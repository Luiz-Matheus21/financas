import { useMemo, useState } from 'react'
import { Check, CheckCircle2, CheckSquare, ChevronDown, Receipt, Square } from 'lucide-react'
import { useCartoesFiltrados, useDados, useNomesEmFoco } from '@/lib/estado'
import { Filtros } from '@/components/Filtros'
import { MarcaBanco } from '@/lib/bancos'
import { faturaDoCartao, todasAsParcelas, type Fatura } from '@/lib/finance'
import { dataBr, dataVencimento, difMeses, mesAtual, rotuloMes, sequenciaMeses } from '@/lib/mes'
import { dinheiro } from '@/lib/formato'
import {
  Botao,
  Cabeca,
  CabecalhoTela,
  Caixa,
  Campo,
  Dinheiro,
  Entrada,
  EntradaValor,
  Etiqueta,
  Linha,
  Modal,
  Tabela,
  Td,
  Th,
  Vazio,
  cn,
} from '@/components/ui'

const MESES_PROJECAO = 12

export function Faturas() {
  const { dados, mes, filtro, filtroCartoes, faturas } = useDados()
  const daPessoa = useCartoesFiltrados()
  const nomesEmFoco = useNomesEmFoco()
  const [expandido, setExpandido] = useState<string | null>(null)
  const [informando, setInformando] = useState<Fatura | null>(null)
  const [confirmandoLote, setConfirmandoLote] = useState(false)

  const parcelas = useMemo(() => todasAsParcelas(dados), [dados])

  /** Só as faturas dos cartões de quem está em foco, e dos bancos marcados. */
  const doMes = useMemo(
    () =>
      daPessoa
        .filter((c) => !filtroCartoes || filtroCartoes.includes(c.id))
        .map((c) => faturaDoCartao(dados, c, mes, filtro, parcelas))
        .filter((f) => f.valor > 0 || f.cartao.ativo)
        .sort((a, b) => b.valor - a.valor),
    [dados, daPessoa, mes, filtro, filtroCartoes, parcelas],
  )

  const total = doMes.reduce((s, f) => s + f.valor, 0)
  const pago = doMes.filter((f) => f.paga).reduce((s, f) => s + f.valor, 0)
  /* O que ainda falta, não o total do mês: dizer "R$ 1.147,15 a pagar" ao
     lado de "R$ 1.147,15 já pago" é uma contradição em uma linha só. */
  const emAberto = total - pago
  const resumo =
    total <= 0
      ? `Nada lançado em ${rotuloMes(mes)}`
      : emAberto <= 0
        ? `Tudo pago em ${rotuloMes(mes)} · ${dinheiro(total)}`
        : `${dinheiro(emAberto)} a pagar em ${rotuloMes(mes)}${pago > 0 ? ` · ${dinheiro(pago)} já marcado como pago` : ''}`

  /* Só as que ainda têm o que pagar: selecionar não pode alcançar o que já
     está pago, nem fatura zerada. */
  const aPagar = useMemo(() => doMes.filter((f) => !f.paga && f.valor > 0), [doMes])

  /**
   * Seleção, e não pagamento direto — o mesmo desenho do celular.
   *
   * Um clique que já paga parece prático até a conta ter cinco cartões: um
   * clique errado quita a fatura errada sem aviso. Aqui o clique escolhe, a
   * barra diz quanto foi escolhido, e pagar é um passo à parte que só alcança
   * o que está marcado.
   */
  const [escolhidas, setEscolhidas] = useState<string[]>([])
  const idsAPagar = aPagar.map((f) => f.cartao.id)

  /* O que saiu do filtro (ou já foi pago) não pode continuar na seleção: senão
     "pagar 3" alcançaria algo que nem está na tela. */
  const selecao = escolhidas.filter((id) => idsAPagar.includes(id))
  const daSelecao = aPagar.filter((f) => selecao.includes(f.cartao.id))
  const somaSelecao = daSelecao.reduce((s, f) => s + f.valor, 0)
  const todasEscolhidas = aPagar.length > 0 && selecao.length === aPagar.length

  const escolher = (id: string) =>
    setEscolhidas((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]))

  const registrar = (f: Fatura, paga: boolean) =>
    faturas.registrar({
      cartaoId: f.cartao.id,
      mes: f.mes,
      valorInformado: f.valorInformado,
      paga,
      observacao: f.registro?.observacao,
    })

  const pagarSelecionadas = () => {
    for (const f of daSelecao) registrar(f, true)
    setEscolhidas([])
  }

  const matriz = useMemo(() => {
    const meses = sequenciaMeses(mes, MESES_PROJECAO)
    const cartoes = daPessoa
      .filter((c) => !filtroCartoes || filtroCartoes.includes(c.id))
      .filter(
        (c) => c.ativo || parcelas.some((p) => p.cartao.id === c.id && difMeses(mes, p.mes) >= 0),
      )
    return {
      meses,
      cartoes,
      celula: (cartaoId: string, m: string) =>
        faturaDoCartao(dados, dados.cartoes.find((c) => c.id === cartaoId)!, m, filtro, parcelas)
          .valor,
    }
  }, [dados, daPessoa, mes, filtro, filtroCartoes, parcelas])

  return (
    <>
      <CabecalhoTela
        titulo="Faturas"
        descricao={resumo}
      />

      <Filtros comCartoes />

      {aPagar.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-[12.5px] text-tinta-fraca">
            {selecao.length > 0 ? (
              <>
                <strong className="text-tinta">{selecao.length}</strong> de {aPagar.length} ·{' '}
                <strong className="num text-tinta">{dinheiro(somaSelecao)}</strong>
              </>
            ) : (
              `${aPagar.length} faturas em aberto`
            )}
          </span>
          <Botao
            aparencia="fantasma"
            tamanho="sm"
            className="!text-info"
            icone={todasEscolhidas ? <Square size={14} /> : <CheckSquare size={14} />}
            onClick={() => setEscolhidas(todasEscolhidas ? [] : idsAPagar)}
          >
            {todasEscolhidas ? 'Limpar seleção' : 'Selecionar todas'}
          </Botao>
          {/* Só aparece quando há o que pagar: sem seleção não teria alvo. */}
          {selecao.length > 0 && (
            <Botao
              aparencia="primaria"
              tamanho="sm"
              icone={<CheckCircle2 size={14} />}
              className="ml-auto"
              onClick={() => setConfirmandoLote(true)}
            >
              {selecao.length === 1
                ? `Marcar como paga · ${dinheiro(somaSelecao)}`
                : `Marcar ${selecao.length} como pagas · ${dinheiro(somaSelecao)}`}
            </Botao>
          )}
        </div>
      )}

      {doMes.length === 0 ? (
        <Caixa>
          <Vazio
            icone={<Receipt size={30} />}
            titulo={
              daPessoa.length === 0 && dados.cartoes.length > 0
                ? `Nenhum cartão de ${nomesEmFoco}`
                : 'Nenhuma fatura neste mês'
            }
            descricao="Sem compras caindo aqui. Troque o mês ou a pessoa na barra de cima, ou lance uma compra."
          />
        </Caixa>
      ) : (
        <div className="mb-5 space-y-3">
          {doMes.map((f) => {
            const aberto = expandido === f.cartao.id
            const venc = dataVencimento(f.mes, f.cartao.diaVencimento)
            const atrasada = !f.paga && venc < new Date().toISOString().slice(0, 10)
            const escolhida = selecao.includes(f.cartao.id)
            return (
              <Caixa
                key={f.cartao.id}
                className={cn(
                  'overflow-hidden transition-colors',
                  f.paga && 'border-entra/35 bg-entra/[0.04]',
                  escolhida && 'border-info bg-info/[0.07]',
                )}
              >
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <MarcaBanco bancoId={f.cartao.bancoId} tamanho={38} className={cn(f.paga && 'opacity-55')} />
                  <div className="min-w-0 leading-tight">
                    <div
                      className={cn(
                        'truncate text-[14px] font-semibold',
                        f.paga && 'text-tinta-fraca',
                      )}
                    >
                      {f.cartao.apelido}
                    </div>
                    <div className="text-[11px] text-tinta-fraca">
                      Vence {dataBr(venc)} · {f.itens.length}{' '}
                      {f.itens.length === 1 ? 'lançamento' : 'lançamentos'}
                    </div>
                  </div>

                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {f.valorInformado != null && (
                      <Etiqueta tom="info">
                        Informado · calculado {dinheiro(f.calculado)}
                      </Etiqueta>
                    )}
                    {atrasada && <Etiqueta tom="sai">Vencida</Etiqueta>}

                    <span
                      className={cn(
                        'num text-lg font-bold',
                        f.paga && 'text-tinta-fraca line-through',
                      )}
                    >
                      {dinheiro(f.valor)}
                    </span>

                    <Botao aparencia="contorno" tamanho="sm" onClick={() => setInformando(f)}>
                      Informar valor
                    </Botao>

                    {/* Mesmo controle do celular: azul é "escolhi esta", verde é
                        "esta está paga". Paga, o clique desfaz; em aberto, escolhe. */}
                    {(f.paga || f.valor > 0) && (
                      <button
                        aria-label={
                          f.paga ? 'Desmarcar pagamento' : escolhida ? 'Tirar da seleção' : 'Selecionar'
                        }
                        title={f.paga ? 'Paga — clique para desfazer' : 'Selecionar para pagar'}
                        onClick={() => (f.paga ? registrar(f, false) : escolher(f.cartao.id))}
                        className={cn(
                          'flex size-[26px] shrink-0 items-center justify-center rounded-pilula border-2 transition-colors',
                          f.paga
                            ? 'border-entra bg-entra text-fundo'
                            : escolhida
                              ? 'border-info bg-info text-fundo'
                              : 'border-linha text-transparent hover:border-info',
                        )}
                      >
                        <Check size={15} strokeWidth={3} />
                      </button>
                    )}
                    <Botao
                      aparencia="fantasma"
                      tamanho="icone"
                      aria-label="Ver lançamentos"
                      onClick={() => setExpandido(aberto ? null : f.cartao.id)}
                    >
                      <ChevronDown
                        size={16}
                        className={cn('transition-transform', aberto && 'rotate-180')}
                      />
                    </Botao>
                  </div>
                </div>

                {aberto && (
                  <div className="border-t border-linha-suave">
                    {f.itens.length === 0 ? (
                      <p className="px-4 py-5 text-center text-[12px] text-tinta-fraca">
                        Nenhum lançamento calculado nesta fatura.
                      </p>
                    ) : (
                      <Tabela>
                        <Cabeca>
                          <tr>
                            <Th>Lançamento</Th>
                            <Th alinhar="centro">Compra</Th>
                            <Th alinhar="centro">Parcela</Th>
                            <Th alinhar="direita">Valor</Th>
                          </tr>
                        </Cabeca>
                        <tbody>
                          {f.itens.map((p) => (
                            <Linha key={`${p.compra.id}-${p.numero}`}>
                              <Td>
                                <div className="leading-tight">
                                  <div className="font-medium">{p.compra.descricao}</div>
                                  <div className="text-[11px] text-tinta-tenue">
                                    {p.compra.categoria}
                                  </div>
                                </div>
                              </Td>
                              <Td alinhar="centro" className="num text-[12px] text-tinta-fraca">
                                {dataBr(p.compra.dataCompra)}
                              </Td>
                              <Td alinhar="centro" className="num text-[12px]">
                                {p.total === 1 ? 'À vista' : `${p.numero}/${p.total}`}
                              </Td>
                              <Td alinhar="direita" className="num font-semibold">
                                {dinheiro(p.valor)}
                              </Td>
                            </Linha>
                          ))}
                        </tbody>
                      </Tabela>
                    )}
                  </div>
                )}
              </Caixa>
            )
          })}
        </div>
      )}

      <Caixa className="overflow-hidden">
        <header className="px-5 pt-4 pb-3">
          <h2 className="text-[15px] font-semibold tracking-tight">
            Próximos {MESES_PROJECAO} meses
          </h2>
          <p className="mt-0.5 text-xs text-tinta-fraca">
            O que já está comprometido em cada cartão, mês a mês. Serve para saber quando o
            aperto passa.
          </p>
        </header>
        <div className="border-t border-linha-suave">
          <Tabela>
            <Cabeca>
              <tr>
                <Th className="sticky left-0 bg-superficie">Mês</Th>
                {matriz.cartoes.map((c) => (
                  <Th key={c.id} alinhar="direita">
                    <span className="flex items-center justify-end gap-1.5">
                      <MarcaBanco bancoId={c.bancoId} tamanho={18} />
                      {c.apelido}
                    </span>
                  </Th>
                ))}
                <Th alinhar="direita">Total</Th>
              </tr>
            </Cabeca>
            <tbody>
              {matriz.meses.map((m) => {
                const valores = matriz.cartoes.map((c) => matriz.celula(c.id, m))
                const soma = valores.reduce((s, v) => s + v, 0)
                const atual = m === mesAtual()
                return (
                  <Linha key={m} className={atual ? 'bg-marca/5' : undefined}>
                    <Td className="sticky left-0 bg-superficie font-semibold whitespace-nowrap">
                      {rotuloMes(m)}
                      {atual && <span className="ml-1.5 text-[10px] text-marca">agora</span>}
                    </Td>
                    {valores.map((v, i) => (
                      <Td
                        key={matriz.cartoes[i]!.id}
                        alinhar="direita"
                        className={cn('num', v === 0 && 'text-tinta-tenue')}
                      >
                        {v === 0 ? '—' : dinheiro(v)}
                      </Td>
                    ))}
                    <Td alinhar="direita" className="num font-bold">
                      {soma === 0 ? '—' : dinheiro(soma)}
                    </Td>
                  </Linha>
                )
              })}
            </tbody>
          </Tabela>
        </div>
      </Caixa>

      {informando && (
        <ModalInformar fatura={informando} onFechar={() => setInformando(null)} />
      )}

      <Modal
        aberto={confirmandoLote}
        onFechar={() => setConfirmandoLote(false)}
        titulo={daSelecao.length === 1 ? 'Marcar como paga' : 'Marcar como pagas'}
        descricao={
          daSelecao.length === 1
            ? `1 fatura de ${rotuloMes(mes)}, escolhida por você.`
            : `${daSelecao.length} faturas de ${rotuloMes(mes)}, escolhidas por você.`
        }
        largura={470}
        rodape={
          <>
            <Botao aparencia="perigo" onClick={() => setConfirmandoLote(false)}>
              Cancelar
            </Botao>
            <Botao
              aparencia="primaria"
              icone={<CheckCircle2 size={15} />}
              onClick={() => {
                pagarSelecionadas()
                setConfirmandoLote(false)
              }}
            >
              Marcar como pagas
            </Botao>
          </>
        }
      >
        {/* Mostrar a lista, e não só o número, é o que deixa conferir antes de
            confirmar: cinco cartões de uma vez é fácil de errar no cego. */}
        <div className="divide-y divide-linha-suave rounded-cartao border border-linha">
          {daSelecao.map((f) => (
            <div key={f.cartao.id} className="flex items-center gap-3 px-3 py-2.5">
              <MarcaBanco bancoId={f.cartao.bancoId} tamanho={26} />
              <span className="truncate text-[13px] font-semibold">{f.cartao.apelido}</span>
              <span className="num ml-auto text-[13px] font-bold">{dinheiro(f.valor)}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 bg-elevado/50 px-3 py-2.5">
            <span className="text-[12px] font-bold tracking-wide text-tinta-tenue uppercase">
              Total
            </span>
            <span className="num ml-auto text-[15px] font-bold text-entra">
              {dinheiro(somaSelecao)}
            </span>
          </div>
        </div>
        <p className="mt-3 text-[12px] text-tinta-fraca">
          Depois dá para desfazer: um clique na marca verde tira a fatura de paga.
        </p>
      </Modal>
    </>
  )
}

function ModalInformar({ fatura, onFechar }: { fatura: Fatura; onFechar: () => void }) {
  const { faturas } = useDados()
  const [valor, setValor] = useState(fatura.valorInformado ?? fatura.calculadoTotal)
  const [obs, setObs] = useState(fatura.registro?.observacao ?? '')

  const diferenca = valor - fatura.calculadoTotal

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={`Fatura de ${fatura.cartao.apelido}`}
      descricao={`${rotuloMes(fatura.mes)} — informe o valor que o banco mostrou, se for diferente do calculado.`}
      largura={480}
      rodape={
        <>
          {fatura.valorInformado != null && (
            <Botao
              aparencia="fantasma"
              className="mr-auto"
              onClick={() => {
                faturas.registrar({
                  cartaoId: fatura.cartao.id,
                  mes: fatura.mes,
                  paga: fatura.paga,
                  observacao: obs.trim() || undefined,
                })
                onFechar()
              }}
            >
              Voltar ao calculado
            </Botao>
          )}
          <Botao aparencia="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao
            aparencia="primaria"
            onClick={() => {
              faturas.registrar({
                cartaoId: fatura.cartao.id,
                mes: fatura.mes,
                valorInformado: valor,
                paga: fatura.paga,
                observacao: obs.trim() || undefined,
              })
              onFechar()
            }}
          >
            Salvar valor
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-cartao border border-linha bg-afundado px-3.5 py-3">
          <span className="text-[12px] text-tinta-fraca">Calculado pelas compras</span>
          <span className="num font-semibold">{dinheiro(fatura.calculadoTotal)}</span>
        </div>

        <Campo rotulo="Valor da fatura no banco">
          <EntradaValor valor={valor} onValor={setValor} autoFocus />
        </Campo>

        {Math.abs(diferenca) >= 0.01 && (
          <div className="flex items-center justify-between rounded-cartao border border-linha bg-afundado px-3.5 py-3">
            <span className="text-[12px] text-tinta-fraca">
              {diferenca > 0 ? 'A mais que o calculado' : 'A menos que o calculado'}
            </span>
            <Dinheiro valor={diferenca} colorido sinal className="font-semibold" />
          </div>
        )}

        <Campo rotulo="Observação" dica="Ex.: anuidade, IOF de compra internacional, estorno.">
          <Entrada value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" />
        </Campo>
      </div>
    </Modal>
  )
}
