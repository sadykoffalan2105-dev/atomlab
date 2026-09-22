import {
  ATOMIC_DATA,
  bondAngleDeg,
  bondEnthalpyKJ,
  bondLengthPm,
  dHfKJ,
  dipoleDebye,
  formationReactionKJ,
  getCrystal,
  REACTION_STEP_CHAINS,
} from '../../../../chemistry/data'
import { assertLadderMatchesFormation, buildBornHaberLadder, type Ladder } from '../kit/energyLadderData'
import { CO2_STAGES, CO2_STEPS } from './co2Steps'

/**
 * Энергетика C (графит) + O₂ (г.) → CO₂ (г.) на 1 моль CO₂.
 *
 * ДВА РАЗНЫХ ВОПРОСА — два разных набора чисел, оба только из ядра (thermoData):
 *
 * 1) ЛЕСТНИЦА ГЕССА (панель урока) — BORN_HABER.co2: атомизация графита, диссоциация O₂
 *    (множитель 2 × ΔH°f(O, г.)), образование двух связей C=O; сумма = ΔH°f(CO₂, г.).
 *    Это путь РАСЧЁТА. Ступень «C (графит) → C (г.)» — НЕ ФИЗИЧЕСКАЯ СТАДИЯ: свободного атома
 *    углерода в горении графита нет, атомизация дороже, чем вся реакция даёт на моль CO₂.
 *    Так и подписано в тексте урока и в подписи ступени.
 *
 * 2) МЕХАНИЗМ (то, что показывает 3D) — REACTION_STEP_CHAINS.c_o2:
 *    C (графит) + ½ O₂ → CO (с края слоя),  затем CO + ·OH → CO₂ + H· (дожигание в газе).
 *    Суммарно CO + ½ O₂ → CO₂ (co_combustion); co_formation + co_combustion = co2_formation.
 *
 * Файл без THREE и React — его читают панель энергии и тесты.
 */

/**
 * Время сюжета для ступеней лестницы. Лестница ФОРМАЛЬНАЯ (путь расчёта через свободные атомы),
 * поэтому её ступени НЕ синхронизированы с механизмом: поверхностный разрыв O=O не стоит 498,4
 * (его компенсируют связи C–O), а «атомизация» в кадре десорбции снова показала бы «атом C покидает
 * графит». Все ступени получают одно и то же время в самом начале урока — лестница видна целиком
 * с первого шага, порядок ступеней — порядок цикла в ядре.
 */
const LADDER_AT = CO2_STEPS[0]!.from + 0.3
const STAGE_AT: Record<string, number> = {
  dissociation: LADDER_AT,
  atomization: LADDER_AT,
  bonds: LADDER_AT,
}

/** Единое время ступеней лестницы (тест: не совпадает ни с одной стадией механизма). */
export const CO2_LADDER_AT = LADDER_AT

export const CO2_LADDER: Ladder = buildBornHaberLadder('co2', STAGE_AT)

/** Ступень лестницы по id ('atomization' | 'dissociation' | 'bonds'), кДж/моль. */
export function co2StageKJ(id: 'atomization' | 'dissociation' | 'bonds'): number {
  const s = CO2_LADDER.stages.find((x) => x.id === id)
  if (!s) throw new Error(`co2: нет ступени ${id}`)
  return s.dH
}

/** Теплота образования CO₂ (г.) по сумме лестницы, кДж/моль, одна десятая — для 3D-подписи. */
export const CO2_DHF_KJ = Math.round(CO2_LADDER.sumKJ * 10) / 10

/** Табличная ΔH°f(CO₂, г.), кДж/моль. */
export const CO2_DHF_TABLE_KJ = CO2_LADDER.tableKJ

/** ΔH°f угарного газа CO (г.), кДж/моль — первая стадия горения (CO уходит с края слоя). */
export const CO_DHF_KJ = dHfKJ('CO(g)')

/**
 * Стадии механизма в порядке показа: id записи FORMATION_REACTIONS и её ΔH, кДж на уравнение.
 * co_formation (−110,5) — ИТОГ двух стадий сцены: хемосорбция O₂ (экзотермична, from = adsorb.at)
 * плюс десорбция C(O) → CO (г.) (эндотермична, лимитирующая, at = desorb.at). Самой десорбции
 * это число не приписывается: at — кадр, когда CO уже в газе и итог стадий достигнут.
 */
export const CO2_MECHANISM: readonly { id: (typeof REACTION_STEP_CHAINS.c_o2)[number]; dH: number; from: number; at: number }[] =
  REACTION_STEP_CHAINS.c_o2.map((id) => ({
    id,
    dH: formationReactionKJ(id),
    from: id === 'co_formation' ? CO2_STAGES.adsorb.at : CO2_STAGES.oxidize.at,
    at: id === 'co_formation' ? CO2_STAGES.desorb.at : CO2_STAGES.oxidize.at,
  }))

/** CO + ·OH → CO₂ + H·, кДж на уравнение. */
export const CO_OH_KJ = formationReactionKJ('co_oh_oxidation')

/** CO + ½ O₂ → CO₂ (суммарное дожигание), кДж на моль CO. */
export const CO_COMBUSTION_KJ = formationReactionKJ('co_combustion')

/** Сумма затрат формального пути (атомизация + диссоциация), кДж/моль. */
export const CO2_COST_KJ =
  Math.round(CO2_LADDER.stages.filter((s) => s.dH > 0).reduce((sum, s) => sum + s.dH, 0) * 10) / 10

/** Выигрыш на образовании двух связей C=O, кДж/моль. */
export const CO2_BOND_GAIN_KJ = co2StageKJ('bonds')

/** Энергия ОДНОЙ связи C=O в самой CO₂ по циклу Гесса, кДж/моль. */
export const CO2_BOND_EXACT_KJ = Math.round((-CO2_BOND_GAIN_KJ / 2) * 10) / 10

/** Справочная СРЕДНЯЯ энергия связи C=O в CO₂, кДж/моль. */
export const CO2_BOND_TABLE_KJ = bondEnthalpyKJ('C=O(CO2)')

/** Насколько атомизация графита превышает всё тепло реакции на моль CO₂, кДж/моль. */
export const CO2_ATOMIZATION_EXCESS_KJ = Math.round((co2StageKJ('atomization') + CO2_DHF_TABLE_KJ) * 10) / 10

// ─────────────────────────────────────────────────────────────────────────────
// Числа ядра, которые пока записаны только в пояснениях (note) — читаются оттуда, а не пишутся здесь
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ковалентный радиус углерода по Кордеро (2008) при гибридизации sp² (графит, КЧ 3) и sp (CO, CO₂,
 * КЧ 2). В atomicData число поля covalentRadiusPm — sp³ (76), а sp² и sp записаны в covalentRadiusNote
 * («sp³; sp² 73 пм, sp 69 пм (Cordero 2008)»). Сцена не держит своих чисел, поэтому берёт их оттуда;
 * если пояснение ядра изменится, сборка упадёт здесь, а не нарисует неверный радиус.
 */
function carbonRadiusPm(hyb: 'sp2' | 'sp'): number {
  const note = ATOMIC_DATA.C.covalentRadiusNote ?? ''
  const tag = hyb === 'sp2' ? 'sp²' : 'sp'
  const m = new RegExp(`(?:^|[;,]\\s*)${tag} (\\d+(?:\\.\\d+)?) пм`).exec(note)
  if (!m) throw new Error(`co2: в ATOMIC_DATA.C.covalentRadiusNote нет радиуса ${tag}`)
  return Number(m[1])
}

/**
 * Температура сублимации сухого льда при 1 атм, °C. В crystalData.dry_ice она записана в note
 * («сублимация при −78.5 °C (1 атм)») — отдельного поля у CrystalDatum пока нет.
 */
function dryIceSublimationC(): number {
  const m = /сублимация при ([−-])(\d+(?:\.\d+)?) °C/.exec(getCrystal('dry_ice')?.note ?? '')
  if (!m) throw new Error('co2: в crystalData.dry_ice.note нет температуры сублимации')
  return -Number(m[2])
}

// ─────────────────────────────────────────────────────────────────────────────
// Геометрия и полярность — справочные числа для подписей и текстов
// ─────────────────────────────────────────────────────────────────────────────

export const CO2_FACTS = {
  /** длина связи C=O в CO₂ (г.), пм, r_e */
  coPm: bondLengthPm('C=O(CO2)'),
  /** валентный угол O=C=O, градусы */
  angleDeg: bondAngleDeg('carbonDioxide'),
  /** дипольный момент молекулы CO₂, Д — строго ноль по симметрии */
  dipoleD: dipoleDebye('CO2')!,
  /** электроотрицательности по Полингу и их разность O − C */
  chiC: ATOMIC_DATA.C.electronegativity!,
  chiO: ATOMIC_DATA.O.electronegativity!,
  deltaChi: Math.round((ATOMIC_DATA.O.electronegativity! - ATOMIC_DATA.C.electronegativity!) * 100) / 100,
  /** связь O=O реагента, пм (r_e) */
  o2Pm: bondLengthPm('O=O'),
  /** поверхностная карбонильная связь C(O): длина как у C=O карбонила, пм */
  surfaceCoPm: bondLengthPm('C=O'),
  /** тройная связь C≡O в угарном газе: длина, пм, и энергия, кДж/моль */
  coTriplePm: bondLengthPm('C#O'),
  coTripleKJ: bondEnthalpyKJ('C#O'),
  /** O–H (длина по воде, r_0), пм — в ядре нет отдельной длины для радикала ·OH */
  ohPm: bondLengthPm('O-H'),
  /** мостиковый интермедиат C–O–O–C хемосорбции: одинарные C–O и O–O, пм (bondData) */
  coSinglePm: bondLengthPm('C-O'),
  ooSinglePm: bondLengthPm('O-O'),
  /** угол C–O–H подхода радикала ·OH — нарисован по углу воды (в ядре нет угла HOCO), градусы */
  cohDeg: bondAngleDeg('water'),
  /** ковалентные радиусы углерода по Кордеро при фактической гибридизации, пм */
  cSp3Pm: ATOMIC_DATA.C.covalentRadiusPm,
  cSp2Pm: carbonRadiusPm('sp2'),
  cSpPm: carbonRadiusPm('sp'),
  /** сублимация сухого льда при 1 атм, °C (crystalData.dry_ice) */
  sublimationC: dryIceSublimationC(),
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Окислительно-восстановительный баланс
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Полуреакции с ЭЛЕКТРОННЫМ балансом (ФОРМАЛЬНЫЕ степени окисления — связи ковалентные,
 * ионов C⁴⁺ и O²⁻ нет). Отдано 4 e⁻ = принято 4 e⁻; заряд слева 0, справа 0.
 */
export const CO2_HALF_REACTIONS = [
  { id: 'oxidation' as const, equation: 'C⁰ − 4e⁻ → C⁺⁴', electrons: 4, times: 1, chargeLeft: 0, chargeRight: 4 },
  { id: 'reduction' as const, equation: 'O₂⁰ + 4e⁻ → 2 O⁻²', electrons: 4, times: 1, chargeLeft: 0, chargeRight: -4 },
] as const

/** Уравнения, которые показывает сцена, в машинном виде (ASCII-формулы) — для теста баланса. */
export const CO2_REACTIONS = {
  /** суммарное */
  overall: { left: [{ formula: 'C', coeff: 1 }, { formula: 'O2', coeff: 1 }], right: [{ formula: 'CO2', coeff: 1 }] },
  /** шаг 2: хемосорбция на двух краевых атомах */
  adsorb: { left: [{ formula: 'O2', coeff: 1 }, { formula: 'C', coeff: 2 }], right: [{ formula: 'CO', coeff: 2 }] },
  /** шаг 3: C(O) → CO (г.) (атомы те же, меняется только связь с решёткой) */
  desorb: { left: [{ formula: 'CO', coeff: 1 }], right: [{ formula: 'CO', coeff: 1 }] },
  /** шаг 4: CO + ·OH → CO₂ + H· */
  oxidize: { left: [{ formula: 'CO', coeff: 1 }, { formula: 'OH', coeff: 1 }], right: [{ formula: 'CO2', coeff: 1 }, { formula: 'H', coeff: 1 }] },
} as const

/** Шаг урока, на котором сцена показывает итог (панель энергии видна на всех шагах). */
export const CO2_ENERGY_STEP_INDEX = CO2_STEPS.findIndex((s) => s.id === 'solid')

/** Проверка для теста и dev: лестница = ядро, знаки верные, механизм сходится с итогом. */
export function validateCo2Energetics(): void {
  assertLadderMatchesFormation(CO2_LADDER, 0.05)
  if (!(co2StageKJ('atomization') > 0)) throw new Error('co2: атомизация графита обязана быть эндотермической')
  if (Math.abs(co2StageKJ('atomization') - dHfKJ('C(g)')) > 1e-9) throw new Error('co2: атомизация ≠ ΔH°f(C, г.)')
  const diss = CO2_LADDER.stages.find((s) => s.id === 'dissociation')!
  if (!(diss.dH > 0) || diss.multiplier !== 2 || Math.abs(diss.dH - 2 * dHfKJ('O(g)')) > 1e-9) {
    throw new Error('co2: диссоциация O₂ обязана быть 2 × ΔH°f(O, г.) > 0')
  }
  if (!(CO2_BOND_GAIN_KJ < 0)) throw new Error('co2: образование связей обязано быть экзотермическим')
  // Главный довод сцены: атомизация дороже всего тепла реакции — свободного C (г.) в горении нет.
  if (!(CO2_ATOMIZATION_EXCESS_KJ > 0)) throw new Error('co2: атомизация обязана превышать |ΔH°f(CO₂)|')
  // Механизм: C → CO на краю, дожигание CO; сумма стадий «C → CO» и «CO → CO₂» = ΔH°f(CO₂).
  const sum = formationReactionKJ('co_formation') + formationReactionKJ('co_combustion')
  if (Math.abs(sum - formationReactionKJ('co2_formation')) > 1e-6) throw new Error('co2: C → CO → CO₂ не сходится с ΔH°f(CO₂)')
  if (Math.abs(formationReactionKJ('co2_formation') - CO2_DHF_TABLE_KJ) > 1e-6) throw new Error('co2: co2_formation ≠ ΔH°f(CO₂)')
  if (!(CO_OH_KJ < 0)) throw new Error('co2: CO + ·OH → CO₂ + H· обязана быть экзотермической')
  if (CO2_FACTS.dipoleD !== 0 || CO2_FACTS.angleDeg !== 180) throw new Error('co2: CO₂ линейна и неполярна')
  if (!(CO2_FACTS.deltaChi > 0.4)) throw new Error('co2: связь C=O обязана быть полярной')
  // Радиус углерода убывает с ростом доли s: sp³ > sp² > sp (Кордеро).
  if (!(CO2_FACTS.cSp3Pm > CO2_FACTS.cSp2Pm && CO2_FACTS.cSp2Pm > CO2_FACTS.cSpPm)) throw new Error('co2: радиусы C обязаны убывать sp³ > sp² > sp')
  if (!(CO2_FACTS.sublimationC < 0)) throw new Error('co2: сухой лёд сублимирует ниже 0 °C')
  // Мостик C–O–O–C: одинарные связи длиннее двойных, O–O короче 2·r_e(O₂).
  if (!(CO2_FACTS.ooSinglePm > CO2_FACTS.o2Pm && CO2_FACTS.ooSinglePm < 2 * CO2_FACTS.o2Pm && CO2_FACTS.coSinglePm > CO2_FACTS.surfaceCoPm)) {
    throw new Error('co2: мостик C–O–O–C обязан состоять из одинарных связей')
  }
  if (!(CO2_FACTS.coTriplePm < CO2_FACTS.coPm && CO2_FACTS.coPm < CO2_FACTS.surfaceCoPm)) {
    throw new Error('co2: C≡O (CO) < C=O (CO₂) < C=O (карбонил) по длине')
  }
}
