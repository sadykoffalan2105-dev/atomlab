import * as THREE from 'three'
import { ease, mix, norm, type EaseName } from './easing'

/**
 * ATOMLAB Cinema — keyframe-треки.
 *
 * Ключевая идея: движение объекта описывается ОДНОЙ дорожкой на всю сцену,
 * а не набором «если фаза 2 — делай так, если фаза 3 — иначе».
 * Поэтому разрывов на границах фаз не бывает по построению: значение в точке t
 * зависит только от соседних ключей, а они общие для обеих сторон границы.
 *
 * Дорожки — это чистые данные (JSON-совместимые), их можно хранить в раскадровке,
 * логировать и валидировать, не запуская рендер.
 */

/**
 * Способ интерполяции сегмента (задаётся на ключе, В который идёт переход — как `ease`):
 *   • 'eased' (по умолчанию) — сегмент проходится кривой `ease` от 0 до 1; при
 *     smoothstep скорость в каждом ключе нулевая — объект «останавливается» на ключе;
 *   • 'hermite' — кубический сплайн Эрмита с касательными Катмулла–Рома по соседним
 *     ключам: скорость непрерывна через внутренние ключи, значения ключей точные.
 *     `ease` в таком сегменте игнорируется (параметр времени линейный).
 *
 * Касательная в ключе ненулевая, только если ОБА соседних сегмента — 'hermite';
 * на первом/последнем ключе и на стыке с 'eased' она 0 — это стыкуется без рывка
 * скорости и с удержанием значения за краями дорожки, и с smoothstep-сегментами.
 * Для скаляров касательная монотонно ограничена (Fritsch–Carlson): внутри сегмента
 * значение не выходит за пределы значений его ключей — без перелёта.
 */
export type TrackInterp = 'eased' | 'hermite'

export type ScalarKey = {
  /** story time, сек */
  t: number
  v: number
  /** кривая перехода ИЗ предыдущего ключа В этот */
  ease?: EaseName
  /** интерполяция сегмента ИЗ предыдущего ключа В этот (по умолчанию 'eased') */
  interp?: TrackInterp
}

export type Vec3Key = {
  t: number
  v: readonly [number, number, number]
  ease?: EaseName
  /**
   * Дуга (в мировых единицах): траектория выгибается перпендикулярно направлению
   * движения на sin(π·u)·arc. Так частицы и молекулы летят по баллистической
   * кривой, а не по «мёртвой» прямой.
   * В 'hermite'-сегменте профиль дуги sin²(π·u) — нулевая производная на концах,
   * чтобы дуга не ломала непрерывность скорости.
   */
  arc?: number
  /** Ось, вокруг которой выгибается дуга (по умолчанию мировой +Y). */
  arcAxis?: readonly [number, number, number]
  /**
   * Интерполяция сегмента ИЗ предыдущего ключа В этот (по умолчанию 'eased').
   * Для векторов касательные Катмулла–Рома без монотонного ограничения:
   * путь в пространстве плавно огибает ключи.
   */
  interp?: TrackInterp
}

export type ScalarTrack = readonly ScalarKey[]
export type Vec3Track = readonly Vec3Key[]

/** Окно видимости: [начало, конец) в story time. */
export type Window = readonly [number, number]

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _axis = new THREE.Vector3()
const _perp = new THREE.Vector3()

function findSegment(len: number, at: (i: number) => number, t: number): number {
  // Дорожки короткие (3–12 ключей) — линейный поиск быстрее бинарного и без ветвлений по кэшу.
  for (let i = 1; i < len; i++) {
    if (t < at(i)) return i
  }
  return len - 1
}

// ——— Эрмит ———

/** Кубический Эрмит на параметре s ∈ [0, 1]; m0, m1 — касательные, уже умноженные на длину сегмента. */
function hermite(p0: number, m0: number, p1: number, m1: number, s: number): number {
  const s2 = s * s
  const s3 = s2 * s
  return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1
}

/**
 * Трёхточечная производная по неравномерной сетке (точна для парабол):
 * m = (h1·d0 + h0·d1) / (h0 + h1), d — наклоны соседних сегментов.
 */
function threePointSlope(t0: number, v0: number, t1: number, v1: number, t2: number, v2: number): number {
  const h0 = t1 - t0
  const h1 = t2 - t1
  const d0 = (v1 - v0) / h0
  const d1 = (v2 - v1) / h1
  return (h1 * d0 + h0 * d1) / (h0 + h1)
}

/** Касательная скалярной дорожки в ключе j (единицы значения за секунду), с монотонным ограничением. */
function scalarTangent(track: ScalarTrack, j: number): number {
  const n = track.length
  if (j <= 0 || j >= n - 1) return 0
  const k = track[j]!
  const next = track[j + 1]!
  if (k.interp !== 'hermite' || next.interp !== 'hermite') return 0
  const prev = track[j - 1]!
  const d0 = (k.v - prev.v) / (k.t - prev.t)
  const d1 = (next.v - k.v) / (next.t - k.t)
  // Локальный экстремум или плато — касательная 0, иначе сплайн перелетит ключ.
  if (d0 * d1 <= 0) return 0
  const m = threePointSlope(prev.t, prev.v, k.t, k.v, next.t, next.v)
  // Fritsch–Carlson: |m| ≤ 3·min(|d0|, |d1|) гарантирует монотонность обоих сегментов.
  const lim = 3 * Math.min(Math.abs(d0), Math.abs(d1))
  return Math.abs(m) > lim ? Math.sign(m) * lim : m
}

/** Компонента c касательной векторной дорожки в ключе j (без монотонного ограничения). */
function vec3TangentComponent(track: Vec3Track, j: number, c: 0 | 1 | 2): number {
  const n = track.length
  if (j <= 0 || j >= n - 1) return 0
  const k = track[j]!
  const next = track[j + 1]!
  if (k.interp !== 'hermite' || next.interp !== 'hermite') return 0
  const prev = track[j - 1]!
  return threePointSlope(prev.t, prev.v[c], k.t, k.v[c], next.t, next.v[c])
}

export function sampleScalar(track: ScalarTrack, t: number): number {
  const n = track.length
  if (n === 0) return 0
  const first = track[0]!
  if (n === 1 || t <= first.t) return first.v
  const last = track[n - 1]!
  if (t >= last.t) return last.v
  const i = findSegment(n, (k) => track[k]!.t, t)
  const k0 = track[i - 1]!
  const k1 = track[i]!
  if (k1.interp === 'hermite') {
    const h = k1.t - k0.t
    const s = norm(k0.t, k1.t, t)
    return hermite(k0.v, scalarTangent(track, i - 1) * h, k1.v, scalarTangent(track, i) * h, s)
  }
  return mix(k0.v, k1.v, ease(k1.ease, norm(k0.t, k1.t, t)))
}

export function sampleVec3(track: Vec3Track, t: number, out: THREE.Vector3): THREE.Vector3 {
  const n = track.length
  if (n === 0) return out.set(0, 0, 0)
  const first = track[0]!
  if (n === 1 || t <= first.t) return out.set(first.v[0], first.v[1], first.v[2])
  const last = track[n - 1]!
  if (t >= last.t) return out.set(last.v[0], last.v[1], last.v[2])

  const i = findSegment(n, (k) => track[k]!.t, t)
  const k0 = track[i - 1]!
  const k1 = track[i]!
  _a.set(k0.v[0], k0.v[1], k0.v[2])
  _b.set(k1.v[0], k1.v[1], k1.v[2])

  let bump: number
  if (k1.interp === 'hermite') {
    const h = k1.t - k0.t
    const s = norm(k0.t, k1.t, t)
    out.set(
      hermite(k0.v[0], vec3TangentComponent(track, i - 1, 0) * h, k1.v[0], vec3TangentComponent(track, i, 0) * h, s),
      hermite(k0.v[1], vec3TangentComponent(track, i - 1, 1) * h, k1.v[1], vec3TangentComponent(track, i, 1) * h, s),
      hermite(k0.v[2], vec3TangentComponent(track, i - 1, 2) * h, k1.v[2], vec3TangentComponent(track, i, 2) * h, s),
    )
    const sn = Math.sin(Math.PI * s)
    bump = sn * sn
  } else {
    const u = ease(k1.ease, norm(k0.t, k1.t, t))
    out.copy(_a).lerp(_b, u)
    bump = Math.sin(Math.PI * u)
  }

  const arc = k1.arc
  if (arc) {
    _dir.copy(_b).sub(_a)
    if (_dir.lengthSq() > 1e-10) {
      const ax = k1.arcAxis
      _axis.set(ax ? ax[0] : 0, ax ? ax[1] : 1, ax ? ax[2] : 0)
      _perp.copy(_dir).normalize().cross(_axis)
      if (_perp.lengthSq() < 1e-8) _perp.set(0, 1, 0)
      else _perp.normalize()
      out.addScaledVector(_perp, bump * arc)
    }
  }
  return out
}

/** Активно ли окно в момент t. */
export function inWindow(w: Window | undefined, t: number): boolean {
  if (!w) return true
  return t >= w[0] && t < w[1]
}

/**
 * Плавная «шторка» окна: 0 вне окна, 1 внутри, с мягкими краями `fade`.
 * Нужна, чтобы связи и подписи не появлялись/исчезали щелчком.
 */
export function windowFade(w: Window, t: number, fade = 0.12): number {
  if (t <= w[0] || t >= w[1]) return 0
  const inA = norm(w[0], w[0] + fade, t)
  const outA = 1 - norm(w[1] - fade, w[1], t)
  return Math.min(inA, outA)
}

/** Детерминированный псевдослучайный шум для микро-колебаний (brounian jitter). */
export function jitter(t: number, seed: number): number {
  return (
    Math.sin(t * (5.13 + seed * 1.7) + seed * 12.9898) * 0.6 +
    Math.sin(t * (9.71 + seed * 0.9) + seed * 78.233) * 0.4
  )
}

/** Проверка дорожки: ключи должны идти строго по возрастанию времени. */
export function validateTrack(name: string, track: ReadonlyArray<{ t: number }>): void {
  for (let i = 1; i < track.length; i++) {
    if (track[i]!.t <= track[i - 1]!.t) {
      throw new Error(`[cinema] track "${name}": keys must be strictly increasing (index ${i})`)
    }
  }
}
