import { useState } from 'react'
import { api, ErroApi } from '@/lib/api'
import { mensagemDeErro } from '@/lib/auth'
import { Botao, Campo, Entrada, Etiqueta, Modal } from '@/components/ui'

/** Trocar senha não precisa de código: a senha atual já prova quem é a
    pessoa. O que acontece depois (derrubar a sessão) fica por conta de quem
    chama. */
export function ModalSenha({
  aberto,
  onFechar,
  onTrocada,
}: {
  aberto: boolean
  onFechar: () => void
  onTrocada: () => void
}) {
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const trocar = async () => {
    setSalvando(true)
    setCampos({})
    setErro('')
    try {
      await api.perfil.trocarSenha({ senhaAtual, senha, confirmacao })
      onTrocada()
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
      titulo="Trocar senha"
      descricao="As sessões abertas em outros computadores são encerradas."
      rodape={
        <>
          <Botao aparencia="perigo" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao
            aparencia="alerta"
            disabled={!senhaAtual || !senha}
            carregando={salvando}
            onClick={() => void trocar()}
          >
            Trocar senha
          </Botao>
        </>
      }
    >
      <div className="space-y-3">
        {erro && <Etiqueta tom="sai">{erro}</Etiqueta>}
        <Campo rotulo="Senha atual" erro={campos.senhaAtual}>
          <Entrada type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} />
        </Campo>
        <Campo rotulo="Nova senha" erro={campos.senha}>
          <Entrada type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campo>
        <Campo rotulo="Repita a nova senha" erro={campos.confirmacao}>
          <Entrada type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
        </Campo>
      </div>
    </Modal>
  )
}
