import * as THREE from 'three'
import type { CameraRigState } from './states'

/**
 * Свободная область холста: панель урока (слева или снизу) и реактор снизу
 * закрывают часть кадра. Центр действия переносится в середину свободной
 * области, а при тесной области сцена чуть отъезжает. Логика та же, что у
 * урока ClO₂ (Clo2CinemaScene.measureSafeArea), вынесена для остальных сцен.
 */

export type SafeArea = {
  /** центр свободной области в пикселях холста */
  cx: number
  cy: number
  /** множитель зума (≤ 1) при тесной области */
  fit: number
  counter: number
  ready: boolean
  /** сглаженный сдвиг рига в мировых единицах */
  ox: number
  oy: number
}

export function createSafeArea(): SafeArea {
  return { cx: 0, cy: 0, fit: 1, counter: 0, ready: false, ox: 0, oy: 0 }
}

/** Как часто (в кадрах) перемерять DOM — getBoundingClientRect не бесплатен. */
export const SAFE_AREA_EVERY = 20

export function measureSafeArea(safe: SafeArea, canvas: HTMLCanvasElement): void {
  const r = canvas.getBoundingClientRect()
  if (r.width < 10 || r.height < 10) return
  let left = r.left
  let right = r.right
  let top = r.top + Math.min(90, r.height * 0.1)
  let bottom = r.bottom
  const reactor = document.querySelector<HTMLElement>('[data-lab-reactor]')
  if (reactor) {
    const rr = reactor.getBoundingClientRect()
    if (rr.height > 0 && rr.top > r.top + r.height * 0.35 && rr.top < bottom) bottom = rr.top
  }
  const panel = document.querySelector<HTMLElement>('[data-lab-lesson-panel]')
  if (panel) {
    const pr = panel.getBoundingClientRect()
    if (pr.width > 0 && pr.height > 0) {
      const docksBottom = pr.width > r.width * 0.8 || pr.top > r.top + r.height * 0.5
      if (docksBottom) bottom = Math.min(bottom, pr.top)
      else if (pr.left < r.left + r.width * 0.5) left = Math.max(left, pr.right)
      else right = Math.min(right, pr.left)
    }
  }
  if (bottom - top < r.height * 0.3) top = r.top
  safe.cx = (left + right) / 2 - r.left
  safe.cy = (top + bottom) / 2 - r.top
  const ratio = Math.min((right - left) / r.width, (bottom - top) / r.height)
  safe.fit = Math.max(0.88, Math.min(1, 0.55 + 0.45 * ratio))
  safe.ready = true
}

const _o = new THREE.Vector3()
const _ox = new THREE.Vector3()

/**
 * Применяет камеру раскадровки к ригу с учётом свободной области:
 * зум умножается на fit, центр действия сдвигается в середину области.
 */
export function applyCameraToRig(
  rig: CameraRigState,
  safe: SafeArea,
  cam: { zoom: number; offset: THREE.Vector3; yaw: number; roll: number; shake: number },
  view: { canvas: HTMLCanvasElement; camera: THREE.Camera; width: number; height: number },
): void {
  if (safe.counter++ % SAFE_AREA_EVERY === 0) measureSafeArea(safe, view.canvas)
  const fit = safe.ready ? safe.fit : 1
  rig.zoom = cam.zoom * fit
  rig.offset.copy(cam.offset).multiplyScalar(fit)
  if (safe.ready) {
    // Сдвиг в плоскости z = 0: сколько пикселей в мировой единице и где сейчас центр.
    _o.set(0, 0, 0).project(view.camera)
    _ox.set(1, 0, 0).project(view.camera)
    const pxPerUnit = Math.abs(_ox.x - _o.x) * 0.5 * view.width
    if (pxPerUnit > 1e-3) {
      const ox = (safe.cx - (_o.x * 0.5 + 0.5) * view.width) / pxPerUnit
      const oy = -(safe.cy - (-_o.y * 0.5 + 0.5) * view.height) / pxPerUnit
      safe.ox += (ox - safe.ox) * 0.08
      safe.oy += (oy - safe.oy) * 0.08
      rig.offset.x += safe.ox
      rig.offset.y += safe.oy
    }
  }
  rig.yaw = cam.yaw
  rig.roll = cam.roll
  rig.shake = cam.shake
}
