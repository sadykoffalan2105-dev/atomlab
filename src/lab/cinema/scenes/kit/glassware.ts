/**
 * ATOMLAB Cinema kit — ПРОФИЛИ ЛАБОРАТОРНОЙ ПОСУДЫ без React и без R3F (чистые числа формы).
 *
 * Профиль — ломаная (r, y) от оси вращения вверх: из неё строится THREE.LatheGeometry. Модуль читают
 * и сцены кино-ядра (пробирка в школьной сцене раствора), и VR-лаборатория (vrLabGlassLibrary), и тест
 * в Node — поэтому здесь нет импорта three.
 */

export type GlassProfilePoint = readonly [number, number]
export type GlassProfile = readonly GlassProfilePoint[]

/** Пробирка VR-лаборатории (метры): округлое дно, прямая стенка, узкое горло. */
export const TEST_TUBE_PROFILE: GlassProfile = [
  [0, 0],
  [0.03, 0],
  [0.038, 0.025],
  [0.04, 0.48],
  [0.024, 0.545],
  [0.02, 0.595],
]

/**
 * Школьная пробирка: полусферическое дно радиуса r, прямая стенка до высоты h, отогнутый край.
 * Точки — от оси (0, 0) по дну, стенке и краю; segments — точек на четверть окружности дна.
 */
export function roundTestTubeProfile(r: number, h: number, segments = 10): GlassProfilePoint[] {
  const out: GlassProfilePoint[] = [[0, 0]]
  for (let i = 1; i <= segments; i++) {
    const a = (i / segments) * (Math.PI / 2)
    out.push([r * Math.sin(a), r - r * Math.cos(a)])
  }
  out.push([r, h - r * 0.12])
  out.push([r * 1.1, h])
  return out
}

/** Уровень жидкости: профиль той же пробирки, обрезанный на высоте level (0…h), чуть внутри стенки. */
export function liquidProfile(r: number, level: number, inset = 0.9, segments = 10): GlassProfilePoint[] {
  const ri = r * inset
  const out: GlassProfilePoint[] = [[0, r - ri]]
  for (let i = 1; i <= segments; i++) {
    const a = (i / segments) * (Math.PI / 2)
    const y = r - ri * Math.cos(a)
    if (y >= level) {
      out.push([ri * Math.sin(a), level])
      out.push([0, level])
      return out
    }
    out.push([ri * Math.sin(a), y])
  }
  out.push([ri, Math.max(level, r)])
  out.push([0, Math.max(level, r)])
  return out
}
