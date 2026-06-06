import { learnSectionPathKey } from './learnFgosMatrix'
import type { SectionEquationEntry } from '../learn/topicQuizTypes'

const SECTION_EQUATIONS: Readonly<Record<string, readonly SectionEquationEntry[]>> = {
  // ——— 7 класс, глава I ———
  [learnSectionPathKey('g7', 'c1', 's01')]: [
    {
      equation: '2H₂ + O₂ → 2H₂O',
      productCompoundId: 'h2o',
      hint: 'Образование воды — простое соединение для начала курса.',
    },
  ],
  [learnSectionPathKey('g7', 'c1', 's02')]: [
    {
      equation: '2Na + Cl₂ → 2NaCl',
      productCompoundId: 'nacl',
      hint: 'Соединение металла и неметалла — пример чистого вещества.',
    },
  ],
  [learnSectionPathKey('g7', 'c1', 's03')]: [
    {
      equation: '2H₂ + O₂ → 2H₂O',
      productCompoundId: 'h2o',
      hint: 'Безопасный пример реакции для знакомства с кабинетом.',
    },
  ],
  [learnSectionPathKey('g7', 'c1', 's04')]: [
    {
      equation: '2Mg + O₂ → 2MgO',
      productCompoundId: 'mgo',
      hint: 'Горение магния на спиртовке — яркое пламя, белый оксид.',
    },
    {
      equation: 'C + O₂ → CO₂',
      productCompoundId: 'co2',
      hint: 'Горение угля — пример окисления простого вещества.',
    },
  ],
  [learnSectionPathKey('g7', 'c1', 's05')]: [
    {
      equation: 'HCl + NaOH → NaCl + H₂O',
      productCompoundId: 'nacl',
      hint: 'Из растворов получают чистую соль — пример для темы «смеси».',
    },
  ],
  [learnSectionPathKey('g7', 'c1', 's06')]: [
    {
      equation: 'HCl + NaOH → NaCl + H₂O',
      productCompoundId: 'nacl',
      hint: 'Нейтрализация — способ выделить чистую поваренную соль.',
    },
  ],
  [learnSectionPathKey('g7', 'c1', 's07')]: [
    {
      equation: '2H₂ + O₂ → 2H₂O',
      productCompoundId: 'h2o',
      hint: 'Вода в разных агрегатных состояниях — одно и то же вещество.',
    },
  ],
  [learnSectionPathKey('g7', 'c1', 's08')]: [
    {
      equation: 'CH₄ + 2O₂ → CO₂ + 2H₂O',
      productCompoundId: 'co2',
      hint: 'Горение метана — химическое явление, образуются новые вещества.',
    },
    {
      equation: '4Fe + 3O₂ → 2Fe₂O₃',
      productCompoundId: 'fe2o3',
      hint: 'Ржавление железа — медленное химическое явление.',
    },
  ],
  [learnSectionPathKey('g7', 'c1', 's09')]: [
    {
      equation: '4Fe + 3O₂ → 2Fe₂O₃',
      productCompoundId: 'fe2o3',
      hint: 'Ржавчина в быту — химический процесс.',
    },
    {
      equation: 'C + O₂ → CO₂',
      productCompoundId: 'co2',
      hint: 'Горение древесины — химия в повседневной жизни.',
    },
  ],
  [learnSectionPathKey('g7', 'c1', 's10')]: [
    {
      equation: '2H₂ + O₂ → 2H₂O',
      productCompoundId: 'h2o',
      hint: 'Повторение: составление уравнения синтеза воды.',
    },
    {
      equation: 'HCl + NaOH → NaCl + H₂O',
      productCompoundId: 'nacl',
      hint: 'Повторение: нейтрализация кислоты основанием.',
    },
  ],

  // ——— отдельные § других глав (как было) ———
  [learnSectionPathKey('g7', 'c2', 's12')]: [
    {
      equation: '2H₂ + O₂ → 2H₂O',
      productCompoundId: 'h2o',
      hint: 'Составьте коэффициенты для синтеза воды.',
    },
  ],
  [learnSectionPathKey('g7', 'c2', 's13')]: [
    {
      equation: '4Fe + 3O₂ → 2Fe₂O₃',
      productCompoundId: 'fe2o3',
      hint: 'Окисление железа — ржавление.',
    },
  ],
  [learnSectionPathKey('g7', 'c4', 's05')]: [
    {
      equation: '2Mg + O₂ → 2MgO',
      productCompoundId: 'mgo',
      hint: 'Горение магния даёт яркое пламя и белый оксид.',
    },
  ],
  [learnSectionPathKey('g7', 'c4', 's06')]: [
    {
      equation: 'C + O₂ → CO₂',
      productCompoundId: 'co2',
      hint: 'Горение угля на воздухе.',
    },
  ],
  [learnSectionPathKey('g7', 'c5', 's06')]: [
    {
      equation: 'Zn + 2HCl → ZnCl₂ + H₂',
      productCompoundId: 'hcl',
      hint: 'Кислота реагирует с металлом, выделяется водород.',
    },
  ],
  [learnSectionPathKey('g7', 'c6', 's05')]: [
    {
      equation: 'CaO + H₂O → Ca(OH)₂',
      productCompoundId: 'cao',
      hint: 'Основный оксид кальция гидратируется с выделением тепла.',
    },
  ],
  [learnSectionPathKey('g7', 'c6', 's06')]: [
    {
      equation: 'HCl + NaOH → NaCl + H₂O',
      productCompoundId: 'nacl',
      hint: 'Классическая нейтрализация кислоты основанием.',
    },
  ],
}

const DEFAULT_BY_CHAPTER: Readonly<Record<string, readonly SectionEquationEntry[]>> = {
  c1: [
    {
      equation: '2H₂ + O₂ → 2H₂O',
      productCompoundId: 'h2o',
      hint: 'Образование воды из простых веществ.',
    },
  ],
  c2: [
    {
      equation: '2H₂ + O₂ → 2H₂O',
      productCompoundId: 'h2o',
      hint: 'Проверьте баланс атомов H и O.',
    },
  ],
  c3: [
    {
      equation: '2Na + Cl₂ → 2NaCl',
      productCompoundId: 'nacl',
      hint: 'Соединение металла и неметалла.',
    },
  ],
  c4: [
    {
      equation: 'S + O₂ → SO₂',
      productCompoundId: 'so2',
      hint: 'Горение серы — оксид серы(IV).',
    },
  ],
  c5: [
    {
      equation: 'Zn + 2HCl → ZnCl₂ + H₂',
      productCompoundId: 'hcl',
      hint: 'Взаимодействие кислоты с металлом.',
    },
  ],
  c6: [
    {
      equation: 'HCl + NaOH → NaCl + H₂O',
      productCompoundId: 'nacl',
      hint: 'Нейтрализация — соль и вода.',
    },
  ],
  c7: [
    {
      equation: 'C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O',
      productCompoundId: 'co2',
      hint: 'Окисление глюкозы при дыхании.',
    },
  ],
  c8: [
    {
      equation: 'CaCO₃ → CaO + CO₂',
      productCompoundId: 'cao',
      hint: 'Разложение известняка при нагревании.',
    },
  ],
}

export type LearnEquationScope = {
  gradeId: string
  chapterId: string
  sectionId: string
}

export function getSectionEquations(
  gradeId: string,
  chapterId: string,
  sectionId: string,
): readonly SectionEquationEntry[] {
  const key = learnSectionPathKey(gradeId, chapterId, sectionId)
  return SECTION_EQUATIONS[key] ?? DEFAULT_BY_CHAPTER[chapterId] ?? DEFAULT_BY_CHAPTER.c1!
}

/** Первое уравнение § (обратная совместимость). */
export function getSectionEquationOffer(
  gradeId: string,
  chapterId: string,
  sectionId: string,
): SectionEquationEntry {
  return getSectionEquations(gradeId, chapterId, sectionId)[0]!
}

export function getSectionAllowedProductIds(
  gradeId: string,
  chapterId: string,
  sectionId: string,
): string[] {
  const ids = getSectionEquations(gradeId, chapterId, sectionId).map((e) => e.productCompoundId)
  return [...new Set(ids)]
}

export function buildGenerateEquationLabUrl(
  gradeId: string,
  chapterId: string,
  sectionId: string,
  productCompoundId?: string,
): string {
  const params = new URLSearchParams()
  params.set('reactor', '1')
  params.set('genEq', '1')
  params.set('learnG', gradeId)
  params.set('learnC', chapterId)
  params.set('learnS', sectionId)
  const preferred = productCompoundId ?? getSectionEquationOffer(gradeId, chapterId, sectionId).productCompoundId
  params.set('product', preferred)
  return `/#/?${params.toString()}`
}

export function parseLearnEquationScope(params: URLSearchParams): LearnEquationScope | null {
  const gradeId = params.get('learnG')
  const chapterId = params.get('learnC')
  const sectionId = params.get('learnS')
  if (!gradeId || !chapterId || !sectionId) return null
  return { gradeId, chapterId, sectionId }
}
