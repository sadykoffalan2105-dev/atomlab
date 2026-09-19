import { dHfKJ, getCrystal } from '../../../../chemistry/data'
import { assertLadderMatchesFormation, type Ladder, type LadderStage } from '../kit/energyLadderData'
import { fesCueAt, FES_STEPS } from './fesSteps'

/**
 * Энергетика Fe (тв.) + S (тв.) → FeS (тв.) на 1 моль FeS.
 *
 * ПОЧЕМУ НЕ ЦИКЛ БОРНА — ГАБЕРА. Для NaCl цикл строится честно: там есть
 * справочная энергия решётки. У сульфида железа(II) её табличного значения нет,
 * а связь Fe–S заметно ковалентная (χ(Fe) = 1,83, χ(S) = 2,58, Δχ = 0,75 —
 * это ещё не ионная связь), поэтому чисто ионная модель дала бы выдуманное число.
 * Вместо неё взята лестница по ЗАКОНУ ГЕССА из трёх ступеней — все величины
 * справочные (кДж/моль, 298 K, CODATA/CRC через chemistry/data):
 *
 *   Fe (тв.) → Fe (г.)                +416,3   ΔH°f(Fe, г) — атомизация металла
 *   ⅛ S₈ (тв.) → S (г.)               +277,2   ΔH°f(S, г)  — разрыв короны S₈
 *   Fe (г.) + S (г.) → FeS (тв.)      −793,5   по закону Гесса: ΔH°f(FeS) − (1) − (2)
 *   ──────────────────────────────────────────
 *   Σ = ΔH°f(FeS, тв.) = −100,0 кДж/моль (табличное)
 *
 * Третья ступень ПОСЧИТАНА, а не взята из таблицы, и так и подписана в тексте
 * урока: это энергия, которая выделяется при сборке кристалла из свободных
 * атомов. Знаки настоящие: две ступени вверх (затраты), одна вниз (выигрыш);
 * выигрыш больше затрат — реакция экзотермическая, поэтому после поджига
 * смесь горит сама.
 *
 * Файл без THREE и React — его читают панель энергии и тесты.
 */

/** Табличная ΔH°f(FeS, тв.), кДж/моль: −100,0. */
export const FES_DHF_TABLE_KJ = dHfKJ('FeS(s)')

/** Атомизация железа, кДж/моль: ΔH°f(Fe, г) = +416,3. */
export const FES_ATOM_FE_KJ = dHfKJ('Fe(g)')

/** Атомизация серы (⅛ короны S₈ → атом), кДж/моль: ΔH°f(S, г) = +277,2. */
export const FES_ATOM_S_KJ = dHfKJ('S(g)')

/**
 * Энергия сборки кристалла FeS из газообразных атомов, кДж/моль.
 * Не табличная величина: найдена по закону Гесса как остаток цикла.
 */
export const FES_CRYSTAL_KJ = Math.round((FES_DHF_TABLE_KJ - FES_ATOM_FE_KJ - FES_ATOM_S_KJ) * 10) / 10

const STAGES: readonly LadderStage[] = [
  {
    id: 'atomFe',
    kind: 'sublimation',
    equation: 'Fe (тв.) → Fe (г.)',
    dH: FES_ATOM_FE_KJ,
    at: fesCueAt('ignite') - 0.8,
  },
  {
    id: 'atomS',
    kind: 'dissociation',
    equation: '⅛ S₈ (тв.) → S (г.)',
    dH: FES_ATOM_S_KJ,
    at: fesCueAt('ignite') + 0.6,
  },
  {
    id: 'crystal',
    kind: 'lattice',
    equation: 'Fe (г.) + S (г.) → FeS (тв.)',
    dH: FES_CRYSTAL_KJ,
    at: fesCueAt('lattice'),
  },
]

export const FES_LADDER: Ladder = {
  cycleId: 'fes',
  formula: 'FeS',
  equation: 'Fe (тв.) + S (тв.) → FeS (тв.)',
  stages: STAGES,
  sumKJ: Math.round(STAGES.reduce((sum, s) => sum + s.dH, 0) * 10) / 10,
  tableKJ: FES_DHF_TABLE_KJ,
}

/** Теплота образования FeS, кДж/моль, округлённая для подписей: −100. */
export const FES_DHF_KJ = Math.round(FES_LADDER.sumKJ)

/** Сумма затратных ступеней (атомизация Fe и S), кДж/моль: +693,5. */
export const FES_COST_KJ = Math.round((FES_ATOM_FE_KJ + FES_ATOM_S_KJ) * 10) / 10

/** Шаг урока, на котором показывают блок энергии целиком. */
export const FES_ENERGY_STEP_INDEX = FES_STEPS.findIndex((s) => s.id === 'energy')

/**
 * Полуреакции с ЭЛЕКТРОННЫМ балансом: отдано ровно столько электронов, сколько
 * принято (2 = 2). Заряд тоже сходится: слева 0, справа (+2) + (−2) = 0.
 * Железо окисляется до степени +2 (не +3): при сухом сплавлении Fe и S
 * получается именно FeS, а Fe₂S₃ неустойчив и распадается на FeS и S.
 */
export const FES_HALF_REACTIONS = [
  {
    id: 'oxidation' as const,
    equation: 'Fe⁰ − 2e⁻ → Fe²⁺',
    electrons: 2,
    times: 1,
    chargeLeft: 0,
    chargeRight: 2,
  },
  {
    id: 'reduction' as const,
    equation: 'S⁰ + 2e⁻ → S²⁻',
    electrons: 2,
    times: 1,
    chargeLeft: 0,
    chargeRight: -2,
  },
] as const

/** Суммарное уравнение в машинном виде (ASCII-формулы) — для теста стехиометрии. */
export const FES_REACTION = {
  left: [
    { formula: 'Fe', coeff: 1 },
    { formula: 'S', coeff: 1 },
  ],
  right: [{ formula: 'FeS', coeff: 1 }],
} as const

/**
 * Качественная проба на продукт (шаг 5): сульфид железа(II) с соляной кислотой
 * даёт сероводород — газ с запахом тухлых яиц, которого исходная смесь не давала.
 * В 3D не рисуется, показано только уравнением (об этом сказано в note шага).
 */
export const FES_ACID_TEST = {
  equation: 'FeS + 2 HCl → FeCl₂ + H₂S↑',
  left: [
    { formula: 'FeS', coeff: 1 },
    { formula: 'HCl', coeff: 2 },
  ],
  right: [
    { formula: 'FeCl2', coeff: 1 },
    { formula: 'H2S', coeff: 1 },
  ],
} as const

/** Справочные параметры продукта — для подписей и теста. */
export const FES_CRYSTAL = getCrystal('troilite')!

/** Проверка для теста: лестница сходится с табличной ΔH°f и знаки физичны. */
export function validateFesEnergetics(): void {
  assertLadderMatchesFormation(FES_LADDER, 0.5)
  const up = FES_LADDER.stages.filter((s) => s.dH > 0)
  if (up.length !== 2) throw new Error('fes: затратных ступеней обязано быть две (атомизация Fe и S)')
  const down = FES_LADDER.stages.filter((s) => s.dH < 0)
  if (down.length !== 1) throw new Error('fes: выигрышная ступень одна — сборка кристалла')
  if (!(FES_LADDER.sumKJ < 0)) throw new Error('fes: реакция обязана быть экзотермической (ΔH°f < 0)')
  if (!(Math.abs(down[0]!.dH) > FES_COST_KJ)) {
    throw new Error('fes: выигрыш обязан превышать затраты, иначе смесь не горела бы сама')
  }
  for (const s of FES_LADDER.stages) {
    if (!Number.isFinite(s.dH)) throw new Error(`fes: ступень «${s.id}» без числа`)
    if (!(s.at >= 0)) throw new Error(`fes: ступень «${s.id}» без времени сюжета`)
  }
}
