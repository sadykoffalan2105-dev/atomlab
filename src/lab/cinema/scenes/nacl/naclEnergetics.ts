import { LATTICE_ENTHALPY_KJ } from '../../../../chemistry/data'
import { assertLadderMatchesFormation, buildBornHaberLadder, type Ladder } from '../kit/energyLadderData'
import { naclCueAt, NACL_ELECTRONS, NACL_STEPS } from './naclSteps'

/**
 * Энергетика 2 Na + Cl₂ → 2 NaCl — цикл Борна — Габера на 1 моль NaCl (одна формульная
 * единица, поэтому у всех ступеней множитель 1).
 *
 * Числа НЕ живут здесь: ступени приходят из BORN_HABER.nacl (chemistry/data/thermoData.ts):
 * сублимация Na, ½D(Cl₂) = ΔH°f(Cl, г.) при 298 K (JANAF), IE₁(Na), EA₁(Cl) как энтальпия
 * присоединения электрона (Δ_eg H < 0), энергия решётки U < 0. Сумма = табличная ΔH°f.
 *
 * Знаки принципиальны: три ступени вверх (затраты), две вниз (выигрыш).
 * Экзотермичность даёт ИМЕННО ЭНЕРГИЯ РЕШЁТКИ: без неё сумма первых четырёх
 * ступеней положительна — процесс был бы эндотермическим.
 *
 * Файл без THREE и React — его читают панель энергии и тесты.
 */

/** Время сюжета, к которому каждая ступень считается пройденной. */
const STAGE_AT: Record<string, number> = {
  sublimation: naclCueAt('sublimate'),
  dissociation: naclCueAt('bondBreak'),
  ionization: NACL_ELECTRONS.e1.leave,
  affinity: NACL_ELECTRONS.e1.arrive,
  lattice: naclCueAt('lattice'),
}

export const NACL_LADDER: Ladder = buildBornHaberLadder('nacl', STAGE_AT)

/** Ступень цикла по виду (для подписей и текстов). */
export function naclStageKJ(kind: 'sublimation' | 'dissociation' | 'ionization' | 'affinity' | 'lattice'): number {
  const s = NACL_LADDER.stages.find((x) => x.kind === kind)
  if (!s) throw new Error(`nacl: нет ступени ${kind}`)
  return s.dH
}

/** Теплота образования NaCl (тв.) по сумме цикла, кДж/моль, одна десятая — для 3D-подписи. */
export const NACL_DHF_KJ = Math.round(NACL_LADDER.sumKJ * 10) / 10

/** Табличная ΔH°f(NaCl, тв.), кДж/моль. */
export const NACL_DHF_TABLE_KJ = NACL_LADDER.tableKJ

/** Тепловой эффект уравнения 2 Na + Cl₂ → 2 NaCl (две формульные единицы), кДж. */
export const NACL_REACTION_DH_KJ = Math.round(2 * NACL_DHF_TABLE_KJ * 10) / 10

/** Сумма затратных ступеней (без энергии решётки), кДж/моль. */
export const NACL_COST_BEFORE_LATTICE_KJ =
  Math.round(NACL_LADDER.stages.filter((s) => s.kind !== 'lattice').reduce((sum, s) => sum + s.dH, 0) * 10) / 10

/** Энергия решётки NaCl в цикле, кДж/моль (отрицательная). */
export const NACL_LATTICE_KJ = naclStageKJ('lattice')

/** Энергия решётки в таблице LATTICE_ENTHALPY_KJ (обязана совпадать со ступенью цикла). */
export const NACL_LATTICE_TABLE_KJ = LATTICE_ENTHALPY_KJ['NaCl(s)']!

/** Шаг урока, на котором показывают блок энергии целиком. */
export const NACL_ENERGY_STEP_INDEX = NACL_STEPS.findIndex((s) => s.id === 'energy')

/**
 * Полуреакции с ЭЛЕКТРОННЫМ балансом. Отдано ровно столько электронов,
 * сколько принято: 2 × 1 = 2. Заряд тоже сходится: слева 0, справа 2(+1) + 2(−1) = 0.
 * Восстанавливается МОЛЕКУЛА Cl₂ целиком — частицы «Cl²⁻» не существует.
 */
export const NACL_HALF_REACTIONS = [
  {
    id: 'oxidation' as const,
    equation: 'Na⁰ − 1e⁻ → Na⁺',
    /** электронов отдано одной частицей */
    electrons: 1,
    /** во сколько раз взята полуреакция */
    times: 2,
    chargeLeft: 0,
    chargeRight: 1,
  },
  {
    id: 'reduction' as const,
    equation: 'Cl₂⁰ + 2e⁻ → 2 Cl⁻',
    electrons: 2,
    times: 1,
    chargeLeft: 0,
    chargeRight: -2,
  },
] as const

/** Суммарное уравнение в машинном виде (ASCII-формулы) — для теста стехиометрии. */
export const NACL_REACTION = {
  left: [
    { formula: 'Na', coeff: 2 },
    { formula: 'Cl2', coeff: 1 },
  ],
  right: [{ formula: 'NaCl', coeff: 2 }],
} as const

/** Проверка для теста: сумма ступеней совпадает с табличной ΔH°f, знаки верные. */
export function validateNaclEnergetics(): void {
  assertLadderMatchesFormation(NACL_LADDER, 0.05)
  if (!(NACL_LATTICE_KJ < 0)) throw new Error('nacl: энергия решётки обязана быть отрицательной')
  if (Math.abs(NACL_LATTICE_KJ - NACL_LATTICE_TABLE_KJ) > 1e-9) {
    throw new Error(`nacl: U в цикле ${NACL_LATTICE_KJ} ≠ U в таблице ${NACL_LATTICE_TABLE_KJ}`)
  }
  for (const k of ['sublimation', 'dissociation', 'ionization'] as const) {
    if (!(naclStageKJ(k) > 0)) throw new Error(`nacl: ступень ${k} обязана быть эндотермической (ΔH > 0)`)
  }
  if (!(naclStageKJ('affinity') < 0)) throw new Error('nacl: Δ_eg H(Cl) обязана быть отрицательной')
  for (const s of NACL_LADDER.stages) {
    if ((s.multiplier ?? 1) !== 1) throw new Error(`nacl: у ступени ${s.id} множитель ${s.multiplier}, а в NaCl одна формульная единица`)
  }
}
