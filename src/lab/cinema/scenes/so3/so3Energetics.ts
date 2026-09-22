import {
  ATOMIC_DATA,
  bondAngleDeg,
  bondLengthPm,
  dHfKJ,
  dipoleDebye,
  FORMATION_REACTIONS,
  formationReactionKJ,
  REACTION_STEP_CHAINS,
  reagentBondPm,
} from '../../../../chemistry/data'
import { assertLadderMatchesFormation, type Ladder, type LadderStage } from '../kit/energyLadderData'
import { SO3_STEPS, SO3_TRANSFERS } from './so3Steps'

/**
 * Энергетика 2 SO₂ (г.) + O₂ (г.) ⇌ 2 SO₃ (г.) — лестница по стадиям ШКОЛЬНОЙ схемы катализа.
 *
 * Числа НЕ живут здесь: стадии — REACTION_STEP_CHAINS.so2_v2o5 (thermoData.ts), ΔH каждой —
 * formationReactionKJ(id) по закону Гесса из ΔH°f ядра (CRC 97th, 298 K):
 *   V₂O₅ + SO₂ → V₂O₄ + SO₃        ΔH₁ > 0   (×2 на уравнение: две молекулы SO₂)
 *   V₂O₄ + ½ O₂ → V₂O₅             ΔH₂ < 0   (×2)
 *   ───────────────────────────────────────
 *   2·ΔH₁ + 2·ΔH₂ = ΔH(so3_contact) = 2·ΔH°f(SO₃) − 2·ΔH°f(SO₂)
 * Катализатор не меняет ΔH: сумма стадий обязана совпасть с прямой реакцией — это проверяет тест.
 *
 * Лестница — на УРАВНЕНИЕ (2 моль SO₃), единица «кДж», у обеих ступеней множитель 2.
 * Поле kind у ступени — только категория для набора (панель его не рисует): стадия 1 отнимает
 * у катализатора атом O ('dissociation'), стадия 2 — O₂ связывается с ванадием ('bond').
 *
 * Файл без THREE и React — его читают панель энергии и тесты.
 */

/** Стадии школьной схемы в порядке показа. */
export const SO3_CHAIN = REACTION_STEP_CHAINS.so2_v2o5
/** Сколько раз проходит каждая стадия на уравнение 2 SO₂ + O₂ (две молекулы SO₂ — два оборота). */
export const SO3_STAGE_MULTIPLIER = 2

const round3 = (v: number) => Math.round(v * 1000) / 1000

const stage = (id: string, ladderId: string, kind: LadderStage['kind'], at: number): LadderStage => {
  const perUnit = formationReactionKJ(id)
  return {
    id: ladderId,
    dH: round3(SO3_STAGE_MULTIPLIER * perUnit),
    at,
    equation: FORMATION_REACTIONS[id]!.equation,
    kind,
    multiplier: SO3_STAGE_MULTIPLIER,
    perUnitKJ: perUnit,
  }
}

/** Ступени лестницы: время — кадры второго переноса / второго возврата кислорода. */
const STAGES: readonly LadderStage[] = [
  stage(SO3_CHAIN[0], 'reduction', 'dissociation', SO3_TRANSFERS.b.transfer),
  stage(SO3_CHAIN[1], 'reoxidation', 'bond', SO3_TRANSFERS.b.refill),
]

/** ΔH прямой реакции 2 SO₂ + O₂ → 2 SO₃ по ΔH°f ядра, кДж на уравнение. */
export const SO3_REACTION_DH_KJ = formationReactionKJ('so3_contact')

export const SO3_LADDER: Ladder = {
  cycleId: 'so3_contact',
  formula: 'SO₃',
  equation: FORMATION_REACTIONS.so3_contact!.equation,
  stages: STAGES,
  sumKJ: round3(STAGES.reduce((s, x) => s + x.dH, 0)),
  tableKJ: SO3_REACTION_DH_KJ,
}

/** ΔH одной стадии на ОДИН оборот катализатора (perUnit), кДж. */
export function so3StageKJ(id: 'reduction' | 'reoxidation'): number {
  const s = SO3_LADDER.stages.find((x) => x.id === id)
  if (!s) throw new Error(`so3: нет ступени ${id}`)
  return s.perUnitKJ!
}

/** ΔH на 1 моль SO₃, кДж/моль: половина уравнения. */
export const SO3_DH_PER_MOL_KJ = round3(SO3_REACTION_DH_KJ / 2)

/** SO₃ + H₂O (ж.) → H₂SO₄ (ж.), кДж/моль — почему SO₃ поглощают кислотой, а не водой. */
export const SO3_HYDRATION_KJ = formationReactionKJ('so3_hydration')

/** ΔH°f реагента и продукта, кДж/моль. */
export const SO2_DHF_KJ = dHfKJ('SO2(g)')
export const SO3_DHF_KJ = dHfKJ('SO3(g)')

/**
 * Формальная степень окисления серы в SOₙ из электронейтральности: n·(8 − валентные e⁻ O).
 * Кислород в оксидах −2 = −(8 − 6): число валентных электронов — из ATOMIC_DATA.
 */
export function sulfurOxidationState(oxygens: number): number {
  return oxygens * (8 - ATOMIC_DATA.O.valenceElectrons)
}

/** Справочные числа для подписей и текстов — все из ядра. */
export const SO3_FACTS = {
  so2Pm: bondLengthPm('S=O'),
  so2AngleDeg: bondAngleDeg('sulfurDioxide'),
  so2DipoleD: dipoleDebye('SO2')!,
  o2Pm: bondLengthPm('O=O'),
  so3Pm: bondLengthPm('S=O(SO3)'),
  so3AngleDeg: bondAngleDeg('sulfurTrioxide'),
  so3DipoleD: dipoleDebye('SO3')!,
  /** тример S₃O₉ (γ-SO₃, кристалл): мостиковая S–O кольца и концевая S=O */
  s3o9RingPm: reagentBondPm('s3o9', 'S–O(кольцо)'),
  s3o9TermPm: reagentBondPm('s3o9', 'S=O(конц.)'),
  oxSO2: sulfurOxidationState(2),
  oxSO3: sulfurOxidationState(3),
} as const

/**
 * Полуреакции ОДНОГО оборота катализатора (формальные степени окисления — связи ковалентные):
 * S⁺⁴ отдаёт 2e⁻, два атома V⁺⁵ принимают по одному; во второй стадии атом O (из ½ O₂)
 * принимает 2e⁻ от двух V⁺⁴. На уравнение — по два оборота.
 */
export const SO3_HALF_REACTIONS = [
  { id: 'sulfur' as const, equation: 'S⁺⁴ − 2e⁻ → S⁺⁶', electrons: 2, times: 2, role: 'oxidation' as const },
  { id: 'vanadiumDown' as const, equation: 'V⁺⁵ + 1e⁻ → V⁺⁴', electrons: 1, times: 4, role: 'reduction' as const },
  { id: 'vanadiumUp' as const, equation: 'V⁺⁴ − 1e⁻ → V⁺⁵', electrons: 1, times: 4, role: 'oxidation' as const },
  { id: 'oxygen' as const, equation: 'O₂⁰ + 4e⁻ → 2 O⁻²', electrons: 4, times: 1, role: 'reduction' as const },
] as const

/** Суммарное уравнение и стадии в машинном виде — для теста стехиометрии. */
export const SO3_REACTION = {
  left: [
    { formula: 'SO2', coeff: 2 },
    { formula: 'O2', coeff: 1 },
  ],
  right: [{ formula: 'SO3', coeff: 2 }],
} as const

export const SO3_STAGE_REACTIONS = {
  reduction: {
    left: [
      { formula: 'V2O5', coeff: 1 },
      { formula: 'SO2', coeff: 1 },
    ],
    right: [
      { formula: 'V2O4', coeff: 1 },
      { formula: 'SO3', coeff: 1 },
    ],
  },
  reoxidation: {
    left: [
      { formula: 'V2O4', coeff: 1 },
      { formula: 'O', coeff: 1 },
    ],
    right: [{ formula: 'V2O5', coeff: 1 }],
  },
} as const

/** Шаг урока, на котором говорят об энергии по стадиям. */
export const SO3_ENERGY_STEP_INDEX = SO3_STEPS.findIndex((s) => s.id === 'reoxidation')

/** Проверка для теста и dev: сумма стадий = прямая реакция, знаки верные. */
export function validateSo3Energetics(): void {
  assertLadderMatchesFormation(SO3_LADDER, 0.05)
  if (!(so3StageKJ('reduction') > 0)) throw new Error('so3: стадия V₂O₅ + SO₂ по ядру эндотермическая')
  if (!(so3StageKJ('reoxidation') < 0)) throw new Error('so3: стадия V₂O₄ + ½ O₂ обязана быть экзотермической')
  if (!(SO3_REACTION_DH_KJ < 0)) throw new Error('so3: окисление SO₂ экзотермично (Ле Шателье: нагрев мешает)')
  const hess = 2 * SO3_DHF_KJ - 2 * SO2_DHF_KJ
  if (Math.abs(hess - SO3_REACTION_DH_KJ) > 1e-6) throw new Error(`so3: ΔH реакции ${SO3_REACTION_DH_KJ} ≠ 2·ΔH°f разность ${hess}`)
  for (const s of SO3_LADDER.stages) {
    if (s.multiplier !== SO3_STAGE_MULTIPLIER) throw new Error(`so3: у ступени ${s.id} множитель ${s.multiplier}`)
    if (Math.abs(s.dH - s.multiplier * s.perUnitKJ!) > 1e-6) throw new Error(`so3: ступень ${s.id} ≠ множитель × perUnit`)
  }
}
