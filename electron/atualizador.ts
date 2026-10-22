import { BrowserWindow, app } from 'electron'
import { autoUpdater } from 'electron-updater'


/**
 * As releases públicas do projeto podem ser consultadas sem uma credencial.
 * Uma API de atualização própria pode ser configurada opcionalmente.
 */
const URL_API = (process.env.BOLSO_URL_API || '').replace(/\/$/, '')

/*
 * Um token opcional permite builds para repositórios privados. O projeto
 * público não versiona nem exige essa credencial.
 */
const TOKEN = process.env.BOLSO_TOKEN_ATUALIZACAO || ''
const DONO = 'Luiz-Matheus21'
const REPO = 'financas'

export type FaseAtualizacao =
  | 'inativo'
  | 'verificando'
  | 'em-dia'
  | 'baixando'
  | 'pronta'
  | 'erro'

export interface EstadoAtualizacao {
  fase: FaseAtualizacao
  versaoAtual: string
  /** Versão que está sendo baixada ou já pronta para instalar. */
  versaoNova?: string
  /** 0 a 100, só durante o download. */
  progresso?: number
  erro?: string
  /** Quando o app foi reaberto já numa versão nova, para avisar o que mudou. */
  notas?: string
}

let estado: EstadoAtualizacao = { fase: 'inativo', versaoAtual: app.getVersion() }
let janela: BrowserWindow | null = null

const avisar = (mudanca: Partial<EstadoAtualizacao>) => {
  estado = { ...estado, ...mudanca }
  janela?.webContents.send('atualizacao:estado', estado)
}

/** O que a tela de Ajustes lê ao abrir, sem esperar por evento nenhum. */
export const estadoAtual = (): EstadoAtualizacao => estado

export const iniciarAtualizador = (alvo: BrowserWindow, dev: boolean) => {
  janela = alvo
  estado = { fase: 'inativo', versaoAtual: app.getVersion() }

  // Em desenvolvimento não existe app-update.yml; tentar verificar só dá erro.
  if (dev) return

  if (URL_API) {
    // 'generic' pede <url>/latest.yml e depois <url>/<arquivo>.exe — que é
    // exatamente o que a rota /atualizacao/:arquivo entrega.
    autoUpdater.setFeedURL({ provider: 'generic', url: `${URL_API}/atualizacao` })
  } else {
    autoUpdater.setFeedURL({ provider: 'github', owner: DONO, repo: REPO, private: false, token: TOKEN || undefined })
  }
  autoUpdater.autoDownload = true
  // Instalar no fechamento é o que evita fechar o app na cara de quem está usando.
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => avisar({ fase: 'verificando', erro: undefined }))
  autoUpdater.on('update-not-available', () => avisar({ fase: 'em-dia' }))
  autoUpdater.on('update-available', (info) =>
    avisar({ fase: 'baixando', versaoNova: info.version, progresso: 0 }),
  )
  autoUpdater.on('download-progress', (p) => avisar({ progresso: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info) =>
    avisar({
      fase: 'pronta',
      versaoNova: info.version,
      progresso: 100,
      notas: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
    }),
  )
  autoUpdater.on('error', (e) =>
    avisar({ fase: 'erro', erro: e instanceof Error ? e.message : String(e) }),
  )

  // Espera o app abrir antes de gastar rede com isso.
  setTimeout(() => void verificar(), 4000)
}

export const verificar = async (): Promise<EstadoAtualizacao> => {
  if (estado.fase === 'inativo') return estado
  if (estado.fase === 'baixando' || estado.fase === 'pronta') return estado
  try {
    await autoUpdater.checkForUpdates()
  } catch (e) {
    avisar({ fase: 'erro', erro: e instanceof Error ? e.message : String(e) })
  }
  return estado
}

/** Fecha e reabre já na versão nova. Só faz sentido com o download pronto. */
export const instalarAgora = () => {
  if (estado.fase !== 'pronta') return false
  setImmediate(() => autoUpdater.quitAndInstall(false, true))
  return true
}
