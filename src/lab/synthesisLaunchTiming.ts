/** Плавные тайминги синтеза — «запуск корабля»: длиннее, постепеннее. */
export const LAUNCH_STREAM_FLY_DUR = 0.72
export const LAUNCH_TERM_STAGGER = 0.072
export const LAUNCH_ATOM_STAGGER = 0.016
export const LAUNCH_MERGE_FLASH_DUR = 0.42
export const LAUNCH_PRODUCT_ENTRANCE_DUR = 0.62
export const LAUNCH_PRODUCT_HOLD = 0.95

export function synthesisConvergeDurationSec(termCount: number, atomCount: number): number {
  const maxTermIndex = Math.max(0, termCount - 1)
  const maxAtomsPerTerm = Math.max(1, Math.ceil(atomCount / Math.max(1, termCount)))
  const maxStagger =
    maxTermIndex * LAUNCH_TERM_STAGGER + (maxAtomsPerTerm - 1) * LAUNCH_ATOM_STAGGER
  return LAUNCH_STREAM_FLY_DUR + maxStagger
}

export function synthesisLaunchWatchdogMs(termCount: number, atomCount: number): number {
  const convergeDur = synthesisConvergeDurationSec(termCount, atomCount)
  return Math.ceil((convergeDur + LAUNCH_MERGE_FLASH_DUR + LAUNCH_PRODUCT_ENTRANCE_DUR + LAUNCH_PRODUCT_HOLD + 0.45) * 1000)
}
