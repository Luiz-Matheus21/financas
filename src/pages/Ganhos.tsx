import { useDados } from '@/lib/estado'
import { CATEGORIAS_GANHO, type Ganho } from '@/lib/types'
import { ListaLancamentos } from '@/components/Lancamentos'

export function Ganhos() {
  const { compartilhados: dados, ganhos } = useDados()
  return (
    <ListaLancamentos
      especie="ganho"
      titulo="Ganhos"
      descricao="Salário, bônus, freela, aluguel — tudo que entra. É a base do “quanto posso gastar”."
      categorias={CATEGORIAS_GANHO}
      itens={dados.ganhos}
      onCriar={(r) => ganhos.criar(r as Omit<Ganho, 'id' | 'criadoEm'>)}
      onAtualizar={(id, r) => ganhos.atualizar(id, r as Partial<Ganho>)}
      onRemover={ganhos.remover}
    />
  )
}
