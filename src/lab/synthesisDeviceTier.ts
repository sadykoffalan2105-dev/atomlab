import { resolveEffectiveGraphicsPreset } from '../perf/graphicsSettings'

/** Грубая оценка «слабого» устройства для lite-синтеза с первого кадра. */
export type SynthesisDeviceTier = 'low' | 'normal'

let cachedTier: SynthesisDeviceTier | null = null

export function getSynthesisDeviceTier(): SynthesisDeviceTier {
  if (cachedTier) return cachedTier
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    cachedTier = 'normal'
    return cachedTier
  }

  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const userPreset = resolveEffectiveGraphicsPreset()

  if (reducedMotion || mobileUa || userPreset === 'low') {
    cachedTier = 'low'
  } else {
    cachedTier = 'normal'
  }
  return cachedTier
}

/** Сброс кэша при смене пресета графики. */
export function resetSynthesisDeviceTierCache(): void {
  cachedTier = null
}
