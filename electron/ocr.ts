import { app } from 'electron'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Worker } from 'tesseract.js'

/**
 * Os .traineddata.gz viajam com o app (pasta resources/tessdata), então o OCR
 * funciona sem internet na primeira execução.
 */
const pastaIdiomas = () =>
  process.env.BOLSO_TESSDATA ??
  (app.isPackaged
    ? join(process.resourcesPath, 'tessdata')
    : join(app.getAppPath(), 'resources', 'tessdata'))

const pastaCache = () => {
  const p = join(app.getPath('userData'), 'tesseract')
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
  return p
}

let worker: Worker | null = null
let iniciando: Promise<Worker> | null = null

const obterWorker = async (): Promise<Worker> => {
  if (worker) return worker
  if (iniciando) return iniciando
  iniciando = (async () => {
    const { createWorker } = await import('tesseract.js')
    const w = await createWorker('por', 1, {
      langPath: pastaIdiomas(),
      cachePath: pastaCache(),
      gzip: true,
      logger: () => {},
      errorHandler: (e: unknown) => console.error('[ocr]', e),
    })
    worker = w
    return w
  })()
  try {
    return await iniciando
  } finally {
    iniciando = null
  }
}

export interface ResultadoOcr {
  texto: string
  confianca: number
  linhas: string[]
}

/** Reconhece o texto de uma imagem recebida como data URL do renderer. */
export const reconhecer = async (dataUrl: string): Promise<ResultadoOcr> => {
  const w = await obterWorker()
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1]! : dataUrl
  const buffer = Buffer.from(base64, 'base64')
  const { data } = await w.recognize(buffer)
  const texto = data.text ?? ''
  return {
    texto,
    confianca: data.confidence ?? 0,
    linhas: texto
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
  }
}

export const encerrar = async (): Promise<void> => {
  if (!worker) return
  const w = worker
  worker = null
  try {
    await w.terminate()
  } catch {
    /* encerrando o app, não há o que tratar */
  }
}
