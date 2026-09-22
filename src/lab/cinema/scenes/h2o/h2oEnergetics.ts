/**
 * Энергетика урока «вода»: 2 H₂ (г.) + O₂ (г.) → 2 H₂O.
 *
 * ДВА пути, и сцена их не смешивает:
 *   1. РЕАЛЬНЫЙ путь — разветвлённая цепь (шаги 2–4 сцены): стадии REACTION_STEP_CHAINS.h2_o2
 *      из ядра, ΔH каждой — formationReactionKJ (по ΔH°f): инициирование, два разветвления,
 *      продолжение цепи. Эти числа звучат в тексте шагов.
 *   2. РАСЧЁТНЫЙ путь закона Гесса через свободные атомы — лестница панели урока. Это НЕ стадии
 *      реакции (так и подписано в панели): H₂ → 2 H, ½ O₂ → O, H + O → ·OH, H + ·OH → H₂O.
 *      Все ступени — из ΔH°f ядра (H, O, ·OH, H₂O), поэтому сумма равна табличной ΔH°f ТОЧНО;
 *      ступени образования связей — последовательные энергии WATER_SEQUENTIAL_BDE_KJ со знаком минус.
 *
 * Ни одного числа руками. Файл без THREE и React — его читают панель энергии и тест.
 */
import {
  dHfKJ,
  formationReactionKJ,
  reactionEnthalpyBothKJ,
  REACTION_STEP_CHAINS,
  WATER_SEQUENTIAL_BDE_KJ,
  bondEnthalpyKJ,
} from '../../../../chemistry/data'
import { assertLadderMatchesFormation, type Ladder, type LadderStage } from '../kit/energyLadderData'
import { H2O_EVENTS, H2O_STEPS } from './h2oSteps'

const r1 = (v: number) => Math.round(v * 10) / 10

const DHF = {
  h: dHfKJ('H(g)'),
  o: dHfKJ('O(g)'),
  oh: dHfKJ('OH(g)'),
  gas: dHfKJ('H2O(g)'),
  liquid: dHfKJ('H2O(l)'),
} as const

/**
 * Лестница на 1 моль H₂O (ПАРА): H₂ + ½ O₂ → H₂O (г.) — расчётный путь через атомы.
 * Время ступени — момент сюжета, когда связь ЭТОГО типа впервые рвётся или образуется в цепи:
 * H–H — инициирование, O=O и первая O–H — разветвление, H–OH — продолжение цепи.
 */
const STAGES: readonly LadderStage[] = [
  {
    id: 'dissocHH',
    kind: 'dissociation',
    dH: r1(2 * DHF.h),
    at: H2O_EVENTS.init,
    equation: 'H₂ → 2 H',
    multiplier: 2,
    perUnitKJ: DHF.h,
  },
  { id: 'dissocOO', kind: 'dissociation', dH: DHF.o, at: H2O_EVENTS.branchH, equation: '½ O₂ → O' },
  { id: 'bond1', kind: 'bond', dH: r1(DHF.oh - DHF.h - DHF.o), at: H2O_EVENTS.branchO, equation: 'H + O → ·OH' },
  { id: 'bond2', kind: 'bond', dH: r1(DHF.gas - DHF.h - DHF.oh), at: H2O_EVENTS.propA, equation: 'H + ·OH → H₂O' },
]

export const H2O_LADDER: Ladder = {
  cycleId: 'h2o',
  formula: 'H₂O',
  equation: 'H₂ (г.) + ½ O₂ (г.) → H₂O (г.)',
  stages: STAGES,
  sumKJ: r1(STAGES.reduce((s, x) => s + x.dH, 0)),
  tableKJ: DHF.gas,
}

/** Ступень лестницы по id. */
export function h2oStageKJ(id: 'dissocHH' | 'dissocOO' | 'bond1' | 'bond2'): number {
  const s = H2O_LADDER.stages.find((x) => x.id === id)
  if (!s) throw new Error(`h2o: нет ступени ${id}`)
  return s.dH
}

// ─────────────────────────────────────────────────────────────────────────────
// Реальный путь: разветвлённая цепь (ядро: REACTION_STEP_CHAINS.h2_o2)
// ─────────────────────────────────────────────────────────────────────────────

const CHAIN_IDS = REACTION_STEP_CHAINS.h2_o2
/** ΔH стадий цепи, кДж на уравнение стадии: инициирование, разветвления, продолжение. */
export const H2O_CHAIN_KJ = {
  initiation: formationReactionKJ(CHAIN_IDS[0]),
  branchH: formationReactionKJ(CHAIN_IDS[1]),
  branchO: formationReactionKJ(CHAIN_IDS[2]),
  propagation: formationReactionKJ(CHAIN_IDS[3]),
} as const

/**
 * Одно звено разветвлённой цепи: H· + O₂ + 3 H₂ → 2 H₂O + 3 H· (branchH + branchO + 2·продолжение).
 * Из одного радикала — три: отсюда лавина и взрыв.
 */
export const H2O_CHAIN_LINK_KJ = r1(H2O_CHAIN_KJ.branchH + H2O_CHAIN_KJ.branchO + 2 * H2O_CHAIN_KJ.propagation)

/**
 * Что показано в кадре шагов 2–4: 4 H₂ + O₂ → 2 H₂O + 4 H· (инициирование + звено). Чтобы вернуться
 * к уравнению 2 H₂ + O₂ → 2 H₂O, четыре радикала должны рекомбинировать: 4 H· → 2 H₂ (обрыв цепи,
 * −2 × ΔH инициирования). Итог по закону Гесса обязан совпасть с 2·ΔH°f(H₂O, г.).
 */
export const H2O_CHAIN_HESS_KJ = r1(H2O_CHAIN_KJ.initiation + H2O_CHAIN_LINK_KJ - 2 * H2O_CHAIN_KJ.initiation)

// ─────────────────────────────────────────────────────────────────────────────
// Итоги для текстов и 3D-подписей
// ─────────────────────────────────────────────────────────────────────────────

const BURN = reactionEnthalpyBothKJ('water_g_2mol')

export const H2O_THERMO = {
  /** ΔH°f воды-ПАРА, кДж/моль */
  gasKJ: DHF.gas,
  /** ΔH°f воды-ЖИДКОСТИ, кДж/моль */
  liquidKJ: DHF.liquid,
  /** теплота конденсации пара при 25 °C, кДж/моль (< 0) */
  condensationKJ: r1(DHF.liquid - DHF.gas),
  /** 2 H₂ + O₂ → 2 H₂O (г.), кДж на уравнение — контрольная реакция ядра */
  reaction2molKJ: formationReactionKJ('h2o_formation_g'),
  /** то же по СРЕДНИМ энергиям связей (школьный расчёт) и расхождение с ΔH°f */
  fromBondsKJ: BURN.fromBonds,
  bondsDeltaKJ: r1(Math.abs(BURN.fromFormation - BURN.fromBonds)),
  /** табличные энергии связей (средние), кДж/моль */
  bond: { hh: bondEnthalpyKJ('H-H'), oo: bondEnthalpyKJ('O=O'), oh: bondEnthalpyKJ('O-H') },
  /** D(O=O) по ΔH°f: 2·ΔH°f(O, г.) */
  ooFromFormation: r1(2 * DHF.o),
  /** расхождение табличной E(H–H) и 2·ΔH°f(H, г.) — две компиляции */
  hhSpreadKJ: r1(Math.abs(2 * DHF.h - bondEnthalpyKJ('H-H'))),
  dHf: DHF,
} as const

/** Шаг урока, на котором панель показывает лестницу целиком. */
export const H2O_ENERGY_STEP_INDEX = H2O_STEPS.findIndex((s) => s.id === 'energy')

/**
 * Элементарные стадии, показанные в кадре, в машинном виде — для теста баланса по атомам,
 * заряду (все частицы нейтральны) и числу неспаренных электронов (u).
 */
export const H2O_ELEMENTARY = [
  { id: 'init', left: [{ f: 'H2', n: 1, u: 0 }], right: [{ f: 'H', n: 2, u: 1 }] },
  { id: 'branchH', left: [{ f: 'H', n: 1, u: 1 }, { f: 'O2', n: 1, u: 2 }], right: [{ f: 'OH', n: 1, u: 1 }, { f: 'O', n: 1, u: 2 }] },
  { id: 'branchO', left: [{ f: 'O', n: 1, u: 2 }, { f: 'H2', n: 1, u: 0 }], right: [{ f: 'OH', n: 1, u: 1 }, { f: 'H', n: 1, u: 1 }] },
  { id: 'propA', left: [{ f: 'OH', n: 1, u: 1 }, { f: 'H2', n: 1, u: 0 }], right: [{ f: 'H2O', n: 1, u: 0 }, { f: 'H', n: 1, u: 1 }] },
  { id: 'propB', left: [{ f: 'OH', n: 1, u: 1 }, { f: 'H2', n: 1, u: 0 }], right: [{ f: 'H2O', n: 1, u: 0 }, { f: 'H', n: 1, u: 1 }] },
] as const

/** Суммарное уравнение — для теста стехиометрии. */
export const H2O_REACTION = {
  left: [
    { formula: 'H2', coeff: 2 },
    { formula: 'O2', coeff: 1 },
  ],
  right: [{ formula: 'H2O', coeff: 2 }],
} as const

/** Проверка в dev и в тесте сцены. */
export function validateH2oEnergetics(): void {
  for (const s of H2O_LADDER.stages) {
    if (s.kind === 'dissociation' && !(s.dH > 0)) throw new Error(`h2o: ступень «${s.id}» — разрыв, ΔH обязан быть > 0`)
    if (s.kind === 'bond' && !(s.dH < 0)) throw new Error(`h2o: ступень «${s.id}» — образование связи, ΔH обязан быть < 0`)
    const m = s.multiplier ?? 1
    if (s.perUnitKJ != null && Math.abs(m * s.perUnitKJ - s.dH) > 0.05) throw new Error(`h2o: ступень ${s.id}: ${m} × ${s.perUnitKJ} ≠ ${s.dH}`)
  }
  // Путь через атомы собран из ΔH°f ядра — сумма обязана совпасть с табличной ТОЧНО (±0,05).
  assertLadderMatchesFormation(H2O_LADDER, 0.05)
  // Ступени образования связей = последовательные энергии разрыва ядра со знаком минус.
  if (Math.abs(h2oStageKJ('bond1') + WATER_SEQUENTIAL_BDE_KJ.second) > 0.05) throw new Error('h2o: H + O → ·OH ≠ −D(O–H в ·OH)')
  if (Math.abs(h2oStageKJ('bond2') + WATER_SEQUENTIAL_BDE_KJ.first) > 0.05) throw new Error('h2o: H + ·OH → H₂O ≠ −D(H–OH)')
  if (!(WATER_SEQUENTIAL_BDE_KJ.first > WATER_SEQUENTIAL_BDE_KJ.second)) throw new Error('h2o: первая связь H–OH обязана быть прочнее второй')
  // Реальный путь (цепь) по закону Гесса даёт тот же итог.
  if (Math.abs(H2O_CHAIN_HESS_KJ - H2O_THERMO.reaction2molKJ) > 0.05) {
    throw new Error(`h2o: цепь по Гессу ${H2O_CHAIN_HESS_KJ} ≠ ${H2O_THERMO.reaction2molKJ}`)
  }
  if (Math.abs(2 * H2O_LADDER.sumKJ - H2O_THERMO.reaction2molKJ) > 0.05) throw new Error('h2o: 2 × ΔH°f ≠ ΔH уравнения')
  // Знаки стадий цепи: разветвления эндотермичны (гремучий газ устойчив без поджига), продолжение экзо.
  if (!(H2O_CHAIN_KJ.initiation > 0 && H2O_CHAIN_KJ.branchH > 0 && H2O_CHAIN_KJ.branchO > 0 && H2O_CHAIN_KJ.propagation < 0)) {
    throw new Error('h2o: знаки стадий цепи')
  }
  if (!(H2O_CHAIN_LINK_KJ < 0)) throw new Error('h2o: звено цепи обязано быть экзотермическим')
  if (!(H2O_THERMO.liquidKJ < H2O_THERMO.gasKJ)) throw new Error('h2o: жидкая вода обязана быть ниже пара')
  // Баланс элементарных стадий: атомы и неспаренные электроны.
  for (const st of H2O_ELEMENTARY) {
    const atoms = (side: readonly { f: string; n: number }[]) => {
      const m = new Map<string, number>()
      for (const x of side) for (const g of x.f.matchAll(/([A-Z][a-z]?)(\d*)/g)) m.set(g[1]!, (m.get(g[1]!) ?? 0) + (g[2] ? Number(g[2]) : 1) * x.n)
      return [...m.entries()].sort().join(';')
    }
    if (atoms(st.left) !== atoms(st.right)) throw new Error(`h2o: стадия ${st.id} не сбалансирована по атомам`)
  }
}
