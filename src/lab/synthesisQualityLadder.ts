import type { SynthesisDeviceTier } from './synthesisDeviceTier'
import { SYNTHESIS_PERF } from './synthesisPerfPreset'
import { FIXED_SYNTHESIS_CAP } from '../perf/graphicsSettings'

/** 0=MINIMAL … 4=ULTRA */
export type SynthesisQualityLevel = 0 | 1 | 2 | 3 | 4

export const SYNTHESIS_QUALITY_MINIMAL = 0 as const
export const SYNTHESIS_QUALITY_LITE = 1 as const
export const SYNTHESIS_QUALITY_BALANCED = 2 as const
export const SYNTHESIS_QUALITY_HIGH = 3 as const
export const SYNTHESIS_QUALITY_ULTRA = 4 as const

export type SynthesisQualityFeatures = {
  bloomConverge: boolean
  bloomMerge: boolean
  depthOfField: boolean
  glassAtoms: boolean
  neonBonds: boolean
  arcReactor: boolean
  birthEntrance: boolean
  electronDrift: boolean
}

export type SynthesisQualityGovernor = {
  readonly qualityLevel: SynthesisQualityLevel
  /** Совместимость: level ≤ 1 */
  readonly forceLite: boolean
  setCap: (cap: SynthesisQualityLevel) => void
  reset: (initial?: SynthesisQualityLevel) => void
  tick: (fps: number) => void
}

/** Качество превью при редактировании коэффициентов (без активного синтеза). */
export function computeReactorEditQualityCap(
  atomCount: number,
  coeffEditBurst = false,
): SynthesisQualityLevel {
  if (coeffEditBurst) {
    if (atomCount > 6) return SYNTHESIS_QUALITY_LITE
    return SYNTHESIS_QUALITY_BALANCED
  }
  if (atomCount > SYNTHESIS_PERF.liteFxAtomThreshold) return SYNTHESIS_QUALITY_LITE
  if (atomCount > SYNTHESIS_PERF.denseAtomThreshold) return SYNTHESIS_QUALITY_BALANCED
  return SYNTHESIS_QUALITY_HIGH
}

/** Статический потолок качества — всегда High; только плотность атомов может снизить cap. */
export function computeStaticQualityCap(opts: {
  deviceTier: SynthesisDeviceTier
  atomCount: number
  visualTier: 'full' | 'lite' | 'cluster'
}): SynthesisQualityLevel {
  const { atomCount, visualTier } = opts
  let cap: SynthesisQualityLevel = FIXED_SYNTHESIS_CAP

  if (visualTier === 'cluster') {
    cap = Math.min(cap, SYNTHESIS_QUALITY_LITE) as SynthesisQualityLevel
  }
  if (atomCount > SYNTHESIS_PERF.liteFxAtomThreshold) {
    cap = Math.min(cap, SYNTHESIS_QUALITY_LITE) as SynthesisQualityLevel
  } else if (atomCount > SYNTHESIS_PERF.denseAtomThreshold) {
    cap = Math.min(cap, SYNTHESIS_QUALITY_BALANCED) as SynthesisQualityLevel
  }
  return cap
}

export function featuresForQuality(
  level: SynthesisQualityLevel,
  phase: string,
): SynthesisQualityFeatures {
  const merge = phase === 'mergeFlash' || phase === 'product'
  const converge =
    phase === 'converge' || phase === 'ignite' || phase === 'flying' || merge

  switch (level) {
    case SYNTHESIS_QUALITY_MINIMAL:
      return {
        bloomConverge: false,
        bloomMerge: false,
        depthOfField: false,
        glassAtoms: false,
        neonBonds: false,
        arcReactor: false,
        birthEntrance: false,
        electronDrift: false,
      }
    case SYNTHESIS_QUALITY_LITE:
      return {
        bloomConverge: false,
        bloomMerge: merge,
        depthOfField: false,
        glassAtoms: false,
        neonBonds: false,
        arcReactor: merge,
        birthEntrance: false,
        electronDrift: false,
      }
    case SYNTHESIS_QUALITY_BALANCED:
      return {
        bloomConverge: false,
        bloomMerge: merge,
        depthOfField: false,
        glassAtoms: merge,
        neonBonds: merge,
        arcReactor: converge,
        birthEntrance: merge,
        electronDrift: false,
      }
    case SYNTHESIS_QUALITY_HIGH:
      return {
        bloomConverge: false,
        bloomMerge: merge,
        depthOfField: false,
        glassAtoms: merge,
        neonBonds: merge,
        arcReactor: converge,
        birthEntrance: true,
        electronDrift: false,
      }
    default:
      return {
        bloomConverge: false,
        bloomMerge: merge,
        depthOfField: false,
        glassAtoms: merge,
        neonBonds: merge,
        arcReactor: converge,
        birthEntrance: true,
        electronDrift: false,
      }
  }
}

export function qualityLevelToForceLite(level: SynthesisQualityLevel): boolean {
  return level <= SYNTHESIS_QUALITY_LITE
}

/**
 * Адаптивный губернатор: быстро понижает уровень при просадке FPS, медленно повышает.
 */
export function createSynthesisQualityGovernor(): SynthesisQualityGovernor {
  let level: SynthesisQualityLevel = SYNTHESIS_QUALITY_HIGH
  let cap: SynthesisQualityLevel = SYNTHESIS_QUALITY_HIGH
  let emaFps = 60
  let downgradeHold = 0
  let upgradeHold = 0
  /** Не опускаем ниже BALANCED — визуально остаётся «высоким». */
  const floor: SynthesisQualityLevel = SYNTHESIS_QUALITY_BALANCED

  const clampLevel = (v: number): SynthesisQualityLevel =>
    Math.max(floor, Math.min(cap, Math.round(v))) as SynthesisQualityLevel

  return {
    get qualityLevel() {
      return level
    },
    get forceLite() {
      return qualityLevelToForceLite(level)
    },
    setCap(nextCap: SynthesisQualityLevel) {
      cap = nextCap
      level = Math.min(level, cap) as SynthesisQualityLevel
    },
    reset(initial?: SynthesisQualityLevel) {
      const start = initial ?? cap
      level = Math.min(start, cap) as SynthesisQualityLevel
      emaFps = 60
      downgradeHold = 0
      upgradeHold = 0
    },
    tick(fps: number) {
      emaFps = emaFps * 0.88 + fps * 0.12
      const f = emaFps

      let target = level
      if (f < 32) target = Math.min(target, SYNTHESIS_QUALITY_BALANCED) as SynthesisQualityLevel
      else if (f < 42) target = Math.min(target, SYNTHESIS_QUALITY_HIGH) as SynthesisQualityLevel

      if (target < level) {
        downgradeHold += 0.25
        if (downgradeHold >= 0.2) {
          level = clampLevel(target)
          downgradeHold = 0
          upgradeHold = 0
        }
      } else {
        downgradeHold = Math.max(0, downgradeHold - 0.12)
      }

      if (f >= 105 && level < cap) {
        upgradeHold += 0.25
        if (upgradeHold >= 0.55) {
          level = clampLevel(level + 1)
          upgradeHold = 0
        }
      } else if (f >= 92 && level < cap) {
        upgradeHold += 0.25
        if (upgradeHold >= 1.05) {
          level = clampLevel(level + 1)
          upgradeHold = 0
        }
      } else {
        upgradeHold = Math.max(0, upgradeHold - 0.08)
      }
    },
  }
}

/** createFpsGovernor — тонкая обёртка для обратной совместимости. */
export function createFpsGovernor(opts?: {
  enterFps?: number
  exitFps?: number
  holdSec?: number
}): { forceLite: boolean; tick: (fps: number) => void; reset: () => void } {
  const gov = createSynthesisQualityGovernor()
  const enterFps = opts?.enterFps ?? SYNTHESIS_PERF.fpsLiteEnter
  void enterFps
  return {
    get forceLite() {
      return gov.forceLite
    },
    tick(fps: number) {
      gov.tick(fps)
    },
    reset() {
      gov.reset(SYNTHESIS_QUALITY_HIGH)
    },
  }
}
