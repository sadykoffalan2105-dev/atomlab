import type { ElementViewModel } from '../types/chemistry'

/** Категории элементов (по полю groupBlock из IUPAC-данных). */
export type ElementCategoryId =
  | 'alkali-metal'
  | 'alkaline-earth-metal'
  | 'transition-metal'
  | 'post-transition-metal'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble-gas'
  | 'lanthanide'
  | 'actinide'

/** Дополнительный фильтр: все металлы сразу. */
export type ElementCategoryFilterId = ElementCategoryId | 'all-metals'

const GROUP_BLOCK_TO_CATEGORY: Record<string, ElementCategoryId> = {
  'alkali metal': 'alkali-metal',
  'alkaline earth metal': 'alkaline-earth-metal',
  'transition metal': 'transition-metal',
  'post-transition metal': 'post-transition-metal',
  metalloid: 'metalloid',
  nonmetal: 'nonmetal',
  halogen: 'halogen',
  'noble gas': 'noble-gas',
  lanthanide: 'lanthanide',
  actinide: 'actinide',
}

const METAL_CATEGORIES = new Set<ElementCategoryId>([
  'alkali-metal',
  'alkaline-earth-metal',
  'transition-metal',
  'post-transition-metal',
  'lanthanide',
  'actinide',
])

/** Порядок кнопок в легенде (как в школьной классификации). */
export const ELEMENT_CATEGORY_ORDER: readonly ElementCategoryFilterId[] = [
  'alkali-metal',
  'alkaline-earth-metal',
  'transition-metal',
  'post-transition-metal',
  'metalloid',
  'nonmetal',
  'halogen',
  'noble-gas',
  'lanthanide',
  'actinide',
  'all-metals',
]

export function elementCategoryId(el: ElementViewModel): ElementCategoryId | null {
  const key = el.groupBlock.trim().toLowerCase()
  return GROUP_BLOCK_TO_CATEGORY[key] ?? null
}

export function elementMatchesCategoryFilter(
  el: ElementViewModel,
  filter: ElementCategoryFilterId,
): boolean {
  const cat = elementCategoryId(el)
  if (!cat) return false
  if (filter === 'all-metals') return METAL_CATEGORIES.has(cat)
  return cat === filter
}

export function isMetalCategory(cat: ElementCategoryId): boolean {
  return METAL_CATEGORIES.has(cat)
}
