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

/** Губернатор FPS: при просадке включаем lite-режим синтеза. */
export type FpsGovernorState = {
  forceLite: boolean
  tick: (fps: number) => void
  reset: () => void
}

export function createFpsGovernor(opts?: { enterFps?: number; holdSec?: number }): FpsGovernorState {
  const enterFps = opts?.enterFps ?? 50
  const holdSec = opts?.holdSec ?? 0.5
  let lowAccum = 0
  let forceLite = false

  return {
    get forceLite() {
      return forceLite
    },
    tick(fps: number) {
      if (fps < enterFps) lowAccum += 0.25
      else lowAccum = Math.max(0, lowAccum - 0.25)
      if (lowAccum >= holdSec) forceLite = true
    },
    reset() {
      lowAccum = 0
      forceLite = false
    },
  }
}
