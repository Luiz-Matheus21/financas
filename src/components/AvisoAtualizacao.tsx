import { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import type { EstadoAtualizacao } from '../../electron/atualizador'
import { Barra, Botao, Caixa } from './ui'

/**
 * Aviso discreto no canto: só aparece quando há download em andamento ou uma
 * versão pronta para instalar. Nunca interrompe o que está sendo feito — a
 * troca só acontece quando a pessoa clica em reiniciar, ou no próximo fechamento.
 */
export function AvisoAtualizacao() {
  const [estado, setEstado] = useState<EstadoAtualizacao | null>(null)
  const [dispensado, setDispensado] = useState(false)

  useEffect(() => {
    void window.bolso.atualizacao.estado().then(setEstado)
    return window.bolso.atualizacao.aoMudar((e) => {
      setEstado(e)
      // Versão nova pronta merece reaparecer mesmo se o aviso foi dispensado antes.
      if (e.fase === 'pronta') setDispensado(false)
    })
  }, [])

  if (!estado || dispensado) return null
  const baixando = estado.fase === 'baixando'
  const pronta = estado.fase === 'pronta'
  if (!baixando && !pronta) return null

  return (
    <Caixa className="fixed right-5 bottom-5 z-30 w-[310px] p-4 shadow-[var(--sombra-flutuante)]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-pilula bg-marca/15 text-marca">
          {pronta ? <RefreshCw size={15} /> : <Download size={15} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">
            {pronta ? `Versão ${estado.versaoNova} pronta` : `Baixando versão ${estado.versaoNova}`}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-tinta-fraca">
            {pronta
              ? 'Reinicie para usar a versão nova. Seus dados continuam onde estão.'
              : 'Pode continuar usando — o download acontece em segundo plano.'}
          </p>
        </div>
        <button
          onClick={() => setDispensado(true)}
          aria-label="Dispensar aviso"
          className="text-tinta-tenue hover:text-tinta"
        >
          <X size={15} />
        </button>
      </div>

      {baixando && (
        <div className="mt-3">
          <Barra valor={estado.progresso ?? 0} cor="var(--c-marca)" />
          <p className="num mt-1 text-right text-[10.5px] text-tinta-tenue">
            {estado.progresso ?? 0}%
          </p>
        </div>
      )}

      {pronta && (
        <div className="mt-3 flex justify-end gap-2">
          <Botao aparencia="fantasma" tamanho="sm" onClick={() => setDispensado(true)}>
            Depois
          </Botao>
          <Botao
            aparencia="primaria"
            tamanho="sm"
            icone={<RefreshCw size={14} />}
            onClick={() => void window.bolso.atualizacao.instalar()}
          >
            Reiniciar agora
          </Botao>
        </div>
      )}
    </Caixa>
  )
}
