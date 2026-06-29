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
import { useReactorPreviewLayout } from '../../lab/useReactorPreviewLayout'
import {
  applyReactorPreviewLayout,
  createReactorPreviewVisibilityGuard,
} from '../../lab/reactorPreviewVisibilityGuard'
import { ReactorPreviewAtomSlot } from './ReactorPreviewAtomSlot'
import {
  reactorPreviewAtomScale,
  type ReactorPreviewAtom,
} from './reactorPreviewLayout'
import { SYNTHESIS_PERF } from '../../lab/synthesisPerfPreset'

/**
 * Превью реагентов: полная Bohr-модель (протоны, нейтроны, электроны).
 * Число 3D-моделей = коэффициент. При flightActive позиции управляет GSAP.
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
  coeffEditBurst = false,
  productPrewarm: _productPrewarm = false,
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
  coeffEditBurst?: boolean
  productPrewarm?: boolean
  atomGroupRefs?: MutableRefObject<(THREE.Group | null)[]>
  atomScaleGroupRefs?: MutableRefObject<(THREE.Group | null)[]>
  previewRootRef?: MutableRefObject<THREE.Group | null>
}) {
  const { invalidate } = useThree()
  const previewAtoms = useReactorPreviewLayout(terms, coeffEditBurst)
  const termsSig = useMemo(
    () => terms.map((t) => `${t.id}:${t.z}:${t.coeff}:${t.diatomic ? 1 : 0}`).join('|'),
    [terms],
  )

  const shellAtomsRef = useRef<readonly ReactorPreviewAtom[]>(previewAtoms)
  const shellEmptyFramesRef = useRef(0)
  const slotZRef = useRef<number[]>([])
  const SHELL_HOLD_FRAMES = 120
  const maxPoolRef = useRef(0)

  if (previewAtoms.length > 0) {
    shellAtomsRef.current = previewAtoms
    shellEmptyFramesRef.current = 0
  }

  const previewLenRef = useRef(previewAtoms.length)
  previewLenRef.current = previewAtoms.length

  const shellHoldActive = coeffEditBurst && !visible
  const useShell =
    previewAtoms.length === 0 &&
    shellAtomsRef.current.length > 0 &&
    (shellHoldActive || shellEmptyFramesRef.current < SHELL_HOLD_FRAMES)
  const renderAtoms = previewAtoms.length > 0 ? previewAtoms : useShell ? shellAtomsRef.current : []
  const n = renderAtoms.length
  maxPoolRef.current = Math.max(maxPoolRef.current, n)
  if (terms.length === 0 && n === 0) maxPoolRef.current = 0
  const poolSize = maxPoolRef.current

  for (let i = 0; i < n; i++) {
    slotZRef.current[i] = renderAtoms[i]!.z
  }

  const shouldRender =
    n > 0 &&
    (visible ||
      shellHoldActive ||
      (shellEmptyFramesRef.current < SHELL_HOLD_FRAMES && shellAtomsRef.current.length > 0))
  const groupVisible = shouldRender && (visible || shellHoldActive)

  const groupRef = useRef<THREE.Group>(null)
  const visibilityGuardRef = useRef(createReactorPreviewVisibilityGuard())
  const guardFrameRef = useRef(0)
  const atomGroupRefsLocal = useRef<(THREE.Group | null)[]>([])
  const atomScaleGroupRefsLocal = useRef<(THREE.Group | null)[]>([])
  const atomGroupRefs = atomGroupRefsExternal ?? atomGroupRefsLocal
  const atomScaleGroupRefs = atomScaleGroupRefsExternal ?? atomScaleGroupRefsLocal
  const scale = reactorPreviewAtomScale(n)
  const fullDetailLatchRef = useRef(false)
  const allowFullDetail = !forceLite && !coeffEditBurst
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
        visible: groupVisible,
        visualTier: 'full',
        qualityLevel,
        coeffEditBurst,
      }),
    [n, forceLite, qualityLevel, flightActive, groupVisible, coeffEditBurst],
  )
  const { electronAnimate, driftAtoms, slowSpin, visibilityGuardEvery } = previewPolicy

  useEffect(() => {
    assertPreviewElectronAnimation(electronAnimate, n)
  }, [electronAnimate, n])

  useLayoutEffect(() => {
    while (atomGroupRefs.current.length < poolSize) atomGroupRefs.current.push(null)
    while (atomScaleGroupRefs.current.length < poolSize) atomScaleGroupRefs.current.push(null)
  }, [poolSize, atomGroupRefs, atomScaleGroupRefs])

  const syncLayout = useCallback(() => {
    applyReactorPreviewLayout(renderAtoms, atomGroupRefs, atomScaleGroupRefs, scale)
  }, [renderAtoms, scale, atomGroupRefs, atomScaleGroupRefs])

  const layoutSyncRafRef = useRef<number | null>(null)
  const layoutSyncTimerRef = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (flightActive || poseLocked || n === 0) return
    if (layoutSyncTimerRef.current != null) window.clearTimeout(layoutSyncTimerRef.current)
    if (layoutSyncRafRef.current != null) cancelAnimationFrame(layoutSyncRafRef.current)
    layoutSyncTimerRef.current = null
    layoutSyncRafRef.current = null
    const run = () => {
      layoutSyncTimerRef.current = null
      layoutSyncRafRef.current = null
      syncLayout()
      invalidate()
    }
    if (coeffEditBurst) {
      layoutSyncTimerRef.current = window.setTimeout(run, 32)
    } else {
      layoutSyncRafRef.current = requestAnimationFrame(run)
    }
    return () => {
      if (layoutSyncTimerRef.current != null) window.clearTimeout(layoutSyncTimerRef.current)
      if (layoutSyncRafRef.current != null) cancelAnimationFrame(layoutSyncRafRef.current)
    }
  }, [flightActive, poseLocked, termsSig, syncLayout, invalidate, n, coeffEditBurst])

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
        allowRecover: !coeffEditBurst,
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
      const amp = n > 18 ? 0.022 : 0.032
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

  useLayoutEffect(() => {
    const g = groupRef.current
    if (!g) return
    g.visible = groupVisible
    if (!groupVisible) {
      for (let i = 0; i < atomGroupRefs.current.length; i++) {
        const posG = atomGroupRefs.current[i]
        const scaleG = atomScaleGroupRefs.current[i]
        if (posG) posG.visible = false
        if (scaleG) scaleG.visible = false
      }
    }
  }, [groupVisible, atomGroupRefs, atomScaleGroupRefs])

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
      {Array.from({ length: poolSize }, (_, i) => {
        const atom = i < n ? renderAtoms[i]! : null
        const active = atom != null
        const slotZ = atom?.z ?? slotZRef.current[i] ?? 1
        const atomPolicy = getReactorAtomRenderPolicy({
          atomCount: n,
          atomZ: slotZ,
          forceLite: forceLite || coeffEditBurst,
          qualityLevel,
          coeffEditBurst,
        })
        const [ax, ay, az] = atom?.pos ?? [0, 0, 0]
        const slotVisible = active && groupVisible
        return (
          <group
            key={`pool-${i}`}
            visible={slotVisible}
            ref={(el) => {
              atomGroupRefs.current[i] = el
              if (el && active) {
                el.visible = true
                if (!flightActive && !poseLocked) {
                  el.position.set(ax, ay, az)
                }
              }
            }}
          >
            <group
              scale={scale}
              visible={slotVisible}
              ref={(el) => {
                atomScaleGroupRefs.current[i] = el
                if (el && active) {
                  el.visible = true
                  if (!flightActive && !poseLocked) {
                    el.scale.set(scale, scale, scale)
                  }
                }
              }}
            >
              <ReactorPreviewAtomSlot
                z={slotZ}
                animate={active && electronAnimate}
                previewStatic={!active || !electronAnimate}
                useFullDetail={useFullDetail && !flightActive && active}
                synthesisGlass={synthesisGlass && (flightActive || poseLocked) && active}
                previewLite={!useFullDetail}
                electronFrameSkip={
                  coeffEditBurst
                    ? Math.max(atomPolicy.electronFrameSkip, 2)
                    : flightActive
                      ? Math.max(atomPolicy.electronFrameSkip, 2)
                      : atomPolicy.electronFrameSkip
                }
                hideOrbitRings={false}
                localLight={!sharedLighting}
              />
            </group>
          </group>
        )
      })}
    </group>
  )
}
