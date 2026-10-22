import type { Dados } from './types'

interface Operacao {
  id: string
  recurso: string
  acao: string
  alvo?: string
  corpo?: unknown
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const chaves = { cartoes: 'cartoes', compras: 'compras', ganhos: 'ganhos', 'gastos-fixos': 'gastosFixos' } as const

/** Migra criações que ficaram offline em versões que não enviavam o ID ao servidor. */
export function migrarPendencias<T extends Operacao>(dados: Dados, fila: T[], gerarId: () => string): { dados: Dados; fila: T[] } {
  const ids = new Map<string, string>()
  const usados = new Set<string>()
  const migrada = fila.map((p) => {
    const chave = chaves[p.recurso as keyof typeof chaves]
    if (p.acao !== 'criar' || !chave) return p
    const corpo = (p.corpo ?? {}) as Record<string, unknown>
    const item = dados[chave].find((i) => !usados.has(i.id) && (corpo.id === i.id ||
      (!corpo.id && (() => {
        const atualizado = fila.filter((op) => op.recurso === p.recurso && op.alvo === i.id && op.acao === 'atualizar')
          .reduce((r, op) => ({ ...r, ...(op.corpo as Record<string, unknown>) }), corpo)
        return [corpo, atualizado].some((r) => Object.entries(r).every(([k, v]) => JSON.stringify((i as unknown as Record<string, unknown>)[k]) === JSON.stringify(v)))
      })())))
    const anterior = typeof corpo.id === 'string' ? corpo.id : item?.id
    const id = anterior && uuid.test(anterior) ? anterior : gerarId()
    if (anterior) ids.set(anterior, id)
    if (item) usados.add(item.id)
    return { ...p, corpo: { ...corpo, id } }
  })
  const trocar = (v: string) => ids.get(v) ?? v
  return {
    dados: {
      ...dados,
      cartoes: dados.cartoes.map((i) => ({ ...i, id: trocar(i.id) })),
      compras: dados.compras.map((i) => ({ ...i, id: trocar(i.id), cartaoId: i.cartaoId ? trocar(i.cartaoId) : null })),
      ganhos: dados.ganhos.map((i) => ({ ...i, id: trocar(i.id) })),
      gastosFixos: dados.gastosFixos.map((i) => ({ ...i, id: trocar(i.id) })),
      faturas: dados.faturas.map((i) => ({ ...i, cartaoId: trocar(i.cartaoId) })),
      config: { ...dados.config, ultimoCartaoId: dados.config.ultimoCartaoId ? trocar(dados.config.ultimoCartaoId) : undefined },
    },
    fila: migrada.map((p) => {
      const corpo = p.corpo && typeof p.corpo === 'object' ? { ...p.corpo } as Record<string, unknown> : undefined
      if (corpo) for (const k of ['cartaoId', 'ultimoCartaoId']) {
        if (typeof corpo[k] === 'string') corpo[k] = trocar(corpo[k] as string)
      }
      return { ...p, corpo, alvo: p.alvo ? p.alvo.split('|').map(trocar).join('|') : undefined } as T
    }),
  }
}

/** Dados próprios atualizados localmente prevalecem sobre o retrato compartilhado. */
export function combinarFamilia(dados: Dados, outros: Partial<Dados>, usuarioId?: string): Dados {
  const juntar = <T extends { usuarioId?: string }>(meus: T[], familia?: T[]) => [
    ...meus.map((i) => ({ ...i, usuarioId })),
    ...(familia ?? []).filter((i) => i.usuarioId !== usuarioId),
  ]
  return {
    ...dados,
    cartoes: juntar(dados.cartoes, outros.cartoes),
    compras: juntar(dados.compras, outros.compras),
    ganhos: juntar(dados.ganhos, outros.ganhos),
    gastosFixos: juntar(dados.gastosFixos, outros.gastosFixos),
    faturas: [...dados.faturas, ...(outros.faturas ?? []).filter((f) =>
      (outros.cartoes ?? []).some((c) => c.id === f.cartaoId && c.usuarioId !== usuarioId))],
  }
}
