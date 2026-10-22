/**
 * Lança uma versão nova: sobe o número, empacota, publica a release no GitHub
 * e o app instalado se atualiza sozinho a partir dela.
 *
 *   npm run lancar -- correcao    1.2.3 -> 1.2.4   nada muda no jeito de usar
 *   npm run lancar -- melhoria    1.2.3 -> 1.3.0   funcionalidade ou fluxo novo
 *   npm run lancar -- reforma     1.2.3 -> 2.0.0   quebra dados ou reorganiza o app
 *
 * As releases públicas não precisam de token de leitura. Para publicar uma
 * release, use GH_TOKEN ou autentique o GitHub CLI com `gh auth login`.
 */
import { execFileSync, execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const PACOTE = join(RAIZ, 'package.json')

/*
 * npm, npx e gh sao .cmd no Windows e so rodam via shell. O git nao: com
 * shell, argumentos como --pretty=- %s seriam quebrados pelo proprio shell.
 */
const CMD = new Set(['npm', 'npx', 'gh'])
const comShell = (cmd) => process.platform === 'win32' && CMD.has(cmd)

const TIPOS = {
  correcao: 'patch',
  melhoria: 'minor',
  reforma: 'major',
  // os nomes em inglês também servem, para quem já tem o semver na cabeça
  patch: 'patch',
  minor: 'minor',
  major: 'major',
}

const morrer = (msg) => {
  console.error(`\n  ${msg}\n`)
  process.exit(1)
}

/** Roda capturando a saída, com o mesmo cuidado com espaços. */
const rodar = (cmd, args, opcoes = {}) => {
  const opcoesBase = { cwd: RAIZ, encoding: 'utf8', stdio: 'pipe', ...opcoes }
  if (!comShell(cmd)) return execFileSync(cmd, args, opcoesBase).trim()
  const linha = [cmd, ...args.map((a) => (/[ "]/.test(a) ? `"${a}"` : a))].join(' ')
  return execSync(linha, opcoesBase).trim()
}

/**
 * Roda mostrando a saída. Quando precisa de shell (npm, npx e gh são .cmd no
 * Windows), monta a linha de comando com aspas em cada argumento: sem isso o
 * shell quebra qualquer caminho que tenha espaço — e este projeto mora em
 * "Projetos Pessoais".
 */
const mostrar = (cmd, args, env) => {
  const opcoes = { cwd: RAIZ, stdio: 'inherit', env: { ...process.env, ...env } }
  if (!comShell(cmd)) return execFileSync(cmd, args, opcoes)
  const linha = [cmd, ...args.map((a) => (/[ "]/.test(a) ? `"${a}"` : a))].join(' ')
  return execSync(linha, opcoes)
}

/* ------------------------------- conferências ------------------------------ */

const tipo = TIPOS[(process.argv[2] ?? '').toLowerCase()]
if (!tipo) {
  morrer(
    'diga o tamanho da mudança:\n' +
      '    npm run lancar -- correcao   (1.2.3 -> 1.2.4)  correção, texto, ajuste visual\n' +
      '    npm run lancar -- melhoria   (1.2.3 -> 1.3.0)  funcionalidade ou fluxo novo\n' +
      '    npm run lancar -- reforma    (1.2.3 -> 2.0.0)  quebra os dados salvos',
  )
}

if (rodar('git', ['status', '--porcelain'])) {
  morrer('tem alteração não comitada. Comite ou guarde antes de lançar.')
}

const ramo = rodar('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
if (ramo !== 'main') morrer(`você está no ramo "${ramo}". Lance a partir de main.`)

// Publicar a release exige token de escrita; o do gh CLI serve.
if (!process.env.GH_TOKEN) {
  try {
    process.env.GH_TOKEN = rodar('gh', ['auth', 'token'])
    console.log('  usando o token do gh CLI para publicar a release')
  } catch {
    morrer('falta GH_TOKEN e o gh CLI não está logado. Rode `gh auth login`.')
  }
}

/* --------------------------- testes antes de subir ------------------------- */

console.log('\n== conferindo o código ==')
mostrar('npm', ['run', 'typecheck'])
mostrar('npm', ['run', 'testar'])

/* ------------------------------ número da versão -------------------------- */

const anterior = JSON.parse(readFileSync(PACOTE, 'utf8')).version
rodar('npm', ['version', tipo, '--no-git-tag-version'])
const versao = JSON.parse(readFileSync(PACOTE, 'utf8')).version
console.log(`\n== ${anterior} -> ${versao} (${tipo}) ==`)

/* ----------------------- o que mudou desde a última ----------------------- */

let notas = ''
try {
  const ultimaTag = rodar('git', ['describe', '--tags', '--abbrev=0'])
  notas = rodar('git', ['log', `${ultimaTag}..HEAD`, '--pretty=- %s'])
} catch {
  notas = rodar('git', ['log', '-15', '--pretty=- %s'])
}
if (!notas) notas = '- ajustes internos'

/* ------------------------- empacota, marca e publica ---------------------- */

try {
  mostrar('npm', ['run', 'build'])
  mostrar('npx', ['electron-builder', '--win', '--publish', 'always'])
} catch (e) {
  // Empacotou errado: desfaz o número para não deixar a versão furada no repo.
  const p = JSON.parse(readFileSync(PACOTE, 'utf8'))
  p.version = anterior
  writeFileSync(PACOTE, JSON.stringify(p, null, 2) + '\n')
  morrer(`o empacotamento falhou, versão devolvida para ${anterior}: ${e.message}`)
}

rodar('git', ['add', 'package.json', 'package-lock.json'])
rodar('git', ['commit', '-m', `Versao ${versao}`])
rodar('git', ['tag', `v${versao}`])
/*
 * So a tag desta versao, nunca --tags.
 *
 * --tags empurra TODAS as tags locais, e basta uma antiga divergir da remota
 * pra o push inteiro ser recusado — mesmo com main e a tag nova ja aceitas.
 * O script morria ai, depois de ja ter criado a release, e ela ficava em
 * rascunho sem o instalador. Empurrar so o que interessa nao depende do
 * estado das tags velhas.
 */
mostrar('git', ['push', 'origin', 'main'])
mostrar('git', ['push', 'origin', `v${versao}`])

try {
  const arquivoNotas = join(RAIZ, 'release', 'notas.md')
  writeFileSync(arquivoNotas, notas)
  mostrar('gh', ['release', 'edit', `v${versao}`, '--draft=false', '--notes-file', arquivoNotas])
} catch {
  console.log('  (não deu para escrever as notas na release; edite pelo site se quiser)')
}

/*
 * Sem o latest.yml na release, o app instalado nao enxerga a versao nova e a
 * atualizacao automatica falha em silencio. Melhor descobrir aqui.
 */
try {
  const args = [
    'release',
    'view',
    `v${versao}`,
    '--json',
    'assets',
    '-q',
    '.assets[].name',
  ]
  if (!rodar('gh', args).includes('latest.yml')) {
    console.error(
      '\n  ATENCAO: a release saiu sem latest.yml — o updater nao enxerga esta versao.',
    )
    console.error('  Rode de novo: npx electron-builder --win --publish always\n')
  }
} catch {
  console.log('  (nao deu para conferir os arquivos da release)')
}

console.log(`\n  versão ${versao} publicada.`)
console.log('  quem já tem o app instalado recebe o aviso na próxima vez que abrir.\n')
