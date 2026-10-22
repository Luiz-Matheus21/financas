import { useEffect, useRef, useState } from 'react'
import { Camera, Pencil, Trash2, ZoomIn } from 'lucide-react'
import { Avatar, Botao, Modal } from '@/components/ui'

/**
 * Foto de perfil: escolher, enquadrar, confirmar.
 *
 * O desenho é o do WhatsApp de propósito — avatar no meio com um lápis no
 * canto, e a frase embaixo. É onde a pessoa já procura por isso; inventar outro
 * lugar só faria ela caçar o botão.
 *
 * O enquadramento existe porque foto de celular é retangular e o avatar é
 * redondo: sem escolher o pedaço, metade das fotos vira um recorte do ombro de
 * alguém. Mostrar o resultado antes de salvar é o que evita a foto errada ficar
 * aparecendo para a família inteira até alguém reclamar.
 */

/** O avatar maior do app tem 72 px; 256 dá folga para telas densas sem pesar. */
const LADO = 256
const QUALIDADE = 0.82
/** Bate com o teto do servidor, para a recusa acontecer antes de subir. */
const MAX_ARQUIVO = 12 * 1024 * 1024

interface Enquadramento {
  /** Quanto a imagem foi ampliada além do mínimo que cobre o quadro. */
  zoom: number
  /** Deslocamento do centro, em pixels da tela de preview. */
  x: number
  y: number
}

const INICIAL: Enquadramento = { zoom: 1, x: 0, y: 0 }

/** Lado do quadrado onde a pessoa enquadra — só a tela, não o que é salvo. */
const PREVIA = 260

export function EscolherFoto({
  nome,
  foto,
  onTrocar,
  onRemover,
}: {
  nome: string
  foto: string | null
  onTrocar: (dataUrl: string) => Promise<void> | void
  onRemover: () => Promise<void> | void
}) {
  const campo = useRef<HTMLInputElement>(null)
  const [escolhida, setEscolhida] = useState<HTMLImageElement | null>(null)
  const [quadro, setQuadro] = useState<Enquadramento>(INICIAL)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  const abrir = (arquivo: File | undefined) => {
    if (!arquivo) return
    setErro('')
    if (arquivo.size > MAX_ARQUIVO) {
      setErro('Essa imagem é grande demais. Escolha outra.')
      return
    }
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => {
      setQuadro(INICIAL)
      setEscolhida(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      setErro('Não consegui abrir essa imagem.')
    }
    img.src = url
    if (campo.current) campo.current.value = ''
  }

  const fechar = () => {
    if (escolhida) URL.revokeObjectURL(escolhida.src)
    setEscolhida(null)
  }

  const confirmar = async () => {
    if (!escolhida) return
    setOcupado(true)
    try {
      await onTrocar(recortar(escolhida, quadro))
      fechar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui usar essa imagem.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 py-1">
      {/* O avatar inteiro é o botão: é assim que se espera clicar nele. */}
      <button
        type="button"
        onClick={() => campo.current?.click()}
        disabled={ocupado}
        title={foto ? 'Trocar a foto' : 'Escolher uma foto'}
        className="group relative rounded-pilula outline-offset-4 focus-visible:outline focus-visible:outline-marca"
      >
        <Avatar nome={nome} foto={foto} cor="var(--c-marca)" tamanho={96} />
        <span className="absolute inset-0 rounded-pilula bg-fundo/0 transition-colors group-hover:bg-fundo/35" />
        <span className="absolute -right-0.5 -bottom-0.5 flex size-8 items-center justify-center rounded-pilula border-2 border-superficie bg-marca-solida text-[#06231a]">
          <Pencil size={14} />
        </span>
      </button>

      <p className="max-w-[280px] text-center text-[11.5px] leading-relaxed text-tinta-fraca">
        {erro || 'Toque na foto para trocar. Quem está na sua família vê ela no lugar das suas iniciais.'}
      </p>

      {foto && (
        <Botao
          aparencia="perigo"
          tamanho="sm"
          icone={<Trash2 size={13} />}
          disabled={ocupado}
          onClick={() => void onRemover()}
        >
          Remover foto
        </Botao>
      )}

      <input
        ref={campo}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
        onChange={(e) => abrir(e.target.files?.[0])}
      />

      <Modal
        aberto={!!escolhida}
        onFechar={fechar}
        titulo="Ajeite a foto"
        descricao="Arraste para escolher o pedaço e use o controle para aproximar."
        largura={360}
        rodape={
          <>
            <Botao aparencia="perigo" onClick={fechar}>
              Cancelar
            </Botao>
            <Botao aparencia="primaria" icone={<Camera size={15} />} disabled={ocupado} onClick={() => void confirmar()}>
              {ocupado ? 'Salvando…' : 'Confirmar'}
            </Botao>
          </>
        }
      >
        {escolhida && (
          <Recortador imagem={escolhida} quadro={quadro} onQuadro={setQuadro} />
        )}
      </Modal>
    </div>
  )
}

/* -------------------------------- recorte -------------------------------- */

/**
 * A escala que faz a imagem cobrir o quadrado inteiro.
 *
 * Parte-se dela e não de 1: uma foto deitada com escala 1 deixaria duas tarjas
 * vazias no avatar. Daqui para cima é a pessoa que aproxima.
 */
const escalaMinima = (img: HTMLImageElement, lado: number) =>
  Math.max(lado / img.naturalWidth, lado / img.naturalHeight)

/** Não deixa arrastar a imagem para fora, o que abriria buraco no recorte. */
function limitar(quadro: Enquadramento, img: HTMLImageElement): Enquadramento {
  const escala = escalaMinima(img, PREVIA) * quadro.zoom
  const folgaX = Math.max(0, (img.naturalWidth * escala - PREVIA) / 2)
  const folgaY = Math.max(0, (img.naturalHeight * escala - PREVIA) / 2)
  return {
    zoom: quadro.zoom,
    x: Math.min(folgaX, Math.max(-folgaX, quadro.x)),
    y: Math.min(folgaY, Math.max(-folgaY, quadro.y)),
  }
}

function Recortador({
  imagem,
  quadro,
  onQuadro,
}: {
  imagem: HTMLImageElement
  quadro: Enquadramento
  onQuadro: (q: Enquadramento) => void
}) {
  const arrastando = useRef<{ x: number; y: number } | null>(null)

  /* Zoom muda a folga: o que estava no limite pode passar a estar fora. */
  useEffect(() => {
    const ajustado = limitar(quadro, imagem)
    if (ajustado.x !== quadro.x || ajustado.y !== quadro.y) onQuadro(ajustado)
  }, [quadro, imagem, onQuadro])

  const escala = escalaMinima(imagem, PREVIA) * quadro.zoom

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative cursor-grab touch-none overflow-hidden rounded-pilula border-2 border-linha active:cursor-grabbing"
        style={{ width: PREVIA, height: PREVIA }}
        onPointerDown={(e) => {
          arrastando.current = { x: e.clientX - quadro.x, y: e.clientY - quadro.y }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!arrastando.current) return
          onQuadro(
            limitar(
              { ...quadro, x: e.clientX - arrastando.current.x, y: e.clientY - arrastando.current.y },
              imagem,
            ),
          )
        }}
        onPointerUp={() => (arrastando.current = null)}
      >
        <img
          src={imagem.src}
          alt=""
          draggable={false}
          className="absolute top-1/2 left-1/2 max-w-none select-none"
          style={{
            width: imagem.naturalWidth * escala,
            height: imagem.naturalHeight * escala,
            transform: `translate(calc(-50% + ${quadro.x}px), calc(-50% + ${quadro.y}px))`,
          }}
        />
      </div>

      <label className="flex w-full items-center gap-3">
        <ZoomIn size={15} className="shrink-0 text-tinta-tenue" />
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={quadro.zoom}
          onChange={(e) => onQuadro(limitar({ ...quadro, zoom: Number(e.target.value) }, imagem))}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-linha accent-marca"
        />
      </label>
    </div>
  )
}

/**
 * Gera o JPEG final com o mesmo enquadramento que a pessoa viu.
 *
 * JPEG e não PNG: foto de gente comprime muito melhor assim, e é a diferença
 * entre 20 KB e 300 KB trafegando toda vez que a família abre o app.
 */
function recortar(img: HTMLImageElement, quadro: Enquadramento): string {
  const tela = document.createElement('canvas')
  tela.width = LADO
  tela.height = LADO
  const ctx = tela.getContext('2d')
  if (!ctx) throw new Error('Não consegui preparar a imagem.')

  // Da tela de 260 px para a imagem salva de 256: mesma proporção, outro tamanho.
  const escala = escalaMinima(img, LADO) * quadro.zoom
  const fator = LADO / PREVIA
  const largura = img.naturalWidth * escala
  const altura = img.naturalHeight * escala

  ctx.drawImage(
    img,
    LADO / 2 - largura / 2 + quadro.x * fator,
    LADO / 2 - altura / 2 + quadro.y * fator,
    largura,
    altura,
  )
  return tela.toDataURL('image/jpeg', QUALIDADE)
}
