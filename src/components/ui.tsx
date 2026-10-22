import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import * as Dialogo from '@radix-ui/react-dialog'
import {
  forwardRef,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { ChevronDown, Loader2, X } from 'lucide-react'
import { dinheiro, iniciais, lerValor } from '@/lib/formato'

export const cn = (...c: ClassValue[]) => twMerge(clsx(c))

/* ------------------------------- superfícies ------------------------------ */

export function Caixa({
  className,
  children,
  ...resto
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-cartao border border-linha bg-superficie',
        'shadow-[var(--sombra-cartao)]',
        className,
      )}
      {...resto}
    >
      {children}
    </div>
  )
}

export function Secao({
  titulo,
  descricao,
  acao,
  children,
  className,
  semPainel,
}: {
  titulo?: ReactNode
  descricao?: ReactNode
  acao?: ReactNode
  children: ReactNode
  className?: string
  semPainel?: boolean
}) {
  const corpo = (
    <>
      {(titulo || acao) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div className="min-w-0">
            {titulo && <h2 className="text-[15px] font-semibold tracking-tight">{titulo}</h2>}
            {descricao && <p className="mt-0.5 text-xs text-tinta-fraca">{descricao}</p>}
          </div>
          {acao && <div className="flex shrink-0 items-center gap-2">{acao}</div>}
        </header>
      )}
      <div className={cn(titulo || acao ? 'border-t border-linha-suave' : '')}>{children}</div>
    </>
  )
  if (semPainel) return <section className={className}>{corpo}</section>
  return <Caixa className={cn("overflow-hidden", className)}>{corpo}</Caixa>
}

/* --------------------------------- botões -------------------------------- */

type Aparencia = 'primaria' | 'neutra' | 'fantasma' | 'perigo' | 'contorno' | 'convite' | 'alerta'

/**
 * A aparência diz o QUE o botão faz, não a cor dele.
 *
 * Amarrar cor ao significado é o que garante que dois botões que desfazem
 * coisa apareçam iguais em telas diferentes — e que trocar a paleta um dia
 * seja mexer aqui, não em trinta lugares.
 *
 *   primaria  confirma, conclui, salva  → verde
 *   perigo    sai, cancela, exclui      → vermelho
 *   convite   convida, compartilha,
 *             envia codigo, busca       → azul
 *   alerta    troca senha               → laranja
 */
const APARENCIAS: Record<Aparencia, string> = {
  primaria: 'bg-marca-solida text-[#06231a] font-semibold',
  neutra: 'bg-elevado text-tinta border border-linha',
  contorno: 'border border-linha text-tinta-fraca hover:text-tinta',
  fantasma: 'text-tinta-fraca hover:bg-elevado hover:text-tinta',
  perigo: 'bg-sai/12 text-sai border border-sai/30',
  convite: 'bg-info/12 text-info border border-info/30',
  alerta: 'bg-alerta/12 text-alerta border border-alerta/30',
}

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  aparencia?: Aparencia
  tamanho?: 'sm' | 'md' | 'lg' | 'icone'
  icone?: ReactNode
  carregando?: boolean
}

export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(function Botao(
  { aparencia = 'neutra', tamanho = 'md', icone, className, children, carregando = false, disabled, ...resto },
  ref,
) {
  const tamanhos = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-9.5 px-3.5 text-[13px] gap-2',
    lg: 'h-11 px-5 text-sm gap-2',
    icone: 'size-9.5 justify-center',
  }
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-controle whitespace-nowrap',
        'disabled:cursor-not-allowed disabled:opacity-45',
        tamanhos[tamanho],
        APARENCIAS[aparencia],
        className,
      )}
      disabled={disabled}
      aria-busy={carregando || undefined}
      {...resto}
    >
      {carregando ? <Loader2 size={16} className="animate-spin" /> : icone}
      {carregando ? <span className="sr-only">Carregando</span> : null}
      {children}
    </button>
  )
})

/* --------------------------------- campos -------------------------------- */

export function Campo({
  rotulo,
  dica,
  erro,
  children,
  className,
}: {
  rotulo?: ReactNode
  dica?: ReactNode
  erro?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      {rotulo && (
        <span className="text-[11px] font-semibold tracking-wide text-tinta-fraca uppercase">
          {rotulo}
        </span>
      )}
      {children}
      {erro ? (
        <span className="text-[11px] text-sai">{erro}</span>
      ) : (
        dica && <span className="text-[11px] text-tinta-tenue">{dica}</span>
      )}
    </label>
  )
}

const baseEntrada =
  'h-9.5 w-full rounded-controle border border-linha bg-afundado px-3 text-[13px] text-tinta ' +
  'placeholder:text-tinta-tenue focus:border-marca/60 focus:outline-none'

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Entrada({ className, ...resto }, ref) {
    return <input ref={ref} className={cn(baseEntrada, className)} {...resto} />
  },
)

export const AreaTexto = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function AreaTexto({ className, ...resto }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(baseEntrada, 'h-auto min-h-20 resize-y py-2 leading-relaxed', className)}
        {...resto}
      />
    )
  },
)

export const Selecao = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Selecao({ className, children, ...resto }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(baseEntrada, 'appearance-none pr-9 [&>option]:bg-superficie', className)}
          {...resto}
        >
          {children}
        </select>
        <ChevronDown
          size={15}
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-tinta-tenue"
        />
      </div>
    )
  },
)

/**
 * Campo de dinheiro. Mantém o que foi digitado enquanto o foco está nele — nada
 * pior que o campo reformatar no meio da digitação — e normaliza ao sair.
 */
export function EntradaValor({
  valor,
  onValor,
  className,
  autoFocus,
  placeholder = '0,00',
}: {
  valor: number
  onValor: (v: number) => void
  className?: string
  autoFocus?: boolean
  placeholder?: string
}) {
  const [texto, setTexto] = useState(() => (valor ? valor.toFixed(2).replace('.', ',') : ''))
  const [focado, setFocado] = useState(false)

  useEffect(() => {
    if (!focado) setTexto(valor ? valor.toFixed(2).replace('.', ',') : '')
  }, [valor, focado])

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[13px] text-tinta-tenue">
        R$
      </span>
      <input
        autoFocus={autoFocus}
        inputMode="decimal"
        className={cn(baseEntrada, 'num pl-9 text-right', className)}
        value={texto}
        placeholder={placeholder}
        onFocus={() => setFocado(true)}
        onChange={(e) => {
          setTexto(e.target.value)
          onValor(lerValor(e.target.value))
        }}
        onBlur={() => {
          setFocado(false)
          const v = lerValor(texto)
          onValor(v)
          setTexto(v ? v.toFixed(2).replace('.', ',') : '')
        }}
      />
    </div>
  )
}

/* -------------------------------- etiquetas ------------------------------- */

type Tom = 'neutro' | 'entra' | 'sai' | 'alerta' | 'info' | 'destaque'

const TONS: Record<Tom, string> = {
  neutro: 'bg-elevado text-tinta-fraca border-linha',
  entra: 'bg-entra/12 text-entra border-entra/25',
  sai: 'bg-sai/12 text-sai border-sai/25',
  alerta: 'bg-alerta/12 text-alerta border-alerta/25',
  info: 'bg-info/12 text-info border-info/25',
  destaque: 'bg-destaque/12 text-destaque border-destaque/25',
}

export function Etiqueta({
  tom = 'neutro',
  children,
  className,
  icone,
}: {
  tom?: Tom
  children: ReactNode
  className?: string
  icone?: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pilula border px-2 py-0.5',
        'text-[11px] font-semibold whitespace-nowrap',
        TONS[tom],
        className,
      )}
    >
      {icone}
      {children}
    </span>
  )
}

/* --------------------------------- barras -------------------------------- */

export function Barra({
  valor,
  cor,
  altura = 6,
  className,
}: {
  /** 0 a 100. */
  valor: number
  cor?: string
  altura?: number
  className?: string
}) {
  const pct = Math.max(0, Math.min(100, valor))
  return (
    <div
      className={cn('w-full overflow-hidden rounded-pilula bg-[var(--trilho)]', className)}
      style={{ height: altura }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-pilula transition-[width] duration-500"
        style={{ width: `${pct}%`, background: cor ?? 'var(--c-marca)' }}
      />
    </div>
  )
}

/* ------------------------------- indicadores ------------------------------ */

export function Metrica({
  rotulo,
  valor,
  detalhe,
  tom = 'neutro',
  icone,
  className,
}: {
  rotulo: ReactNode
  valor: ReactNode
  detalhe?: ReactNode
  tom?: Tom
  icone?: ReactNode
  className?: string
}) {
  const cores: Record<Tom, string> = {
    neutro: 'text-tinta',
    entra: 'text-entra',
    sai: 'text-sai',
    alerta: 'text-alerta',
    info: 'text-info',
    destaque: 'text-destaque',
  }
  return (
    <Caixa className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-semibold tracking-wide text-tinta-fraca uppercase">
          {rotulo}
        </span>
        {icone && <span className="text-tinta-tenue">{icone}</span>}
      </div>
      <div className={cn('num mt-2 text-2xl font-bold tracking-tight', cores[tom])}>{valor}</div>
      {detalhe && <div className="mt-1 text-xs text-tinta-fraca">{detalhe}</div>}
    </Caixa>
  )
}

export function Dinheiro({
  valor,
  colorido,
  className,
  sinal,
}: {
  valor: number
  /** Verde no positivo, coral no negativo. */
  colorido?: boolean
  className?: string
  sinal?: boolean
}) {
  const cor = !colorido ? '' : valor > 0 ? 'text-entra' : valor < 0 ? 'text-sai' : 'text-tinta-fraca'
  const prefixo = sinal && valor > 0 ? '+' : ''
  return <span className={cn('num', cor, className)}>{prefixo}{dinheiro(valor)}</span>
}

/* --------------------------------- pessoas ------------------------------- */

export function Avatar({
  nome,
  cor,
  tamanho = 28,
  className,
  foto,
}: {
  nome: string
  cor: string
  tamanho?: number
  className?: string
  /** Data URL da foto de perfil. Sem ela, ficam as iniciais. */
  foto?: string | null
}) {
  /* color-mix e não "cor + 22": a cor chega como var(--c-marca) na maioria das
     telas, e grudar dois dígitos no fim de um var() produz CSS inválido — o
     fundo some e sobra a inicial solta no ar. */
  const suave = (pct: number) => `color-mix(in srgb, ${cor} ${pct}%, transparent)`

  if (foto) {
    return (
      <img
        src={foto}
        alt={nome}
        title={nome}
        className={cn('shrink-0 rounded-pilula object-cover', className)}
        style={{ width: tamanho, height: tamanho, border: `1px solid ${suave(35)}` }}
      />
    )
  }
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-pilula font-bold', className)}
      title={nome}
      style={{
        width: tamanho,
        height: tamanho,
        fontSize: Math.round(tamanho * 0.38),
        background: suave(14),
        color: cor,
        border: `1px solid ${suave(35)}`,
      }}
    >
      {iniciais(nome)}
    </span>
  )
}

/* --------------------------------- vazio --------------------------------- */

export function Vazio({
  icone,
  titulo,
  descricao,
  acao,
}: {
  icone?: ReactNode
  titulo: string
  descricao?: string
  acao?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icone && <div className="mb-1 text-tinta-tenue">{icone}</div>}
      <p className="text-sm font-semibold">{titulo}</p>
      {descricao && <p className="max-w-sm text-xs text-tinta-fraca">{descricao}</p>}
      {acao && <div className="mt-3">{acao}</div>}
    </div>
  )
}

/* --------------------------------- modal --------------------------------- */

export function Modal({
  aberto,
  onFechar,
  titulo,
  descricao,
  children,
  rodape,
  largura = 560,
  semFechar,
}: {
  aberto: boolean
  onFechar: () => void
  titulo: ReactNode
  descricao?: ReactNode
  children: ReactNode
  rodape?: ReactNode
  largura?: number
  /** Esconde o X do canto — só faz sentido quando o rodapé já tem um
      "Cancelar": os dois juntos fariam a mesma coisa duas vezes. */
  semFechar?: boolean
}) {
  return (
    <Dialogo.Root open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <Dialogo.Portal>
        <Dialogo.Overlay className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]" />
        <Dialogo.Content
          className={cn(
            'surge fixed top-1/2 left-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-3rem)]',
            '-translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden',
            'rounded-cartao border border-linha bg-superficie shadow-[var(--sombra-flutuante)]',
          )}
          style={{ maxWidth: largura }}
        >
          <header className="flex items-start justify-between gap-4 border-b border-linha-suave px-5 py-4">
            <div className="min-w-0">
              <Dialogo.Title className="text-[15px] font-semibold tracking-tight">
                {titulo}
              </Dialogo.Title>
              {descricao && (
                <Dialogo.Description className="mt-0.5 text-xs text-tinta-fraca">
                  {descricao}
                </Dialogo.Description>
              )}
            </div>
            {!semFechar && (
              <Dialogo.Close asChild>
                <Botao aparencia="fantasma" tamanho="icone" aria-label="Fechar">
                  <X size={16} />
                </Botao>
              </Dialogo.Close>
            )}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {rodape && (
            <footer className="flex items-center justify-end gap-2 border-t border-linha-suave bg-elevado/50 px-5 py-3.5">
              {rodape}
            </footer>
          )}
        </Dialogo.Content>
      </Dialogo.Portal>
    </Dialogo.Root>
  )
}

export function Confirmacao({
  aberto,
  onFechar,
  onConfirmar,
  titulo,
  mensagem,
  rotuloConfirmar = 'Excluir',
  /* Vermelho por ser o caso comum (excluir), mas nem toda confirmação destrói:
     marcar faturas como pagas conclui, e o verde é a cor disso. */
  aparenciaConfirmar = 'perigo',
}: {
  aberto: boolean
  onFechar: () => void
  onConfirmar: () => void
  titulo: string
  mensagem: ReactNode
  rotuloConfirmar?: string
  aparenciaConfirmar?: Aparencia
}) {
  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={titulo}
      largura={440}
      rodape={
        <>
          <Botao aparencia="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao
            aparencia={aparenciaConfirmar}
            onClick={() => {
              onConfirmar()
              onFechar()
            }}
          >
            {rotuloConfirmar}
          </Botao>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-tinta-fraca">{mensagem}</p>
    </Modal>
  )
}

/* -------------------------------- tabelas -------------------------------- */

export function Tabela({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-[13px]', className)}>{children}</table>
    </div>
  )
}

export const Cabeca = ({ children }: { children: ReactNode }) => (
  <thead className="text-[11px] font-semibold tracking-wide text-tinta-tenue uppercase">
    {children}
  </thead>
)

export const Th = ({
  children,
  className,
  alinhar,
}: {
  children?: ReactNode
  className?: string
  alinhar?: 'direita' | 'centro'
}) => (
  <th
    className={cn(
      'border-b border-linha-suave px-4 py-2.5 font-semibold',
      alinhar === 'direita' ? 'text-right' : alinhar === 'centro' ? 'text-center' : 'text-left',
      className,
    )}
  >
    {children}
  </th>
)

export const Td = ({
  children,
  className,
  alinhar,
  colSpan,
}: {
  children?: ReactNode
  className?: string
  alinhar?: 'direita' | 'centro'
  colSpan?: number
}) => (
  <td
    colSpan={colSpan}
    className={cn(
      'border-b border-linha-suave px-4 py-2.5 align-middle',
      alinhar === 'direita' ? 'text-right' : alinhar === 'centro' ? 'text-center' : 'text-left',
      className,
    )}
  >
    {children}
  </td>
)

export const Linha = ({ children, className }: { children: ReactNode; className?: string }) => (
  <tr className={cn('hover:bg-elevado/60', className)}>{children}</tr>
)

/* ------------------------------ interruptor ------------------------------ */

export function Interruptor({
  ligado,
  onMudar,
  rotulo,
}: {
  ligado: boolean
  onMudar: (v: boolean) => void
  rotulo?: ReactNode
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-2.5">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={ligado}
        onClick={() => onMudar(!ligado)}
        className={cn(
          'relative h-5.5 w-10 shrink-0 rounded-pilula border transition-colors',
          ligado ? 'border-marca-solida/40 bg-marca-solida/85' : 'border-linha bg-[var(--trilho)]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4 rounded-pilula bg-white transition-[left] duration-200',
            ligado ? 'left-[1.15rem]' : 'left-0.5',
          )}
        />
      </button>
      {rotulo && (
        <label htmlFor={id} className="cursor-pointer text-[13px] text-tinta-fraca">
          {rotulo}
        </label>
      )}
    </div>
  )
}

/* ---------------------------- cabeçalho de tela --------------------------- */

export function CabecalhoTela({
  titulo,
  descricao,
  acoes,
}: {
  titulo: ReactNode
  descricao?: ReactNode
  acoes?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-bold tracking-tight">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-[13px] text-tinta-fraca">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  )
}
