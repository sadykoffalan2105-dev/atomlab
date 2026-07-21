import type { SynthesisContinuityView } from './synthesisAntiBlink'

export type VisualCoverageInput = {
  continuity: SynthesisContinuityView
  mergeFx: boolean
  convergeFx: boolean
  /** micro-scale GPU prewarm during coeff edit — not visible coverage */
  editMode: boolean
}

/**
 * Unified coverage: center never empty.
 * micro-prewarm NEVER counts (invisible mesh at scale 0.001) — even outside edit.
 * merge/converge НЕ считаются «покрытыми» сами по себе — иначе пустой кадр без restore.
 */
export function isVisualCoverageOk(input: VisualCoverageInput): boolean {
  const { continuity, mergeFx, convergeFx, editMode } = input
  const { reactorPreviewVisible, reactorPreviewMounted, productSlotVisible, productPrewarm } =
    continuity

  if (reactorPreviewVisible && reactorPreviewMounted) return true
  // Full-scale product only — prewarm is not coverage (caused empty center + false handoff).
  if (productSlotVisible && !productPrewarm) return true
  void editMode
  // merge/converge: только если уже есть Bohr или слот — иначе coverage violation → restore
  if ((mergeFx || convergeFx) && reactorPreviewMounted && reactorPreviewVisible) return true
  if ((mergeFx || convergeFx) && productSlotVisible && !productPrewarm) return true
  return false
}

export function createVisualCoverageController() {
  let violationFrames = 0
  return {
    reset() {
      violationFrames = 0
    },
    tick(input: VisualCoverageInput, onViolation: () => void): void {
      if (isVisualCoverageOk(input)) {
        violationFrames = 0
        return
      }
      violationFrames += 1
      if (violationFrames <= 12) onViolation()
    },
  }
}

/** @deprecated use isVisualCoverageOk — wraps legacy API */
export function synthesisContinuityCoveredV2(
  view: SynthesisContinuityView,
  mergeFx: boolean,
  convergeFx: boolean,
  editMode = false,
): boolean {
  return isVisualCoverageOk({ continuity: view, mergeFx, convergeFx, editMode })
}
