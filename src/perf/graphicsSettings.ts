import {
  resolveDeviceSynthesisCap,
  type SynthesisQualityLevel,
} from '../lab/synthesisQualityLadder'
import type { VrLabQualityTier } from '../components/vrLab/vrLabPerformance'
import { getSynthesisDeviceTier } from '../lab/synthesisDeviceTier'

// resolveDeviceSynthesisCap / FIXED_SYNTHESIS_CAP теперь живут в synthesisQualityLadder
// (разрыв циклической зависимости graphicsSettings ↔ synthesisQualityLadder).
export { resolveDeviceSynthesisCap }
export { FIXED_SYNTHESIS_CAP } from '../lab/synthesisQualityLadder'

export const FIXED_VR_TIER: VrLabQualityTier = 'high'

/** @deprecated UI удалён — всегда high на normal tier. */
export function resolveEffectiveGraphicsPreset(): 'high' {
  return 'high'
}

/** @deprecated UI удалён — cap по устройству. */
export function presetToSynthesisCap(): SynthesisQualityLevel {
  return resolveDeviceSynthesisCap()
}

/** VR tier: high на normal, medium на low. */
export function presetToVrTier(): VrLabQualityTier {
  return getSynthesisDeviceTier() === 'low' ? 'medium' : FIXED_VR_TIER
}
