import { getCrystal, LATTICE_ENTHALPY_KJ, OXIDE_SECOND_EA_KJ } from '../../../../chemistry/data'
import { assertLadderMatchesFormation, buildBornHaberLadder, type Ladder } from '../kit/energyLadderData'
import { mgoCueAt, MGO_ELECTRONS, MGO_STEPS } from './mgoSteps'

/**
 * Энергетика 2 Mg + O₂ → 2 MgO — цикл Борна — Габера на 1 моль MgO (одна формульная
 * единица, поэтому у всех ступеней множитель 1).
 *
 * Числа НЕ живут здесь: ступени приходят из BORN_HABER.mgo (chemistry/data/thermoData.ts):
 * сублимация Mg, ½D(O₂) = ΔH°f(O, г.), IE₁ и IE₂ магния, EA₁ кислорода (Δ_eg H < 0),
 * EA₂ кислорода (O⁻ + e⁻ → O²⁻, ЭНДОтермична), энергия решётки U < 0.
 *
 * Два вывода, которых нет в уроке NaCl:
 *   1) второй электрон кислород принимает С ЗАТРАТОЙ (EA₂ > 0): O⁻ отталкивает электрон;
 *   2) процесс всё равно сильно экзотермический — за счёт решётки с зарядами ±2.
 *
 * EA₂ не измеряют: её извлекают из циклов вместе с U — ядро держит согласованную пару
 * (OXIDE_SECOND_EA_KJ и U(MgO)); менять одно без другого нельзя. Сумма цикла отличается
 * от табличной ΔH°f на несколько десятых кДж/моль — это расхождение названо в тексте урока.
 *
 * Файл без THREE и React — его читают панель энергии и тесты.
 */

/** Время сюжета, к которому каждая ступень считается пройденной (ионизация — уход e⁻, сродство — приход). */
const STAGE_AT: Record<string, number> = {
  sublimation: mgoCueAt('sublimate'),
  dissociation: mgoCueAt('bondBreak'),
  ionization1: MGO_ELECTRONS.e1.leave,
  affinity1: MGO_ELECTRONS.e1.arrive,
  ionization2: MGO_ELECTRONS.e3.leave,
  affinity2: MGO_ELECTRONS.e3.arrive,
  lattice: mgoCueAt('lattice'),
}

export const MGO_LADDER: Ladder = buildBornHaberLadder('mgo', STAGE_AT)

export type MgoStageId = 'sublimation' | 'dissociation' | 'ionization1' | 'ionization2' | 'affinity1' | 'affinity2' | 'lattice'

/** Ступень цикла по id (для текстов и теста). */
export function mgoStageKJ(id: MgoStageId): number {
  const s = MGO_LADDER.stages.find((x) => x.id === id)
  if (!s) throw new Error(`mgo: нет ступени ${id}`)
  return s.dH
}

const r1 = (v: number) => Math.round(v * 10) / 10

/** Сумма ступеней цикла, кДж/моль (одна десятая). */
export const MGO_SUM_KJ = r1(MGO_LADDER.sumKJ)

/** Табличная ΔH°f(MgO, тв.), кДж/моль — её показывает 3D-подпись. */
export const MGO_DHF_TABLE_KJ = MGO_LADDER.tableKJ

/** Расхождение суммы цикла с таблицей, кДж/моль (> 0 — сумма менее отрицательна). */
export const MGO_RESIDUAL_KJ = r1(MGO_SUM_KJ - MGO_DHF_TABLE_KJ)

/** Тепловой эффект уравнения 2 Mg + O₂ → 2 MgO (две формульные единицы), кДж. */
export const MGO_REACTION_DH_KJ = r1(2 * MGO_DHF_TABLE_KJ)

/** Сумма затратных ступеней (без энергии решётки), кДж/моль. */
export const MGO_COST_BEFORE_LATTICE_KJ = r1(MGO_LADDER.stages.filter((s) => s.kind !== 'lattice').reduce((sum, s) => sum + s.dH, 0))

/** Энергия решётки MgO в цикле, кДж/моль (отрицательная). */
export const MGO_LATTICE_KJ = mgoStageKJ('lattice')

/** Энергия решётки MgO в таблице LATTICE_ENTHALPY_KJ (обязана совпадать со ступенью цикла). */
export const MGO_LATTICE_TABLE_KJ = LATTICE_ENTHALPY_KJ['MgO(s)']!

/** Энергия решётки NaCl для сравнения «заряды ±1 против ±2», кДж/моль. */
export const NACL_LATTICE_REF_KJ = LATTICE_ENTHALPY_KJ['NaCl(s)']!

/** Во сколько раз решётка MgO прочнее решётки NaCl по циклам Борна — Габера (одна десятая). */
export const MGO_LATTICE_RATIO = r1(MGO_LATTICE_KJ / NACL_LATTICE_REF_KJ)

/**
 * Оценка по закону Кулона для ЭНЕРГИИ (∝ q₁q₂/r, а не сила ∝ 1/r²): произведение зарядов
 * 2·2 / (1·1) и обратное отношение расстояний катион–анион в решётках NaCl и MgO (обе — тип NaCl,
 * постоянная Маделунга одна). Одна десятая.
 */
function chargeProduct(crystalId: string): number {
  const qs = (getCrystal(crystalId)!.basis ?? []).map((s) => s.charge ?? 0)
  return Math.max(...qs) * Math.abs(Math.min(...qs))
}
/** |q₁q₂| MgO / |q₁q₂| NaCl — из зарядов базиса решёток ядра. */
export const MGO_COULOMB_CHARGE_FACTOR = chargeProduct('mgo') / chargeProduct('nacl')
export const MGO_COULOMB_RATIO = r1((MGO_COULOMB_CHARGE_FACTOR * getCrystal('nacl')!.cationAnionPm) / getCrystal('mgo')!.cationAnionPm)

/** Вторая энергия сродства кислорода, кДж/моль — ЭНДОтермическая (> 0). */
export const MGO_SECOND_EA_KJ = OXIDE_SECOND_EA_KJ

/** Шаг урока, на котором показывают блок энергии целиком. */
export const MGO_ENERGY_STEP_INDEX = MGO_STEPS.findIndex((s) => s.id === 'energy')

/**
 * Полуреакции с ЭЛЕКТРОННЫМ балансом: 2 × 2 = 4 = 1 × 4. Заряд тоже сходится:
 * слева 0, справа 2(+2) + 2(−2) = 0. Восстанавливается МОЛЕКУЛА O₂ целиком.
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

/** Проверка для теста: сумма ступеней совпадает с табличной ΔH°f в пределах разброса, знаки физические. */
export function validateMgoEnergetics(): void {
  // Сумма цикла расходится с таблицей на доли кДж/моль (справочный разброс, назван в уроке).
  assertLadderMatchesFormation(MGO_LADDER, 0.5)
  if (!(MGO_LATTICE_KJ < 0)) throw new Error('mgo: энергия решётки обязана быть отрицательной')
  if (Math.abs(MGO_LATTICE_KJ - MGO_LATTICE_TABLE_KJ) > 1e-9) {
    throw new Error(`mgo: U в цикле ${MGO_LATTICE_KJ} ≠ U в таблице ${MGO_LATTICE_TABLE_KJ}`)
  }
  for (const k of ['sublimation', 'dissociation', 'ionization1', 'ionization2', 'affinity2'] as const) {
    if (!(mgoStageKJ(k) > 0)) throw new Error(`mgo: ступень ${k} обязана быть эндотермической (ΔH > 0)`)
  }
  if (!(mgoStageKJ('affinity1') < 0)) throw new Error('mgo: EA₁ кислорода обязана быть отрицательной (Δ_eg H)')
  if (!(mgoStageKJ('ionization2') > mgoStageKJ('ionization1'))) throw new Error('mgo: IE₂ обязана быть больше IE₁')
  if (mgoStageKJ('affinity2') !== OXIDE_SECOND_EA_KJ) throw new Error('mgo: EA₂ цикла ≠ OXIDE_SECOND_EA_KJ')
  if (!(MGO_COST_BEFORE_LATTICE_KJ > 0)) throw new Error('mgo: без решётки процесс обязан быть эндотермическим')
  if (!(MGO_LATTICE_KJ < NACL_LATTICE_REF_KJ)) throw new Error('mgo: решётка MgO обязана быть прочнее решётки NaCl')
  for (const s of MGO_LADDER.stages) {
    if ((s.multiplier ?? 1) !== 1) throw new Error(`mgo: у ступени ${s.id} множитель ${s.multiplier}, а в MgO одна формульная единица`)
  }
}
