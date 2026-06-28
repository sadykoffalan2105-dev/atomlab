export type ReactorPreviewContinuityGuard = {
  reset: () => void
  tick: (opts: {
    reactorViewOpen: boolean
    synthLive: boolean
    previewMounted: boolean
    previewVisible: boolean
    previewAtomCount: number
    invalidate: () => void
  }) => void
}

/** Инвариант: при edit с атомами превью не должно пропадать без синтеза. */
export function createReactorPreviewContinuityGuard(): ReactorPreviewContinuityGuard {
  let violationFrames = 0

  return {
    reset() {
      violationFrames = 0
    },
    tick({ reactorViewOpen, synthLive, previewMounted, previewVisible, previewAtomCount, invalidate }) {
      if (!reactorViewOpen || synthLive || previewAtomCount <= 0) {
        violationFrames = 0
        return
      }
      const ok = previewMounted && previewVisible
      if (ok) {
        violationFrames = 0
        return
      }
      violationFrames += 1
      if (violationFrames <= 6) {
        invalidate()
      }
    },
  }
}
