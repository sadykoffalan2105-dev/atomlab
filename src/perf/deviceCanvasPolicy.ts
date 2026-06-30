import type { SynthesisDeviceTier } from '../lab/synthesisDeviceTier'

export type LabPerfLevel = 'high' | 'low'

export type LabCanvasPolicy = {
  dpr: number | [number, number]
  antialias: boolean
}

/**
 * DPR и AA для Lab Canvas.
 * В режиме редактирования реактора — стабильная политика (смена DPR при +/- ломает WebGL → белый экран).
 */
export function resolveLabCanvasPolicy(opts: {
  deviceTier: SynthesisDeviceTier
  perfLevel: LabPerfLevel
  synthesisRunActive: boolean
  reactorViewOpen: boolean
  coeffEditBurst?: boolean
  substanceView: boolean
}): LabCanvasPolicy {
  const { deviceTier, perfLevel, synthesisRunActive, reactorViewOpen, substanceView } = opts

  const deviceLow = deviceTier === 'low'

  if (reactorViewOpen && !synthesisRunActive && !substanceView) {
    return deviceLow ? { dpr: 1, antialias: false } : { dpr: [1, 1.25], antialias: true }
  }

  const fpsLow = perfLevel === 'low'
  const heavyScene = synthesisRunActive || substanceView

  if (deviceLow || fpsLow) {
    return { dpr: 1, antialias: false }
  }

  if (heavyScene) {
    return { dpr: 1, antialias: false }
  }

  if (reactorViewOpen) {
    return { dpr: [1, 1.25], antialias: true }
  }

  return { dpr: [1, 1.25], antialias: true }
}
