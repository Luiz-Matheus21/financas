import { useMemo, useState } from 'react'
import { CreditCard, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCartoesFiltrados, useDados, useNomesEmFoco } from '@/lib/estado'
import {
  BANCOS,
  BANDEIRAS,
  MarcaBanco,
  MarcaBandeira,
  bancoPorId,
  bandeiraUsual,
} from '@/lib/bancos'
import { todasAsParcelas, usoDoLimite } from '@/lib/finance'
import type { Bandeira, Cartao } from '@/lib/types'
import { dinheiro, porcento } from '@/lib/formato'
import {
  Avatar,
  Barra,
  Botao,
  CabecalhoTela,
  Caixa,
  Campo,
  Confirmacao,
  Entrada,
  EntradaValor,
  Etiqueta,
  Interruptor,
  Modal,
  Selecao,
  Vazio,
  cn,
} from '@/components/ui'

export function Cartoes() {
  const { dados, cartoes, mes } = useDados()
  const daPessoa = useCartoesFiltrados()
  const nomesEmFoco = useNomesEmFoco()
  const [novo, setNovo] = useState(false)
  const [editando, setEditando] = useState<Cartao | null>(null)
  const [excluir, setExcluir] = useState<Cartao | null>(null)

  const parcelas = useMemo(() => todasAsParcelas(dados), [dados])

  const usos = useMemo(
    () =>
      daPessoa
        .map((c) => usoDoLimite(dados, c, mes, parcelas))
        .sort((a, b) => Number(b.cartao.ativo) - Number(a.cartao.ativo) || b.usado - a.usado),
    [dados, daPessoa, mes, parcelas],
  )

  const totais = useMemo(
    () =>
      usos
        .filter((u) => u.cartao.ativo)
        .reduce(
          (acc, u) => ({
            limite: acc.limite + u.limite,
            usado: acc.usado + u.usado,
            disponivel: acc.disponivel + u.disponivel,
          }),
          { limite: 0, usado: 0, disponivel: 0 },
        ),
    [usos],
  )

  return (
    <>
      <CabecalhoTela
        titulo="Cartões"
        descricao={
          usos.length > 0
            ? `${dinheiro(totais.disponivel)} livres de ${dinheiro(totais.limite)} em limite`
            : 'Cadastre os cartões com limite, fechamento e vencimento.'
        }
        acoes={
          <Botao aparencia="primaria" icone={<Plus size={15} />} onClick={() => setNovo(true)}>
            Novo cartão
          </Botao>
        }
      />

      {usos.length === 0 ? (
        <Caixa>
          <Vazio
            icone={<CreditCard size={30} />}
            titulo={
              dados.cartoes.length === 0
                ? 'Nenhum cartão cadastrado'
                : `Nenhum cartão de ${nomesEmFoco}`
            }
            descricao={
              dados.cartoes.length === 0
                ? 'O dia de fechamento decide em qual fatura a compra cai; o de vencimento decide em qual mês o dinheiro sai.'
                : 'Os cartões das outras pessoas continuam lá — troque a visão na barra de cima ou cadastre um cartão para essa pessoa.'
            }
            acao={
              <Botao aparencia="primaria" icone={<Plus size={15} />} onClick={() => setNovo(true)}>
                Cadastrar cartão
              </Botao>
            }
          />
        </Caixa>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {usos.map((u) => (
            <CartaoVisual
              key={u.cartao.id}
              uso={u}
              onEditar={() => setEditando(u.cartao)}
              onExcluir={() => setExcluir(u.cartao)}
            />
          ))}
        </div>
      )}

      {novo && <FormularioCartao aberto onFechar={() => setNovo(false)} onSalvar={(c) => cartoes.criar(c)} />}
      {editando && (
        <FormularioCartao
          aberto
          cartao={editando}
          onFechar={() => setEditando(null)}
          onSalvar={(c) => cartoes.atualizar(editando.id, c)}
        />
      )}

      <Confirmacao
        aberto={!!excluir}
        onFechar={() => setExcluir(null)}
        onConfirmar={() => excluir && cartoes.remover(excluir.id)}
        titulo={`Excluir ${excluir?.apelido ?? ''}?`}
        mensagem="As compras lançadas nesse cartão não são apagadas: elas viram compras em dinheiro, caindo direto no mês de cada uma em vez de aparecer numa fatura."
      />
    </>
  )
}

function CartaoVisual({
  uso,
  onEditar,
  onExcluir,
}: {
  uso: ReturnType<typeof usoDoLimite>
  onEditar: () => void
  onExcluir: () => void
}) {
  const { dados } = useDados()
  const { cartao } = uso
  const banco = bancoPorId(cartao.bancoId)
  const apertado = uso.percentual >= 80
  const estourou = uso.disponivel < 0

  return (
    <Caixa className={cn('overflow-hidden', !cartao.ativo && 'opacity-55')}>
      {/* Faixa na cor da marca: identifica o cartão de longe. */}
      <div
        className="relative px-4 pt-4 pb-5"
        style={{
          background: `linear-gradient(135deg, ${banco.cor}, ${banco.cor}dd 55%, ${banco.cor}88)`,
          color: banco.tinta,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <MarcaBanco bancoId={cartao.bancoId} tamanho={38} />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-bold">{cartao.apelido}</div>
              <div className="text-[11px] opacity-80">{banco.nome}</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <MarcaBandeira bandeira={cartao.bandeira} tamanho={26} />
            {cartao.ultimosDigitos && (
              <span className="num text-[11px] tracking-widest opacity-85">
                •••• {cartao.ultimosDigitos}
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] tracking-wide uppercase opacity-75">Disponível</div>
            <div className="num text-xl font-bold">{dinheiro(uso.disponivel)}</div>
          </div>
          <div className="text-right text-[11px] opacity-85">
            <div>Fecha dia {cartao.diaFechamento}</div>
            <div>Vence dia {cartao.diaVencimento}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-tinta-fraca">
            <span>
              Usado <span className="num text-tinta">{dinheiro(uso.usado)}</span>
            </span>
            <span className="num">{porcento(uso.percentual)} de {dinheiro(uso.limite)}</span>
          </div>
          <Barra
            valor={uso.percentual}
            cor={estourou ? 'var(--c-sai)' : apertado ? 'var(--c-alerta)' : 'var(--c-marca)'}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {uso.parcelasAbertas > 0 && (
            <Etiqueta tom="neutro">{uso.parcelasAbertas} parcelas em aberto</Etiqueta>
          )}
          {estourou && <Etiqueta tom="sai">Limite estourado</Etiqueta>}
          {!estourou && apertado && <Etiqueta tom="alerta">Limite apertado</Etiqueta>}
          {!cartao.ativo && <Etiqueta tom="neutro">Inativo</Etiqueta>}

          <div className="ml-auto flex gap-1">
            <Botao aparencia="fantasma" tamanho="icone" aria-label="Editar" onClick={onEditar}>
              <Pencil size={15} />
            </Botao>
            <Botao
              aparencia="fantasma"
              tamanho="icone"
              aria-label="Excluir"
              className="hover:text-sai"
              onClick={onExcluir}
            >
              <Trash2 size={15} />
            </Botao>
          </div>
        </div>
      </div>
    </Caixa>
  )
}

type Rascunho = Omit<Cartao, 'id' | 'criadoEm'>

function FormularioCartao({
  aberto,
  cartao,
  onFechar,
  onSalvar,
}: {
  aberto: boolean
  cartao?: Cartao
  onFechar: () => void
  onSalvar: (c: Rascunho) => void
}) {
  const { dados } = useDados()
  /** Depois que a pessoa mexe na bandeira, trocar de banco não a sobrescreve. */
  const [bandeiraTocada, setBandeiraTocada] = useState(!!cartao)
  const [r, setR] = useState<Rascunho>(
    cartao
      ? { ...cartao }
      : {
          apelido: '',
          bancoId: 'nubank',
          bandeira: bandeiraUsual('nubank'),
          limite: 0,
          diaFechamento: 25,
          diaVencimento: 5,
          ultimosDigitos: '',
          ativo: true,
        },
  )

  const banco = bancoPorId(r.bancoId)
  const valido = r.apelido.trim().length > 1 && r.limite >= 0

  const salvar = () => {
    if (!valido) return
    onSalvar({ ...r, apelido: r.apelido.trim(), ultimosDigitos: r.ultimosDigitos?.trim() || undefined })
    onFechar()
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={cartao ? 'Editar cartão' : 'Novo cartão'}
      descricao="O fechamento decide em qual fatura a compra entra; o vencimento, em qual mês o dinheiro sai."
      largura={620}
      rodape={
        <>
          <Botao aparencia="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao aparencia="primaria" disabled={!valido} onClick={salvar}>
            Salvar cartão
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-cartao border border-linha bg-afundado p-3">
          <MarcaBanco bancoId={r.bancoId} tamanho={44} />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[14px] font-semibold">{r.apelido || 'Sem apelido'}</div>
            <div className="text-[11px] text-tinta-fraca">
              {banco.nome} · Fecha {r.diaFechamento} · Vence {r.diaVencimento}
            </div>
          </div>
          <div className="ml-auto" style={{ color: banco.cor }}>
            <MarcaBandeira bandeira={r.bandeira} tamanho={28} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Apelido" dica="Como você chama esse cartão no dia a dia.">
            <Entrada
              autoFocus
              value={r.apelido}
              placeholder="Nubank Matheus"
              onChange={(e) => setR({ ...r, apelido: e.target.value })}
            />
          </Campo>


          <Campo rotulo="Banco">
            <Selecao
              value={r.bancoId}
              onChange={(e) =>
                setR((atual) => ({
                  ...atual,
                  bancoId: e.target.value,
                  bandeira: bandeiraTocada ? atual.bandeira : bandeiraUsual(e.target.value),
                }))
              }
            >
              {BANCOS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
            </Selecao>
          </Campo>

          <Campo rotulo="Bandeira" dica="Vem do banco escolhido — confira no seu cartão.">
            <Selecao
              value={r.bandeira}
              onChange={(e) => {
                setBandeiraTocada(true)
                setR({ ...r, bandeira: e.target.value as Bandeira })
              }}
            >
              {BANDEIRAS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
            </Selecao>
          </Campo>

          <Campo rotulo="Limite total">
            <EntradaValor valor={r.limite} onValor={(v) => setR({ ...r, limite: v })} />
          </Campo>

          <Campo rotulo="Últimos 4 dígitos" dica="Opcional — ajuda o OCR a achar o cartão no print.">
            <Entrada
              value={r.ultimosDigitos ?? ''}
              inputMode="numeric"
              maxLength={4}
              placeholder="1234"
              className="num"
              onChange={(e) =>
                setR({ ...r, ultimosDigitos: e.target.value.replace(/\D/g, '').slice(0, 4) })
              }
            />
          </Campo>

          <Campo rotulo="Dia do fechamento">
            <Selecao
              value={r.diaFechamento}
              onChange={(e) => setR({ ...r, diaFechamento: Number(e.target.value) })}
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  dia {d}
                </option>
              ))}
            </Selecao>
          </Campo>

          <Campo rotulo="Dia do vencimento">
            <Selecao
              value={r.diaVencimento}
              onChange={(e) => setR({ ...r, diaVencimento: Number(e.target.value) })}
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  dia {d}
                </option>
              ))}
            </Selecao>
          </Campo>
        </div>

        <Etiqueta tom="info" className="whitespace-normal">
          Com fechamento {r.diaFechamento} e vencimento {r.diaVencimento}, uma compra feita depois do
          dia {r.diaFechamento} já cai na fatura do mês seguinte.
        </Etiqueta>

        <div className="border-t border-linha-suave pt-4">
          <Interruptor
            ligado={r.ativo}
            onMudar={(v) => setR({ ...r, ativo: v })}
            rotulo="Cartão ativo (aparece nas novas compras e no painel)"
          />
        </div>
      </div>
    </Modal>
  )
}
