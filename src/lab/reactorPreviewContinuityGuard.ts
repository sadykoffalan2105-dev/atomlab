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
    /** @deprecated use productOwnsScreen — painted alone must not hide Bohr. */
    productPainted?: boolean
    /** Молекула full-scale на экране — единственный сигнал hide Bohr. */
    productOwnsScreen?: boolean
    previewRootRef?: MutableRefObject<THREE.Group | null>
    invalidate: () => void
  }) => void
}

function restorePreviewRoot(root: THREE.Group): void {
  // Только корень: pin/React владеют видимостью слотов. traverse(true) → ghost pool + hitch.
  root.visible = true
}

function hidePreviewRoot(root: THREE.Group): void {
  root.visible = false
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
      productOwnsScreen = false,
      previewRootRef,
      invalidate,
    }) {
      if (!reactorViewOpen || previewAtomCount <= 0) {
        violationFrames = 0
        return
      }

      const root = previewRootRef?.current
      // Painted без ownsScreen больше не скрывает Bohr (ложный handoff → пустой центр).
      const ownsScreen = productOwnsScreen === true

      /**
       * Hide Bohr ТОЛЬКО при явном productOwnsScreen (full-scale paint).
       * productPainted без ownsScreen больше не гасит корень — иначе пустой центр.
       */
      if (!synthLive) {
        if (ownsScreen && !previewVisible) {
          violationFrames = 0
          if (root && root.visible) hidePreviewRoot(root)
          return
        }
        if (root) restorePreviewRoot(root)
        violationFrames = 0
        if (previewMounted && previewVisible && root?.visible) return
        if (root) restorePreviewRoot(root)
        invalidate()
        return
      }

      // Синтез: продукт на экране — Bohr скрыт.
      if (!previewVisible && ownsScreen) {
        violationFrames = 0
        if (root && root.visible) hidePreviewRoot(root)
        return
      }

      // Продукт реально на экране (синтез) — Bohr не restore.
      if (ownsScreen && synthLive) {
        violationFrames = 0
        if (root && root.visible) hidePreviewRoot(root)
        return
      }

      assertReactorPreviewZeroGap({
        reactorViewOpen,
        synthLive,
        previewAtomCount,
        previewMounted,
        previewVisible,
        productPrewarm,
      })

      const rootVisible = root ? root.visible : previewVisible
      const coverage = assertPreviewCoverage({
        termsNonempty: previewAtomCount > 0,
        previewMounted,
        rootVisible,
        productPainted: ownsScreen || productPainted,
        synthLive,
      })

      const ok =
        coverage === 'ok' ||
        (previewMounted && previewVisible && rootVisible)

      if (ok) {
        violationFrames = 0
        return
      }

      // Не восстанавливаем shell, если LabScene намеренно скрыл превью (product takeover).
      if (!previewVisible && ownsScreen) {
        violationFrames = 0
        if (root && root.visible) hidePreviewRoot(root)
        return
      }

      violationFrames += 1
      if (root && previewVisible) {
        restorePreviewRoot(root)
      }
      if (violationFrames <= 96) {
        invalidate()
      }
    },
  }
}
