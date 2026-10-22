/**
 * Gera os ícones dos dois apps a partir de código — sem depender de editor de
 * imagem, e com o desenho versionado junto do resto.
 *
 *   npm run gerar:icone
 *
 * O desenho: quadrado arredondado verde da marca, e por cima um cartão escuro
 * com três barras ascendentes dentro. É o app em uma imagem — cartão e gasto
 * crescendo — e não um cofrinho genérico. As medidas foram escolhidas para
 * sobreviver a 16px: barra de 2px com 1px de folga é o menor par que ainda lê
 * como "três barras subindo" em vez de um borrão.
 *
 * Cada tamanho é rasterizado com supersampling 4x4 para as bordas não
 * serrilharem. Escreve:
 *
 *   build/icon.ico                              (desktop, multi-tamanho)
 *   ../bolso-mobile/assets/icon.png             (1024, ícone cheio)
 *   ../bolso-mobile/assets/android-icon-foreground.png  (só o cartão, na zona segura)
 *   ../bolso-mobile/assets/android-icon-background.png  (só o verde)
 *   ../bolso-mobile/assets/android-icon-monochrome.png  (silhueta branca)
 *   ../bolso-mobile/assets/splash-icon.png
 *   ../bolso-mobile/assets/favicon.png
 *
 * Os assets do celular só são escritos se o repositório bolso-mobile estiver
 * clonado ao lado deste.
 */
import { deflateSync } from 'node:zlib'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const MOBILE = join(RAIZ, '..', 'bolso-mobile')
const TAMANHOS_ICO = [16, 24, 32, 48, 64, 128, 256]

/*
 * ATENÇÃO — este script está desatualizado em relação aos ícones publicados.
 *
 * Desde 12/09/2026 os ícones do app vêm dos PNGs em `build/fonte/`, desenhados
 * fora daqui, e não mais do código abaixo. O desenho mudou: o cartão ganhou um
 * chip no canto superior esquerdo, que este script não desenha.
 *
 * Rodar isso sobrescreveria os sete arquivos com o desenho ANTIGO, sem o chip.
 * Por isso ele agora exige confirmação explícita:
 *
 *   node scripts/gerar-icone.mjs --quero-o-desenho-antigo
 *
 * Para voltar a ter um gerador fiel ao que está publicado, o caminho é portar
 * o chip para o `rasterizar()` daqui — aí o comentário some e o script volta a
 * ser a fonte da verdade.
 */
if (!process.argv.includes('--quero-o-desenho-antigo')) {
  console.error('')
  console.error('  Este script gera o desenho ANTIGO (sem o chip) e sobrescreveria')
  console.error('  os ícones atuais, que vêm de build/fonte/.')
  console.error('')
  console.error('  Se é isso mesmo que você quer:')
  console.error('    node scripts/gerar-icone.mjs --quero-o-desenho-antigo')
  console.error('')
  process.exit(1)
}

/* ------------------------------- desenho -------------------------------- */

const VERDE_CLARO = [0x3d, 0xe8, 0x9c]
const VERDE_ESCURO = [0x10, 0x96, 0x63]
const ESCURO = [0x06, 0x23, 0x1a]
const BRANCO = [0xff, 0xff, 0xff]

/** Está dentro de um retângulo de cantos arredondados? Coordenadas 0..1. */
const dentroRRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.max(x0 + r, Math.min(x, x1 - r))
  const cy = Math.max(y0 + r, Math.min(y, y1 - r))
  const noCantoX = x < x0 + r || x > x1 - r
  const noCantoY = y < y0 + r || y > y1 - r
  if (noCantoX && noCantoY) return Math.hypot(x - cx, y - cy) <= r
  return true
}

/* O cartão e as barras, em coordenadas 0..1 do quadrado inteiro. */
const CARTAO = { x0: 0.14, y0: 0.25, x1: 0.86, y1: 0.75, r: 0.085 }
const BASE_BARRAS = 0.665
const BARRAS = [
  { x0: 0.25, x1: 0.375, topo: 0.555 },
  { x0: 0.4375, x1: 0.5625, topo: 0.465 },
  { x0: 0.625, x1: 0.75, topo: 0.375 },
]

const noCartao = (x, y) => dentroRRect(x, y, CARTAO.x0, CARTAO.y0, CARTAO.x1, CARTAO.y1, CARTAO.r)

const naBarra = (x, y) =>
  BARRAS.some((b) => x >= b.x0 && x <= b.x1 && y >= b.topo && y <= BASE_BARRAS)

/**
 * Cor de um ponto, ou null para transparente.
 *
 * @param modo 'cheio'  quadrado verde + cartão (ícone normal)
 *             'frente' só o cartão, sem fundo (primeiro plano do adaptativo)
 *             'fundo'  só o quadrado verde, sem cartão
 *             'mono'   silhueta branca do cartão
 */
const pintar = (x, y, modo = 'cheio') => {
  if (modo === 'frente' || modo === 'mono') {
    if (!noCartao(x, y)) return null
    if (modo === 'mono') return naBarra(x, y) ? null : BRANCO
    return naBarra(x, y) ? VERDE_CLARO : ESCURO
  }

  if (!dentroRRect(x, y, 0.02, 0.02, 0.98, 0.98, 0.22)) return null

  // Gradiente diagonal do fundo: dá volume sem precisar de sombra.
  const t = Math.min(1, Math.max(0, (x + y) / 2))
  const fundo = VERDE_CLARO.map((c, i) => Math.round(c + (VERDE_ESCURO[i] - c) * t))
  if (modo === 'fundo') return fundo

  if (!noCartao(x, y)) return fundo
  return naBarra(x, y) ? VERDE_CLARO : ESCURO
}

/**
 * Rasteriza um lado em RGBA.
 *
 * @param escala reduz o desenho e centraliza — o primeiro plano do ícone
 *               adaptativo do Android é recortado num círculo, então o desenho
 *               precisa caber na parte central para não ter as pontas comidas.
 */
const rasterizar = (lado, modo = 'cheio', escala = 1) => {
  const amostras = 4
  const pixels = Buffer.alloc(lado * lado * 4)
  const meio = 0.5
  for (let py = 0; py < lado; py++) {
    for (let px = 0; px < lado; px++) {
      let r = 0
      let g = 0
      let b = 0
      let cobertos = 0
      for (let sy = 0; sy < amostras; sy++) {
        for (let sx = 0; sx < amostras; sx++) {
          const x = (px + (sx + 0.5) / amostras) / lado
          const y = (py + (sy + 0.5) / amostras) / lado
          const cor = pintar(meio + (x - meio) / escala, meio + (y - meio) / escala, modo)
          if (!cor) continue
          r += cor[0]
          g += cor[1]
          b += cor[2]
          cobertos++
        }
      }
      if (cobertos === 0) continue
      const i = (py * lado + px) * 4
      pixels[i] = Math.round(r / cobertos)
      pixels[i + 1] = Math.round(g / cobertos)
      pixels[i + 2] = Math.round(b / cobertos)
      pixels[i + 3] = Math.round((cobertos / (amostras * amostras)) * 255)
    }
  }
  return pixels
}

/* --------------------------------- PNG ---------------------------------- */

const TABELA_CRC = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

const crc32 = (buf) => {
  let c = 0xffffffff
  for (const byte of buf) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const pedaco = (tipo, dados) => {
  const nome = Buffer.from(tipo, 'ascii')
  const tamanho = Buffer.alloc(4)
  tamanho.writeUInt32BE(dados.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([nome, dados])))
  return Buffer.concat([tamanho, nome, dados, crc])
}

const png = (lado, pixels) => {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(lado, 0)
  ihdr.writeUInt32BE(lado, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA

  // Cada linha carrega um byte de filtro (0 = sem filtro) na frente.
  const linhas = Buffer.alloc((lado * 4 + 1) * lado)
  for (let y = 0; y < lado; y++) {
    const destino = y * (lado * 4 + 1)
    linhas[destino] = 0
    pixels.copy(linhas, destino + 1, y * lado * 4, (y + 1) * lado * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedaco('IHDR', ihdr),
    pedaco('IDAT', deflateSync(linhas, { level: 9 })),
    pedaco('IEND', Buffer.alloc(0)),
  ])
}

/* --------------------------------- ICO ---------------------------------- */

const ico = (imagens) => {
  const cabecalho = Buffer.alloc(6)
  cabecalho.writeUInt16LE(0, 0)
  cabecalho.writeUInt16LE(1, 2) // 1 = ícone
  cabecalho.writeUInt16LE(imagens.length, 4)

  let deslocamento = 6 + imagens.length * 16
  const entradas = []
  for (const { lado, dados } of imagens) {
    const e = Buffer.alloc(16)
    e[0] = lado >= 256 ? 0 : lado // 0 significa 256
    e[1] = lado >= 256 ? 0 : lado
    e.writeUInt16LE(1, 4) // planos
    e.writeUInt16LE(32, 6) // bits por pixel
    e.writeUInt32LE(dados.length, 8)
    e.writeUInt32LE(deslocamento, 12)
    entradas.push(e)
    deslocamento += dados.length
  }

  return Buffer.concat([cabecalho, ...entradas, ...imagens.map((i) => i.dados)])
}

/* -------------------------------- saída --------------------------------- */

const gravar = (caminho, conteudo) => {
  mkdirSync(join(caminho, '..'), { recursive: true })
  writeFileSync(caminho, conteudo)
  console.log(`  ${caminho.replace(join(RAIZ, '..'), '.')}  ${(conteudo.length / 1024).toFixed(1)} kB`)
}

console.log('\n== desktop ==')
gravar(
  join(RAIZ, 'build', 'icon.ico'),
  ico(TAMANHOS_ICO.map((lado) => ({ lado, dados: png(lado, rasterizar(lado)) }))),
)

if (existsSync(MOBILE)) {
  const assets = join(MOBILE, 'assets')
  console.log('\n== celular ==')
  gravar(join(assets, 'icon.png'), png(1024, rasterizar(1024)))
  gravar(join(assets, 'splash-icon.png'), png(1024, rasterizar(1024)))
  gravar(join(assets, 'favicon.png'), png(48, rasterizar(48)))
  // 0.62 mantém o cartão dentro do círculo que o Android recorta.
  gravar(join(assets, 'android-icon-foreground.png'), png(1024, rasterizar(1024, 'frente', 0.62)))
  gravar(join(assets, 'android-icon-background.png'), png(1024, rasterizar(1024, 'fundo')))
  gravar(join(assets, 'android-icon-monochrome.png'), png(1024, rasterizar(1024, 'mono', 0.62)))
} else {
  console.log(`\n  (bolso-mobile não está em ${MOBILE}; assets do celular não foram gerados)`)
}

console.log('')
