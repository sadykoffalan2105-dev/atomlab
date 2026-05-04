import type { CompoundDef } from '../types/chemistry'
import { getElementByZ } from '../data/elements'

export const REACTOR_EQUATION_MAX_TERMS = 8
export const REACTOR_EQUATION_MAX_FLY_ATOMS = 24

/** coeff: для diatomic — число молекул X₂; иначе число атомов X. */
export type ReactorEquationTerm = { id: string; z: number; coeff: number; diatomic?: boolean }

export type ReactorValidationResult =
  | { ok: true; zSlots: number[]; compound: CompoundDef }
  | { ok: false; message: string }

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
  const maxK = Math.min(200, Math.max(REACTOR_EQUATION_MAX_FLY_ATOMS, Math.ceil(totalLeft / minUnit) + 2))
  for (let k = 1; k <= maxK; k++) {
    if (compositionKey(normalizeComposition(compositionFromProduct(compound, k))) === compositionKey(Ln)) {
      return k
    }
  }
  return null
}

export type LeftCatalogMatch = { compound: CompoundDef; k: number }

/** Все вещества каталога, для которых левая часть = k × формульная единица. */
export function findCatalogMatchesForLeftTerms(
  leftTerms: readonly ReactorEquationTerm[],
  catalog: readonly CompoundDef[],
): LeftCatalogMatch[] {
  const left = compositionFromLeftTerms(leftTerms)
  if (!left || Object.keys(left).length === 0) return []
  const out: LeftCatalogMatch[] = []
  for (const compound of catalog) {
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
    return { ok: false, message: 'Выберите вещество‑продукт из списка (правая часть уравнения).' }
  }

  const pk = Math.max(0, Math.floor(productCoeff))
  if (pk <= 0) {
    return { ok: false, message: 'Коэффициент перед продуктом должен быть целым числом ≥ 1.' }
  }

  if (leftTerms.length === 0) {
    return {
      ok: false,
      message: 'Добавьте реагенты слева: режим «По уравнению» (строка) или «Из таблицы» (Менделеев).',
    }
  }

  if (leftTerms.length > REACTOR_EQUATION_MAX_TERMS) {
    return { ok: false, message: `Слишком много слагаемых (максимум ${REACTOR_EQUATION_MAX_TERMS}).` }
  }

  for (const t of leftTerms) {
    const c = Math.floor(t.coeff)
    if (c < 1 || !Number.isFinite(t.coeff)) {
      return { ok: false, message: 'Проверь коэффициенты: нужны целые числа не меньше 1.' }
    }
    if (!getElementByZ(t.z)) {
      return { ok: false, message: 'Неизвестный элемент в уравнении.' }
    }
  }

  const zSlots = expandLeftTermsToZSlots(leftTerms)
  if (zSlots.length < 2) {
    return { ok: false, message: 'Суммарно должно быть хотя бы два атома слева (например 2 H и 1 O).' }
  }
  if (zSlots.length > REACTOR_EQUATION_MAX_FLY_ATOMS) {
    return {
      ok: false,
      message: `Слишком много атомов для анимации (максимум ${REACTOR_EQUATION_MAX_FLY_ATOMS}). Уменьшите коэффициенты.`,
    }
  }

  const left = compositionFromLeftTerms(leftTerms)
  if (!left) {
    return { ok: false, message: 'Не удалось разобрать левую часть уравнения.' }
  }

  const right = normalizeComposition(compositionFromProduct(product, pk))
  const lKey = compositionKey(left)
  const rKey = compositionKey(right)
  if (lKey !== rKey) {
    return {
      ok: false,
      message: 'Ошибка в балансе масс: число атомов каждого элемента слева и справа не совпадает. Проверь коэффициенты.',
    }
  }

  return { ok: true, zSlots, compound: product }
}
