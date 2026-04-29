/**
 * Камера/орбита мини-героя в карточке вещества (`CatalogMoleculeHero`).
 * Синтез + settled приводим к ним, чтобы весь кадр совпадал с каталогом 3D.
 */
export const CATALOG_HERO_VIEW = {
  cameraPosition: [0, 0.12, 2.7] as [number, number, number],
  fov: 42,
  target: [0, 0, 0] as [number, number, number],
  /** Фиксированный радиус орбиты, как в карточке (без сильного «уезда» назад). */
  minDistance: 2.7,
  maxDistance: 2.7,
  minPolarAngle: Math.PI * 0.38,
  maxPolarAngle: Math.PI * 0.62,
} as const

/**
 * Параметры OrbitControls для основного лабораторного Canvas.
 * Синтез (synth) отключает только зум; вращение с демпфированием остаётся на всём FSM.
 */
export const LAB_ORBIT = {
  minDistance: 2.1,
  maxDistance: 9.8,
  minPolarAngle: Math.PI * 0.3,
  maxPolarAngle: Math.PI * 0.58,
  target: [0, 0.15, 0] as [number, number, number],
  enableDamping: true,
  dampingFactor: 0.06,
} as const
