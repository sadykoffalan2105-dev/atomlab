import type { CompoundDef } from '../types/chemistry'
import { getElementBySymbol, getElementByZ } from '../data/elements'
import type { ReactorEquationTerm } from './reactorEquationBalance'
import { compositionKey } from './reactorEquationBalance'

/**
 * Доп. продукты справа (кроме цели каталога): вещество каталога (NaCl рядом с ClO₂)
 * или простое вещество (H₂ в Zn + 2HCl → ZnCl₂ + H₂, Cu в Fe + CuSO₄ → FeSO₄ + Cu).
 * coeff у элемента — как у реагентов: для diatomic число молекул X₂, иначе атомов.
 */
export type ReactorCoProductTerm = {
  id: string
  coeff: number
  /** Нельзя удалить — часть научного маршрута. */
  locked?: boolean
} & (
  | { compoundId: string; z?: undefined; diatomic?: undefined }
  | { compoundId?: undefined; z: number; diatomic?: boolean }
)

export type SciLeftSpec =
  | { kind: 'compound'; compoundId: string; targetCoeff: number; glowZ: number }
  | { kind: 'element'; z: number; diatomic?: boolean; targetCoeff: number }

export type SciCoProductSpec =
  | { compoundId: string; targetCoeff: number; z?: undefined; diatomic?: undefined }
  | { compoundId?: undefined; z: number; diatomic?: boolean; targetCoeff: number }

export type ScientificReactorRecipe = {
  productId: string
  left: readonly SciLeftSpec[]
  coProducts: readonly SciCoProductSpec[]
  productTargetCoeff: number
  titleRu: string
  /**
   * Только экран реакции «шарами» (ионы, электроны, органика, простое вещество-продукт):
   * уравнивать можно, запуск синтеза недоступен — анимация этой реакции появится позже.
   */
  stageOnly?: boolean
  /**
   * Место главного продукта среди продуктов уравнения учебника (0 — первый). Экран реакции ставит его
   * туда же, а не в конец: «NaOH + HCl → NaCl + H₂O», а не «→ H₂O + NaCl». Нет — главный продукт последний.
   */
  productIndex?: number
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
    if (cp.compoundId != null) {
      const compound = compoundById[cp.compoundId]
      if (!compound) continue
      mergeComp(out, compound.composition, cp.coeff)
      continue
    }
    const el = getElementByZ(cp.z)
    if (!el) continue
    mergeComp(out, { [el.symbol]: cp.diatomic ? 2 : 1 }, cp.coeff)
  }
  return out
}

function sameCoProduct(term: ReactorCoProductTerm, spec: SciCoProductSpec): boolean {
  if (spec.compoundId != null) return term.compoundId === spec.compoundId
  return term.compoundId == null && term.z === spec.z && Boolean(term.diatomic) === Boolean(spec.diatomic)
}

/**
 * Сид уравнения.
 * withTargetCoeffs=false → все коэфф. = 1 (ученик балансирует до 2+1→2+2).
 */
export function seedScientificReactorEquation(
  productId: string,
  newId: () => string,
  opts?: { withTargetCoeffs?: boolean; recipe?: ScientificReactorRecipe | null },
): {
  leftTerms: ReactorEquationTerm[]
  coProducts: ReactorCoProductTerm[]
  productCoeff: number
} | null {
  const recipe = opts?.recipe ?? getScientificReactorRecipe(productId)
  if (!recipe || recipe.productId !== productId) return null
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
  const coProducts: ReactorCoProductTerm[] = recipe.coProducts.map((cp) =>
    cp.compoundId != null
      ? {
          id: newId(),
          compoundId: cp.compoundId,
          coeff: useTarget ? cp.targetCoeff : 1,
          locked: true,
        }
      : {
          id: newId(),
          z: cp.z,
          ...(cp.diatomic ? { diatomic: true as const } : {}),
          coeff: useTarget ? cp.targetCoeff : 1,
          locked: true,
        },
  )
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
  recipeOverride?: ScientificReactorRecipe | null,
): boolean {
  if (!product) return false
  const recipe = recipeOverride ?? getScientificReactorRecipe(product.id)
  if (!recipe || recipe.productId !== product.id) return false

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
    if (!sameCoProduct(coProducts[i]!, recipe.coProducts[i]!)) return false
  }

  const left = compositionFromScientificLeft(leftTerms, compoundById)
  if (!left) return false
  const right = compositionFromScientificRight(product, productCoeff, coProducts, compoundById)
  if (compositionKey(left) !== compositionKey(right)) return false
  // Ионы и электроны: заряд слева = заряд справа (Fe → Fe²⁺ + 2e⁻, а не + e⁻).
  return chargeOfScientificSide(leftTerms, compoundById) === chargeOfScientificRight(product, productCoeff, coProducts, compoundById)
}

/** Суммарный заряд левой части (ионы, электроны); у простых веществ и нейтральных веществ — 0. */
export function chargeOfScientificSide(
  terms: readonly { compoundId?: string; coeff: number }[],
  compoundById: Readonly<Record<string, CompoundDef>>,
): number {
  let q = 0
  for (const t of terms) {
    if (!t.compoundId) continue
    q += (compoundById[t.compoundId]?.charge ?? 0) * Math.max(0, Math.floor(t.coeff))
  }
  return q
}

/** Суммарный заряд правой части: главный продукт × коэффициент + побочные. */
export function chargeOfScientificRight(
  product: CompoundDef,
  productCoeff: number,
  coProducts: readonly ReactorCoProductTerm[],
  compoundById: Readonly<Record<string, CompoundDef>>,
): number {
  return (product.charge ?? 0) * Math.max(0, Math.floor(productCoeff)) + chargeOfScientificSide(coProducts, compoundById)
}

/** Текст уравнения рецепта с целевыми коэффициентами: «2NaClO₂ + Cl₂ → 2NaCl + 2ClO₂». */
export function formatScientificRecipeEquation(
  recipe: ScientificReactorRecipe,
  compoundById: Readonly<Record<string, CompoundDef>>,
): string {
  const k = (n: number) => (n === 1 ? '' : String(n))
  const elementText = (z: number, diatomic?: boolean) => {
    const sym = getElementByZ(z)?.symbol ?? '?'
    return diatomic ? `${sym}₂` : sym
  }
  const compoundText = (id: string) => compoundById[id]?.formulaUnicode ?? id
  const left = recipe.left.map((s) =>
    s.kind === 'compound' ? `${k(s.targetCoeff)}${compoundText(s.compoundId)}` : `${k(s.targetCoeff)}${elementText(s.z, s.diatomic)}`,
  )
  const right = [
    ...recipe.coProducts.map((s) =>
      s.compoundId != null
        ? `${k(s.targetCoeff)}${compoundText(s.compoundId)}`
        : `${k(s.targetCoeff)}${elementText(s.z, s.diatomic)}`,
    ),
    `${k(recipe.productTargetCoeff)}${compoundText(recipe.productId)}`,
  ]
  return `${left.join(' + ')} → ${right.join(' + ')}`
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
