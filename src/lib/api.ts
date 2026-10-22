/**
 * Cliente da API do Finanças.
 *
 * O endereço vem da configuração de build. O padrão local evita apontar uma
 * cópia pública do desktop para a API pessoal de quem mantém o projeto.
 */

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:3100'

export interface Usuario {
  id: string
  email: string
  nome: string
  sobrenome: string
  identificador: string
}

export interface Sessao {
  acesso: string
  refresh: string
  usuario: Usuario
  lembrar: boolean
}

/** Erro que veio da API: tem status e, quando é validação, os campos. */
export class ErroApi extends Error {
  status: number
  codigo: string
  campos?: Record<string, unknown>
  constructor(status: number, corpo: { erro?: string; mensagem?: string; campos?: Record<string, unknown> }) {
    super(corpo?.mensagem || 'Não deu para completar a operação.')
    this.status = status
    this.codigo = corpo?.erro ?? 'desconhecido'
    this.campos = corpo?.campos
  }
}

/** Erro de rede: a requisição não chegou. Serve pra entrar em modo offline. */
export class ErroRede extends Error {
  constructor() {
    super('Sem conexão com o servidor.')
  }
}

let sessao: Sessao | null = null
let aoPerderSessao: (() => void) | null = null

export const definirSessao = (s: Sessao | null) => {
  sessao = s
}
export const sessaoAtual = () => sessao
export const aoExpirar = (fn: () => void) => {
  aoPerderSessao = fn
}

/**
 * Renovação em voo, compartilhada.
 *
 * Sem isso, se cinco telas pedirem dados ao mesmo tempo com o token vencido,
 * cinco renovações partem juntas — e como o servidor gira o refresh a cada
 * uso, quatro delas chegariam com um token já revogado e derrubariam a sessão
 * de quem não fez nada de errado.
 */
async function buscar(url: string, opcoes: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    return await fetch(url, { ...opcoes, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

let renovando: Promise<boolean> | null = null

async function renovar(): Promise<boolean> {
  if (!sessao?.refresh) return false
  if (renovando) return renovando

  renovando = (async () => {
    try {
      const r = await buscar(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: sessao!.refresh, dispositivo: 'desktop' }),
      })
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) return false
        throw new ErroRede()
      }
      const novo = await r.json()
      sessao = { ...sessao!, acesso: novo.acesso, refresh: novo.refresh }
      if (sessao.lembrar) await window.bolso.sessao.gravar(sessao)
      return true
    } catch {
      // Falha de rede não invalida a sessão: o token continua bom, só não deu
      // pra falar com o servidor agora.
      throw new ErroRede()
    } finally {
      renovando = null
    }
  })()

  return renovando
}

interface Opcoes {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  corpo?: unknown
  /** Rotas de login/cadastro não mandam token nem tentam renovar. */
  semAutenticacao?: boolean
}

async function requisitar<T>(caminho: string, opcoes: Opcoes = {}, jaRenovou = false): Promise<T> {
  const { metodo = 'GET', corpo, semAutenticacao } = opcoes

  let resposta: Response
  try {
    resposta = await buscar(`${BASE}${caminho}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(!semAutenticacao && sessao?.acesso ? { Authorization: `Bearer ${sessao.acesso}` } : {}),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
  } catch {
    throw new ErroRede()
  }

  // 401 uma vez é token vencido: renova e repete. Duas vezes é sessão morta.
  if (resposta.status === 401 && !semAutenticacao && !jaRenovou) {
    if (await renovar()) return requisitar<T>(caminho, opcoes, true)
    sessao = null
    await window.bolso.sessao.apagar()
    aoPerderSessao?.()
  }

  if (resposta.status >= 500 || resposta.status === 429) throw new ErroRede()
  const texto = await resposta.text()
  const dados = texto ? JSON.parse(texto) : {}
  if (!resposta.ok) throw new ErroApi(resposta.status, dados)
  return dados as T
}

/* ------------------------------ autenticação ----------------------------- */

export const api = {
  online: () => requisitar<{ ok: boolean }>('/saude', { semAutenticacao: true }).then(() => true).catch(() => false),

  versao: (versao: string) =>
    requisitar<{ minima: string; atual: string; precisaAtualizar: boolean; temNovidade: boolean; urlApk: string | null }>(
      `/versao?versao=${encodeURIComponent(versao)}`,
      { semAutenticacao: true },
    ),

  regrasSenha: () =>
    requisitar<{ regras: { id: string; texto: string }[] }>('/auth/regras-senha', { semAutenticacao: true }),

  registrar: (dados: {
    nome: string
    sobrenome: string
    email: string
    senha: string
    confirmacao: string
    sexo?: string
    dataNascimento: string
  }) => requisitar<{ ok: true; mensagem: string }>('/auth/registrar', { metodo: 'POST', corpo: dados, semAutenticacao: true }),

  ativar: (email: string, codigo: string) =>
    requisitar<{ ok: true; mensagem: string }>('/auth/ativar', {
      metodo: 'POST',
      corpo: { email, codigo },
      semAutenticacao: true,
    }),

  reenviarCodigo: (email: string) =>
    requisitar<{ ok: true; mensagem: string }>('/auth/reenviar-codigo', {
      metodo: 'POST',
      corpo: { email },
      semAutenticacao: true,
    }),

  entrar: (email: string, senha: string) =>
    requisitar<{ acesso: string; refresh: string; usuario: Usuario }>('/auth/login', {
      metodo: 'POST',
      corpo: { email, senha, dispositivo: 'desktop' },
      semAutenticacao: true,
    }),

  esqueciSenha: (email: string) =>
    requisitar<{ ok: true; mensagem: string }>('/auth/esqueci-senha', {
      metodo: 'POST',
      corpo: { email },
      semAutenticacao: true,
    }),

  redefinirSenha: (dados: { email: string; codigo: string; senha: string; confirmacao: string }) =>
    requisitar<{ ok: true; mensagem: string }>('/auth/redefinir-senha', {
      metodo: 'POST',
      corpo: dados,
      semAutenticacao: true,
    }),

  sair: () =>
    sessao
      ? requisitar<{ ok: true }>('/auth/sair', {
          metodo: 'POST',
          corpo: { refresh: sessao.refresh },
          semAutenticacao: true,
        }).catch(() => ({ ok: true as const }))
      : Promise.resolve({ ok: true as const }),

  /* -------------------------------- perfil ------------------------------- */

  perfil: {
    ver: () => requisitar<Record<string, unknown>>('/perfil'),
    trocarFoto: (foto: string) =>
      requisitar<{ ok: true; foto: string }>('/perfil/foto', { metodo: 'PUT', corpo: { foto } }),
    removerFoto: () => requisitar<{ ok: true; foto: null }>('/perfil/foto', { metodo: 'DELETE' }),
    salvar: (p: Record<string, unknown>) => requisitar('/perfil', { metodo: 'PATCH', corpo: p }),
    trocarSenha: (p: { senhaAtual: string; senha: string; confirmacao: string }) =>
      requisitar<{ ok: true; mensagem: string }>('/perfil/senha', { metodo: 'POST', corpo: p }),
    pedirTrocaEmail: (email: string, senha: string) =>
      requisitar<{ ok: true; mensagem: string }>('/perfil/email', { metodo: 'POST', corpo: { email, senha } }),
    confirmarTrocaEmail: (codigo: string) =>
      requisitar<{ ok: true; email: string }>('/perfil/email/confirmar', { metodo: 'POST', corpo: { codigo } }),
    pedirExclusaoConta: (senha: string) =>
      requisitar<{ ok: true; mensagem: string }>('/perfil/excluir', { metodo: 'POST', corpo: { senha } }),
    confirmarExclusaoConta: (codigo: string) =>
      requisitar<{ ok: true; mensagem: string }>('/perfil/excluir/confirmar', { metodo: 'POST', corpo: { codigo } }),
  },

  /* ------------------------------- família ------------------------------- */

  familia: {
    ver: () => requisitar<Record<string, unknown>>('/familia'),
    criar: (nome: string) => requisitar('/familia', { metodo: 'POST', corpo: { nome } }),
    desfazer: () => requisitar('/familia', { metodo: 'DELETE' }),
    sair: () => requisitar('/familia/sair', { metodo: 'POST' }),
    convidar: (identificador: string) =>
      requisitar<{ ok: true; convite: { link: string; nome: string } }>('/familia/convites', {
        metodo: 'POST',
        corpo: { identificador },
      }),
    gerarLink: () =>
      requisitar<{ ok: true; convite: { link: string }; mensagemPronta: string }>('/familia/convites/link', {
        metodo: 'POST',
      }),
    cancelarConvite: (id: string) => requisitar(`/familia/convites/${id}`, { metodo: 'DELETE' }),
    aceitar: (id: string) => requisitar(`/familia/convites/${id}/aceitar`, { metodo: 'POST' }),
    recusar: (id: string) => requisitar(`/familia/convites/${id}/recusar`, { metodo: 'POST' }),
    porToken: (token: string) => requisitar(`/familia/convites/token/${token}`),
    aceitarPorToken: (token: string) => requisitar(`/familia/convites/token/${token}/aceitar`, { metodo: 'POST' }),
    dados: () => requisitar<Record<string, unknown>>('/familia/dados'),
  },

  /* -------------------------------- dados -------------------------------- */

  dados: {
    tudo: () => requisitar<Record<string, unknown>>('/dados/tudo'),
    criar: (recurso: string, item: unknown) => requisitar(`/dados/${recurso}`, { metodo: 'POST', corpo: item }),
    atualizar: (recurso: string, id: string, item: unknown) =>
      requisitar(`/dados/${recurso}/${id}`, { metodo: 'PATCH', corpo: item }),
    remover: (recurso: string, id: string) => requisitar(`/dados/${recurso}/${id}`, { metodo: 'DELETE' }),
    salvarFatura: (f: unknown) => requisitar('/dados/faturas', { metodo: 'PUT', corpo: f }),
    removerFatura: (cartaoId: string, mes: string) =>
      requisitar(`/dados/faturas/${cartaoId}/${mes}`, { metodo: 'DELETE' }),
    config: (c: unknown) => requisitar('/dados/config', { metodo: 'PATCH', corpo: c }),
  },
}

export { BASE as URL_API }
