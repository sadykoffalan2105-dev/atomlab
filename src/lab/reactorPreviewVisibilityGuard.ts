import type { MutableRefObject } from 'react'
import * as THREE from 'three'
import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import { PREVIEW_MIN_ATOM_SCALE } from '../components/lab/reactorPreviewLayout'

/** Пустых refs подряд до принудительного восстановления. */
export const PREVIEW_REF_RECOVER_FRAMES = 6

export type ReactorPreviewVisibilityGuard = {
  reset: () => void
  tick: (opts: {
    atomCount: number
    atomGroupRefs: MutableRefObject<(THREE.Group | null)[]>
    atomScaleGroupRefs: MutableRefObject<(THREE.Group | null)[]>
    layoutScale: number
    previewAtoms: readonly (ReactorPreviewAtom | null | undefined)[]
    rootVisible: boolean
    flightActive: boolean
    /** false — только visible/scale, без syncLayout (не дёргать layout при +/-). */
    allowRecover?: boolean
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
        allowRecover = true,
        onRecover,
      } = opts

      if (!rootVisible || flightActive || atomCount <= 0) {
        missingRefFrames = 0
        return
      }

      const scaleFloor = Math.max(PREVIEW_MIN_ATOM_SCALE, layoutScale)
      let bound = 0

      for (let i = 0; i < atomCount; i++) {
        const posG = atomGroupRefs.current[i]
        const scaleG = atomScaleGroupRefs.current[i]
        if (!posG || !scaleG) continue
        bound += 1
        posG.visible = true
        scaleG.visible = true
        const sx = scaleG.scale.x
        if (sx < scaleFloor * 0.5) {
          scaleG.scale.set(scaleFloor, scaleFloor, scaleFloor)
        }
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

      // Частичный mount при быстрой смене коэффициентов — не считаем ошибкой.
      if (bound === 0) {
        missingRefFrames += 1
      } else if (bound < atomCount) {
        missingRefFrames = Math.max(0, missingRefFrames - 1)
      } else {
        missingRefFrames = 0
      }

      if (missingRefFrames >= PREVIEW_REF_RECOVER_FRAMES) {
        const now = performance.now()
        if (allowRecover && now - lastRecoverMs > 320) {
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
  applyReactorPreviewLayoutSlots(
    previewAtoms.length,
    previewAtoms,
    [],
    atomGroupRefs,
    atomScaleGroupRefs,
    layoutScale,
  )
}

/** Layout для slotCount слотов с shell-hold. */
export function applyReactorPreviewLayoutSlots(
  slotCount: number,
  previewAtoms: readonly (ReactorPreviewAtom | null | undefined)[],
  shellAtoms: readonly ReactorPreviewAtom[],
  atomGroupRefs: MutableRefObject<(THREE.Group | null)[]>,
  atomScaleGroupRefs: MutableRefObject<(THREE.Group | null)[]>,
  layoutScale: number,
): void {
  if (slotCount <= 0) return
  const scaleFloor = Math.max(PREVIEW_MIN_ATOM_SCALE, layoutScale)
  for (let i = 0; i < slotCount; i++) {
    const atom = previewAtoms[i] ?? shellAtoms[i] ?? null
    const posG = atomGroupRefs.current[i]
    const scaleG = atomScaleGroupRefs.current[i]
    if (!atom) {
      if (posG) posG.visible = false
      if (scaleG) scaleG.visible = false
      continue
    }
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
  }
  for (let i = slotCount; i < atomGroupRefs.current.length; i++) {
    const posG = atomGroupRefs.current[i]
    const scaleG = atomScaleGroupRefs.current[i]
    if (posG) posG.visible = false
    if (scaleG) scaleG.visible = false
  }
}
