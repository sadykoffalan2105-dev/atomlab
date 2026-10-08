/**
 * Чистая геометрия и время для «Как образуется» в реакторе (без React и three — модели читает тест в Node).
 * Масштаб — как у школьных сцен и каталога: 1 Å = 0,285 мировых единиц, шар = 0,62 радиуса (ковалентного у атома,
 * ионного у иона).
 */
export type V3 = [number, number, number]
export type Tri = [string, string, string]

/** Мировых единиц на пикометр (1 Å = 0,285). */
export const K = 0.00285
/** Доля радиуса, которую рисует шар (как SCHOOL_DRAW.ballScale). */
export const BALL = 0.62
/** Ковалентные радиусы, пм (Cordero 2008; C — sp²/sp³ ≈ 73–76). */
export const COV_PM = { H: 31, C: 76, O: 66, Cl: 102 } as const
/** Ионные радиусы, пм (Shannon, КЧ 6). */
export const ION_PM = { Ca2: 100, Cl1: 181, O2: 140 } as const
/** Длины связей и расстояния, пм (справочные). */
export const BOND_PM = {
  CO_co2: 116, // C=O в CO₂
  OO: 121, // O=O в O₂
  CC_graphite: 142, // C–C в слое графита
  CO_carbonate: 129, // C–O в CO₃²⁻ (кальцит ≈ 128–129)
  CO_h2co3_single: 134, // C–OH в H₂CO₃
  CO_h2co3_double: 121, // C=O в H₂CO₃
  OH: 96, // O–H в воде
  OH_acid: 97, // O–H в H₂CO₃
  HCl: 127, // H–Cl
  CaO: 240, // Ca–O в CaO (решётка NaCl, a = 481 пм)
} as const
export const ANGLE_DEG = { carbonate: 120, co2: 180, water: 104.5 } as const

export const rCov = (el: keyof typeof COV_PM) => COV_PM[el] * BALL * K
export const rIon = (pm: number) => pm * BALL * K
export const pm = (x: number) => x * K

export const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x)
export const ease = (x: number) => {
  const u = clamp01(x)
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
}
/** 0…1 сглажено от a к b. */
export const seg = (t: number, a: number, b: number) => ease((t - a) / Math.max(1e-6, b - a))
/** 0…1 с плавными краями внутри окна [a, b]; fade — длина переходов. */
export const win = (t: number, a: number, b: number, fade = 0.5) => ease((t - a) / fade) * (1 - ease((t - (b - fade)) / fade))

export const add3 = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
export const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const mul3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
export const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2])
export const norm3 = (a: V3): V3 => {
  const l = len3(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
export const mid3 = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
export const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
export const dist3 = (a: V3, b: V3) => len3(sub3(a, b))
/** Угол при вершине v (градусы). */
export function angleDeg(v: V3, a: V3, b: V3): number {
  const x = norm3(sub3(a, v))
  const y = norm3(sub3(b, v))
  return (Math.acos(Math.max(-1, Math.min(1, x[0] * y[0] + x[1] * y[1] + x[2] * y[2]))) * 180) / Math.PI
}

export type Fn = (t: number) => number
export type PFn = (t: number) => V3

/** Ключевые точки: между соседними — плавный переход (ease) за время от t предыдущего ключа до t следующего. */
export function track(keys: readonly { t: number; p: V3 }[]): PFn {
  return (t) => {
    if (t <= keys[0]!.t) return keys[0]!.p
    for (let i = 1; i < keys.length; i++) {
      const b = keys[i]!
      if (t < b.t) {
        const a = keys[i - 1]!
        return lerp3(a.p, b.p, ease((t - a.t) / Math.max(1e-6, b.t - a.t)))
      }
    }
    return keys[keys.length - 1]!.p
  }
}
export function trackN(keys: readonly { t: number; v: number }[]): Fn {
  return (t) => {
    if (t <= keys[0]!.t) return keys[0]!.v
    for (let i = 1; i < keys.length; i++) {
      const b = keys[i]!
      if (t < b.t) {
        const a = keys[i - 1]!
        return a.v + (b.v - a.v) * ease((t - a.t) / Math.max(1e-6, b.t - a.t))
      }
    }
    return keys[keys.length - 1]!.v
  }
}

/** Детерминированный «шум» тепловых колебаний (без Math.random — перемотка даёт тот же кадр). */
export function jiggle(seed: number, t: number, amp: number): V3 {
  const s = seed * 12.9898
  return [
    amp * Math.sin(t * 23.1 + s) * Math.cos(t * 7.3 + s * 0.7),
    amp * Math.sin(t * 19.7 + s * 1.3) * Math.cos(t * 5.9 + s * 0.3),
    amp * Math.sin(t * 21.3 + s * 2.1) * Math.cos(t * 6.7 + s * 1.1),
  ]
}

/** Поворот точки p вокруг оси (единичной) через начало координат на угол a (рад). */
export function rotAxis(p: V3, axis: V3, a: number): V3 {
  const [x, y, z] = axis
  const c = Math.cos(a)
  const s = Math.sin(a)
  const d = (x * p[0] + y * p[1] + z * p[2]) * (1 - c)
  return [
    p[0] * c + (y * p[2] - z * p[1]) * s + x * d,
    p[1] * c + (z * p[0] - x * p[2]) * s + y * d,
    p[2] * c + (x * p[1] - y * p[0]) * s + z * d,
  ]
}

/* ── модель сцены ── */

export type StageDef = { key: string; dur: number }
export type Stage = StageDef & { t0: number; t1: number }
export type Stages = { list: Stage[]; total: number; W: (key: string) => Stage }
export function buildStages(defs: readonly StageDef[]): Stages {
  let t = 0
  const list = defs.map((d) => {
    const s = { ...d, t0: t, t1: t + d.dur }
    t += d.dur
    return s
  })
  const W = (key: string) => list.find((s) => s.key === key) ?? { key, dur: 0.001, t0: 0, t1: 0.001 }
  return { list, total: t, W }
}

/** Частица (атом или ион): подпись на шаре может меняться во времени (Cl → Cl⁻, O → O²⁻, H → H⁺ → H). */
export type Particle = {
  id: string
  el: 'H' | 'C' | 'O' | 'Cl' | 'Ca'
  label: string | ((t: number) => string)
  /** заряд частицы в момент t (для проверки электронейтральности); нет — 0 */
  q?: Fn
  r: Fn
  pos: PFn
  /** видимость 0…1 (шар растёт/тает) */
  k: Fn
  /** фон (кристалл, вода): тусклый, без подписи, не входит в баланс атомов */
  decor?: boolean
}
/** Палочка связи между частицами a и b: n — кратность (1, 2), k — «рост» 0…1. */
export type Bond = { a: string; b: string; n: 1 | 2; k: Fn; decor?: boolean }
/** Ключ камеры: в момент t за d секунд камера приходит к yaw/pitch/zoom; focus — точка в центре кадра. */
export type CamKey = { t: number; d: number; yaw: number; pitch: number; zoom: number; focus: V3 }

/** Электрон (точка со следом): pos — функция t, k — видимость; tone — чей (цвет). */
export type RouteElectron = { id: string; pos: PFn; k: Fn; tone: 'c' | 'o' | 'h' | 'cl' }

export type RouteModel = {
  stages: Stages
  particles: Particle[]
  bonds: Bond[]
  electrons: RouteElectron[]
  cam: CamKey[]
  /** радиус описанной сферы кадра при zoom = 1 */
  fit: number
  /** яркость фона (кристалл, вода) — доля цвета; по умолчанию 0,42 */
  decorDim?: number
}

/** Подпись частицы в момент t. */
export const labelAt = (p: Particle, t: number) => (typeof p.label === 'string' ? p.label : p.label(t))
/** Ступенька: значение a до момента at, затем b. */
export const step = <T,>(at: number, a: T, b: T) => (t: number): T => (t < at ? a : b)

export const byId = (m: RouteModel, id: string): Particle => {
  const p = m.particles.find((x) => x.id === id)
  if (!p) throw new Error(`route particle ${id}`)
  return p
}

/** Камера в момент t (плавно по ключам). */
export function camAt(keys: readonly CamKey[], t: number): { yaw: number; pitch: number; zoom: number; focus: V3 } {
  let yaw = keys[0]!.yaw
  let pitch = keys[0]!.pitch
  let zoom = keys[0]!.zoom
  let focus = keys[0]!.focus
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i]!
    const u = ease((t - k.t) / k.d)
    if (u <= 0) break
    yaw += (k.yaw - yaw) * u
    pitch += (k.pitch - pitch) * u
    zoom += (k.zoom - zoom) * u
    focus = lerp3(focus, k.focus, u)
  }
  return { yaw, pitch, zoom, focus }
}
