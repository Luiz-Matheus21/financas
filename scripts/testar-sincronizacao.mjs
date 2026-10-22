import { build } from 'esbuild'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
async function carregar(arquivo, extras = {}, plugins = []) {
  const r = await build({ entryPoints: [arquivo], bundle: true, write: false, platform: 'node', format: 'cjs', define: { 'import.meta.env.VITE_API_URL': 'undefined' }, plugins })
  const contexto = { module: { exports: {} }, exports: {}, require, console, setTimeout, clearTimeout, AbortController, Response, process, ...extras }
  contexto.exports = contexto.module.exports
  vm.runInNewContext(r.outputFiles[0].text, contexto)
  return contexto.module.exports
}
const base = new URL('../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const raiz = decodeURIComponent(base)
const sync = await carregar(join(raiz, 'src/lib/sincronizacao.ts'))
const uid = '11111111-1111-4111-8111-111111111111'
const uid2 = '22222222-2222-4222-8222-222222222222'
const cartao = { id: 'local-cartao', apelido: 'Meu cartão' }
const compra = { id: 'local-compra', descricao: 'Mercado', cartaoId: cartao.id, valorTotal: 25 }
const dados = { cartoes: [cartao], compras: [compra], ganhos: [], gastosFixos: [], faturas: [{ cartaoId: cartao.id, mes: '2026-10' }], config: { ultimoCartaoId: cartao.id } }
const fila = [
  { id: 'p1', recurso: 'cartoes', acao: 'criar', corpo: { apelido: cartao.apelido } },
  { id: 'p2', recurso: 'compras', acao: 'criar', corpo: { descricao: compra.descricao, cartaoId: cartao.id, valorTotal: 25 } },
  { id: 'p3', recurso: 'compras', acao: 'atualizar', alvo: compra.id, corpo: { valorTotal: 30 } },
  { id: 'p4', recurso: 'faturas', acao: 'remover', alvo: `${cartao.id}|2026-10` },
]
const ids = [uid, uid2]
const migrado = sync.migrarPendencias(dados, fila, () => ids.shift())
assert.equal(migrado.dados.cartoes[0].id, uid)
assert.equal(migrado.dados.compras[0].cartaoId, uid)
assert.equal(migrado.fila[1].corpo.id, uid2)
assert.equal(migrado.fila[1].corpo.cartaoId, uid)
assert.equal(migrado.fila[2].alvo, uid2)
assert.equal(migrado.fila[3].alvo, `${uid}|2026-10`)
assert.equal(migrado.dados.faturas[0].cartaoId, uid)
assert.equal(migrado.dados.config.ultimoCartaoId, uid)
assert.equal(sync.migrarPendencias(migrado.dados, migrado.fila, () => { throw Error('UUID não deve mudar') }).fila[0].corpo.id, uid)
assert.equal(dados.cartoes[0].id, 'local-cartao')
const editado = sync.migrarPendencias({ ...dados, compras: [{ ...compra, valorTotal: 30 }] }, fila, (() => { const valores = [uid, uid2]; return () => valores.shift() })())
assert.equal(editado.dados.compras[0].id, uid2, 'criação antiga editada offline mantém os vínculos')
assert.equal(editado.fila[2].alvo, uid2)

console.log('OK: migração preserva UUIDs, vínculos, edições, faturas e cache original')

const familia = sync.combinarFamilia(
  { ...dados, compras: [{ ...compra, cartaoId: null, valorTotal: 32, parcelas: 1, dataCompra: '2026-10-15' }], gastosFixos: [{ id: 'avulso', descricao: 'Almoço', valor: 18, recorrencia: 'unica', mesInicio: '2026-10' }] },
  { compras: [{ ...compra, usuarioId: uid, valorTotal: 999 }, { id: 'leticia', usuarioId: uid2, descricao: 'Táxi', cartaoId: null, parcelas: 1, valorTotal: 20, dataCompra: '2026-10-15' }] }, uid,
)
assert.equal(familia.compras.length, 2, 'retrato da família não duplica os meus dados')
assert.equal(familia.compras[0].valorTotal, 32, 'edição local prevalece')
assert.equal(familia.compras[0].usuarioId, uid)
assert.equal(familia.compras[1].usuarioId, uid2)
const financeiro = await carregar(join(raiz, 'src/lib/finance.ts'))
const resumo = financeiro.resumoDoMes(familia, '2026-10')
assert.equal(resumo.avulsos, 52)
assert.equal(resumo.fixos, 18)
assert.equal(resumo.gastos, 70)
assert.equal(financeiro.resumoDoMes(familia, '2026-10', [uid2]).gastos, 20)
assert.equal(financeiro.resumoDoMes(familia, '2026-11').gastos, 0, 'avulsos não se repetem')
console.log('OK: família inclui dinheiro e avulsos do mês, respeita filtro e preserva edição local')

for (const app of ['bolso', 'bolso-mobile']) {
  let apagou = 0
  let chamadas = 0
  let modo = 'offline-refresh'
  const memoria = new Map()
  const storage = { setItem: async (k,v) => memoria.set(k,v), getItem: async (k) => memoria.get(k) ?? null, removeItem: async (k) => { apagou++; memoria.delete(k) } }
  const plugin = { name: 'storage', setup(b) { b.onResolve({ filter: /^@react-native-async-storage\/async-storage$/ }, () => ({ path: 'storage', namespace: 'mock' })); b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export default globalThis.storage' })) } }
  const caminho = join(raiz, '..', app, 'src/lib/api.ts')
  const api = await carregar(caminho, {
    storage,
    window: { bolso: { sessao: { gravar: async () => {}, apagar: async () => { apagou++ } } } },
    fetch: async (url, opcoes) => {
      assert.ok(opcoes.signal)
      chamadas++
      if (url.endsWith('/auth/refresh')) {
        if (modo === 'offline-refresh') throw Error('rede indisponível')
        if (modo === 'invalid-refresh') return new Response('{}', { status: 401 })
        return new Response(JSON.stringify({ acesso: 'novo', refresh: 'novo-refresh' }))
      }
      if (modo === 'servidor-fora') return new Response('{}', { status: 503 })
      if (modo === 'retomou' && opcoes.headers.Authorization === 'Bearer novo') return new Response('{"ganhos":[]}')
      return new Response('{}', { status: 401 })
    },
  }, app === 'bolso-mobile' ? [plugin] : [])
  const sessao = { acesso: 'antigo', refresh: 'refresh', usuario: { id: uid }, lembrar: true }
  api.definirSessao(sessao)
  await assert.rejects(api.api.dados.tudo(), (e) => e instanceof api.ErroRede)
  assert.equal(api.sessaoAtual().refresh, 'refresh')
  assert.equal(apagou, 0)
  modo = 'servidor-fora'
  await assert.rejects(api.api.dados.tudo(), (e) => e instanceof api.ErroRede)
  assert.equal(apagou, 0)
  modo = 'retomou'
  chamadas = 0
  await Promise.all([api.api.dados.tudo(), api.api.dados.tudo()])
  assert.equal(api.sessaoAtual().acesso, 'novo')
  assert.equal(chamadas, 5, 'duas chamadas compartilham uma renovação')
  modo = 'invalid-refresh'
  api.definirSessao(sessao)
  await assert.rejects(api.api.dados.tudo())
  assert.equal(api.sessaoAtual(), null)
  console.log(`OK: ${app} mantém sessão sem rede/503, renova uma vez e encerra sessão revogada`)
}

const pasta = mkdtempSync(join(tmpdir(), 'financas-sync-'))
try {
  const plugin = { name: 'electron', setup(b) { b.onResolve({ filter: /^electron$/ }, () => ({ path: 'electron', namespace: 'mock' })); b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const app = { getPath: () => globalThis.pasta }' })) } }
  const store = await carregar(join(raiz, 'electron/store.ts'), { pasta }, [plugin])
  store.gravar({ ...dados, _usuarioId: uid, _fila: fila }, uid)
  assert.equal(store.ler(uid)._fila.length, 4)
  store.gravar({ ...dados, _usuarioId: uid2, _fila: [] }, uid2)
  assert.equal(store.ler(uid)._fila.length, 4)
  assert.equal(store.ler(uid2)._fila.length, 0)
  assert.equal(store.ler(uid)._usuarioId, uid)
  console.log('OK: Electron conserva fila no disco e isola contas')
} finally {
  assert.ok(pasta.startsWith(join(tmpdir(), 'financas-sync-')))
  rmSync(pasta, { recursive: true, force: true })
}
