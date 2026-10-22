import { useCallback, useEffect, useState } from 'react'
import { ArrowUpCircle, Download, RefreshCw, Sparkles, X } from 'lucide-react'
import { api } from '@/lib/api'
import { Botao, Caixa } from '@/components/ui'

/**
 * Checagem de versão: avisa quando há novidade, e barra quando é obrigatório.
 *
 * O endpoint existia desde o começo e ninguém chamava — o que quer dizer que
 * uma mudança de API que quebrasse cliente antigo apareceria como erro solto
 * no meio do uso, sem a pessoa entender o motivo. Aqui a conversa acontece
 * antes: ou some do caminho, ou explica e manda atualizar.
 *
 * No desktop "atualizar" não é baixar arquivo: o app já se atualiza sozinho
 * pela API. Então a tela de bloqueio comanda o próprio atualizador em vez de
 * mandar a pessoa procurar um instalador.
 */

type Estado =
  | { fase: 'checando' }
  | { fase: 'ok' }
  | { fase: 'novidade'; atual: string }
  | { fase: 'obrigatoria'; minima: string }

export function useVersao() {
  const [estado, setEstado] = useState<Estado>({ fase: 'checando' })
  const [minha, setMinha] = useState('')

  const conferir = useCallback(async () => {
    try {
      const info = await window.bolso.app.info()
      setMinha(info.versao)
      const r = await api.versao(info.versao)
      if (r.precisaAtualizar) setEstado({ fase: 'obrigatoria', minima: r.minima })
      else if (r.temNovidade) setEstado({ fase: 'novidade', atual: r.atual })
      else setEstado({ fase: 'ok' })
    } catch {
      // Sem rede não dá pra saber, e travar quem está offline seria pior que
      // deixar passar: o app funciona sem internet de propósito.
      setEstado({ fase: 'ok' })
    }
  }, [])

  useEffect(() => {
    void conferir()
    // Quem abriu o app sem rede precisa ser conferido quando ela voltar.
    const aoVoltar = () => void conferir()
    window.addEventListener('online', aoVoltar)
    return () => window.removeEventListener('online', aoVoltar)
  }, [conferir])

  return { estado, minha, conferir }
}

/** Tela que cobre tudo: daqui só se sai atualizando. */
export function BloqueioVersao({ minima, minha }: { minima: string; minha: string }) {
  const [fase, setFase] = useState<string>('inativo')
  const [erro, setErro] = useState('')

  useEffect(() => {
    void window.bolso.atualizacao.estado().then((e) => setFase(e.fase))
    return window.bolso.atualizacao.aoMudar((e) => {
      setFase(e.fase)
      setErro(e.erro ?? '')
    })
  }, [])

  const pronta = fase === 'pronta'
  const baixando = fase === 'baixando' || fase === 'verificando'

  return (
    <div className="flex min-h-screen items-center justify-center bg-fundo p-8">
      <div className="w-full max-w-[420px] text-center">
        <span className="mx-auto mb-4 flex size-16 items-center justify-center rounded-pilula bg-alerta/12 text-alerta">
          <ArrowUpCircle size={30} />
        </span>
        <h1 className="text-lg font-semibold text-tinta">Atualize o aplicativo</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-tinta-fraca">
          Esta versão ({minha}) não conversa mais com o servidor. A partir da {minima} tudo volta ao
          normal, e seus dados continuam lá esperando.
        </p>

        <div className="mt-5 flex justify-center gap-2">
          {pronta ? (
            <Botao
              aparencia="primaria"
              icone={<RefreshCw size={15} />}
              onClick={() => void window.bolso.atualizacao.instalar()}
            >
              Reiniciar e instalar
            </Botao>
          ) : (
            <Botao
              aparencia="convite"
              icone={<Download size={15} />}
              disabled={baixando}
              onClick={() => void window.bolso.atualizacao.verificar().then((e) => setFase(e.fase))}
            >
              {baixando ? 'Baixando…' : 'Procurar atualização'}
            </Botao>
          )}
        </div>

        {erro && <p className="mt-3 text-[11.5px] text-sai">{erro}</p>}
      </div>
    </div>
  )
}

/** Faixa discreta: dá pra continuar usando, mas fica o aviso. */
export function AvisoVersao({ atual, minha }: { atual: string; minha: string }) {
  const [escondido, setEscondido] = useState(false)
  if (escondido) return null
  return (
    <Caixa className="mb-4 flex items-center gap-3 px-4 py-3">
      <Sparkles size={16} className="shrink-0 text-info" />
      <span className="text-[12.5px]">
        <strong className="text-tinta">Versão {atual} disponível</strong>
        <span className="text-tinta-fraca"> — você está na {minha}. O app baixa sozinho e instala ao fechar.</span>
      </span>
      <Botao
        aparencia="fantasma"
        tamanho="icone"
        aria-label="Dispensar"
        className="ml-auto"
        onClick={() => setEscondido(true)}
      >
        <X size={15} />
      </Botao>
    </Caixa>
  )
}
