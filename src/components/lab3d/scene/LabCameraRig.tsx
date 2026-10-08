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
import { labEvents } from '../labEvents'
import type { LabSceneBridge } from './labBridge'
import { labCameraInsets } from './labCameraInsets'
import { hoodSash } from './LabHood'
import {
  CAMERA_BOUNDS,
  HOOD,
  HOOD_SASH_Z,
  TARGET_BOUNDS,
  cameraPoseFor,
  hoodOpening,
  insideHood,
  keepCameraOutOfFurniture,
  type LabViewId,
} from './labSceneLayout'

/**
 * Путь перелёта: прямой или через точку перед проёмом вытяжки (камера входит под створку и выходит из-под неё
 * горизонтально, а не сквозь стекло). Угол ломаной скруглён (квадратичная кривая), параметр — доля длины пути.
 */
interface FlightPath {
  readonly via: THREE.Vector3
  readonly w1: THREE.Vector3
  readonly w2: THREE.Vector3
  readonly l1: number
  readonly lc: number
  readonly l2: number
}

interface Flight {
  fromP: THREE.Vector3
  fromT: THREE.Vector3
  toP: THREE.Vector3
  toT: THREE.Vector3
  t: number
  dur: number
  path: FlightPath | null
  /** Перелёт крупного плана опыта: по окончании запоминается, где встала камера (сдвинул ли её ученик потом). */
  focus: boolean
}

/**
 * Полуширина свободной части экрана компьютера на крупном плане, в долях расстояния до предмета:
 * 1280×800, поле зрения 48°, панель опыта слева ≈ 376 px → tan 24° · (1280 − 376) / 800 ≈ 0,5.
 */
const PC_FOCUS_HALF_W = 0.5
const MAX_POLAR = 1.52
const MAX_POLAR_HOOD = 1.64
/** Камера у проёма вытяжки или в нём (там можно смотреть на риску снизу вверх). */
const nearHoodOpening = (p: THREE.Vector3) => p.z < HOOD_SASH_Z + 0.4 && Math.abs(p.x - HOOD.x) < HOOD.w / 2 && p.y < HOOD.h

/** Подъём створки для камеры: пока створка едет — по нижнему из «сейчас» и «куда едет» (проём не больше реального). */
const sashLift = () => Math.min(hoodSash.lift, hoodSash.target)

function makePath(from: THREE.Vector3, to: THREE.Vector3): FlightPath | null {
  const inFrom = insideHood(from)
  if (inFrom === insideHood(to)) return null
  const inner = inFrom ? from : to
  const op = hoodOpening(sashLift())
  // точка перед проёмом на высоте камеры внутри шкафа: участок via ↔ inner идёт горизонтально под планкой створки
  const via = new THREE.Vector3(inner.x, op ? Math.min(inner.y, op.max.y) : inner.y, HOOD_SASH_Z + 0.16)
  const L1 = from.distanceTo(via)
  const L2 = via.distanceTo(to)
  const r = Math.min(0.12, L1 * 0.45, L2 * 0.45)
  const w1 = via.clone().lerp(from, L1 > 1e-6 ? r / L1 : 0)
  const w2 = via.clone().lerp(to, L2 > 1e-6 ? r / L2 : 0)
  const lc = (w1.distanceTo(via) + via.distanceTo(w2) + w1.distanceTo(w2)) / 2
  return { via, w1, w2, l1: L1 - r, lc, l2: L2 - r }
}

function pathAt(f: Flight, k: number, out: THREE.Vector3): THREE.Vector3 {
  const P = f.path
  if (!P) return out.lerpVectors(f.fromP, f.toP, k)
  const s = k * (P.l1 + P.lc + P.l2)
  if (s <= P.l1) return out.lerpVectors(f.fromP, P.w1, P.l1 > 1e-6 ? s / P.l1 : 1)
  if (s >= P.l1 + P.lc) return out.lerpVectors(P.w2, f.toP, P.l2 > 1e-6 ? (s - P.l1 - P.lc) / P.l2 : 1)
  const u = P.lc > 1e-6 ? (s - P.l1) / P.lc : 1
  const a = (1 - u) * (1 - u)
  const b = 2 * u * (1 - u)
  const c = u * u
  return out.set(a * P.w1.x + b * P.via.x + c * P.w2.x, a * P.w1.y + b * P.via.y + c * P.w2.y, a * P.w1.z + b * P.via.z + c * P.w2.z)
}

interface Props {
  readonly view: LabViewId
  /** Меняется при каждом нажатии чипа — повторное нажатие того же вида возвращает камеру в точку. */
  readonly viewNonce: number
  readonly bridge: LabSceneBridge
  /** Ширина панели интерфейса слева (CSS px): вид сдвигается, чтобы стол и доска были в свободной части экрана. */
  readonly leftInsetPx?: number
}

const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)

export function LabCameraRig({ view, viewNonce, bridge, leftInsetPx = 0 }: Props) {
  const controls = useRef<OrbitControlsImpl>(null)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => s.size)
  const flight = useRef<Flight | null>(null)
  const portrait = size.width < size.height
  const boardPhone = view === 'board' && portrait

  // Поле зрения: на телефоне шире, чтобы стол помещался по ширине
  useLayoutEffect(() => {
    camera.fov = portrait ? 58 : 48
    camera.near = 0.03
    camera.far = 40
    camera.updateProjectionMatrix()
  }, [camera, portrait])

  /** Поза вида с учётом панели слева: подбираем по свободной ширине и сдвигаем вправо по экрану. */
  const poseFor = (v: LabViewId) => {
    const fov = portrait ? 58 : 48
    const inset = portrait ? 0 : Math.min(leftInsetPx, size.width * 0.45)
    const effAspect = (size.width - inset) / Math.max(1, size.height)
    const pose = cameraPoseFor(v, effAspect, fov)
    if (inset > 0) {
      const dist = pose.position.distanceTo(pose.target)
      const worldPerPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(fov) / 2)) / Math.max(1, size.height)
      const dir = pose.target.clone().sub(pose.position).normalize()
      const right = dir.cross(new THREE.Vector3(0, 1, 0)).normalize()
      const shift = right.multiplyScalar(-(inset / 2) * worldPerPx)
      pose.position.add(shift)
      pose.target.add(shift)
    }
    return pose
  }

  const flyTo = (toP: THREE.Vector3, toT: THREE.Vector3, dur = 0.9, focus = false) => {
    // Конечная точка перелёта — не внутри шкафа (в вытяжку — только под поднятую створку, в проём рабочей зоны)
    keepCameraOutOfFurniture(toP, sashLift())
    const c = controls.current
    if (!c) {
      camera.position.copy(toP)
      camera.lookAt(toT)
      return
    }
    const fromP = camera.position.clone()
    flight.current = { fromP, fromT: c.target.clone(), toP, toT, t: 0, dur, path: makePath(fromP, toP), focus }
  }

  // Первая поза — сразу, без перелёта
  const placed = useRef(false)
  useLayoutEffect(() => {
    if (placed.current) return
    const pose = poseFor(view)
    camera.position.copy(pose.position)
    camera.lookAt(pose.target)
    controls.current?.target.copy(pose.target)
    placed.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Крупные планы опыта: откуда камера ушла на первый крупный план цепочки (туда она и вернётся), где встала после
   * перелёта (если ученик потом сам повернул/приблизил камеру — возврата нет: ракурс ученика не сбрасываем).
   */
  const before = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  const focusEnd = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  const userTook = useRef(false)

  useEffect(() => {
    if (!placed.current) return
    const pose = poseFor(view)
    flyTo(pose.position, pose.target)
    // ученик выбрал вид — возврат после крупного плана идёт уже в этот вид; крупный план за панелью больше не следит
    before.current = null
    focusRaw.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, viewNonce, portrait, leftInsetPx])

  /**
   * Сдвиг крупного плана по экрану: предмет — в середине свободной части экрана (справа от панели опыта; на телефоне —
   * между полосой видов сверху и подсказкой/панелью снизу: раскрытая панель поднимает предмет над собой).
   */
  const centerInFree = (pos: THREE.Vector3, target: THREE.Vector3) => {
    const fov = portrait ? 58 : 48
    const inset = portrait ? 0 : Math.min(leftInsetPx, size.width * 0.45)
    const ins = labCameraInsets.get()
    // на сколько px вниз от середины холста середина свободной полосы (не больше четверти высоты)
    const down = THREE.MathUtils.clamp((ins.top - ins.bottom) / 2, -size.height * 0.25, size.height * 0.25)
    if (inset <= 0 && Math.abs(down) < 1) return
    const dist = pos.distanceTo(target)
    const worldPerPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(fov) / 2)) / Math.max(1, size.height)
    const dir = target.clone().sub(pos).normalize()
    const right = dir.clone().cross(new THREE.Vector3(0, 1, 0))
    if (right.lengthSq() < 1e-8) return
    right.normalize()
    const up = right.clone().cross(dir).normalize()
    // взгляд вверх — предмет на экране ниже (и наоборот)
    const shift = right.multiplyScalar(-(inset / 2) * worldPerPx).addScaledVector(up, down * worldPerPx)
    pos.add(shift)
    target.add(shift)
  }

  /**
   * Телефон (портрет): по ширине видно втрое меньше, чем на компьютере, — крупный план отъезжает, чтобы по ширине
   * поместилось столько же, сколько в свободной части экрана компьютера. Крупный план шкалы (бюретка, газометр — с
   * 0,1–0,2 м) отъезжает меньше: деления и цифры должны читаться.
   */
  const phoneFocusDistance = (pos: THREE.Vector3, target: THREE.Vector3) => {
    if (!portrait) return
    const halfW = Math.tan(THREE.MathUtils.degToRad(58) / 2) * (size.width / Math.max(1, size.height))
    const f0 = THREE.MathUtils.clamp(PC_FOCUS_HALF_W / halfW, 1, 1.8)
    const k = THREE.MathUtils.clamp((pos.distanceTo(target) - 0.1) / 0.2, 0.3, 1)
    pos.sub(target).multiplyScalar(1 + (f0 - 1) * k).add(target)
  }

  // Крупный план от опыта ('focus') и возврат в текущий вид ('focusReset'); двойной клик по предмету — приближение
  const poseRef = useRef(poseFor)
  poseRef.current = poseFor
  const centerRef = useRef(centerInFree)
  centerRef.current = centerInFree
  const phoneDistRef = useRef(phoneFocusDistance)
  phoneDistRef.current = phoneFocusDistance
  /** Крупный план на экране — до сдвига в свободную часть экрана (чтобы пересчитать сдвиг, когда панель раскрыли). */
  const focusRaw = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  // Раскрыли/свернули панель на телефоне при крупном плане — предмет переезжает в середину свободной полосы
  // (если ученик сам не повернул камеру)
  useEffect(
    () =>
      labCameraInsets.subscribe(() => {
        const raw = focusRaw.current
        const c = controls.current
        if (!raw || !c || userTook.current) return
        const end = focusEnd.current
        if (end && !flight.current && (camera.position.distanceTo(end.position) > 0.08 || c.target.distanceTo(end.target) > 0.08)) return
        const pos = raw.position.clone()
        const target = raw.target.clone()
        centerRef.current(pos, target)
        focusEnd.current = null
        flyTo(pos, target, 0.5, true)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [camera],
  )
  const viewRef = useRef(view)
  viewRef.current = view
  useEffect(() => {
    const debug = typeof window !== 'undefined' && /[?&]debug(Lab|Cam)=1/.test(window.location.hash)
    const log = (type: string) => {
      if (!debug) return
      const w = window as unknown as { __labCamLog?: { t: number; type: string }[] }
      ;(w.__labCamLog ??= []).push({ t: Math.round(performance.now()), type })
    }
    const offFocus = labEvents.on('focus', (e) => {
      const c = controls.current
      // первый крупный план цепочки: запомнить, откуда пришли (если камера ещё летит в вид — то куда летит)
      if (!before.current && c) {
        const f = flight.current
        before.current = f && !f.focus ? { position: f.toP.clone(), target: f.toT.clone() } : { position: camera.position.clone(), target: c.target.clone() }
      }
      userTook.current = false
      focusEnd.current = null
      const target = new THREE.Vector3(...e.target)
      const pos = new THREE.Vector3(...e.position)
      phoneDistRef.current(pos, target)
      pos.clamp(CAMERA_BOUNDS.min, CAMERA_BOUNDS.max)
      focusRaw.current = { position: pos.clone(), target: target.clone() }
      centerRef.current(pos, target)
      log('focus')
      flyTo(pos, target, 1.1, true)
    })
    const offReset = labEvents.on('focusReset', () => {
      const c = controls.current
      const back = before.current
      const end = focusEnd.current
      before.current = null
      focusEnd.current = null
      focusRaw.current = null
      // ученик сам повернул/приблизил камеру на крупном плане — оставляем его ракурс
      const moved = !!end && !!c && !flight.current && (camera.position.distanceTo(end.position) > 0.08 || c.target.distanceTo(end.target) > 0.08)
      if (userTook.current || moved) {
        userTook.current = false
        log('focusReset:kept')
        return
      }
      log('focusReset')
      const pose = back ?? poseRef.current(viewRef.current)
      flyTo(pose.position.clone(), pose.target.clone(), 1.0)
    })
    bridge.zoomTo = (p, dist = 0.6) => {
      userTook.current = true
      const target = new THREE.Vector3(p.x, p.y, p.z)
      const dir = camera.position.clone().sub(target)
      dir.y = Math.max(dir.y, dir.length() * 0.35)
      const pos = target.clone().add(dir.normalize().multiplyScalar(dist))
      pos.clamp(CAMERA_BOUNDS.min, CAMERA_BOUNDS.max)
      flyTo(pos, target.clamp(TARGET_BOUNDS.min, TARGET_BOUNDS.max), 0.8)
    }
    return () => {
      offFocus()
      offReset()
      bridge.zoomTo = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge, camera])

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
    // в вытяжке камера под планкой створки смотрит на риску горизонтально или чуть снизу (глаз на уровне мениска)
    c.maxPolarAngle = nearHoodOpening(f ? f.toP : camera.position) || nearHoodOpening(camera.position) ? MAX_POLAR_HOOD : MAX_POLAR
    if (f) {
      f.t = Math.min(1, f.t + dt / f.dur)
      const k = ease(f.t)
      pathAt(f, k, camera.position)
      c.target.lerpVectors(f.fromT, f.toT, k)
      c.enabled = f.t >= 1
      if (f.t >= 1) flight.current = null
      c.update()
      if (f.t >= 1 && f.focus) focusEnd.current = { position: camera.position.clone(), target: c.target.clone() }
      return
    }
    // Не за стены, не под столешницу, не внутрь вытяжки/шкафов (изнутри коробки её грани не видны — «просвечивает»);
    // в вытяжку — только в проём под поднятой створкой
    camera.position.clamp(CAMERA_BOUNDS.min, CAMERA_BOUNDS.max)
    keepCameraOutOfFurniture(camera.position, sashLift())
    c.target.clamp(TARGET_BOUNDS.min, TARGET_BOUNDS.max)
  })

  // Для автоматических проверок: …#/vr-lab?debugLab=1 — window.__labCam.get() / set(позиция, цель)
  useEffect(() => {
    if (typeof window === 'undefined' || !/[?&]debug(Lab|Cam)=1/.test(window.location.hash)) return
    const w = window as unknown as { __labCam?: unknown }
    const r3 = (v: THREE.Vector3) => [v.x, v.y, v.z].map((n) => Math.round(n * 1000) / 1000)
    w.__labCam = {
      scene: () => scene,
      get: () => ({ position: r3(camera.position), target: controls.current ? r3(controls.current.target) : null }),
      // предмет крупного плана (до сдвига в свободную часть экрана) на холсте, CSS px от левого верхнего угла холста
      focusOnScreen: () => {
        const raw = focusRaw.current
        if (!raw) return null
        const p = raw.target.clone().project(camera)
        return [Math.round(((p.x + 1) / 2) * size.width), Math.round(((1 - p.y) / 2) * size.height)]
      },
      set: (p: [number, number, number], t: [number, number, number]) => {
        flight.current = null
        camera.position.set(...p)
        controls.current?.target.set(...t)
        controls.current?.update()
      },
    }
    return () => {
      delete w.__labCam
    }
  }, [camera, scene, size.width, size.height])

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      rotateSpeed={0.55}
      zoomSpeed={0.8}
      panSpeed={0.7}
      screenSpacePanning
      enableRotate={!boardPhone}
      // крупный план шкалы (бюретка, газометр) — с 0,1–0,15 м
      minDistance={0.1}
      maxDistance={5}
      minPolarAngle={0.25}
      maxPolarAngle={MAX_POLAR}
      minAzimuthAngle={-1.25}
      maxAzimuthAngle={1.25}
      touches={{ ONE: boardPhone ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
    />
  )
}
