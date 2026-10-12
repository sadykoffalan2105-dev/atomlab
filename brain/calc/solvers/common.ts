/**
 * Общие кусочки решателей: школьная M вещества, «газ ли это», переход m/V/N → n и обратно со строками шагов.
 */
import type { Lang } from '../../pipeline/normalize.ts'
import { NA, VM, molarMass } from '../constants.ts'
import { fnum, molarMassLine, unitLabel, type CalcValue, type Line } from '../format.ts'
import type { AskKind, Qty, Species } from '../parse.ts'

export const GASES = new Set([
  'H2', 'O2', 'N2', 'Cl2', 'F2', 'CO2', 'CO', 'CH4', 'NH3', 'SO2', 'NO', 'NO2', 'N2O', 'H2S', 'HCl', 'HBr', 'HI', 'C2H6', 'C2H4', 'C2H2', 'C3H8',
  'C3H6', 'C4H10', 'He', 'Ne', 'Ar', 'Kr', 'Xe', 'O3', 'PH3', 'SiH4',
])

export const Mof = (sp: Species): number | null => molarMass(sp.counts, 'school')

export const vm = (lang: Lang) => fnum(VM, lang)
export const na = (lang: Lang) => (lang === 'en' ? '6.02·10²³' : '6,02·10²³')

/** Величина в «Дано»: m(Zn) = 13 г, V(H₂) = 5,6 л, n = 2 моль, N = 1,2·10²³. */
export function givenOf(q: Qty, sp: Species | null): CalcValue {
  const s = sp ? `(${sp.pretty})` : ''
  if (q.unit === 'g') return { label: `m${s}`, value: q.value, unit: 'g' }
  if (q.unit === 'l') return { label: `V${s}`, value: q.value, unit: 'l' }
  if (q.unit === 'mol') return { label: `n${s}`, value: q.value, unit: 'mol' }
  if (q.unit === 'particles') return { label: `N${s}`, value: q.value, unit: 'none' }
  if (q.unit === 'pct') return { label: `ω${s}`, value: q.value, unit: 'pct' }
  if (q.unit === 'M') return { label: `C${s}`, value: q.value, unit: 'moll' }
  return { label: s, value: q.value, unit: 'none' }
}

/** n по данной величине (масса / объём газа н. у. / число частиц) + строки шагов. */
export function toMoles(q: Qty, sp: Species, steps: Line[]): number | null {
  const M = Mof(sp)
  if (q.unit === 'mol') return q.value
  if (q.unit === 'g') {
    if (M == null) return null
    const n = q.value / M
    steps.push(molarMassLine(sp.pretty, sp.counts))
    steps.push((l) => `n(${sp.pretty}) = m / M = ${fnum(q.value, l)} / ${fnum(M, l, 'M')} = ${fnum(n, l)} ${unitLabel('mol', l)}`)
    return n
  }
  if (q.unit === 'l' && sp.ascii === 'H2O') {
    // вода — жидкость: m = ρ·V (1 г/мл), а не Vm
    if (M == null) return null
    const m = q.value * 1000
    const n = m / M
    steps.push((l) => `m(H₂O) = ρ · V = 1 · ${fnum(m, l)} = ${fnum(m, l)} ${unitLabel('g', l)}`)
    steps.push(molarMassLine(sp.pretty, sp.counts))
    steps.push((l) => `n(H₂O) = ${fnum(m, l)} / ${fnum(M, l, 'M')} = ${fnum(n, l)} ${unitLabel('mol', l)}`)
    return n
  }
  if (q.unit === 'l') {
    if (!GASES.has(sp.ascii)) return null
    const n = q.value / VM
    steps.push((l) => `n(${sp.pretty}) = V / Vm = ${fnum(q.value, l)} / ${vm(l)} = ${fnum(n, l)} ${unitLabel('mol', l)}`)
    return n
  }
  if (q.unit === 'particles') {
    const n = q.value / NA
    steps.push((l) => `n(${sp.pretty}) = N / Nₐ = ${fnum(q.value, l)} / ${na(l)} = ${fnum(n, l)} ${unitLabel('mol', l)}`)
    return n
  }
  return null
}

/** Из n — искомые m/V/N (с шагами); M-строка добавляется, если её ещё нет. */
export function fromMoles(n: number, sp: Species, kinds: AskKind[], steps: Line[], answers: CalcValue[], opts: { mLine?: boolean } = {}): boolean {
  const M = Mof(sp)
  let any = false
  for (const k of kinds) {
    if (k === 'mass') {
      if (M == null) return false
      const m = n * M
      if (opts.mLine !== false) steps.push(molarMassLine(sp.pretty, sp.counts))
      steps.push((l) => `m(${sp.pretty}) = n · M = ${fnum(n, l)} · ${fnum(M, l, 'M')} = ${fnum(m, l)} ${unitLabel('g', l)}`)
      answers.push({ label: `m(${sp.pretty})`, value: m, unit: 'g' })
      any = true
    } else if (k === 'volume') {
      if (!GASES.has(sp.ascii)) return false
      const V = n * VM
      steps.push((l) => `V(${sp.pretty}) = n · Vm = ${fnum(n, l)} · ${vm(l)} = ${fnum(V, l)} ${unitLabel('l', l)}`)
      answers.push({ label: `V(${sp.pretty})`, value: V, unit: 'l' })
      any = true
    } else if (k === 'mol') {
      answers.push({ label: `n(${sp.pretty})`, value: n, unit: 'mol' })
      any = true
    } else if (k === 'particles') {
      const N = n * NA
      steps.push((l) => `N(${sp.pretty}) = n · Nₐ = ${fnum(n, l)} · ${na(l)} = ${fnum(N, l)}`)
      answers.push({ label: `N(${sp.pretty})`, value: N, unit: 'none' })
      any = true
    }
  }
  return any
}

/** Вид величины → AskKind. */
export const kindOf = (q: Qty): AskKind | null => (q.unit === 'g' ? 'mass' : q.unit === 'l' ? 'volume' : q.unit === 'mol' ? 'mol' : q.unit === 'particles' ? 'particles' : null)

/** Близко к целому (для подбора индексов формулы). */
export const nearInt = (x: number, tol = 0.1) => Math.abs(x - Math.round(x)) <= tol

const SUBS = '₀₁₂₃₄₅₆₇₈₉'
/** {C:2,H:4} → «C₂H₄» (порядок: C, H, затем по алфавиту; для неорганики — как пришло). */
export function formulaOf(counts: Record<string, number>, order?: string[]): string {
  const keys = order ?? Object.keys(counts)
  return keys
    .filter((k) => counts[k])
    .map((k) => `${k}${counts[k]! > 1 ? [...String(counts[k])].map((d) => SUBS[Number(d)]!).join('') : ''}`)
    .join('')
}
