/** Единый слой защиты лаборатории: canvas, синтез, производительность. */

export { ensureCanvasMinSize, useCanvasSizeGuard } from './canvasGuard'
export { SynthesisRunController, useSynthesisRunController } from './synthesisRunController'
export { useThrottledPhaseCallback } from './phaseThrottle'
export { createSynthesisRunGuard, createFpsGovernor } from './synthesisRunGuard'
export type { SynthesisRunGuard, FpsGovernorState } from './synthesisRunGuard'
export { assertNoProductHeroBeforeRun } from './labPreviewGuard'
