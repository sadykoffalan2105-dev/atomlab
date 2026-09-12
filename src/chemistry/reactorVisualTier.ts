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

/**
 * Сколько Bohr-моделей на слагаемое.
 * full: все атомы (tier уже ≤24).
 * lite/cluster: кап + badge ×N — иначе dichromate/большие coeff валят WebGL.
 */
export function previewModelsForTerm(coeff: number, tier: ReactorVisualTier, termCount: number): number {
  const c = Math.max(0, Math.floor(coeff))
  if (c <= 0) return 0
  if (tier === 'cluster') return 1
  if (tier === 'lite') {
    const perTerm = Math.max(1, Math.min(4, Math.floor(12 / Math.max(1, termCount))))
    return Math.min(c, perTerm)
  }
  return c
}

/**
 * Сколько атомов реально появится в превью для заданного tier — в отличие от
 * наивной суммы коэффициентов, здесь учтён per-term cap lite/cluster tier'ов.
 * Используется в hold-логике при +/-: если ждать наивную сумму, а tier её
 * никогда не построит (cap меньше), hold завис бы навсегда и достраивал
 * кадр фантомными клонами последнего атома.
 */
export function previewAtomCountForTier(
  terms: readonly ReactorEquationTerm[],
  tier: ReactorVisualTier,
): number {
  const activeTerms = terms.filter((t) => Math.floor(t.coeff) > 0)
  return activeTerms.reduce(
    (sum, t) => sum + previewModelsForTerm(t.coeff, tier, activeTerms.length),
    0,
  )
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
