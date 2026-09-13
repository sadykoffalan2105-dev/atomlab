/**
 * Замер производительности лаборатории — только для разработки и стендов.
 *
 * Включён в DEV и в сборке с `?perf=1` в адресе. Скрипты (scripts/perf-*.mjs)
 * читают `window.__atomlabPerf.snapshot()`: время кадра по перцентилям и
 * renderer.info за кадр целиком — со всеми проходами пост-обработки, а не
 * только последним (autoReset выключается, сброс делаем сами раз в кадр).
 */

export type LabPerfSnapshot = {
  frames: number
  fps: number
  frameMs: { p50: number; p95: number; p99: number; max: number }
  calls: number
  triangles: number
  points: number
  programs: number
  geometries: number
  textures: number
  dpr: number
  width: number
  height: number
}

export type LabPerfApi = {
  snapshot: () => LabPerfSnapshot
  reset: () => void
  /** сцена three.js — только для разбора стоимости слоёв в perf-скриптах */
  scene?: unknown
}

export function isPerfProbeEnabled(): boolean {
  if (import.meta.env.DEV) return true
  try {
    return /[?&#]perf=1\b/.test(window.location.href)
  } catch {
    return false
  }
}

const WINDOW = 600

export function createFrameStats() {
  const samples = new Float32Array(WINDOW)
  let count = 0
  let head = 0
  let last = 0
  return {
    tick(now: number) {
      if (last > 0) {
        samples[head] = now - last
        head = (head + 1) % WINDOW
        count = Math.min(WINDOW, count + 1)
      }
      last = now
    },
    reset() {
      count = 0
      head = 0
      last = 0
    },
    summary() {
      const arr = Array.from(samples.subarray(0, count)).sort((a, b) => a - b)
      const q = (p: number) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(p * arr.length))]! : 0)
      const mean = arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0
      return {
        frames: arr.length,
        fps: mean > 0 ? 1000 / mean : 0,
        frameMs: { p50: q(0.5), p95: q(0.95), p99: q(0.99), max: arr.length ? arr[arr.length - 1]! : 0 },
      }
    },
  }
}
