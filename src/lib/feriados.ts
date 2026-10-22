import type { MesRef } from './types'

/**
 * Feriados brasileiros, calculados — não baixados.
 *
 * Uma lista fixa de datas envelheceria em janeiro: Carnaval, Sexta-feira Santa
 * e Corpus Christi mudam todo ano porque dependem da Páscoa. Calcular aqui faz
 * o app continuar certo em 2030 sem ninguém atualizar nada, e sem depender de
 * uma API que pode estar fora do ar justo quando o celular está sem sinal.
 *
 * Serve para uma conta só, mas que aparece todo mês: quantos dias a pessoa
 * realmente trabalha. Quem recebe vale-refeição por dia trabalhado não recebe
 * em feriado — e é isso que faz o "entrou" do mês bater com o extrato.
 */

/** aaaa-mm-dd */
export type DataIso = string

const iso = (ano: number, mes: number, dia: number): DataIso =>
  `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

/**
 * Domingo de Páscoa pelo algoritmo de Meeus/Butcher (calendário gregoriano).
 *
 * É aritmética pura de propósito: nenhuma data de referência para manter, e o
 * resultado é o mesmo em qualquer fuso — o que importa porque um erro de um dia
 * aqui move Carnaval e Corpus Christi junto.
 */
function pascoa(ano: number): Date {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(ano, mes - 1, dia))
}

const somaDias = (d: Date, dias: number): Date =>
  new Date(d.getTime() + dias * 86_400_000)

const paraIso = (d: Date): DataIso => d.toISOString().slice(0, 10)

export interface Feriado {
  data: DataIso
  nome: string
  ambito: 'nacional' | 'estadual' | 'municipal'
}

/**
 * Feriados nacionais da Lei 662/1949 e da Lei 6.802/1980, mais os móveis.
 *
 * Carnaval e a quinta-feira de Corpus Christi são ponto facultativo por lei
 * federal, não feriado — mas quase todo empregador dá folga, e para o efeito
 * que interessa aqui (não cair vale-refeição) contam igual. Quem trabalha nesses
 * dias pode desmarcar na configuração.
 */
export function feriadosNacionais(ano: number): Feriado[] {
  const p = pascoa(ano)
  return [
    { data: iso(ano, 1, 1), nome: 'Confraternização Universal', ambito: 'nacional' },
    { data: paraIso(somaDias(p, -48)), nome: 'Carnaval (segunda)', ambito: 'nacional' },
    { data: paraIso(somaDias(p, -47)), nome: 'Carnaval', ambito: 'nacional' },
    { data: paraIso(somaDias(p, -2)), nome: 'Sexta-feira Santa', ambito: 'nacional' },
    { data: iso(ano, 4, 21), nome: 'Tiradentes', ambito: 'nacional' },
    { data: iso(ano, 5, 1), nome: 'Dia do Trabalho', ambito: 'nacional' },
    { data: paraIso(somaDias(p, 60)), nome: 'Corpus Christi', ambito: 'nacional' },
    { data: iso(ano, 9, 7), nome: 'Independência', ambito: 'nacional' },
    { data: iso(ano, 10, 12), nome: 'Nossa Senhora Aparecida', ambito: 'nacional' },
    { data: iso(ano, 11, 2), nome: 'Finados', ambito: 'nacional' },
    { data: iso(ano, 11, 15), nome: 'Proclamação da República', ambito: 'nacional' },
    // Feriado nacional desde a Lei 14.759/2023.
    { data: iso(ano, 11, 20), nome: 'Consciência Negra', ambito: 'nacional' },
    { data: iso(ano, 12, 25), nome: 'Natal', ambito: 'nacional' },
  ]
}

type Regra = (ano: number) => Feriado[]

const fixo = (mes: number, dia: number, nome: string, ambito: 'estadual' | 'municipal'): Regra =>
  (ano) => [{ data: iso(ano, mes, dia), nome, ambito }]

const juntar =
  (...regras: Regra[]): Regra =>
  (ano) =>
    regras.flatMap((r) => r(ano))

/**
 * Feriados estaduais.
 *
 * Só os que são feriado civil por lei estadual — data magna e afins. Datas
 * religiosas de padroeiro são municipais e entram na outra tabela.
 */
const ESTADUAIS: Record<string, Regra> = {
  AC: juntar(
    fixo(1, 23, 'Dia do Evangélico', 'estadual'),
    fixo(6, 15, 'Aniversário do Acre', 'estadual'),
    fixo(9, 5, 'Dia da Amazônia', 'estadual'),
    fixo(11, 17, 'Assinatura do Tratado de Petrópolis', 'estadual'),
  ),
  AL: juntar(
    fixo(6, 24, 'São João', 'estadual'),
    fixo(6, 29, 'São Pedro', 'estadual'),
    fixo(9, 16, 'Emancipação de Alagoas', 'estadual'),
  ),
  AM: juntar(
    fixo(9, 5, 'Elevação do Amazonas a província', 'estadual'),
    fixo(12, 8, 'Nossa Senhora da Conceição', 'estadual'),
  ),
  AP: juntar(
    fixo(3, 19, 'São José', 'estadual'),
    fixo(9, 13, 'Criação do Território do Amapá', 'estadual'),
  ),
  BA: fixo(7, 2, 'Independência da Bahia', 'estadual'),
  CE: juntar(
    fixo(3, 19, 'São José', 'estadual'),
    fixo(3, 25, 'Abolição da escravidão no Ceará', 'estadual'),
  ),
  DF: juntar(
    fixo(4, 21, 'Fundação de Brasília', 'estadual'),
    fixo(11, 30, 'Dia do Evangélico', 'estadual'),
  ),
  ES: fixo(10, 28, 'Dia do Servidor Público', 'estadual'),
  GO: fixo(10, 28, 'Dia do Servidor Público', 'estadual'),
  MA: fixo(7, 28, 'Adesão do Maranhão à Independência', 'estadual'),
  MG: fixo(4, 21, 'Data magna de Minas Gerais', 'estadual'),
  MS: fixo(10, 11, 'Criação do Mato Grosso do Sul', 'estadual'),
  MT: fixo(11, 20, 'Consciência Negra', 'estadual'),
  PA: fixo(8, 15, 'Adesão do Pará à Independência', 'estadual'),
  PB: fixo(8, 5, 'Fundação do Estado', 'estadual'),
  PE: fixo(3, 6, 'Revolução Pernambucana', 'estadual'),
  PI: fixo(10, 19, 'Dia do Piauí', 'estadual'),
  PR: fixo(12, 19, 'Emancipação do Paraná', 'estadual'),
  RJ: juntar(
    fixo(4, 23, 'São Jorge', 'estadual'),
    fixo(11, 20, 'Consciência Negra', 'estadual'),
  ),
  RN: juntar(
    fixo(10, 3, 'Mártires de Cunhaú e Uruaçu', 'estadual'),
    fixo(8, 7, 'Dia do Rio Grande do Norte', 'estadual'),
  ),
  RO: juntar(
    fixo(1, 4, 'Criação do Estado', 'estadual'),
    fixo(6, 18, 'Dia do Evangélico', 'estadual'),
  ),
  RR: fixo(10, 5, 'Criação de Roraima', 'estadual'),
  RS: fixo(9, 20, 'Revolução Farroupilha', 'estadual'),
  SC: fixo(8, 11, 'Criação da Capitania de Santa Catarina', 'estadual'),
  SE: fixo(7, 8, 'Emancipação de Sergipe', 'estadual'),
  SP: fixo(7, 9, 'Revolução Constitucionalista', 'estadual'),
  TO: juntar(
    fixo(3, 18, 'Autonomia do Tocantins', 'estadual'),
    fixo(10, 5, 'Criação do Estado', 'estadual'),
  ),
}

export const UFS = [
  { id: 'AC', nome: 'Acre' }, { id: 'AL', nome: 'Alagoas' }, { id: 'AM', nome: 'Amazonas' },
  { id: 'AP', nome: 'Amapá' }, { id: 'BA', nome: 'Bahia' }, { id: 'CE', nome: 'Ceará' },
  { id: 'DF', nome: 'Distrito Federal' }, { id: 'ES', nome: 'Espírito Santo' },
  { id: 'GO', nome: 'Goiás' }, { id: 'MA', nome: 'Maranhão' }, { id: 'MG', nome: 'Minas Gerais' },
  { id: 'MS', nome: 'Mato Grosso do Sul' }, { id: 'MT', nome: 'Mato Grosso' },
  { id: 'PA', nome: 'Pará' }, { id: 'PB', nome: 'Paraíba' }, { id: 'PE', nome: 'Pernambuco' },
  { id: 'PI', nome: 'Piauí' }, { id: 'PR', nome: 'Paraná' }, { id: 'RJ', nome: 'Rio de Janeiro' },
  { id: 'RN', nome: 'Rio Grande do Norte' }, { id: 'RO', nome: 'Rondônia' },
  { id: 'RR', nome: 'Roraima' }, { id: 'RS', nome: 'Rio Grande do Sul' },
  { id: 'SC', nome: 'Santa Catarina' }, { id: 'SE', nome: 'Sergipe' },
  { id: 'SP', nome: 'São Paulo' }, { id: 'TO', nome: 'Tocantins' },
] as const

/**
 * Feriados de cidade.
 *
 * Só as capitais e algumas cidades grandes: é onde mora a maioria, e uma tabela
 * com os 5.570 municípios do país não caberia no app nem seria mantida. Quem
 * mora fora da lista escolhe "Outra cidade" e fica com os estaduais — e pode
 * marcar o feriado local à mão no mês em que ele cair.
 */
export const CIDADES: Record<string, { id: string; nome: string; regra: Regra }[]> = {
  AC: [{ id: 'rio-branco', nome: 'Rio Branco', regra: fixo(12, 28, 'Aniversário de Rio Branco', 'municipal') }],
  AL: [{ id: 'maceio', nome: 'Maceió', regra: fixo(12, 8, 'Nossa Senhora dos Prazeres', 'municipal') }],
  AM: [{ id: 'manaus', nome: 'Manaus', regra: fixo(10, 24, 'Aniversário de Manaus', 'municipal') }],
  AP: [{ id: 'macapa', nome: 'Macapá', regra: fixo(2, 4, 'Aniversário de Macapá', 'municipal') }],
  BA: [
    { id: 'salvador', nome: 'Salvador', regra: juntar(fixo(6, 24, 'São João', 'municipal'), fixo(12, 8, 'Nossa Senhora da Conceição', 'municipal')) },
    { id: 'feira-de-santana', nome: 'Feira de Santana', regra: fixo(9, 18, 'Aniversário da cidade', 'municipal') },
  ],
  CE: [{ id: 'fortaleza', nome: 'Fortaleza', regra: fixo(4, 13, 'Aniversário de Fortaleza', 'municipal') }],
  DF: [],
  ES: [{ id: 'vitoria', nome: 'Vitória', regra: fixo(9, 8, 'Nossa Senhora da Vitória', 'municipal') }],
  GO: [{ id: 'goiania', nome: 'Goiânia', regra: fixo(10, 24, 'Aniversário de Goiânia', 'municipal') }],
  MA: [{ id: 'sao-luis', nome: 'São Luís', regra: fixo(9, 8, 'Aniversário de São Luís', 'municipal') }],
  MG: [
    { id: 'belo-horizonte', nome: 'Belo Horizonte', regra: juntar(fixo(12, 8, 'Nossa Senhora da Conceição', 'municipal'), fixo(8, 15, 'Assunção de Nossa Senhora', 'municipal')) },
    { id: 'uberlandia', nome: 'Uberlândia', regra: fixo(8, 31, 'Aniversário da cidade', 'municipal') },
  ],
  MS: [{ id: 'campo-grande', nome: 'Campo Grande', regra: fixo(8, 26, 'Aniversário de Campo Grande', 'municipal') }],
  MT: [{ id: 'cuiaba', nome: 'Cuiabá', regra: fixo(4, 8, 'Aniversário de Cuiabá', 'municipal') }],
  PA: [{ id: 'belem', nome: 'Belém', regra: fixo(1, 12, 'Aniversário de Belém', 'municipal') }],
  PB: [{ id: 'joao-pessoa', nome: 'João Pessoa', regra: fixo(8, 5, 'Nossa Senhora das Neves', 'municipal') }],
  PE: [
    { id: 'recife', nome: 'Recife', regra: fixo(12, 8, 'Nossa Senhora da Conceição', 'municipal') },
    { id: 'olinda', nome: 'Olinda', regra: fixo(3, 12, 'Aniversário de Olinda', 'municipal') },
  ],
  PI: [{ id: 'teresina', nome: 'Teresina', regra: fixo(8, 16, 'Aniversário de Teresina', 'municipal') }],
  PR: [
    { id: 'curitiba', nome: 'Curitiba', regra: fixo(9, 8, 'Nossa Senhora da Luz', 'municipal') },
    { id: 'londrina', nome: 'Londrina', regra: fixo(12, 10, 'Aniversário de Londrina', 'municipal') },
  ],
  RJ: [
    { id: 'rio-de-janeiro', nome: 'Rio de Janeiro', regra: juntar(fixo(1, 20, 'São Sebastião', 'municipal'), fixo(3, 1, 'Aniversário da cidade', 'municipal')) },
    { id: 'niteroi', nome: 'Niterói', regra: fixo(11, 22, 'Aniversário de Niterói', 'municipal') },
    { id: 'duque-de-caxias', nome: 'Duque de Caxias', regra: fixo(8, 25, 'Aniversário da cidade', 'municipal') },
    { id: 'sao-goncalo', nome: 'São Gonçalo', regra: fixo(9, 22, 'Aniversário de São Gonçalo', 'municipal') },
  ],
  RN: [{ id: 'natal', nome: 'Natal', regra: fixo(11, 21, 'Nossa Senhora da Apresentação', 'municipal') }],
  RO: [{ id: 'porto-velho', nome: 'Porto Velho', regra: fixo(10, 2, 'Aniversário de Porto Velho', 'municipal') }],
  RR: [{ id: 'boa-vista', nome: 'Boa Vista', regra: fixo(7, 9, 'Aniversário de Boa Vista', 'municipal') }],
  RS: [{ id: 'porto-alegre', nome: 'Porto Alegre', regra: fixo(2, 2, 'Nossa Senhora dos Navegantes', 'municipal') }],
  SC: [{ id: 'florianopolis', nome: 'Florianópolis', regra: fixo(3, 23, 'Aniversário de Florianópolis', 'municipal') }],
  SE: [{ id: 'aracaju', nome: 'Aracaju', regra: fixo(3, 17, 'Aniversário de Aracaju', 'municipal') }],
  SP: [
    { id: 'sao-paulo', nome: 'São Paulo', regra: fixo(1, 25, 'Aniversário de São Paulo', 'municipal') },
    { id: 'campinas', nome: 'Campinas', regra: fixo(7, 14, 'Aniversário de Campinas', 'municipal') },
    { id: 'santos', nome: 'Santos', regra: fixo(1, 26, 'Aniversário de Santos', 'municipal') },
    { id: 'guarulhos', nome: 'Guarulhos', regra: fixo(12, 8, 'Aniversário de Guarulhos', 'municipal') },
  ],
  TO: [{ id: 'palmas', nome: 'Palmas', regra: fixo(5, 20, 'Aniversário de Palmas', 'municipal') }],
}

/** Todos os feriados do ano para uma região. */
export function feriadosDoAno(ano: number, uf?: string, cidade?: string): Feriado[] {
  const lista = [...feriadosNacionais(ano)]
  if (uf && ESTADUAIS[uf]) lista.push(...ESTADUAIS[uf](ano))
  if (uf && cidade) {
    const c = (CIDADES[uf] ?? []).find((x) => x.id === cidade)
    if (c) lista.push(...c.regra(ano))
  }
  // Duas leis podem cair no mesmo dia (Consciência Negra no MT, por exemplo):
  // contar duas vezes tiraria um dia de trabalho que existe.
  const vistos = new Set<string>()
  return lista.filter((f) => (vistos.has(f.data) ? false : (vistos.add(f.data), true)))
}

/** Só os do mês pedido, já ordenados. */
export function feriadosDoMes(mes: MesRef, uf?: string, cidade?: string): Feriado[] {
  const ano = Number(mes.slice(0, 4))
  return feriadosDoAno(ano, uf, cidade)
    .filter((f) => f.data.slice(0, 7) === mes)
    .sort((a, b) => a.data.localeCompare(b.data))
}
