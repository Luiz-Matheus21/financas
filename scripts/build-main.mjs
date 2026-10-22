import { build } from 'esbuild'

/* Credenciais opcionais são recebidas somente pelo ambiente de build. */
const token = process.env.BOLSO_TOKEN_ATUALIZACAO ?? ''
const urlApi = process.env.BOLSO_URL_API ?? ''

/*
 * Com BOLSO_URL_API o instalador sai SEM token: a atualizacao passa pela API,
 * que guarda a credencial do lado de la. E o caminho preferido; o token so
 * existe pra quem ainda nao tem a API no ar.
 */
if (urlApi) console.log(`[build] atualizacao pela API em ${urlApi}`)
else console.log('[build] atualizacao pelas releases publicas do GitHub')

const common = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: ['electron', 'tesseract.js', 'electron-updater'],
  define: {
    'process.env.BOLSO_TOKEN_ATUALIZACAO': JSON.stringify(urlApi ? '' : token),
    'process.env.BOLSO_URL_API': JSON.stringify(urlApi),
    'process.env.BOLSO_REPO_DADOS': JSON.stringify(process.env.BOLSO_REPO_DADOS ?? ''),
  },
  logLevel: 'info',
}

await build({ ...common, entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.js' })
await build({ ...common, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.js' })
