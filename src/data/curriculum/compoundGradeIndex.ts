import type { CompoundDef } from '../../types/chemistry'
import { COMPOUND_GRADE_MAP, type InorganicChapter } from './compoundGradeMap.generated'

export type InorganicSchoolGrade = 7 | 8 | 9
export type OrganicSchoolGrade = 'g10' | 'g11'
export type CatalogDomain = 'inorganic' | 'organic'

export { type InorganicChapter }

export function inorganicGradesForId(id: string): readonly InorganicSchoolGrade[] {
  return COMPOUND_GRADE_MAP[id]?.grades ?? [8, 9]
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

export function organicGradeForMolecule(id: string, classId: string): OrganicSchoolGrade {
  if (ORGANIC_G11_MOLECULE_IDS.has(id)) return 'g11'
  if (ORGANIC_G11_CLASS_IDS.has(classId)) return 'g11'
  return 'g10'
}

export function filterOrganicByGrade<T extends { id: string; classId: string }>(
  molecules: readonly T[],
  grade: OrganicSchoolGrade | 'all',
): readonly T[] {
  if (grade === 'all') return molecules
  return molecules.filter((m) => organicGradeForMolecule(m.id, m.classId) === grade)
}

export function gradeStats(compounds: readonly CompoundDef[]): Record<InorganicSchoolGrade, number> {
  const s: Record<InorganicSchoolGrade, number> = { 7: 0, 8: 0, 9: 0 }
  for (const c of compounds) {
    for (const g of inorganicGradesForId(c.id)) s[g]++
  }
  return s
}
