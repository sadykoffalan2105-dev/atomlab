import { startTransition, Suspense, useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useLocale } from '../../../../i18n/useLocale'
import { catalogHeroCameraPose, catalogHeroFrameFor } from '../../../../components/lab/hero/heroFrame'
import { heroHandoff } from '../../../../components/lab/hero/heroHandoff'
import { createSafeArea, measureSafeArea, measureSafeAreaAfterPaint, SAFE_AREA_EVERY, SAFE_AREA_LAMBDA, type SafeArea } from '../../core/safeArea'
import { damp } from '../../core/spring'
import { CinemaDomLabels } from '../../react/CinemaDomLabels'
import { cinemaPlayhead, clo2StepStore, type Clo2StepStatus } from '../clo2/clo2StepStore'
import { toSceneLocale } from '../kit/sceneKit'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import { NaClReactionScene, type NaclLightRig, type NaclStatus } from './NaClReactionScene'
import { NACL_FINISH, NACL_STEPS } from './naclSteps'
import { prebuildNaclHeroView } from './naclLatticeView'
import { validateNaclEnergetics } from './naclEnergetics'
import { naclDepthPushAt, naclExtentAt, validateNaclModel } from './naclModel'
import { isPerfProbeEnabled } from '../../../perf/labPerfProbe'

/**
 * Урок «ионная связь»: 2 Na (тв.) + Cl₂ (г.) → 2 NaCl (тв.) — ТОНКИЙ R3F-АДАПТЕР.
 *
 * Вся сцена — фреймворк-независимый класс NaClReactionScene (three + GSAP). Адаптер только:
 *   • создаёт сцену на прогон, кладёт её root в сцену R3F и зовёт update в useFrame;
 *   • прогревает шейдеры (warmup → compileAsync) и лишь потом запускает шаг 0;
 *   • связывает панель урока (clo2StepStore: шаги, «Далее» / «Повторить» / автоплей, статус
 *     playing → paused → finishing → done) с goToStep / replay / finish;
 *   • пробрасывает контракт лаборатории (ScientificSynthesisFxProps): embryo → birth → complete;
 *   • кадрирует root по свободной от панелей области (core/safeArea), подписи — CinemaDomLabels;
 *   • ведёт передачу кадра герою продукта (hero/heroHandoff): в хвосте камера подъезжает к кадру
 *     героя, решётка сцены встаёт ровно на его место, герой показывается, решётка сцены гаснет —
 *     в кадре всегда одна решётка;
 *   • ставит фон сцены (#0a0b10) и на выходе возвращает фон лаборатории.
 *
 * Пост-обработку (bloom) адаптер НЕ монтирует: композер меняет тонмаппинг кадра, и герой после
 * размонтирования сцены выглядел бы иначе, чем решётка сцены за кадр до этого. Электрон светится
 * сам: яркое ядро без тонмаппинга + аддитивный ореол + след (подхватит и bloom хоста, если он есть).
 */

/** Фон сцены (тёмное поле микроскопа). */
const SCENE_BG = new THREE.Color('#0a0b10')
/**
 * Габарит композиции берём у шага (naclExtentAt): у каждого шага он свой, поэтому композиция
 * занимает свободную область целиком и не уходит под панели (общий габарит резал две ионные
 * пары шага 4 доком реактора и оставлял половину узкого экрана пустой).
 */
const _extent = { w: 7, h: 3.9, cx: 0, cy: 0 }
const FILL = 0.92
/** Страховка прогрева, мс: дольше шаг 0 не ждёт. */
const WARMUP_TIMEOUT_MS = 1500
/** Задержка отчёта «урок закончен» после complete, мс (свой кадр для перерисовки страницы). */
const DONE_DELAY_MS = 320
/** Слой без камеры: заготовка героя прогревается, но не рисуется. */
const HIDDEN_LAYER = 31


/**
 * Свет сцены живёт в сцене R3F ПОСТОЯННО (после урока — с нулевой яркостью): смена числа источников
 * перекомпилировала бы все освещённые материалы лаборатории — длинный кадр ровно при передаче героя.
 */
const LIGHTS = new WeakMap<THREE.Scene, NaclLightRig>()
function persistentLights(scene: THREE.Scene): NaclLightRig {
  let rig = LIGHTS.get(scene)
  if (!rig) {
    rig = {
      ambient: new THREE.AmbientLight(0xdfe8ff, 0),
      key: new THREE.DirectionalLight(0xffffff, 0),
      point: new THREE.PointLight(0xbfe6ff, 0, 12, 1.6),
    }
    rig.key.position.set(3.5, 5, 6)
    rig.ambient.name = 'nacl-light-ambient'
    rig.key.name = 'nacl-light-key'
    rig.point.name = 'nacl-light-point'
    scene.add(rig.ambient, rig.key, rig.key.target, rig.point)
    LIGHTS.set(scene, rig)
  }
  return rig
}

type Runtime = {
  scene: NaClReactionScene
  safe: SafeArea
  bg: THREE.Color
  prevBg: THREE.Color | null
  /** передача кадра: камера в начале хвоста и цель (кадр героя) */
  cam: {
    armed: boolean
    fromPos: THREE.Vector3
    fromTarget: THREE.Vector3
    fromFov: number
    toPos: THREE.Vector3
    toTarget: THREE.Vector3
    toFov: number
    /** камера отдана лаборатории (урок закончен, герой в кадре) */
    released: boolean
    /** кадр героя измерен заранее */
    measured: boolean
  }
  ox: number
  oy: number
  scale: number
  /** отладка передачи кадра (?perf=1): по кадру хвоста — видимость решёток и расхождение поз */
  probe: { t: number; lattice: boolean; hero: boolean; dPos: number; dScale: number; dAngle: number }[] | null
}

const _pa = new THREE.Vector3()
const _pb = new THREE.Vector3()
const _sa = new THREE.Vector3()
const _sb = new THREE.Vector3()
const _qa = new THREE.Quaternion()
const _qb = new THREE.Quaternion()

/** Отладка: в каждом кадре хвоста — видна ли решётка сцены, показан ли герой и насколько расходятся их позы. */
function probeHandoff(rt: Runtime, t: number, heroShown: boolean): void {
  if (t < NACL_FINISH.from || !rt.probe || rt.probe.length > 600) return
  const lat = rt.scene.latticeObject
  const body = heroHandoff.getBody('nacl')
  let dPos = -1
  let dScale = -1
  let dAngle = -1
  if (body) {
    lat.updateWorldMatrix(true, false)
    body.updateWorldMatrix(true, false)
    lat.matrixWorld.decompose(_pa, _qa, _sa)
    body.matrixWorld.decompose(_pb, _qb, _sb)
    dPos = _pa.distanceTo(_pb)
    dScale = Math.abs(_sa.x / _sb.x - 1)
    dAngle = _qa.angleTo(_qb)
  }
  let latVisible = true
  for (let o: THREE.Object3D | null = lat; o; o = o.parent) if (!o.visible) latVisible = false
  rt.probe.push({ t: Math.round(t * 1000) / 1000, lattice: latVisible, hero: heroShown, dPos, dScale, dAngle })
}

const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _target = new THREE.Vector3()
const _pose = { position: [0, 0, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number], fov: 46 }

type Controls = { target?: THREE.Vector3 } | null

/**
 * Кадрирование root: центр — в середину свободной области, масштаб — чтобы габарит кадра вписался
 * в неё. Сдвиг сглажен (не зависит от частоты кадров). Модульная функция — ноль аллокаций.
 */
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
  naclExtentAt(rt.scene.time, _extent)
  const s = FILL * Math.min((right - left) / pxPerUnit / _extent.w, (bottom - top) / pxPerUnit / _extent.h)
  // Габарит несимметричен (полоса итога — только под решёткой): в центр свободной области ставим
  // ЦЕНТР КОМПОЗИЦИИ, а не цель кадра, иначе сверху остаётся пустая полоса в размер полосы подписей.
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
  // Длиннофокусная перспектива шагов 1–4 (naclDepthPushAt): корень отодвигается от камеры в k раз
  // и во столько же увеличивается — ГОМОТЕТИЯ С ЦЕНТРОМ В КАМЕРЕ. Проекция кадра не меняется ни на
  // пиксель, а глубинное искажение внутри композиции падает в k раз: одинаковые атомы Na в ячейке
  // перестают выглядеть разными по размеру, а куб ОЦК читается кубом.
  const push = naclDepthPushAt(rt.scene.time)
  if (push !== 1) {
    root.position.sub(cam.position).multiplyScalar(push).add(cam.position)
  }
  root.quaternion.copy(cam.quaternion)
  root.scale.setScalar(rt.scale * push)
  rt.scene.setViewport(h, cam.fov)
}

/**
 * Кадр героя меряется заранее — на паузе последнего шага, после отрисовки кадра (DOM «чистый»):
 * в хвосте не остаётся ни одного чтения раскладки.
 */
function premeasureHeroFrame(rt: Runtime, canvas: HTMLCanvasElement): void {
  const run = () => {
    catalogHeroCameraPose(catalogHeroFrameFor(canvas, 'nacl', { ignoreLessonPanel: true }), _pose)
    rt.cam.toPos.set(_pose.position[0], _pose.position[1], _pose.position[2])
    rt.cam.toTarget.set(_pose.target[0], _pose.target[1], _pose.target[2])
    rt.cam.toFov = _pose.fov
    rt.cam.measured = true
  }
  requestAnimationFrame(() => window.setTimeout(run, 0))
}

/** Хвост: камера плавно подъезжает к кадру героя продукта (тот же кадр, что у лаборатории после урока). */
function driveHandoffCamera(rt: Runtime, cam: THREE.PerspectiveCamera, controls: Controls, canvas: HTMLCanvasElement, t: number): void {
  const c = rt.cam
  if (c.released) return
  if (t < NACL_FINISH.from) {
    c.armed = false
    return
  }
  if (!c.armed) {
    c.armed = true
    c.fromPos.copy(cam.position)
    if (controls?.target) c.fromTarget.copy(controls.target)
    else c.fromTarget.set(0, 0, -1).applyQuaternion(cam.quaternion).multiplyScalar(9).add(cam.position)
    c.fromFov = cam.fov
    // Кадр героя без панели урока: после урока панель уходит, и герой встаёт в этот кадр.
    // Обычно он уже измерен на паузе шага 6 (premeasureHeroFrame); иначе — меряем сейчас.
    if (!c.measured) {
      catalogHeroCameraPose(catalogHeroFrameFor(canvas, 'nacl', { ignoreLessonPanel: true }), _pose)
      c.toPos.set(_pose.position[0], _pose.position[1], _pose.position[2])
      c.toTarget.set(_pose.target[0], _pose.target[1], _pose.target[2])
      c.toFov = _pose.fov
    }
  }
  const x = Math.min(1, Math.max(0, (t - NACL_FINISH.from) / (NACL_FINISH.to - NACL_FINISH.from)))
  const u = x * x * (3 - 2 * x)
  cam.position.lerpVectors(c.fromPos, c.toPos, u)
  _target.lerpVectors(c.fromTarget, c.toTarget, u)
  cam.lookAt(_target)
  if (controls?.target) controls.target.copy(_target)
  const fov = c.fromFov + (c.toFov - c.fromFov) * u
  if (Math.abs(cam.fov - fov) > 1e-4) {
    cam.fov = fov
    cam.updateProjectionMatrix()
  }
}

function createRuntime(scene: NaClReactionScene, threeScene: THREE.Scene): Runtime {
  const prev = threeScene.background instanceof THREE.Color ? threeScene.background : null
  const bg = SCENE_BG.clone()
  threeScene.background = bg
  return {
    scene,
    safe: createSafeArea(),
    bg,
    prevBg: prev,
    cam: {
      armed: false,
      fromPos: new THREE.Vector3(),
      fromTarget: new THREE.Vector3(),
      fromFov: 46,
      toPos: new THREE.Vector3(),
      toTarget: new THREE.Vector3(),
      toFov: 46,
      released: false,
      measured: false,
    },
    ox: 0,
    oy: 0,
    scale: 0,
    probe: null,
  }
}

const STATUS: Record<NaclStatus, Clo2StepStatus | null> = {
  idle: null,
  playing: 'playing',
  paused: 'paused',
  finishing: 'finishing',
  done: 'done',
}

export function NaclCinemaScene(props: ScientificSynthesisFxProps) {
  const { runId = 0, lowPower = false } = props
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const threeScene = useThree((s) => s.scene)
  const locale = toSceneLocale(useLocale().locale)
  const [rt, setRt] = useState<Runtime | null>(null)

  // Колбэки лаборатории зовутся из событий сцены — держим свежие в рефе.
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
    if (import.meta.env.DEV) {
      validateNaclModel()
      validateNaclEnergetics()
    }
    let started = false
    let cancelled = false
    let doneTimer = 0
    // eslint-disable-next-line prefer-const -- создаётся после сцены, колбэки сцены читают его позже
    let runtime: Runtime
    const scene = new NaClReactionScene({
      locale: localeRef.current,
      lowPower,
      lights: persistentLights(threeScene),
      onStatus: (status, step) => {
        const s = STATUS[status]
        if (!s) return
        if (status === 'done') {
          // «Урок закончен» перерисовывает страницу (карточка продукта, панели). Кадр complete уже
          // занят показом героя — переносим этот рендер на отдельный кадр чуть позже.
          // startTransition здесь НЕ помогает и не ставится: страница читает «урок идёт» через
          // useSyncExternalStore, а обновления внешнего стора React не откладывает (замер трассы:
          // TimerFire 37 мс и с переходом, и без него).
          doneTimer = window.setTimeout(() => clo2StepStore.report(runId, step, s), DONE_DELAY_MS)
          return
        }
        // Пауза на последнем шаге: заранее меряем кадр героя (DOM), чтобы хвост не читал раскладку.
        if (status === 'paused' && step === NACL_STEPS.length - 1) premeasureHeroFrame(runtime, gl.domElement)
        clo2StepStore.report(runId, step, s)
      },
      onCue: (id) => {
        const cb = cbRef.current
        // embryo и birth — в startTransition: перерисовка лаборатории (монтаж слота героя, фазы
        // синтеза) идёт кусочками по ~5 мс между кадрами, а не одним кадром на 60–110 мс посреди
        // хвоста. Рендер лаборатории читает «birth случился» из состояния (LabScene
        // collapseBirthRunId), которое коммитится вместе с linger, — сцену посреди хвоста не снимет.
        // complete — синхронно: к нему оба перехода давно закоммичены (0,9 с хвоста).
        // embryo и birth стоят в один момент (naclSteps): React сводит их в ОДИН рендер вместо двух.
        if (id === 'embryo') startTransition(() => cb.onEmbryoReady?.())
        else if (id === 'birth') startTransition(() => cb.onBirthReady?.())
        else if (id === 'complete') {
          // Решётка сцены стоит ровно на месте героя — героя можно показывать.
          heroHandoff.release(runId)
          cb.onComplete()
        } else cb.onNarrationCue?.(id)
      },
    })
    runtime = createRuntime(scene, threeScene)
    heroHandoff.claim(runId, 'nacl')
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
      'nacl',
      NACL_STEPS.length,
    )
    setRt(runtime)
    if (isPerfProbeEnabled()) {
      // Отладка (?perf=1): кадры передачи героя, видимые источники света (их число входит в ключ
      // программ шейдеров) и перемотка сюжета.
      const w = window as unknown as Record<string, unknown>
      runtime.probe = []
      w.__naclHandoffProbe = () => runtime.probe
      w.__naclSeek = (t: number) => scene.seek(t)
      w.__naclLights = () => {
        const out: string[] = []
        threeScene.traverseVisible((o) => {
          if ((o as THREE.Light).isLight) out.push(`${o.name || o.type}@${o.position.toArray().map((v) => v.toFixed(2)).join(',')}`)
        })
        return out
      }
    }

    // Шаг 0 — после прогрева шейдеров (или по страховке); «Далее» во время прогрева отменяет автостарт.
    const start = () => {
      if (cancelled || started) return
      started = true
      void scene.goToStep(0)
    }
    const timer = window.setTimeout(start, WARMUP_TIMEOUT_MS)
    // Прогрев: сцена + заготовка героя (та же решётка, её материалы и буферы) — до шага 0, чтобы
    // в хвосте монтаж героя не компилировал программ и не создавал буферов. Заготовка на время
    // прогрева лежит в root на слое без камеры: компилируется, но в кадр не попадает.
    const heroView = prebuildNaclHeroView(lowPower)
    heroView.group.traverse((o) => o.layers.set(HIDDEN_LAYER))
    scene.root.add(heroView.group)
    const raf = requestAnimationFrame(() => {
      if (cancelled) return
      void scene.warmup(gl, camera, threeScene).then(() => {
        heroView.group.removeFromParent()
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
      heroHandoff.abandon(runId)
      // Фон лаборатории — назад (если его за время урока не заменили).
      if (threeScene.background === runtime.bg) threeScene.background = runtime.prevBg
      setRt(null)
    }
  }, [runId, lowPower, gl, camera, threeScene])

  useFrame((state, dt) => {
    if (!rt) return
    const cam = state.camera as THREE.PerspectiveCamera
    const controls = state.controls as unknown as Controls
    const canvas = state.gl.domElement
    const scene = rt.scene
    const t = scene.time

    // Хвост: камера — к кадру героя (после OrbitControls.update: этот хук — приоритет 0).
    driveHandoffCamera(rt, cam, controls, canvas, t)
    frameRoot(rt, cam, controls, canvas, state.size.width, state.size.height, dt)

    // Передача кадра: решётка встаёт на место тела героя, пока оно смонтировано.
    scene.setHandoffTarget(heroHandoff.getBody('nacl'))
    scene.update(dt, cam)
    const hs = heroHandoff.getSnapshot()
    if (hs.runId === runId && hs.shown) {
      scene.releaseLatticeToHero()
      rt.cam.released = true
    }

    // Фон: в хвосте — к фону лаборатории (после урока тот же цвет, без скачка).
    if (rt.prevBg) {
      const u = Math.min(1, Math.max(0, (t - NACL_FINISH.from) / (NACL_FINISH.to - NACL_FINISH.from)))
      rt.bg.copy(SCENE_BG).lerp(rt.prevBg, u)
    }

    if (rt.probe) probeHandoff(rt, t, hs.runId === runId && hs.shown)

    // Панель энергии читает место сюжета в своём rAF.
    cinemaPlayhead.t = t
    cinemaPlayhead.runId = runId
  })

  if (!rt) return null
  return (
    <primitive object={rt.scene.root}>
      <CinemaDomLabels labels={rt.scene.labels} safe={rt.safe} layout />
      {/*
        Прогрев troika-текста (невидимо): после урока лаборатория снова показывает реактор с
        подписями коэффициентов, а первый troika-текст за сеанс создаёт служебный WebGL-контекст
        генератора SDF и строит атлас — длинный кадр ~80 мс сразу после передачи героя. Здесь это
        случается в начале урока, пока сцена ещё проявляется. Своя граница Suspense обязательна:
        Text ждёт шрифт (suspend), и без неё React спрятал бы всё дерево сцены лаборатории вместе
        с её светом — число источников менялось бы, и все программы шейдеров пересобирались.
      */}
      <Suspense fallback={null}>
        <Text visible={false} fontSize={0.01}>
          0123456789
        </Text>
      </Suspense>
    </primitive>
  )
}
