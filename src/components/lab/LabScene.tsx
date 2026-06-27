import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, startTransition, useDeferredValue } from 'react'
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
import { createSynthesisQualityGovernor } from '../../lab/atomGuard/synthesisRunGuard'
import {
  computeReactorEditQualityCap,
  computeStaticQualityCap,
  featuresForQuality,
  qualityLevelToForceLite,
  type SynthesisQualityLevel,
} from '../../lab/synthesisQualityLadder'
import {
  getReactorPreviewPolicy,
  shouldRunGuardTick,
} from '../../lab/synthesisLagGuard'
import { CatalogSubstanceDisplay } from './CatalogSubstanceDisplay'
import { CatalogCanvasResizeSync } from './CatalogCanvasResizeSync'
import { ReactorTermsPreview } from './ReactorTermsPreview'
import { buildReactorPreviewAtoms } from './reactorPreviewLayout'
import { getSynthesisDeviceTier } from '../../lab/synthesisDeviceTier'
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
  createLabCanvasFrameHoldGuard,
  shouldMountProductGpuPrewarm,
} from '../../lab/labCanvasFrameGuard'
import { isProductGpuCompiled } from '../../lab/productGpuCompileCache'
import {
  createProductCrossfadeGuard,
  type ProductCrossfadeGuard,
} from '../../lab/synthesisLaunchGuard'
import {
  createSynthesisCoverageTracker,
} from '../../lab/synthesisVisualGuard'
import {
  resolveSynthesisContinuity,
  synthesisContinuityCovered,
  type SynthesisStickyMountRef,
  type SynthesisPreviewStickyRef,
} from '../../lab/synthesisAntiBlink'
import { getSynthesisTimingProfile, isInstantSynthesisProfile } from '../../lab/synthesisTimingProfile'
import { LAB_COSMIC_BG } from './LabSynthesisCosmicBackdrop'
import { useGraphicsSettingsOptional } from '../../perf/GraphicsSettingsProvider'
import { useRuntimeFpsGovernor } from '../../perf/useRuntimeFpsGovernor'

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

/** Runtime FPS governor — понижает глобальный пресет при просадке. */
function LabGlobalFpsBridge() {
  const gfx = useGraphicsSettingsOptional()
  useRuntimeFpsGovernor({
    enabled: gfx != null,
    onDowngrade: () => gfx?.runtimeDowngrade(),
    enterFps: 40,
  })
  return null
}

/** Прогрев кадра при открытии реактора — без gl.compile (блокирует main thread на секунды). */
function ReactorSceneWarmup({ reactorOpen }: { reactorOpen: boolean }) {
  const { invalidate } = useThree()
  const warmedRef = useRef(false)
  useEffect(() => {
    if (!reactorOpen) {
      warmedRef.current = false
      return
    }
    if (warmedRef.current) return
    warmedRef.current = true
    invalidate()
    let raf2 = 0
    let raf3 = 0
    const raf1 = requestAnimationFrame(() => {
      invalidate()
      raf2 = requestAnimationFrame(() => {
        invalidate()
        raf3 = requestAnimationFrame(() => invalidate())
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      cancelAnimationFrame(raf3)
    }
  }, [reactorOpen, invalidate])
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
  /** Продукт для скрытого pre-warm (compile GPU) до запуска синтеза */
  prewarmProductCompound?: CompoundDef | null
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
  const graphicsSettings = useGraphicsSettingsOptional()
  const orbRef = useRef<OrbitControlsImpl | null>(null)
  const perfLevelRef = useRef<PerfLevel>('high')
  const perfAcc = useRef({ t: 0, lowT: 0, highT: 0, fps: 60 })
  const fpsGovRef = useRef(
    createSynthesisQualityGovernor(),
  )
  const synthForceLiteRef = useRef(false)
  const synthQualityLevelRef = useRef<SynthesisQualityLevel>(3)
  const [synthQualityLevel, setSynthQualityLevel] = useState<SynthesisQualityLevel>(0)
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
  const productPaintFramesRef = useRef(0)
  const [prewarmReady, setPrewarmReady] = useState(false)
  const prewarmReadyRef = useRef(false)
  const prewarmCompoundIdRef = useRef<string | null>(null)
  const productStickyMountRef = useRef<SynthesisStickyMountRef | null>(null)
  const previewStickyMountRef = useRef<SynthesisPreviewStickyRef | null>(null)
  const crossfadeGuardRef = useRef<ProductCrossfadeGuard | null>(null)
  const coverageTrackerRef = useRef(createSynthesisCoverageTracker())
  const frameHoldRef = useRef(createLabCanvasFrameHoldGuard())
  const previewVisualTier = useMemo(
    () => (reactorPreviewTerms?.length ? getReactorVisualTier(reactorPreviewTerms) : 'full'),
    [reactorPreviewTerms],
  )
  const previewAtomCount = reactorPreviewTerms?.length
    ? buildReactorPreviewAtoms(reactorPreviewTerms, { tier: previewVisualTier }).length
    : 0
  const deferredPreviewAtomCount = useDeferredValue(previewAtomCount)
  const manyAtomsCameraRef = useRef(previewAtomCount > 8)

  const synthTimingProfile = useMemo(
    () => getSynthesisTimingProfile(synthForceLite, getSynthesisDeviceTier()),
    [synthForceLite],
  )
  const instantSynthesis = isInstantSynthesisProfile(synthTimingProfile)

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
    prewarmProductCompound ??
    null

  const gpuPrewarmAllowed = shouldMountProductGpuPrewarm({
    policy: 'intent',
    synthesisRunActive,
    synthActive,
    showSettledHero,
    hasPrewarmIntent: prewarmProductCompound != null,
  })

  const mountReactorPreview =
    reactorViewOpen &&
    reactorPreviewTerms != null &&
    reactorPreviewTerms.length >= 1 &&
    (!showSettledHero || synthActive || synthesisRunActive)

  const continuity = useMemo(
    () =>
      resolveSynthesisContinuity({
        runId: synthesis?.runId ?? 0,
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
        productPainted,
        stickyMountRef: productStickyMountRef,
        previewStickyRef: previewStickyMountRef,
      }),
    [
      synthesis?.runId,
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
      productPainted,
    ],
  )

  const productForSlot =
    continuity.productMeshMounted && productCompoundCandidate
      ? productCompoundCandidate
      : null

  const previewMotionLocked =
    synthActive && !instantSynthesis && synthesisPhase !== 'product'
  const previewPoseLocked = synthesisRunActive && !synthActive
  const reactorPreviewMounted = continuity.reactorPreviewMounted
  const reactorPreviewVisible = continuity.reactorPreviewVisible
  const productSlotVisible = continuity.productSlotVisible
  const productPrewarmActive = continuity.productPrewarm

  const handleProductGpuCompiled = useCallback((compoundId: string) => {
    prewarmCompoundIdRef.current = compoundId
    prewarmReadyRef.current = true
    setPrewarmReady(true)
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
    const compound = prewarmProductCompound ?? synthesis?.product
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
    prewarmProductCompound?.id,
    synthesis?.product?.id,
    synthActive,
    synthesisRunActive,
  ])

  useLayoutEffect(() => {
    // Сброс first-paint latch на каждый новый прогон/выход из синтеза.
    productPaintedRef.current = false
    productPaintFramesRef.current = 0
    setProductPainted(false)
    if (!synthActive || !synthesis?.runId) {
      setProductRevealReady(false)
      return
    }
    const productId = synthesis.product?.id
    const gpuReady =
      productId != null &&
      ((prewarmReadyRef.current || prewarmReady) &&
        prewarmCompoundIdRef.current === productId)
    if (gpuReady || (productId != null && isProductGpuCompiled(productId))) {
      setProductRevealReady(true)
      return
    }
    setProductRevealReady(false)
  }, [synthActive, synthesis?.runId, synthesis?.product?.id, prewarmReady])

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

  // Слабые GPU: если compile затянулся — всё равно показываем продукт (атомы до productPainted).
  useEffect(() => {
    if (!synthActive || !synthesis?.runId || productRevealReady) return
    let frames = 0
    let raf = 0
    const tick = () => {
      frames += 1
      if (productRevealReady) return
      if (frames >= 36) {
        setProductRevealReady(true)
        prewarmReadyRef.current = true
        setPrewarmReady(true)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [synthActive, synthesis?.runId, productRevealReady])

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

  useEffect(() => {
    if (!synthActive) {
      if (!showSettledHero) {
        setEarlyProductReveal(false)
        setForceProductSlot(false)
      }
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
  }, [synthActive, synthesisPhase, synthesis?.runId, synthesis?.product?.id, instantSynthesis, showSettledHero])

  /** Мгновенный синтез: 3 кадра атомы+электроны → молекула → пауза → settled. */
  useEffect(() => {
    if (!instantSynthesis || !synthesis?.runId) return
    const onDone = synthesis.onDone
    const holdMs = Math.max(420, synthTimingProfile.productHold * 1000)
    let raf2 = 0
    let raf3 = 0
    let timer = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        raf3 = requestAnimationFrame(() => {
          timer = window.setTimeout(() => onDone('success'), holdMs)
        })
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      cancelAnimationFrame(raf3)
      window.clearTimeout(timer)
    }
  }, [instantSynthesis, synthesis?.runId, synthesis?.onDone, synthTimingProfile.productHold])

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

  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => {
    if (catalogViewMode) return
    if (previewAtomCount > 9) manyAtomsCameraRef.current = true
    else if (previewAtomCount < 7) manyAtomsCameraRef.current = false
    const manyAtoms = manyAtomsCameraRef.current
    const p = camera as THREE.PerspectiveCamera
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
    const userCap = graphicsSettings?.synthesisCap
    const staticCap = computeStaticQualityCap({
      deviceTier: getSynthesisDeviceTier(),
      atomCount: deferredPreviewAtomCount,
      visualTier: previewVisualTier,
      userCap,
    })
    if (!synthesis?.runId) {
      const editCap = Math.min(
        computeReactorEditQualityCap(deferredPreviewAtomCount),
        staticCap,
      ) as SynthesisQualityLevel
      const editLite = qualityLevelToForceLite(editCap)
      synthForceLiteRef.current = editLite
      if (forceLiteFxRef) forceLiteFxRef.current = editLite
      startTransition(() => {
        setSynthQualityLevel((prev) => (prev === editCap ? prev : editCap))
      })
      return
    }
    fpsGovRef.current.reset()
    const cap = Math.min(
      computeReactorEditQualityCap(deferredPreviewAtomCount),
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
    deferredPreviewAtomCount,
    previewVisualTier,
    forceLiteFxRef,
    graphicsSettings?.synthesisCap,
    graphicsSettings?.effectivePreset,
  ])

  // Лёгкий авто-тюнинг: если FPS проседает — переключаемся на low и обратно с гистерезисом.
  // Делается здесь (внутри Canvas), чтобы измерять delta из render-loop без внешних зависимостей.
  useEffect(() => {
    perfLevelRef.current = 'high'
    perfAcc.current = { t: 0, lowT: 0, highT: 0, fps: 60 }
    onPerfLevelChange?.('high')
  }, [onPerfLevelChange])

  const previewLagPolicy = useMemo(
    () =>
      getReactorPreviewPolicy({
        atomCount: previewAtomCount,
        forceLite: synthForceLite,
        qualityLevel: synthQualityLevel,
        flightActive: previewMotionLocked,
        visible: reactorPreviewVisible,
      }),
    [previewAtomCount, synthForceLite, synthQualityLevel, previewMotionLocked, reactorPreviewVisible],
  )

  useFrame((_, delta) => {
    frameHoldRef.current.markRendered()

    // First-paint latch: как только меш молекулы виден на полном масштабе,
    // ждём 2 реально отрисованных кадра и затем разрешаем скрыть превью атомов.
    // Это исключает чёрный кадр при мгновенном появлении продукта.
    if (synthActive && productSlotVisible && !productPaintedRef.current) {
      productPaintFramesRef.current += 1
      if (productPaintFramesRef.current >= 8) {
        productPaintedRef.current = true
        setProductPainted(true)
      }
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
      if (!synthesisContinuityCovered(continuity, synthesisPhase === 'mergeFlash', synthesisPhase === 'converge')) {
            if (synthesisPhase === 'mergeFlash' || synthesisPhase === 'product') {
              setForceProductSlot(true)
            }
          }
        },
      )
    }

    frameHoldRef.current.tick(() => invalidate(), reactorViewOpen && !synthesisRunActive)

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

    const perfGuardActive = synthActive || synthesisRunActive
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
      if (levelChanged && (downgrade || now - qualityUiThrottleRef.current > 480)) {
        qualityUiThrottleRef.current = now
        setSynthQualityLevel(nextLevel)
      }
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

  return (
    <>
      <LabGlobalFpsBridge />
      <LabSceneClearSync reactorMode={reactorViewOpen} />
      {reactorBackdrop ? <LabReactorClearColor /> : null}
      {reactorBackdrop ? (
        <LabSynthesisCosmicBackdrop />
      ) : null}
      {reactorBackdrop ? <LabReactorLights /> : null}
      {reactorViewOpen ? (
        <ReactorSceneWarmup reactorOpen={reactorViewOpen} />
      ) : null}

      {!reactorViewOpen ? (
        <>
          <color attach="background" args={[LAB_SCENE_CLEAR_HEX]} />
          <fog attach="fog" args={[LAB_SCENE_CLEAR_HEX, 6, 28]} />
          <Stars radius={100} depth={50} count={1200} factor={3} saturation={0} fade speed={0.35} />
          <ambientLight intensity={0.22} />
          <directionalLight position={[4, 6, 2]} intensity={0.55} color="#b8c8ff" />
          <group position={[0, 0, 0]}>
            {structureZ != null ? (
              <AtomStructureModel z={structureZ} previewEmphasis cosmicStyle />
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
          {reactorPreviewMounted && reactorPreviewTerms ? (
            <ReactorTermsPreview
              terms={reactorPreviewTerms}
              visible={reactorPreviewVisible}
              flightActive={previewMotionLocked}
              poseLocked={previewPoseLocked}
              sharedLighting={synthActive || synthesisRunActive}
              forceLite={previewForceLite}
              qualityLevel={synthQualityLevel}
              synthesisGlass={synthQualityFeatures.glassAtoms}
              visualTier={previewVisualTier}
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
      {productForSlot ? (
        <LabProductHeroSlot
          compound={productForSlot}
          visible={productSlotVisible}
          prewarm={productPrewarmActive}
          entrance={productSlotEntrance}
          runId={synthesis?.runId ?? 0}
          birthEntrance={false}
          entranceDuration={0}
          onGpuCompiled={handleProductGpuCompiled}
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
    visualTier?: import('../../chemistry/reactorVisualTier').ReactorVisualTier
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
    const tier = getReactorVisualTier(reactorPreviewTerms)
    return buildReactorPreviewAtoms(reactorPreviewTerms, { tier }).length
  }, [reactorPreviewTerms])

  /** always: декоративный атом, переход в реактор и синтез — без ghost-frame на demand. */
  const canvasFrameloop = 'always' as const
  const densePreview = previewAtomCount > 6

  const lowPower3d =
    getSynthesisDeviceTier() === 'low' ||
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
          preserveDrawingBuffer: reactorViewOpen || synthesisRunActive,
        }}
        dpr={canvasDpr}
        frameloop={canvasFrameloop}
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
          synthesisPhase={synthesisPhase}
          forceLiteFxRef={forceLiteFxRef}
          prewarmProductCompound={prewarmProductCompound}
        />
      </Canvas>
    </CanvasErrorBoundary>
  )
}
