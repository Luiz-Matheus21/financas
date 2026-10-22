import { useEffect, useState } from 'react'
import {
  Check,
  Download,
  FolderOpen,
  Info,
  Moon,
  PiggyBank,
  RefreshCw,
  Sun,
  Upload,
} from 'lucide-react'
import { useDados } from '@/lib/estado'
import { Trabalho } from '@/components/Trabalho'
import type { EstadoAtualizacao } from '../../electron/atualizador'
import type { EstadoSincronizacao } from '../../electron/sincronizacao'
import type { Dados } from '@/lib/types'
import { dinheiro } from '@/lib/formato'
import {
  Barra,
  Botao,
  CabecalhoTela,
  Caixa,
  Campo,
  Confirmacao,
  EntradaValor,
  Etiqueta,
  Interruptor,
} from '@/components/ui'

export function Ajustes() {
  const { dados, atualizarConfig, substituirTudo, tema, alternarTema } = useDados()
  const [caminho, setCaminho] = useState('')
  const [info, setInfo] = useState<{ versao: string; electron: string } | null>(null)
  const [importado, setImportado] = useState<Dados | null>(null)
  const [aviso, setAviso] = useState('')
  const [atz, setAtz] = useState<EstadoAtualizacao | null>(null)
  const [sinc, setSinc] = useState<EstadoSincronizacao | null>(null)

  useEffect(() => {
    void window.bolso.dados.caminho().then(setCaminho)
    void window.bolso.app.info().then(setInfo)
    void window.bolso.atualizacao.estado().then(setAtz)
    void window.bolso.sincronizacao.estado().then(setSinc)
    const pararSinc = window.bolso.sincronizacao.aoMudar(setSinc)
    const pararAtz = window.bolso.atualizacao.aoMudar(setAtz)
    return () => {
      pararSinc()
      pararAtz()
    }
  }, [])

  const exportar = async () => {
    const destino = await window.bolso.dados.exportar(dados)
    setAviso(destino ? `Backup salvo em ${destino}` : '')
  }

  const importar = async () => {
    const lidos = (await window.bolso.dados.importar()) as Dados | null
    if (lidos) setImportado(lidos)
  }

  const contagens = [
    ['cartões', dados.cartoes.length],
    ['compras', dados.compras.length],
    ['ganhos', dados.ganhos.length],
    ['gastos', dados.gastosFixos.length],
  ] as const

  return (
    <>
      <CabecalhoTela
        titulo="Ajustes"
        descricao="Tudo fica salvo num arquivo seu, nesta máquina. A cópia que sincroniza os seus computadores vai só para o seu repositório privado."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Trabalho />

        <Caixa className="overflow-hidden">
          <header className="px-5 pt-4 pb-3">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <PiggyBank size={15} className="text-marca" />
              Reserva mínima
            </h2>
            <p className="mt-0.5 text-xs text-tinta-fraca">
              Um valor que o painel desconta antes de dizer quanto dá para gastar. Serve para não
              zerar a conta.
            </p>
          </header>
          <div className="space-y-3 border-t border-linha-suave px-5 py-4">
            <Campo rotulo="Guardar todo mês">
              <EntradaValor
                valor={dados.config.reservaMinima ?? 0}
                onValor={(v) => atualizarConfig({ reservaMinima: v })}
              />
            </Campo>
            {(dados.config.reservaMinima ?? 0) > 0 && (
              <Etiqueta tom="info">
                O painel vai mostrar {dinheiro(dados.config.reservaMinima)} a menos como disponível.
              </Etiqueta>
            )}
          </div>
        </Caixa>

        <Caixa className="overflow-hidden">
          <header className="px-5 pt-4 pb-3">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              {tema === 'dark' ? (
                <Moon size={15} className="text-info" />
              ) : (
                <Sun size={15} className="text-alerta" />
              )}
              Aparência
            </h2>
            <p className="mt-0.5 text-xs text-tinta-fraca">
              O tema escolhido vale também para a barra de título da janela.
            </p>
          </header>
          <div className="border-t border-linha-suave px-5 py-4">
            <Interruptor
              ligado={tema === 'dark'}
              onMudar={() => alternarTema()}
              rotulo={tema === 'dark' ? 'Tema escuro' : 'Tema claro'}
            />
          </div>
        </Caixa>

        <Caixa className="overflow-hidden xl:col-span-2">
          <header className="px-5 pt-4 pb-3">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <Download size={15} className="text-destaque" />
              Backup dos dados
            </h2>
            <p className="mt-0.5 text-xs text-tinta-fraca">
              Exporte de vez em quando. É um arquivo JSON só seu — dá para levar para outro
              computador ou guardar na nuvem.
            </p>
          </header>
          <div className="space-y-4 border-t border-linha-suave px-5 py-4">
            <div className="flex flex-wrap gap-2">
              <Botao aparencia="primaria" icone={<Download size={15} />} onClick={exportar}>
                Exportar backup
              </Botao>
              <Botao icone={<Upload size={15} />} onClick={importar}>
                Importar backup
              </Botao>
              <Botao
                aparencia="contorno"
                icone={<FolderOpen size={15} />}
                onClick={() => window.bolso.dados.revelar()}
              >
                Abrir a pasta dos dados
              </Botao>
            </div>

            {aviso && <Etiqueta tom="entra">{aviso}</Etiqueta>}

            <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-linha-suave pt-3.5 text-[12px] text-tinta-fraca">
              {contagens.map(([rotulo, n]) => (
                <span key={rotulo}>
                  <span className="num font-semibold text-tinta">{n}</span> {rotulo}
                </span>
              ))}
            </div>

            {caminho && (
              <p className="font-mono text-[11px] break-all text-tinta-tenue">{caminho}</p>
            )}
          </div>
        </Caixa>

        <Caixa className="overflow-hidden xl:col-span-2">
          <header className="px-5 pt-4 pb-3">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <RefreshCw size={15} className="text-marca" />
              Atualização
            </h2>
            <p className="mt-0.5 text-xs text-tinta-fraca">
              A versão nova é baixada sozinha e instalada quando você reiniciar o app. Nada
              some: seus dados ficam fora da pasta do programa.
            </p>
          </header>
          <div className="space-y-3 border-t border-linha-suave px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[13px]">
                Instalada:{' '}
                <strong className="num">{info?.versao ?? '…'}</strong>
              </span>
              <TextoAtualizacao estado={atz} />
              <div className="ml-auto flex gap-2">
                {atz?.fase === 'pronta' ? (
                  <Botao
                    aparencia="primaria"
                    icone={<RefreshCw size={15} />}
                    onClick={() => void window.bolso.atualizacao.instalar()}
                  >
                    Reiniciar e instalar
                  </Botao>
                ) : (
                  <Botao
                    icone={<RefreshCw size={15} />}
                    disabled={atz?.fase === 'verificando' || atz?.fase === 'baixando'}
                    onClick={() => void window.bolso.atualizacao.verificar().then(setAtz)}
                  >
                    Procurar atualização
                  </Botao>
                )}
              </div>
            </div>

            {atz?.fase === 'baixando' && <Barra valor={atz.progresso ?? 0} cor="var(--c-marca)" />}

            {atz?.fase === 'erro' && (
              <p className="text-[11.5px] leading-relaxed text-sai">{atz.erro}</p>
            )}

            {atz?.fase === 'inativo' && (
              <p className="text-[11.5px] leading-relaxed text-tinta-tenue">
                Rodando em desenvolvimento — a atualização automática só vale no app instalado.
              </p>
            )}
          </div>
        </Caixa>

        <Caixa className="overflow-hidden xl:col-span-2">
          <header className="px-5 pt-4 pb-3">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <RefreshCw size={15} className="text-marca" />
              Sincronização entre dispositivos
            </h2>
            <p className="mt-0.5 text-xs text-tinta-fraca">
              Seus dados vão e voltam sozinhos entre os seus computadores ao abrir e ao
              fechar o app. Tudo continua salvo aqui também: sem internet você usa normal, e
              a sincronização acontece na próxima vez que houver conexão.
            </p>
          </header>
          <div className="space-y-3 border-t border-linha-suave px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <TextoSincronizacao estado={sinc} />
              {sinc?.ultima && (
                <span className="text-[12px] text-tinta-fraca">
                  última: {new Date(sinc.ultima).toLocaleString('pt-BR')}
                </span>
              )}
              <div className="ml-auto">
                <Botao
                  aparencia="convite"
                  icone={<RefreshCw size={15} />}
                  disabled={sinc?.fase === 'sincronizando'}
                  onClick={() => void window.bolso.sincronizacao.agora().then(setSinc)}
                >
                  Sincronizar agora
                </Botao>
              </div>
            </div>

            {sinc?.detalhe && (
              <p
                className={`text-[11.5px] leading-relaxed ${
                  sinc.fase === 'conflito' ? 'text-sai' : 'text-tinta-tenue'
                }`}
              >
                {sinc.detalhe}
              </p>
            )}
          </div>
        </Caixa>

        <Caixa className="flex items-start gap-3 p-5 xl:col-span-2">
          <Info size={16} className="mt-0.5 shrink-0 text-tinta-tenue" />
          <div className="text-[12px] leading-relaxed text-tinta-fraca">
            <p>
              <strong className="text-tinta">Finanças {info?.versao ?? ''}</strong> — controle
              financeiro de casa, rodando só na sua máquina. O reconhecimento de prints usa
              Tesseract offline; nenhuma imagem é enviada para a internet.
            </p>
            {info && (
              <p className="mt-1 text-tinta-tenue">Electron {info.electron}</p>
            )}
          </div>
        </Caixa>
      </div>

      <Confirmacao
        aberto={!!importado}
        onFechar={() => setImportado(null)}
        onConfirmar={() => importado && substituirTudo(importado)}
        titulo="Substituir todos os dados?"
        rotuloConfirmar="Substituir"
        mensagem={
          importado
            ? `O backup traz ${importado.cartoes.length} cartões e ${importado.compras.length} compras. Isso apaga o que está aqui hoje e coloca o conteúdo do arquivo no lugar.`
            : ''
        }
      />
    </>
  )
}

/** Uma frase só, dizendo em que pé está a atualização. */
function TextoSincronizacao({ estado }: { estado: EstadoSincronizacao | null }) {
  if (!estado) return null
  if (estado.fase === 'sincronizando') return <Etiqueta tom="neutro">Sincronizando…</Etiqueta>
  if (estado.fase === 'em-dia')
    return (
      <Etiqueta tom="entra" icone={<Check size={12} />}>
        Em dia
      </Etiqueta>
    )
  // Sem internet não é erro: o app funciona igual, só não conversou com a
  // outra máquina ainda. Por isso tom de aviso, e não de falha.
  if (estado.fase === 'sem-rede') return <Etiqueta tom="info">Sem internet</Etiqueta>
  // Também não é falha: os dados de fora já estão aplicados, só a subida ficou
  // pendente — e ela é retentada sozinha na próxima sincronização.
  if (estado.fase === 'envio-pendente') return <Etiqueta tom="info">Falta enviar</Etiqueta>
  if (estado.fase === 'conflito') return <Etiqueta tom="sai">Houve conflito</Etiqueta>
  return <Etiqueta tom="neutro">Ainda não sincronizou</Etiqueta>
}

function TextoAtualizacao({ estado }: { estado: EstadoAtualizacao | null }) {
  if (!estado) return null
  if (estado.fase === 'verificando') return <Etiqueta tom="neutro">Procurando…</Etiqueta>
  if (estado.fase === 'em-dia')
    return (
      <Etiqueta tom="entra" icone={<Check size={12} />}>
        Já está na última
      </Etiqueta>
    )
  if (estado.fase === 'baixando')
    return <Etiqueta tom="info">Baixando {estado.versaoNova}</Etiqueta>
  if (estado.fase === 'pronta')
    return <Etiqueta tom="entra">{estado.versaoNova} pronta para instalar</Etiqueta>
  if (estado.fase === 'erro') return <Etiqueta tom="sai">Não deu para verificar</Etiqueta>
  return null
}
