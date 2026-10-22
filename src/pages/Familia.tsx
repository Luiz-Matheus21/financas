import { useCallback, useEffect, useState } from 'react'
import { Copy, Crown, DoorOpen, Link2, Trash2, UserPlus, Users } from 'lucide-react'
import { api, ErroApi } from '@/lib/api'
import { useAutenticacao, mensagemDeErro } from '@/lib/auth'
import { useDados } from '@/lib/estado'
import { IndicarApp } from '@/components/IndicarApp'
import { Avatar, Botao, CabecalhoTela, Caixa, Campo, Entrada, Etiqueta, Vazio } from '@/components/ui'

interface Membro {
  id: string
  nome: string
  sobrenome: string
  identificador: string
  foto: string | null
  papel: 'criador' | 'membro'
}

interface Convite {
  id: string
  familia: string
  convidado_por: string
}

interface Pendente {
  id: string
  identificador: string
  nome: string
  sobrenome: string
}

interface Visao {
  familia: {
    id: string
    nome: string
    souCriador: boolean
    vagas: number
    membros: Membro[]
    convitesPendentes: Pendente[]
  } | null
  convites: Convite[]
}

export function FamiliaPage() {
  const { usuario } = useAutenticacao()
  const { recarregar } = useDados()
  const [v, setV] = useState<Visao | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [nome, setNome] = useState('')
  const [convidar, setConvidar] = useState('')
  const [link, setLink] = useState('')

  const carregar = useCallback(async () => {
    try {
      setV((await api.familia.ver()) as unknown as Visao)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const acao = (fn: () => Promise<void>) => async () => {
    setErro('')
    setAviso('')
    setOcupado(true)
    try {
      await fn()
      await carregar()
      // A família mudou: quem está na barra de filtro e os dados compartilhados
      // precisam acompanhar, senão a tela continua mostrando quem já saiu.
      await recarregar()
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : mensagemDeErro(e))
    } finally {
      setOcupado(false)
    }
  }

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      setAviso('Link copiado. É só colar no WhatsApp.')
    } catch {
      setErro('Não consegui copiar. Selecione o link e copie manualmente.')
    }
  }

  if (!v) {
    return (
      <>
        <CabecalhoTela titulo="Família" descricao="Junte os gastos e ganhos de quem mora com você." />
        {erro ? <Etiqueta tom="sai">{erro}</Etiqueta> : <p className="text-xs text-tinta-fraca">Carregando…</p>}
      </>
    )
  }

  /* ----------------------------- sem família ----------------------------- */

  if (!v.familia) {
    return (
      <>
        <CabecalhoTela
          titulo="Família"
          descricao="Cada pessoa lança o que é dela, e a família mostra a soma. No máximo 5 integrantes."
        />
        {aviso && <Etiqueta tom="entra">{aviso}</Etiqueta>}
        {erro && <Etiqueta tom="sai">{erro}</Etiqueta>}

        {v.convites.length > 0 && (
          <Caixa className="mt-4 overflow-hidden">
            <header className="px-5 pt-4 pb-3">
              <h2 className="text-[15px] font-semibold tracking-tight">Você foi convidado</h2>
            </header>
            <ul className="border-t border-linha-suave">
              {v.convites.map((c) => (
                <li key={c.id} className="flex items-center gap-3 border-b border-linha-suave px-5 py-3 last:border-0">
                  <Users size={16} className="text-marca" />
                  <div className="min-w-0 flex-1 text-[13px]">
                    <strong>{c.familia}</strong>
                    <div className="text-[11px] text-tinta-fraca">convite de {c.convidado_por}</div>
                  </div>
                  <Botao
                    aparencia="primaria"
                    tamanho="sm"
                    disabled={ocupado}
                    onClick={acao(async () => {
                      await api.familia.aceitar(c.id)
                    })}
                  >
                    Aceitar
                  </Botao>
                  <Botao
                    aparencia="perigo"
                    tamanho="sm"
                    disabled={ocupado}
                    onClick={acao(async () => {
                      await api.familia.recusar(c.id)
                    })}
                  >
                    Recusar
                  </Botao>
                </li>
              ))}
            </ul>
          </Caixa>
        )}

        <Caixa className="mt-4 overflow-hidden">
          <header className="px-5 pt-4 pb-3">
            <h2 className="text-[15px] font-semibold tracking-tight">Criar uma família</h2>
            <p className="mt-0.5 text-xs text-tinta-fraca">
              Você fica como dono e é quem pode convidar e desfazer.
            </p>
          </header>
          <div className="flex items-end gap-2 border-t border-linha-suave px-5 py-4">
            <Campo rotulo="Nome da família" className="flex-1">
              <Entrada value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Casa do Matheus" />
            </Campo>
            <Botao
              aparencia="primaria"
              disabled={ocupado || nome.trim().length < 2}
              onClick={acao(async () => {
                await api.familia.criar(nome.trim())
                setNome('')
              })}
            >
              Criar
            </Botao>
          </div>
        </Caixa>

        <div className="mt-4">
          <IndicarApp />
        </div>
      </>
    )
  }

  /* ----------------------------- com família ----------------------------- */

  const f = v.familia

  return (
    <>
      <CabecalhoTela
        titulo={f.nome}
        descricao={`${f.membros.length} de 5 integrantes. ${
          f.souCriador ? 'Você criou esta família.' : 'Você pode sair quando quiser.'
        }`}
      />
      {aviso && <Etiqueta tom="entra">{aviso}</Etiqueta>}
      {erro && <Etiqueta tom="sai">{erro}</Etiqueta>}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Caixa className="overflow-hidden">
          <header className="px-5 pt-4 pb-3">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <Users size={15} className="text-marca" />
              Integrantes
            </h2>
          </header>
          <ul className="border-t border-linha-suave">
            {f.membros.map((m) => (
              <li key={m.id} className="flex items-center gap-3 border-b border-linha-suave px-5 py-3 last:border-0">
                <Avatar nome={m.nome} foto={m.foto} cor="var(--c-marca)" tamanho={30} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                    {m.nome} {m.sobrenome}
                    {m.id === usuario?.id && <span className="text-[11px] text-tinta-tenue">(você)</span>}
                    {m.papel === 'criador' && <Crown size={12} className="text-destaque" />}
                  </div>
                  <div className="font-mono text-[11px] text-tinta-tenue">ID: {m.identificador}</div>
                </div>
              </li>
            ))}
          </ul>
        </Caixa>

        {f.souCriador && (
          <Caixa className="overflow-hidden">
            <header className="px-5 pt-4 pb-3">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                <UserPlus size={15} className="text-info" />
                Convidar
              </h2>
              <p className="mt-0.5 text-xs text-tinta-fraca">
                Pelo identificador de quem já tem conta, ou por um link que qualquer pessoa abre.
              </p>
            </header>
            <div className="space-y-4 border-t border-linha-suave px-5 py-4">
              {f.vagas <= 0 ? (
                <Etiqueta tom="alerta">A família já está cheia.</Etiqueta>
              ) : (
                <>
                  <div className="flex items-end gap-2">
                    <Campo rotulo="Identificador" className="flex-1">
                      <Entrada
                        value={convidar}
                        onChange={(e) => setConvidar(e.target.value.toLowerCase())}
                        placeholder="nome-00"
                        className="font-mono"
                      />
                    </Campo>
                    <Botao
                      aparencia="convite"
                      disabled={ocupado || convidar.trim().length < 4}
                      onClick={acao(async () => {
                        const r = await api.familia.convidar(convidar.trim())
                        setConvidar('')
                        setAviso(`Convite enviado para ${r.convite.nome}.`)
                      })}
                    >
                      Convidar
                    </Botao>
                  </div>

                  <div className="border-t border-linha-suave pt-3.5">
                    <Botao
                      aparencia="convite"
                      icone={<Link2 size={15} />}
                      disabled={ocupado}
                      onClick={acao(async () => {
                        const r = await api.familia.gerarLink()
                        setLink(r.mensagemPronta)
                      })}
                    >
                      Gerar link de convite
                    </Botao>
                    {link && (
                      <div className="mt-2.5 space-y-2">
                        <p className="rounded-controle bg-afundado p-2.5 text-[11.5px] break-all text-tinta-fraca">
                          {link}
                        </p>
                        <Botao
                          aparencia="primaria"
                          tamanho="sm"
                          icone={<Copy size={14} />}
                          onClick={() => void copiar(link)}
                        >
                          Copiar
                        </Botao>
                      </div>
                    )}
                  </div>
                </>
              )}

              {f.convitesPendentes.length > 0 && (
                <div className="border-t border-linha-suave pt-3.5">
                  <p className="mb-2 text-[11px] font-semibold tracking-wide text-tinta-fraca uppercase">
                    Convites em aberto
                  </p>
                  <ul className="space-y-1.5">
                    {f.convitesPendentes.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 text-[12.5px]">
                        <span className="min-w-0 flex-1 truncate">
                          {c.nome ? `${c.nome} ${c.sobrenome}` : c.identificador}
                        </span>
                        <Botao
                          aparencia="perigo"
                          tamanho="sm"
                          icone={<Trash2 size={13} />}
                          disabled={ocupado}
                          onClick={acao(async () => {
                            await api.familia.cancelarConvite(c.id)
                          })}
                        >
                          Cancelar
                        </Botao>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Caixa>
        )}

        <Caixa className="overflow-hidden xl:col-span-2">
          <header className="px-5 pt-4 pb-3">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <DoorOpen size={15} className="text-sai" />
              {f.souCriador ? 'Desfazer a família' : 'Sair da família'}
            </h2>
            <p className="mt-0.5 text-xs text-tinta-fraca">
              {f.souCriador
                ? 'A família deixa de existir para todo mundo. Ninguém perde os próprios dados — eles só param de ser somados juntos.'
                : 'Seus dados somem da visão da família na hora. Nada é apagado, e você pode entrar em outra depois.'}
            </p>
          </header>
          <div className="border-t border-linha-suave px-5 py-4">
            <Botao
              aparencia="perigo"
              disabled={ocupado}
              onClick={acao(async () => {
                if (f.souCriador) await api.familia.desfazer()
                else await api.familia.sair()
              })}
            >
              {f.souCriador ? 'Desfazer família' : 'Sair da família'}
            </Botao>
          </div>
        </Caixa>
      </div>

      {f.membros.length === 1 && (
        <Vazio
          titulo="Você ainda está sozinho aqui"
          descricao="Convide alguém pelo identificador ou mande o link — os números só se juntam quando a outra pessoa aceita."
        />
      )}

      <div className="mt-4">
        <IndicarApp />
      </div>
    </>
  )
}
