import { SYNTHESIS_PERF } from './synthesisPerfPreset'
import type { ReactorVisualTier } from '../chemistry/reactorVisualTier'
import { synthesisTimingScale } from '../chemistry/reactorVisualTier'

/** Быстрый синтез — короткие фазы, читаемый полёт атомов (пресет video/README). */
export const LAUNCH_STREAM_FLY_DUR = SYNTHESIS_PERF.streamFlyDur
export const LAUNCH_TERM_STAGGER = SYNTHESIS_PERF.termStagger
export const LAUNCH_ATOM_STAGGER = SYNTHESIS_PERF.atomStagger
export const LAUNCH_MERGE_FLASH_DUR = SYNTHESIS_PERF.mergeFlashDur
export const LAUNCH_PRODUCT_ENTRANCE_DUR = SYNTHESIS_PERF.productEntranceDur
export const LAUNCH_PRODUCT_HOLD = SYNTHESIS_PERF.productHold
export const SYNTHESIS_IGNITE_SKIP_MS = SYNTHESIS_PERF.igniteSkipMs

export function synthesisConvergeDurationSec(
  termCount: number,
  atomCount: number,
  tier: ReactorVisualTier = 'full',
): number {
  if (tier === 'cluster') {
    const maxTermIndex = Math.max(0, termCount - 1)
    return (
      SYNTHESIS_PERF.clusterFlyDur + maxTermIndex * SYNTHESIS_PERF.clusterTermStagger
    ) * synthesisTimingScale(tier)
  }
  const maxTermIndex = Math.max(0, termCount - 1)
  const maxAtomsPerTerm = Math.max(1, Math.ceil(atomCount / Math.max(1, termCount)))
  const maxStagger =
    maxTermIndex * LAUNCH_TERM_STAGGER + (maxAtomsPerTerm - 1) * LAUNCH_ATOM_STAGGER
  return (LAUNCH_STREAM_FLY_DUR + maxStagger) * synthesisTimingScale(tier)
}

export function synthesisLaunchWatchdogMs(
  termCount: number,
  atomCount: number,
  tier: ReactorVisualTier = 'full',
): number {
  const convergeDur = synthesisConvergeDurationSec(termCount, atomCount, tier)
  return Math.ceil(
    (convergeDur + LAUNCH_MERGE_FLASH_DUR + LAUNCH_PRODUCT_ENTRANCE_DUR + LAUNCH_PRODUCT_HOLD + 0.15) *
      1000,
  )
}
