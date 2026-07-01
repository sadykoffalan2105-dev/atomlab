/** Единый слой защиты лаборатории: canvas, синтез, производительность. */

export { ensureCanvasMinSize, useCanvasSizeGuard } from './canvasGuard'
export { useThrottledPhaseCallback } from './phaseThrottle'
export { createSynthesisRunGuard, createFpsGovernor, createSynthesisQualityGovernor } from './synthesisRunGuard'
export type { SynthesisQualityGovernor, SynthesisQualityLevel, SynthesisQualityFeatures } from '../synthesisQualityLadder'
export {
  computeStaticQualityCap,
  featuresForQuality,
  qualityLevelToForceLite,
} from '../synthesisQualityLadder'
export type { SynthesisRunGuard } from './synthesisRunGuard'
export { assertNoProductHeroBeforeRun } from './labPreviewGuard'
