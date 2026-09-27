/**
 * Научные спецификации школьных сцен первых 10 веществ каталога 7 класса.
 * Порядок — порядок каталога (SCHOOL_SPEC_IDS). Проверка: scripts/test-school-specs.mts.
 */
import { CO_SPEC } from './co'
import { CO2_SPEC } from './co2'
import { H2O_SPEC } from './h2o'
import { NACL_SPEC } from './nacl'
import { SO2_SPEC } from './so2'
import { SO3_SPEC } from './so3'
import type { SchoolSceneSpec, SchoolSpecId } from './types'

export const SCHOOL_SPECS: Readonly<Partial<Record<SchoolSpecId, SchoolSceneSpec>>> = {
  h2o: H2O_SPEC,
  co2: CO2_SPEC,
  nacl: NACL_SPEC,
  co: CO_SPEC,
  so2: SO2_SPEC,
  so3: SO3_SPEC,
}

export function schoolSpecFor(id: string): SchoolSceneSpec | null {
  return (SCHOOL_SPECS as Record<string, SchoolSceneSpec | undefined>)[id] ?? null
}

export * from './types'
export { resolveAngleDeg, resolveLengthPm, particleDipoleD } from './core'
