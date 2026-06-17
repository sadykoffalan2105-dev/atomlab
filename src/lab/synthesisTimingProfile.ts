/**
 * Профили таймингов синтеза: cinematic (по умолчанию) и fast (fallback при низком FPS / много атомов).
 */
export type SynthesisTimingProfile = {
  streamFlyDur: number
  termStagger: number
  atomStagger: number
  mergeFlashDur: number
  productEntranceDur: number
  productHold: number
  productRevealOverlapSec: number
  igniteSkipMs: number
  atomCollapseDur: number
  previewOverlapMs: number
  clusterFlyDur: number
  clusterTermStagger: number
}

/** Быстрый синтез — для lite / governor / плотных реакций. */
export const SYNTHESIS_TIMING_FAST: SynthesisTimingProfile = {
  streamFlyDur: 0.15,
  termStagger: 0.006,
  atomStagger: 0.0015,
  mergeFlashDur: 0.07,
  productEntranceDur: 0.09,
  productHold: 0.05,
  productRevealOverlapSec: 0.05,
  igniteSkipMs: 0,
  atomCollapseDur: 0.08,
  previewOverlapMs: 240,
  clusterFlyDur: 0.12,
  clusterTermStagger: 0.04,
}

/** Кинематографичный «cosmic birth»: схождение → вспышка → рождение молекулы (~2 с). */
export const SYNTHESIS_TIMING_CINEMATIC: SynthesisTimingProfile = {
  streamFlyDur: 0.78,
  termStagger: 0.062,
  atomStagger: 0.014,
  mergeFlashDur: 0.34,
  productEntranceDur: 0.62,
  productHold: 0.14,
  productRevealOverlapSec: 0.2,
  igniteSkipMs: 520,
  atomCollapseDur: 0.26,
  previewOverlapMs: 520,
  clusterFlyDur: 0.38,
  clusterTermStagger: 0.08,
}

export function getSynthesisTimingProfile(forceLite: boolean): SynthesisTimingProfile {
  return forceLite ? SYNTHESIS_TIMING_FAST : SYNTHESIS_TIMING_CINEMATIC
}
