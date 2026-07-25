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

export type ScalarKey = {
  /** story time, сек */
  t: number
  v: number
  /** кривая перехода ИЗ предыдущего ключа В этот */
  ease?: EaseName
}

export type Vec3Key = {
  t: number
  v: readonly [number, number, number]
  ease?: EaseName
  /**
   * Дуга (в мировых единицах): траектория выгибается перпендикулярно направлению
   * движения на sin(π·u)·arc. Так частицы и молекулы летят по баллистической
   * кривой, а не по «мёртвой» прямой.
   */
  arc?: number
  /** Ось, вокруг которой выгибается дуга (по умолчанию мировой +Y). */
  arcAxis?: readonly [number, number, number]
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
  const u = ease(k1.ease, norm(k0.t, k1.t, t))
  _a.set(k0.v[0], k0.v[1], k0.v[2])
  _b.set(k1.v[0], k1.v[1], k1.v[2])
  out.copy(_a).lerp(_b, u)

  const arc = k1.arc
  if (arc) {
    _dir.copy(_b).sub(_a)
    if (_dir.lengthSq() > 1e-10) {
      const ax = k1.arcAxis
      _axis.set(ax ? ax[0] : 0, ax ? ax[1] : 1, ax ? ax[2] : 0)
      _perp.copy(_dir).normalize().cross(_axis)
      if (_perp.lengthSq() < 1e-8) _perp.set(0, 1, 0)
      else _perp.normalize()
      out.addScaledVector(_perp, Math.sin(Math.PI * u) * arc)
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
