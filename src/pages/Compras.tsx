import { useAutenticacao } from '@/lib/auth'
import { useEffect, useMemo, useState } from 'react'
import { FilterX, Pencil, Plus, ScanText, ShoppingBag, Trash2 } from 'lucide-react'
import { useCartoesFiltrados, useDados } from '@/lib/estado'
import { iconeGasto } from '@/lib/categorias'
import { MarcaBanco } from '@/lib/bancos'
import { primeiraFaturaDe, primeiroCartao, todasAsParcelas, todosOsGastosDiretos, valoresParcelas } from '@/lib/finance'
import { dataBr, difMeses, hojeIso, mesDaData, rotuloMes, somaMes } from '@/lib/mes'
import type { Cartao, Compra } from '@/lib/types'
import { dinheiro, lerValor } from '@/lib/formato'
import {
  Avatar,
  Botao,
  Cabeca,
  CabecalhoTela,
  Caixa,
  Confirmacao,
  Entrada,
  Etiqueta,
  Linha,
  Selecao,
  Tabela,
  Td,
  Th,
  Vazio,
  cn,
} from '@/components/ui'
import { FormularioCompra, rascunhoVazio, type RascunhoCompra } from '@/components/FormularioCompra'
import { LeitorDePrint } from '@/components/LeitorDePrint'
import type { Tela } from '@/components/Shell'

type Escopo = 'mes' | 'abertas' | 'todas'

export function Compras({
  irPara,
  abrirLeitor = false,
}: {
  irPara: (t: Tela) => void
  /** Entrou aqui pelo atalho "Ler print" do painel. */
  abrirLeitor?: boolean
}) {
  const { compartilhados: dados, dados: pessoais, mes, filtro, compras } = useDados()
  const { usuario } = useAutenticacao()
  const daPessoa = useCartoesFiltrados()
  /** Cartão que um lançamento novo assume: o da pessoa em foco, se ela tiver. */
  const cartaoInicial = primeiroCartao(daPessoa, pessoais.cartoes, pessoais.config.ultimoCartaoId)
  const [novo, setNovo] = useState(false)
  const [editando, setEditando] = useState<Compra | null>(null)
  const [excluir, setExcluir] = useState<Compra | null>(null)
  const [leitor, setLeitor] = useState(abrirLeitor)
  const [printColado, setPrintColado] = useState<string | null>(null)
  const [lidoDoPrint, setLidoDoPrint] = useState<RascunhoCompra | null>(null)
  const [escopo, setEscopo] = useState<Escopo>('mes')
  /** '' = todos os cartões, 'dinheiro' = só as sem cartão. */
  const [cartaoId, setCartaoId] = useState('')
  const [busca, setBusca] = useState('')
  /* Um filtro por coluna: o cabeçalho é onde a pessoa já está olhando. */
  const [fData, setFData] = useState('')
  const [fParcelas, setFParcelas] = useState<'todas' | 'avista' | 'parcelado'>('todas')
  const [fMinimo, setFMinimo] = useState('')

  const parcelas = useMemo(() => todasAsParcelas(dados), [dados])
  const avulsos = useMemo(() => todosOsGastosDiretos(dados), [dados])
  /** Mesma forma de `parcelas`, mas com `cartao: null` — compra em dinheiro. */
  const itens = useMemo(
    () => [...parcelas, ...avulsos.map((d) => ({ ...d, cartao: null as Cartao | null }))],
    [parcelas, avulsos],
  )

  /*
   * Ctrl+V em qualquer canto da tela abre o leitor com o print já dentro — é o
   * caminho de sempre: printou a notificação no celular, colou aqui. Fica de
   * fora quando já há um formulário ou o próprio leitor na frente.
   */
  const ocupado = leitor || novo || !!editando || !!lidoDoPrint
  useEffect(() => {
    if (ocupado) return
    const aoColar = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
      if (!item) return
      const arquivo = item.getAsFile()
      if (!arquivo) return
      e.preventDefault()
      const fr = new FileReader()
      fr.onload = () => {
        setPrintColado(String(fr.result))
        setLeitor(true)
      }
      fr.readAsDataURL(arquivo)
    }
    window.addEventListener('paste', aoColar)
    return () => window.removeEventListener('paste', aoColar)
  }, [ocupado])

  const fecharLeitor = () => {
    setLeitor(false)
    setPrintColado(null)
  }

  // Trocar de pessoa não pode deixar o filtro preso num cartão que saiu da lista.
  useEffect(() => {
    if (cartaoId && cartaoId !== 'dinheiro' && !daPessoa.some((c) => c.id === cartaoId)) setCartaoId('')
  }, [cartaoId, daPessoa])

  /** Uma linha por compra, com a parcela que interessa ao escopo escolhido. */
  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const porCompra = new Map<string, { compra: Compra; parcelas: typeof itens }>()
    for (const p of itens) {
      const atual = porCompra.get(p.compra.id)
      if (atual) atual.parcelas.push(p)
      else porCompra.set(p.compra.id, { compra: p.compra, parcelas: [p] })
    }

    return [...porCompra.values()]
      .map(({ compra, parcelas: ps }) => {
        const cartao = ps[0]!.cartao
        const usuarioId = ps[0]!.usuarioId
        const noMes = ps.find((p) => p.mes === mes)
        const abertas = ps.filter((p) => difMeses(mes, p.mes) >= 0)
        return { compra, cartao, usuarioId, ps, noMes, abertas }
      })
      .filter((l) => {
        if (filtro && filtro.length && l.usuarioId && !filtro.includes(l.usuarioId)) return false
        if (cartaoId === 'dinheiro' && l.cartao) return false
        if (cartaoId && cartaoId !== 'dinheiro' && l.cartao?.id !== cartaoId) return false
        if (escopo === 'mes' && !l.noMes) return false
        if (escopo === 'abertas' && l.abertas.length === 0) return false
        if (termo) {
          const alvo = `${l.compra.descricao} ${l.compra.categoria}`.toLowerCase()
          if (!alvo.includes(termo)) return false
        }
        if (fData && !dataBr(l.compra.dataCompra).includes(fData.trim())) return false
        if (fParcelas === 'avista' && l.compra.parcelas > 1) return false
        if (fParcelas === 'parcelado' && l.compra.parcelas <= 1) return false
        if (fMinimo) {
          const minimo = lerValor(fMinimo)
          const valor = escopo === 'mes' ? (l.noMes?.valor ?? 0) : l.compra.valorTotal
          if (minimo > 0 && valor < minimo) return false
        }
        return true
      })
      .sort((a, b) => b.compra.dataCompra.localeCompare(a.compra.dataCompra))
  }, [parcelas, mes, filtro, cartaoId, escopo, busca, fData, fParcelas, fMinimo])

  const temFiltroDeColuna = !!(busca || cartaoId || fData || fMinimo || fParcelas !== 'todas')
  const limparColunas = () => {
    setBusca('')
    setCartaoId('')
    setFData('')
    setFMinimo('')
    setFParcelas('todas')
  }

  const totalMostrado = linhas.reduce(
    (s, l) => s + (escopo === 'mes' ? (l.noMes?.valor ?? 0) : l.compra.valorTotal),
    0,
  )

  const ESCOPOS: { id: Escopo; rotulo: string }[] = [
    { id: 'mes', rotulo: `Na fatura de ${rotuloMes(mes)}` },
    { id: 'abertas', rotulo: 'Com parcelas em aberto' },
    { id: 'todas', rotulo: 'Todas' },
  ]

  return (
    <>
      <CabecalhoTela
        titulo="Compras"
        descricao={
          escopo === 'mes'
            ? `${linhas.length} compras somando ${dinheiro(totalMostrado)} nesta fatura`
            : `${linhas.length} compras somando ${dinheiro(totalMostrado)} em valor total`
        }
        acoes={
          <>
            <Botao
              aparencia="contorno"
              icone={<ScanText size={15} />}
              onClick={() => setLeitor(true)}
            >
              Ler print
            </Botao>
            <Botao aparencia="primaria" icone={<Plus size={15} />} onClick={() => setNovo(true)}>
              Nova compra
            </Botao>
          </>
        }
      />

      <Caixa className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="flex rounded-controle border border-linha p-0.5">
          {ESCOPOS.map((e) => (
            <button
              key={e.id}
              onClick={() => setEscopo(e.id)}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-[12px] font-semibold',
                escopo === e.id
                  ? 'bg-marca/15 text-marca'
                  : 'text-tinta-fraca hover:bg-elevado hover:text-tinta',
              )}
            >
              {e.rotulo}
            </button>
          ))}
        </div>

        {temFiltroDeColuna && (
          <Botao
            aparencia="fantasma"
            tamanho="sm"
            icone={<FilterX size={14} />}
            className="ml-auto"
            onClick={limparColunas}
          >
            Limpar filtros
          </Botao>
        )}
      </Caixa>

      <Caixa className="overflow-hidden">
        {linhas.length === 0 ? (
          <Vazio
            icone={<ShoppingBag size={30} />}
            titulo="Nenhuma compra por aqui"
            descricao={
              escopo === 'mes'
                ? 'Nada cai na fatura desse mês com os filtros atuais. Troque o mês na barra de cima ou lance uma compra.'
                : 'Lance a primeira compra ou solte um print na tela “Ler print”.'
            }
            acao={
              <Botao aparencia="primaria" icone={<Plus size={15} />} onClick={() => setNovo(true)}>
                Nova compra
              </Botao>
            }
          />
        ) : (
          <Tabela>
            <Cabeca>
              <tr>
                <Th>Compra</Th>
                <Th>Cartão</Th>
                <Th alinhar="centro">Data</Th>
                <Th alinhar="centro">Parcelas</Th>
                <Th alinhar="direita">
                  {escopo === 'mes' ? 'Nesta fatura' : 'Parcela'}
                </Th>
                <Th alinhar="direita">Total</Th>
                <Th />
              </tr>
              {/* Cada coluna filtra a si mesma, logo abaixo do próprio título. */}
              <tr className="[&>td]:px-3 [&>td]:pb-2.5">
                <td>
                  <FiltroColuna
                    placeholder="Descrição ou categoria"
                    valor={busca}
                    onValor={setBusca}
                  />
                </td>
                <td>
                  <Selecao
                    className="h-8 py-0 text-[12px]"
                    value={cartaoId}
                    onChange={(e) => setCartaoId(e.target.value)}
                  >
                    <option value="">Todos</option>
                    <option value="dinheiro">Dinheiro</option>
                    {daPessoa.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.apelido}
                      </option>
                    ))}
                  </Selecao>
                </td>
                <td>
                  <FiltroColuna placeholder="dd/mm/aaaa" valor={fData} onValor={setFData} centro />
                </td>
                <td>
                  <Selecao
                    className="h-8 py-0 text-[12px]"
                    value={fParcelas}
                    onChange={(e) => setFParcelas(e.target.value as typeof fParcelas)}
                  >
                    <option value="todas">Todas</option>
                    <option value="avista">À vista</option>
                    <option value="parcelado">Parceladas</option>
                  </Selecao>
                </td>
                <td>
                  <FiltroColuna
                    placeholder="Mínimo"
                    valor={fMinimo}
                    onValor={setFMinimo}
                    direita
                  />
                </td>
                <td />
                <td />
              </tr>
            </Cabeca>
            <tbody>
              {linhas.map((l) => {
                const inicio = l.cartao
                  ? primeiraFaturaDe(l.compra, l.cartao)
                  : l.compra.primeiraFatura || mesDaData(l.compra.dataCompra)
                const valorParcela = valoresParcelas(l.compra.valorTotal, l.compra.parcelas)[0]!
                const fim = somaMes(inicio, l.compra.parcelas - 1)
                return (
                  <Linha key={l.compra.id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        {(() => {
                          const Icone = iconeGasto(l.compra.categoria)
                          return (
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-controle bg-elevado text-tinta-fraca">
                              <Icone size={15} />
                            </span>
                          )
                        })()}
                        <div className="min-w-0 leading-tight">
                          <div className="truncate font-semibold">{l.compra.descricao}</div>
                          <div className="flex items-center gap-1.5 text-[11px] text-tinta-tenue">
                            {l.compra.categoria}
                            {l.compra.origemOcr && <Etiqueta tom="destaque">Print</Etiqueta>}
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      {l.cartao ? (
                        <div className="flex items-center gap-2">
                          <MarcaBanco bancoId={l.cartao.bancoId} tamanho={24} />
                          <span className="text-[12px] text-tinta-fraca">{l.cartao.apelido}</span>
                        </div>
                      ) : (
                        <Etiqueta tom="neutro">Dinheiro</Etiqueta>
                      )}
                    </Td>
                    <Td alinhar="centro" className="num text-[12px] text-tinta-fraca">
                      {dataBr(l.compra.dataCompra)}
                    </Td>
                    <Td alinhar="centro">
                      {l.compra.parcelas === 1 ? (
                        <Etiqueta tom="neutro">À vista</Etiqueta>
                      ) : (
                        <div className="leading-tight">
                          <div className="num text-[12px] font-semibold">
                            {l.noMes ? `${l.noMes.numero}/${l.compra.parcelas}` : `${l.compra.parcelas}x`}
                          </div>
                          <div className="text-[10px] text-tinta-tenue">
                            {rotuloMes(inicio)} → {rotuloMes(fim)}
                          </div>
                        </div>
                      )}
                    </Td>
                    <Td alinhar="direita" className="num font-semibold">
                      {dinheiro(escopo === 'mes' ? (l.noMes?.valor ?? 0) : valorParcela)}
                    </Td>
                    <Td alinhar="direita" className="num text-tinta-fraca">
                      {dinheiro(l.compra.valorTotal)}
                    </Td>
                    <Td alinhar="direita">
                      <div className="flex justify-end gap-1">
                        <Botao
                          aparencia="fantasma"
                          tamanho="icone"
                          aria-label="Editar"
                          disabled={!!l.compra.usuarioId && l.compra.usuarioId !== usuario?.id}
                          onClick={() => setEditando(l.compra)}
                        >
                          <Pencil size={15} />
                        </Botao>
                        <Botao
                          aparencia="fantasma"
                          tamanho="icone"
                          aria-label="Excluir"
                          className="hover:text-sai"
                          disabled={!!l.compra.usuarioId && l.compra.usuarioId !== usuario?.id}
                          onClick={() => setExcluir(l.compra)}
                        >
                          <Trash2 size={15} />
                        </Botao>
                      </div>
                    </Td>
                  </Linha>
                )
              })}
            </tbody>
          </Tabela>
        )}
      </Caixa>

      {novo && (
        <FormularioCompra
          aberto
          inicial={{ ...rascunhoVazio(cartaoInicial), dataCompra: mesDaData(hojeIso()) === mes ? hojeIso() : `${mes}-01` }}
          onFechar={() => setNovo(false)}
          onSalvar={(r: RascunhoCompra) => compras.criar(r)}
        />
      )}

      {leitor && (
        <LeitorDePrint
          imagemInicial={printColado}
          onFechar={fecharLeitor}
          onRevisar={(r) => {
            fecharLeitor()
            setLidoDoPrint(r)
          }}
          irParaCartoes={() => irPara('cartoes')}
        />
      )}

      {lidoDoPrint && (
        <FormularioCompra
          aberto
          titulo="Conferir compra lida do print"
          inicial={lidoDoPrint}
          onFechar={() => setLidoDoPrint(null)}
          onSalvar={(r) => compras.criar(r)}
        />
      )}

      {editando && (
        <FormularioCompra
          aberto
          titulo="Editar compra"
          rotuloSalvar="Salvar alterações"
          inicial={{ ...editando }}
          onFechar={() => setEditando(null)}
          onSalvar={(r) => compras.atualizar(editando.id, r)}
        />
      )}

      <Confirmacao
        aberto={!!excluir}
        onFechar={() => setExcluir(null)}
        onConfirmar={() => excluir && compras.remover(excluir.id)}
        titulo="Excluir compra?"
        mensagem={`“${excluir?.descricao ?? ''}” sai de todas as faturas, inclusive as parcelas dos próximos meses.`}
      />
    </>
  )
}

/** Caixa de filtro que mora dentro do cabeçalho — discreta até ter conteúdo. */
function FiltroColuna({
  placeholder,
  valor,
  onValor,
  centro,
  direita,
}: {
  placeholder: string
  valor: string
  onValor: (v: string) => void
  centro?: boolean
  direita?: boolean
}) {
  return (
    <Entrada
      value={valor}
      placeholder={placeholder}
      onChange={(e) => onValor(e.target.value)}
      className={cn(
        'h-8 py-0 text-[12px] font-normal',
        valor ? 'border-marca/50' : 'border-linha-suave',
        centro && 'text-center',
        direita && 'text-right',
      )}
    />
  )
}
