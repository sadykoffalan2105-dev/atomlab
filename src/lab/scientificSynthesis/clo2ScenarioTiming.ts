/**
 * Cinematic timeline for ClO₂ synthesis:
 * 2NaClO₂ + Cl₂ → 2NaCl + 2ClO₂
 *
 * Story beats match the director brief; wall-clock stretches on Phase 3 (time dilation).
 */
export const CLO2_SCENARIO = {
  /** Phase 1 — Entry */
  stage1End: 2.5,
  /** Phase 2 — Activation */
  stage2End: 4.0,
  /** Phase 3 — Electron transfer / reconfiguration */
  stage3End: 5.5,
  /** Phase 4 — Release & separation */
  stage4End: 7.0,
  /** Finale — hero ClO₂ reveal */
  finaleEnd: 8.5,
  /** O–Cl–O angle в радикале ClO₂ (VSEPR / экспериментальное значение) */
  clo2AngleDeg: 117.4,
  /** O–Cl–O угол в ионе хлорита ClO₂⁻ до окисления — немного теснее */
  chloriteAngleDeg: 110.5,
  clo2BondLen: 0.56,
  cl2BondLen: 0.72,
  /** Порог внутри фазы 3 (0..1), когда начинается перенос электрона Cl→Na⁺ */
  transferStart: 0.42,
} as const

export type Clo2Stage = 1 | 2 | 3 | 4 | 5

export function clo2StageAt(t: number): Clo2Stage {
  if (t < CLO2_SCENARIO.stage1End) return 1
  if (t < CLO2_SCENARIO.stage2End) return 2
  if (t < CLO2_SCENARIO.stage3End) return 3
  if (t < CLO2_SCENARIO.stage4End) return 4
  return 5
}

/** Fallback timeScale if GSAP director is unavailable. */
export function clo2TimeScale(t: number): number {
  if (t >= CLO2_SCENARIO.stage2End && t < CLO2_SCENARIO.stage3End) return 0.55
  if (t >= CLO2_SCENARIO.stage1End && t < CLO2_SCENARIO.stage2End) return 0.85
  return 1
}

export function scientificSynthesisWatchdogMs(productId: string): number | null {
  if (productId === 'clo2') {
    return Math.ceil(CLO2_SCENARIO.finaleEnd * 1000 + 4000)
  }
  return null
}
