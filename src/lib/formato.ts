const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
})

const MOEDA_CURTA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const NUMERO = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const dinheiro = (v: number): string => MOEDA.format(v || 0)

/** Para eixos de gráfico e espaços apertados: R$ 1,2 mil / R$ 3,4 mi. */
export const dinheiroCurto = (v: number): string => {
  const a = Math.abs(v)
  const sinal = v < 0 ? '-' : ''
  if (a >= 1_000_000) return `${sinal}R$ ${NUMERO.format(a / 1_000_000).replace(',00', '')} mi`
  if (a >= 1000) return `${sinal}R$ ${NUMERO.format(a / 1000).replace(',00', '')} mil`
  return MOEDA_CURTA.format(v || 0)
}

export const numero = (v: number): string => NUMERO.format(v || 0)

export const porcento = (v: number, casas = 0): string =>
  `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`

/**
 * Lê valor digitado em português. Aceita "1.234,56", "1234,56", "1234.56" e
 * "R$ 1.234,56" — colar de um print ou do app do banco tem que funcionar.
 */
export const lerValor = (texto: string): number => {
  if (typeof texto === 'number') return texto
  const limpo = String(texto ?? '')
    .replace(/[^\d,.-]/g, '')
    .trim()
  if (!limpo) return 0
  const temVirgula = limpo.includes(',')
  const temPonto = limpo.includes('.')
  let normal = limpo
  if (temVirgula && temPonto) {
    // O separador decimal é o último que aparece.
    normal =
      limpo.lastIndexOf(',') > limpo.lastIndexOf('.')
        ? limpo.replace(/\./g, '').replace(',', '.')
        : limpo.replace(/,/g, '')
  } else if (temVirgula) {
    normal = limpo.replace(/\./g, '').replace(',', '.')
  } else if (temPonto) {
    // "1.234" sem centavos é milhar; "12.34" é decimal.
    const partes = limpo.split('.')
    normal = partes[partes.length - 1]!.length === 3 ? limpo.replace(/\./g, '') : limpo
  }
  const n = Number(normal)
  return Number.isFinite(n) ? n : 0
}

export const iniciais = (nome: string): string =>
  nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

export const id = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export const plural = (n: number, um: string, muitos: string): string =>
  `${n} ${n === 1 ? um : muitos}`

/* ------------------------------ datas ------------------------------------ */

/**
 * Máscara de data enquanto se digita: 21012001 vira 21/01/2001.
 *
 * A pessoa digita como escreve à mão — dia, mês, ano. O formato ISO
 * (2001-01-21) é o que o banco entende, e ninguém deveria precisar saber
 * disso: a conversão fica aqui, nas duas direções.
 */
export const mascararData = (v: string): string => {
  const d = String(v ?? '').replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

/** '21/01/2001' -> '2001-01-21'. Devolve '' enquanto estiver incompleta. */
export const dataParaIso = (v: string): string => {
  const d = String(v ?? '').replace(/\D/g, '')
  if (d.length !== 8) return ''
  return `${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}`
}

/** '2001-01-21' -> '21/01/2001', para mostrar o que veio do servidor. */
export const isoParaData = (v: string | null | undefined): string => {
  const m = String(v ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}
