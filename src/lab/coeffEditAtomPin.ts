/**
 * Жёсткий pin Bohr-атомов во время расстановки коэффициентов.
 * Инвариант: пока есть реагенты и идёт edit/pre-synth — атомы НЕ могут пропасть
 * (ни visible=false, ни scale≈0 после collapse синтеза).
 */
import type { MutableRefObject } from 'react'
import type * as THREE from 'three'
import { PREVIEW_MIN_ATOM_SCALE } from '../components/lab/reactorPreviewLayout'

export type CoeffEditAtomPinOpts = {
  slotCount: number
  layoutScale: number
  root: THREE.Group | null
  atomGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  atomScaleGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  /** Позиции из layout (опционально) — вернуть слоты на место. */
  positions?: ReadonlyArray<{ pos: readonly [number, number, number] } | null | undefined>
  /** Опционально убить GSAP tween на scale (передаёт LabScene). */
  killScaleTweens?: (scale: THREE.Vector3) => void
}

/** Нужен ли hard-pin (edit / pre-synth / hold). */
export function shouldHardPinCoeffEditAtoms(opts: {
  coeffEditing: boolean
  previewOnlyMode: boolean
  synthHoldPreview: boolean
  hasActiveTerms: boolean
  synthLive: boolean
}): boolean {
  if (opts.synthLive && !opts.synthHoldPreview) return false
  if (opts.coeffEditing || opts.previewOnlyMode || opts.synthHoldPreview) {
    return opts.hasActiveTerms
  }
  return false
}

/**
 * Каждый кадр: root + все активные слоты visible=true, scale = floor.
 * Без порога 0.45 — иначе collapse 0.06 / mid-tween оставляют «пустой» центр.
 */
export function pinCoeffEditAtomsHard(opts: CoeffEditAtomPinOpts): void {
  const {
    slotCount,
    layoutScale,
    root,
    atomGroupRefs,
    atomScaleGroupRefs,
    positions,
    killScaleTweens,
  } = opts
  if (slotCount <= 0) return

  if (root) {
    root.visible = true
  }

  const floor = Math.max(PREVIEW_MIN_ATOM_SCALE, layoutScale, 0.58)
  for (let i = 0; i < slotCount; i++) {
    const pos = atomGroupRefs.current[i]
    const sc = atomScaleGroupRefs.current[i]
    if (pos) {
      pos.visible = true
      const atom = positions?.[i]
      if (atom?.pos) {
        pos.position.set(atom.pos[0], atom.pos[1], atom.pos[2])
      }
    }
    if (sc) {
      sc.visible = true
      if (Math.abs(sc.scale.x - floor) > 0.01 || sc.scale.x < floor * 0.98) {
        killScaleTweens?.(sc.scale)
        sc.scale.set(floor, floor, floor)
      }
    }
  }
}
