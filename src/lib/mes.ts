import type { MesRef } from './types'

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const MESES_CURTOS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

export const mesDe = (d: Date): MesRef =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export const mesAtual = (): MesRef => mesDe(new Date())

export const partesMes = (m: MesRef): [number, number] => {
  const [a, mm] = m.split('-').map(Number)
  return [a, mm]
}

/** Soma (ou subtrai) meses a uma chave 'YYYY-MM'. */
export const somaMes = (m: MesRef, n: number): MesRef => {
  const [ano, mes] = partesMes(m)
  const total = ano * 12 + (mes - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/** Distância em meses entre duas chaves (b - a). */
export const difMeses = (a: MesRef, b: MesRef): number => {
  const [aa, am] = partesMes(a)
  const [ba, bm] = partesMes(b)
  return (ba * 12 + bm) - (aa * 12 + am)
}

export const nomeMes = (m: MesRef): string => {
  const [ano, mes] = partesMes(m)
  return `${MESES[mes - 1]} de ${ano}`
}

export const nomeMesCurto = (m: MesRef): string => {
  const [ano, mes] = partesMes(m)
  return `${MESES_CURTOS[mes - 1]}/${String(ano).slice(2)}`
}

export const rotuloMes = (m: MesRef): string => {
  const [ano, mes] = partesMes(m)
  return `${MESES_CURTOS[mes - 1]!.replace(/^./, (c) => c.toUpperCase())} ${ano}`
}

/** Sequência de n meses começando em `inicio`. */
export const sequenciaMeses = (inicio: MesRef, n: number): MesRef[] =>
  Array.from({ length: n }, (_, i) => somaMes(inicio, i))

/** Data 'YYYY-MM-DD' -> MesRef. */
export const mesDaData = (iso: string): MesRef => iso.slice(0, 7)

export const diaDaData = (iso: string): number => Number(iso.slice(8, 10))

/** Último dia do mês, para não gerar 31/02. */
export const ultimoDiaDoMes = (m: MesRef): number => {
  const [ano, mes] = partesMes(m)
  return new Date(ano, mes, 0).getDate()
}

/** Data de vencimento real da fatura naquele mês, respeitando meses curtos. */
export const dataVencimento = (m: MesRef, dia: number): string => {
  const [ano, mes] = partesMes(m)
  const d = Math.min(dia, ultimoDiaDoMes(m))
  return `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export const hojeIso = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const dataBr = (iso: string): string => {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}
