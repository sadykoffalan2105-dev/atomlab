/**
 * Камера без VR: OrbitControls с ограничениями (не за стены, не под стол, ограниченный зум) и плавные перелёты
 * между точками «Стол», «Доска», «Полки», «Вытяжка». Мышь: левая — вращение, правая — сдвиг, колесо — зум.
 * Касание: один палец — вращение, два — зум и сдвиг. На телефоне в режиме «Доска» доска во всю высоту, листается по ширине.
 */
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { BOARD_CENTER, BOARD_SIZE } from '../labContract'
import type { LabSceneBridge } from './labBridge'
import { CAMERA_BOUNDS, TARGET_BOUNDS, cameraPoseFor, type LabViewId } from './labSceneLayout'

interface Flight {
  fromP: THREE.Vector3
  fromT: THREE.Vector3
  toP: THREE.Vector3
  toT: THREE.Vector3
  t: number
  dur: number
}

interface Props {
  readonly view: LabViewId
  /** Меняется при каждом нажатии чипа — повторное нажатие того же вида возвращает камеру в точку. */
  readonly viewNonce: number
  readonly bridge: LabSceneBridge
}

const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)

export function LabCameraRig({ view, viewNonce, bridge }: Props) {
  const controls = useRef<OrbitControlsImpl>(null)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const flight = useRef<Flight | null>(null)
  const portrait = size.width < size.height
  const aspect = size.width / Math.max(1, size.height)
  const boardPhone = view === 'board' && portrait

  // Поле зрения: на телефоне шире, чтобы стол помещался по ширине
  useLayoutEffect(() => {
    camera.fov = portrait ? 58 : 48
    camera.near = 0.03
    camera.far = 40
    camera.updateProjectionMatrix()
  }, [camera, portrait])

  const flyTo = (toP: THREE.Vector3, toT: THREE.Vector3, dur = 0.9) => {
    const c = controls.current
    if (!c) {
      camera.position.copy(toP)
      camera.lookAt(toT)
      return
    }
    flight.current = { fromP: camera.position.clone(), fromT: c.target.clone(), toP, toT, t: 0, dur }
  }

  // Первая поза — сразу, без перелёта
  const placed = useRef(false)
  useLayoutEffect(() => {
    if (placed.current) return
    const pose = cameraPoseFor(view, aspect, portrait ? 58 : 48)
    camera.position.copy(pose.position)
    camera.lookAt(pose.target)
    controls.current?.target.copy(pose.target)
    placed.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!placed.current) return
    const pose = cameraPoseFor(view, aspect, portrait ? 58 : 48)
    flyTo(pose.position, pose.target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, viewNonce, portrait])

  // Листание доски на телефоне
  useEffect(() => {
    bridge.boardPanEnabled = boardPhone
    const visibleHalfW = () => {
      const c = controls.current
      const dist = c ? camera.position.distanceTo(c.target) : 1
      return dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect
    }
    const maxShift = () => Math.max(0, BOARD_SIZE.w / 2 - visibleHalfW() + 0.05)
    bridge.panBoard = (dxPx) => {
      const c = controls.current
      if (!c || !boardPhone) return
      const dist = camera.position.distanceTo(c.target)
      const worldPerPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / Math.max(1, size.height)
      const m = maxShift()
      const nx = THREE.MathUtils.clamp(c.target.x - dxPx * worldPerPx, BOARD_CENTER.x - m, BOARD_CENTER.x + m)
      const d = nx - c.target.x
      c.target.x += d
      camera.position.x += d
      c.update()
    }
    bridge.shiftBoard = (dir) => {
      const c = controls.current
      if (!c) return
      const m = maxShift()
      const nx = THREE.MathUtils.clamp(c.target.x + dir * visibleHalfW() * 1.3, BOARD_CENTER.x - m, BOARD_CENTER.x + m)
      const d = nx - c.target.x
      flyTo(camera.position.clone().setX(camera.position.x + d), c.target.clone().setX(nx), 0.45)
    }
    return () => {
      bridge.boardPanEnabled = false
      bridge.panBoard = null
      bridge.shiftBoard = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge, boardPhone, camera, size.height])

  useFrame((_, dt) => {
    const c = controls.current
    if (!c) return
    const f = flight.current
    if (f) {
      f.t = Math.min(1, f.t + dt / f.dur)
      const k = ease(f.t)
      camera.position.lerpVectors(f.fromP, f.toP, k)
      c.target.lerpVectors(f.fromT, f.toT, k)
      c.enabled = f.t >= 1
      if (f.t >= 1) flight.current = null
      c.update()
      return
    }
    // Не за стены, не под столешницу
    camera.position.clamp(CAMERA_BOUNDS.min, CAMERA_BOUNDS.max)
    c.target.clamp(TARGET_BOUNDS.min, TARGET_BOUNDS.max)
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.09}
      rotateSpeed={0.55}
      zoomSpeed={0.8}
      panSpeed={0.7}
      screenSpacePanning
      enableRotate={!boardPhone}
      minDistance={0.35}
      maxDistance={5}
      minPolarAngle={0.25}
      maxPolarAngle={1.52}
      minAzimuthAngle={-1.25}
      maxAzimuthAngle={1.25}
      touches={{ ONE: boardPhone ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
    />
  )
}
