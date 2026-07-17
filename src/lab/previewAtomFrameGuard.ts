import type { MutableRefObject } from 'react'
import type * as THREE from 'three'
import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import { PREVIEW_MIN_ATOM_SCALE } from '../components/lab/reactorPreviewLayout'

/**
 * Восстановить visible у активных слотов 0..atomCount-1 (без скрытия хвоста пула).
 * Нужно после краткого hide group: React visible={true} может не перезаписать THREE.
 */
export function restorePreviewActiveSlotVisibility(opts: {
  atomCount: number
  rootRef: THREE.Group | null
  atomGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  atomScaleGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  layoutScale: number
}): void {
  const { atomCount, rootRef, atomGroupRefs, atomScaleGroupRefs, layoutScale } = opts
  if (atomCount <= 0) return
  if (rootRef) rootRef.visible = true
  const scaleFloor = Math.max(PREVIEW_MIN_ATOM_SCALE, layoutScale)
  for (let i = 0; i < atomCount; i++) {
    const posG = atomGroupRefs.current[i]
    const scaleG = atomScaleGroupRefs.current[i]
    if (posG) posG.visible = true
    if (scaleG) {
      scaleG.visible = true
      const sx = scaleG.scale.x
      if (sx < scaleFloor * 0.45 || Math.abs(sx - scaleFloor) > 0.05) {
        scaleG.scale.set(scaleFloor, scaleFloor, scaleFloor)
      }
    }
  }
}

/**
 * Каждый кадр при +/-: принудительно держим root и слоты visible + scale.
 * Не гасим слоты при кратковременном null — иначе hitch = «атомы пропали».
 * Не гасим i >= atomCount во время pin (atomCount = display hold).
 */
export function pinPreviewAtomsOnScreen(opts: {
  atomCount: number
  rootRef: THREE.Group | null
  atomGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  atomScaleGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  layoutScale: number
  previewAtoms: readonly (ReactorPreviewAtom | null | undefined)[]
  shellAtoms?: readonly ReactorPreviewAtom[]
}): void {
  const {
    atomCount,
    rootRef,
    atomGroupRefs,
    atomScaleGroupRefs,
    layoutScale,
    previewAtoms,
    shellAtoms = [],
  } = opts
  if (atomCount <= 0) return

  if (rootRef) rootRef.visible = true

  const scaleFloor = Math.max(PREVIEW_MIN_ATOM_SCALE, layoutScale)

  for (let i = 0; i < atomCount; i++) {
    const atom = previewAtoms[i] ?? shellAtoms[i] ?? null
    const posG = atomGroupRefs.current[i]
    const scaleG = atomScaleGroupRefs.current[i]
    if (posG) {
      posG.visible = true
      if (atom) {
        const [x, y, z] = atom.pos
        if (
          Math.abs(posG.position.x - x) > 0.001 ||
          Math.abs(posG.position.y - y) > 0.001 ||
          Math.abs(posG.position.z - z) > 0.001
        ) {
          posG.position.set(x, y, z)
        }
      }
    }
    if (scaleG) {
      scaleG.visible = true
      const sx = scaleG.scale.x
      if (sx < scaleFloor * 0.45 || Math.abs(sx - scaleFloor) > 0.05) {
        scaleG.scale.set(scaleFloor, scaleFloor, scaleFloor)
      }
    }
  }

  // Pool slots beyond displayCount stay mounted but hidden — never collapse scale.
  for (let i = atomCount; i < atomGroupRefs.current.length; i++) {
    const posG = atomGroupRefs.current[i]
    const scaleG = atomScaleGroupRefs.current[i]
    if (posG) posG.visible = false
    if (scaleG) scaleG.visible = false
  }
}
