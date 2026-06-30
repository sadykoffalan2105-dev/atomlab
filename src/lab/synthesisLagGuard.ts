import { SYNTHESIS_PERF } from './synthesisPerfPreset'
import type { SynthesisQualityLevel } from './synthesisQualityLadder'
import { qualityLevelToForceLite } from './synthesisQualityLadder'
import { PREVIEW_MAX_ATOM_MODELS } from './reactorPreviewGuarantee'

/** Политика рендера одного атома в превью реактора. */
export type ReactorAtomRenderPolicy = {
  synthesisDetail: boolean
  previewLite: boolean
  electronFrameSkip: number
}

/** Политика всего превью (ReactorTermsPreview). */
export type ReactorPreviewPolicy = {
  electronAnimate: boolean
  driftAtoms: boolean
  slowSpin: boolean
  /** Проверять visibility guard каждые N кадров (1 = каждый кадр). */
  visibilityGuardEvery: number
  /** Проверять coverage guard каждые N кадров. */
  coverageGuardEvery: number
}

export function shouldForceLiteByAtomCount(atomCount: number): boolean {
  return atomCount >= SYNTHESIS_PERF.liteFxAtomThreshold
}

export function getReactorPreviewPolicy(opts: {
  atomCount: number
  forceLite: boolean
  qualityLevel?: SynthesisQualityLevel
  flightActive: boolean
  visible: boolean
  visualTier?: 'full' | 'lite' | 'cluster'
  /** Быстрая серия +/- — электроны остаются, drift/spin отключаем. */
  coeffEditBurst?: boolean
  maxAnimatedAtoms?: number
}): ReactorPreviewPolicy {
  const {
    atomCount,
    forceLite,
    qualityLevel,
    flightActive,
    visible,
    visualTier = 'full',
    coeffEditBurst = false,
    maxAnimatedAtoms = SYNTHESIS_PERF.maxAnimatedAtoms,
  } = opts

  const liteRender =
    forceLite ||
    qualityLevelToForceLite(qualityLevel ?? 4) ||
    atomCount > SYNTHESIS_PERF.denseAtomThreshold ||
    visualTier === 'cluster' ||
    coeffEditBurst
  const minimal = (qualityLevel ?? 4) <= 0

  /** При +/- коэффициентов электроны всегда анимируются (до PREVIEW_MAX). */
  const electronCap = coeffEditBurst
    ? PREVIEW_MAX_ATOM_MODELS
    : Math.min(maxAnimatedAtoms, PREVIEW_MAX_ATOM_MODELS)

  return {
    electronAnimate: visible && !flightActive && atomCount <= electronCap,
    driftAtoms:
      !coeffEditBurst &&
      !minimal &&
      visible &&
      !flightActive &&
      atomCount <= 16 &&
      (qualityLevel ?? 4) >= 4,
    slowSpin:
      !coeffEditBurst &&
      visible &&
      !flightActive &&
      atomCount <= 16 &&
      !liteRender,
    visibilityGuardEvery: coeffEditBurst ? 4 : liteRender ? 4 : atomCount > 8 ? 3 : 2,
    coverageGuardEvery: coeffEditBurst ? 4 : liteRender ? 3 : 2,
  }
}

export function getReactorAtomRenderPolicy(opts: {
  atomCount: number
  atomZ: number
  forceLite: boolean
  qualityLevel?: SynthesisQualityLevel
  coeffEditBurst?: boolean
  minElectronFrameSkip?: number
}): ReactorAtomRenderPolicy {
  const {
    atomCount,
    atomZ,
    forceLite,
    qualityLevel,
    coeffEditBurst = false,
    minElectronFrameSkip = 1,
  } = opts
  const lite =
    forceLite ||
    qualityLevelToForceLite(qualityLevel ?? 4) ||
    shouldForceLiteByAtomCount(atomCount)

  const synthesisDetail =
    !lite && atomCount <= SYNTHESIS_PERF.fullDetailAtomThreshold && atomZ <= 54
  const previewLite = lite || atomCount > SYNTHESIS_PERF.fullDetailAtomThreshold || atomZ > 26

  let electronFrameSkip = Math.max(1, minElectronFrameSkip)
  const dense = atomCount > SYNTHESIS_PERF.denseAtomThreshold
  if (coeffEditBurst) electronFrameSkip = Math.max(electronFrameSkip, 2)
  else if (lite) electronFrameSkip = Math.max(electronFrameSkip, 3)
  else if (dense) electronFrameSkip = Math.max(electronFrameSkip, 2)
  else if (atomZ > 18) electronFrameSkip = Math.max(electronFrameSkip, 2)

  return { synthesisDetail, previewLite, electronFrameSkip }
}

/** Пропускать ли тик guard на этом кадре. */
export function shouldRunGuardTick(frameIndex: number, every: number): boolean {
  if (every <= 1) return true
  return frameIndex % every === 0
}
