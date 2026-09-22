import {
  bondAngleDeg,
  bondEnthalpyKJ,
  bondLengthPm,
  dHfKJ,
  dipoleDebye,
  reactionEnthalpyBothKJ,
} from '../../../../chemistry/data'
import { assertLadderMatchesFormation, type Ladder, type LadderStage } from '../kit/energyLadderData'
import { so2CueAt, SO2_STEPS } from './so2Steps'

/**
 * Энергетика S (тв., ромбическая) + O₂ (г.) → SO₂ (г.).
 *
 * Это НЕ цикл Борна — Габера: связь ковалентная, ионов и решётки нет.
 * Лестница молекулярная, три ступени на 1 моль SO₂ (298 K, кДж/моль),
 * все числа — из chemistry/data, ни одного руками:
 *   атомизация серы  ⅛ S₈ (тв.) → S (г.)      +277,2  = ΔH°f(S, г.)
 *   диссоциация O₂   O₂ (г.) → 2 O (г.)        +498,4  = 2 · ΔH°f(O, г.)
 *   две связи S=O    S (г.) + 2 O (г.) → SO₂  −1072,4  (по закону Гесса)
 *   ───────────────────────────────────────────────────
 *   Σ = −296,8 = табличная ΔH°f(SO₂, г.)
 *
 * ЧЕСТНО О ТРЕТЬЕЙ СТУПЕНИ. Её не берут из таблицы энергий связей, а считают
 * по закону Гесса как разность: ΔH°f(SO₂) − (атомизация + диссоциация). Отсюда
 * 1072,4 / 2 = 536,2 кДж на связь — БОЛЬШЕ табличной средней энергии S=O
 * (522 кДж/моль), потому что 522 — это среднее по многим соединениям, а в самой
 * SO₂ π-плотность делокализована между обеими связями (резонанс) и связи прочнее.
 * Разница двух способов расчёта видна в MOLECULAR_REACTIONS.so2_from_elements:
 * по связям −280,0, по ΔH°f −296,8 кДж/моль.
 *
 * Файл без THREE и React — его читают панель энергии и тесты.
 */

/** ⅛ S₈ (тв.) → S (г.): энтальпия атомизации ромбической серы, кДж/моль. */
export const SO2_ATOMIZATION_S_KJ = dHfKJ('S(g)')

/** O₂ (г.) → 2 O (г.): полная диссоциация молекулы кислорода, кДж/моль. */
export const SO2_DISSOCIATION_O2_KJ = 2 * dHfKJ('O(g)')

/** Табличная ΔH°f(SO₂, г.), кДж/моль. */
export const SO2_DHF_TABLE_KJ = dHfKJ('SO2(g)')

/** S (г.) + 2 O (г.) → SO₂ (г.): образование двух связей S=O по закону Гесса, кДж/моль. */
export const SO2_BONDS_KJ =
  Math.round((SO2_DHF_TABLE_KJ - SO2_ATOMIZATION_S_KJ - SO2_DISSOCIATION_O2_KJ) * 10) / 10

/** Энергия ОДНОЙ связи S=O в самой молекуле SO₂ (по циклу), кДж/моль: 536,2. */
export const SO2_BOND_IN_MOLECULE_KJ = Math.round((-SO2_BONDS_KJ / 2) * 10) / 10

/** Средняя табличная энергия связи S=O по многим соединениям, кДж/моль: 522. */
export const SO2_BOND_MEAN_KJ = bondEnthalpyKJ('S=O')

/** Время сюжета, к которому каждая ступень считается пройденной. */
const STAGE_AT: Record<string, number> = {
  atomization: so2CueAt('sFree'),
  dissociation: so2CueAt('o2Break'),
  bonds: so2CueAt('bond2'),
}

const STAGES: readonly LadderStage[] = [
  {
    id: 'atomization',
    dH: SO2_ATOMIZATION_S_KJ,
    at: STAGE_AT.atomization!,
    equation: '⅛ S₈ (тв.) → S (г.)',
    // Ступень «твёрдое простое вещество → одноатомный газ» — та же сублимация,
    // что и у металлов в цикле Борна — Габера, только у серы рвутся связи S–S кольца.
    kind: 'sublimation',
  },
  {
    id: 'dissociation',
    dH: SO2_DISSOCIATION_O2_KJ,
    at: STAGE_AT.dissociation!,
    equation: 'O₂ (г.) → 2 O (г.)',
    kind: 'dissociation',
  },
  {
    id: 'bonds',
    dH: SO2_BONDS_KJ,
    at: STAGE_AT.bonds!,
    equation: 'S (г.) + 2 O (г.) → SO₂ (г.)',
    kind: 'bond',
  },
]

export const SO2_LADDER: Ladder = {
  cycleId: 'so2',
  formula: 'SO₂',
  equation: 'S (тв., ромб.) + O₂ (г.) → SO₂ (г.)',
  stages: STAGES,
  sumKJ: Math.round(STAGES.reduce((s, x) => s + x.dH, 0) * 10) / 10,
  tableKJ: SO2_DHF_TABLE_KJ,
}

/** Теплота образования SO₂ для подписи в 3D, кДж/моль: −297. */
export const SO2_DHF_KJ = Math.round(SO2_LADDER.sumKJ)

/** Сумма затратных ступеней (без образования связей), кДж/моль: +775,6. */
export const SO2_COST_BEFORE_BONDS_KJ =
  Math.round(STAGES.filter((s) => s.dH > 0).reduce((sum, s) => sum + s.dH, 0) * 10) / 10

/** Шаг урока, на котором показывают блок энергии целиком. */
export const SO2_ENERGY_STEP_INDEX = SO2_STEPS.findIndex((s) => s.id === 'energy')

/** Геометрия и полярность продукта — для подписей и текстов (всё из справочника). */
export const SO2_FACTS = {
  /** O–S–O, градусы: 119,5 (уголковая молекула) */
  angleDeg: bondAngleDeg('sulfurDioxide'),
  /** O–C–O в CO₂ для сравнения: 180 (линейная) */
  co2AngleDeg: bondAngleDeg('carbonDioxide'),
  /** ∠S–S–S в короне S₈: 108 */
  ringAngleDeg: bondAngleDeg('sulfurRing'),
  /** длина связи S=O, пм: 143,1 */
  bondSOPm: bondLengthPm('S=O'),
  /** длина связи S–S в кольце, пм: 205,5 */
  bondSSPm: bondLengthPm('S-S'),
  /** длина связи O=O, пм (r_e, bondData 'O=O') */
  bondOOPm: bondLengthPm('O=O'),
  /** дипольный момент SO₂, D: 1,63 (молекула полярна) */
  dipoleD: dipoleDebye('SO2')!,
  /** дипольный момент CO₂, D: 0 (связи полярны, молекула — нет) */
  co2DipoleD: dipoleDebye('CO2')!,
} as const

/**
 * Тепловой эффект каталитического окисления 2 SO₂ + O₂ ⇌ 2 SO₃, кДж
 * (по закону Гесса из табличных ΔH°f) — для шага «свойства».
 */
export const SO3_OXIDATION_DH_KJ = Math.round((2 * dHfKJ('SO3(g)') - 2 * dHfKJ('SO2(g)')) * 10) / 10

/**
 * Суммарное уравнение в машинном виде (ASCII-формулы) — для теста стехиометрии.
 * Сера — простое вещество в стандартном состоянии (кольцо S₈), но в уравнении
 * школьного учебника её пишут как S: коэффициенты балансируются по АТОМАМ.
 */
export const SO2_REACTION = {
  left: [
    { formula: 'S', coeff: 1 },
    { formula: 'O2', coeff: 1 },
  ],
  right: [{ formula: 'SO2', coeff: 1 }],
} as const

/** Уравнения-спутники шага «свойства» — тоже проверяются тестом на баланс. */
export const SO2_SIDE_REACTIONS = {
  sulfurousAcid: {
    left: [
      { formula: 'SO2', coeff: 1 },
      { formula: 'H2O', coeff: 1 },
    ],
    right: [{ formula: 'H2SO3', coeff: 1 }],
  },
  sulfurTrioxide: {
    left: [
      { formula: 'SO2', coeff: 2 },
      { formula: 'O2', coeff: 1 },
    ],
    right: [{ formula: 'SO3', coeff: 2 }],
  },
} as const

/** Проверка для теста: сумма ступеней совпадает с табличной ΔH°f. */
export function validateSo2Energetics(): void {
  assertLadderMatchesFormation(SO2_LADDER, 0.5)

  const atomization = SO2_LADDER.stages.find((s) => s.id === 'atomization')
  const dissociation = SO2_LADDER.stages.find((s) => s.id === 'dissociation')
  const bonds = SO2_LADDER.stages.find((s) => s.id === 'bonds')
  if (!atomization || atomization.dH <= 0) throw new Error('so2: атомизация серы обязана быть эндотермической (ΔH > 0)')
  if (!dissociation || dissociation.dH <= 0) throw new Error('so2: диссоциация O₂ обязана быть эндотермической (ΔH > 0)')
  if (!bonds || bonds.dH >= 0) throw new Error('so2: образование связей S=O обязано быть экзотермическим (ΔH < 0)')

  // Без выигрыша от связей процесс был бы эндотермическим — это смысл шага 6.
  if (SO2_COST_BEFORE_BONDS_KJ <= 0) throw new Error('so2: затратные ступени обязаны давать плюс')
  if (SO2_DHF_KJ >= 0) throw new Error('so2: образование SO₂ экзотермично, ΔH°f < 0')

  // Связь в самой SO₂ прочнее средней табличной S=O — из-за делокализации.
  if (!(SO2_BOND_IN_MOLECULE_KJ > SO2_BOND_MEAN_KJ)) {
    throw new Error(
      `so2: связь в молекуле (${SO2_BOND_IN_MOLECULE_KJ}) обязана быть прочнее средней табличной S=O (${SO2_BOND_MEAN_KJ})`,
    )
  }

  // Два независимых способа расчёта теплового эффекта не должны разойтись сильно.
  const both = reactionEnthalpyBothKJ('so2_from_elements')
  if (Math.abs(both.deltaKJ) > 25) {
    throw new Error(`so2: расчёт по связям (${both.fromBonds}) и по ΔH°f (${both.fromFormation}) разошлись слишком сильно`)
  }
  if (Math.abs(both.fromFormation - SO2_DHF_TABLE_KJ) > 0.01) {
    throw new Error('so2: ΔH°f реакции из MOLECULAR_REACTIONS обязана совпасть с табличной ΔH°f(SO₂)')
  }

  // Геометрия: уголковая молекула, CO₂ — линейная; SO₂ полярна, CO₂ нет.
  if (!(SO2_FACTS.angleDeg > 90 && SO2_FACTS.angleDeg < 180)) throw new Error('so2: O–S–O обязан быть между 90° и 180°')
  if (SO2_FACTS.co2AngleDeg !== 180) throw new Error('so2: CO₂ обязан быть линейным (180°)')
  if (!(SO2_FACTS.dipoleD > 0)) throw new Error('so2: SO₂ полярна, μ > 0')
  if (SO2_FACTS.co2DipoleD !== 0) throw new Error('so2: CO₂ неполярна, μ = 0')
  if (SO3_OXIDATION_DH_KJ >= 0) throw new Error('so2: окисление SO₂ до SO₃ экзотермично')
}
