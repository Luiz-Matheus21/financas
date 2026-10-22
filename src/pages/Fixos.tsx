import { useDados } from '@/lib/estado'
import { CATEGORIAS_GASTO, type GastoFixo } from '@/lib/types'
import { ListaLancamentos } from '@/components/Lancamentos'

export function Fixos() {
  const { compartilhados: dados, gastosFixos } = useDados()
  return (
    <ListaLancamentos
      especie="fixo"
      titulo="Gastos"
      descricao="O que sai fora do cartão: as contas de todo mês, como aluguel e luz, e também os gastos avulsos."
      categorias={CATEGORIAS_GASTO}
      itens={dados.gastosFixos}
      onCriar={(r) => gastosFixos.criar(r as Omit<GastoFixo, 'id' | 'criadoEm'>)}
      onAtualizar={(id, r) => gastosFixos.atualizar(id, r as Partial<GastoFixo>)}
      onRemover={gastosFixos.remover}
    />
  )
}
