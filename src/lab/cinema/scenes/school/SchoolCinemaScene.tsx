import { startTransition, Suspense, useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useLocale } from '../../../../i18n/useLocale'
import { createSafeArea, measureSafeArea, measureSafeAreaAfterPaint, SAFE_AREA_EVERY, SAFE_AREA_LAMBDA, type SafeArea } from '../../core/safeArea'
import { damp } from '../../core/spring'
import { CinemaDomLabels } from '../../react/CinemaDomLabels'
import { cinemaPlayhead, clo2StepStore, type Clo2StepStatus } from '../clo2/clo2StepStore'
import { toSceneLocale } from '../kit/sceneKit'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import { SchoolReactionScene, type SchoolLightRig, type SchoolStatus } from './SchoolReactionScene'
import type { SchoolSceneSpec } from './schoolSpec'

/**
 * R3F-АДАПТЕР школьной сцены образования молекулы (по образцу NaclCinemaScene, без передачи решётки
 * герою). Вся сцена — класс SchoolReactionScene; адаптер:
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
  scene: SchoolReactionScene
  safe: SafeArea
  ox: number
  oy: number
  scale: number
}

/** Фон урока — фоном сцены R3F; возвращает прежний фон лаборатории (или null). */
function takeBackground(threeScene: THREE.Scene, scene: SchoolReactionScene): THREE.Color | null {
  const prev = threeScene.background instanceof THREE.Color ? threeScene.background : null
  scene.setHostBackground(prev)
  threeScene.background = scene.background
  return prev
}

/** Вернуть фон лаборатории (если его за время урока не заменили). */
function restoreBackground(threeScene: THREE.Scene, scene: SchoolReactionScene, prev: THREE.Color | null): void {
  if (threeScene.background === scene.background) threeScene.background = prev
}

const _extent = { w: 1, h: 1, cx: 0, cy: 0 }
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _target = new THREE.Vector3()

type Controls = { target?: THREE.Vector3 } | null

/** Кадрирование root: центр композиции — в середину свободной области, габарит шага вписан в неё. */
function frameRoot(rt: Runtime, cam: THREE.PerspectiveCamera, controls: Controls, canvas: HTMLCanvasElement, w: number, h: number, dt: number): void {
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
  rt.scene.setViewport(h, cam.fov)
}

const STATUS: Record<SchoolStatus, Clo2StepStatus | null> = {
  idle: null,
  playing: 'playing',
  paused: 'paused',
  finishing: 'finishing',
  done: 'done',
}

export type SchoolCinemaSceneProps = ScientificSynthesisFxProps & {
  spec: SchoolSceneSpec
  /** id урока панели (lessons.ts) — обычно spec.id. */
  lesson?: string
}

export function SchoolCinemaScene(props: SchoolCinemaSceneProps) {
  const { runId = 0, lowPower = false, spec } = props
  const lesson = props.lesson ?? spec.id
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
    const scene = new SchoolReactionScene(spec, {
      locale: localeRef.current,
      lowPower,
      lights: persistentLights(threeScene),
      onStatus: (status, step) => {
        const s = STATUS[status]
        if (!s) return
        if (status === 'done') {
          doneTimer = window.setTimeout(() => clo2StepStore.report(runId, step, s), DONE_DELAY_MS)
          return
        }
        clo2StepStore.report(runId, step, s)
      },
      onCue: (id) => {
        const cb = cbRef.current
        if (id === 'embryo') startTransition(() => cb.onEmbryoReady?.())
        else if (id === 'birth') startTransition(() => cb.onBirthReady?.())
        else if (id === 'complete') cb.onComplete()
        else cb.onNarrationCue?.(id)
      },
    })
    const prevBg = takeBackground(threeScene, scene)
    const runtime: Runtime = { scene, safe: createSafeArea(), ox: 0, oy: 0, scale: 0 }
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
    const raf = requestAnimationFrame(() => {
      if (cancelled) return
      void scene.warmup(gl, camera, threeScene).then(start)
    })

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.clearTimeout(doneTimer)
      cancelAnimationFrame(raf)
      scene.dispose()
      clo2StepStore.detach(runId)
      restoreBackground(threeScene, scene, prevBg)
      setRt(null)
    }
  }, [runId, lowPower, gl, camera, threeScene, spec, lesson])

  useFrame((state, dt) => {
    if (!rt) return
    const cam = state.camera as THREE.PerspectiveCamera
    const controls = state.controls as unknown as Controls
    frameRoot(rt, cam, controls, state.gl.domElement, state.size.width, state.size.height, dt)
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
