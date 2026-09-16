import type { CompoundDef } from '../../types/chemistry'
import { COMPOUND_GRADE_MAP, ORGANIC_GRADE_MAP, type InorganicChapter } from './compoundGradeMap.generated'

/** Классы школы, по которым размечены вещества (учебники Kimyo 7–11). */
export type InorganicSchoolGrade = 7 | 8 | 9 | 10 | 11
export type SchoolGrade = InorganicSchoolGrade
/** Ступень органики для 3D-моделей (organicMoleculeTypes.grade): 10 или 11 класс. */
export type OrganicSchoolGrade = 'g10' | 'g11'
export type CatalogDomain = 'inorganic' | 'organic'

export const SCHOOL_GRADES: readonly SchoolGrade[] = [7, 8, 9, 10, 11]

export function isSchoolGrade(n: number): n is SchoolGrade {
  return (SCHOOL_GRADES as readonly number[]).includes(n)
}

export { type InorganicChapter }

export function inorganicGradesForId(id: string): readonly InorganicSchoolGrade[] {
  return COMPOUND_GRADE_MAP[id]?.grades ?? [8, 9]
}

/** Первая страница учебника, где вещество встречается (для порядка «как в книге»); null — не найдено. */
export function inorganicFirstPageForId(id: string): number | null {
  return COMPOUND_GRADE_MAP[id]?.firstPage ?? null
}

export function inorganicChapterForId(id: string): InorganicChapter {
  return COMPOUND_GRADE_MAP[id]?.chapter ?? 'прочее'
}

export function filterInorganicCompoundsByGrade(
  compounds: readonly CompoundDef[],
  grade: InorganicSchoolGrade | 'all',
): readonly CompoundDef[] {
  if (grade === 'all') return compounds
  return compounds.filter((c) => inorganicGradesForId(c.id).includes(grade))
}

export function filterInorganicCompoundsByChapter(
  compounds: readonly CompoundDef[],
  chapter: InorganicChapter | 'all',
): readonly CompoundDef[] {
  if (chapter === 'all') return compounds
  return compounds.filter((c) => inorganicChapterForId(c.id) === chapter)
}

export const INORGANIC_CHAPTERS: readonly InorganicChapter[] = [
  'вода',
  'оксиды',
  'кислоты',
  'основания',
  'соли',
  'качественные',
  'металлы',
  'неметаллы',
  'кислород',
  'водород',
  'азот',
  'сера',
  'фосфор',
  'хром',
  'хлор',
  'марганец',
  'кремний',
  'катализ',
  'прочее',
] as const

/** Классы органики 11 кл. (Kimyo): арены, фенолы, азотсодержащие, сложные эфиры и полиолы. */
const ORGANIC_G11_CLASS_IDS = new Set([
  'arene',
  'phenol',
  'nitrogen',
  'ester',
  'alkadiene',
  'polyol',
])

const ORGANIC_G11_MOLECULE_IDS = new Set([
  'adamantane',
  'glycerol',
  'ethylene-glycol',
  'glucose-open',
  'triacetin',
  'n-hexane',
  '2-methylpentane',
  '3-methylpentane',
  '2-3-dimethylbutane',
  '2-2-dimethylbutane',
  'propyne',
  'n-butanol',
  'ethyl-acetate',
  'diethyl-ether',
  'styrene',
  'toluene',
  'aniline',
  'methylamine',
])

/** Ступень 3D-модели молекулы (10/11) — используется реестром органики; не путать с классами учебников. */
export function organicGradeForMolecule(id: string, classId: string): OrganicSchoolGrade {
  if (ORGANIC_G11_MOLECULE_IDS.has(id)) return 'g11'
  if (ORGANIC_G11_CLASS_IDS.has(classId)) return 'g11'
  return 'g10'
}

/**
 * Классы учебников (7–11), где органическая молекула упоминается (сверка Kimyo).
 * Без свидетельств — ступень 3D-модели (10 или 11).
 */
export function organicGradesForMolecule(m: { id: string; classId: string }): readonly SchoolGrade[] {
  const ev = ORGANIC_GRADE_MAP[m.id]?.grades
  if (ev && ev.length > 0) return ev
  return organicGradeForMolecule(m.id, m.classId) === 'g11' ? [11] : [10]
}

export function organicFirstPageForId(id: string): number | null {
  return ORGANIC_GRADE_MAP[id]?.firstPage ?? null
}

export function filterOrganicByGrade<T extends { id: string; classId: string }>(
  molecules: readonly T[],
  grade: SchoolGrade | 'all',
): readonly T[] {
  if (grade === 'all') return molecules
  return molecules.filter((m) => organicGradesForMolecule(m).includes(grade))
}

export function gradeStats(compounds: readonly CompoundDef[]): Record<InorganicSchoolGrade, number> {
  const s: Record<InorganicSchoolGrade, number> = { 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 }
  for (const c of compounds) {
    for (const g of inorganicGradesForId(c.id)) s[g]++
  }
  return s
}

/**
 * Короткая подпись классов для бейджа: [7,8,9] → «7–9», [7,9] → «7, 9», [7,8,9,11] → «7–9, 11».
 */
export function formatGradeRange(grades: readonly SchoolGrade[]): string {
  const sorted = [...new Set(grades)].sort((a, b) => a - b)
  const parts: string[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j++
    parts.push(j > i ? `${sorted[i]}–${sorted[j]}` : String(sorted[i]))
    i = j + 1
  }
  return parts.join(', ')
}
