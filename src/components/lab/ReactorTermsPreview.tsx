import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { assertPreviewElectronAnimation } from '../../lab/reactorPreviewGuarantee'
import { resolveReactorEditPerfFlags } from '../../lab/reactorEditPerfMode'
import { createReactorInvalidateThrottle } from '../../lab/reactorInvalidateThrottle'
import {
  getReactorAtomRenderPolicy,
  getReactorPreviewPolicy,
  shouldRunGuardTick,
} from '../../lab/synthesisLagGuard'
import { SYNTHESIS_PERF } from '../../lab/synthesisPerfPreset'
import { getLowPowerDeviceProfile } from '../../lab/lowPowerDeviceProfile'
import { getSynthesisDeviceTier } from '../../lab/synthesisDeviceTier'
import { warnIfReactorVisualDegraded } from '../../lab/reactorVisualPreservation'
import { useReactorPreviewLayout } from '../../lab/useReactorPreviewLayout'
import { buildPreviewRenderSnapshot } from '../../lab/previewRenderAtoms'
import { pinPreviewAtomsOnScreen } from '../../lab/previewAtomFrameGuard'
import {
  applyReactorPreviewLayoutSlots,
  createReactorPreviewVisibilityGuard,
} from '../../lab/reactorPreviewVisibilityGuard'
import { ReactorPreviewAtomSlot } from './ReactorPreviewAtomSlot'
import {
  reactorPreviewAtomScale,
  type ReactorPreviewAtom,
} from './reactorPreviewLayout'

/**
 * Превью реагентов: полная Bohr-модель (протоны, нейтроны, электроны, орбиты).
 * Число 3D-моделей = коэффициент. Perf-слой — только debounce/throttle/guard.
 */
export function ReactorTermsPreview({
  terms,
  visible: _visible = true,
  flightActive = false,
  poseLocked = false,
  sharedLighting = false,
  forceLite = false,
  qualityLevel,
  synthesisGlass = false,
  coeffEditBurst = false,
  coeffEditing = coeffEditBurst,
  previewOnlyMode = false,
  synthHoldPreview = false,
  productPrewarm: _productPrewarm = false,
  lowPower = false,
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
  coeffEditing?: boolean
  /** До запуска синтеза — атомы всегда на экране */
  previewOnlyMode?: boolean
  /** Во время синтеза до отрисовки продукта — атомы не скрываем */
  synthHoldPreview?: boolean
  productPrewarm?: boolean
  lowPower?: boolean
  atomGroupRefs?: MutableRefObject<(THREE.Group | null)[]>
  atomScaleGroupRefs?: MutableRefObject<(THREE.Group | null)[]>
  previewRootRef?: MutableRefObject<THREE.Group | null>
}) {
  const { invalidate } = useThree()
  const lowPowerProfile = useMemo(() => getLowPowerDeviceProfile(getSynthesisDeviceTier()), [])
  const perf = useMemo(
    () =>
      resolveReactorEditPerfFlags({
        coeffEditBurst,
        coeffEditing,
        forceLite,
        lowPower,
        layoutDebounceMs: lowPower ? lowPowerProfile.coeffEditLayoutDebounceMs : undefined,
      }),
    [coeffEditBurst, coeffEditing, forceLite, lowPower, lowPowerProfile.coeffEditLayoutDebounceMs],
  )
  const invalidateThrottleRef = useRef(createReactorInvalidateThrottle(perf.maxInvalidateHz))
  useEffect(() => {
    invalidateThrottleRef.current = createReactorInvalidateThrottle(perf.maxInvalidateHz)
  }, [perf.maxInvalidateHz])

  const { atoms: previewAtoms, layoutPending } = useReactorPreviewLayout(
    terms,
    coeffEditBurst,
    perf.layoutDebounceMs,
    coeffEditing,
  )
  const termsSig = useMemo(
    () => terms.map((t) => `${t.id}:${t.z}:${t.coeff}:${t.diatomic ? 1 : 0}`).join('|'),
    [terms],
  )

  const shellAtomsRef = useRef<readonly ReactorPreviewAtom[]>(previewAtoms)
  const shellEmptyFramesRef = useRef(0)
  const slotZRef = useRef<number[]>([])
  const visibleLatchRef = useRef(false)
  const denseLightLatchRef = useRef(false)
  const SHELL_HOLD_FRAMES = layoutPending ? 4800 : coeffEditing ? 2400 : coeffEditBurst ? 480 : 240
  const maxPoolRef = useRef(0)

  const previewLenRef = useRef(previewAtoms.length)
  previewLenRef.current = previewAtoms.length

  const expectedAtomCount = useMemo(() => {
    let count = 0
    for (const t of terms) {
      const c = Math.floor(t.coeff)
      if (c > 0) count += c
    }
    return count
  }, [terms])

  const hasActiveTerms = expectedAtomCount > 0
  const editingActive = coeffEditing || previewOnlyMode

  const snapshot = buildPreviewRenderSnapshot(
    previewAtoms,
    shellAtomsRef.current,
    expectedAtomCount,
    editingActive,
  )
  const renderAtoms = snapshot.atoms

  if (renderAtoms.length > 0) {
    shellAtomsRef.current = renderAtoms
    shellEmptyFramesRef.current = 0
  }

  const n = snapshot.renderCount > 0 ? snapshot.renderCount : renderAtoms.length
  maxPoolRef.current = Math.max(maxPoolRef.current, n, expectedAtomCount)
  if (terms.length === 0 && n === 0) maxPoolRef.current = 0
  const poolSize = maxPoolRef.current

  for (let i = 0; i < n; i++) {
    slotZRef.current[i] = renderAtoms[i]!.z
  }

  const shouldRender =
    terms.length > 0 &&
    hasActiveTerms &&
    (previewOnlyMode ||
      synthHoldPreview ||
      coeffEditing ||
      layoutPending ||
      n > 0 ||
      shellAtomsRef.current.length > 0)

  if (shouldRender && previewOnlyMode) visibleLatchRef.current = true
  const groupVisible =
    previewOnlyMode && visibleLatchRef.current && hasActiveTerms
      ? true
      : shouldRender || (previewOnlyMode && visibleLatchRef.current && hasActiveTerms)

  if (n > 16) denseLightLatchRef.current = true
  else if (n < 12) denseLightLatchRef.current = false
  const useDenseLight = denseLightLatchRef.current

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
        maxAnimatedAtoms: lowPowerProfile.maxAnimatedAtoms,
      }),
    [n, forceLite, qualityLevel, flightActive, groupVisible, coeffEditBurst, lowPowerProfile.maxAnimatedAtoms],
  )
  const { electronAnimate, driftAtoms, slowSpin, visibilityGuardEvery } = previewPolicy

  useEffect(() => {
    assertPreviewElectronAnimation(electronAnimate, n)
  }, [electronAnimate, n])

  useEffect(() => {
    warnIfReactorVisualDegraded({ hideOrbitRings: false, previewStaticFromBurst: false })
  }, [])

  useLayoutEffect(() => {
    while (atomGroupRefs.current.length < poolSize) atomGroupRefs.current.push(null)
    while (atomScaleGroupRefs.current.length < poolSize) atomScaleGroupRefs.current.push(null)
  }, [poolSize, atomGroupRefs, atomScaleGroupRefs])

  const syncLayout = useCallback(() => {
    applyReactorPreviewLayoutSlots(
      n,
      renderAtoms,
      shellAtomsRef.current,
      atomGroupRefs,
      atomScaleGroupRefs,
      scale,
    )
  }, [renderAtoms, n, scale, atomGroupRefs, atomScaleGroupRefs])

  const layoutSyncRafRef = useRef<number | null>(null)
  const layoutSyncTimerRef = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (flightActive || poseLocked) return
    if (n === 0 && shellAtomsRef.current.length === 0) return
    if (layoutSyncTimerRef.current != null) window.clearTimeout(layoutSyncTimerRef.current)
    if (layoutSyncRafRef.current != null) cancelAnimationFrame(layoutSyncRafRef.current)
    layoutSyncTimerRef.current = null
    layoutSyncRafRef.current = null
    const run = () => {
      layoutSyncTimerRef.current = null
      layoutSyncRafRef.current = null
      applyReactorPreviewLayoutSlots(
        n,
        renderAtoms,
        shellAtomsRef.current,
        atomGroupRefs,
        atomScaleGroupRefs,
        scale,
      )
      invalidateThrottleRef.current.request(invalidate)
    }
    run()
  }, [
    flightActive,
    poseLocked,
    termsSig,
    invalidate,
    renderAtoms,
    n,
    scale,
    atomGroupRefs,
    atomScaleGroupRefs,
  ])

  useFrame((s) => {
    const pinEveryFrame = editingActive && hasActiveTerms && n > 0 && groupVisible
    if (pinEveryFrame) {
      pinPreviewAtomsOnScreen({
        atomCount: n,
        rootRef: groupRef.current,
        atomGroupRefs,
        atomScaleGroupRefs,
        layoutScale: scale,
        previewAtoms: renderAtoms,
        shellAtoms: shellAtomsRef.current,
      })
    }

    const shellHoldActive =
      editingActive &&
      hasActiveTerms &&
      shellAtomsRef.current.length > 0 &&
      (previewLenRef.current === 0 || previewLenRef.current < expectedAtomCount)

    if (previewLenRef.current === 0 && shellAtomsRef.current.length > 0 && !shellHoldActive && !coeffEditing && !layoutPending) {
      shellEmptyFramesRef.current += 1
      if (shellEmptyFramesRef.current <= SHELL_HOLD_FRAMES) {
        invalidateThrottleRef.current.request(invalidate)
      }
    }

    guardFrameRef.current += 1
    const guardEvery = pinEveryFrame ? 1 : visibilityGuardEvery
    if (shouldRunGuardTick(guardFrameRef.current, guardEvery)) {
      visibilityGuardRef.current.tick({
        atomCount: n,
        atomGroupRefs,
        atomScaleGroupRefs,
        layoutScale: scale,
        previewAtoms: renderAtoms,
        rootVisible: groupVisible,
        flightActive,
        allowRecover: !flightActive && !layoutPending,
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
    if (!groupVisible && !(previewOnlyMode && visibleLatchRef.current)) {
      for (let i = 0; i < atomGroupRefs.current.length; i++) {
        const posG = atomGroupRefs.current[i]
        const scaleG = atomScaleGroupRefs.current[i]
        if (posG) posG.visible = false
        if (scaleG) scaleG.visible = false
      }
    }
  }, [groupVisible, previewOnlyMode, atomGroupRefs, atomScaleGroupRefs])

  return (
    <group ref={groupRef} visible={groupVisible} frustumCulled={false}>
      {!sharedLighting ? (
        <>
          <ambientLight intensity={useDenseLight ? 0.38 : 0.22} />
          <directionalLight position={[4, 6, 2]} intensity={useDenseLight ? 0.72 : 0.55} color="#b8c8ff" />
          {useDenseLight ? (
            <pointLight position={[0, 0.5, 2.5]} intensity={1.1} distance={12} color="#7afcff" />
          ) : null}
        </>
      ) : null}
      {Array.from({ length: poolSize }, (_, i) => {
        const atom = i < n ? (renderAtoms[i] ?? shellAtomsRef.current[i] ?? null) : null
        const active = atom != null
        const slotZ = atom?.z ?? slotZRef.current[i] ?? 1
        const atomPolicy = getReactorAtomRenderPolicy({
          atomCount: n,
          atomZ: slotZ,
          forceLite: forceLite || coeffEditBurst,
          qualityLevel,
          coeffEditBurst,
          minElectronFrameSkip: lowPowerProfile.minElectronFrameSkip,
        })
        const [ax, ay, az] = atom?.pos ?? [0, 0, 0]
        const slotVisible = active && groupVisible
        return (
          <group
            key={`pool-${i}`}
            visible={slotVisible}
            ref={(el) => {
              atomGroupRefs.current[i] = el
              if (el && slotVisible) {
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
                if (el && slotVisible) {
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
                previewStatic={!active || (!electronAnimate && !coeffEditBurst)}
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
