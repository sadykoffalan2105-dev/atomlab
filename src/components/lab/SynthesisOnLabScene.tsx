import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { CATALOG_HERO_DEFAULT_LAB_SCALE } from './catalogMoleculeHeroShared'
import { CatalogSubstanceDisplay } from './CatalogSubstanceDisplay'
import { getElementByZ } from '../../data/elements'
import type { CompoundDef } from '../../types/chemistry'

const FLY_DUR = 0.52
const MERGE_FLASH_DUR = 0.2
const PRODUCT_ENTRANCE_DUR = 0.28
const PRODUCT_HOLD = 0.95
const FAIL_DUR = 0.45
const Y_ATOMS = 0.12
const ATOM_SCALE = 0.44

type Phase = 'flying' | 'mergeFlash' | 'product' | 'failBounce'

const BG = {
  fly: { c: '#03050f', f: ['#03050f', 5, 26] as [string, number, number] },
  product: { c: '#0a0c18', f: ['#0a0c18', 6.5, 16] as [string, number, number] },
  fail: { c: '#140a0a', f: ['#120808', 4, 18] as [string, number, number] },
} as const

const FAIL_MERGE_COLOR = '#ff5c44'

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

/** Лёгкий шар для фазы полёта (без ядра/электронов AtomStructureModel — до 24 слотов). */
function SynthesisFlyAtom({ z }: { z: number }) {
  const el = getElementByZ(z)
  const color = el ? `#${el.cpkHex}` : '#8899aa'
  return (
    <mesh>
      <sphereGeometry args={[0.48, 18, 14]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.32}
        metalness={0.22}
        roughness={0.36}
      />
    </mesh>
  )
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
    const grow = 1 - Math.exp(-3.1 * tt)
    if (ptLight.current) {
      ptLight.current.intensity = (2.2 + 4 * easeOut) * (1 - tt) * 1.85
    }
    if (hemi.current) {
      hemi.current.intensity = 0.5 * (1 - tt) * (isSuccess ? 0.7 : 0.55)
    }
    if (ringG.current) ringG.current.scale.setScalar(0.5 + 3.4 * grow)
    if (ringMat.current) {
      ringMat.current.opacity = 0.58 * (1 - 0.8 * tt)
    }
  })

  return (
    <group>
      <pointLight ref={ptLight} position={[0, 0.1, 0.45]} intensity={0} color={colorA} distance={12} />
      <hemisphereLight
        ref={hemi}
        color={isSuccess ? '#9dd8ff' : '#ffccb0'}
        groundColor="#0a0a0a"
        intensity={0}
      />
      <group rotation={[-Math.PI * 0.5, 0, 0]}>
        <group ref={ringG}>
          <mesh>
            <ringGeometry args={[0.14, 0.44, 48]} />
            <meshBasicMaterial
              ref={ringMat}
              color={colorA}
              transparent
              opacity={0.58}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      </group>
      <Sparkles
        count={isSuccess ? 36 : 24}
        scale={3.2}
        size={1.9}
        speed={0.62}
        opacity={0.5}
        color={colorA}
        position={[0, 0.1, 0.15]}
      />
    </group>
  )
}

function SynthesisSky({ phase, hasProduct }: { phase: Phase; hasProduct: boolean }) {
  const catalogStyleBg =
    hasProduct && (phase === 'mergeFlash' || phase === 'product')
  const bg = catalogStyleBg
    ? BG.product
    : phase === 'failBounce'
      ? BG.fail
      : phase === 'flying'
        ? BG.fly
        : /* merge без продукта */ BG.fly
  return (
    <>
      <color attach="background" args={[bg.c]} />
      <fog attach="fog" args={bg.f} />
    </>
  )
}

/**
 * Синтез: N атомов (2–4) в ряд втягиваются в центр, вспышка, молекула как в каталоге.
 */
export function SynthesisOnLabScene({
  zSlots,
  product,
  runId,
  onDone,
  onSynthesisStageChange,
}: {
  zSlots: readonly number[]
  product: CompoundDef | null
  runId: number
  onDone: (kind: 'success' | 'fail') => void
  onSynthesisStageChange?: (stage: 'reactor' | 'substance') => void
}) {
  const n = zSlots.length
  // Динамические refs групп атомов по индексу в `zSlots`.
  const atomGroupRefs = useRef<(THREE.Group | null)[]>([])

  const productEntranceRef = useRef<THREE.Group>(null)
  const [phase, setPhase] = useState<Phase>('flying')
  const phaseRef = useRef<Phase>('flying')
  const [fxLevel, setFxLevel] = useState<'off' | 'low' | 'full'>('off')
  const tAcc = useRef(0)
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  const slotsKey = zSlots.join(',')

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  useLayoutEffect(() => {
    const isSubstanceView =
      !!product && (phase === 'mergeFlash' || phase === 'product')
    onSynthesisStageChange?.(isSubstanceView ? 'substance' : 'reactor')
  }, [phase, product, onSynthesisStageChange])

  useLayoutEffect(() => {
    if (n < 2) return
    doneRef.current = false
    tAcc.current = 0
    phaseRef.current = 'flying'
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase('flying')
    setFxLevel('off')
    const pts = positionsOnCircle(n, 1.12)
    for (let i = 0; i < n; i++) {
      const g = atomGroupRefs.current[i] ?? null
      if (g) {
        const [x, z] = pts[i] ?? [0, 0]
        g.position.set(x, Y_ATOMS, z)
        g.scale.set(1, 1, 1)
        g.visible = true
      }
    }
    if (productEntranceRef.current) {
      productEntranceRef.current.scale.set(0.001, 0.001, 0.001)
    }

    const buildFlyTl = (groups: (THREE.Group | null)[]) => {
      return gsap.context(() => {
        const tl = gsap.timeline()
        for (let i = 0; i < n; i++) {
          const at = groups[i]
          if (!at) continue
          tl.to(
            at.position,
            { x: 0, y: Y_ATOMS, z: 0, duration: FLY_DUR, ease: 'power1.in' },
            0,
          )
          tl.to(
            at.scale,
            { x: 0.32, y: 0.32, z: 0.32, duration: FLY_DUR, ease: 'power2.in' },
            0,
          )
        }
        tl.call(
          () => {
            for (let i = 0; i < n; i++) {
              const g = groups[i]
              if (g) g.visible = false
            }
            tAcc.current = 0
            phaseRef.current = 'mergeFlash'
            setPhase('mergeFlash')
          },
          undefined,
          FLY_DUR,
        )
      })
    }

    let activeCtx: ReturnType<typeof buildFlyTl> | null = null
    let cancelled = false
    let rafLoop = 0
    const MAX_FLY_START_FRAMES = 12

    const readGroups = (): (THREE.Group | null)[] =>
      Array.from({ length: n }, (_, i) => atomGroupRefs.current[i] ?? null)

    const tryStart = (frame: number) => {
      if (cancelled) return
      const groups = readGroups()
      if (groups.some((g) => g == null)) {
        if (frame < MAX_FLY_START_FRAMES) {
          rafLoop = requestAnimationFrame(() => tryStart(frame + 1))
        }
        return
      }
      if (activeCtx) activeCtx.revert()
      activeCtx = buildFlyTl(groups)
    }

    {
      const groups = readGroups()
      if (n >= 2 && groups.every((g) => g != null)) {
        activeCtx = buildFlyTl(groups)
      } else {
        rafLoop = requestAnimationFrame(() => tryStart(0))
      }
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(rafLoop)
      activeCtx?.revert()
    }
  }, [runId, n, slotsKey])

  const sparkleHex = product?.accentColor ?? '#3dffec'

  useFrame((_, delta) => {
    const ph = phaseRef.current
    if (ph === 'mergeFlash') {
      tAcc.current += delta
      if (tAcc.current >= MERGE_FLASH_DUR) {
        tAcc.current = 0
        if (product) {
          phaseRef.current = 'product'
          setPhase('product')
          setFxLevel('low')
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
    const pts = positionsOnCircle(n, 1.08)
    const grps: (THREE.Group | null)[] = Array.from({ length: n }, (_, i) => atomGroupRefs.current[i] ?? null)
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
  }, [phase, runId, n, slotsKey])

  const mountCatalogSubstance = !!product && (phase === 'mergeFlash' || phase === 'product')
  const showCatalogSubstance = !!product && phase === 'product'
  const inMerge = phase === 'mergeFlash'
  const hasCatalogLights = showCatalogSubstance
  const lightsHero = (phase === 'product' && !!product) || (inMerge && !product)
  const showAtomModels = (phase === 'flying' || phase === 'failBounce') && n >= 2

  /* Не возвращаем `null` целиком: иначе в R3F остаётся пустой кадр; при n<2 — тёмный фон + свет. */
  if (n < 2) {
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
            fxLevel={phase === 'mergeFlash' ? 'off' : fxLevel}
            renderQuality="synthesis"
          />
        </group>
      ) : null}

      {showAtomModels
        ? zSlots.map((z, i) => (
            <group
              key={`${i}-${z}`}
              ref={(el) => {
                atomGroupRefs.current[i] = el
              }}
            >
              <group scale={ATOM_SCALE} position={[0, 0, 0]}>
                <SynthesisFlyAtom z={z} />
              </group>
            </group>
          ))
        : null}
    </>
  )
}
