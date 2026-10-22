import { useState } from 'react'
import { api, ErroApi } from '@/lib/api'
import { mensagemDeErro } from '@/lib/auth'
import { Botao, Campo, Entrada, Etiqueta, Modal } from '@/components/ui'

/** Excluir conta — mesma lógica de dois passos do trocar email, mas com o
    tom vermelho que a gravidade da ação pede. */
export function ModalExcluir({
  aberto,
  onFechar,
  onExcluida,
}: {
  aberto: boolean
  onFechar: () => void
  onExcluida: () => void
}) {
  const [etapa, setEtapa] = useState<'pedido' | 'codigo'>('pedido')
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
      await api.perfil.pedirExclusaoConta(senha)
      setSenha('')
      setEtapa('codigo')
      setAviso('Se a senha estiver correta, enviamos um código para o seu email.')
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
      await api.perfil.confirmarExclusaoConta(codigo)
      onExcluida()
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
      titulo={etapa === 'pedido' ? 'Excluir conta' : 'Confirme a exclusão'}
      descricao={
        etapa === 'pedido' ? 'A conta é removida após o código enviado por email.' : undefined
      }
      rodape={
        etapa === 'pedido' ? (
          <>
            <Botao aparencia="perigo" onClick={fechar} disabled={salvando}>
              Cancelar
            </Botao>
            <Botao aparencia="convite" disabled={!senha} carregando={salvando} onClick={() => void pedirCodigo()}>
              Enviar código
            </Botao>
          </>
        ) : (
          <>
            <Botao aparencia="perigo" onClick={() => setEtapa('pedido')} disabled={salvando}>
              Voltar
            </Botao>
            <Botao
              aparencia="convite"
              disabled={codigo.length < 6}
              carregando={salvando}
              onClick={() => void confirmar()}
            >
              Confirmar exclusão
            </Botao>
          </>
        )
      }
    >
      <div className="space-y-3">
        {erro && <Etiqueta tom="sai">{erro}</Etiqueta>}
        {etapa === 'pedido' ? (
          <Campo rotulo="Sua senha" erro={campos.senha}>
            <Entrada type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </Campo>
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
            <p className="text-[11px] text-sai">Essa ação não pode ser desfeita.</p>
          </>
        )}
      </div>
    </Modal>
  )
}
