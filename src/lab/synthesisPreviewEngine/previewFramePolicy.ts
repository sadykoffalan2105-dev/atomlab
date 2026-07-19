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
  /** GSAP владеет атомами — pin не трогает. */
  flightActive: boolean
}

/**
 * Единая политика кадра превью синтеза.
 * lockVisualTier на весь pre-synth — иначе n 9↔11 даёт remount Bohr → пустой экран.
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
  const shellHold = editingActive || hotCoeffEdit
  const effectiveForceLite =
    forceLite || frameBudgetLite || lowPowerProfile.forceLiteReactor
  /**
   * Плотный edit → lite сразу. Порог 8 (не 10/12/16), чтобы dichromate
   * не прыгал full→lite на каждом +/-.
   */
  const denseHot = (hotCoeffEdit || editingActive) && atomCount >= 8
  const renderForceLite =
    denseHot ||
    (!hotCoeffEdit && !editingActive && effectiveForceLite) ||
    frameBudgetLite

  const base = getReactorPreviewPolicy({
    atomCount,
    forceLite: renderForceLite || ((hotCoeffEdit || editingActive) && atomCount >= 6),
    flightActive,
    visible: groupVisible || (editingActive && atomCount > 0),
    qualityLevel,
    coeffEditBurst: hotCoeffEdit || editingActive,
    maxAnimatedAtoms: Math.max(lowPowerProfile.maxAnimatedAtoms, SYNTHESIS_PERF.maxAnimatedAtoms),
  })

  const pinEveryFrame =
    !flightActive && atomCount > 0 && (hotCoeffEdit || editingActive)

  const electronAnimate =
    !flightActive &&
    atomCount > 0 &&
    (hotCoeffEdit || editingActive || groupVisible) &&
    atomCount <= SYNTHESIS_PERF.maxAnimatedAtoms

  return {
    ...base,
    electronAnimate,
    driftAtoms: false,
    slowSpin: pinEveryFrame ? false : base.slowSpin && !lowPowerProfile.disableSlowSpin,
    visibilityGuardEvery: 1,
    coverageGuardEvery: pinEveryFrame ? 2 : base.coverageGuardEvery,
    pinEveryFrame,
    // Весь pre-synth: tier заморожен — нет full↔lite remount.
    lockVisualTier: editingActive || hotCoeffEdit || denseHot || atomCount >= 8,
    lockPoolSize: shellHold,
    effectiveForceLite: renderForceLite,
    maxInvalidateHz: 60,
    hotCoeffEdit,
    flightActive,
  }
}

/**
 * Latch полной детализации. При lockVisualTier никогда не апгрейдим обратно
 * в full — именно апгрейд 11→9 вызывал второй remount и «пропажу» атомов.
 */
export function resolveFullDetailLatch(
  current: boolean,
  atomCount: number,
  lockVisualTier: boolean,
  effectiveForceLite: boolean,
): boolean {
  if (effectiveForceLite) return false
  if (atomCount >= 8) return false
  if (lockVisualTier) return current
  if (atomCount <= 6) return true
  return current
}
