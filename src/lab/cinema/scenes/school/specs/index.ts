/**
 * Научные спецификации школьных сцен первых 10 веществ каталога 7 класса.
 * Порядок — порядок каталога (SCHOOL_SPEC_IDS). Проверка: scripts/test-school-specs.mts.
 */
import { BASO4_SPEC } from './baso4'
import { CO_SPEC } from './co'
import { CO2_SPEC } from './co2'
import { H2O_SPEC } from './h2o'
import { N2O_SPEC } from './n2o'
import { N2O5_SPEC } from './n2o5'
import { NACL_SPEC } from './nacl'
import { NO_SPEC } from './no'
import { NO2_SPEC } from './no2'
import { SO2_SPEC } from './so2'
import { SO3_SPEC } from './so3'
import type { MoleculeSchoolSpecId, SchoolScienceSpec, SolutionSchoolSpecId, SolutionScienceSpec } from './types'

export const SCHOOL_SPECS: Readonly<Record<MoleculeSchoolSpecId, SchoolScienceSpec>> = {
  h2o: H2O_SPEC,
  co2: CO2_SPEC,
  nacl: NACL_SPEC,
  co: CO_SPEC,
  so2: SO2_SPEC,
  so3: SO3_SPEC,
  no: NO_SPEC,
  no2: NO2_SPEC,
  n2o: N2O_SPEC,
  n2o5: N2O5_SPEC,
}

/** Сцены «обмен в растворе» (движок school/solution): BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl. */
export const SOLUTION_SPECS: Readonly<Record<SolutionSchoolSpecId, SolutionScienceSpec>> = {
  baso4: BASO4_SPEC,
}
export { BASO4_SPEC }

export function schoolSpecFor(id: string): SchoolScienceSpec | null {
  return (SCHOOL_SPECS as Record<string, SchoolScienceSpec | undefined>)[id] ?? null
}

export * from './types'
export { resolveAngleDeg, resolveLengthPm, particleDipoleD } from './core'
export { geometryOf, lessonText, pairOrigins, stepTimings, textbookOf, type LessonTextLike, type PairOriginLike } from './adapter'
