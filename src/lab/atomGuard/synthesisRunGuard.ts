/** Защита от двойного завершения синтеза и гонок runId. */

export type SynthesisRunGuard = {
  beginRun: (runId: number) => void
  tryCompleteSuccess: (runId: number, fn: () => void) => boolean
  tryOnDone: (runId: number, fn: () => void) => boolean
  reset: () => void
}

export function createSynthesisRunGuard(): SynthesisRunGuard {
  let activeRunId = 0
  let completing = false
  let doneFired = false

  return {
    beginRun(runId: number) {
      activeRunId = runId
      completing = false
      doneFired = false
    },
    tryCompleteSuccess(runId: number, fn: () => void): boolean {
      if (runId !== activeRunId || completing) return false
      completing = true
      fn()
      return true
    },
    tryOnDone(runId: number, fn: () => void): boolean {
      if (runId !== activeRunId || doneFired || completing) return false
      doneFired = true
      fn()
      return true
    },
    reset() {
      activeRunId = 0
      completing = false
      doneFired = false
    },
  }
}

/** Губернатор FPS — см. synthesisQualityLadder.ts (адаптивные уровни 0–4). */
export {
  createFpsGovernor,
  createSynthesisQualityGovernor,
  type SynthesisQualityGovernor,
} from '../synthesisQualityLadder'
