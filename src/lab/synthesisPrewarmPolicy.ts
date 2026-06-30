import type { CompoundDef } from '../types/chemistry'

/** Популярные вещества школьного курса — фоновый GPU-прогрев в простое. */
export const POPULAR_SYNTHESIS_COMPOUND_IDS = [
  'h2o',
  'nacl',
  'salt_k2cr2o7',
  'h2so4',
  'co2',
  'h2',
  'o2',
  'nh3',
  'cao',
  'fe2o3',
] as const

export function resolvePopularSynthesisCompounds(
  compoundById: Record<string, CompoundDef>,
): CompoundDef[] {
  const out: CompoundDef[] = []
  for (const id of POPULAR_SYNTHESIS_COMPOUND_IDS) {
    const c = compoundById[id]
    if (c) out.push(c)
  }
  return out
}

/** Можно ли безопасно GPU-prewarm (не во время burst +/-). */
export function canIdleGpuPrewarm(opts: {
  reactorOpen: boolean
  coeffEditBurst: boolean
  synthesisRunActive: boolean
  hasProduct: boolean
}): boolean {
  return (
    opts.reactorOpen &&
    opts.hasProduct &&
    !opts.coeffEditBurst &&
    !opts.synthesisRunActive
  )
}
