import type { MutableRefObject } from 'react'
import type * as THREE from 'three'
import { assertReactorPreviewZeroGap } from './reactorPreviewZeroGap'

export type ReactorPreviewContinuityGuard = {
  reset: () => void
  tick: (opts: {
    reactorViewOpen: boolean
    synthLive: boolean
    previewMounted: boolean
    previewVisible: boolean
    previewAtomCount: number
    productPrewarm: boolean
    previewRootRef?: MutableRefObject<THREE.Group | null>
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
    tick({
      reactorViewOpen,
      synthLive,
      previewMounted,
      previewVisible,
      previewAtomCount,
      productPrewarm,
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
      const ok = previewMounted && previewVisible
      if (ok) {
        violationFrames = 0
        return
      }
      violationFrames += 1
      const root = previewRootRef?.current
      if (root) {
        root.visible = true
        root.traverse((obj) => {
          obj.visible = true
        })
      }
      if (violationFrames <= 48) {
        invalidate()
      }
    },
  }
}
