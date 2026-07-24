import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from 'react'
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
import { SynthesisElementsCollapseFx } from './SynthesisElementsCollapseFx'
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
import { resolveInstantSynthFrameBudget } from '../../lab/synthesisStabilityEngine'
import {
  canHideBohrForProduct,
  isInstantProductScreenReady,
  resolveLab3dFrameRescue,
  isCenterCovered,
  createEmptyCenterFrameCounter,
} from '../../lab/lab3dVisibilityEngine'
import { pinCoeffEditAtomsHard } from '../../lab/coeffEditAtomPin'
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
import { createReactorPreviewContinuityGuard } from '../../lab/reactorPreviewContinuityGuard'
import {
  applyReactorPreviewCamera,
  needsReactorPreviewCameraRescue,
  resolveReactorPreviewCameraPose,
  REACTOR_PREVIEW_CAMERA,
  type ReactorPreviewCameraPose,
} from '../../lab/reactorPreviewCamera'
import { getSynthesisTimingProfile, isInstantSynthesisProfile } from '../../lab/synthesisTimingProfile'
import { PRODUCT_BIRTH_FROM_COLLAPSE_SEC } from '../../lab/synthesisCollapseEffect/elementsCollapseAnimation'
import { LAB_COSMIC_BG } from './LabSynthesisCosmicBackdrop'
import { resolveDeviceSynthesisCap } from '../../perf/graphicsSettings'
import { resolveLabCanvasPolicy } from '../../perf/deviceCanvasPolicy'
import {
  bumpShieldOnCoeffEdit,
  createShieldSnapshot,
  createSoftWebGlRecovery,
  isWebGlDrawingBufferAlive,
  REACTOR_SHIELD,
  shieldAllowsCanvasRemount,
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
  const { camera, invalidate, gl } = useThree()
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
  const emptyCenterCounterRef = useRef(createEmptyCenterFrameCounter())
  const synthActive = synthesis != null
  const previewActive = false
  const previewForceLiteLatchRef = useRef<boolean | null>(null)
  const previewAtomGroupRefs = useRef<(THREE.Group | null)[]>([])
  const previewAtomScaleGroupRefs = useRef<(THREE.Group | null)[]>([])
  const previewRootRef = useRef<THREE.Group | null>(null)
  const productRootGroupRef = useRef<THREE.Group | null>(null)
  const [earlyProductReveal, setEarlyProductReveal] = useState(false)
  const [forceProductSlot, setForceProductSlot] = useState(false)
  const [productRevealReady, setProductRevealReady] = useState(false)
  const [productPainted, setProductPainted] = useState(false)
  /** Ревизия после birth/complete collapse FX. */
  const collapseDoneRunIdRef = useRef(0)
  const [collapseRev, setCollapseRev] = useState(0)
  /** FX ещё fade'ится, пока молекула уже рождается из круга. */
  const [collapseFxLinger, setCollapseFxLinger] = useState(false)
  /** Micro-молекула уже внутри круга (GPU warm) до видимого birth. */
  const [collapseEmbryo, setCollapseEmbryo] = useState(false)
  const collapseLingerTimerRef = useRef(0)
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
    // Во время синтеза — всегда можно.
    if (synthActive || synthesisRunActive) {
      setAllowIdleProductPrewarm(true)
      return
    }
    // До синтеза: если есть явный intent (hover/Run prewarm) и реактор "прогрет" по кадрам,
    // разрешаем idle micro-prewarm. Это ускоряет появление молекулы после Run.
    if (
      reactorGpuIdleReady &&
      reactorViewOpen &&
      !coeffEditingActive &&
      prewarmProductCompound != null
    ) {
      setAllowIdleProductPrewarm(true)
      return
    }
    if (!coeffEditingActive) setAllowIdleProductPrewarm(false)
  }, [
    synthActive,
    synthesisRunActive,
    reactorGpuIdleReady,
    reactorViewOpen,
    coeffEditingActive,
    prewarmProductCompound,
  ])
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
  /** Стабильный target для OrbitControls — без нового tuple каждый render. */
  const reactorOrbitTargetRef = useRef<readonly [number, number, number]>(
    REACTOR_PREVIEW_CAMERA.few.target,
  )
  /** Пользователь крутит орбиту — не форсить hero-позу. */
  const userOrbitingRef = useRef(false)
  /** One-shot stuck rescue после catalog → reactor (не каждый кадр при zoom). */
  const stuckRescueDoneRef = useRef(false)
  const hadPreviewAtomsRef = useRef(false)
  /** Rising-edge: вход в pre-synth → один раз выставить камеру превью. */
  const preSynthCameraArmedRef = useRef(false)
  const lastSynthRunIdRef = useRef(0)

  const synthTimingProfile = useMemo(
    () => getSynthesisTimingProfile(synthForceLite, getSynthesisDeviceTier()),
    [synthForceLite],
  )
  const instantSynthesis = isInstantSynthesisProfile(synthTimingProfile)
  const currentSynthRunIdForCollapse = synthesis?.runId ?? 0
  /**
   * Instant: FX с первого кадра нового runId (без waiting state=false).
   * collapseDoneRunIdRef === runId после onBirthReady (молекула рождается из круга).
   */
  const elementsCollapsePlaying =
    synthActive &&
    instantSynthesis &&
    currentSynthRunIdForCollapse > 0 &&
    collapseDoneRunIdRef.current !== currentSynthRunIdForCollapse
  const showElementsCollapseFx =
    synthActive &&
    instantSynthesis &&
    currentSynthRunIdForCollapse > 0 &&
    (elementsCollapsePlaying || collapseFxLinger)
  void collapseRev

  useLayoutEffect(() => {
    if (!synthActive) {
      collapseDoneRunIdRef.current = 0
      setCollapseFxLinger(false)
      setCollapseEmbryo(false)
      if (collapseLingerTimerRef.current) {
        window.clearTimeout(collapseLingerTimerRef.current)
        collapseLingerTimerRef.current = 0
      }
      return
    }
    if (!instantSynthesis || currentSynthRunIdForCollapse <= 0) return
    // Новый run — сбрасываем linger/embryo, пока birth снова не сработает.
    if (collapseDoneRunIdRef.current !== currentSynthRunIdForCollapse) {
      setCollapseFxLinger(false)
      setCollapseEmbryo(false)
      if (collapseLingerTimerRef.current) {
        window.clearTimeout(collapseLingerTimerRef.current)
        collapseLingerTimerRef.current = 0
      }
    }
    if (collapseDoneRunIdRef.current === currentSynthRunIdForCollapse) return
    synthesis?.onPhaseChange?.('converge', 0.05)
  }, [synthActive, instantSynthesis, currentSynthRunIdForCollapse, synthesis])

  /** Burst: молекула уже внутри круга (GPU warm → видимый зародыш). */
  const handleElementsCollapseEmbryoReady = useCallback(() => {
    setCollapseEmbryo(true)
    setForceProductSlot(true)
    setEarlyProductReveal(true)
    setProductRevealReady(true)
    setAllowIdleProductPrewarm(true)
    synthesis?.onSynthesisStageChange?.('substance')
    invalidate()
  }, [invalidate, synthesis])

  /** Пик круга: молекула растёт из свечения — единое целое, без паузы «круг → пусто». */
  const handleElementsCollapseBirthReady = useCallback(() => {
    if (currentSynthRunIdForCollapse > 0) {
      collapseDoneRunIdRef.current = currentSynthRunIdForCollapse
    }
    setCollapseEmbryo(true)
    setCollapseFxLinger(true)
    setCollapseRev((n) => n + 1)
    setForceProductSlot(true)
    setProductRevealReady(true)
    setEarlyProductReveal(true)
    setAllowIdleProductPrewarm(true)
    synthesis?.onPhaseChange?.('mergeFlash', 0.88)
    synthesis?.onSynthesisStageChange?.('substance')
    invalidate()
  }, [currentSynthRunIdForCollapse, synthesis, invalidate])

  const handleElementsCollapseComplete = useCallback(() => {
    if (collapseDoneRunIdRef.current !== currentSynthRunIdForCollapse) {
      handleElementsCollapseBirthReady()
    }
    // Linger дольше birth GSAP — glow/fade не обрывает молекулу.
    if (collapseLingerTimerRef.current) window.clearTimeout(collapseLingerTimerRef.current)
    collapseLingerTimerRef.current = window.setTimeout(() => {
      setCollapseFxLinger(false)
      collapseLingerTimerRef.current = 0
    }, Math.ceil(PRODUCT_BIRTH_FROM_COLLAPSE_SEC * 1400 + 600))
    startTransition(() => {
      setAllowIdleProductPrewarm(true)
    })
    invalidate()
  }, [currentSynthRunIdForCollapse, handleElementsCollapseBirthReady, invalidate])
  const instantSynthBudget = useMemo(() => {
    const productId = synthesis?.product?.id
    const gpuCompiled = productId != null && isProductGpuCompiled(productId)
    return resolveInstantSynthFrameBudget({ gpuCompiled, deviceTier })
  }, [synthesis?.product?.id, deviceTier])

  /**
   * GPU-prep при синтезе.
   * Embryo/birth/linger: reveal всегда открыт — молекула живёт внутри круга.
   * Не сбрасываем productRevealReady после birthReady (раньше это глушило слот до GPU).
   */
  useLayoutEffect(() => {
    if (!synthActive || !synthesis?.runId) return
    const productId = synthesis.product?.id
    if (productId == null) return
    if (instantSynthesis && elementsCollapsePlaying && !collapseEmbryo) {
      setAllowIdleProductPrewarm(false)
      setForceProductSlot(false)
      setEarlyProductReveal(false)
      setProductRevealReady(false)
      return
    }
    if (instantSynthesis && (collapseEmbryo || collapseFxLinger)) {
      setAllowIdleProductPrewarm(true)
      setForceProductSlot(true)
      setEarlyProductReveal(true)
      setProductRevealReady(true)
      if (isProductGpuCompiled(productId)) {
        prewarmCompoundIdRef.current = productId
        prewarmReadyRef.current = true
        setPrewarmReady(true)
      }
      return
    }
    setAllowIdleProductPrewarm(true)
    setForceProductSlot(true)
    setEarlyProductReveal(true)
    if (isProductGpuCompiled(productId)) {
      prewarmCompoundIdRef.current = productId
      prewarmReadyRef.current = true
      setPrewarmReady(true)
      setProductRevealReady(true)
    } else {
      setProductRevealReady(false)
    }
  }, [
    synthActive,
    synthesis?.runId,
    synthesis?.product?.id,
    instantSynthesis,
    elementsCollapsePlaying,
    collapseEmbryo,
    collapseFxLinger,
  ])

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

  /** Схлопывание атомов УДАЛЕНО — scale 0.06 давал «пропажу» при +/- после синтеза. */
  const fadePreviewAtoms = useCallback(() => {
    setForceProductSlot(true)
    setEarlyProductReveal(true)
    // Никогда не collapse scale — pinCoeffEditAtomsHard держит полный размер.
  }, [])

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
  const warmupPaused =
    !reactorGpuIdleReady || reactorCoeffEditBurst || synthActive || elementsCollapsePlaying

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
    showSettledHero,
  })
  /**
   * Collapse FX + handoff до paint: не pin Bohr (иначе вспышка атомов / white hitch).
   * Для всех продуктов — не зависит от compoundId.
   */
  const suppressBohrPinForCollapseHandoff =
    elementsCollapsePlaying ||
    (synthActive &&
      instantSynthesis &&
      currentSynthRunId > 0 &&
      collapseDoneRunIdRef.current === currentSynthRunId &&
      !effectiveProductPainted)

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
    forceVisibleInGlow:
      instantSynthesis &&
      (collapseFxLinger ||
        (collapseEmbryo &&
          collapseDoneRunIdRef.current === currentSynthRunIdForCollapse)) &&
      // Не форсим full-visible без реального GPU — иначе K₂Cr₂O₇ даёт sync hitch 4–5с.
      (prewarmReadyRef.current ||
        prewarmReady ||
        (synthesis?.product?.id != null && isProductGpuCompiled(synthesis.product.id))),
  })

  const previewMotionLocked = false
  /**
   * GSAP-полёт атомов: нужен flightActive=true, иначе pinCoeff каждый кадр
   * возвращает Bohr на места превью → «анимация пропала».
   * Родитель ставит phase='ignite' при Run, а сцена уже в converge — учитываем ignite.
   */
  const previewFlightActive =
    suppressBohrPinForCollapseHandoff ||
    (synthLive &&
      !suppressBohrPinForCollapseHandoff &&
      (synthesisPhase === 'converge' ||
        synthesisPhase === 'flying' ||
        synthesisPhase === 'ignite' ||
        synthesisPhase === '' ||
        !synthesisPhase))
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
  /**
   * Pre-synth: lite на плотных уравнениях (анти white-screen).
   * Не дёргаем forceLite на edit rising/falling — rememo policy + hitch.
   */
  const editForceLite = preSynthesisPreview
    ? frameBudgetLite ||
      lowPowerProfile.forceLiteReactor ||
      previewAtomCount >= 10
    : (!coeffEditingActive && editLiteLatchRef.current) ||
      (!coeffEditingActive && reactorCoeffEditBurst) ||
      frameBudgetLite ||
      lowPowerProfile.forceLiteReactor ||
      previewAtomCount >= 10
  const reactorPreviewMounted =
    continuity.reactorPreviewMounted ||
    (reactorViewOpen && effectivePreviewTerms != null && effectivePreviewTerms.length >= 1)
  /** Pre-synth: всегда показываем Bohr, даже если continuity на кадр сказала false. */
  const reactorPreviewVisible =
    preSynthesisPreview || continuity.reactorPreviewVisible || coeffEditingActive
  const productSlotVisible = continuity.productSlotVisible
  const productPrewarmActive = continuity.productPrewarm
  /**
   * Embryo (до birthReady): зародыш внутри круга — visible после GPU, иначе micro-compile.
   * Birth/linger: всегда visible (круг ещё светит / linger), без GPU-дыры «пусто → pop».
   */
  const productEmbryoOnly =
    instantSynthesis &&
    elementsCollapsePlaying &&
    collapseEmbryo &&
    collapseDoneRunIdRef.current !== currentSynthRunIdForCollapse
  const productGlowHandoff =
    instantSynthesis &&
    (collapseFxLinger ||
      (collapseEmbryo &&
        collapseDoneRunIdRef.current === currentSynthRunIdForCollapse))
  const productSlotVisibleResolved = productEmbryoOnly
    ? productSlotView.gpuReady
    : productGlowHandoff
      ? productSlotView.gpuReady
      : elementsCollapsePlaying && !collapseEmbryo
        ? false
        : productSlotView.visible
  const productPrewarmResolved = productEmbryoOnly
    ? !productSlotView.gpuReady
    : productGlowHandoff
      ? !productSlotView.gpuReady
      : elementsCollapsePlaying && !collapseEmbryo
        ? false
        : productSlotView.prewarm
  const showProductDuringCollapse =
    Boolean(productForSlot) &&
    (!elementsCollapsePlaying || collapseEmbryo || collapseFxLinger)
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
      // Только реальный paint — без него не закрываем run (иначе toast + пустой центр).
      const readyNow = () => isInstantProductScreenReady(productPaintedRef.current)
      if (readyNow()) {
        synthesis.onDone(kind)
        return
      }
      setProductRevealReady(true)
      setForceProductSlot(true)
      let frames = 0
      const maxWait = 180
      const tick = () => {
        frames += 1
        if (readyNow()) {
          synthesis.onDone(kind)
          return
        }
        // Force full-scale nudge while waiting — но не во время birth из круга.
        const g = productRootGroupRef.current
        const birthBusy =
          collapseLingerTimerRef.current !== 0 ||
          (g != null && g.scale.x > 0.02 && g.scale.x < 0.92)
        if (g && g.scale.x < 0.86 && !birthBusy) {
          g.scale.set(1, 1, 1)
          invalidate()
        }
        if (frames >= maxWait) {
          // Последний шанс: завершаем, Bohr остаётся пока paint не придёт / rescue.
          synthesis.onDone(kind)
          return
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    },
    [synthesis, invalidate],
  )

  const handleInstantSynthStuck = useCallback(() => {
    setProductRevealReady(true)
    setForceProductSlot(true)
    setEarlyProductReveal(true)
    // Не snap к 1 во время birth из круга — иначе «зависание → pop».
    if (collapseFxLinger || collapseEmbryo) {
      invalidate()
      return
    }
    const g = productRootGroupRef.current
    if (g) {
      g.scale.set(1, 1, 1)
      invalidate()
    }
  }, [invalidate, collapseFxLinger, collapseEmbryo])

  const instantProductReady = useCallback(() => {
    return isInstantProductScreenReady(productPaintedRef.current)
  }, [])

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
    // Любой кадр edit ИЛИ rising/falling — восстановить Bohr (не только edge).
    if (!coeffEditingActive && !rising && !falling) return

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
    // Убить GSAP collapse со синтеза — иначе атомы «пропали» при +/-.
    for (let i = 0; i < Math.max(n, previewAtomScaleGroupRefs.current.length); i++) {
      const sc = previewAtomScaleGroupRefs.current[i]
      if (sc) gsap.killTweensOf(sc.scale)
      const g = previewAtomGroupRefs.current[i]
      if (g) gsap.killTweensOf(g)
    }
    pinCoeffEditAtomsHard({
      slotCount: n,
      layoutScale: scaleFloor,
      root,
      atomGroupRefs: previewAtomGroupRefs,
      atomScaleGroupRefs: previewAtomScaleGroupRefs,
    })
    if (falling || rising) invalidate()
  }, [coeffEditingActive, synthActive, synthesisRunActive, invalidate, previewTermsSig])

  /** Смена коэффициентов / terms — сразу pin, не ждать rising edge editing. */
  useLayoutEffect(() => {
    if (synthActive || synthesisRunActive) return
    if (!reactorViewOpen || !preSynthesisPreview) return
    const n = Math.max(0, previewAtomCountRef.current)
    if (n <= 0) return
    const root = previewRootRef.current
    if (root) root.visible = true
    for (let i = 0; i < n; i++) {
      const sc = previewAtomScaleGroupRefs.current[i]
      if (sc) gsap.killTweensOf(sc.scale)
    }
    pinCoeffEditAtomsHard({
      slotCount: n,
      layoutScale: reactorPreviewAtomScale(n),
      root,
      atomGroupRefs: previewAtomGroupRefs,
      atomScaleGroupRefs: previewAtomScaleGroupRefs,
    })
  }, [
    previewTermsSig,
    reactorViewOpen,
    preSynthesisPreview,
    synthActive,
    synthesisRunActive,
  ])

  const restorePreviewRootVisibility = useCallback(() => {
    const root = previewRootRef.current
    if (!root) return
    root.visible = true
  }, [])

  useLayoutEffect(() => {
    if (coeffEditingActive) return
    if (preSynthesisPreview) return
    const scaleX = productRootGroupRef.current?.scale.x
    // Жёсткий gate: Bohr гасим только когда молекула full-scale на экране.
    if (
      !canHideBohrForProduct({
        productPainted: effectiveProductPainted,
        slotVisible: productSlotVisibleResolved,
        prewarm: productPrewarmResolved,
        coeffEditing: coeffEditingActive,
        preSynthesis: preSynthesisPreview,
        scaleX,
      })
    ) {
      return
    }
    const root = previewRootRef.current
    if (!root) return
    root.visible = false
  }, [
    effectiveProductPainted,
    productSlotVisibleResolved,
    productPrewarmResolved,
    coeffEditingActive,
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
      // Instant collapse: не форсим product до конца FX (анти white hitch).
      if (!(instantSynthesis && elementsCollapsePlaying)) {
        setForceProductSlot(true)
        setEarlyProductReveal(true)
      } else {
        setForceProductSlot(false)
        setEarlyProductReveal(false)
      }
      restorePreviewRootVisibility()
      const productId = synthesis?.product?.id
      const gpuReadyNow =
        productId != null &&
        (isProductGpuCompiled(productId) ||
          ((prewarmReadyRef.current || prewarmReady) && prewarmCompoundIdRef.current === productId))
      setProductRevealReady(
        Boolean(gpuReadyNow) && !(instantSynthesis && elementsCollapsePlaying),
      )
      return
    }
    const productId = synthesis?.product?.id
    const gpuReady =
      productId != null &&
      ((prewarmReadyRef.current || prewarmReady) &&
        prewarmCompoundIdRef.current === productId)
    if (gpuReady || (productId != null && isProductGpuCompiled(productId))) {
      if (!(instantSynthesis && elementsCollapsePlaying)) {
        setProductRevealReady(true)
      }
      return
    }
  }, [
    synthActive,
    synthesis?.runId,
    synthesis?.product?.id,
    prewarmReady,
    synthesisRunActive,
    restorePreviewRootVisibility,
    instantSynthesis,
    elementsCollapsePlaying,
  ])

  // Когда prewarm завершился уже во время синтеза — сразу показываем продукт.
  useEffect(() => {
    if (!synthActive || !synthesis?.runId || productRevealReady) return
    if (elementsCollapsePlaying) return
    const productId = synthesis.product?.id
    if (productId == null) return
    if (
      (prewarmReady && prewarmCompoundIdRef.current === productId) ||
      isProductGpuCompiled(productId)
    ) {
      setProductRevealReady(true)
    }
  }, [
    synthActive,
    synthesis?.runId,
    synthesis?.product?.id,
    prewarmReady,
    productRevealReady,
    elementsCollapsePlaying,
  ])

  // Fallback productReveal: не форсим во время collapse FX.
  useEffect(() => {
    if (!synthActive || !synthesis?.runId || productRevealReady) return
    if (elementsCollapsePlaying) return
    const productId = synthesis.product?.id
    let frames = 0
    let raf = 0
    const cap = instantSynthesis ? instantSynthBudget.revealMaxFrames * 4 : instantSynthBudget.revealMaxFrames * 2
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
  }, [
    synthActive,
    synthesis?.runId,
    synthesis?.product?.id,
    productRevealReady,
    instantSynthesis,
    instantSynthBudget.revealMaxFrames,
    elementsCollapsePlaying,
  ])

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
    if (elementsCollapsePlaying) return
    setForceProductSlot(true)
    setEarlyProductReveal(true)
  }, [synthActive, synthesis?.runId, elementsCollapsePlaying])

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
    synthesis?.onSynthesisStageChange?.('substance')
  }, [synthesis])

  const previewForceLite =
    (synthActive || synthesisRunActive) && previewForceLiteLatchRef.current !== null
      ? previewForceLiteLatchRef.current
      : synthForceLite

  assertNoProductHeroBeforeRun(
    synthesis?.runId ?? 0,
    productSlotVisible && !showSettledHero,
    transformPreviewCompound != null,
  )
  /** Birth GSAP с birthReady (пока круг ещё на экране), не после dispose glow. */
  const productBirthActive =
    instantSynthesis &&
    synthActive &&
    !showSettledHero &&
    (productGlowHandoff || (!elementsCollapsePlaying && collapseEmbryo))
  const productSlotEntrance: 'smooth' | 'none' | 'instant' =
    showSettledHero && !synthActive
      ? 'none'
      : productBirthActive || productEmbryoOnly
        ? 'smooth'
        : instantSynthesis || synthActive
          ? 'instant'
          : 'smooth'

  /** Фон реактора с первого кадра после «Синтез» — без чёрного провала и ghost-frame. */
  const reactorBackdrop = reactorViewOpen

  /** Каталожный кадр: только settled + full-scale paint — иначе Bohr «за кадром». */
  const productTrulyOwnsScreen =
    showSettledHero &&
    effectiveProductPainted &&
    productSlotVisibleResolved &&
    !productPrewarmResolved &&
    !coeffEditingActive

  /** Bohr гасим сразу, как только молекула full-scale (и при settle, и в конце run). */
  const hideBohrForProduct =
    !coeffEditingActive &&
    !preSynthesisPreview &&
    effectiveProductPainted &&
    productSlotVisibleResolved &&
    !productPrewarmResolved &&
    (showSettledHero || synthActive || synthesisRunActive)

  const catalogViewMode = previewActive || productTrulyOwnsScreen

  /**
   * Ракурс превью: при первом появлении / выходе из catalog / входе в pre-synth.
   * На каждом +/- только обновляем «домашнюю» позу — орбиту не замораживаем
   * (дальше useFrame ловит «камеру далеко от позы» → чёрный центр).
   */
  // eslint-disable-next-line react-hooks/immutability
  useLayoutEffect(() => {
    const leftCatalog = catalogViewModePrevRef.current && !catalogViewMode
    catalogViewModePrevRef.current = catalogViewMode
    if (catalogViewMode) return
    if (previewAtomCount <= 0) {
      if (!reactorViewOpen) hadPreviewAtomsRef.current = false
      return
    }

    const { pose, manyAtoms } = resolveReactorPreviewCameraPose(
      previewAtomCount,
      manyAtomsCameraRef.current,
    )
    manyAtomsCameraRef.current = manyAtoms
    reactorCameraLockPoseRef.current = pose
    reactorOrbitTargetRef.current = pose.target

    const firstAtoms = !hadPreviewAtomsRef.current
    hadPreviewAtomsRef.current = true
    const enteredPreSynth =
      preSynthesisPreview && !preSynthCameraArmedRef.current
    if (preSynthesisPreview) preSynthCameraArmedRef.current = true
    else preSynthCameraArmedRef.current = false

    if (leftCatalog || enteredPreSynth) stuckRescueDoneRef.current = false
    const needPose = leftCatalog || firstAtoms || enteredPreSynth
    if (!needPose) return
    if (userOrbitingRef.current && !leftCatalog && !firstAtoms && !enteredPreSynth) return

    const cam = camera as THREE.PerspectiveCamera
    applyReactorPreviewCamera(cam, orbRef.current, pose)
    reactorCameraLockUntilRef.current = performance.now() + REACTOR_PREVIEW_CAMERA.lockMs
    invalidate()

    const orb = orbRef.current
    const t = window.setTimeout(() => {
      if (userOrbitingRef.current && !leftCatalog && !enteredPreSynth) return
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
    reactorViewOpen,
    preSynthesisPreview,
  ])

  useLayoutEffect(() => {
    if (catalogViewMode) stuckRescueDoneRef.current = false
  }, [catalogViewMode])

  useLayoutEffect(() => {
    if (!reactorViewOpen || catalogViewMode) return
    stuckRescueDoneRef.current = false
    emptyCenterCounterRef.current.resetEpisode()
  }, [previewTermsSig, reactorViewOpen, catalogViewMode])

  /** Pointer → сразу отпустить camera lock, чтобы можно было крутить и разглядеть. */
  useEffect(() => {
    const el = gl.domElement
    const onDown = () => {
      userOrbitingRef.current = true
      reactorCameraLockUntilRef.current = 0
    }
    const onUp = () => {
      userOrbitingRef.current = false
    }
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
    }
  }, [gl])

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

    // Краткий hold hero-ракурса; pointerdown сразу отпускает — можно крутить.
    const lockPose = reactorCameraLockPoseRef.current
    const lockActive =
      lockPose != null &&
      !catalogViewMode &&
      !synthActive &&
      !synthesisRunActive &&
      !userOrbitingRef.current &&
      performance.now() < reactorCameraLockUntilRef.current
    if (lockActive && lockPose) {
      applyReactorPreviewCamera(camera as THREE.PerspectiveCamera, orbRef.current, lockPose)
    } else if (
      lockPose &&
      !catalogViewMode &&
      !synthActive &&
      !synthesisRunActive &&
      !userOrbitingRef.current &&
      !stuckRescueDoneRef.current &&
      previewAtomCount > 0 &&
      needsReactorPreviewCameraRescue({
        position: camera.position,
        pose: lockPose,
        catalogPosition: CATALOG_HERO_VIEW.cameraPosition,
      })
    ) {
      // One-shot: catalog hero / far pose после settle → иначе Bohr «за кадром» (чёрный центр).
      applyReactorPreviewCamera(camera as THREE.PerspectiveCamera, orbRef.current, lockPose)
      stuckRescueDoneRef.current = true
      reactorCameraLockUntilRef.current =
        performance.now() + REACTOR_PREVIEW_CAMERA.stuckRescueMs
      invalidate()
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
        synthesisRunActive || synthActive || reactorViewOpen,
        {
          preview: reactorPreviewVisible && reactorPreviewMounted,
          // micro-prewarm НЕ coverage — иначе пустой центр не ловится.
          product: productSlotVisibleResolved && !productPrewarmResolved,
          mergeFx: synthesisPhase === 'mergeFlash',
          convergeFx:
            elementsCollapsePlaying ||
            synthesisPhase === 'converge' ||
            synthesisPhase === 'ignite' ||
            synthesisPhase === 'flying',
          cosmicFx: false,
        },
        () => {
          const editMode = reactorViewOpen && !synthesisRunActive && !synthActive
          if (previewRootRef.current && (editMode || !productSlotVisibleResolved || productPrewarmResolved)) {
            previewRootRef.current.visible = true
            invalidate()
          }
          const g = productRootGroupRef.current
          if (g && (showSettledHero || synthActive || synthesisRunActive) && productSlotVisibleResolved) {
            if (g.scale.x < 0.86) g.scale.set(1, 1, 1)
            invalidate()
          }
          if (synthesisPhase === 'mergeFlash' || synthesisPhase === 'product') {
            setForceProductSlot(true)
            setProductRevealReady(true)
          }
        },
      )
    }

    const continuityProductId =
      synthesisSettledProduct?.id ?? synthesis?.product?.id ?? null
    void continuityProductId

    // Единый gate hide Bohr — ДО continuity (иначе painted без full-scale гасит корень).
    const productScreenOkEarly = canHideBohrForProduct({
      productPainted: productPaintedRef.current,
      slotVisible: productSlotVisibleResolved,
      prewarm: productPrewarmResolved,
      coeffEditing: coeffEditingActive,
      preSynthesis: preSynthesisPreview,
      scaleX: productRootGroupRef.current?.scale.x,
    })

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
        productSlotVisibleResolved &&
        !productPrewarmResolved &&
        !coeffEditingActive &&
        !preSynthesisPreview &&
        (synthesisRunActive || synthActive || showSettledHero),
      productOwnsScreen: productScreenOkEarly,
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

    // Каждый кадр пока продукт НЕ владеет экраном: полный scale атомов.
    // Во время elements-collapse pin запрещён — анимация сама двигает слоты.
    const productScreenOk = productScreenOkEarly
    if (
      reactorViewOpen &&
      !productScreenOk &&
      !suppressBohrPinForCollapseHandoff &&
      previewAtomCount > 0 &&
      (coeffEditingActive ||
        preSynthesisPreview ||
        synthHoldPreview ||
        (showSettledHero && !productSlotVisibleResolved))
    ) {
      pinCoeffEditAtomsHard({
        slotCount: previewAtomCount,
        layoutScale: reactorPreviewAtomScale(previewAtomCount),
        root: previewRootRef.current,
        atomGroupRefs: previewAtomGroupRefs,
        atomScaleGroupRefs: previewAtomScaleGroupRefs,
        killScaleTweens: (s) => gsap.killTweensOf(s),
      })
    }

    // Lab3DVisibilityEngine: rescue пустого центра (оба бага со скринов).
    const productScaleX = productRootGroupRef.current?.scale.x
    const rescue = resolveLab3dFrameRescue({
      reactorOpen: reactorViewOpen,
      hasPreviewTerms: effectivePreviewTerms != null && effectivePreviewTerms.length >= 1,
      coeffEditing: coeffEditingActive,
      preSynthesis: preSynthesisPreview,
      synthLive: synthesisRunActive || synthActive,
      showSettledHero,
      productPainted: productPaintedRef.current,
      productSlotVisible: productSlotVisibleResolved,
      productPrewarm: productPrewarmResolved,
      productScaleX,
    })
    if (rescue.invalidatePaint && productPaintedRef.current) {
      productPaintedRef.current = false
      paintedForRunIdRef.current = 0
      setProductPainted(false)
    }
    if (rescue.forceBohrRootVisible && !productScreenOk && previewRootRef.current) {
      previewRootRef.current.visible = true
    }
    if (rescue.forceProductFullScale && !productBirthActive) {
      const g = productRootGroupRef.current
      if (g && g.scale.x < 0.86) {
        gsap.killTweensOf(g.scale)
        g.scale.set(1, 1, 1)
        invalidate()
      }
    }

    // Порог emptyCenterRescueFrames: дополнительный nudge если центр пуст.
    // Не restore Bohr, если молекула уже full-scale на экране.
    const centerOk =
      suppressBohrPinForCollapseHandoff ||
      collapseFxLinger ||
      isCenterCovered({
        bohrVisible:
          !productScreenOk &&
          (reactorPreviewVisible || rescue.forceBohrRootVisible) &&
          (previewRootRef.current?.visible !== false),
        bohrMounted: reactorPreviewMounted,
        productSlotVisible: productSlotVisibleResolved,
        productPrewarm: productPrewarmResolved,
      })
    if (emptyCenterCounterRef.current.tick(centerOk)) {
      // НЕ сбрасываем stuckRescueDone каждый empty-кадр — это был thrash камеры → hitch.
      if (!productScreenOk && rescue.keepBohrUntilPaint && previewRootRef.current) {
        previewRootRef.current.visible = true
      }
      if ((showSettledHero || synthActive || synthesisRunActive) && productRootGroupRef.current) {
        const g = productRootGroupRef.current
        if (g.scale.x < 0.86) g.scale.set(1, 1, 1)
        setForceProductSlot(true)
        setProductRevealReady(true)
      }
      // Один camera rescue за streak (счётчик rising-edge).
      if (
        preSynthesisPreview &&
        previewAtomCount > 0 &&
        !userOrbitingRef.current &&
        !stuckRescueDoneRef.current &&
        reactorCameraLockPoseRef.current
      ) {
        applyReactorPreviewCamera(
          camera as THREE.PerspectiveCamera,
          orbRef.current,
          reactorCameraLockPoseRef.current,
        )
        stuckRescueDoneRef.current = true
        if (previewRootRef.current) previewRootRef.current.visible = true
        if (!suppressBohrPinForCollapseHandoff) {
          pinCoeffEditAtomsHard({
            slotCount: previewAtomCount,
            layoutScale: reactorPreviewAtomScale(previewAtomCount),
            root: previewRootRef.current,
            atomGroupRefs: previewAtomGroupRefs,
            atomScaleGroupRefs: previewAtomScaleGroupRefs,
            killScaleTweens: (s) => gsap.killTweensOf(s),
          })
        }
      }
      invalidate()
    }

    // На старте синтеза / при edit держим Bohr до paint текущего runId.
    const paintOkForRun = isEffectiveProductPainted({
      productPainted: productPaintedRef.current,
      synthLive: synthesisRunActive || synthActive,
      runId: currentSynthRunId,
      paintedForRunId: paintedForRunIdRef.current,
      showSettledHero,
    })
    const productScreenOkForHide = canHideBohrForProduct({
      productPainted: paintOkForRun,
      slotVisible: productSlotVisibleResolved,
      prewarm: productPrewarmResolved,
      coeffEditing: coeffEditingActive,
      preSynthesis: preSynthesisPreview,
      scaleX: productRootGroupRef.current?.scale.x,
    })
    const mustShowBohr =
      reactorViewOpen &&
      effectivePreviewTerms != null &&
      effectivePreviewTerms.length >= 1 &&
      !productScreenOkForHide &&
      (!showSettledHero || coeffEditingActive || rescue.keepBohrUntilPaint)
    if (mustShowBohr && previewRootRef.current) {
      previewRootRef.current.visible = true
    } else if (productScreenOkForHide && previewRootRef.current && !coeffEditingActive) {
      // Молекула владеет экраном — не restore Bohr (иначе хаос орбит поверх K₂Cr₂O₇).
      previewRootRef.current.visible = false
    } else if (
      reactorViewOpen &&
      (synthesisRunActive || synthActive) &&
      !productScreenOkForHide &&
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
      // Во время +/- / collapse FX не трогаем React quality — remount/hitch Bohr.
      if (
        !coeffEditingActive &&
        !elementsCollapsePlaying &&
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
      {reactorBackdrop ? (
        <LabSynthesisCosmicBackdrop
          lite={
            // В реакторе всегда lite Stars — full 900 + Bohr/молекула = hitch / white-screen.
            true
          }
          frozen={synthActive || synthesisRunActive || showElementsCollapseFx}
        />
      ) : null}
      {reactorBackdrop ? <LabReactorLights /> : null}
      {reactorViewOpen ? (
        <ReactorSceneWarmup reactorOpen={reactorViewOpen} paused={warmupPaused} />
      ) : null}
      {reactorViewOpen && reactorGpuIdleReady ? (
        <ReactorAtomShaderWarmup
          active={
            // Не греть 8 Bohr параллельно с живым уравнением — dichromate + warmup = white-screen.
            previewAtomCount <= 0 &&
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
          <Stars radius={100} depth={50} count={420} factor={2.4} saturation={0} fade speed={0.12} />
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
              // После paint/settle Bohr обязан быть скрыт — иначе орбиты поверх молекулы.
              visible={
                !hideBohrForProduct &&
                (reactorPreviewVisible ||
                  preSynthesisPreview ||
                  coeffEditingActive ||
                  synthHoldPreview)
              }
              synthHoldPreview={synthHoldPreview && !hideBohrForProduct}
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
          {synthActive && synthesis && instantSynthesis && showElementsCollapseFx ? (
            <SynthesisElementsCollapseFx
              key={`collapse-${synthesis.runId}`}
              runId={synthesis.runId}
              atomGroupRefs={previewAtomGroupRefs}
              atomCount={previewAtomCount}
              densePreview={previewAtomCount >= 10}
              lowPower={
                // Только реально слабое устройство — synthForceLite резал FX до «лего».
                lowPowerProfile.forceLiteReactor || lowPowerProfile.isMobileSoc
              }
              accentHex={synthesis.product?.accentColor}
              onEmbryoReady={handleElementsCollapseEmbryoReady}
              onBirthReady={handleElementsCollapseBirthReady}
              onComplete={handleElementsCollapseComplete}
            />
          ) : null}
          {synthActive && synthesis && instantSynthesis && !elementsCollapsePlaying ? (
            <InstantLabSynthesis
              runId={synthesis.runId}
              onDone={handleInstantSynthDone}
              onPhaseChange={synthesis.onPhaseChange}
              onStuck={handleInstantSynthStuck}
              minFrames={instantSynthBudget.minFrames}
              maxFrames={instantSynthBudget.maxFrames}
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
      {showProductDuringCollapse ? (
        <LabProductHeroSlot
          compound={productForSlot!}
          visible={productSlotVisibleResolved}
          prewarm={productPrewarmResolved}
          entrance={productSlotEntrance}
          runId={synthesis?.runId ?? lastSynthRunIdRef.current}
          birthEntrance={productBirthActive}
          entranceDuration={
            productBirthActive || productEmbryoOnly ? PRODUCT_BIRTH_FROM_COLLAPSE_SEC : 0
          }
          shaderCompileAsync={productPrewarmResolved}
          onGpuCompiled={handleProductGpuCompiled}
          onProductVisiblePaint={handleProductVisiblePaint}
          rootGroupRef={productRootGroupRef}
          emergeFromGlow={
            productBirthActive || collapseFxLinger || productEmbryoOnly || productGlowHandoff
          }
          embryoInGlow={productEmbryoOnly && productSlotVisibleResolved}
        />
      ) : null}
      <OrbitControls
        ref={orbRef}
        makeDefault
        enablePan={false}
        enableRotate={!synthActive && !synthesisRunActive}
        enableZoom={!catalogViewMode && !synthActive && !synthesisRunActive}
        // Во время pre-synth можно свободно крутить; damping чуть живее для осмотра.
        minDistance={catalogViewMode ? CATALOG_HERO_VIEW.minDistance : LAB_ORBIT.minDistance}
        maxDistance={catalogViewMode ? CATALOG_HERO_VIEW.maxDistance : LAB_ORBIT.maxDistance}
        minPolarAngle={catalogViewMode ? CATALOG_HERO_VIEW.minPolarAngle : LAB_ORBIT.minPolarAngle}
        maxPolarAngle={catalogViewMode ? CATALOG_HERO_VIEW.maxPolarAngle : LAB_ORBIT.maxPolarAngle}
        target={
          catalogViewMode ? CATALOG_HERO_VIEW.target : reactorOrbitTargetRef.current
        }
        enableDamping={LAB_ORBIT.enableDamping}
        dampingFactor={LAB_ORBIT.dampingFactor}
      />
    </>
  )
}

function LabCanvasImpl({
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
            // НЕ opacity=0 (белый/пустой экран). Держим тёмный CSS + soft recover.
            canvas.style.opacity = '1'
            canvas.style.background = sceneBg
            softWebglRef.current.onContextLost()
            clearHardTimer()
            const editingNow =
              coeffEditBurstRef.current || coeffEditingRef.current
            hardRemountTimerRef.current = window.setTimeout(() => {
              hardRemountTimerRef.current = null
              const now = performance.now()
              const alive = isWebGlDrawingBufferAlive(state.gl)
              const glDead = !alive
              // Мёртвый GL: один remount после ban. Живой — только soft (без remount thrash).
              if (!glDead && !softWebglRef.current.shouldHardRemount(now)) return
              if (
                !shieldAllowsCanvasRemount(
                  shieldSnapRef.current,
                  now,
                  editingNow,
                  glDead,
                )
              ) {
                return
              }
              softWebglRef.current.acknowledgeHardRemount()
              setInternalSessionKey((k) => k + 1)
            }, REACTOR_SHIELD.hardRecoverAfterMs)
            state.invalidate()
          }
          const onRestored = () => {
            const parent = canvas.parentElement
            if (parent) {
              const w = Math.max(2, Math.floor(parent.clientWidth))
              const h = Math.max(2, Math.floor(parent.clientHeight))
              if (w >= 8 && h >= 8) state.gl.setSize(w, h, false)
            }
            state.gl.setClearColor(bg, 1)
            state.scene.background = bg
            canvas.style.background = sceneBg
            // Всегда opacity=1 — даже фейковый restored не даёт белый экран.
            canvas.style.opacity = '1'
            const alive = isWebGlDrawingBufferAlive(state.gl)
            const ok = softWebglRef.current.onContextRestored(() => state.invalidate(), alive)
            if (ok) clearHardTimer()
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

export const LabCanvas = memo(LabCanvasImpl)
