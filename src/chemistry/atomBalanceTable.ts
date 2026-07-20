import type { CompoundDef } from '../types/chemistry'
import {
  compositionFromLeftTerms,
  compositionFromProduct,
  type ReactorEquationTerm,
} from './reactorEquationBalance'

export type AtomBalanceRow = {
  symbol: string
  left: number
  right: number
  balanced: boolean
}

export type AtomBalanceTable = {
  rows: AtomBalanceRow[]
  allBalanced: boolean
}

/** Живая таблица атомов слева/справа для метода подбора коэффициентов. */
export function buildAtomBalanceRows(
  leftTerms: readonly ReactorEquationTerm[],
  product: CompoundDef | null,
  productCoeff: number,
): AtomBalanceTable {
  const left = compositionFromLeftTerms(leftTerms) ?? {}
  const right = product ? compositionFromProduct(product, productCoeff) : {}
  const symbols = new Set([...Object.keys(left), ...Object.keys(right)])
  const rows: AtomBalanceRow[] = [...symbols]
    .sort((a, b) => a.localeCompare(b))
    .map((symbol) => {
      const L = left[symbol] ?? 0
      const R = right[symbol] ?? 0
      return { symbol, left: L, right: R, balanced: L > 0 && R > 0 && L === R }
    })
  const allBalanced =
    rows.length > 0 &&
    rows.every((r) => r.balanced) &&
    Object.keys(left).length > 0 &&
    Object.keys(right).length > 0
  return { rows, allBalanced }
}
