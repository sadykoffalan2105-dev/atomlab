import type { CompoundDef } from '../types/chemistry'
import { getElementBySymbol, getElementByZ } from '../data/elements'
import type { ReactorEquationTerm } from './reactorEquationBalance'
import { compositionKey } from './reactorEquationBalance'

/** Доп. продукты справа (кроме цели каталога), напр. NaCl рядом с ClO₂. */
export type ReactorCoProductTerm = {
  id: string
  compoundId: string
  coeff: number
  /** Нельзя удалить — часть научного маршрута. */
  locked?: boolean
}

type SciLeftSpec =
  | { kind: 'compound'; compoundId: string; targetCoeff: number; glowZ: number }
  | { kind: 'element'; z: number; diatomic?: boolean; targetCoeff: number }

export type ScientificReactorRecipe = {
  productId: string
  left: readonly SciLeftSpec[]
  coProducts: readonly { compoundId: string; targetCoeff: number }[]
  productTargetCoeff: number
  titleRu: string
}

/**
 * Научные маршруты: вещества уже в уравнении, ученик расставляет коэффициенты.
 * Цель для ClO₂: 2 NaClO₂ + Cl₂ → 2 NaCl + 2 ClO₂
 */
export const SCIENTIFIC_REACTOR_RECIPES: Readonly<Record<string, ScientificReactorRecipe>> = {
  clo2: {
    productId: 'clo2',
    titleRu: 'Окисление хлорита хлором',
    left: [
      { kind: 'compound', compoundId: 'salt_na_clo2', targetCoeff: 2, glowZ: 17 },
      { kind: 'element', z: 17, diatomic: true, targetCoeff: 1 },
    ],
    coProducts: [{ compoundId: 'nacl', targetCoeff: 2 }],
    productTargetCoeff: 2,
  },
}

export function getScientificReactorRecipe(
  productId: string | null | undefined,
): ScientificReactorRecipe | null {
  if (!productId) return null
  return SCIENTIFIC_REACTOR_RECIPES[productId] ?? null
}

export function hasScientificReactorRecipe(productId: string | null | undefined): boolean {
  return getScientificReactorRecipe(productId) != null
}

function mergeComp(
  into: Record<string, number>,
  composition: Record<string, number>,
  mult: number,
) {
  const k = Math.max(0, Math.floor(mult))
  if (k <= 0) return
  for (const [sym, n] of Object.entries(composition)) {
    const t = Math.max(0, Math.floor(Number(n))) * k
    if (t > 0) into[sym] = (into[sym] ?? 0) + t
  }
}

export function compositionFromScientificLeft(
  terms: readonly ReactorEquationTerm[],
  compoundById: Readonly<Record<string, CompoundDef>>,
): Record<string, number> | null {
  const out: Record<string, number> = {}
  for (const t of terms) {
    const c = Math.max(0, Math.floor(t.coeff))
    if (c <= 0) continue
    if (t.compoundId) {
      const compound = compoundById[t.compoundId]
      if (!compound) return null
      mergeComp(out, compound.composition, c)
      continue
    }
    const el = getElementByZ(t.z)
    if (!el) return null
    const atoms = c * (t.diatomic ? 2 : 1)
    out[el.symbol] = (out[el.symbol] ?? 0) + atoms
  }
  return Object.keys(out).length > 0 ? out : null
}

export function compositionFromScientificRight(
  product: CompoundDef,
  productCoeff: number,
  coProducts: readonly ReactorCoProductTerm[],
  compoundById: Readonly<Record<string, CompoundDef>>,
): Record<string, number> {
  const out: Record<string, number> = {}
  mergeComp(out, product.composition, productCoeff)
  for (const cp of coProducts) {
    const compound = compoundById[cp.compoundId]
    if (!compound) continue
    mergeComp(out, compound.composition, cp.coeff)
  }
  return out
}

/**
 * Сид уравнения.
 * withTargetCoeffs=false → все коэфф. = 1 (ученик балансирует до 2+1→2+2).
 */
export function seedScientificReactorEquation(
  productId: string,
  newId: () => string,
  opts?: { withTargetCoeffs?: boolean },
): {
  leftTerms: ReactorEquationTerm[]
  coProducts: ReactorCoProductTerm[]
  productCoeff: number
} | null {
  const recipe = getScientificReactorRecipe(productId)
  if (!recipe) return null
  const useTarget = opts?.withTargetCoeffs === true
  const leftTerms: ReactorEquationTerm[] = recipe.left.map((spec) => {
    if (spec.kind === 'compound') {
      return {
        id: newId(),
        z: spec.glowZ,
        coeff: useTarget ? spec.targetCoeff : 1,
        compoundId: spec.compoundId,
        locked: true,
      }
    }
    return {
      id: newId(),
      z: spec.z,
      coeff: useTarget ? spec.targetCoeff : 1,
      ...(spec.diatomic ? { diatomic: true as const } : {}),
      locked: true,
    }
  })
  const coProducts: ReactorCoProductTerm[] = recipe.coProducts.map((cp) => ({
    id: newId(),
    compoundId: cp.compoundId,
    coeff: useTarget ? cp.targetCoeff : 1,
    locked: true,
  }))
  return {
    leftTerms,
    coProducts,
    productCoeff: useTarget ? recipe.productTargetCoeff : 1,
  }
}

export function isScientificEquationBalanced(
  leftTerms: readonly ReactorEquationTerm[],
  coProducts: readonly ReactorCoProductTerm[],
  product: CompoundDef | undefined,
  productCoeff: number,
  compoundById: Readonly<Record<string, CompoundDef>>,
): boolean {
  if (!product) return false
  const recipe = getScientificReactorRecipe(product.id)
  if (!recipe) return false

  if (leftTerms.length !== recipe.left.length) return false
  for (let i = 0; i < recipe.left.length; i++) {
    const spec = recipe.left[i]!
    const term = leftTerms[i]!
    if (spec.kind === 'compound') {
      if (term.compoundId !== spec.compoundId) return false
    } else if (
      term.compoundId ||
      term.z !== spec.z ||
      Boolean(term.diatomic) !== Boolean(spec.diatomic)
    ) {
      return false
    }
  }
  if (coProducts.length !== recipe.coProducts.length) return false
  for (let i = 0; i < recipe.coProducts.length; i++) {
    if (coProducts[i]!.compoundId !== recipe.coProducts[i]!.compoundId) return false
  }

  const left = compositionFromScientificLeft(leftTerms, compoundById)
  if (!left) return false
  const right = compositionFromScientificRight(product, productCoeff, coProducts, compoundById)
  return compositionKey(left) === compositionKey(right)
}

/** zSlots-заглушка для научного запуска (микромир не использует Bohr). */
export function scientificSyntheticZSlots(product: CompoundDef, productCoeff: number): number[] {
  const zs: number[] = []
  const k = Math.max(1, Math.floor(productCoeff))
  for (let n = 0; n < k; n++) {
    for (const [sym, count] of Object.entries(product.composition)) {
      const el = getElementBySymbol(sym)
      if (!el) continue
      const c = Math.max(0, Math.floor(Number(count)))
      for (let i = 0; i < c; i++) zs.push(el.z)
    }
  }
  return zs.length >= 2 ? zs : [17, 8, 8]
}
