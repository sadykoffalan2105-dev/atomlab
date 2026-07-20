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
  /** Сколько мс удерживать позу после программного set (против гонки OrbitControls). */
  lockMs: 280,
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
  catalogZ = 3.6,
  eps = 0.55,
): boolean {
  return Math.abs(position.z - catalogZ) < eps && Math.abs(position.x) < 0.35
}
