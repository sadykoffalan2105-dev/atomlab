import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
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
} from '../../lab/reactorPreviewShield'
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
        (!flightActive && previewOnlyMode && (frame.slotCount > 0 || frame.hasActiveTerms)) ||
        tickPolicy.pinEveryFrame ||
        shield.pinEveryFrame,
      lockVisualTier: true,
      lockPoolSize: true,
      electronAnimate: true,
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
   * Визуал реактора: космический full (nebula + орбиты), без sessionLite.
   * Tier залипает — нет full↔lite remount; perf — через electronFrameSkip.
   */
  if (!frame.hasActiveTerms) {
    engineRef.current.denseLightLatch = false
    engineRef.current.fullDetailLatch = true
  } else if (previewOnlyMode || coeffEditing || tickPolicy.lockVisualTier) {
    // Держим cosmic full на всю сессию уравнения.
    engineRef.current.denseLightLatch = false
    engineRef.current.fullDetailLatch = true
  } else if (tickPolicy.effectiveForceLite || frame.slotCount >= 20) {
    engineRef.current.denseLightLatch = true
    engineRef.current.fullDetailLatch = false
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
  const holdPreview = previewOnlyMode || coeffEditing
  /**
   * Сколько слотов держим видимыми. Не схлопываем до live n при кратком lag layout.
   */
  const stickySlotCount = holdPreview
    ? Math.max(n, shellAtoms.length, frame.expectedAtomCount, frame.hasActiveTerms ? 1 : 0)
    : n

  /**
   * Pre-synth / edit: группа ВСЕГДА visible, пока есть ненулевые коэффициенты.
   * Не завязываемся только на n/shell — краткий 0 на +/- давал пустой starfield.
   */
  const atomsOnScreen =
    holdPreview
      ? frame.hasActiveTerms || n > 0 || shellAtoms.length > 0
      : Boolean(visible) && (n > 0 || shellAtoms.length > 0 || frame.groupVisible)

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
          const show = i < ls.stickySlotCount && (ls.atomsOnScreen || ls.holdPreview)
          if (show) {
            el.visible = true
            const atom = ls.renderAtoms[i] ?? ls.shellAtoms[i]
            if (atom && !ls.externalAtomControl) {
              el.position.set(atom.pos[0], atom.pos[1], atom.pos[2])
            }
          } else if (!ls.holdPreview) {
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
          const show = i < ls.stickySlotCount && (ls.atomsOnScreen || ls.holdPreview)
          if (show) {
            el.visible = true
            if (!ls.externalAtomControl) {
              el.scale.set(ls.scale, ls.scale, ls.scale)
            }
          } else if (!ls.holdPreview) {
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
     * КРИТИЧНО: во время pre-synth / coeff-edit НИКОГДА не массово гасим слоты.
     * Старый путь `!atomsOnScreen → visible=false` давал пустой starfield при
     * кратком мигании флага на +/-.
     */
    const holdAtoms = previewOnlyMode || coeffEditing
    if (!atomsOnScreen && !holdAtoms) {
      if (root) root.visible = false
      for (let i = 0; i < atomGroupRefs.current.length; i++) {
        const posG = atomGroupRefs.current[i]
        const scG = atomScaleGroupRefs.current[i]
        if (posG) posG.visible = false
        if (scG) scG.visible = false
      }
      return
    }

    // Жёсткий pin в pre-synth: каждые 2 кадра (не каждый) — меньше main-thread hitch.
    if (holdAtoms && !externalAtomControl) {
      const gf = guardFrameRef.current
      if (gf % 2 === 0) {
        if (root) root.visible = true
        const count = Math.max(stickySlotCount, n, shellAtoms.length, 1)
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
    }

    guardFrameRef.current = tickSynthesisPreviewFrame({
      policy: {
        ...tickPolicy,
        // Edit: pin через stride — иначе 15 атомов × 60fps = лишний CPU.
        pinEveryFrame: tickPolicy.pinEveryFrame && guardFrameRef.current % 2 === 0,
        visibilityGuardEvery: Math.max(tickPolicy.visibilityGuardEvery, holdAtoms ? 6 : 2),
      },
      slotCount: stickySlotCount,
      groupVisible: atomsOnScreen || holdAtoms,
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
    if (previewOnlyMode || coeffEditing) {
      g.visible = true
      if (!externalAtomControl && stickySlotCount > 0) {
        // Только force-show: позиции уже пишет sync в эффекте выше (без double-walk).
        shieldForceShowActiveSlots({
          slotCount: stickySlotCount,
          root: g,
          atomGroupRefs,
          atomScaleGroupRefs,
          layoutScale: scale,
        })
      }
      return
    }
    // После синтеза / productOwnsScreen: корень и слоты скрыты — только молекула.
    if (!atomsOnScreen) {
      g.visible = false
      for (let i = 0; i < atomGroupRefs.current.length; i++) {
        const posG = atomGroupRefs.current[i]
        const scaleG = atomScaleGroupRefs.current[i]
        if (posG) posG.visible = false
        if (scaleG) scaleG.visible = false
      }
      return
    }
    g.visible = true
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
    coeffEditing,
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
  ])

  const forceElectronMotion = true
  /**
   * Космический дизайн (nebula + орбиты + CPK): previewLite=false, rings on.
   * Стабильность — sticky slots / keyboard commit; FPS — electronFrameSkip.
   */
  const hotDense = (policy.hotCoeffEdit || coeffEditing) && n >= 8
  /**
   * Pre-synth: держим тёплый пул слотов (до 12), чтобы рост coeff
   * не cold-mount'ил Bohr пачкой → hitch / пустой кадр.
   */
  const warmPool = holdPreview ? Math.min(16, Math.max(stickySlotCount, 12)) : stickySlotCount
  const mountBohrCount = Math.min(
    24,
    Math.max(warmPool, Math.min(poolSize, stickySlotCount + (holdPreview ? 0 : 2))),
  )
  // Не режем визуал lite'ом — только реже пишем матрицы электронов.
  const editSkip = hotDense ? 3 : holdPreview ? 2 : 1
  const editLocalLight = !sharedLighting && (atomsOnScreen || holdPreview)

  return (
    <group
      ref={groupRef}
      visible={atomsOnScreen || holdPreview}
      frustumCulled={false}
    >
      {!sharedLighting && (atomsOnScreen || holdPreview) ? (
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
        const slotVisible = i < stickySlotCount && (atomsOnScreen || holdPreview)
        return (
          <group key={`slot-${i}`} visible={slotVisible} ref={getPosRef(i)}>
            <group scale={scale} visible={slotVisible} ref={getScaleRef(i)}>
              <ReactorPreviewAtomSlot
                z={slotZ}
                animate={forceElectronMotion && (atomsOnScreen || holdPreview)}
                previewStatic={false}
                useFullDetail={false}
                synthesisGlass={false}
                previewLite={false}
                electronFrameSkip={editSkip}
                hideOrbitRings={false}
                localLight={editLocalLight}
              />
            </group>
          </group>
        )
      })}
    </group>
  )
}