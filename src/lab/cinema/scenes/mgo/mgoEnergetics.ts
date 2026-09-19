import { LATTICE_ENTHALPY_KJ, OXIDE_SECOND_EA_KJ } from '../../../../chemistry/data'
import { assertLadderMatchesFormation, buildBornHaberLadder, type Ladder } from '../kit/energyLadderData'
import { mgoCueAt, MGO_STEPS } from './mgoSteps'

/**
 * Энергетика 2 Mg + O₂ → 2 MgO — цикл Борна — Габера на 1 моль MgO.
 *
 * Числа НЕ живут здесь: они приходят из BORN_HABER.mgo
 * (chemistry/data/thermoData.ts), кДж/моль, 298 K:
 *   сублимация Mg (тв → г)             +147,1
 *   диссоциация ½ O₂ → O               +249,2   (½ · D(O=O) = ½ · 498,4)
 *   ионизация Mg → Mg⁺ + e⁻            +737,7   (IE₁)
 *   ионизация Mg⁺ → Mg²⁺ + e⁻         +1450,7   (IE₂ — вдвое дороже первой)
 *   сродство O + e⁻ → O⁻               −141,0   (EA₁, выделяется)
 *   сродство O⁻ + e⁻ → O²⁻             +744,0   (EA₂, ЗАТРАЧИВАЕТСЯ)
 *   энергия решётки Mg²⁺ + O²⁻ → MgO  −3789,0
 *   ────────────────────────────────────────────
 *   Σ = −601,3 ≈ ΔH°f(MgO, тв) = −601,6 (табличное)
 *
 * ДВА школьных вывода, которых нет в уроке NaCl:
 *   1) второй электрон кислород принимает С ЗАТРАТОЙ энергии: O⁻ уже заряжен
 *      отрицательно и отталкивает следующий электрон (EA₂ = +744 > 0);
 *   2) всё равно процесс сильно экзотермический — за счёт энергии решётки,
 *      которая при зарядах ±2 почти в пять раз больше, чем у NaCl (−787).
 *
 * ЧЕСТНО О РАЗБРОСЕ СПРАВОЧНИКОВ: EA₂(O) в литературе даётся от +744 до +844,
 * а U(MgO) — от −3789 до −3850 кДж/моль. Это ОДНА И ТА ЖЕ неопределённость:
 * EA₂ прямо не измеряют, её извлекают из цикла Борна — Габера вместе с U.
 * В ядре проекта выбрана согласованная пара (+744 / −3789), при которой цикл
 * сходится с табличной ΔH°f с точностью 0,3 кДж/моль. Менять EA₂ можно только
 * вместе с U — иначе сумма перестанет быть суммой.
 *
 * Файл без THREE и React — его читают панель энергии и тесты.
 */

/** Время сюжета, к которому каждая ступень считается пройденной. */
const STAGE_AT: Record<string, number> = {
  sublimation: mgoCueAt('sublimate'),
  dissociation: mgoCueAt('bondBreak'),
  ionization1: 9.3,
  ionization2: 9.8,
  affinity1: 10.9,
  affinity2: 11.6,
  lattice: mgoCueAt('lattice'),
}

export const MGO_LADDER: Ladder = buildBornHaberLadder('mgo', STAGE_AT)

/** Теплота образования MgO (тв.) по сумме цикла, кДж/моль — для подписей: −601. */
export const MGO_DHF_KJ = Math.round(MGO_LADDER.sumKJ)

/** Табличная ΔH°f(MgO, тв.), кДж/моль. */
export const MGO_DHF_TABLE_KJ = MGO_LADDER.tableKJ

/** Тепловой эффект уравнения 2 Mg + O₂ → 2 MgO (две формульные единицы), кДж. */
export const MGO_REACTION_DH_KJ = 2 * MGO_DHF_KJ

/**
 * Сумма затратных ступеней (без энергии решётки), кДж/моль: +3187,7.
 * Число для шага 6: до решётки процесс был бы чудовищно эндотермическим.
 */
export const MGO_COST_BEFORE_LATTICE_KJ = Math.round(
  MGO_LADDER.stages.filter((s) => s.kind !== 'lattice').reduce((sum, s) => sum + s.dH, 0),
)

/** Энергия решётки MgO, кДж/моль (отрицательная). */
export const MGO_LATTICE_KJ = MGO_LADDER.stages.find((s) => s.kind === 'lattice')!.dH

/** Энергия решётки NaCl для сравнения «заряды ±1 против ±2», кДж/моль. */
export const NACL_LATTICE_REF_KJ = LATTICE_ENTHALPY_KJ['NaCl(s)']!

/** Во сколько раз решётка MgO прочнее решётки NaCl (≈ 4,8). */
export const MGO_LATTICE_RATIO = Math.round((MGO_LATTICE_KJ / NACL_LATTICE_REF_KJ) * 10) / 10

/** Вторая энергия сродства кислорода, кДж/моль — ЭНДОтермическая (> 0). */
export const MGO_SECOND_EA_KJ = OXIDE_SECOND_EA_KJ

/** Шаг урока, на котором показывают блок энергии целиком. */
export const MGO_ENERGY_STEP_INDEX = MGO_STEPS.findIndex((s) => s.id === 'energy')

/**
 * Полуреакции с ЭЛЕКТРОННЫМ балансом. Отдано ровно столько электронов,
 * сколько принято: 2 × 2 = 4 = 1 × 4. Заряд тоже сходится:
 * слева 0, справа 2(+2) + 2(−2) = 0.
 * Восстанавливается МОЛЕКУЛА O₂ целиком — частицы «O₂²⁻» в продукте нет.
 */
export const MGO_HALF_REACTIONS = [
  {
    id: 'oxidation' as const,
    equation: 'Mg⁰ − 2e⁻ → Mg²⁺',
    /** электронов отдано одной частицей */
    electrons: 2,
    /** во сколько раз взята полуреакция */
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
export const MGO_REACTION = {
  left: [
    { formula: 'Mg', coeff: 2 },
    { formula: 'O2', coeff: 1 },
  ],
  right: [{ formula: 'MgO', coeff: 2 }],
} as const

/** Проверка для теста: сумма ступеней совпадает с табличной ΔH°f, знаки физические. */
export function validateMgoEnergetics(): void {
  assertLadderMatchesFormation(MGO_LADDER, 5)

  const lattice = MGO_LADDER.stages.find((s) => s.kind === 'lattice')
  if (!lattice || lattice.dH >= 0) throw new Error('mgo: энергия решётки обязана быть отрицательной')

  const byId = new Map(MGO_LADDER.stages.map((s) => [s.id, s.dH]))
  const sub = byId.get('sublimation')
  const dis = byId.get('dissociation')
  const ie1 = byId.get('ionization1')
  const ie2 = byId.get('ionization2')
  const ea1 = byId.get('affinity1')
  const ea2 = byId.get('affinity2')
  if (!(sub! > 0)) throw new Error('mgo: сублимация магния обязана быть эндотермической')
  if (!(dis! > 0)) throw new Error('mgo: диссоциация ½O₂ обязана быть эндотермической')
  if (!(ie1! > 0 && ie2! > 0)) throw new Error('mgo: обе энергии ионизации обязаны быть положительными')
  if (!(ie2! > ie1!)) throw new Error('mgo: IE₂ обязана быть больше IE₁ (электрон отрывают от катиона)')
  if (!(ea1! < 0)) throw new Error('mgo: первое сродство кислорода к электрону обязано быть экзотермическим')
  if (!(ea2! > 0)) throw new Error('mgo: второе сродство кислорода (O⁻ + e⁻ → O²⁻) обязано быть ЭНДОтермическим')
  if (MGO_COST_BEFORE_LATTICE_KJ <= 0) throw new Error('mgo: без решётки процесс обязан быть эндотермическим')
  if (!(MGO_LATTICE_KJ < NACL_LATTICE_REF_KJ)) {
    throw new Error('mgo: решётка MgO обязана быть прочнее решётки NaCl (заряды ±2 против ±1)')
  }
}
