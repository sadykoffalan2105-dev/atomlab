/**
 * Cinematic timeline for methane combustion:
 * CH₄ + 2O₂ → CO₂ + 2H₂O (экзотермическая реакция горения)
 */
export const CH4_SCENARIO = {
  /** Phase 1 — Entry: реагенты влетают, броуновское микро-колебание */
  stage1End: 2.0,
  /** Phase 2 — Approach: сближение, slow-motion, связи натягиваются */
  stage2End: 3.5,
  /** Phase 3 — Ignition: разрыв связей, искра, огненная вспышка, образование продуктов */
  stage3End: 5.0,
  /** Phase 4 — Release: разлёт продуктов с тепловым импульсом и огненным следом */
  stage4End: 6.5,
  /** Финал: чистые CO₂ + 2H₂O, подпись */
  finaleEnd: 8.0,

  /** VSEPR: CH₄ — тетраэдр 109.5° */
  chBondLen: 0.42,
  /** O=O в молекуле кислорода */
  ooBondLen: 0.48,
  /** C=O в CO₂ — линейная молекула, 180° */
  coBondLen: 0.46,
  /** H–O–H в воде — угол 104.5° */
  h2oAngleDeg: 104.5,
  ohBondLen: 0.38,
} as const

export type Ch4Stage = 1 | 2 | 3 | 4 | 5

export function ch4StageAt(t: number): Ch4Stage {
  if (t < CH4_SCENARIO.stage1End) return 1
  if (t < CH4_SCENARIO.stage2End) return 2
  if (t < CH4_SCENARIO.stage3End) return 3
  if (t < CH4_SCENARIO.stage4End) return 4
  return 5
}

/** Единичные тетраэдрические направления (нормированные), угол между любыми двумя ≈109.47°. */
export const TETRAHEDRAL_DIRS = [
  [1, 1, 1],
  [1, -1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
] as const

export function scientificSynthesisWatchdogMsCh4(): number {
  return Math.ceil(CH4_SCENARIO.finaleEnd * 1000 + 4000)
}
