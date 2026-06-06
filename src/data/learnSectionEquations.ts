import { learnSectionPathKey } from './learnFgosMatrix'
import type { SectionEquationOffer } from '../learn/topicQuizTypes'

const OFFERS: Readonly<Record<string, SectionEquationOffer>> = {
  [learnSectionPathKey('g7', 'c1', 's08')]: {
    equation: 'CH₄ + 2O₂ → CO₂ + 2H₂O',
    productCompoundId: 'co2',
    hint: 'Горение метана — типичное химическое явление.',
  },
  [learnSectionPathKey('g7', 'c2', 's12')]: {
    equation: '2H₂ + O₂ → 2H₂O',
    productCompoundId: 'h2o',
    hint: 'Составьте коэффициенты для синтеза воды.',
  },
  [learnSectionPathKey('g7', 'c2', 's13')]: {
    equation: '4Fe + 3O₂ → 2Fe₂O₃',
    productCompoundId: 'fe2o3',
    hint: 'Окисление железа — ржавление.',
  },
  [learnSectionPathKey('g7', 'c4', 's06')]: {
    equation: 'C + O₂ → CO₂',
    productCompoundId: 'co2',
    hint: 'Горение угля на воздухе.',
  },
  [learnSectionPathKey('g7', 'c4', 's05')]: {
    equation: '2Mg + O₂ → 2MgO',
    productCompoundId: 'mgo',
    hint: 'Горение магния даёт яркое пламя и белый оксид.',
  },
  [learnSectionPathKey('g7', 'c5', 's06')]: {
    equation: 'Zn + 2HCl → ZnCl₂ + H₂',
    productCompoundId: 'hcl',
    hint: 'Кислота реагирует с металлом, выделяется водород.',
  },
  [learnSectionPathKey('g7', 'c6', 's06')]: {
    equation: 'HCl + NaOH → NaCl + H₂O',
    productCompoundId: 'nacl',
    hint: 'Классическая нейтрализация кислоты основанием.',
  },
  [learnSectionPathKey('g7', 'c6', 's05')]: {
    equation: 'CaO + H₂O → Ca(OH)₂',
    productCompoundId: 'cao',
    hint: 'Основный оксид кальция гидратируется с выделением тепла.',
  },
}

const DEFAULT_BY_CHAPTER: Readonly<Record<string, SectionEquationOffer>> = {
  c1: {
    equation: '2H₂ + O₂ → 2H₂O',
    productCompoundId: 'h2o',
    hint: 'Образование воды из простых веществ.',
  },
  c2: {
    equation: '2H₂ + O₂ → 2H₂O',
    productCompoundId: 'h2o',
    hint: 'Проверьте баланс атомов H и O.',
  },
  c3: {
    equation: '2Na + Cl₂ → 2NaCl',
    productCompoundId: 'nacl',
    hint: 'Соединение металла и неметалла.',
  },
  c4: {
    equation: 'S + O₂ → SO₂',
    productCompoundId: 'so2',
    hint: 'Горение серы — оксид серы(IV).',
  },
  c5: {
    equation: 'Zn + 2HCl → ZnCl₂ + H₂',
    productCompoundId: 'hcl',
    hint: 'Взаимодействие кислоты с металлом.',
  },
  c6: {
    equation: 'HCl + NaOH → NaCl + H₂O',
    productCompoundId: 'nacl',
    hint: 'Нейтрализация — соль и вода.',
  },
  c7: {
    equation: 'C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O',
    productCompoundId: 'co2',
    hint: 'Окисление глюкозы при дыхании.',
  },
  c8: {
    equation: 'CaCO₃ → CaO + CO₂',
    productCompoundId: 'cao',
    hint: 'Разложение известняка при нагревании.',
  },
}

export function getSectionEquationOffer(
  gradeId: string,
  chapterId: string,
  sectionId: string,
): SectionEquationOffer {
  const key = learnSectionPathKey(gradeId, chapterId, sectionId)
  return OFFERS[key] ?? DEFAULT_BY_CHAPTER[chapterId] ?? DEFAULT_BY_CHAPTER.c1!
}

export function buildGenerateEquationLabUrl(offer: SectionEquationOffer): string {
  const params = new URLSearchParams()
  params.set('reactor', '1')
  params.set('genEq', '1')
  params.set('product', offer.productCompoundId)
  return `/#/?${params.toString()}`
}
