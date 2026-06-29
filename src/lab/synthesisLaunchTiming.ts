import type { ReactorVisualTier } from '../chemistry/reactorVisualTier'
import { synthesisTimingScale } from '../chemistry/reactorVisualTier'
import {
  getSynthesisTimingProfile,
  SYNTHESIS_TIMING_BALANCED,
  type SynthesisTimingProfile,
} from './synthesisTimingProfile'
import { SYNTH_ANTI_STALL } from './synthesisAntiStall'

const DEFAULT_PROFILE = SYNTHESIS_TIMING_BALANCED

/** @deprecated Используйте profile из getSynthesisTimingProfile */
export const LAUNCH_STREAM_FLY_DUR = DEFAULT_PROFILE.streamFlyDur
export const LAUNCH_TERM_STAGGER = DEFAULT_PROFILE.termStagger
export const LAUNCH_ATOM_STAGGER = DEFAULT_PROFILE.atomStagger
export const LAUNCH_MERGE_FLASH_DUR = DEFAULT_PROFILE.mergeFlashDur
export const LAUNCH_PRODUCT_ENTRANCE_DUR = DEFAULT_PROFILE.productEntranceDur
export const LAUNCH_PRODUCT_HOLD = DEFAULT_PROFILE.productHold
export const SYNTHESIS_IGNITE_SKIP_MS = DEFAULT_PROFILE.igniteSkipMs

export function synthesisConvergeDurationSec(
  termCount: number,
  atomCount: number,
  tier: ReactorVisualTier = 'full',
  profile: SynthesisTimingProfile = DEFAULT_PROFILE,
): number {
  if (tier === 'cluster') {
    const maxTermIndex = Math.max(0, termCount - 1)
    return (
      profile.clusterFlyDur + maxTermIndex * profile.clusterTermStagger
    ) * synthesisTimingScale(tier)
  }
  const maxTermIndex = Math.max(0, termCount - 1)
  const maxAtomsPerTerm = Math.max(1, Math.ceil(atomCount / Math.max(1, termCount)))
  const maxStagger =
    maxTermIndex * profile.termStagger + (maxAtomsPerTerm - 1) * profile.atomStagger
  return (profile.streamFlyDur + maxStagger) * synthesisTimingScale(tier)
}

export function synthesisLaunchWatchdogMs(
  termCount: number,
  atomCount: number,
  tier: ReactorVisualTier = 'full',
  forceLite = false,
): number {
  const profile = getSynthesisTimingProfile(forceLite)
  if (profile.streamFlyDur <= 0 && profile.mergeFlashDur <= 0) {
    return Math.ceil((profile.productHold + 0.35) * 1000 + SYNTH_ANTI_STALL.runBudgetGraceMs)
  }
  const convergeDur = synthesisConvergeDurationSec(termCount, atomCount, tier, profile)
  const sec =
    convergeDur +
    profile.mergeFlashDur +
    profile.productEntranceDur +
    profile.productHold +
    0.28
  return Math.ceil(sec * 1000 + SYNTH_ANTI_STALL.runBudgetGraceMs)
}

export { getSynthesisTimingProfile, type SynthesisTimingProfile }
