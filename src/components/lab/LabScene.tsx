import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, DragControls } from '@react-three/drei'
import { gsap } from 'gsap'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { DecorativeAtom } from './DecorativeAtom'
import { AtomStructureModel } from './AtomStructureModel'
import { MoleculeMesh } from './MoleculeMesh'
import { SynthesisOnLabScene } from './SynthesisOnLabScene'
import { LabProductHeroSlot } from './LabProductHeroSlot'
import { LabSynthesisCosmicBackdrop } from './LabSynthesisCosmicBackdrop'
import { assertNoProductHeroBeforeRun } from '../../lab/atomGuard/labPreviewGuard'
import { createFpsGovernor } from '../../lab/atomGuard/synthesisRunGuard'
import { CatalogSubstanceDisplay } from './CatalogSubstanceDisplay'
import { CatalogCanvasResizeSync } from './CatalogCanvasResizeSync'
import { ReactorTermsPreview } from './ReactorTermsPreview'
import { buildReactorPreviewAtoms } from './reactorPreviewLayout'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import type { CompoundDef } from '../../types/chemistry'
import type { LabParticle, Vec3 } from '../../types/chemistry'
import { compoundById } from '../../data/compounds'
import { CATALOG_HERO_VIEW, LAB_ORBIT } from './labOrbitConstants'
import { CanvasErrorBoundary } from '../common/CanvasErrorBoundary'
import { CanvasSceneErrorFallback } from '../common/CanvasSceneErrorFallback'
import { useT } from '../../i18n/useT'
import { isWebGLAvailable } from '../../utils/webgl'
import { scheduleIdleMatch } from '../../lab/labRenderGuards'
import {
  createProductCrossfadeGuard,
  type ProductCrossfadeGuard,
} from '../../lab/synthesisLaunchGuard'
import {
  createSynthesisCoverageTracker,
  SYNTH_PREVIEW_RETAIN_FRAMES,
} from '../../lab/synthesisVisualGuard'

/** Свободная лаборатория (атомы на столе). */
const LAB_SCENE_CLEAR_HEX = '#03040a'
/** Реактор / синтез / каталожный кадр — один фон, без мигания между ветками. */
const REACTOR_SCENE_HEX = '#0a0c18'
const REACTOR_FOG_IDLE: [string, number, number] = [REACTOR_SCENE_HEX, 6.5, 16]

function LabReactorEnvironment() {
  const { gl, scene } = useThree()
  useLayoutEffect(() => {
    const c = hexToColor(REACTOR_SCENE_HEX)
    gl.setClearColor(c, 1)
    scene.background = c
  }, [gl, scene])
  return (
    <>
      <color attach="background" args={[REACTOR_SCENE_HEX]} />
      <fog attach="fog" args={REACTOR_FOG_IDLE} />
      <Stars radius={110} depth={55} count={420} factor={2.8} saturation={0.12} fade speed={0.18} />
    </>
  )
}

/** Свет и фон, пока синтез ещё монтируется (нет «пустого» кадра). */
function LabReactorLights() {
  return (
    <>
      <ambientLight intensity={0.48} />
      <directionalLight position={[3.2, 5.5, 2.5]} intensity={0.92} color="#b8c8ff" />
      <pointLight position={[0, 0.18, 1.6]} intensity={1.55} distance={18} color="#7afcff" />
      <pointLight position={[-2.2, 1.1, 3.2]} intensity={0.42} distance={14} color="#ffd0ec" />
    </>
  )
}

/** Прогрев шейдеров в idle — не блокирует клик «Запустить». */
function ReactorSceneWarmup({ active }: { active: boolean }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    if (!active) return
    let cancelled = false
    scheduleIdleMatch(() => {
      if (cancelled) return
      gl.compile(scene, camera)
      gl.render(scene, camera)
    })
    return () => {
      cancelled = true
    }
  }, [active, gl, scene, camera])
  return null
}

type PerfLevel = 'high' | 'low'

function hexToColor(hex: string): THREE.Color {
  const h = hex.startsWith('#') ? hex : '#' + hex.replace('#', '')
  return new THREE.Color(h)
}

function DraggableParticle({
  particle: p,
  onParticleMove,
  onInspectAtom,
}: {
  particle: LabParticle
  onParticleMove: (id: string, pos: Vec3) => void
  onInspectAtom?: (z: number) => void
}) {
  const [px, py, pz] = p.position
  const mat = useMemo(() => {
    const m = new THREE.Matrix4()
    m.makeTranslation(px, py, pz)
    return m
  }, [px, py, pz])
  const lastMatrix = useRef(mat.clone())
  useEffect(() => {
    lastMatrix.current.copy(mat)
  }, [mat])

  const onDrag = useCallback((m: THREE.Matrix4) => {
    lastMatrix.current.copy(m)
  }, [])

  const onDragEnd = useCallback(() => {
    const v = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    lastMatrix.current.decompose(v, q, s)
    onParticleMove(p.id, [v.x, v.y, v.z])
  }, [onParticleMove, p.id])

  const atomCpkHex = p.type === 'atom' ? p.color : undefined
  const atomColor = useMemo(
    () => (atomCpkHex ? hexToColor(atomCpkHex) : null),
    [atomCpkHex],
  )

  return (
    <DragControls
      dragLimits={[
        [0.6, 3.8],
        [-0.4, 1.6],
        [-1.4, 1.4],
      ]}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
    >
      <group matrix={mat} matrixAutoUpdate={false}>
        {p.type === 'atom' ? (
          <mesh
            onDoubleClick={(e) => {
              e.stopPropagation()
              onInspectAtom?.(p.z)
            }}
          >
            <sphereGeometry args={[0.24, 20, 20]} />
            <meshStandardMaterial
              color={atomColor!}
              emissive={atomColor!}
              emissiveIntensity={0.35}
              metalness={0.25}
              roughness={0.35}
            />
          </mesh>
        ) : (
          <group scale={0.42}>
            {compoundById[p.compoundId] ? (
              <MoleculeMesh compound={compoundById[p.compoundId]!} scale={1} accentBoost={1.1} />
            ) : null}
          </group>
        )}
      </group>
    </DragControls>
  )
}

function TransformPreviewHero({ compound }: { compound: CompoundDef }) {
  return (
    <>
      <CatalogSubstanceDisplay
        compound={compound}
        reducedEffects
        labSynthesisScene
        renderQuality="synthesis"
        fxLevel="low"
      />
    </>
  )
}

function SceneContent({
  particles,
  onParticleMove,
  structureZ,
  onInspectAtom,
  synthesis,
  /** true, пока runId>0 на странице лаборатории: не показывать settled-герой поверх «пустой» ветки synth */
  synthesisRunActive = false,
  onPerfLevelChange,
  reactorPreviewTerms = null,
  reactorViewOpen,
  transformPreviewCompound = null,
  synthesisSettledProduct,
  laboratorySynthesisView,
  synthesisPhase = '',
  forceLiteFxRef,
  prewarmProductCompound = null,
}: {
  particles: readonly LabParticle[]
  onParticleMove: (id: string, pos: Vec3) => void
  structureZ: number | null
  onInspectAtom?: (z: number) => void
  synthesisRunActive?: boolean
  onPerfLevelChange?: (level: PerfLevel) => void
  /** Слагаемые левой части для превью атомных структур */
  reactorPreviewTerms?: readonly ReactorEquationTerm[] | null
  /** Выбранное вещество до запуска — каталожная 3D-модель в центре */
  transformPreviewCompound?: CompoundDef | null
  /** Реактор открыт: без пары в центре не показывать декоративный атом */
  reactorViewOpen: boolean
  synthesisSettledProduct: CompoundDef | null
  laboratorySynthesisView: 'reactor' | 'substance'
  synthesisPhase?: string
  forceLiteFxRef?: React.MutableRefObject<boolean>
  /** Продукт для скрытого pre-warm (compile GPU) до запуска синтеза */
  prewarmProductCompound?: CompoundDef | null
  synthesis: {
    runId: number
    zSlots: readonly number[]
    flyTerms: readonly ReactorEquationTerm[]
    product: CompoundDef | null
    onDone: (kind: 'success' | 'fail') => void
    onSynthesisStageChange?: (stage: 'reactor' | 'substance') => void
    onPhaseChange?: (phase: string, launchProgress: number) => void
  } | null
}) {
  const { camera } = useThree()
  const orbRef = useRef<OrbitControlsImpl | null>(null)
  const perfLevelRef = useRef<PerfLevel>('high')
  const perfAcc = useRef({ t: 0, lowT: 0, highT: 0, fps: 60 })
  const fpsGovRef = useRef(createFpsGovernor())
  const synthActive = synthesis != null
  const previewActive = false
  const previewAtomGroupRefs = useRef<(THREE.Group | null)[]>([])
  const previewAtomScaleGroupRefs = useRef<(THREE.Group | null)[]>([])
  const previewRootRef = useRef<THREE.Group | null>(null)
  const [earlyProductReveal, setEarlyProductReveal] = useState(false)
  const [forceProductSlot, setForceProductSlot] = useState(false)
  const [prewarmReady, setPrewarmReady] = useState(false)
  const [previewRetainFrames, setPreviewRetainFrames] = useState(0)
  const crossfadeGuardRef = useRef<ProductCrossfadeGuard | null>(null)
  const coverageTrackerRef = useRef(createSynthesisCoverageTracker())
  const previewAtomCount = reactorPreviewTerms?.length
    ? buildReactorPreviewAtoms(reactorPreviewTerms).length
    : 0

  const showSettledHero =
    !synthActive &&
    !synthesisRunActive &&
    !previewActive &&
    synthesisSettledProduct != null

  const mountReactorPreview =
    reactorViewOpen &&
    reactorPreviewTerms != null &&
    reactorPreviewTerms.length >= 1 &&
    (!showSettledHero || synthActive || synthesisRunActive)
  /** Блокируем drift/GSAP с converge до product — иначе атомы «прыгают» на merge. */
  const previewMotionLocked = synthActive && synthesisPhase !== 'product'
  const previewPoseLocked = synthActive || synthesisRunActive
  const reactorPreviewVisible =
    mountReactorPreview &&
    (synthesisPhase !== 'product' || previewRetainFrames > 0)

  const fadePreviewAtoms = useCallback(() => {
    for (const g of previewAtomScaleGroupRefs.current) {
      if (!g) continue
      gsap.killTweensOf(g.scale)
      const sx = g.scale.x
      const sy = g.scale.y
      const sz = g.scale.z
      gsap.to(g.scale, {
        x: sx * 0.02,
        y: sy * 0.02,
        z: sz * 0.02,
        duration: 0.04,
        ease: 'power2.in',
      })
    }
  }, [])

  const productForSlot =
    synthesisSettledProduct ??
    (synthActive && synthesis?.product ? synthesis.product : null) ??
    prewarmProductCompound
  const productSlotVisible =
    productForSlot != null &&
    (showSettledHero ||
      forceProductSlot ||
      earlyProductReveal ||
      (synthActive && synthesisPhase === 'product'))
  const productPrewarmActive =
    productForSlot != null &&
    !productSlotVisible &&
    !showSettledHero &&
    reactorViewOpen &&
    prewarmProductCompound != null &&
    prewarmReady

  useEffect(() => {
    if (!reactorViewOpen || !prewarmProductCompound) {
      setPrewarmReady(false)
      return
    }
    const id = requestAnimationFrame(() => setPrewarmReady(true))
    return () => {
      cancelAnimationFrame(id)
      setPrewarmReady(false)
    }
  }, [reactorViewOpen, prewarmProductCompound?.id])

  useEffect(() => {
    if (!synthActive) {
      setEarlyProductReveal(false)
      setForceProductSlot(false)
      setPreviewRetainFrames(0)
      coverageTrackerRef.current.reset()
      crossfadeGuardRef.current?.cancel()
      crossfadeGuardRef.current = null
      return
    }
    if (synthesisPhase !== 'mergeFlash') return
    const guard = createProductCrossfadeGuard(() => setForceProductSlot(true))
    crossfadeGuardRef.current = guard
    return () => {
      guard.cancel()
      if (crossfadeGuardRef.current === guard) crossfadeGuardRef.current = null
    }
  }, [synthActive, synthesisPhase, synthesis?.runId])

  useEffect(() => {
    if (!productSlotVisible) return
    crossfadeGuardRef.current?.signalProductReady()
    setPreviewRetainFrames(SYNTH_PREVIEW_RETAIN_FRAMES)
  }, [productSlotVisible, synthesis?.runId])

  useEffect(() => {
    if (previewRetainFrames <= 0) return
    const id = requestAnimationFrame(() => {
      setPreviewRetainFrames((n) => Math.max(0, n - 1))
    })
    return () => cancelAnimationFrame(id)
  }, [previewRetainFrames])

  const onEarlyProductReveal = useCallback(() => {
    setEarlyProductReveal(true)
  }, [])

  assertNoProductHeroBeforeRun(
    synthesis?.runId ?? 0,
    productSlotVisible && !showSettledHero,
    transformPreviewCompound != null,
  )
  const productSlotEntrance: 'smooth' | 'none' =
    showSettledHero && !synthActive ? 'none' : 'smooth'

  const reactorBackdrop =
    reactorViewOpen &&
    (mountReactorPreview ||
      previewActive ||
      synthActive ||
      synthesisRunActive ||
      synthesisSettledProduct != null)

  /** Каталожный кадр: превью продукта, settled, слот продукта */
  /** Preload молекулы не переключает каталожную камеру — иначе чёрный кадр и resize. */
  const catalogViewMode =
    previewActive ||
    showSettledHero ||
    productSlotVisible ||
    (!!synthActive && !!synthesis?.product && laboratorySynthesisView === 'substance')

  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => {
    if (catalogViewMode) return
    const p = camera as THREE.PerspectiveCamera
    const manyAtoms = previewAtomCount > 8
    // eslint-disable-next-line react-hooks/immutability
    p.fov = manyAtoms ? 61 : 58
    p.updateProjectionMatrix()
    camera.position.set(0, manyAtoms ? 1.38 : 1.25, manyAtoms ? 7.15 : 6.2)
    camera.lookAt(0, 0.18, 0)
    const t = orbRef.current?.target
    if (t) t.set(0, 0.15, 0)
    orbRef.current?.update?.()
  }, [camera, catalogViewMode, previewAtomCount])

  // eslint-disable-next-line react-hooks/immutability
  useLayoutEffect(() => {
    if (!catalogViewMode) return
    const p = camera as THREE.PerspectiveCamera
    // eslint-disable-next-line react-hooks/immutability
    p.fov = CATALOG_HERO_VIEW.fov
    p.updateProjectionMatrix()
    const [x, y, z] = CATALOG_HERO_VIEW.cameraPosition
    camera.position.set(x, y, z)
    const [tx, ty, tz] = CATALOG_HERO_VIEW.target
    camera.lookAt(tx, ty, tz)
    if (orbRef.current?.target) {
      orbRef.current.target.set(tx, ty, tz)
      orbRef.current.update?.()
    }
  }, [
    camera,
    catalogViewMode,
    showSettledHero,
    previewActive,
    synthesis?.runId,
    synthesisSettledProduct?.id,
    synthesisPhase,
  ])

  useEffect(() => {
    fpsGovRef.current.reset()
    if (forceLiteFxRef) forceLiteFxRef.current = false
  }, [synthesis?.runId, forceLiteFxRef])

  // Лёгкий авто-тюнинг: если FPS проседает — переключаемся на low и обратно с гистерезисом.
  // Делается здесь (внутри Canvas), чтобы измерять delta из render-loop без внешних зависимостей.
  useEffect(() => {
    perfLevelRef.current = 'high'
    perfAcc.current = { t: 0, lowT: 0, highT: 0, fps: 60 }
    onPerfLevelChange?.('high')
  }, [onPerfLevelChange])

  useFrame((_, delta) => {
    if (synthesisRunActive || synthActive) {
      coverageTrackerRef.current.tick(
        true,
        {
          preview: reactorPreviewVisible && mountReactorPreview,
          product: productSlotVisible || productPrewarmActive,
          mergeFx: synthesisPhase === 'mergeFlash',
          convergeFx:
            synthesisPhase === 'converge' ||
            synthesisPhase === 'ignite' ||
            synthesisPhase === 'flying',
          cosmicFx: synthesisRunActive || synthActive,
        },
        () => setForceProductSlot(true),
      )
    }

    if (
      previewMotionLocked &&
      previewAtomCount > 0 &&
      previewAtomCount <= 8 &&
      previewRootRef.current
    ) {
      previewRootRef.current.rotation.y += delta * 0.04
    }

    // delta может быть очень большим при сворачивании окна; ограничим.
    const d = Math.min(0.25, Math.max(0.0005, delta))
    const fps = 1 / d
    const a = perfAcc.current
    // EMA сглаживание
    a.fps = a.fps * 0.9 + fps * 0.1
    if (synthActive && forceLiteFxRef) {
      const gov = fpsGovRef.current
      gov.tick(a.fps)
      forceLiteFxRef.current = gov.forceLite
    }
    a.t += d
    if (a.t < 0.25) return
    a.t = 0

    if (synthesisRunActive) return

    const cur = perfLevelRef.current
    const LOW_ENTER_FPS = 50
    const HIGH_EXIT_FPS = 58
    const ENTER_SEC = 0.8
    const EXIT_SEC = 1.5

    if (cur === 'high') {
      if (a.fps < LOW_ENTER_FPS) a.lowT += 0.25
      else a.lowT = Math.max(0, a.lowT - 0.25)
      if (a.lowT >= ENTER_SEC) {
        perfLevelRef.current = 'low'
        a.highT = 0
        onPerfLevelChange?.('low')
      }
    } else {
      if (a.fps > HIGH_EXIT_FPS) a.highT += 0.25
      else a.highT = Math.max(0, a.highT - 0.25)
      if (a.highT >= EXIT_SEC) {
        perfLevelRef.current = 'high'
        a.lowT = 0
        onPerfLevelChange?.('high')
      }
    }
  })

  const cosmicSynthActive = synthesisRunActive || synthActive
  const cosmicAccent =
    synthesis?.product?.accentColor ??
    prewarmProductCompound?.accentColor ??
    synthesisSettledProduct?.accentColor ??
    '#3dffec'

  return (
    <>
      {reactorBackdrop && !cosmicSynthActive ? <LabReactorEnvironment /> : null}
      {cosmicSynthActive ? (
        <LabSynthesisCosmicBackdrop
          phase={synthesisPhase || 'converge'}
          accentHex={cosmicAccent}
          lite
        />
      ) : null}
      {reactorBackdrop ? <LabReactorLights /> : null}
      {(mountReactorPreview || productPrewarmActive) ? <ReactorSceneWarmup active /> : null}

      {!reactorViewOpen ? (
        <>
          <color attach="background" args={[LAB_SCENE_CLEAR_HEX]} />
          <fog attach="fog" args={[LAB_SCENE_CLEAR_HEX, 6, 28]} />
          <Stars radius={100} depth={50} count={1200} factor={3} saturation={0} fade speed={0.35} />
          <ambientLight intensity={0.22} />
          <directionalLight position={[4, 6, 2]} intensity={0.55} color="#b8c8ff" />
          <group position={[0, 0, 0]}>
            {structureZ != null ? (
              <AtomStructureModel z={structureZ} />
            ) : (
              <DecorativeAtom />
            )}
          </group>
          {particles.map((p) => (
            <DraggableParticle
              key={p.id}
              particle={p}
              onParticleMove={onParticleMove}
              onInspectAtom={onInspectAtom}
            />
          ))}
        </>
      ) : null}

      {reactorViewOpen ? (
        <>
          {mountReactorPreview && reactorPreviewTerms ? (
            <ReactorTermsPreview
              terms={reactorPreviewTerms}
              visible={reactorPreviewVisible}
              flightActive={previewMotionLocked}
              poseLocked={previewPoseLocked}
              sharedLighting={synthActive || synthesisRunActive}
              atomGroupRefs={previewAtomGroupRefs}
              atomScaleGroupRefs={previewAtomScaleGroupRefs}
              previewRootRef={previewRootRef}
            />
          ) : null}
          {previewActive && transformPreviewCompound ? (
            <TransformPreviewHero compound={transformPreviewCompound} />
          ) : null}
          {synthActive && synthesis ? (
            <SynthesisOnLabScene
              zSlots={synthesis.zSlots}
              flyTerms={synthesis.flyTerms}
              product={synthesis.product}
              runId={synthesis.runId}
              onDone={synthesis.onDone}
              onSynthesisStageChange={synthesis.onSynthesisStageChange}
              onPhaseChange={synthesis.onPhaseChange}
              previewAtomGroupRefs={previewAtomGroupRefs}
              previewAtomScaleGroupRefs={previewAtomScaleGroupRefs}
              onPreviewAtomFade={fadePreviewAtoms}
              onEarlyProductReveal={onEarlyProductReveal}
              externalProductSlot
              externalCosmicBackdrop
              labLiteMode
              forceLiteFx={forceLiteFxRef?.current ?? false}
            />
          ) : null}
          {showSettledHero && synthesisSettledProduct
            ? particles
                .filter(
                  (p) =>
                    !(
                      p.type === 'molecule' &&
                      p.compoundId === synthesisSettledProduct.id
                    ),
                )
                .map((p) => (
                  <DraggableParticle
                    key={p.id}
                    particle={p}
                    onParticleMove={onParticleMove}
                    onInspectAtom={onInspectAtom}
                  />
                ))
            : null}
        </>
      ) : null}

      {catalogViewMode && !synthActive ? <CatalogCanvasResizeSync /> : null}
      {(productSlotVisible || productPrewarmActive) && productForSlot ? (
        <LabProductHeroSlot
          compound={productForSlot}
          visible={productSlotVisible}
          prewarm={productPrewarmActive}
          entrance={productSlotEntrance}
          runId={synthesis?.runId ?? 0}
        />
      ) : null}
      <OrbitControls
        ref={orbRef}
        makeDefault
        enablePan={false}
        enableRotate={!synthActive && !synthesisRunActive}
        enableZoom={!catalogViewMode && !synthActive && !synthesisRunActive}
        minDistance={catalogViewMode ? CATALOG_HERO_VIEW.minDistance : LAB_ORBIT.minDistance}
        maxDistance={catalogViewMode ? CATALOG_HERO_VIEW.maxDistance : LAB_ORBIT.maxDistance}
        minPolarAngle={catalogViewMode ? CATALOG_HERO_VIEW.minPolarAngle : LAB_ORBIT.minPolarAngle}
        maxPolarAngle={catalogViewMode ? CATALOG_HERO_VIEW.maxPolarAngle : LAB_ORBIT.maxPolarAngle}
        target={catalogViewMode ? CATALOG_HERO_VIEW.target : LAB_ORBIT.target}
        enableDamping={LAB_ORBIT.enableDamping}
        dampingFactor={LAB_ORBIT.dampingFactor}
      />
    </>
  )
}

export function LabCanvas({
  particles,
  onParticleMove,
  structureZ,
  onInspectAtom,
  synthesis,
  synthesisRunActive = false,
  reactorPreviewTerms = null,
  transformPreviewCompound = null,
  reactorViewOpen = false,
  synthesisSettledProduct = null,
  laboratorySynthesisView = 'reactor',
  synthesisPhase = '',
  forceLiteFxRef,
  prewarmProductCompound = null,
  sessionKey = 0,
}: {
  particles: readonly LabParticle[]
  onParticleMove: (id: string, pos: Vec3) => void
  structureZ: number | null
  onInspectAtom?: (z: number) => void
  synthesisRunActive?: boolean
  reactorPreviewTerms?: readonly ReactorEquationTerm[] | null
  transformPreviewCompound?: CompoundDef | null
  reactorViewOpen?: boolean
  synthesisSettledProduct?: CompoundDef | null
  laboratorySynthesisView?: 'reactor' | 'substance'
  synthesisPhase?: string
  forceLiteFxRef?: React.MutableRefObject<boolean>
  prewarmProductCompound?: CompoundDef | null
  /** Remount Canvas только при webglcontextlost (внутренний sessionKey). */
  sessionKey?: number
  synthesis: {
    runId: number
    zSlots: readonly number[]
    flyTerms: readonly ReactorEquationTerm[]
    product: CompoundDef | null
    onDone: (kind: 'success' | 'fail') => void
    onSynthesisStageChange?: (stage: 'reactor' | 'substance') => void
    onPhaseChange?: (phase: string, launchProgress: number) => void
  } | null
}) {
  const { t } = useT()
  const [perfLevel, setPerfLevel] = useState<PerfLevel>('high')
  const [internalSessionKey, setInternalSessionKey] = useState(0)
  const canvasKey = `${sessionKey}-${internalSessionKey}`

  const previewAtomCount = useMemo(() => {
    if (!reactorPreviewTerms?.length) return 0
    return buildReactorPreviewAtoms(reactorPreviewTerms).length
  }, [reactorPreviewTerms])
  const densePreview = previewAtomCount > 6

  const lowPower3d =
    synthesisRunActive ||
    reactorViewOpen ||
    synthesisSettledProduct != null ||
    laboratorySynthesisView === 'substance' ||
    densePreview ||
    previewAtomCount > 0
  const canvasDpr: number | [number, number] =
    synthesisRunActive || lowPower3d ? 1 : perfLevel === 'low' ? 1 : [1, 1.5]
  const canvasAntialias = !lowPower3d
  if (!isWebGLAvailable()) {
    return (
      <div
        role="status"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          minHeight: 240,
          padding: 12,
          borderRadius: 12,
          color: 'rgba(220,228,255,0.92)',
          background: 'rgba(8,10,26,0.92)',
          border: '1px solid rgba(61,255,236,0.22)',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        {t('lab.webglUnavailable')}
      </div>
    )
  }
  return (
    <CanvasErrorBoundary resetKey={canvasKey} fallback={<CanvasSceneErrorFallback />}>
      <Canvas
        key={canvasKey}
        gl={{
          antialias: canvasAntialias,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        dpr={canvasDpr}
        /** always: DecorativeAtom, ReactorTermsPreview и AtomStructureModel крутят электроны в useFrame */
        frameloop="always"
        onCreated={(state) => {
          const bg = hexToColor(reactorViewOpen ? REACTOR_SCENE_HEX : LAB_SCENE_CLEAR_HEX)
          state.gl.setClearColor(bg, 1)
          state.scene.background = bg
          const canvas = state.gl.domElement
          const onLost = (e: Event) => {
            e.preventDefault()
            requestAnimationFrame(() => {
              setInternalSessionKey((k) => k + 1)
            })
          }
          const onRestored = () => {
            state.gl.setClearColor(bg, 1)
            state.scene.background = bg
            state.gl.setSize(state.size.width, state.size.height)
            state.invalidate()
          }
          canvas.addEventListener('webglcontextlost', onLost)
          canvas.addEventListener('webglcontextrestored', onRestored)
        }}
      >
        <SceneContent
          particles={particles}
          onParticleMove={onParticleMove}
          structureZ={structureZ}
          onInspectAtom={onInspectAtom}
          synthesis={synthesis}
          synthesisRunActive={synthesisRunActive}
          onPerfLevelChange={setPerfLevel}
          reactorPreviewTerms={reactorPreviewTerms}
          transformPreviewCompound={transformPreviewCompound}
          reactorViewOpen={reactorViewOpen}
          synthesisSettledProduct={synthesisSettledProduct ?? null}
          laboratorySynthesisView={laboratorySynthesisView}
          synthesisPhase={synthesisPhase}
          forceLiteFxRef={forceLiteFxRef}
          prewarmProductCompound={prewarmProductCompound}
        />
      </Canvas>
    </CanvasErrorBoundary>
  )
}
