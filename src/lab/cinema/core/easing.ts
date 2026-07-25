/**
 * ATOMLAB Cinema — кинематографические кривые.
 *
 * Единственный источник интерполяции для всей библиотеки: треки, камера, свет.
 * Все функции нормированы: f(0) = 0, f(1) = 1 (кроме `spike`, это импульс 0→1→0).
 */

export type EaseFn = (t: number) => number

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t)

export const Ease = {
  linear: (t: number) => clamp01(t),
  /** smoothstep — базовая «мягкая» кривая, ей анимируется 80% сцены */
  smooth: (t: number) => {
    const x = clamp01(t)
    return x * x * (3 - 2 * x)
  },
  /** smootherstep — нулевые 1-я и 2-я производные на концах, для медленных наездов камеры */
  smoother: (t: number) => {
    const x = clamp01(t)
    return x * x * x * (x * (x * 6 - 15) + 10)
  },
  inQuad: (t: number) => {
    const x = clamp01(t)
    return x * x
  },
  outQuad: (t: number) => {
    const x = clamp01(t)
    return 1 - (1 - x) * (1 - x)
  },
  inCubic: (t: number) => {
    const x = clamp01(t)
    return x * x * x
  },
  outCubic: (t: number) => {
    const x = clamp01(t)
    return 1 - Math.pow(1 - x, 3)
  },
  inOutCubic: (t: number) => {
    const x = clamp01(t)
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
  },
  outQuart: (t: number) => 1 - Math.pow(1 - clamp01(t), 4),
  /** резкий срыв — разрыв связи, вылет иона */
  inExpo: (t: number) => {
    const x = clamp01(t)
    return x <= 0 ? 0 : Math.pow(2, 10 * x - 10)
  },
  /** мгновенный старт и длинное торможение — «выброс» продукта */
  outExpo: (t: number) => {
    const x = clamp01(t)
    return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)
  },
  inSine: (t: number) => 1 - Math.cos((clamp01(t) * Math.PI) / 2),
  outSine: (t: number) => Math.sin((clamp01(t) * Math.PI) / 2),
  inOutSine: (t: number) => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2,
  /** небольшой перелёт цели — щелчок ионной пары Na⁺Cl⁻ */
  outBack: (t: number) => {
    const x = clamp01(t)
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
  },
  /** упругий доворот — кристаллизация, «защёлкивание» геометрии */
  outElastic: (t: number) => {
    const x = clamp01(t)
    if (x === 0 || x === 1) return x
    const c4 = (2 * Math.PI) / 3
    return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1
  },
  /** импульс: 0 → 1 → 0. Вспышки, ударные волны, искры */
  spike: (t: number) => {
    const x = clamp01(t)
    return Math.sin(Math.PI * x)
  },
  /** быстрый удар с длинным затуханием — тепловой импульс экзотермии */
  flash: (t: number) => {
    const x = clamp01(t)
    return x < 0.14 ? x / 0.14 : Math.pow(1 - (x - 0.14) / 0.86, 2.2)
  },
} as const satisfies Record<string, EaseFn>

export type EaseName = keyof typeof Ease

export function ease(name: EaseName | undefined, t: number): number {
  return (name ? Ease[name] : Ease.smooth)(t)
}

/** Линейная интерполяция без аллокаций (используется в горячем цикле). */
export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Нормировать x из [a, b] в [0, 1] c защитой от деления на ноль. */
export function norm(a: number, b: number, x: number): number {
  const d = b - a
  return d === 0 ? (x >= b ? 1 : 0) : clamp01((x - a) / d)
}

/** smoothstep(a, b, x) — самая частая операция сцены. */
export function smoothstep(a: number, b: number, x: number): number {
  return Ease.smooth(norm(a, b, x))
}
