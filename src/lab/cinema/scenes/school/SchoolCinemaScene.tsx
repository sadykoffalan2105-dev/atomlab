import { startTransition, Suspense, useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useLocale } from '../../../../i18n/useLocale'
import { heroHandoff } from '../../../../components/lab/hero/heroHandoff'
import { catalogHeroCameraPose, catalogHeroFrameFor } from '../../../../components/lab/hero/heroFrame'
import { createSchoolMatteMaterial, schoolSphereGeometry } from '../../../../components/lab/hero/schoolHeroStyle'
import { createSafeArea, measureSafeArea, measureSafeAreaAfterPaint, SAFE_AREA_EVERY, SAFE_AREA_LAMBDA, type SafeArea } from '../../core/safeArea'
import { damp } from '../../core/spring'
import { CinemaDomLabels } from '../../react/CinemaDomLabels'
import { cinemaPlayhead, clo2StepStore, type Clo2StepStatus } from '../clo2/clo2StepStore'
import { toSceneLocale } from '../kit/sceneKit'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import { SchoolReactionScene, type SchoolLightRig } from './SchoolReactionScene'
import type { SchoolRuntimeScene, SchoolRuntimeStatus, SchoolSceneFactory } from './schoolRuntime'
import type { SchoolSceneSpec } from './schoolSpec'

/**
 * R3F-АДАПТЕР школьной сцены (по образцу NaclCinemaScene, без передачи решётки герою). Сцена — класс
 * с интерфейсом SchoolRuntimeScene: SchoolReactionScene («образование молекулы», по spec) или любой
 * другой через фабрику create (solution/SolutionExchangeScene — «обмен в растворе»); адаптер:
 *   • создаёт сцену на прогон, кладёт root в сцену R3F и зовёт update в useFrame;
 *   • прогревает шейдеры и лишь потом запускает шаг 0;
 *   • связывает панель урока (clo2StepStore) с goToStep / replay / finish;
 *   • пробрасывает контракт лаборатории: embryo → birth → complete (в хвосте сцена гаснет);
 *   • кадрирует root по свободной от панелей области (core/safeArea), подписи — CinemaDomLabels;
 *   • ставит тёмный фон сцены и на выходе возвращает фон лаборатории.
 */

const FILL = 0.9
const WARMUP_TIMEOUT_MS = 1500
const DONE_DELAY_MS = 320

const LIGHTS = new WeakMap<THREE.Scene, SchoolLightRig>()
/** Свет живёт в сцене R3F постоянно (после урока — нулевой): число источников у лаборатории не меняется. */
function persistentLights(scene: THREE.Scene): SchoolLightRig {
  let rig = LIGHTS.get(scene)
  if (!rig) {
    rig = {
      ambient: new THREE.AmbientLight(0xdfe8ff, 0),
      key: new THREE.DirectionalLight(0xffffff, 0),
      point: new THREE.PointLight(0xbfe6ff, 0, 12, 1.6),
    }
    rig.key.position.set(3.5, 5, 6)
    rig.ambient.name = 'school-light-ambient'
    rig.key.name = 'school-light-key'
    rig.point.name = 'school-light-point'
    scene.add(rig.ambient, rig.key, rig.key.target, rig.point)
    LIGHTS.set(scene, rig)
  }
  rig.ambient.intensity = 0.34
  rig.key.intensity = 0.9
  rig.point.intensity = 0.45
  return rig
}

type Runtime = {
  scene: SchoolRuntimeScene
  safe: SafeArea
  ox: number
  oy: number
  scale: number
  /** передача кадра герою: камера в хвосте подъезжает к кадру героя (как у NaCl) */
  cam: HandoffCam
}

type HandoffCam = {
  armed: boolean
  released: boolean
  fromPos: THREE.Vector3
  fromTarget: THREE.Vector3
  fromFov: number
  toPos: THREE.Vector3
  toTarget: THREE.Vector3
  toFov: number
  /** место героя (центр кадра героя) — пока тело героя не смонтировано */
  ghost: THREE.Object3D
}

/** Герой в кадре: сцена прячет свой кадр, камера отдана лаборатории. */
function releaseToHero(rt: Runtime): void {
  rt.scene.releaseToHero?.()
  rt.cam.released = true
}

const _pose = { position: [0, 0, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number], fov: 40 }
const _camTarget = new THREE.Vector3()

/**
 * Хвост с передачей кадра: камера плавно едет к кадру героя продукта (тот же, что у лаборатории после
 * урока). Кадр урока привязан к камере (frameRoot) и на экране не дёргается; кристалл урока сцена ведёт
 * к месту героя — к концу хвоста он стоит там, где появится герой, и лаборатории не нужен доезд камеры.
 */
function driveHandoffCamera(rt: Runtime, compoundId: string, cam: THREE.PerspectiveCamera, controls: Controls, canvas: HTMLCanvasElement): void {
  const c = rt.cam
  const fin = rt.scene.model.finish
  if (c.released || !fin) return
  const t = rt.scene.time
  if (t < fin.from) {
    c.armed = false
    return
  }
  if (!c.armed) {
    c.armed = true
    c.fromPos.copy(cam.position)
    if (controls?.target) c.fromTarget.copy(controls.target)
    else c.fromTarget.set(0, 0, -1).applyQuaternion(cam.quaternion).multiplyScalar(9).add(cam.position)
    c.fromFov = cam.fov
    catalogHeroCameraPose(catalogHeroFrameFor(canvas, compoundId, { ignoreLessonPanel: true }), _pose)
    c.toPos.set(_pose.position[0], _pose.position[1], _pose.position[2])
    c.toTarget.set(_pose.target[0], _pose.target[1], _pose.target[2])
    c.toFov = _pose.fov
    c.ghost.position.copy(c.toTarget)
    c.ghost.updateMatrixWorld(true)
  }
  const x = Math.min(1, Math.max(0, (t - fin.from) / (fin.to - fin.from)))
  const u = x * x * (3 - 2 * x)
  cam.position.lerpVectors(c.fromPos, c.toPos, u)
  _camTarget.lerpVectors(c.fromTarget, c.toTarget, u)
  cam.lookAt(_camTarget)
  if (controls?.target) controls.target.copy(_camTarget)
  const fov = c.fromFov + (c.toFov - c.fromFov) * u
  if (Math.abs(cam.fov - fov) > 1e-4) {
    cam.fov = fov
    cam.updateProjectionMatrix()
  }
}

/** Фон урока — фоном сцены R3F; возвращает прежний фон лаборатории (или null). */
function takeBackground(threeScene: THREE.Scene, scene: SchoolRuntimeScene): THREE.Color | null {
  const prev = threeScene.background instanceof THREE.Color ? threeScene.background : null
  scene.setHostBackground(prev)
  threeScene.background = scene.background
  return prev
}

/** Вернуть фон лаборатории (если его за время урока не заменили). */
function restoreBackground(threeScene: THREE.Scene, scene: SchoolRuntimeScene, prev: THREE.Color | null): void {
  if (threeScene.background === scene.background) threeScene.background = prev
}

const _extent = { w: 1, h: 1, cx: 0, cy: 0 }
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _target = new THREE.Vector3()

type Controls = { target?: THREE.Vector3 } | null

/** Кадрирование root: центр композиции — в середину свободной области, габарит шага вписан в неё. */
function frameRoot(rt: Runtime, cam: THREE.PerspectiveCamera, controls: Controls, canvas: HTMLCanvasElement, w: number, h: number, dt: number, dpr: number): void {
  const safe = rt.safe
  if (safe.counter++ % SAFE_AREA_EVERY === 0) {
    if (safe.ready) measureSafeAreaAfterPaint(safe, canvas)
    else measureSafeArea(safe, canvas)
  }
  if (controls?.target) _target.copy(controls.target)
  else _target.set(0, 0, -1).applyQuaternion(cam.quaternion).multiplyScalar(9).add(cam.position)
  const dist = Math.max(0.1, cam.position.distanceTo(_target))
  const pxPerUnit = h / (2 * dist * Math.tan((cam.fov * Math.PI) / 360))
  const left = safe.ready ? safe.left : 0
  const right = safe.ready ? safe.right : w
  const top = safe.ready ? safe.top : 0
  const bottom = safe.ready ? safe.bottom : h
  const ox = ((left + right) / 2 - w / 2) / pxPerUnit
  const oy = -((top + bottom) / 2 - h / 2) / pxPerUnit
  rt.scene.extentAt(rt.scene.time, _extent)
  const s = FILL * Math.min((right - left) / pxPerUnit / _extent.w, (bottom - top) / pxPerUnit / _extent.h)
  const oxc = ox - _extent.cx * s
  const oyc = oy - _extent.cy * s
  const k = Math.min(0.1, Math.max(0, dt))
  if (rt.scale === 0) {
    rt.ox = oxc
    rt.oy = oyc
    rt.scale = s
  } else {
    rt.ox = damp(rt.ox, oxc, SAFE_AREA_LAMBDA, k)
    rt.oy = damp(rt.oy, oyc, SAFE_AREA_LAMBDA, k)
    rt.scale = damp(rt.scale, s, SAFE_AREA_LAMBDA, k)
  }
  _right.setFromMatrixColumn(cam.matrixWorld, 0)
  _up.setFromMatrixColumn(cam.matrixWorld, 1)
  const root = rt.scene.root
  root.position.copy(_target).addScaledVector(_right, rt.ox).addScaledVector(_up, rt.oy)
  // Перспективу не «лечим» гомотетией от камеры (она даёт тот же кадр): сцена не вращает композицию
  // целиком — каждая молекула поворачивается вокруг своего центра (schoolModel), и размеры честные.
  root.quaternion.copy(cam.quaternion)
  root.scale.setScalar(rt.scale)
  rt.scene.setViewport(h, cam.fov, dpr)
}

const STATUS: Record<SchoolRuntimeStatus, Clo2StepStatus | null> = {
  idle: null,
  playing: 'playing',
  paused: 'paused',
  finishing: 'finishing',
  done: 'done',
}

export type SchoolCinemaSceneProps = ScientificSynthesisFxProps & {
  /** Сцена «образование молекулы» по спецификации (SchoolReactionScene). */
  spec?: SchoolSceneSpec
  /** Любая другая сцена с интерфейсом SchoolRuntimeScene (стабильная ссылка на модуль). */
  create?: SchoolSceneFactory
  /** id урока панели (lessons.ts) — обычно spec.id. */
  lesson?: string
  /**
   * Вещество героя, которому сцена передаёт кадр (hero/heroHandoff): герой монтируется сразу в полный
   * размер и невидим, пока сцена не отпустит его; кристалл урока в хвосте встаёт на его место.
   */
  heroCompound?: string
}

export function SchoolCinemaScene(props: SchoolCinemaSceneProps) {
  const { runId = 0, lowPower = false, spec, create, heroCompound } = props
  const lesson = props.lesson ?? spec?.id ?? 'school'
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const threeScene = useThree((s) => s.scene)
  const locale = toSceneLocale(useLocale().locale)
  const [rt, setRt] = useState<Runtime | null>(null)

  const cbRef = useRef(props)
  useEffect(() => {
    cbRef.current = props
  })
  const localeRef = useRef(locale)
  useEffect(() => {
    localeRef.current = locale
    rt?.scene.setLocale(locale)
  }, [locale, rt])

  useEffect(() => {
    let started = false
    let cancelled = false
    let doneTimer = 0
    const options = {
      locale: localeRef.current,
      lowPower,
      lights: persistentLights(threeScene),
      onStatus: (status: SchoolRuntimeStatus, step: number) => {
        const s = STATUS[status]
        if (!s) return
        if (status === 'done') {
          doneTimer = window.setTimeout(() => clo2StepStore.report(runId, step, s), DONE_DELAY_MS)
          return
        }
        clo2StepStore.report(runId, step, s)
      },
      onCue: (id: string) => {
        const cb = cbRef.current
        if (id === 'embryo') startTransition(() => cb.onEmbryoReady?.())
        else if (id === 'birth') startTransition(() => cb.onBirthReady?.())
        else if (id === 'complete') {
          // кристалл урока стоит на месте героя — героя можно показывать
          if (heroCompound) heroHandoff.release(runId)
          cb.onComplete()
        } else cb.onNarrationCue?.(id)
      },
    }
    const scene: SchoolRuntimeScene = create ? create(options) : new SchoolReactionScene(spec!, options)
    if (heroCompound && scene.setHandoffTarget) heroHandoff.claim(runId, heroCompound)
    const prevBg = takeBackground(threeScene, scene)
    const runtime: Runtime = {
      scene,
      safe: createSafeArea(),
      ox: 0,
      oy: 0,
      scale: 0,
      cam: {
        armed: false,
        released: false,
        fromPos: new THREE.Vector3(),
        fromTarget: new THREE.Vector3(),
        fromFov: 40,
        toPos: new THREE.Vector3(),
        toTarget: new THREE.Vector3(),
        toFov: 40,
        ghost: new THREE.Object3D(),
      },
    }
    clo2StepStore.attach(
      runId,
      {
        playStep: (i) => {
          started = true
          void scene.goToStep(i)
        },
        replayStep: () => void scene.replay(),
        finish: () => void scene.finish(),
      },
      lesson,
      scene.stepCount,
    )
    setRt(runtime)
    if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('schoolSeek')) {
      // Отладка и кадры: перемотка сюжета (__schoolSeek(t)) — панель урока встаёт на шаг момента t.
      ;(window as unknown as Record<string, unknown>).__schoolSeek = (t: number) => {
        started = true
        void scene.goToStep(scene.model.timing.stepIndexAt(t), { instant: true })
        scene.seek(t)
      }
    }

    const start = () => {
      if (cancelled || started) return
      started = true
      void scene.goToStep(0)
    }
    const timer = window.setTimeout(start, WARMUP_TIMEOUT_MS)
    // Прогрев и программы героя (matcap, instanced): в хвосте герой монтируется без компиляции шейдера.
    const heroWarm = heroCompound ? new THREE.InstancedMesh(schoolSphereGeometry(lowPower), createSchoolMatteMaterial(), 1) : null
    if (heroWarm) {
      heroWarm.setColorAt(0, new THREE.Color(0xffffff))
      heroWarm.visible = false
      scene.root.add(heroWarm)
    }
    const raf = requestAnimationFrame(() => {
      if (cancelled) return
      void scene.warmup(gl, camera, threeScene).then(() => {
        if (heroWarm) {
          heroWarm.removeFromParent()
          ;(heroWarm.material as THREE.Material).dispose()
          heroWarm.dispose()
        }
        start()
      })
    })

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.clearTimeout(doneTimer)
      cancelAnimationFrame(raf)
      scene.dispose()
      clo2StepStore.detach(runId)
      if (heroCompound) heroHandoff.abandon(runId)
      restoreBackground(threeScene, scene, prevBg)
      setRt(null)
    }
  }, [runId, lowPower, gl, camera, threeScene, spec, create, lesson, heroCompound])

  useFrame((state, dt) => {
    if (!rt) return
    const cam = state.camera as THREE.PerspectiveCamera
    const controls = state.controls as unknown as Controls
    if (heroCompound && rt.scene.setHandoffTarget) driveHandoffCamera(rt, heroCompound, cam, controls, state.gl.domElement)
    frameRoot(rt, cam, controls, state.gl.domElement, state.size.width, state.size.height, dt, state.gl.getPixelRatio())
    // Точечный свет — перед молекулой и чуть выше (между сценой и камерой), а не в начале координат лаборатории:
    // оттуда, снизу, он давал розовый блик на нижней кромке шаров (O у NO, N₂O₅).
    const pl = LIGHTS.get(state.scene)?.point
    if (pl) pl.position.copy(rt.scene.root.position).lerp(cam.position, 0.35).addScaledVector(_up, 0.08 * cam.position.distanceTo(rt.scene.root.position))
    if (heroCompound && rt.scene.setHandoffTarget) {
      // передача кадра: кристалл урока встаёт на место тела героя; герой показан — сцена прячет свой кадр
      const body = heroHandoff.getBody(heroCompound)
      rt.scene.setHandoffTarget(body ?? (rt.cam.armed ? rt.cam.ghost : null), !body)
      const hs = heroHandoff.getSnapshot()
      if (hs.runId === runId && hs.shown) releaseToHero(rt)
    }
    rt.scene.update(dt, cam)
    cinemaPlayhead.t = rt.scene.time
    cinemaPlayhead.runId = runId
  })

  if (!rt) return null
  return (
    <primitive object={rt.scene.root}>
      <CinemaDomLabels labels={rt.scene.labels} safe={rt.safe} layout />
      {/* Прогрев troika-текста (невидимо) — в СВОЕЙ границе Suspense: иначе React спрятал бы всё дерево сцены. */}
      <Suspense fallback={null}>
        <Text visible={false} fontSize={0.01}>
          0123456789
        </Text>
      </Suspense>
    </primitive>
  )
}
