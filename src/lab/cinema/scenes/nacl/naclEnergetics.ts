import { assertLadderMatchesFormation, buildBornHaberLadder, type Ladder } from '../kit/energyLadderData'
import { naclCueAt, NACL_STEPS } from './naclSteps'

/**
 * Энергетика 2 Na + Cl₂ → 2 NaCl — цикл Борна — Габера на 1 моль NaCl.
 *
 * Числа НЕ живут здесь: они приходят из BORN_HABER.nacl (chemistry/data/thermoData.ts),
 * кДж/моль, 298 K:
 *   сублимация Na (тв → г)          +107,3   (NIST-JANAF)
 *   диссоциация ½ Cl₂ → Cl          +121,7   (½ · D = ½ · 243,4)
 *   ионизация Na → Na⁺ + e⁻         +495,8   (IE₁ = 5,139 эВ, CRC)
 *   сродство Cl + e⁻ → Cl⁻          −348,6   (EA = 3,613 эВ, CRC)
 *   энергия решётки Na⁺ + Cl⁻ → NaCl −787,0  (цикл Борна — Габера)
 *   ─────────────────────────────────────────
 *   Σ = −410,8 ≈ ΔH°f(NaCl, тв) = −411,2 (табличное)
 *
 * Знаки принципиальны: три ступени вверх (затраты), две вниз (выигрыш).
 * Экзотермичность даёт ИМЕННО ЭНЕРГИЯ РЕШЁТКИ: без неё сумма первых четырёх
 * ступеней +376,2 кДж/моль — процесс был бы эндотермическим.
 *
 * Файл без THREE и React — его читают панель энергии и тесты.
 */

/** Время сюжета, к которому каждая ступень считается пройденной. */
const STAGE_AT: Record<string, number> = {
  sublimation: naclCueAt('sublimate'),
  dissociation: naclCueAt('bondBreak'),
  ionization: naclCueAt('transfer') - 1.2,
  affinity: naclCueAt('transfer') + 0.35,
  lattice: naclCueAt('lattice'),
}

export const NACL_LADDER: Ladder = buildBornHaberLadder('nacl', STAGE_AT)

/** Теплота образования NaCl (тв.) по сумме цикла, кДж/моль — для подписей: −411. */
export const NACL_DHF_KJ = Math.round(NACL_LADDER.sumKJ)

/** Табличная ΔH°f(NaCl, тв.), кДж/моль. */
export const NACL_DHF_TABLE_KJ = NACL_LADDER.tableKJ

/** Тепловой эффект уравнения 2 Na + Cl₂ → 2 NaCl (две формульные единицы), кДж. */
export const NACL_REACTION_DH_KJ = 2 * NACL_DHF_KJ

/**
 * Сумма затратных ступеней (без энергии решётки), кДж/моль: +376,2.
 * Число для шага 6: «до решётки процесс ещё эндотермический».
 */
export const NACL_COST_BEFORE_LATTICE_KJ = Math.round(
  NACL_LADDER.stages.filter((s) => s.kind !== 'lattice').reduce((sum, s) => sum + s.dH, 0),
)

/** Энергия решётки NaCl, кДж/моль (отрицательная). */
export const NACL_LATTICE_KJ = NACL_LADDER.stages.find((s) => s.kind === 'lattice')!.dH

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

/** Проверка для теста: сумма ступеней совпадает с табличной ΔH°f. */
export function validateNaclEnergetics(): void {
  assertLadderMatchesFormation(NACL_LADDER, 5)
  const lattice = NACL_LADDER.stages.find((s) => s.kind === 'lattice')
  if (!lattice || lattice.dH >= 0) throw new Error('nacl: энергия решётки обязана быть отрицательной')
  const up = NACL_LADDER.stages.filter((s) => s.dH > 0).map((s) => s.kind)
  if (!up.includes('sublimation') || !up.includes('dissociation') || !up.includes('ionization')) {
    throw new Error('nacl: сублимация, диссоциация и ионизация обязаны быть эндотермическими (ΔH > 0)')
  }
  const ea = NACL_LADDER.stages.find((s) => s.kind === 'affinity')
  if (!ea || ea.dH >= 0) throw new Error('nacl: сродство хлора к электрону обязано быть отрицательным')
}
