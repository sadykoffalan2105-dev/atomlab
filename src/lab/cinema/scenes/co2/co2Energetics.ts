import {
  ATOMIC_DATA,
  bondAngleDeg,
  bondEnthalpyKJ,
  bondLengthPm,
  dHfKJ,
  dipoleDebye,
  getCrystal,
} from '../../../../chemistry/data'
import { assertLadderMatchesFormation, buildBornHaberLadder, type Ladder } from '../kit/energyLadderData'
import { co2CueAt, CO2_STEPS } from './co2Steps'

/**
 * Энергетика C (графит) + O₂ (г.) → CO₂ (г.) — цикл Гесса на 1 моль CO₂.
 *
 * Числа НЕ живут здесь: они приходят из BORN_HABER.co2 и FORMATION_ENTHALPY
 * (chemistry/data/thermoData.ts), кДж/моль, 298 K:
 *   атомизация графита C (тв.) → C (г.)   +716,7   (= ΔH°f(C, г.), NIST-JANAF)
 *   диссоциация O₂ (г.) → 2 O (г.)        +498,4   (= 2 · ΔH°f(O, г.) = 2 · 249,2)
 *   образование двух связей C=O          −1608,6   (по закону Гесса)
 *   ───────────────────────────────────────────
 *   Σ = −393,5 = ΔH°f(CO₂, г.) — сходится ТОЧНО.
 *
 * ЧЕСТНАЯ ОГОВОРКА, которая повторена в тексте шага 2 и в подписи лестницы:
 * это путь РАСЧЁТА, а не механизм. Уголь горит на поверхности твёрдой фазы,
 * свободных атомов C (г.) в пламени нет. Закон Гесса разрешает считать
 * по любому пути — ответ от пути не зависит.
 *
 * Отсюда энергия ОДНОЙ связи C=O в самой CO₂: 1608,6 / 2 = 804,3 кДж/моль,
 * тогда как справочная СРЕДНЯЯ энергия связи C=O(CO₂) = 799 кДж/моль.
 * Расчёт по средним энергиям связей даёт −383 вместо −393,5: разница
 * ≈ 10 кДж/моль — это и есть школьный вывод о точности средних энергий связей.
 *
 * Файл без THREE и React — его читают панель энергии и тесты.
 */

/** Время сюжета, к которому каждая ступень считается пройденной. */
const STAGE_AT: Record<string, number> = {
  atomization: co2CueAt('detach'),
  dissociation: co2CueAt('o2Break'),
  bonds: co2CueAt('bond2'),
}

export const CO2_LADDER: Ladder = buildBornHaberLadder('co2', STAGE_AT)

/** Теплота образования CO₂ (г.) по сумме цикла, кДж/моль: −393,5. */
export const CO2_DHF_KJ = CO2_LADDER.sumKJ

/** Табличная ΔH°f(CO₂, г.), кДж/моль. */
export const CO2_DHF_TABLE_KJ = CO2_LADDER.tableKJ

/** ΔH°f угарного газа CO (г.), кДж/моль: −110,5 — ветка неполного сгорания. */
export const CO_DHF_KJ = dHfKJ('CO(g)')

/**
 * 2 C (графит) + O₂ (г.) → 2 CO (г.): тепловой эффект уравнения, кДж.
 * Вдвое меньше тепла, чем даёт полное сгорание того же углерода, — и это
 * главный практический довод против неполного сгорания (кроме ядовитости CO).
 */
export const CO_REACTION_DH_KJ = 2 * CO_DHF_KJ

/** Сумма эндотермических ступеней (атомизация + диссоциация), кДж/моль: +1215,1. */
export const CO2_COST_KJ = Math.round(
  CO2_LADDER.stages.filter((s) => s.dH > 0).reduce((sum, s) => sum + s.dH, 0) * 10,
) / 10

/** Выигрыш на образовании двух связей C=O, кДж/моль: −1608,6. */
export const CO2_BOND_GAIN_KJ = CO2_LADDER.stages.find((s) => s.kind === 'bond')!.dH

/** Энергия ОДНОЙ связи C=O в самой CO₂ по циклу Гесса, кДж/моль: 804,3. */
export const CO2_BOND_EXACT_KJ = Math.round((-CO2_BOND_GAIN_KJ / 2) * 10) / 10

/** Справочная СРЕДНЯЯ энергия связи C=O в CO₂, кДж/моль: 799. */
export const CO2_BOND_TABLE_KJ = bondEnthalpyKJ('C=O(CO2)')

/** Оценка ΔH по средним энергиям связей: +716,7 + 498 − 2·799 = −383,3 кДж/моль. */
export const CO2_DH_FROM_BONDS_KJ =
  Math.round((dHfKJ('C(g)') + bondEnthalpyKJ('O=O') - 2 * CO2_BOND_TABLE_KJ) * 10) / 10

/** Насколько оценка по средним связям расходится с истиной, кДж/моль: ≈ 10,2. */
export const CO2_BOND_ESTIMATE_GAP_KJ =
  Math.round(Math.abs(CO2_DH_FROM_BONDS_KJ - CO2_DHF_TABLE_KJ) * 10) / 10

// ─────────────────────────────────────────────────────────────────────────────
// Геометрия и полярность — справочные числа для подписей и текстов
// ─────────────────────────────────────────────────────────────────────────────

const GRAPHITE = getCrystal('graphite')!

/** Число со НАСТОЯЩИМ минусом U+2212 для подписей в 3D: −393.5, +716.7. */
function signed(n: number): string {
  return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n)
}

export const CO2_FACTS = {
  /** ΔH°f(CO₂, г.) как её пишут на подписи: «−393.5» */
  dHfText: signed(CO2_DHF_TABLE_KJ),
  /** ΔH°f(CO, г.) для предупреждения о неполном сгорании: «−110.5» */
  coDHfText: signed(CO_DHF_KJ),
  /** длина связи C=O в CO₂, пм */
  coPm: bondLengthPm('C=O(CO2)'),
  /** валентный угол O=C=O, градусы */
  angleDeg: bondAngleDeg('carbonDioxide'),
  /** дипольный момент молекулы CO₂, Д — строго ноль по симметрии */
  dipoleD: dipoleDebye('CO2')!,
  /** разность электроотрицательностей O − C по Полингу */
  deltaChi: Math.round((ATOMIC_DATA.O.electronegativity! - ATOMIC_DATA.C.electronegativity!) * 100) / 100,
  /** энергия связи O=O, кДж/моль */
  o2BondKJ: bondEnthalpyKJ('O=O'),
  /** длина связи O=O, пм */
  o2Pm: bondLengthPm('O=O'),
  /** тройная связь C≡O в угарном газе: длина, пм и энергия, кДж/моль */
  coTriplePm: bondLengthPm('C#O'),
  coTripleKJ: bondEnthalpyKJ('C#O'),
  graphite: {
    spaceGroup: GRAPHITE.spaceGroup,
    spaceGroupNo: GRAPHITE.spaceGroupNo,
    latticeType: GRAPHITE.latticeType,
    /** C–C внутри слоя, пм */
    ccPm: GRAPHITE.cationAnionPm,
    /** расстояние между слоями, пм = c/2 */
    layerPm: Math.round((GRAPHITE.cellPm.c! / 2) * 100) / 100,
    cellAPm: GRAPHITE.cellPm.a,
    cellCPm: GRAPHITE.cellPm.c!,
    /** КЧ атома углерода внутри слоя */
    coordination: GRAPHITE.coordination['C (в слое)']!,
    densityGCm3: GRAPHITE.densityGCm3,
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Окислительно-восстановительный баланс
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Полуреакции с ЭЛЕКТРОННЫМ балансом. Отдано ровно столько электронов,
 * сколько принято: 1 × 4 = 2 × 2. Заряд сходится: слева 0, справа 0.
 * Связи в CO₂ ковалентные полярные, поэтому «−4e⁻» — это СТЕПЕНЬ ОКИСЛЕНИЯ
 * (формальный учёт), а не настоящие ионы C⁴⁺ и O²⁻: электроны только смещены
 * к кислороду, но остались общими. Так и сказано в тексте шага 5.
 */
export const CO2_HALF_REACTIONS = [
  {
    id: 'oxidation' as const,
    equation: 'C⁰ − 4e⁻ → C⁺⁴',
    /** электронов отдано одной частицей */
    electrons: 4,
    /** во сколько раз взята полуреакция */
    times: 1,
    chargeLeft: 0,
    chargeRight: 4,
  },
  {
    id: 'reduction' as const,
    equation: 'O₂⁰ + 4e⁻ → 2 O⁻²',
    electrons: 4,
    times: 1,
    chargeLeft: 0,
    chargeRight: -4,
  },
] as const

/** Суммарное уравнение в машинном виде (ASCII-формулы) — для теста стехиометрии. */
export const CO2_REACTION = {
  left: [
    { formula: 'C', coeff: 1 },
    { formula: 'O2', coeff: 1 },
  ],
  right: [{ formula: 'CO2', coeff: 1 }],
} as const

/** Ветка неполного сгорания — показывается предупреждением на шаге 6. */
export const CO_REACTION = {
  left: [
    { formula: 'C', coeff: 2 },
    { formula: 'O2', coeff: 1 },
  ],
  right: [{ formula: 'CO', coeff: 2 }],
} as const

/** Шаг урока, на котором показывают блок энергии целиком. */
export const CO2_ENERGY_STEP_INDEX = CO2_STEPS.findIndex((s) => s.id === 'energy')

/** Проверка для теста: сумма ступеней совпадает с табличной ΔH°f. */
export function validateCo2Energetics(): void {
  assertLadderMatchesFormation(CO2_LADDER, 1)

  const atom = CO2_LADDER.stages.find((s) => s.id === 'atomization')
  if (!atom || atom.dH <= 0) throw new Error('co2: атомизация графита обязана быть эндотермической (ΔH > 0)')
  if (Math.abs(atom.dH - dHfKJ('C(g)')) > 1e-9) {
    throw new Error('co2: ступень атомизации обязана равняться ΔH°f(C, г.) из справочника')
  }

  const diss = CO2_LADDER.stages.find((s) => s.kind === 'dissociation')
  if (!diss || diss.dH <= 0) throw new Error('co2: диссоциация O₂ обязана быть эндотермической (ΔH > 0)')
  if (Math.abs(diss.dH - 2 * dHfKJ('O(g)')) > 1e-9) {
    throw new Error('co2: ступень диссоциации обязана равняться 2 · ΔH°f(O, г.)')
  }

  const bonds = CO2_LADDER.stages.find((s) => s.kind === 'bond')
  if (!bonds || bonds.dH >= 0) throw new Error('co2: образование связей обязано быть экзотермическим (ΔH < 0)')

  if (!(CO2_DHF_KJ < 0)) throw new Error('co2: горение углерода обязано быть экзотермическим')
  if (!(CO_DHF_KJ < 0)) throw new Error('co2: образование CO тоже экзотермично')
  // На 1 моль углерода: полное сгорание −393,5, неполное −110,5 кДж — втрое меньше.
  if (!(CO2_DHF_KJ < CO_DHF_KJ)) {
    throw new Error('co2: полное сгорание обязано давать больше тепла на моль углерода, чем неполное')
  }
  if (Math.abs(CO_REACTION_DH_KJ - 2 * CO_DHF_KJ) > 1e-9) {
    throw new Error('co2: тепловой эффект 2 C + O₂ → 2 CO обязан быть вдвое больше ΔH°f(CO)')
  }

  // Полярность: связь полярна (Δχ заметно > 0), молекула — нет (μ = 0 по симметрии).
  if (!(CO2_FACTS.deltaChi > 0.4)) throw new Error('co2: связь C=O обязана быть полярной (Δχ > 0.4)')
  if (CO2_FACTS.dipoleD !== 0) throw new Error('co2: линейная симметричная CO₂ обязана иметь μ = 0')
  if (CO2_FACTS.angleDeg !== 180) throw new Error('co2: молекула CO₂ обязана быть линейной (180°)')

  // Тройная связь в CO прочнее и короче двойной C=O в CO₂ — иначе ветка CO нарисована неверно.
  if (!(CO2_FACTS.coTripleKJ > CO2_BOND_TABLE_KJ)) throw new Error('co2: связь C≡O в CO прочнее связи C=O в CO₂')
  if (!(CO2_FACTS.coTriplePm < CO2_FACTS.coPm)) throw new Error('co2: связь C≡O в CO короче связи C=O в CO₂')

  // Оценка по средним энергиям связей заметно расходится с истиной — это тема шага 6.
  if (!(CO2_BOND_ESTIMATE_GAP_KJ > 5 && CO2_BOND_ESTIMATE_GAP_KJ < 20)) {
    throw new Error(`co2: расхождение оценки по связям ${CO2_BOND_ESTIMATE_GAP_KJ} вне ожидаемых 5…20 кДж/моль`)
  }
}
