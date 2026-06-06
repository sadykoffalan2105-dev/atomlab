/**
 * Единый пресет «быстрый профессиональный синтез».
 * См. video/README.md — заметки по записи экрана и настройке FPS.
 */
export const SYNTHESIS_PERF = {
  /** Полёт реагентов к центру (с) — быстрый, без «зависания» */
  streamFlyDur: 0.18,
  termStagger: 0.007,
  atomStagger: 0.002,
  /** Вспышка слияния */
  mergeFlashDur: 0.09,
  /** Появление продукта */
  productEntranceDur: 0.11,
  productHold: 0.07,
  /** Overlap: продукт появляется за столько сек до конца mergeFlash */
  productRevealOverlapSec: 0.06,
  /** Фаза ignite перед converge (мс); 0 = сразу converge в лаборатории */
  igniteSkipMs: 0,
  /** Порог атомов для облегчённых FX и lite-моделей */
  liteFxAtomThreshold: 5,
  /** Плотное превью: реже drift/guard */
  denseAtomThreshold: 10,
  /** Полная детализация AtomStructureModel (орбиты 48 seg) */
  fullDetailAtomThreshold: 12,
  /** Макс. атомов с анимацией электронов */
  maxAnimatedAtoms: 24,
  /** FPS ниже порога → forceLite (LabScene governor) */
  fpsLiteEnter: 52,
  fpsLiteExit: 58,
  fpsLiteHoldSec: 0.3,
  /** Cyber explore 3D */
  cyberCanvasDpr: 1 as number,
} as const
