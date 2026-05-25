/**
 * Константы и отложенные колбэки для стабильности лабораторного Canvas (R3F / react-use-measure).
 * Не устраняют сбои WebGL, но снижают риск «белого» кадра из-за блокировки main thread.
 */

/** Минимальная высота области под WebGL (подстраховка flex-схлопывания). */
export const LAB_CANVAS_MIN_HEIGHT_REM = 17.778
export const LAB_CANVAS_MIN_HEIGHT_VH = 40

/** Подложка под canvas (совпадает с LabScene / .canvasWrap). */
export const LAB_CANVAS_FALLBACK_BG = '#03040a'

type IdleDeadlineLike = { didTimeout: boolean; timeRemaining: () => number }

/**
 * Выполнить `fn` в idle или сразу после текущего кадра — не блокировать ввод и отрисовку.
 */
export function scheduleIdleMatch(fn: () => void): void {
  const ric = (
    globalThis as typeof globalThis & {
      requestIdleCallback?: (cb: (d: IdleDeadlineLike) => void, opts?: { timeout: number }) => number
    }
  ).requestIdleCallback
  if (typeof ric === 'function') {
    ric(
      () => {
        fn()
      },
      { timeout: 120 },
    )
    return
  }
  queueMicrotask(fn)
}
