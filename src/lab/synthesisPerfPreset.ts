/**
 * Единый пресет «быстрый профессиональный синтез».
 * См. video/README.md — заметки по записи экрана и настройке FPS.
 */
export const SYNTHESIS_PERF = {
  /** Полёт реагентов к центру (с) — чуть длиннее для читаемого схождения */
  streamFlyDur: 0.28,
  termStagger: 0.012,
  atomStagger: 0.003,
  /** Вспышка слияния */
  mergeFlashDur: 0.14,
  /** Появление продукта */
  productEntranceDur: 0.16,
  productHold: 0.12,
  /** Overlap: продукт появляется за столько сек до конца mergeFlash */
  productRevealOverlapSec: 0.05,
  /** Фаза ignite перед converge (мс); 0 = сразу converge в лаборатории */
  igniteSkipMs: 0,
  /** Порог атомов для облегчённых FX */
  liteFxAtomThreshold: 3,
  /** Cyber explore 3D */
  cyberCanvasDpr: 1 as number,
} as const
