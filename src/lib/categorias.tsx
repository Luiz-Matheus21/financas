import {
  Armchair,
  Banknote,
  Briefcase,
  Bus,
  CalendarCheck,
  Croissant,
  Dog,
  Fuel,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Palmtree,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  Repeat,
  Shapes,
  ShoppingCart,
  Shirt,
  Sparkles,
  Tag,
  Ticket,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

/**
 * Um ícone para cada categoria.
 *
 * Vale menos como enfeite e mais como atalho de leitura: numa lista de trinta
 * compras, a silhueta do carrinho acha o mercado antes de a palavra ser lida.
 * Por isso cada ícone é do objeto da categoria, não do sentimento dela — nada
 * de seta pra cima em "Lazer".
 *
 * A mesma escolha aparece no celular, com o ícone equivalente do Ionicons;
 * mudar aqui pede mudar lá, senão o mesmo gasto tem duas caras.
 */
const GASTOS: Record<string, LucideIcon> = {
  Mercado: ShoppingCart,
  Restaurante: UtensilsCrossed,
  Transporte: Bus,
  Combustível: Fuel,
  Saúde: HeartPulse,
  Farmácia: Pill,
  Casa: Armchair,
  Moradia: House,
  Educação: GraduationCap,
  Assinaturas: Repeat,
  Vestuário: Shirt,
  Lazer: Sparkles,
  Viagem: Plane,
  Presentes: Gift,
  Pet: Dog,
  Eletrônicos: Laptop,
  Serviços: Wrench,
  Impostos: Landmark,
}

const GANHOS: Record<string, LucideIcon> = {
  Salário: Banknote,
  'Benefícios': Ticket,
  'Décimo terceiro': Gift,
  Férias: Palmtree,
  Bônus: Sparkles,
  Freelance: Briefcase,
  Aluguel: House,
  Rendimentos: PiggyBank,
  Reembolso: HandCoins,
  Venda: Tag,
}

/** Sem correspondência ("Outros", ou categoria digitada à mão) cai num genérico. */
export const iconeGasto = (categoria: string): LucideIcon => GASTOS[categoria] ?? Shapes
export const iconeGanho = (categoria: string): LucideIcon => GANHOS[categoria] ?? Shapes

/** Recorrência mensal: não é categoria, é o tipo do lançamento. */
export const ICONE_FIXO = CalendarCheck
export const ICONE_FATURA = Receipt
