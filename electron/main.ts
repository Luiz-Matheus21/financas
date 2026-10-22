import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { caminhoArquivo, gravar, gravarArquivoExterno, ler, lerArquivoExterno } from './store'
import { encerrar as encerrarOcr, reconhecer } from './ocr'
import { estadoAtual, iniciarAtualizador, instalarAgora, verificar } from './atualizador'
import { agendarEnvio, cancelarEnvioAgendado, estadoSincronizacao, observarSincronizacao, sincronizar } from './sincronizacao'
import { apagarSessao, gravarSessao, lerSessao, type Sessao } from './sessao'

const DEV = !!process.env.VITE_DEV_SERVER_URL
const RAIZ = join(__dirname, '..')

// O nome visível do app passou de "Bolso" para "Finanças", mas o Electron
// deriva o caminho de userData do productName — e é lá que mora TUDO: os dados
// (store.ts), o clone de sincronização e o Tesseract. Sem fixar aqui, a troca
// moveria a pasta de %APPDATA%\Bolso para %APPDATA%\Finanças e o app instalado
// abriria vazio, como se fosse uma instalação nova. Tem que rodar antes de
// qualquer coisa que leia userData.
app.setPath('userData', join(app.getPath('appData'), 'Bolso'))

// Em desenvolvimento o Windows mostraria o icone padrao do Electron na barra de
// tarefas; no app empacotado o icone vem embutido no .exe.
const ICONE = join(RAIZ, 'build', 'icon.ico')

/** Cores da barra de título nativa — precisam acompanhar o tema do app. */
const CROMO = {
  dark: { color: '#0F1115', symbolColor: '#8B93A7' },
  light: { color: '#FFFFFF', symbolColor: '#5A6172' },
} as const

let janela: BrowserWindow | null = null

const criarJanela = () => {
  janela = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 900,
    minHeight: 640,
    show: false,
    backgroundColor: CROMO.dark.color,
    ...(DEV && existsSync(ICONE) ? { icon: ICONE } : {}),
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...CROMO.dark, height: 44 },
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  janela.once('ready-to-show', () => janela?.show())

  iniciarAtualizador(janela, DEV)

  // Link externo abre no navegador, nunca dentro do app.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (DEV) {
    // Sem isso, erro no renderer some: o console dele não cai no terminal.
    // A assinatura desse evento mudou entre versoes do Electron (argumentos
    // soltos virraram um objeto), entao trato as duas formas.
    janela.webContents.on('console-message', (...args: unknown[]) => {
      const d = args[1]
      if (d && typeof d === 'object' && 'message' in d) {
        const o = d as { message: string; level?: string; sourceId?: string; lineNumber?: number }
        console.log(`[renderer:${o.level ?? 'log'}] ${o.message} (${o.sourceId}:${o.lineNumber})`)
      } else {
        console.log(`[renderer] ${String(args[2] ?? d ?? '')}`)
      }
    })
    janela.loadURL(process.env.VITE_DEV_SERVER_URL!)
  } else {
    janela.loadFile(join(RAIZ, 'dist', 'index.html'))
  }

  janela.on('closed', () => {
    janela = null
  })
}

const registrarIpc = () => {
  ipcMain.handle('dados:ler', (_e, usuarioId?: string) => ler(usuarioId))

  ipcMain.handle('dados:gravar', (_e, dados: unknown, usuarioId?: string) => {
    gravar(dados, usuarioId)
    // O app grava a cada poucas teclas; enviar na hora seria um commit por
    // edição. O envio real só acontece depois de um tempo parado.
    if (!usuarioId) agendarEnvio(caminhoArquivo())
    return true
  })

  ipcMain.handle('dados:caminho', () => caminhoArquivo())

  ipcMain.handle('dados:revelar', () => {
    shell.showItemInFolder(caminhoArquivo())
    return true
  })

  ipcMain.handle('dados:exportar', async (_e, dados: unknown) => {
    const agora = new Date()
    const selo = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
    const r = await dialog.showSaveDialog(janela!, {
      title: 'Exportar dados',
      defaultPath: `bolso-${selo}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (r.canceled || !r.filePath) return null
    gravarArquivoExterno(r.filePath, dados)
    return r.filePath
  })

  ipcMain.handle('dados:importar', async () => {
    const r = await dialog.showOpenDialog(janela!, {
      title: 'Importar dados',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (r.canceled || !r.filePaths[0]) return null
    return lerArquivoExterno(r.filePaths[0])
  })

  ipcMain.handle('ocr:reconhecer', async (_e, dataUrl: string) => {
    try {
      return { ok: true as const, ...(await reconhecer(dataUrl)) }
    } catch (e) {
      console.error('[ocr] falhou', e)
      return { ok: false as const, erro: e instanceof Error ? e.message : String(e) }
    }
  })

  /** Abre um print do disco e devolve como data URL, pronto para o OCR. */
  ipcMain.handle('ocr:escolherImagem', async () => {
    const r = await dialog.showOpenDialog(janela!, {
      title: 'Escolher print da compra',
      properties: ['openFile'],
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
    })
    if (r.canceled || !r.filePaths[0]) return null
    const caminho = r.filePaths[0]
    const tipo = extname(caminho).slice(1).toLowerCase().replace('jpg', 'jpeg')
    return {
      nome: caminho.split(/[\\/]/).pop() ?? 'print',
      dataUrl: `data:image/${tipo};base64,${readFileSync(caminho).toString('base64')}`,
    }
  })

  /* Sessão fica no processo principal, fora do alcance do renderer. Ver o
     comentário em sessao.ts. */
  ipcMain.handle('sessao:ler', () => lerSessao())
  ipcMain.handle('sessao:gravar', (_e, s: Sessao) => {
    gravarSessao(s)
    return true
  })
  ipcMain.handle('sessao:apagar', () => {
    apagarSessao()
    return true
  })

  ipcMain.handle('janela:tema', (_e, tema: 'dark' | 'light') => {
    const cromo = CROMO[tema] ?? CROMO.dark
    nativeTheme.themeSource = tema
    janela?.setTitleBarOverlay({ ...cromo, height: 44 })
    janela?.setBackgroundColor(cromo.color)
    return true
  })

  ipcMain.handle('app:info', () => ({
    versao: app.getVersion(),
    plataforma: process.platform,
    electron: process.versions.electron,
  }))

  ipcMain.handle('atualizacao:estado', () => estadoAtual())
  ipcMain.handle('atualizacao:verificar', () => verificar())
  ipcMain.handle('atualizacao:instalar', () => instalarAgora())

  ipcMain.handle('sincronizacao:estado', () => estadoSincronizacao())
  ipcMain.handle('sincronizacao:agora', () => sincronizar(caminhoArquivo()))
}

// A sincronização nunca segura a abertura do app: ele sobe com os dados
// locais na hora e, se algo chegar de outra máquina, a tela é avisada e
// recarrega. É o que mantém o Bolso utilizável sem internet.
const sincronizarEAvisar = async () => {
  const resultado = await sincronizar(caminhoArquivo())
  if (resultado.aplicouDeFora) janela?.webContents.send('dados:externos', ler())
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark'
  registrarIpc()
  criarJanela()
  observarSincronizacao((estado) => janela?.webContents.send('sincronizacao:estado', estado))
  void sincronizarEAvisar()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela()
  })
})

// Fechar sem enviar deixaria a outra máquina um dia atrasada: gastei a tarde
// lançando compras aqui, abro no notebook e não está lá. Por isso a saída
// espera o envio terminar antes de encerrar de fato.
let saindo = false

app.on('before-quit', (evento) => {
  if (saindo) return
  saindo = true
  evento.preventDefault()
  cancelarEnvioAgendado()
  void (async () => {
    try {
      await sincronizar(caminhoArquivo())
    } catch (e) {
      console.error('[sync:saida]', e)
    }
    await encerrarOcr()
    app.exit(0)
  })()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
