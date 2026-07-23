import type { SynthesisDeviceTier } from './synthesisDeviceTier'

/**
 * Профили таймингов синтеза.
 * balanced — плавная анимация ~1.1 с на обычных ПК.
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
  collapseAtoms: boolean
}

/** Мгновенный — без полёта атомов и вспышек: сразу молекула (лаборатория по умолчанию). */
export const SYNTHESIS_TIMING_INSTANT: SynthesisTimingProfile = {
  streamFlyDur: 0,
  termStagger: 0,
  atomStagger: 0,
  mergeFlashDur: 0,
  productEntranceDur: 0,
  productHold: 0,
  productRevealOverlapSec: 0,
  igniteSkipMs: 0,
  atomCollapseDur: 0,
  previewOverlapMs: 0,
  clusterFlyDur: 0,
  clusterTermStagger: 0,
  collapseAtoms: false,
}

export function isInstantSynthesisProfile(profile: SynthesisTimingProfile): boolean {
  return profile.streamFlyDur <= 0 && profile.mergeFlashDur <= 0
}

/** Минимальный — слабые устройства / просадка FPS. */
export const SYNTHESIS_TIMING_FAST: SynthesisTimingProfile = {
  streamFlyDur: 0.36,
  termStagger: 0.02,
  atomStagger: 0.006,
  mergeFlashDur: 0.16,
  productEntranceDur: 0.2,
  productHold: 0.06,
  productRevealOverlapSec: 0.08,
  igniteSkipMs: 180,
  atomCollapseDur: 0,
  previewOverlapMs: 300,
  clusterFlyDur: 0.22,
  clusterTermStagger: 0.05,
  collapseAtoms: false,
}

/** Баланс: читаемый полёт + вспышка + рождение молекулы. */
export const SYNTHESIS_TIMING_BALANCED: SynthesisTimingProfile = {
  streamFlyDur: 0.62,
  termStagger: 0.048,
  atomStagger: 0.012,
  mergeFlashDur: 0.32,
  productEntranceDur: 0.38,
  productHold: 0.1,
  productRevealOverlapSec: 0.14,
  igniteSkipMs: 320,
  atomCollapseDur: 0.14,
  previewOverlapMs: 420,
  clusterFlyDur: 0.3,
  clusterTermStagger: 0.06,
  collapseAtoms: false,
}

/** Длинный cinematic — только мощные ПК без lite. */
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
  collapseAtoms: true,
}

/**
 * Тайминг по устройству (forceLite ≠ «без анимации» — только короче FX):
 * - low → FAST
 * - normal → BALANCED (полёт + лучи + вспышка)
 */
export function getSynthesisTimingProfile(
  _forceLite: boolean,
  deviceTier: SynthesisDeviceTier = 'normal',
): SynthesisTimingProfile {
  if (deviceTier === 'low') return SYNTHESIS_TIMING_FAST
  return SYNTHESIS_TIMING_BALANCED
}
