#!/usr/bin/env node
/**
 * Автотесты стабильности синтеза (pure TS, без WebGL).
 * Запуск: npm run test:synthesis-stability
 */
import assert from 'node:assert/strict'
import { expandLeftTermsToPreviewSlots } from '../src/chemistry/reactorEquationBalance.ts'
import type { ReactorEquationTerm } from '../src/chemistry/reactorEquationBalance.ts'
import { buildReactorPreviewAtoms, reactorPreviewAtomScale, PREVIEW_ATOM_SCALE, PREVIEW_ATOM_MIN_GAP, previewAtomsMinPairDistance } from '../src/components/lab/reactorPreviewLayout.ts'
import { resolveSynthesisContinuity } from '../src/lab/synthesisAntiBlink.ts'
import { isVisualCoverageOk } from '../src/lab/visualCoverageController.ts'
import { isReactorCoeffEditing } from '../src/lab/reactorCoeffEditMode.ts'
import { canIdleGpuPrewarm, canIdleGpuCompileQueue } from '../src/lab/synthesisPrewarmPolicy.ts'
import { getReactorPreviewPolicy } from '../src/lab/synthesisLagGuard.ts'
import { buildPreviewLayoutSync } from '../src/lab/reactorPreviewLayoutWorkerClient.ts'
import {
  assertLayoutShellInvariant,
  evaluateScenario,
  expectedForScenario,
  type SynthesisStabilityScenario,
} from '../src/lab/synthesisStabilityContract.ts'
import {
  shouldForceSyncPreviewLayout,
  shouldAllowWorkerPreviewLayout,
} from '../src/lab/atomlabPerfGuard.ts'
import {
  assertPreviewCoverage,
  deferHeavyLayoutRebuild,
  allowProductGpuMount,
} from '../src/lab/atomlabSynthesisGuard.ts'
import { SYNC_BUILD_ATOM_CAP } from '../src/lab/useReactorPreviewLayout.ts'
import {
  buildPreviewLayoutForEdit,
  pickLayoutAtoms,
  simulateCoeffEditLayoutSteps,
  shouldScheduleIdleLayoutRebuild,
} from '../src/lab/previewLayoutPolicy.ts'
import { resolveStablePreviewRenderAtoms, buildPreviewRenderSnapshot } from '../src/lab/previewRenderAtoms.ts'
import { shellRenderCountTs } from '../src/wasm/previewAtomShellWasm.ts'
import { mergePreviewLayoutSlots, resolvePreviewLayoutSlotAtom } from '../src/lab/previewLayoutSlots.ts'
import {
  createPreviewEngineState,
  estimateExpectedAtomCount,
  resolvePreviewEngineFrame,
  resolvePreviewFramePolicy,
  bumpSettlePinUntil,
  isSettlePinActive,
  withSettlePinPolicy,
  PREVIEW_SETTLE_PIN_MS,
} from '../src/lab/synthesisPreviewEngine/index.ts'
import { restorePreviewActiveSlotVisibility } from '../src/lab/previewAtomFrameGuard.ts'
import {
  PREVIEW_POOL_STEP,
  PREVIEW_POOL_STEP_DENSE,
  PREVIEW_POOL_DENSE_THRESHOLD,
  quantizePoolSize,
} from '../src/lab/synthesisPreviewEngine/previewEngineState.ts'
import {
  resolvePreviewEditingActive,
  resolvePreviewExternalAtomControl,
} from '../src/lab/synthesisPreviewEngine/previewExternalControl.ts'
import { resolveSynthesisProductSlot } from '../src/lab/synthesisProductSlot.ts'

function k2cr2o7Terms(): ReactorEquationTerm[] {
  return [
    { id: 'cr', z: 24, coeff: 4 },
    { id: 'k', z: 19, coeff: 4 },
    { id: 'o2', z: 8, coeff: 7, diatomic: true },
  ]
}

function mockSticky<T>(initial: T | null = null) {
  return { current: initial }
}

// --- layout: K2Cr2O7 = 15 preview atoms ---
{
  const terms = k2cr2o7Terms()
  const slots = expandLeftTermsToPreviewSlots(terms)
  assert.equal(slots.length, 15, 'K2Cr2O7 preview slot count')
  const atoms = buildReactorPreviewAtoms(terms, { tier: 'full' })
  assert.equal(atoms.length, slots.length, 'layout atoms match slots')
  assert.equal(atoms.length, 15)
}

// --- constant atom scale (v1.2.0 contract) ---
{
  assert.equal(reactorPreviewAtomScale(6), PREVIEW_ATOM_SCALE)
  assert.equal(reactorPreviewAtomScale(30), PREVIEW_ATOM_SCALE)
}

// --- coeff edit: preview always visible, no product takeover ---
{
  const stickyMountRef = mockSticky(null)
  const previewStickyRef = mockSticky(null)
  const view = resolveSynthesisContinuity({
    runId: 0,
    synthActive: false,
    synthesisRunActive: false,
    synthesisPhase: '',
    showSettledHero: false,
    mountReactorPreview: true,
    reactorViewOpen: true,
    gpuPrewarmAllowed: false,
    prewarmReady: false,
    productCompoundId: 'k2cr2o7',
    earlyProductReveal: false,
    forceProductSlot: false,
    productRevealReady: false,
    productPainted: false,
    coeffEditBurst: true,
    stickyMountRef,
    previewStickyRef,
  })
  assert.equal(view.reactorPreviewVisible, true, 'preview visible during coeff burst')
  assert.equal(view.productMeshMounted, false, 'no product mesh during coeff burst')
  assert.equal(view.productSlotVisible, false, 'no product slot during coeff burst')
  const covered = isVisualCoverageOk({
    continuity: view,
    mergeFx: false,
    convergeFx: false,
    editMode: true,
  })
  assert.equal(covered, true, 'visual coverage during edit')
}

// --- balanced equation edit: no product mount until synth ---
{
  const stickyMountRef = mockSticky(null)
  const previewStickyRef = mockSticky(null)
  const view = resolveSynthesisContinuity({
    runId: 0,
    synthActive: false,
    synthesisRunActive: false,
    synthesisPhase: '',
    showSettledHero: false,
    mountReactorPreview: true,
    reactorViewOpen: true,
    gpuPrewarmAllowed: false,
    prewarmReady: false,
    productCompoundId: 'k2cr2o7',
    earlyProductReveal: false,
    forceProductSlot: false,
    productRevealReady: false,
    productPainted: false,
    coeffEditBurst: false,
    stickyMountRef,
    previewStickyRef,
  })
  assert.equal(view.productMeshMounted, false, 'balanced idle: no product GPU mount')
  assert.equal(view.reactorPreviewVisible, true)
}

// --- electrons animate during coeff burst up to 48 atoms ---
{
  const policy = getReactorPreviewPolicy({
    atomCount: 15,
    forceLite: true,
    flightActive: false,
    visible: true,
    coeffEditBurst: true,
    maxAnimatedAtoms: 12,
  })
  assert.equal(policy.electronAnimate, true, 'electrons on during burst even if lowPower cap is 12')
}

// --- sync cap exported ---
assert.ok(SYNC_BUILD_ATOM_CAP >= 10 && SYNC_BUILD_ATOM_CAP <= 16)

// --- rapid coeff changes: layout cache returns same count ---
{
  const terms = k2cr2o7Terms()
  for (let c = 1; c <= 7; c++) {
    const t = terms.map((x, i) => (i === 2 ? { ...x, coeff: c } : x))
    const n = buildReactorPreviewAtoms(t, { tier: 'full' }).length
    assert.equal(n, expandLeftTermsToPreviewSlots(t).length)
  }
}

// --- idle GPU prewarm allowed when balanced, not during burst ---
{
  assert.equal(
    canIdleGpuPrewarm({
      reactorOpen: true,
      coeffEditBurst: false,
      synthesisRunActive: false,
      hasProduct: true,
    }),
    true,
  )
  assert.equal(
    canIdleGpuPrewarm({
      reactorOpen: true,
      coeffEditBurst: true,
      synthesisRunActive: false,
      hasProduct: true,
    }),
    false,
  )
  assert.equal(
    canIdleGpuPrewarm({
      reactorOpen: true,
      coeffEditBurst: false,
      coeffEditing: true,
      synthesisRunActive: false,
      hasProduct: true,
    }),
    true,
    'visualHold alone does not block GPU prewarm',
  )
  assert.equal(
    canIdleGpuCompileQueue({
      reactorOpen: true,
      coeffEditBurst: false,
      synthesisRunActive: false,
      synthActive: false,
    }),
    true,
  )
  assert.equal(
    canIdleGpuCompileQueue({
      reactorOpen: true,
      coeffEditBurst: true,
      synthesisRunActive: false,
    }),
    false,
  )
  assert.equal(
    canIdleGpuCompileQueue({
      reactorOpen: true,
      coeffEditBurst: false,
      coeffEditing: true,
      synthesisRunActive: false,
      synthActive: false,
    }),
    false,
    'coeffEditing (visualHold/settle) blocks GPU compile queue',
  )
  assert.equal(
    canIdleGpuCompileQueue({
      reactorOpen: true,
      coeffEditBurst: false,
      synthesisRunActive: true,
    }),
    false,
  )
}

// --- burst layout: sync path always returns atoms for heavy equations ---
{
  const terms = k2cr2o7Terms()
  const sync = buildPreviewLayoutSync(terms)
  assert.equal(sync.atoms.length, 15, 'sync layout for K2Cr2O7')
  assert.ok(
    assertLayoutShellInvariant(terms, sync.atoms, sync.atoms),
    'shell invariant for sync layout',
  )
}

// --- stability contract: all documented scenarios ---
{
  const scenarios: SynthesisStabilityScenario[] = [
    'coeff_burst_edit',
    'coeff_burst_idle_gap',
    'balanced_idle',
    'synth_before_product_paint',
    'synth_product_handoff',
    'settled_handoff',
  ]
  for (const scenario of scenarios) {
    const exp = expectedForScenario(scenario)
    const { view, coverageOk, idlePrewarmOk } = evaluateScenario(scenario)
    assert.equal(view.reactorPreviewVisible, exp.previewVisible, `${scenario}: previewVisible`)
    assert.equal(view.reactorPreviewMounted, exp.previewMounted, `${scenario}: previewMounted`)
    assert.equal(view.productMeshMounted, exp.productMesh, `${scenario}: productMesh`)
    assert.equal(view.productSlotVisible, exp.productSlot, `${scenario}: productSlot`)
    assert.equal(coverageOk, exp.coverageOk, `${scenario}: coverageOk`)
    if (exp.idlePrewarmOk != null) {
      assert.equal(idlePrewarmOk, exp.idlePrewarmOk, `${scenario}: idlePrewarmOk`)
    }
  }
}

// --- popular substances: layout never empty when terms valid ---
{
  const ids = ['h2o', 'nacl', 'co2'] as const
  for (const id of ids) {
    const terms: ReactorEquationTerm[] = [
      { id: 'a', z: 1, coeff: 2 },
      { id: 'b', z: 8, coeff: 1, diatomic: true },
    ]
    const atoms = buildReactorPreviewAtoms(terms, { tier: 'full' })
    assert.ok(atoms.length >= 2, `layout atoms for mock ${id}`)
  }
}

// --- coeff editing flag ---
{
  assert.equal(isReactorCoeffEditing(true, true), true)
  assert.equal(isReactorCoeffEditing(false, false), true)
  assert.equal(isReactorCoeffEditing(false, true), false)
}

// --- coeff edit pre-synthesis: preview only ---
{
  const stickyMountRef = mockSticky(null)
  const previewStickyRef = mockSticky(null)
  const view = resolveSynthesisContinuity({
    runId: 0,
    synthActive: false,
    synthesisRunActive: false,
    synthesisPhase: '',
    showSettledHero: false,
    mountReactorPreview: true,
    reactorViewOpen: true,
    gpuPrewarmAllowed: true,
    prewarmReady: true,
    productCompoundId: 'salt_k2cr2o7',
    earlyProductReveal: false,
    forceProductSlot: false,
    productRevealReady: false,
    productPainted: false,
    coeffEditBurst: true,
    coeffEditing: true,
    stickyMountRef,
    previewStickyRef,
  })
  assert.equal(view.reactorPreviewVisible, true, 'preview during coeff edit')
  assert.equal(view.productMeshMounted, false)
}

// --- pre-synthesis balanced: only atoms, no GPU product ---
{
  const stickyMountRef = mockSticky(null)
  const previewStickyRef = mockSticky(null)
  const view = resolveSynthesisContinuity({
    runId: 0,
    synthActive: false,
    synthesisRunActive: false,
    synthesisPhase: '',
    showSettledHero: false,
    mountReactorPreview: true,
    reactorViewOpen: true,
    gpuPrewarmAllowed: true,
    prewarmReady: true,
    productCompoundId: 'salt_k2cr2o7',
    earlyProductReveal: false,
    forceProductSlot: false,
    productRevealReady: false,
    productPainted: false,
    coeffEditBurst: false,
    coeffEditing: false,
    stickyMountRef,
    previewStickyRef,
  })
  assert.equal(view.reactorPreviewVisible, true, 'balanced pre-run: preview visible')
  assert.equal(view.productMeshMounted, true, 'balanced pre-run: micro GPU prewarm may mount')
  assert.equal(view.productSlotVisible, false, 'balanced pre-run: product slot stays off')
  assert.equal(view.productPrewarm, true, 'balanced pre-run: only micro-prewarm')
}

// --- cleared equation: no stale preview shell ---
{
  const stickyMountRef = mockSticky(null)
  const previewStickyRef = mockSticky(null)
  const view = resolveSynthesisContinuity({
    runId: 0,
    synthActive: false,
    synthesisRunActive: false,
    synthesisPhase: '',
    showSettledHero: false,
    mountReactorPreview: false,
    reactorViewOpen: true,
    gpuPrewarmAllowed: false,
    prewarmReady: false,
    productCompoundId: null,
    earlyProductReveal: false,
    forceProductSlot: false,
    productRevealReady: false,
    productPainted: false,
    coeffEditBurst: false,
    stickyMountRef,
    previewStickyRef,
  })
  assert.equal(view.reactorPreviewMounted, false, 'empty reactor: no preview mount')
  assert.equal(view.reactorPreviewVisible, false)
}

{
  assert.equal(shouldForceSyncPreviewLayout(15, true), true)
  assert.equal(shouldAllowWorkerPreviewLayout(15, true), false)
  assert.equal(shouldAllowWorkerPreviewLayout(15, false), true)
}

// --- pickLayoutAtoms: hold shell while layout catches up during edit ---
{
  const terms = k2cr2o7Terms()
  const full = buildPreviewLayoutForEdit(terms, [], false)
  const partialTerms = terms.map((t, i) => (i === 2 ? { ...t, coeff: 3 } : t))
  const partial = buildReactorPreviewAtoms(partialTerms, { tier: 'full' })
  const held = pickLayoutAtoms(partial, full, true, 15)
  assert.equal(held.length, full.length, 'edit hold keeps larger shell until built catches up')
}

// --- synthesisPreviewEngine: shell hold during edit ---
{
  const state = createPreviewEngineState()
  const terms = k2cr2o7Terms()
  const full = buildReactorPreviewAtoms(terms, { tier: 'full' })
  state.shellAtoms = full
  const partial = full.slice(0, 7)
  const frame = resolvePreviewEngineFrame(state, {
    terms,
    previewAtoms: partial,
    editingActive: true,
    previewOnlyMode: true,
    synthHoldPreview: false,
    coeffEditing: true,
    layoutPending: false,
    lockPoolSize: true,
  })
  assert.ok(frame.slotCount >= 15, 'engine holds shell count during edit')
  assert.equal(frame.groupVisible, true)
  const policy = resolvePreviewFramePolicy({
    atomCount: frame.slotCount,
    editingActive: true,
    coeffEditBurst: true,
    coeffEditing: true,
    flightActive: false,
    groupVisible: true,
    forceLite: false,
    frameBudgetLite: false,
    lowPowerProfile: {
      tier: 'mid',
      isMobileSoc: false,
      forceLiteReactor: false,
      maxAnimatedAtoms: 48,
      minElectronFrameSkip: 1,
      canvasDpr: 1.5,
      disableAtomDrift: false,
      disableSlowSpin: false,
      productPaintLatchFrames: 4,
      coeffEditLayoutDebounceMs: 0,
    },
  })
  assert.equal(policy.pinEveryFrame, true)
  assert.equal(policy.hotCoeffEdit, true)
  // Pin + guard каждый кадр — атомы не успевают «залипнуть» invisible.
  assert.ok(policy.visibilityGuardEvery >= 1)
}

// Idle превью (открыт реактор = editingActive) — pin ВСЕГДА, электроны живы.
{
  const idle = resolvePreviewFramePolicy({
    atomCount: 15,
    editingActive: true,
    coeffEditBurst: false,
    coeffEditing: false,
    flightActive: false,
    groupVisible: true,
    forceLite: false,
    frameBudgetLite: false,
    lowPowerProfile: {
      tier: 'mid',
      isMobileSoc: false,
      forceLiteReactor: false,
      maxAnimatedAtoms: 48,
      minElectronFrameSkip: 1,
      canvasDpr: 1.5,
      disableAtomDrift: false,
      disableSlowSpin: false,
      productPaintLatchFrames: 4,
      coeffEditLayoutDebounceMs: 0,
    },
  })
  assert.equal(idle.hotCoeffEdit, false)
  assert.equal(idle.pinEveryFrame, true, 'pre-synth must pin every frame')
  assert.equal(idle.electronAnimate, true)
  assert.equal(idle.lockPoolSize, true)
}

// --- settle pin: после hot +/- pin держится ещё PREVIEW_SETTLE_PIN_MS ---
{
  const idle = resolvePreviewFramePolicy({
    atomCount: 15,
    editingActive: true,
    coeffEditBurst: false,
    coeffEditing: false,
    flightActive: false,
    groupVisible: true,
    forceLite: false,
    frameBudgetLite: false,
    lowPowerProfile: {
      tier: 'mid',
      isMobileSoc: false,
      forceLiteReactor: false,
      maxAnimatedAtoms: 48,
      minElectronFrameSkip: 1,
      canvasDpr: 1.5,
      disableAtomDrift: false,
      disableSlowSpin: false,
      productPaintLatchFrames: 4,
      coeffEditLayoutDebounceMs: 0,
    },
  })
  const now = 1000
  const until = bumpSettlePinUntil(true, now, 0)
  assert.equal(until, now + PREVIEW_SETTLE_PIN_MS)
  assert.equal(isSettlePinActive(now + 10, until), true)
  assert.equal(isSettlePinActive(until + 1, until), false)
  const settled = withSettlePinPolicy(idle, true, true)
  assert.equal(settled.pinEveryFrame, true)
  assert.equal(settled.lockVisualTier, true)
  // groupVisible=false → settle не меняет политику (возвращает как есть)
  const blocked = withSettlePinPolicy(idle, true, false)
  assert.equal(blocked.pinEveryFrame, idle.pinEveryFrame)
}

// --- restore slots after hide: children visible again without relying on React props ---
{
  const mkGroup = (visible: boolean) => ({ visible, scale: { x: 1, y: 1, z: 1, set() {} } })
  const root = mkGroup(false)
  const posRefs = { current: [mkGroup(false), mkGroup(false), mkGroup(false)] }
  const scaleRefs = {
    current: [
      { visible: false, scale: { x: 0.1, y: 0.1, z: 0.1, set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z } } },
      { visible: false, scale: { x: 0.1, y: 0.1, z: 0.1, set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z } } },
      { visible: false, scale: { x: 0.1, y: 0.1, z: 0.1, set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z } } },
    ],
  }
  restorePreviewActiveSlotVisibility({
    atomCount: 2,
    rootRef: root as never,
    atomGroupRefs: posRefs as never,
    atomScaleGroupRefs: scaleRefs as never,
    layoutScale: 1,
  })
  assert.equal(root.visible, true)
  assert.equal(posRefs.current[0]!.visible, true)
  assert.equal(posRefs.current[1]!.visible, true)
  assert.equal(posRefs.current[2]!.visible, false, 'tail slot untouched by restore')
  assert.equal(scaleRefs.current[0]!.visible, true)
  assert.equal(scaleRefs.current[1]!.visible, true)
}

// --- merge layout slots: индексы pool = индексы слотов ---
{
  const shell = buildReactorPreviewAtoms(k2cr2o7Terms(), { tier: 'full' })
  const partial = shell.slice(0, 7)
  const merged = mergePreviewLayoutSlots(15, partial, shell)
  assert.equal(merged.length, 15)
  assert.equal(merged[0]?.z, shell[0]?.z)
  assert.equal(merged[6]?.z, partial[6]?.z)
  assert.equal(merged[7]?.z, shell[7]?.z)
  assert.equal(merged[14]?.z, shell[14]?.z)
  assert.equal(resolvePreviewLayoutSlotAtom(9, partial, shell)?.z, shell[9]?.z)
}

// --- shell render count (C++ mirror TS) ---
{
  assert.equal(shellRenderCountTs(3, 15, 15, true), 15)
  assert.equal(shellRenderCountTs(0, 15, 15, true), 15)
  assert.equal(shellRenderCountTs(7, 15, 7, true), 7)
  const shell = buildReactorPreviewAtoms(k2cr2o7Terms(), { tier: 'full' })
  const snap = buildPreviewRenderSnapshot([], shell, 15, true)
  assert.equal(snap.renderCount, 15)
  assert.ok(snap.atoms.length >= 15)
}

// --- resolveStablePreviewRenderAtoms: shell not clobbered ---
{
  const terms = k2cr2o7Terms()
  const shell = buildReactorPreviewAtoms(terms, { tier: 'full' })
  const partialTerms = terms.map((t, i) => (i === 2 ? { ...t, coeff: 1 } : t))
  const preview = buildReactorPreviewAtoms(partialTerms, { tier: 'full' })
  const stable = resolveStablePreviewRenderAtoms(preview, shell, 15, true)
  assert.ok(stable.length >= preview.length, 'stable render never shrinks below preview during edit lag')
  assert.ok(stable.length >= 11, 'stable render holds shell while expected > preview')
}

// --- K2Cr2O7 rapid +/-: sync edit layout never empty ---
{
  const terms = k2cr2o7Terms()
  const steps = simulateCoeffEditLayoutSteps(terms, 2, [1, 2, 3, 4, 5, 6, 7])
  assert.equal(steps.length, 7)
  for (let i = 0; i < steps.length; i++) {
    const t = terms.map((x, j) => (j === 2 ? { ...x, coeff: i + 1 } : x))
    assert.ok(
      assertLayoutShellInvariant(t, steps[i]!, steps[i]!),
      `K2Cr2O7 coeff step ${i + 1}: shell invariant`,
    )
    assert.ok(steps[i]!.length > 0, `K2Cr2O7 coeff step ${i + 1}: atoms visible`)
  }
}

// --- coeff editing always sync-build (no defer during edit) ---
{
  const terms = k2cr2o7Terms()
  const atoms = buildPreviewLayoutForEdit(terms, [])
  assert.equal(atoms.length, 15)
  assert.equal(deferHeavyLayoutRebuild(15, true), true, 'wasm defers only when editing flag set')
  assert.equal(shouldScheduleIdleLayoutRebuild(15, true, true, false), false)
  assert.equal(shouldScheduleIdleLayoutRebuild(15, false, true, false), true)
}

// --- product GPU mount gate ---
{
  assert.equal(allowProductGpuMount(true, true, false), false, 'no mount during coeff burst')
  assert.equal(allowProductGpuMount(false, false, true), true, 'mount during synth')
}

// --- product slot: prewarm then visible (no deadlock) ---
{
  type CompoundDef = import('../src/types/chemistry.ts').CompoundDef
  const compound = { id: 'salt_k2cr2o7' } as CompoundDef
  const slot = resolveSynthesisProductSlot({
    productForSlot: compound,
    productSlotVisible: true,
    productPrewarmActive: false,
    showSettledHero: false,
    synthLive: true,
    prewarmReady: false,
    prewarmCompoundId: null,
  })
  assert.equal(slot.visible, true, 'visible immediately during synth cold compile')
  assert.equal(slot.prewarm, false, 'no hidden micro-prewarm during synth')
  const ready = resolveSynthesisProductSlot({
    productForSlot: compound,
    productSlotVisible: true,
    productPrewarmActive: false,
    showSettledHero: false,
    synthLive: true,
    prewarmReady: true,
    prewarmCompoundId: 'salt_k2cr2o7',
  })
  assert.equal(ready.visible, true, 'visible after gpu compile')
  assert.equal(ready.prewarm, false)
}

{
  assert.equal(deferHeavyLayoutRebuild(20, true), true)
  assert.equal(deferHeavyLayoutRebuild(8, true), false)
  assert.equal(
    assertPreviewCoverage({
      termsNonempty: true,
      previewMounted: true,
      rootVisible: false,
      productPainted: false,
      synthLive: false,
    }),
    'root_hidden',
  )
  assert.equal(
    assertPreviewCoverage({
      termsNonempty: true,
      previewMounted: true,
      rootVisible: true,
      productPainted: true,
      synthLive: true,
    }),
    'ok',
  )
}

// --- pool quantization: длина массива слотов меняется реже ---
{
  assert.equal(quantizePoolSize(0), 0)
  assert.equal(quantizePoolSize(1), PREVIEW_POOL_STEP)
  assert.equal(quantizePoolSize(PREVIEW_POOL_STEP), PREVIEW_POOL_STEP)
  assert.equal(quantizePoolSize(PREVIEW_POOL_STEP + 1), PREVIEW_POOL_STEP * 2)
  assert.equal(quantizePoolSize(17), 20, 'dense pool step for >16 atoms')
  assert.equal(PREVIEW_POOL_STEP_DENSE, 4)
  assert.equal(PREVIEW_POOL_DENSE_THRESHOLD, 16)
  // Пул всегда >= фактического числа атомов
  for (let n = 1; n <= 60; n++) {
    assert.ok(quantizePoolSize(n) >= n, `pool covers ${n} atoms`)
  }
}

// --- сложное уравнение, быстрые +/-: движок не роняет видимые атомы ---
{
  const base: ReactorEquationTerm[] = [
    { id: 'cr', z: 24, coeff: 2 },
    { id: 'k', z: 19, coeff: 2 },
    { id: 'o', z: 8, coeff: 7, diatomic: true },
    { id: 'h', z: 1, coeff: 4, diatomic: true },
    { id: 'cl', z: 17, coeff: 6, diatomic: true },
    { id: 's', z: 16, coeff: 1 },
  ]
  const state = createPreviewEngineState()
  let lastPool = 0
  // Быстрое чередование коэффициентов (нервное +/-) на сложном веществе
  const pattern = [4, 8, 2, 12, 3, 16, 1, 20, 5, 10, 2, 14, 6, 18, 3, 9]
  for (const c of pattern) {
    const terms = base.map((t, i) => (i === 3 ? { ...t, coeff: c } : t))
    const expected = estimateExpectedAtomCount(terms)
    const previewAtoms = buildReactorPreviewAtoms(terms, {
      tier: expected > 12 ? 'lite' : 'full',
    })
    const frame = resolvePreviewEngineFrame(state, {
      terms,
      previewAtoms,
      editingActive: true,
      previewOnlyMode: true,
      synthHoldPreview: false,
      coeffEditing: true,
      layoutPending: false,
      lockPoolSize: true,
    })
    // Каждый слот < slotCount имеет непустой атом (нет дыр — нет пропадания)
    for (let i = 0; i < frame.slotCount; i++) {
      const a = frame.layoutAtoms[i] ?? state.shellAtoms[i]
      assert.ok(a, `complex edit: slot ${i} has atom (coeff=${c})`)
    }
    // Пул монотонен во время editing (lockPoolSize) — React не размонтирует слоты
    assert.ok(frame.poolSize >= lastPool, `pool monotonic during edit (coeff=${c})`)
    assert.ok(frame.poolSize >= frame.slotCount, 'pool covers slotCount')
    assert.ok(frame.slotCount >= expected, `slotCount holds >= expected (coeff=${c})`)
    lastPool = frame.poolSize
  }
}

// --- synth launch: pin preview until GSAP flight (no white frame) ---
{
  assert.equal(
    resolvePreviewExternalAtomControl({
      flightActive: false,
      poseLocked: false,
      previewOnlyMode: false,
      synthHoldPreview: true,
    }),
    false,
    'hold preview pin before flight',
  )
  assert.equal(
    resolvePreviewExternalAtomControl({
      flightActive: true,
      poseLocked: false,
      previewOnlyMode: false,
      synthHoldPreview: true,
    }),
    true,
    'GSAP owns refs during converge',
  )
  assert.equal(
    resolvePreviewEditingActive({
      coeffEditing: false,
      previewOnlyMode: false,
      synthHoldPreview: true,
    }),
    true,
    'shell-hold during synth before product paint',
  )
  const state = createPreviewEngineState()
  const terms = k2cr2o7Terms()
  const full = buildReactorPreviewAtoms(terms, { tier: 'full' })
  state.shellAtoms = full
  const frame = resolvePreviewEngineFrame(state, {
    terms,
    previewAtoms: full,
    editingActive: true,
    previewOnlyMode: false,
    synthHoldPreview: true,
    coeffEditing: false,
    layoutPending: false,
    lockPoolSize: true,
  })
  assert.equal(frame.groupVisible, true, 'synth hold keeps preview visible')
  assert.ok(frame.slotCount >= 15)
}

// --- K2Cr2O7 user-reported coeff patterns: never empty viewport ---
{
  const base: ReactorEquationTerm[] = [
    { id: 'cr', z: 24, coeff: 1 },
    { id: 'k', z: 19, coeff: 1 },
    { id: 'o2', z: 8, coeff: 1, diatomic: true },
  ]
  const state = createPreviewEngineState()
  const sequences: ReactorEquationTerm[][] = []
  for (let o = 1; o <= 7; o++) {
    sequences.push(base.map((t, i) => (i === 2 ? { ...t, coeff: o } : t)))
  }
  for (let c = 1; c <= 4; c++) {
    sequences.push([
      { id: 'cr', z: 24, coeff: c },
      { id: 'k', z: 19, coeff: 4 },
      { id: 'o2', z: 8, coeff: 4, diatomic: true },
    ])
  }
  for (let k = 1; k <= 4; k++) {
    sequences.push([
      { id: 'cr', z: 24, coeff: 2 },
      { id: 'k', z: 19, coeff: k },
      { id: 'o2', z: 8, coeff: 4, diatomic: true },
    ])
  }
  sequences.push(k2cr2o7Terms())

  for (const terms of sequences) {
    const expected = estimateExpectedAtomCount(terms)
    const preview = buildReactorPreviewAtoms(terms, {
      tier: expected > 12 ? 'lite' : 'full',
    })
    const frame = resolvePreviewEngineFrame(state, {
      terms,
      previewAtoms: preview,
      editingActive: true,
      previewOnlyMode: true,
      synthHoldPreview: false,
      coeffEditing: true,
      layoutPending: false,
      lockPoolSize: true,
    })
    const label = terms.map((t) => `${t.id}=${t.coeff}`).join(',')
    assert.ok(frame.slotCount > 0, `K2Cr2O7 pattern ${label}: slotCount > 0`)
    assert.ok(frame.groupVisible, `K2Cr2O7 pattern ${label}: groupVisible`)
    assert.ok(
      frame.slotCount >= expected,
      `K2Cr2O7 pattern ${label}: slotCount ${frame.slotCount} >= expected ${expected}`,
    )
    const merged = mergePreviewLayoutSlots(frame.slotCount, preview, state.shellAtoms)
    assert.equal(
      merged.length,
      frame.slotCount,
      `K2Cr2O7 pattern ${label}: merge length matches slotCount`,
    )
    for (let i = 0; i < frame.slotCount; i++) {
      const atom = frame.layoutAtoms[i] ?? state.shellAtoms[i] ?? merged[i]
      assert.ok(atom, `K2Cr2O7 pattern ${label}: slot ${i} has atom`)
    }
  }
}

// --- mergePreviewLayoutSlots: never returns short array when slotCount > 0 ---
{
  const shell = buildReactorPreviewAtoms(k2cr2o7Terms(), { tier: 'full' })
  for (const slotCount of [1, 6, 7, 15, 16, 20]) {
    const partial = shell.slice(0, Math.min(3, shell.length))
    const merged = mergePreviewLayoutSlots(slotCount, partial, shell)
    assert.equal(merged.length, slotCount, `merge pads to slotCount=${slotCount}`)
  }
}

// --- dense coeff packing: атомы не сливаются (визуально «не пропадают») ---
{
  const denseCases: ReactorEquationTerm[][] = [
    k2cr2o7Terms(),
    [
      { id: 'cr', z: 24, coeff: 8 },
      { id: 'k', z: 19, coeff: 8 },
      { id: 'o2', z: 8, coeff: 14, diatomic: true },
    ],
    [{ id: 'a', z: 1, coeff: 16 }],
    [{ id: 'a', z: 1, coeff: 24 }],
    [{ id: 'a', z: 1, coeff: 32 }],
    [{ id: 'a', z: 1, coeff: 48 }],
    [
      { id: 'a', z: 1, coeff: 12 },
      { id: 'b', z: 2, coeff: 12 },
      { id: 'c', z: 3, coeff: 12 },
      { id: 'd', z: 4, coeff: 12 },
    ],
    [
      { id: 'a', z: 1, coeff: 20 },
      { id: 'b', z: 2, coeff: 20 },
    ],
  ]
  const floor = PREVIEW_ATOM_MIN_GAP * 0.88
  for (const terms of denseCases) {
    const atoms = buildReactorPreviewAtoms(terms, { tier: 'full' })
    const expected = estimateExpectedAtomCount(terms)
    assert.equal(atoms.length, expected, `dense count ${terms.map((t) => t.coeff).join('+')}`)
    const md = previewAtomsMinPairDistance(atoms)
    assert.ok(
      md >= floor,
      `dense minDist ${md.toFixed(3)} >= ${floor.toFixed(3)} for ${terms.map((t) => t.coeff).join('+')}`,
    )
  }
}

// --- rapid +/- up to 48: engine never drops a slot atom ---
{
  const state = createPreviewEngineState()
  const pattern = [1, 4, 8, 16, 24, 32, 40, 48, 36, 20, 12, 6, 2, 48, 1, 30]
  for (const c of pattern) {
    const terms: ReactorEquationTerm[] = [
      { id: 'cr', z: 24, coeff: Math.max(1, Math.floor(c / 3)) },
      { id: 'k', z: 19, coeff: Math.max(1, Math.floor(c / 3)) },
      { id: 'o2', z: 8, coeff: Math.max(1, c - 2 * Math.max(1, Math.floor(c / 3))), diatomic: true },
    ]
    let total = estimateExpectedAtomCount(terms)
    if (total > 48) {
      terms[2] = { ...terms[2]!, coeff: Math.max(1, terms[2]!.coeff - (total - 48)) }
      total = estimateExpectedAtomCount(terms)
    }
    const previewAtoms = buildReactorPreviewAtoms(terms, {
      tier: total > 12 ? 'lite' : 'full',
    })
    const frame = resolvePreviewEngineFrame(state, {
      terms,
      previewAtoms,
      editingActive: true,
      previewOnlyMode: true,
      synthHoldPreview: false,
      coeffEditing: true,
      layoutPending: false,
      lockPoolSize: false,
      hotCoeffEdit: true,
    })
    assert.ok(frame.poolSize >= frame.slotCount, `pool covers slots at c~${c}`)
    assert.ok(frame.slotCount >= total, `slotCount >= expected at c~${c}`)
    for (let i = 0; i < frame.slotCount; i++) {
      const a = frame.layoutAtoms[i] ?? state.shellAtoms[i]
      assert.ok(a, `no hole at slot ${i} (c~${c}, total=${total})`)
    }
    const md = previewAtomsMinPairDistance(previewAtoms)
    assert.ok(md >= 0.45, `layout spacing ok at total=${total}: ${md.toFixed(3)}`)
  }
}

console.log('test-synthesis-stability: all passed')
