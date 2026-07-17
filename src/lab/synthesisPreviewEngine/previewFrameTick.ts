import type { MutableRefObject } from 'react'
import type * as THREE from 'three'
import type { ReactorPreviewAtom } from '../../components/lab/reactorPreviewLayout'
import { pinPreviewAtomsOnScreen } from '../previewAtomFrameGuard'
import {
  applyReactorPreviewLayoutSlots,
  type ReactorPreviewVisibilityGuard,
} from '../reactorPreviewVisibilityGuard'
import { shouldRunGuardTick } from '../synthesisLagGuard'
import type { PreviewFramePolicy } from './previewFramePolicy'

export type PreviewFrameTickInput = {
  policy: PreviewFramePolicy
  slotCount: number
  groupVisible: boolean
  flightActive: boolean
  layoutPending: boolean
  layoutScale: number
  layoutAtoms: readonly (ReactorPreviewAtom | null | undefined)[]
  shellAtoms: readonly ReactorPreviewAtom[]
  rootRef: THREE.Group | null
  atomGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  atomScaleGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  visibilityGuard: ReactorPreviewVisibilityGuard
  guardFrame: number
  onRecoverLayout: () => void
}

export function tickSynthesisPreviewFrame(input: PreviewFrameTickInput): number {
  const {
    policy,
    slotCount,
    groupVisible,
    flightActive,
    layoutPending,
    layoutScale,
    layoutAtoms,
    shellAtoms,
    rootRef,
    atomGroupRefs,
    atomScaleGroupRefs,
    visibilityGuard,
    guardFrame,
    onRecoverLayout,
  } = input

  if (policy.pinEveryFrame) {
    pinPreviewAtomsOnScreen({
      atomCount: slotCount,
      rootRef,
      atomGroupRefs,
      atomScaleGroupRefs,
      layoutScale,
      previewAtoms: layoutAtoms,
      shellAtoms,
      // Pre-synth / editing: не гасим хвост — stale n давал «пропали» при росте coeff.
      keepTailVisible: policy.lockPoolSize || policy.hotCoeffEdit,
    })
  }

  if (
    shouldRunGuardTick(guardFrame, policy.visibilityGuardEvery) &&
    slotCount > 0 &&
    groupVisible &&
    !flightActive
  ) {
    visibilityGuard.tick({
      atomCount: slotCount,
      atomGroupRefs,
      atomScaleGroupRefs,
      layoutScale,
      previewAtoms: layoutAtoms,
      rootVisible: groupVisible,
      flightActive,
      allowRecover: !flightActive && !layoutPending,
      onRecover: onRecoverLayout,
    })
  }

  return guardFrame + 1
}

export function syncPreviewLayoutSlots(
  slotCount: number,
  layoutAtoms: readonly (ReactorPreviewAtom | null | undefined)[],
  shellAtoms: readonly ReactorPreviewAtom[],
  atomGroupRefs: MutableRefObject<(THREE.Group | null)[]>,
  atomScaleGroupRefs: MutableRefObject<(THREE.Group | null)[]>,
  layoutScale: number,
): void {
  if (slotCount <= 0) return
  applyReactorPreviewLayoutSlots(
    slotCount,
    layoutAtoms,
    shellAtoms,
    atomGroupRefs,
    atomScaleGroupRefs,
    layoutScale,
  )
}
