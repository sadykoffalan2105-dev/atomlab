import { easeOutCubic, mixHexColors } from '../vrLabAnimation'
import type { VrLabTubeContent } from '../types'

export type MixBlendState = {
  colorA: string
  colorB: string
  mixRatio: number
  temperature: number
}

export function createMixBlend(a: VrLabTubeContent, b: VrLabTubeContent): MixBlendState {
  return {
    colorA: a.liquidColor,
    colorB: b.liquidColor,
    mixRatio: 0,
    temperature: 0,
  }
}

export function advanceMixBlend(
  state: MixBlendState,
  progress: number,
  heat: number,
): { displayColor: string; mixRatio: number; temperature: number } {
  const mixRatio = easeOutCubic(Math.max(0, Math.min(1, progress)))
  const temperature = heat * mixRatio
  return {
    displayColor: mixHexColors(state.colorA, state.colorB, mixRatio),
    mixRatio,
    temperature,
  }
}
