import {
  bondEnthalpyKJ,
  bondLengthPm,
  dHfKJ,
  dipoleDebye,
  getElement,
  MOLECULAR_REACTIONS,
  reactionEnthalpyFromBondsKJ,
  reactionEnthalpyFromFormationKJ,
} from '../../../../chemistry/data'
import { assertLadderMatchesFormation, type Ladder, type LadderStage } from '../kit/energyLadderData'
import { hclCueAt, HCL_STEPS } from './hclSteps'

/**
 * Энергетика H₂ (г.) + Cl₂ (г.) → 2 HCl (г.).
 *
 * У молекулярной реакции нет цикла Борна — Габера (ионной решётки не возникает),
 * поэтому лестница строится по ЭНЕРГИЯМ СВЯЗЕЙ — это тот же закон Гесса, только
 * через путь «разорвать всё на атомы → собрать продукт»:
 *
 *   H–H → 2 H•            +435,8 (D(H–H),  bondData)
 *   Cl–Cl → 2 Cl•         +243   (D(Cl–Cl), bondData)
 *   2 H• + 2 Cl• → 2 HCl  −862   (−2 · D(H–Cl) = −2 · 431)
 *   ──────────────────────────
 *   Σ = −183 кДж  ≈  2 · ΔH°f(HCl, г.) = −184,6 кДж (табличное)
 *
 * Расхождение 1,6 кДж — обычная цена средних энергий связей: D(H–Cl) табулируют
 * как среднюю величину, а ΔH°f измеряют калориметрически. Оба числа приходят из
 * src/chemistry/data, ни одно не подгоняется.
 *
 * ЦЕПНОЙ МЕХАНИЗМ считается ОТДЕЛЬНО, по теплотам образования частиц (все четыре
 * значения табличные: ΔH°f(HCl) = −92,3; ΔH°f(H) = +218,0; ΔH°f(Cl) = +121,3):
 *
 *   зарождение    Cl₂ + hν → 2 Cl•        +242,6  (нужен квант, λ ≤ 492 нм)
 *   рост цепи 1   Cl• + H₂ → HCl + H•       +4,4  (чуть эндотермично)
 *   рост цепи 2   H•  + Cl₂ → HCl + Cl•   −189,0  (сильно экзотермично)
 *   обрыв         Cl• + Cl• → Cl₂         −242,6
 *
 * Главное соотношение урока: ДВЕ СТАДИИ РОСТА ЦЕПИ В СУММЕ ДАЮТ ВСЮ РЕАКЦИЮ —
 *   (+4,4) + (−189,0) = −184,6 = 2 · ΔH°f(HCl),
 * а зарождение и обрыв взаимно уничтожаются. Поэтому один поглощённый квант
 * запускает множество звеньев: расход энергии был один раз, выигрыш — каждый круг.
 *
 * Файл без THREE и React — его читают панель энергии и тесты.
 */

/** Ключ реакции в научном ядре (MOLECULAR_REACTIONS). */
export const HCL_REACTION_ID = 'hcl_g_2mol'

const REACTION = MOLECULAR_REACTIONS[HCL_REACTION_ID]!

/** ΔH°f(HCl, г.), кДж/моль: −92,3. */
export const HCL_DHF_KJ = dHfKJ('HCl(g)')

/** Тепловой эффект уравнения H₂ + Cl₂ → 2 HCl (две формульные единицы), кДж: −184,6. */
export const HCL_REACTION_DH_KJ = reactionEnthalpyFromFormationKJ(HCL_REACTION_ID)

/** Тот же эффект, посчитанный НЕЗАВИСИМО по энергиям связей, кДж: −183. */
export const HCL_BOND_DH_KJ = reactionEnthalpyFromBondsKJ(HCL_REACTION_ID)

/** Энергия диссоциации Cl–Cl, кДж/моль: 243 — её и должен принести квант света. */
export const HCL_INITIATION_KJ = bondEnthalpyKJ('Cl-Cl')

// ─────────────────────────────────────────────────────────────────────────────
// Квант света, который рвёт Cl₂
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Определяющие константы СИ (CODATA, точные по определению) — это физика, а не
 * справочные данные вещества, поэтому они живут здесь, а не в chemistry/data.
 */
const PLANCK_J_S = 6.62607015e-34
const LIGHT_M_S = 299792458
const AVOGADRO = 6.02214076e23

/** Энергия моля квантов длиной волны λ: E = h·c·N_A / λ. */
const HC_NA_J_M = PLANCK_J_S * LIGHT_M_S * AVOGADRO

/**
 * Самая ДЛИННАЯ волна, кванта которой ещё хватает на разрыв Cl–Cl, нм:
 * λ = h·c·N_A / D(Cl–Cl) = 0,11963 Дж·м/моль / 243 000 Дж/моль ≈ 492 нм.
 * Это сине-зелёная граница: синий и фиолетовый свет реакцию запускают, красный — нет.
 */
export const HCL_PHOTON_NM = Math.round((HC_NA_J_M / (HCL_INITIATION_KJ * 1000)) * 1e9)

// ─────────────────────────────────────────────────────────────────────────────
// Полярность связи H–Cl
// ─────────────────────────────────────────────────────────────────────────────

/** Элементарный заряд, Кл (точная константа СИ). */
const ELEMENTARY_CHARGE_C = 1.602176634e-19
/** 1 дебай в Кл·м (точное определение: 1 D = 10⁻²¹ / c Кл·м). */
const DEBYE_C_M = 1e-21 / LIGHT_M_S
/** Дипольный момент «чисто ионной» пары зарядов ±e на 1 Å, в дебаях: 4,803. */
const DEBYE_PER_E_ANGSTROM = (ELEMENTARY_CHARGE_C * 1e-10) / DEBYE_C_M

/** Разность электроотрицательностей χ(Cl) − χ(H) = 3,16 − 2,20 = 0,96. */
export const HCL_DELTA_EN =
  Math.round((getElement('Cl').electronegativity! - getElement('H').electronegativity!) * 100) / 100

/**
 * Доля ионности связи H–Cl по ОПЫТНОМУ дипольному моменту:
 *   μ(наблюд.) / μ(чисто ионная) = 1,08 D / (4,803 · 1,2746 Å) = 0,176 → ≈ 18 %.
 * Связь остаётся ПОЛЯРНОЙ КОВАЛЕНТНОЙ: до ионной (≥ 50 %) ей далеко.
 * Число зависит от того, какое μ взято в справочнике (1,03…1,11 D → 17…18 %),
 * здесь — значение из src/chemistry/data (DIPOLE_MOMENTS.HCl = 1,08 D).
 */
export const HCL_IONIC_FRACTION =
  dipoleDebye('HCl')! / (DEBYE_PER_E_ANGSTROM * (bondLengthPm('H-Cl') / 100))

/** Та же доля в процентах, округлённая для подписей: 18. */
export const HCL_IONIC_PERCENT = Math.round(HCL_IONIC_FRACTION * 100)

// ─────────────────────────────────────────────────────────────────────────────
// Лестница по энергиям связей
// ─────────────────────────────────────────────────────────────────────────────

/** Время сюжета, к которому ступень считается пройденной. */
const STAGE_AT: Record<string, number> = {
  bondClCl: hclCueAt('homolysis'),
  bondHH: hclCueAt('abstract') - 0.6,
  bondHCl: hclCueAt('propagate'),
}

const STAGES: readonly LadderStage[] = [
  {
    id: 'bondClCl',
    kind: 'dissociation',
    dH: bondEnthalpyKJ('Cl-Cl'),
    at: STAGE_AT.bondClCl!,
    equation: 'Cl₂ → 2 Cl•',
  },
  {
    id: 'bondHH',
    kind: 'dissociation',
    dH: bondEnthalpyKJ('H-H'),
    at: STAGE_AT.bondHH!,
    equation: 'H₂ → 2 H•',
  },
  {
    id: 'bondHCl',
    kind: 'bond',
    dH: -2 * bondEnthalpyKJ('H-Cl'),
    at: STAGE_AT.bondHCl!,
    equation: '2 H• + 2 Cl• → 2 HCl',
  },
]

/**
 * Лестница урока. `sumKJ` — сумма ступеней (по связям), `tableKJ` — независимое
 * табличное значение 2 · ΔH°f(HCl). Совпадение двух путей и есть закон Гесса.
 */
export const HCL_LADDER: Ladder = {
  cycleId: HCL_REACTION_ID,
  formula: 'HCl',
  equation: REACTION.equation,
  stages: STAGES,
  sumKJ: STAGES.reduce((s, x) => s + x.dH, 0),
  tableKJ: HCL_REACTION_DH_KJ,
}

// ─────────────────────────────────────────────────────────────────────────────
// Цепной механизм: элементарные стадии
// ─────────────────────────────────────────────────────────────────────────────

export type HclChainKind = 'initiation' | 'propagation' | 'termination'

export type HclChainStep = {
  id: 'initiation' | 'propagation1' | 'propagation2' | 'termination'
  kind: HclChainKind
  /** ΔH элементарной стадии, кДж/моль — из теплот образования частиц */
  dHKJ: number
  equation: string
  /** момент сюжета, когда стадия происходит на экране */
  at: number
}

/** ΔH элементарной стадии по теплотам образования: Σ(продукты) − Σ(реагенты). */
const stepDH = (products: readonly string[], reactants: readonly string[]): number =>
  Math.round((products.reduce((s, k) => s + dHfKJ(k), 0) - reactants.reduce((s, k) => s + dHfKJ(k), 0)) * 1000) / 1000

export const HCL_CHAIN: readonly HclChainStep[] = [
  {
    id: 'initiation',
    kind: 'initiation',
    dHKJ: stepDH(['Cl(g)', 'Cl(g)'], ['Cl2(g)']),
    equation: 'Cl₂ + hν → 2 Cl•',
    at: hclCueAt('homolysis'),
  },
  {
    id: 'propagation1',
    kind: 'propagation',
    dHKJ: stepDH(['HCl(g)', 'H(g)'], ['Cl(g)', 'H2(g)']),
    equation: 'Cl• + H₂ → HCl + H•',
    at: hclCueAt('abstract'),
  },
  {
    id: 'propagation2',
    kind: 'propagation',
    dHKJ: stepDH(['HCl(g)', 'Cl(g)'], ['H(g)', 'Cl2(g)']),
    equation: 'H• + Cl₂ → HCl + Cl•',
    at: hclCueAt('propagate'),
  },
  {
    id: 'termination',
    kind: 'termination',
    dHKJ: stepDH(['Cl2(g)'], ['Cl(g)', 'Cl(g)']),
    equation: 'Cl• + Cl• → Cl₂',
    at: hclCueAt('terminate'),
  },
]

const chainStep = (id: HclChainStep['id']): HclChainStep => HCL_CHAIN.find((s) => s.id === id)!

/** ΔH первой стадии роста цепи, кДж/моль: +4,4 (эндотермическая, самая медленная). */
export const HCL_PROP1_KJ = chainStep('propagation1').dHKJ
/** ΔH второй стадии роста цепи, кДж/моль: −189,0 (она и греет смесь). */
export const HCL_PROP2_KJ = chainStep('propagation2').dHKJ
/** Сумма стадий роста цепи, кДж: −184,6 — ровно тепловой эффект всей реакции. */
export const HCL_PROPAGATION_SUM_KJ = Math.round((HCL_PROP1_KJ + HCL_PROP2_KJ) * 1000) / 1000

/**
 * Порядок величины квантового выхода цепи: один поглощённый квант даёт до ~10⁶
 * молекул HCl (классический результат Боденштейна). Число ОЦЕНОЧНОЕ — в тексте
 * шага оно так и названо.
 */
export const HCL_QUANTUM_YIELD_LOG10 = 6

/** Шаг урока, на котором показывают блок энергии целиком. */
export const HCL_ENERGY_STEP_INDEX = HCL_STEPS.findIndex((s) => s.id === 'energy')

/**
 * Суммарное уравнение в машинном виде (ASCII-формулы) — для теста стехиометрии.
 * Заряда ни у одной частицы нет: реакция радикальная, а не ионная.
 */
export const HCL_REACTION_FORMULAS = {
  left: [
    { formula: 'H2', coeff: 1 },
    { formula: 'Cl2', coeff: 1 },
  ],
  right: [{ formula: 'HCl', coeff: 2 }],
} as const

/**
 * Баланс по РАДИКАЛАМ, а не по электронам: в каждой элементарной стадии роста
 * цепи слева один неспаренный электрон и справа один — цепь не обрывается.
 * У зарождения слева 0, справа 2; у обрыва наоборот.
 */
export const HCL_RADICAL_BALANCE = [
  { id: 'initiation' as const, left: 0, right: 2 },
  { id: 'propagation1' as const, left: 1, right: 1 },
  { id: 'propagation2' as const, left: 1, right: 1 },
  { id: 'termination' as const, left: 2, right: 0 },
] as const

/** Проверка для теста: оба независимых расчёта сходятся, знаки верные. */
export function validateHclEnergetics(): void {
  // Сумма ступеней по связям = табличная 2·ΔH°f(HCl) (допуск — цена средних D).
  assertLadderMatchesFormation(HCL_LADDER, 5)

  if (!(HCL_REACTION_DH_KJ < 0)) throw new Error('hcl: реакция обязана быть экзотермической')
  if (Math.abs(HCL_REACTION_DH_KJ - 2 * HCL_DHF_KJ) > 1e-6) {
    throw new Error('hcl: тепловой эффект уравнения обязан равняться 2 · ΔH°f(HCl)')
  }

  // Разрыв связей — только эндотермический, образование — только экзотермическое.
  for (const s of HCL_LADDER.stages) {
    if (s.kind === 'dissociation' && s.dH <= 0) throw new Error(`hcl: разрыв «${s.id}» обязан быть эндотермическим`)
    if (s.kind === 'bond' && s.dH >= 0) throw new Error(`hcl: образование связи «${s.id}» обязано быть экзотермическим`)
  }

  // Сердце урока: две стадии роста цепи в сумме дают всю реакцию.
  if (Math.abs(HCL_PROPAGATION_SUM_KJ - HCL_REACTION_DH_KJ) > 0.01) {
    throw new Error(
      `hcl: (${HCL_PROP1_KJ}) + (${HCL_PROP2_KJ}) = ${HCL_PROPAGATION_SUM_KJ} ≠ ${HCL_REACTION_DH_KJ} кДж — цепь не сходится`,
    )
  }
  if (!(HCL_PROP1_KJ > 0)) throw new Error('hcl: Cl• + H₂ → HCl + H• обязана быть слегка эндотермической')
  if (!(HCL_PROP2_KJ < 0)) throw new Error('hcl: H• + Cl₂ → HCl + Cl• обязана быть экзотермической')

  // Зарождение и обрыв взаимно уничтожаются — иначе цепь не «бесплатна».
  const init = chainStep('initiation').dHKJ
  const term = chainStep('termination').dHKJ
  if (Math.abs(init + term) > 1e-6) throw new Error('hcl: зарождение и обрыв обязаны быть противоположны по знаку')
  if (!(init > 0)) throw new Error('hcl: на разрыв Cl₂ энергию надо ЗАТРАТИТЬ')

  // Квант должен нести не меньше энергии, чем D(Cl–Cl).
  const quantumKJ = (HC_NA_J_M / (HCL_PHOTON_NM * 1e-9)) / 1000
  if (quantumKJ < HCL_INITIATION_KJ - 1) {
    throw new Error(`hcl: квант ${HCL_PHOTON_NM} нм несёт ${quantumKJ.toFixed(0)} кДж/моль — меньше D(Cl–Cl)`)
  }

  // Баланс радикалов: рост цепи их не создаёт и не уничтожает.
  for (const b of HCL_RADICAL_BALANCE) {
    const step = HCL_CHAIN.find((s) => s.id === b.id)!
    if (step.kind === 'propagation' && b.left !== b.right) {
      throw new Error(`hcl: стадия роста «${b.id}» обязана сохранять число радикалов`)
    }
  }
}
