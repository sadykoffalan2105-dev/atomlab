/**
 * Visibility FSM: hide только с явной причиной; restore всегда парный.
 * Защита от «детей THREE.visible=false при React visible=true».
 */
import type { MutableRefObject } from 'react'
import type * as THREE from 'three'
import { PREVIEW_MIN_ATOM_SCALE } from '../../components/lab/reactorPreviewLayout'

export type ShieldVisibilityReason =
  | 'shown'
  | 'hidden_product'
  | 'hidden_closed'
  | 'hidden_flight'

export type ShieldVisibilityState = {
  reason: ShieldVisibilityReason
}

export function createShieldVisibilityState(): ShieldVisibilityState {
  return { reason: 'shown' }
}

export function canHidePreview(
  reason: ShieldVisibilityReason,
  editing: boolean,
): boolean {
  if (editing) return false
  return reason === 'hidden_product' || reason === 'hidden_closed' || reason === 'hidden_flight'
}

/**
 * Принудительно показать активные слоты 0..slotCount-1.
 * Не трогает хвост пула (его гасит pin отдельно).
 */
export function shieldForceShowActiveSlots(opts: {
  slotCount: number
  root: THREE.Group | null
  atomGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  atomScaleGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  layoutScale: number
}): void {
  const { slotCount, root, atomGroupRefs, atomScaleGroupRefs, layoutScale } = opts
  if (slotCount <= 0) return
  if (root) root.visible = true
  const floor = Math.max(PREVIEW_MIN_ATOM_SCALE, layoutScale)
  for (let i = 0; i < slotCount; i++) {
    const pos = atomGroupRefs.current[i]
    const sc = atomScaleGroupRefs.current[i]
    if (pos) {
      pos.visible = true
    }
    if (sc) {
      sc.visible = true
      if (sc.scale.x < floor * 0.45) {
        sc.scale.set(floor, floor, floor)
      }
    }
  }
}

/** Скрыть слоты только если FSM разрешил. */
export function shieldHideAllSlots(opts: {
  atomGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  atomScaleGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  root: THREE.Group | null
  editing: boolean
  reason: ShieldVisibilityReason
}): boolean {
  if (!canHidePreview(opts.reason, opts.editing)) return false
  if (opts.root) opts.root.visible = false
  for (let i = 0; i < opts.atomGroupRefs.current.length; i++) {
    const pos = opts.atomGroupRefs.current[i]
    const sc = opts.atomScaleGroupRefs.current[i]
    if (pos) pos.visible = false
    if (sc) sc.visible = false
  }
  return true
}
