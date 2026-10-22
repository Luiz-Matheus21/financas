import { useMemo, useState } from 'react'
import { useDados } from '@/lib/estado'
import { MarcaBanco } from '@/lib/bancos'
import { primeiraFaturaDe, valoresParcelas } from '@/lib/finance'
import { hojeIso, mesDaData, nomeMes, rotuloMes, sequenciaMeses, somaMes } from '@/lib/mes'
import { CATEGORIAS_GASTO, type Compra } from '@/lib/types'
import { dinheiro } from '@/lib/formato'
import {
  AreaTexto,
  Botao,
  Campo,
  Entrada,
  EntradaValor,
  Etiqueta,
  Modal,
  Selecao,
} from './ui'

export type RascunhoCompra = Omit<Compra, 'id' | 'criadoEm'>

export const rascunhoVazio = (cartaoId: string | null): RascunhoCompra => ({
  cartaoId,
  descricao: '',
  valorTotal: 0,
  parcelas: 1,
  dataCompra: hojeIso(),
  categoria: 'Outros',
})

/**
 * Formulário de compra usado tanto no cadastro manual quanto no que vem do OCR.
 * Mostra em qual fatura cada parcela vai cair antes de salvar — é o que evita
 * a surpresa de a compra aparecer num mês diferente do esperado.
 */
export function FormularioCompra({
  aberto,
  inicial,
  titulo = 'Nova compra',
  rotuloSalvar = 'Lançar compra',
  onFechar,
  onSalvar,
}: {
  aberto: boolean
  inicial: RascunhoCompra
  titulo?: string
  rotuloSalvar?: string
  onFechar: () => void
  onSalvar: (r: RascunhoCompra) => void
}) {
  const { dados } = useDados()
  const [r, setR] = useState<RascunhoCompra>(inicial)

  const disponiveis = dados.cartoes.filter((c) => c.ativo || c.id === r.cartaoId)
  const cartao = dados.cartoes.find((c) => c.id === r.cartaoId)

  const previsao = useMemo(() => {
    if (!r.valorTotal || !r.dataCompra) return null
    const compraFicticia = { ...r, id: 'previa', criadoEm: '' } as Compra
    const inicio = cartao
      ? primeiraFaturaDe(compraFicticia, cartao)
      : r.primeiraFatura || mesDaData(r.dataCompra)
    const valores = valoresParcelas(r.valorTotal, r.parcelas)
    return { inicio, valores, meses: sequenciaMeses(inicio, valores.length) }
  }, [cartao, r])

  const valido = r.valorTotal > 0 && r.parcelas >= 1 && !!r.dataCompra

  const salvar = () => {
    if (!valido) return
    onSalvar({
      ...r,
      descricao: r.descricao.trim() || 'Compra sem descrição',
      observacao: r.observacao?.trim() || undefined,
    })
    onFechar()
  }

  const parcelaValor = previsao?.valores[0] ?? 0

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={titulo}
      descricao="Informe o total e em quantas vezes — o app distribui as parcelas nas faturas."
      largura={640}
      rodape={
        <>
          <Botao aparencia="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao aparencia="primaria" disabled={!valido} onClick={salvar}>
            {rotuloSalvar}
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Descrição" className="sm:col-span-2">
            <Entrada
              autoFocus
              value={r.descricao}
              placeholder="Geladeira, mercado, Uber…"
              onChange={(e) => setR({ ...r, descricao: e.target.value })}
            />
          </Campo>

          <Campo rotulo="Cartão">
            <Selecao
              value={r.cartaoId ?? ''}
              onChange={(e) => setR({ ...r, cartaoId: e.target.value || null })}
            >
              <option value="">Dinheiro (sem cartão)</option>
              {disponiveis.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.apelido}
                </option>
              ))}
            </Selecao>
          </Campo>

          <Campo rotulo="Data da compra">
            <Entrada
              type="date"
              value={r.dataCompra}
              onChange={(e) => setR({ ...r, dataCompra: e.target.value })}
            />
          </Campo>

          <Campo rotulo="Valor total">
            <EntradaValor valor={r.valorTotal} onValor={(v) => setR({ ...r, valorTotal: v })} />
          </Campo>

          <Campo
            rotulo="Parcelas"
            dica={r.parcelas > 1 ? `${r.parcelas}x de ${dinheiro(parcelaValor)}` : 'À vista'}
          >
            <div className="flex items-center gap-2">
              <Selecao
                value={r.parcelas}
                onChange={(e) => setR({ ...r, parcelas: Number(e.target.value) })}
              >
                {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? 'À vista (1x)' : `${n}x`}
                  </option>
                ))}
              </Selecao>
            </div>
          </Campo>

          <Campo rotulo="Categoria">
            <Selecao value={r.categoria} onChange={(e) => setR({ ...r, categoria: e.target.value })}>
              {CATEGORIAS_GASTO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Selecao>
          </Campo>

          <Campo
            rotulo="Forçar 1ª fatura"
            dica="Só se o banco jogou a compra num mês diferente do calculado."
          >
            <Selecao
              value={r.primeiraFatura ?? ''}
              onChange={(e) => setR({ ...r, primeiraFatura: e.target.value || undefined })}
            >
              <option value="">Calcular pelo fechamento</option>
              {previsao &&
                sequenciaMeses(somaMes(previsao.inicio, -2), 6).map((m) => (
                  <option key={m} value={m}>
                    {rotuloMes(m)}
                  </option>
                ))}
            </Selecao>
          </Campo>

          <Campo rotulo="Observação" className="sm:col-span-2">
            <AreaTexto
              value={r.observacao ?? ''}
              placeholder="Opcional — número do pedido, quem pediu, o que combinaram…"
              onChange={(e) => setR({ ...r, observacao: e.target.value })}
            />
          </Campo>
        </div>

        {previsao && (
          <div className="rounded-cartao border border-linha bg-afundado p-3.5">
            <div className="mb-2.5 flex items-center gap-2">
              {cartao && <MarcaBanco bancoId={cartao.bancoId} tamanho={26} />}
              <span className="text-[12px] font-semibold">
                {r.parcelas === 1 ? 'Cai inteira na fatura de' : 'Como as parcelas caem'}{' '}
                {r.parcelas === 1 && nomeMes(previsao.inicio)}
              </span>
              {r.primeiraFatura && <Etiqueta tom="alerta">1ª fatura forçada</Etiqueta>}
            </div>

            {r.parcelas > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {previsao.meses.map((m, i) => (
                  <span
                    key={m}
                    className="rounded-controle border border-linha bg-superficie px-2 py-1 text-[11px]"
                  >
                    <span className="text-tinta-tenue">
                      {i + 1}/{previsao.valores.length}
                    </span>{' '}
                    <span className="font-semibold">{rotuloMes(m)}</span>{' '}
                    <span className="num text-tinta-fraca">{dinheiro(previsao.valores[i]!)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
