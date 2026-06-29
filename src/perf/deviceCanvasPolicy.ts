import type { SynthesisDeviceTier } from '../lab/synthesisDeviceTier'

export type LabPerfLevel = 'high' | 'low'

export type LabCanvasPolicy = {
  dpr: number | [number, number]
  antialias: boolean
}

/**
 * DPR и AA для Lab Canvas.
 * На мощных ПК — как раньше (до 1.5× DPR, AA в реакторе).
 * На слабых / при просадке FPS — 1× без AA.
 */
export function resolveLabCanvasPolicy(opts: {
  deviceTier: SynthesisDeviceTier
  perfLevel: LabPerfLevel
  synthesisRunActive: boolean
  reactorViewOpen: boolean
  coeffEditBurst: boolean
  substanceView: boolean
}): LabCanvasPolicy {
  const {
    deviceTier,
    perfLevel,
    synthesisRunActive,
    reactorViewOpen,
    coeffEditBurst,
    substanceView,
  } = opts

  const deviceLow = deviceTier === 'low'
  const fpsLow = perfLevel === 'low'
  const heavyScene = synthesisRunActive || substanceView

  if (deviceLow || fpsLow) {
    return { dpr: 1, antialias: false }
  }

  if (heavyScene || (reactorViewOpen && coeffEditBurst)) {
    return { dpr: 1, antialias: false }
  }

  if (reactorViewOpen) {
    return { dpr: [1, 1.5], antialias: true }
  }

  return { dpr: [1, 1.5], antialias: true }
}
