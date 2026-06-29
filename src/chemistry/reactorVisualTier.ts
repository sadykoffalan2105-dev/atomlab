import {
  expandLeftTermsToPreviewSlots,
  expandLeftTermsToZSlots,
  type ReactorEquationTerm,
} from './reactorEquationBalance'
import { REACTOR_VISUAL_FULL_ATOMS, REACTOR_VISUAL_LITE_ATOMS } from './reactorLimits'

export type ReactorVisualTier = 'full' | 'lite' | 'cluster'

export function getReactorVisualTier(terms: readonly ReactorEquationTerm[]): ReactorVisualTier {
  const previewCount = expandLeftTermsToPreviewSlots(terms).length
  const flyCount = expandLeftTermsToZSlots(terms).length
  const n = Math.max(previewCount, flyCount)
  if (n > REACTOR_VISUAL_LITE_ATOMS) return 'cluster'
  if (n > REACTOR_VISUAL_FULL_ATOMS) return 'lite'
  return 'full'
}

/** Сколько 3D-моделей показывать — всегда равно коэффициенту (tier только для таймингов/perf). */
export function previewModelsForTerm(coeff: number, _tier: ReactorVisualTier, _termCount: number): number {
  return Math.max(0, Math.floor(coeff))
}

/** Coeff for ×N badge when shown models < actual coeff. */
export function termBadgeCoeff(coeff: number, tier: ReactorVisualTier, termCount: number): number | null {
  const c = Math.max(0, Math.floor(coeff))
  const shown = previewModelsForTerm(c, tier, termCount)
  if (c <= 1 || shown >= c) return null
  return c
}

export function synthesisTimingScale(tier: ReactorVisualTier): number {
  if (tier === 'cluster') return 0.55
  if (tier === 'lite') return 0.78
  return 1
}
