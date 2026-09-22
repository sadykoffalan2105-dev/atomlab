/**
 * ATOMLAB Cinema kit — КАМЕРА КАК ДОРОЖКИ.
 *
 * Камера ведёт взгляд: наезд на место события, медленный облёт решётки на
 * финале, никаких резких прыжков. Камера — такие же дорожки, как у атомов:
 * shotTrack превращает список «планов» в набор дорожек zoom / yaw / pitch /
 * roll / offset, orbitTrack — облёт по yaw с постоянным наклоном, а
 * assertCameraContinuity в тесте сцены ловит скачок камеры между кадрами.
 *
 * Сцена в onFrame зовёт sampleShot(track, t, ctx.camera) — без аллокаций.
 * Наклон (pitch) применяется ригом в порядке 'YXZ' (core/states.CameraRigState).
 */
import * as THREE from 'three'
import type { EaseName } from '../../core/easing'
import { sampleScalar, sampleVec3, type ScalarKey, type ScalarTrack, type Vec3Key, type Vec3Track } from '../../core/tracks'
import type { SceneCamera } from './sceneKit'

/** План камеры в момент t (время сюжета). Пропущенное поле — как в предыдущем плане. */
export type ShotKey = {
  t: number
  zoom?: number
  /** рад, поворот вокруг вертикали */
  yaw?: number
  /** рад, наклон: > 0 — взгляд сверху */
  pitch?: number
  roll?: number
  /** точка мира, которая встаёт в центр кадра (мировые единицы рига) */
  target?: readonly [number, number, number]
  /** кривая перехода ИЗ предыдущего плана В этот (по умолчанию 'smoother' — для медленных наездов) */
  ease?: EaseName
}

export type ShotTrack = {
  zoom: ScalarTrack
  yaw: ScalarTrack
  pitch: ScalarTrack
  roll: ScalarTrack
  /** смещение рига = −target (центр действия в центр кадра) */
  offset: Vec3Track
}

/**
 * Дорожки камеры из списка планов. Ключи обязаны идти строго по возрастанию t.
 * Смещение рига — минус target: чтобы точка target оказалась в центре, мир едет навстречу.
 */
export function shotTrack(keys: readonly ShotKey[]): ShotTrack {
  if (keys.length === 0) throw new Error('[camera] shotTrack: нет планов')
  const zoom: ScalarKey[] = []
  const yaw: ScalarKey[] = []
  const pitch: ScalarKey[] = []
  const roll: ScalarKey[] = []
  const offset: Vec3Key[] = []
  let z = 1
  let y = 0
  let p = 0
  let r = 0
  let tg: readonly [number, number, number] = [0, 0, 0]
  let last = -Infinity
  for (const k of keys) {
    if (!(k.t > last)) throw new Error(`[camera] shotTrack: планы не по возрастанию времени (t=${k.t})`)
    last = k.t
    z = k.zoom ?? z
    y = k.yaw ?? y
    p = k.pitch ?? p
    r = k.roll ?? r
    tg = k.target ?? tg
    const e: EaseName = k.ease ?? 'smoother'
    zoom.push({ t: k.t, v: z, ease: e })
    yaw.push({ t: k.t, v: y, ease: e })
    pitch.push({ t: k.t, v: p, ease: e })
    roll.push({ t: k.t, v: r, ease: e })
    offset.push({ t: k.t, v: [-tg[0], -tg[1], -tg[2]], ease: e })
  }
  return { zoom, yaw, pitch, roll, offset }
}

/**
 * Облёт решётки: yaw от yaw0 к yaw1 за [t0, t1] (кривая inOutSine — мягкий
 * старт и остановка) при постоянном наклоне pitch. Возвращает планы для
 * shotTrack, склеиваются с остальными: shotTrack([...plans, ...orbitTrack(...)]).
 */
export function orbitTrack(t0: number, t1: number, yaw0: number, yaw1: number, pitch: number, zoom?: number): ShotKey[] {
  if (!(t1 > t0)) throw new Error('[camera] orbitTrack: t1 должен быть больше t0')
  return [
    { t: t0, yaw: yaw0, pitch, zoom },
    { t: t1, yaw: yaw1, pitch, zoom, ease: 'inOutSine' },
  ]
}

/** Записать камеру кадра из дорожек (в ctx.camera). Без аллокаций. */
export function sampleShot(track: ShotTrack, t: number, out: SceneCamera): SceneCamera {
  out.zoom = sampleScalar(track.zoom, t)
  out.yaw = sampleScalar(track.yaw, t)
  out.pitch = sampleScalar(track.pitch, t)
  out.roll = sampleScalar(track.roll, t)
  sampleVec3(track.offset, t, out.offset)
  return out
}

/** Состояние камеры, которое проверяет assertCameraContinuity. */
export type CameraSample = { zoom: number; yaw: number; pitch: number; roll: number; offset: THREE.Vector3 }

export type CameraContinuityLimits = {
  /** рад за кадр для yaw/pitch/roll (по умолчанию 0.05 ≈ 2.9° за 1/30 с) */
  angle?: number
  /** относительная смена zoom за кадр (по умолчанию 0.05 = 5 %) */
  zoom?: number
  /** мировых единиц за кадр для offset (по умолчанию 0.09 — как у атомов) */
  offset?: number
}

/**
 * Тест сцены: между соседними выборками dt камера не прыгает. sample(t) пишет
 * камеру в момент t (может отдавать один и тот же объект — копия делается здесь).
 * maxDeltaPerFrame — лимиты (числом — общий лимит угла, остальные по умолчанию).
 */
export function assertCameraContinuity(
  sample: (t: number) => CameraSample,
  end: number,
  maxDeltaPerFrame: number | CameraContinuityLimits = {},
  dt = 1 / 30,
): void {
  const lim: CameraContinuityLimits = typeof maxDeltaPerFrame === 'number' ? { angle: maxDeltaPerFrame } : maxDeltaPerFrame
  const maxAngle = lim.angle ?? 0.05
  const maxZoom = lim.zoom ?? 0.05
  const maxOffset = lim.offset ?? 0.09
  const prevOffset = new THREE.Vector3()
  let prev: { zoom: number; yaw: number; pitch: number; roll: number } | null = null
  for (let t = 0; t <= end + 1e-9; t += dt) {
    const c = sample(t)
    if (prev) {
      const at = t.toFixed(2)
      const check = (name: string, d: number, max: number) => {
        if (d > max) throw new Error(`[camera] ${name} прыгнул на ${d.toFixed(4)} за кадр при t=${at} (предел ${max})`)
      }
      check('yaw', Math.abs(c.yaw - prev.yaw), maxAngle)
      check('pitch', Math.abs(c.pitch - prev.pitch), maxAngle)
      check('roll', Math.abs(c.roll - prev.roll), maxAngle)
      check('zoom', Math.abs(c.zoom - prev.zoom) / Math.max(1e-6, Math.abs(prev.zoom)), maxZoom)
      check('offset', c.offset.distanceTo(prevOffset), maxOffset)
      prev.zoom = c.zoom
      prev.yaw = c.yaw
      prev.pitch = c.pitch
      prev.roll = c.roll
    } else {
      prev = { zoom: c.zoom, yaw: c.yaw, pitch: c.pitch, roll: c.roll }
    }
    prevOffset.copy(c.offset)
  }
}
