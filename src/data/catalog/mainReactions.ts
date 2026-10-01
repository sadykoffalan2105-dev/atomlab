/**
 * 200 основных реакций: доступ, поиск, «скелет» уравнения без коэффициентов (то, что видит ученик до уравнивания).
 * Данные — src/data/catalog/mainReactions200.ts (генератор scripts/plan/select-reactions200.mts).
 */
import { MAIN_REACTIONS_200 } from './mainReactions200'
import { MAIN_REACTION_TYPE_ORDER, type MainReaction, type MainReactionType } from './mainReactionTypes'

export { MAIN_REACTIONS_200, MAIN_REACTION_TYPE_ORDER }
export type { MainReaction, MainReactionType }

const byId = new Map(MAIN_REACTIONS_200.map((r) => [r.id, r]))

export function mainReactionById(id: string | null | undefined): MainReaction | undefined {
  return id ? byId.get(id) : undefined
}

/** «2Na + Cl₂ → 2NaCl» → «Na + Cl₂ → NaCl»: коэффициенты убраны (все равны 1). */
export function mainReactionSkeleton(equation: string): string {
  return equation
    .split(/(\s*(?:→|⇄|⇌|=)\s*)/)
    .map((part) =>
      /^\s*(?:→|⇄|⇌|=)\s*$/.test(part)
        ? part
        : part
            .split(/(\s\+\s)/)
            .map((t) => (/^\s\+\s$/.test(t) ? t : t.replace(/^(\s*)\d+(?=[A-Z(\[])/, '$1')))
            .join(''),
    )
    .join('')
}

/** Формулы реакции для поиска: «NaCl», «Cl2» (без нижних индексов), названия не нужны — их ищет каталог. */
export function mainReactionSearchText(r: MainReaction): string {
  const plain = r.equation.replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080))
  return `${r.equation} ${plain} ${r.titleRu ?? ''} ${r.qualitative ?? ''}`.toLowerCase()
}

export function mainReactionsByType(type: MainReactionType): MainReaction[] {
  return MAIN_REACTIONS_200.filter((r) => r.type === type)
}
