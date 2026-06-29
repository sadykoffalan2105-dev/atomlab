/**
 * Единый пресет «быстрый профессиональный синтез».
 * См. video/README.md — заметки по записи экрана и настройке FPS.
 */
export const SYNTHESIS_PERF = {
  /** Полёт реагентов к центру (с) — быстрый, без «зависания» */
  streamFlyDur: 0.15,
  termStagger: 0.006,
  atomStagger: 0.0015,
  /** Вспышка слияния */
  mergeFlashDur: 0.07,
  /** Появление продукта */
  productEntranceDur: 0.09,
  productHold: 0.05,
  /** Overlap: продукт появляется за столько сек до конца mergeFlash */
  productRevealOverlapSec: 0.05,
  /** Фаза ignite перед converge (мс); 0 = сразу converge в лаборатории */
  igniteSkipMs: 0,
  /** Порог атомов для облегчённых FX (не замена модели — только меньше сегментов орбит). */
  liteFxAtomThreshold: 22,
  /** Плотное превью: реже drift/guard */
  denseAtomThreshold: 14,
  /** Lite с первого кадра синтеза только при очень плотном превью */
  synthLiteStartThreshold: 14,
  /** Полная детализация AtomStructureModel (орбиты 48 seg) */
  fullDetailAtomThreshold: 12,
  /** Макс. атомов с анимацией электронов */
  maxAnimatedAtoms: 48,
  /** Cluster mode — короткий burst per term (с) */
  clusterFlyDur: 0.12,
  clusterTermStagger: 0.04,
  /** FPS ниже порога → forceLite (LabScene governor) */
  fpsLiteEnter: 48,
  fpsLiteExit: 54,
  fpsLiteHoldSec: 0.25,
  /** Cyber explore 3D */
  cyberCanvasDpr: 1 as number,
} as const
