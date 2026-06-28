import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
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
import { ReactorPreviewAtomSlot } from './ReactorPreviewAtomSlot'
import { buildReactorPreviewAtoms, reactorPreviewAtomScale } from './reactorPreviewLayout'
import { getReactorVisualTier, type ReactorVisualTier } from '../../chemistry/reactorVisualTier'
import { SYNTHESIS_PERF } from '../../lab/synthesisPerfPreset'

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
  coeffEditBurst = false,
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
  /** Серия быстрых +/- — без drift и реже layout-sync. */
  coeffEditBurst?: boolean
  atomGroupRefs?: MutableRefObject<(THREE.Group | null)[]>
  atomScaleGroupRefs?: MutableRefObject<(THREE.Group | null)[]>
  previewRootRef?: MutableRefObject<THREE.Group | null>
}) {
  const { invalidate } = useThree()
  const visualTier = visualTierProp ?? getReactorVisualTier(terms)
  const previewAtoms = useMemo(
    () => buildReactorPreviewAtoms(terms, { tier: visualTier }),
    [terms, visualTier],
  )
  const termsSig = useMemo(
    () => terms.map((t) => `${t.id}:${t.z}:${t.coeff}:${t.diatomic ? 1 : 0}`).join('|'),
    [terms],
  )
  const activeTermIds = useMemo(
    () => terms.filter((t) => Math.floor(t.coeff) > 0).map((t) => t.id),
    [terms],
  )

  const n = previewAtoms.length
  const groupRef = useRef<THREE.Group>(null)
  const visibilityGuardRef = useRef(createReactorPreviewVisibilityGuard())
  const guardFrameRef = useRef(0)
  const atomGroupRefsLocal = useRef<(THREE.Group | null)[]>([])
  const atomScaleGroupRefsLocal = useRef<(THREE.Group | null)[]>([])
  const atomGroupRefs = atomGroupRefsExternal ?? atomGroupRefsLocal
  const atomScaleGroupRefs = atomScaleGroupRefsExternal ?? atomScaleGroupRefsLocal
  const scale = reactorPreviewAtomScale(n)
  /** Гистерезис: не переключать full↔lite при каждом +/- у порога 12 атомов. */
  const fullDetailLatchRef = useRef(false)
  const allowFullDetail = visualTier === 'full' && !forceLite
  if (allowFullDetail && n <= SYNTHESIS_PERF.fullDetailAtomThreshold) {
    fullDetailLatchRef.current = true
  } else if (n > SYNTHESIS_PERF.fullDetailAtomThreshold + 4) {
    fullDetailLatchRef.current = false
  }
  const useFullDetail = fullDetailLatchRef.current

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

  /** Только расширяем массивы refs — не обрезаем (обрезка давала «мигание» при unmount). */
  useLayoutEffect(() => {
    while (atomGroupRefs.current.length < n) atomGroupRefs.current.push(null)
    while (atomScaleGroupRefs.current.length < n) atomScaleGroupRefs.current.push(null)
  }, [n, atomGroupRefs, atomScaleGroupRefs])

  const syncLayout = useCallback(() => {
    applyReactorPreviewLayout(previewAtoms, atomGroupRefs, atomScaleGroupRefs, scale)
  }, [previewAtoms, scale, atomGroupRefs, atomScaleGroupRefs])

  const layoutSyncRafRef = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (flightActive || poseLocked) return
    if (layoutSyncRafRef.current != null) cancelAnimationFrame(layoutSyncRafRef.current)
    layoutSyncRafRef.current = requestAnimationFrame(() => {
      layoutSyncRafRef.current = null
      syncLayout()
      invalidate()
    })
    return () => {
      if (layoutSyncRafRef.current != null) cancelAnimationFrame(layoutSyncRafRef.current)
    }
  }, [flightActive, poseLocked, termsSig, syncLayout, invalidate])

  useFrame((s) => {
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
        onRecover: syncLayout,
      })
    }

    if (!visible || flightActive) return
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
          forceLite: forceLite || coeffEditBurst,
          qualityLevel,
        })
        const termKey = activeTermIds[atom.termIndex] ?? `t${atom.termIndex}`
        const [ax, ay, az] = atom.pos
        const slotKey = `${termKey}-${atom.atomInTerm}-${atom.z}`
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
                  flightActive
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
    </group>
  )
}
