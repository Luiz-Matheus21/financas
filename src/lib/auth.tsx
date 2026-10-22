import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, aoExpirar, definirSessao, ErroRede, sessaoAtual, type Sessao, type Usuario } from './api'

interface Contexto {
  usuario: Usuario | null
  /** true enquanto a sessão guardada está sendo lida do disco. */
  carregando: boolean
  /** false quando a última tentativa de falar com a API foi por rede. */
  online: boolean
  entrar: (email: string, senha: string, lembrar: boolean) => Promise<void>
  sair: () => Promise<void>
  /** Reconfere a conexão — usado pelo botão "tentar de novo" das telas. */
  verificarConexao: () => Promise<boolean>
}

const Ctx = createContext<Contexto | null>(null)

export function ProvedorAutenticacao({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [online, setOnline] = useState(true)

  /**
   * Sessão guardada volta na abertura.
   *
   * Repare que o app entra mesmo sem conseguir falar com o servidor: os dados
   * ficam em cache local, e exigir rede pra abrir transformaria um app que
   * funciona offline em um que não abre no avião. A sessão só cai quando o
   * servidor responde 401 — ou seja, quando ele diz que ela morreu.
   */
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const guardada = (await window.bolso.sessao.ler()) as Sessao | null
        if (guardada?.refresh && vivo) {
          definirSessao(guardada)
          setUsuario(guardada.usuario)
        }
      } catch (e) {
        console.error('[auth] não consegui ler a sessão', e)
      } finally {
        if (vivo) setCarregando(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [])

  // O cliente da API avisa quando o servidor recusa a sessão de vez.
  useEffect(() => {
    aoExpirar(() => {
      definirSessao(null)
      setUsuario(null)
    })
  }, [])

  const entrar = useCallback(async (email: string, senha: string, lembrar: boolean) => {
    const r = await api.entrar(email, senha)
    const nova: Sessao = { acesso: r.acesso, refresh: r.refresh, usuario: r.usuario, lembrar }
    definirSessao(nova)
    // Sem "lembrar", a sessão vive só na memória: fechar o app desconecta.
    if (lembrar) await window.bolso.sessao.gravar(nova)
    else await window.bolso.sessao.apagar()
    setUsuario(r.usuario)
    setOnline(true)
  }, [])

  const sair = useCallback(async () => {
    await api.sair()
    definirSessao(null)
    await window.bolso.sessao.apagar()
    setUsuario(null)
  }, [])

  const verificarConexao = useCallback(async () => {
    const ok = await api.online()
    setOnline(ok)
    return ok
  }, [])

  // Confere a conexão na abertura e quando o Windows avisa que a rede voltou.
  useEffect(() => {
    void verificarConexao()
    const aoVoltar = () => void verificarConexao()
    window.addEventListener('online', aoVoltar)
    return () => window.removeEventListener('online', aoVoltar)
  }, [verificarConexao])

  return (
    <Ctx.Provider value={{ usuario, carregando, online, entrar, sair, verificarConexao }}>{children}</Ctx.Provider>
  )
}

export function useAutenticacao() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAutenticacao precisa estar dentro de ProvedorAutenticacao')
  return c
}

/** Traduz erro de rede numa frase que serve pra tela. */
export const mensagemDeErro = (e: unknown): string =>
  e instanceof ErroRede
    ? 'Sem conexão com o servidor. Verifique sua internet.'
    : e instanceof Error
      ? e.message
      : 'Algo deu errado. Tente de novo.'

export { sessaoAtual }
