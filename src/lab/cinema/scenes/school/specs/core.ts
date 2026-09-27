/**
 * Мост спецификаций к научному ядру: числа длин, углов, зарядов ядер и слоёв берутся ТОЛЬКО отсюда.
 * Без three и React — читается тестами в Node.
 */
import {
  ATOMIC_DATA,
  BOND_ANGLES,
  bondLengthPm,
  CRYSTAL_DATA,
  DIPOLE_MOMENTS,
  reagentAngleDeg,
  reagentBondPm,
  type ElementSymbol,
} from '../../../../../chemistry/data'
import { atomLevels } from '../../../../../chemistry/data/electronLevels'
import type { AngleRef, AtomSpec, LengthRef, ParticleSpec, SchoolSource } from './types'

/** Длина связи, пм — из ядра. */
export function resolveLengthPm(ref: LengthRef): number {
  if ('bond' in ref) return bondLengthPm(ref.bond)
  if ('reagent' in ref) return reagentBondPm(ref.reagent, ref.name)
  const c = CRYSTAL_DATA[ref.crystal]
  if (!c) throw new Error(`school specs: нет кристалла «${ref.crystal}»`)
  return c.cationAnionPm
}

/** Валентный угол, градусы — из ядра. */
export function resolveAngleDeg(ref: AngleRef): number {
  if ('angle' in ref) return BOND_ANGLES[ref.angle].deg
  return reagentAngleDeg(ref.reagent, ref.name)
}

/** Дипольный момент частицы, D (null — в ядре нет). */
export function particleDipoleD(p: ParticleSpec): number | null {
  return p.dipoleKey ? (DIPOLE_MOMENTS[p.dipoleKey]?.debye ?? null) : null
}

/** Атом для спецификации: заряд ядра, слои и внешние электроны — из ядра. */
export function atomSpec(
  element: ElementSymbol,
  o: {
    unpaired: number
    config: string
    schoolValences: readonly number[]
    excited?: AtomSpec['excited']
  },
): AtomSpec {
  const d = ATOMIC_DATA[element]
  const levels = atomLevels(d.z)
  return {
    element,
    z: d.z,
    levels,
    outer: levels[levels.length - 1]!,
    unpaired: o.unpaired,
    config: o.config,
    ...(o.excited ? { excited: o.excited } : {}),
    schoolValences: o.schoolValences,
  }
}

/** Валентные электроны атома (ядро: ATOMIC_DATA.valenceElectrons). */
export function valenceElectrons(element: ElementSymbol): number {
  return ATOMIC_DATA[element].valenceElectrons
}

/** Справочник без учебника. */
export const ref = (reference: string): SchoolSource => ({ reference })
