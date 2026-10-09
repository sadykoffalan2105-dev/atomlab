/**
 * Холст новой светлой лаборатории: свет (окружение из Lightformer — без сети, «солнце» из окна, мягкие тени на ПК),
 * комната, оборудование, электронная доска, установка опыта на рабочем месте, камера.
 * Всё, что может «подвиснуть» (Suspense), — в своей Suspense внутри Canvas, чтобы не прятать холст целиком.
 * Тональная компрессия ACES 0,94 (сравнение кадров: AgX 1,05 делает белые стены и цветные растворы серее —
 * «серое молоко»; ?tm=agx — AgX для сравнения).
 * Постобработка только на ПК (high): мягкое свечение ярких мест, лёгкая виньетка, сглаживание MSAA ×4 в буфере
 * постобработки (SMAA не нужен и стоил бы ещё 3 программы шейдеров сверх бюджета 58); ?fx=0 — без неё,
 * в VR и после двух просадок кадров подряд — тоже без неё. Рисует кадр по-прежнему только RenderGate (labPerf).
 */
import { Environment, Lightformer, PerformanceMonitor, useCursor } from '@react-three/drei'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode, type EffectComposer as EffectComposerImpl } from 'postprocessing'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { LabInteractiveItems } from '../interaction/LabInteractiveItems'
import { LabHotBadges } from '../interaction/LabHotBadges'
import { LabAudioListener } from '../audio/LabAudioListener'
import {
  BENCH_TOP_Y,
  HOOD_WORK_CENTER,
  WORK_AREA_CENTER,
  type BoardPanelProps,
  type ExperimentRigProps,
  type LabExperimentId,
  type LabLang,
} from '../labContract'
import { ExperimentRig, LAB_EXPERIMENTS } from '../experiments'
import { FlameLightPool } from '../experiments/parts/fire'
import { LabBoard } from './LabBoard'
import { LabCameraRig } from './LabCameraRig'
import { LabEquipment } from './LabEquipment'
import { LabHoodControls } from './LabHood'
import { LabRoom } from './LabRoom'
import type { LabSceneBridge } from './labBridge'
import { useLabMaterials } from './labMaterials'
import { HOOD, ROOM, type LabViewId } from './labSceneLayout'
import { ContactShadowBake, LabPerfProbe, noteLabPerfDecline, noteLabPerfIncline, RenderGate, setLabFrameRenderer, useLabFxAllowed } from './labPerf'
import { labRoomOccluder } from './labOccluders'
import { StaticBatch } from './labStaticBatch'
import { LabExtinguisher } from '../interaction/LabExtinguisher'
import { LabXrRoot } from '../xr/LabXrRoot'
import { labXr, useXrPresenting } from '../xr/labXrStore'

/** Параметр адреса (#/vr-lab?…&name=value). */
function hashParam(name: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return new URLSearchParams(window.location.hash.split('?')[1] ?? '').get(name)
  } catch {
    return null
  }
}
/** Тональная компрессия: ACES 0,94 (по умолчанию) или AgX 1,05 (?tm=agx) — для сравнения кадров. */
const TONE_ACES = hashParam('tm') !== 'agx'
const TONE_MAPPING = TONE_ACES ? THREE.ACESFilmicToneMapping : THREE.AgXToneMapping
const TONE_EXPOSURE = TONE_ACES ? 0.94 : 1.05
/** ?fx=0 — без постобработки. */
const FX_OFF = hashParam('fx') === '0'
/** Тень солнца 2048² — только мощный ПК (много ядер и большие текстуры); иначе 1024². */
function sunShadowSize(gl: THREE.WebGLRenderer): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 4 : 4
  return gl.capabilities.maxTextureSize >= 16384 && cores >= 8 ? 2048 : 1024
}

/**
 * Постобработка: EffectComposer не рисует сам (enabled=false — его useFrame пустой), а регистрирует «нарисовать кадр»
 * в RenderGate. Свечение — только у очень ярких мест (пламя, блики), виньетка едва заметна, края сглаживает MSAA ×4.
 */
function LabPostFx() {
  const composer = useRef<EffectComposerImpl>(null)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  useEffect(() => {
    const c = composer.current
    if (!c) return
    setLabFrameRenderer((dt) => c.render(dt))
    return () => {
      setLabFrameRenderer(null)
      // @react-three/postprocessing не освобождает буферы и шейдеры составителя при размонтировании
      c.dispose()
    }
  }, [])
  // Плотность пикселей сменилась (PerformanceMonitor) — буферы постобработки под новый размер
  useEffect(() => {
    composer.current?.setSize(size.width, size.height)
  }, [size, dpr])
  return (
    <EffectComposer ref={composer} enabled={false} multisampling={4}>
      <Bloom mipmapBlur intensity={0.35} luminanceThreshold={0.85} luminanceSmoothing={0.2} />
      <Vignette offset={0.25} darkness={0.35} />
      <ToneMapping mode={TONE_ACES ? ToneMappingMode.ACES_FILMIC : ToneMappingMode.AGX} />
    </EffectComposer>
  )
}

export interface Lab3DCanvasProps {
  readonly experimentId: LabExperimentId
  readonly step: number
  readonly lang: LabLang
  readonly quality: 'low' | 'high'
  readonly view: LabViewId
  readonly viewNonce: number
  readonly bridge: LabSceneBridge
  readonly onAdvance: () => void
  readonly onSelectExperiment: (id: LabExperimentId) => void
  readonly onStep: (step: number) => void
  readonly onReady?: () => void
  readonly ariaLabel: string
  /** Ширина панели интерфейса слева (CSS px) — камера сдвигает вид в свободную часть. */
  readonly leftInsetPx?: number
}

/** Есть ли у объекта (или его предков внутри установки) свой обработчик клика — тогда курсор «рука». */
function isInteractive(obj: THREE.Object3D | null, stop: THREE.Object3D | null): boolean {
  let o: THREE.Object3D | null = obj
  while (o && o !== stop) {
    const inst = (o as unknown as { __r3f?: { handlers?: Record<string, unknown> } }).__r3f
    const h = inst?.handlers
    if (o.userData?.interactive || o.userData?.target || (h && (h.onClick || h.onPointerDown || h.onPointerUp))) return true
    o = o.parent
  }
  return false
}

/** Опыт с place: 'hood' ставится в вытяжной шкаф, остальные — на рабочее место стола. */
export function rigCenterFor(id: LabExperimentId): THREE.Vector3 {
  return LAB_EXPERIMENTS.find((e) => e.id === id)?.place === 'hood' ? HOOD_WORK_CENTER : WORK_AREA_CENTER
}

/** Места контактных теней: рабочее место стола и вытяжки (постоянные массивы — без пересоздания буферов). */
const SHADOW_SPOTS = [
  { id: 'bench', position: [WORK_AREA_CENTER.x, WORK_AREA_CENTER.y + 0.0015, WORK_AREA_CENTER.z] as [number, number, number], scale: [2.5, 0.95] as [number, number] },
  { id: 'hood', position: [HOOD_WORK_CENTER.x, HOOD_WORK_CENTER.y + 0.0015, HOOD_WORK_CENTER.z] as [number, number, number], scale: [1.05, 0.6] as [number, number] },
] as const

function RigSlot(props: ExperimentRigProps) {
  const [hover, setHover] = useState(false)
  const [root, setRoot] = useState<THREE.Group | null>(null)
  useCursor(hover, 'pointer', 'auto')
  const onOver = useCallback((e: ThreeEvent<PointerEvent>) => setHover(isInteractive(e.object, root)), [root])
  const onOut = useCallback(() => setHover(false), [])
  return (
    <group ref={setRoot} position={rigCenterFor(props.experimentId)} onPointerOver={onOver} onPointerMove={onOver} onPointerOut={onOut}>
      <Suspense fallback={null}>
        <ExperimentRig {...props} />
      </Suspense>
    </group>
  )
}

/** Группа комнаты — препятствие для HTML-подписей (снимается при размонтировании). */
function setRoomOccluder(g: THREE.Group | null) {
  labRoomOccluder.current = g
}

function SceneContent(props: Lab3DCanvasProps) {
  const { quality, lang } = props
  const mats = useLabMaterials(quality)
  const high = quality === 'high'
  const gl = useThree((s) => s.gl)
  const xr = useXrPresenting()
  const fxAllowed = useLabFxAllowed()
  // Постобработка: только ПК, не в VR (там каждый проход — на оба глаза), не после двух просадок кадров
  const fxOn = high && !FX_OFF && !xr && fxAllowed
  const sun = useMemo(() => {
    const l = new THREE.DirectionalLight('#fff4e5', high ? 2.6 : 1.9)
    l.position.set(-5.2, 4.4, 1.6)
    l.target.position.set(0, 0.9, -0.2)
    if (high) {
      l.castShadow = true
      // 1024² (2048² — только мощный ПК): тени мягкие (radius), карта дешёвая
      const sz = sunShadowSize(gl)
      l.shadow.mapSize.set(sz, sz)
      l.shadow.bias = -0.0002
      l.shadow.normalBias = 0.02
      l.shadow.radius = 3
      const cam = l.shadow.camera
      cam.left = -3.4
      cam.right = 3.4
      cam.top = 2.6
      cam.bottom = -2.6
      cam.near = 0.5
      cam.far = 14
    }
    return l
  }, [high, gl])
  const hoodSpot = useMemo(() => {
    const l = new THREE.SpotLight('#f4f9ff', 2.2, 2.4, 0.95, 0.85, 1.6)
    l.position.set(HOOD.x, HOOD.h - 0.46, ROOM.frontZ + HOOD.d / 2 - 0.05)
    l.target.position.set(HOOD.x, BENCH_TOP_Y, ROOM.frontZ + HOOD.d / 2)
    return l
  }, [])
  const bridge = props.bridge
  const rigCenter = rigCenterFor(props.experimentId)
  const inHood = rigCenter === HOOD_WORK_CENTER
  const onSceneDoubleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      bridge.zoomTo?.(e.point, 0.75)
    },
    [bridge],
  )
  const panel: BoardPanelProps = {
    experimentId: props.experimentId,
    step: props.step,
    lang,
    onSelectExperiment: props.onSelectExperiment,
    onStep: props.onStep,
  }
  return (
    <>
      <color attach="background" args={['#e9eef3']} />
      {/* Небо/пол слабее, чем раньше, — тени от посуды читаются; заполняющий свет мягче */}
      <hemisphereLight args={['#f4f8ff', '#cfc6b6', high ? 0.32 : 0.75]} />
      <primitive object={sun} />
      <primitive object={sun.target} />
      <directionalLight position={[1.5, 2.9, 2.6]} intensity={high ? 0.4 : 0.8} color="#f3f7ff" />
      <Suspense fallback={null}>
        <Environment frames={1} resolution={high ? 256 : 128} blur={0.25} environmentIntensity={0.72}>
          <color attach="background" args={['#dfe5ec']} />
          {/* Потолочные панели */}
          {[-1.4, 1.4].map((x) =>
            [-0.1, 2.3].map((z) => (
              <Lightformer key={`${x}:${z}`} form="rect" intensity={2.6} position={[x, ROOM.h, z]} rotation-x={Math.PI / 2} scale={[1.2, 0.6, 1]} />
            )),
          )}
          {/* Окно слева — главный источник дневного света */}
          <Lightformer form="rect" intensity={4} color="#eaf4ff" position={[-ROOM.w / 2, 1.8, 1.1]} rotation-y={Math.PI / 2} scale={[3.2, 1.7, 1]} />
          {/* Светлые стены — мягкий отражённый свет */}
          <Lightformer form="rect" intensity={0.7} color="#f2f4f7" position={[ROOM.w / 2, 1.5, 1]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
          <Lightformer form="rect" intensity={0.6} color="#f2f4f7" position={[0, 1.5, ROOM.frontZ]} scale={[6.6, 3, 1]} />
          <Lightformer form="rect" intensity={0.5} color="#e8e2d6" position={[0, 0, 1]} rotation-x={-Math.PI / 2} scale={[6, 6, 1]} />
        </Environment>
      </Suspense>
      {/* Подсвеченная рабочая зона вытяжного шкафа */}
      {high && <primitive object={hoodSpot} />}
      {high && <primitive object={hoodSpot.target} />}
      {/* Постоянные источники для света пламени: число источников не меняется при смене опыта — шейдеры не пересобираются */}
      {high && <FlameLightPool />}
      {/* Мягкие контактные тени под рабочим местом (только ПК) */}
      {/* Два постоянных экземпляра (стол и вытяжка) с неизменными параметрами: drei ContactShadows не освобождает
          свои буферы при пересоздании — так они не пересоздаются; неактивный — прозрачный */}
      {high &&
        SHADOW_SPOTS.map((s) => (
          <ContactShadowBake
            key={s.id}
            bakeKey={`${props.experimentId}:${props.step}`}
            position={s.position}
            scale={s.scale}
            resolution={512}
            blur={2.2}
            far={0.5}
            opacity={(s.id === 'hood') === inHood ? 0.42 : 0}
            color="#1d2a3a"
          />
        ))}
      {/* Двойной клик/тап по любой поверхности — камера приближается к этой точке */}
      <group onDoubleClick={onSceneDoubleClick}>
        {/* Корень комнаты — по нему HTML-подписи понимают, что их закрывает мебель (labOccluders) */}
        <group ref={setRoomOccluder}>
          {/* Неподвижные детали комнаты склеены по материалам — десятки вызовов отрисовки вместо сотен */}
          <StaticBatch deps={[mats, lang, quality]}>
            <LabRoom mats={mats} lang={lang} quality={quality} />
          </StaticBatch>
        </group>
        <StaticBatch deps={[mats, lang, inHood]}>
          <LabEquipment mats={mats} lang={lang} hoodBusy={inHood} />
        </StaticBatch>
      </group>
      <LabBoard mats={mats} panel={panel} bridge={props.bridge} />
      <RigSlot experimentId={props.experimentId} step={props.step} onAdvance={props.onAdvance} quality={quality} lang={lang} />
      <LabInteractiveItems mats={mats} lang={lang} quality={quality} bridge={props.bridge} />
      <LabHotBadges lang={lang} />
      {/* Вытяжка: створка, тумблер тяги, струйки воздуха; звук — слушатель у камеры */}
      <LabHoodControls mats={mats} quality={quality} busy={inHood} />
      <LabAudioListener />
      <LabExtinguisher mats={mats} lang={lang} quality={quality} experimentId={props.experimentId} />
      <LabCameraRig view={props.view} viewNonce={props.viewNonce} bridge={props.bridge} leftInsetPx={props.leftInsetPx} />
      <LabXrRoot />
      {/* Постобработка (ПК): регистрирует свой «нарисовать кадр» в RenderGate */}
      {fxOn && <LabPostFx />}
      {/* Кадр рисуется только когда шейдеры собраны (без «замерзания» при смене опыта); вкл/выкл постобработки
          меняет тональную компрессию в шейдерах — тоже пересборка через ворота */}
      <RenderGate compileKey={`${props.experimentId}:${quality}:${fxOn ? 'fx' : 'plain'}`} onFirstReady={props.onReady} />
      <LabPerfProbe />
    </>
  )
}

/** Пределы плотности пикселей: на ПК до 1,75, на слабых устройствах до 1,25; при просадке кадров — плавно ниже. */
const DPR_RANGE: Readonly<Record<'low' | 'high', readonly [number, number]>> = { high: [1, 1.75], low: [0.8, 1.25] }

export default function Lab3DCanvas(props: Lab3DCanvasProps) {
  const high = props.quality === 'high'
  const [lo, hi] = DPR_RANGE[props.quality]
  const deviceDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const [dpr, setDpr] = useState(() => Math.min(hi, deviceDpr))
  return (
    <Canvas
      shadows={high ? 'percentage' : false}
      dpr={dpr}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: TONE_MAPPING, toneMappingExposure: TONE_EXPOSURE }}
      camera={{ fov: 48, near: 0.03, far: 40, position: [0, 1.8, 1.8] }}
      aria-label={props.ariaLabel}
      role="img"
    >
      {/* Просели кадры — снижаем плотность пикселей шагами (между lo и hi), выросли — возвращаем */}
      {/* Две просадки подряд — постобработка выключается до конца сессии; в VR плотность пикселей не трогаем */}
      <PerformanceMonitor
        factor={1}
        flipflops={4}
        onDecline={noteLabPerfDecline}
        onIncline={noteLabPerfIncline}
        onChange={({ factor }) => {
          if (labXr.get().presenting) return
          setDpr(Math.round((lo + (Math.min(hi, deviceDpr) - lo) * factor) * 20) / 20)
        }}
        onFallback={() => {
          if (!labXr.get().presenting) setDpr(lo)
        }}
      />
      <SceneContent {...props} />
    </Canvas>
  )
}
