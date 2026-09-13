import type { EaseFn } from './easing'

/**
 * ATOMLAB Cinema — пружины и затухание (вторичное движение).
 *
 * Все шаги — АНАЛИТИЧЕСКОЕ решение осциллятора
 *   x'' + 2ζω·x' + ω²·(x − target) = 0
 * в замкнутой форме, а не явный Эйлер. Поэтому результат точен для любого dt:
 * один шаг dt = 1 даёт то же, что десять шагов по 0.1, и поведение не зависит
 * от частоты кадров (60 Гц на ПК и 24 Гц на слабом телефоне выглядят одинаково).
 *
 *   ω (omega) — собственная угловая частота, рад/с (период ≈ 2π/ω);
 *   ζ (zeta)  — коэффициент затухания: 0 — вечные колебания, <1 — с перелётом,
 *               1 — критическое (быстрее всего без перелёта), >1 — вязкое.
 *
 * Горячие функции не аллоцируют: коэффициенты шага пишутся в модульные переменные.
 */

export type SpringState = { x: number; v: number }

// Шаг линейной системы: y(dt) = A·y0 + B·v0,  v(dt) = C·y0 + D·v0,  где y = x − target.
let _A = 1
let _B = 0
let _C = 0
let _D = 1

/** Порог, в котором ζ считаем критическим (ветви решения численно сходятся). */
const CRITICAL_EPS = 1e-4

function springCoefficients(omega: number, zeta: number, dt: number): void {
  if (!(dt > 0)) {
    _A = 1
    _B = 0
    _C = 0
    _D = 1
    return
  }
  if (!(omega > 0)) {
    // Пружины нет — свободное движение с постоянной скоростью.
    _A = 1
    _B = dt
    _C = 0
    _D = 1
    return
  }
  const z = zeta > 0 ? zeta : 0
  if (Math.abs(z - 1) < CRITICAL_EPS) {
    // Критическое: y = (y0 + (v0 + ω·y0)·t)·e^(−ωt)
    const wt = omega * dt
    const e = Math.exp(-wt)
    _A = (1 + wt) * e
    _B = dt * e
    _C = -omega * omega * dt * e
    _D = (1 - wt) * e
  } else if (z < 1) {
    // Недодемпфированное: затухающий косинус с частотой ωd = ω·√(1 − ζ²)
    const wd = omega * Math.sqrt(1 - z * z)
    const e = Math.exp(-z * omega * dt)
    const c = Math.cos(wd * dt)
    const s = Math.sin(wd * dt) / wd
    _A = e * (c + z * omega * s)
    _B = e * s
    _C = -e * omega * omega * s
    _D = e * (c - z * omega * s)
  } else {
    // Передемпфированное: сумма двух экспонент, корни r1·r2 = ω².
    const root = Math.sqrt(z * z - 1)
    // Устойчивая к потере точности форма медленного корня при больших ζ.
    const r1 = -omega / (z + root)
    const r2 = -omega * (z + root)
    const e1 = Math.exp(r1 * dt)
    const e2 = Math.exp(r2 * dt)
    const inv = 1 / (r1 - r2)
    _A = (r1 * e2 - r2 * e1) * inv
    _B = (e1 - e2) * inv
    _C = r1 * r2 * (e2 - e1) * inv
    _D = (r1 * e1 - r2 * e2) * inv
  }
}

/**
 * Шаг пружины к цели: мутирует `state` (x — положение, v — скорость).
 * Точен для любого dt (замкнутая форма), не аллоцирует.
 */
export function springStep(state: SpringState, target: number, omega: number, zeta: number, dt: number): void {
  springCoefficients(omega, zeta, dt)
  const y0 = state.x - target
  const v0 = state.v
  state.x = target + _A * y0 + _B * v0
  state.v = _C * y0 + _D * v0
}

/**
 * Векторная пружина на слотах Float32Array (xyz × N), как в пулах `core/pools.ts`:
 * положение pos[i*3..i*3+2], скорость vel[i*3..i*3+2]. Коэффициенты считаются один раз
 * на все три оси.
 */
export function springStepVec3(
  pos: Float32Array,
  vel: Float32Array,
  i: number,
  tx: number,
  ty: number,
  tz: number,
  omega: number,
  zeta: number,
  dt: number,
): void {
  springCoefficients(omega, zeta, dt)
  const o = i * 3
  const yx = pos[o]! - tx
  const yy = pos[o + 1]! - ty
  const yz = pos[o + 2]! - tz
  const vx = vel[o]!
  const vy = vel[o + 1]!
  const vz = vel[o + 2]!
  pos[o] = tx + _A * yx + _B * vx
  pos[o + 1] = ty + _A * yy + _B * vy
  pos[o + 2] = tz + _A * yz + _B * vz
  vel[o] = _C * yx + _D * vx
  vel[o + 1] = _C * yy + _D * vy
  vel[o + 2] = _C * yz + _D * vz
}

/**
 * Экспоненциальное сглаживание, не зависящее от частоты кадров:
 *   current → target с остатком e^(−λ·dt).
 * Замена «lerp(current, target, 0.14) каждый кадр» (которое на 30 Гц вдвое медленнее, чем на 60).
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt)
}

/** Доля шага для THREE `.lerp(target, alpha)`: alpha = 1 − e^(−λ·dt). */
export function dampAlpha(lambda: number, dt: number): number {
  return 1 - Math.exp(-lambda * dt)
}

/**
 * λ, эквивалентная старому покадровому `lerp(…, alpha)` при частоте `fps`:
 * lambdaFromLerp(0.14, 60) ≈ 9.05 — поведение на 60 Гц сохраняется, на других частотах тоже.
 */
export function lambdaFromLerp(alpha: number, fps = 60): number {
  return -Math.log(1 - alpha) * fps
}

/** Отклик пружины из x = 0, v = 0 к цели 1 за время t. */
function springResponse(omega: number, zeta: number, t: number): number {
  springCoefficients(omega, zeta, t)
  return 1 - _A
}

/**
 * Кривая-пружина, совместимая с `EaseFn` (0..1 → значение): отклик пружины из покоя
 * к 1 за нормированное время. ω — рад на всю длительность бита (типично 8–20),
 * ζ — затухание (0.3–0.6 — заметный «щелчок» с перелётом, 1 — без перелёта).
 *
 * Гарантии EaseFn: f(0) = 0 и f(1) = 1 ровно — невязка недозатухшей пружины в t = 1
 * убирается добавкой (1 − s(1))·smootherstep(t), у которой нулевые производные на концах,
 * так что начальная скорость (0) и форма звона не меняются.
 */
export function springEase(omega: number, zeta: number): EaseFn {
  const fix = 1 - springResponse(omega, zeta, 1)
  return (t: number) => {
    const x = t < 0 ? 0 : t > 1 ? 1 : t
    if (x === 0) return 0
    if (x === 1) return 1
    const smoother = x * x * x * (x * (x * 6 - 15) + 10)
    return springResponse(omega, zeta, x) + fix * smoother
  }
}
