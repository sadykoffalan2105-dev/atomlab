import type { PerspectiveCamera, Vector3 } from 'three'
import { LAB_ORBIT } from '../components/lab/labOrbitConstants'

/**
 * Красивый «геройский» ракурс превью реагентов в реакторе:
 * слегка сбоку и сверху — атомы читаются сразу, без ручного вращения.
 * Совпадает с референсом (дуга Cr | K | O₂ в кадре).
 */
export type ReactorPreviewCameraPose = {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
  fov: number
}

export const REACTOR_PREVIEW_CAMERA = {
  /** Мало атомов (≤8): ближе, выразительнее. */
  few: {
    position: [0.92, 1.38, 6.35] as const,
    target: [0, 0.18, 0.1] as const,
    fov: 56,
  } satisfies ReactorPreviewCameraPose,
  /** Много атомов: шире и чуть дальше, чтобы кластеры не обрезались. */
  many: {
    position: [1.12, 1.52, 7.35] as const,
    target: [0, 0.2, 0.08] as const,
    fov: 60,
  } satisfies ReactorPreviewCameraPose,
  /** Гистерезис: many при >9, few при <7. */
  manyEnter: 9,
  manyExit: 7,
  /** Краткий hold после set — затем пользователь крутит орбиту свободно. */
  lockMs: 320,
  /** Одноразовый rescue у catalog hero (не продлевать lockMs). */
  stuckRescueMs: 180,
} as const

export type OrbitControlsLike = {
  target: Vector3
  minDistance: number
  maxDistance: number
  minPolarAngle: number
  maxPolarAngle: number
  setScale?: (scale: number) => void
  update?: () => void
}

export function resolveReactorPreviewCameraPose(
  atomCount: number,
  manyAtomsLatch: boolean,
): { pose: ReactorPreviewCameraPose; manyAtoms: boolean } {
  let many = manyAtomsLatch
  if (atomCount > REACTOR_PREVIEW_CAMERA.manyEnter) many = true
  else if (atomCount < REACTOR_PREVIEW_CAMERA.manyExit) many = false
  return {
    manyAtoms: many,
    pose: many ? REACTOR_PREVIEW_CAMERA.many : REACTOR_PREVIEW_CAMERA.few,
  }
}

/**
 * Жёстко ставит камеру + внутреннее состояние OrbitControls.
 * Без этого после catalog hero (z≈3.6) атомы остаются «за кадром»,
 * пока пользователь не покрутит орбиту.
 */
export function applyReactorPreviewCamera(
  camera: PerspectiveCamera,
  controls: OrbitControlsLike | null | undefined,
  pose: ReactorPreviewCameraPose,
): void {
  camera.fov = pose.fov
  camera.updateProjectionMatrix()
  camera.position.set(pose.position[0], pose.position[1], pose.position[2])
  camera.lookAt(pose.target[0], pose.target[1], pose.target[2])

  if (!controls) return

  // Сначала лимиты реактора — иначе update() зажмёт radius на catalog 3.6.
  controls.minDistance = LAB_ORBIT.minDistance
  controls.maxDistance = LAB_ORBIT.maxDistance
  controls.minPolarAngle = LAB_ORBIT.minPolarAngle
  controls.maxPolarAngle = LAB_ORBIT.maxPolarAngle
  controls.target.set(pose.target[0], pose.target[1], pose.target[2])
  controls.setScale?.(1)

  // update() читает position → spherical → clamp → пишет обратно.
  camera.position.set(pose.position[0], pose.position[1], pose.position[2])
  controls.update?.()

  // Повтор: если React ещё держал catalog-лимиты на первом кадре — добиваем.
  camera.position.set(pose.position[0], pose.position[1], pose.position[2])
  camera.lookAt(pose.target[0], pose.target[1], pose.target[2])
  controls.target.set(pose.target[0], pose.target[1], pose.target[2])
  controls.setScale?.(1)
  controls.update?.()
}

/** Поза всё ещё близка к каталожному hero (признак «залипания»). */
export function isCameraStuckNearCatalogHero(
  position: { x: number; y: number; z: number },
  catalog: readonly [number, number, number] = [0, 0.12, 3.6],
  radius = 0.35,
): boolean {
  // 3D-шар: старый «только z ±1.1» ловил нормальный zoom (minDistance 2.8) и дрался с орбитой.
  const dx = position.x - catalog[0]
  const dy = position.y - catalog[1]
  const dz = position.z - catalog[2]
  return dx * dx + dy * dy + dz * dz < radius * radius
}

/**
 * Камера далеко от «домашней» позы превью → атомы за кадром (чёрный центр при живом уравнении).
 * Порог 2.75: catalog hero (z≈3.6) ≈3.16 от few — ловится; лёгкий zoom пользователя — нет.
 */
export function isCameraFarFromPreviewPose(
  position: { x: number; y: number; z: number },
  pose: ReactorPreviewCameraPose,
  maxDist = 2.75,
): boolean {
  const dx = position.x - pose.position[0]
  const dy = position.y - pose.position[1]
  const dz = position.z - pose.position[2]
  return dx * dx + dy * dy + dz * dz > maxDist * maxDist
}

/**
 * Нужен rescue ракурса превью (чёрный центр при живом уравнении).
 * Закрывает мёртвую зону: catalog hero не в шаре 0.35 и не дальше 3.5 от few.
 */
export function needsReactorPreviewCameraRescue(opts: {
  position: { x: number; y: number; z: number }
  pose: ReactorPreviewCameraPose
  catalogPosition?: readonly [number, number, number]
}): boolean {
  const catalog = opts.catalogPosition ?? ([0, 0.12, 3.6] as const)
  // Шире catalog-шар: OrbitControls часто оставляет камеру чуть рядом с 3.6.
  if (isCameraStuckNearCatalogHero(opts.position, catalog, 1.15)) return true
  if (isCameraFarFromPreviewPose(opts.position, opts.pose)) return true
  // Catalog clamp z=3.6 при home z≈6.3…7.3 — атомы «за кадром».
  if (opts.position.z < opts.pose.position[2] - 1.6) return true
  return false
}
