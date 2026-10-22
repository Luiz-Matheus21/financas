import { combinarFamilia, migrarPendencias } from './sincronizacao'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Cartao, Compra, Dados, FaturaRegistro, GastoFixo, Ganho, MesRef } from './types'
import { dadosVazios } from './types'
import { mesAtual } from './mes'
import { aplicarTema as aplicarTemaLocal } from './tema'
import { api as servidor, ErroRede } from './api'
import { useAutenticacao } from './auth'

const novoId = () => crypto.randomUUID()

/* ---------------------------------------------------------------------------
   Os dados agora vêm da API, não mais de um arquivo local.

   O que mudou de verdade: as "pessoas" sumiram. Antes elas eram fichas criadas
   à mão dentro do app, e um cartão pertencia a uma ficha. Agora cada pessoa é
   uma conta com login, e o que você cadastra é sempre seu — a família é que
   junta os números de todo mundo, em `familia`.

   Offline continua valendo, e é o que dita o desenho daqui:

   - a tela muda na hora (otimista) e a chamada vai depois; esperar a rede a
     cada tecla deixaria o app lento mesmo com internet boa
   - o que não conseguiu subir fica numa fila gravada em disco, e volta a ser
     tentado quando a rede voltar
   - o último retrato do servidor fica em cache local, então o app abre e
     mostra tudo mesmo começando sem rede
--------------------------------------------------------------------------- */

type Recurso = 'cartoes' | 'compras' | 'ganhos' | 'gastos-fixos'

interface Pendencia {
  id: string
  recurso: Recurso | 'faturas' | 'config'
  acao: 'criar' | 'atualizar' | 'remover'
  alvo?: string
  corpo?: unknown
}

interface Contexto {
  dados: Dados
  compartilhados: Dados
  carregando: boolean
  salvando: boolean
  /** false quando a última conversa com o servidor falhou por rede. */
  online: boolean
  erroSincronizacao: string | null
  /** Quantas mudanças ainda não subiram. Zero = tudo no servidor. */
  pendentes: number
  mes: MesRef
  setMes: (m: MesRef) => void
  /** Ids de integrantes da família em foco. null = todo mundo. */
  filtro: string[] | null
  setFiltro: (f: string[] | null) => void
  /**
   * Ids de cartões em foco. null = todos.
   *
   * É um filtro separado do de pessoas porque responde outra pergunta: "quanto
   * eu devo ao Bradesco" não é a mesma coisa que "quanto o Luiz gastou". Como
   * são independentes, marcar um não pode apagar o outro — os dois se cruzam.
   */
  filtroCartoes: string[] | null
  setFiltroCartoes: (f: string[] | null) => void
  tema: 'dark' | 'light'
  alternarTema: () => void

  /** Integrantes da família, vazio quando não há família. */
  familia: { id: string; nome: string; souCriador: boolean } | null
  membros: {
    id: string
    nome: string
    sobrenome: string
    identificador: string
    /** Data URL da foto de perfil, quando a pessoa colocou uma. */
    foto: string | null
    souEu: boolean
  }[]
  /** Link público para indicar o app a quem ainda não tem. */
  linkApp: string
  recarregar: () => Promise<void>

  cartoes: {
    criar: (c: Omit<Cartao, 'id' | 'criadoEm'>) => Cartao
    atualizar: (id: string, c: Partial<Cartao>) => void
    remover: (id: string) => void
  }
  compras: {
    criar: (c: Omit<Compra, 'id' | 'criadoEm'>) => Compra
    criarMuitas: (cs: Omit<Compra, 'id' | 'criadoEm'>[]) => void
    atualizar: (id: string, c: Partial<Compra>) => void
    remover: (id: string) => void
  }
  ganhos: {
    criar: (g: Omit<Ganho, 'id' | 'criadoEm'>) => Ganho
    atualizar: (id: string, g: Partial<Ganho>) => void
    remover: (id: string) => void
  }
  gastosFixos: {
    criar: (g: Omit<GastoFixo, 'id' | 'criadoEm'>) => GastoFixo
    atualizar: (id: string, g: Partial<GastoFixo>) => void
    remover: (id: string) => void
  }
  faturas: { registrar: (r: FaturaRegistro) => void }
  substituirTudo: (d: Dados) => void
  atualizarConfig: (c: Partial<Dados['config']>) => void
}

const Ctx = createContext<Contexto | null>(null)

export const useDados = (): Contexto => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useDados fora do ProvedorDados')
  return c
}

/** Nome do recurso na API a partir da chave usada no estado. */
const RECURSO: Record<string, Recurso> = {
  cartoes: 'cartoes',
  compras: 'compras',
  ganhos: 'ganhos',
  gastosFixos: 'gastos-fixos',
}

export function ProvedorDados({ children }: { children: ReactNode }) {
  const { usuario } = useAutenticacao()
  const [dados, setDados] = useState<Dados>(dadosVazios)
  const [carregando, setCarregando] = useState(true)
  const [online, setOnline] = useState(true)
  const [erroSincronizacao, setErroSincronizacao] = useState<string | null>(null)
  const [mes, setMes] = useState<MesRef>(mesAtual)
  const [filtro, setFiltro] = useState<string[] | null>(null)
  const [filtroCartoes, setFiltroCartoes] = useState<string[] | null>(null)
  const [familia, setFamilia] = useState<Contexto['familia']>(null)
  const [membros, setMembros] = useState<Contexto['membros']>([])
  const [linkApp, setLinkApp] = useState('')
  const [fila, setFila] = useState<Pendencia[]>([])

  const [outros, setOutros] = useState<Partial<Dados>>({})
  const filaRef = useRef(fila)
  const versaoLocal = useRef(0)
  const contaAtual = useRef(usuario?.id)
  contaAtual.current = usuario?.id
  const gravacao = useRef<Promise<unknown>>(Promise.resolve())
  const pronto = useRef(false)
  const drenando = useRef(false)

  /* ------------------------------ cache local ---------------------------- */

  // Reusa o mesmo arquivo do modelo antigo como cache: é só um retrato do que
  // o servidor tem, então perder não dói — mas é o que faz o app abrir cheio
  // quando a rede não responde.
  const guardarCache = useCallback((d: Dados, f: Pendencia[]) => {
    return window.bolso.dados.gravar({ ...d, _fila: f, _usuarioId: usuario?.id, _outros: outros, _familia: familia, _membros: membros }, usuario?.id)
  }, [usuario?.id, outros, familia, membros])

  const lerCache = useCallback(async (): Promise<{ dados: Dados; fila: Pendencia[]; visao?: { outros?: Partial<Dados>; familia?: Contexto['familia']; membros?: Contexto['membros'] } }> => {
    const bruto = (await window.bolso.dados.ler(usuario?.id)) as Dados & { _fila?: Pendencia[]; _usuarioId?: string; _outros?: Partial<Dados>; _familia?: Contexto['familia']; _membros?: Contexto['membros'] }
    if (bruto?._usuarioId && bruto._usuarioId !== usuario?.id) return { dados: dadosVazios(), fila: [] }
    const { _fila, _usuarioId, ...resto } = bruto ?? {}
    return { dados: { ...dadosVazios(), ...resto }, fila: _fila ?? [], visao: { outros: bruto?._outros, familia: bruto?._familia, membros: bruto?._membros } }
  }, [usuario?.id])

  /* ------------------------------- carga --------------------------------- */

  const carregarDoServidor = useCallback(async () => {
    const conta = contaAtual.current
    const versao = versaoLocal.current
    const tudo = (await servidor.dados.tudo()) as unknown as Dados
    const novos: Dados = { ...dadosVazios(), ...tudo }
    if (conta !== contaAtual.current) return novos
    if (!filaRef.current.length && versao === versaoLocal.current) setDados(novos)
    aplicarTemaLocal(novos.config?.tema ?? 'dark')
    setOnline(true)
    return novos
  }, [])

  const carregarFamilia = useCallback(async () => {
    try {
      const f = (await servidor.familia.ver()) as {
        familia: { id: string; nome: string; souCriador: boolean; membros: Contexto['membros'] } | null
        linkApp?: string
      }
      if (contaAtual.current !== usuario?.id) return
      setFamilia(f.familia ? { id: f.familia.id, nome: f.familia.nome, souCriador: f.familia.souCriador } : null)
      setMembros((f.familia?.membros ?? []).map((m) => ({ ...m, souEu: m.id === usuario?.id })))
      if (f.familia) {
        const compartilhados = await servidor.familia.dados() as unknown as Dados
        if (contaAtual.current === usuario?.id) setOutros(compartilhados)
      } else setOutros({})
      if (f.linkApp) setLinkApp(f.linkApp)
    } catch {
      // Família é enfeite perto dos dados próprios: falhar aqui não pode
      // impedir o app de abrir.
    }
  }, [usuario?.id])

  useEffect(() => {
    let vivo = true
    pronto.current = false
    setOutros({})
    setFamilia(null)
    setMembros([])
    setFiltro(null)
    filaRef.current = []
    setFila([])
    setDados(dadosVazios())
    if (!usuario) { setCarregando(false); return }
    setCarregando(true)
    ;(async () => {
      const lido = await lerCache()
      if (!vivo) return
      const cache = { ...lido, ...migrarPendencias(lido.dados, lido.fila, novoId) }
      filaRef.current = cache.fila as Pendencia[]
      setDados(cache.dados)
      aplicarTemaLocal(cache.dados.config.tema)
      setOutros(cache.visao?.outros ?? {})
      setFamilia(cache.visao?.familia ?? null)
      setMembros(cache.visao?.membros ?? [])
      setFila(cache.fila as Pendencia[])
      pronto.current = true
      setCarregando(false)
    })()
    return () => { vivo = false; pronto.current = false }
  }, [usuario?.id, lerCache])

  const enfileirar = useCallback((p: Omit<Pendencia, 'id'>) => {
    versaoLocal.current++
    const nova = [...filaRef.current, { ...p, id: novoId() }]
    filaRef.current = nova
    setFila(nova)
  }, [])

  /**
   * Sobe a fila em ordem, uma por vez.
   *
   * Em ordem porque as operações dependem umas das outras: criar o cartão
   * precisa chegar antes da compra que aponta pra ele. Em paralelo, a compra
   * chegaria primeiro e seria recusada.
   */
  // Cache acompanha o estado, pra próxima abertura sem rede ver o mais novo.
  useEffect(() => {
    if (!carregando && pronto.current && usuario) gravacao.current = guardarCache(dados, fila)
  }, [dados, fila, outros, familia, membros, carregando, guardarCache])

  const drenar = useCallback(async () => {
    if (drenando.current || !pronto.current || !usuario) return
    drenando.current = true
    const conta = usuario.id
    try {
      await gravacao.current
      while (filaRef.current.length) {
        await gravacao.current
        if (conta !== contaAtual.current) return
        const p = filaRef.current[0]
        if (p.recurso === 'config') await servidor.dados.config(p.corpo)
        else if (p.recurso === 'faturas') {
          if (p.acao === 'remover') {
            const [cartaoId, m] = (p.alvo ?? '').split('|')
            await servidor.dados.removerFatura(cartaoId, m)
          } else await servidor.dados.salvarFatura(p.corpo)
        } else if (p.acao === 'criar') await servidor.dados.criar(p.recurso, p.corpo)
        else if (p.acao === 'atualizar') await servidor.dados.atualizar(p.recurso, p.alvo!, p.corpo)
        else await servidor.dados.remover(p.recurso, p.alvo!)
        if (conta !== contaAtual.current) return
        filaRef.current = filaRef.current.filter((x) => x.id !== p.id)
        setFila(filaRef.current)
      }
      if (conta !== contaAtual.current) return
      await Promise.all([carregarDoServidor(), carregarFamilia()])
      setOnline(true)
      setErroSincronizacao(null)
    } catch (e) {
      // Preserve a fila inclusive em recusas: nunca apagar um lançamento silenciosamente.
      if (conta !== contaAtual.current) return
      setOnline(!(e instanceof ErroRede))
      setErroSincronizacao(e instanceof ErroRede ? null : 'Não foi possível sincronizar. Seus lançamentos continuam salvos neste aparelho.')
      console.error('[sincronizacao]', e)
    } finally {
      drenando.current = false
    }
  }, [usuario?.id, carregarDoServidor, carregarFamilia])

  useEffect(() => { if (!carregando) void drenar() }, [fila, carregando, drenar])

  useEffect(() => {
    const voltar = () => { void drenar() }
    const offline = () => setOnline(false)
    window.addEventListener('online', voltar)
    window.addEventListener('offline', offline)
    window.addEventListener('focus', voltar)
    const timer = setInterval(() => { void drenar() }, 30000)
    return () => {
      window.removeEventListener('online', voltar)
      window.removeEventListener('offline', offline)
      window.removeEventListener('focus', voltar)
      clearInterval(timer)
    }
  }, [drenar])

  /* -------------------------------- tema --------------------------------- */

  const alternarTema = useCallback(() => {
    setDados((d) => {
      const t = d.config.tema === 'dark' ? 'light' : 'dark'
      aplicarTemaLocal(t)
      enfileirar({ recurso: 'config', acao: 'atualizar', corpo: { tema: t } })
      return { ...d, config: { ...d.config, tema: t } }
    })
  }, [enfileirar])

  /* -------------------------------- CRUD --------------------------------- */

  /** O mesmo UUID acompanha o registro local e o servidor. */
  function crud<T extends { id: string; criadoEm: string }>(chave: keyof Dados) {
    const recurso = RECURSO[chave as string]
    const lista = (d: Dados) => d[chave] as unknown as T[]
    return {
      criar: (item: Omit<T, 'id' | 'criadoEm'>): T => {
        const completo = { ...item, id: novoId(), criadoEm: new Date().toISOString() } as T
        setDados((d) => ({ ...d, [chave]: [...lista(d), completo] }) as Dados)
        enfileirar({ recurso, acao: 'criar', corpo: completo })
        return completo
      },
      criarMuitas: (itens: Omit<T, 'id' | 'criadoEm'>[]) => {
        const agora = new Date().toISOString()
        const completos = itens.map((i) => ({ ...i, id: novoId(), criadoEm: agora }) as T)
        setDados((d) => ({ ...d, [chave]: [...lista(d), ...completos] }) as Dados)
        for (const i of completos) enfileirar({ recurso, acao: 'criar', corpo: i })
      },
      atualizar: (id: string, patch: Partial<T>) => {
        setDados(
          (d) =>
            ({ ...d, [chave]: lista(d).map((i) => (i.id === id ? { ...i, ...patch } : i)) }) as Dados,
        )
        enfileirar({ recurso, acao: 'atualizar', alvo: id, corpo: patch })
      },
      remover: (id: string) => {
        setDados((d) => ({ ...d, [chave]: lista(d).filter((i) => i.id !== id) }) as Dados)
        enfileirar({ recurso, acao: 'remover', alvo: id })
      },
    }
  }

  const operacoes = useMemo(() => {
    const cartoesCrud = crud<Cartao>('cartoes')
    const comprasCrud = crud<Compra>('compras')
    return {
      cartoes: {
        ...cartoesCrud,
        /* O banco não apaga a compra ao apagar o cartão (ON DELETE SET NULL):
           ela vira compra em dinheiro. Espelha isso aqui, em vez de sumir com
           ela — do contrário a tela mostraria menos gasto do que existe. */
        remover: (id: string) => {
          setDados((d) => ({
            ...d,
            cartoes: d.cartoes.filter((c) => c.id !== id),
            compras: d.compras.map((c) => (c.cartaoId === id ? { ...c, cartaoId: null } : c)),
            faturas: d.faturas.filter((f) => f.cartaoId !== id),
          }))
          enfileirar({ recurso: 'cartoes', acao: 'remover', alvo: id })
        },
      },
      compras: (() => {
        const lembrar = (cartaoId?: string | null) => {
          if (!cartaoId) return
          setDados((d) =>
            d.config.ultimoCartaoId === cartaoId
              ? d
              : { ...d, config: { ...d.config, ultimoCartaoId: cartaoId } },
          )
        }
        return {
          ...comprasCrud,
          criar: (c: Omit<Compra, 'id' | 'criadoEm'>) => {
            const feita = comprasCrud.criar(c)
            lembrar(c.cartaoId)
            return feita
          },
          criarMuitas: (cs: Omit<Compra, 'id' | 'criadoEm'>[]) => {
            comprasCrud.criarMuitas(cs)
            lembrar(cs[cs.length - 1]?.cartaoId)
          },
        }
      })(),
      ganhos: crud<Ganho>('ganhos'),
      gastosFixos: crud<GastoFixo>('gastosFixos'),
      faturas: {
        registrar: (r: FaturaRegistro) => {
          const vazio = r.valorInformado == null && !r.paga && !r.observacao
          setDados((d) => {
            const outros = d.faturas.filter((f) => !(f.cartaoId === r.cartaoId && f.mes === r.mes))
            return { ...d, faturas: vazio ? outros : [...outros, r] }
          })
          enfileirar(
            vazio
              ? { recurso: 'faturas', acao: 'remover', alvo: `${r.cartaoId}|${r.mes}` }
              : { recurso: 'faturas', acao: 'atualizar', corpo: r },
          )
        },
      },
    }
    // `crud` e `enfileirar` são estáveis; recriar isso a cada render faria
    // toda tela que recebe essas funções renderizar de novo sem motivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enfileirar])

  const substituirTudo = useCallback(
    (d: Dados) => {
      const pendencias: Pendencia[] = [
        ...d.cartoes.map((corpo) => ({ id: novoId(), recurso: 'cartoes' as const, acao: 'criar' as const, corpo })),
        ...d.compras.map((corpo) => ({ id: novoId(), recurso: 'compras' as const, acao: 'criar' as const, corpo })),
        ...d.ganhos.map((corpo) => ({ id: novoId(), recurso: 'ganhos' as const, acao: 'criar' as const, corpo })),
        ...d.gastosFixos.map((corpo) => ({ id: novoId(), recurso: 'gastos-fixos' as const, acao: 'criar' as const, corpo })),
      ]
      const importado = migrarPendencias(d, pendencias, novoId)
      setDados(importado.dados)
      for (const p of importado.fila) enfileirar(p)
    },
    [enfileirar],
  )

  const atualizarConfig = useCallback(
    (c: Partial<Dados['config']>) => {
      setDados((d) => ({ ...d, config: { ...d.config, ...c } }))
      enfileirar({ recurso: 'config', acao: 'atualizar', corpo: c })
    },
    [enfileirar],
  )

  const recarregar = useCallback(async () => { await drenar() }, [drenar])

  const compartilhados = useMemo(
    () => combinarFamilia(dados, outros, usuario?.id),
    [dados, outros, usuario?.id],
  )

  const valor: Contexto = {
    dados,
    compartilhados,
    carregando,
    salvando: fila.length > 0,
    online,
    erroSincronizacao,
    pendentes: fila.length,
    mes,
    setMes,
    filtro,
    setFiltro,
    filtroCartoes,
    setFiltroCartoes,
    tema: dados.config.tema ?? 'dark',
    alternarTema,
    familia,
    membros,
    linkApp,
    recarregar,
    ...operacoes,
    substituirTudo,
    atualizarConfig,
  }

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

/* --------------------------------- ajudas -------------------------------- */

/** Integrantes cobertos pelo filtro atual. Sem família, só eu. */
export const useMembrosFiltrados = (): Contexto['membros'] => {
  const { membros, filtro } = useDados()
  return useMemo(
    () => (filtro && filtro.length ? membros.filter((m) => filtro.includes(m.id)) : membros),
    [membros, filtro],
  )
}

/** Primeiros nomes em foco, para textos de tela vazia. */
export const useNomesEmFoco = (): string => {
  const membros = useMembrosFiltrados()
  return useMemo(() => membros.map((m) => m.nome.split(' ')[0]).join(' e '), [membros])
}

/**
 * Cartões em foco.
 *
 * Sem família, são todos os seus. Com família, o filtro escolhe de quem — e
 * aí os cartões dos outros vêm da visão da família, não daqui.
 */
export const useCartoesFiltrados = (): Cartao[] => {
  const { dados } = useDados()
  return dados.cartoes
}
