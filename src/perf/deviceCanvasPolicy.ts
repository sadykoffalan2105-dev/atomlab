import type { GpuClass, SynthesisDeviceTier } from '../lab/synthesisDeviceTier'

export type LabPerfLevel = 'high' | 'low'

export type LabCanvasPolicy = {
  dpr: number | [number, number]
  antialias: boolean
}

/** Нижняя граница адаптивного DPR — доля базового. */
export const LAB_CANVAS_MIN_RESOLUTION_SCALE = 0.75

function readWindowDpr(): number {
  if (typeof window === 'undefined') return 1
  return window.devicePixelRatio || 1
}

/** Как calculateDpr в R3F: диапазон [min, max] зажимает devicePixelRatio. */
export function resolveBaseDpr(
  dpr: number | [number, number],
  devicePixelRatio: number = readWindowDpr(),
): number {
  return Array.isArray(dpr) ? Math.min(Math.max(dpr[0], devicePixelRatio), dpr[1]) : dpr
}

/**
 * Адаптивное разрешение: единственное, что губернатор меняет посреди запуска.
 * scale ≈ 1 → политика без изменений (тот же диапазон); иначе число base × scale,
 * не ниже LAB_CANVAS_MIN_RESOLUTION_SCALE × base, округлённое до 0.01.
 */
export function applyResolutionScaleToDpr(
  dpr: number | [number, number],
  resolutionScale: number,
  devicePixelRatio: number = readWindowDpr(),
): number | [number, number] {
  if (!(resolutionScale < 0.999)) return dpr
  const base = resolveBaseDpr(dpr, devicePixelRatio)
  const scale = Math.max(LAB_CANVAS_MIN_RESOLUTION_SCALE, resolutionScale)
  return Math.max(0.5, Math.round(base * scale * 100) / 100)
}

/**
 * DPR и AA для Lab Canvas.
 * В режиме редактирования реактора — стабильная политика (смена DPR при +/- ломает WebGL → белый экран).
 * `resolutionScale` меняет только губернатор во время запуска синтеза, редкими шагами (0.875 / 0.75).
 */
export function resolveLabCanvasPolicy(opts: {
  deviceTier: SynthesisDeviceTier
  perfLevel: LabPerfLevel
  synthesisRunActive: boolean
  reactorViewOpen: boolean
  coeffEditBurst?: boolean
  substanceView: boolean
  /** Класс GPU: встроенные «mid» (Iris Xe, Vega) держим на DPR 1 — hi-DPI ноутбуки иначе 1.25². */
  gpuClass?: GpuClass
  /** Масштаб DPR от губернатора (0.75…1), по умолчанию 1. */
  resolutionScale?: number
  /** Для тестов; по умолчанию window.devicePixelRatio. */
  devicePixelRatio?: number
}): LabCanvasPolicy {
  const policy = resolveBaseLabCanvasPolicy(opts)
  const scale = opts.resolutionScale ?? 1
  if (!(scale < 0.999)) return policy
  return {
    dpr: applyResolutionScaleToDpr(policy.dpr, scale, opts.devicePixelRatio ?? readWindowDpr()),
    antialias: policy.antialias,
  }
}

function resolveBaseLabCanvasPolicy(opts: {
  deviceTier: SynthesisDeviceTier
  perfLevel: LabPerfLevel
  synthesisRunActive: boolean
  reactorViewOpen: boolean
  substanceView: boolean
  gpuClass?: GpuClass
}): LabCanvasPolicy {
  const { deviceTier, perfLevel, synthesisRunActive, reactorViewOpen, substanceView } = opts

  const deviceLow = deviceTier === 'low'
  const hiDpr: number | [number, number] = opts.gpuClass === 'mid' ? 1 : [1, 1.25]

  /** Стабильный DPR на всём сеансе реактора — смена при settled/синтезе рвёт WebGL. */
  if (reactorViewOpen && !substanceView) {
    return deviceLow ? { dpr: 1, antialias: false } : { dpr: hiDpr, antialias: true }
  }

  // Free-lab / atom inspect: стабильный DPR.
  // Смена [1,1.25]↔1 от perfLevel при просадке FPS даёт периодическое мигание модели.
  if (!reactorViewOpen && !substanceView && !synthesisRunActive) {
    return deviceLow ? { dpr: 1, antialias: false } : { dpr: hiDpr, antialias: true }
  }

  const fpsLow = perfLevel === 'low'
  const heavyScene = synthesisRunActive || substanceView

  if (deviceLow || fpsLow) {
    return { dpr: 1, antialias: false }
  }

  if (heavyScene) {
    return { dpr: 1, antialias: false }
  }

  return { dpr: hiDpr, antialias: true }
}
