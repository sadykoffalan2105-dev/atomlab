import type { CompoundDef } from '../types/chemistry'
import { getElementByZ } from '../data/elements'
import type { ReactorEquationTerm } from './reactorEquationBalance'

/** Степень окисления: целое число (0, +2, −2, …). */
export type OxidationNumber = number

export type OxidationLabel = {
  symbol: string
  /** Число атомов этого символа в формуле (для Fe₂ → 2). */
  count: number
  ox: OxidationNumber
  /** Отображение: Fe⁰, O⁻², Fe³⁺ */
  display: string
}

export type SpeciesOxidation = {
  /** Unicode-подобная строка с SO: Fe₂³⁺O₃²⁻ */
  formulaWithOx: string
  labels: OxidationLabel[]
}

const SUPER: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '−': '⁻',
}

function toSuper(n: number): string {
  if (n === 0) return SUPER['0']!
  const sign = n > 0 ? SUPER['+']! : SUPER['-']!
  const abs = String(Math.abs(n))
    .split('')
    .map((d) => SUPER[d] ?? d)
    .join('')
  return `${abs}${sign}`
}

export function formatOxidationDisplay(symbol: string, ox: OxidationNumber): string {
  return `${symbol}${toSuper(ox)}`
}

/** Типичная степень окисления кислорода в оксидах (−2), кроме пероксидов. */
const OXYGEN_OX = -2
const HYDROGEN_OX = 1

/** Простые вещества: SO = 0. */
export function oxidationForElementTerm(term: ReactorEquationTerm): SpeciesOxidation {
  const el = getElementByZ(term.z)
  const symbol = el?.symbol ?? '?'
  const label: OxidationLabel = {
    symbol,
    count: term.diatomic ? 2 : 1,
    ox: 0,
    display: formatOxidationDisplay(symbol, 0),
  }
  const formulaWithOx = term.diatomic
    ? `${symbol}₂${toSuper(0)}`
    : formatOxidationDisplay(symbol, 0)
  return { formulaWithOx, labels: [label] }
}

/**
 * Школьный расчёт SO для бинарных оксидов / простых солей без скобок.
 * O = −2, H = +1, остальные — из электронейтральности.
 */
export function oxidationForCompound(compound: CompoundDef): SpeciesOxidation | null {
  const entries = Object.entries(compound.composition)
    .map(([symbol, n]) => [symbol, Math.max(0, Math.floor(Number(n)))] as const)
    .filter(([, n]) => n > 0)
  if (entries.length === 0) return null

  const oxMap = new Map<string, OxidationNumber>()
  for (const [symbol] of entries) {
    if (symbol === 'O') oxMap.set(symbol, OXYGEN_OX)
    else if (symbol === 'H') oxMap.set(symbol, HYDROGEN_OX)
  }

  const unknown = entries.filter(([s]) => !oxMap.has(s))
  if (unknown.length === 1) {
    const [sym, count] = unknown[0]!
    let charge = 0
    for (const [s, n] of entries) {
      if (s === sym) continue
      charge += (oxMap.get(s) ?? 0) * n
    }
    const ox = -charge / count
    if (!Number.isFinite(ox) || Math.abs(ox - Math.round(ox)) > 1e-6) return null
    oxMap.set(sym, Math.round(ox))
  } else if (unknown.length > 1) {
    // Fe₃O₄ и смешанные — не разбираем автоматически в v1.
    return null
  }

  const labels: OxidationLabel[] = entries.map(([symbol, count]) => {
    const ox = oxMap.get(symbol) ?? 0
    return { symbol, count, ox, display: formatOxidationDisplay(symbol, ox) }
  })

  const formulaWithOx = labels
    .map((l) => {
      const sub =
        l.count > 1
          ? String(l.count)
              .split('')
              .map((d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)] ?? d)
              .join('')
          : ''
      return `${l.symbol}${sub}${toSuper(l.ox)}`
    })
    .join('')

  return { formulaWithOx, labels }
}

export function oxidationForProduct(
  compound: CompoundDef | null,
): SpeciesOxidation | null {
  if (!compound) return null
  return oxidationForCompound(compound)
}
