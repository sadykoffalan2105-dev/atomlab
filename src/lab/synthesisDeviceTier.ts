/** Грубая оценка устройства — всегда normal (качество фиксировано на High). */
export type SynthesisDeviceTier = 'low' | 'normal'

let cachedTier: SynthesisDeviceTier | null = null

export function getSynthesisDeviceTier(): SynthesisDeviceTier {
  if (cachedTier) return cachedTier
  cachedTier = 'normal'
  return cachedTier
}

export function resetSynthesisDeviceTierCache(): void {
  cachedTier = null
}
