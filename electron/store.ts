import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

/** Estrutura mínima esperada no arquivo. Detalhes ficam nos tipos do renderer. */
interface DadosBrutos {
  _fila?: unknown[]
  _usuarioId?: string
  _familia?: unknown
  _outros?: unknown
  _membros?: unknown[]
  versao: number
  pessoas: unknown[]
  cartoes: unknown[]
  compras: unknown[]
  ganhos: unknown[]
  gastosFixos: unknown[]
  faturas: unknown[]
  config: Record<string, unknown>
}

const vazio = (): DadosBrutos => ({
  versao: 1,
  pessoas: [],
  cartoes: [],
  compras: [],
  ganhos: [],
  gastosFixos: [],
  faturas: [],
  config: { tema: 'dark', reservaMinima: 0 },
})

const pastaDados = () => {
  const p = join(app.getPath('userData'), 'dados')
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
  return p
}

const nomeConta = (usuarioId?: string) => usuarioId && /^[0-9a-f-]{36}$/i.test(usuarioId) ? `bolso-${usuarioId}` : 'bolso'
export const caminhoArquivo = (usuarioId?: string) => join(pastaDados(), `${nomeConta(usuarioId)}.json`)
const caminhoBackup = (usuarioId?: string) => join(pastaDados(), `${nomeConta(usuarioId)}.backup.json`)

/** Garante que nenhuma lista venha faltando depois de uma importação torta. */
const normalizar = (bruto: Partial<DadosBrutos> | null): DadosBrutos => {
  const base = vazio()
  if (!bruto || typeof bruto !== 'object') return base
  return {
    _fila: Array.isArray(bruto._fila) ? bruto._fila : [],
    _usuarioId: bruto._usuarioId,
    _familia: bruto._familia,
    _outros: bruto._outros,
    _membros: bruto._membros,
    versao: typeof bruto.versao === 'number' ? bruto.versao : base.versao,
    pessoas: Array.isArray(bruto.pessoas) ? bruto.pessoas : [],
    cartoes: Array.isArray(bruto.cartoes) ? bruto.cartoes : [],
    compras: Array.isArray(bruto.compras) ? bruto.compras : [],
    ganhos: Array.isArray(bruto.ganhos) ? bruto.ganhos : [],
    gastosFixos: Array.isArray(bruto.gastosFixos) ? bruto.gastosFixos : [],
    faturas: Array.isArray(bruto.faturas) ? bruto.faturas : [],
    config: { ...base.config, ...(bruto.config ?? {}) },
  }
}

export const ler = (usuarioId?: string): DadosBrutos => {
  const arquivo = caminhoArquivo(usuarioId)
  if (usuarioId && !existsSync(arquivo)) {
    const legado = ler()
    if (!legado._usuarioId || legado._usuarioId === usuarioId) return legado
    return vazio()
  }
  for (const tentativa of [arquivo, caminhoBackup(usuarioId)]) {
    if (!existsSync(tentativa)) continue
    try {
      return normalizar(JSON.parse(readFileSync(tentativa, 'utf8')))
    } catch (e) {
      console.error(`[store] arquivo ilegível: ${tentativa}`, e)
    }
  }
  return vazio()
}

/**
 * Gravação atômica: escreve num temporário e só então troca pelo definitivo,
 * mantendo o anterior como backup. Se a máquina cair no meio, sobra um dos
 * dois íntegro.
 */
export const gravar = (dados: unknown, usuarioId?: string): void => {
  const arquivo = caminhoArquivo(usuarioId)
  const temporario = `${arquivo}.tmp`
  writeFileSync(temporario, JSON.stringify(dados, null, 2), 'utf8')
  if (existsSync(arquivo)) {
    try {
      copyFileSync(arquivo, caminhoBackup(usuarioId))
    } catch (e) {
      console.error('[store] falhou o backup', e)
    }
  }
  renameSync(temporario, arquivo)
}

export const lerArquivoExterno = (caminho: string): DadosBrutos =>
  normalizar(JSON.parse(readFileSync(caminho, 'utf8')))

export const gravarArquivoExterno = (caminho: string, dados: unknown): void =>
  writeFileSync(caminho, JSON.stringify(dados, null, 2), 'utf8')
