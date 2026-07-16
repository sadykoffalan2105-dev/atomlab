import type { ReactorPreviewPolicy } from '../synthesisLagGuard'
import { getReactorPreviewPolicy } from '../synthesisLagGuard'
import type { SynthesisQualityLevel } from '../synthesisQualityLadder'
import type { LowPowerDeviceProfile } from '../lowPowerDeviceProfile'
import { SYNTHESIS_PERF } from '../synthesisPerfPreset'
import { resolvePreviewHotCoeffEdit } from './previewExternalControl'

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
  /** Горячий +/- (не просто открытое превью). */
  hotCoeffEdit: boolean
}

/**
 * Единая политика кадра превью синтеза: слабый ПК — меньше FX, атомы всегда на экране.
 * pinEveryFrame только при реальном +/-; idle превью не платит pin+guard каждый кадр.
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

  const hotCoeffEdit = resolvePreviewHotCoeffEdit({ coeffEditing, coeffEditBurst })
  /** Shell/пул держим шире; тяжёлый pin — только hot. */
  const shellHold = editingActive || hotCoeffEdit
  const effectiveForceLite =
    forceLite || frameBudgetLite || lowPowerProfile.forceLiteReactor
  /**
   * При hot-edit не поднимаем detail (remount), но при росте атомов
   * обязаны уйти в lite — иначе WebGL white/freeze на Cr/K₂Cr₂O₇.
   */
  const denseHot = hotCoeffEdit && atomCount > SYNTHESIS_PERF.fullDetailAtomThreshold
  const renderForceLite = denseHot || (!hotCoeffEdit && effectiveForceLite) || frameBudgetLite

  const base = getReactorPreviewPolicy({
    atomCount,
    forceLite: renderForceLite || (hotCoeffEdit && atomCount > 8),
    flightActive,
    visible: groupVisible,
    qualityLevel,
    coeffEditBurst: hotCoeffEdit,
    maxAnimatedAtoms: lowPowerProfile.maxAnimatedAtoms,
  })

  const pinEveryFrame = hotCoeffEdit && groupVisible && atomCount > 0 && !flightActive

  return {
    ...base,
    electronAnimate:
      base.electronAnimate &&
      (!lowPowerProfile.isMobileSoc || atomCount <= lowPowerProfile.maxAnimatedAtoms),
    driftAtoms:
      pinEveryFrame ? false : base.driftAtoms && !lowPowerProfile.disableAtomDrift,
    slowSpin:
      pinEveryFrame ? false : base.slowSpin && !lowPowerProfile.disableSlowSpin,
    // Pin уже удерживает visible/pos — не дублируем guard каждый кадр.
    visibilityGuardEvery: pinEveryFrame
      ? Math.max(base.visibilityGuardEvery, 4)
      : Math.min(base.visibilityGuardEvery, 2),
    coverageGuardEvery: pinEveryFrame
      ? Math.max(base.coverageGuardEvery, 4)
      : base.coverageGuardEvery,
    pinEveryFrame,
    lockVisualTier: hotCoeffEdit,
    lockPoolSize: shellHold,
    effectiveForceLite: renderForceLite,
    maxInvalidateHz: 60,
    hotCoeffEdit,
  }
}

export function resolveFullDetailLatch(
  current: boolean,
  atomCount: number,
  lockVisualTier: boolean,
  effectiveForceLite: boolean,
): boolean {
  // Downgrade всегда разрешён — иначе full Bohr × 15+ → white/context lost.
  if (effectiveForceLite) return false
  if (atomCount > SYNTHESIS_PERF.fullDetailAtomThreshold) return false
  if (lockVisualTier) return current
  if (atomCount <= SYNTHESIS_PERF.fullDetailAtomThreshold) return true
  if (atomCount > SYNTHESIS_PERF.fullDetailAtomThreshold + 4) return false
  return current
}
