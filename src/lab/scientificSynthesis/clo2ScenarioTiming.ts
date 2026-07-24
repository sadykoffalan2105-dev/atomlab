/**
 * Сценарий микромира: 2NaClO₂ + Cl₂ → 2NaCl + 2ClO₂
 * Тайминги — точь-в-точь по режиссёрскому сценарию.
 */
export const CLO2_SCENARIO = {
  /** ЭТАП 1. Исходное состояние */
  stage1End: 2.0,
  /** ЭТАП 2. Сближение и подготовка */
  stage2End: 3.5,
  /** ЭТАП 3. Перестройка связей (главный момент) */
  stage3End: 5.0,
  /** ЭТАП 4. Разлёт продуктов */
  stage4End: 6.5,
  /** Финал: чистый ClO₂ в центре + подпись */
  finaleEnd: 7.4,
  /** Угол O–Cl–O (°) */
  clo2AngleDeg: 117.4,
  /** Длина связи Cl–O (условные единицы сцены) */
  clo2BondLen: 0.56,
  /** Длина Cl–Cl в Cl₂ */
  cl2BondLen: 0.72,
} as const

export type Clo2Stage = 1 | 2 | 3 | 4 | 5

export function clo2StageAt(t: number): Clo2Stage {
  if (t < CLO2_SCENARIO.stage1End) return 1
  if (t < CLO2_SCENARIO.stage2End) return 2
  if (t < CLO2_SCENARIO.stage3End) return 3
  if (t < CLO2_SCENARIO.stage4End) return 4
  return 5
}

/** Медленный ход на этапах 2–3 (активация / перестройка). */
export function clo2TimeScale(t: number): number {
  if (t >= CLO2_SCENARIO.stage1End && t < CLO2_SCENARIO.stage3End) return 0.72
  return 1
}

export function scientificSynthesisWatchdogMs(productId: string): number | null {
  if (productId === 'clo2') {
    return Math.ceil(CLO2_SCENARIO.finaleEnd * 1000 + 3200)
  }
  return null
}
