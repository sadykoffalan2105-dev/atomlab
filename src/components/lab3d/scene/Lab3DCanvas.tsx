/**
 * Холст новой светлой лаборатории: свет (окружение из Lightformer — без сети, «солнце» из окна, мягкие тени на ПК),
 * комната, оборудование, электронная доска, установка опыта на рабочем месте, камера.
 * Всё, что может «подвиснуть» (Suspense), — в своей Suspense внутри Canvas, чтобы не прятать холст целиком.
 */
import { Environment, Lightformer, useCursor } from '@react-three/drei'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useCallback, useMemo, useState } from 'react'
import * as THREE from 'three'
import {
  WORK_AREA_CENTER,
  type BoardPanelProps,
  type ExperimentRigProps,
  type LabExperimentId,
  type LabLang,
} from '../labContract'
import { ExperimentRig } from '../experiments'
import { LabBoard } from './LabBoard'
import { LabCameraRig } from './LabCameraRig'
import { LabEquipment } from './LabEquipment'
import { LabRoom } from './LabRoom'
import type { LabSceneBridge } from './labBridge'
import { useLabMaterials } from './labMaterials'
import { ROOM, type LabViewId } from './labSceneLayout'

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

function RigSlot(props: ExperimentRigProps) {
  const [hover, setHover] = useState(false)
  const [root, setRoot] = useState<THREE.Group | null>(null)
  useCursor(hover, 'pointer', 'auto')
  const onOver = useCallback((e: ThreeEvent<PointerEvent>) => setHover(isInteractive(e.object, root)), [root])
  const onOut = useCallback(() => setHover(false), [])
  return (
    <group ref={setRoot} position={WORK_AREA_CENTER} onPointerOver={onOver} onPointerMove={onOver} onPointerOut={onOut}>
      <Suspense fallback={null}>
        <ExperimentRig {...props} />
      </Suspense>
    </group>
  )
}

function SceneContent(props: Lab3DCanvasProps) {
  const { quality, lang } = props
  const mats = useLabMaterials(quality)
  const high = quality === 'high'
  const sun = useMemo(() => {
    const l = new THREE.DirectionalLight('#fff4e2', high ? 2.4 : 2.0)
    l.position.set(-5.2, 4.4, 1.6)
    l.target.position.set(0, 0.9, -0.2)
    if (high) {
      l.castShadow = true
      l.shadow.mapSize.set(2048, 2048)
      l.shadow.bias = -0.0003
      l.shadow.normalBias = 0.025
      l.shadow.radius = 4
      const cam = l.shadow.camera
      cam.left = -3.4
      cam.right = 3.4
      cam.top = 2.6
      cam.bottom = -2.6
      cam.near = 0.5
      cam.far = 14
    }
    return l
  }, [high])
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
      <hemisphereLight args={['#ffffff', '#d9d2c4', high ? 0.55 : 0.85]} />
      <primitive object={sun} />
      <primitive object={sun.target} />
      <directionalLight position={[1.5, 2.9, 2.6]} intensity={high ? 0.55 : 0.8} color="#f3f7ff" />
      <Suspense fallback={null}>
        <Environment frames={1} resolution={high ? 256 : 128} environmentIntensity={0.85}>
          <color attach="background" args={['#dfe5ec']} />
          {/* Потолочные панели */}
          {[-1.4, 1.4].map((x) =>
            [-0.1, 2.3].map((z) => (
              <Lightformer key={`${x}:${z}`} form="rect" intensity={2.2} position={[x, ROOM.h, z]} rotation-x={Math.PI / 2} scale={[1.2, 0.6, 1]} />
            )),
          )}
          {/* Окно слева — главный источник дневного света */}
          <Lightformer form="rect" intensity={3.2} color="#eaf4ff" position={[-ROOM.w / 2, 1.8, 1.1]} rotation-y={Math.PI / 2} scale={[3.2, 1.7, 1]} />
          {/* Светлые стены — мягкий отражённый свет */}
          <Lightformer form="rect" intensity={0.7} color="#f2f4f7" position={[ROOM.w / 2, 1.5, 1]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
          <Lightformer form="rect" intensity={0.6} color="#f2f4f7" position={[0, 1.5, ROOM.frontZ]} scale={[6.6, 3, 1]} />
          <Lightformer form="rect" intensity={0.5} color="#e8e2d6" position={[0, 0, 1]} rotation-x={-Math.PI / 2} scale={[6, 6, 1]} />
        </Environment>
      </Suspense>
      <LabRoom mats={mats} lang={lang} quality={quality} />
      <LabEquipment mats={mats} lang={lang} />
      <LabBoard mats={mats} panel={panel} bridge={props.bridge} />
      <RigSlot experimentId={props.experimentId} step={props.step} onAdvance={props.onAdvance} quality={quality} lang={lang} />
      <LabCameraRig view={props.view} viewNonce={props.viewNonce} bridge={props.bridge} />
    </>
  )
}

export default function Lab3DCanvas(props: Lab3DCanvasProps) {
  const high = props.quality === 'high'
  return (
    <Canvas
      shadows={high ? 'percentage' : false}
      dpr={high ? [1, 1.75] : [1, 1.25]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.02 }}
      camera={{ fov: 48, near: 0.03, far: 40, position: [0, 1.8, 1.8] }}
      onCreated={() => props.onReady?.()}
      aria-label={props.ariaLabel}
      role="img"
    >
      <SceneContent {...props} />
    </Canvas>
  )
}
