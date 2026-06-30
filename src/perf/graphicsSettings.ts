import {
  SYNTHESIS_QUALITY_BALANCED,
  type SynthesisQualityLevel,
} from '../lab/synthesisQualityLadder'
import type { VrLabQualityTier } from '../components/vrLab/vrLabPerformance'
import {
  getSynthesisDeviceTier,
  type SynthesisDeviceTier,
} from '../lab/synthesisDeviceTier'

/** Потолок качества на мощных устройствах — High (3), без UI-переключателя. */
export const FIXED_SYNTHESIS_CAP: SynthesisQualityLevel = 3
export const FIXED_VR_TIER: VrLabQualityTier = 'high'

/** Стартовый cap синтеза с учётом устройства (normal → High, low → Balanced). */
export function resolveDeviceSynthesisCap(
  tier: SynthesisDeviceTier = getSynthesisDeviceTier(),
): SynthesisQualityLevel {
  return tier === 'low' ? SYNTHESIS_QUALITY_BALANCED : FIXED_SYNTHESIS_CAP
}

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
