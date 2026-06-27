import type { SynthesisQualityLevel } from '../lab/synthesisQualityLadder'
import {
  SYNTHESIS_QUALITY_BALANCED,
  SYNTHESIS_QUALITY_HIGH,
  SYNTHESIS_QUALITY_LITE,
  SYNTHESIS_QUALITY_MINIMAL,
  SYNTHESIS_QUALITY_ULTRA,
} from '../lab/synthesisQualityLadder'
import type { VrLabQualityTier } from '../components/vrLab/vrLabPerformance'

/** Пользовательский пресет графики. Auto — по железу. */
export type GraphicsPreset = 'auto' | 'low' | 'medium' | 'high' | 'ultra'

export const GRAPHICS_STORAGE_KEY = 'atomlab.graphicsPreset'

const PRESET_ORDER = ['low', 'medium', 'high', 'ultra'] as const
type NonAutoPreset = (typeof PRESET_ORDER)[number]

export function isGraphicsPreset(v: string): v is GraphicsPreset {
  return v === 'auto' || (PRESET_ORDER as readonly string[]).includes(v)
}

export function readStoredGraphicsPreset(): GraphicsPreset {
  if (typeof window === 'undefined') return 'auto'
  try {
    const raw = localStorage.getItem(GRAPHICS_STORAGE_KEY)
    if (raw && isGraphicsPreset(raw)) return raw
  } catch {
    /* ignore */
  }
  return 'auto'
}

export function writeStoredGraphicsPreset(preset: GraphicsPreset): void {
  try {
    localStorage.setItem(GRAPHICS_STORAGE_KEY, preset)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('atomlab:graphics-preset', { detail: preset }))
}

/** Авто-оценка железа (консервативно для школьных ПК). */
export function detectHardwareGraphicsPreset(): NonAutoPreset {
  if (typeof window === 'undefined') return 'medium'
  try {
    const cores = navigator.hardwareConcurrency ?? 4
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced || mobile || cores <= 2 || mem <= 2) return 'low'
    if (cores <= 4 || mem <= 4) return 'medium'
    if (cores >= 8 && mem >= 8) return 'high'
    return 'medium'
  } catch {
    return 'medium'
  }
}

export function resolveEffectiveGraphicsPreset(stored?: GraphicsPreset): NonAutoPreset {
  const p = stored ?? readStoredGraphicsPreset()
  return p === 'auto' ? detectHardwareGraphicsPreset() : p
}

export function presetToSynthesisCap(preset: NonAutoPreset): SynthesisQualityLevel {
  switch (preset) {
    case 'low':
      return SYNTHESIS_QUALITY_LITE
    case 'medium':
      return SYNTHESIS_QUALITY_BALANCED
    case 'high':
      return SYNTHESIS_QUALITY_HIGH
    case 'ultra':
      return SYNTHESIS_QUALITY_ULTRA
    default:
      return SYNTHESIS_QUALITY_BALANCED
  }
}

export function presetToVrTier(preset: NonAutoPreset): VrLabQualityTier {
  switch (preset) {
    case 'low':
      return 'low'
    case 'medium':
      return 'medium'
    case 'high':
    case 'ultra':
      return 'high'
    default:
      return 'medium'
  }
}

/** Снизить пресет на один шаг (FPS governor). */
export function downgradeGraphicsPreset(preset: NonAutoPreset): NonAutoPreset {
  const idx = PRESET_ORDER.indexOf(preset)
  return idx <= 0 ? 'low' : PRESET_ORDER[idx - 1]!
}

export function downgradeVrTier(tier: VrLabQualityTier): VrLabQualityTier {
  if (tier === 'high') return 'medium'
  if (tier === 'medium') return 'low'
  return 'low'
}

export function synthesisCapToLabelLevel(cap: SynthesisQualityLevel): NonAutoPreset {
  if (cap <= SYNTHESIS_QUALITY_MINIMAL) return 'low'
  if (cap <= SYNTHESIS_QUALITY_LITE) return 'low'
  if (cap <= SYNTHESIS_QUALITY_BALANCED) return 'medium'
  if (cap <= SYNTHESIS_QUALITY_HIGH) return 'high'
  return 'ultra'
}
