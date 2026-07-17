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
  /** Shell/пул держим шире; pin — весь pre-synth, не только hot (иначе атомы «пропадают» после оседания). */
  const shellHold = editingActive || hotCoeffEdit
  const effectiveForceLite =
    forceLite || frameBudgetLite || lowPowerProfile.forceLiteReactor
  /**
   * При hot-edit / dense сразу lite и держим — без flip full↔lite (remount Bohr = «пропали»).
   * Электроны при visible и atomCount>0 всегда анимируются в base; щит усиливает это.
   */
  const denseHot = hotCoeffEdit && atomCount > SYNTHESIS_PERF.fullDetailAtomThreshold
  const renderForceLite =
    denseHot ||
    (hotCoeffEdit && atomCount >= 10) ||
    (editingActive && atomCount >= 10) ||
    (!hotCoeffEdit && effectiveForceLite) ||
    frameBudgetLite

  const base = getReactorPreviewPolicy({
    atomCount,
    forceLite: renderForceLite || ((hotCoeffEdit || editingActive) && atomCount > 8),
    flightActive,
    visible: groupVisible || (editingActive && atomCount > 0),
    qualityLevel,
    coeffEditBurst: hotCoeffEdit || editingActive,
    maxAnimatedAtoms: Math.max(lowPowerProfile.maxAnimatedAtoms, SYNTHESIS_PERF.maxAnimatedAtoms),
  })

  /**
   * КРИТИЧНО: pin каждый кадр, пока превью открыто (editingActive=previewOnlyMode).
   * Раньше pin падал после settle → THREE.visible=false залипал → «атомы пропали».
   */
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
    lockVisualTier: hotCoeffEdit || denseHot || (editingActive && atomCount >= 10),
    lockPoolSize: shellHold,
    effectiveForceLite: renderForceLite,
    maxInvalidateHz: 60,
    hotCoeffEdit,
    flightActive,
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
