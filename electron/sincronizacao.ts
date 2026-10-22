import { app } from 'electron'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * Sincronização dos dados entre as máquinas do usuário.
 *
 * Os dados do Bolso são um arquivo JSON só, guardado em userData — ótimo pra
 * usar offline, mas preso a uma máquina. Aqui esse arquivo passa por um
 * repositório privado separado, configurado por quem instala, que funciona como "o último
 * estado conhecido": ao abrir, baixa o que a outra máquina deixou; ao fechar
 * (e de tempos em tempos), envia o que mudou aqui.
 *
 * O app continua funcionando 100% offline: tudo é lido e gravado localmente, e
 * a sincronização é um extra que acontece quando há internet. Falhar em
 * sincronizar nunca impede de usar o app.
 *
 * Premissa que mantém isso simples: um usuário só, uma máquina de cada vez.
 * Quando as duas editam sem internet, nada é descartado — vence a versão mais
 * recente e a outra vira uma cópia datada em conflitos/.
 */

const REPO = (process.env.BOLSO_REPO_DADOS || '').trim()
const ARQUIVO = 'dados/bolso.json'

// Nenhum comando de git pode ficar pendurado: numa rede ruim o app demoraria
// pra abrir sem nada explicando. GIT_TERMINAL_PROMPT=0 evita o outro jeito de
// travar — o git parando pra pedir senha num terminal que ninguém vê.
const TIMEOUT = 25_000

export type FaseSincronizacao =
  | 'inativa'
  | 'sincronizando'
  | 'em-dia'
  | 'sem-rede'
  | 'conflito'
  /** A descida foi bem, só o envio falhou. Não é o mesmo que estar sem rede:
   *  o que veio da outra máquina já está aplicado aqui, e dizer "sem internet"
   *  seria mentir sobre dados que a pessoa já tem na tela. */
  | 'envio-pendente'

export interface EstadoSincronizacao {
  fase: FaseSincronizacao
  detalhe: string
  /** ISO da última sincronização bem-sucedida, pra a tela poder mostrar "há 5 min". */
  ultima?: string
  /** Verdadeiro quando o arquivo local acabou de ser trocado pelo de outra
   *  máquina — é o sinal de que a tela precisa reler os dados. */
  aplicouDeFora?: boolean
}

const git = (args: string[], cwd: string) =>
  new Promise<string>((resolve, reject) => {
    execFile(
      'git',
      args,
      { cwd, timeout: TIMEOUT, windowsHide: true, maxBuffer: 1024 * 1024 * 50, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
      (erro, saida, erroSaida) => {
        if (erro) return reject(new Error(String(erroSaida || '').trim() || erro.message))
        resolve(String(saida || ''))
      },
    )
  })

const maquina = () => hostname() || 'desconhecida'

const hash = (arquivo: string) =>
  existsSync(arquivo) ? createHash('sha1').update(readFileSync(arquivo)).digest('hex') : ''

const pastaSync = () => join(app.getPath('userData'), 'sync')
const marcador = () => join(app.getPath('userData'), 'sync-local.json')

const lerMarcador = (): { hash: string; commit: string } => {
  try {
    return JSON.parse(readFileSync(marcador(), 'utf8'))
  } catch {
    return { hash: '', commit: '' }
  }
}

const existeNoRemoto = async (dir: string, caminho: string) => {
  try {
    await git(['cat-file', '-e', `origin/main:${caminho}`], dir)
    return true
  } catch {
    return false
  }
}

/** origin/main traz commit que este clone ainda não tem? */
const remotoAvancou = async (dir: string) => {
  try {
    await git(['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], dir)
    return false
  } catch {
    return true
  }
}

/** Sobrou commit local que nunca chegou ao repositório? É o que fica quando o
 *  push falhou numa execução anterior. */
const envioPendente = async (dir: string) => {
  try {
    await git(['merge-base', '--is-ancestor', 'HEAD', 'origin/main'], dir)
    return false
  } catch {
    return true
  }
}

const mostrarDoRemoto = (dir: string, caminho: string) =>
  new Promise<Buffer | null>((resolve) => {
    execFile(
      'git',
      ['show', `origin/main:${caminho}`],
      { cwd: dir, encoding: 'buffer', maxBuffer: 1024 * 1024 * 200, windowsHide: true },
      (erro, saida) => resolve(erro ? null : (saida as unknown as Buffer)),
    )
  })

let estado: EstadoSincronizacao = { fase: 'inativa', detalhe: 'Ainda não sincronizou' }
let ouvinte: ((e: EstadoSincronizacao) => void) | null = null
let emAndamento: Promise<EstadoSincronizacao> | null = null
let agendado: NodeJS.Timeout | null = null

const avisar = (mudanca: Partial<EstadoSincronizacao>) => {
  estado = { ...estado, ...mudanca }
  ouvinte?.(estado)
}

export const estadoSincronizacao = () => estado
export const observarSincronizacao = (fn: (e: EstadoSincronizacao) => void) => {
  ouvinte = fn
}

const trabalho = async (arquivoLocal: string): Promise<EstadoSincronizacao> => {
  const dir = pastaSync()

  try {
    avisar({ fase: 'sincronizando', detalhe: 'Conectando ao seu repositório de dados' })
    if (!existsSync(join(dir, '.git'))) {
      mkdirSync(dirname(dir), { recursive: true })
      await git(['clone', REPO, dir], dirname(dir))
    }
    await git(['fetch', 'origin', 'main'], dir)
  } catch (e) {
    console.error('[sync] sem rede:', e)
    avisar({ fase: 'sem-rede', detalhe: 'Sem internet — seus dados continuam salvos aqui' })
    return estado
  }

  try {
    const noRepo = join(dir, ARQUIVO)
    const anterior = lerMarcador()
    const agora = hash(arquivoLocal)
    // Um commit local que ficou sem subir também é trabalho desta máquina que
    // o repositório ainda não tem.
    const mudouAqui = agora !== anterior.hash || (await envioPendente(dir))

    const cabecaRemota = (await git(['rev-parse', 'origin/main'], dir)).trim()
    // Um commit local que ficou sem subir (push falhou antes) também deixa
    // HEAD diferente de origin/main, mas não é novidade do outro dispositivo —
    // comparar os SHAs direto tratava os dois casos como iguais e abria
    // conflito do nada. Quem responde "há commit novo lá fora?" é a
    // ancestralidade; o marcador cobre o caso de um reset que morreu antes de
    // aplicar, e o marcador vazio de uma instalação nova pede tudo.
    const mudouLa = (await remotoAvancou(dir)) || anterior.commit !== cabecaRemota

    // Conflito é quando os dois lados mudaram desde a última conversa. Inclui
    // a primeira sincronização de uma máquina que já tinha dados próprios —
    // sem isso, o arquivo de fora entraria por cima do daqui em silêncio.
    const temLocal = existsSync(arquivoLocal)
    const temRemoto = await existeNoRemoto(dir, ARQUIVO)
    const conflito = temLocal && temRemoto && mudouAqui && mudouLa

    // Não dá pra saber qual é "o certo", mas dá pra saber qual é o mais
    // recente — e é esse que a pessoa quer continuar usando. O outro nunca é
    // jogado fora: vira uma cópia datada em conflitos/.
    let venceLocal = true
    let copiaConflito = ''
    if (conflito) {
      const dataLocal = statSync(arquivoLocal).mtimeMs
      const dataRemota = Date.parse((await git(['log', '-1', '--format=%cI', 'origin/main'], dir)).trim())
      venceLocal = !Number.isFinite(dataRemota) || dataLocal >= dataRemota

      const carimbo = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      copiaConflito = join('conflitos', `bolso-${carimbo}-${venceLocal ? 'do-outro-dispositivo' : maquina()}.json`)
      const destino = join(dir, copiaConflito)
      mkdirSync(dirname(destino), { recursive: true })
      if (venceLocal) {
        const bruto = await mostrarDoRemoto(dir, ARQUIVO)
        if (bruto) writeFileSync(destino, bruto)
      } else {
        copyFileSync(arquivoLocal, destino)
      }
    }

    let aplicouDeFora = false
    if (mudouLa) {
      avisar({ detalhe: 'Baixando o que mudou no outro dispositivo' })
      await git(['reset', '--hard', 'origin/main'], dir)
      if ((!conflito || !venceLocal) && existsSync(noRepo)) {
        mkdirSync(dirname(arquivoLocal), { recursive: true })
        copyFileSync(noRepo, arquivoLocal)
        aplicouDeFora = hash(arquivoLocal) !== agora
      }
    }

    // Espelha o estado desta máquina no clone e envia.
    if (existsSync(arquivoLocal)) {
      mkdirSync(dirname(noRepo), { recursive: true })
      copyFileSync(arquivoLocal, noRepo)
    }

    // Enviar tem tratamento de erro próprio: falhar aqui não desfaz nem
    // desmente o que já desceu. Antes era um try só, e um push que falhava
    // fazia a tela dizer "sem internet" com os dados de fora JÁ aplicados no
    // disco — e sem gravar o marcador, o que virava conflito falso na abertura
    // seguinte.
    let enviou = false
    let falhouEnvio: unknown = null
    try {
      if ((await git(['status', '--porcelain'], dir)).trim()) {
        avisar({ detalhe: 'Enviando suas alterações' })
        await git(['add', '-A'], dir)
        await git(
          ['-c', 'user.email=financas-desktop@users.noreply.github.com', '-c', `user.name=${maquina()}`, 'commit', '-m', conflito ? `Conflito resolvido em ${maquina()}` : `Dados de ${maquina()}`],
          dir,
        )
        await git(['push', 'origin', 'main'], dir)
        enviou = true
      } else if (await envioPendente(dir)) {
        // Commit de uma execução anterior cujo push não passou: nada novo pra
        // registrar, mas ainda há o que enviar. Sem este retry os dados
        // ficariam parados no clone até algo mais mudar por acaso.
        avisar({ detalhe: 'Enviando suas alterações' })
        await git(['push', 'origin', 'main'], dir)
        enviou = true
      }
    } catch (e) {
      falhouEnvio = e
      console.error('[sync] envio falhou (o que veio de fora já está aplicado):', e)
    }

    // Gravado mesmo com o envio falhando — é o que impede a próxima abertura
    // de achar que esta máquina mudou sozinha. Guarda o commit do REMOTO: se o
    // push não passou, o que o repositório de fato tem continua sendo o de antes.
    writeFileSync(
      marcador(),
      JSON.stringify(
        { hash: hash(arquivoLocal), commit: (await git(['rev-parse', 'origin/main'], dir)).trim() },
        null,
        2,
      ),
    )

    const ultima = new Date().toISOString()
    if (falhouEnvio && !conflito) {
      avisar({
        fase: 'envio-pendente',
        ultima,
        aplicouDeFora,
        detalhe: aplicouDeFora
          ? 'Dados do outro dispositivo aplicados. Suas alterações ainda não subiram — vão na próxima.'
          : 'Suas alterações ainda não subiram — vão na próxima sincronização',
      })
    } else if (conflito) {
      avisar({
        fase: 'conflito',
        ultima,
        aplicouDeFora,
        detalhe:
          (venceLocal
            ? `Os dois dispositivos mudaram. Vale o desta máquina (mais recente); o outro ficou em ${copiaConflito}`
            : `Os dois dispositivos mudaram. Vale o do outro (mais recente); o desta máquina ficou em ${copiaConflito}`) +
          (falhouEnvio ? ' Ainda não subiu — vai na próxima.' : ''),
      })
    } else {
      avisar({
        fase: 'em-dia',
        ultima,
        aplicouDeFora,
        detalhe: mudouLa ? 'Dados do outro dispositivo aplicados' : enviou ? 'Suas alterações foram enviadas' : 'Tudo em dia',
      })
    }
    return estado
  } catch (e) {
    console.error('[sync] falhou:', e)
    avisar({ fase: 'sem-rede', detalhe: 'Não deu pra sincronizar agora — seus dados continuam salvos aqui' })
    return estado
  }
}

/**
 * Sincroniza agora. Chamadas concorrentes compartilham a mesma execução: dois
 * comandos de git mexendo no mesmo clone ao mesmo tempo se atrapalhariam.
 */
export const sincronizar = (arquivoLocal: string) => {
  if (!REPO) {
    avisar({ fase: 'inativa', detalhe: 'Sincronização não configurada' })
    return Promise.resolve(estado)
  }
  if (emAndamento) return emAndamento
  emAndamento = trabalho(arquivoLocal).finally(() => {
    emAndamento = null
  })
  return emAndamento
}

/**
 * Agenda um envio pra daqui a pouco. Cada gravação chama isso, mas o app grava
 * a cada tecla digitada — enviar a cada uma seria um commit por caractere, então
 * o relógio reinicia a cada chamada e só o silêncio dispara o envio de verdade.
 */
export const agendarEnvio = (arquivoLocal: string, atrasoMs = 20_000) => {
  if (!REPO) return
  if (agendado) clearTimeout(agendado)
  agendado = setTimeout(() => {
    agendado = null
    void sincronizar(arquivoLocal)
  }, atrasoMs)
}

export const cancelarEnvioAgendado = () => {
  if (agendado) clearTimeout(agendado)
  agendado = null
}
