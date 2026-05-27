import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import { valencyBondDots } from '../data/elementValencySchool'

/** Сколько связей нужно отметить для слагаемого (школьная валентность). */
export function requiredValencyBonds(z: number): number {
  return valencyBondDots(z)
}

export function isTermValencyComplete(z: number, activeBonds: number): boolean {
  const need = requiredValencyBonds(z)
  if (need === 0) return true
  return activeBonds === need
}

export function areAllTermsValencyComplete(
  terms: readonly ReactorEquationTerm[],
  pins: Readonly<Record<string, number>>,
): boolean {
  if (terms.length === 0) return false
  return terms.every((t) => isTermValencyComplete(t.z, pins[t.id] ?? 0))
}

/** Синхронизировать карту отметок с текущими слагаемыми. */
export function syncValencyPins(
  terms: readonly ReactorEquationTerm[],
  prev: Record<string, number>,
): Record<string, number> {
  const next: Record<string, number> = {}
  for (const t of terms) {
    const need = requiredValencyBonds(t.z)
    const raw = prev[t.id] ?? 0
    next[t.id] = need === 0 ? 0 : Math.min(need, Math.max(0, raw))
  }
  return next
}
