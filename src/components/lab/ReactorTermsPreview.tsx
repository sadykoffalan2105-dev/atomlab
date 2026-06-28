import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { assertPreviewElectronAnimation } from '../../lab/reactorPreviewGuarantee'
import {
  getReactorPreviewPolicy,
  shouldRunGuardTick,
} from '../../lab/synthesisLagGuard'
import {
  applyReactorPreviewLayout,
  createReactorPreviewVisibilityGuard,
} from '../../lab/reactorPreviewVisibilityGuard'
import { requestPreviewLayout } from '../../lab/reactorPreviewLayoutWorkerClient'
import {
  buildReactorPreviewAtoms,
  getTermGroupCenters,
  PREVIEW_ATOM_SCALE,
  reactorPreviewAtomScale,
  type ReactorPreviewAtom,
} from './reactorPreviewLayout'
import {
  getReactorVisualTier,
  termBadgeCoeff,
  type ReactorVisualTier,
} from '../../chemistry/reactorVisualTier'
import { ReactorInstancedAtoms } from './ReactorInstancedAtoms'
import { ReactorCoeffBadge } from './ReactorCoeffBadge'

/**
 * Превью реагентов v1.2.0: instanced atoms, constant scale, coeff → count.
 * GSAP flight uses proxy groups inside ReactorInstancedAtoms.
 */
export function ReactorTermsPreview({
  terms,
  visible = true,
  flightActive = false,
  poseLocked = false,
  sharedLighting = false,
  forceLite = false,
  qualityLevel,
  synthesisGlass: _synthesisGlass = false,
  visualTier: visualTierProp,
  coeffEditBurst = false,
  productPrewarm = false,
  atomGroupRefs: atomGroupRefsExternal,
  atomScaleGroupRefs: atomScaleGroupRefsExternal,
  previewRootRef,
}: {
  terms: readonly ReactorEquationTerm[]
  visible?: boolean
  flightActive?: boolean
  poseLocked?: boolean
  sharedLighting?: boolean
  forceLite?: boolean
  qualityLevel?: import('../../lab/synthesisQualityLadder').SynthesisQualityLevel
  synthesisGlass?: boolean
  visualTier?: ReactorVisualTier
  coeffEditBurst?: boolean
  productPrewarm?: boolean
  atomGroupRefs?: MutableRefObject<(THREE.Group | null)[]>
  atomScaleGroupRefs?: MutableRefObject<(THREE.Group | null)[]>
  previewRootRef?: MutableRefObject<THREE.Group | null>
}) {
  const { invalidate } = useThree()
  const visualTier = visualTierProp ?? getReactorVisualTier(terms)
  const syncPreview = useMemo(
    () => buildReactorPreviewAtoms(terms, { tier: visualTier }),
    [terms, visualTier],
  )
  const [workerAtoms, setWorkerAtoms] = useState<ReactorPreviewAtom[] | null>(null)
  const termsSig = useMemo(
    () => terms.map((t) => `${t.id}:${t.z}:${t.coeff}:${t.diatomic ? 1 : 0}`).join('|'),
    [terms],
  )

  useEffect(() => {
    let cancelled = false
    setWorkerAtoms(null)
    void requestPreviewLayout(terms).then(({ atoms }) => {
      if (!cancelled) setWorkerAtoms(atoms)
    })
    return () => {
      cancelled = true
    }
  }, [termsSig, terms])

  const previewAtoms = workerAtoms ?? syncPreview

  const shellAtomsRef = useRef<readonly ReactorPreviewAtom[]>(previewAtoms)
  const shellEmptyFramesRef = useRef(0)
  const SHELL_HOLD_FRAMES = 8

  if (previewAtoms.length > 0) {
    shellAtomsRef.current = previewAtoms
    shellEmptyFramesRef.current = 0
  }

  const previewLenRef = useRef(previewAtoms.length)
  previewLenRef.current = previewAtoms.length

  const shellHoldActive = coeffEditBurst || productPrewarm
  const useShell =
    previewAtoms.length === 0 &&
    shellAtomsRef.current.length > 0 &&
    (shellHoldActive || shellEmptyFramesRef.current < SHELL_HOLD_FRAMES)
  const renderAtoms = previewAtoms.length > 0 ? previewAtoms : useShell ? shellAtomsRef.current : []
  const n = renderAtoms.length
  const groupVisible =
    visible && (n > 0 || (shellHoldActive && shellAtomsRef.current.length > 0))

  const groupRef = useRef<THREE.Group>(null)
  const visibilityGuardRef = useRef(createReactorPreviewVisibilityGuard())
  const guardFrameRef = useRef(0)
  const atomGroupRefsLocal = useRef<(THREE.Group | null)[]>([])
  const atomScaleGroupRefsLocal = useRef<(THREE.Group | null)[]>([])
  const atomGroupRefs = atomGroupRefsExternal ?? atomGroupRefsLocal
  const atomScaleGroupRefs = atomScaleGroupRefsExternal ?? atomScaleGroupRefsLocal
  const scale = reactorPreviewAtomScale(n)

  const activeTerms = useMemo(
    () => terms.filter((t) => Math.floor(t.coeff) > 0),
    [terms],
  )
  const termCenters = useMemo(() => getTermGroupCenters(terms), [terms])
  const badges = useMemo(() => {
    return activeTerms
      .map((t, ti) => {
        const badge = termBadgeCoeff(t.coeff, visualTier, activeTerms.length)
        if (badge == null) return null
        const center = termCenters.find((c) => c.termIndex === ti)
        if (!center) return null
        return { coeff: badge, pos: center.pos as [number, number, number] }
      })
      .filter(Boolean) as { coeff: number; pos: [number, number, number] }[]
  }, [activeTerms, visualTier, termCenters])

  const previewPolicy = useMemo(
    () =>
      getReactorPreviewPolicy({
        atomCount: n,
        forceLite: forceLite || coeffEditBurst,
        flightActive,
        visible,
        visualTier,
        qualityLevel,
        coeffEditBurst,
      }),
    [n, forceLite, qualityLevel, flightActive, visible, visualTier, coeffEditBurst],
  )
  const { electronAnimate, driftAtoms, slowSpin, visibilityGuardEvery } = previewPolicy
  const electronFrameSkip = coeffEditBurst ? 3 : flightActive ? 2 : 1

  useEffect(() => {
    assertPreviewElectronAnimation(electronAnimate, n)
  }, [electronAnimate, n])

  const syncLayout = useCallback(() => {
    applyReactorPreviewLayout(renderAtoms, atomGroupRefs, atomScaleGroupRefs, scale)
  }, [renderAtoms, scale, atomGroupRefs, atomScaleGroupRefs])

  const layoutSyncRafRef = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (flightActive || poseLocked || n === 0) return
    if (layoutSyncRafRef.current != null) cancelAnimationFrame(layoutSyncRafRef.current)
    layoutSyncRafRef.current = requestAnimationFrame(() => {
      layoutSyncRafRef.current = null
      syncLayout()
      invalidate()
    })
    return () => {
      if (layoutSyncRafRef.current != null) cancelAnimationFrame(layoutSyncRafRef.current)
    }
  }, [flightActive, poseLocked, termsSig, syncLayout, invalidate, n])

  useFrame((s) => {
    if (previewLenRef.current === 0 && shellAtomsRef.current.length > 0 && !shellHoldActive) {
      shellEmptyFramesRef.current += 1
      if (shellEmptyFramesRef.current <= SHELL_HOLD_FRAMES) invalidate()
    }

    guardFrameRef.current += 1
    if (shouldRunGuardTick(guardFrameRef.current, visibilityGuardEvery)) {
      visibilityGuardRef.current.tick({
        atomCount: n,
        atomGroupRefs,
        atomScaleGroupRefs,
        layoutScale: scale,
        previewAtoms: renderAtoms,
        rootVisible: groupVisible,
        flightActive,
        allowRecover: true,
        onRecover: syncLayout,
      })
    }

    if (!groupVisible || flightActive || n === 0) return
    const t = s.clock.elapsedTime
    const root = groupRef.current
    if (root && slowSpin) root.rotation.y = t * (n > 18 ? 0.032 : 0.04)

    if (!driftAtoms) return
    for (let i = 0; i < n; i++) {
      const g = atomGroupRefs.current[i] ?? null
      if (!g) continue
      const { pos } = renderAtoms[i]!
      const [bx, by, bz] = pos
      const ph = i * 1.6 + renderAtoms[i]!.z * 0.37
      const amp = n > 18 ? 0.028 : 0.042
      g.position.set(
        bx + Math.sin(t * 0.32 + ph) * amp,
        by + Math.sin(t * 0.25 + ph * 0.9) * amp * 0.7,
        bz + Math.cos(t * 0.28 + ph * 1.05) * amp,
      )
    }
  })

  useLayoutEffect(() => {
    if (previewRootRef) previewRootRef.current = groupRef.current
  }, [previewRootRef, n])

  return (
    <group ref={groupRef} visible={groupVisible} frustumCulled={false}>
      {!sharedLighting ? (
        <>
          <ambientLight intensity={n > 18 ? 0.38 : 0.22} />
          <directionalLight position={[4, 6, 2]} intensity={n > 18 ? 0.72 : 0.55} color="#b8c8ff" />
          {n > 18 ? (
            <pointLight position={[0, 0.5, 2.5]} intensity={1.1} distance={12} color="#7afcff" />
          ) : null}
        </>
      ) : null}
      <ReactorInstancedAtoms
        atoms={renderAtoms}
        visible={groupVisible}
        scale={PREVIEW_ATOM_SCALE}
        electronAnimate={electronAnimate}
        electronFrameSkip={electronFrameSkip}
        flightActive={flightActive}
        poseLocked={poseLocked}
        atomGroupRefs={atomGroupRefs}
        atomScaleGroupRefs={atomScaleGroupRefs}
      />
      {badges.map((b, i) => (
        <ReactorCoeffBadge key={`badge-${i}-${b.coeff}`} coeff={b.coeff} position={b.pos} />
      ))}
    </group>
  )
}
