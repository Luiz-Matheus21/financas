/**
 * Testes do motor financeiro: em qual fatura a compra cai, como as parcelas se
 * espalham, quanto de limite fica preso e o que sobra no mês.
 *
 * Uso: npm run testar:financeiro
 */
import { build } from 'esbuild'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const saida = join(RAIZ, 'dist-electron', 'teste-financeiro.mjs')

await build({
  entryPoints: [join(RAIZ, 'src', 'lib', 'finance.ts')],
  outfile: saida,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  logLevel: 'silent',
})

const F = await import(pathToFileURL(saida).href)

let falhas = 0
let total = 0

const eq = (rotulo, obtido, esperado) => {
  total++
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado)
  if (!ok) falhas++
  console.log(
    `  ${ok ? 'OK    ' : 'FALHOU'} ${rotulo}` +
      (ok ? '' : `\n         obtido:   ${JSON.stringify(obtido)}\n         esperado: ${JSON.stringify(esperado)}`),
  )
}

const cartao = (extra) => ({
  id: 'c1',
  apelido: 'Cartao',
  bancoId: 'nubank',
  bandeira: 'mastercard',
  usuarioId: 'p1',
  limite: 10000,
  diaFechamento: 25,
  diaVencimento: 5,
  ativo: true,
  criadoEm: '',
  ...extra,
})

const compra = (extra) => ({
  id: 'x1',
  cartaoId: 'c1',
  descricao: 'Compra',
  valorTotal: 300,
  parcelas: 1,
  dataCompra: '2026-08-20',
  categoria: 'Outros',
  criadoEm: '',
  ...extra,
})

/* ----------------------- divisão de parcelas ----------------------- */
console.log('\n=== divisao de parcelas ===')
eq('1000 em 3x fecha em 1000', F.valoresParcelas(1000, 3).reduce((a, b) => a + b, 0), 1000)
eq('1000 em 3x', F.valoresParcelas(1000, 3), [333.33, 333.33, 333.34])
eq('100 em 1x', F.valoresParcelas(100, 1), [100])
eq('0,05 em 2x', F.valoresParcelas(0.05, 2), [0.02, 0.03])
eq('2499 em 10x', F.valoresParcelas(2499, 10), Array(10).fill(249.9))

/* ------------------------- mês da fatura --------------------------- */
console.log('\n=== em qual fatura a compra cai ===')
const fechaVinteCinco = cartao({ diaFechamento: 25, diaVencimento: 5 })
eq(
  'fecha 25 / vence 5, compra em 20/08 -> vence em setembro',
  F.primeiraFaturaDe(compra({ dataCompra: '2026-08-20' }), fechaVinteCinco),
  '2026-09',
)
eq(
  'fecha 25 / vence 5, compra em 28/08 (depois do fechamento) -> outubro',
  F.primeiraFaturaDe(compra({ dataCompra: '2026-08-28' }), fechaVinteCinco),
  '2026-10',
)
eq(
  'fecha 25 / vence 5, compra em 25/08 (no dia do fechamento) -> setembro',
  F.primeiraFaturaDe(compra({ dataCompra: '2026-08-25' }), fechaVinteCinco),
  '2026-09',
)
eq(
  'compra em 28/12 vira fatura de fevereiro do ano seguinte',
  F.primeiraFaturaDe(compra({ dataCompra: '2026-12-28' }), fechaVinteCinco),
  '2027-02',
)

const venceDepois = cartao({ diaFechamento: 10, diaVencimento: 20 })
eq(
  'fecha 10 / vence 20, compra em 05/08 -> vence no proprio agosto',
  F.primeiraFaturaDe(compra({ dataCompra: '2026-08-05' }), venceDepois),
  '2026-08',
)
eq(
  'fecha 10 / vence 20, compra em 15/08 -> setembro',
  F.primeiraFaturaDe(compra({ dataCompra: '2026-08-15' }), venceDepois),
  '2026-09',
)
eq(
  'primeira fatura forcada pelo usuario manda',
  F.primeiraFaturaDe(compra({ dataCompra: '2026-08-05', primeiraFatura: '2026-11' }), venceDepois),
  '2026-11',
)

/* ------------------------- parcelas no tempo ----------------------- */
console.log('\n=== parcelas espalhadas nos meses ===')
const dozeVezes = F.parcelasDaCompra(
  compra({ valorTotal: 1200, parcelas: 12, dataCompra: '2026-08-20' }),
  fechaVinteCinco,
)
eq('12 parcelas geradas', dozeVezes.length, 12)
eq('primeira em setembro/2026', dozeVezes[0].mes, '2026-09')
eq('ultima em agosto/2027', dozeVezes[11].mes, '2027-08')
eq('cada parcela de 100', [...new Set(dozeVezes.map((p) => p.valor))], [100])

/* ------------------------------ limite ----------------------------- */
console.log('\n=== limite comprometido ===')
const dados = {
  versao: 1,
  pessoas: [
    { id: 'p1', nome: 'Matheus', cor: '#2FD98F', criadoEm: '' },
    { id: 'p2', nome: 'Leticia', cor: '#60A5FA', criadoEm: '' },
  ],
  cartoes: [fechaVinteCinco],
  compras: [
    compra({ id: 'a', valorTotal: 1200, parcelas: 12, dataCompra: '2026-08-20' }),
    compra({ id: 'b', valorTotal: 500, parcelas: 1, dataCompra: '2026-08-20', usuarioId: 'p2' }),
  ],
  ganhos: [
    {
      id: 'g1',
      usuarioId: 'p1',
      descricao: 'Salario',
      valor: 8000,
      categoria: 'Salário',
      recorrencia: 'mensal',
      mesInicio: '2026-01',
      criadoEm: '',
    },
    {
      id: 'g2',
      usuarioId: 'p2',
      descricao: 'Salario',
      valor: 5000,
      categoria: 'Salário',
      recorrencia: 'mensal',
      mesInicio: '2026-01',
      criadoEm: '',
    },
    {
      id: 'g3',
      usuarioId: 'p1',
      descricao: 'Bonus',
      valor: 3000,
      categoria: 'Bônus',
      recorrencia: 'unica',
      mesInicio: '2026-09',
      criadoEm: '',
    },
  ],
  gastosFixos: [
    {
      id: 'f1',
      usuarioId: 'p1',
      descricao: 'Aluguel',
      valor: 2500,
      categoria: 'Moradia',
      recorrencia: 'mensal',
      mesInicio: '2026-01',
      criadoEm: '',
    },
  ],
  faturas: [],
  config: { tema: 'dark', reservaMinima: 0 },
}

const uso = F.usoDoLimite(dados, fechaVinteCinco, '2026-09')
eq('usado em setembro = 12x100 + 500', uso.usado, 1700)
eq('disponivel = 10000 - 1700', uso.disponivel, 8300)
eq('depois de pagar setembro, usado cai para 1100', F.usoDoLimite(dados, fechaVinteCinco, '2026-10').usado, 1100)
eq('limite volta ao normal apos a ultima parcela', F.usoDoLimite(dados, fechaVinteCinco, '2027-09').usado, 0)

/* ------------------------- resumo do mês --------------------------- */
console.log('\n=== resumo do mes ===')
const setembro = F.resumoDoMes(dados, '2026-09')
eq('ganhos de setembro (8000 + 5000 + bonus 3000)', setembro.ganhos, 16000)
eq('fatura de setembro (100 + 500)', setembro.faturas, 600)
eq('gastos fixos', setembro.fixos, 2500)
eq('sobra', setembro.saldo, 12900)

const outubro = F.resumoDoMes(dados, '2026-10')
eq('bonus nao repete em outubro', outubro.ganhos, 13000)
eq('fatura de outubro so a parcela', outubro.faturas, 100)

console.log('\n=== visao por pessoa ===')
const soMatheus = F.resumoDoMes(dados, '2026-09', ['p1'])
const soLeticia = F.resumoDoMes(dados, '2026-09', ['p2'])
eq('ganhos do Matheus', soMatheus.ganhos, 11000)
eq('ganhos da Leticia', soLeticia.ganhos, 5000)
eq('fatura atribuida ao Matheus (parcela do cartao dele)', soMatheus.faturas, 100)
eq('fatura atribuida a Leticia (compra marcada como dela)', soLeticia.faturas, 500)
eq(
  'a soma das duas visoes bate com o total',
  F.arred(soMatheus.gastos + soLeticia.gastos),
  setembro.gastos,
)

/* ---------------------- valor informado pelo banco ----------------- */
console.log('\n=== valor informado pelo banco ===')
const comInformado = {
  ...dados,
  faturas: [{ cartaoId: 'c1', mes: '2026-09', valorInformado: 660 }],
}
eq(
  'o valor informado substitui o calculado',
  F.faturaDoCartao(comInformado, fechaVinteCinco, '2026-09').valor,
  660,
)
const rateioM = F.faturaDoCartao(comInformado, fechaVinteCinco, '2026-09', ['p1']).valor
const rateioL = F.faturaDoCartao(comInformado, fechaVinteCinco, '2026-09', ['p2']).valor
eq('rateio proporcional para o Matheus (100/600 de 660)', rateioM, 110)
eq('rateio proporcional para a Leticia (500/600 de 660)', rateioL, 550)
eq('o rateio nao perde nem cria dinheiro', F.arred(rateioM + rateioL), 660)

/* ----------------------------- categorias -------------------------- */
console.log('\n=== agrupamento por categoria ===')
const cats = F.porCategoria(setembro)
eq('categoria de maior peso e Moradia (aluguel)', cats[0].categoria, 'Moradia')
eq(
  'a soma das categorias bate com os gastos do mes',
  F.arred(cats.reduce((s, c) => s + c.valor, 0)),
  setembro.gastos,
)

/* -------------------- aumento a partir de um mes -------------------- */
console.log('\n=== reajuste de ganho mensal (aumento) ===')
const salario = {
  id: 'g9',
  usuarioId: 'p1',
  descricao: 'Salario',
  valor: 5000,
  categoria: 'Salario',
  recorrencia: 'mensal',
  mesInicio: '2026-01',
  ajustes: [
    { mes: '2026-09', valor: 6000 },
    { mes: '2027-03', valor: 6500 },
  ],
  criadoEm: '',
}
eq('antes do 1o reajuste vale o cadastro', F.valorNoMes(salario, '2026-08'), 5000)
eq('no mes do reajuste ja vale o novo', F.valorNoMes(salario, '2026-09'), 6000)
eq('meses seguintes seguem no novo valor', F.valorNoMes(salario, '2027-01'), 6000)
eq('o segundo reajuste manda dali para frente', F.valorNoMes(salario, '2027-06'), 6500)
eq('sem ajuste algum vale o cadastro', F.valorNoMes({ valor: 120 }, '2026-08'), 120)
eq(
  'a ordem dos ajustes na lista nao importa',
  F.valorNoMes(
    { valor: 1, ajustes: [{ mes: '2027-03', valor: 3 }, { mes: '2026-09', valor: 2 }] },
    '2026-10',
  ),
  2,
)
eq('o ajuste vigente aponta o mes certo', F.ajusteVigente(salario, '2027-01').mes, '2026-09')
const comSalario = { ...dados, ganhos: [salario] }
eq('o resumo usa o valor vigente (agosto)', F.resumoDoMes(comSalario, '2026-08').ganhos, 5000)
eq('o resumo usa o valor vigente (setembro)', F.resumoDoMes(comSalario, '2026-09').ganhos, 6000)
eq(
  'a projecao ve o aumento chegar no mes certo',
  F.projecao(comSalario, '2026-08', 3).map((r) => r.ganhos),
  [5000, 6000, 6000],
)


/* ---------------- cartao que o formulario novo assume --------------- */
console.log('\n=== cartao inicial de uma compra nova ===')
const cLuiz = cartao({ id: 'cl', usuarioId: 'p1', ativo: true })
const cLeticia = cartao({ id: 'cle', usuarioId: 'p2', ativo: true })
const cVelho = cartao({ id: 'cv', usuarioId: 'p1', ativo: false })
const todosCartoes = [cVelho, cLuiz, cLeticia]
eq(
  'sem ultimo usado, pega o primeiro ativo',
  F.primeiroCartao(todosCartoes, todosCartoes),
  'cl',
)
eq(
  'o ultimo usado ganha do primeiro ativo',
  F.primeiroCartao(todosCartoes, todosCartoes, 'cle'),
  'cle',
)
eq(
  'ultimo usado de outra pessoa nao vaza para a visao filtrada',
  F.primeiroCartao([cLeticia], todosCartoes, 'cl'),
  'cle',
)
eq(
  'ultimo usado que nao existe mais e ignorado',
  F.primeiroCartao(todosCartoes, todosCartoes, 'apagado'),
  'cl',
)
eq(
  'pessoa sem cartao cai para a lista inteira',
  F.primeiroCartao([], todosCartoes, 'cle'),
  'cle',
)
eq('sem cartao nenhum devolve vazio', F.primeiroCartao([], [], 'cl'), '')




/* --------------------------- férias, feriados e vale ---------------------- */

console.log('\n=== ferias: adiantamento, terco e desconto ===')

const dadosCom = (ganhos, config = {}) => ({
  versao: 1,
  cartoes: [],
  compras: [],
  ganhos,
  gastosFixos: [],
  faturas: [],
  config: { tema: 'dark', reservaMinima: 0, ...config },
})

const contracheque = (extra) => ({
  id: 'g1',
  descricao: 'Salario',
  valor: 4000,
  categoria: 'Salário',
  recorrencia: 'mensal',
  mesInicio: '2026-01',
  criadoEm: '',
  ...extra,
})

const soValor = (d, mes) => F.ganhosDoMes(d, mes).map((g) => g.valor)

// 15 dias de ferias em set/2026, nada vendido:
// salario 4000 + ferias (4000*15/30 = 2000) + terco (2000/3 = 666,67)
const d15 = dadosCom([
  contracheque({ ferias: [{ id: 'f1', mes: '2026-09', dias: 15, diasVendidos: 0 }] }),
])
eq('mes das ferias soma adiantamento e terco', soValor(d15, '2026-09'), [6666.67])
eq('mes seguinte desconta os dias adiantados', soValor(d15, '2026-10'), [2000])
eq('mes sem relacao com ferias fica intacto', soValor(d15, '2026-08'), [4000])
eq(
  'dois meses somados = dois salarios + terco',
  F.arred(soValor(d15, '2026-09')[0] + soValor(d15, '2026-10')[0]),
  8666.67,
)

// 30 dias com 10 vendidos: o terco incide sobre os 40 dias (Sumula 328 do TST)
const d30 = dadosCom([
  contracheque({ ferias: [{ id: 'f1', mes: '2026-09', dias: 30, diasVendidos: 10 }] }),
])
eq('abono e terco sobre os dias vendidos', soValor(d30, '2026-09'), [11111.11])
eq('desconto do mes seguinte e so dos dias gozados', soValor(d30, '2026-10'), [0])

console.log('\n=== dias trabalhados: feriados e escala ===')

eq('setembro/2026 tem 21 dias uteis com o feriado', F.diasTrabalhaveisNoMes('2026-09', {}), 21)
eq(
  'quem trabalha em feriado tem os 22',
  F.diasTrabalhaveisNoMes('2026-09', {
    jornada: { tipo: 'semana', diasSemana: [1, 2, 3, 4, 5], folgaEmFeriado: false },
  }),
  22,
)
eq('janeiro/2027 desconta o dia 1o', F.diasTrabalhaveisNoMes('2027-01', {}), 20)
eq(
  'feriado municipal de Sao Paulo tira mais um dia',
  F.diasTrabalhaveisNoMes('2027-01', { uf: 'SP', cidade: 'sao-paulo' }),
  19,
)
eq(
  'seg a sabado da mais dias que seg a sexta',
  F.diasTrabalhaveisNoMes('2026-09', {
    jornada: { tipo: 'semana', diasSemana: [1, 2, 3, 4, 5, 6], folgaEmFeriado: true },
  }),
  25,
)
eq(
  'escala dia sim dia nao da metade do mes',
  F.diasTrabalhaveisNoMes('2026-09', {
    jornada: {
      tipo: 'escala',
      escalaTrabalha: 1,
      escalaFolga: 1,
      escalaInicio: '2026-09-01',
      folgaEmFeriado: false,
    },
  }),
  15,
)
eq(
  'escala 6x1 em setembro/2026',
  F.diasTrabalhaveisNoMes('2026-09', {
    jornada: {
      tipo: 'escala',
      escalaTrabalha: 6,
      escalaFolga: 1,
      escalaInicio: '2026-09-01',
      folgaEmFeriado: false,
    },
  }),
  26,
)

console.log('\n=== vale-refeicao por dia trabalhado ===')

const vale = (extra) => ({
  id: 'g2',
  descricao: 'Vale Refeicao',
  valor: 50,
  categoria: 'Benefícios',
  recorrencia: 'mensal',
  mesInicio: '2026-01',
  porDiaUtil: true,
  criadoEm: '',
  ...extra,
})

eq('R$ 50 por dia util em setembro/2026', soValor(dadosCom([vale()]), '2026-09'), [1050])
eq('mes com mais feriado paga menos', soValor(dadosCom([vale()]), '2027-01'), [1000])

const dJuntos = dadosCom([
  contracheque({ ferias: [{ id: 'f1', mes: '2026-09', dias: 15, diasVendidos: 0 }] }),
  vale(),
])
eq('nas ferias o vale encolhe junto', soValor(dJuntos, '2026-09'), [6666.67, 550])
// Outubro/2026 tem 22 dias de seg a sex, menos o dia 12 (Aparecida, segunda).
eq('fora das ferias o vale volta ao normal', soValor(dJuntos, '2026-10'), [2000, 1050])

/* --------------------- compra em dinheiro (sem cartao) -------------- */
console.log('\n=== compra em dinheiro ===')

const compraDinheiro = compra({
  id: 'd1',
  cartaoId: null,
  valorTotal: 300,
  parcelas: 1,
  dataCompra: '2026-08-20',
  categoria: 'Mercado',
})

eq('nao entra em todasAsParcelas (isso e so pra compra com cartao)', F.todasAsParcelas({
  ...dados,
  compras: [compraDinheiro],
}).length, 0)

const diretos = F.todosOsGastosDiretos({ ...dados, compras: [compraDinheiro] })
eq('gera 1 gasto direto', diretos.length, 1)
eq('cai no proprio mes da compra, sem esperar fechamento', diretos[0].mes, '2026-08')
eq('valor cheio, sem cartao pra parcelar', diretos[0].valor, 300)

const compraDinheiroParcelada = compra({
  id: 'd2',
  cartaoId: null,
  valorTotal: 900,
  parcelas: 3,
  dataCompra: '2026-08-20',
})
const parceladosDireto = F.gastosDiretosDaCompra(compraDinheiroParcelada)
eq('parcela em dinheiro tambem se espalha pelos meses', parceladosDireto.map((p) => p.mes), [
  '2026-08',
  '2026-09',
  '2026-10',
])
eq('cada parcela em dinheiro de 300', parceladosDireto.map((p) => p.valor), [300, 300, 300])

const dadosComDinheiro = {
  ...dados,
  compras: [...dados.compras, compraDinheiro],
}
const setembroComDinheiro = F.resumoDoMes(dadosComDinheiro, '2026-09')
const agostoComDinheiro = F.resumoDoMes(dadosComDinheiro, '2026-08')
eq('compra em dinheiro nao mexe no mes da fatura de cartao', setembroComDinheiro.faturas, setembro.faturas)
eq('compra em dinheiro pesa no proprio mes (avulsos)', agostoComDinheiro.avulsos, 300)
eq(
  'gastos do mes somam fatura + fixo + avulso',
  agostoComDinheiro.gastos,
  F.arred(agostoComDinheiro.faturas + agostoComDinheiro.fixos + agostoComDinheiro.avulsos),
)
eq(
  'compra em dinheiro entra no agrupamento por categoria',
  F.porCategoria(agostoComDinheiro).find((c) => c.categoria === 'Mercado')?.valor,
  300,
)

/* ------------- apagar o cartao vira "compra em dinheiro" ------------- */
console.log('\n=== apagar cartao nao apaga a compra ===')
// Mesma regra do banco (ON DELETE SET NULL): a compra perde o cartao, mas
// continua existindo e pesando no mes dela, só que fora de qualquer fatura.
const compraOrfa = { ...compra({ id: 'o1', valorTotal: 150, dataCompra: '2026-08-10' }), cartaoId: null }
const dadosPosExclusao = { ...dados, cartoes: [], compras: [compraOrfa] }
eq('sem cartao nenhum, nao gera fatura', F.todasAsParcelas(dadosPosExclusao).length, 0)
eq(
  'mas continua pesando no orcamento do mes como gasto avulso',
  F.resumoDoMes(dadosPosExclusao, '2026-08').avulsos,
  150,
)

console.log(
  `\n${falhas === 0 ? `TODOS OS ${total} TESTES PASSARAM` : `${falhas} de ${total} testes falharam`}`,
)
process.exit(falhas === 0 ? 0 : 1)
