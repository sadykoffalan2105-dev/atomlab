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
       * Hide Bohr при любом productOwnsScreen (full-scale paint) —
       * и во время синтеза, и после settle. Иначе орбиты Bohr «залипают»
       * поверх молекулы (ClO₂ / K₂Cr₂O₇ и т.п.).
       */
      if (ownsScreen) {
        violationFrames = 0
        if (root && root.visible) hidePreviewRoot(root)
        return
      }

      if (!synthLive) {
        if (root) restorePreviewRoot(root)
        violationFrames = 0
        if (previewMounted && previewVisible && root?.visible) return
        if (root) restorePreviewRoot(root)
        invalidate()
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
