import type { CompoundDef } from '../types/chemistry'
import { getElementByZ } from '../data/elements'
import {
  REACTOR_COEFF_MAX,
  REACTOR_EQUATION_MAX_TERMS,
} from './reactorLimits'
import { fromElementsPolicy } from './substanceSynthesisRoute'

export { REACTOR_COEFF_MAX, REACTOR_EQUATION_MAX_TERMS } from './reactorLimits'
/** @deprecated Используйте REACTOR_VISUAL_FULL_ATOMS из reactorLimits — не блокирует уравнение. */
export { REACTOR_EQUATION_MAX_FLY_ATOMS } from './reactorLimits'

/** coeff: для diatomic — число молекул X₂; иначе число атомов X. */
export type ReactorEquationTerm = { id: string; z: number; coeff: number; diatomic?: boolean }

export type ReactorValidationErrorCode =
  | 'NO_PRODUCT'
  | 'PRODUCT_COEFF_INVALID'
  | 'NO_REAGENTS'
  | 'MAX_TERMS'
  | 'TERM_COEFF_INVALID'
  | 'UNKNOWN_ELEMENT'
  | 'TOO_FEW_ATOMS'
  | 'MAX_FLY_ATOMS'
  | 'LEFT_PARSE_FAIL'
  | 'BALANCE_MISMATCH'
  | 'SCHOOL_ROUTE_ONLY'

export type ReactorValidationResult =
  | { ok: true; zSlots: number[]; compound: CompoundDef }
  | { ok: false; code: ReactorValidationErrorCode; params?: Record<string, string | number> }

function normalizeComposition(m: Record<string, number>): Record<string, number> {
  const o: Record<string, number> = {}
  for (const [k, v] of Object.entries(m)) {
    const n = Math.max(0, Math.floor(Number(v)))
    if (n > 0) o[k] = n
  }
  return o
}

export function compositionKey(m: Record<string, number>): string {
  return Object.entries(m)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `${k}:${n}`)
    .join('|')
}

export function compositionFromLeftTerms(terms: readonly ReactorEquationTerm[]): Record<string, number> | null {
  const counts: Record<string, number> = {}
  for (const t of terms) {
    const c = Math.max(0, Math.floor(t.coeff))
    if (c <= 0) continue
    const el = getElementByZ(t.z)
    if (!el) return null
    const atoms = c * (t.diatomic ? 2 : 1)
    counts[el.symbol] = (counts[el.symbol] ?? 0) + atoms
  }
  return Object.keys(counts).length > 0 ? counts : null
}

export function compositionFromProduct(compound: CompoundDef, productCoeff: number): Record<string, number> {
  const k = Math.max(0, Math.floor(productCoeff))
  const out: Record<string, number> = {}
  if (k <= 0) return out
  for (const [sym, n] of Object.entries(compound.composition)) {
    const t = Math.max(0, Math.floor(Number(n))) * k
    if (t > 0) out[sym] = t
  }
  return out
}

export function expandLeftTermsToZSlots(terms: readonly ReactorEquationTerm[]): number[] {
  const zs: number[] = []
  for (const t of terms) {
    const c = Math.max(0, Math.floor(t.coeff))
    const n = c * (t.diatomic ? 2 : 1)
    for (let i = 0; i < n; i++) zs.push(t.z)
  }
  return zs
}

/**
 * 3D-превью в реакторе: по одной модели на единицу коэффициента.
 * O₂ с коэфф. 7 → 7 атомов O (не 14). Синтез по-прежнему через expandLeftTermsToZSlots.
 */
export function expandLeftTermsToPreviewSlots(terms: readonly ReactorEquationTerm[]): number[] {
  const zs: number[] = []
  for (const t of terms) {
    const c = Math.max(0, Math.floor(t.coeff))
    for (let i = 0; i < c; i++) zs.push(t.z)
  }
  return zs
}

/** Подбор k такого, что k × состав(вещество) совпадает с левым составом (по ключу). */
export function findMatchingProductCoeff(
  left: Record<string, number>,
  compound: CompoundDef,
): number | null {
  const Ln = normalizeComposition(left)
  const posCounts = Object.values(compound.composition)
    .map((n) => Math.max(0, Math.floor(Number(n))))
    .filter((n) => n > 0)
  if (posCounts.length === 0) return null
  const minUnit = Math.min(...posCounts)
  const totalLeft = Object.values(Ln).reduce((a, b) => a + b, 0)
  const maxK = Math.min(REACTOR_COEFF_MAX, Math.ceil(totalLeft / minUnit) + 4)
  for (let k = 1; k <= maxK; k++) {
    if (compositionKey(normalizeComposition(compositionFromProduct(compound, k))) === compositionKey(Ln)) {
      return k
    }
  }
  return null
}

export type LeftCatalogMatch = { compound: CompoundDef; k: number }

/**
 * Быстрый отсев: у вещества есть символ, которого нет в левом составе — совпадение невозможно.
 * Сильно сокращает число вызовов findMatchingProductCoeff при большом каталоге.
 */
export function filterCatalogCandidatesForLeft(
  left: Record<string, number>,
  catalog: readonly CompoundDef[],
): CompoundDef[] {
  const Ln = normalizeComposition(left)
  return catalog.filter((compound) => {
    for (const sym of Object.keys(compound.composition)) {
      const need = Math.max(0, Math.floor(Number(compound.composition[sym])))
      if (need <= 0) continue
      if ((Ln[sym] ?? 0) < 1) return false
    }
    return true
  })
}

/** Все вещества каталога, для которых левая часть = k × формульная единица. */
export function findCatalogMatchesForLeftTerms(
  leftTerms: readonly ReactorEquationTerm[],
  catalog: readonly CompoundDef[],
): LeftCatalogMatch[] {
  const left = compositionFromLeftTerms(leftTerms)
  if (!left || Object.keys(left).length === 0) return []
  const candidates = filterCatalogCandidatesForLeft(left, catalog)
  const out: LeftCatalogMatch[] = []
  for (const compound of candidates) {
    const k = findMatchingProductCoeff(left, compound)
    if (k != null) out.push({ compound, k })
  }
  return out
}

export function isReactorEquationBalanced(
  leftTerms: readonly ReactorEquationTerm[],
  product: CompoundDef | undefined,
  productCoeff: number,
): boolean {
  if (!product) return false
  const left = compositionFromLeftTerms(leftTerms)
  if (!left) return false
  const pk = Math.max(0, Math.floor(productCoeff))
  if (pk <= 0) return false
  const right = normalizeComposition(compositionFromProduct(product, pk))
  return compositionKey(left) === compositionKey(right)
}

/**
 * Проверка уравнения: слева только атомы (coeff × элемент), справа coeff × состав вещества из каталога.
 */
export function validateReactorEquation(
  leftTerms: readonly ReactorEquationTerm[],
  product: CompoundDef | undefined,
  productCoeff: number,
): ReactorValidationResult {
  if (!product) {
    return { ok: false, code: 'NO_PRODUCT' }
  }

  const pk = Math.max(0, Math.floor(productCoeff))
  if (pk <= 0) {
    return { ok: false, code: 'PRODUCT_COEFF_INVALID' }
  }

  if (leftTerms.length === 0) {
    return { ok: false, code: 'NO_REAGENTS' }
  }

  if (leftTerms.length > REACTOR_EQUATION_MAX_TERMS) {
    return { ok: false, code: 'MAX_TERMS', params: { maxTerms: REACTOR_EQUATION_MAX_TERMS } }
  }

  for (const t of leftTerms) {
    const c = Math.floor(t.coeff)
    if (c < 1 || !Number.isFinite(t.coeff)) {
      return { ok: false, code: 'TERM_COEFF_INVALID' }
    }
    if (!getElementByZ(t.z)) {
      return { ok: false, code: 'UNKNOWN_ELEMENT' }
    }
  }

  const zSlots = expandLeftTermsToZSlots(leftTerms)
  if (zSlots.length < 2) {
    return { ok: false, code: 'TOO_FEW_ATOMS' }
  }

  const left = compositionFromLeftTerms(leftTerms)
  if (!left) {
    return { ok: false, code: 'LEFT_PARSE_FAIL' }
  }

  const right = normalizeComposition(compositionFromProduct(product, pk))
  const lKey = compositionKey(left)
  const rKey = compositionKey(right)
  if (lKey !== rKey) {
    return {
      ok: false,
      code: 'BALANCE_MISMATCH',
    }
  }

  // Массовый баланс может сойтись для «2S + 3O₂ = 2SO₃», но школьный путь другой.
  if (fromElementsPolicy(product.id) === 'forbidden') {
    return { ok: false, code: 'SCHOOL_ROUTE_ONLY', params: { formula: product.formulaUnicode } }
  }

  return { ok: true, zSlots, compound: product }
}
