import {
  SYNTHESIS_QUALITY_HIGH,
  type SynthesisQualityLevel,
} from '../lab/synthesisQualityLadder'
import type { VrLabQualityTier } from '../components/vrLab/vrLabPerformance'

/** Фиксированное качество — всегда High, без UI-переключателя. */
export const FIXED_SYNTHESIS_CAP: SynthesisQualityLevel = SYNTHESIS_QUALITY_HIGH
export const FIXED_VR_TIER: VrLabQualityTier = 'high'

/** @deprecated UI удалён — всегда high. */
export function resolveEffectiveGraphicsPreset(): 'high' {
  return 'high'
}

/** @deprecated UI удалён — всегда high cap. */
export function presetToSynthesisCap(): SynthesisQualityLevel {
  return FIXED_SYNTHESIS_CAP
}

/** @deprecated UI удалён — всегда high tier. */
export function presetToVrTier(): VrLabQualityTier {
  return FIXED_VR_TIER
}
