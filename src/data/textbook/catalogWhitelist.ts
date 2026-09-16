/**
 * Каталог веществ = только вещества из учебников «Химия» 7–11.
 * Список id строит scripts/textbook-inventory/build-whitelist.mts (сверка формул учебников с каталогом по составу).
 */
import whitelist from './catalogWhitelist.json'

/**
 * Вещества не из учебников, на которые опираются реактор и банк реакций (ClO₂-рецепт, реакции с KClO₄ и т. п.).
 * В данных остаются, в каталоге не показываются.
 */
export const CATALOG_HIDDEN_IDS: ReadonlySet<string> = new Set([
  'clo2',
  'salt_k_clo4',
  'salt_ba_mno4',
  'salt_ba_clo3',
  'salt_cu_cr2o7',
  'salt_fe3_s',
  'adamantane',
  'triacetin',
])

const TEXTBOOK_IDS: ReadonlySet<string> = new Set([...whitelist.inorganic, ...whitelist.organic])

/** Вещество есть в учебниках (или нужно лаборатории) — остаётся в данных приложения. */
export function isTextbookCompoundId(id: string): boolean {
  return id.startsWith('tb_') || TEXTBOOK_IDS.has(id) || CATALOG_HIDDEN_IDS.has(id)
}

/** Показывать ли вещество в каталоге и списках выбора. */
export function isCatalogVisibleId(id: string): boolean {
  return !CATALOG_HIDDEN_IDS.has(id)
}
