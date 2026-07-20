import type { CompoundDef } from '../types/chemistry'
import { getElementByZ } from '../data/elements'
import type { ReactorEquationTerm } from './reactorEquationBalance'
import {
  oxidationForCompound,
  oxidationForElementTerm,
  type OxidationNumber,
} from './oxidationStateEngine'

export type ElectronHalfReaction = {
  symbol: string
  fromOx: OxidationNumber
  toOx: OxidationNumber
  /** Электроны на 1 атом: отрицательное = отдаёт (окисление). */
  electronsPerAtom: number
  kind: 'oxidation' | 'reduction'
  line: string
}

export type ElectronBalanceResult = {
  isRedox: boolean
  halfReactions: ElectronHalfReaction[]
  lcm: number
  suggestedLeft: Record<string, number>
  suggestedProductCoeff: number
  summaryLines: string[]
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a))
  let y = Math.abs(Math.round(b))
  while (y) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}

function lcm2(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b)
}

function formatOx(n: OxidationNumber): string {
  if (n === 0) return '0'
  return n > 0 ? `+${n}` : `${n}`
}

/**
 * Электронный баланс: элементы/X₂ → один продукт.
 * 1) SO реагентов = 0, SO в продукте из школьных правил
 * 2) e⁻ на атом → для X₂ умножаем на 2
 * 3) НОК → множители реагентов
 * 4) k продукта из состава; при дробях масштабируем до целых
 */
export function computeElectronBalance(
  leftTerms: readonly ReactorEquationTerm[],
  product: CompoundDef | null,
): ElectronBalanceResult | null {
  if (!product || leftTerms.length === 0) return null
  const productOx = oxidationForCompound(product)
  if (!productOx) return null

  const productOxBySymbol = new Map(productOx.labels.map((l) => [l.symbol, l.ox] as const))
  const halfReactions: ElectronHalfReaction[] = []

  for (const term of leftTerms) {
    const el = getElementByZ(term.z)
    if (!el) continue
    const toOx = productOxBySymbol.get(el.symbol)
    if (toOx == null || toOx === 0) continue
    const electronsPerAtom = 0 - toOx
    const kind: 'oxidation' | 'reduction' = electronsPerAtom < 0 ? 'oxidation' : 'reduction'
    const eAbs = Math.abs(electronsPerAtom)
    const line =
      kind === 'oxidation'
        ? `${el.symbol}⁰ → ${el.symbol}${formatOx(toOx)} + ${eAbs}e⁻`
        : `${el.symbol}⁰ + ${eAbs}e⁻ → ${el.symbol}${formatOx(toOx)}`
    halfReactions.push({
      symbol: el.symbol,
      fromOx: 0,
      toOx,
      electronsPerAtom,
      kind,
      line,
    })
  }

  const oxList = halfReactions.filter((h) => h.kind === 'oxidation')
  const redList = halfReactions.filter((h) => h.kind === 'reduction')
  if (oxList.length === 0 || redList.length === 0) {
    return {
      isRedox: false,
      halfReactions,
      lcm: 0,
      suggestedLeft: {},
      suggestedProductCoeff: 1,
      summaryLines: ['Реакция не выглядит как ОВР (нет пары окисление/восстановление).'],
    }
  }

  const oxH = oxList[0]!
  const redH = redList[0]!
  const oxTerm = leftTerms.find((t) => getElementByZ(t.z)?.symbol === oxH.symbol)
  const redTerm = leftTerms.find((t) => getElementByZ(t.z)?.symbol === redH.symbol)

  const eOxAtom = Math.abs(oxH.electronsPerAtom)
  const eRedAtom = Math.abs(redH.electronsPerAtom)
  const oxPerUnit = eOxAtom * (oxTerm?.diatomic ? 2 : 1)
  const redPerUnit = eRedAtom * (redTerm?.diatomic ? 2 : 1)
  const L = lcm2(oxPerUnit, redPerUnit)

  // Число единиц реагента (молекул X₂ или атомов X) после e-баланса
  let oxUnits = L / oxPerUnit
  let redUnits = L / redPerUnit

  // Атомы каждого элемента слева
  let oxAtoms = oxUnits * (oxTerm?.diatomic ? 2 : 1)
  let redAtoms = redUnits * (redTerm?.diatomic ? 2 : 1)

  const oxInP = Math.max(0, Math.floor(Number(product.composition[oxH.symbol] ?? 0)))
  const redInP = Math.max(0, Math.floor(Number(product.composition[redH.symbol] ?? 0)))

  // Масштаб, чтобы атомы делились на состав продукта
  let scale = 1
  for (let s = 1; s <= 12; s++) {
    const oa = oxAtoms * s
    const ra = redAtoms * s
    const okOx = oxInP === 0 || oa % oxInP === 0
    const okRed = redInP === 0 || ra % redInP === 0
    if (okOx && okRed) {
      const kOx = oxInP > 0 ? oa / oxInP : 0
      const kRed = redInP > 0 ? ra / redInP : 0
      if (oxInP > 0 && redInP > 0 && kOx !== kRed) continue
      scale = s
      break
    }
  }

  oxAtoms *= scale
  redAtoms *= scale
  oxUnits *= scale
  redUnits *= scale

  const productCoeff =
    oxInP > 0 ? oxAtoms / oxInP : redInP > 0 ? redAtoms / redInP : 1

  const suggestedLeft: Record<string, number> = {}
  if (oxTerm) suggestedLeft[oxTerm.id] = Math.max(1, Math.round(oxUnits))
  if (redTerm) suggestedLeft[redTerm.id] = Math.max(1, Math.round(redUnits))
  for (const t of leftTerms) {
    if (suggestedLeft[t.id] == null) suggestedLeft[t.id] = Math.max(1, Math.floor(t.coeff) || 1)
  }

  return {
    isRedox: true,
    halfReactions,
    lcm: L,
    suggestedLeft,
    suggestedProductCoeff: Math.max(1, Math.round(productCoeff)),
    summaryLines: [
      `Окисление: ${oxH.line}`,
      `Восстановление: ${redH.line}`,
      `НОК (на единицу реагента): ${L}`,
      `Коэффициенты: ${oxH.symbol}×${suggestedLeft[oxTerm?.id ?? ''] ?? '—'}, ${redH.symbol}×${suggestedLeft[redTerm?.id ?? ''] ?? '—'}, продукт×${Math.round(productCoeff)}`,
    ],
  }
}

export function isLikelyRedoxEquation(
  leftTerms: readonly ReactorEquationTerm[],
  product: CompoundDef | null,
): boolean {
  return Boolean(computeElectronBalance(leftTerms, product)?.isRedox)
}

export function describeLeftOxLabels(leftTerms: readonly ReactorEquationTerm[]): string[] {
  return leftTerms.map((t) => oxidationForElementTerm(t).formulaWithOx)
}
