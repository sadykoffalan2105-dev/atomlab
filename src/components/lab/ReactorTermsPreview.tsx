import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
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
import { AtomStructureModel } from './AtomStructureModel'
import { buildReactorPreviewAtoms, reactorPreviewAtomScale } from './reactorPreviewLayout'
import { getReactorVisualTier, type ReactorVisualTier } from '../../chemistry/reactorVisualTier'
import { SYNTHESIS_PERF } from '../../lab/synthesisPerfPreset'

/** Кадры после смены коэффициентов — не дёргать layout/guard (refs ещё монтируются). */
const LAYOUT_SETTLE_FRAMES = 8

/**
 * Превью реагентов: полная структура атома (протоны, нейтроны, электроны).
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
  atomGroupRefs: atomGroupRefsExternal,
  atomScaleGroupRefs: atomScaleGroupRefsExternal,
  previewRootRef,
}: {
  terms: readonly ReactorEquationTerm[]
  visible?: boolean
  /** true: drift/GSAP владеют позициями (converge → merge) */
  flightActive?: boolean
  /** true: не сбрасывать позиции/scale к layout (весь синтез) */
  poseLocked?: boolean
  /** true: свет даёт LabReactorLights — без дубля и скачков яркости */
  sharedLighting?: boolean
  /** FPS-governor / плотное превью — lite-модели и реже guard */
  forceLite?: boolean
  qualityLevel?: import('../../lab/synthesisQualityLadder').SynthesisQualityLevel
  /** Стеклянная оболочка атома (только когда разрешено quality ladder). */
  synthesisGlass?: boolean
  /** Tiered visual cap (full | lite | cluster). */
  visualTier?: ReactorVisualTier
  atomGroupRefs?: MutableRefObject<(THREE.Group | null)[]>
  atomScaleGroupRefs?: MutableRefObject<(THREE.Group | null)[]>
  previewRootRef?: MutableRefObject<THREE.Group | null>
}) {
  const visualTier = visualTierProp ?? getReactorVisualTier(terms)
  const previewAtoms = useMemo(
    () => buildReactorPreviewAtoms(terms, { tier: visualTier }),
    [terms, visualTier],
  )
  const termsSig = useMemo(
    () => terms.map((t) => `${t.id}:${t.z}:${t.coeff}:${t.diatomic ? 1 : 0}`).join('|'),
    [terms],
  )
  const termIds = useMemo(() => terms.map((t) => t.id), [terms])

  const n = previewAtoms.length
  const groupRef = useRef<THREE.Group>(null)
  const visibilityGuardRef = useRef(createReactorPreviewVisibilityGuard())
  const guardFrameRef = useRef(0)
  const settleFramesRef = useRef(0)
  const atomGroupRefsLocal = useRef<(THREE.Group | null)[]>([])
  const atomScaleGroupRefsLocal = useRef<(THREE.Group | null)[]>([])
  const atomGroupRefs = atomGroupRefsExternal ?? atomGroupRefsLocal
  const atomScaleGroupRefs = atomScaleGroupRefsExternal ?? atomScaleGroupRefsLocal
  const scale = reactorPreviewAtomScale(n)
  /** Полная Bohr-модель до порога; lite только при очень плотном превью / cluster. */
  const useFullDetail =
    visualTier === 'full' && n <= SYNTHESIS_PERF.fullDetailAtomThreshold && !forceLite

  const previewPolicy = useMemo(
    () =>
      getReactorPreviewPolicy({
        atomCount: n,
        forceLite,
        flightActive,
        visible,
        visualTier,
        qualityLevel,
      }),
    [n, forceLite, qualityLevel, flightActive, visible, visualTier],
  )
  const { electronAnimate, driftAtoms, slowSpin, visibilityGuardEvery } = previewPolicy

  useEffect(() => {
    assertPreviewElectronAnimation(electronAnimate, n)
  }, [electronAnimate, n])

  /** Только расширяем массивы — не затираем refs после bind (гонка с SynthesisConvergeStreams). */
  useLayoutEffect(() => {
    while (atomGroupRefs.current.length < n) atomGroupRefs.current.push(null)
    if (atomGroupRefs.current.length > n) atomGroupRefs.current.length = n
    while (atomScaleGroupRefs.current.length < n) atomScaleGroupRefs.current.push(null)
    if (atomScaleGroupRefs.current.length > n) atomScaleGroupRefs.current.length = n
  }, [n, atomGroupRefs, atomScaleGroupRefs])

  const syncLayout = useCallback(() => {
    applyReactorPreviewLayout(previewAtoms, atomGroupRefs, atomScaleGroupRefs, scale)
  }, [previewAtoms, scale, atomGroupRefs, atomScaleGroupRefs])

  useLayoutEffect(() => {
    visibilityGuardRef.current.reset()
    guardFrameRef.current = 0
    settleFramesRef.current = LAYOUT_SETTLE_FRAMES
  }, [termsSig, n])

  useLayoutEffect(() => {
    if (flightActive || poseLocked) return
    syncLayout()
  }, [flightActive, poseLocked, termsSig, syncLayout])

  useFrame((s) => {
    if (settleFramesRef.current > 0) settleFramesRef.current -= 1
    const layoutSettling = settleFramesRef.current > 0

    guardFrameRef.current += 1
    if (shouldRunGuardTick(guardFrameRef.current, visibilityGuardEvery)) {
      visibilityGuardRef.current.tick({
        atomCount: n,
        atomGroupRefs,
        atomScaleGroupRefs,
        layoutScale: scale,
        previewAtoms,
        rootVisible: visible,
        flightActive,
        layoutSettling,
        onRecover: syncLayout,
      })
    }

    if (!visible || flightActive || layoutSettling) return
    const t = s.clock.elapsedTime
    const root = groupRef.current
    if (root && slowSpin) root.rotation.y = t * (n > 18 ? 0.032 : 0.04)

    if (!driftAtoms) return
    for (let i = 0; i < n; i++) {
      const g = atomGroupRefs.current[i] ?? null
      if (!g) continue
      const { pos } = previewAtoms[i]!
      const [bx, by, bz] = pos
      const ph = i * 1.6 + previewAtoms[i]!.z * 0.37
      const amp = n > 18 ? 0.028 : 0.042
      g.position.set(
        bx + Math.sin(t * 0.32 + ph) * amp,
        by + Math.sin(t * 0.25 + ph * 0.9) * amp * 0.7,
        bz + Math.cos(t * 0.28 + ph * 1.05) * amp,
      )
    }
  })

  if (n === 0) return null

  useLayoutEffect(() => {
    if (previewRootRef) previewRootRef.current = groupRef.current
  }, [previewRootRef])

  return (
    <group ref={groupRef} visible frustumCulled={false}>
      {!sharedLighting ? (
        <>
          <ambientLight intensity={n > 18 ? 0.38 : 0.22} />
          <directionalLight position={[4, 6, 2]} intensity={n > 18 ? 0.72 : 0.55} color="#b8c8ff" />
          {n > 18 ? (
            <pointLight position={[0, 0.5, 2.5]} intensity={1.1} distance={12} color="#7afcff" />
          ) : null}
        </>
      ) : null}
      {previewAtoms.map((atom, i) => {
        const atomPolicy = getReactorAtomRenderPolicy({
          atomCount: n,
          atomZ: atom.z,
          forceLite,
          qualityLevel,
        })
        const termKey = termIds[atom.termIndex] ?? `t${atom.termIndex}`
        const [ax, ay, az] = atom.pos
        return (
          <group
            key={`${termKey}-${atom.atomInTerm}-${atom.z}`}
            ref={(el) => {
              atomGroupRefs.current[i] = el
              if (el && !flightActive && !poseLocked) {
                el.position.set(ax, ay, az)
              }
            }}
          >
            <group
              scale={scale}
              ref={(el) => {
                atomScaleGroupRefs.current[i] = el
                if (el && !flightActive && !poseLocked) {
                  el.scale.set(scale, scale, scale)
                }
              }}
            >
              <AtomStructureModel
                z={atom.z}
                animate={electronAnimate}
                previewStatic={false}
                previewEmphasis
                synthesisDetail={useFullDetail && !flightActive}
                synthesisGlass={synthesisGlass && (flightActive || poseLocked)}
                previewLite={!useFullDetail}
                electronFrameSkip={flightActive ? Math.max(atomPolicy.electronFrameSkip, 2) : atomPolicy.electronFrameSkip}
                hideOrbitRings={visualTier === 'cluster'}
                localLight={!sharedLighting}
              />
            </group>
          </group>
        )
      })}
    </group>
  )
}
