/**
 * ReactorPreviewMotionEngine — 3D-анимация Bohr в реакторе.
 *
 * Цели:
 * - Плавный spin + drift без борьбы с pin scale/visible
 * - На плотных уравнениях (K₂Cr₂O₇) — меньше амплитуда, меньше GPU
 * - Зеркало native/atomlab_core reactor_preview_motion (C++)
 */

export const PREVIEW_MOTION = {
  /** С этого числа слотов — lite-амплитуда и медленный spin. */
  denseFromSlots: 10,
  /** Сверхплотно (дихромат 22) — ещё тише. */
  ultraDenseFromSlots: 18,
  spinSlow: 0.032,
  spinNormal: 0.045,
  driftAmpNormal: 0.032,
  driftAmpDense: 0.018,
  driftAmpUltra: 0.012,
} as const

export type PreviewMotionSample = {
  spinY: number
  /** dx, dy, dz относительно layout-позиции. */
  drift: readonly [number, number, number]
}

/** Политика анимации для N слотов. */
export function resolvePreviewMotionPolicy(slotCount: number): {
  dense: boolean
  ultraDense: boolean
  spinRate: number
  driftAmp: number
  /** Lite-материалы обязательны (анти white-screen). */
  forceLiteMaterials: boolean
} {
  const n = Math.max(0, Math.floor(slotCount))
  const dense = n >= PREVIEW_MOTION.denseFromSlots
  const ultraDense = n >= PREVIEW_MOTION.ultraDenseFromSlots
  return {
    dense,
    ultraDense,
    spinRate: dense ? PREVIEW_MOTION.spinSlow : PREVIEW_MOTION.spinNormal,
    driftAmp: ultraDense
      ? PREVIEW_MOTION.driftAmpUltra
      : dense
        ? PREVIEW_MOTION.driftAmpDense
        : PREVIEW_MOTION.driftAmpNormal,
    forceLiteMaterials: dense,
  }
}

/**
 * Один кадр motion (совпадает с C++ reactor_preview_motion_sample).
 * Не трогает scale/visible — только поза.
 */
export function samplePreviewAtomMotion(opts: {
  elapsedSec: number
  slotIndex: number
  atomicZ: number
  driftAmp: number
}): PreviewMotionSample['drift'] {
  const { elapsedSec: t, slotIndex: i, atomicZ: z, driftAmp: amp } = opts
  const ph = i * 1.6 + z * 0.37
  return [
    Math.sin(t * 0.32 + ph) * amp,
    Math.sin(t * 0.25 + ph * 0.9) * amp * 0.7,
    Math.cos(t * 0.28 + ph * 1.05) * amp,
  ]
}

export function samplePreviewRootSpin(elapsedSec: number, spinRate: number): number {
  return elapsedSec * spinRate
}
