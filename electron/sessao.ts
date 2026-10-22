import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Onde a sessão do usuário fica guardada.
 *
 * No processo principal, e não em localStorage: o refresh token vale 60 dias e
 * dá pra emitir acesso sem senha nenhuma. Em localStorage ele fica legível por
 * qualquer script que rode no renderer — e o app carrega OCR, imagens coladas
 * e, um dia, qualquer dependência nova.
 *
 * Quando o sistema oferece cifragem (`safeStorage`), o arquivo é cifrado com a
 * chave do usuário do Windows: copiar o arquivo pra outra máquina não serve de
 * nada. Onde não oferece, cai pra texto puro em userData — pior, mas ainda
 * dentro da pasta do usuário, e é o que o Electron garante em toda plataforma.
 */

interface Sessao {
  acesso: string
  refresh: string
  usuario: { id: string; email: string; nome: string; sobrenome: string; identificador: string }
  /** Marcado quando a pessoa pediu "continuar conectado". */
  lembrar: boolean
}

const pasta = () => {
  const p = join(app.getPath('userData'), 'sessao')
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
  return p
}

const arquivo = () => join(pasta(), 'sessao.bin')

export const gravarSessao = (s: Sessao): void => {
  const texto = JSON.stringify(s)
  const conteudo = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(texto)
    : Buffer.from(texto, 'utf8')
  writeFileSync(arquivo(), conteudo)
}

export const lerSessao = (): Sessao | null => {
  const a = arquivo()
  if (!existsSync(a)) return null
  try {
    const bruto = readFileSync(a)
    const texto = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(bruto)
      : bruto.toString('utf8')
    return JSON.parse(texto) as Sessao
  } catch (e) {
    // Arquivo ilegível é sessão perdida, não motivo pra travar o app: cair na
    // tela de login resolve. Acontece se a chave do Windows mudar (troca de
    // usuário, restauração de backup).
    console.error('[sessao] arquivo ilegível, descartando', e)
    apagarSessao()
    return null
  }
}

export const apagarSessao = (): void => {
  try {
    rmSync(arquivo(), { force: true })
  } catch (e) {
    console.error('[sessao] falhou ao apagar', e)
  }
}

export type { Sessao }
