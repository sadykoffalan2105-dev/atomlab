import type { MutableRefObject } from 'react'
import * as THREE from 'three'
import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import { PREVIEW_MIN_ATOM_SCALE } from '../components/lab/reactorPreviewLayout'

/** Пустых refs подряд до принудительного восстановления. */
export const PREVIEW_REF_RECOVER_FRAMES = 5

export type ReactorPreviewVisibilityGuard = {
  reset: () => void
  tick: (opts: {
    atomCount: number
    atomGroupRefs: MutableRefObject<(THREE.Group | null)[]>
    atomScaleGroupRefs: MutableRefObject<(THREE.Group | null)[]>
    layoutScale: number
    previewAtoms: readonly ReactorPreviewAtom[]
    rootVisible: boolean
    flightActive: boolean
    /** После смены коэффициентов — refs ещё монтируются, recover не нужен. */
    layoutSettling?: boolean
    onRecover: () => void
  }) => void
}

export function createReactorPreviewVisibilityGuard(): ReactorPreviewVisibilityGuard {
  let missingRefFrames = 0
  let lastRecoverMs = 0

  return {
    reset() {
      missingRefFrames = 0
      lastRecoverMs = 0
    },
    tick(opts) {
      const {
        atomCount,
        atomGroupRefs,
        atomScaleGroupRefs,
        layoutScale,
        previewAtoms,
        rootVisible,
        flightActive,
        layoutSettling = false,
        onRecover,
      } = opts

      if (!rootVisible || flightActive || atomCount <= 0) {
        missingRefFrames = 0
        return
      }

      const scaleFloor = Math.max(PREVIEW_MIN_ATOM_SCALE, layoutScale)
      let bound = 0
      let needsRecover = false

      for (let i = 0; i < atomCount; i++) {
        const posG = atomGroupRefs.current[i]
        const scaleG = atomScaleGroupRefs.current[i]
        if (!posG || !scaleG) {
          needsRecover = true
          continue
        }
        bound += 1
        posG.visible = true
        scaleG.visible = true
        const sx = scaleG.scale.x
        if (sx < scaleFloor * 0.5) {
          scaleG.scale.set(scaleFloor, scaleFloor, scaleFloor)
        }
        // Во время settle только держим видимость; позиции не трогаем.
        if (layoutSettling) continue
        const atom = previewAtoms[i]
        if (atom) {
          const [x, y, z] = atom.pos
          const dx = Math.abs(posG.position.x - x)
          const dy = Math.abs(posG.position.y - y)
          const dz = Math.abs(posG.position.z - z)
          if (dx > 2.5 || dy > 2.5 || dz > 2.5) {
            posG.position.set(x, y, z)
          }
        }
      }

      if (layoutSettling) {
        missingRefFrames = 0
        return
      }

      if (needsRecover || bound < atomCount) {
        missingRefFrames += 1
      } else {
        missingRefFrames = 0
      }

      if (missingRefFrames >= PREVIEW_REF_RECOVER_FRAMES) {
        const now = performance.now()
        if (now - lastRecoverMs > 240) {
          lastRecoverMs = now
          onRecover()
        }
        missingRefFrames = 0
      }
    },
  }
}

/** Принудительно выставить позиции и scale всех атомов превью. */
export function applyReactorPreviewLayout(
  previewAtoms: readonly ReactorPreviewAtom[],
  atomGroupRefs: MutableRefObject<(THREE.Group | null)[]>,
  atomScaleGroupRefs: MutableRefObject<(THREE.Group | null)[]>,
  layoutScale: number,
): void {
  const scaleFloor = Math.max(PREVIEW_MIN_ATOM_SCALE, layoutScale)
  previewAtoms.forEach((atom, i) => {
    const posG = atomGroupRefs.current[i]
    const scaleG = atomScaleGroupRefs.current[i]
    if (posG) {
      posG.visible = true
      posG.position.set(atom.pos[0], atom.pos[1], atom.pos[2])
    }
    if (scaleG) {
      scaleG.visible = true
      const sx = scaleG.scale.x
      if (Math.abs(sx - scaleFloor) > 0.012) {
        scaleG.scale.set(scaleFloor, scaleFloor, scaleFloor)
      }
    }
  })
}
