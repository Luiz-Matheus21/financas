import { createServer } from 'vite'
import { spawn } from 'node:child_process'
import { build, context } from 'esbuild'

const common = {
  bundle: true, platform: 'node', target: 'node22', format: 'cjs',
  sourcemap: true, external: ['electron', 'tesseract.js'], logLevel: 'warning',
}

const server = await createServer()
await server.listen()
const url = server.resolvedUrls.local[0]
console.log(`\n  Bolso  ·  renderer em ${url}\n`)

await build({ ...common, entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.js' })
await build({ ...common, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.js' })

const electronPath = (await import('electron')).default
// O VS Code (e qualquer host Electron) exporta ELECTRON_RUN_AS_NODE; se ele
// vazar para o filho, o Electron sobe como Node puro e `app` vem undefined.
const env = { ...process.env, VITE_DEV_SERVER_URL: url }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(electronPath, ['.'], { stdio: 'inherit', env })
child.on('close', async () => { await server.close(); process.exit(0) })
