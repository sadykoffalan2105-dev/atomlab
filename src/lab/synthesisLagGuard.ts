import { SYNTHESIS_PERF } from './synthesisPerfPreset'

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
  flightActive: boolean
  visible: boolean
  visualTier?: 'full' | 'lite' | 'cluster'
}): ReactorPreviewPolicy {
  const { atomCount, forceLite, flightActive, visible, visualTier = 'full' } = opts
  const dense = atomCount > SYNTHESIS_PERF.denseAtomThreshold
  const liteRender = forceLite || dense || visualTier === 'cluster'

  return {
    electronAnimate:
      visible && !flightActive && atomCount <= SYNTHESIS_PERF.maxAnimatedAtoms && visualTier === 'full',
    driftAtoms: visible && !flightActive && atomCount <= 12 && visualTier === 'full',
    slowSpin: visible && !flightActive && atomCount <= 12 && visualTier === 'full',
    visibilityGuardEvery: liteRender ? 4 : atomCount > 6 ? 2 : 1,
    coverageGuardEvery: liteRender ? 3 : 2,
  }
}

export function getReactorAtomRenderPolicy(opts: {
  atomCount: number
  atomZ: number
  forceLite: boolean
}): ReactorAtomRenderPolicy {
  const { atomCount, atomZ, forceLite } = opts
  const lite = forceLite || shouldForceLiteByAtomCount(atomCount)
  const dense = atomCount > SYNTHESIS_PERF.denseAtomThreshold

  const synthesisDetail =
    !lite && atomCount <= SYNTHESIS_PERF.fullDetailAtomThreshold && atomZ <= 54
  const previewLite = lite || atomCount > SYNTHESIS_PERF.fullDetailAtomThreshold || atomZ > 26

  let electronFrameSkip = 1
  if (lite) electronFrameSkip = 3
  else if (dense) electronFrameSkip = 2
  else if (atomZ > 18) electronFrameSkip = 2

  return { synthesisDetail, previewLite, electronFrameSkip }
}

/** Пропускать ли тик guard на этом кадре. */
export function shouldRunGuardTick(frameIndex: number, every: number): boolean {
  if (every <= 1) return true
  return frameIndex % every === 0
}
