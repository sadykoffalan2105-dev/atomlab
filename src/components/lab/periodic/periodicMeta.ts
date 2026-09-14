/**
 * Метаданные страницы «Таблица Менделеева»: подписи классов, цвета-акценты,
 * период/группа в краткой форме и поиск элемента.
 */
import type { ElementViewModel } from '../../../types/chemistry'
import type { AppLocale } from '../../../i18n/types'
import type { MessageKey } from '../../../i18n/messagesRu'
import { ELEMENTS } from '../../../data/elements'
import { ELEMENT_NAMES_EN } from '../../../data/elementNamesEn'
import { elementDisplayName } from '../../../data/elementDisplayName'
import type { ElementCategoryFilterId } from '../../../data/elementCategory'
import { getRuGridPos } from '../../../data/ruElementGrid'
import { RU_GROUP_LABELS } from '../../../data/ruGroupLabels'
import type { TextbookBlockClass } from '../../../data/mendeleevTextbookBlock'

export const CATEGORY_I18N: Record<ElementCategoryFilterId, MessageKey> = {
  'alkali-metal': 'periodic.categoryAlkaliMetal',
  'alkaline-earth-metal': 'periodic.categoryAlkalineEarthMetal',
  'transition-metal': 'periodic.categoryTransitionMetal',
  'post-transition-metal': 'periodic.categoryPostTransitionMetal',
  metalloid: 'periodic.categoryMetalloid',
  nonmetal: 'periodic.categoryNonmetal',
  halogen: 'periodic.categoryHalogen',
  'noble-gas': 'periodic.categoryNobleGas',
  lanthanide: 'periodic.categoryLanthanide',
  actinide: 'periodic.categoryActinide',
  'all-metals': 'periodic.categoryAllMetals',
}

/** Цвет точки у чипа класса (и у подписи класса в карточке). */
export const CATEGORY_COLOR: Record<ElementCategoryFilterId, string> = {
  'alkali-metal': '#fb7185',
  'alkaline-earth-metal': '#fbbf24',
  'transition-metal': '#60a5fa',
  'post-transition-metal': '#94a3b8',
  metalloid: '#2dd4bf',
  nonmetal: '#34d399',
  halogen: '#e879f9',
  'noble-gas': '#22d3ee',
  lanthanide: '#a78bfa',
  actinide: '#f97316',
  'all-metals': '#cbd5e1',
}

/** Акцент блока (s/p/d/f/благородные газы) — те же цвета, что у ячеек таблицы. */
export const BLOCK_ACCENT: Record<TextbookBlockClass, { a: string; b: string }> = {
  tbS: { a: '#34d399', b: '#0d9488' },
  tbP: { a: '#f472b6', b: '#be185d' },
  tbD: { a: '#60a5fa', b: '#4f46e5' },
  tbF: { a: '#a78bfa', b: '#7c3aed' },
  tbNoble: { a: '#22d3ee', b: '#0369a1' },
}

export const BLOCK_ORDER: readonly TextbookBlockClass[] = ['tbS', 'tbP', 'tbD', 'tbF', 'tbNoble']

export function blockLegendKey(key: TextbookBlockClass): MessageKey {
  if (key === 'tbNoble') return 'periodic.legendNoble'
  return `periodic.legend${key.slice(2)}` as MessageKey
}

/** Ряд краткой формы → период. */
const ROW_TO_PERIOD: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 4,
  6: 5,
  7: 5,
  8: 6,
  9: 6,
  10: 7,
  11: 7,
  12: 6,
  13: 7,
}

/** Период и группа (римская цифра + подгруппа A/B) в краткой форме ПСХЭ. */
export function ruPeriodGroup(z: number): { period: number | null; group: string | null } {
  const pos = getRuGridPos(z)
  if (!pos) return { period: null, group: null }
  const period = ROW_TO_PERIOD[pos.y] ?? null
  if (pos.f != null) return { period, group: 'III B' }
  if (pos.t != null) return { period, group: 'VIII B' }
  if (pos.g != null) {
    const roman = RU_GROUP_LABELS[pos.g - 1] ?? String(pos.g)
    const sub = pos.s === 'a' ? ' A' : pos.s === 'b' ? ' B' : ''
    return { period, group: `${roman}${sub}` }
  }
  return { period, group: null }
}

/** Разбивает «[Ar] 3d6 4s2» на части для верхних индексов. */
export function configParts(config: string): Array<{ text: string; sup?: string }> {
  const out: Array<{ text: string; sup?: string }> = []
  const re = /(\d*[spdf])(\d+)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(config)) != null) {
    if (m.index > last) out.push({ text: config.slice(last, m.index) })
    out.push({ text: m[1], sup: m[2] })
    last = m.index + m[0].length
  }
  if (last < config.length) out.push({ text: config.slice(last) })
  return out
}

export type ElementSearchResult = {
  matches: ReadonlySet<number>
  best: number | null
}

/** Поиск по символу, названию (текущий язык + RU + EN) или порядковому номеру. */
export function searchElements(query: string, locale: AppLocale): ElementSearchResult | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  const matches = new Set<number>()
  let best: number | null = null
  let bestScore = 0

  if (/^\d+$/.test(q)) {
    const z = Number(q)
    if (ELEMENTS.some((e) => e.z === z)) {
      matches.add(z)
      best = z
    }
    return { matches, best }
  }

  const score = (el: ElementViewModel): number => {
    const sym = el.symbol.toLowerCase()
    const names = [elementDisplayName(el, locale), el.nameRu, ELEMENT_NAMES_EN[el.z - 1] ?? '']
      .map((n) => n.toLowerCase())
    if (sym === q) return 100
    if (names.includes(q)) return 90
    if (sym.startsWith(q)) return 60
    if (names.some((n) => n.startsWith(q))) return 50
    if (q.length >= 2 && names.some((n) => n.includes(q))) return 20
    return 0
  }

  for (const el of ELEMENTS) {
    const s = score(el)
    if (s <= 0) continue
    matches.add(el.z)
    if (s > bestScore) {
      bestScore = s
      best = el.z
    }
  }
  return { matches, best }
}
