import type { MutableRefObject } from 'react'
import type * as THREE from 'three'
import { assertReactorPreviewZeroGap } from './reactorPreviewZeroGap'
import { assertPreviewCoverage } from './atomlabSynthesisGuard'

export type ReactorPreviewContinuityGuard = {
  reset: () => void
  tick: (opts: {
    reactorViewOpen: boolean
    synthLive: boolean
    previewMounted: boolean
    previewVisible: boolean
    previewAtomCount: number
    productPrewarm: boolean
    productPainted?: boolean
    previewRootRef?: MutableRefObject<THREE.Group | null>
    invalidate: () => void
  }) => void
}

function restorePreviewRoot(root: THREE.Group): void {
  root.visible = true
  root.traverse((obj) => {
    obj.visible = true
  })
}

/** Инвариант: при edit с атомами превью не должно пропадать без синтеза. */
export function createReactorPreviewContinuityGuard(): ReactorPreviewContinuityGuard {
  let violationFrames = 0

  return {
    reset() {
      violationFrames = 0
    },
    tick({
      reactorViewOpen,
      synthLive,
      previewMounted,
      previewVisible,
      previewAtomCount,
      productPrewarm,
      productPainted = false,
      previewRootRef,
      invalidate,
    }) {
      assertReactorPreviewZeroGap({
        reactorViewOpen,
        synthLive,
        previewAtomCount,
        previewMounted,
        previewVisible,
        productPrewarm,
      })

      if (!reactorViewOpen || previewAtomCount <= 0) {
        violationFrames = 0
        return
      }

      const root = previewRootRef?.current
      const rootVisible = root ? root.visible : previewVisible
      const coverage = assertPreviewCoverage({
        termsNonempty: previewAtomCount > 0,
        previewMounted,
        rootVisible,
        productPainted,
        synthLive,
      })

      const ok =
        coverage === 'ok' ||
        (previewMounted && (previewVisible || previewAtomCount > 0) && rootVisible)

      if (ok) {
        violationFrames = 0
        return
      }

      violationFrames += 1
      if (root) {
        restorePreviewRoot(root)
      }
      if (violationFrames <= 96) {
        invalidate()
      }
    },
  }
}
