import { dHfKJ } from '../../../../chemistry/data'
import { sJ } from '../../../../chemistry/data/thermoData'
import type { Ladder, LadderStage } from '../kit/energyLadderData'
import { caoCueAt, CAO_STEPS } from './caoSteps'

/**
 * Энергетика обжига известняка CaCO₃ (тв.) → CaO (тв.) + CO₂ (г.).
 *
 * ЧИСЛА НЕ ЖИВУТ ЗДЕСЬ: всё берётся из chemistry/data (кДж/моль, 298 K):
 *   ΔH°f(CaCO₃, кальцит) = −1207,6   ΔH°f(CaO) = −634,9   ΔH°f(CO₂) = −393,5
 *   S°(CaCO₃) = 91,7   S°(CaO) = 38,1   S°(CO₂) = 213,8   Дж/(моль·К)
 *
 * ЛЕСТНИЦА — цикл ГЕССА через простые вещества (не Борна — Габера: здесь нет
 * ни ионизации, ни сродства к электрону — степени окисления вообще не меняются):
 *   1) CaCO₃ (тв.) → Ca (тв.) + C (графит) + 3/2 O₂ (г.)   +1207,6  (это −ΔH°f)
 *   2) C (графит) + O₂ (г.) → CO₂ (г.)                      −393,5
 *   3) Ca (тв.) + ½ O₂ (г.) → CaO (тв.)                     −634,9
 *   ───────────────────────────────────────────────────────────────
 *   Σ = +179,2 кДж/моль — реакция ЭНДОТЕРМИЧЕСКАЯ, лестница идёт ВВЕРХ.
 *
 * Знак ΔH > 0 сам по себе не запрещает реакцию: выделяется ГАЗ, поэтому
 * ΔS° = +160,2 Дж/(моль·К) и ΔG° = ΔH° − TΔS° обращается в ноль при
 * T = ΔH°/ΔS° ≈ 1119 K (≈ 846 °C). Выше этой температуры равновесие
 * сдвинуто вправо — отсюда и печь на 900…1000 °C.
 *
 * Файл без THREE и React — его читают панель энергии и тесты.
 */

const CACO3 = 'CaCO3(s)'
const CAO = 'CaO(s)'
const CO2 = 'CO2(g)'
const CAOH2 = 'Ca(OH)2(s)'
const H2O_L = 'H2O(l)'

/** ΔH° обжига по закону Гесса, кДж/моль: ΔH°f(CaO) + ΔH°f(CO₂) − ΔH°f(CaCO₃). */
export const CAO_REACTION_DH_KJ = dHfKJ(CAO) + dHfKJ(CO2) - dHfKJ(CACO3)

/** ΔS° обжига, Дж/(моль·К): газ из твёрдого — энтропия резко растёт. */
export const CAO_REACTION_DS_J = sJ(CAO) + sJ(CO2) - sJ(CACO3)

/** Температура, при которой ΔG° = 0: T = ΔH° / ΔS°, K. */
export const CAO_EQUILIBRIUM_K = (CAO_REACTION_DH_KJ * 1000) / CAO_REACTION_DS_J

/** Та же температура в °C — её называет текст урока («почему нужен сильный нагрев»). */
export const CAO_EQUILIBRIUM_C = CAO_EQUILIBRIUM_K - 273.15

/** Рабочая температура известковой печи, °C — школьный диапазон 900…1000. */
export const CAO_KILN_C = 900

/**
 * Ступени лестницы со временем сюжета. `kind` — техническое поле общего
 * компонента (оно нигде не рисуется); цикл здесь гессовский, а не Борна — Габера,
 * поэтому ближайшие по смыслу значения: разложение на простые вещества —
 * 'dissociation', сборка ионного кристалла CaO — 'lattice', ковалентный CO₂ — 'bond'.
 */
const STAGES: readonly LadderStage[] = [
  {
    id: 'decompose',
    kind: 'dissociation',
    dH: -dHfKJ(CACO3),
    at: caoCueAt('split'),
    equation: 'CaCO₃ (тв.) → Ca (тв.) + C (графит) + 3/2 O₂ (г.)',
  },
  {
    id: 'co2',
    kind: 'bond',
    dH: dHfKJ(CO2),
    at: caoCueAt('escape'),
    equation: 'C (графит) + O₂ (г.) → CO₂ (г.)',
  },
  {
    id: 'cao',
    kind: 'lattice',
    dH: dHfKJ(CAO),
    at: caoCueAt('rocksalt'),
    equation: 'Ca (тв.) + ½ O₂ (г.) → CaO (тв.)',
  },
]

export const CAO_LADDER: Ladder = {
  cycleId: 'cao-calcination',
  formula: 'CaO + CO₂',
  equation: 'CaCO₃ (тв.) → CaO (тв.) + CO₂ (г.)',
  stages: STAGES,
  sumKJ: STAGES.reduce((sum, s) => sum + s.dH, 0),
  tableKJ: CAO_REACTION_DH_KJ,
}

/** ΔH обжига, округлённое для подписи в 3D: +179. */
export const CAO_DH_KJ = Math.round(CAO_REACTION_DH_KJ)

/** Шаг урока, на котором показывают блок энергии целиком. */
export const CAO_ENERGY_STEP_INDEX = CAO_STEPS.findIndex((s) => s.id === 'energy')

/**
 * Две реакции «дальше в классе» (шаг 5). Энтальпии — тоже по закону Гесса
 * из ΔH°f, знак физический: обе экзотермические.
 */
export const CAO_SLAKING_DH_KJ = dHfKJ(CAOH2) - (dHfKJ(CAO) + dHfKJ(H2O_L))
export const CAO_LIMEWATER_DH_KJ = dHfKJ(CACO3) + dHfKJ(H2O_L) - (dHfKJ(CAOH2) + dHfKJ(CO2))

/**
 * Суммарное уравнение в машинном виде (ASCII-формулы) — для теста стехиометрии.
 * Степени окисления НЕ меняются: Ca +2, C +4, O −2 и слева, и справа —
 * обжиг известняка НЕ окислительно-восстановительная реакция.
 */
export const CAO_REACTION = {
  left: [{ formula: 'CaCO3', coeff: 1 }],
  right: [
    { formula: 'CaO', coeff: 1 },
    { formula: 'CO2', coeff: 1 },
  ],
} as const

/** Реакции шага 5 в машинном виде — тест проверяет и их баланс. */
export const CAO_FOLLOW_UP_REACTIONS = [
  {
    id: 'slaking' as const,
    left: [
      { formula: 'CaO', coeff: 1 },
      { formula: 'H2O', coeff: 1 },
    ],
    right: [{ formula: 'CaO2H2', coeff: 1 }],
    dHKJ: CAO_SLAKING_DH_KJ,
  },
  {
    id: 'limewater' as const,
    left: [
      { formula: 'CaO2H2', coeff: 1 },
      { formula: 'CO2', coeff: 1 },
    ],
    right: [
      { formula: 'CaCO3', coeff: 1 },
      { formula: 'H2O', coeff: 1 },
    ],
    dHKJ: CAO_LIMEWATER_DH_KJ,
  },
] as const

/** Проверка для теста: арифметика лестницы и знаки. */
export function validateCaoEnergetics(): void {
  const d = Math.abs(CAO_LADDER.sumKJ - CAO_LADDER.tableKJ)
  if (d > 0.01) {
    throw new Error(`cao: сумма ступеней ${CAO_LADDER.sumKJ} ≠ ΔH реакции ${CAO_LADDER.tableKJ}`)
  }
  if (!(CAO_REACTION_DH_KJ > 0)) throw new Error('cao: обжиг известняка обязан быть эндотермическим (ΔH > 0)')
  if (!(CAO_REACTION_DS_J > 0)) throw new Error('cao: выделяется газ — ΔS обязана быть положительной')
  if (!(CAO_EQUILIBRIUM_K > 1000 && CAO_EQUILIBRIUM_K < 1250)) {
    throw new Error(`cao: T(ΔG = 0) = ${CAO_EQUILIBRIUM_K.toFixed(0)} K, ожидалось ≈ 1119 K`)
  }
  if (!(CAO_KILN_C > CAO_EQUILIBRIUM_C)) {
    throw new Error('cao: печь обязана работать выше температуры равновесия')
  }
  const up = CAO_LADDER.stages.filter((s) => s.dH > 0)
  const down = CAO_LADDER.stages.filter((s) => s.dH < 0)
  if (up.length !== 1 || down.length !== 2) {
    throw new Error('cao: лестница Гесса — одна ступень вверх (распад) и две вниз (образование CaO и CO₂)')
  }
  if (!(CAO_SLAKING_DH_KJ < 0)) throw new Error('cao: гашение извести обязано быть экзотермическим')
  if (!(CAO_LIMEWATER_DH_KJ < 0)) throw new Error('cao: помутнение известковой воды обязано быть экзотермическим')
}
