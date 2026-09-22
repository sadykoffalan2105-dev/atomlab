import {
  dHfKJ,
  FORMATION_ENTHALPY,
  FORMATION_REACTIONS,
  formationReactionIsEstimated,
  formationReactionKJ,
} from '../../../../chemistry/data'
import type { Ladder, LadderStage } from '../kit/energyLadderData'
import { mn2o7CueAt, MN2O7_PROTONS, MN2O7_STEPS } from './mn2o7Steps'

/**
 * Энергетика 2 KMnO₄ (тв.) + H₂SO₄ (ж.) → Mn₂O₇ (ж.) + K₂SO₄ (тв.) + H₂O (ж.) — уравнение учебника.
 *
 * ЧИСЛА НЕ ЖИВУТ ЗДЕСЬ: всё — из chemistry/data/thermoData.ts (FORMATION_ENTHALPY и контрольные
 * реакции FORMATION_REACTIONS 'mn2o7_textbook', 'mn2o7_decomposition').
 *
 * ЛЕСТНИЦА — цикл ГЕССА через простые вещества (не Борна — Габера: степени окисления здесь
 * не меняются — Mn +7, S +6, O −2, H +1, K +1 и слева, и справа):
 *   1) 2 KMnO₄ → простые вещества            2 × (−ΔH°f(KMnO₄))  > 0
 *   2) H₂SO₄ → простые вещества              −ΔH°f(H₂SO₄, ж.)     > 0
 *   3) простые вещества → K₂SO₄              ΔH°f(K₂SO₄)          < 0
 *   4) простые вещества → H₂O (ж.)           ΔH°f(H₂O, ж.)        < 0
 *   5) простые вещества → Mn₂O₇ (ж.)         ΔH°f(Mn₂O₇, ж.)      < 0  — ОЦЕНКА (вторичный источник)
 * Сумма = formationReactionKJ('mn2o7_textbook'). ΔH°f(Mn₂O₇) в CRC и NIST-JANAF нет, поэтому
 * сумма — оценка, и сходимость с первичными таблицами НЕ заявляется (решение владельца 2).
 *
 * Файл без THREE и React — его читают панель энергии и тесты.
 */

const KMNO4 = 'KMnO4(s)'
const H2SO4 = 'H2SO4(l)'
const MN2O7 = 'Mn2O7(l)'
const K2SO4 = 'K2SO4(s)'
const KHSO4 = 'KHSO4(s)'
const H2O_L = 'H2O(l)'

/** Коэффициент вещества в уравнении учебника (из ядра, не руками). */
function coefOf(reactionId: string, key: string): number {
  const t = FORMATION_REACTIONS[reactionId]!.species.find((s) => s.key === key)
  if (!t) throw new Error(`mn2o7: в реакции ${reactionId} нет ${key}`)
  return Math.abs(t.coef)
}

const N_KMNO4 = coefOf('mn2o7_textbook', KMNO4)

/** ΔH реакции учебника по закону Гесса, кДж на уравнение (оценка: Mn₂O₇ estimated). */
export const MN2O7_REACTION_DH_KJ = formationReactionKJ('mn2o7_textbook')

/** Оценка ли это (в ядре ΔH°f(Mn₂O₇) помечена estimated). */
export const MN2O7_ESTIMATED = formationReactionIsEstimated('mn2o7_textbook')

/** ΔH°f(Mn₂O₇, ж.), кДж/моль — ОЦЕНКА из вторичного источника. */
export const MN2O7_DHF_KJ = dHfKJ(MN2O7)
export const MN2O7_DHF_ESTIMATED = FORMATION_ENTHALPY[MN2O7]?.estimated === true

/**
 * Та же реакция, какой она идёт в концентрированной кислоте на самом деле:
 * 2 KMnO₄ + 2 H₂SO₄ → Mn₂O₇ + 2 KHSO₄ + H₂O. Считается из ΔH°f ядра (отдельной записи нет).
 */
export const MN2O7_KHSO4_DH_KJ =
  Math.round((dHfKJ(MN2O7) + 2 * dHfKJ(KHSO4) + dHfKJ(H2O_L) - 2 * dHfKJ(KMNO4) - 2 * dHfKJ(H2SO4)) * 1000) / 1000

/** Разложение 2 Mn₂O₇ → 4 MnO₂ + 3 O₂, кДж на уравнение (оценка). */
export const MN2O7_DECOMP_DH_KJ = formationReactionKJ('mn2o7_decomposition')
export const MN2O7_DECOMP_ESTIMATED = formationReactionIsEstimated('mn2o7_decomposition')

/** Коэффициенты уравнения разложения — из ядра (для 3D-подписи и теста баланса). */
export const MN2O7_DECOMP_COEF = {
  mn2o7: coefOf('mn2o7_decomposition', MN2O7),
  mno2: coefOf('mn2o7_decomposition', 'MnO2(s)'),
  o2: coefOf('mn2o7_decomposition', 'O2(g)'),
} as const

/**
 * Ступени лестницы со временем сюжета. `kind` — техническое поле общего компонента
 * (не рисуется): разложение на простые вещества — 'dissociation', сборка вещества — 'bond'
 * (ковалентные Mn₂O₇ и H₂O) и 'lattice' (ионный K₂SO₄).
 */
const STAGES: readonly LadderStage[] = [
  {
    id: 'kmno4',
    kind: 'dissociation',
    dH: -N_KMNO4 * dHfKJ(KMNO4),
    multiplier: N_KMNO4,
    perUnitKJ: -dHfKJ(KMNO4),
    at: MN2O7_PROTONS.p1.leave - 1.1,
    equation: '2 KMnO₄ (тв.) → 2 K (тв.) + 2 Mn (тв.) + 4 O₂ (г.)',
  },
  {
    id: 'h2so4',
    kind: 'dissociation',
    dH: -dHfKJ(H2SO4),
    at: MN2O7_PROTONS.p1.leave - 0.5,
    equation: 'H₂SO₄ (ж.) → H₂ (г.) + S (тв.) + 2 O₂ (г.)',
  },
  {
    id: 'k2so4',
    kind: 'lattice',
    dH: dHfKJ(K2SO4),
    at: mn2o7CueAt('sulfate'),
    equation: '2 K (тв.) + S (тв.) + 2 O₂ (г.) → K₂SO₄ (тв.)',
  },
  {
    id: 'h2o',
    kind: 'bond',
    dH: dHfKJ(H2O_L),
    at: mn2o7CueAt('condense'),
    equation: 'H₂ (г.) + ½ O₂ (г.) → H₂O (ж.)',
  },
  {
    id: 'mn2o7',
    kind: 'bond',
    dH: dHfKJ(MN2O7),
    at: mn2o7CueAt('bridge'),
    equation: '2 Mn (тв.) + 7/2 O₂ (г.) → Mn₂O₇ (ж.)',
  },
]

export const MN2O7_LADDER: Ladder = {
  cycleId: 'mn2o7-textbook',
  formula: 'Mn₂O₇',
  equation: '2 KMnO₄ (тв.) + H₂SO₄ (ж.) → Mn₂O₇ (ж.) + K₂SO₄ (тв.) + H₂O (ж.)',
  stages: STAGES,
  sumKJ: Math.round(STAGES.reduce((sum, s) => sum + s.dH, 0) * 1000) / 1000,
  tableKJ: MN2O7_REACTION_DH_KJ,
}

/** Ступень по id (для текстов и тестов). */
export function mn2o7StageKJ(id: 'kmno4' | 'h2so4' | 'k2so4' | 'h2o' | 'mn2o7'): number {
  const s = MN2O7_LADDER.stages.find((x) => x.id === id)
  if (!s) throw new Error(`mn2o7: нет ступени ${id}`)
  return s.dH
}

/** Шаг урока, на котором показывают блок энергии целиком. */
export const MN2O7_ENERGY_STEP_INDEX = MN2O7_STEPS.findIndex((s) => s.id === 'energy')

/** Суммарное уравнение учебника в машинном виде (ASCII-формулы) — для теста стехиометрии. */
export const MN2O7_REACTION = {
  left: [
    { formula: 'KMnO4', coeff: N_KMNO4 },
    { formula: 'H2SO4', coeff: coefOf('mn2o7_textbook', H2SO4) },
  ],
  right: [
    { formula: 'Mn2O7', coeff: coefOf('mn2o7_textbook', MN2O7) },
    { formula: 'K2SO4', coeff: coefOf('mn2o7_textbook', K2SO4) },
    { formula: 'H2O', coeff: coefOf('mn2o7_textbook', H2O_L) },
  ],
} as const

/** Уравнение разложения в машинном виде. */
export const MN2O7_DECOMPOSITION = {
  left: [{ formula: 'Mn2O7', coeff: MN2O7_DECOMP_COEF.mn2o7 }],
  right: [
    { formula: 'MnO2', coeff: MN2O7_DECOMP_COEF.mno2 },
    { formula: 'O2', coeff: MN2O7_DECOMP_COEF.o2 },
  ],
} as const

/** Проверка для теста: арифметика лестницы и знаки. */
export function validateMn2o7Energetics(): void {
  const d = Math.abs(MN2O7_LADDER.sumKJ - MN2O7_LADDER.tableKJ)
  if (d > 0.01) throw new Error(`mn2o7: сумма ступеней ${MN2O7_LADDER.sumKJ} ≠ ΔH реакции ${MN2O7_LADDER.tableKJ}`)
  for (const s of MN2O7_LADDER.stages) {
    if (s.kind === 'dissociation' && !(s.dH > 0)) throw new Error(`mn2o7: разложение на простые вещества (${s.id}) обязано быть эндотермическим`)
    if (s.kind !== 'dissociation' && !(s.dH < 0)) throw new Error(`mn2o7: образование ${s.id} из простых веществ обязано быть экзотермическим`)
    if (s.multiplier != null && s.perUnitKJ != null && Math.abs(s.multiplier * s.perUnitKJ - s.dH) > 1e-9) {
      throw new Error(`mn2o7: у ступени ${s.id} множитель × на единицу ≠ ступени`)
    }
  }
  if (!MN2O7_ESTIMATED || !MN2O7_DHF_ESTIMATED) throw new Error('mn2o7: ΔH°f(Mn₂O₇) в ядре обязана быть помечена как оценка')
  if (!(MN2O7_DECOMP_DH_KJ < 0)) throw new Error('mn2o7: разложение Mn₂O₇ обязано быть экзотермическим')
  for (let i = 1; i < MN2O7_LADDER.stages.length; i++) {
    if (MN2O7_LADDER.stages[i]!.at < MN2O7_LADDER.stages[i - 1]!.at) throw new Error('mn2o7: ступени лестницы не по времени сюжета')
  }
}
