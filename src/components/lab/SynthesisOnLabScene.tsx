/* eslint-disable react-hooks/immutability -- R3F/Three: imperative updates to shared Object3D refs in layout effects */
/* eslint-disable react-hooks/exhaustive-deps -- fly refs: stable imperative R3F wiring */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { assertSuccessSynthesisVisualMode } from '../../lab/synthesisGuarantee'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { CATALOG_HERO_DEFAULT_LAB_SCALE } from './catalogMoleculeHeroShared'
import { CatalogSubstanceDisplay } from './CatalogSubstanceDisplay'
import {
  SYNTHESIS_ATOM_STAGGER,
  SYNTHESIS_STREAM_FLY_DUR,
  SYNTHESIS_STREAM_STAGGER,
  SynthesisConvergeStreams,
} from './SynthesisConvergeStreams'
import { LightweightElementBall } from './LightweightElementBall'
import type { CompoundDef } from '../../types/chemistry'

const FLY_DUR = 0.22
const MERGE_FLASH_DUR = 0.1
const PRODUCT_ENTRANCE_DUR = 0.1
const PRODUCT_HOLD = 0.02
const FAIL_DUR = 0.16
const Y_ATOMS = 0.12
const ATOM_SCALE = 0.44

type Phase = 'converge' | 'flying' | 'mergeFlash' | 'product' | 'failBounce'

const BG = {
  fly: { c: '#03050f', f: ['#03050f', 5, 26] as [string, number, number] },
  product: { c: '#0a0c18', f: ['#0a0c18', 6.5, 16] as [string, number, number] },
  fail: { c: '#140a0a', f: ['#120808', 4, 18] as [string, number, number] },
} as const

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
}: {
  tInMergeRef: MutableRefObject<number>
  total: number
  isSuccess: boolean
  flashHex: string
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
    if (ringG.current) ringG.current.scale.setScalar(0.35 + (isSuccess ? 4.8 : 3.4) * grow)
    if (ringMat.current) {
      ringMat.current.opacity = (isSuccess ? 0.78 : 0.58) * (1 - 0.88 * tt)
    }
  })

  return (
    <group>
      <pointLight ref={ptLight} position={[0, 0.1, 0.45]} intensity={0} color={colorA} distance={16} />
      <hemisphereLight
        ref={hemi}
        color={isSuccess ? '#9dd8ff' : '#ffccb0'}
        groundColor="#0a0a0a"
        intensity={0}
      />
      <group rotation={[-Math.PI * 0.5, 0, 0]}>
        <group ref={ringG}>
          <mesh>
            <ringGeometry args={[0.1, isSuccess ? 0.58 : 0.44, 56]} />
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
        count={isSuccess ? 48 : 14}
        scale={isSuccess ? 3.8 : 2.8}
        size={isSuccess ? 2.2 : 1.6}
        speed={isSuccess ? 1.25 : 0.85}
        opacity={isSuccess ? 0.62 : 0.42}
        color={colorA}
        position={[0, 0.1, 0.15]}
      />
    </group>
  )
}

function SynthesisSky({ phase, hasProduct }: { phase: Phase; hasProduct: boolean }) {
  const catalogStyleBg = hasProduct && (phase === 'mergeFlash' || phase === 'product')
  const bg = catalogStyleBg
    ? BG.product
    : phase === 'failBounce'
      ? BG.fail
      : BG.fly
  return (
    <>
      <color attach="background" args={[bg.c]} />
      <fog attach="fog" args={bg.f} />
    </>
  )
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
}: {
  zSlots: readonly number[]
  flyTerms?: readonly ReactorEquationTerm[]
  product: CompoundDef | null
  runId: number
  onDone: (kind: 'success' | 'fail') => void
  onSynthesisStageChange?: (stage: 'reactor' | 'substance') => void
}) {
  const useConverge = !!product && flyTerms.length > 0
  const slotsKey = useConverge ? flyTerms.map((t) => `${t.z}:${t.coeff}`).join('|') : zSlots.join(',')

  const flyGroupRefs = useRef<(THREE.Group | null)[]>([])
  const flyTimelineCtxRef = useRef<ReturnType<typeof gsap.context> | null>(null)
  const flyStartedRef = useRef(false)
  const circlePtsRef = useRef<Array<[number, number]>>([])

  const productEntranceRef = useRef<THREE.Group>(null)
  const [phase, setPhase] = useState<Phase>(useConverge ? 'converge' : 'flying')
  const phaseRef = useRef<Phase>(useConverge ? 'converge' : 'flying')
  const [fxLevel, setFxLevel] = useState<'off' | 'low' | 'full'>('off')
  const tAcc = useRef(0)
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  const productGuaranteedRef = useRef(product)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    productGuaranteedRef.current = product
  }, [product])

  const beginMergeFlash = useCallback(() => {
    tAcc.current = 0
    phaseRef.current = 'mergeFlash'
    setPhase('mergeFlash')
  }, [])

  const forceProductSuccess = useCallback(() => {
    if (!productGuaranteedRef.current || doneRef.current) return
    phaseRef.current = 'product'
    setPhase('product')
    setFxLevel('full')
    tAcc.current = PRODUCT_HOLD
    doneRef.current = true
    onDoneRef.current('success')
  }, [])

  useLayoutEffect(() => {
    const isSubstanceView = !!product && phase === 'product'
    onSynthesisStageChange?.(isSubstanceView ? 'substance' : 'reactor')
  }, [phase, product, onSynthesisStageChange])

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
    flyTimelineCtxRef.current?.revert()
    flyTimelineCtxRef.current = null
    tAcc.current = 0

    if (useConverge) {
      flyGroupRefs.current = []
      assertSuccessSynthesisVisualMode(true, false)
      phaseRef.current = 'converge'
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase('converge')
      setFxLevel('low')
    } else {
      const n = zSlots.length
      if (n < 2) return
      flyGroupRefs.current = new Array(n).fill(null)
      circlePtsRef.current = positionsOnCircle(n, 1.12)
      assertSuccessSynthesisVisualMode(!!product, true)
      beginFlyingPhase()
    }

    if (productEntranceRef.current) {
      productEntranceRef.current.scale.set(0.001, 0.001, 0.001)
    }

    return () => {
      flyTimelineCtxRef.current?.revert()
      flyTimelineCtxRef.current = null
    }
  }, [runId, slotsKey, product, beginFlyingPhase, useConverge, zSlots.length])

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
    if (ph === 'mergeFlash') {
      tAcc.current += delta
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
      if (tAcc.current >= PRODUCT_HOLD && !doneRef.current) {
        doneRef.current = true
        onDoneRef.current('success')
      }
    }
  })

  useLayoutEffect(() => {
    if (phase !== 'product' || !product || !productEntranceRef.current) return
    const g = productEntranceRef.current
    g.scale.set(0.01, 0.01, 0.01)
    const t = gsap.to(g.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: PRODUCT_ENTRANCE_DUR,
      ease: 'power2.out',
    })
    return () => {
      t.kill()
    }
  }, [phase, product, runId])

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

  const mountCatalogSubstance =
    !!product && (phase === 'converge' || phase === 'mergeFlash' || phase === 'product')
  const showCatalogSubstance = !!product && phase === 'product'
  const inMerge = phase === 'mergeFlash'
  const hasCatalogLights = showCatalogSubstance
  const lightsHero = inMerge || phase === 'converge' || (phase === 'product' && !!product)
  const showFailAtomModels = !useConverge && (phase === 'flying' || phase === 'failBounce') && zSlots.length >= 2
  const showConvergeStreams = useConverge && phase === 'converge'

  if (!useConverge && zSlots.length < 2) {
    return (
      <>
        <SynthesisSky phase="flying" hasProduct={false} />
        <ambientLight intensity={0.3} />
        <directionalLight position={[3.2, 5.5, 2.5]} intensity={0.55} color="#b8c8ff" />
      </>
    )
  }

  return (
    <>
      <SynthesisSky phase={phase} hasProduct={!!product} />

      {showConvergeStreams ? (
        <SynthesisConvergeStreams terms={flyTerms} runId={runId} onImpact={beginMergeFlash} />
      ) : null}

      {inMerge && (
        <MergeFlashBurst
          tInMergeRef={tAcc}
          total={MERGE_FLASH_DUR}
          isSuccess={!!product}
          flashHex={sparkleHex}
        />
      )}

      {!hasCatalogLights ? (
        <>
          <ambientLight intensity={lightsHero ? 0.36 : 0.2} />
          <directionalLight
            position={[3.2, 5.5, 2.5]}
            intensity={lightsHero ? 0.72 : 0.45}
            color="#b8c8ff"
          />
        </>
      ) : null}
      {mountCatalogSubstance && product ? (
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
                <LightweightElementBall z={z} radius={0.48} segments={12} />
              </group>
            </group>
          ))
        : null}
    </>
  )
}
