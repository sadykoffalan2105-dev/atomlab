import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { assertPreviewElectronAnimation } from '../../lab/reactorPreviewGuarantee'
import {
  getReactorAtomRenderPolicy,
  getReactorPreviewPolicy,
  shouldRunGuardTick,
} from '../../lab/synthesisLagGuard'
import {
  applyReactorPreviewLayout,
  createReactorPreviewVisibilityGuard,
} from '../../lab/reactorPreviewVisibilityGuard'
import { ReactorPreviewAtomSlot } from './ReactorPreviewAtomSlot'
import {
  buildReactorPreviewAtoms,
  getTermGroupCenters,
  reactorPreviewAtomScale,
  type ReactorPreviewAtom,
} from './reactorPreviewLayout'
import {
  getReactorVisualTier,
  termBadgeCoeff,
  type ReactorVisualTier,
} from '../../chemistry/reactorVisualTier'
import { ReactorCoeffBadge } from './ReactorCoeffBadge'
import { SYNTHESIS_PERF } from '../../lab/synthesisPerfPreset'

/**
 * Превью реагентов: полная Bohr-модель (протоны, нейтроны, электроны).
 * При flightActive позиции управляет GSAP (SynthesisConvergeStreams), не useFrame.
 */
export function ReactorTermsPreview({
  terms,
  visible = true,
  flightActive = false,
  poseLocked = false,
  sharedLighting = false,
  forceLite = false,
  qualityLevel,
  synthesisGlass = false,
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
  const activeTermIds = useMemo(
    () => terms.filter((t) => Math.floor(t.coeff) > 0).map((t) => t.id),
    [terms],
  )
  const visualTierComputed = visualTierProp ?? getReactorVisualTier(terms)
  const visualTierLatchRef = useRef(visualTierComputed)
  if (!coeffEditBurst) visualTierLatchRef.current = visualTierComputed
  const visualTier = coeffEditBurst ? visualTierLatchRef.current : visualTierComputed
  const previewAtoms = useMemo(
    () => buildReactorPreviewAtoms(terms, { tier: visualTier }),
    [terms, visualTier],
  )
  const termsSig = useMemo(
    () => terms.map((t) => `${t.id}:${t.z}:${t.coeff}:${t.diatomic ? 1 : 0}`).join('|'),
    [terms],
  )

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
    visible && (n > 0 || ((shellHoldActive || shellEmptyFramesRef.current < SHELL_HOLD_FRAMES) && shellAtomsRef.current.length > 0))

  const groupRef = useRef<THREE.Group>(null)
  const visibilityGuardRef = useRef(createReactorPreviewVisibilityGuard())
  const guardFrameRef = useRef(0)
  const atomGroupRefsLocal = useRef<(THREE.Group | null)[]>([])
  const atomScaleGroupRefsLocal = useRef<(THREE.Group | null)[]>([])
  const atomGroupRefs = atomGroupRefsExternal ?? atomGroupRefsLocal
  const atomScaleGroupRefs = atomScaleGroupRefsExternal ?? atomScaleGroupRefsLocal
  const scale = reactorPreviewAtomScale(n)
  const fullDetailLatchRef = useRef(false)
  const allowFullDetail = visualTier === 'full' && !forceLite && !coeffEditBurst
  if (allowFullDetail && n <= SYNTHESIS_PERF.fullDetailAtomThreshold) {
    fullDetailLatchRef.current = true
  } else if (n > SYNTHESIS_PERF.fullDetailAtomThreshold + 4) {
    fullDetailLatchRef.current = false
  }
  const useFullDetail = fullDetailLatchRef.current

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

  useEffect(() => {
    assertPreviewElectronAnimation(electronAnimate, n)
  }, [electronAnimate, n])

  useLayoutEffect(() => {
    while (atomGroupRefs.current.length < n) atomGroupRefs.current.push(null)
    while (atomScaleGroupRefs.current.length < n) atomScaleGroupRefs.current.push(null)
  }, [n, atomGroupRefs, atomScaleGroupRefs])

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
      {renderAtoms.map((atom, i) => {
        const atomPolicy = getReactorAtomRenderPolicy({
          atomCount: n,
          atomZ: atom.z,
          forceLite: forceLite || coeffEditBurst,
          qualityLevel,
          coeffEditBurst,
        })
        const termKey = activeTermIds[atom.termIndex] ?? `t${atom.termIndex}`
        const slotKey = `${termKey}-${atom.atomInTerm}-${atom.z}`
        const [ax, ay, az] = atom.pos
        return (
          <group
            key={slotKey}
            ref={(el) => {
              atomGroupRefs.current[i] = el
              if (el) {
                el.visible = true
                if (!flightActive && !poseLocked) {
                  el.position.set(ax, ay, az)
                }
              }
            }}
          >
            <group
              scale={scale}
              ref={(el) => {
                atomScaleGroupRefs.current[i] = el
                if (el) {
                  el.visible = true
                  if (!flightActive && !poseLocked) {
                    el.scale.set(scale, scale, scale)
                  }
                }
              }}
            >
              <ReactorPreviewAtomSlot
                z={atom.z}
                animate={electronAnimate}
                useFullDetail={useFullDetail && !flightActive}
                synthesisGlass={synthesisGlass && (flightActive || poseLocked)}
                previewLite={!useFullDetail}
                electronFrameSkip={
                  coeffEditBurst
                    ? Math.max(atomPolicy.electronFrameSkip, 2)
                    : flightActive
                      ? Math.max(atomPolicy.electronFrameSkip, 2)
                      : atomPolicy.electronFrameSkip
                }
                hideOrbitRings={visualTier === 'cluster'}
                localLight={!sharedLighting}
              />
            </group>
          </group>
        )
      })}
      {badges.map((b, i) => (
        <ReactorCoeffBadge key={`badge-${i}-${b.coeff}`} coeff={b.coeff} position={b.pos} />
      ))}
    </group>
  )
}
