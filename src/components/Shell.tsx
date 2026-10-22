import { useMemo, type ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  Moon,
  Receipt,
  ScanText,
  Settings,
  Sun,
  TrendingDown,
  TrendingUp,
  Users,
  UserRound,
  Wallet,
  Check,
  CalendarClock,
} from 'lucide-react'
import { useDados } from '@/lib/estado'
import { useAutenticacao } from '@/lib/auth'
import { mesAtual, rotuloMes, somaMes, difMeses } from '@/lib/mes'
import { Avatar, Botao, cn } from './ui'

export type Tela =
  | 'painel'
  | 'cartoes'
  | 'compras'
  | 'faturas'
  | 'ganhos'
  | 'fixos'
  | 'perfil'
  | 'familia'
  | 'ajustes'

const NAVEGACAO: { tela: Tela; rotulo: string; icone: typeof Wallet; grupo: 1 | 2 | 3 }[] = [
  { tela: 'painel', rotulo: 'Painel', icone: LayoutDashboard, grupo: 1 },
  { tela: 'faturas', rotulo: 'Faturas', icone: Receipt, grupo: 1 },
  { tela: 'cartoes', rotulo: 'Cartões', icone: CreditCard, grupo: 2 },
  { tela: 'compras', rotulo: 'Compras', icone: Wallet, grupo: 2 },
  { tela: 'ganhos', rotulo: 'Ganhos', icone: TrendingUp, grupo: 3 },
  { tela: 'fixos', rotulo: 'Gastos', icone: TrendingDown, grupo: 3 },
  { tela: 'familia', rotulo: 'Família', icone: Users, grupo: 3 },
]

function Marca() {
  return (
    <div className="flex items-center gap-2.5 px-3">
      <span
        className="flex size-8 items-center justify-center rounded-[10px]"
        style={{ background: 'linear-gradient(145deg, var(--c-marca), #12a06a)' }}
      >
        <Wallet size={17} strokeWidth={2.4} color="#06231a" />
      </span>
      <div className="leading-tight">
        <div className="text-[15px] font-bold tracking-tight">Finanças</div>
        <div className="text-[10px] tracking-wide text-tinta-tenue uppercase">
          Controle financeiro
        </div>
      </div>
    </div>
  )
}

function BarraLateral({ tela, irPara }: { tela: Tela; irPara: (t: Tela) => void }) {
  const { tema, alternarTema, salvando, online, pendentes, erroSincronizacao } = useDados()

  return (
    <aside className="flex w-[228px] shrink-0 flex-col border-r border-linha bg-superficie">
      <div className="arrastar flex h-[44px] items-center pt-1">
        <Marca />
      </div>

      <nav className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {NAVEGACAO.map((item, i) => {
          const Icone = item.icone
          const ativo = tela === item.tela
          const abreGrupo = i > 0 && NAVEGACAO[i - 1]!.grupo !== item.grupo
          return (
            <div key={item.tela}>
              {abreGrupo && <div className="my-2 border-t border-linha-suave" />}
              <button
                onClick={() => irPara(item.tela)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-controle px-3 py-2 text-[13px]',
                  ativo
                    ? 'bg-marca/12 font-semibold text-marca'
                    : 'text-tinta-fraca hover:bg-elevado hover:text-tinta',
                )}
              >
                <Icone size={17} strokeWidth={ativo ? 2.3 : 1.9} />
                {item.rotulo}
              </button>
            </div>
          )
        })}
      </nav>

      <div className="border-t border-linha-suave p-2">
        <button
          onClick={() => irPara('perfil')}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-controle px-3 py-2 text-[13px]',
            tela === 'perfil'
              ? 'bg-marca/12 font-semibold text-marca'
              : 'text-tinta-fraca hover:bg-elevado hover:text-tinta',
          )}
        >
          <UserRound size={17} strokeWidth={1.9} />
          Meu perfil
        </button>
        <button
          onClick={() => irPara('ajustes')}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-controle px-3 py-2 text-[13px]',
            tela === 'ajustes'
              ? 'bg-marca/12 font-semibold text-marca'
              : 'text-tinta-fraca hover:bg-elevado hover:text-tinta',
          )}
        >
          <Settings size={17} strokeWidth={1.9} />
          Ajustes
        </button>
        <div className="mt-1 flex items-center justify-between px-3 py-1.5">
          <span className="flex items-center gap-1.5 text-[11px] text-tinta-tenue">
            {salvando ? (
              <>
                <span className="size-1.5 animate-pulse rounded-full bg-alerta" />
                {erroSincronizacao ? 'Falha ao sincronizar' : online ? `${pendentes} pendentes` : 'Offline · salvo no aparelho'}
              </>
            ) : (
              <>
                <Check size={12} />
                {online ? 'Tudo sincronizado' : 'Offline · salvo no aparelho'}
              </>
            )}
          </span>
          <button
            onClick={alternarTema}
            title={tema === 'dark' ? 'Tema claro' : 'Tema escuro'}
            className="rounded-controle p-1.5 text-tinta-tenue hover:bg-elevado hover:text-tinta"
          >
            {tema === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>
    </aside>
  )
}

function SeletorMes() {
  const { mes, setMes } = useDados()
  const distancia = difMeses(mesAtual(), mes)
  const legenda =
    distancia === 0
      ? 'Mês atual'
      : distancia === 1
        ? 'Próximo mês'
        : distancia === -1
          ? 'Mês passado'
          : distancia > 0
            ? `Em ${distancia} meses`
            : `${Math.abs(distancia)} meses atrás`

  return (
    <div className="flex items-center gap-1 rounded-controle border border-linha bg-superficie p-1">
      <button
        onClick={() => setMes(somaMes(mes, -1))}
        aria-label="Mês anterior"
        className="rounded-md p-1.5 text-tinta-fraca hover:bg-elevado hover:text-tinta"
      >
        <ChevronLeft size={16} />
      </button>
      <button
        onClick={() => setMes(mesAtual())}
        title="Voltar para o mês atual"
        className="min-w-[132px] px-1 text-center leading-tight"
      >
        <div className="text-[13px] font-semibold">{rotuloMes(mes)}</div>
        <div className="text-[10px] text-tinta-tenue">{legenda}</div>
      </button>
      <button
        onClick={() => setMes(somaMes(mes, 1))}
        aria-label="Próximo mês"
        className="rounded-md p-1.5 text-tinta-fraca hover:bg-elevado hover:text-tinta"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

/**
 * Diz de quem é a tela: a família, quando existe uma, ou o próprio nome.
 *
 * Antes aqui ficava a fileira "Nós dois · Leticia · Luiz", que misturava duas
 * coisas — dizer onde você está e escolher o que ver. Escolher o que ver desceu
 * para os filtros da própria tela, onde dá para marcar mais de uma pessoa; aqui
 * em cima sobrou só a informação, do lado do mês, que é o outro "onde estou".
 */
function EtiquetaContexto() {
  const { familia, membros } = useDados()
  const { usuario } = useAutenticacao()

  const eu = membros.find((m) => m.souEu)
  const nome = (eu?.nome ?? usuario?.nome ?? '').split(' ')[0]
  if (!familia && !nome) return null

  return (
    <span
      className="flex items-center gap-1.5 rounded-controle border border-linha bg-superficie px-2.5 py-1.5 text-[12px] font-semibold text-tinta"
      title={familia ? `Família ${familia.nome}` : 'Somente os seus lançamentos'}
    >
      {familia ? (
        <>
          <Users size={14} className="text-marca" />
          {familia.nome}
        </>
      ) : (
        <>
          <Avatar nome={nome} cor="var(--c-marca)" tamanho={18} />
          {nome}
        </>
      )}
    </span>
  )
}

export function Shell({
  tela,
  irPara,
  titulo,
  subtitulo,
  acoes,
  mostrarMes = true,
  children,
}: {
  tela: Tela
  irPara: (t: Tela) => void
  titulo: string
  subtitulo?: ReactNode
  acoes?: ReactNode
  mostrarMes?: boolean
  children: ReactNode
}) {
  const { dados } = useDados()
  const contagem = useMemo(() => ({ cartoes: dados.cartoes.length }), [dados.cartoes.length])

  return (
    <div className="flex h-full">
      <BarraLateral tela={tela} irPara={irPara} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="arrastar flex h-[44px] shrink-0 items-center gap-3 border-b border-linha bg-superficie/80 px-5 pr-[140px] backdrop-blur">
          <h1 className="truncate text-[13px] font-semibold tracking-tight">{titulo}</h1>
          {subtitulo && (
            <span className="truncate text-[12px] text-tinta-fraca">· {subtitulo}</span>
          )}
        </header>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-linha px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {mostrarMes && <SeletorMes />}
            <EtiquetaContexto />
          </div>
          <div className="flex items-center gap-2">{acoes}</div>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto p-5">
          {contagem.cartoes === 0 && (tela === 'compras' || tela === 'faturas') ? (
            <PrimeiroPasso
              titulo="Cadastre um cartão primeiro"
              texto="Com o limite, o dia de fechamento e o de vencimento, o app já distribui as parcelas nas faturas certas."
              rotulo="Cadastrar cartão"
              onIr={() => irPara('cartoes')}
              icone={<CreditCard size={26} />}
            />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  )
}

function PrimeiroPasso({
  titulo,
  texto,
  rotulo,
  onIr,
  icone,
}: {
  titulo: string
  texto: string
  rotulo: string
  onIr: () => void
  icone: ReactNode
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 pt-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-cartao bg-marca/12 text-marca">
        {icone}
      </span>
      <h2 className="text-base font-semibold">{titulo}</h2>
      <p className="text-[13px] leading-relaxed text-tinta-fraca">{texto}</p>
      <Botao aparencia="primaria" className="mt-2" onClick={onIr} icone={<CalendarClock size={15} />}>
        {rotulo}
      </Botao>
    </div>
  )
}
