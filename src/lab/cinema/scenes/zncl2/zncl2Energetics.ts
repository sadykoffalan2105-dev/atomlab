import { cellPotentialV, dHfKJ, standardPotentialV, STANDARD_POTENTIALS_V } from '../../../../chemistry/data'
import { assertLadderMatchesFormation, buildBornHaberLadder, type Ladder } from '../kit/energyLadderData'
import { ZNCL2_STEPS } from './zncl2Steps'

/**
 * Энергетика Zn (тв.) + 2 HCl (р-р) → ZnCl₂ (р-р) + H₂ (г.)↑.
 *
 * Тепловой эффект реакции равен ΔH°f(Zn²⁺, водн) = −153,9 кДж/моль, потому что
 * ΔH°f остальных участников ИОННОГО уравнения Zn + 2 H⁺ → Zn²⁺ + H₂ равны нулю
 * по определению: Zn (тв.) и H₂ (г.) — простые вещества, а H⁺ (водн) — начало
 * отсчёта шкалы ионов в растворе. Хлорид-ионы в реакции не участвуют, поэтому
 * их вклад (2 × −167,2 кДж/моль) сокращается слева и справа.
 *
 * Лестница — НЕ цикл Борна — Габера (решётки у продукта нет), а цикл Гесса того
 * же вида: реакцию в растворе разложили на газофазные стадии. Числа живут не
 * здесь, а в BORN_HABER.zncl2_aq (chemistry/data/thermoData.ts), кДж/моль, 298 K:
 *   Zn (тв) → Zn (г)                 +130,4   (сублимация, NIST-JANAF)
 *   Zn (г) → Zn⁺ (г) + e⁻            +906,4   (IE₁, CRC)
 *   Zn⁺ (г) → Zn²⁺ (г) + e⁻         +1733,3   (IE₂, CRC)
 *   2 H⁺ (водн) → 2 H⁺ (г)          +2182,0   (−2 · ΔH_гидр(H⁺) = −2 · (−1091))
 *   2 H⁺ (г) + 2e⁻ → 2 H (г)        −2624,0   (−2 · IE₁(H) = −2 · 1312)
 *   2 H (г) → H₂ (г)                 −436,0   (−2·ΔH°f(H, г); E(H–H) 435,8 — на 0,2 меньше)
 *   Zn²⁺ (г) → Zn²⁺ (водн)          −2046,0   (энтальпия гидратации)
 *   ───────────────────────────────────────────
 *   Σ = −153,9 = ΔH°f(Zn²⁺, водн) — табличное значение
 *
 * ВАЖНО про шкалу: абсолютных энтальпий гидратации отдельных ионов не бывает,
 * все значения привязаны к условию ΔH_гидр(H⁺) = −1091 кДж/моль (Smith, 1977).
 * В электронейтральном уравнении эта опорная точка сокращается, поэтому сумма
 * от выбора шкалы не зависит. Сравнивать отдельные ступени со значениями из
 * другого справочника напрямую НЕЛЬЗЯ.
 *
 * Файл без THREE и React — его читают панель энергии и тесты.
 */

/**
 * Время сюжета, к которому ступень считается пройденной.
 *
 * Здесь, в отличие от NaCl, ступени НЕ привязаны к событиям сцены: цикл Гесса —
 * это мысленный обходной путь через газовую фазу, которого в стакане не
 * происходит. Поэтому лестница заполняется по порядку на шаге «энергия»,
 * и порядок ступеней — естественный: сначала затраты, потом выигрыш.
 */
const STAGE_AT: Record<string, number> = {
  sublimation: 21.3,
  ionization1: 21.8,
  ionization2: 22.3,
  dehydration: 22.8,
  neutralization: 23.3,
  recombination: 23.8,
  hydration: 24.3,
}

export const ZNCL2_LADDER: Ladder = buildBornHaberLadder('zncl2_aq', STAGE_AT)

/** Тепловой эффект реакции по сумме цикла, кДж/моль: −154. */
export const ZNCL2_REACTION_DH_KJ = Math.round(ZNCL2_LADDER.sumKJ)

/** Табличная ΔH°f(Zn²⁺, водн), кДж/моль — с ней сверяется сумма. */
export const ZNCL2_DHF_TABLE_KJ = ZNCL2_LADDER.tableKJ

/** ΔH°f(ZnCl₂, водн) = ΔH°f(Zn²⁺) + 2·ΔH°f(Cl⁻), кДж/моль: −488,3. */
export const ZNCL2_SOLUTION_DHF_KJ = dHfKJ('ZnCl2(aq)')

/** ΔH°f(ZnCl₂, тв.), кДж/моль: −415,1 — БЕЗВОДНАЯ соль (её получают упариванием в токе сухого HCl). */
export const ZNCL2_SOLID_DHF_KJ = dHfKJ('ZnCl2(s)')

/** Сумма затратных ступеней (ΔH > 0), кДж/моль. */
export const ZNCL2_COST_KJ = Math.round(
  ZNCL2_LADDER.stages.filter((s) => s.dH > 0).reduce((sum, s) => sum + s.dH, 0),
)

/** Сумма выигрышных ступеней (ΔH < 0), кДж/моль. */
export const ZNCL2_GAIN_KJ = Math.round(
  ZNCL2_LADDER.stages.filter((s) => s.dH < 0).reduce((sum, s) => sum + s.dH, 0),
)

/** Шаг урока, на котором показывают блок энергии целиком. */
export const ZNCL2_ENERGY_STEP_INDEX = ZNCL2_STEPS.findIndex((s) => s.id === 'energy')

// ─────────────────────────────────────────────────────────────────────────────
// Электрохимия: почему цинк растворяется, а медь — нет
// ─────────────────────────────────────────────────────────────────────────────

/** E°(Zn²⁺/Zn) = −0,76 В. */
export const ZNCL2_E0_ZN_V = standardPotentialV('Zn2+/Zn')
/** E°(2H⁺/H₂) = 0,00 В — ноль шкалы по определению (стандартный водородный электрод). */
export const ZNCL2_E0_H_V = standardPotentialV('H+/H2')
/** E°(Cu²⁺/Cu) = +0,34 В. */
export const ZNCL2_E0_CU_V = standardPotentialV('Cu2+/Cu')

/** ЭДС реакции Zn + 2H⁺: E° = E°(H⁺/H₂) − E°(Zn²⁺/Zn) = +0,76 В > 0 — идёт. */
export const ZNCL2_CELL_V = cellPotentialV('H+/H2', 'Zn2+/Zn')

/** Та же ЭДС для меди: −0,34 В < 0 — медь в соляной кислоте НЕ растворяется. */
export const ZNCL2_CELL_CU_V = cellPotentialV('H+/H2', 'Cu2+/Cu')

/** Подписи пар для панели (half берём из справочника, а не пишем руками). */
export const ZNCL2_COUPLES = {
  zn: STANDARD_POTENTIALS_V['Zn2+/Zn']!,
  h: STANDARD_POTENTIALS_V['H+/H2']!,
  cu: STANDARD_POTENTIALS_V['Cu2+/Cu']!,
} as const

/**
 * Полуреакции с ЭЛЕКТРОННЫМ балансом: цинк отдаёт ровно 2 e⁻, два протона
 * принимают ровно 2 e⁻. Заряд тоже сходится: слева 0 + 2(+1) = +2,
 * справа (+2) + 0 = +2.
 */
export const ZNCL2_HALF_REACTIONS = [
  {
    id: 'oxidation' as const,
    equation: 'Zn⁰ − 2e⁻ → Zn²⁺',
    /** электронов отдано одной частицей */
    electrons: 2,
    /** во сколько раз взята полуреакция */
    times: 1,
    chargeLeft: 0,
    chargeRight: 2,
    e0V: ZNCL2_E0_ZN_V,
  },
  {
    id: 'reduction' as const,
    equation: '2 H⁺ + 2e⁻ → H₂↑',
    electrons: 2,
    times: 1,
    chargeLeft: 2,
    chargeRight: 0,
    e0V: ZNCL2_E0_H_V,
  },
] as const

/** Молекулярное уравнение в машинном виде (ASCII-формулы) — для теста стехиометрии. */
export const ZNCL2_REACTION = {
  left: [
    { formula: 'Zn', coeff: 1 },
    { formula: 'HCl', coeff: 2 },
  ],
  right: [
    { formula: 'ZnCl2', coeff: 1 },
    { formula: 'H2', coeff: 1 },
  ],
} as const

/**
 * Сокращённое ИОННОЕ уравнение: хлорид-ионы — зрители и в него не входят.
 * Заряды: слева 0 + 2(+1) = +2, справа (+2) + 0 = +2.
 */
export const ZNCL2_IONIC_REACTION = {
  left: [
    { formula: 'Zn', coeff: 1, charge: 0 },
    { formula: 'H', coeff: 2, charge: 1 },
  ],
  right: [
    { formula: 'Zn', coeff: 1, charge: 2 },
    { formula: 'H2', coeff: 1, charge: 0 },
  ],
} as const

/** Проверка для теста: сумма ступеней совпадает с табличной ΔH°f и знаки верные. */
export function validateZncl2Energetics(): void {
  assertLadderMatchesFormation(ZNCL2_LADDER, 1)

  const byId = new Map(ZNCL2_LADDER.stages.map((s) => [s.id, s]))
  const up = ['sublimation', 'ionization1', 'ionization2', 'dehydration']
  for (const id of up) {
    const s = byId.get(id)
    if (!s || s.dH <= 0) throw new Error(`zncl2: ступень «${id}» обязана быть эндотермической (ΔH > 0)`)
  }
  const down = ['neutralization', 'recombination', 'hydration']
  for (const id of down) {
    const s = byId.get(id)
    if (!s || s.dH >= 0) throw new Error(`zncl2: ступень «${id}» обязана быть экзотермической (ΔH < 0)`)
  }

  if (!(byId.get('ionization2')!.dH > byId.get('ionization1')!.dH)) {
    throw new Error('zncl2: IE₂ обязана быть больше IE₁ — второй электрон отрывают от катиона')
  }
  if (ZNCL2_REACTION_DH_KJ >= 0) throw new Error('zncl2: реакция экзотермическая, ΔH обязана быть отрицательной')

  // Электрохимия: цинк активнее водорода, медь — нет.
  if (!(ZNCL2_CELL_V > 0)) throw new Error('zncl2: E° реакции с цинком обязана быть положительной')
  if (!(ZNCL2_CELL_CU_V < 0)) throw new Error('zncl2: E° реакции с медью обязана быть отрицательной (медь не растворяется)')
  if (ZNCL2_E0_H_V !== 0) throw new Error('zncl2: E°(2H⁺/H₂) — ноль шкалы по определению')

  // Электронный и зарядовый баланс полуреакций.
  const given = ZNCL2_HALF_REACTIONS[0].electrons * ZNCL2_HALF_REACTIONS[0].times
  const taken = ZNCL2_HALF_REACTIONS[1].electrons * ZNCL2_HALF_REACTIONS[1].times
  if (given !== taken) throw new Error(`zncl2: отдано ${given} e⁻, принято ${taken} e⁻`)
}
