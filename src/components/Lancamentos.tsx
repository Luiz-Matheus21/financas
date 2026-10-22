import { useMemo, useState } from 'react'
import { CalendarRange, Palmtree, Pencil, Plus, Repeat, TrendingUp, Trash2 } from 'lucide-react'
import { useAutenticacao } from '@/lib/auth'
import { useDados } from '@/lib/estado'
import { difMeses, nomeMes, rotuloMes, sequenciaMeses, somaMes } from '@/lib/mes'
import { ajusteVigente, diasTrabalhaveisNoMes, valorNoMes } from '@/lib/finance'
import type { Ajuste, Ferias, GastoFixo, Ganho, MesRef, Recorrencia } from '@/lib/types'
import { iconeGanho, iconeGasto } from '@/lib/categorias'
import { dinheiro } from '@/lib/formato'
import {
  Avatar,
  Botao,
  Cabeca,
  CabecalhoTela,
  Caixa,
  Campo,
  Confirmacao,
  Entrada,
  EntradaValor,
  Etiqueta,
  Interruptor,
  Linha,
  Modal,
  Selecao,
  Tabela,
  Td,
  Th,
  Vazio,
  cn,
} from './ui'

/** Ganho e gasto fixo têm a mesma forma; só muda o rótulo e a cor. */
export type Lancamento = Ganho | GastoFixo
type Rascunho = Omit<Lancamento, 'id' | 'criadoEm'> & { dia?: number }

const diaDe = (l: Lancamento): number | undefined =>
  'diaRecebimento' in l ? l.diaRecebimento : (l as GastoFixo).diaVencimento

export function ListaLancamentos({
  especie,
  titulo,
  descricao,
  categorias,
  itens,
  onCriar,
  onAtualizar,
  onRemover,
}: {
  especie: 'ganho' | 'fixo'
  titulo: string
  descricao: string
  categorias: readonly string[]
  itens: Lancamento[]
  onCriar: (r: Record<string, unknown>) => void
  onAtualizar: (id: string, r: Record<string, unknown>) => void
  onRemover: (id: string) => void
}) {
  const { dados, mes, filtro } = useDados()
  const [novo, setNovo] = useState(false)
  const { usuario } = useAutenticacao()
  const [editando, setEditando] = useState<Lancamento | null>(null)
  const [excluir, setExcluir] = useState<Lancamento | null>(null)
  const [soDoMes, setSoDoMes] = useState(true)

  const entra = especie === 'ganho'
  const rotuloDia = entra ? 'Dia do recebimento' : 'Dia do vencimento'

  const valeNoMes = (l: Lancamento, m: MesRef) => {
    if (l.recorrencia === 'unica') return l.mesInicio === m
    if (difMeses(l.mesInicio, m) < 0) return false
    if (l.mesFim && difMeses(l.mesFim, m) > 0) return false
    return true
  }

  /* O valor mostrado é o que vale no mês de referência, não o de cadastro. */
  const visiveis = useMemo(
    () =>
      itens
        .filter((l) => (!filtro || !filtro.length ? true : !l.usuarioId || filtro.includes(l.usuarioId)))
        .filter((l) => (soDoMes ? valeNoMes(l, mes) : true))
        .map((l) => ({ item: l, valor: valorNoMes(l, mes), ajuste: ajusteVigente(l, mes) }))
        .sort((a, b) => b.valor - a.valor),
    [itens, filtro, soDoMes, mes],
  )

  const total = visiveis.reduce((s, l) => s + l.valor, 0)

  return (
    <>
      <CabecalhoTela
        titulo={titulo}
        descricao={
          soDoMes
            ? `${dinheiro(total)} em ${nomeMes(mes)}`
            : `${dinheiro(total)} somando todos os lançamentos cadastrados`
        }
        acoes={
          <>
            <Botao
              aparencia={soDoMes ? 'neutra' : 'contorno'}
              icone={<CalendarRange size={15} />}
              onClick={() => setSoDoMes((v) => !v)}
            >
              {soDoMes ? 'Só deste mês' : 'Todos os cadastros'}
            </Botao>
            <Botao aparencia="primaria" icone={<Plus size={15} />} onClick={() => setNovo(true)}>
              {entra ? 'Novo ganho' : 'Novo gasto'}
            </Botao>
          </>
        }
      />

      <Caixa className="overflow-hidden">
        {visiveis.length === 0 ? (
          <Vazio
            icone={<Repeat size={30} />}
            titulo={entra ? 'Nenhum ganho lançado' : 'Nenhum gasto lançado'}
            descricao={descricao}
            acao={
              <Botao aparencia="primaria" icone={<Plus size={15} />} onClick={() => setNovo(true)}>
                Cadastrar
              </Botao>
            }
          />
        ) : (
          <Tabela>
            <Cabeca>
              <tr>
                <Th>Descrição</Th>
                <Th alinhar="centro">Recorrência</Th>
                <Th alinhar="centro">Dia</Th>
                <Th alinhar="direita">Valor</Th>
                <Th />
              </tr>
            </Cabeca>
            <tbody>
              {visiveis.map(({ item: l, valor, ajuste }) => {
                const Icone = especie === 'ganho' ? iconeGanho(l.categoria) : iconeGasto(l.categoria)
                return (
                  <Linha key={l.id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        {/* O ícone é da categoria: acha a linha antes da palavra. */}
                        <span
                          className={cn(
                            'flex size-8 shrink-0 items-center justify-center rounded-controle',
                            especie === 'ganho' ? 'bg-entra/12 text-entra' : 'bg-sai/12 text-sai',
                          )}
                        >
                          <Icone size={15} />
                        </span>
                        <div className="min-w-0 leading-tight">
                          <div className="truncate font-semibold">{l.descricao}</div>
                          <div className="text-[11px] text-tinta-tenue">{l.categoria}</div>
                        </div>
                      </div>
                    </Td>
                    <Td alinhar="centro">
                      {l.recorrencia === 'mensal' ? (
                        <div className="leading-tight">
                          <Etiqueta tom="info">Todo mês</Etiqueta>
                          <div className="mt-0.5 text-[10px] text-tinta-tenue">
                            Desde {rotuloMes(l.mesInicio)}
                            {l.mesFim ? ` até ${rotuloMes(l.mesFim)}` : ''}
                          </div>
                        </div>
                      ) : (
                        <div className="leading-tight">
                          <Etiqueta tom="neutro">Uma vez</Etiqueta>
                          <div className="mt-0.5 text-[10px] text-tinta-tenue">
                            {rotuloMes(l.mesInicio)}
                          </div>
                        </div>
                      )}
                    </Td>
                    <Td alinhar="centro" className="num text-[12px] text-tinta-fraca">
                      {diaDe(l) ?? '—'}
                    </Td>
                    <Td
                      alinhar="direita"
                      className={cn('num font-semibold', entra ? 'text-entra' : 'text-sai')}
                    >
                      {dinheiro(valor)}
                      {ajuste && (
                        <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] font-normal text-tinta-tenue">
                          <TrendingUp size={10} />
                          Reajustado em {rotuloMes(ajuste.mes)}
                        </div>
                      )}
                    </Td>
                    <Td alinhar="direita">
                      <div className="flex justify-end gap-1">
                        <Botao
                          aparencia="fantasma"
                          tamanho="icone"
                          aria-label="Editar"
                          disabled={!!l.usuarioId && l.usuarioId !== usuario?.id}
                          onClick={() => setEditando(l)}
                        >
                          <Pencil size={15} />
                        </Botao>
                        <Botao
                          aparencia="fantasma"
                          tamanho="icone"
                          aria-label="Excluir"
                          className="hover:text-sai"
                          disabled={!!l.usuarioId && l.usuarioId !== usuario?.id}
                          onClick={() => setExcluir(l)}
                        >
                          <Trash2 size={15} />
                        </Botao>
                      </div>
                    </Td>
                  </Linha>
                )
              })}
              <tr>
                <Td colSpan={4} className="text-[12px] font-semibold text-tinta-fraca">
                  Total {soDoMes ? `de ${nomeMes(mes)}` : 'cadastrado'}
                </Td>
                <Td
                  alinhar="direita"
                  className={cn('num text-[15px] font-bold', entra ? 'text-entra' : 'text-sai')}
                >
                  {dinheiro(total)}
                </Td>
                <Td />
              </tr>
            </tbody>
          </Tabela>
        )}
      </Caixa>

      {novo && (
        <Formulario
          aberto
          especie={especie}
          rotuloDia={rotuloDia}
          categorias={categorias}
          onFechar={() => setNovo(false)}
          onSalvar={onCriar}
        />
      )}

      {editando && (
        <Formulario
          aberto
          especie={especie}
          rotuloDia={rotuloDia}
          categorias={categorias}
          item={editando}
          onFechar={() => setEditando(null)}
          onSalvar={(r) => onAtualizar(editando.id, r)}
        />
      )}

      <Confirmacao
        aberto={!!excluir}
        onFechar={() => setExcluir(null)}
        onConfirmar={() => excluir && onRemover(excluir.id)}
        titulo="Excluir lançamento?"
        mensagem={`“${excluir?.descricao ?? ''}” deixa de contar em todos os meses.`}
      />
    </>
  )
}

function Formulario({
  aberto,
  especie,
  rotuloDia,
  categorias,
  item,
  onFechar,
  onSalvar,
}: {
  aberto: boolean
  especie: 'ganho' | 'fixo'
  rotuloDia: string
  categorias: readonly string[]
  item?: Lancamento
  onFechar: () => void
  onSalvar: (r: Record<string, unknown>) => void
}) {
  const { dados, mes } = useDados()
  const entra = especie === 'ganho'

  /* Editar mostra o valor que vale no mês aberto, não o de quando cadastrou. */
  const valorVigente = item ? valorNoMes(item, mes) : 0
  const [desdeQuando, setDesdeQuando] = useState<MesRef>(mes)
  const [corrigirTudo, setCorrigirTudo] = useState(false)

  const [r, setR] = useState<Rascunho>(
    item
      ? { ...item, valor: valorVigente, dia: diaDe(item) }
      : {
          descricao: '',
          valor: 0,
          categoria: entra ? 'Salário' : 'Moradia',
          recorrencia: 'unica' as Recorrencia,
          mesInicio: mes,
          dia: entra ? 5 : 10,
        },
  )

  const valido = r.descricao.trim().length > 1 && r.valor > 0

  /* Valor por dia trabalhado: o campo passa a ser a diária, e a dica mostra
     quanto isso dá no mês aberto — que é a pergunta que a pessoa realmente faz. */
  const porDia = entra && !!(r as { porDiaUtil?: boolean }).porDiaUtil
  const diasNoMes = useMemo(
    () => (porDia ? diasTrabalhaveisNoMes(mes, dados.config) : 0),
    [porDia, mes, dados.config],
  )

  /* Mudar o valor de um lançamento mensal já existente é aumento, não correção. */
  const mudouValor = !!item && item.recorrencia === 'mensal' && r.valor !== valorVigente

  /**
   * Um aumento entra como ajuste e o valor de cadastro fica intacto — assim os
   * meses anteriores continuam com o valor que realmente valia neles. Só a
   * correção explícita reescreve tudo, e aí o histórico some de propósito.
   */
  const historico = (): { valor: number; ajustes?: Ajuste[] } => {
    if (!item) return { valor: r.valor }
    if (!mudouValor) return { valor: item.valor, ajustes: item.ajustes }
    if (corrigirTudo) return { valor: r.valor, ajustes: undefined }
    const outros = (item.ajustes ?? []).filter((a) => a.mes !== desdeQuando)
    return { valor: item.valor, ajustes: [...outros, { mes: desdeQuando, valor: r.valor }] }
  }

  const salvar = () => {
    if (!valido) return
    const { dia, valor: _valor, ajustes: _ajustes, ...resto } = r
    // Férias é conceito de ganho: num gasto fixo o campo nem existe.
    onSalvar({
      ...resto,
      ...historico(),
      descricao: r.descricao.trim(),
      mesFim: r.recorrencia === 'mensal' ? r.mesFim || undefined : undefined,
      [entra ? 'diaRecebimento' : 'diaVencimento']: dia,
    })
    onFechar()
  }

  const mesesOpcao = sequenciaMeses(somaMes(mes, -24), 61)

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={item ? 'Editar lançamento' : entra ? 'Novo ganho' : 'Novo gasto'}
      descricao={
        entra
          ? 'Marque “todo mês” para o salário — cadastra uma vez e vale sempre — e “uma vez” para bônus e 13º.'
          : 'O que não passa no cartão. “Todo mês” para aluguel, luz e escola; “uma vez” para um gasto avulso.'
      }
      largura={600}
      rodape={
        <>
          <Botao aparencia="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao aparencia="primaria" disabled={!valido} onClick={salvar}>
            Salvar
          </Botao>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Descrição" className="sm:col-span-2">
          <Entrada
            autoFocus
            value={r.descricao}
            placeholder={entra ? 'Salário Sysfer' : 'Aluguel'}
            onChange={(e) => setR({ ...r, descricao: e.target.value })}
          />
        </Campo>


        <Campo
          rotulo={porDia ? 'Valor por dia' : 'Valor'}
          dica={
            porDia
              ? `${dinheiro(r.valor * diasNoMes)} em ${rotuloMes(mes)} · ${diasNoMes} dias`
              : item && item.recorrencia === 'mensal'
                ? `O que vale em ${rotuloMes(mes)}`
                : undefined
          }
        >
          <EntradaValor valor={r.valor} onValor={(v) => setR({ ...r, valor: v })} />
        </Campo>

        <Campo rotulo="Categoria">
          <Selecao value={r.categoria} onChange={(e) => setR({ ...r, categoria: e.target.value })}>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Selecao>
        </Campo>

        <Campo rotulo={rotuloDia} dica="Só informativo, para saber a ordem dentro do mês.">
          <Selecao value={r.dia ?? ''} onChange={(e) => setR({ ...r, dia: Number(e.target.value) })}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                dia {d}
              </option>
            ))}
          </Selecao>
        </Campo>

        <Campo rotulo="Recorrência">
          <Selecao
            value={r.recorrencia}
            onChange={(e) => setR({ ...r, recorrencia: e.target.value as Recorrencia })}
          >
            <option value="mensal">Fixo (todo mês)</option>
            <option value="unica">Avulso (só neste mês)</option>
          </Selecao>
        </Campo>

        {/* Só em ganho mensal: é o vale-refeição e parentes, creditados por dia
            trabalhado. Num gasto fixo ou num bônus de uma vez não faz sentido. */}
        {entra && r.recorrencia === 'mensal' && (
          <div className="sm:col-span-2">
            <Interruptor
              ligado={porDia}
              onMudar={(v) => setR({ ...r, porDiaUtil: v } as Rascunho)}
              rotulo={
                <span>
                  O valor é por dia trabalhado
                  <span className="block text-[11.5px] text-tinta-fraca">
                    Vale-refeição e afins: o mês vira o valor vezes os dias que você trabalha, sem
                    contar feriado nem férias. Os dias saem de Ajustes → Trabalho e feriados.
                  </span>
                </span>
              }
            />
          </div>
        )}

        <Campo rotulo={r.recorrencia === 'mensal' ? 'A partir de' : 'Mês'}>
          <Selecao value={r.mesInicio} onChange={(e) => setR({ ...r, mesInicio: e.target.value })}>
            {mesesOpcao.map((m) => (
              <option key={m} value={m}>
                {rotuloMes(m)}
              </option>
            ))}
          </Selecao>
        </Campo>

        {/* Férias só existem em salário mensal: não faz sentido marcar férias
            num bônus de uma vez nem num vale que é creditado por dia. */}
        {entra && r.recorrencia === 'mensal' && r.categoria === 'Salário' && (
          <BlocoFerias
            valorMes={r.valor}
            ferias={(r as { ferias?: Ferias[] }).ferias ?? []}
            mesBase={mes}
            onMudar={(fs) => setR({ ...r, ferias: fs } as Rascunho)}
          />
        )}

        {mudouValor && (
          <div className="space-y-3 rounded-cartao border border-marca/35 bg-marca/6 p-3.5 sm:col-span-2">
            <p className="text-[12.5px] leading-relaxed">
              De <span className="num font-semibold">{dinheiro(valorVigente)}</span> para{' '}
              <span className="num font-semibold">{dinheiro(r.valor)}</span>. Os meses
              anteriores continuam com o valor antigo.
            </p>

            {!corrigirTudo && (
              <Campo rotulo="Passa a valer a partir de">
                <Selecao value={desdeQuando} onChange={(e) => setDesdeQuando(e.target.value)}>
                  {mesesOpcao
                    .filter((m) => difMeses(r.mesInicio, m) >= 0)
                    .map((m) => (
                      <option key={m} value={m}>
                        {rotuloMes(m)}
                      </option>
                    ))}
                </Selecao>
              </Campo>
            )}

            <Interruptor
              ligado={corrigirTudo}
              onMudar={setCorrigirTudo}
              rotulo="Era erro de digitação — corrigir em todos os meses"
            />
          </div>
        )}

        {!!item?.ajustes?.length && !mudouValor && (
          <p className="text-[11.5px] leading-relaxed text-tinta-tenue sm:col-span-2">
            Reajustes já registrados:{' '}
            {[...item.ajustes]
              .sort((a, b) => difMeses(b.mes, a.mes))
              .map((a) => `${rotuloMes(a.mes)} ${dinheiro(a.valor)}`)
              .join(' · ')}
            . Antes do primeiro, vale o cadastro de {dinheiro(item.valor)}.
          </p>
        )}

        {r.recorrencia === 'mensal' && (
          <Campo rotulo="Até" dica="Deixe em aberto se não tem data de fim." className="sm:col-span-2">
            <Selecao
              value={r.mesFim ?? ''}
              onChange={(e) => setR({ ...r, mesFim: e.target.value || undefined })}
            >
              <option value="">Sem data de fim</option>
              {mesesOpcao
                .filter((m) => difMeses(r.mesInicio, m) >= 0)
                .map((m) => (
                  <option key={m} value={m}>
                    {rotuloMes(m)}
                  </option>
                ))}
            </Selecao>
          </Campo>
        )}
      </div>
    </Modal>
  )
}


/* --------------------------------- férias --------------------------------- */

/**
 * Marca os períodos de férias direto no salário.
 *
 * A conta aparece aqui, e não escondida no cálculo, porque é dinheiro que entra
 * num mês e sai no seguinte: ver "+R$ 2.666,67 em Jan" e "−R$ 2.000,00 em Fev"
 * lado a lado é o que evita gastar em fevereiro o que já foi recebido em
 * janeiro. Os limites são os da CLT — 30 dias por período, e no máximo um terço
 * deles vendido (art. 143).
 */
function BlocoFerias({
  valorMes,
  ferias,
  mesBase,
  onMudar,
}: {
  valorMes: number
  ferias: Ferias[]
  mesBase: MesRef
  onMudar: (f: Ferias[]) => void
}) {
  const meses = sequenciaMeses(somaMes(mesBase, -6), 31)

  const trocar = (id: string, mudanca: Partial<Ferias>) =>
    onMudar(ferias.map((f) => (f.id === id ? { ...f, ...mudanca } : f)))

  const adicionar = () =>
    onMudar([
      ...ferias,
      {
        id: `fer-${Date.now().toString(36)}`,
        mes: somaMes(mesBase, 1),
        dias: 30,
        diasVendidos: 0,
      },
    ])

  return (
    <div className="space-y-3 rounded-cartao border border-linha bg-elevado/40 p-3.5 sm:col-span-2">
      <div className="flex items-center gap-2">
        <Palmtree size={15} className="text-info" />
        <span className="text-[13px] font-semibold">Férias</span>
        <Botao
          aparencia="convite"
          tamanho="sm"
          icone={<Plus size={13} />}
          className="ml-auto"
          onClick={adicionar}
        >
          Adicionar período
        </Botao>
      </div>

      {ferias.length === 0 ? (
        <p className="text-[11.5px] leading-relaxed text-tinta-fraca">
          Marque o mês das férias e o app já faz a conta: o adiantamento e o terço entram naquele
          mês, o desconto dos dias pagos cai no mês seguinte, e o vale-refeição encolhe na
          proporção dos dias parados.
        </p>
      ) : (
        ferias.map((f) => {
          const porDia = valorMes / 30
          const adiantamento = porDia * f.dias
          const abono = porDia * f.diasVendidos
          const terco = (porDia * (f.dias + f.diasVendidos)) / 3
          const maxVendidos = Math.floor(f.dias / 3)
          return (
            <div key={f.id} className="space-y-2.5 rounded-controle border border-linha-suave p-3">
              <div className="grid gap-2.5 sm:grid-cols-3">
                <Campo rotulo="Mês das férias">
                  <Selecao value={f.mes} onChange={(e) => trocar(f.id, { mes: e.target.value })}>
                    {meses.map((m) => (
                      <option key={m} value={m}>
                        {rotuloMes(m)}
                      </option>
                    ))}
                  </Selecao>
                </Campo>
                <Campo rotulo="Dias de descanso">
                  <Selecao
                    value={f.dias}
                    onChange={(e) => {
                      const dias = Number(e.target.value)
                      trocar(f.id, {
                        dias,
                        diasVendidos: Math.min(f.diasVendidos, Math.floor(dias / 3)),
                      })
                    }}
                  >
                    {[5, 10, 15, 20, 25, 30].map((d) => (
                      <option key={d} value={d}>
                        {d} dias
                      </option>
                    ))}
                  </Selecao>
                </Campo>
                <Campo rotulo="Dias vendidos" dica="No máximo um terço.">
                  <Selecao
                    value={f.diasVendidos}
                    onChange={(e) => trocar(f.id, { diasVendidos: Number(e.target.value) })}
                  >
                    {Array.from({ length: maxVendidos + 1 }, (_, i) => i).map((d) => (
                      <option key={d} value={d}>
                        {d === 0 ? 'nenhum' : `${d} dias`}
                      </option>
                    ))}
                  </Selecao>
                </Campo>
              </div>

              <div className="space-y-1 border-t border-linha-suave pt-2.5 text-[11.5px]">
                <Conta rotulo={`Férias (${f.dias} dias)`} valor={adiantamento} />
                {f.diasVendidos > 0 && (
                  <Conta rotulo={`Abono (${f.diasVendidos} dias)`} valor={abono} />
                )}
                <Conta rotulo="Um terço constitucional" valor={terco} />
                <Conta
                  rotulo={`Entra a mais em ${rotuloMes(f.mes)}`}
                  valor={adiantamento + abono + terco}
                  forte
                />
                <Conta
                  rotulo={`Sai em ${rotuloMes(somaMes(f.mes, 1))}`}
                  valor={-adiantamento}
                  forte
                />
              </div>

              <Botao
                aparencia="perigo"
                tamanho="sm"
                icone={<Trash2 size={13} />}
                onClick={() => onMudar(ferias.filter((x) => x.id !== f.id))}
              >
                Remover período
              </Botao>
            </div>
          )
        })
      )}
    </div>
  )
}

function Conta({ rotulo, valor, forte }: { rotulo: string; valor: number; forte?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className={forte ? 'font-semibold text-tinta' : 'text-tinta-fraca'}>{rotulo}</span>
      <span
        className={cn(
          'num',
          forte ? 'font-bold' : 'text-tinta-fraca',
          valor < 0 ? 'text-sai' : forte ? 'text-entra' : '',
        )}
      >
        {dinheiro(valor)}
      </span>
    </div>
  )
}
