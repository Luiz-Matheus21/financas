import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ClipboardPaste,
  FileImage,
  FolderOpen,
  ListChecks,
  ScanText,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useCartoesFiltrados, useDados } from '@/lib/estado'
import { MarcaBanco, bancoPorId } from '@/lib/bancos'
import { primeiroCartao } from '@/lib/finance'
import { interpretar, type Sugestao } from '@/lib/ocr'
import { dataBr } from '@/lib/mes'
import { dinheiro } from '@/lib/formato'
import { Botao, Caixa, Etiqueta, Modal, Selecao, cn } from '@/components/ui'
import { rascunhoVazio, type RascunhoCompra } from '@/components/FormularioCompra'

type Fase = 'vazio' | 'lendo' | 'lido' | 'erro'

/**
 * Leitura de print por OCR, em cima da tela de compras. Sai daqui de dois
 * jeitos: um lançamento só, que volta como rascunho para conferência, ou uma
 * lista da fatura, lançada em lote sem sair do leitor.
 */
export function LeitorDePrint({
  imagemInicial,
  onFechar,
  onRevisar,
  irParaCartoes,
}: {
  /** Print já colado na tela de compras — entra direto no reconhecimento. */
  imagemInicial?: string | null
  onFechar: () => void
  onRevisar: (r: RascunhoCompra) => void
  irParaCartoes: () => void
}) {
  const { dados, compras } = useDados()
  const daPessoa = useCartoesFiltrados()
  const cartaoInicial = primeiroCartao(daPessoa, dados.cartoes, dados.config.ultimoCartaoId)
  /** Cartões oferecidos no lote: os da pessoa em foco, ou todos se ela não tiver. */
  const ofertados = daPessoa.length ? daPessoa : dados.cartoes
  const [imagem, setImagem] = useState<string | null>(null)
  const [fase, setFase] = useState<Fase>('vazio')
  const [erro, setErro] = useState('')
  const [texto, setTexto] = useState('')
  const [confianca, setConfianca] = useState(0)
  const [sugestao, setSugestao] = useState<Sugestao | null>(null)
  const [verTexto, setVerTexto] = useState(false)
  const [marcados, setMarcados] = useState<Set<number>>(new Set())
  const [cartaoLote, setCartaoLote] = useState('')
  const [salvos, setSalvos] = useState(0)

  const nomeBanco = useCallback((id: string) => bancoPorId(id).nome, [])

  const processar = useCallback(
    async (dataUrl: string) => {
      setImagem(dataUrl)
      setFase('lendo')
      setErro('')
      setSalvos(0)
      const r = await window.bolso.ocr.reconhecer(dataUrl)
      if (!r.ok) {
        setFase('erro')
        setErro(r.erro ?? 'não deu para ler a imagem')
        return
      }
      setTexto(r.texto)
      setConfianca(r.confianca)
      const s = interpretar(r.texto, dados.cartoes, nomeBanco)
      setSugestao(s)
      setCartaoLote(s.cartaoId)
      setMarcados(new Set())
      setFase('lido')
    },
    [dados.cartoes, nomeBanco],
  )

  /* Print que veio colado de fora não pode ser reconhecido duas vezes. */
  const jaLido = useRef<string | null>(null)
  useEffect(() => {
    if (!imagemInicial || jaLido.current === imagemInicial) return
    jaLido.current = imagemInicial
    processar(imagemInicial)
  }, [imagemInicial, processar])

  /* Colar print com Ctrl+V é o caminho mais rápido; fica ativo com o leitor aberto. */
  useEffect(() => {
    const aoColar = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
      if (!item) return
      const arquivo = item.getAsFile()
      if (!arquivo) return
      e.preventDefault()
      const leitor = new FileReader()
      leitor.onload = () => processar(String(leitor.result))
      leitor.readAsDataURL(arquivo)
    }
    window.addEventListener('paste', aoColar)
    return () => window.removeEventListener('paste', aoColar)
  }, [processar])

  const aoSoltar = (e: React.DragEvent) => {
    e.preventDefault()
    const arquivo = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'))
    if (!arquivo) return
    const leitor = new FileReader()
    leitor.onload = () => processar(String(leitor.result))
    leitor.readAsDataURL(arquivo)
  }

  const escolher = async () => {
    const r = await window.bolso.ocr.escolherImagem()
    if (r?.dataUrl) processar(r.dataUrl)
  }

  // Trocar de pessoa não pode deixar o lote preso num cartão que saiu da lista.
  useEffect(() => {
    if (cartaoLote && !ofertados.some((c) => c.id === cartaoLote)) setCartaoLote('')
  }, [cartaoLote, ofertados])

  const limpar = () => {
    setImagem(null)
    setTexto('')
    setSugestao(null)
    setFase('vazio')
    setSalvos(0)
    setMarcados(new Set())
    jaLido.current = null
  }

  /** Fecha o leitor e devolve o rascunho para a conferência na tela de compras. */
  const revisar = () => {
    if (!sugestao) return
    const base = rascunhoVazio(sugestao.cartaoId || cartaoInicial)
    onRevisar({
      ...base,
      descricao: sugestao.descricao,
      valorTotal: sugestao.valorTotal,
      parcelas: sugestao.parcelas,
      dataCompra: sugestao.dataCompra,
      categoria: sugestao.categoria,
      cartaoId: sugestao.cartaoId || base.cartaoId,
      origemOcr: true,
    })
  }

  const lancarLote = () => {
    if (!sugestao || marcados.size === 0) return
    const cartaoId = cartaoLote || cartaoInicial
    const novas = [...marcados].map((i) => {
      const item = sugestao.itens[i]!
      return {
        ...rascunhoVazio(cartaoId),
        descricao: item.descricao,
        valorTotal: item.valor * (item.parcelas ?? 1),
        parcelas: item.parcelas ?? 1,
        dataCompra: sugestao.dataCompra,
        categoria: sugestao.categoria,
        origemOcr: true,
      }
    })
    compras.criarMuitas(novas)
    setSalvos(novas.length)
    setMarcados(new Set())
  }

  const itensUteis = useMemo(() => (sugestao?.itens ?? []).filter((i) => i.valor > 0), [sugestao])

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo="Ler print da compra"
      descricao="Cole (Ctrl+V), arraste ou escolha um print da notificação, do comprovante ou da fatura. O texto é reconhecido aqui no seu computador, sem enviar nada para fora."
      largura={780}
      rodape={
        <>
          {salvos > 0 && (
            <Etiqueta tom="entra" className="mr-auto">
              {salvos} compras lançadas
            </Etiqueta>
          )}
          {imagem && (
            <Botao aparencia="contorno" icone={<Trash2 size={15} />} onClick={limpar}>
              Limpar
            </Botao>
          )}
          <Botao aparencia="primaria" icone={<FolderOpen size={15} />} onClick={escolher}>
            Escolher arquivo
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        {/* --------------------------- área da imagem -------------------------- */}
        <Caixa className="overflow-hidden" onDrop={aoSoltar} onDragOver={(e) => e.preventDefault()}>
          {!imagem ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-9 text-center">
              <span className="flex size-14 items-center justify-center rounded-cartao bg-marca/12 text-marca">
                <ClipboardPaste size={26} />
              </span>
              <p className="text-sm font-semibold">Cole o print aqui com Ctrl+V</p>
              <p className="max-w-sm text-[12px] leading-relaxed text-tinta-fraca">
                Vale a notificação do banco, o comprovante do app, a tela de parcelamento ou até a
                lista de lançamentos da fatura — nesse caso o app oferece importar tudo de uma vez.
              </p>
              <p className="mt-1 text-[11px] text-tinta-tenue">Ou arraste a imagem para cá</p>
            </div>
          ) : (
            <div className="relative">
              <img
                src={imagem}
                alt="Print da compra"
                className="max-h-[300px] w-full bg-afundado object-contain"
              />
              {fase === 'lendo' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/65">
                  <span className="size-7 animate-spin rounded-full border-2 border-white/25 border-t-marca" />
                  <span className="text-[12px] font-semibold text-white">Reconhecendo o texto…</span>
                </div>
              )}
              <button
                onClick={limpar}
                aria-label="Remover imagem"
                className="absolute top-2 right-2 rounded-pilula bg-black/60 p-1.5 text-white"
              >
                <X size={15} />
              </button>
            </div>
          )}
        </Caixa>

        {/* ---------------------------- resultado ----------------------------- */}
        {fase === 'erro' && (
          <Caixa className="flex items-start gap-3 p-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-sai" />
            <div>
              <p className="text-[13px] font-semibold">Não deu para ler esse print</p>
              <p className="mt-0.5 text-[12px] text-tinta-fraca">{erro}</p>
            </div>
          </Caixa>
        )}

        {fase === 'lido' && sugestao && (
          <>
            <Caixa className="overflow-hidden">
              <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
                <div>
                  <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                    <Sparkles size={15} className="text-marca" />
                    O que o print diz
                  </h2>
                  <p className="mt-0.5 text-xs text-tinta-fraca">
                    Confira antes de lançar — o que está marcado como palpite não foi encontrado no
                    texto.
                  </p>
                </div>
                <Etiqueta tom={confianca >= 70 ? 'entra' : confianca >= 45 ? 'alerta' : 'sai'}>
                  Leitura {Math.round(confianca)}%
                </Etiqueta>
              </header>

              <div className="grid grid-cols-2 gap-px border-t border-linha-suave bg-linha-suave">
                <Achado
                  rotulo="Valor"
                  valor={sugestao.valorTotal > 0 ? dinheiro(sugestao.valorTotal) : '—'}
                  ok={sugestao.achou.valor}
                  destaque
                />
                <Achado
                  rotulo="Parcelas"
                  valor={
                    sugestao.parcelas > 1
                      ? `${sugestao.parcelas}x de ${dinheiro(sugestao.valorTotal / sugestao.parcelas)}`
                      : 'À vista'
                  }
                  ok={sugestao.achou.parcelas}
                />
                <Achado rotulo="Data" valor={dataBr(sugestao.dataCompra)} ok={sugestao.achou.data} />
                <Achado
                  rotulo="Cartão"
                  valor={dados.cartoes.find((c) => c.id === sugestao.cartaoId)?.apelido ?? 'não achei'}
                  ok={sugestao.achou.cartao}
                  icone={
                    sugestao.cartaoId ? (
                      <MarcaBanco
                        bancoId={
                          dados.cartoes.find((c) => c.id === sugestao.cartaoId)?.bancoId ?? 'outro'
                        }
                        tamanho={20}
                      />
                    ) : undefined
                  }
                />
                <Achado
                  rotulo="Descrição"
                  valor={sugestao.descricao || '—'}
                  ok={sugestao.achou.descricao}
                  className="col-span-2"
                />
              </div>

              <footer className="flex flex-wrap items-center gap-2 border-t border-linha-suave px-5 py-3.5">
                <Botao
                  aparencia="primaria"
                  icone={<Check size={15} />}
                  disabled={sugestao.valorTotal <= 0}
                  onClick={revisar}
                >
                  Revisar e lançar
                </Botao>
                <Botao
                  aparencia="fantasma"
                  tamanho="sm"
                  icone={<ScanText size={14} />}
                  onClick={() => setVerTexto((v) => !v)}
                >
                  {verTexto ? 'Esconder texto lido' : 'Ver texto lido'}
                </Botao>
              </footer>

              {verTexto && (
                <pre className="max-h-56 overflow-auto border-t border-linha-suave bg-afundado px-5 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-tinta-fraca">
                  {texto || '(Nada reconhecido)'}
                </pre>
              )}
            </Caixa>

            {itensUteis.length >= 2 && (
              <Caixa className="overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                      <ListChecks size={15} className="text-info" />
                      Parece uma lista de lançamentos
                    </h2>
                    <p className="mt-0.5 text-xs text-tinta-fraca">
                      Marque o que quiser trazer para o cartão escolhido.
                    </p>
                  </div>
                  <Selecao
                    className="w-auto min-w-40"
                    value={cartaoLote}
                    onChange={(e) => setCartaoLote(e.target.value)}
                  >
                    {ofertados.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.apelido}
                      </option>
                    ))}
                  </Selecao>
                </header>

                <ul className="max-h-72 overflow-y-auto border-t border-linha-suave">
                  {itensUteis.map((item, i) => {
                    const on = marcados.has(i)
                    return (
                      <li key={`${item.descricao}-${i}`}>
                        <button
                          onClick={() =>
                            setMarcados((s) => {
                              const n = new Set(s)
                              n.has(i) ? n.delete(i) : n.add(i)
                              return n
                            })
                          }
                          className={cn(
                            'flex w-full items-center gap-3 border-b border-linha-suave px-5 py-2.5 text-left',
                            on ? 'bg-marca/8' : 'hover:bg-elevado/60',
                          )}
                        >
                          <span
                            className={cn(
                              'flex size-4.5 shrink-0 items-center justify-center rounded-[5px] border',
                              on ? 'border-marca-solida bg-marca-solida text-[#06231a]' : 'border-linha',
                            )}
                          >
                            {on && <Check size={12} strokeWidth={3} />}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px]">
                            {item.descricao}
                          </span>
                          {item.parcelas && item.parcelas > 1 && (
                            <Etiqueta tom="neutro">{item.parcelas}x</Etiqueta>
                          )}
                          <span className="num text-[13px] font-semibold">
                            {dinheiro(item.valor)}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <footer className="flex items-center justify-between gap-3 border-t border-linha-suave px-5 py-3.5">
                  <span className="text-[12px] text-tinta-fraca">
                    {marcados.size === 0
                      ? 'Nenhum item marcado'
                      : `${marcados.size} de ${itensUteis.length} marcados`}
                  </span>
                  <Botao
                    aparencia="primaria"
                    disabled={marcados.size === 0}
                    icone={<Check size={15} />}
                    onClick={lancarLote}
                  >
                    Lançar marcados
                  </Botao>
                </footer>
              </Caixa>
            )}
          </>
        )}

        {fase === 'vazio' && (
          <Caixa className="p-5">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold">
              <FileImage size={15} className="text-tinta-fraca" />
              Prints que funcionam bem
            </h2>
            <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-tinta-fraca">
              <li>
                <strong className="text-tinta">Notificação de compra</strong> — costuma trazer
                valor, estabelecimento e cartão numa linha só.
              </li>
              <li>
                <strong className="text-tinta">Comprovante do app do banco</strong> — o melhor caso:
                tem data, valor e o número de parcelas.
              </li>
              <li>
                <strong className="text-tinta">Tela de parcelamento</strong> — o app entende
                formatos como “12x de R$ 249,90”.
              </li>
              <li>
                <strong className="text-tinta">Lista da fatura</strong> — cada linha vira um
                lançamento que você marca e importa em lote.
              </li>
            </ul>
            <p className="mt-4 border-t border-linha-suave pt-3 text-[11.5px] text-tinta-tenue">
              Dica: cadastrar os últimos 4 dígitos de cada cartão faz o app acertar sozinho em qual
              cartão a compra foi.{' '}
              <button className="text-marca underline" onClick={irParaCartoes}>
                ir para cartões
              </button>
            </p>
          </Caixa>
        )}
      </div>
    </Modal>
  )
}

function Achado({
  rotulo,
  valor,
  ok,
  destaque,
  icone,
  className,
}: {
  rotulo: string
  valor: string
  ok: boolean
  destaque?: boolean
  icone?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('bg-superficie px-5 py-3', className)}>
      <div className="flex items-center gap-1.5">
        <span className="text-[10.5px] font-semibold tracking-wide text-tinta-fraca uppercase">
          {rotulo}
        </span>
        {ok ? (
          <Check size={11} className="text-entra" strokeWidth={3} />
        ) : (
          <span className="rounded-pilula bg-alerta/15 px-1.5 text-[9.5px] font-bold text-alerta">
            Palpite
          </span>
        )}
      </div>
      <div className={cn('mt-1 flex items-center gap-2', destaque ? 'text-lg font-bold' : 'text-[13px]')}>
        {icone}
        <span className={cn('num truncate', !ok && 'text-tinta-fraca')}>{valor}</span>
      </div>
    </div>
  )
}
