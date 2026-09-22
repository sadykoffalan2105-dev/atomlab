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
import { OrbitControls, DragControls } from '@react-three/drei'
import { gsap } from 'gsap'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { DecorativeAtom } from './DecorativeAtom'
import { AtomStructureModel } from './AtomStructureModel'
import { MoleculeMesh } from './MoleculeMesh'
import { SynthesisOnLabScene } from './SynthesisOnLabScene'
import { SynthesisElementsCollapseFx } from './SynthesisElementsCollapseFx'
import { setCinemaActive } from '../../lab/cinemaActive'
import { clo2StepStore } from '../../lab/cinema/scenes/clo2/clo2StepStore'
import { InstantLabSynthesis } from './InstantLabSynthesis'
import { getScientificSynthesisFx, hasScientificSynthesisFx } from '../../lab/scientificSynthesis/registry'
import { LabProductHeroSlot } from './LabProductHeroSlot'
import { LabSynthesisCosmicBackdrop } from './LabSynthesisCosmicBackdrop'
import { LabIdleCosmicBackdrop, LAB_IDLE_COSMIC_BG } from './LabIdleCosmicBackdrop'
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
import { ProductHero } from './hero/ProductHero'
import { heroFrameGeometry, measureHeroFrame } from './hero/heroFrame'
import { CatalogCanvasResizeSync } from './CatalogCanvasResizeSync'
import { ReactorTermsPreview } from './ReactorTermsPreview'
import {
  ScientificReactorStage,
  type ScientificReactorStageLabels,
} from './scientific/ScientificReactorStage'
import type { StageCoProduct } from './scientific/scientificReactorStageLayout'

export type ScientificStageInput = {
  leftTerms: readonly ReactorEquationTerm[]
  coProducts: readonly StageCoProduct[]
  productId: string
  productCoeff: number
  balanced: boolean
  labels?: ScientificReactorStageLabels
}
import { reactorPreviewAtomScale } from './reactorPreviewLayout'
import {
  getSynthesisDeviceClassification,
  getSynthesisDeviceTier,
  refineSynthesisDeviceTierFromFps,
} from '../../lab/synthesisDeviceTier'
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
  type SynthesisCoverage,
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
import { LabPerfProbe } from './LabPerfProbe'
import { isPerfProbeEnabled } from '../../lab/perf/labPerfProbe'
import { LabSynthesisGpuQueue } from './LabSynthesisGpuQueue'

/** Свободная лаборатория — фиолетовый космос (LabIdleCosmicBackdrop). */
const LAB_SCENE_CLEAR_HEX = LAB_IDLE_COSMIC_BG
/** Реактор / синтез / каталожный кадр — фон через LabSynthesisCosmicBackdrop. */
const REACTOR_SCENE_HEX = '#0a0818'

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

/** Модульная функция вместо стрелки в кадре — ноль аллокаций в useFrame. */
function killScaleTweens(scale: THREE.Vector3): void {
  gsap.killTweensOf(scale)
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
  // Выбранный продукт до запуска — тот же герой, что после синтеза (решётка/молекула по данным, без ауры).
  return <ProductHero compound={compound} showLabels />
}

/** Базовое смещение камеры каталожного кадра относительно цели. */
const CATALOG_HERO_OFFSET_Y =
  CATALOG_HERO_VIEW.cameraPosition[1] - CATALOG_HERO_VIEW.target[1]
const CATALOG_HERO_OFFSET_Z =
  CATALOG_HERO_VIEW.cameraPosition[2] - CATALOG_HERO_VIEW.target[2]
const CATALOG_HERO_RADIUS = Math.hypot(CATALOG_HERO_OFFSET_Y, CATALOG_HERO_OFFSET_Z)
export type CatalogHeroFrame = {
  /** Цель камеры по X: центр свободной области левее/правее центра канвы (панель урока, карточка). */
  targetX: number
  /** Цель камеры по Y: ниже нуля — модель поднимается над доком реактора. */
  targetY: number
  /** Радиус орбиты: свободная область меньше канвы → камера отходит. */
  radius: number
}

const CATALOG_HERO_FRAME_BASE: CatalogHeroFrame = {
  targetX: CATALOG_HERO_VIEW.target[0],
  targetY: CATALOG_HERO_VIEW.target[1],
  radius: CATALOG_HERO_RADIUS,
}

/**
 * Кадр героя продукта по СВОБОДНОЙ области канвы (hero/heroFrame): та же measureSafeArea, что у
 * сцен (верхние пилюли, реактор, панель урока слева или снизу), плюс карточка продукта. Цель —
 * по X и Y, расстояние — по описанной сфере героя вместе с подписями. Раньше учитывался только
 * нижний док и только Y: на телефоне низ модели уходил под панель, а подпись — под тулбар.
 */
function measureCatalogHeroFrame(
  canvas: HTMLCanvasElement | null,
  compoundId: string | null | undefined,
): CatalogHeroFrame {
  const f = measureHeroFrame(canvas, heroFrameGeometry(compoundId), CATALOG_HERO_VIEW.fov, CATALOG_HERO_RADIUS)
  if (!f) return CATALOG_HERO_FRAME_BASE
  return { targetX: CATALOG_HERO_VIEW.target[0] + f.targetX, targetY: CATALOG_HERO_VIEW.target[1] + f.targetY, radius: f.radius }
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
  teacherMode = false,
  onNarrationCue,
  scientificStage = null,
  onResolutionScaleChange,
}: {
  particles: readonly LabParticle[]
  onParticleMove: (id: string, pos: Vec3) => void
  structureZ: number | null
  onInspectAtom?: (z: number) => void
  synthesisRunActive?: boolean
  /** Научный маршрут (ClO₂): до запуска — реагенты и продукты формульными единицами. */
  scientificStage?: ScientificStageInput | null
  onPerfLevelChange?: (level: PerfLevel) => void
  /** Масштаб DPR от губернатора (0.75…1) — Canvas применяет через resolveLabCanvasPolicy. */
  onResolutionScaleChange?: (scale: number) => void
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
  /** Озвучка преподавателя на научном микромире (ClO₂). */
  teacherMode?: boolean
  onNarrationCue?: (id: string) => void
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
      // Пол LITE и на normal tier: устойчивая просадка должна доходить до lite (раньше — BALANCED).
      floor: SYNTHESIS_QUALITY_LITE,
      cap: deviceSynthCap,
      initial: deviceSynthCap,
    }),
  )
  /** runId, для которого губернатор уже сброшен (сброс только на старте запуска). */
  const govRunIdRef = useRef(0)
  const synthForceLiteRef = useRef(false)
  const synthQualityLevelRef = useRef<SynthesisQualityLevel>(deviceSynthCap)
  const [synthQualityLevel, setSynthQualityLevel] = useState<SynthesisQualityLevel>(deviceSynthCap)
  const synthForceLite = qualityLevelToForceLite(synthQualityLevel)
  /** Последний запрошенный в React уровень — setState только при реальной смене, не каждый кадр. */
  const qualityUiRequestRef = useRef({ level: -1, at: 0 })
  const viewportDpr = useThree((s) => s.viewport.dpr)
  const getThreeState = useThree((s) => s.get)
  const lastViewportDprRef = useRef(viewportDpr)
  useEffect(() => {
    if (lastViewportDprRef.current === viewportDpr) return
    lastViewportDprRef.current = viewportDpr
    // EffectComposer (@react-three/postprocessing) ресайзит буферы только при смене size —
    // после адаптивного DPR переустанавливаем тот же size новым объектом.
    const { size, setSize } = getThreeState()
    setSize(size.width, size.height, size.top, size.left)
  }, [viewportDpr, getThreeState])
  useEffect(() => {
    if (!reactorViewOpen) return
    const gov = fpsGovRef.current
    // Вне реактора — базовый DPR; следующий сеанс начинает с полного разрешения.
    return () => {
      gov.resetResolution()
      onResolutionScaleChange?.(1)
    }
  }, [reactorViewOpen, onResolutionScaleChange])
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
  /**
   * Аргументы сторожей живут в стабильных объектах и только перезаписываются в кадре.
   * Раньше здесь на каждый кадр рождалось ~6 объектов и 2 замыкания — пилообразный GC
   * поверх живой 3D-сцены и «подвисание» на 1-2 кадра каждые несколько секунд.
   */
  const coveragePartsRef = useRef<SynthesisCoverage>({
    preview: false,
    product: false,
    mergeFx: false,
    convergeFx: false,
    cosmicFx: false,
  })
  const coverageRescueInRef = useRef({
    editMode: false,
    cinemaOwnsScreen: false,
    productSlotVisible: false,
    productPrewarm: false,
    heroLive: false,
    birthTween: false,
    phase: '' as string,
  })
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
  // Научный маршрут рисует свою сцену молекулами — превью атомов Бора не держим.
  if (reactorViewOpen && scientificStage == null && reactorPreviewTerms && reactorPreviewTerms.length >= 1) {
    previewTermsShellRef.current = reactorPreviewTerms
  } else if (!reactorViewOpen || scientificStage != null) {
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
  // Научная сцена — по РЕАКЦИИ, а не по продукту: реагенты синтеза (flyTerms) обязаны совпасть
  // с сигнатурой сцены. «NaOH + HCl → NaCl» не играет «2 Na + Cl₂», Mg(OH)₂ → MgO — не горение Mg.
  const scientificMicroworldActive =
    synthActive &&
    showElementsCollapseFx &&
    hasScientificSynthesisFx(synthesis?.product?.id, synthesis?.flyTerms)
  const ScientificFx = scientificMicroworldActive
    ? getScientificSynthesisFx(synthesis?.product?.id, synthesis?.flyTerms)
    : null
  void collapseRev
  // Флаг для Bohr-моделей: пока идёт урок-кино, ни один чужой атом не рисуется.
  useEffect(() => {
    setCinemaActive(scientificMicroworldActive)
    return () => setCinemaActive(false)
  }, [scientificMicroworldActive])

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
  /**
   * lowPower научной кинематики фиксируется на старте запуска (смена runId) и не меняется
   * до конца урока: FPS-губернатор адаптирует DPR, а не материалы/геометрию посреди сцены.
   * Уточнённый по FPS tier попадёт сюда только на следующем запуске.
   */
  const cinemaRunId = synthesis?.runId ?? 0
  const [cinemaLowPowerLock, setCinemaLowPowerLock] = useState(() => ({
    runId: cinemaRunId,
    lowPower: lowPowerProfile.forceLiteReactor || lowPowerProfile.isMobileSoc,
  }))
  if (cinemaLowPowerLock.runId !== cinemaRunId) {
    const runProfile = getLowPowerDeviceProfile(getSynthesisDeviceTier())
    setCinemaLowPowerLock({
      runId: cinemaRunId,
      lowPower: runProfile.forceLiteReactor || runProfile.isMobileSoc,
    })
  }
  const cinemaLowPower = cinemaLowPowerLock.lowPower

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
  /** Научная сцена до запуска заменяет превью атомов Бора: там молекулы, а не орбиты. */
  const scientificStageShown = scientificStage != null && reactorViewOpen && preSynthesisPreview
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
      // Урок-кино по шагам ждёт ученика: пока сцена на связи, прогон не закрываем,
      // иначе setRunId(0) снимет ScientificFx и панель прямо посреди шага.
      const lesson = clo2StepStore.getSnapshot()
      if (lesson.runId === synthesis.runId && lesson.status !== 'done') return
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
        showSettledHero,
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
    showSettledHero,
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

  /** Каталожный кадр / Bohr: settled слот ИЛИ painted продукт во время/после синтеза. */
  const hideBohrForProduct =
    canHideBohrForProduct({
      productPainted: effectiveProductPainted,
      slotVisible: productSlotVisibleResolved,
      prewarm: productPrewarmResolved,
      coeffEditing: coeffEditingActive,
      preSynthesis: preSynthesisPreview,
      showSettledHero,
    }) ||
    (!coeffEditingActive &&
      !preSynthesisPreview &&
      effectiveProductPainted &&
      productSlotVisibleResolved &&
      !productPrewarmResolved &&
      (synthActive || synthesisRunActive))

  const productTrulyOwnsScreen = hideBohrForProduct && showSettledHero

  const catalogViewMode = previewActive || productTrulyOwnsScreen

  /** Кадр каталожной модели с поправкой на нижний док реактора. */
  const [catalogHeroFrame, setCatalogHeroFrame] = useState<CatalogHeroFrame>(
    CATALOG_HERO_FRAME_BASE,
  )
  const catalogHeroFrameRef = useRef(catalogHeroFrame)
  const catalogHeroTarget = useMemo<[number, number, number]>(
    () => [
      catalogHeroFrame.targetX,
      catalogHeroFrame.targetY,
      CATALOG_HERO_VIEW.target[2],
    ],
    [catalogHeroFrame],
  )

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

  /** Научный микромир: сразу отдаляем камеру, чтобы схема читалась целиком. */
  useLayoutEffect(() => {
    if (!scientificMicroworldActive) return
    const pose = REACTOR_PREVIEW_CAMERA.scientific
    reactorCameraLockPoseRef.current = pose
    reactorOrbitTargetRef.current = pose.target
    stuckRescueDoneRef.current = false
    const cam = camera as THREE.PerspectiveCamera
    applyReactorPreviewCamera(cam, orbRef.current, pose)
    reactorCameraLockUntilRef.current = performance.now() + 2400
    invalidate()
    const orb = orbRef.current
    const t = window.setTimeout(() => {
      if (userOrbitingRef.current) return
      applyReactorPreviewCamera(cam, orb, pose)
      invalidate()
    }, 40)
    return () => window.clearTimeout(t)
  }, [scientificMicroworldActive, camera, invalidate])

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

  /**
   * Кадр каталожной модели считаем по СВОБОДНОЙ высоте канвы (без дока реактора).
   * Док меняет высоту (условия, сообщение, баланс), поэтому слушаем ResizeObserver.
   */
  const heroFrameCompoundId = productForSlot?.id ?? synthesisSettledProduct?.id ?? null
  useLayoutEffect(() => {
    if (!catalogViewMode) {
      if (catalogHeroFrameRef.current !== CATALOG_HERO_FRAME_BASE) {
        catalogHeroFrameRef.current = CATALOG_HERO_FRAME_BASE
        setCatalogHeroFrame(CATALOG_HERO_FRAME_BASE)
      }
      return
    }
    const canvas = gl.domElement
    const sync = () => {
      const next = measureCatalogHeroFrame(canvas, heroFrameCompoundId)
      const prev = catalogHeroFrameRef.current
      if (
        Math.abs(next.targetX - prev.targetX) < 0.004 &&
        Math.abs(next.targetY - prev.targetY) < 0.004 &&
        Math.abs(next.radius - prev.radius) < 0.004
      ) {
        return
      }
      catalogHeroFrameRef.current = next
      setCatalogHeroFrame(next)
    }
    // Скролл сыплет событиями — считаем не чаще кадра.
    let raf = 0
    const syncSoon = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        sync()
      })
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(canvas)
    const dock = document.querySelector<HTMLElement>('[data-lab-reactor]')
    if (dock) ro.observe(dock)
    window.addEventListener('resize', sync)
    // На узком экране док липкий: при прокрутке он наезжает на канву, не меняя своих
    // размеров, — ResizeObserver молчит, и кадр остался бы посчитанным по старому
    // перекрытию. Слушаем скролл в фазе перехвата, чтобы ловить и внутренние скроллеры.
    window.addEventListener('scroll', syncSoon, { passive: true, capture: true })
    // Док и карточка продукта появляются/досчитывают высоту после первых кадров
    // (сообщение об успехе, карточка героя) — перемеряем редко, setState только при сдвиге.
    const late = window.setTimeout(sync, 160)
    const poll = window.setInterval(sync, 500)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', sync)
      window.removeEventListener('scroll', syncSoon, { capture: true } as EventListenerOptions)
      if (raf) cancelAnimationFrame(raf)
      window.clearTimeout(late)
      window.clearInterval(poll)
    }
  }, [catalogViewMode, gl, heroFrameCompoundId])

  // eslint-disable-next-line react-hooks/immutability
  useLayoutEffect(() => {
    if (!catalogViewMode) return
    const p = camera as THREE.PerspectiveCamera
    // eslint-disable-next-line react-hooks/immutability
    p.fov = CATALOG_HERO_VIEW.fov
    p.updateProjectionMatrix()
    const [, , tz] = CATALOG_HERO_VIEW.target
    const tx = catalogHeroFrame.targetX
    const ty = catalogHeroFrame.targetY
    const k = catalogHeroFrame.radius / CATALOG_HERO_RADIUS
    camera.position.set(
      tx + CATALOG_HERO_VIEW.cameraPosition[0] * k,
      ty + CATALOG_HERO_OFFSET_Y * k,
      tz + CATALOG_HERO_OFFSET_Z * k,
    )
    camera.lookAt(tx, ty, tz)
    if (orbRef.current?.target) {
      orbRef.current.target.set(tx, ty, tz)
      orbRef.current.update?.()
    }
  }, [
    camera,
    catalogViewMode,
    catalogHeroFrame,
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
      // runId после каждого прогона возвращается в 0, а следующий снова 1 — без обнуления
      // губернатор не сбросился бы и второй запуск стартовал бы с деградированного уровня.
      govRunIdRef.current = 0
      return
    }
    const cap = Math.min(
      computeReactorEditQualityCap(previewAtomCount, reactorCoeffEditBurst),
      staticCap,
    ) as SynthesisQualityLevel
    const gov = fpsGovRef.current
    gov.setCap(cap)
    // Сброс только на старте нового runId; смена плотности/burst посреди запуска лишь опускает cap.
    // Масштаб DPR сохраняется между запусками (свидетельство устройства, без скачка DPR на старте).
    if (govRunIdRef.current !== synthesis.runId) {
      govRunIdRef.current = synthesis.runId
      gov.reset(cap)
    }
    const startLevel = gov.qualityLevel
    const initialLite = qualityLevelToForceLite(startLevel)
    synthQualityLevelRef.current = startLevel
    synthForceLiteRef.current = initialLite
    startTransition(() => {
      setSynthQualityLevel(startLevel)
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

  /**
   * Восстановление покрытия кадра. Создаётся один раз и читает поля из ref —
   * иначе на каждый кадр рождалось новое замыкание.
   */
  /** Тот же приём для continuity-guard: объект аргументов один на всю жизнь сцены. */
  const previewContinuityInRef = useRef({
    reactorViewOpen: false,
    synthLive: false,
    previewMounted: false,
    previewVisible: false,
    previewAtomCount: 0,
    productPrewarm: false,
    productPainted: false,
    productOwnsScreen: false,
    previewRootRef,
    invalidate,
  })
  previewContinuityInRef.current.invalidate = invalidate

  /** Вход lab3dVisibilityEngine — тоже один объект на сцену, а не новый каждый кадр. */
  const rescueInputRef = useRef({
    reactorOpen: false,
    hasPreviewTerms: false,
    coeffEditing: false,
    preSynthesis: false,
    synthLive: false,
    showSettledHero: false,
    productPainted: false,
    productSlotVisible: false,
    productPrewarm: false,
    productScaleX: undefined as number | undefined,
  })

  /** Флаги для onMainThreadStall — колбэк создаётся один раз, а не каждый кадр. */
  const frameHoldStallFlagsRef = useRef({ reactorIdle: false })
  const onMainThreadStall = useCallback(() => {
    if (frameHoldStallFlagsRef.current.reactorIdle) {
      suppressGpuPrewarm()
      if (forceLiteFxRef) forceLiteFxRef.current = true
      synthForceLiteRef.current = true
      return
    }
    suppressGpuPrewarm(1800)
    if (forceLiteFxRef) forceLiteFxRef.current = true
    synthForceLiteRef.current = true
    // Через губернатор — иначе он на следующем кадре вернул бы прежний уровень.
    const stallGov = fpsGovRef.current
    if (
      stallGov.forceDown(SYNTHESIS_QUALITY_BALANCED) ||
      synthQualityLevelRef.current > stallGov.qualityLevel
    ) {
      const stallLevel = stallGov.qualityLevel
      synthQualityLevelRef.current = stallLevel
      qualityUiRequestRef.current.level = stallLevel
      qualityUiRequestRef.current.at = performance.now()
      startTransition(() => setSynthQualityLevel(stallLevel))
    }
  }, [forceLiteFxRef])
  const frameHoldInRef = useRef({
    invalidate,
    reactorEdit: false,
    synthesisLive: false,
    onMainThreadStall,
  })
  frameHoldInRef.current.onMainThreadStall = onMainThreadStall

  const coverageRecover = useCallback(() => {
    const inp = coverageRescueInRef.current
    // Урок-кино сам рисует кадр: спасателю запрещено включать Bohr поверх сцены.
    if (
      previewRootRef.current &&
      !inp.cinemaOwnsScreen &&
      (inp.editMode || !inp.productSlotVisible || inp.productPrewarm)
    ) {
      previewRootRef.current.visible = true
      invalidate()
    }
    const g = productRootGroupRef.current
    // Пока идёт GSAP-рождение молекулы, снапить scale нельзя — это и есть «дёрг».
    if (g && inp.heroLive && inp.productSlotVisible && !inp.birthTween) {
      if (g.scale.x < 0.86) g.scale.set(1, 1, 1)
      invalidate()
    }
    if (inp.phase === 'mergeFlash' || inp.phase === 'product') {
      setForceProductSlot(true)
      setProductRevealReady(true)
    }
  }, [invalidate])

  useFrame((_, delta) => {
    frameHoldRef.current.markRendered()
    frameBudgetRef.current.sample(Math.min(120, Math.max(0.5, delta * 1000)))

    // Краткий hold hero-ракурса; pointerdown сразу отпускает — можно крутить.
    // Научный микромир держит дальний кадр, пока пользователь не трогает орбиту.
    const lockPose = reactorCameraLockPoseRef.current
    const sciCamHold =
      scientificMicroworldActive &&
      lockPose != null &&
      !userOrbitingRef.current &&
      performance.now() < reactorCameraLockUntilRef.current
    const lockActive =
      lockPose != null &&
      !catalogViewMode &&
      ((!synthActive && !synthesisRunActive) || sciCamHold) &&
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
      // Поля пишем в стабильные объекты: ноль аллокаций в кадре (minor GC = рывок сцены).
      const parts = coveragePartsRef.current
      // Во время урока-кино Bohr не считается покрытием кадра — кадр рисует сама сцена.
      parts.preview =
        reactorPreviewVisible && reactorPreviewMounted && !scientificMicroworldActive
      // micro-prewarm НЕ coverage — иначе пустой центр не ловится.
      parts.product = productSlotVisibleResolved && !productPrewarmResolved
      parts.mergeFx = synthesisPhase === 'mergeFlash'
      parts.convergeFx =
        elementsCollapsePlaying ||
        synthesisPhase === 'converge' ||
        synthesisPhase === 'ignite' ||
        synthesisPhase === 'flying'
      parts.cosmicFx = false
      const rescueIn = coverageRescueInRef.current
      rescueIn.editMode = reactorViewOpen && !synthesisRunActive && !synthActive
      rescueIn.cinemaOwnsScreen = scientificMicroworldActive
      rescueIn.productSlotVisible = productSlotVisibleResolved
      rescueIn.productPrewarm = productPrewarmResolved
      rescueIn.heroLive = showSettledHero || synthActive || synthesisRunActive
      rescueIn.birthTween = productBirthActive || productEmbryoOnly
      rescueIn.phase = synthesisPhase
      coverageTrackerRef.current.tick(
        synthesisRunActive || synthActive || reactorViewOpen,
        parts,
        coverageRecover,
      )
    }

    const continuityProductId =
      synthesisSettledProduct?.id ?? synthesis?.product?.id ?? null
    void continuityProductId

    // Единый gate hide Bohr — ДО continuity (иначе painted без full-scale гасит корень).
    // Урок-кино владеет кадром целиком: во время сцены экран принадлежит ей, а не Bohr.
    // Без этого сторож каждый кадр «спасал» забытые слоты реагентов поверх урока.
    const productScreenOkEarly =
      scientificMicroworldActive ||
      canHideBohrForProduct({
        productPainted: productPaintedRef.current,
        slotVisible: productSlotVisibleResolved,
        prewarm: productPrewarmResolved,
        coeffEditing: coeffEditingActive,
        preSynthesis: preSynthesisPreview,
        scaleX: productRootGroupRef.current?.scale.x,
        showSettledHero,
      })

    const contIn = previewContinuityInRef.current
    contIn.reactorViewOpen = reactorViewOpen
    contIn.synthLive = synthesisRunActive || synthActive
    contIn.previewMounted = reactorPreviewMounted
    // Pre-synth / coeff edit: никогда не отдаём hide корня continuity-guard'у.
    // Но во время урока-кино previewVisible=false — иначе сторож считает кадр пустым
    // и каждый кадр восстанавливает корень Bohr поверх научной сцены.
    contIn.previewVisible =
      !scientificMicroworldActive &&
      (reactorPreviewVisible ||
        (reactorViewOpen && !synthesisRunActive && !synthActive && !showSettledHero))
    contIn.previewAtomCount = previewAtomCount
    contIn.productPrewarm = productPrewarmActive
    contIn.productPainted =
      effectiveProductPainted &&
      productSlotVisibleResolved &&
      !productPrewarmResolved &&
      !coeffEditingActive &&
      !preSynthesisPreview &&
      (synthesisRunActive || synthActive || showSettledHero)
    contIn.productOwnsScreen = productScreenOkEarly
    previewContinuityRef.current.tick(contIn)

    // Имя корня Bohr — для диагностики и смоук-проверок «в кадре только сцена урока».
    if (previewRootRef.current && previewRootRef.current.name === '') {
      previewRootRef.current.name = 'lab-bohr-preview-root'
    }

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
        killScaleTweens: killScaleTweens,
      })
    }

    // Lab3DVisibilityEngine: rescue пустого центра (оба бага со скринов).
    const productScaleX = productRootGroupRef.current?.scale.x
    const rescueIn3d = rescueInputRef.current
    rescueIn3d.reactorOpen = reactorViewOpen
    rescueIn3d.hasPreviewTerms =
      effectivePreviewTerms != null && effectivePreviewTerms.length >= 1
    rescueIn3d.coeffEditing = coeffEditingActive
    rescueIn3d.preSynthesis = preSynthesisPreview
    rescueIn3d.synthLive = synthesisRunActive || synthActive
    rescueIn3d.showSettledHero = showSettledHero
    rescueIn3d.productPainted = productPaintedRef.current
    rescueIn3d.productSlotVisible = productSlotVisibleResolved
    rescueIn3d.productPrewarm = productPrewarmResolved
    rescueIn3d.productScaleX = productScaleX
    const rescue = resolveLab3dFrameRescue(rescueIn3d)
    // Во время урока-кино не сбрасываем paint: это setState из кадра → полный ререндер сцены.
    if (rescue.invalidatePaint && productPaintedRef.current && !scientificMicroworldActive) {
      productPaintedRef.current = false
      paintedForRunIdRef.current = 0
      setProductPainted(false)
    }
    if (rescue.forceBohrRootVisible && !productScreenOk && previewRootRef.current) {
      previewRootRef.current.visible = true
    }
    /**
     * Окно embryo → birth: идёт GSAP-твин рождения молекулы (scale 0 → 1, ~1.15 с).
     * productBirthActive там ещё false, поэтому старый охранник убивал твин на первом
     * же кадре и молекула «прыгала» в полный размер. Добавили всё окно жизни круга.
     */
    if (
      rescue.forceProductFullScale &&
      !productBirthActive &&
      !productEmbryoOnly &&
      !scientificMicroworldActive
    ) {
      const g = productRootGroupRef.current
      if (g && g.scale.x < 0.86) {
        gsap.killTweensOf(g.scale)
        g.scale.set(1, 1, 1)
        invalidate()
      }
    }

    // Порог emptyCenterRescueFrames: дополнительный nudge если центр пуст.
    // Не restore Bohr, если молекула уже full-scale на экране.
    // Урок-кино сам закрывает кадр — для него центр всегда «покрыт».
    const centerOk =
      scientificMicroworldActive ||
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
            killScaleTweens: killScaleTweens,
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
    // Урок-кино владеет экраном — корень Bohr гасим активно, а не «ждём paint продукта».
    const productScreenOkForHide =
      scientificMicroworldActive ||
      canHideBohrForProduct({
        productPainted: paintOkForRun,
        slotVisible: productSlotVisibleResolved,
        prewarm: productPrewarmResolved,
        coeffEditing: coeffEditingActive,
        preSynthesis: preSynthesisPreview,
        scaleX: productRootGroupRef.current?.scale.x,
        showSettledHero,
      })
    const mustShowBohr =
      reactorViewOpen &&
      effectivePreviewTerms != null &&
      effectivePreviewTerms.length >= 1 &&
      !productScreenOkForHide &&
      (!showSettledHero || coeffEditingActive) &&
      rescue.keepBohrUntilPaint
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

    const holdIn = frameHoldInRef.current
    holdIn.invalidate = invalidate
    // Во время +/- не усиливаем hitch лишними invalidate-burst.
    holdIn.reactorEdit = reactorViewOpen && !synthesisRunActive && !coeffEditingActive
    holdIn.synthesisLive = synthesisRunActive || synthActive
    frameHoldStallFlagsRef.current.reactorIdle =
      reactorViewOpen && !synthesisRunActive && !synthActive
    frameHoldRef.current.tick(holdIn)

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
    const gov = fpsGovRef.current
    if (perfGuardActive) {
      // DPR адаптируется только в запуске и не во время +/- (смена DPR при правке рвала WebGL).
      // Урок-кино тоже неприкосновенен: смена dpr пересоздаёт все FBO и композер
      // постобработки прямо посреди сцены — гарантированный провал кадра.
      gov.setAdaptResolution(
        (synthActive || synthesisRunActive) &&
          !coeffEditingActive &&
          !scientificMicroworldActive,
      )
      // Реальное время кадра: оценка раз в 250 мс по p90; true — только при смене уровня/DPR.
      if (gov.sample(delta)) {
        onResolutionScaleChange?.(gov.resolutionScale)
      }
      const nextLevel = gov.qualityLevel
      const nextLite = gov.forceLite
      synthQualityLevelRef.current = nextLevel
      if (forceLiteFxRef) forceLiteFxRef.current = nextLite
      synthForceLiteRef.current = nextLite
      const uiReq = qualityUiRequestRef.current
      // Во время +/- / collapse FX не трогаем React quality — remount/hitch Bohr.
      // Один запрос на смену; повтор — только если state так и не догнал за 600 мс.
      if (
        nextLevel !== synthQualityLevel &&
        !coeffEditingActive &&
        !elementsCollapsePlaying
      ) {
        const now = performance.now()
        if (uiReq.level !== nextLevel || now - uiReq.at > 600) {
          uiReq.level = nextLevel
          uiReq.at = now
          startTransition(() => setSynthQualityLevel(nextLevel))
        }
      }
    }
    a.t += d
    if (a.t < 0.25) return
    const refineDt = a.t
    a.t = 0
    refineSynthesisDeviceTierFromFps(
      perfGuardActive && gov.p90FrameMs > 0 ? 1000 / gov.p90FrameMs : a.fps,
      refineDt,
    )

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
        // Имя корня — для сторожа .smoke/cinema/stage-guard.mjs: звёздный фон реактора
        // не принадлежит сцене урока, но урок рисуется поверх него намеренно
        // (SynthesisOnLabScene externalCosmicBackdrop), поэтому сторож знает его по имени,
        // а не считает «ничьим» мешем. Фон сцены ставят LabSceneClearSync/LabReactorClearColor,
        // так что обёртка не ломает <color attach="background"> внутри бэкдропа.
        <group name="lab-reactor-backdrop-root">
          <LabSynthesisCosmicBackdrop
            lite={
              // В реакторе всегда lite Stars — full 900 + Bohr/молекула = hitch / white-screen.
              true
            }
            frozen={synthActive || synthesisRunActive || showElementsCollapseFx}
            collapseActive={showElementsCollapseFx || collapseFxLinger}
          />
        </group>
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
        // Имя корня — для сторожа .smoke/cinema/stage-guard.mjs: очередь прогрева
        // не принадлежит сцене урока и не должна попадать в кадр.
        <group name="lab-gpu-queue-root">
          <LabSynthesisGpuQueue
            compounds={popularPrewarmCompounds}
            priorityCompound={gpuQueuePriorityCompound}
            active={gpuQueueActive}
          />
        </group>
      ) : null}

      {/* Свободная сцена (декоративный атом, частицы) не показывается поверх урока-кино, даже если панель реактора свёрнута. */}
      {!reactorViewOpen && !scientificMicroworldActive ? (
        // Имя корня — для сторожа .smoke/cinema/stage-guard.mjs: экран входа
        // (декоративный атом, частицы, космический фон) чужой уроку-кино.
        <group name="lab-decor-atom-root">
          <LabIdleCosmicBackdrop lite={deviceTier === 'low'} />
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
        </group>
      ) : null}

      {reactorViewOpen ? (
        <>
          {/* Sticky shell: не unmount при product slot — иначе +/- после синтеза cold remount. */}
          {reactorPreviewMounted && effectivePreviewTerms && scientificStage == null ? (
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
                !hideBohrForProduct &&
                !synthesisRunActive &&
                !synthActive &&
                !showSettledHero
              }
              // После paint/settle Bohr обязан быть скрыт — иначе орбиты поверх молекулы.
              visible={
                !scientificMicroworldActive &&
                !scientificStageShown &&
                !hideBohrForProduct &&
                (reactorPreviewVisible ||
                  preSynthesisPreview ||
                  coeffEditingActive ||
                  synthHoldPreview)
              }
              // Научный микромир (ClO₂, NaCl…) рисует свои атомы — Bohr-превью прячем даже при synth-hold,
              // иначе 2Na + Cl₂ висят сжатым комком посреди урока.
              productOwnsScreen={hideBohrForProduct || scientificMicroworldActive}
              synthHoldPreview={synthHoldPreview && !hideBohrForProduct}
              lowPower={lowPowerProfile.forceLiteReactor || lowPowerProfile.isMobileSoc}
              productPrewarm={productPrewarmActive}
              atomGroupRefs={previewAtomGroupRefs}
              atomScaleGroupRefs={previewAtomScaleGroupRefs}
              previewRootRef={previewRootRef}
            />
          ) : null}
          {scientificStage ? (
            <ScientificReactorStage
              leftTerms={scientificStage.leftTerms}
              coProducts={scientificStage.coProducts}
              productId={scientificStage.productId}
              productCoeff={scientificStage.productCoeff}
              balanced={scientificStage.balanced}
              labels={scientificStage.labels}
              lowPower={lowPowerProfile.forceLiteReactor || lowPowerProfile.isMobileSoc}
              visible={scientificStageShown}
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
            ScientificFx ? (
              // Корень сцены урока-кино: сторож stage-guard считает чужим всё,
              // что рисуется в кадре мимо этой ветки.
              <group name="lab-cinema-scene-root">
                <ScientificFx
                  key={`sci-${synthesis.product?.id ?? 'unknown'}-${synthesis.runId}`}
                  runId={synthesis.runId}
                  // Зафиксировано на старте запуска — без смены материалов посреди урока.
                  lowPower={cinemaLowPower}
                  teacherMode={teacherMode}
                  onNarrationCue={onNarrationCue}
                  onEmbryoReady={handleElementsCollapseEmbryoReady}
                  onBirthReady={handleElementsCollapseBirthReady}
                  onComplete={handleElementsCollapseComplete}
                />
              </group>
            ) : (
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
            )
          ) : null}
          {/*
            Пока урок-кино владеет экраном, прогон закрывать нельзя: InstantLabSynthesis
            монтировался ровно по cue 'birth' и через ~0.2 с звал onDone → setRunId(0) →
            сцена и панель урока исчезали, не доиграв хвост.
          */}
          {synthActive &&
          synthesis &&
          instantSynthesis &&
          !elementsCollapsePlaying &&
          !scientificMicroworldActive ? (
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
        // Радиус каталожного кадра зависит от свободной полосы над доком реактора.
        minDistance={catalogViewMode ? catalogHeroFrame.radius : LAB_ORBIT.minDistance}
        maxDistance={catalogViewMode ? catalogHeroFrame.radius : LAB_ORBIT.maxDistance}
        minPolarAngle={catalogViewMode ? CATALOG_HERO_VIEW.minPolarAngle : LAB_ORBIT.minPolarAngle}
        maxPolarAngle={catalogViewMode ? CATALOG_HERO_VIEW.maxPolarAngle : LAB_ORBIT.maxPolarAngle}
        target={catalogViewMode ? catalogHeroTarget : reactorOrbitTargetRef.current}
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
  teacherMode = false,
  onNarrationCue,
  scientificStage = null,
}: {
  particles: readonly LabParticle[]
  onParticleMove: (id: string, pos: Vec3) => void
  structureZ: number | null
  onInspectAtom?: (z: number) => void
  synthesisRunActive?: boolean
  scientificStage?: ScientificStageInput | null
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
  teacherMode?: boolean
  onNarrationCue?: (id: string) => void
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
  const deviceGpuClass = useMemo(() => getSynthesisDeviceClassification().gpu, [])
  /** Адаптивный DPR (0.75…1) — меняет только губернатор SceneContent, редкими шагами. */
  const [resolutionScale, setResolutionScale] = useState(1)
  const canvasPolicy = resolveLabCanvasPolicy({
    deviceTier,
    perfLevel,
    synthesisRunActive: synthesisRunActive ?? false,
    reactorViewOpen: reactorViewOpen ?? false,
    coeffEditBurst: reactorCoeffEditBurst,
    substanceView: laboratorySynthesisView === 'substance',
    gpuClass: deviceGpuClass,
    resolutionScale,
  })
  const canvasDpr = canvasPolicy.dpr
  const perfProbe = useMemo(() => isPerfProbeEnabled(), [])
  const canvasAntialias = canvasPolicy.antialias
  // Probe-контекст один раз на mount: вызов на каждый render плодил WebGL-контексты
  // («Too many active WebGL contexts» → браузер терял контекст основного Canvas).
  const webglAvailable = useMemo(() => isWebGLAvailable(), [])
  if (!webglAvailable) {
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
        {perfProbe ? <LabPerfProbe /> : null}
        <SceneContent
          particles={particles}
          onParticleMove={onParticleMove}
          structureZ={structureZ}
          onInspectAtom={onInspectAtom}
          synthesis={synthesis}
          synthesisRunActive={synthesisRunActive}
          onPerfLevelChange={setPerfLevel}
          onResolutionScaleChange={setResolutionScale}
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
          teacherMode={teacherMode}
          onNarrationCue={onNarrationCue}
          scientificStage={scientificStage}
        />
      </Canvas>
    </CanvasErrorBoundary>
  )
}

export const LabCanvas = memo(LabCanvasImpl)
