/**
 * Teste ponta a ponta do OCR, rodando dentro do Electron.
 *
 * Renderiza prints sintéticos (parecidos com notificação de banco e com lista
 * de fatura), captura como imagem, passa pelo Tesseract e confere o que o
 * parser extraiu. Uso: npm run testar:ocr
 */
import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'

// app.getAppPath() aponta para a pasta do script quando o Electron e chamado
// com um arquivo; a raiz do projeto e um nivel acima.
const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..')

// Sem GPU o capturePage e mais confiavel em maquina sem sessao grafica ativa.
app.disableHardwareAcceleration()

// Fechar a janela de captura nao pode encerrar o app no meio do teste.
app.on('window-all-closed', () => {})

// O modulo de OCR resolve a pasta de idiomas por app.getAppPath(), que aqui
// aponta para scripts/; o teste aponta direto para a pasta real.
process.env.BOLSO_TESSDATA = join(RAIZ, 'resources', 'tessdata')

const CASOS = [
  {
    nome: 'notificação de compra parcelada',
    html: `
      <div class="tela">
        <div class="topo">Nubank</div>
        <h1>Compra aprovada</h1>
        <p class="loja">MAGAZINE LUIZA</p>
        <p class="valor">R$ 2.499,00</p>
        <p class="linha">Cartao de credito &bull;&bull;&bull;&bull; 4417</p>
        <p class="linha">Parcelado em 10x de R$ 249,90</p>
        <p class="linha">15/08/2026 as 14:32</p>
      </div>`,
    esperado: { valorTotal: 2499, parcelas: 10, data: '2026-08-15', cartao: 'digitos', categoria: 'Eletrônicos' },
  },
  {
    nome: 'lista de lançamentos da fatura',
    html: `
      <div class="tela lista">
        <h1>Fatura de agosto</h1>
        <div class="item"><span>SUPERMERCADO ZONA SUL</span><b>R$ 312,45</b></div>
        <div class="item"><span>IFOOD</span><b>R$ 78,90</b></div>
        <div class="item"><span>POSTO IPIRANGA</span><b>R$ 250,00</b></div>
        <div class="item"><span>NETFLIX</span><b>R$ 59,90</b></div>
        <div class="item total"><span>Total</span><b>R$ 701,25</b></div>
      </div>`,
    esperado: { valorTotal: 701.25, minItens: 3 },
  },
]

const ESTILO = `
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#fff; font-family:"Segoe UI",Arial,sans-serif; color:#111; }
    .tela { width:560px; padding:32px 36px; }
    .topo { font-size:20px; font-weight:700; color:#820AD1; margin-bottom:18px; }
    h1 { font-size:26px; margin-bottom:16px; }
    .loja { font-size:24px; font-weight:600; margin-bottom:10px; }
    .valor { font-size:38px; font-weight:700; margin-bottom:18px; }
    .linha { font-size:20px; margin-bottom:8px; color:#333; }
    .lista .item { display:flex; justify-content:space-between; font-size:21px; padding:10px 0; border-bottom:1px solid #ddd; }
    .lista .item b { font-weight:600; }
    .lista .total { font-weight:700; border-bottom:none; }
  </style>`

/** Compila os módulos TS que o teste precisa e importa o resultado. */
const carregarModulos = async () => {
  const saida = join(RAIZ, 'dist-electron', 'teste-ocr-modulos.cjs')
  await build({
    entryPoints: [join(RAIZ, 'scripts', 'ponte-ocr.ts')],
    outfile: saida,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron', 'tesseract.js'],
    logLevel: 'silent',
  })
  return await import(pathToFileURL(saida).href)
}

const capturar = async (html) => {
  const janela = new BrowserWindow({
    show: false,
    width: 560,
    height: 560,
    frame: false,
    webPreferences: { offscreen: false },
  })
  await janela.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`<html><body>${ESTILO}${html}</body></html>`)}`,
  )
  await new Promise((r) => setTimeout(r, 350))
  const imagem = await janela.webContents.capturePage()
  janela.destroy()
  return `data:image/png;base64,${imagem.toPNG().toString('base64')}`
}

app.whenReady().then(async () => {
  const { reconhecer, interpretar, bancoPorId } = await carregarModulos()

  const cartoes = [
    {
      id: 'c1',
      apelido: 'Nubank Matheus',
      bancoId: 'nubank',
      bandeira: 'mastercard',
      pessoaId: 'p1',
      limite: 10000,
      diaFechamento: 25,
      diaVencimento: 5,
      ultimosDigitos: '4417',
      ativo: true,
      criadoEm: '',
    },
    {
      id: 'c2',
      apelido: 'Itau Leticia',
      bancoId: 'itau',
      bandeira: 'visa',
      pessoaId: 'p2',
      limite: 6000,
      diaFechamento: 10,
      diaVencimento: 20,
      ultimosDigitos: '9012',
      ativo: true,
      criadoEm: '',
    },
  ]

  let falhas = 0

  for (const caso of CASOS) {
    console.log(`\n=== ${caso.nome} ===`)
    const dataUrl = await capturar(caso.html)
    const inicio = Date.now()
    const r = await reconhecer(dataUrl)
    const s = interpretar(r.texto, cartoes, (id) => bancoPorId(id).nome)

    console.log(`  confianca ......... ${Math.round(r.confianca)}%  (${Date.now() - inicio}ms)`)
    console.log(`  valor ............. ${s.valorTotal}  (esperado ${caso.esperado.valorTotal})`)
    console.log(`  parcelas .......... ${s.parcelas}`)
    console.log(`  data .............. ${s.dataCompra}`)
    console.log(`  cartao ............ ${cartoes.find((c) => c.id === s.cartaoId)?.apelido}`)
    console.log(`  descricao ......... ${JSON.stringify(s.descricao)}`)
    console.log(`  categoria ......... ${s.categoria}`)
    console.log(`  itens da lista .... ${s.itens.length}`)

    const checar = (rotulo, ok) => {
      console.log(`  ${ok ? 'OK  ' : 'FALHOU'} ${rotulo}`)
      if (!ok) falhas++
    }

    if (caso.esperado.valorTotal != null) {
      checar('valor total', Math.abs(s.valorTotal - caso.esperado.valorTotal) < 0.02)
    }
    if (caso.esperado.parcelas != null) checar('parcelas', s.parcelas === caso.esperado.parcelas)
    if (caso.esperado.data) checar('data exata', s.dataCompra === caso.esperado.data)
    if (caso.esperado.categoria) checar('categoria', s.categoria === caso.esperado.categoria)
    if (caso.esperado.cartao === 'digitos') checar('cartao pelos digitos', s.cartaoId === 'c1')
    if (caso.esperado.minItens != null) {
      checar(`pelo menos ${caso.esperado.minItens} itens`, s.itens.length >= caso.esperado.minItens)
      if (s.itens.length) console.log('    ' + s.itens.map((i) => `${i.descricao}=${i.valor}`).join(' | '))
    }
  }

  console.log(`\n${falhas === 0 ? 'TODOS OS CASOS PASSARAM' : `${falhas} verificacoes falharam`}`)
  app.exit(falhas === 0 ? 0 : 1)
})
