import {
  MOLECULAR_REACTIONS,
  bondAngleDeg,
  bondEnthalpyKJ,
  bondLengthPm,
  dHfKJ,
  dipoleDebye,
  getCrystal,
  reactionEnthalpyBothKJ,
} from '../../../../chemistry/data'
import { assertLadderMatchesFormation, type Ladder, type LadderStage } from '../kit/energyLadderData'
import { NH3_STEPS, nh3CueAt } from './nh3Steps'

/**
 * Энергетика N₂ (г) + 3 H₂ (г) ⇌ 2 NH₃ (г) — синтез аммиака по Габеру — Бошу.
 *
 * Здесь НЕТ термодинамических чисел: все они приходят из
 * src/chemistry/data/thermoData.ts и bondData.ts.
 *
 * Лестница энергии у аммиака НЕ борн-габеровская: вещество молекулярное, ионной
 * решётки нет. Ступени — энергии связей (кДж на уравнение, то есть на 2 моль NH₃):
 *
 *   разорвать  1 × N≡N            +945      (самая дорогая ступень реакции)
 *   разорвать  3 × H–H            +1307,4   (3 × 435,8)
 *   образовать 6 × N–H            −2346     (6 × 391)
 *   ────────────────────────────────────────
 *   Σ = −93,6 кДж ≈   по ΔH°f: 2 · (−45,9) = −91,8 кДж
 *
 * Расхождение 1,8 кДж — обычное для расчёта по СРЕДНИМ энергиям связей
 * (E(N–H) = 391 кДж/моль усреднена по соединениям азота), выдумки здесь нет.
 *
 * ВАЖНО ДЛЯ УРОКА: катализатор НЕ меняет ни одну из этих ступеней. ΔH реакции
 * от катализатора не зависит — железо снижает только ЭНЕРГИЮ АКТИВАЦИИ, то есть
 * высоту барьера между исходными веществами и продуктами (см. HABER ниже).
 *
 * Файл без THREE и React — его читают панель энергии и тесты.
 */

const REACTION_ID = 'ammonia_2mol'

const REACTION = MOLECULAR_REACTIONS[REACTION_ID]!

/** Время сюжета, к которому ступень считается пройденной. */
const STAGE_AT: Record<string, number> = {
  hh: nh3CueAt('adsorb') + 1.6,
  nn: nh3CueAt('split'),
  nh: nh3CueAt('nh3'),
}

/** Ступень «разорвать n связей X»: ΔH = +n · E(X), эндотермическая. */
function breakStage(id: string, bond: 'N#N' | 'H-H', n: number, equation: string): LadderStage {
  return { id, kind: 'dissociation', dH: n * bondEnthalpyKJ(bond), at: STAGE_AT[id]!, equation }
}

/** Ступень «образовать 6 связей N–H»: ΔH = −6 · E(N–H), экзотермическая. */
function formStage(): LadderStage {
  const term = REACTION.bondsFormed[0]!
  return {
    id: 'nh',
    kind: 'bond',
    dH: -term.n * bondEnthalpyKJ(term.bond),
    at: STAGE_AT.nh!,
    equation: '2 N + 6 H → 2 NH₃',
  }
}

/** Оба способа посчитать тепловой эффект уравнения: по связям и по ΔH°f. */
export const NH3_ENTHALPY = reactionEnthalpyBothKJ(REACTION_ID)

/**
 * Лестница энергии по связям на ОДНО уравнение (2 моль NH₃).
 * `tableKJ` — независимая проверка по закону Гесса через ΔH°f.
 */
export const NH3_LADDER: Ladder = {
  cycleId: REACTION_ID,
  formula: 'NH₃',
  equation: 'N₂ (г) + 3 H₂ (г) ⇌ 2 NH₃ (г)',
  stages: [
    breakStage('hh', 'H-H', REACTION.bondsBroken.find((b) => b.bond === 'H-H')!.n, '3 H–H → 6 H'),
    breakStage('nn', 'N#N', REACTION.bondsBroken.find((b) => b.bond === 'N#N')!.n, 'N≡N → 2 N'),
    formStage(),
  ].sort((a, b) => a.at - b.at),
  sumKJ: NH3_ENTHALPY.fromBonds,
  tableKJ: NH3_ENTHALPY.fromFormation,
}

/** Тепловой эффект уравнения N₂ + 3 H₂ ⇌ 2 NH₃, кДж (округлённо −92). */
export const NH3_REACTION_DH_KJ = Math.round(NH3_ENTHALPY.fromFormation)

/** Табличная ΔH°f(NH₃, г), кДж/моль: −45,9. */
export const NH3_DHF_KJ = dHfKJ('NH3(g)')

/** Энергия тройной связи N≡N, кДж/моль — «почему азот инертен». */
export const NN_BOND_KJ = bondEnthalpyKJ('N#N')

/** Справочная геометрия молекул сцены (пм и градусы). */
export const NH3_GEOMETRY = {
  nnPm: bondLengthPm('N#N'),
  hhPm: bondLengthPm('H-H'),
  nhPm: bondLengthPm('N-H'),
  /** валентный угол H–N–H в тригональной пирамиде */
  angleDeg: bondAngleDeg('ammonia'),
  /** дипольный момент NH₃, Д */
  dipoleD: dipoleDebye('NH3'),
  nhBondKJ: bondEnthalpyKJ('N-H'),
  hhBondKJ: bondEnthalpyKJ('H-H'),
} as const

/** Кристалл катализатора: α-Fe, ОЦК Im-3m, a = 286,65 пм, КЧ 8. */
export const NH3_CATALYST_CRYSTAL = getCrystal('fe_metal')!

/**
 * УСЛОВИЯ ПРОМЫШЛЕННОГО ПРОЦЕССА ГАБЕРА — БОША.
 *
 * Это КИНЕТИКА и технология, а не справочные термодинамические величины, поэтому
 * числа живут здесь, а не в src/chemistry/data (там только атомные радиусы, связи,
 * решётки и энтальпии). Источники: Appl «Ammonia» (Ullmann's Encyclopedia of
 * Industrial Chemistry), Ertl «Primary steps in catalytic synthesis of ammonia»,
 * школьный курс Kimyo 9.
 *
 * Честно про неопределённость: КАЖУЩАЯСЯ энергия активации синтеза на промотиро-
 * ванном железе у разных авторов и при разных условиях лежит в пределах
 * 60…100 кДж/моль — поэтому показан интервал, а не одно число. Барьер БЕЗ
 * катализатора оценивается энергией разрыва N≡N: 945 кДж/моль (это надёжное
 * табличное значение из bondData.ts, см. NN_BOND_KJ).
 */
export const HABER = {
  /** рабочая температура, °C */
  tempC: [400, 500] as const,
  /** рабочее давление, МПа */
  pressureMPa: [20, 30] as const,
  /** то же давление в атмосферах (для школьного текста) */
  pressureAtm: [200, 300] as const,
  /** выход за один проход через колонну, % (остальное возвращают в цикл) */
  yieldPerPassPct: 15,
  /** кажущаяся энергия активации на промотированном железе, кДж/моль */
  eaCatalystKJ: [60, 100] as const,
  /** барьер без катализатора ≈ энергия разрыва N≡N, кДж/моль */
  eaPlainKJ: NN_BOND_KJ,
  /** состав катализатора: железо с промоторами */
  catalyst: 'Fe / K₂O / Al₂O₃',
} as const

/** Шаг урока, на котором показывают блок энергии целиком. */
export const NH3_ENERGY_STEP_INDEX = NH3_STEPS.findIndex((s) => s.id === 'energy')

/**
 * Суммарное уравнение в машинном виде (ASCII-формулы) — для теста стехиометрии.
 * Реакция ОБРАТИМАЯ: `reversible: true` — в текстах и подписях только «⇌».
 */
export const NH3_REACTION = {
  left: [
    { formula: 'N2', coeff: 1 },
    { formula: 'H2', coeff: 3 },
  ],
  right: [{ formula: 'NH3', coeff: 2 }],
  reversible: true,
} as const

/** Проверка для теста и dev-режима сцены. */
export function validateNh3Energetics(): void {
  // 1. Сумма ступеней по связям совпадает с расчётом по ΔH°f (допуск 5 кДж).
  assertLadderMatchesFormation(NH3_LADDER, 5)

  // 2. Знаки: обе диссоциации вверх, образование связей вниз, итог экзотермический.
  const byId = new Map(NH3_LADDER.stages.map((s) => [s.id, s]))
  const nn = byId.get('nn')
  const hh = byId.get('hh')
  const nh = byId.get('nh')
  if (!nn || nn.dH <= 0) throw new Error('nh3: разрыв N≡N обязан быть эндотермическим (ΔH > 0)')
  if (!hh || hh.dH <= 0) throw new Error('nh3: разрыв H–H обязан быть эндотермическим (ΔH > 0)')
  if (!nh || nh.dH >= 0) throw new Error('nh3: образование связей N–H обязано быть экзотермическим (ΔH < 0)')
  if (NH3_LADDER.sumKJ >= 0) throw new Error('nh3: синтез аммиака экзотермический, сумма обязана быть < 0')

  // 3. N≡N — самая дорогая ОДИНОЧНАЯ связь в реакции: отсюда инертность азота.
  if (!(bondEnthalpyKJ('N#N') > bondEnthalpyKJ('H-H') && bondEnthalpyKJ('N#N') > bondEnthalpyKJ('N-H'))) {
    throw new Error('nh3: E(N≡N) обязана быть больше E(H–H) и E(N–H)')
  }

  // 4. Катализатор снижает барьер, но НЕ меняет ΔH: интервал Eₐ(Fe) строго ниже E(N≡N).
  if (!(HABER.eaCatalystKJ[1] < HABER.eaPlainKJ)) {
    throw new Error('nh3: барьер на железе обязан быть ниже энергии разрыва N≡N')
  }

  // 5. Ле Шателье: газов слева 4 моль, справа 2 моль — давление смещает вправо.
  const molesLeft = NH3_REACTION.left.reduce((s, x) => s + x.coeff, 0)
  const molesRight = NH3_REACTION.right.reduce((s, x) => s + x.coeff, 0)
  if (!(molesLeft > molesRight)) throw new Error('nh3: слева обязано быть больше молей газа, чем справа')
}

/** Δn(газ) = 2 − 4 = −2: число молей газа уменьшается, поэтому давление смещает равновесие вправо. */
export const NH3_DELTA_N =
  NH3_REACTION.right.reduce((s, x) => s + x.coeff, 0) - NH3_REACTION.left.reduce((s, x) => s + x.coeff, 0)
