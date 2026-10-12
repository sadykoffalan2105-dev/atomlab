/**
 * Карта школьной программы Kimyo 7–11 (src/data/kb/curriculum/kimyo-map.json, version 1) — типы.
 * Источник правды для поиска мозга (§-карточка, ссылка «§12 Kimyo 8», подписи цитат), калькулятора задач (типы задач → §)
 * и генератора контрольных вопросов. Собирает scripts/brain/build-curriculum-map.mts (npm run brain:curriculum-map),
 * схема — src/data/kb/curriculum/kimyo-map.schema.json.
 */

export type GradeKey = 'g7' | 'g8' | 'g9' | 'g10' | 'g11'
export type Tri = { ru: string; uz: string; en: string }
export type TriOpt = { ru: string; uz?: string; en?: string }

/** Идентификаторы расчётных задач — контракт с калькулятором (brain/calc) и генератором вопросов. */
export const TASK_TYPE_IDS = [
  'molar_mass',
  'mass_fraction_element',
  'formula_from_fractions',
  'moles_mass_volume_particles',
  'gas_density',
  'gas_mixture',
  'clapeyron',
  'equation_stoich',
  'excess_limiting',
  'yield',
  'impurities',
  'solution_mass_fraction',
  'solution_density_volume',
  'molarity',
  'normality',
  'equivalent',
  'solubility',
  'crystal_hydrate',
  'thermochem',
  'reaction_rate',
  'equilibrium',
  'electrolysis_faraday',
  'redox_balance',
  'oxidation_state',
  'ph',
  'dissociation_degree',
  'water_hardness',
  'atomic_structure_counts',
  'mixture_fraction',
  'combustion_formula',
  'metal_plate',
  'air_volume',
] as const
export type TaskTypeId = (typeof TASK_TYPE_IDS)[number]

export type TaskType = {
  id: TaskTypeId
  name: Tri
  /** регексы (строки, флаги iu) — маркеры задачи этого типа в условии */
  markers: { ru: string[]; uz: string[]; en: string[] }
  /** единицы, где тип вводится (по оглавлению): ['g7:2.9', …] */
  introducedIn: string[]
}

export type UnitKind = 'paragraph' | 'practical' | 'review' | 'tasks' | 'lab'

export type UnitReaction = {
  eq: string
  ascii: string
  type: string
  conditions?: string
  page?: number
  bankId?: string
  labHref?: string
  isGeneral?: boolean
  isIonic?: boolean
}

export type UnitExample = { statement: string; answer?: string; page?: number; source: 'example' | 'exercise' | 'labTask'; typeGuess?: TaskTypeId }

export type UnitTest = { q: TriOpt; choices?: { ru: string[]; uz?: string[]; en?: string[] }; correct?: number; a: TriOpt; explanation?: { ru: string } }

export type Unit = {
  /** 'g8:12' (класс:номер как напечатан: '12' | '2.6' | 'lab') */
  id: string
  grade: number
  kp: string
  kind: UnitKind
  /** «Kimyo 8, §12» / «Kimyo 8, 12-§» / «Kimyo 8, §12»; для 7 и 10 кл. — «Kimyo 7, гл. 2, тема 6» */
  label: Tri
  /** точный префикс цитаты: «[Kimyo 8, §12]» (страницу добавляет поиск: «[Kimyo 8, §12, стр. 50]») */
  cite: string
  chapter: { id: string; num: number; title: Tri }
  appSections: string[]
  title: Tri & { uzSource: 'i18n' | 'auto' | 'ru' }
  pages: { start: number; end: number }
  concepts: { ru: string; uz?: string; en?: string; slug?: string }[]
  definitions: { term: TriOpt; text: { ru: string }; page?: number; chunkId?: string; source: 'textbook' | 'qaBank' }[]
  laws: { name: TriOpt; statement: { ru: string }; formula?: string }[]
  formulas: string[]
  reactions: UnitReaction[]
  substances: { formula: string; nameRu: string; nameUz?: string; role: string; kind: string; catalogId?: string }[]
  tasks: { types: TaskTypeId[]; examples: UnitExample[]; exercises: { n: number; text: string; typeGuess?: TaskTypeId }[] }
  tests: UnitTest[]
  topics: string[]
  domain: string
  level: { prereq: string[]; next: string[] }
  stats: { textbookChunks: number; definitionChunks: number; summaryChunks: number; reactions: number; examples: number; exercises: number; tests: number; coverageScore: number }
}

export type Chapter = { id: string; num: number; title: Tri; units: string[] }

export type CurriculumMapFile = {
  version: 1
  generatedAt: string
  sources: Record<string, string>
  taskTypes: TaskType[]
  grades: Record<GradeKey, { book: { title: string; pages: number }; chapters: Chapter[]; units: Unit[] }>
}
