import type { Cartao, MesRef } from './types'
import { lerValor } from './formato'
import { hojeIso, mesAtual, partesMes } from './mes'

/* --------------------------------------------------------------------------
   Leitura de print de compra.

   O OCR devolve texto solto e torto; o que interessa é achar quatro coisas:
   valor, número de parcelas, data e em qual cartão foi. Cada uma tem uma
   confiança própria — o formulário mostra o que foi achado e o usuário
   confirma antes de salvar. Nada é lançado sem passar pela tela.
-------------------------------------------------------------------------- */

const MESES_NOME: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
}

/** Linhas que nunca são o nome do estabelecimento. */
const RUIDO =
  /^(total|subtotal|valor|data|hora|parcel|compra|cart[ãa]o|cr[ée]dito|d[ée]bito|aprovad|conclu[íi]d|pagamento|recibo|comprovante|estabelecimento|transa[çc][ãa]o|autoriza|nsu|doc|id da|c[óo]digo|banco|fatura|limite|dispon[íi]vel|vencimento|saldo|r\$|pix|via|status)/i

const MOEDA_RE = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g

export interface Sugestao {
  valorTotal: number
  parcelas: number
  dataCompra: string
  cartaoId: string
  descricao: string
  categoria: string
  /** O que o parser realmente encontrou, para a tela sinalizar o que é palpite. */
  achou: {
    valor: boolean
    parcelas: boolean
    data: boolean
    cartao: boolean
    descricao: boolean
  }
  /** Candidatas a lançamento quando o print é uma lista (extrato/fatura). */
  itens: { descricao: string; valor: number; parcelas?: number }[]
}

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/* --------------------------------- valor --------------------------------- */

/**
 * Prefere o valor que vem rotulado como total. Sem rótulo, fica com o maior —
 * num comprovante o maior número quase sempre é o total da compra.
 */
const acharValor = (linhas: string[]): { valor: number; explicito: boolean } => {
  const rotulados: number[] = []
  const todos: number[] = []

  for (const linha of linhas) {
    const achados = [...linha.matchAll(MOEDA_RE)].map((m) => lerValor(m[1]!))
    if (achados.length === 0) continue
    todos.push(...achados)
    if (/total|valor\s*(da|do)?\s*(compra|pagamento|transa)|valor\s*pago|^valor/i.test(linha)) {
      rotulados.push(...achados)
    }
  }

  // Numa linha de parcelamento ("12x de R$ 100,00") o valor é da parcela, não do total.
  const validos = (lista: number[]) => lista.filter((v) => v > 0)
  const escolha = validos(rotulados).length ? Math.max(...validos(rotulados)) : 0
  if (escolha) return { valor: escolha, explicito: true }
  const restantes = validos(todos)
  return { valor: restantes.length ? Math.max(...restantes) : 0, explicito: false }
}

/* -------------------------------- parcelas ------------------------------- */

const acharParcelas = (texto: string): { parcelas: number; achou: boolean } => {
  const t = normalizar(texto)
  const padroes: RegExp[] = [
    /(?:em|de)\s*(\d{1,2})\s*(?:x|vezes|parcelas)/,
    /(\d{1,2})\s*x\s*(?:de\s*)?r?\$?/,
    /parcelad[ao]\s*(?:em)?\s*(\d{1,2})/,
    /parcela\s*\d{1,2}\s*(?:de|\/)\s*(\d{1,2})/,
    /(\d{1,2})\s*parcelas/,
  ]
  for (const re of padroes) {
    const m = t.match(re)
    const n = m ? Number(m[1]) : 0
    if (n >= 1 && n <= 48) return { parcelas: n, achou: true }
  }
  if (/a\s*vista|debito|1\s*x\b/.test(t)) return { parcelas: 1, achou: true }
  return { parcelas: 1, achou: false }
}

/* ---------------------------------- data --------------------------------- */

const acharData = (texto: string): { data: string; achou: boolean } => {
  const hoje = new Date()

  // Varre todos os candidatos: num comprovante, "2.499,00" tambem casa com o
  // formato de data, e parar no primeiro faria a data verdadeira ser perdida.
  for (const m of texto.matchAll(/(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/g)) {
    // Descarta o que e claramente valor monetario ("1.234,56").
    const depois = texto.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 1)
    if (depois === ',') continue

    const dia = Number(m[1])
    const mes = Number(m[2])
    let ano = m[3] ? Number(m[3]) : hoje.getFullYear()
    if (ano < 100) ano += 2000
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 2000 || ano > 2100) continue

    return {
      data: `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
      achou: true,
    }
  }

  const porNome = normalizar(texto).match(/(\d{1,2})\s*(?:de\s*)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\w*\.?\s*(?:de\s*)?(\d{4})?/)
  if (porNome) {
    const dia = Number(porNome[1])
    const mes = MESES_NOME[porNome[2]!]!
    const ano = porNome[3] ? Number(porNome[3]) : hoje.getFullYear()
    if (dia >= 1 && dia <= 31) {
      return {
        data: `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
        achou: true,
      }
    }
  }

  return { data: hojeIso(), achou: false }
}

/* --------------------------------- cartão -------------------------------- */

/**
 * Pontua cada cartão cadastrado contra o texto: últimos dígitos valem mais que
 * o apelido, que vale mais que o nome do banco.
 */
const acharCartao = (
  texto: string,
  cartoes: Cartao[],
  nomeBanco: (id: string) => string,
): { cartaoId: string; achou: boolean } => {
  const t = normalizar(texto)
  let melhor = { id: '', pontos: 0 }

  for (const c of cartoes) {
    let pontos = 0
    if (c.ultimosDigitos && new RegExp(`\\b${c.ultimosDigitos}\\b`).test(t)) pontos += 6

    const palavrasApelido = normalizar(c.apelido)
      .split(/\s+/)
      .filter((p) => p.length >= 3)
    for (const p of palavrasApelido) if (t.includes(p)) pontos += 3

    const banco = normalizar(nomeBanco(c.bancoId))
      .split(/\s+/)
      .filter((p) => p.length >= 3)
    for (const p of banco) if (t.includes(p)) pontos += 2

    if (pontos > melhor.pontos) melhor = { id: c.id, pontos }
  }

  if (melhor.pontos >= 2) return { cartaoId: melhor.id, achou: true }
  const padrao = cartoes.find((c) => c.ativo) ?? cartoes[0]
  return { cartaoId: padrao?.id ?? '', achou: false }
}

/* ------------------------------- descrição ------------------------------- */

const acharDescricao = (linhas: string[]): { descricao: string; achou: boolean } => {
  const candidatas = linhas
    .map((l) => l.replace(/[|_]+/g, ' ').trim())
    .filter((l) => l.length >= 4 && l.length <= 48)
    .filter((l) => !RUIDO.test(l))
    .filter((l) => !/\d{2},\d{2}/.test(l))
    .filter((l) => (l.match(/[A-Za-zÀ-ú]/g)?.length ?? 0) >= l.length * 0.55)

  if (candidatas.length === 0) return { descricao: '', achou: false }
  // A primeira candidata longa costuma ser o estabelecimento.
  const escolhida = candidatas.sort((a, b) => b.length - a.length)[0]!
  return { descricao: escolhida.replace(/\s{2,}/g, ' '), achou: true }
}

/* ------------------------------- categoria ------------------------------- */

const PISTAS_CATEGORIA: [RegExp, string][] = [
  [/mercado|supermerc|carrefour|assai|atacad|pao de acucar|extra|big|hortifr/i, 'Mercado'],
  [/ifood|rappi|restaur|lanch|pizza|burger|cafe|padaria|bar\b/i, 'Restaurante'],
  [/uber|cabify|taxi|metro|onibus|passagem|estacion|(?<![\d.,])99(?![\d.,])/i, 'Transporte'],
  [/posto|shell|ipiranga|petrobras|ale\b|combust|gasolin|etanol/i, 'Combustível'],
  [/farmac|drogar|drogas?il|pacheco|raia/i, 'Farmácia'],
  [/hospital|clinic|laborat|exame|dentist|consult|unimed|amil/i, 'Saúde'],
  [/netflix|spotify|disney|hbo|max\b|prime|youtube|assinat|google one|icloud|office/i, 'Assinaturas'],
  [/renner|riachuelo|zara|cea|c&a|centauro|nike|adidas|calcad|roupa/i, 'Vestuário'],
  [/magalu|magazine|americanas|casas bahia|amazon|mercado livre|kabum|pichau/i, 'Eletrônicos'],
  [/cinema|ingresso|show|steam|playstation|xbox|nintendo|jogo/i, 'Lazer'],
  [/hotel|airbnb|latam|gol\b|azul\b|booking|decolar|passagem aere/i, 'Viagem'],
  [/petz|cobasi|veterin|racao/i, 'Pet'],
  [/escola|colegio|curso|faculdade|udemy|alura/i, 'Educação'],
  [/leroy|telha|obramax|construc|tinta|cimento/i, 'Casa'],
]

const acharCategoria = (texto: string): string => {
  for (const [re, cat] of PISTAS_CATEGORIA) if (re.test(texto)) return cat
  return 'Outros'
}

/* ---------------------------- lista de itens ----------------------------- */

/**
 * Quando o print é um extrato ou uma fatura, cada linha com descrição + valor
 * é um lançamento em potencial. Devolve as linhas nesse formato para o usuário
 * escolher quais quer importar.
 */
const acharItens = (linhas: string[]): Sugestao['itens'] => {
  const itens: Sugestao['itens'] = []
  for (const linha of linhas) {
    const valores = [...linha.matchAll(MOEDA_RE)]
    if (valores.length !== 1) continue
    const valor = lerValor(valores[0]![1]!)
    if (valor <= 0) continue

    const descricao = linha
      .replace(MOEDA_RE, '')
      .replace(/R\$/gi, '')
      .replace(/\d{1,2}\s*\/\s*\d{1,2}/g, '')
      .replace(/[-–|·]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()

    if (descricao.length < 3 || RUIDO.test(descricao)) continue
    const parcelas = linha.match(/(\d{1,2})\s*\/\s*(\d{1,2})/)
    itens.push({
      descricao,
      valor,
      parcelas: parcelas ? Number(parcelas[2]) : undefined,
    })
  }
  return itens
}

/* -------------------------------- entrada -------------------------------- */

export const interpretar = (
  texto: string,
  cartoes: Cartao[],
  nomeBanco: (id: string) => string,
): Sugestao => {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const valor = acharValor(linhas)
  const parcelas = acharParcelas(texto)
  const data = acharData(texto)
  const cartao = acharCartao(texto, cartoes, nomeBanco)
  const descricao = acharDescricao(linhas)

  return {
    valorTotal: valor.valor,
    parcelas: parcelas.parcelas,
    dataCompra: data.data,
    cartaoId: cartao.cartaoId,
    descricao: descricao.descricao,
    categoria:
      (descricao.descricao && acharCategoria(descricao.descricao) !== 'Outros'
        ? acharCategoria(descricao.descricao)
        : acharCategoria(texto)),
    achou: {
      valor: valor.valor > 0,
      parcelas: parcelas.achou,
      data: data.achou,
      cartao: cartao.achou,
      descricao: descricao.achou,
    },
    itens: acharItens(linhas),
  }
}

/** Mês de referência para textos que só trazem "fatura de agosto". */
export const mesDoTexto = (texto: string): MesRef => {
  const m = normalizar(texto).match(/fatura\s*(?:de\s*)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/)
  if (!m) return mesAtual()
  const [ano] = partesMes(mesAtual())
  return `${ano}-${String(MESES_NOME[m[1]!]).padStart(2, '0')}`
}
