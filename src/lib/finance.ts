import type { Ajuste, Cartao, Compra, Config, Dados, FaturaRegistro, Ferias, GastoFixo, Ganho, Jornada, MesRef } from './types'
import { feriadosDoMes } from './feriados'
import { diaDaData, difMeses, mesDaData, somaMes } from './mes'

export const arred = (v: number): number => Math.round(v * 100) / 100

/**
 * Divide o total em n parcelas sem perder centavo: todas iguais e a última
 * absorve a sobra da divisão.
 */
export const valoresParcelas = (total: number, n: number): number[] => {
  const parcelas = Math.max(1, Math.floor(n))
  const centavos = Math.round(total * 100)
  const base = Math.floor(centavos / parcelas)
  const sobra = centavos - base * parcelas
  return Array.from({ length: parcelas }, (_, i) =>
    (base + (i === parcelas - 1 ? sobra : 0)) / 100,
  )
}

/**
 * Mês da fatura em que a compra cai pela primeira vez.
 *
 * A competência usada em todo o sistema é o mês do VENCIMENTO — é o mês em que
 * o dinheiro realmente sai. Compra feita até o dia do fechamento entra na
 * fatura que fecha naquele mês; depois disso, escorrega para a seguinte. Se o
 * vencimento cai antes do fechamento, a fatura vence no mês seguinte ao
 * fechamento.
 */
export const primeiraFaturaDe = (compra: Compra, cartao: Cartao): MesRef => {
  if (compra.primeiraFatura) return compra.primeiraFatura
  const mesCompra = mesDaData(compra.dataCompra)
  const dia = diaDaData(compra.dataCompra)
  const mesFechamento = dia <= cartao.diaFechamento ? mesCompra : somaMes(mesCompra, 1)
  const atrasoVencimento = cartao.diaVencimento > cartao.diaFechamento ? 0 : 1
  return somaMes(mesFechamento, atrasoVencimento)
}

export interface Parcela {
  compra: Compra
  cartao: Cartao
  numero: number
  total: number
  valor: number
  mes: MesRef
  usuarioId: string
}

/** Todas as parcelas de uma compra, já posicionadas no mês de cada fatura. */
export const parcelasDaCompra = (compra: Compra, cartao: Cartao): Parcela[] => {
  const inicio = primeiraFaturaDe(compra, cartao)
  const valores = valoresParcelas(compra.valorTotal, compra.parcelas)
  return valores.map((valor, i) => ({
    compra,
    cartao,
    numero: i + 1,
    total: valores.length,
    valor,
    mes: somaMes(inicio, i),
    usuarioId: compra.usuarioId || cartao.usuarioId || '',
  }))
}

/**
 * Achata as compras COM cartão em parcelas. Base de quase todo cálculo daqui.
 *
 * Compra sem cartão (dinheiro/pix/débito) não entra: ela não tem fatura pra
 * cair, e é resolvida à parte por `todosOsGastosDiretos`.
 */
export const todasAsParcelas = (dados: Dados): Parcela[] => {
  const porId = new Map(dados.cartoes.map((c) => [c.id, c]))
  const out: Parcela[] = []
  for (const compra of dados.compras) {
    if (!compra.cartaoId) continue
    const cartao = porId.get(compra.cartaoId)
    if (!cartao) continue
    out.push(...parcelasDaCompra(compra, cartao))
  }
  return out
}

export interface GastoDireto {
  compra: Compra
  numero: number
  total: number
  valor: number
  mes: MesRef
  usuarioId: string
}

/**
 * Parcelas de uma compra sem cartão: sem fechamento nem vencimento pra
 * decidir a fatura, cada parcela cai um mês depois da outra a partir do mês
 * da própria compra.
 */
export const gastosDiretosDaCompra = (compra: Compra): GastoDireto[] => {
  const inicio = compra.primeiraFatura || mesDaData(compra.dataCompra)
  const valores = valoresParcelas(compra.valorTotal, compra.parcelas)
  return valores.map((valor, i) => ({
    compra,
    numero: i + 1,
    total: valores.length,
    valor,
    mes: somaMes(inicio, i),
    usuarioId: compra.usuarioId || '',
  }))
}

/** Achata as compras SEM cartão. Par de `todasAsParcelas` para as em dinheiro. */
export const todosOsGastosDiretos = (dados: Dados): GastoDireto[] =>
  dados.compras.filter((c) => !c.cartaoId).flatMap(gastosDiretosDaCompra)

export type FiltroPessoas = string[] | null

/**
 * O filtro agora é por integrante da família, não por ficha de pessoa.
 *
 * Registro sem dono é registro meu: nos meus próprios dados o campo vem vazio,
 * porque tudo ali é meu por definição. Ele só chega preenchido na visão da
 * família, onde precisa dizer de quem é cada linha. Sem esse `|| !usuarioId`,
 * filtrar por qualquer pessoa esconderia os meus lançamentos.
 */
const passaFiltro = (usuarioId: string, filtro: FiltroPessoas) =>
  !filtro || filtro.length === 0 || !usuarioId || filtro.includes(usuarioId)

export interface Fatura {
  cartao: Cartao
  mes: MesRef
  itens: Parcela[]
  /** Soma das parcelas que passaram no filtro de pessoa. */
  calculado: number
  /** Soma de todas as parcelas do cartão no mês, ignorando o filtro. */
  calculadoTotal: number
  valorInformado?: number
  /** O que vale para o orçamento: informado (rateado pelo filtro) ou calculado. */
  valor: number
  paga: boolean
  registro?: FaturaRegistro
}

export const registroFatura = (
  faturas: FaturaRegistro[],
  cartaoId: string,
  mes: MesRef,
): FaturaRegistro | undefined => faturas.find((f) => f.cartaoId === cartaoId && f.mes === mes)

/**
 * Fatura de um cartão num mês. Quando existe valor informado pelo banco, ele
 * manda — e, se houver filtro de pessoa, é rateado na proporção das parcelas
 * daquela pessoa, para a soma das visões continuar batendo com o total.
 */
export const faturaDoCartao = (
  dados: Dados,
  cartao: Cartao,
  mes: MesRef,
  filtro: FiltroPessoas = null,
  parcelas?: Parcela[],
): Fatura => {
  const base = (parcelas ?? todasAsParcelas(dados)).filter(
    (p) => p.cartao.id === cartao.id && p.mes === mes,
  )
  const itens = base.filter((p) => passaFiltro(p.usuarioId, filtro))
  const calculadoTotal = arred(base.reduce((s, p) => s + p.valor, 0))
  const calculado = arred(itens.reduce((s, p) => s + p.valor, 0))
  const registro = registroFatura(dados.faturas, cartao.id, mes)
  const informado = registro?.valorInformado

  let valor = calculado
  if (informado != null) {
    if (calculadoTotal > 0) valor = arred(informado * (calculado / calculadoTotal))
    else if (passaFiltro(cartao.usuarioId ?? '', filtro)) valor = informado
    else valor = 0
  }

  return {
    cartao,
    mes,
    itens: itens.slice().sort((a, b) => b.valor - a.valor),
    calculado,
    calculadoTotal,
    valorInformado: informado,
    valor,
    paga: !!registro?.paga,
    registro,
  }
}

export interface UsoLimite {
  cartao: Cartao
  limite: number
  /** Parcelas ainda não pagas: fatura do mês de referência em diante. */
  usado: number
  disponivel: number
  percentual: number
  parcelasAbertas: number
}

/**
 * Limite comprometido. Conta a fatura do mês de referência e todas as
 * seguintes — é o que o banco só libera de volta conforme as faturas são pagas.
 */
export const usoDoLimite = (
  dados: Dados,
  cartao: Cartao,
  mesRef: MesRef,
  parcelas?: Parcela[],
): UsoLimite => {
  const abertas = (parcelas ?? todasAsParcelas(dados)).filter(
    (p) => p.cartao.id === cartao.id && difMeses(mesRef, p.mes) >= 0,
  )
  const usado = arred(abertas.reduce((s, p) => s + p.valor, 0))
  return {
    cartao,
    limite: cartao.limite,
    usado,
    disponivel: arred(cartao.limite - usado),
    percentual: cartao.limite > 0 ? Math.min(100, (usado / cartao.limite) * 100) : 0,
    parcelasAbertas: abertas.length,
  }
}

const dentroDoIntervalo = (
  item: { recorrencia: 'mensal' | 'unica'; mesInicio: MesRef; mesFim?: MesRef },
  mes: MesRef,
) => {
  if (item.recorrencia === 'unica') return item.mesInicio === mes
  if (difMeses(item.mesInicio, mes) < 0) return false
  if (item.mesFim && difMeses(item.mesFim, mes) > 0) return false
  return true
}

/**
 * Cartão que um formulário novo deve assumir. A ordem de preferência é: o
 * último cartão usado, o primeiro ativo, qualquer um — sempre dentro da
 * pessoa em foco, e só caindo para a lista inteira se ela não tiver nenhum.
 *
 * O último usado só ganha se ele estiver entre os cartões oferecidos: trocar
 * a visão para a Leticia não pode abrir a compra no cartão do Luiz.
 */
export const primeiroCartao = (
  emFoco: Cartao[],
  todos: Cartao[],
  ultimoUsado?: string,
): string => {
  const escolher = (cs: Cartao[]) =>
    cs.find((c) => c.id === ultimoUsado)?.id ?? cs.find((c) => c.ativo)?.id ?? cs[0]?.id
  return escolher(emFoco) ?? escolher(todos) ?? ''
}

/**
 * Valor que vale no mês: o ajuste mais recente que já entrou em vigor, senão
 * o valor de cadastro. É o que faz um aumento contar só dali para frente sem
 * reescrever o passado.
 */
export const valorNoMes = (item: { valor: number; ajustes?: Ajuste[] }, mes: MesRef): number => {
  const vigentes = (item.ajustes ?? []).filter((a) => difMeses(a.mes, mes) >= 0)
  if (vigentes.length === 0) return item.valor
  return vigentes.reduce((atual, a) => (difMeses(atual.mes, a.mes) >= 0 ? a : atual)).valor
}

/** Ajuste que está valendo no mês, quando existe — para explicar o valor na tela. */
export const ajusteVigente = (
  item: { ajustes?: Ajuste[] },
  mes: MesRef,
): Ajuste | undefined => {
  const vigentes = (item.ajustes ?? []).filter((a) => difMeses(a.mes, mes) >= 0)
  if (vigentes.length === 0) return undefined
  return vigentes.reduce((atual, a) => (difMeses(atual.mes, a.mes) >= 0 ? a : atual))
}

/* ---------------------------------- férias -------------------------------- */

/**
 * A folha de pagamento conta o mês como 30 dias, sempre — fevereiro incluído.
 * É assim na CLT (art. 64 e seguintes) e é assim que o valor bate com o
 * contracheque; usar o número real de dias daria uma diferença de centavos
 * todo mês e nenhuma delas apareceria no papel.
 */
const DIAS_MES = 30

export interface ParteFerias {
  rotulo: string
  valor: number
}

export interface EfeitoFerias {
  ferias: Ferias
  /** Quanto as férias somam (positivo) ou tiram (negativo) neste mês. */
  valor: number
  /** A conta aberta, para a tela poder mostrar de onde saiu cada parcela. */
  partes: ParteFerias[]
  /** 'gozo' é o mês das férias; 'desconto', o mês seguinte. */
  fase: 'gozo' | 'desconto'
}

const arredCentavos = (v: number) => Math.round(v * 100) / 100

/**
 * O que as férias fazem com o salário num mês.
 *
 * O desenho é o do adiantamento, que é como a folha brasileira funciona: no
 * mês das férias entra o salário normal MAIS os dias de férias pagos na frente,
 * e no mês seguinte esses mesmos dias saem do salário, porque já foram pagos.
 * Somando os dois meses, a pessoa recebeu dois salários — mais o terço e o
 * abono, que são dinheiro novo de verdade.
 *
 * Sem o desconto do mês seguinte, o app prometeria um dinheiro que já foi
 * gasto: é exatamente o erro que quebra o orçamento de quem volta de férias.
 */
export function efeitoFeriasNoMes(ganho: Ganho, mes: MesRef): EfeitoFerias | null {
  for (const f of ganho.ferias ?? []) {
    const base = valorNoMes(ganho, f.mes)
    const porDia = base / DIAS_MES

    if (f.mes === mes) {
      const adiantamento = arredCentavos(porDia * f.dias)
      const abono = arredCentavos(porDia * f.diasVendidos)
      // O terço constitucional (art. 7º, XVII) incide sobre os dias de descanso
      // e também sobre os vendidos — é o que a Súmula 328 do TST firmou.
      const terco = arredCentavos((porDia * (f.dias + f.diasVendidos)) / 3)
      const partes: ParteFerias[] = [{ rotulo: `Férias (${f.dias} dias)`, valor: adiantamento }]
      if (abono > 0) partes.push({ rotulo: `Abono (${f.diasVendidos} dias vendidos)`, valor: abono })
      partes.push({ rotulo: 'Um terço constitucional', valor: terco })
      return {
        ferias: f,
        valor: arredCentavos(adiantamento + abono + terco),
        partes,
        fase: 'gozo',
      }
    }

    if (somaMes(f.mes, 1) === mes) {
      const desconto = -arredCentavos(porDia * f.dias)
      return {
        ferias: f,
        valor: desconto,
        partes: [{ rotulo: `Dias de férias já adiantados (${f.dias})`, valor: desconto }],
        fase: 'desconto',
      }
    }
  }
  return null
}

/** Dias de férias que uma pessoa tira no mês — o que suspende os benefícios. */
export const diasDeFeriasNoMes = (dados: Dados, usuarioId: string | undefined, mes: MesRef): number =>
  dados.ganhos
    .filter((g) => (g.usuarioId ?? '') === (usuarioId ?? ''))
    .flatMap((g) => g.ferias ?? [])
    .filter((f) => f.mes === mes)
    .reduce((s, f) => s + f.dias, 0)

/* ------------------------- dias efetivamente trabalhados ------------------- */

/** Segunda a sexta, que é o caso da maioria e o padrão quando nada foi dito. */
const JORNADA_PADRAO: Jornada = {
  tipo: 'semana',
  diasSemana: [1, 2, 3, 4, 5],
  folgaEmFeriado: true,
}

const diasDoMes = (mes: MesRef): number => {
  const [ano, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(ano, m, 0)).getUTCDate()
}

/**
 * Quantos dias a pessoa trabalha no mês, já descontados feriados e férias.
 *
 * É a base do vale-refeição e de qualquer benefício pago por dia. A conta é
 * feita dia a dia, e não por uma média, porque a média erra sempre: um mês com
 * dois feriados na semana perde dois dias de vale, e nenhum "22 dias úteis
 * fixos" mostraria isso.
 *
 * As férias entram proporcionalmente. Elas são marcadas por mês e quantidade de
 * dias, sem data de início — proporcional é a única resposta honesta com o que
 * o app sabe, e erra por no máximo um dia.
 */
export function diasTrabalhaveisNoMes(
  mes: MesRef,
  config: Pick<Config, 'uf' | 'cidade' | 'jornada'>,
  diasDeFerias = 0,
): number {
  const jornada = config.jornada ?? JORNADA_PADRAO
  const [ano, m] = mes.split('-').map(Number)
  const total = diasDoMes(mes)

  const feriados = jornada.folgaEmFeriado
    ? new Set(feriadosDoMes(mes, config.uf, config.cidade).map((f) => f.data))
    : new Set<string>()

  let dias = 0
  for (let dia = 1; dia <= total; dia++) {
    const data = new Date(Date.UTC(ano, m - 1, dia))
    const iso = data.toISOString().slice(0, 10)
    if (feriados.has(iso)) continue

    if (jornada.tipo === 'escala') {
      const trabalha = jornada.escalaTrabalha ?? 1
      const folga = jornada.escalaFolga ?? 1
      const ciclo = trabalha + folga
      if (ciclo <= 0) continue
      const inicio = jornada.escalaInicio
        ? Date.parse(`${jornada.escalaInicio}T00:00:00Z`)
        : Date.UTC(ano, 0, 1)
      const passados = Math.floor((data.getTime() - inicio) / 86_400_000)
      // Resto sempre positivo: um dia ANTES do início do ciclo não pode virar
      // índice negativo e cair no lado errado da escala.
      const posicao = ((passados % ciclo) + ciclo) % ciclo
      if (posicao < trabalha) dias++
      continue
    }

    const semana = jornada.diasSemana ?? JORNADA_PADRAO.diasSemana!
    if (semana.includes(data.getUTCDay())) dias++
  }

  if (diasDeFerias > 0) {
    const fracaoParada = Math.min(1, diasDeFerias / 30)
    dias = Math.round(dias * (1 - fracaoParada))
  }
  return dias
}

/**
 * Benefício não é salário: vale-refeição é creditado por dia trabalhado, então
 * em feriado e em férias ele simplesmente não vem.
 */
const CATEGORIA_BENEFICIO = 'Benefícios'

/* Nos dois casos o valor sai já resolvido para o mês — quem soma não precisa saber de ajuste. */
export const ganhosDoMes = (dados: Dados, mes: MesRef, filtro: FiltroPessoas = null): Ganho[] =>
  dados.ganhos
    .filter((g) => dentroDoIntervalo(g, mes) && passaFiltro(g.usuarioId ?? '', filtro))
    .map((g) => {
      const base = valorNoMes(g, mes)

      /* Valor por dia: o mês é a multiplicação, não o cadastro. Vale para o
         vale-refeição, e para qualquer coisa creditada por dia trabalhado. */
      if (g.porDiaUtil) {
        const ferias = diasDeFeriasNoMes(dados, g.usuarioId, mes)
        const uteis = diasTrabalhaveisNoMes(mes, dados.config, ferias)
        return { ...g, valor: arredCentavos(base * uteis) }
      }

      /* Benefício de valor mensal fechado: só encolhe na proporção das férias. */
      if (g.categoria === CATEGORIA_BENEFICIO) {
        const dias = diasDeFeriasNoMes(dados, g.usuarioId, mes)
        if (dias <= 0) return { ...g, valor: base }
        const trabalhados = Math.max(0, DIAS_MES - dias)
        return { ...g, valor: arredCentavos((base / DIAS_MES) * trabalhados) }
      }

      const efeito = efeitoFeriasNoMes(g, mes)
      return { ...g, valor: arredCentavos(base + (efeito?.valor ?? 0)) }
    })

export const gastosFixosDoMes = (
  dados: Dados,
  mes: MesRef,
  filtro: FiltroPessoas = null,
): GastoFixo[] =>
  dados.gastosFixos
    .filter((g) => dentroDoIntervalo(g, mes) && passaFiltro(g.usuarioId ?? '', filtro))
    .map((g) => ({ ...g, valor: valorNoMes(g, mes) }))

export interface ResumoMes {
  mes: MesRef
  ganhos: number
  faturas: number
  fixos: number
  avulsos: number
  gastos: number
  saldo: number
  faturasPorCartao: Fatura[]
  detalheGanhos: Ganho[]
  detalheFixos: GastoFixo[]
  detalheAvulsos: GastoDireto[]
  parcelas: Parcela[]
}

export const resumoDoMes = (
  dados: Dados,
  mes: MesRef,
  filtro: FiltroPessoas = null,
  parcelas?: Parcela[],
  diretos?: GastoDireto[],
): ResumoMes => {
  const todas = parcelas ?? todasAsParcelas(dados)
  const todosDiretos = diretos ?? todosOsGastosDiretos(dados)
  const relevantes = dados.cartoes.filter(
    (c) => c.ativo || todas.some((p) => p.cartao.id === c.id && p.mes === mes),
  )
  const faturasPorCartao = relevantes.map((c) => faturaDoCartao(dados, c, mes, filtro, todas))
  const detalheGanhos = ganhosDoMes(dados, mes, filtro)
  const detalheFixos = gastosFixosDoMes(dados, mes, filtro)
  const detalheAvulsos = todosDiretos.filter((d) => d.mes === mes && passaFiltro(d.usuarioId, filtro))

  const faturas = arred(faturasPorCartao.reduce((s, f) => s + f.valor, 0))
  const ganhos = arred(detalheGanhos.reduce((s, g) => s + g.valor, 0))
  const fixos = arred(detalheFixos.reduce((s, g) => s + g.valor, 0))
  const avulsos = arred(detalheAvulsos.reduce((s, d) => s + d.valor, 0))
  const gastos = arred(faturas + fixos + avulsos)

  return {
    mes,
    ganhos,
    faturas,
    fixos,
    avulsos,
    gastos,
    saldo: arred(ganhos - gastos),
    faturasPorCartao: faturasPorCartao.slice().sort((a, b) => b.valor - a.valor),
    detalheGanhos,
    detalheFixos,
    detalheAvulsos,
    parcelas: todas.filter((p) => p.mes === mes && passaFiltro(p.usuarioId, filtro)),
  }
}

export const projecao = (
  dados: Dados,
  mesInicio: MesRef,
  quantidade: number,
  filtro: FiltroPessoas = null,
): ResumoMes[] => {
  const todas = todasAsParcelas(dados)
  const diretos = todosOsGastosDiretos(dados)
  return Array.from({ length: quantidade }, (_, i) =>
    resumoDoMes(dados, somaMes(mesInicio, i), filtro, todas, diretos),
  )
}

/** Gastos do mês agrupados por categoria — junta parcelas de cartão, avulsos e gastos fixos. */
export const porCategoria = (resumo: ResumoMes): { categoria: string; valor: number }[] => {
  const mapa = new Map<string, number>()
  const soma = (k: string, v: number) => mapa.set(k, arred((mapa.get(k) ?? 0) + v))
  for (const p of resumo.parcelas) soma(p.compra.categoria || 'Outros', p.valor)
  for (const d of resumo.detalheAvulsos) soma(d.compra.categoria || 'Outros', d.valor)
  for (const f of resumo.detalheFixos) soma(f.categoria || 'Outros', f.valor)
  return [...mapa.entries()]
    .map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor)
}

/**
 * Quebra por integrante da família. Recebe os ids de fora porque o estado é
 * que sabe quem está na família — finance.ts continua sendo só cálculo.
 */
export const porMembro = (
  dados: Dados,
  mes: MesRef,
  membros: string[],
  parcelas?: Parcela[],
): { usuarioId: string; ganhos: number; gastos: number; saldo: number }[] => {
  const todas = parcelas ?? todasAsParcelas(dados)
  return membros.map((id) => {
    const r = resumoDoMes(dados, mes, [id], todas)
    return { usuarioId: id, ganhos: r.ganhos, gastos: r.gastos, saldo: r.saldo }
  })
}
