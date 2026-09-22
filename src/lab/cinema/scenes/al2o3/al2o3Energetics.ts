import {
  ATOMIC_DATA,
  BORN_HABER,
  dHfKJ,
  formationReactionKJ,
  LATTICE_ENTHALPY_INFO,
  LATTICE_ENTHALPY_KJ,
  OXIDE_SECOND_EA_KJ,
} from '../../../../chemistry/data'
import { assertLadderMatchesFormation, buildBornHaberLadder, type Ladder } from '../kit/energyLadderData'
import { al2o3CueAt, AL2O3_ELECTRONS, AL2O3_STEPS } from './al2o3Steps'

/**
 * Энергетика 4 Al + 3 O₂ → 2 Al₂O₃ — цикл Борна — Габера на 1 моль Al₂O₃ (одна формульная единица),
 * ВСЕ ступени с множителями частиц: 2 Al и 3 O.
 *
 * Числа НЕ живут здесь: ступени приходят из BORN_HABER.al2o3 (chemistry/data/thermoData.ts):
 *   2·ΔH_субл(Al), 2·(IE₁ + IE₂ + IE₃)(Al), 3·ΔH°f(O, г.), 3·EA₁(O) < 0, 3·EA₂(O) > 0, U < 0.
 * Энергия решётки ВЫВЕДЕНА из цикла при EA₂ = +744 (LATTICE_ENTHALPY_INFO), поэтому сходимость
 * суммы здесь тождественна; проверяется согласованность U с таблицей решёток и с EA₂ ядра.
 *
 * Знаки принципиальны: четыре ступени вверх (затраты), две вниз (выигрыш). Третий электрон Al
 * дороже первых двух вместе взятых, и всё равно процесс резко экзотермичен — решётка из ионов
 * с зарядами +3 и −2 выигрывает больше, чем стоят все затраты.
 *
 * Файл без THREE и React — его читают панель энергии и тесты.
 */

export type Al2o3StageId = 'sublimation' | 'ionization' | 'dissociation' | 'affinity1' | 'affinity2' | 'lattice'

/** Первый приход второго электрона кислорода (k = 3) и последний приход вообще. */
const LAST_EA1 = AL2O3_ELECTRONS[2]!.arrive
const LAST_EA2 = AL2O3_ELECTRONS[5]!.arrive

/** Время сюжета, к которому каждая ступень считается пройденной. */
const STAGE_AT: Record<Al2o3StageId, number> = {
  sublimation: al2o3CueAt('sublimate'),
  dissociation: al2o3CueAt('bondBreak'),
  // Ионизация начинается в кадр ухода первого электрона — в этот же кадр в 3D появляется Al⁺.
  ionization: AL2O3_ELECTRONS[0]!.leave,
  affinity1: LAST_EA1,
  affinity2: LAST_EA2,
  lattice: al2o3CueAt('lattice'),
}

export const AL2O3_LADDER: Ladder = buildBornHaberLadder('al2o3', STAGE_AT)

/** Ступень цикла по id (кДж на 1 моль Al₂O₃, уже с множителем). */
export function al2o3StageKJ(id: Al2o3StageId): number {
  const s = AL2O3_LADDER.stages.find((x) => x.id === id)
  if (!s) throw new Error(`al2o3: нет ступени ${id}`)
  return s.dH
}

/** Множитель частиц ступени (2 Al, 3 O; у решётки — 1). */
export function al2o3StageMultiplier(id: Al2o3StageId): number {
  return AL2O3_LADDER.stages.find((x) => x.id === id)?.multiplier ?? 1
}

/** Величина ступени на одну частицу, кДж/моль. */
export function al2o3StagePerUnitKJ(id: Al2o3StageId): number {
  const s = AL2O3_LADDER.stages.find((x) => x.id === id)!
  return s.perUnitKJ ?? s.dH
}

const r1 = (v: number) => Math.round(v * 10) / 10

/** Три энергии ионизации алюминия (кДж/моль) — из atomicData. */
export const AL_IE_KJ = [ATOMIC_DATA.Al.ie1KJ, ATOMIC_DATA.Al.ie2KJ!, ATOMIC_DATA.Al.ie3KJ!] as const

/** IE₁ + IE₂ + IE₃ одного атома Al, кДж/моль. */
export const AL_IE_SUM_KJ = r1(AL_IE_KJ[0] + AL_IE_KJ[1] + AL_IE_KJ[2])

/** EA₁ и EA₂ кислорода (Δ_eg H, кДж/моль): −141,0 и +744. */
export const O_EA1_KJ = ATOMIC_DATA.O.electronAffinityKJ
export const O_EA2_KJ = OXIDE_SECOND_EA_KJ

/** Теплота образования Al₂O₃ (корунд) по сумме цикла, кДж/моль, одна десятая — для 3D-подписи. */
export const AL2O3_DHF_KJ = r1(AL2O3_LADDER.sumKJ)

/** Табличная ΔH°f(Al₂O₃, тв.), кДж/моль. */
export const AL2O3_DHF_TABLE_KJ = AL2O3_LADDER.tableKJ

/** Тепловой эффект уравнения 4 Al + 3 O₂ → 2 Al₂O₃, кДж (thermoData.FORMATION_REACTIONS). */
export const AL2O3_REACTION_DH_KJ = r1(formationReactionKJ('al2o3_formation'))

/** Термит Fe₂O₃ + 2 Al → 2 Fe + Al₂O₃, кДж на уравнение. */
export const THERMITE_DH_KJ = r1(formationReactionKJ('thermite'))

/** Сумма затратных и прочих ступеней без решётки, кДж/моль (Σ = 13 494,6). */
export const AL2O3_COST_BEFORE_LATTICE_KJ = r1(AL2O3_LADDER.stages.filter((s) => s.kind !== 'lattice').reduce((sum, s) => sum + s.dH, 0))

/** Энергия решётки Al₂O₃ в цикле, кДж/моль (отрицательная, выведена из цикла). */
export const AL2O3_LATTICE_KJ = al2o3StageKJ('lattice')

/** Энергия решётки в таблице LATTICE_ENTHALPY_KJ (обязана совпадать со ступенью цикла). */
export const AL2O3_LATTICE_TABLE_KJ = LATTICE_ENTHALPY_KJ['Al2O3(s)']!

/** Для сравнения в тексте: энергия решётки MgO из той же таблицы (−3789, решение владельца 6). */
export const MGO_LATTICE_KJ = LATTICE_ENTHALPY_KJ['MgO(s)']!

/**
 * Литературный разброс |U(Al₂O₃)| и верхняя граница EA₂ — числа из пояснений ядра
 * (BORN_HABER.al2o3.note и LATTICE_ENTHALPY_INFO['Al2O3(s)'].note), а не из сцены.
 */
function numbersFromNote(note: string): number[] {
  return [...note.matchAll(/\d{1,3}(?:[\u00a0\u202f ]\d{3})+|\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(/[\u00a0\u202f ]/g, '').replace(',', '.')))
}
const RANGE_NUMS = numbersFromNote(BORN_HABER.al2o3.note ?? '').filter((v) => v > 10000)
export const AL2O3_U_RANGE_KJ = [Math.min(...RANGE_NUMS), Math.max(...RANGE_NUMS)] as const
export const O_EA2_MAX_KJ = Math.max(...numbersFromNote(LATTICE_ENTHALPY_INFO['Al2O3(s)']!.note).filter((v) => v > O_EA2_KJ && v < 1000))

/** Шаг урока, на котором показывают блок энергии целиком. */
export const AL2O3_ENERGY_STEP_INDEX = AL2O3_STEPS.findIndex((s) => s.id === 'energy')

/**
 * Полуреакции с ЭЛЕКТРОННЫМ балансом: 4 × 3 = 12 электронов отдано, 3 × 4 = 12 принято.
 * Заряд тоже сходится: справа 4(+3) + 6(−2) = 0. Восстанавливается МОЛЕКУЛА O₂ целиком.
 */
export const AL2O3_HALF_REACTIONS = [
  { id: 'oxidation' as const, equation: 'Al⁰ − 3e⁻ → Al³⁺', electrons: 3, times: 4, chargeLeft: 0, chargeRight: 3 },
  { id: 'reduction' as const, equation: 'O₂⁰ + 4e⁻ → 2 O²⁻', electrons: 4, times: 3, chargeLeft: 0, chargeRight: -4 },
] as const

/** Суммарное уравнение в машинном виде (ASCII-формулы) — для теста стехиометрии. */
export const AL2O3_REACTION = {
  left: [
    { formula: 'Al', coeff: 4 },
    { formula: 'O2', coeff: 3 },
  ],
  right: [{ formula: 'Al2O3', coeff: 2 }],
} as const

/** Термит в машинном виде — для теста баланса. */
export const THERMITE_REACTION = {
  left: [
    { formula: 'Fe2O3', coeff: 1 },
    { formula: 'Al', coeff: 2 },
  ],
  right: [
    { formula: 'Fe', coeff: 2 },
    { formula: 'Al2O3', coeff: 1 },
  ],
} as const

/** Проверка для теста и dev: сумма ступеней = табличная ΔH°f, знаки и множители верные. */
export function validateAl2o3Energetics(): void {
  assertLadderMatchesFormation(AL2O3_LADDER, 0.05)
  if (!(AL2O3_LATTICE_KJ < 0)) throw new Error('al2o3: энергия решётки обязана быть отрицательной')
  if (Math.abs(AL2O3_LATTICE_KJ - AL2O3_LATTICE_TABLE_KJ) > 1e-9) {
    throw new Error(`al2o3: U в цикле ${AL2O3_LATTICE_KJ} ≠ U в таблице ${AL2O3_LATTICE_TABLE_KJ}`)
  }
  for (const k of ['sublimation', 'ionization', 'dissociation', 'affinity2'] as const) {
    if (!(al2o3StageKJ(k) > 0)) throw new Error(`al2o3: ступень ${k} обязана быть эндотермической (ΔH > 0)`)
  }
  if (!(al2o3StageKJ('affinity1') < 0)) throw new Error('al2o3: EA₁(O) обязана быть отрицательной')
  const mult: Record<Al2o3StageId, number> = { sublimation: 2, ionization: 2, dissociation: 3, affinity1: 3, affinity2: 3, lattice: 1 }
  for (const [id, m] of Object.entries(mult) as [Al2o3StageId, number][]) {
    if (al2o3StageMultiplier(id) !== m) throw new Error(`al2o3: у ступени ${id} множитель ${al2o3StageMultiplier(id)}, ожидался ${m}`)
    if (Math.abs(al2o3StageKJ(id) - m * al2o3StagePerUnitKJ(id)) > 0.05) throw new Error(`al2o3: ступень ${id} ≠ множитель × величина на частицу`)
  }
  if (!(AL_IE_KJ[2] > AL_IE_KJ[1] && AL_IE_KJ[1] > AL_IE_KJ[0])) throw new Error('al2o3: IE₃ > IE₂ > IE₁')
  if (Math.abs(al2o3StagePerUnitKJ('sublimation') - dHfKJ('Al(g)')) > 1e-9) throw new Error('al2o3: сублимация ≠ ΔH°f(Al, г.)')
  if (!(AL2O3_U_RANGE_KJ[0] < -AL2O3_LATTICE_KJ && -AL2O3_LATTICE_KJ < AL2O3_U_RANGE_KJ[1])) throw new Error('al2o3: U вне литературного разброса')
}
