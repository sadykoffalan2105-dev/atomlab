/** Подсчёт атомов и проверка коэффициентов (7 класс, простые вещества O₂, N₂, O₃). */

export type BalanceSideTerm = {
  id: string
  /** ASCII: H2, O2, Fe2O3, NH3 */
  formula: string
  /** Простое двухатомное вещество (O2, N2, H2, Cl2) — коэффициент × молекула */
  diatomic?: boolean
  valencyKey?: string
}

export type BalanceLesson = {
  id: string
  titleKey: string
  /** Unicode для отображения */
  equationDisplay: string
  left: readonly BalanceSideTerm[]
  right: readonly BalanceSideTerm[]
  /** id термина → правильный коэффициент */
  correct: Readonly<Record<string, number>>
  stepKeys: readonly string[]
  diatomicNoteKey?: string
  labProductId?: string
}

const SUB = '₀₁₂₃₄₅₆₇₈₉'

export function toSubscript(n: number): string {
  if (n <= 1) return ''
  return String(n)
    .split('')
    .map((d) => SUB[Number(d)] ?? d)
    .join('')
}

export function asciiToUnicodeFormula(formula: string): string {
  return formula.replace(/(\d+)/g, (_, d: string) => toSubscript(Number(d)))
}

/** Разбор формулы без скобок и зарядов (школьный уровень). */
export function parseFormulaCounts(formula: string): Record<string, number> {
  const norm = formula.trim().replace(/[\u2080-\u2089]/g, (ch) => String(SUB.indexOf(ch)))
  const out: Record<string, number> = {}
  const re = /([A-Z][a-z]?)(\d*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(norm))) {
    const sym = m[1]!
    const n = m[2] ? Number(m[2]) : 1
    out[sym] = (out[sym] ?? 0) + n
  }
  return out
}

export function termAtomCounts(term: BalanceSideTerm, coeff: number): Record<string, number> {
  const k = Math.max(0, Math.floor(coeff))
  if (k <= 0) return {}
  const base = parseFormulaCounts(term.formula)
  const out: Record<string, number> = {}
  for (const [sym, n] of Object.entries(base)) {
    out[sym] = n * k
  }
  return out
}

function mergeCounts(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = { ...a }
  for (const [sym, n] of Object.entries(b)) {
    out[sym] = (out[sym] ?? 0) + n
  }
  return out
}

export function sideAtomCounts(
  terms: readonly BalanceSideTerm[],
  coeffs: Readonly<Record<string, number>>,
): Record<string, number> {
  let total: Record<string, number> = {}
  for (const term of terms) {
    total = mergeCounts(total, termAtomCounts(term, coeffs[term.id] ?? 1))
  }
  return total
}

export function isEquationBalanced(
  left: readonly BalanceSideTerm[],
  right: readonly BalanceSideTerm[],
  coeffs: Readonly<Record<string, number>>,
): boolean {
  const l = sideAtomCounts(left, coeffs)
  const r = sideAtomCounts(right, coeffs)
  const symbols = new Set([...Object.keys(l), ...Object.keys(r)])
  for (const sym of symbols) {
    if ((l[sym] ?? 0) !== (r[sym] ?? 0)) return false
  }
  return symbols.size > 0
}

export function formatEquationSide(
  terms: readonly BalanceSideTerm[],
  coeffs: Readonly<Record<string, number>>,
  hideCoeffs = false,
): string {
  return terms
    .map((t) => {
      const c = coeffs[t.id] ?? 1
      const coeffStr = hideCoeffs || c === 1 ? '' : String(c)
      return `${coeffStr}${asciiToUnicodeFormula(t.formula)}`
    })
    .join(' + ')
}

export function unbalancedElements(
  left: readonly BalanceSideTerm[],
  right: readonly BalanceSideTerm[],
  coeffs: Readonly<Record<string, number>>,
): string[] {
  const l = sideAtomCounts(left, coeffs)
  const r = sideAtomCounts(right, coeffs)
  const symbols = new Set([...Object.keys(l), ...Object.keys(r)])
  const bad: string[] = []
  for (const sym of symbols) {
    if ((l[sym] ?? 0) !== (r[sym] ?? 0)) bad.push(sym)
  }
  return bad.sort()
}

export const G7_BALANCE_LESSONS: readonly BalanceLesson[] = [
  {
    id: 'h2_o2_h2o',
    titleKey: 'learn.balance.lesson.h2o',
    equationDisplay: 'H₂ + O₂ → H₂O',
    left: [
      { id: 'h2', formula: 'H2', valencyKey: 'learn.balance.valency.h' },
      { id: 'o2', formula: 'O2', diatomic: true, valencyKey: 'learn.balance.valency.o2' },
    ],
    right: [{ id: 'h2o', formula: 'H2O', valencyKey: 'learn.balance.valency.h2o' }],
    correct: { h2: 2, o2: 1, h2o: 2 },
    stepKeys: [
      'learn.balance.step.h2o.s1',
      'learn.balance.step.h2o.s2',
      'learn.balance.step.h2o.s3',
      'learn.balance.step.h2o.s4',
    ],
    diatomicNoteKey: 'learn.balance.note.diatomic',
    labProductId: 'water',
  },
  {
    id: 'fe_o2_fe2o3',
    titleKey: 'learn.balance.lesson.rust',
    equationDisplay: 'Fe + O₂ → Fe₂O₃',
    left: [
      { id: 'fe', formula: 'Fe', valencyKey: 'learn.balance.valency.fe' },
      { id: 'o2', formula: 'O2', diatomic: true, valencyKey: 'learn.balance.valency.o2' },
    ],
    right: [{ id: 'fe2o3', formula: 'Fe2O3', valencyKey: 'learn.balance.valency.fe2o3' }],
    correct: { fe: 4, o2: 3, fe2o3: 2 },
    stepKeys: [
      'learn.balance.step.rust.s1',
      'learn.balance.step.rust.s2',
      'learn.balance.step.rust.s3',
      'learn.balance.step.rust.s4',
    ],
    diatomicNoteKey: 'learn.balance.note.diatomic',
    labProductId: 'iron_oxide',
  },
  {
    id: 'n2_h2_nh3',
    titleKey: 'learn.balance.lesson.nh3',
    equationDisplay: 'N₂ + H₂ → NH₃',
    left: [
      { id: 'n2', formula: 'N2', diatomic: true, valencyKey: 'learn.balance.valency.n2' },
      { id: 'h2', formula: 'H2', diatomic: true, valencyKey: 'learn.balance.valency.h2' },
    ],
    right: [{ id: 'nh3', formula: 'NH3', valencyKey: 'learn.balance.valency.nh3' }],
    correct: { n2: 1, h2: 3, nh3: 2 },
    stepKeys: [
      'learn.balance.step.nh3.s1',
      'learn.balance.step.nh3.s2',
      'learn.balance.step.nh3.s3',
    ],
    diatomicNoteKey: 'learn.balance.note.diatomicBoth',
    labProductId: 'ammonia',
  },
  {
    id: 'c_o2_co2',
    titleKey: 'learn.balance.lesson.co2',
    equationDisplay: 'C + O₂ → CO₂',
    left: [
      { id: 'c', formula: 'C', valencyKey: 'learn.balance.valency.c' },
      { id: 'o2', formula: 'O2', diatomic: true, valencyKey: 'learn.balance.valency.o2' },
    ],
    right: [{ id: 'co2', formula: 'CO2', valencyKey: 'learn.balance.valency.co2' }],
    correct: { c: 1, o2: 1, co2: 1 },
    stepKeys: ['learn.balance.step.co2.s1', 'learn.balance.step.co2.s2', 'learn.balance.step.co2.s3'],
    diatomicNoteKey: 'learn.balance.note.diatomic',
    labProductId: 'co2',
  },
  {
    id: 'al_o2_al2o3',
    titleKey: 'learn.balance.lesson.al2o3',
    equationDisplay: 'Al + O₂ → Al₂O₃',
    left: [
      { id: 'al', formula: 'Al', valencyKey: 'learn.balance.valency.al' },
      { id: 'o2', formula: 'O2', diatomic: true, valencyKey: 'learn.balance.valency.o2' },
    ],
    right: [{ id: 'al2o3', formula: 'Al2O3', valencyKey: 'learn.balance.valency.al2o3' }],
    correct: { al: 4, o2: 3, al2o3: 2 },
    stepKeys: [
      'learn.balance.step.al2o3.s1',
      'learn.balance.step.al2o3.s2',
      'learn.balance.step.al2o3.s3',
    ],
    diatomicNoteKey: 'learn.balance.note.diatomic',
  },
  {
    id: 's_o2_so2',
    titleKey: 'learn.balance.lesson.so2',
    equationDisplay: 'S + O₂ → SO₂',
    left: [
      { id: 's', formula: 'S', valencyKey: 'learn.balance.valency.s' },
      { id: 'o2', formula: 'O2', diatomic: true, valencyKey: 'learn.balance.valency.o2' },
    ],
    right: [{ id: 'so2', formula: 'SO2', valencyKey: 'learn.balance.valency.so2' }],
    correct: { s: 1, o2: 1, so2: 1 },
    stepKeys: ['learn.balance.step.so2.s1', 'learn.balance.step.so2.s2'],
    diatomicNoteKey: 'learn.balance.note.diatomic',
  },
  {
    id: 'o3_o2',
    titleKey: 'learn.balance.lesson.ozone',
    equationDisplay: 'O₃ → O₂',
    left: [{ id: 'o3', formula: 'O3', valencyKey: 'learn.balance.valency.o3' }],
    right: [{ id: 'o2', formula: 'O2', diatomic: true, valencyKey: 'learn.balance.valency.o2' }],
    correct: { o3: 2, o2: 3 },
    stepKeys: [
      'learn.balance.step.ozone.s1',
      'learn.balance.step.ozone.s2',
      'learn.balance.step.ozone.s3',
    ],
    diatomicNoteKey: 'learn.balance.note.ozone',
  },
] as const

export function initialCoeffs(lesson: BalanceLesson): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of [...lesson.left, ...lesson.right]) out[t.id] = 1
  return out
}

export function coeffsMatch(
  user: Readonly<Record<string, number>>,
  correct: Readonly<Record<string, number>>,
): boolean {
  const ids = Object.keys(correct)
  if (ids.length === 0) return false

  const normalize = (src: Readonly<Record<string, number>>) => {
    const g = ids.reduce((acc, id) => gcd(acc, src[id] ?? 1), src[ids[0]!] ?? 1)
    return ids.map((id) => (src[id] ?? 1) / g)
  }

  const nu = normalize(user)
  const nc = normalize(correct)
  return nu.every((v, i) => v === nc[i])
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}

export function checkBalanceAnswer(
  lesson: BalanceLesson,
  coeffs: Readonly<Record<string, number>>,
): { ok: boolean; balanced: boolean; proportional: boolean } {
  const balanced = isEquationBalanced(lesson.left, lesson.right, coeffs)
  const proportional = coeffsMatch(coeffs, lesson.correct)
  return { ok: balanced && proportional, balanced, proportional }
}
