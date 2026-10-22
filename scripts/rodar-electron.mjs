/**
 * Lança o Electron com o ambiente limpo.
 *
 * Terminais dentro de editores Electron (VS Code, Cursor) exportam
 * ELECTRON_RUN_AS_NODE=1. Se isso vazar para o filho, o Electron sobe como Node
 * puro, `app` vem undefined e o erro não tem nada a ver com o código.
 *
 * Uso: node scripts/rodar-electron.mjs <arquivo ou .> [args...]
 */
import { spawn } from 'node:child_process'
import electron from 'electron'

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const filho = spawn(electron, process.argv.slice(2), { stdio: 'inherit', env })
filho.on('close', (codigo) => process.exit(codigo ?? 0))
