import { NACL_STEPS, naclCueAt } from './naclSteps'

/**
 * Энергетика 2 Na + Cl₂ → 2 NaCl на 1 моль NaCl — цикл Борна — Габера.
 *
 * Все числа справочные (298 K, кДж/моль):
 *   • сублимация Na (тв.) → Na (г):            +107,3   (NIST-JANAF)
 *   • ионизация Na → Na⁺ + e⁻:                 +495,8   (CRC, первая энергия ионизации 5,139 эВ)
 *   • диссоциация ½ Cl₂ → Cl:                  +121,7   (½ · 243,4, NIST-JANAF)
 *   • сродство к электрону Cl + e⁻ → Cl⁻:       −348,6   (CRC, 3,613 эВ)
 *   • энергия решётки Na⁺ + Cl⁻ → NaCl (тв.):   −787     (по циклу Борна — Габера)
 *   ─────────────────────────────────────────────────────
 *   ΔH°f(NaCl, тв.) = −410,8 ≈ −411 кДж/моль   (табличное −411,1)
 *
 * Файл без THREE и React — его читают панель энергии и тесты.
 */

export type NaclEnergyStageId = 'sublimation' | 'ionization' | 'dissociation' | 'affinity' | 'lattice'

export type NaclEnergyStage = {
  id: NaclEnergyStageId
  /** кДж на 1 моль NaCl; > 0 — затраты, < 0 — выигрыш */
  dH: number
  /** момент сюжета, с которого ступень считается пройденной */
  at: number
}

export const NACL_BORN_HABER: readonly NaclEnergyStage[] = [
  { id: 'sublimation', dH: 107.3, at: 0.8 },
  { id: 'ionization', dH: 495.8, at: naclCueAt('transfer') },
  { id: 'dissociation', dH: 121.7, at: naclCueAt('bondBreak') },
  { id: 'affinity', dH: -348.6, at: naclCueAt('transfer') + 0.35 },
  { id: 'lattice', dH: -787, at: naclCueAt('lattice') },
]

/** Табличная теплота образования NaCl (тв.), кДж/моль. */
export const NACL_DHF_TABLE_KJ = -411.1

/** Сумма ступеней цикла, кДж/моль. */
export function naclFormationEnthalpyKJ(): number {
  let sum = 0
  for (const s of NACL_BORN_HABER) sum += s.dH
  return sum
}

/** Округлённое значение для подписей на экране: −411. */
export const NACL_DHF_KJ = Math.round(naclFormationEnthalpyKJ())

/** Тепловой эффект уравнения 2 Na + Cl₂ → 2 NaCl, кДж. */
export const NACL_REACTION_DH_KJ = 2 * NACL_DHF_KJ

/** Сколько ступеней лестницы уже «пройдено» к моменту t (для бегунка панели). */
export function naclEnergyStagesDoneAt(t: number): number {
  let n = 0
  for (const s of NACL_BORN_HABER) if (t >= s.at) n++
  return n
}

/** Ступень, которую подсвечивать в момент t (индекс в порядке лестницы), −1 — ни одну. */
export function naclEnergyActiveStageAt(t: number): number {
  const order = naclEnergyLadder()
  let active = -1
  for (let i = 0; i < order.length; i++) if (t >= order[i]!.at) active = i
  return active
}

/**
 * Порядок ступеней на лестнице — по времени сюжета, чтобы бегунок шёл слева направо:
 * сублимация, диссоциация, ионизация, сродство, решётка.
 */
export function naclEnergyLadder(): readonly NaclEnergyStage[] {
  return [...NACL_BORN_HABER].sort((a, b) => a.at - b.at)
}

/** Шаг урока, на котором показывают блок энергии целиком. */
export const NACL_ENERGY_STEP_INDEX = NACL_STEPS.findIndex((s) => s.id === 'energy')
