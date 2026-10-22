import { useState } from 'react'
import { api, ErroApi } from '@/lib/api'
import { mensagemDeErro } from '@/lib/auth'
import { Botao, Campo, Entrada, Etiqueta, Modal } from '@/components/ui'

/**
 * Trocar email — pede o novo endereço e a senha, manda o código, e o próprio
 * modal vira a etapa de confirmação (igual ao passo de código do cadastro),
 * em vez de fechar no meio do caminho.
 */
export function ModalEmail({
  aberto,
  emailAtual,
  onFechar,
  onTrocado,
}: {
  aberto: boolean
  emailAtual: string
  onFechar: () => void
  onTrocado: (email: string) => void
}) {
  const [etapa, setEtapa] = useState<'pedido' | 'codigo'>('pedido')
  const [emailNovo, setEmailNovo] = useState('')
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [aviso, setAviso] = useState('')
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const tratarErro = (e: unknown) => {
    const planos: Record<string, string> = {}
    if (e instanceof ErroApi && e.campos) {
      for (const [k, v] of Object.entries(e.campos)) {
        planos[k] = typeof v === 'string' ? v : ((v as { mensagem?: string })?.mensagem ?? 'Inválido.')
      }
      setCampos(planos)
    }
    setErro(Object.keys(planos).length > 0 ? '' : mensagemDeErro(e))
  }

  const fechar = () => {
    setEtapa('pedido')
    setEmailNovo('')
    setSenha('')
    setCodigo('')
    setAviso('')
    setErro('')
    setCampos({})
    onFechar()
  }

  const pedirCodigo = async () => {
    setSalvando(true)
    setCampos({})
    setErro('')
    try {
      await api.perfil.pedirTrocaEmail(emailNovo.trim(), senha)
      setSenha('')
      setEtapa('codigo')
      setAviso('Se este email estiver disponível, enviamos um código de 6 dígitos para ele.')
    } catch (e) {
      tratarErro(e)
    } finally {
      setSalvando(false)
    }
  }

  const confirmar = async () => {
    setSalvando(true)
    setCampos({})
    setErro('')
    try {
      const r = await api.perfil.confirmarTrocaEmail(codigo)
      onTrocado(r.email)
    } catch (e) {
      tratarErro(e)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      semFechar
      aberto={aberto}
      onFechar={fechar}
      titulo={etapa === 'pedido' ? 'Trocar email' : 'Confirme o novo email'}
      descricao={etapa === 'pedido' ? `Hoje é ${emailAtual}. O código vai para o endereço novo.` : undefined}
      rodape={
        etapa === 'pedido' ? (
          <>
            <Botao aparencia="perigo" onClick={fechar} disabled={salvando}>
              Cancelar
            </Botao>
            <Botao
              aparencia="convite"
              disabled={!emailNovo || !senha}
              carregando={salvando}
              onClick={() => void pedirCodigo()}
            >
              Enviar código
            </Botao>
          </>
        ) : (
          <>
            <Botao aparencia="perigo" onClick={() => setEtapa('pedido')} disabled={salvando}>
              Voltar
            </Botao>
            <Botao aparencia="primaria" disabled={codigo.length < 6} carregando={salvando} onClick={() => void confirmar()}>
              Confirmar
            </Botao>
          </>
        )
      }
    >
      <div className="space-y-3">
        {erro && <Etiqueta tom="sai">{erro}</Etiqueta>}
        {etapa === 'pedido' ? (
          <>
            <Campo rotulo="Novo email" erro={campos.email}>
              <Entrada
                type="email"
                value={emailNovo}
                onChange={(e) => setEmailNovo(e.target.value)}
                placeholder="novo@email.com"
              />
            </Campo>
            <Campo rotulo="Sua senha" erro={campos.senha}>
              <Entrada type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
            </Campo>
          </>
        ) : (
          <>
            {aviso && <Etiqueta tom="entra">{aviso}</Etiqueta>}
            <Campo rotulo="Código recebido">
              <Entrada
                inputMode="numeric"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                className="text-center tracking-[0.3em]"
                placeholder="000000"
              />
            </Campo>
            <p className="text-[11px] text-tinta-tenue">O código vale por 5 minutos e só pode ser usado uma vez.</p>
          </>
        )}
      </div>
    </Modal>
  )
}
