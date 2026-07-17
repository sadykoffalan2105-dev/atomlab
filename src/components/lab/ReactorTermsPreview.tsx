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
  bumpSettlePinUntil,
  isSettlePinActive,
  withSettlePinPolicy,
} from '../../lab/synthesisPreviewEngine'
import {
  resolvePreviewEditingActive,
  resolvePreviewExternalAtomControl,
} from '../../lab/synthesisPreviewEngine/previewExternalControl'
import { restorePreviewActiveSlotVisibility } from '../../lab/previewAtomFrameGuard'
import { createReactorPreviewVisibilityGuard } from '../../lab/reactorPreviewVisibilityGuard'
import {
  bumpShieldOnCoeffEdit,
  createShieldSnapshot,
  resolveShieldRenderPolicy,
  tickShieldPhase,
  shieldForceShowActiveSlots,
} from '../../lab/reactorPreviewShield'
import { ReactorPreviewAtomSlot } from './ReactorPreviewAtomSlot'
import { ReactorPreviewPresenceDots } from './ReactorPreviewPresenceDots'
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
  synthesisGlass: _synthesisGlass = false,
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
  const settlePinUntilRef = useRef(0)
  const shieldRef = useRef(createShieldSnapshot())
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
    hotCoeffEdit: framePolicy.hotCoeffEdit,
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

  settlePinUntilRef.current = bumpSettlePinUntil(
    policy.hotCoeffEdit || previewOnlyMode,
    performance.now(),
    settlePinUntilRef.current,
  )
  const settlePin = isSettlePinActive(performance.now(), settlePinUntilRef.current)
  let tickPolicy = withSettlePinPolicy(policy, settlePin || previewOnlyMode, frame.groupVisible)

  // --- ReactorPreviewShield: единый закон видимости / электронов / lite ---
  {
    const now = performance.now()
    if (policy.hotCoeffEdit || coeffEditBurst || coeffEditing || previewOnlyMode) {
      shieldRef.current = bumpShieldOnCoeffEdit(
        shieldRef.current,
        now,
        Math.max(frame.slotCount, 12),
      )
    }
    shieldRef.current = tickShieldPhase(shieldRef.current, now)
    const shield = resolveShieldRenderPolicy({
      snap: shieldRef.current,
      nowMs: now,
      hotCoeffEdit: policy.hotCoeffEdit || previewOnlyMode,
      preSynthesis: previewOnlyMode,
      atomCount: frame.slotCount,
      groupVisible: true,
      flightActive,
      externalForceLite: policy.effectiveForceLite,
    })
    tickPolicy = {
      ...tickPolicy,
      // Pre-synth: pin ВСЕГДА, пока есть атомы.
      pinEveryFrame:
        (!flightActive && previewOnlyMode && frame.slotCount > 0) ||
        tickPolicy.pinEveryFrame ||
        shield.pinEveryFrame,
      lockVisualTier: true,
      lockPoolSize: true,
      electronAnimate: true,
      effectiveForceLite: shield.forceLite || tickPolicy.effectiveForceLite || frame.slotCount >= 10,
    }
  }

  engineRef.current.fullDetailLatch = resolveFullDetailLatch(
    engineRef.current.fullDetailLatch,
    frame.slotCount,
    tickPolicy.lockVisualTier,
    tickPolicy.effectiveForceLite,
  )

  const scale = reactorPreviewAtomScale(frame.slotCount)
  const groupRef = useRef<THREE.Group>(null)
  const visibilityGuardRef = useRef(createReactorPreviewVisibilityGuard())
  const guardFrameRef = useRef(0)
  const atomGroupRefsLocal = useRef<(THREE.Group | null)[]>([])
  const atomScaleGroupRefsLocal = useRef<(THREE.Group | null)[]>([])
  const atomGroupRefs = atomGroupRefsExternal ?? atomGroupRefsLocal
  const atomScaleGroupRefs = atomScaleGroupRefsExternal ?? atomScaleGroupRefsLocal

  const { electronAnimate, driftAtoms, slowSpin } = tickPolicy
  const n = frame.slotCount
  /** Минимум пула = n (+engine); без жёстких 32 Bohr. */
  const poolSize = Math.max(frame.poolSize, n)
  const renderAtoms = frame.layoutAtoms
  const shellAtoms = engineRef.current.shellAtoms

  const previewLatched =
    previewOnlyMode && engineRef.current.visibleLatch && frame.slotCount > 0
  /** Pre-synth / edit: группа ВСЕГДА visible. */
  const effectiveGroupVisible =
    previewOnlyMode || coeffEditing
      ? n > 0 || shellAtoms.length > 0
      : Boolean(visible) && (frame.groupVisible || previewLatched || frame.slotCount > 0)

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
          // Pre-synth / edit: всегда visible для активных слотов — groupVisible может быть stale на mount.
          if (i < ls.n) {
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
          if (i < ls.n) {
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
    // Жёсткий pin каждый кадр в pre-synth — до любого early-return.
    if ((previewOnlyMode || coeffEditing) && !externalAtomControl) {
      const root = groupRef.current
      if (root) root.visible = true
      const count = Math.max(n, 1)
      for (let i = 0; i < count; i++) {
        const posG = atomGroupRefs.current[i]
        const scG = atomScaleGroupRefs.current[i]
        if (posG) posG.visible = true
        if (scG) {
          scG.visible = true
          if (scG.scale.x < scale * 0.4) scG.scale.set(scale, scale, scale)
        }
      }
    }

    guardFrameRef.current = tickSynthesisPreviewFrame({
      policy: tickPolicy,
      slotCount: n,
      groupVisible: true,
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

    if (externalAtomControl || n === 0) return
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
    // Pre-synth: НИКОГДА не гасим детей — continuity/product false давал залипший hide.
    if (previewOnlyMode) {
      g.visible = true
      if (!externalAtomControl && n > 0) {
        shieldForceShowActiveSlots({
          slotCount: n,
          root: g,
          atomGroupRefs,
          atomScaleGroupRefs,
          layoutScale: scale,
        })
        syncPreviewLayoutSlots(n, renderAtoms, shellAtoms, atomGroupRefs, atomScaleGroupRefs, scale)
      }
      return
    }
    g.visible = effectiveGroupVisible
    // Не гасим children поштучно — залипает visible=false при гонке с pin/synth start.
    // Достаточно скрыть корень; pin восстановит слоты при следующем edit.
    if (!effectiveGroupVisible) {
      return
    }
    if (!externalAtomControl && n > 0) {
      shieldForceShowActiveSlots({
        slotCount: n,
        root: g,
        atomGroupRefs,
        atomScaleGroupRefs,
        layoutScale: scale,
      })
      restorePreviewActiveSlotVisibility({
        atomCount: n,
        rootRef: g,
        atomGroupRefs,
        atomScaleGroupRefs,
        layoutScale: scale,
      })
      syncPreviewLayoutSlots(n, renderAtoms, shellAtoms, atomGroupRefs, atomScaleGroupRefs, scale)
    }
  }, [
    previewOnlyMode,
    effectiveGroupVisible,
    externalAtomControl,
    n,
    scale,
    renderAtoms,
    shellAtoms,
    atomGroupRefs,
    atomScaleGroupRefs,
  ])

  const forceElectronMotion = true
  /**
   * Mount только n (+2 запас). Раньше 32 Bohr → GPU hitch / white / пропажа атомов.
   * Presence — тонкий fallback при hot dense, не перекрывает ядро.
   */
  const hotDense = (policy.hotCoeffEdit || coeffEditing) && n >= 10
  const showPresence = hotDense && (previewOnlyMode || coeffEditing)
  const mountBohrCount = Math.max(n, Math.min(poolSize, n + 2), previewOnlyMode || coeffEditing ? Math.min(n + 2, 20) : 0)

  return (
    <group
      ref={groupRef}
      visible
      frustumCulled={false}
    >
      {!sharedLighting ? (
        <>
          <ambientLight intensity={0.28} />
          <directionalLight position={[4, 6, 2]} intensity={0.65} color="#b8c8ff" />
          <pointLight position={[0, 0.5, 2.5]} intensity={0.9} distance={12} color="#7afcff" />
        </>
      ) : null}
      {showPresence ? (
        <ReactorPreviewPresenceDots
          atoms={renderAtoms}
          shellAtoms={shellAtoms}
          slotCount={Math.max(n, shellAtoms.length, 1)}
          visible
          maxCount={48}
          radius={0.09}
        />
      ) : null}
      {Array.from({ length: mountBohrCount }, (_, i) => {
        const layoutAtom = i < n ? renderAtoms[i] : null
        const shellAtom = i < shellAtoms.length ? shellAtoms[i] : null
        const atom = layoutAtom ?? shellAtom
        const incomingZ = atom?.z ?? engineRef.current.slotZ[i] ?? 1
        if (atom != null) engineRef.current.slotZ[i] = incomingZ
        const slotZ = engineRef.current.slotZ[i] ?? incomingZ
        const slotVisible =
          i < n && (previewOnlyMode || coeffEditing || effectiveGroupVisible)
        const atomPolicy = getReactorAtomRenderPolicy({
          atomCount: Math.max(n, 1),
          atomZ: slotZ,
          forceLite: tickPolicy.effectiveForceLite && n >= 12,
          qualityLevel,
          coeffEditBurst: policy.hotCoeffEdit || coeffEditBurst,
          minElectronFrameSkip: 1,
        })
        const useFullDetail = atomPolicy.synthesisDetail && n <= 10
        const previewLite = !useFullDetail && (atomPolicy.previewLite || n >= 16)
        return (
          <group key={`slot-${i}`} visible={slotVisible} ref={getPosRef(i)}>
            <group scale={scale} visible={slotVisible} ref={getScaleRef(i)}>
              <ReactorPreviewAtomSlot
                z={slotZ}
                animate={forceElectronMotion}
                previewStatic={false}
                useFullDetail={useFullDetail}
                synthesisGlass={false}
                previewLite={previewLite}
                electronFrameSkip={Math.max(1, atomPolicy.electronFrameSkip)}
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