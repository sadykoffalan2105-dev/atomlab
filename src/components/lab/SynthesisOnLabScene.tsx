/* eslint-disable react-hooks/immutability -- R3F/Three: imperative updates to shared Object3D refs in layout effects */
/* eslint-disable react-hooks/exhaustive-deps -- fly refs: stable imperative R3F wiring */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { assertSuccessSynthesisVisualMode } from '../../lab/synthesisGuarantee'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { CATALOG_HERO_DEFAULT_LAB_SCALE } from './catalogMoleculeHeroShared'
import { CatalogSubstanceDisplay } from './CatalogSubstanceDisplay'
import {
  LAUNCH_MERGE_FLASH_DUR,
  LAUNCH_PRODUCT_ENTRANCE_DUR,
  LAUNCH_PRODUCT_HOLD,
  SYNTHESIS_IGNITE_SKIP_MS,
  synthesisConvergeDurationSec,
} from '../../lab/synthesisLaunchTiming'
import { SYNTHESIS_PERF } from '../../lab/synthesisPerfPreset'
import {
  SYNTHESIS_ATOM_STAGGER,
  SYNTHESIS_STREAM_FLY_DUR,
  SYNTHESIS_STREAM_STAGGER,
  SynthesisConvergeStreams,
} from './SynthesisConvergeStreams'
import { SynthesisCinematicSky } from './SynthesisCinematicSky'
import { SynthesisWarpStreaks } from './SynthesisWarpStreaks'
import { SynthesisLaunchCamera } from './SynthesisLaunchCamera'
import { SynthesisIgniteBurst } from './SynthesisIgniteBurst'
import { SynthesisArcReactor } from './SynthesisArcReactor'
import { AtomStructureModel } from './AtomStructureModel'
import type { CompoundDef } from '../../types/chemistry'

const FLY_DUR = 0.26
const MERGE_FLASH_DUR = LAUNCH_MERGE_FLASH_DUR
const PRODUCT_ENTRANCE_DUR = LAUNCH_PRODUCT_ENTRANCE_DUR
const PRODUCT_HOLD = LAUNCH_PRODUCT_HOLD
const FAIL_DUR = 0.28
const Y_ATOMS = 0.12
const ATOM_SCALE = 0.44

type Phase = 'ignite' | 'converge' | 'flying' | 'mergeFlash' | 'product' | 'failBounce'

const FAIL_MERGE_COLOR = '#ff5c44'

function synthesisStuckSec(useConverge: boolean, termCount: number, atomCount: number): number {
  const maxTermIndex = Math.max(0, termCount - 1)
  const maxAtomsPerTerm = Math.max(1, Math.ceil(atomCount / Math.max(1, termCount)))
  const maxStagger =
    maxTermIndex * SYNTHESIS_STREAM_STAGGER + (maxAtomsPerTerm - 1) * SYNTHESIS_ATOM_STAGGER
  const convergeDur = useConverge ? SYNTHESIS_STREAM_FLY_DUR + maxStagger : FLY_DUR
  return convergeDur + MERGE_FLASH_DUR + PRODUCT_ENTRANCE_DUR + PRODUCT_HOLD + 0.2
}

function positionsOnCircle(n: number, radius = 1.12): Array<[number, number]> {
  if (n <= 0) return []
  if (n === 1) return [[0, 0]]
  if (n === 2) {
    return [
      [radius, 0],
      [-radius, 0],
    ]
  }
  if (n === 3) {
    const angs = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]
    return angs.map((a) => [Math.cos(a) * radius, Math.sin(a) * radius])
  }
  const angs = Array.from({ length: n }, (_, i) => (i / n) * Math.PI * 2 - Math.PI / 2)
  return angs.map((a) => [Math.cos(a) * radius, Math.sin(a) * radius])
}

function MergeFlashBurst({
  tInMergeRef,
  total,
  isSuccess,
  flashHex,
  minimalFx = false,
}: {
  tInMergeRef: MutableRefObject<number>
  total: number
  isSuccess: boolean
  flashHex: string
  minimalFx?: boolean
}) {
  const ringG = useRef<THREE.Group>(null)
  const ringMat = useRef<THREE.MeshBasicMaterial>(null)
  const ptLight = useRef<THREE.PointLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const colorA = (isSuccess ? flashHex : FAIL_MERGE_COLOR) as THREE.ColorRepresentation

  useFrame(() => {
    const raw = tInMergeRef.current
    const tt = total > 0.0001 ? Math.min(1, raw / total) : 0
    const easeOut = 1 - (1 - tt) * (1 - tt)
    const grow = 1 - Math.exp(-4.2 * tt)
    const peak = tt < 0.3 ? tt / 0.3 : 1 - (tt - 0.3) / 0.7
    if (ptLight.current) {
      const base = isSuccess ? 4 + 6 * easeOut : 2.2 + 4 * easeOut
      ptLight.current.intensity = base * (1 - tt * 0.9) * (isSuccess ? 1.2 + peak * 0.6 : 1)
    }
    if (hemi.current) {
      hemi.current.intensity = 0.7 * (1 - tt) * (isSuccess ? 0.9 : 0.55)
    }
    if (ringG.current) ringG.current.scale.setScalar(0.35 + (isSuccess ? 5.6 : 3.8) * grow)
    if (ringMat.current) {
      ringMat.current.opacity = (isSuccess ? 0.92 : 0.62) * (1 - 0.82 * tt)
    }
  })

  return (
    <group>
      <mesh rotation={[-Math.PI * 0.5, 0, 0]}>
        <ringGeometry args={[0.05, isSuccess ? 0.72 : 0.5, minimalFx ? 24 : 36]} />
        <meshBasicMaterial
          color={colorA}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <pointLight ref={ptLight} position={[0, 0.1, 0.45]} intensity={0} color={colorA} distance={16} />
      {!minimalFx ? (
        <hemisphereLight
          ref={hemi}
          color={isSuccess ? '#9dd8ff' : '#ffccb0'}
          groundColor="#0a0a0a"
          intensity={0}
        />
      ) : null}
      <group rotation={[-Math.PI * 0.5, 0, 0]}>
        <group ref={ringG}>
          <mesh>
            <ringGeometry args={[0.1, isSuccess ? 0.58 : 0.44, minimalFx ? 28 : 40]} />
            <meshBasicMaterial
              ref={ringMat}
              color={colorA}
              transparent
              opacity={0.78}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      </group>
      <Sparkles
        count={minimalFx ? (isSuccess ? 24 : 10) : isSuccess ? 100 : 22}
        scale={minimalFx ? (isSuccess ? 3.8 : 2.2) : isSuccess ? 6.4 : 3.6}
        size={minimalFx ? (isSuccess ? 2 : 1.2) : isSuccess ? 3.2 : 2}
        speed={minimalFx ? 1.4 : isSuccess ? 2.8 : 1.2}
        opacity={minimalFx ? 0.55 : isSuccess ? 0.88 : 0.5}
        color={colorA}
        position={[0, 0.1, 0.15]}
      />
    </group>
  )
}

function cinematicPhase(phase: Phase): 'converge' | 'merge' | 'fail' | null {
  if (phase === 'ignite' || phase === 'converge' || phase === 'flying') return 'converge'
  if (phase === 'mergeFlash' || phase === 'product') return 'merge'
  if (phase === 'failBounce') return 'fail'
  return null
}

/**
 * Успешный синтез: потоки реагентов → вспышка → каталожная молекула (без шаров-пузырьков).
 */
export function SynthesisOnLabScene({
  zSlots,
  flyTerms = [],
  product,
  runId,
  onDone,
  onSynthesisStageChange,
  onPhaseChange,
  externalProductSlot = false,
  labLiteMode = false,
  forceLiteFx = false,
  onStreamsReady,
  previewAtomGroupRefs,
  previewAtomScaleGroupRefs,
  onPreviewAtomFade,
  onEarlyProductReveal,
  externalCosmicBackdrop = false,
}: {
  zSlots: readonly number[]
  flyTerms?: readonly ReactorEquationTerm[]
  product: CompoundDef | null
  runId: number
  onDone: (kind: 'success' | 'fail') => void
  onSynthesisStageChange?: (stage: 'reactor' | 'substance') => void
  onPhaseChange?: (phase: Phase, launchProgress: number) => void
  /** Молекула рисуется в LabProductHeroSlot — без дубля и мигания */
  externalProductSlot?: boolean
  /** Лаборатория: космос lite + без движения камеры (стабильный FPS) */
  labLiteMode?: boolean
  /** Фон/звёзды рисует LabScene — без дубля SynthesisCinematicSky */
  externalCosmicBackdrop?: boolean
  forceLiteFx?: boolean
  onStreamsReady?: () => void
  previewAtomGroupRefs?: MutableRefObject<(THREE.Group | null)[]>
  previewAtomScaleGroupRefs?: MutableRefObject<(THREE.Group | null)[]>
  onPreviewAtomFade?: () => void
  onEarlyProductReveal?: () => void
}) {
  const useConverge = !!product && flyTerms.length > 0
  const slotsKey = useConverge ? flyTerms.map((t) => `${t.z}:${t.coeff}`).join('|') : zSlots.join(',')
  const atomCount = useMemo(
    () => flyTerms.reduce((s, t) => s + t.coeff * (t.diatomic ? 2 : 1), 0),
    [flyTerms],
  )
  const synthesisFxMinimal =
    forceLiteFx || atomCount >= SYNTHESIS_PERF.liteFxAtomThreshold
  const cosmicLite = labLiteMode || synthesisFxMinimal

  const flyGroupRefs = useRef<(THREE.Group | null)[]>([])
  const flyTimelineCtxRef = useRef<ReturnType<typeof gsap.context> | null>(null)
  const flyStartedRef = useRef(false)
  const circlePtsRef = useRef<Array<[number, number]>>([])

  const productEntranceRef = useRef<THREE.Group>(null)
  const skipIgnite = labLiteMode || SYNTHESIS_IGNITE_SKIP_MS <= 0
  const initialPhase: Phase = useConverge ? (skipIgnite ? 'converge' : 'ignite') : 'flying'
  const [phase, setPhase] = useState<Phase>(initialPhase)
  const phaseRef = useRef<Phase>(initialPhase)
  const [fxLevel, setFxLevel] = useState<'off' | 'low' | 'full'>('off')
  const tAcc = useRef(0)
  const convergeStartRef = useRef(0)
  const launchProgressRef = useRef(0)
  const impactPulseRef = useRef(0)
  const launchBoostRef = useRef(0)
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  const onEarlyProductRevealRef = useRef(onEarlyProductReveal)
  const earlyProductFiredRef = useRef(false)
  const productGuaranteedRef = useRef(product)

  useEffect(() => {
    phaseRef.current = phase
    onPhaseChange?.(phase, launchProgressRef.current)
  }, [phase, onPhaseChange])

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    productGuaranteedRef.current = product
  }, [product])

  useEffect(() => {
    onEarlyProductRevealRef.current = onEarlyProductReveal
  }, [onEarlyProductReveal])

  const convergeDurationSec = useMemo(
    () =>
      useConverge
        ? synthesisConvergeDurationSec(flyTerms.length, flyTerms.reduce((s, t) => s + t.coeff * (t.diatomic ? 2 : 1), 0))
        : FLY_DUR,
    [useConverge, flyTerms],
  )

  const beginMergeFlash = useCallback(() => {
    tAcc.current = 0
    impactPulseRef.current = 1
    launchProgressRef.current = 1
    phaseRef.current = 'mergeFlash'
    setPhase('mergeFlash')
  }, [])

  const forceProductSuccess = useCallback(() => {
    if (!productGuaranteedRef.current || doneRef.current) return
    if (phaseRef.current === 'product') return
    phaseRef.current = 'product'
    setPhase('product')
    setFxLevel('full')
    tAcc.current = 0
  }, [])

  useLayoutEffect(() => {
    onSynthesisStageChange?.('reactor')
  }, [onSynthesisStageChange])

  const startFailFlyTimeline = useCallback(() => {
    const n = zSlots.length
    if (flyStartedRef.current || n < 2) return
    const groups = flyGroupRefs.current
    if (groups.length < n || !groups.slice(0, n).every((g) => g != null)) return

    flyStartedRef.current = true
    flyTimelineCtxRef.current?.revert()
    flyTimelineCtxRef.current = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { immediateRender: true } })
      for (let i = 0; i < n; i++) {
        const at = groups[i]!
        tl.to(
          at.position,
          { x: 0, y: Y_ATOMS, z: 0, duration: FLY_DUR, ease: 'power3.in' },
          0,
        )
        tl.to(
          at.scale,
          { x: 0.22, y: 0.22, z: 0.22, duration: FLY_DUR, ease: 'power4.in' },
          0,
        )
      }
      tl.call(
        () => {
          for (let i = 0; i < n; i++) {
            const g = groups[i]
            if (g) g.visible = false
          }
          beginMergeFlash()
        },
        undefined,
        FLY_DUR,
      )
    })
  }, [zSlots.length, beginMergeFlash])

  const beginFlyingPhase = useCallback(() => {
    phaseRef.current = 'flying'
    setPhase('flying')
    setFxLevel('off')
    const n = zSlots.length
    for (let i = 0; i < n; i++) {
      const g = flyGroupRefs.current[i]
      if (g) g.visible = true
    }
    startFailFlyTimeline()
  }, [zSlots.length, startFailFlyTimeline])

  const bindFlyGroup = useCallback(
    (i: number) => (node: THREE.Group | null) => {
      flyGroupRefs.current[i] = node
      if (!node || useConverge) return
      const [x, z] = circlePtsRef.current[i] ?? [0, 0]
      node.position.set(x, Y_ATOMS, z)
      node.scale.set(1, 1, 1)
      node.visible = phaseRef.current === 'flying' || phaseRef.current === 'failBounce'
      if (phaseRef.current === 'flying') startFailFlyTimeline()
    },
    [startFailFlyTimeline, useConverge],
  )

  useLayoutEffect(() => {
    doneRef.current = false
    flyStartedRef.current = false
    earlyProductFiredRef.current = false
    flyTimelineCtxRef.current?.revert()
    flyTimelineCtxRef.current = null
    tAcc.current = 0

    if (useConverge) {
      flyGroupRefs.current = []
      assertSuccessSynthesisVisualMode(true, false)
      convergeStartRef.current = performance.now() / 1000
      launchProgressRef.current = 0
      impactPulseRef.current = 0
      setFxLevel('low')
      launchBoostRef.current = 0.42
      if (labLiteMode || SYNTHESIS_IGNITE_SKIP_MS <= 0) {
        phaseRef.current = 'converge'
        setPhase('converge')
        convergeStartRef.current = performance.now() / 1000
      } else {
        phaseRef.current = 'ignite'
        setPhase('ignite')
        window.setTimeout(() => {
          if (phaseRef.current !== 'ignite') return
          phaseRef.current = 'converge'
          setPhase('converge')
          convergeStartRef.current = performance.now() / 1000
        }, SYNTHESIS_IGNITE_SKIP_MS)
      }
    } else {
      const n = zSlots.length
      if (n < 2) return
      flyGroupRefs.current = new Array(n).fill(null)
      circlePtsRef.current = positionsOnCircle(n, 1.12)
      assertSuccessSynthesisVisualMode(!!product, true)
      beginFlyingPhase()
    }

    if (productEntranceRef.current && !externalProductSlot) {
      productEntranceRef.current.scale.set(0.001, 0.001, 0.001)
    }

    return () => {
      flyTimelineCtxRef.current?.revert()
      flyTimelineCtxRef.current = null
    }
  }, [runId, slotsKey, product, beginFlyingPhase, useConverge, zSlots.length, labLiteMode])

  useEffect(() => {
    if (!product) return
    const stuckSec = synthesisStuckSec(useConverge, flyTerms.length, zSlots.length)
    const timer = window.setTimeout(() => {
      if (phaseRef.current !== 'product') {
        forceProductSuccess()
      }
    }, stuckSec * 1000)
    return () => window.clearTimeout(timer)
  }, [runId, product, useConverge, flyTerms.length, slotsKey, forceProductSuccess])

  const sparkleHex = product?.accentColor ?? '#3dffec'

  useFrame((_, delta) => {
    const ph = phaseRef.current
    if (ph === 'ignite' && useConverge) {
      launchProgressRef.current = 0.08
      launchBoostRef.current = 0.42
    } else if (ph === 'converge' && useConverge) {
      const elapsed = performance.now() / 1000 - convergeStartRef.current
      const p = convergeDurationSec > 0.01 ? Math.min(1, elapsed / convergeDurationSec) : 1
      launchProgressRef.current = 0.1 + p * 0.85
      launchBoostRef.current = 0.12 + p * 0.88
    } else if (ph === 'mergeFlash') {
      impactPulseRef.current = Math.max(0, impactPulseRef.current - delta * 3.2)
      launchBoostRef.current = 0.55 + impactPulseRef.current * 0.45
    } else if (ph === 'product') {
      launchBoostRef.current = 0.2
    }

    if (ph === 'mergeFlash') {
      tAcc.current += delta
      const overlap = SYNTHESIS_PERF.productRevealOverlapSec
      if (
        !earlyProductFiredRef.current &&
        productGuaranteedRef.current &&
        tAcc.current >= MERGE_FLASH_DUR - overlap
      ) {
        earlyProductFiredRef.current = true
        onEarlyProductRevealRef.current?.()
      }
      if (tAcc.current >= MERGE_FLASH_DUR) {
        tAcc.current = 0
        if (productGuaranteedRef.current) {
          phaseRef.current = 'product'
          setPhase('product')
          setFxLevel('full')
        } else {
          phaseRef.current = 'failBounce'
          setPhase('failBounce')
        }
      }
    } else if (ph === 'product') {
      tAcc.current += delta
      const revealDone = tAcc.current >= PRODUCT_ENTRANCE_DUR + PRODUCT_HOLD
      if (revealDone && !doneRef.current) {
        doneRef.current = true
        onDoneRef.current('success')
      }
    }
  })

  useLayoutEffect(() => {
    if (externalProductSlot || phase !== 'product' || !product || !productEntranceRef.current) return
    const g = productEntranceRef.current
    g.visible = true
    g.scale.set(1, 1, 1)
  }, [phase, product, runId, externalProductSlot])

  useLayoutEffect(() => {
    if (phase !== 'failBounce') return
    if (productGuaranteedRef.current) {
      phaseRef.current = 'product'
      setPhase('product')
      setFxLevel('full')
      return
    }
    const n = zSlots.length
    const pts = positionsOnCircle(n, 1.08)
    const grps: (THREE.Group | null)[] = flyGroupRefs.current.slice(0, n)
    for (const g of grps) {
      if (g) {
        g.visible = true
        g.position.set(0, Y_ATOMS, 0)
        g.scale.set(1, 1, 1)
      }
    }
    if (n < 2) return
    const ctx = gsap.context(() => {
      for (let i = 0; i < n; i++) {
        const g = grps[i]!
        const [x, z] = pts[i] ?? [0, 0]
        gsap.to(g.position, {
          x,
          y: Y_ATOMS,
          z,
          duration: FAIL_DUR,
          ease: 'power2.inOut',
        })
      }
      gsap.delayedCall(FAIL_DUR, () => {
        if (!doneRef.current) {
          doneRef.current = true
          onDoneRef.current('fail')
        }
      })
    })
    return () => {
      ctx.revert()
    }
  }, [phase, runId, zSlots.length, slotsKey])

  const showCatalogSubstance = !!product && phase === 'product' && !externalProductSlot
  const inMerge = phase === 'mergeFlash'
  const skipLocalLights = labLiteMode && externalProductSlot
  const showFailAtomModels = !useConverge && (phase === 'flying' || phase === 'failBounce') && zSlots.length >= 2
  const showConvergeStreams = useConverge && (phase === 'ignite' || phase === 'converge')

  const cinema = cinematicPhase(phase)
  const accentHex = product?.accentColor ?? '#3dffec'
  const showCinematic = cinema != null && !externalCosmicBackdrop
  const showWarpAndArc = cinema != null && !labLiteMode && !externalCosmicBackdrop

  if (!useConverge && zSlots.length < 2) {
    return (
      <>
        <ambientLight intensity={0.3} />
        <directionalLight position={[3.2, 5.5, 2.5]} intensity={0.55} color="#b8c8ff" />
      </>
    )
  }

  return (
    <>
      {showCinematic && cinema ? (
        <SynthesisCinematicSky
          phase={cinema}
          intensityRef={launchBoostRef}
          accentHex={accentHex}
          lite={cosmicLite}
        />
      ) : null}
      {showWarpAndArc ? (
        <SynthesisWarpStreaks
          active={phase === 'ignite' || phase === 'converge'}
          intensityRef={launchBoostRef}
          accentHex={accentHex}
          lite={cosmicLite}
        />
      ) : null}
      {useConverge && showCinematic && !labLiteMode ? (
        <SynthesisLaunchCamera active progressRef={launchProgressRef} impactPulseRef={impactPulseRef} />
      ) : null}

      {phase === 'ignite' && !cosmicLite ? <SynthesisIgniteBurst accentHex={accentHex} /> : null}

      {showConvergeStreams && previewAtomGroupRefs && previewAtomScaleGroupRefs ? (
        <SynthesisConvergeStreams
          terms={flyTerms}
          runId={runId}
          onImpact={beginMergeFlash}
          onStreamsReady={onStreamsReady}
          beamsVisible={false}
          previewAtomGroupRefs={previewAtomGroupRefs}
          previewAtomScaleGroupRefs={previewAtomScaleGroupRefs}
          onBeginAtomFade={onPreviewAtomFade}
        />
      ) : null}

      {(inMerge || phase === 'converge' || phase === 'ignite') && useConverge && showWarpAndArc ? (
        <SynthesisArcReactor
          active={phase === 'ignite' || phase === 'converge' || inMerge}
          accentHex={accentHex}
          impactPulseRef={impactPulseRef}
          lite={cosmicLite}
        />
      ) : null}

      {inMerge && (
        <MergeFlashBurst
          tInMergeRef={tAcc}
          total={MERGE_FLASH_DUR}
          isSuccess={!!product}
          flashHex={sparkleHex}
          minimalFx={synthesisFxMinimal || labLiteMode}
        />
      )}

      {!skipLocalLights ? (
        <>
          <ambientLight intensity={0.44} />
          <directionalLight position={[3.2, 5.5, 2.5]} intensity={0.85} color="#b8c8ff" />
        </>
      ) : null}
      {showCatalogSubstance && product ? (
        <group ref={productEntranceRef} position={[0, 0, 0]}>
          <CatalogSubstanceDisplay
            compound={product}
            labScaleBoost={CATALOG_HERO_DEFAULT_LAB_SCALE}
            reducedEffects
            labSynthesisScene
            fxLevel={fxLevel}
            renderQuality="synthesis"
          />
        </group>
      ) : null}

      {showFailAtomModels
        ? zSlots.map((z, i) => (
            <group key={`${runId}-fail-${i}-${z}`} ref={bindFlyGroup(i)}>
              <group scale={ATOM_SCALE} position={[0, 0, 0]}>
                <AtomStructureModel z={z} animate previewEmphasis previewLite localLight={false} />
              </group>
            </group>
          ))
        : null}
    </>
  )
}
