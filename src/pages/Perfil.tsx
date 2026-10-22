import { useEffect, useState } from 'react'
import { AtSign, KeyRound, LogOut, Trash2, UserRound } from 'lucide-react'
import { api } from '@/lib/api'
import { useAutenticacao, mensagemDeErro } from '@/lib/auth'
import { Avatar, Botao, CabecalhoTela, Caixa, Etiqueta } from '@/components/ui'
import { ModalDados } from '@/components/perfil/ModalDados'
import { ModalSenha } from '@/components/perfil/ModalSenha'
import { ModalEmail } from '@/components/perfil/ModalEmail'
import { ModalExcluir } from '@/components/perfil/ModalExcluir'

const ROTULOS_SEXO: Record<string, string> = {
  feminino: 'Feminino',
  masculino: 'Masculino',
  nao_informado: 'Prefiro não informar',
}

/** (21) 99999-8888 para exibição; o servidor guarda só os dígitos. */
const mascararTelefone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return '—'
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

interface Perfil {
  email: string
  nome: string
  sobrenome: string
  sexo: string
  telefone: string | null
  dataNascimento: string | null
  foto: string | null
}

function Bloco({
  titulo,
  icone,
  descricao,
  children,
}: {
  titulo: string
  icone: React.ReactNode
  descricao?: string
  children: React.ReactNode
}) {
  return (
    <Caixa className="overflow-hidden">
      <header className="px-5 pt-4 pb-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          {icone}
          {titulo}
        </h2>
        {descricao && <p className="mt-0.5 text-xs text-tinta-fraca">{descricao}</p>}
      </header>
      <div className="space-y-3 border-t border-linha-suave px-5 py-4">{children}</div>
    </Caixa>
  )
}

/** Uma linha rótulo/valor, só leitura — editar exige abrir "Alterar dados". */
function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold tracking-wide text-tinta-fraca uppercase">{rotulo}</div>
      <div className="text-[13px] text-tinta">{valor}</div>
    </div>
  )
}

export function PerfilPage() {
  const { usuario, sair } = useAutenticacao()
  const [p, setP] = useState<Perfil | null>(null)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const [modal, setModal] = useState<'dados' | 'senha' | 'email' | 'excluir' | null>(null)

  useEffect(() => {
    api
      .perfil.ver()
      .then((r) => setP(r as unknown as Perfil))
      .catch((e) => setErro(mensagemDeErro(e)))
  }, [])

  if (!p) {
    return (
      <>
        <CabecalhoTela titulo="Meu perfil" descricao="Seus dados de conta." />
        {erro ? <Etiqueta tom="sai">{erro}</Etiqueta> : <p className="text-xs text-tinta-fraca">Carregando…</p>}
      </>
    )
  }

  return (
    <>
      <CabecalhoTela
        titulo="Meu perfil"
        descricao={`ID: ${usuario?.identificador ?? ''} — é esse identificador que alguém usa para te convidar para uma família.`}
      />

      {aviso && <Etiqueta tom="entra">{aviso}</Etiqueta>}
      {erro && <Etiqueta tom="sai">{erro}</Etiqueta>}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Bloco titulo="Seus dados" icone={<UserRound size={15} className="text-marca" />}>
          {/* Só leitura: a foto e o resto dos campos mudam pelo mesmo lugar,
              "Alterar dados" — sem exceção pra ela ficar editável a qualquer
              hora enquanto o resto exige abrir o modal primeiro. */}
          <div className="flex justify-center py-1">
            <Avatar nome={p.nome} foto={p.foto} cor="var(--c-marca)" tamanho={96} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Linha rotulo="Nome" valor={`${p.nome} ${p.sobrenome}`} />
            <Linha rotulo="Telefone" valor={mascararTelefone(p.telefone ?? '')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Linha rotulo="Nascimento" valor={p.dataNascimento ?? '—'} />
            <Linha rotulo="Sexo" valor={ROTULOS_SEXO[p.sexo] ?? 'Prefiro não informar'} />
          </div>

          <Botao aparencia="primaria" onClick={() => setModal('dados')}>
            Alterar dados
          </Botao>
        </Bloco>

        <Bloco
          titulo="Senha"
          icone={<KeyRound size={15} className="text-alerta" />}
          descricao="Trocar a senha encerra as sessões abertas em outros computadores."
        >
          <Botao aparencia="alerta" onClick={() => setModal('senha')}>
            Trocar senha
          </Botao>
        </Bloco>

        <Bloco titulo="Email" icone={<AtSign size={15} className="text-info" />} descricao={`Hoje é ${p.email}.`}>
          <Botao aparencia="convite" onClick={() => setModal('email')}>
            Trocar email
          </Botao>
        </Bloco>

        <Bloco
          titulo="Excluir conta"
          icone={<Trash2 size={15} className="text-sai" />}
          descricao="A conta é removida após o código enviado por email — essa ação não pode ser desfeita."
        >
          <Botao aparencia="perigo" onClick={() => setModal('excluir')}>
            Excluir conta
          </Botao>
        </Bloco>

        <Bloco titulo="Sessão" icone={<LogOut size={15} className="text-sai" />}>
          <p className="text-[12.5px] text-tinta-fraca">
            Sair desconecta só este computador. Seus dados continuam no servidor.
          </p>
          <Botao aparencia="perigo" icone={<LogOut size={15} />} onClick={() => void sair()}>
            Sair da conta
          </Botao>
        </Bloco>
      </div>

      <ModalDados
        aberto={modal === 'dados'}
        dados={p}
        onFechar={() => setModal(null)}
        onFotoAtualizada={(foto) => setP({ ...p, foto })}
        onSalvo={(novo) => {
          setP({ ...p, ...novo })
          setModal(null)
          setAviso('Perfil atualizado.')
        }}
      />

      <ModalSenha
        aberto={modal === 'senha'}
        onFechar={() => setModal(null)}
        onTrocada={() => {
          setModal(null)
          setAviso('Senha alterada. Entre de novo com a senha nova.')
          // A troca derruba todas as sessões, inclusive esta — sair aqui evita
          // a tela ficar batendo em 401 até perceber sozinha.
          setTimeout(() => void sair(), 1800)
        }}
      />

      <ModalEmail
        aberto={modal === 'email'}
        emailAtual={p.email}
        onFechar={() => setModal(null)}
        onTrocado={(email) => {
          setP({ ...p, email })
          setModal(null)
          setAviso('Email alterado.')
        }}
      />

      <ModalExcluir
        aberto={modal === 'excluir'}
        onFechar={() => setModal(null)}
        onExcluida={() => {
          setModal(null)
          setAviso('Conta excluída.')
          setTimeout(() => void sair(), 700)
        }}
      />
    </>
  )
}
