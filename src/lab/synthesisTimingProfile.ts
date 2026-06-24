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
  productHold: 0.45,
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
  streamFlyDur: 0.22,
  termStagger: 0.012,
  atomStagger: 0.003,
  mergeFlashDur: 0.1,
  productEntranceDur: 0.14,
  productHold: 0.05,
  productRevealOverlapSec: 0.06,
  igniteSkipMs: 0,
  atomCollapseDur: 0,
  previewOverlapMs: 260,
  clusterFlyDur: 0.16,
  clusterTermStagger: 0.05,
  collapseAtoms: false,
}

/** Баланс: читаемый полёт + вспышка + рождение молекулы. */
export const SYNTHESIS_TIMING_BALANCED: SynthesisTimingProfile = {
  streamFlyDur: 0.52,
  termStagger: 0.04,
  atomStagger: 0.009,
  mergeFlashDur: 0.28,
  productEntranceDur: 0.32,
  productHold: 0.08,
  productRevealOverlapSec: 0.12,
  igniteSkipMs: 0,
  atomCollapseDur: 0.12,
  previewOverlapMs: 380,
  clusterFlyDur: 0.26,
  clusterTermStagger: 0.055,
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
 * Профиль таймингов синтеза.
 * Зависит ТОЛЬКО от device tier (кэшируется на сессию), поэтому объект
 * стабилен в течение всего прогона — никаких перезапусков анимации, если
 * FPS-губернатор переключает forceLite на лету (он влияет лишь на богатство
 * эффектов внутри SynthesisOnLabScene, а не на длительности).
 *
 * low / слабое устройство → FAST (короткая ~0.4 с, дешёвые эффекты)
 * normal / мощное         → BALANCED (читаемая анимация ~0.8–1.1 с)
 */
export function getSynthesisTimingProfile(
  _forceLite: boolean,
  deviceTier: SynthesisDeviceTier = 'normal',
): SynthesisTimingProfile {
  if (deviceTier === 'low') return SYNTHESIS_TIMING_FAST
  return SYNTHESIS_TIMING_BALANCED
}
