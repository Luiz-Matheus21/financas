import { useState } from 'react'
import { Check } from 'lucide-react'
import { api, ErroApi } from '@/lib/api'
import { mensagemDeErro } from '@/lib/auth'
import { Botao, Campo, Entrada, Etiqueta, Modal, Selecao } from '@/components/ui'
import { EscolherFoto } from '@/components/EscolherFoto'

const SEXOS = [
  { valor: 'feminino', texto: 'Feminino' },
  { valor: 'masculino', texto: 'Masculino' },
  { valor: 'nao_informado', texto: 'Prefiro não informar' },
]

/** (21) 99999-8888 enquanto digita; o servidor guarda só os dígitos. */
const mascararTelefone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

interface Dados {
  nome: string
  sobrenome: string
  sexo: string
  telefone: string | null
  dataNascimento: string | null
  foto: string | null
}

/**
 * Editar dados, sexo e foto — tudo atrás do botão "Alterar dados".
 *
 * A foto morava solta na tela principal, editável a qualquer momento — só
 * que o resto dos campos passou a exigir "Editar" antes, e uma exceção só
 * pra foto quebrava a regra que o próprio modal existe pra impor.
 */
export function ModalDados({
  aberto,
  dados,
  onFechar,
  onSalvo,
  onFotoAtualizada,
}: {
  aberto: boolean
  dados: Dados
  onFechar: () => void
  onSalvo: (d: Dados) => void
  /** A foto sobe pro servidor na hora — diferente do resto, que só vale ao
      clicar em "Salvar". Sem isso, fechar sem salvar deixaria a tela
      principal com a foto velha mesmo já tendo trocado de verdade. */
  onFotoAtualizada: (foto: string | null) => void
}) {
  const [p, setP] = useState<Dados>(dados)
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    setSalvando(true)
    setCampos({})
    setErro('')
    try {
      await api.perfil.salvar({
        nome: p.nome,
        sobrenome: p.sobrenome,
        sexo: p.sexo,
        telefone: p.telefone ?? '',
        dataNascimento: p.dataNascimento,
      })
      onSalvo(p)
    } catch (e) {
      const planos: Record<string, string> = {}
      if (e instanceof ErroApi && e.campos) {
        for (const [k, v] of Object.entries(e.campos)) {
          planos[k] = typeof v === 'string' ? v : ((v as { mensagem?: string })?.mensagem ?? 'Inválido.')
        }
        setCampos(planos)
      }
      setErro(Object.keys(planos).length > 0 ? '' : mensagemDeErro(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      semFechar
      aberto={aberto}
      onFechar={onFechar}
      titulo="Alterar dados"
      rodape={
        <>
          <Botao aparencia="perigo" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao aparencia="convite" icone={<Check size={15} />} carregando={salvando} onClick={() => void salvar()}>
            Salvar
          </Botao>
        </>
      }
    >
      <div className="space-y-3">
        {erro && <Etiqueta tom="sai">{erro}</Etiqueta>}
        <EscolherFoto
          nome={p.nome}
          foto={p.foto}
          onTrocar={async (dataUrl) => {
            const r = await api.perfil.trocarFoto(dataUrl)
            setP((p) => ({ ...p, foto: r.foto }))
            onFotoAtualizada(r.foto)
          }}
          onRemover={async () => {
            try {
              await api.perfil.removerFoto()
              setP((p) => ({ ...p, foto: null }))
              onFotoAtualizada(null)
            } catch (e) {
              setErro(mensagemDeErro(e))
            }
          }}
        />
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Nome" erro={campos.nome}>
            <Entrada value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} />
          </Campo>
          <Campo rotulo="Sobrenome" erro={campos.sobrenome}>
            <Entrada value={p.sobrenome} onChange={(e) => setP({ ...p, sobrenome: e.target.value })} />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Telefone" erro={campos.telefone}>
            <Entrada
              value={mascararTelefone(p.telefone ?? '')}
              onChange={(e) => setP({ ...p, telefone: e.target.value.replace(/\D/g, '') })}
              placeholder="(21) 99999-8888"
            />
          </Campo>
          <Campo rotulo="Nascimento" erro={campos.dataNascimento}>
            <Entrada
              type="date"
              value={p.dataNascimento ?? ''}
              onChange={(e) => setP({ ...p, dataNascimento: e.target.value })}
            />
          </Campo>
        </div>
        <Campo rotulo="Sexo">
          <Selecao value={p.sexo ?? 'nao_informado'} onChange={(e) => setP({ ...p, sexo: e.target.value })}>
            {SEXOS.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.texto}
              </option>
            ))}
          </Selecao>
        </Campo>
      </div>
    </Modal>
  )
}
