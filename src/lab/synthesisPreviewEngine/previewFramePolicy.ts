import type { ReactorPreviewPolicy } from '../synthesisLagGuard'
import { getReactorPreviewPolicy } from '../synthesisLagGuard'
import type { SynthesisQualityLevel } from '../synthesisQualityLadder'
import type { LowPowerDeviceProfile } from '../lowPowerDeviceProfile'
import { SYNTHESIS_PERF } from '../synthesisPerfPreset'

export type PreviewFramePolicyInput = {
  atomCount: number
  editingActive: boolean
  coeffEditBurst: boolean
  coeffEditing: boolean
  flightActive: boolean
  groupVisible: boolean
  forceLite: boolean
  frameBudgetLite: boolean
  qualityLevel?: SynthesisQualityLevel
  lowPowerProfile: LowPowerDeviceProfile
}

export type PreviewFramePolicy = ReactorPreviewPolicy & {
  /** Каждый кадр: pin visible + layout (без пропадания атомов). */
  pinEveryFrame: boolean
  /** Не менять full-detail / lite во время burst (нет мигания). */
  lockVisualTier: boolean
  /** Пул слотов не сжимать во время edit. */
  lockPoolSize: boolean
  /** Эффективный forceLite для рендера (без осцилляций). */
  effectiveForceLite: boolean
  maxInvalidateHz: number
}

/**
 * Единая политика кадра превью синтеза: слабый ПК — меньше FX, атомы всегда на экране.
 */
export function resolvePreviewFramePolicy(input: PreviewFramePolicyInput): PreviewFramePolicy {
  const {
    atomCount,
    editingActive,
    coeffEditBurst,
    coeffEditing,
    flightActive,
    groupVisible,
    forceLite,
    frameBudgetLite,
    qualityLevel,
    lowPowerProfile,
  } = input

  const editing = coeffEditing || coeffEditBurst || editingActive
  const effectiveForceLite =
    forceLite || frameBudgetLite || lowPowerProfile.forceLiteReactor
  // При edit не переключаем lite/detail — иначе remount Bohr (Cr и др.).
  const renderForceLite = editing ? frameBudgetLite : effectiveForceLite

  const base = getReactorPreviewPolicy({
    atomCount,
    forceLite: renderForceLite,
    flightActive,
    visible: groupVisible,
    qualityLevel,
    coeffEditBurst: editing,
    maxAnimatedAtoms: lowPowerProfile.maxAnimatedAtoms,
  })

  const pinEveryFrame = editing && groupVisible && atomCount > 0 && !flightActive

  return {
    ...base,
    electronAnimate:
      base.electronAnimate &&
      (!lowPowerProfile.isMobileSoc || atomCount <= lowPowerProfile.maxAnimatedAtoms),
    driftAtoms:
      pinEveryFrame ? false : base.driftAtoms && !lowPowerProfile.disableAtomDrift,
    slowSpin:
      pinEveryFrame ? false : base.slowSpin && !lowPowerProfile.disableSlowSpin,
    visibilityGuardEvery: pinEveryFrame ? 1 : Math.min(base.visibilityGuardEvery, 2),
    coverageGuardEvery: pinEveryFrame ? 1 : base.coverageGuardEvery,
    pinEveryFrame,
    lockVisualTier: editing,
    lockPoolSize: editing,
    effectiveForceLite: renderForceLite,
    maxInvalidateHz: pinEveryFrame ? 60 : 60,
  }
}

export function resolveFullDetailLatch(
  current: boolean,
  atomCount: number,
  lockVisualTier: boolean,
  effectiveForceLite: boolean,
): boolean {
  if (lockVisualTier) return current
  if (effectiveForceLite) return false
  if (atomCount <= SYNTHESIS_PERF.fullDetailAtomThreshold) return true
  if (atomCount > SYNTHESIS_PERF.fullDetailAtomThreshold + 4) return false
  return current
}
