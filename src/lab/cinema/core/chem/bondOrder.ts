/**
 * ATOMLAB Cinema — электроотрицательность, полярность и порядки связей урока.
 *
 * Полярность пишется в BondPool.polarity (−1 плотность к A, +1 к B), порядок — в BondPool.order.
 */

/** Электроотрицательность по Полингу. */
export const electronegativity = {
  H: 2.2,
  C: 2.55,
  N: 3.04,
  O: 3.44,
  Na: 0.93,
  S: 2.58,
  Cl: 3.16,
} as const

export type ChiElement = keyof typeof electronegativity

function chiOf(x: ChiElement | number): number {
  return typeof x === 'number' ? x : electronegativity[x]
}

/**
 * Полярность связи A–B в −1..1: tanh(scale·(χ_B − χ_A)).
 * Знак — к более электроотрицательному атому (+ к B, − к A), как в BondPool.polarity.
 * При scale = 1: Cl–O ≈ 0.27, O–H ≈ 0.85, Na–Cl ≈ 0.98 (почти ионная).
 * Это визуальная шкала смещения плотности, а не доля ионности по Полингу.
 */
export function bondPolarity(a: ChiElement | number, b: ChiElement | number, scale = 1): number {
  return Math.tanh(scale * (chiOf(b) - chiOf(a)))
}

/**
 * Порядки связей для урока ClO₂ — ШКОЛЬНАЯ модель (резонансные структуры и счёт электронов),
 * согласованная по знаку с моделью Хюккеля из orbitals.ts, но не выведенная из неё численно.
 */
export const LESSON_BOND_ORDERS = {
  /** Cl₂: одинарная σ-связь. */
  chlorine: { ClCl: 1 },
  /**
   * Хлорит ClO₂⁻: среднее двух резонансных структур O=Cl–O⁻ ↔ ⁻O–Cl=O → 1.5 на каждую Cl–O.
   */
  chlorite: { ClO: 1.5 },
  /**
   * Интермедиат ClOClO (Cl_X–O–Cl_A=O): Cl_X–O одинарная, мостик O–Cl_A одинарный,
   * концевая Cl_A=O двойная.
   */
  ClOClO: { ClX_O: 1, O_ClA: 1, ClA_O: 2 },
  /** Аддукт [ClOCl(O)OClO]⁻: новая мостиковая связь — одинарная (донорно-акцепторная). */
  adduct: { bridge: 1 },
  /**
   * Радикал ClO₂: 1.5 (как у хлорита) + 0.25 на связь — ушёл электрон с разрыхляющей
   * π*-орбитали 2b1 (порядок всей π-системы +0.5, делится на две Cl–O) → 1.75.
   * Отсюда короче связь (1.57 → 1.47 Å) и шире угол (110.5° → 117.4°).
   */
  radical: { ClO: 1.75 },
} as const

/** Прибавка к каждой Cl–O при ClO₂⁻ → ClO₂ в школьной модели. */
export const LESSON_SOMO_REMOVAL_DELTA = LESSON_BOND_ORDERS.radical.ClO - LESSON_BOND_ORDERS.chlorite.ClO
