import type { Bandeira } from './types'
import { TRACOS } from './logos'

export interface Banco {
  id: string
  nome: string
  /** Cor oficial da marca — é o que dá identidade ao cartão na tela. */
  cor: string
  /** Cor do glifo sobre a cor da marca. */
  tinta: string
  /** Chave em TRACOS quando existe logo oficial; senão cai no monograma. */
  traco?: keyof typeof TRACOS
  monograma?: string
}

/**
 * Catálogo dos bancos e carteiras usados no Brasil. Quem tem logo no
 * simple-icons aparece com o traçado oficial; o resto usa monograma na cor
 * da marca, o que mantém a fileira de cartões visualmente consistente.
 */
const CATALOGO: Banco[] = [
  { id: 'nubank', nome: 'Nubank', cor: '#820AD1', tinta: '#FFFFFF', traco: 'nubank' },
  { id: 'itau', nome: 'Itaú', cor: '#EC7000', tinta: '#FFFFFF', monograma: 'it' },
  { id: 'bradesco', nome: 'Bradesco', cor: '#CC092F', tinta: '#FFFFFF', monograma: 'br' },
  { id: 'santander', nome: 'Santander', cor: '#EC0000', tinta: '#FFFFFF', monograma: 'S' },
  { id: 'bb', nome: 'Banco do Brasil', cor: '#FAE128', tinta: '#0A3D91', monograma: 'BB' },
  { id: 'caixa', nome: 'Caixa', cor: '#1C5FA8', tinta: '#F58220', monograma: 'CX' },
  { id: 'inter', nome: 'Inter', cor: '#FF7A00', tinta: '#FFFFFF', monograma: 'in' },
  { id: 'c6', nome: 'C6 Bank', cor: '#1C1C1C', tinta: '#D5B676', monograma: 'C6' },
  { id: 'btg', nome: 'BTG Pactual', cor: '#04213F', tinta: '#B8C4D4', monograma: 'BTG' },
  { id: 'xp', nome: 'XP', cor: '#0D0D0D', tinta: '#FFD100', monograma: 'XP' },
  { id: 'picpay', nome: 'PicPay', cor: '#11C76F', tinta: '#FFFFFF', traco: 'picpay' },
  { id: 'mercadopago', nome: 'Mercado Pago', cor: '#00A8E0', tinta: '#FFFFFF', traco: 'mercadopago' },
  { id: 'pagbank', nome: 'PagBank', cor: '#00A868', tinta: '#FFFFFF', monograma: 'pb' },
  { id: 'neon', nome: 'Neon', cor: '#00A3FF', tinta: '#FFFFFF', monograma: 'ne' },
  { id: 'next', nome: 'Next', cor: '#00E88F', tinta: '#0B2B1F', monograma: 'nx' },
  { id: 'original', nome: 'Banco Original', cor: '#F5A623', tinta: '#1A1A1A', monograma: 'bo' },
  { id: 'will', nome: 'Will Bank', cor: '#F53F5B', tinta: '#FFFFFF', monograma: 'will' },
  { id: 'pan', nome: 'Banco Pan', cor: '#00A3E0', tinta: '#FFFFFF', monograma: 'pan' },
  { id: 'bmg', nome: 'Banco BMG', cor: '#F58220', tinta: '#FFFFFF', monograma: 'bmg' },
  { id: 'safra', nome: 'Safra', cor: '#003C71', tinta: '#FFFFFF', monograma: 'sa' },
  { id: 'sicoob', nome: 'Sicoob', cor: '#00AE9D', tinta: '#FFFFFF', monograma: 'sic' },
  { id: 'sicredi', nome: 'Sicredi', cor: '#3FA110', tinta: '#FFFFFF', monograma: 'scr' },
  { id: 'digio', nome: 'digio', cor: '#0F5CF0', tinta: '#FFFFFF', monograma: 'dg' },
  { id: 'agibank', nome: 'Agibank', cor: '#00A0DF', tinta: '#FFFFFF', monograma: 'ag' },
  { id: 'unicred', nome: 'Unicred', cor: '#00539F', tinta: '#FFFFFF', monograma: 'un' },
  { id: 'banrisul', nome: 'Banrisul', cor: '#005CA9', tinta: '#FFFFFF', monograma: 'bs' },
  { id: 'nomad', nome: 'Nomad', cor: '#1B1B1B', tinta: '#FFFFFF', monograma: 'nm' },
  { id: 'outro', nome: 'Outro banco', cor: '#64748B', tinta: '#FFFFFF', monograma: '•' },
]

/**
 * Ordem alfabética: é como se procura banco numa lista longa. "Outro banco"
 * escapa da regra e fica sempre no fim, que é onde se olha quando não achou.
 */
export const BANCOS: Banco[] = [...CATALOGO].sort((a, b) =>
  a.id === 'outro' ? 1 : b.id === 'outro' ? -1 : a.nome.localeCompare(b.nome, 'pt-BR'),
)

const OUTRO = CATALOGO.find((b) => b.id === 'outro')!

export const bancoPorId = (id: string): Banco =>
  CATALOGO.find((b) => b.id === id) ?? OUTRO

/**
 * Bandeira que cada banco emite com mais frequência no cartão de crédito.
 * É chute inicial do formulário, não verdade absoluta: o mesmo banco emite
 * Visa e Mastercard na mesma linha, então quem cadastra confere no cartão.
 */
const BANDEIRA_USUAL: Record<string, Bandeira> = {
  nubank: 'mastercard',
  itau: 'visa',
  bradesco: 'visa',
  santander: 'mastercard',
  bb: 'elo',
  caixa: 'elo',
  inter: 'mastercard',
  c6: 'mastercard',
  btg: 'mastercard',
  xp: 'visa',
  picpay: 'mastercard',
  mercadopago: 'mastercard',
  pagbank: 'visa',
  neon: 'visa',
  next: 'visa',
  original: 'mastercard',
  will: 'mastercard',
  pan: 'mastercard',
  bmg: 'mastercard',
  safra: 'mastercard',
  sicoob: 'visa',
  sicredi: 'mastercard',
  digio: 'visa',
  agibank: 'visa',
  unicred: 'mastercard',
  banrisul: 'mastercard',
  nomad: 'mastercard',
}

/** Bandeira a sugerir quando o banco é escolhido. */
export const bandeiraUsual = (bancoId: string): Bandeira =>
  BANDEIRA_USUAL[bancoId] ?? 'mastercard'

/** Bandeiras. Visa e Mastercard têm logo oficial; as outras usam texto. */
export const BANDEIRAS: { id: Bandeira; nome: string; traco?: keyof typeof TRACOS; cor: string }[] = [
  { id: 'visa', nome: 'Visa', traco: 'visa', cor: '#1A1F71' },
  { id: 'mastercard', nome: 'Mastercard', traco: 'mastercard', cor: '#EB001B' },
  { id: 'elo', nome: 'Elo', cor: '#FFCB05' },
  { id: 'amex', nome: 'American Express', cor: '#2671B9' },
  { id: 'hipercard', nome: 'Hipercard', cor: '#822124' },
  { id: 'outra', nome: 'Outra', cor: '#64748B' },
]

export const bandeiraPorId = (id: Bandeira) =>
  BANDEIRAS.find((b) => b.id === id) ?? BANDEIRAS[BANDEIRAS.length - 1]!

interface MarcaProps {
  bancoId: string
  /** Lado do quadrado em px. */
  tamanho?: number
  className?: string
  /** Sem o fundo colorido: só o glifo, na cor da marca. */
  chapado?: boolean
}

/** Marca do banco: ladrilho arredondado na cor oficial com o glifo por cima. */
export function MarcaBanco({ bancoId, tamanho = 40, className, chapado }: MarcaProps) {
  const banco = bancoPorId(bancoId)
  const traco = banco.traco ? TRACOS[banco.traco] : undefined
  const fonte = Math.round(tamanho * (banco.monograma && banco.monograma.length > 2 ? 0.3 : 0.42))

  return (
    <span
      className={className}
      title={banco.nome}
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: Math.round(tamanho * 0.28),
        background: chapado ? 'transparent' : banco.cor,
        color: chapado ? banco.cor : banco.tinta,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: chapado ? 'none' : 'inset 0 1px 0 rgba(255,255,255,.18)',
      }}
    >
      {traco ? (
        <svg
          viewBox="0 0 24 24"
          width={Math.round(tamanho * 0.56)}
          height={Math.round(tamanho * 0.56)}
          fill="currentColor"
          aria-hidden
        >
          <path d={traco} />
        </svg>
      ) : (
        <span
          style={{
            fontSize: fonte,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            fontFamily: 'inherit',
          }}
        >
          {banco.monograma}
        </span>
      )}
    </span>
  )
}

/** Selo da bandeira, para o canto do cartão. */
export function MarcaBandeira({ bandeira, tamanho = 22 }: { bandeira: Bandeira; tamanho?: number }) {
  const b = bandeiraPorId(bandeira)
  const traco = b.traco ? TRACOS[b.traco] : undefined
  if (traco) {
    return (
      <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="currentColor" aria-label={b.nome}>
        <path d={traco} />
      </svg>
    )
  }
  return (
    <span
      aria-label={b.nome}
      style={{ fontSize: Math.round(tamanho * 0.5), fontWeight: 800, letterSpacing: '.02em' }}
    >
      {b.nome === 'American Express' ? 'AMEX' : b.nome.toUpperCase()}
    </span>
  )
}

export const TRACO_PIX = TRACOS.pix
