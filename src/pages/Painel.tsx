import { useMemo } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowRight,
  CreditCard,
  PiggyBank,
  Receipt,
  ScanText,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useDados } from '@/lib/estado'
import { iconeGasto } from '@/lib/categorias'
import { Filtros } from '@/components/Filtros'
import { MarcaBanco } from '@/lib/bancos'
import {
  porCategoria,
  porMembro,
  projecao,
  resumoDoMes,
  todasAsParcelas,
  usoDoLimite,
} from '@/lib/finance'
import { nomeMesCurto, rotuloMes } from '@/lib/mes'
import { dinheiro, dinheiroCurto, porcento } from '@/lib/formato'
import type { Tela } from '@/components/Shell'
import {
  Avatar,
  Barra,
  Botao,
  CabecalhoTela,
  Caixa,
  Dinheiro,
  Etiqueta,
  Metrica,
  Vazio,
  cn,
} from '@/components/ui'

const MESES_GRAFICO = 7

export function Painel({
  irPara,
  onLerPrint,
}: {
  irPara: (t: Tela) => void
  onLerPrint: () => void
}) {
  const { compartilhados: dados, mes, filtro, membros } = useDados()

  const parcelas = useMemo(() => todasAsParcelas(dados), [dados])
  const resumo = useMemo(() => resumoDoMes(dados, mes, filtro, parcelas), [dados, mes, filtro, parcelas])
  const futuro = useMemo(() => projecao(dados, mes, MESES_GRAFICO, filtro), [dados, mes, filtro])
  const categorias = useMemo(() => porCategoria(resumo), [resumo])
  // Só existe quebra por pessoa quando há família; sozinho, tudo é seu.
  const pessoas = useMemo(
    () => porMembro(dados, mes, membros.map((m) => m.id), parcelas),
    [dados, mes, membros, parcelas],
  )

  const limites = useMemo(() => {
    const alvo = dados.cartoes.filter(
      (c) => c.ativo && (!filtro || !filtro.length || !c.usuarioId || filtro.includes(c.usuarioId)),
    )
    const usos = alvo.map((c) => usoDoLimite(dados, c, mes, parcelas))
    return {
      usos: usos.sort((a, b) => b.percentual - a.percentual),
      limite: usos.reduce((s, u) => s + u.limite, 0),
      usado: usos.reduce((s, u) => s + u.usado, 0),
      disponivel: usos.reduce((s, u) => s + u.disponivel, 0),
    }
  }, [dados, mes, filtro, parcelas])

  const reserva = dados.config.reservaMinima ?? 0
  const podeGastar = resumo.saldo - reserva
  const comprometido = resumo.ganhos > 0 ? (resumo.gastos / resumo.ganhos) * 100 : 0

  const dadosGrafico = futuro.map((r) => ({
    mes: nomeMesCurto(r.mes),
    ganhos: r.ganhos,
    gastos: r.gastos,
    saldo: r.saldo,
  }))

  const semNada =
    resumo.ganhos === 0 && resumo.gastos === 0 && dados.compras.length === 0 && dados.ganhos.length === 0

  return (
    <>
      <CabecalhoTela
        titulo={`Painel de ${rotuloMes(mes)}`}
        descricao={
          resumo.ganhos > 0
            ? `${porcento(comprometido)} da renda do mês já está comprometida`
            : 'Cadastre os ganhos para o app calcular quanto sobra.'
        }
        acoes={
          <>
            <Botao aparencia="contorno" icone={<ScanText size={15} />} onClick={onLerPrint}>
              Ler print
            </Botao>
            <Botao aparencia="primaria" icone={<Wallet size={15} />} onClick={() => irPara('compras')}>
              Nova compra
            </Botao>
          </>
        }
      />

      <Filtros />

      {semNada ? (
        <Caixa>
          <Vazio
            icone={<PiggyBank size={30} />}
            titulo="Ainda não tem nada para mostrar"
            descricao="Cadastre os ganhos do mês e as compras dos cartões. Aí o painel passa a responder quanto sobra neste mês e nos próximos."
            acao={
              <div className="flex gap-2">
                <Botao aparencia="primaria" onClick={() => irPara('ganhos')}>
                  Cadastrar ganhos
                </Botao>
                <Botao onClick={() => irPara('cartoes')}>Cadastrar cartões</Botao>
              </div>
            }
          />
        </Caixa>
      ) : (
        <div className="space-y-4">
          {/* --------------------------- números do mês -------------------------- */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
            <Metrica
              rotulo="Entrou"
              valor={dinheiro(resumo.ganhos)}
              tom="entra"
              icone={<TrendingUp size={16} />}
              detalhe={`${resumo.detalheGanhos.length} lançamentos`}
            />
            <Metrica
              rotulo="Vai sair"
              valor={dinheiro(resumo.gastos)}
              tom="sai"
              icone={<TrendingDown size={16} />}
              detalhe={
                resumo.avulsos > 0
                  ? `${dinheiro(resumo.faturas)} em faturas · ${dinheiro(resumo.fixos)} gastos · ${dinheiro(resumo.avulsos)} dinheiro`
                  : `${dinheiro(resumo.faturas)} em faturas · ${dinheiro(resumo.fixos)} gastos`
              }
            />
            <Metrica
              rotulo="Sobra do mês"
              valor={dinheiro(resumo.saldo)}
              tom={resumo.saldo >= 0 ? 'entra' : 'sai'}
              icone={<PiggyBank size={16} />}
              detalhe={
                resumo.saldo >= 0 ? 'depois de tudo pago' : 'o mês fecha no vermelho'
              }
            />
            <Metrica
              rotulo="Limite livre"
              valor={dinheiro(limites.disponivel)}
              tom={limites.disponivel > 0 ? 'info' : 'sai'}
              icone={<CreditCard size={16} />}
              detalhe={`de ${dinheiro(limites.limite)} nos cartões`}
            />
          </div>

          {/* -------------------------- quanto dá pra gastar --------------------- */}
          <Caixa
            className="flex flex-wrap items-center gap-5 p-5"
            style={{
              background:
                podeGastar >= 0
                  ? 'linear-gradient(120deg, color-mix(in srgb, var(--c-entra) 12%, var(--c-superficie)), var(--c-superficie) 60%)'
                  : 'linear-gradient(120deg, color-mix(in srgb, var(--c-sai) 12%, var(--c-superficie)), var(--c-superficie) 60%)',
            }}
          >
            <div className="min-w-56">
              <div className="text-[11px] font-semibold tracking-wide text-tinta-fraca uppercase">
                Dá para gastar em {rotuloMes(mes)}
              </div>
              <div
                className={cn(
                  'num mt-1 text-4xl font-bold tracking-tight',
                  podeGastar >= 0 ? 'text-entra' : 'text-sai',
                )}
              >
                {dinheiro(podeGastar)}
              </div>
              {reserva > 0 && (
                <div className="mt-1 text-[12px] text-tinta-fraca">
                  já descontando {dinheiro(reserva)} de reserva
                </div>
              )}
            </div>

            <div className="min-w-52 flex-1">
              <div className="mb-1.5 flex justify-between text-[11px] text-tinta-fraca">
                <span>Comprometido da renda</span>
                <span className="num">{porcento(Math.min(comprometido, 999))}</span>
              </div>
              <Barra
                valor={comprometido}
                altura={9}
                cor={
                  comprometido > 100
                    ? 'var(--c-sai)'
                    : comprometido > 80
                      ? 'var(--c-alerta)'
                      : 'var(--c-marca)'
                }
              />
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {comprometido > 100 && <Etiqueta tom="sai">Gastando mais do que entra</Etiqueta>}
                {comprometido > 80 && comprometido <= 100 && (
                  <Etiqueta tom="alerta">Margem apertada</Etiqueta>
                )}
                {comprometido <= 80 && comprometido > 0 && (
                  <Etiqueta tom="entra">Folga confortável</Etiqueta>
                )}
                {limites.usos.some((u) => u.percentual >= 80) && (
                  <Etiqueta tom="alerta">Cartão perto do limite</Etiqueta>
                )}
              </div>
            </div>
          </Caixa>

          {/* -------------------------------- gráfico ---------------------------- */}
          <Caixa className="overflow-hidden">
            <header className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4 pb-1">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight">
                  Entradas e saídas até {rotuloMes(futuro[futuro.length - 1]!.mes)}
                </h2>
                <p className="mt-0.5 text-xs text-tinta-fraca">
                  As barras já incluem as parcelas que ainda vão cair nas próximas faturas.
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-tinta-fraca">
                <Legenda cor="var(--c-entra)" texto="entra" />
                <Legenda cor="var(--c-sai)" texto="sai" />
                <Legenda cor="var(--c-info)" texto="sobra" tracejado />
              </div>
            </header>
            <div className="h-[248px] px-2 pt-2 pb-3">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dadosGrafico} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <CartesianGrid stroke="var(--c-linha)" vertical={false} />
                  <XAxis
                    dataKey="mes"
                    tick={{ fill: 'var(--c-tinta-fraca)', fontSize: 11 }}
                    axisLine={{ stroke: 'var(--c-linha)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => dinheiroCurto(Number(v))}
                    tick={{ fill: 'var(--c-tinta-tenue)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={72}
                  />
                  <Tooltip content={<DicaGrafico />} cursor={{ fill: 'var(--c-elevado)' }} />
                  <Bar dataKey="ganhos" fill="var(--c-entra)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="gastos" fill="var(--c-sai)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Line
                    type="monotone"
                    dataKey="saldo"
                    stroke="var(--c-info)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={{ r: 3, fill: 'var(--c-info)', strokeWidth: 0 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Caixa>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
            {/* ----------------------------- faturas ---------------------------- */}
            <Caixa className="overflow-hidden">
              <header className="flex items-center justify-between px-5 pt-4 pb-3">
                <h2 className="text-[15px] font-semibold tracking-tight">
                  Faturas de {rotuloMes(mes)}
                </h2>
                <Botao
                  aparencia="fantasma"
                  tamanho="sm"
                  icone={<ArrowRight size={14} />}
                  onClick={() => irPara('faturas')}
                >
                  Ver todas
                </Botao>
              </header>
              <div className="border-t border-linha-suave">
                {resumo.faturasPorCartao.filter((f) => f.valor > 0).length === 0 ? (
                  <Vazio
                    icone={<Receipt size={26} />}
                    titulo="Nenhuma fatura neste mês"
                    descricao="Nada foi comprado para cair aqui."
                  />
                ) : (
                  <ul>
                    {resumo.faturasPorCartao
                      .filter((f) => f.valor > 0)
                      .map((f) => {
                        const uso = usoDoLimite(dados, f.cartao, mes, parcelas)
                        return (
                          <li
                            key={f.cartao.id}
                            className="flex items-center gap-3 border-b border-linha-suave px-5 py-3 last:border-0"
                          >
                            <MarcaBanco bancoId={f.cartao.bancoId} tamanho={32} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="truncate text-[13px] font-semibold">
                                  {f.cartao.apelido}
                                </span>
                                <span className="num text-[13px] font-semibold">
                                  {dinheiro(f.valor)}
                                </span>
                              </div>
                              <div className="mt-1.5">
                                <Barra
                                  valor={uso.percentual}
                                  altura={4}
                                  cor={
                                    uso.percentual >= 90
                                      ? 'var(--c-sai)'
                                      : uso.percentual >= 75
                                        ? 'var(--c-alerta)'
                                        : 'var(--c-marca)'
                                  }
                                />
                              </div>
                              <div className="mt-1 flex justify-between text-[10.5px] text-tinta-tenue">
                                <span>Vence dia {f.cartao.diaVencimento}</span>
                                <span className="num">{dinheiro(uso.disponivel)} livres</span>
                              </div>
                            </div>
                            {f.paga && <Etiqueta tom="entra">Paga</Etiqueta>}
                          </li>
                        )
                      })}
                  </ul>
                )}
              </div>
            </Caixa>

            {/* ---------------------------- por pessoa --------------------------- */}
            <div className="space-y-4">
              <Caixa className="overflow-hidden">
                <header className="px-5 pt-4 pb-3">
                  <h2 className="text-[15px] font-semibold tracking-tight">Por pessoa</h2>
                  <p className="mt-0.5 text-xs text-tinta-fraca">
                    O que cada um ganhou e gastou em {rotuloMes(mes)}.
                  </p>
                </header>
                <ul className="border-t border-linha-suave">
                  {pessoas.map((linha) => {
                    const p = membros.find((x) => x.id === linha.usuarioId)
                    if (!p) return null
                    return (
                      <li
                        key={linha.usuarioId}
                        className="flex items-center gap-3 border-b border-linha-suave px-5 py-3 last:border-0"
                      >
                        <Avatar nome={p.nome} foto={p.foto} cor="var(--c-marca)" tamanho={32} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold">{p.nome}</div>
                          <div className="text-[11px] text-tinta-fraca">
                            <span className="text-entra">{dinheiro(linha.ganhos)}</span>
                            {' entrou · '}
                            <span className="text-sai">{dinheiro(linha.gastos)}</span>
                            {' saiu'}
                          </div>
                        </div>
                        <Dinheiro valor={linha.saldo} colorido sinal className="font-bold" />
                      </li>
                    )
                  })}
                  {membros.length > 1 && (
                    <li className="flex items-center gap-3 bg-elevado/50 px-5 py-3">
                      <span className="flex size-8 items-center justify-center rounded-pilula bg-marca/15 text-marca">
                        <Wallet size={15} />
                      </span>
                      <div className="min-w-0 flex-1 text-[13px] font-semibold">Nós dois</div>
                      <Dinheiro
                        valor={pessoas.reduce((s, l) => s + l.saldo, 0)}
                        colorido
                        sinal
                        className="font-bold"
                      />
                    </li>
                  )}
                </ul>
              </Caixa>

              <Caixa className="overflow-hidden">
                <header className="px-5 pt-4 pb-3">
                  <h2 className="text-[15px] font-semibold tracking-tight">Onde o dinheiro foi</h2>
                  <p className="mt-0.5 text-xs text-tinta-fraca">
                    Categorias com mais peso em {rotuloMes(mes)}.
                  </p>
                </header>
                <div className="border-t border-linha-suave px-5 py-4">
                  {categorias.length === 0 ? (
                    <p className="py-4 text-center text-[12px] text-tinta-fraca">
                      Nenhum gasto categorizado neste mês.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {categorias.slice(0, 6).map((c) => {
                        const pct = resumo.gastos > 0 ? (c.valor / resumo.gastos) * 100 : 0
                        const Icone = iconeGasto(c.categoria)
                        return (
                          <li key={c.categoria}>
                            <div className="mb-1 flex items-center justify-between gap-3 text-[12px]">
                              <span className="flex min-w-0 items-center gap-2 font-medium">
                                {/* O ícone acha a linha antes de a palavra ser lida. */}
                                <Icone size={14} className="shrink-0 text-tinta-tenue" />
                                <span className="truncate">{c.categoria}</span>
                              </span>
                              <span className="num shrink-0 text-tinta-fraca">
                                {dinheiro(c.valor)}{' '}
                                <span className="text-tinta-tenue">({porcento(pct)})</span>
                              </span>
                            </div>
                            <Barra valor={pct} altura={5} cor="var(--c-destaque)" />
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </Caixa>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Legenda({ cor, texto, tracejado }: { cor: string; texto: string; tracejado?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-0.5 w-4 rounded-full"
        style={{
          background: tracejado ? `repeating-linear-gradient(90deg, ${cor} 0 4px, transparent 4px 7px)` : cor,
          height: tracejado ? 2 : 8,
          borderRadius: 999,
        }}
      />
      {texto}
    </span>
  )
}

interface DicaProps {
  active?: boolean
  label?: string
  payload?: { dataKey?: string | number; value?: number }[]
}

/** Tooltip própria: a padrão do recharts ignora o tema. */
function DicaGrafico({ active, label, payload }: DicaProps) {
  if (!active || !payload?.length) return null
  const pegar = (k: string) => payload.find((p) => p.dataKey === k)?.value ?? 0
  return (
    <div className="rounded-controle border border-linha bg-elevado px-3 py-2 shadow-[var(--sombra-flutuante)]">
      <div className="mb-1 text-[11px] font-semibold text-tinta-fraca">{label}</div>
      <div className="space-y-0.5 text-[12px]">
        <div className="flex justify-between gap-4">
          <span className="text-entra">entra</span>
          <span className="num">{dinheiro(pegar('ganhos'))}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-sai">sai</span>
          <span className="num">{dinheiro(pegar('gastos'))}</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-linha pt-0.5">
          <span className="text-tinta-fraca">sobra</span>
          <Dinheiro valor={pegar('saldo')} colorido />
        </div>
      </div>
    </div>
  )
}
