import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { assertPreviewElectronAnimation } from '../../lab/reactorPreviewGuarantee'
import { resolveReactorEditPerfFlags } from '../../lab/reactorEditPerfMode'
import { createReactorInvalidateThrottle } from '../../lab/reactorInvalidateThrottle'
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
  shouldBumpShieldOnPreviewFrame,
} from '../../lab/reactorPreviewShield'
import {
  resolvePreviewAtomInvariants,
  resolveStableElectronFrameSkip,
} from '../../lab/synthesisStabilityEngine'
import {
  pinCoeffEditAtomsHard,
  shouldHardPinCoeffEditAtoms,
  resolveBohrReactVisible,
} from '../../lab/coeffEditAtomPin'
import {
  PREVIEW_MOTION,
  resolvePreviewMotionPolicy,
  samplePreviewAtomMotion,
  samplePreviewRootSpin,
} from '../../lab/reactorPreviewMotionEngine'
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
  /** Сколько Bohr уже смонтировано; растём +4/кадр → полный dichromate < 1с без wipe. */
  const [mountCap, setMountCap] = useState(0)
  const mountCapRef = useRef(0)
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
    /**
     * bump ТОЛЬКО на реальный +/-. Раньше previewOnlyMode bump'ил каждый render
     * (invalidate × pin) → phase навсегда hot, stickyLite с фейковым atomCount≥12,
     * remountBan/gpuBan не сходили → hitch/мигание на dichromate.
     */
    if (shouldBumpShieldOnPreviewFrame({
      hotCoeffEdit: policy.hotCoeffEdit,
      coeffEditBurst,
      coeffEditing,
    })) {
      shieldRef.current = bumpShieldOnCoeffEdit(
        shieldRef.current,
        now,
        frame.slotCount,
      )
    }
    shieldRef.current = tickShieldPhase(shieldRef.current, now)
    const shield = resolveShieldRenderPolicy({
      snap: shieldRef.current,
      nowMs: now,
      hotCoeffEdit: policy.hotCoeffEdit,
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
        (!flightActive && previewOnlyMode && (frame.slotCount > 0 || frame.hasActiveTerms)) ||
        tickPolicy.pinEveryFrame ||
        shield.pinEveryFrame,
      lockVisualTier: true,
      lockPoolSize: true,
      // Collapse/flight: не крутить электроны — главный GPU-нагрузка на N Bohr.
      electronAnimate:
        !flightActive && (tickPolicy.electronAnimate || shield.electronAnimate),
      // Не форсим lite thrash через live n — sticky denseLightLatch ниже.
      effectiveForceLite:
        shield.forceLite ||
        tickPolicy.effectiveForceLite ||
        engineRef.current.denseLightLatch,
    }
  }

  engineRef.current.fullDetailLatch = resolveFullDetailLatch(
    engineRef.current.fullDetailLatch,
    frame.slotCount,
    tickPolicy.lockVisualTier,
    tickPolicy.effectiveForceLite,
  )
  /**
   * Визуал реактора: при ≥10 слотах — lite-материалы (анти white-screen на K₂Cr₂O₇).
   * Электроны и drift остаются; full nebula только на малых уравнениях.
   * Tier залипает — нет full↔lite remount thrash.
   */
  if (!frame.hasActiveTerms) {
    engineRef.current.denseLightLatch = false
    engineRef.current.fullDetailLatch = true
  } else if (
    tickPolicy.effectiveForceLite ||
    frame.slotCount >= PREVIEW_MOTION.denseFromSlots ||
    frame.expectedAtomCount >= PREVIEW_MOTION.denseFromSlots
  ) {
    engineRef.current.denseLightLatch = true
    engineRef.current.fullDetailLatch = false
  } else if (previewOnlyMode || coeffEditing || tickPolicy.lockVisualTier) {
    engineRef.current.denseLightLatch = false
    engineRef.current.fullDetailLatch = true
  }

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
  /**
   * Единый движок инвариантов — SynthesisStabilityEngine.
   * Все решения по holdPreview/atomsOnScreen/pin централизованы здесь.
   */
  const invariants = resolvePreviewAtomInvariants({
    previewOnlyMode,
    coeffEditing,
    synthHoldPreview,
    visibleProp: Boolean(visible),
    hasActiveTerms: frame.hasActiveTerms,
    slotCount: n,
    shellCount: shellAtoms.length,
    expectedAtomCount: frame.expectedAtomCount,
    groupVisible: frame.groupVisible,
  })
  const { holdPreview, atomsOnScreen, stickySlotCount, keepMountPool } = invariants

  const effectiveGroupVisible = atomsOnScreen

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
    stickySlotCount,
    scale: 1,
    renderAtoms,
    shellAtoms,
    externalAtomControl,
    groupVisible: effectiveGroupVisible,
    atomsOnScreen,
    holdPreview,
    hasActiveTerms: frame.hasActiveTerms,
    parentVisible: Boolean(visible),
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
          const hold = ls.holdPreview
          const show =
            (hold || ls.parentVisible) &&
            i < ls.stickySlotCount &&
            (ls.atomsOnScreen || hold || ls.hasActiveTerms)
          if (show) {
            el.visible = true
            const atom = ls.renderAtoms[i] ?? ls.shellAtoms[i]
            if (atom && !ls.externalAtomControl) {
              el.position.set(atom.pos[0], atom.pos[1], atom.pos[2])
            }
          } else if (!hold && !ls.parentVisible) {
            el.visible = false
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
          const hold = ls.holdPreview
          const show =
            (hold || ls.parentVisible) &&
            i < ls.stickySlotCount &&
            (ls.atomsOnScreen || hold || ls.hasActiveTerms)
          if (show) {
            el.visible = true
            if (!ls.externalAtomControl) {
              el.scale.set(ls.scale, ls.scale, ls.scale)
            }
          } else if (!hold && !ls.parentVisible) {
            el.visible = false
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
    stickySlotCount,
    scale,
    renderAtoms,
    shellAtoms,
    externalAtomControl,
    groupVisible: effectiveGroupVisible,
    atomsOnScreen,
    holdPreview,
    hasActiveTerms: frame.hasActiveTerms,
    parentVisible: Boolean(visible),
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
    if (!atomsOnScreen) return
    if (externalAtomControl) return
    if (n === 0 && shellAtoms.length === 0) return
    syncPreviewLayoutSlots(n, renderAtoms, shellAtoms, atomGroupRefs, atomScaleGroupRefs, scale)
    invalidateThrottleRef.current.request(invalidate)
  }, [
    atomsOnScreen,
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
    const root = groupRef.current
    /**
     * holdAtoms = edit / pre-synth / synth-hold → pin.
     * visible=false (product owns screen) → Bohr СКРЫТ, даже если terms ещё в уравнении.
     * Иначе после синтеза 22 Bohr + молекула = хаос орбит (баг со скрина K₂Cr₂O₇).
     */
    const holdAtoms = previewOnlyMode || coeffEditing || synthHoldPreview
    const productOwnsScreen = !visible && !holdAtoms
    const hardPin =
      !productOwnsScreen &&
      shouldHardPinCoeffEditAtoms({
        coeffEditing,
        previewOnlyMode,
        synthHoldPreview,
        hasActiveTerms: frame.hasActiveTerms || stickySlotCount > 0,
        synthLive: false,
      })

    if (productOwnsScreen) {
      if (root) root.visible = false
      return
    }

    if (!atomsOnScreen && !holdAtoms && !frame.hasActiveTerms) {
      if (root) root.visible = false
      return
    }
    if (holdAtoms || hardPin || Boolean(visible)) {
      if (root && !root.visible) root.visible = true
    }

    // Жёсткий pin каждый кадр — только пока Bohr должен быть на экране.
    if ((holdAtoms || hardPin) && !externalAtomControl) {
      pinCoeffEditAtomsHard({
        slotCount: Math.max(stickySlotCount, n, shellAtoms.length, frame.hasActiveTerms ? 1 : 0),
        layoutScale: scale,
        root,
        atomGroupRefs,
        atomScaleGroupRefs,
        positions: renderAtoms.length > 0 ? renderAtoms : shellAtoms,
      })
    }

    guardFrameRef.current = tickSynthesisPreviewFrame({
      policy: {
        ...tickPolicy,
        pinEveryFrame: tickPolicy.pinEveryFrame || holdAtoms || hardPin,
        visibilityGuardEvery: Math.max(tickPolicy.visibilityGuardEvery, holdAtoms ? 6 : 2),
      },
      slotCount: stickySlotCount,
      groupVisible: !productOwnsScreen && (atomsOnScreen || holdAtoms || hardPin),
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

    if (externalAtomControl || n === 0 || productOwnsScreen) return
    const t = s.clock.elapsedTime
    const motion = resolvePreviewMotionPolicy(Math.max(n, stickySlotCount))
    if (root && slowSpin) root.rotation.y = samplePreviewRootSpin(t, motion.spinRate)

    if (!driftAtoms) return
    for (let i = 0; i < n; i++) {
      const g = atomGroupRefs.current[i] ?? null
      if (!g) continue
      const atom = renderAtoms[i] ?? shellAtoms[i]
      if (!atom) continue
      const { pos } = atom
      const [bx, by, bz] = pos
      const [dx, dy, dz] = samplePreviewAtomMotion({
        elapsedSec: t,
        slotIndex: i,
        atomicZ: atom.z,
        driftAmp: motion.driftAmp,
      })
      g.position.set(bx + dx, by + dy, bz + dz)
    }
  })

  useLayoutEffect(() => {
    if (previewRootRef) previewRootRef.current = groupRef.current
  }, [previewRootRef, n])

  useLayoutEffect(() => {
    const g = groupRef.current
    if (!g) return
    const holdAtoms = previewOnlyMode || coeffEditing || synthHoldPreview
    // Product owns screen: hide Bohr root (shell stays mounted for next +/-).
    if (!visible && !holdAtoms) {
      g.visible = false
      return
    }
    // Pre-synth / edit: НИКОГДА не гасим детей.
    if (holdAtoms) {
      g.visible = true
      if (!externalAtomControl && stickySlotCount > 0) {
        shieldForceShowActiveSlots({
          slotCount: stickySlotCount,
          root: g,
          atomGroupRefs,
          atomScaleGroupRefs,
          layoutScale: scale,
          forceFullScale: true,
        })
        pinCoeffEditAtomsHard({
          slotCount: stickySlotCount,
          layoutScale: scale,
          root: g,
          atomGroupRefs,
          atomScaleGroupRefs,
          positions: renderAtoms.length > 0 ? renderAtoms : shellAtoms,
        })
      }
      return
    }
    if (!atomsOnScreen && !frame.hasActiveTerms) {
      g.visible = false
      return
    }
    g.visible = Boolean(visible)
    if (visible && !externalAtomControl && n > 0) {
      shieldForceShowActiveSlots({
        slotCount: n,
        root: g,
        atomGroupRefs,
        atomScaleGroupRefs,
        layoutScale: scale,
        forceFullScale: true,
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
    coeffEditing,
    synthHoldPreview,
    visible,
    atomsOnScreen,
    effectiveGroupVisible,
    externalAtomControl,
    n,
    stickySlotCount,
    scale,
    renderAtoms,
    shellAtoms,
    atomGroupRefs,
    atomScaleGroupRefs,
    frame.hasActiveTerms,
  ])

  const forceElectronMotion = true
  /**
   * Космический дизайн: сразу все слоты уравнения (дихромат = 22).
   * Старый Math.min(16, …) резал mount при hold — чёрный пустой кадр при уравненном K₂Cr₂O₇.
   */
  const targetMount = Math.max(
    stickySlotCount,
    holdPreview ? Math.max(stickySlotCount, frame.hasActiveTerms ? 1 : 0) : 0,
    Math.min(poolSize, stickySlotCount),
  )

  useEffect(() => {
    if (targetMount <= 0) {
      // Не сбрасываем mountCap при кратком targetMount=0, пока уравнение живо.
      if (!keepMountPool && !frame.hasActiveTerms) {
        mountCapRef.current = 0
        setMountCap(0)
      }
      return
    }
    // Сразу все слоты — без ramp и без потолка 16.
    if (holdPreview || mountCapRef.current < stickySlotCount) {
      const jump = Math.max(stickySlotCount, targetMount)
      if (jump !== mountCapRef.current) {
        mountCapRef.current = jump
        setMountCap(jump)
      }
      return
    }
    if (mountCapRef.current >= targetMount) return
    let cancelled = false
    let raf = 0
    const step = () => {
      if (cancelled) return
      const next = Math.min(targetMount, mountCapRef.current + 8)
      mountCapRef.current = next
      setMountCap(next)
      if (next < targetMount) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [targetMount, stickySlotCount, holdPreview, frame.hasActiveTerms, keepMountPool])

  const mountBohrCount = Math.max(mountCap, stickySlotCount, targetMount)
  /** Стабильный frame-skip через движок (stickySlotCount, без 1↔2 thrash). */
  const editSkip = resolveStableElectronFrameSkip(stickySlotCount, {
    deviceTier: getSynthesisDeviceTier(),
    lowPower,
  })
  const holdAtomsUi = previewOnlyMode || coeffEditing || synthHoldPreview
  const motionPolicy = resolvePreviewMotionPolicy(Math.max(stickySlotCount, n))
  /** Product owns screen → скрыть Bohr. Edit/pre-synth → всегда показать. */
  const productOwnsScreen = !holdAtomsUi && !visible
  const reactGroupVisible = resolveBohrReactVisible({
    visible: Boolean(visible),
    previewOnlyMode,
    coeffEditing,
    synthHoldPreview,
    atomsOnScreen,
    hasActiveTerms: frame.hasActiveTerms,
    stickySlotCount,
    // Пока hold/pre-synth — продукт не владеет экраном (страховка против пустого центра).
    productOwnsScreen,
  }) && !productOwnsScreen
  const editLocalLight = !sharedLighting && reactGroupVisible
  // Collapse/flight: атомы летят в центр — электроны и spin только жрут GPU.
  const electronsLive =
    !flightActive && forceElectronMotion && reactGroupVisible && holdAtomsUi
  const bohrAnimate = electronsLive
  /** Dense (дихромат): lite-материалы обязательны — full×22 = WebGL white-screen. */
  const slotPreviewLite =
    lowPower || !holdAtomsUi || motionPolicy.forceLiteMaterials || Boolean(forceLite)

  return (
    <group
      ref={groupRef}
      visible={reactGroupVisible}
      frustumCulled={false}
    >
      {!sharedLighting && reactGroupVisible ? (
        <>
          <ambientLight intensity={0.28} />
          <directionalLight position={[4, 6, 2]} intensity={0.65} color="#b8c8ff" />
          <pointLight position={[0, 0.5, 2.5]} intensity={0.9} distance={12} color="#7afcff" />
        </>
      ) : null}
      {Array.from({ length: mountBohrCount }, (_, i) => {
        const layoutAtom = i < n ? renderAtoms[i] : null
        const shellAtom = i < shellAtoms.length ? shellAtoms[i] : null
        const atom = layoutAtom ?? shellAtom
        const incomingZ = atom?.z ?? engineRef.current.slotZ[i] ?? 1
        if (atom != null) engineRef.current.slotZ[i] = incomingZ
        const slotZ = engineRef.current.slotZ[i] ?? incomingZ
        const slotVisible =
          reactGroupVisible &&
          i < stickySlotCount &&
          i < mountBohrCount
        return (
          <group key={`slot-${i}`} visible={slotVisible} ref={getPosRef(i)}>
            <group scale={scale} visible={slotVisible} ref={getScaleRef(i)}>
              <ReactorPreviewAtomSlot
                z={slotZ}
                animate={bohrAnimate && slotVisible}
                previewStatic={!holdAtomsUi || flightActive}
                useFullDetail={false}
                synthesisGlass={false}
                previewLite={slotPreviewLite}
                electronFrameSkip={flightActive ? 8 : editSkip}
                hideOrbitRings={!holdAtomsUi || flightActive}
                localLight={editLocalLight}
              />
            </group>
          </group>
        )
      })}
    </group>
  )
}