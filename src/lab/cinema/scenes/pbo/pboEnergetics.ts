import {
  BORN_HABER,
  dHfKJ,
  formationReactionKJ,
  LATTICE_ENTHALPY_INFO,
  LATTICE_ENTHALPY_KJ,
  OXIDE_SECOND_EA_KJ,
} from '../../../../chemistry/data'
import { assertLadderMatchesFormation, buildBornHaberLadder, type Ladder } from '../kit/energyLadderData'
import { pboCueAt, PBO_ELECTRONS, PBO_STEPS } from './pboSteps'

/**
 * Энергетика 2 Pb + O₂ → 2 PbO — ФОРМАЛЬНЫЙ цикл Борна — Габера на 1 моль PbO (глёт).
 * Одна формульная единица: у всех ступеней множитель 1.
 *
 * Числа НЕ живут здесь: ступени — BORN_HABER.pbo (chemistry/data/thermoData.ts): сублимация Pb,
 * ½D(O₂) = ΔH°f(O, г.), IE₁ и IE₂ свинца, EA₁ кислорода (< 0) и EA₂ (> 0, эндотермическая),
 * «энергия решётки» — ВЫВЕДЕНА из цикла (LATTICE_ENTHALPY_INFO: derived, estimated), поэтому
 * сумма совпадает с таблицей тождественно. Цикл формальный: связь Pb–O в глёте в значительной
 * мере ковалентна (BORN_HABER.pbo.formal) — это сказано в тексте урока.
 *
 * Файл без THREE и React — его читают панель энергии и тесты.
 */

/** Время сюжета, к которому каждая ступень считается пройденной. */
const STAGE_AT: Record<string, number> = {
  sublimation: pboCueAt('sublimate'),
  dissociation: pboCueAt('bondBreak'),
  ionization1: PBO_ELECTRONS.e1.leave,
  affinity1: PBO_ELECTRONS.e1.arrive,
  ionization2: PBO_ELECTRONS.e2.leave,
  affinity2: PBO_ELECTRONS.e2.arrive,
  lattice: pboCueAt('lattice'),
}

export const PBO_LADDER: Ladder = buildBornHaberLadder('pbo', STAGE_AT)

export type PboStageId = 'sublimation' | 'dissociation' | 'ionization1' | 'ionization2' | 'affinity1' | 'affinity2' | 'lattice'

/** Ступень цикла по id (для подписей и текстов). */
export function pboStageKJ(id: PboStageId): number {
  const s = PBO_LADDER.stages.find((x) => x.id === id)
  if (!s) throw new Error(`pbo: нет ступени ${id}`)
  return s.dH
}

/** Теплота образования глёта по сумме цикла, кДж/моль, одна десятая — для 3D-подписи. */
export const PBO_DHF_KJ = Math.round(PBO_LADDER.sumKJ * 10) / 10

/** Табличная ΔH°f глёта (α-PbO) и массикота (β-PbO), кДж/моль. */
export const PBO_DHF_TABLE_KJ = PBO_LADDER.tableKJ
export const PBO_DHF_LITHARGE_KJ = dHfKJ('PbO(litharge)')
export const PBO_DHF_MASSICOT_KJ = dHfKJ('PbO(massicot)')

/** Насколько массикот выше глёта по энтальпии (> 0 — при 25 °C массикот метастабилен), кДж/моль. */
export const PBO_MASSICOT_EXCESS_KJ = Math.round((PBO_DHF_MASSICOT_KJ - PBO_DHF_LITHARGE_KJ) * 10) / 10

/** Тепловой эффект уравнения 2 Pb + O₂ → 2 PbO (глёт), кДж — из FORMATION_REACTIONS ядра. */
export const PBO_REACTION_DH_KJ = formationReactionKJ('pbo_formation')

/** Способ учебника (9 кл.): 2 Pb(NO₃)₂ → 2 PbO + 4 NO₂ + O₂, кДж на уравнение (эндотермичен). */
export const PBO_TEXTBOOK_ROUTE_DH_KJ = formationReactionKJ('pbno3_decomposition')

/** Сумма затратных ступеней (без «энергии решётки»), кДж/моль. */
export const PBO_COST_BEFORE_LATTICE_KJ =
  Math.round(PBO_LADDER.stages.filter((s) => s.kind !== 'lattice').reduce((sum, s) => sum + s.dH, 0) * 10) / 10

/** Формальная «энергия решётки» глёта в цикле, кДж/моль (отрицательная). */
export const PBO_LATTICE_KJ = pboStageKJ('lattice')

/** То же значение в таблице LATTICE_ENTHALPY_KJ (обязано совпадать со ступенью цикла). */
export const PBO_LATTICE_TABLE_KJ = LATTICE_ENTHALPY_KJ['PbO(litharge)']!

/** Цикл помечен ядром как формальный, а U — как выведенная оценка. */
export const PBO_CYCLE_IS_FORMAL = BORN_HABER.pbo!.formal === true
export const PBO_LATTICE_IS_ESTIMATED = LATTICE_ENTHALPY_INFO['PbO(litharge)']?.estimated === true

/** Шаг урока, на котором показывают блок энергии целиком. */
export const PBO_ENERGY_STEP_INDEX = PBO_STEPS.findIndex((s) => s.id === 'energy')

/**
 * Полуреакции с ЭЛЕКТРОННЫМ балансом: 2 × 2 = 4 электрона отдано, 4 принято (O₂ + 4e⁻ → 2 O²⁻).
 * Заряд сходится: слева 0, справа 2(+2) + 2(−2) = 0. Восстанавливается МОЛЕКУЛА O₂ целиком.
 */
export const PBO_HALF_REACTIONS = [
  {
    id: 'oxidation' as const,
    equation: 'Pb⁰ − 2e⁻ → Pb²⁺',
    electrons: 2,
    times: 2,
    chargeLeft: 0,
    chargeRight: 2,
  },
  {
    id: 'reduction' as const,
    equation: 'O₂⁰ + 4e⁻ → 2 O²⁻',
    electrons: 4,
    times: 1,
    chargeLeft: 0,
    chargeRight: -4,
  },
] as const

/** Суммарное уравнение в машинном виде (ASCII-формулы) — для теста стехиометрии. */
export const PBO_REACTION = {
  left: [
    { formula: 'Pb', coeff: 2 },
    { formula: 'O2', coeff: 1 },
  ],
  right: [{ formula: 'PbO', coeff: 2 }],
} as const

/** Проверка для теста: сумма ступеней совпадает с табличной ΔH°f, знаки верные. */
export function validatePboEnergetics(): void {
  assertLadderMatchesFormation(PBO_LADDER, 0.05)
  if (!(PBO_LATTICE_KJ < 0)) throw new Error('pbo: «энергия решётки» обязана быть отрицательной')
  if (Math.abs(PBO_LATTICE_KJ - PBO_LATTICE_TABLE_KJ) > 1e-9) {
    throw new Error(`pbo: U в цикле ${PBO_LATTICE_KJ} ≠ U в таблице ${PBO_LATTICE_TABLE_KJ}`)
  }
  for (const k of ['sublimation', 'dissociation', 'ionization1', 'ionization2', 'affinity2'] as const) {
    if (!(pboStageKJ(k) > 0)) throw new Error(`pbo: ступень ${k} обязана быть эндотермической (ΔH > 0)`)
  }
  if (!(pboStageKJ('affinity1') < 0)) throw new Error('pbo: EA₁(O) обязана быть отрицательной')
  if (pboStageKJ('affinity2') !== OXIDE_SECOND_EA_KJ) throw new Error('pbo: EA₂(O) обязана совпадать с OXIDE_SECOND_EA_KJ ядра')
  if (!PBO_CYCLE_IS_FORMAL || !PBO_LATTICE_IS_ESTIMATED) throw new Error('pbo: ядро обязано помечать цикл PbO как формальный')
  if (!(PBO_MASSICOT_EXCESS_KJ > 0)) throw new Error('pbo: массикот обязан лежать выше глёта по энтальпии')
  for (const s of PBO_LADDER.stages) {
    if ((s.multiplier ?? 1) !== 1) throw new Error(`pbo: у ступени ${s.id} множитель ${s.multiplier}, а в PbO одна формульная единица`)
  }
}
