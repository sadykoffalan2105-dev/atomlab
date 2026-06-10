/** Формулы и задачи для расчётов 7 класса (моль, масса, N_A, объём газа и т.д.). */

export type ChemFormulaCard = {
  id: string
  titleKey: string
  leadKey: string
  /** Крупная формула для карточки (Unicode). */
  mainFormula: string
  variableKeys: readonly string[]
  transformKeys?: readonly string[]
  exampleKey?: string
}

export type ChemWorkedStep = {
  textKey: string
  formula?: string
}

export type ChemWorkedExample = {
  id: string
  titleKey: string
  givenKeys: readonly string[]
  findKey: string
  steps: readonly ChemWorkedStep[]
  answerKey: string
}

export type ChemPracticeTask = {
  id: string
  formulaId: string
  questionKey: string
  /** Подстановка в questionKey. */
  params: Record<string, string>
  correctAnswer: number
  tolerance: number
  unitKey: string
  hintKeys: readonly string[]
}

export const CHEM_FORMULAS: readonly ChemFormulaCard[] = [
  {
    id: 'ar',
    titleKey: 'learn.problems.formula.ar.title',
    leadKey: 'learn.problems.formula.ar.lead',
    mainFormula: 'Aᵣ(X) = mₐ(X) / u',
    variableKeys: [
      'learn.problems.formula.ar.v1',
      'learn.problems.formula.ar.v2',
      'learn.problems.formula.ar.v3',
    ],
    exampleKey: 'learn.problems.formula.ar.example',
  },
  {
    id: 'mr',
    titleKey: 'learn.problems.formula.mr.title',
    leadKey: 'learn.problems.formula.mr.lead',
    mainFormula: 'Mᵣ = Σ Aᵣ',
    variableKeys: [
      'learn.problems.formula.mr.v1',
      'learn.problems.formula.mr.v2',
    ],
    exampleKey: 'learn.problems.formula.mr.example',
  },
  {
    id: 'omega',
    titleKey: 'learn.problems.formula.omega.title',
    leadKey: 'learn.problems.formula.omega.lead',
    mainFormula: 'ω(E) = n · Aᵣ(E) / Mᵣ · 100%',
    variableKeys: [
      'learn.problems.formula.omega.v1',
      'learn.problems.formula.omega.v2',
      'learn.problems.formula.omega.v3',
      'learn.problems.formula.omega.v4',
    ],
    transformKeys: ['learn.problems.formula.omega.t1'],
  },
  {
    id: 'n',
    titleKey: 'learn.problems.formula.n.title',
    leadKey: 'learn.problems.formula.n.lead',
    mainFormula: 'n = m / M',
    variableKeys: [
      'learn.problems.formula.n.v1',
      'learn.problems.formula.n.v2',
      'learn.problems.formula.n.v3',
    ],
    transformKeys: [
      'learn.problems.formula.n.t1',
      'learn.problems.formula.n.t2',
    ],
  },
  {
    id: 'N',
    titleKey: 'learn.problems.formula.N.title',
    leadKey: 'learn.problems.formula.N.lead',
    mainFormula: 'N = n · N_A',
    variableKeys: [
      'learn.problems.formula.N.v1',
      'learn.problems.formula.N.v2',
      'learn.problems.formula.N.v3',
    ],
    transformKeys: ['learn.problems.formula.N.t1'],
  },
  {
    id: 'V',
    titleKey: 'learn.problems.formula.V.title',
    leadKey: 'learn.problems.formula.V.lead',
    mainFormula: 'V = n · 22,4',
    variableKeys: [
      'learn.problems.formula.V.v1',
      'learn.problems.formula.V.v2',
    ],
    transformKeys: ['learn.problems.formula.V.t1'],
  },
  {
    id: 'rho',
    titleKey: 'learn.problems.formula.rho.title',
    leadKey: 'learn.problems.formula.rho.lead',
    mainFormula: 'ρ = m / V',
    variableKeys: [
      'learn.problems.formula.rho.v1',
      'learn.problems.formula.rho.v2',
      'learn.problems.formula.rho.v3',
    ],
    transformKeys: [
      'learn.problems.formula.rho.t1',
      'learn.problems.formula.rho.t2',
    ],
  },
] as const

export const CHEM_WORKED_EXAMPLES: readonly ChemWorkedExample[] = [
  {
    id: 'n_to_N_carbon',
    titleKey: 'learn.problems.example.nToN.title',
    givenKeys: ['learn.problems.example.nToN.g1'],
    findKey: 'learn.problems.example.nToN.find',
    steps: [
      { textKey: 'learn.problems.example.nToN.s1', formula: 'N = n · N_A' },
      {
        textKey: 'learn.problems.example.nToN.s2',
        formula: 'N(C) = 2 · 6,02 · 10²³ = 12,04 · 10²³',
      },
    ],
    answerKey: 'learn.problems.example.nToN.answer',
  },
  {
    id: 'h_in_water',
    titleKey: 'learn.problems.example.hInWater.title',
    givenKeys: ['learn.problems.example.hInWater.g1'],
    findKey: 'learn.problems.example.hInWater.find',
    steps: [
      { textKey: 'learn.problems.example.hInWater.s1', formula: 'Mᵣ(H₂O) = 2·1 + 16 = 18' },
      { textKey: 'learn.problems.example.hInWater.s2' },
      { textKey: 'learn.problems.example.hInWater.s3', formula: '18 : 4,5 = 2 : x → x = 0,5' },
    ],
    answerKey: 'learn.problems.example.hInWater.answer',
  },
  {
    id: 'co2_molecules',
    titleKey: 'learn.problems.example.co2N.title',
    givenKeys: ['learn.problems.example.co2N.g1'],
    findKey: 'learn.problems.example.co2N.find',
    steps: [
      { textKey: 'learn.problems.example.co2N.s1', formula: 'M(CO₂) = 12 + 16·2 = 44 г/моль' },
      { textKey: 'learn.problems.example.co2N.s2', formula: 'n = m / M = 11 / 44 = 0,25 моль' },
      { textKey: 'learn.problems.example.co2N.s3', formula: 'N = n · N_A' },
    ],
    answerKey: 'learn.problems.example.co2N.answer',
  },
  {
    id: 'gas_ratio',
    titleKey: 'learn.problems.example.gasRatio.title',
    givenKeys: [
      'learn.problems.example.gasRatio.g1',
      'learn.problems.example.gasRatio.g2',
    ],
    findKey: 'learn.problems.example.gasRatio.find',
    steps: [
      { textKey: 'learn.problems.example.gasRatio.s1', formula: 'm = ρ · V' },
      {
        textKey: 'learn.problems.example.gasRatio.s2',
        formula: 'm(H₂) : m(O₂) = (0,089·2) : (1,429·1) ≈ 1 : 8',
      },
    ],
    answerKey: 'learn.problems.example.gasRatio.answer',
  },
  {
    id: 'mass_table',
    titleKey: 'learn.problems.example.table.title',
    givenKeys: ['learn.problems.example.table.g1'],
    findKey: 'learn.problems.example.table.find',
    steps: [
      { textKey: 'learn.problems.example.table.s1', formula: 'N = N_A · n' },
      { textKey: 'learn.problems.example.table.s2', formula: 'm = M · n' },
      { textKey: 'learn.problems.example.table.s3' },
    ],
    answerKey: 'learn.problems.example.table.answer',
  },
] as const

export const CHEM_PRACTICE_TASKS: readonly ChemPracticeTask[] = [
  {
    id: 'pr_n_from_m',
    formulaId: 'n',
    questionKey: 'learn.problems.practice.nFromM.q',
    params: { m: '9', substance: 'H₂O', M: '18' },
    correctAnswer: 0.5,
    tolerance: 0.02,
    unitKey: 'learn.problems.unit.mol',
    hintKeys: ['learn.problems.practice.nFromM.h1', 'learn.problems.practice.nFromM.h2'],
  },
  {
    id: 'pr_N_from_n',
    formulaId: 'N',
    questionKey: 'learn.problems.practice.NFromN.q',
    params: { n: '3' },
    correctAnswer: 18.06,
    tolerance: 0.5,
    unitKey: 'learn.problems.unit.10e23',
    hintKeys: ['learn.problems.practice.NFromN.h1', 'learn.problems.practice.NFromN.h2'],
  },
  {
    id: 'pr_V_gas',
    formulaId: 'V',
    questionKey: 'learn.problems.practice.VFromN.q',
    params: { n: '2', gas: 'O₂' },
    correctAnswer: 44.8,
    tolerance: 0.5,
    unitKey: 'learn.problems.unit.l',
    hintKeys: ['learn.problems.practice.VFromN.h1', 'learn.problems.practice.VFromN.h2'],
  },
  {
    id: 'pr_mr_h2so4',
    formulaId: 'mr',
    questionKey: 'learn.problems.practice.mr.q',
    params: { formula: 'H₂SO₄' },
    correctAnswer: 98,
    tolerance: 0,
    unitKey: 'learn.problems.unit.gPerMol',
    hintKeys: ['learn.problems.practice.mr.h1', 'learn.problems.practice.mr.h2'],
  },
  {
    id: 'pr_omega_h',
    formulaId: 'omega',
    questionKey: 'learn.problems.practice.omegaH.q',
    params: { substance: 'H₂O' },
    correctAnswer: 11.11,
    tolerance: 0.5,
    unitKey: 'learn.problems.unit.percent',
    hintKeys: ['learn.problems.practice.omegaH.h1', 'learn.problems.practice.omegaH.h2'],
  },
  {
    id: 'pr_co2_n',
    formulaId: 'n',
    questionKey: 'learn.problems.practice.co2N.q',
    params: { m: '22' },
    correctAnswer: 0.5,
    tolerance: 0.02,
    unitKey: 'learn.problems.unit.mol',
    hintKeys: ['learn.problems.practice.co2N.h1', 'learn.problems.practice.co2N.h2'],
  },
] as const

export function parseNumericAnswer(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function answersMatch(user: number, expected: number, tolerance: number): boolean {
  return Math.abs(user - expected) <= tolerance
}

export function pickPracticeTask(formulaId?: string): ChemPracticeTask {
  const pool = formulaId
    ? CHEM_PRACTICE_TASKS.filter((t) => t.formulaId === formulaId)
    : CHEM_PRACTICE_TASKS
  const list = pool.length > 0 ? pool : CHEM_PRACTICE_TASKS
  return list[Math.floor(Math.random() * list.length)]!
}

export function formulaById(id: string): ChemFormulaCard | undefined {
  return CHEM_FORMULAS.find((f) => f.id === id)
}
