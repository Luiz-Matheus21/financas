import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { api, ErroApi, ErroRede } from '../lib/api'
import { useAutenticacao, mensagemDeErro } from '../lib/auth'
import { Botao, Campo, Entrada } from '../components/ui'
import { aplicarTema, temaGuardado, type Tema } from '../lib/tema'

/**
 * Telas de entrada: login, cadastro, código e recuperação de senha.
 *
 * Ficam num arquivo só porque compartilham o mesmo cartão centralizado e
 * trocam de passo entre si o tempo todo — cadastrar leva ao código, esqueci
 * leva ao código, o código leva ao login. Separadas em quatro arquivos, essa
 * navegação viraria props atravessando quatro fronteiras sem ganho nenhum.
 */

type Passo = 'entrar' | 'cadastro' | 'codigo' | 'esqueci' | 'redefinir'

const SEXOS = [
  { valor: 'feminino', texto: 'Feminino' },
  { valor: 'masculino', texto: 'Masculino' },
  { valor: 'nao_informado', texto: 'Prefiro não informar' },
]

/* ------------------------------ peças comuns ----------------------------- */

/**
 * Escolha de tema na tela de login.
 *
 * Fica aqui porque é antes de existir conta: o tema da conta só chega depois
 * do login, e quem usa o app no escuro não deve ser recebido por uma tela
 * branca toda vez. A escolha feita aqui vale até a config da conta assumir.
 */
function SeletorTema() {
  const [tema, setTema] = useState<Tema>(temaGuardado)
  /* Um ícone que alterna, e não dois botões com os dois nomes: o mesmo controle
     do celular, e ocupa um canto em vez de uma faixa. O ícone mostra para onde
     se vai — sol quando está escuro — que é como todo app de mercado faz. */
  const trocar = () => {
    const proximo: Tema = tema === 'dark' ? 'light' : 'dark'
    setTema(proximo)
    aplicarTema(proximo)
  }
  return (
    <button
      type="button"
      onClick={trocar}
      title={tema === 'dark' ? 'Tema claro' : 'Tema escuro'}
      aria-label={tema === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      className="rounded-controle p-2 text-tinta-tenue transition-colors hover:bg-elevado hover:text-tinta"
    >
      {tema === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}

function Cartao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-[380px]">
        <div className="mb-3 flex justify-end">
          <SeletorTema />
        </div>
        <div className="mb-7 text-center">
          <div className="mb-1 text-[11px] font-bold tracking-[0.18em] text-marca uppercase">Finanças</div>
          <h1 className="text-lg font-semibold text-tinta">{titulo}</h1>
          {descricao && <p className="mt-1.5 text-[12.5px] leading-relaxed text-tinta-fraca">{descricao}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}

function Aviso({ texto, tipo = 'erro' }: { texto: string; tipo?: 'erro' | 'ok' }) {
  return (
    <div
      className={
        'rounded-controle px-3 py-2.5 text-[12px] leading-relaxed ' +
        (tipo === 'erro' ? 'bg-sai/10 text-sai' : 'bg-marca/10 text-marca')
      }
    >
      {texto}
    </div>
  )
}

/** Lista de regras da senha, acendendo conforme a pessoa digita. */
function RegrasSenha({ senha, regras }: { senha: string; regras: { id: string; texto: string }[] }) {
  // Mesma verificação do servidor. Repetida aqui de propósito: é retorno
  // imediato enquanto digita, e quem decide de verdade continua sendo a API.
  const testes: Record<string, (s: string) => boolean> = {
    tamanho: (s) => s.length >= 8,
    maiuscula: (s) => /[A-ZÀ-Þ]/.test(s),
    minuscula: (s) => /[a-zà-þ]/.test(s),
    numero: (s) => /\d/.test(s),
    especial: (s) => /[^\p{L}\p{N}\s]/u.test(s),
    'sem-espaco': (s) => !/\s/.test(s),
  }
  return (
    <ul className="flex flex-col gap-1">
      {regras.map((r) => {
        const ok = senha.length > 0 && (testes[r.id]?.(senha) ?? false)
        return (
          <li key={r.id} className={'flex items-center gap-1.5 text-[11.5px] ' + (ok ? 'text-marca' : 'text-tinta-tenue')}>
            <span className={'size-1.5 rounded-full ' + (ok ? 'bg-marca' : 'bg-linha')} />
            {r.texto}
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------- componente ------------------------------ */

export function Entrar() {
  const { entrar, online, verificarConexao } = useAutenticacao()
  const [passo, setPasso] = useState<Passo>('entrar')
  // Reenviar sem espera nenhuma convida a martelar o botão — o servidor já
  // limita a 5 por 15 min, mas a espera aqui é o que impede a pessoa de
  // achar que nada aconteceu e tentar de novo em cima do próprio pedido.
  const [reenvioBloqueado, setReenvioBloqueado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [campos, setCampos] = useState<Record<string, string>>({})

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [lembrar, setLembrar] = useState(true)

  const [nome, setNome] = useState('')
  const [sobrenome, setSobrenome] = useState('')
  const [sexo, setSexo] = useState('nao_informado')
  const [nascimento, setNascimento] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [codigo, setCodigo] = useState('')

  const [regras, setRegras] = useState<{ id: string; texto: string }[]>([])

  // Vem do servidor pra não haver duas listas de regras divergindo com o tempo.
  useEffect(() => {
    api
      .regrasSenha()
      .then((r) => setRegras(r.regras))
      .catch(() => setRegras([]))
  }, [])

  const limpar = () => {
    setErro('')
    setAviso('')
    setCampos({})
  }

  const irPara = (p: Passo) => {
    limpar()
    setPasso(p)
  }

  /** Todo submit passa por aqui: mesma trava, mesmo tratamento de erro.
   *  O evento é opcional porque o reenvio de código dispara isso num clique
   *  de botão avulso, sem formulário em volta pra prevenir o padrão. */
  const enviar = (fn: () => Promise<void>) => async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (ocupado) return
    limpar()
    setOcupado(true)
    try {
      await fn()
    } catch (err) {
      if (err instanceof ErroApi && err.campos) {
        const planos: Record<string, string> = {}
        for (const [k, v] of Object.entries(err.campos)) {
          planos[k] = typeof v === 'string' ? v : ((v as { mensagem?: string })?.mensagem ?? 'Inválido.')
        }
        setCampos(planos)
      }
      setErro(mensagemDeErro(err))
      if (err instanceof ErroRede) void verificarConexao()
    } finally {
      setOcupado(false)
    }
  }

  /* --------------------------------- login -------------------------------- */

  if (passo === 'entrar') {
    return (
      <Cartao titulo="Entrar na sua conta">
        <form className="flex flex-col gap-3.5" onSubmit={enviar(async () => entrar(email.trim(), senha, lembrar))}>
          {!online && (
            <Aviso texto="Sem conexão com o servidor. Você precisa de internet para entrar pela primeira vez." />
          )}
          {erro && <Aviso texto={erro} />}

          <Campo rotulo="Email" erro={campos.email}>
            <Entrada
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              disabled={ocupado}
            />
          </Campo>

          <Campo rotulo="Senha" erro={campos.senha}>
            <Entrada
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              disabled={ocupado}
            />
          </Campo>

          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-tinta-fraca">
            <input
              type="checkbox"
              checked={lembrar}
              onChange={(e) => setLembrar(e.target.checked)}
              className="size-3.5 accent-marca"
              disabled={ocupado}
            />
            Continuar conectado neste computador
          </label>

          <Botao
            type="submit"
            aparencia="primaria"
            tamanho="lg"
            carregando={ocupado}
            className="mt-1 justify-center"
          >
            {ocupado ? 'Entrando…' : 'Entrar'}
          </Botao>

          <div className="flex items-center justify-between pt-1 text-[12px]">
            <button type="button" className="text-tinta-fraca hover:text-tinta" onClick={() => irPara('esqueci')} disabled={ocupado}>
              Esqueci minha senha
            </button>
            <button type="button" className="font-medium text-marca hover:underline" onClick={() => irPara('cadastro')} disabled={ocupado}>
              Criar conta
            </button>
          </div>
        </form>
      </Cartao>
    )
  }

  /* -------------------------------- cadastro ------------------------------- */

  if (passo === 'cadastro') {
    return (
      <Cartao titulo="Criar sua conta" descricao="Você vai receber um código por email para ativar. Verifique também a pasta de spam.">
        <form
          className="flex flex-col gap-3.5"
          onSubmit={enviar(async () => {
            await api.registrar({
              nome: nome.trim(),
              sobrenome: sobrenome.trim(),
              email: email.trim(),
              senha,
              confirmacao,
              sexo,
              dataNascimento: nascimento,
            })
            setPasso('codigo')
            setAviso('Se este email estiver disponível, enviamos um código de 6 dígitos para ele.')
          })}
        >
          {erro && <Aviso texto={erro} />}

          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Nome" erro={campos.nome}>
              <Entrada autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
            </Campo>
            <Campo rotulo="Sobrenome" erro={campos.sobrenome}>
              <Entrada value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} />
            </Campo>
          </div>

          <Campo rotulo="Email" erro={campos.email}>
            <Entrada type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Nascimento" erro={campos.dataNascimento}>
              <Entrada type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} />
            </Campo>
            <Campo rotulo="Sexo">
              <select
                value={sexo}
                onChange={(e) => setSexo(e.target.value)}
                className="h-9.5 w-full rounded-controle border border-linha bg-afundado px-3 text-[13px] text-tinta focus:border-marca/60 focus:outline-none"
              >
                {SEXOS.map((s) => (
                  <option key={s.valor} value={s.valor}>
                    {s.texto}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <Campo rotulo="Senha" erro={campos.senha}>
            <Entrada type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </Campo>
          {regras.length > 0 && <RegrasSenha senha={senha} regras={regras} />}

          <Campo rotulo="Repita a senha" erro={campos.confirmacao}>
            <Entrada type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
          </Campo>

          <Botao type="submit" aparencia="primaria" tamanho="lg" disabled={ocupado} carregando={ocupado} className="mt-1 justify-center">
            {ocupado ? 'Criando…' : 'Criar conta'}
          </Botao>

          <button type="button" className="pt-1 text-[12px] text-tinta-fraca hover:text-tinta disabled:opacity-50 disabled:hover:text-tinta-fraca" onClick={() => irPara('entrar')} disabled={ocupado}>
            Já tenho conta
          </button>
        </form>
      </Cartao>
    )
  }

  /* --------------------------------- código -------------------------------- */

  if (passo === 'codigo') {
    return (
      <Cartao titulo="Confirme seu email" descricao={`Digite o código de 6 dígitos enviado para ${email}.`}>
        <form
          className="flex flex-col gap-3.5"
          onSubmit={enviar(async () => {
            await api.ativar(email.trim(), codigo.trim())
            setPasso('entrar')
            setAviso('Conta ativada. Agora é só entrar.')
            setCodigo('')
          })}
        >
          {aviso && <Aviso texto={aviso} tipo="ok" />}
          {erro && <Aviso texto={erro} />}

          <Campo rotulo="Código">
            <Entrada
              autoFocus
              inputMode="numeric"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              className="h-12 text-center text-xl tracking-[0.4em]"
              placeholder="000000"
            />
          </Campo>

          <p className="text-[11.5px] leading-relaxed text-tinta-tenue">
            O código vale por 5 minutos e só pode ser usado uma vez.
          </p>

          <Botao
            type="submit"
            aparencia="primaria"
            tamanho="lg"
            disabled={ocupado || codigo.length < 6}
            carregando={ocupado}
            className="justify-center"
          >
            {ocupado ? 'Confirmando…' : 'Ativar conta'}
          </Botao>

          <button
            type="button"
            className="pt-1 text-[12px] font-medium text-info hover:underline disabled:text-tinta-tenue disabled:no-underline"
            disabled={ocupado || reenvioBloqueado}
            onClick={() =>
              void enviar(async () => {
                await api.reenviarCodigo(email.trim())
                setReenvioBloqueado(true)
                setTimeout(() => setReenvioBloqueado(false), 30_000)
                setAviso('Reenviamos o código. Confira também a caixa de spam.')
              })()
            }
          >
            Não chegou? Reenviar código
          </button>

          <button type="button" className="pt-1 text-[12px] text-tinta-fraca hover:text-tinta disabled:opacity-50 disabled:hover:text-tinta-fraca" onClick={() => irPara('entrar')} disabled={ocupado}>
            Voltar
          </button>
        </form>
      </Cartao>
    )
  }

  /* ------------------------------ esqueci senha ---------------------------- */

  if (passo === 'esqueci') {
    return (
      <Cartao titulo="Recuperar senha" descricao="Informe o email da conta e enviaremos um código.">
        <form
          className="flex flex-col gap-3.5"
          onSubmit={enviar(async () => {
            await api.esqueciSenha(email.trim())
            setPasso('redefinir')
            setAviso('Se houver uma conta com este email, um código foi enviado.')
          })}
        >
          {erro && <Aviso texto={erro} />}

          <Campo rotulo="Email">
            <Entrada type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </Campo>

          <Botao type="submit" aparencia="primaria" tamanho="lg" disabled={ocupado} carregando={ocupado} className="justify-center">
            {ocupado ? 'Enviando…' : 'Enviar código'}
          </Botao>

          <button type="button" className="pt-1 text-[12px] text-tinta-fraca hover:text-tinta disabled:opacity-50 disabled:hover:text-tinta-fraca" onClick={() => irPara('entrar')} disabled={ocupado}>
            Voltar
          </button>
        </form>
      </Cartao>
    )
  }

  /* ------------------------------ nova senha ------------------------------- */

  return (
    <Cartao titulo="Cadastrar nova senha">
      <form
        className="flex flex-col gap-3.5"
        onSubmit={enviar(async () => {
          await api.redefinirSenha({ email: email.trim(), codigo: codigo.trim(), senha, confirmacao })
          setPasso('entrar')
          setAviso('Senha alterada. Entre com a senha nova.')
          setSenha('')
          setConfirmacao('')
          setCodigo('')
        })}
      >
        {aviso && <Aviso texto={aviso} tipo="ok" />}
        {erro && <Aviso texto={erro} />}

        <Campo rotulo="Código recebido">
          <Entrada
            autoFocus
            inputMode="numeric"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            className="h-11 text-center text-lg tracking-[0.35em]"
            placeholder="000000"
          />
        </Campo>

        <Campo rotulo="Nova senha" erro={campos.senha}>
          <Entrada type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campo>
        {regras.length > 0 && <RegrasSenha senha={senha} regras={regras} />}

        <Campo rotulo="Repita a nova senha" erro={campos.confirmacao}>
          <Entrada type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
        </Campo>

        <Botao type="submit" aparencia="primaria" tamanho="lg" disabled={ocupado} carregando={ocupado} className="justify-center">
          {ocupado ? 'Salvando…' : 'Salvar nova senha'}
        </Botao>

        <button type="button" className="pt-1 text-[12px] text-tinta-fraca hover:text-tinta disabled:opacity-50 disabled:hover:text-tinta-fraca" onClick={() => irPara('entrar')} disabled={ocupado}>
          Voltar
        </button>
      </form>
    </Cartao>
  )
}
