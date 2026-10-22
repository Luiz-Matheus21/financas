/** Chave de mês no formato 'YYYY-MM'. Toda competência do sistema usa isso. */
export type MesRef = string

export type Bandeira = 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard' | 'outra'

export interface Cartao {
  id: string
  /** Dono. Só vem preenchido na visão da família. */
  usuarioId?: string
  apelido: string
  bancoId: string
  bandeira: Bandeira
  limite: number
  diaFechamento: number
  diaVencimento: number
  ultimosDigitos?: string
  ativo: boolean
  criadoEm: string
}

export interface Compra {
  id: string
  /** Nulo é compra em dinheiro/pix/débito: sem cartão, sem fatura, cai direto no mês da compra. */
  cartaoId: string | null
  descricao: string
  valorTotal: number
  parcelas: number
  dataCompra: string
  /** Preenchido quando o usuário força a 1ª fatura em vez de deixar o fechamento decidir. */
  primeiraFatura?: MesRef
  categoria: string
  /** Dono do registro. Só vem preenchido na visão da família. */
  usuarioId?: string
  observacao?: string
  origemOcr?: boolean
  criadoEm: string
}

export type Recorrencia = 'mensal' | 'unica'

/**
 * Novo valor de um lançamento mensal a partir de um mês — aumento de salário,
 * reajuste de aluguel, corte. Os meses anteriores continuam com o valor
 * antigo, que é o que faz o histórico ficar honesto.
 */
export interface Ajuste {
  mes: MesRef
  valor: number
}

/**
 * Um período de férias marcado no salário.
 *
 * Existe porque férias não são "um mês diferente": são um adiantamento no mês
 * em que caem e um desconto no mês seguinte, mais o terço da Constituição e o
 * abono dos dias vendidos. Sem modelar isso, o mês das férias parece um mês de
 * fartura e o seguinte parece um buraco — e é justamente aí que a pessoa se
 * programa errado.
 *
 * Guardado no próprio salário, e não numa lista solta, porque todo o cálculo
 * sai do valor dele: quem muda de salário muda as férias junto, sem precisar
 * lembrar de editar dois lugares.
 */
export interface Ferias {
  id: string
  /** Mês em que as férias são gozadas e o adiantamento cai. */
  mes: MesRef
  /** Dias de descanso. A CLT dá 30 por período aquisitivo. */
  dias: number
  /** Dias vendidos (abono pecuniário). Até 10 — um terço dos 30. */
  diasVendidos: number
}

export interface Ganho {
  id: string
  usuarioId?: string
  descricao: string
  valor: number
  categoria: string
  recorrencia: Recorrencia
  /** 'mensal': mês de início. 'unica': o mês do lançamento. */
  mesInicio: MesRef
  /** 'mensal' opcional: último mês em que ainda entra. */
  mesFim?: MesRef
  /** Mudanças de valor ao longo do tempo, em ordem qualquer. */
  ajustes?: Ajuste[]
  /** Só faz sentido num salário mensal. Pode haver mais de um por ano: a CLT
      permite partir as férias em até três períodos. */
  ferias?: Ferias[]
  /**
   * O valor é por dia trabalhado, não por mês.
   *
   * É o caso do vale-refeição: R$ 50 por dia útil dá R$ 1.100 num mês de 22
   * dias e R$ 950 num de 19. Guardar o valor do mês faria o app errar todo mês
   * que tem feriado — e é justamente o mês do feriado que a pessoa se programa
   * pensando que vai receber igual.
   */
  porDiaUtil?: boolean
  diaRecebimento?: number
  criadoEm: string
}

export interface GastoFixo {
  id: string
  usuarioId?: string
  descricao: string
  valor: number
  categoria: string
  recorrencia: Recorrencia
  mesInicio: MesRef
  mesFim?: MesRef
  ajustes?: Ajuste[]
  diaVencimento?: number
  criadoEm: string
}

/** Valor da fatura informado pelo banco, sobrepondo o calculado. */
export interface FaturaRegistro {
  cartaoId: string
  mes: MesRef
  valorInformado?: number
  paga?: boolean
  observacao?: string
}

/**
 * Como a pessoa trabalha.
 *
 * Existe por causa do vale-refeição, que é creditado por dia trabalhado: sem
 * saber quais dias são esses, o app não sabe quanto entra no mês. E "dia
 * trabalhado" não é igual para todo mundo — tem quem faça segunda a sexta, quem
 * faça 12x36, quem trabalhe sábado. Por isso é configuração, e não uma regra
 * chumbada no código.
 */
export interface Jornada {
  tipo: 'semana' | 'escala'
  /** 'semana': dias trabalhados, 0 = domingo … 6 = sábado. */
  diasSemana?: number[]
  /** 'escala': ciclo de X dias trabalhando e Y de folga (12x36, 5x2, 6x1). */
  escalaTrabalha?: number
  escalaFolga?: number
  /** 'escala': um dia de trabalho conhecido, para saber a fase do ciclo. */
  escalaInicio?: string
  /** Feriado é folga? Em escala normalmente não é. */
  folgaEmFeriado: boolean
}

export interface Config {
  tema: 'dark' | 'light'
  mesInicial?: MesRef
  reservaMinima: number
  /** Último cartão em que se lançou compra: a próxima já abre nele. */
  ultimoCartaoId?: string
  /** Sigla do estado, para os feriados estaduais. */
  uf?: string
  /** Id da cidade dentro do estado, para os municipais. */
  cidade?: string
  jornada?: Jornada
}

export interface Dados {
  versao: number
  cartoes: Cartao[]
  compras: Compra[]
  ganhos: Ganho[]
  gastosFixos: GastoFixo[]
  faturas: FaturaRegistro[]
  config: Config
}

export const CATEGORIAS_GASTO = [
  'Mercado', 'Restaurante', 'Transporte', 'Combustível', 'Saúde', 'Farmácia',
  'Casa', 'Moradia', 'Educação', 'Assinaturas', 'Vestuário', 'Lazer',
  'Viagem', 'Presentes', 'Pet', 'Eletrônicos', 'Serviços', 'Impostos', 'Outros',
] as const

export const CATEGORIAS_GANHO = [
  'Salário', 'Benefícios', 'Décimo terceiro', 'Férias', 'Bônus', 'Freelance',
  'Aluguel', 'Rendimentos', 'Reembolso', 'Venda', 'Outros',
] as const

export const dadosVazios = (): Dados => ({
  versao: 1,
  cartoes: [],
  compras: [],
  ganhos: [],
  gastosFixos: [],
  faturas: [],
  config: { tema: 'dark', reservaMinima: 0 },
})
