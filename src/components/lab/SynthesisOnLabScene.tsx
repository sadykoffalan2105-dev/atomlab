/* eslint-disable react-hooks/immutability -- R3F/Three: imperative updates to shared Object3D refs in layout effects */
/* eslint-disable react-hooks/exhaustive-deps -- fly refs: stable imperative R3F wiring */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { assertSuccessSynthesisVisualMode } from '../../lab/synthesisGuarantee'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { getReactorVisualTier, type ReactorVisualTier } from '../../chemistry/reactorVisualTier'
import { CATALOG_HERO_DEFAULT_LAB_SCALE } from './catalogMoleculeHeroShared'
import { CatalogSubstanceDisplay } from './CatalogSubstanceDisplay'
import {
  synthesisConvergeDurationSec,
} from '../../lab/synthesisLaunchTiming'
import type { SynthesisTimingProfile } from '../../lab/synthesisTimingProfile'
import { SYNTHESIS_TIMING_BALANCED } from '../../lab/synthesisTimingProfile'
import { SYNTHESIS_PERF } from '../../lab/synthesisPerfPreset'
import type { SynthesisQualityFeatures, SynthesisQualityLevel } from '../../lab/synthesisQualityLadder'
import { SYNTHESIS_QUALITY_MINIMAL } from '../../lab/synthesisQualityLadder'
import {
  SynthesisConvergeStreams,
} from './SynthesisConvergeStreams'
import { SynthesisNeonBondFormation } from './SynthesisNeonBondFormation'
import { buildReactorPreviewAtoms } from './reactorPreviewLayout'
import { pulseAllPreviewAtomsOnMerge } from '../../lab/synthesisAtomImpact'
import { SynthesisCinematicSky } from './SynthesisCinematicSky'
import { SynthesisWarpStreaks } from './SynthesisWarpStreaks'
import { SynthesisLaunchCamera } from './SynthesisLaunchCamera'
import { SynthesisIgniteBurst } from './SynthesisIgniteBurst'
import { SynthesisArcReactor } from './SynthesisArcReactor'
import { AtomStructureModel } from './AtomStructureModel'
import type { CompoundDef } from '../../types/chemistry'

const FLY_DUR = 0.26
const FAIL_DUR = 0.28
const Y_ATOMS = 0.12
const ATOM_SCALE = 0.44

type Phase = 'ignite' | 'converge' | 'flying' | 'mergeFlash' | 'product' | 'failBounce'

const FAIL_MERGE_COLOR = '#ff5c44'

function synthesisStuckSec(
  useConverge: boolean,
  termCount: number,
  atomCount: number,
  profile: SynthesisTimingProfile,
): number {
  const maxTermIndex = Math.max(0, termCount - 1)
  const maxAtomsPerTerm = Math.max(1, Math.ceil(atomCount / Math.max(1, termCount)))
  const maxStagger =
    maxTermIndex * profile.termStagger + (maxAtomsPerTerm - 1) * profile.atomStagger
  const convergeDur = useConverge ? profile.streamFlyDur + maxStagger : FLY_DUR
  return (
    convergeDur + profile.mergeFlashDur + profile.productEntranceDur + profile.productHold + 0.35
  )
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
  cinematic = false,
}: {
  tInMergeRef: MutableRefObject<number>
  total: number
  isSuccess: boolean
  flashHex: string
  minimalFx?: boolean
  cinematic?: boolean
}) {
  const ringG = useRef<THREE.Group>(null)
  const ringMat = useRef<THREE.MeshBasicMaterial>(null)
  const coreMat = useRef<THREE.MeshBasicMaterial>(null)
  const ptLight = useRef<THREE.PointLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const shockG = useRef<THREE.Group>(null)
  const shockMat = useRef<THREE.MeshBasicMaterial>(null)
  const colorA = (isSuccess ? flashHex : FAIL_MERGE_COLOR) as THREE.ColorRepresentation

  useFrame(() => {
    const raw = tInMergeRef.current
    const tt = total > 0.0001 ? Math.min(1, raw / total) : 0
    const easeOut = 1 - (1 - tt) * (1 - tt)
    const grow = 1 - Math.exp(-(cinematic ? 3.2 : 4.2) * tt)
    const peak = tt < 0.28 ? tt / 0.28 : 1 - (tt - 0.28) / 0.72
    if (ptLight.current) {
      // Резкий пик света в момент удара — ощущение взрыва.
      const flash = Math.exp(-7 * tt)
      const base = isSuccess ? 5 + 7 * easeOut : 2.6 + 4 * easeOut
      const cinematicBoost = cinematic && isSuccess ? 1.5 : 1
      ptLight.current.intensity =
        (base * (1 - tt * 0.85) * (isSuccess ? 1.2 + peak * 0.6 : 1) + flash * (isSuccess ? 9 : 5)) *
        cinematicBoost
    }
    if (hemi.current) {
      hemi.current.intensity = 0.7 * (1 - tt) * (isSuccess ? 0.9 : 0.55)
    }
    if (ringG.current) {
      ringG.current.scale.setScalar(0.35 + (isSuccess ? (cinematic ? 7.2 : 5.6) : 3.8) * grow)
    }
    if (ringMat.current) {
      ringMat.current.opacity = (isSuccess ? 0.92 : 0.62) * (1 - 0.82 * tt)
    }
    if (coreMat.current) {
      coreMat.current.opacity = cinematic && isSuccess ? (1 - tt) * 0.95 * peak : 0
    }
    // Ударная сфера: очень быстро расширяется и гаснет (фронт взрыва).
    if (shockG.current) {
      const shock = 1 - Math.exp(-(cinematic ? 9 : 11) * tt)
      shockG.current.scale.setScalar(0.2 + (isSuccess ? 6.4 : 4.2) * shock)
    }
    if (shockMat.current) {
      shockMat.current.opacity = (isSuccess ? 0.7 : 0.45) * Math.max(0, 1 - tt * 1.65)
    }
  })

  return (
    <group>
      {!minimalFx ? (
        <group ref={shockG}>
          <mesh>
            <sphereGeometry args={[0.16, 20, 20]} />
            <meshBasicMaterial
              ref={shockMat}
              color={colorA}
              transparent
              opacity={0.6}
              depthWrite={false}
              side={THREE.BackSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      ) : null}
      {cinematic && isSuccess && !minimalFx ? (
        <mesh position={[0, 0.1, 0.12]}>
          <sphereGeometry args={[0.22, 24, 24]} />
          <meshBasicMaterial
            ref={coreMat}
            color="#ffffff"
            transparent
            opacity={0.9}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ) : null}
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
        count={minimalFx ? (isSuccess ? 20 : 10) : isSuccess ? (cinematic ? 72 : 48) : 18}
        scale={minimalFx ? (isSuccess ? 3.4 : 2) : isSuccess ? (cinematic ? 5.8 : 4.8) : 3.2}
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
  qualityLevel = 3,
  qualityFeatures,
  onStreamsReady,
  previewAtomGroupRefs,
  previewAtomScaleGroupRefs,
  onPreviewAtomFade,
  onEarlyProductReveal,
  externalCosmicBackdrop = false,
  visualTier: visualTierProp,
  timingProfile = SYNTHESIS_TIMING_BALANCED,
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
  qualityLevel?: SynthesisQualityLevel
  qualityFeatures?: SynthesisQualityFeatures
  onStreamsReady?: () => void
  previewAtomGroupRefs?: MutableRefObject<(THREE.Group | null)[]>
  previewAtomScaleGroupRefs?: MutableRefObject<(THREE.Group | null)[]>
  onPreviewAtomFade?: () => void
  onEarlyProductReveal?: () => void
  /** full | lite | cluster */
  visualTier?: ReactorVisualTier
  timingProfile?: SynthesisTimingProfile
}) {
  const useConverge = !!product && flyTerms.length > 0
  const visualTier = visualTierProp ?? (flyTerms.length > 0 ? getReactorVisualTier(flyTerms) : 'full')
  const slotsKey = useConverge ? flyTerms.map((t) => `${t.z}:${t.coeff}`).join('|') : zSlots.join(',')
  const atomCount = useMemo(
    () => flyTerms.reduce((s, t) => s + t.coeff * (t.diatomic ? 2 : 1), 0),
    [flyTerms],
  )
  const synthesisFxMinimal =
    forceLiteFx ||
    qualityLevel <= SYNTHESIS_QUALITY_MINIMAL ||
    atomCount >= SYNTHESIS_PERF.liteFxAtomThreshold
  const fx = qualityFeatures
  const cinematicMode = !labLiteMode && !synthesisFxMinimal && timingProfile.igniteSkipMs > 0
  const cosmicLite = labLiteMode || synthesisFxMinimal

  const mergeFlashDur = timingProfile.mergeFlashDur
  const productEntranceDur = timingProfile.productEntranceDur
  const productHold = timingProfile.productHold

  const flyGroupRefs = useRef<(THREE.Group | null)[]>([])
  const flyTimelineCtxRef = useRef<ReturnType<typeof gsap.context> | null>(null)
  const flyStartedRef = useRef(false)
  const circlePtsRef = useRef<Array<[number, number]>>([])

  const productEntranceRef = useRef<THREE.Group>(null)
  const skipIgnite = labLiteMode || timingProfile.igniteSkipMs <= 0
  const initialPhase: Phase = useConverge ? (skipIgnite ? 'converge' : 'ignite') : 'flying'
  const [phase, setPhase] = useState<Phase>(initialPhase)
  const phaseRef = useRef<Phase>(initialPhase)
  const [fxLevel, setFxLevel] = useState<'off' | 'low' | 'full'>('off')
  const [heavyFxReady, setHeavyFxReady] = useState(false)
  const [mergeBurstReady, setMergeBurstReady] = useState(false)
  const tAcc = useRef(0)
  const convergeStartRef = useRef(0)
  const launchProgressRef = useRef(0)
  const impactPulseRef = useRef(0)
  const bondGrowRef = useRef(0)
  const bondLockRef = useRef(0)
  const launchBoostRef = useRef(0)
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  const onEarlyProductRevealRef = useRef(onEarlyProductReveal)
  const earlyProductFiredRef = useRef(false)
  const productGuaranteedRef = useRef(product)

  useEffect(() => {
    setHeavyFxReady(false)
    setMergeBurstReady(false)
    const raf = requestAnimationFrame(() => {
      setHeavyFxReady(true)
    })
    return () => cancelAnimationFrame(raf)
  }, [runId])

  useEffect(() => {
    if (phase !== 'mergeFlash') {
      setMergeBurstReady(false)
      return
    }
    const raf = requestAnimationFrame(() => {
      setMergeBurstReady(true)
    })
    return () => cancelAnimationFrame(raf)
  }, [phase, runId])

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
        ? synthesisConvergeDurationSec(
            flyTerms.length,
            flyTerms.reduce((s, t) => s + t.coeff * (t.diatomic ? 2 : 1), 0),
            visualTier,
            timingProfile,
          )
        : FLY_DUR,
    [useConverge, flyTerms, visualTier, timingProfile],
  )

  const previewZs = useMemo(
    () => buildReactorPreviewAtoms(flyTerms, { tier: visualTier }).map((a) => a.z),
    [flyTerms, visualTier, runId],
  )

  const beginMergeFlash = useCallback(() => {
    tAcc.current = 0
    impactPulseRef.current = 1
    bondLockRef.current = 0
    launchProgressRef.current = 1
    if (previewAtomGroupRefs && previewAtomScaleGroupRefs) {
      pulseAllPreviewAtomsOnMerge(
        previewAtomGroupRefs.current,
        previewAtomScaleGroupRefs.current,
      )
    }
    phaseRef.current = 'mergeFlash'
    setPhase('mergeFlash')
    earlyProductFiredRef.current = true
    onEarlyProductRevealRef.current?.()
  }, [previewAtomGroupRefs, previewAtomScaleGroupRefs])

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
      if (labLiteMode || timingProfile.igniteSkipMs <= 0) {
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
        }, timingProfile.igniteSkipMs)
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
  }, [runId, slotsKey, product, beginFlyingPhase, useConverge, zSlots.length, labLiteMode, timingProfile])

  useEffect(() => {
    if (!product) return
    const stuckSec = synthesisStuckSec(useConverge, flyTerms.length, zSlots.length, timingProfile)
    const timer = window.setTimeout(() => {
      if (phaseRef.current !== 'product') {
        forceProductSuccess()
      }
    }, stuckSec * 1000)
    return () => window.clearTimeout(timer)
  }, [runId, product, useConverge, flyTerms.length, slotsKey, forceProductSuccess, timingProfile])

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
      bondGrowRef.current = Math.max(0, (p - 0.5) / 0.5)
    } else if (ph === 'mergeFlash') {
      impactPulseRef.current = Math.max(
        0,
        impactPulseRef.current - delta * (cinematicMode ? 2.1 : 3.2),
      )
      launchBoostRef.current = 0.55 + impactPulseRef.current * 0.45
    } else if (ph === 'product') {
      bondGrowRef.current = 1
      bondLockRef.current = 1
      launchBoostRef.current = 0.2
    }

    if (ph === 'mergeFlash') {
      const tt = mergeFlashDur > 0.0001 ? Math.min(1, tAcc.current / mergeFlashDur) : 1
      bondGrowRef.current = 0.55 + tt * 0.45
      bondLockRef.current = tt > 0.65 ? Math.min(1, (tt - 0.65) / 0.35) : 0
      tAcc.current += delta
      const overlap = timingProfile.productRevealOverlapSec
      if (
        !earlyProductFiredRef.current &&
        productGuaranteedRef.current &&
        tAcc.current >= mergeFlashDur - overlap
      ) {
        earlyProductFiredRef.current = true
        onEarlyProductRevealRef.current?.()
      }
      if (tAcc.current >= mergeFlashDur) {
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
      const revealDone = tAcc.current >= productEntranceDur + productHold
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

  const showNeonBonds =
    heavyFxReady &&
    useConverge &&
    !!product &&
    previewAtomGroupRefs != null &&
    (phase === 'converge' || phase === 'mergeFlash' || phase === 'ignite')

  const cinema = cinematicPhase(phase)
  const accentHex = product?.accentColor ?? '#3dffec'
  const showCinematic = cinema != null && !externalCosmicBackdrop
  const showWarpAndArc = cinema != null && cinematicMode && !externalCosmicBackdrop
  const showArcPulse =
    heavyFxReady &&
    useConverge &&
    !externalCosmicBackdrop &&
    !synthesisFxMinimal &&
    (fx?.arcReactor ?? true)

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
      {useConverge && showCinematic && cinematicMode ? (
        <SynthesisLaunchCamera
          active
          progressRef={launchProgressRef}
          impactPulseRef={impactPulseRef}
          cinematic={cinematicMode}
        />
      ) : null}

      {phase === 'ignite' && cinematicMode ? <SynthesisIgniteBurst accentHex={accentHex} /> : null}

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
          visualTier={visualTier}
          timingProfile={timingProfile}
        />
      ) : null}

      {(inMerge || phase === 'converge' || phase === 'ignite') && showArcPulse ? (
        <SynthesisArcReactor
          active={phase === 'ignite' || phase === 'converge' || inMerge}
          accentHex={accentHex}
          impactPulseRef={impactPulseRef}
          lite={cosmicLite}
        />
      ) : null}

      {inMerge && mergeBurstReady && (
        <MergeFlashBurst
          tInMergeRef={tAcc}
          total={mergeFlashDur}
          isSuccess={!!product}
          flashHex={sparkleHex}
          minimalFx={synthesisFxMinimal || labLiteMode}
          cinematic={cinematicMode || !labLiteMode}
        />
      )}

      {showNeonBonds && product && previewAtomGroupRefs ? (
        <SynthesisNeonBondFormation
          product={product}
          previewZs={previewZs}
          previewAtomGroupRefs={previewAtomGroupRefs}
          growRef={bondGrowRef}
          lockRef={bondLockRef}
          impactRef={impactPulseRef}
          active={(fx?.neonBonds ?? true) && !synthesisFxMinimal}
        />
      ) : null}

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
