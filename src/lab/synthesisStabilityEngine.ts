/**
 * SynthesisStabilityEngine — единый движок инвариантов превью/синтеза.
 *
 * Цели:
 * 1. При +/- коэффициентов Bohr ВСЕГДА на экране (нет пустого starfield).
 * 2. Handoff Bohr → молекула только после GPU + paint (нет «чёрного» кадра).
 * 3. Run → молекула ≤500ms (instant path, warm GPU).
 * 4. Слабые устройства: меньше paint-кадров, короткие cooldown, без remount thrash.
 */
import type { SynthesisDeviceTier } from './synthesisDeviceTier'

/** Контракт таймингов (60fps ≈ 16.7ms/кадр). */
export const SYNTH_STABILITY = {
  /** Кадров full-scale до paint (cold GPU). */
  visiblePaintFramesCold: 3,
  /** Кадров full-scale до paint (GPU уже скомпилирован). */
  visiblePaintFramesWarm: 1,
  /** Минимум кадров instant-синтеза до onDone. */
  instantMinFrames: 2,
  /** Потолок ожидания paint instant (≈400ms @60fps). */
  instantMaxFrames: 24,
  /** Потолок ожидания GPU reveal при Run (≈300ms). */
  instantRevealMaxFrames: 18,
  /** Задержка GPU-prewarm после открытия реактора (ms). */
  reactorGpuIdleMs: 48,
  /** Пауза product GPU после окончания edit (ms) — без hitch на Bohr. */
  editGpuCooldownMs: 380,
  /** Минимальный scale продукта для «реального» paint. */
  productPaintScaleMin: 0.86,
} as const

export type PreviewAtomInvariants = {
  holdPreview: boolean
  atomsOnScreen: boolean
  pinEveryFrame: boolean
  stickySlotCount: number
  /** Никогда не сбрасывать mount pool, пока уравнение активно. */
  keepMountPool: boolean
}

export type ProductHandoffGate = {
  /** Можно скрыть корень Bohr (THREE). */
  hideBohrRoot: boolean
  /** productPainted для continuity-guard (с учётом GPU). */
  continuityProductPainted: boolean
  /** Продукт визуально владеет экраном (anti-blink). */
  productOwnsScreenSafe: boolean
}

export type InstantSynthFrameBudget = {
  minFrames: number
  maxFrames: number
  revealMaxFrames: number
}

/** Кадры paint продукта: warm GPU → 1 кадр, cold → 3 (слабые GPU — меньше). */
export function resolveVisiblePaintFrames(
  gpuCompiled: boolean,
  lowPower = false,
): number {
  if (lowPower) return gpuCompiled ? 1 : 2
  return gpuCompiled
    ? SYNTH_STABILITY.visiblePaintFramesWarm
    : SYNTH_STABILITY.visiblePaintFramesCold
}

/** Бюджет кадров instant-синтеза (<500ms при warm GPU). */
export function resolveInstantSynthFrameBudget(opts: {
  gpuCompiled: boolean
  deviceTier?: SynthesisDeviceTier
}): InstantSynthFrameBudget {
  const warm = opts.gpuCompiled
  const low = opts.deviceTier === 'low'
  if (low) {
    return {
      minFrames: warm ? 1 : 2,
      maxFrames: warm ? 10 : 18,
      revealMaxFrames: warm ? 6 : 12,
    }
  }
  return {
    minFrames: warm ? 1 : SYNTH_STABILITY.instantMinFrames,
    maxFrames: warm ? 12 : SYNTH_STABILITY.instantMaxFrames,
    revealMaxFrames: warm ? 8 : SYNTH_STABILITY.instantRevealMaxFrames,
  }
}

/** Задержка reactorGpuIdleReady после открытия реактора. */
export function resolveReactorGpuIdleDelayMs(alreadyWarmed = false): number {
  return alreadyWarmed ? 0 : SYNTH_STABILITY.reactorGpuIdleMs
}

/**
 * Инварианты видимости атомов превью.
 * Единственный источник правды для ReactorTermsPreview.
 */
export function resolvePreviewAtomInvariants(opts: {
  previewOnlyMode: boolean
  coeffEditing: boolean
  synthHoldPreview: boolean
  visibleProp: boolean
  hasActiveTerms: boolean
  slotCount: number
  shellCount: number
  expectedAtomCount: number
  groupVisible: boolean
}): PreviewAtomInvariants {
  const {
    previewOnlyMode,
    coeffEditing,
    synthHoldPreview,
    visibleProp,
    hasActiveTerms,
    slotCount,
    shellCount,
    expectedAtomCount,
    groupVisible,
  } = opts

  const holdPreview = previewOnlyMode || coeffEditing || synthHoldPreview
  const stickySlotCount = holdPreview
    ? Math.max(slotCount, shellCount, expectedAtomCount, hasActiveTerms ? 1 : 0)
    : slotCount

  const atomsOnScreen = holdPreview || previewOnlyMode
    ? hasActiveTerms || slotCount > 0 || shellCount > 0 || expectedAtomCount > 0
    : Boolean(visibleProp) &&
      (slotCount > 0 || shellCount > 0 || groupVisible || hasActiveTerms)

  const pinEveryFrame =
    holdPreview && (hasActiveTerms || slotCount > 0 || shellCount > 0 || expectedAtomCount > 0)

  return {
    holdPreview,
    atomsOnScreen,
    pinEveryFrame,
    stickySlotCount,
    keepMountPool: hasActiveTerms || expectedAtomCount > 0,
  }
}

/**
 * Handoff Bohr → молекула: скрываем атомы только когда GPU готов.
 */
export function resolveProductHandoffGate(opts: {
  effectiveProductPainted: boolean
  productSlotVisible: boolean
  preSynthesisPreview: boolean
  coeffEditingActive: boolean
  gpuReady: boolean
  showSettledHero: boolean
  synthLive: boolean
}): ProductHandoffGate {
  const {
    effectiveProductPainted,
    productSlotVisible,
    preSynthesisPreview,
    coeffEditingActive,
    gpuReady,
    showSettledHero,
    synthLive,
  } = opts

  if (preSynthesisPreview || coeffEditingActive) {
    return {
      hideBohrRoot: false,
      continuityProductPainted: false,
      productOwnsScreenSafe: false,
    }
  }

  const paintedAndReady =
    effectiveProductPainted && productSlotVisible && (gpuReady || showSettledHero)

  const productOwnsScreenSafe =
    paintedAndReady && (showSettledHero || synthLive) && !coeffEditingActive

  return {
    hideBohrRoot: productOwnsScreenSafe,
    continuityProductPainted: paintedAndReady && (synthLive || showSettledHero),
    productOwnsScreenSafe,
  }
}

/** GPU prewarm продукта в idle (не во время edit/burst). */
export function resolveAllowIdleProductPrewarm(opts: {
  coeffEditingActive: boolean
  synthLive: boolean
  editCooldownElapsed: boolean
}): boolean {
  if (opts.coeffEditingActive) return false
  if (opts.synthLive) return true
  return opts.editCooldownElapsed
}

/** GSAP collapse атомов — только после реального paint. */
export function shouldCollapsePreviewAtoms(productPainted: boolean): boolean {
  return productPainted
}

/** electronFrameSkip: стабильный, без 1↔2 thrash на edit-edge. */
export function resolveStableElectronFrameSkip(
  atomCount: number,
  opts?: { deviceTier?: SynthesisDeviceTier; lowPower?: boolean },
): number {
  const low = opts?.lowPower || opts?.deviceTier === 'low'
  if (low) {
    if (atomCount >= 8) return 3
    return 2
  }
  if (atomCount >= 10) return 2
  return 1
}
