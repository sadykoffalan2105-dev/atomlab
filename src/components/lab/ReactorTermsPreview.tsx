import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { assertPreviewElectronAnimation } from '../../lab/reactorPreviewGuarantee'
import { resolveReactorEditPerfFlags } from '../../lab/reactorEditPerfMode'
import { createReactorInvalidateThrottle } from '../../lab/reactorInvalidateThrottle'
import { getReactorAtomRenderPolicy } from '../../lab/synthesisLagGuard'
import { getLowPowerDeviceProfile } from '../../lab/lowPowerDeviceProfile'
import { getSynthesisDeviceTier } from '../../lab/synthesisDeviceTier'
import { warnIfReactorVisualDegraded } from '../../lab/reactorVisualPreservation'
import { useReactorPreviewLayout } from '../../lab/useReactorPreviewLayout'
import {
  createPreviewEngineState,
  resolveFullDetailLatch,
  resolvePreviewEngineFrame,
  resolvePreviewFramePolicy,
  syncPreviewLayoutSlots,
  tickSynthesisPreviewFrame,
} from '../../lab/synthesisPreviewEngine'
import {
  resolvePreviewEditingActive,
  resolvePreviewExternalAtomControl,
} from '../../lab/synthesisPreviewEngine/previewExternalControl'
import { createReactorPreviewVisibilityGuard } from '../../lab/reactorPreviewVisibilityGuard'
import { ReactorPreviewAtomSlot } from './ReactorPreviewAtomSlot'
import { reactorPreviewAtomScale } from './reactorPreviewLayout'

/**
 * Превью реагентов: полная Bohr-модель (протоны, нейтроны, электроны, орбиты).
 * Стабильность +/- — synthesisPreviewEngine (shell-hold, pin, policy).
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
  coeffEditing = coeffEditBurst,
  previewOnlyMode = false,
  synthHoldPreview = false,
  productPrewarm: _productPrewarm = false,
  lowPower = false,
  frameBudgetLite = false,
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
  previewOnlyMode?: boolean
  synthHoldPreview?: boolean
  productPrewarm?: boolean
  lowPower?: boolean
  frameBudgetLite?: boolean
  atomGroupRefs?: MutableRefObject<(THREE.Group | null)[]>
  atomScaleGroupRefs?: MutableRefObject<(THREE.Group | null)[]>
  previewRootRef?: MutableRefObject<THREE.Group | null>
}) {
  const { invalidate } = useThree()
  const engineRef = useRef(createPreviewEngineState())
  const lowPowerProfile = useMemo(() => getLowPowerDeviceProfile(getSynthesisDeviceTier()), [])
  const editingActive = resolvePreviewEditingActive({
    coeffEditing,
    previewOnlyMode,
    synthHoldPreview,
  })

  const framePolicy = useMemo(
    () =>
      resolvePreviewFramePolicy({
        atomCount: 0,
        editingActive,
        coeffEditBurst,
        coeffEditing,
        flightActive,
        groupVisible: true,
        forceLite,
        frameBudgetLite,
        qualityLevel,
        lowPowerProfile,
      }),
    [
      editingActive,
      coeffEditBurst,
      coeffEditing,
      flightActive,
      forceLite,
      frameBudgetLite,
      qualityLevel,
      lowPowerProfile,
    ],
  )

  const perf = useMemo(
    () =>
      resolveReactorEditPerfFlags({
        coeffEditBurst,
        coeffEditing,
        forceLite: framePolicy.effectiveForceLite,
        lowPower,
        layoutDebounceMs: lowPower ? lowPowerProfile.coeffEditLayoutDebounceMs : 0,
        atomEstimate: terms.reduce((s, t) => s + Math.max(0, Math.floor(t.coeff)), 0),
      }),
    [
      coeffEditBurst,
      coeffEditing,
      framePolicy.effectiveForceLite,
      lowPower,
      lowPowerProfile.coeffEditLayoutDebounceMs,
      terms,
    ],
  )

  const invalidateThrottleRef = useRef(
    createReactorInvalidateThrottle(framePolicy.maxInvalidateHz),
  )
  useEffect(() => {
    invalidateThrottleRef.current = createReactorInvalidateThrottle(framePolicy.maxInvalidateHz)
  }, [framePolicy.maxInvalidateHz])

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

  const frame = resolvePreviewEngineFrame(engineRef.current, {
    terms,
    previewAtoms,
    editingActive,
    previewOnlyMode,
    synthHoldPreview,
    coeffEditing,
    layoutPending,
    lockPoolSize: framePolicy.lockPoolSize,
  })

  const policy = useMemo(
    () =>
      resolvePreviewFramePolicy({
        atomCount: frame.slotCount,
        editingActive,
        coeffEditBurst,
        coeffEditing,
        flightActive,
        groupVisible: frame.groupVisible,
        forceLite,
        frameBudgetLite,
        qualityLevel,
        lowPowerProfile,
      }),
    [
      frame.slotCount,
      frame.groupVisible,
      editingActive,
      coeffEditBurst,
      coeffEditing,
      flightActive,
      forceLite,
      frameBudgetLite,
      qualityLevel,
      lowPowerProfile,
    ],
  )

  engineRef.current.fullDetailLatch = resolveFullDetailLatch(
    engineRef.current.fullDetailLatch,
    frame.slotCount,
    policy.lockVisualTier,
    policy.effectiveForceLite,
  )
  const useFullDetail = engineRef.current.fullDetailLatch
  const useDenseLight = engineRef.current.denseLightLatch

  const scale = reactorPreviewAtomScale(frame.slotCount)
  const groupRef = useRef<THREE.Group>(null)
  const visibilityGuardRef = useRef(createReactorPreviewVisibilityGuard())
  const guardFrameRef = useRef(0)
  const atomGroupRefsLocal = useRef<(THREE.Group | null)[]>([])
  const atomScaleGroupRefsLocal = useRef<(THREE.Group | null)[]>([])
  const atomGroupRefs = atomGroupRefsExternal ?? atomGroupRefsLocal
  const atomScaleGroupRefs = atomScaleGroupRefsExternal ?? atomScaleGroupRefsLocal

  const { electronAnimate, driftAtoms, slowSpin } = policy
  const n = frame.slotCount
  const poolSize = frame.poolSize
  const renderAtoms = frame.layoutAtoms
  const shellAtoms = engineRef.current.shellAtoms

  const previewLatched =
    previewOnlyMode && engineRef.current.visibleLatch && frame.slotCount > 0
  const effectiveGroupVisible =
    frame.groupVisible || previewLatched || (visible && frame.slotCount > 0)

  /**
   * Во время синтеза атомы летят через GSAP (SynthesisConvergeStreams).
   * До начала полёта (synthHoldPreview) — pin/guard; после — только GSAP.
   */
  const externalAtomControl = resolvePreviewExternalAtomControl({
    flightActive,
    poseLocked,
    previewOnlyMode,
    synthHoldPreview,
  })

  // Последнее состояние layout — для стабильных ref-коллбэков (позиция при mount).
  const layoutStateRef = useRef({
    n,
    scale: 1,
    renderAtoms,
    shellAtoms,
    externalAtomControl,
    groupVisible: effectiveGroupVisible,
  })
  const posRefSettersRef = useRef<Array<(el: THREE.Group | null) => void>>([])
  const scaleRefSettersRef = useRef<Array<(el: THREE.Group | null) => void>>([])

  const getPosRef = useCallback(
    (i: number) => {
      let cb = posRefSettersRef.current[i]
      if (!cb) {
        cb = (el: THREE.Group | null) => {
          atomGroupRefs.current[i] = el
          if (!el) return
          const ls = layoutStateRef.current
          if (i < ls.n && ls.groupVisible) {
            el.visible = true
            const atom = ls.renderAtoms[i] ?? ls.shellAtoms[i]
            if (atom && !ls.externalAtomControl) {
              el.position.set(atom.pos[0], atom.pos[1], atom.pos[2])
            }
          }
        }
        posRefSettersRef.current[i] = cb
      }
      return cb
    },
    [atomGroupRefs],
  )

  const getScaleRef = useCallback(
    (i: number) => {
      let cb = scaleRefSettersRef.current[i]
      if (!cb) {
        cb = (el: THREE.Group | null) => {
          atomScaleGroupRefs.current[i] = el
          if (!el) return
          const ls = layoutStateRef.current
          if (i < ls.n && ls.groupVisible) {
            el.visible = true
            if (!ls.externalAtomControl) {
              el.scale.set(ls.scale, ls.scale, ls.scale)
            }
          }
        }
        scaleRefSettersRef.current[i] = cb
      }
      return cb
    },
    [atomScaleGroupRefs],
  )

  layoutStateRef.current = {
    n,
    scale,
    renderAtoms,
    shellAtoms,
    externalAtomControl,
    groupVisible: effectiveGroupVisible,
  }

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
    syncPreviewLayoutSlots(
      n,
      renderAtoms,
      shellAtoms,
      atomGroupRefs,
      atomScaleGroupRefs,
      scale,
    )
  }, [renderAtoms, shellAtoms, n, scale, atomGroupRefs, atomScaleGroupRefs])

  useLayoutEffect(() => {
    if (externalAtomControl) return
    if (n === 0 && shellAtoms.length === 0) return
    syncPreviewLayoutSlots(n, renderAtoms, shellAtoms, atomGroupRefs, atomScaleGroupRefs, scale)
    invalidateThrottleRef.current.request(invalidate)
  }, [
    externalAtomControl,
    termsSig,
    invalidate,
    renderAtoms,
    shellAtoms,
    n,
    scale,
    atomGroupRefs,
    atomScaleGroupRefs,
  ])

  useFrame((s) => {
    guardFrameRef.current = tickSynthesisPreviewFrame({
      policy,
      slotCount: n,
      groupVisible: effectiveGroupVisible,
      // Синтез владеет refs (GSAP): выключаем pin/guard, чтобы не мигали атомы.
      flightActive: externalAtomControl,
      layoutPending,
      layoutScale: scale,
      layoutAtoms: renderAtoms,
      shellAtoms,
      rootRef: groupRef.current,
      atomGroupRefs,
      atomScaleGroupRefs,
      visibilityGuard: visibilityGuardRef.current,
      guardFrame: guardFrameRef.current,
      onRecoverLayout: syncLayout,
    })

    if (!effectiveGroupVisible || externalAtomControl || n === 0) return
    const t = s.clock.elapsedTime
    const root = groupRef.current
    if (root && slowSpin) root.rotation.y = t * (n > 18 ? 0.032 : 0.04)

    if (!driftAtoms) return
    for (let i = 0; i < n; i++) {
      const g = atomGroupRefs.current[i] ?? null
      if (!g) continue
      const atom = renderAtoms[i] ?? shellAtoms[i]
      if (!atom) continue
      const { pos } = atom
      const [bx, by, bz] = pos
      const ph = i * 1.6 + atom.z * 0.37
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
    g.visible = effectiveGroupVisible
    if (!effectiveGroupVisible) {
      for (let i = 0; i < atomGroupRefs.current.length; i++) {
        const posG = atomGroupRefs.current[i]
        const scaleG = atomScaleGroupRefs.current[i]
        if (posG) posG.visible = false
        if (scaleG) scaleG.visible = false
      }
    }
  }, [effectiveGroupVisible, atomGroupRefs, atomScaleGroupRefs])

  return (
    <group ref={groupRef} visible={effectiveGroupVisible} frustumCulled={false}>
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
        const atom = i < n ? (renderAtoms[i] ?? shellAtoms[i] ?? null) : null
        const slotZ = atom?.z ?? engineRef.current.slotZ[i] ?? 1
        /** Активный слот: есть атом ИЛИ удерживаем last-Z во время edit (не unmount Bohr). */
        const slotActive = atom != null || (i < n && slotZ > 0)
        /** Фиксированный pool-key: identity-keys давали remount при сдвиге индексов. */
        const slotKey = `pool-${i}`
        const atomPolicy = getReactorAtomRenderPolicy({
          atomCount: n,
          atomZ: slotZ,
          forceLite: policy.effectiveForceLite,
          qualityLevel,
          coeffEditBurst: policy.pinEveryFrame,
          minElectronFrameSkip: lowPowerProfile.minElectronFrameSkip,
        })
        /** Во время edit не гасим слот — иначе hitch = «атомы пропали». */
        const slotVisible =
          effectiveGroupVisible && (slotActive || (editingActive && i < n))
        return (
          <group key={slotKey} visible={slotVisible} ref={getPosRef(i)}>
            <group scale={scale} visible={slotVisible} ref={getScaleRef(i)}>
              <ReactorPreviewAtomSlot
                z={slotZ}
                animate={slotActive && electronAnimate}
                previewStatic={!slotActive || (!electronAnimate && policy.pinEveryFrame)}
                useFullDetail={useFullDetail && !flightActive && slotActive && !editingActive}
                synthesisGlass={synthesisGlass && (flightActive || poseLocked) && slotActive}
                previewLite={!useFullDetail || editingActive}
                electronFrameSkip={
                  editingActive || policy.pinEveryFrame
                    ? Math.max(atomPolicy.electronFrameSkip, lowPowerProfile.isMobileSoc ? 3 : 2)
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
