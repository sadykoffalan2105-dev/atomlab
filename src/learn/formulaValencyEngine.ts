/** Составление формул по валентности (крест-метод, 7 класс). */

const SUB = '₀₁₂₃₄₅₆₇₈₉'

export function toSubscript(n: number): string {
  if (n <= 1) return ''
  return String(n)
    .split('')
    .map((d) => SUB[Number(d)] ?? d)
    .join('')
}

export function formatFormulaUnicode(formula: string): string {
  return formula.replace(/(\d+)/g, (_, d: string) => toSubscript(Number(d)))
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

/** Крест-метод: валентности → индексы в формуле (металл/положительный первым). */
export function composeByValency(
  symbolA: string,
  valencyA: number,
  symbolB: string,
  valencyB: number,
): string {
  if (valencyA <= 0 || valencyB <= 0) return ''
  const g = gcd(valencyA, valencyB)
  const idxA = valencyB / g
  const idxB = valencyA / g
  return `${symbolA}${toSubscript(idxA)}${symbolB}${toSubscript(idxB)}`
}

/** Нормализация ответа ученика: H2O, h2o, H₂O → H2O */
export function normalizeFormulaAnswer(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, '')
    .replace(/[\u2080-\u2089]/g, (ch) => String(SUB.indexOf(ch)))
    .replace(/([A-Z][a-z]?)(\d*)/g, (_, sym: string, num: string) => {
      const n = num ? Number(num) : 1
      return n > 1 ? `${sym}${n}` : sym
    })
}

export function formulasMatch(user: string, expected: string): boolean {
  const norm = (s: string) => normalizeFormulaAnswer(s).toLowerCase()
  const u = norm(user)
  const variants = new Set([expected, expected.replace('(OH)2', 'OH2'), expected.replace('(OH)3', 'OH3')])
  for (const v of variants) {
    if (u === norm(v)) return true
  }
  return false
}

export type FormulaLessonItem = {
  id: string
  topicId: string
  nameKey: string
  elementA: string
  valencyA: number
  elementB: string
  valencyB: number
  formula: string
  noteKey: string
}

export type FormulaTopic = {
  id: string
  titleKey: string
  leadKey: string
}

export const G7_FORMULA_TOPICS: readonly FormulaTopic[] = [
  { id: 'oxides', titleKey: 'learn.formulas.topic.oxides', leadKey: 'learn.formulas.topic.oxidesLead' },
  { id: 'bases', titleKey: 'learn.formulas.topic.bases', leadKey: 'learn.formulas.topic.basesLead' },
  { id: 'acids', titleKey: 'learn.formulas.topic.acids', leadKey: 'learn.formulas.topic.acidsLead' },
  { id: 'salts', titleKey: 'learn.formulas.topic.salts', leadKey: 'learn.formulas.topic.saltsLead' },
  { id: 'task', titleKey: 'learn.formulas.topic.task', leadKey: 'learn.formulas.topic.taskLead' },
] as const

export const G7_FORMULA_LESSONS: readonly FormulaLessonItem[] = [
  {
    id: 'na2o',
    topicId: 'oxides',
    nameKey: 'learn.formulas.item.na2o',
    elementA: 'Na',
    valencyA: 1,
    elementB: 'O',
    valencyB: 2,
    formula: 'Na2O',
    noteKey: 'learn.formulas.note.na2o',
  },
  {
    id: 'mgo',
    topicId: 'oxides',
    nameKey: 'learn.formulas.item.mgo',
    elementA: 'Mg',
    valencyA: 2,
    elementB: 'O',
    valencyB: 2,
    formula: 'MgO',
    noteKey: 'learn.formulas.note.mgo',
  },
  {
    id: 'al2o3',
    topicId: 'oxides',
    nameKey: 'learn.formulas.item.al2o3',
    elementA: 'Al',
    valencyA: 3,
    elementB: 'O',
    valencyB: 2,
    formula: 'Al2O3',
    noteKey: 'learn.formulas.note.al2o3',
  },
  {
    id: 'fe2o3',
    topicId: 'oxides',
    nameKey: 'learn.formulas.item.fe2o3',
    elementA: 'Fe',
    valencyA: 3,
    elementB: 'O',
    valencyB: 2,
    formula: 'Fe2O3',
    noteKey: 'learn.formulas.note.fe2o3',
  },
  {
    id: 'cao',
    topicId: 'oxides',
    nameKey: 'learn.formulas.item.cao',
    elementA: 'Ca',
    valencyA: 2,
    elementB: 'O',
    valencyB: 2,
    formula: 'CaO',
    noteKey: 'learn.formulas.note.cao',
  },
  {
    id: 'naoh',
    topicId: 'bases',
    nameKey: 'learn.formulas.item.naoh',
    elementA: 'Na',
    valencyA: 1,
    elementB: 'OH',
    valencyB: 1,
    formula: 'NaOH',
    noteKey: 'learn.formulas.note.naoh',
  },
  {
    id: 'caoh2',
    topicId: 'bases',
    nameKey: 'learn.formulas.item.caoh2',
    elementA: 'Ca',
    valencyA: 2,
    elementB: 'OH',
    valencyB: 1,
    formula: 'Ca(OH)2',
    noteKey: 'learn.formulas.note.caoh2',
  },
  {
    id: 'aloh3',
    topicId: 'bases',
    nameKey: 'learn.formulas.item.aloh3',
    elementA: 'Al',
    valencyA: 3,
    elementB: 'OH',
    valencyB: 1,
    formula: 'Al(OH)3',
    noteKey: 'learn.formulas.note.aloh3',
  },
  {
    id: 'hcl',
    topicId: 'acids',
    nameKey: 'learn.formulas.item.hcl',
    elementA: 'H',
    valencyA: 1,
    elementB: 'Cl',
    valencyB: 1,
    formula: 'HCl',
    noteKey: 'learn.formulas.note.hcl',
  },
  {
    id: 'h2so4',
    topicId: 'acids',
    nameKey: 'learn.formulas.item.h2so4',
    elementA: 'H',
    valencyA: 1,
    elementB: 'SO4',
    valencyB: 2,
    formula: 'H2SO4',
    noteKey: 'learn.formulas.note.h2so4',
  },
  {
    id: 'hno3',
    topicId: 'acids',
    nameKey: 'learn.formulas.item.hno3',
    elementA: 'H',
    valencyA: 1,
    elementB: 'NO3',
    valencyB: 1,
    formula: 'HNO3',
    noteKey: 'learn.formulas.note.hno3',
  },
  {
    id: 'nacl',
    topicId: 'salts',
    nameKey: 'learn.formulas.item.nacl',
    elementA: 'Na',
    valencyA: 1,
    elementB: 'Cl',
    valencyB: 1,
    formula: 'NaCl',
    noteKey: 'learn.formulas.note.nacl',
  },
  {
    id: 'caco3',
    topicId: 'salts',
    nameKey: 'learn.formulas.item.caco3',
    elementA: 'Ca',
    valencyA: 2,
    elementB: 'CO3',
    valencyB: 2,
    formula: 'CaCO3',
    noteKey: 'learn.formulas.note.caco3',
  },
  {
    id: 'fecl3',
    topicId: 'salts',
    nameKey: 'learn.formulas.item.fecl3',
    elementA: 'Fe',
    valencyA: 3,
    elementB: 'Cl',
    valencyB: 1,
    formula: 'FeCl3',
    noteKey: 'learn.formulas.note.fecl3',
  },
  {
    id: 'nh3',
    topicId: 'task',
    nameKey: 'learn.formulas.item.nh3',
    elementA: 'N',
    valencyA: 3,
    elementB: 'H',
    valencyB: 1,
    formula: 'NH3',
    noteKey: 'learn.formulas.note.nh3',
  },
  {
    id: 'h2o',
    topicId: 'task',
    nameKey: 'learn.formulas.item.h2o',
    elementA: 'H',
    valencyA: 1,
    elementB: 'O',
    valencyB: 2,
    formula: 'H2O',
    noteKey: 'learn.formulas.note.h2o',
  },
] as const

export function lessonsForTopic(topicId: string): FormulaLessonItem[] {
  return G7_FORMULA_LESSONS.filter((l) => l.topicId === topicId)
}

export function pickFormulaPractice(topicId?: string): FormulaLessonItem {
  const pool = topicId ? lessonsForTopic(topicId) : [...G7_FORMULA_LESSONS]
  return pool[Math.floor(Math.random() * pool.length)]!
}
