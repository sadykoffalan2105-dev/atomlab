import { ELEMENTS } from '../../data/elements'
import type { CompoundCategory } from '../../types/chemistry'
import type { ReactionClass } from '../../chemistry/reactionTypeTaxonomy'

/** Пара цветов класса вещества (карточки, секции, фильтры). */
export const CATEGORY_TONE: Record<CompoundCategory, { a: string; b: string }> = {
  oxide: { a: '#38bdf8', b: '#6366f1' },
  acid: { a: '#fb7185', b: '#f97316' },
  base: { a: '#a78bfa', b: '#ec4899' },
  salt: { a: '#fbbf24', b: '#f59e0b' },
  other: { a: '#2dd4bf', b: '#22c55e' },
}

/** Цвет типа реакции. */
export const REACTION_TONE: Record<ReactionClass, string> = {
  combination: '#34d399',
  decomposition: '#fbbf24',
  substitution: '#60a5fa',
  exchange: '#a78bfa',
  redox: '#fb7185',
  neutralization: '#2dd4bf',
  hydrolysis: '#38bdf8',
  complex: '#e879f9',
  combustion: '#f97316',
  catalytic: '#facc15',
}

const MASS = new Map(ELEMENTS.map((e) => [e.symbol, e.atomicMass]))

/** Молярная масса по составу, г/моль (null — если в составе неизвестный символ). */
export function molarMass(composition: Readonly<Record<string, number>>): number | null {
  let sum = 0
  for (const [sym, n] of Object.entries(composition)) {
    const m = MASS.get(sym)
    if (m == null || !Number.isFinite(m)) return null
    sum += m * n
  }
  return sum > 0 ? sum : null
}

export function formatMolarMass(m: number, locale: string): string {
  return m.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU', {
    minimumFractionDigits: m < 100 ? 2 : 1,
    maximumFractionDigits: m < 100 ? 2 : 1,
  })
}

const CPK = new Map(ELEMENTS.map((e) => [e.symbol, e.cpkHex]))

/** Цвет атома: CPK из таблицы, слишком тёмные цвета осветляем для тёмной карточки. */
export function atomColor(el: string): string {
  const hex = CPK.get(el)
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex)) return '#c8d0e0'
  const h = hex.startsWith('#') ? hex : `#${hex}`
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  if (lum >= 70) return h
  const k = 70 / Math.max(lum, 1)
  const lift = (v: number) => Math.min(255, Math.round(v * k + 40)).toString(16).padStart(2, '0')
  return `#${lift(r)}${lift(g)}${lift(b)}`
}
