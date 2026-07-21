import type { SynthesisTimingProfile } from './synthesisTimingProfile'

/**
 * Защита от «зависаний» синтеза: провал кадров WebGL, блокировка main thread,
 * застревание фазы GSAP, долгий GPU compile.
 */
export const SYNTH_ANTI_STALL = {
  /** Пауза без отрисовки → invalidate (синтез). */
  canvasStallMs: 22,
  /** Пауза при редактировании уравнения (не во время активного +/-). */
  reactorStallMs: 36,
  /** Сколько раз подряд можно форсировать invalidate. */
  canvasBurstMax: 8,
  /** Δ между кадрами rAF — подозрение на блокировку main thread. */
  mainThreadGapMs: 72,
  /** Макс. burst при main-thread stall. */
  mainThreadBurstMax: 10,
  /** Минимальный интервал между recover-колбэками coverage guard. */
  coverageRecoverMs: 120,
  /** Пустых кадров до recover (синтез). */
  emptyFrameRecover: 1,
  /** Жёсткий таймаут compileAsync продукта. */
  gpuCompileMaxMs: 180,
  /** Кадров prewarm до «готово» без compileAsync — быстрый fallback. */
  gpuCompileFallbackFrames: 2,
  /** Макс. ожидание refs GSAP converge. */
  convergeRefsMaxMs: 1_400,
  /** Запас к расчётному бюджету run watchdog. */
  runBudgetGraceMs: 280,
  /** Ignite не дольше (мс). */
  igniteMaxMs: 420,
  /** MergeFlash не дольше расчёта + (мс). */
  mergeFlashGraceMs: 220,
  /** Product → onDone не дольше расчёта + (мс). Instant: collapse + paint. */
  productDoneGraceMs: 2_400,
} as const

export type SynthesisAntiStallGuard = {
  markRendered: () => void
  tick: (opts: {
    invalidate: () => void
    reactorEdit: boolean
    synthesisLive: boolean
    onMainThreadStall?: () => void
  }) => boolean
  reset: () => void
}

/** Canvas + main-thread watchdog (LabScene useFrame). */
export function createSynthesisAntiStallGuard(): SynthesisAntiStallGuard {
  let lastRenderMs = performance.now()
  let lastFrameMs = performance.now()
  let canvasBurst = 0
  let mainBurst = 0
  let lastMainRecoverMs = 0

  return {
    markRendered() {
      const now = performance.now()
      lastRenderMs = now
      lastFrameMs = now
      canvasBurst = 0
    },
    tick({ invalidate, reactorEdit, synthesisLive, onMainThreadStall }) {
      const now = performance.now()
      const active = synthesisLive || reactorEdit
      if (!active) {
        lastFrameMs = now
        canvasBurst = 0
        mainBurst = 0
        return false
      }

      const frameGap = now - lastFrameMs
      lastFrameMs = now

      if (frameGap > SYNTH_ANTI_STALL.mainThreadGapMs) {
        mainBurst += 1
        if (mainBurst <= SYNTH_ANTI_STALL.mainThreadBurstMax) {
          if (now - lastMainRecoverMs > 64) {
            lastMainRecoverMs = now
            onMainThreadStall?.()
          }
          invalidate()
          return true
        }
      } else {
        mainBurst = Math.max(0, mainBurst - 1)
      }

      const renderGap = now - lastRenderMs
      const limit = reactorEdit
        ? SYNTH_ANTI_STALL.reactorStallMs
        : SYNTH_ANTI_STALL.canvasStallMs
      if (renderGap < limit) {
        canvasBurst = 0
        return false
      }

      canvasBurst += 1
      if (canvasBurst <= SYNTH_ANTI_STALL.canvasBurstMax) {
        invalidate()
        return true
      }
      return false
    },
    reset() {
      const now = performance.now()
      lastRenderMs = now
      lastFrameMs = now
      canvasBurst = 0
      mainBurst = 0
      lastMainRecoverMs = 0
    },
  }
}

/** Полный бюджет run (LaboratoryPage watchdog + SynthesisOnLabScene). */
export function computeSynthesisRunBudgetMs(
  useConverge: boolean,
  termCount: number,
  atomCount: number,
  profile: SynthesisTimingProfile,
  flyDurFallback = 0.26,
): number {
  const maxTermIndex = Math.max(0, termCount - 1)
  const maxAtomsPerTerm = Math.max(1, Math.ceil(atomCount / Math.max(1, termCount)))
  const maxStagger =
    maxTermIndex * profile.termStagger + (maxAtomsPerTerm - 1) * profile.atomStagger
  const convergeDur = useConverge ? profile.streamFlyDur + maxStagger : flyDurFallback
  const sec =
    convergeDur +
    profile.mergeFlashDur +
    profile.productEntranceDur +
    profile.productHold +
    0.28
  return Math.ceil(sec * 1000 + SYNTH_ANTI_STALL.runBudgetGraceMs)
}

export type SynthesisPhaseStallGuard = {
  enter: (phase: string) => void
  /** true если фазу нужно форсировать вперёд */
  check: (
    phase: string,
    budgets: {
      convergeMs: number
      mergeFlashMs: number
      productDoneMs: number
    },
  ) => 'ignite' | 'converge' | 'mergeFlash' | 'product' | 'done' | null
  reset: () => void
}

export function createSynthesisPhaseStallGuard(): SynthesisPhaseStallGuard {
  let phase = ''
  let enteredMs = 0

  return {
    enter(next) {
      if (phase === next) return
      phase = next
      enteredMs = performance.now()
    },
    check(current, budgets) {
      if (phase !== current) {
        phase = current
        enteredMs = performance.now()
      }
      const elapsed = performance.now() - enteredMs

      switch (current) {
        case 'ignite':
          if (elapsed > SYNTH_ANTI_STALL.igniteMaxMs) return 'converge'
          break
        case 'converge':
          if (elapsed > budgets.convergeMs + SYNTH_ANTI_STALL.runBudgetGraceMs) {
            return 'mergeFlash'
          }
          break
        case 'mergeFlash':
          if (elapsed > budgets.mergeFlashMs + SYNTH_ANTI_STALL.mergeFlashGraceMs) {
            return 'product'
          }
          break
        case 'product':
          if (elapsed > budgets.productDoneMs + SYNTH_ANTI_STALL.productDoneGraceMs) {
            return 'done'
          }
          break
        default:
          break
      }
      return null
    },
    reset() {
      phase = ''
      enteredMs = 0
    },
  }
}

/** Таймер compileAsync — не ждём GPU бесконечно. */
export function scheduleGpuCompileWatchdog(
  onTimeout: () => void,
  ms = SYNTH_ANTI_STALL.gpuCompileMaxMs,
): () => void {
  const id = window.setTimeout(onTimeout, ms)
  return () => window.clearTimeout(id)
}
