import { bondEnthalpyKJ, dHfKJ, formationReactionKJ } from '../../../../chemistry/data'
import { assertLadderMatchesFormation, type Ladder, type LadderStage } from '../kit/energyLadderData'
import { SIO2_BREAKS, SIO2_INSERTIONS, SIO2_STEPS } from './sio2Steps'

/**
 * Энергетика Si (тв.) + O₂ (г.) → SiO₂ (тв., α-кварц) — цикл Гесса на 1 моль SiO₂.
 *
 * SiO₂ — атомный полярно-ковалентный кристалл, ионов в нём нет, поэтому это НЕ цикл Борна —
 * Габера (ступеней ионизации и решётки нет), а цикл «атомизация → связи»:
 *   1) Si (тв.) → Si (г.)          ΔH°f(Si, г.)              — ФОРМАЛЬНАЯ ступень закона Гесса:
 *                                                              свободных атомов Si при окислении нет;
 *   2) O₂ (г.) → 2 O (г.)          2 × ΔH°f(O, г.)           — множитель 2;
 *   3) Si (г.) + 2 O (г.) → SiO₂   4 × (−E(Si–O))            — множитель 4: на один Si четыре связи
 *                                                              Si–O (каждый O — мостик на два Si,
 *                                                              на формульную единицу ровно 4 связи).
 * Сумма сходится с табличной ΔH°f(SiO₂) с точностью округления E(Si–O) в ядре до 0,1 кДж —
 * это расхождение названо в тексте урока.
 *
 * Числа НЕ живут здесь: ступени — dHfKJ и bondEnthalpyKJ ядра. Файл без THREE и React —
 * его читают панель энергии и тесты.
 */

/** Сколько связей Si–O приходится на одну формульную единицу SiO₂ (КЧ Si в каркасе). */
export const SIO2_BONDS_PER_UNIT = 4
/** Сколько атомов O на формульную единицу. */
export const SIO2_O_PER_UNIT = 2

const round1 = (v: number) => Math.round(v * 10) / 10
const round3 = (v: number) => Math.round(v * 1000) / 1000

const E_SIO = bondEnthalpyKJ('Si-O')
const H_SI_G = dHfKJ('Si(g)')
const H_O_G = dHfKJ('O(g)')

const stages: LadderStage[] = [
  {
    id: 'atomization',
    kind: 'sublimation',
    dH: H_SI_G,
    at: SIO2_STEPS[1]!.from + 0.8,
    equation: 'Si (тв) → Si (г)',
    perUnitKJ: H_SI_G,
  },
  {
    id: 'dissociation',
    kind: 'dissociation',
    dH: round3(SIO2_O_PER_UNIT * H_O_G),
    at: SIO2_BREAKS.b,
    equation: 'O₂ (г) → 2 O (г)',
    multiplier: SIO2_O_PER_UNIT,
    perUnitKJ: H_O_G,
  },
  {
    id: 'bonds',
    kind: 'bond',
    dH: round3(-SIO2_BONDS_PER_UNIT * E_SIO),
    at: SIO2_INSERTIONS[SIO2_INSERTIONS.length - 1]!.at,
    equation: 'Si (г) + 2 O (г) → SiO₂ (тв)',
    multiplier: SIO2_BONDS_PER_UNIT,
    perUnitKJ: -E_SIO,
  },
]

export const SIO2_LADDER: Ladder = {
  cycleId: 'sio2',
  formula: 'SiO₂',
  equation: 'Si (тв) + O₂ (г) → SiO₂ (тв)',
  stages,
  sumKJ: round3(stages.reduce((s, x) => s + x.dH, 0)),
  tableKJ: dHfKJ('SiO2(s)'),
}

/** Ступень цикла по id. */
export function sio2StageKJ(id: 'atomization' | 'dissociation' | 'bonds'): number {
  const s = SIO2_LADDER.stages.find((x) => x.id === id)
  if (!s) throw new Error(`sio2: нет ступени ${id}`)
  return s.dH
}

/** Табличная ΔH°f(SiO₂, α-кварц), кДж/моль — её показывает 3D-подпись. */
export const SIO2_DHF_TABLE_KJ = SIO2_LADDER.tableKJ
/** Сумма цикла, кДж/моль (одна десятая). */
export const SIO2_DHF_SUM_KJ = round1(SIO2_LADDER.sumKJ)
/** Расхождение суммы с таблицей, кДж/моль (округление E(Si–O) в ядре). */
export const SIO2_RESIDUAL_KJ = round1(Math.abs(SIO2_LADDER.sumKJ - SIO2_LADDER.tableKJ))
/** Тепловой эффект уравнения Si + O₂ → SiO₂ из thermoData (один моль). */
export const SIO2_REACTION_DH_KJ = formationReactionKJ('sio2_formation')

/** Затраты до образования связей (атомизация + диссоциация), кДж/моль. */
export const SIO2_COST_KJ = round1(sio2StageKJ('atomization') + sio2StageKJ('dissociation'))

/**
 * Главная идея урока — сравнение энергий связей (всё из bondData, кДж/моль):
 * у кремния четыре σ-связи Si–O, у углерода две двойные C=O (как в CO₂) против четырёх C–O.
 * Числа Si=O в ядре нет — сравнение для кремния дано без него (см. note шага 4).
 */
export const SIO2_BOND_COMPARISON = {
  siO: E_SIO,
  fourSiO: round1(SIO2_BONDS_PER_UNIT * E_SIO),
  siSi: bondEnthalpyKJ('Si-Si'),
  /** во сколько раз связь Si–O прочнее Si–Si (одна десятая) */
  siOoverSiSi: round1(E_SIO / bondEnthalpyKJ('Si-Si')),
  cDoubleO: bondEnthalpyKJ('C=O(CO2)'),
  twoCdoubleO: round1(2 * bondEnthalpyKJ('C=O(CO2)')),
  cO: bondEnthalpyKJ('C-O'),
  fourCO: round1(4 * bondEnthalpyKJ('C-O')),
} as const

/** Шаг урока, на котором показывают блок энергии целиком. */
export const SIO2_ENERGY_STEP_INDEX = SIO2_STEPS.findIndex((s) => s.id === 'energy')

/**
 * Формальный электронный баланс (степени окисления, а не заряды ионов: связь Si–O
 * полярная ковалентная, реальные заряды — δ+/δ−). Отдано 4 e⁻, принято 4 e⁻.
 */
export const SIO2_HALF_REACTIONS = [
  { id: 'oxidation' as const, equation: 'Si⁰ − 4e⁻ → Si⁺⁴', electrons: 4, times: 1, oxLeft: 0, oxRight: 4 },
  { id: 'reduction' as const, equation: 'O₂⁰ + 4e⁻ → 2 O⁻²', electrons: 4, times: 1, oxLeft: 0, oxRight: -4 },
] as const

/** Суммарное уравнение в машинном виде (ASCII-формулы) — для теста стехиометрии. */
export const SIO2_REACTION = {
  left: [
    { formula: 'Si', coeff: 1 },
    { formula: 'O2', coeff: 1 },
  ],
  right: [{ formula: 'SiO2', coeff: 1 }],
} as const

/** Проверка для теста: сумма ступеней совпадает с табличной ΔH°f, знаки верные. */
export function validateSio2Energetics(): void {
  assertLadderMatchesFormation(SIO2_LADDER, 0.15)
  if (!(sio2StageKJ('atomization') > 0)) throw new Error('sio2: атомизация кремния обязана быть эндотермической')
  if (!(sio2StageKJ('dissociation') > 0)) throw new Error('sio2: диссоциация O₂ обязана быть эндотермической')
  if (!(sio2StageKJ('bonds') < 0)) throw new Error('sio2: образование связей Si–O обязано быть экзотермическим')
  if (Math.abs(SIO2_REACTION_DH_KJ - SIO2_DHF_TABLE_KJ) > 1e-9) throw new Error('sio2: ΔH уравнения ≠ ΔH°f(SiO₂)')
  for (const s of SIO2_LADDER.stages) {
    const m = s.multiplier ?? 1
    if (s.perUnitKJ != null && Math.abs(m * s.perUnitKJ - s.dH) > 1e-6) throw new Error(`sio2: ступень ${s.id}: ${m} × ${s.perUnitKJ} ≠ ${s.dH}`)
  }
}
