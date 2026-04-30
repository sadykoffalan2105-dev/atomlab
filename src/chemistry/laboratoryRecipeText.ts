import type { RawCompoundDef } from '../types/chemistry'

function sortedComposition(comp: Record<string, number>): [string, number][] {
  return Object.entries(comp)
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => a.localeCompare(b))
}

const DIATOMIC = new Set(['H', 'N', 'O', 'F', 'Cl', 'Br', 'I'])

function gcd(a: number, b: number): number {
  let x = Math.abs(a | 0)
  let y = Math.abs(b | 0)
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

function gcdAll(nums: number[]): number {
  let g = 0
  for (const n of nums) g = g === 0 ? Math.abs(n) : gcd(g, n)
  return g || 1
}

function sub2(sym: string): string {
  return `${sym}₂`
}

/**
 * Короткое учебное уравнение: слева простые вещества (элементы),
 * справа вещество из каталога. Уравнение УРАВНЕННО.
 *
 * Важное правило: двухатомные элементы пишем как H₂, O₂, N₂, F₂, Cl₂, Br₂, I₂.
 */
export function buildDefaultLaboratoryRecipeRu(
  p: Pick<RawCompoundDef, 'composition' | 'formulaUnicode'>,
): string {
  const parts = sortedComposition(p.composition)
  if (parts.length === 0) return `= ${p.formulaUnicode}`

  // Choose minimal product coefficient to avoid fractions with diatomic reagents.
  // If any diatomic element appears an odd number of times in the product, multiply product by 2.
  let productCoeff = 1
  for (const [sym, n] of parts) {
    if (DIATOMIC.has(sym) && (n % 2 !== 0)) {
      productCoeff = 2
      break
    }
  }

  const reactants = parts.map(([sym, n]) => {
    const denom = DIATOMIC.has(sym) ? 2 : 1
    const coeff = (n * productCoeff) / denom
    return { sym, coeff: Math.round(coeff), diatomic: DIATOMIC.has(sym) }
  })

  // Reduce coefficients by gcd for a clean equation.
  const g = gcdAll([productCoeff, ...reactants.map((r) => r.coeff)])
  productCoeff = Math.max(1, Math.floor(productCoeff / g))
  for (const r of reactants) r.coeff = Math.max(1, Math.floor(r.coeff / g))

  const left = reactants
    .map((r) => {
      const sym = r.diatomic ? sub2(r.sym) : r.sym
      return `${r.coeff === 1 ? '' : String(r.coeff)}${sym}`
    })
    .join(' + ')

  const right = `${productCoeff === 1 ? '' : String(productCoeff)}${p.formulaUnicode}`
  return `${left} = ${right}`
}
