import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { MarcaBanco, bancoPorId } from '@/lib/bancos'
import { useCartoesFiltrados, useDados } from '@/lib/estado'
import { Avatar, cn } from '@/components/ui'

/**
 * Os dois recortes que a tela de faturas pede: de quem, e de qual banco.
 *
 * São dois filtros e não um só porque respondem perguntas diferentes — "quanto
 * o Luiz gastou" e "quanto eu devo ao Bradesco" — e é o cruzamento dos dois que
 * interessa na hora de pagar: as faturas do Bradesco, da Leticia, deste mês.
 *
 * Nenhum marcado quer dizer todos. É o contrário do que o estado costuma fazer,
 * mas é o que o usuário espera: chegar na tela e ver tudo, sem ter que marcar
 * cinco pessoas antes de enxergar qualquer coisa.
 */

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-controle border px-2.5 py-1.5 text-[12px] font-semibold transition-colors',
        ativo
          ? 'border-marca bg-marca/15 text-marca'
          : 'border-linha bg-superficie text-tinta-fraca hover:bg-elevado hover:text-tinta',
      )}
    >
      {children}
    </button>
  )
}

/**
 * Marca/desmarca um item. "Tudo" e "nada" viram null, que é como o resto do
 * app lê "sem filtro".
 *
 * O primeiro clique é o caso especial: saindo de "todos marcados", clicar num
 * chip escolhe SÓ aquele. Tirar um de seis seria o contrário do que a pessoa
 * quis dizer ao clicar em "Bradesco" — daí em diante, sim, cada clique soma ou
 * tira um.
 */
function alternar(atual: string[] | null, ids: string[], universo: string[]): string[] | null {
  if (!atual) return ids.length === universo.length ? null : ids
  const dentro = ids.every((id) => atual.includes(id))
  const novo = dentro
    ? atual.filter((x) => !ids.includes(x))
    : [...new Set([...atual, ...ids])]
  if (novo.length === 0 || novo.length === universo.length) return null
  return novo
}

export function Filtros({ comCartoes = false }: { comCartoes?: boolean }) {
  const { membros, filtro, setFiltro, filtroCartoes, setFiltroCartoes } = useDados()
  const cartoes = useCartoesFiltrados()

  const idsPessoas = useMemo(() => membros.map((m) => m.id), [membros])
  const marcadoPessoa = (id: string) => !filtro || filtro.includes(id)
  const todasPessoas = !filtro

  /* Um chip por banco, não por cartão: "ver as faturas do Bradesco" é o que se
     quer na prática, e quem tem dois cartões do mesmo banco paga os dois. */
  const bancos = useMemo(() => {
    const mapa = new Map<string, string[]>()
    for (const c of cartoes) {
      const lista = mapa.get(c.bancoId) ?? []
      lista.push(c.id)
      mapa.set(c.bancoId, lista)
    }
    return [...mapa.entries()]
      .map(([bancoId, ids]) => ({ bancoId, ids, nome: bancoPorId(bancoId).nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [cartoes])

  const idsCartoes = useMemo(() => cartoes.map((c) => c.id), [cartoes])
  const marcadoBanco = (ids: string[]) =>
    !filtroCartoes || ids.some((id) => filtroCartoes.includes(id))
  const todosBancos = !filtroCartoes

  const mostraPessoas = membros.length > 1
  const mostraBancos = comCartoes && bancos.length > 1
  if (!mostraPessoas && !mostraBancos) return null

  return (
    <div className="mb-4 grid gap-3 lg:grid-cols-2">
      {mostraPessoas && (
        <div>
          <p className="mb-1.5 text-[10.5px] font-bold tracking-wider text-tinta-tenue">PESSOAS</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip ativo={todasPessoas} onClick={() => setFiltro(null)}>
              {todasPessoas && <Check size={13} />}
              Todas
            </Chip>
            {membros.map((m) => (
              <Chip
                key={m.id}
                ativo={!todasPessoas && marcadoPessoa(m.id)}
                onClick={() => setFiltro(alternar(filtro, [m.id], idsPessoas))}
              >
                <Avatar nome={m.nome} foto={m.foto} cor="var(--c-marca)" tamanho={18} />
                {m.nome.split(' ')[0]}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {mostraBancos && (
        <div>
          <p className="mb-1.5 text-[10.5px] font-bold tracking-wider text-tinta-tenue">CARTÕES</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip ativo={todosBancos} onClick={() => setFiltroCartoes(null)}>
              {todosBancos && <Check size={13} />}
              Todos
            </Chip>
            {bancos.map((b) => (
              <Chip
                key={b.bancoId}
                ativo={!todosBancos && marcadoBanco(b.ids)}
                onClick={() => setFiltroCartoes(alternar(filtroCartoes, b.ids, idsCartoes))}
              >
                <MarcaBanco bancoId={b.bancoId} tamanho={18} />
                {b.nome}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
