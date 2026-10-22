import { useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { useDados } from '@/lib/estado'
import { Botao, Caixa, Entrada } from '@/components/ui'

/**
 * Link para indicar o app a quem ainda não usa.
 *
 * É diferente do convite de família, e por isso mora em outro lugar: o convite
 * dá acesso aos SEUS números e exige que a pessoa já tenha conta; este aqui é
 * só "instala aí", não carrega token nenhum e pode circular em qualquer grupo
 * sem dar acesso a nada.
 *
 * Sem loja de aplicativos, um link é a única forma de alguém chegar ao APK —
 * mandar o arquivo de 126 MB por WhatsApp não é caminho.
 */
export function IndicarApp() {
  const { linkApp } = useDados()
  const [copiado, setCopiado] = useState(false)

  if (!linkApp) return null

  const copiar = async () => {
    await navigator.clipboard.writeText(linkApp)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <Caixa className="overflow-hidden">
      <header className="px-5 pt-4 pb-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <Share2 size={15} className="text-info" />
          Indicar o aplicativo
        </h2>
        <p className="mt-0.5 text-xs text-tinta-fraca">
          Para quem ainda não usa o app. O link abre uma página com o download — não dá acesso
          nenhum aos seus dados, e a pessoa cria a conta dela.
        </p>
      </header>
      <div className="flex flex-wrap items-center gap-2 border-t border-linha-suave px-5 py-4">
        <Entrada readOnly value={linkApp} className="min-w-0 flex-1" onFocus={(e) => e.target.select()} />
        <Botao
          aparencia="convite"
          icone={copiado ? <Check size={15} /> : <Copy size={15} />}
          onClick={() => void copiar()}
        >
          {copiado ? 'Copiado' : 'Copiar link'}
        </Botao>
      </div>
    </Caixa>
  )
}
