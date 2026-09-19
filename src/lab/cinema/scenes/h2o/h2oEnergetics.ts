/**
 * Энергетика урока «вода»: лестница по ЭНЕРГИЯМ СВЯЗЕЙ (закон Гесса).
 *
 * У NaCl лестница — цикл Борна — Габера (ионная связь, есть решётка).
 * У воды связь КОВАЛЕНТНАЯ и решётки нет, поэтому ступени другие:
 * сначала платим за разрыв связей в простых веществах (вверх),
 * потом получаем выигрыш при образовании связей O–H (вниз).
 *
 * Ни одного числа руками: энергии связей — BOND_DATA, теплоты образования —
 * FORMATION_ENTHALPY (src/chemistry/data/thermoData.ts). Сумма ступеней обязана
 * сойтись с табличной ΔH°f — это проверяет assertLadderMatchesFormation().
 */
import { bondEnthalpyKJ, dHfKJ, reactionEnthalpyBothKJ } from '../../../../chemistry/data'
import { assertLadderMatchesFormation, type Ladder, type LadderStage } from '../kit/energyLadderData'

/** Энергии связей, кДж/моль (> 0 — на разрыв). */
const E_HH = bondEnthalpyKJ('H-H')
const E_OO = bondEnthalpyKJ('O=O')
const E_OH = bondEnthalpyKJ('O-H')

/**
 * Лестница на 1 моль H₂O (ПАРА): H₂ + ½ O₂ → H₂O (г.).
 * Показываем именно газ, потому что энергии связей относятся к газовой молекуле;
 * теплота конденсации до жидкости добавляется отдельно (см. H2O_THERMO).
 */
const STAGES: readonly LadderStage[] = [
  { id: 'dissocHH', kind: 'dissociation', dH: E_HH, at: 6.4, equation: 'H₂ → 2 H' },
  { id: 'dissocOO', kind: 'dissociation', dH: E_OO / 2, at: 7.2, equation: '½ O₂ → O' },
  { id: 'bond1', kind: 'bond', dH: -E_OH, at: 11.2, equation: 'H + O → HO' },
  { id: 'bond2', kind: 'bond', dH: -E_OH, at: 11.8, equation: 'H + HO → H₂O' },
]

export const H2O_LADDER: Ladder = {
  cycleId: 'h2o',
  formula: 'H₂O',
  equation: 'H₂ (г.) + ½ O₂ (г.) → H₂O (г.)',
  stages: STAGES,
  sumKJ: Math.round(STAGES.reduce((s, x) => s + x.dH, 0) * 10) / 10,
  tableKJ: dHfKJ('H2O(g)'),
}

/** Числа, которые показывают подписи в 3D и панель урока. */
export const H2O_THERMO = {
  /** ΔH°f воды-ПАРА, кДж/моль */
  gasKJ: dHfKJ('H2O(g)'),
  /** ΔH°f воды-ЖИДКОСТИ, кДж/моль (сюда входит ещё и теплота конденсации) */
  liquidKJ: dHfKJ('H2O(l)'),
  /** теплота конденсации пара в жидкость при 25 °C, кДж/моль (< 0) */
  condensationKJ: Math.round((dHfKJ('H2O(l)') - dHfKJ('H2O(g)')) * 10) / 10,
  /** что тратим на разрыв связей 2 H₂ + O₂, кДж (> 0) */
  breakKJ: 2 * E_HH + E_OO,
  /** что получаем при образовании 4 связей O–H, кДж (< 0) */
  formKJ: -4 * E_OH,
  /** итог горения 2 H₂ + O₂ → 2 H₂O (г.) по связям и по ΔH°f */
  burn2mol: reactionEnthalpyBothKJ('water_g_2mol'),
  bond: { hh: E_HH, oo: E_OO, oh: E_OH },
} as const

/** Проверка в dev и в тесте сцены: лестница обязана сойтись с таблицей. */
export function validateH2oEnergetics(): void {
  // Разрыв связей — затраты, образование — выигрыш. Знак перепутать нельзя.
  for (const s of H2O_LADDER.stages) {
    if (s.kind === 'dissociation' && !(s.dH > 0)) {
      throw new Error(`h2o: ступень «${s.id}» — разрыв связи, ΔH обязан быть > 0`)
    }
    if (s.kind === 'bond' && !(s.dH < 0)) {
      throw new Error(`h2o: ступень «${s.id}» — образование связи, ΔH обязан быть < 0`)
    }
  }
  // Сумма ступеней ↔ табличная ΔH°f(H₂O, г.) = −241.8 кДж/моль.
  assertLadderMatchesFormation(H2O_LADDER, 2)

  // Вода-жидкость должна быть энергетически НИЖЕ пара (конденсация экзотермична).
  if (!(H2O_THERMO.liquidKJ < H2O_THERMO.gasKJ)) {
    throw new Error('h2o: ΔH°f жидкой воды обязана быть меньше, чем у пара')
  }
  // Итог на 2 моля = удвоенная ступенчатая сумма.
  const twice = Math.round(H2O_LADDER.sumKJ * 2 * 10) / 10
  if (Math.abs(twice - H2O_THERMO.burn2mol.fromBonds) > 0.5) {
    throw new Error(`h2o: 2 × ${H2O_LADDER.sumKJ} ≠ ${H2O_THERMO.burn2mol.fromBonds} кДж`)
  }
}
