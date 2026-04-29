import type { CompoundCategory } from '../types/chemistry'

/** Порядок секций в каталоге. */
export const COMPOUND_CATEGORY_ORDER: CompoundCategory[] = ['oxide', 'acid', 'base', 'salt', 'other']

/** Заголовки секций каталога (множественное число). */
export const COMPOUND_CATEGORY_SECTION_TITLE: Record<CompoundCategory, string> = {
  oxide: 'Оксиды',
  acid: 'Кислоты',
  base: 'Основания',
  salt: 'Соли',
  other: 'Прочее',
}

/** Краткая метка типа вещества (единственное число). */
export const COMPOUND_CATEGORY_KIND_LABEL: Record<CompoundCategory, string> = {
  oxide: 'Оксид',
  acid: 'Кислота',
  base: 'Основание',
  salt: 'Соль',
  other: 'Прочее',
}
