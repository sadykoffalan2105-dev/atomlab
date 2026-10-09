/**
 * Перемещение в VR без репарентинга камеры: базовое пространство local-floor (пол — y = 0, столешница на реальной
 * высоте 0,9 м), а точка стояния задаётся смещённым пространством base.getOffsetReferenceSpace(XRRigidTransform).
 * Плавного перемещения нет (комфорт): только телепорт по площадкам и поворот рывком ±30°.
 */
import * as THREE from 'three'
import type { LabXrStand } from './labXrStore'

export interface StandPose {
  /** Точка на полу (м). */
  readonly pos: readonly [number, number, number]
  /** Поворот вокруг Y (рад); 0 — взгляд в −Z. */
  readonly yaw: number
}

export const XR_STANDS: Readonly<Record<LabXrStand, StandPose>> = {
  desk: { pos: [0, 0, 0.85], yaw: 0 },
  hood: { pos: [-2.05, 0, 0.15], yaw: 0 },
  board: { pos: [0, 0, 0.35], yaw: 0 },
  shelves: { pos: [2.3, 0, 0.25], yaw: 0 },
}
export const XR_STAND_ORDER: readonly LabXrStand[] = ['desk', 'hood', 'board', 'shelves']

/** Рост глаз для эмуляции и для запасного пространства 'local' (без пола). */
export const EYE_HEIGHT = 1.6

let base: XRReferenceSpace | null = null
/** Пространство 'local' вместо 'local-floor' — начало на уровне глаз, поэтому смещаем на +1,6 м. */
let baseIsLocal = false
let extraYaw = 0

export async function initBaseSpace(session: XRSession): Promise<void> {
  try {
    base = await session.requestReferenceSpace('local-floor')
    baseIsLocal = false
  } catch {
    base = await session.requestReferenceSpace('local')
    baseIsLocal = true
  }
  extraYaw = 0
}

export function resetBaseSpace() {
  base = null
  extraYaw = 0
}

/** Полный поворот точки стояния (поза площадки + накопленные повороты рывком). */
export function standYaw(stand: LabXrStand): number {
  return XR_STANDS[stand].yaw + extraYaw
}

export function addSnapTurn(delta: number) {
  extraYaw += delta
}

/**
 * Поставить пользователя на площадку: смещение пространства — обратное позе «пользователь в точке P с поворотом yaw».
 * three берёт пространство через renderer.xr.setReferenceSpace.
 */
export function applyStand(gl: THREE.WebGLRenderer, stand: LabXrStand): void {
  if (!base) return
  const s = XR_STANDS[stand]
  const yaw = standYaw(stand)
  // поза в новом пространстве = T(P)·R(yaw)·поза в базовом, значит смещение = inverse(T(P)·R(yaw)) = T(R(−yaw)·(−P))·R(−yaw).
  // В 'local' начало на уровне глаз — P.y = +1,6 м, чтобы стол оказался на своей высоте 0,9 м.
  const P = new THREE.Vector3(s.pos[0], baseIsLocal ? EYE_HEIGHT : s.pos[1], s.pos[2])
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw)
  const p = P.negate().applyQuaternion(q)
  const t = new XRRigidTransform({ x: p.x, y: p.y, z: p.z, w: 1 }, { x: q.x, y: q.y, z: q.z, w: q.w })
  gl.xr.setReferenceSpace(base.getOffsetReferenceSpace(t))
}

const tmpTarget = new THREE.Vector3()
/** Эмуляция без шлема: камера на уровне глаз в точке стояния, взгляд вперёд и чуть вниз (на стол/доску). */
export function emulatedCameraPose(camera: THREE.Camera, stand: LabXrStand): void {
  const s = XR_STANDS[stand]
  const yaw = standYaw(stand)
  camera.position.set(s.pos[0], EYE_HEIGHT, s.pos[2])
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
  // стол и вытяжка — смотрим вниз на рабочее место, доска — прямо на её центр, стеллаж — на полки
  const look = stand === 'board' ? { d: 1.5, y: 1.55 } : stand === 'shelves' ? { d: 1.2, y: 1.25 } : { d: 0.95, y: 0.95 }
  tmpTarget.set(s.pos[0] + fwd.x * look.d, look.y, s.pos[2] + fwd.z * look.d)
  camera.lookAt(tmpTarget)
  camera.updateMatrixWorld()
}
