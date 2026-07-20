import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, startTransition } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, DragControls } from '@react-three/drei'
import { gsap } from 'gsap'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { DecorativeAtom } from './DecorativeAtom'
import { AtomStructureModel } from './AtomStructureModel'
import { MoleculeMesh } from './MoleculeMesh'
import { SynthesisOnLabScene } from './SynthesisOnLabScene'
import { InstantLabSynthesis } from './InstantLabSynthesis'
import { LabProductHeroSlot } from './LabProductHeroSlot'
import { LabSynthesisCosmicBackdrop } from './LabSynthesisCosmicBackdrop'
import { assertNoProductHeroBeforeRun } from '../../lab/atomGuard/labPreviewGuard'
import { createSynthesisQualityGovernor } from '../../lab/atomGuard/synthesisRunGuard'
import {
  computeReactorEditQualityCap,
  computeStaticQualityCap,
  featuresForQuality,
  qualityLevelToForceLite,
  SYNTHESIS_QUALITY_BALANCED,
  SYNTHESIS_QUALITY_LITE,
  type SynthesisQualityLevel,
} from '../../lab/synthesisQualityLadder'
import {
  getReactorPreviewPolicy,
  shouldRunGuardTick,
} from '../../lab/synthesisLagGuard'
import { CatalogSubstanceDisplay } from './CatalogSubstanceDisplay'
import { CatalogCanvasResizeSync } from './CatalogCanvasResizeSync'
import { ReactorTermsPreview } from './ReactorTermsPreview'
import { reactorPreviewAtomScale } from './reactorPreviewLayout'
import { getSynthesisDeviceTier, refineSynthesisDeviceTierFromFps } from '../../lab/synthesisDeviceTier'
import { getReactorVisualTier } from '../../chemistry/reactorVisualTier'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import type { CompoundDef } from '../../types/chemistry'
import type { LabParticle, Vec3 } from '../../types/chemistry'
import { compoundById } from '../../data/compounds'
import { CATALOG_HERO_VIEW, LAB_ORBIT } from './labOrbitConstants'
import { CanvasErrorBoundary } from '../common/CanvasErrorBoundary'
import { CanvasSceneErrorFallback } from '../common/CanvasSceneErrorFallback'
import { useT } from '../../i18n/useT'
import { isWebGLAvailable } from '../../utils/webgl'
import {
  shouldMountProductGpuPrewarm,
} from '../../lab/labCanvasFrameGuard'
import { createReactorFrameBudget } from '../../lab/reactorFrameBudget'
import { createSynthesisAntiStallGuard } from '../../lab/synthesisAntiStall'
import { isProductGpuCompiled } from '../../lab/productGpuCompileCache'
import { resolveSynthesisProductSlot } from '../../lab/synthesisProductSlot'
import {
  createProductCrossfadeGuard,
  type ProductCrossfadeGuard,
} from '../../lab/synthesisLaunchGuard'
import {
  createSynthesisCoverageTracker,
} from '../../lab/synthesisVisualGuard'
import {
  isEffectiveProductPainted,
  resolveSynthesisContinuity,
  type SynthesisStickyMountRef,
  type SynthesisPreviewStickyRef,
} from '../../lab/synthesisAntiBlink'
import { synthesisContinuityCoveredV2 } from '../../lab/visualCoverageController'
import { createReactorPreviewContinuityGuard } from '../../lab/reactorPreviewContinuityGuard'
import {
  applyReactorPreviewCamera,
  isCameraStuckNearCatalogHero,
  resolveReactorPreviewCameraPose,
  REACTOR_PREVIEW_CAMERA,
  type ReactorPreviewCameraPose,
} from '../../lab/reactorPreviewCamera'
import { getSynthesisTimingProfile, isInstantSynthesisProfile } from '../../lab/synthesisTimingProfile'
import { LAB_COSMIC_BG } from './LabSynthesisCosmicBackdrop'
import { resolveDeviceSynthesisCap } from '../../perf/graphicsSettings'
import { resolveLabCanvasPolicy } from '../../perf/deviceCanvasPolicy'
import {
  bumpShieldOnCoeffEdit,
  createShieldSnapshot,
  createSoftWebGlRecovery,
  REACTOR_SHIELD,
  tickShieldPhase,
} from '../../lab/reactorPreviewShield'
import { getLowPowerDeviceProfile } from '../../lab/lowPowerDeviceProfile'
import { SYNTHESIS_PERF } from '../../lab/synthesisPerfPreset'
import {
  canIdleGpuCompileQueue,
  resolvePopularSynthesisCompounds,
} from '../../lab/synthesisPrewarmPolicy'
import { ReactorAtomShaderWarmup } from './ReactorAtomShaderWarmup'
import { LabSynthesisGpuQueue } from './LabSynthesisGpuQueue'

/** Свободная лаборатория (атомы на столе). */
const LAB_SCENE_CLEAR_HEX = '#03040a'
/** Реактор / синтез / каталожный кадр — фон через LabSynthesisCosmicBackdrop. */
const REACTOR_SCENE_HEX = '#0a0c18'

/** Единый clear color реактора — совпадает с LabSynthesisCosmicBackdrop (без скачка при старте синтеза). */
function LabReactorClearColor() {
  const { gl, scene } = useThree()
  useLayoutEffect(() => {
    const c = hexToColor(LAB_COSMIC_BG)
    gl.setClearColor(c, 1)
    scene.background = c
  }, [gl, scene])
  return null
}

/** Синхронизация clear color при переходе idle ↔ реактор — убирает «призрак» обложечного атома. */
function LabSceneClearSync({ reactorMode }: { reactorMode: boolean }) {
  const { gl, scene, invalidate } = useThree()
  useLayoutEffect(() => {
    const hex = reactorMode ? LAB_COSMIC_BG : LAB_SCENE_CLEAR_HEX
    const c = hexToColor(hex)
    gl.setClearColor(c, 1)
    scene.background = c
    invalidate()
  }, [reactorMode, gl, scene, invalidate])
  return null
}

/** Свет и фон, пока синтез ещё монтируется (нет «пустого» кадра). */
function LabReactorLights() {
  return (
    <>
      <ambientLight intensity={0.48} />
      <directionalLight position={[3.2, 5.5, 2.5]} intensity={0.92} color="#b8c8ff" />
      <pointLight position={[0, 0.18, 1.6]} intensity={1.55} distance={18} color="#7afcff" />
    </>
  )
}

/** Прогрев кадра при открытии реактора + несколько invalidate для WebGL pipeline. */
function ReactorSceneWarmup({
  reactorOpen,
  paused,
}: {
  reactorOpen: boolean
  paused?: boolean
}) {
  const { invalidate } = useThree()
  const warmedRef = useRef(false)
  useEffect(() => {
    if (!reactorOpen || paused) {
      if (!reactorOpen) warmedRef.current = false
      return
    }
    if (warmedRef.current) return
    warmedRef.current = true
    let cancelled = false
    let count = 0
    const maxFrames = 20
    const tick = () => {
      if (cancelled) return
      invalidate()
      count += 1
      if (count < maxFrames) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    return () => {
      cancelled = true
    }
  }, [reactorOpen, paused, invalidate])
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
        renderQuality="high"
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
  synthesisPhase = '',
  forceLiteFxRef,
  prewarmProductCompound = null,
  gpuQueuePriorityCompound = null,
  reactorCoeffEditBurst = false,
  reactorCoeffEditing = false,
  reactorGpuIdleReady = false,
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
  synthesisPhase?: string
  forceLiteFxRef?: React.MutableRefObject<boolean>
  /** Быстрая серия +/- — lite meshes, drift off; электроны остаются. */
  reactorCoeffEditBurst?: boolean
  /** Любое редактирование уравнения (burst или !editIdle). */
  reactorCoeffEditing?: boolean
  /** Продукт для скрытого pre-warm (compile GPU) до запуска синтеза */
  prewarmProductCompound?: CompoundDef | null
  /** Приоритет фоновой GPU-очереди — выбранный продукт компилируется первым */
  gpuQueuePriorityCompound?: CompoundDef | null
  /** Реактор стабилен после открытия — можно фоновый GPU-prewarm */
  reactorGpuIdleReady?: boolean
  synthesis: {
    runId: number
    zSlots: readonly number[]
    flyTerms: readonly ReactorEquationTerm[]
    product: CompoundDef | null
    visualTier?: import('../../chemistry/reactorVisualTier').ReactorVisualTier
    onDone: (kind: 'success' | 'fail') => void
    onSynthesisStageChange?: (stage: 'reactor' | 'substance') => void
    onPhaseChange?: (phase: string, launchProgress: number) => void
  } | null
}) {
  const { camera, invalidate } = useThree()
  const orbRef = useRef<OrbitControlsImpl | null>(null)
  const perfLevelRef = useRef<PerfLevel>('high')
  const perfAcc = useRef({ t: 0, lowT: 0, highT: 0, fps: 60 })
  const deviceTier = useMemo(() => getSynthesisDeviceTier(), [])
  const deviceSynthCap = useMemo(() => resolveDeviceSynthesisCap(deviceTier), [deviceTier])
  const fpsGovRef = useRef(
    createSynthesisQualityGovernor({
      floor: deviceTier === 'low' ? SYNTHESIS_QUALITY_LITE : SYNTHESIS_QUALITY_BALANCED,
      cap: deviceSynthCap,
      initial: deviceSynthCap,
    }),
  )
  const synthForceLiteRef = useRef(false)
  const synthQualityLevelRef = useRef<SynthesisQualityLevel>(deviceSynthCap)
  const [synthQualityLevel, setSynthQualityLevel] = useState<SynthesisQualityLevel>(deviceSynthCap)
  const synthForceLite = qualityLevelToForceLite(synthQualityLevel)
  const qualityUiThrottleRef = useRef(0)
  const coverageFrameRef = useRef(0)
  const synthActive = synthesis != null
  const previewActive = false
  const previewForceLiteLatchRef = useRef<boolean | null>(null)
  const previewAtomGroupRefs = useRef<(THREE.Group | null)[]>([])
  const previewAtomScaleGroupRefs = useRef<(THREE.Group | null)[]>([])
  const previewRootRef = useRef<THREE.Group | null>(null)
  const [earlyProductReveal, setEarlyProductReveal] = useState(false)
  const [forceProductSlot, setForceProductSlot] = useState(false)
  const [productRevealReady, setProductRevealReady] = useState(false)
  const [productPainted, setProductPainted] = useState(false)
  const productPaintedRef = useRef(false)
  /** runId, для которого productPainted валиден — иначе stale paint гасит Bohr на старте нового синтеза. */
  const paintedForRunIdRef = useRef(0)
  const productPaintFramesRef = useRef(0)
  const prewarmSuppressUntilRef = useRef(0)
  const [prewarmSuppressRev, setPrewarmSuppressRev] = useState(0)
  const [prewarmReady, setPrewarmReady] = useState(false)
  const prewarmReadyRef = useRef(false)
  const prewarmCompoundIdRef = useRef<string | null>(null)
  const productStickyMountRef = useRef<SynthesisStickyMountRef | null>(null)
  const previewStickyMountRef = useRef<SynthesisPreviewStickyRef | null>(null)
  const crossfadeGuardRef = useRef<ProductCrossfadeGuard | null>(null)
  const coverageTrackerRef = useRef(createSynthesisCoverageTracker())
  const frameHoldRef = useRef(createSynthesisAntiStallGuard())
  const frameBudgetRef = useRef(createReactorFrameBudget())
  const previewContinuityRef = useRef(createReactorPreviewContinuityGuard())
  const editLiteLatchRef = useRef(false)
  const previewTermsShellRef = useRef<readonly ReactorEquationTerm[] | null>(null)
  const coeffEditingActive = reactorCoeffEditing || reactorCoeffEditBurst
  /**
   * После +/- / apply баланса не монтируем product GPU до кнопки «Запустить» —
   * иначе hitch гасит Bohr на idle.
   */
  const [allowIdleProductPrewarm, setAllowIdleProductPrewarm] = useState(false)
  useEffect(() => {
    if (coeffEditingActive) setAllowIdleProductPrewarm(false)
  }, [coeffEditingActive])
  useEffect(() => {
    if (synthActive || synthesisRunActive) setAllowIdleProductPrewarm(true)
  }, [synthActive, synthesisRunActive])
  /**
   * Shell никогда не null'им при открытом реакторе из-за краткого пустого canvas hold —
   * иначе unmount Bohr → пустой starfield при живом уравнении в панели.
   */
  if (reactorViewOpen && reactorPreviewTerms && reactorPreviewTerms.length >= 1) {
    previewTermsShellRef.current = reactorPreviewTerms
  } else if (!reactorViewOpen) {
    previewTermsShellRef.current = null
  }
  const effectivePreviewTerms =
    reactorViewOpen && previewTermsShellRef.current?.length
      ? previewTermsShellRef.current
      : null

  const previewVisualTier = useMemo(
    () => (effectivePreviewTerms?.length ? getReactorVisualTier(effectivePreviewTerms) : 'full'),
    [effectivePreviewTerms],
  )
  const previewAtomCount = useMemo(() => {
    if (!effectivePreviewTerms?.length) return 0
    let n = 0
    for (const t of effectivePreviewTerms) {
      const c = Math.floor(t.coeff)
      if (c > 0) n += c
    }
    return n
  }, [effectivePreviewTerms])

  const previewTermsSig = useMemo(() => {
    if (!effectivePreviewTerms?.length) return ''
    return effectivePreviewTerms
      .map((t) => `${t.id}:${t.z}:${t.coeff}:${t.diatomic ? 1 : 0}`)
      .join('|')
  }, [effectivePreviewTerms])

  /** Отмена idle-prewarm при hitch / во время ранних фаз синтеза (ignite/converge/flying). */
  const effectivePrewarmProduct = useMemo(() => {
    if (performance.now() < prewarmSuppressUntilRef.current) return null
    if (
      synthActive &&
      synthesisPhase &&
      synthesisPhase !== 'mergeFlash' &&
      synthesisPhase !== 'product' &&
      synthesisPhase !== ''
    ) {
      return null
    }
    return prewarmProductCompound ?? null
  }, [prewarmProductCompound, prewarmSuppressRev, synthActive, synthesisPhase])

  const suppressGpuPrewarm = useCallback((holdMs = 2500) => {
    prewarmSuppressUntilRef.current = performance.now() + holdMs
    setPrewarmSuppressRev((v) => v + 1)
    window.setTimeout(() => setPrewarmSuppressRev((v) => v + 1), holdMs + 80)
  }, [])
  const manyAtomsCameraRef = useRef(previewAtomCount > 8)
  const previewAtomCountRef = useRef(previewAtomCount)
  previewAtomCountRef.current = previewAtomCount
  const catalogViewModePrevRef = useRef(false)
  const reactorCameraLockUntilRef = useRef(0)
  const reactorCameraLockPoseRef = useRef<ReactorPreviewCameraPose | null>(null)
  const lastSynthRunIdRef = useRef(0)

  const synthTimingProfile = useMemo(
    () => getSynthesisTimingProfile(synthForceLite, getSynthesisDeviceTier()),
    [synthForceLite],
  )
  const instantSynthesis = isInstantSynthesisProfile(synthTimingProfile)

  /** При запуске синтеза — снять GPU-ban и ждать реального GPU, не форсить reveal. */
  useLayoutEffect(() => {
    if (!synthActive || !synthesis?.runId) return
    const productId = synthesis.product?.id
    if (productId == null) return
    setAllowIdleProductPrewarm(true)
    setForceProductSlot(true)
    setEarlyProductReveal(true)
    if (isProductGpuCompiled(productId)) {
      prewarmCompoundIdRef.current = productId
      prewarmReadyRef.current = true
      setPrewarmReady(true)
      setProductRevealReady(true)
    } else {
      // Cold path: micro-prewarm first — полный слот только после compile.
      setProductRevealReady(false)
    }
  }, [synthActive, synthesis?.runId, synthesis?.product?.id])

  useLayoutEffect(() => {
    if (reactorViewOpen) return
    previewTermsShellRef.current = null
    productStickyMountRef.current = null
    previewStickyMountRef.current = null
    prewarmReadyRef.current = false
    prewarmCompoundIdRef.current = null
    productPaintedRef.current = false
    paintedForRunIdRef.current = 0
    productPaintFramesRef.current = 0
    lastSynthRunIdRef.current = 0
    setPrewarmReady(false)
    setProductRevealReady(false)
    setProductPainted(false)
    setEarlyProductReveal(false)
    setForceProductSlot(false)
  }, [reactorViewOpen])
  const lowPowerProfile = useMemo(
    () => getLowPowerDeviceProfile(getSynthesisDeviceTier()),
    [reactorCoeffEditBurst, synthesisRunActive],
  )

  const synthQualityFeatures = useMemo(
    () => featuresForQuality(synthQualityLevel, synthesisPhase),
    [synthQualityLevel, synthesisPhase],
  )

  const showSettledHero =
    !synthActive &&
    !synthesisRunActive &&
    !previewActive &&
    synthesisSettledProduct != null

  /** Схлопывание атомов — только когда продукт уже на сцене, без «пустого» кадра. */
  const fadePreviewAtoms = useCallback(() => {
    setForceProductSlot(true)
    setEarlyProductReveal(true)

    if (!synthTimingProfile.collapseAtoms) return

    const groups = previewAtomGroupRefs.current
    const scales = previewAtomScaleGroupRefs.current
    const dur = synthTimingProfile.atomCollapseDur
    if (dur <= 0) return

    window.setTimeout(() => {
      groups.forEach((g, i) => {
        if (!g) return
        const sc = scales[i]
        if (sc) {
          gsap.killTweensOf(sc.scale)
          gsap.to(sc.scale, {
            x: 0.06,
            y: 0.06,
            z: 0.06,
            duration: dur,
            ease: 'power3.in',
          })
        }
      })
    }, 220)
  }, [synthTimingProfile.atomCollapseDur, synthTimingProfile.collapseAtoms])

  const productCompoundCandidate =
    synthesisSettledProduct ??
    synthesis?.product ??
    effectivePrewarmProduct ??
    null

  const gpuPrewarmAllowed = shouldMountProductGpuPrewarm({
    policy: 'balanced-idle',
    synthesisRunActive,
    synthActive,
    showSettledHero,
    hasPrewarmIntent: effectivePrewarmProduct != null,
  })

  const popularPrewarmCompounds = useMemo(
    () => resolvePopularSynthesisCompounds(compoundById),
    [],
  )

  const gpuQueueActive =
    reactorGpuIdleReady &&
    allowIdleProductPrewarm &&
    canIdleGpuCompileQueue({
      reactorOpen: reactorViewOpen,
      coeffEditBurst: reactorCoeffEditBurst,
      coeffEditing: coeffEditingActive,
      synthesisRunActive: synthesisRunActive ?? false,
      synthActive,
    })

  const preSynthesisPreview = !synthesisRunActive && !synthActive && !showSettledHero
  const warmupPaused = !reactorGpuIdleReady || reactorCoeffEditBurst

  /** Всегда держим shell смонтированным при terms — иначе +/- после синтеза = cold remount Bohr. */
  const mountReactorPreview =
    reactorViewOpen &&
    effectivePreviewTerms != null &&
    effectivePreviewTerms.length >= 1

  const synthLiveEarly = synthActive || synthesisRunActive
  const currentSynthRunId = synthesis?.runId ?? 0
  /** Stale paint с прошлого runId не гасит Bohr на старте нового синтеза. */
  const effectiveProductPainted = isEffectiveProductPainted({
    productPainted,
    synthLive: synthLiveEarly,
    runId: currentSynthRunId,
    paintedForRunId: paintedForRunIdRef.current,
  })

  const continuity = useMemo(
    () =>
      resolveSynthesisContinuity({
        runId: currentSynthRunId,
        synthActive,
        synthesisRunActive,
        synthesisPhase,
        showSettledHero,
        mountReactorPreview,
        reactorViewOpen,
        gpuPrewarmAllowed,
        prewarmReady: prewarmReadyRef.current || prewarmReady,
        productCompoundId: productCompoundCandidate?.id ?? null,
        earlyProductReveal,
        forceProductSlot,
        productRevealReady,
        productPainted: effectiveProductPainted,
        keepPreviewDuringProduct: synthLiveEarly && !effectiveProductPainted,
        coeffEditBurst: reactorCoeffEditBurst,
        coeffEditing: coeffEditingActive,
        allowIdleProductPrewarm,
        stickyMountRef: productStickyMountRef,
        previewStickyRef: previewStickyMountRef,
      }),
    [
      currentSynthRunId,
      synthActive,
      synthesisRunActive,
      synthesisPhase,
      showSettledHero,
      mountReactorPreview,
      reactorViewOpen,
      gpuPrewarmAllowed,
      prewarmReady,
      productCompoundCandidate?.id,
      earlyProductReveal,
      forceProductSlot,
      productRevealReady,
      effectiveProductPainted,
      synthLiveEarly,
      instantSynthesis,
      reactorCoeffEditBurst,
      reactorCoeffEditing,
      allowIdleProductPrewarm,
    ],
  )

  const productForSlot =
    continuity.productMeshMounted &&
    productCompoundCandidate &&
    (synthActive ||
      synthesisRunActive ||
      showSettledHero ||
      continuity.productPrewarm)
      ? productCompoundCandidate
      : null

  const synthLive = synthActive || synthesisRunActive
  const productSlotView = resolveSynthesisProductSlot({
    productForSlot,
    productSlotVisible: continuity.productSlotVisible,
    productPrewarmActive: continuity.productPrewarm,
    showSettledHero,
    synthLive,
    prewarmReady: prewarmReadyRef.current || prewarmReady,
    prewarmCompoundId: prewarmCompoundIdRef.current,
  })

  const previewMotionLocked = false
  /** mergeFlash не flight: pin слотов до paint, иначе атомы уезжают в пустоту. */
  const previewFlightActive =
    synthLive && (synthesisPhase === 'converge' || synthesisPhase === 'flying')
  const previewPoseLocked = synthesisRunActive && !synthActive
  if (previewAtomCount > 8) editLiteLatchRef.current = true
  else if (
    previewAtomCount < 6 &&
    !coeffEditingActive &&
    !frameBudgetRef.current.shouldForceLite()
  ) {
    editLiteLatchRef.current = false
  }
  const frameBudgetLite =
    !coeffEditingActive && frameBudgetRef.current.shouldForceLite()
  const editForceLite =
    (!coeffEditingActive && editLiteLatchRef.current) ||
    (!coeffEditingActive && reactorCoeffEditBurst) ||
    frameBudgetLite ||
    lowPowerProfile.forceLiteReactor
  const reactorPreviewMounted = continuity.reactorPreviewMounted
  const reactorPreviewVisible = continuity.reactorPreviewVisible
  const productSlotVisible = continuity.productSlotVisible
  const productPrewarmActive = continuity.productPrewarm
  const productSlotVisibleResolved = productSlotView.visible
  const productPrewarmResolved = productSlotView.prewarm
  const synthHoldPreview =
    synthLive && !effectiveProductPainted && effectivePreviewTerms != null

  const handleProductGpuCompiled = useCallback(
    (compoundId: string) => {
      prewarmCompoundIdRef.current = compoundId
      prewarmReadyRef.current = true
      setPrewarmReady(true)
      if (synthActive || synthesisRunActive) {
        setProductRevealReady(true)
      }
    },
    [synthActive, synthesisRunActive],
  )

  const handleProductVisiblePaint = useCallback(() => {
    paintedForRunIdRef.current = lastSynthRunIdRef.current || currentSynthRunId
    productPaintedRef.current = true
    setProductPainted(true)
  }, [currentSynthRunId])

  const handleInstantSynthDone = useCallback(
    (kind: 'success' | 'fail') => {
      if (!synthesis?.onDone) return
      if (kind !== 'success') {
        synthesis.onDone(kind)
        return
      }
      const productId = synthesis.product?.id
      const readyNow = () =>
        productPaintedRef.current ||
        (productId != null && isProductGpuCompiled(productId))
      if (readyNow()) {
        synthesis.onDone(kind)
        return
      }
      let frames = 0
      const maxWait = 90
      const tick = () => {
        frames += 1
        if (readyNow()) {
          synthesis.onDone(kind)
          return
        }
        if (frames >= maxWait) {
          synthesis.onDone(kind)
          return
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    },
    [synthesis],
  )

  const instantProductReady = useCallback(() => {
    const productId = synthesis?.product?.id
    return (
      productPaintedRef.current ||
      (productId != null && isProductGpuCompiled(productId))
    )
  }, [synthesis?.product?.id])

  useEffect(() => {
    if (!gpuPrewarmAllowed || !reactorViewOpen) {
      if (!synthActive && !synthesisRunActive) {
        prewarmReadyRef.current = false
        prewarmCompoundIdRef.current = null
        setPrewarmReady(false)
      }
      return
    }
    const compound = effectivePrewarmProduct ?? synthesis?.product
    if (!compound) {
      prewarmReadyRef.current = false
      prewarmCompoundIdRef.current = null
      setPrewarmReady(false)
      return
    }
    if (isProductGpuCompiled(compound.id)) {
      prewarmCompoundIdRef.current = compound.id
      prewarmReadyRef.current = true
      setPrewarmReady(true)
      return
    }
    if (prewarmCompoundIdRef.current === compound.id && prewarmReadyRef.current) {
      setPrewarmReady(true)
      return
    }
    if (prewarmCompoundIdRef.current !== compound.id) {
      prewarmReadyRef.current = false
      setPrewarmReady(false)
    }
  }, [
    gpuPrewarmAllowed,
    reactorViewOpen,
    effectivePrewarmProduct?.id,
    synthesis?.product?.id,
    synthActive,
    synthesisRunActive,
  ])

  const prevCoeffEditingRef = useRef(false)
  useLayoutEffect(() => {
    if (synthActive || synthesisRunActive) return
    const wasEditing = prevCoeffEditingRef.current
    prevCoeffEditingRef.current = coeffEditingActive
    const rising = coeffEditingActive && !wasEditing
    const falling = !coeffEditingActive && wasEditing
    if (!rising && !falling) return

    // Rising: убрать productPainted. Falling: восстановить Bohr после GPU/hitch на edit-end.
    if (rising) {
      productPaintedRef.current = false
      paintedForRunIdRef.current = 0
      productPaintFramesRef.current = 0
      setProductPainted(false)
    }
    previewStickyMountRef.current = { runId: -1, previewMounted: true }
    const root = previewRootRef.current
    if (root) {
      gsap.killTweensOf(root)
      root.visible = true
    }
    const n = Math.max(0, previewAtomCountRef.current)
    if (n <= 0) return
    const scaleFloor = reactorPreviewAtomScale(n)
    for (let i = 0; i < n; i++) {
      const sc = previewAtomScaleGroupRefs.current[i]
      if (sc) {
        gsap.killTweensOf(sc.scale)
        sc.visible = true
        if (falling || sc.scale.x < scaleFloor * 0.45) {
          sc.scale.set(scaleFloor, scaleFloor, scaleFloor)
        }
      }
      const g = previewAtomGroupRefs.current[i]
      if (g) {
        gsap.killTweensOf(g)
        g.visible = true
      }
    }
    if (falling) invalidate()
  }, [coeffEditingActive, synthActive, synthesisRunActive, invalidate])

  const restorePreviewRootVisibility = useCallback(() => {
    const root = previewRootRef.current
    if (!root) return
    root.visible = true
  }, [])

  useLayoutEffect(() => {
    if (coeffEditingActive) return
    if (preSynthesisPreview) return
    if (!effectiveProductPainted || !productSlotVisibleResolved) return
    if (synthActive || synthesisRunActive) {
      // Во время синтеза после paint — тоже держим Bohr скрытым.
    }
    const root = previewRootRef.current
    if (!root) return
    root.visible = false
  }, [
    effectiveProductPainted,
    productSlotVisibleResolved,
    coeffEditingActive,
    synthActive,
    synthesisRunActive,
    preSynthesisPreview,
  ])

  useLayoutEffect(() => {
    if (!reactorViewOpen || !preSynthesisPreview) return
    productPaintedRef.current = false
    paintedForRunIdRef.current = 0
    productPaintFramesRef.current = 0
    setProductPainted(false)
    restorePreviewRootVisibility()
  }, [previewTermsSig, preSynthesisPreview, reactorViewOpen, restorePreviewRootVisibility])

  /** Settled сброшен (смена coeff) — сразу снять productPainted, не ждать edit-флагов. */
  useLayoutEffect(() => {
    if (showSettledHero) return
    if (synthActive || synthesisRunActive) return
    if (!reactorViewOpen) return
    productPaintedRef.current = false
    paintedForRunIdRef.current = 0
    productPaintFramesRef.current = 0
    setProductPainted(false)
    restorePreviewRootVisibility()
  }, [
    showSettledHero,
    synthActive,
    synthesisRunActive,
    reactorViewOpen,
    restorePreviewRootVisibility,
  ])

  useLayoutEffect(() => {
    const rid = synthesis?.runId ?? 0
    if (rid <= 0) {
      if (!synthActive && !synthesisRunActive) {
        setProductRevealReady(false)
      }
      return
    }
    if (lastSynthRunIdRef.current !== rid) {
      lastSynthRunIdRef.current = rid
      productPaintedRef.current = false
      paintedForRunIdRef.current = 0
      productPaintFramesRef.current = 0
      setProductPainted(false)
      setForceProductSlot(true)
      setEarlyProductReveal(true)
      restorePreviewRootVisibility()
      // Не ставим reveal сразу: ждём GPU, иначе Bohr скрывается до молекулы.
      const productId = synthesis?.product?.id
      const gpuReadyNow =
        productId != null &&
        (isProductGpuCompiled(productId) ||
          ((prewarmReadyRef.current || prewarmReady) && prewarmCompoundIdRef.current === productId))
      // Instant тоже ждёт GPU — иначе чёрный кадр на cold compile.
      setProductRevealReady(Boolean(gpuReadyNow))
      return
    }
    const productId = synthesis?.product?.id
    const gpuReady =
      productId != null &&
      ((prewarmReadyRef.current || prewarmReady) &&
        prewarmCompoundIdRef.current === productId)
    if (gpuReady || (productId != null && isProductGpuCompiled(productId))) {
      setProductRevealReady(true)
      return
    }
  }, [synthActive, synthesis?.runId, synthesis?.product?.id, prewarmReady, synthesisRunActive, restorePreviewRootVisibility])

  // Когда prewarm завершился уже во время синтеза — сразу показываем продукт.
  useEffect(() => {
    if (!synthActive || !synthesis?.runId || productRevealReady) return
    const productId = synthesis.product?.id
    if (productId == null) return
    if (
      (prewarmReady && prewarmCompoundIdRef.current === productId) ||
      isProductGpuCompiled(productId)
    ) {
      setProductRevealReady(true)
    }
  }, [synthActive, synthesis?.runId, synthesis?.product?.id, prewarmReady, productRevealReady])

  // Fallback productReveal: не форсим на 1-м кадре (чёрный/красный).
  // Ждём GPU; safety cap ~1.5с чтобы не зависать на слабых GPU.
  useEffect(() => {
    if (!synthActive || !synthesis?.runId || productRevealReady) return
    const productId = synthesis.product?.id
    let frames = 0
    let raf = 0
    const cap = instantSynthesis ? 72 : 48
    const tick = () => {
      frames += 1
      if (
        (productId != null && isProductGpuCompiled(productId)) ||
        (prewarmReadyRef.current && prewarmCompoundIdRef.current === productId)
      ) {
        setProductRevealReady(true)
        return
      }
      if (frames >= cap) {
        setProductRevealReady(true)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [synthActive, synthesis?.runId, synthesis?.product?.id, productRevealReady, instantSynthesis])

  useLayoutEffect(() => {
    if (!synthesis?.runId) return
    if (previewForceLiteLatchRef.current === null) {
      previewForceLiteLatchRef.current = synthForceLiteRef.current
    }
  }, [synthesis?.runId])

  useEffect(() => {
    if (!synthActive && !synthesisRunActive) {
      previewForceLiteLatchRef.current = null
    }
  }, [synthActive, synthesisRunActive])

  useLayoutEffect(() => {
    if (!synthActive || !synthesis?.runId) return
    setForceProductSlot(true)
    setEarlyProductReveal(true)
  }, [synthActive, synthesis?.runId])

  useLayoutEffect(() => {
    if (synthActive || synthesisRunActive || showSettledHero) return
    setEarlyProductReveal(false)
    setForceProductSlot(false)
  }, [synthActive, synthesisRunActive, showSettledHero])

  useEffect(() => {
    if (!synthActive) {
      coverageTrackerRef.current.reset()
      crossfadeGuardRef.current?.cancel()
      crossfadeGuardRef.current = null
      return
    }
    if (instantSynthesis || synthesisPhase !== 'mergeFlash') return
    const guard = createProductCrossfadeGuard(() => setForceProductSlot(true))
    crossfadeGuardRef.current = guard
    return () => {
      guard.cancel()
      if (crossfadeGuardRef.current === guard) crossfadeGuardRef.current = null
    }
  }, [synthActive, synthesisPhase, synthesis?.runId, synthesis?.product?.id, showSettledHero])

  const onEarlyProductReveal = useCallback(() => {
    setEarlyProductReveal(true)
    setForceProductSlot(true)
  }, [])

  const previewForceLite =
    (synthActive || synthesisRunActive) && previewForceLiteLatchRef.current !== null
      ? previewForceLiteLatchRef.current
      : synthForceLite

  assertNoProductHeroBeforeRun(
    synthesis?.runId ?? 0,
    productSlotVisible && !showSettledHero,
    transformPreviewCompound != null,
  )
  const productSlotEntrance: 'smooth' | 'none' | 'instant' =
    showSettledHero && !synthActive
      ? 'none'
      : instantSynthesis || synthActive
        ? 'instant'
        : 'smooth'

  /** Фон реактора с первого кадра после «Синтез» — без чёрного провала и ghost-frame. */
  const reactorBackdrop = reactorViewOpen

  /** Каталожный кадр: settled / превью продукта вне анимации синтеза. */
  const catalogViewMode =
    previewActive ||
    showSettledHero ||
    (productSlotVisible && !synthesisRunActive && !synthActive)

  /**
   * Ракурс превью реагентов: сразу после coeff / выхода из catalog hero.
   * Раньше `coeffEditingActive` блокировал set — камера залипала на z≈3.6,
   * атомы «появлялись» только после ручного вращения OrbitControls.
   */
  // eslint-disable-next-line react-hooks/immutability
  useLayoutEffect(() => {
    const leftCatalog = catalogViewModePrevRef.current && !catalogViewMode
    catalogViewModePrevRef.current = catalogViewMode
    if (catalogViewMode) return
    if (previewAtomCount <= 0 && !coeffEditingActive && !leftCatalog) return

    const { pose, manyAtoms } = resolveReactorPreviewCameraPose(
      previewAtomCount,
      manyAtomsCameraRef.current,
    )
    manyAtomsCameraRef.current = manyAtoms

    const cam = camera as THREE.PerspectiveCamera
    applyReactorPreviewCamera(cam, orbRef.current, pose)
    reactorCameraLockPoseRef.current = pose
    reactorCameraLockUntilRef.current = performance.now() + REACTOR_PREVIEW_CAMERA.lockMs
    invalidate()

    // Второй кадр — против гонки React-пропсов OrbitControls (min/max distance).
    const orb = orbRef.current
    const t = window.setTimeout(() => {
      applyReactorPreviewCamera(cam, orb, pose)
      invalidate()
    }, 32)
    return () => window.clearTimeout(t)
  }, [
    camera,
    catalogViewMode,
    previewAtomCount,
    previewTermsSig,
    invalidate,
    coeffEditingActive,
    showSettledHero,
  ])

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
    const staticCap = computeStaticQualityCap({
      deviceTier: getSynthesisDeviceTier(),
      atomCount: previewAtomCount,
      visualTier: previewVisualTier,
    })
    if (!synthesis?.runId) {
      const editLite =
        editForceLite ||
        previewAtomCount > SYNTHESIS_PERF.liteFxAtomThreshold ||
        qualityLevelToForceLite(
          computeReactorEditQualityCap(previewAtomCount, reactorCoeffEditBurst) as SynthesisQualityLevel,
        )
      synthForceLiteRef.current = editLite
      if (forceLiteFxRef) forceLiteFxRef.current = editLite
      return
    }
    fpsGovRef.current.reset()
    const cap = Math.min(
      computeReactorEditQualityCap(previewAtomCount, reactorCoeffEditBurst),
      staticCap,
    ) as SynthesisQualityLevel
    fpsGovRef.current.setCap(cap)
    fpsGovRef.current.reset(cap)
    const initialLite = qualityLevelToForceLite(cap)
    synthForceLiteRef.current = initialLite
    startTransition(() => {
      setSynthQualityLevel(cap)
    })
    if (forceLiteFxRef) forceLiteFxRef.current = initialLite
  }, [
    synthesis?.runId,
    previewAtomCount,
    previewVisualTier,
    forceLiteFxRef,
    reactorCoeffEditBurst,
    editForceLite,
  ])

  // Лёгкий авто-тюнинг
  useEffect(() => {
    perfLevelRef.current = 'high'
    perfAcc.current = { t: 0, lowT: 0, highT: 0, fps: 60 }
    onPerfLevelChange?.('high')
  }, [onPerfLevelChange])

  const previewLagPolicy = useMemo(
    () =>
      getReactorPreviewPolicy({
        atomCount: previewAtomCount,
        forceLite: synthForceLite || editForceLite,
        qualityLevel: synthQualityLevel,
        flightActive: previewMotionLocked,
        visible: reactorPreviewVisible,
        coeffEditBurst: reactorCoeffEditBurst,
      }),
    [
      previewAtomCount,
      synthForceLite,
      synthQualityLevel,
      previewMotionLocked,
      reactorPreviewVisible,
      reactorCoeffEditBurst,
      editForceLite,
    ],
  )

  useFrame((_, delta) => {
    frameHoldRef.current.markRendered()
    frameBudgetRef.current.sample(Math.min(120, Math.max(0.5, delta * 1000)))

    // Удерживаем hero-ракурс ~280мс после coeff/выхода из catalog —
    // иначе damping OrbitControls откатывает камеру назад к z≈3.6.
    const lockPose = reactorCameraLockPoseRef.current
    if (
      lockPose &&
      !catalogViewMode &&
      !synthActive &&
      !synthesisRunActive &&
      performance.now() < reactorCameraLockUntilRef.current
    ) {
      applyReactorPreviewCamera(camera as THREE.PerspectiveCamera, orbRef.current, lockPose)
    } else if (
      lockPose &&
      !catalogViewMode &&
      !synthActive &&
      !synthesisRunActive &&
      previewAtomCount > 0 &&
      isCameraStuckNearCatalogHero(camera.position)
    ) {
      // Страховка: если всё же залипли у catalog hero — сразу вернуть ракурс.
      applyReactorPreviewCamera(camera as THREE.PerspectiveCamera, orbRef.current, lockPose)
      reactorCameraLockUntilRef.current = performance.now() + 120
    }

    if (frameBudgetRef.current.shouldForceLite() && reactorViewOpen && !coeffEditingActive) {
      editLiteLatchRef.current = true
      if (forceLiteFxRef) forceLiteFxRef.current = true
    }

    coverageFrameRef.current += 1
    const coverageEvery = previewLagPolicy.coverageGuardEvery
    if (
      (synthesisRunActive || synthActive || reactorViewOpen) &&
      shouldRunGuardTick(coverageFrameRef.current, coverageEvery)
    ) {
      coverageTrackerRef.current.tick(
        synthesisRunActive || synthActive,
        {
          preview: reactorPreviewVisible && reactorPreviewMounted,
          product: productSlotVisible || productPrewarmActive,
          mergeFx: synthesisPhase === 'mergeFlash',
          convergeFx:
            synthesisPhase === 'converge' ||
            synthesisPhase === 'ignite' ||
            synthesisPhase === 'flying',
          cosmicFx: synthesisRunActive || synthActive || reactorViewOpen,
        },
        () => {
          const editMode = reactorViewOpen && !synthesisRunActive && !synthActive
          if (
            !synthesisContinuityCoveredV2(
              continuity,
              synthesisPhase === 'mergeFlash',
              synthesisPhase === 'converge' ||
                synthesisPhase === 'ignite' ||
                synthesisPhase === 'flying',
              editMode,
            )
          ) {
            if (previewRootRef.current && (editMode || synthActive || synthesisRunActive)) {
              previewRootRef.current.visible = true
              invalidate()
            }
            if (synthesisPhase === 'mergeFlash' || synthesisPhase === 'product') {
              setForceProductSlot(true)
            }
          }
        },
      )
    }

    previewContinuityRef.current.tick({
      reactorViewOpen,
      synthLive: synthesisRunActive || synthActive,
      previewMounted: reactorPreviewMounted,
      // Pre-synth / coeff edit: никогда не отдаём hide корня continuity-guard'у.
      previewVisible:
        reactorPreviewVisible ||
        (reactorViewOpen && !synthesisRunActive && !synthActive && !showSettledHero),
      previewAtomCount,
      productPrewarm: productPrewarmActive,
      productPainted:
        effectiveProductPainted &&
        !coeffEditingActive &&
        !preSynthesisPreview &&
        (synthesisRunActive || synthActive || showSettledHero),
      previewRootRef,
      invalidate,
    })

    // Жёсткий restore корня каждый кадр в pre-synth / coeff-edit — против залипшего visible=false.
    if (
      reactorViewOpen &&
      !synthesisRunActive &&
      !synthActive &&
      (!showSettledHero || coeffEditingActive) &&
      previewRootRef.current
    ) {
      previewRootRef.current.visible = true
    }

    // На старте синтеза / при edit держим Bohr до paint текущего runId.
    const paintOkForRun = isEffectiveProductPainted({
      productPainted: productPaintedRef.current,
      synthLive: synthesisRunActive || synthActive,
      runId: currentSynthRunId,
      paintedForRunId: paintedForRunIdRef.current,
    })
    const mustShowBohr =
      reactorViewOpen &&
      effectivePreviewTerms != null &&
      effectivePreviewTerms.length >= 1 &&
      !paintOkForRun &&
      (!showSettledHero || coeffEditingActive)
    if (mustShowBohr && previewRootRef.current) {
      previewRootRef.current.visible = true
    } else if (
      reactorViewOpen &&
      (synthesisRunActive || synthActive) &&
      !paintOkForRun &&
      previewRootRef.current
    ) {
      previewRootRef.current.visible = true
    }

    frameHoldRef.current.tick({
      invalidate,
      // Во время +/- не усиливаем hitch лишними invalidate-burst.
      reactorEdit: reactorViewOpen && !synthesisRunActive && !coeffEditingActive,
      synthesisLive: synthesisRunActive || synthActive,
      onMainThreadStall: () => {
        if (reactorViewOpen && !synthesisRunActive && !synthActive) {
          suppressGpuPrewarm()
          if (forceLiteFxRef) forceLiteFxRef.current = true
          synthForceLiteRef.current = true
          return
        }
        suppressGpuPrewarm(1800)
        if (forceLiteFxRef) forceLiteFxRef.current = true
        synthForceLiteRef.current = true
        const floor = 2 as SynthesisQualityLevel
        if (synthQualityLevelRef.current > floor) {
          synthQualityLevelRef.current = floor
          startTransition(() => setSynthQualityLevel(floor))
        }
      },
    })

    if (
      previewMotionLocked &&
      previewAtomCount > 0 &&
      previewAtomCount <= 8 &&
      previewRootRef.current &&
      !synthForceLite
    ) {
      previewRootRef.current.rotation.y += delta * 0.04
    }

    // delta может быть очень большим при сворачивании окна; ограничим.
    const d = Math.min(0.25, Math.max(0.0005, delta))
    const fps = 1 / d
    const a = perfAcc.current
    // EMA сглаживание
    a.fps = a.fps * 0.9 + fps * 0.1

    const perfGuardActive =
      synthActive ||
      synthesisRunActive ||
      (deviceTier === 'low' && reactorViewOpen && !synthesisRunActive)
    if (perfGuardActive) {
      const gov = fpsGovRef.current
      gov.tick(a.fps)
      const nextLevel = gov.qualityLevel
      const nextLite = gov.forceLite
      synthQualityLevelRef.current = nextLevel
      if (forceLiteFxRef) forceLiteFxRef.current = nextLite
      synthForceLiteRef.current = nextLite
      const now = performance.now()
      const levelChanged = synthQualityLevel !== nextLevel
      const downgrade = nextLevel < synthQualityLevel
      // Во время +/- не трогаем React quality — remount/hitch Bohr.
      if (
        !coeffEditingActive &&
        levelChanged &&
        (downgrade || now - qualityUiThrottleRef.current > 480)
      ) {
        qualityUiThrottleRef.current = now
        setSynthQualityLevel(nextLevel)
      }
    }
    a.t += d
    if (a.t < 0.25) return
    a.t = 0
    refineSynthesisDeviceTierFromFps(a.fps)

    if (synthesisRunActive) return
    // Не гоняем perfLevel↔React state в free-lab: лишние ререндеры Canvas без смены DPR.
    if (!reactorViewOpen) return

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

  return (
    <>
      <LabSceneClearSync reactorMode={reactorViewOpen} />
      {/* Не pin'им clear каждый кадр при +/-: это даёт синий кадр без звёзд при hitch. */}
      {reactorBackdrop ? <LabReactorClearColor /> : null}
      {reactorBackdrop ? <LabSynthesisCosmicBackdrop /> : null}
      {reactorBackdrop ? <LabReactorLights /> : null}
      {reactorViewOpen ? (
        <ReactorSceneWarmup reactorOpen={reactorViewOpen} paused={warmupPaused} />
      ) : null}
      {reactorViewOpen && reactorGpuIdleReady ? (
        <ReactorAtomShaderWarmup
          active={
            !effectiveProductPainted &&
            !showSettledHero &&
            !coeffEditingActive &&
            !synthActive &&
            !synthesisRunActive
          }
        />
      ) : null}
      {gpuQueueActive ? (
        <LabSynthesisGpuQueue
          compounds={popularPrewarmCompounds}
          priorityCompound={gpuQueuePriorityCompound}
          active={gpuQueueActive}
        />
      ) : null}

      {!reactorViewOpen ? (
        <>
          <color attach="background" args={[LAB_SCENE_CLEAR_HEX]} />
          <fog attach="fog" args={[LAB_SCENE_CLEAR_HEX, 6, 28]} />
          <Stars radius={100} depth={50} count={900} factor={2.6} saturation={0} fade speed={0.12} />
          <ambientLight intensity={0.22} />
          <directionalLight position={[4, 6, 2]} intensity={0.55} color="#b8c8ff" />
          <group position={[0, 0, 0]}>
            {structureZ != null ? (
              <AtomStructureModel
                key={`structure-${structureZ}`}
                z={structureZ}
                previewEmphasis
                cosmicStyle
                electronFrameSkip={1}
              />
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
          {/* Sticky shell: не unmount при product slot — иначе +/- после синтеза cold remount. */}
          {reactorPreviewMounted && effectivePreviewTerms ? (
            <ReactorTermsPreview
              terms={effectivePreviewTerms}
              visible={reactorPreviewVisible}
              flightActive={previewFlightActive}
              poseLocked={previewPoseLocked}
              sharedLighting={synthActive || synthesisRunActive || preSynthesisPreview}
              forceLite={previewForceLite || editForceLite}
              qualityLevel={synthQualityLevel}
              synthesisGlass={synthQualityFeatures.glassAtoms}
              coeffEditBurst={reactorCoeffEditBurst}
              coeffEditing={coeffEditingActive}
              frameBudgetLite={frameBudgetLite}
              previewOnlyMode={
                !synthesisRunActive &&
                !synthActive &&
                !(
                  showSettledHero &&
                  effectiveProductPainted &&
                  productSlotVisibleResolved &&
                  !coeffEditingActive
                )
              }
              synthHoldPreview={synthHoldPreview}
              lowPower={lowPowerProfile.forceLiteReactor || lowPowerProfile.isMobileSoc}
              productPrewarm={productPrewarmActive}
              atomGroupRefs={previewAtomGroupRefs}
              atomScaleGroupRefs={previewAtomScaleGroupRefs}
              previewRootRef={previewRootRef}
            />
          ) : null}
          {previewActive && transformPreviewCompound ? (
            <TransformPreviewHero compound={transformPreviewCompound} />
          ) : null}
          {synthActive && synthesis && !instantSynthesis ? (
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
              labLiteMode={synthForceLite}
              forceLiteFx={synthForceLite}
              qualityLevel={synthQualityLevel}
              qualityFeatures={synthQualityFeatures}
              visualTier={synthesis.visualTier ?? previewVisualTier}
              timingProfile={synthTimingProfile}
            />
          ) : null}
          {synthActive && synthesis && instantSynthesis ? (
            <InstantLabSynthesis
              runId={synthesis.runId}
              onDone={handleInstantSynthDone}
              onPhaseChange={synthesis.onPhaseChange}
              minFrames={12}
              maxFrames={90}
              isProductReady={instantProductReady}
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

      {/* Resize sync всегда: balance-панель меняет высоту реактора → иначе 0×0 / белый canvas. */}
      <CatalogCanvasResizeSync touchDpr={false} />
      {productForSlot ? (
        <LabProductHeroSlot
          compound={productForSlot}
          visible={productSlotVisibleResolved}
          prewarm={productPrewarmResolved}
          entrance={productSlotEntrance}
          runId={synthesis?.runId ?? 0}
          birthEntrance={false}
          entranceDuration={0}
          shaderCompileAsync={productPrewarmResolved}
          onGpuCompiled={handleProductGpuCompiled}
          onProductVisiblePaint={handleProductVisiblePaint}
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
        target={
          catalogViewMode
            ? CATALOG_HERO_VIEW.target
            : ([REACTOR_PREVIEW_CAMERA.few.target[0], REACTOR_PREVIEW_CAMERA.few.target[1], REACTOR_PREVIEW_CAMERA.few.target[2]] as [
                number,
                number,
                number,
              ])
        }
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
  gpuQueuePriorityCompound = null,
  sessionKey = 0,
  reactorCoeffEditBurst = false,
  reactorCoeffEditing = false,
  reactorGpuIdleReady = false,
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
  gpuQueuePriorityCompound?: CompoundDef | null
  /** Remount Canvas только при webglcontextlost (внутренний sessionKey). */
  sessionKey?: number | string
  reactorCoeffEditBurst?: boolean
  reactorCoeffEditing?: boolean
  reactorGpuIdleReady?: boolean
  synthesis: {
    runId: number
    zSlots: readonly number[]
    flyTerms: readonly ReactorEquationTerm[]
    product: CompoundDef | null
    visualTier?: import('../../chemistry/reactorVisualTier').ReactorVisualTier
    onDone: (kind: 'success' | 'fail') => void
    onSynthesisStageChange?: (stage: 'reactor' | 'substance') => void
    onPhaseChange?: (phase: string, launchProgress: number) => void
  } | null
}) {
  const { t } = useT()
  const [perfLevel, setPerfLevel] = useState<PerfLevel>('high')
  /** Растёт только при hard recovery мёртвого WebGL (белый canvas / битая иконка). */
  const [internalSessionKey, setInternalSessionKey] = useState(0)
  const hardRemountTimerRef = useRef<number | null>(null)
  const coeffEditBurstRef = useRef(reactorCoeffEditBurst ?? false)
  const coeffEditingRef = useRef(reactorCoeffEditing ?? false)
  coeffEditBurstRef.current = reactorCoeffEditBurst ?? false
  coeffEditingRef.current = reactorCoeffEditing ?? false
  const shieldSnapRef = useRef(createShieldSnapshot())
  const softWebglRef = useRef(createSoftWebGlRecovery())
  const canvasKey = `${sessionKey}-${internalSessionKey}`

  useEffect(() => {
    const now = performance.now()
    if (reactorCoeffEditBurst || reactorCoeffEditing) {
      shieldSnapRef.current = bumpShieldOnCoeffEdit(shieldSnapRef.current, now, 24)
    }
    shieldSnapRef.current = tickShieldPhase(shieldSnapRef.current, now)
  }, [reactorCoeffEditBurst, reactorCoeffEditing])

  useEffect(
    () => () => {
      if (hardRemountTimerRef.current != null) {
        window.clearTimeout(hardRemountTimerRef.current)
        hardRemountTimerRef.current = null
      }
    },
    [],
  )

  /** always — demand давал чёрный центр при +/- коэффициентов. */
  const canvasFrameloop = 'always' as const
  const deviceTier = useMemo(() => getSynthesisDeviceTier(), [])
  const canvasPolicy = resolveLabCanvasPolicy({
    deviceTier,
    perfLevel,
    synthesisRunActive: synthesisRunActive ?? false,
    reactorViewOpen: reactorViewOpen ?? false,
    coeffEditBurst: reactorCoeffEditBurst,
    substanceView: laboratorySynthesisView === 'substance',
  })
  const canvasDpr = canvasPolicy.dpr
  const canvasAntialias = canvasPolicy.antialias
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
  const sceneBg = reactorViewOpen ? REACTOR_SCENE_HEX : LAB_SCENE_CLEAR_HEX
  return (
    <CanvasErrorBoundary
      resetKey={canvasKey}
      maxAutoRetry={1}
      fallback={<CanvasSceneErrorFallback />}
    >
      <Canvas
        key={canvasKey}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          background: sceneBg,
        }}
        gl={{
          antialias: canvasAntialias,
          alpha: false,
          powerPreference: 'high-performance',
          // preserveDrawingBuffer выключен всегда: toggling mid-run провоцировал
          // WebGL hitch / красно-чёрный кадр при старте синтеза.
          preserveDrawingBuffer: false,
        }}
        dpr={canvasDpr}
        frameloop={canvasFrameloop}
        onCreated={(state) => {
          softWebglRef.current.reset()
          const bg = hexToColor(sceneBg)
          state.gl.setClearColor(bg, 1)
          state.scene.background = bg
          const canvas = state.gl.domElement
          // Непрозрачный CSS-фон совпадает с clearColor — иначе компоновщик мигает поверх WebGL.
          canvas.style.background = sceneBg
          canvas.style.display = 'block'
          canvas.style.opacity = '1'
          const clearHardTimer = () => {
            if (hardRemountTimerRef.current != null) {
              window.clearTimeout(hardRemountTimerRef.current)
              hardRemountTimerRef.current = null
            }
          }
          const onLost = (e: Event) => {
            e.preventDefault()
            // Спрятать мёртвый белый canvas — виден CSS-starfield под ним.
            canvas.style.opacity = '0'
            softWebglRef.current.onContextLost()
            clearHardTimer()
            hardRemountTimerRef.current = window.setTimeout(() => {
              hardRemountTimerRef.current = null
              if (!softWebglRef.current.shouldHardRemount()) return
              softWebglRef.current.acknowledgeHardRemount()
              setInternalSessionKey((k) => k + 1)
            }, REACTOR_SHIELD.hardRecoverAfterMs)
            state.invalidate()
          }
          const onRestored = () => {
            clearHardTimer()
            canvas.style.opacity = '1'
            canvas.style.background = sceneBg
            softWebglRef.current.onContextRestored(() => state.invalidate())
            state.gl.setClearColor(bg, 1)
            state.scene.background = bg
            const parent = canvas.parentElement
            if (parent) {
              const w = Math.max(2, Math.floor(parent.clientWidth))
              const h = Math.max(2, Math.floor(parent.clientHeight))
              state.gl.setSize(w, h, false)
            }
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
          synthesisPhase={synthesisPhase}
          forceLiteFxRef={forceLiteFxRef}
          prewarmProductCompound={prewarmProductCompound}
          gpuQueuePriorityCompound={gpuQueuePriorityCompound}
          reactorCoeffEditBurst={reactorCoeffEditBurst}
          reactorCoeffEditing={reactorCoeffEditing}
          reactorGpuIdleReady={reactorGpuIdleReady}
        />
      </Canvas>
    </CanvasErrorBoundary>
  )
}
