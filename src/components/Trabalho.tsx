import { useMemo } from 'react'
import { Briefcase, CalendarDays } from 'lucide-react'
import { useDados } from '@/lib/estado'
import { CIDADES, UFS, feriadosDoMes } from '@/lib/feriados'
import { diasTrabalhaveisNoMes } from '@/lib/finance'
import { dataBr, rotuloMes } from '@/lib/mes'
import type { Jornada } from '@/lib/types'
import { Caixa, Campo, Entrada, Etiqueta, Interruptor, Selecao, cn } from '@/components/ui'

/**
 * Onde a pessoa mora e como ela trabalha.
 *
 * Parece configuração de enfeite, mas é o que faz o vale-refeição fechar com o
 * extrato: quem recebe por dia trabalhado não recebe em feriado, e feriado
 * depende do estado e até da cidade. Sem isso o app erraria todo mês que tem
 * feriado — justamente o mês em que a pessoa se programa esperando o valor de
 * sempre.
 *
 * O resultado aparece na hora, em dias e em feriados do mês aberto, porque uma
 * configuração que não mostra efeito nenhum é uma configuração que ninguém
 * confere.
 */

const SEMANA = [
  { id: 1, curto: 'Seg' },
  { id: 2, curto: 'Ter' },
  { id: 3, curto: 'Qua' },
  { id: 4, curto: 'Qui' },
  { id: 5, curto: 'Sex' },
  { id: 6, curto: 'Sáb' },
  { id: 0, curto: 'Dom' },
]

const PADRAO: Jornada = { tipo: 'semana', diasSemana: [1, 2, 3, 4, 5], folgaEmFeriado: true }

/** Escalas que existem de verdade por aí, para não obrigar a digitar números. */
const ESCALAS = [
  { rotulo: '12x36 (dia sim, dia não)', trabalha: 1, folga: 1 },
  { rotulo: '5x2 (cinco dias, dois de folga)', trabalha: 5, folga: 2 },
  { rotulo: '6x1 (seis dias, um de folga)', trabalha: 6, folga: 1 },
  { rotulo: '4x2 (quatro dias, dois de folga)', trabalha: 4, folga: 2 },
  { rotulo: '5x1 (cinco dias, um de folga)', trabalha: 5, folga: 1 },
]

export function Trabalho() {
  const { dados, mes, atualizarConfig } = useDados()
  const config = dados.config
  const jornada = config.jornada ?? PADRAO

  const trocar = (mudanca: Partial<Jornada>) =>
    atualizarConfig({ jornada: { ...jornada, ...mudanca } })

  const cidades = CIDADES[config.uf ?? ''] ?? []
  const feriados = useMemo(
    () => feriadosDoMes(mes, config.uf, config.cidade),
    [mes, config.uf, config.cidade],
  )
  const dias = useMemo(
    () => diasTrabalhaveisNoMes(mes, config),
    [mes, config],
  )

  return (
    <Caixa className="overflow-hidden xl:col-span-2">
      <header className="px-5 pt-4 pb-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <Briefcase size={15} className="text-info" />
          Trabalho e feriados
        </h2>
        <p className="mt-0.5 text-xs text-tinta-fraca">
          Serve para o app contar os dias que você realmente trabalha — é assim que ele acerta o
          vale-refeição e qualquer outro valor pago por dia.
        </p>
      </header>

      <div className="grid gap-4 border-t border-linha-suave px-5 py-4 lg:grid-cols-2">
        {/* ------------------------------- região ------------------------------ */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Estado" dica="Para os feriados estaduais.">
              <Selecao
                value={config.uf ?? ''}
                onChange={(e) =>
                  // Trocar de estado invalida a cidade: Niterói não existe em SP.
                  atualizarConfig({ uf: e.target.value || undefined, cidade: undefined })
                }
              >
                <option value="">Não informar</option>
                {UFS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </Selecao>
            </Campo>

            <Campo rotulo="Cidade" dica={cidades.length ? 'Para os feriados municipais.' : 'Escolha o estado antes.'}>
              <Selecao
                value={config.cidade ?? ''}
                disabled={cidades.length === 0}
                onChange={(e) => atualizarConfig({ cidade: e.target.value || undefined })}
              >
                <option value="">Outra cidade</option>
                {cidades.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Selecao>
            </Campo>
          </div>

          <Interruptor
            ligado={jornada.folgaEmFeriado}
            onMudar={(v) => trocar({ folgaEmFeriado: v })}
            rotulo={
              <span>
                Folgo em feriado
                <span className="block text-[11.5px] text-tinta-fraca">
                  Desligue se você trabalha em feriado — quem faz escala normalmente trabalha.
                </span>
              </span>
            }
          />
        </div>

        {/* ------------------------------ jornada ------------------------------ */}
        <div className="space-y-3">
          <Campo rotulo="Como você trabalha">
            <Selecao
              value={jornada.tipo}
              onChange={(e) =>
                trocar(
                  e.target.value === 'escala'
                    ? { tipo: 'escala', escalaTrabalha: 1, escalaFolga: 1 }
                    : { tipo: 'semana', diasSemana: [1, 2, 3, 4, 5] },
                )
              }
            >
              <option value="semana">Dias fixos da semana</option>
              <option value="escala">Escala</option>
            </Selecao>
          </Campo>

          {jornada.tipo === 'semana' ? (
            <div className="flex flex-wrap gap-1.5">
              {SEMANA.map((d) => {
                const marcado = (jornada.diasSemana ?? []).includes(d.id)
                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      const atuais = jornada.diasSemana ?? []
                      trocar({
                        diasSemana: marcado
                          ? atuais.filter((x) => x !== d.id)
                          : [...atuais, d.id].sort(),
                      })
                    }}
                    className={cn(
                      'rounded-controle border px-2.5 py-1.5 text-[12px] font-semibold transition-colors',
                      marcado
                        ? 'border-marca bg-marca/15 text-marca'
                        : 'border-linha bg-superficie text-tinta-fraca hover:text-tinta',
                    )}
                  >
                    {d.curto}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Escala">
                <Selecao
                  value={`${jornada.escalaTrabalha ?? 1}x${jornada.escalaFolga ?? 1}`}
                  onChange={(e) => {
                    const [t, f] = e.target.value.split('x').map(Number)
                    trocar({ escalaTrabalha: t, escalaFolga: f })
                  }}
                >
                  {ESCALAS.map((x) => (
                    <option key={x.rotulo} value={`${x.trabalha}x${x.folga}`}>
                      {x.rotulo}
                    </option>
                  ))}
                </Selecao>
              </Campo>
              <Campo rotulo="Um dia que você trabalhou" dica="Para saber onde o ciclo começa.">
                <Entrada
                  type="date"
                  value={jornada.escalaInicio ?? ''}
                  onChange={(e) => trocar({ escalaInicio: e.target.value })}
                />
              </Campo>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------ conferência ---------------------------- */}
      <div className="flex flex-wrap items-center gap-3 border-t border-linha-suave bg-elevado/40 px-5 py-3.5">
        <Etiqueta tom="entra" icone={<CalendarDays size={12} />}>
          {dias} {dias === 1 ? 'dia de trabalho' : 'dias de trabalho'} em {rotuloMes(mes)}
        </Etiqueta>
        {feriados.length > 0 && (
          <span className="text-[11.5px] text-tinta-fraca">
            Feriados no mês: {feriados.map((f) => `${dataBr(f.data).slice(0, 5)} ${f.nome}`).join(' · ')}
          </span>
        )}
      </div>
    </Caixa>
  )
}
