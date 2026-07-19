/**
 * Жёсткий стресс ReactorPreviewShield + rapid +/- (K₂Cr₂O₇).
 * Запуск: npx tsx scripts/test-reactor-preview-shield.mts
 */
import assert from 'node:assert/strict'
import type { ReactorEquationTerm } from '../src/chemistry/reactorEquationBalance.ts'
import { buildReactorPreviewAtoms } from '../src/components/lab/reactorPreviewLayout.ts'
import { resolveAtomStructurePreviewFlags } from '../src/lab/atomStructurePreviewFlags.ts'
import {
  createPreviewEngineState,
  resolvePreviewEngineFrame,
  resolvePreviewFramePolicy,
} from '../src/lab/synthesisPreviewEngine/index.ts'
import {
  REACTOR_SHIELD,
  bumpShieldOnCoeffEdit,
  createShieldSnapshot,
  resolveShieldRenderPolicy,
  shieldAllowsCanvasRemount,
  shieldAllowsGpuCompile,
  tickShieldPhase,
} from '../src/lab/reactorPreviewShield/index.ts'
import { simulateCoeffEditLayoutSteps } from '../src/lab/previewLayoutPolicy.ts'

const lowPower = {
  tier: 'mid' as const,
  isMobileSoc: false,
  forceLiteReactor: false,
  maxAnimatedAtoms: 48,
  minElectronFrameSkip: 1,
  canvasDpr: 1.5,
  disableAtomDrift: false,
  disableSlowSpin: false,
  productPaintLatchFrames: 4,
  coeffEditLayoutDebounceMs: 0,
}

function dichromate(cCr = 4, cK = 4, cO = 7): ReactorEquationTerm[] {
  return [
    { id: 'cr', z: 24, coeff: cCr },
    { id: 'k', z: 19, coeff: cK },
    { id: 'o2', z: 8, coeff: cO, diatomic: true },
  ]
}

// --- Shield never remounts ---
{
  let snap = createShieldSnapshot()
  const t0 = 1000
  snap = bumpShieldOnCoeffEdit(snap, t0, 15)
  assert.equal(shieldAllowsCanvasRemount(snap, t0 + 100, false), false)
  assert.equal(shieldAllowsCanvasRemount(snap, t0 + REACTOR_SHIELD.remountBanMs + 10, false), false)
  assert.equal(REACTOR_SHIELD.softRecoverOnly, true)
}

// --- After rapid edit: pin + electrons + no GPU ---
{
  let snap = createShieldSnapshot()
  const t0 = 5000
  for (let i = 0; i < 40; i++) {
    snap = bumpShieldOnCoeffEdit(snap, t0 + i * 30, 12 + (i % 8))
  }
  snap = tickShieldPhase(snap, t0 + 40 * 30)
  const policy = resolveShieldRenderPolicy({
    snap,
    nowMs: t0 + 40 * 30 + 100,
    hotCoeffEdit: false,
    preSynthesis: true,
    atomCount: 15,
    groupVisible: true,
    flightActive: false,
    externalForceLite: false,
  })
  assert.equal(policy.previewStatic, false)
  assert.equal(policy.electronAnimate, true)
  assert.equal(policy.pinEveryFrame || policy.phase === 'settle' || policy.phase === 'hot', true)
  assert.equal(shieldAllowsGpuCompile(snap, t0 + 40 * 30 + 100, false), false)
}

// --- Million-step rapid coeff on dichromate (engine + pool) ---
{
  const state = createPreviewEngineState()
  let terms = dichromate(2, 2, 3)
  const steps = 200
  for (let s = 0; s < steps; s++) {
    const ti = s % 3
    const base = Math.max(1, Math.floor(terms[ti]!.coeff))
    const next = ((base + (s % 5)) % 6) + 1
    terms = terms.map((t, i) => (i === ti ? { ...t, coeff: next } : t))
    const atoms = buildReactorPreviewAtoms(terms, { tier: 'lite' })
    const frame = resolvePreviewEngineFrame(state, {
      terms,
      previewAtoms: atoms,
      editingActive: true,
      previewOnlyMode: true,
      synthHoldPreview: false,
      coeffEditing: true,
      layoutPending: false,
      lockPoolSize: true,
      hotCoeffEdit: true,
    })
    const expected = terms.reduce((n, t) => n + Math.max(0, Math.floor(t.coeff)), 0)
    assert.ok(frame.poolSize >= expected, `pool ${frame.poolSize} < expected ${expected} at step ${s}`)
    assert.ok(frame.slotCount >= expected, `slots ${frame.slotCount} < expected ${expected} at step ${s}`)
    assert.equal(frame.groupVisible, true)
    const pol = resolvePreviewFramePolicy({
      atomCount: frame.slotCount,
      editingActive: true,
      coeffEditBurst: true,
      coeffEditing: true,
      flightActive: false,
      groupVisible: true,
      forceLite: false,
      frameBudgetLite: false,
      lowPowerProfile: lowPower,
    })
    assert.equal(pol.electronAnimate, true, `electrons dead at step ${s}`)
    assert.equal(pol.pinEveryFrame, true)
  }
}

// --- Layout stress helper ---
{
  const base = dichromate()
  const result = simulateCoeffEditLayoutSteps(base, 0, [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 4])
  assert.ok(result.every((atoms) => atoms.length > 0), 'layout never empty during rapid coeff')
}

// --- denseLightLatch sticky: O₂ 1↔7 не сбрасывает lite (нет full↔lite remount) ---
{
  const state = createPreviewEngineState()
  const run = (cO: number) => {
    const terms = dichromate(1, 1, cO)
    const atoms = buildReactorPreviewAtoms(terms, { tier: 'lite' })
    return resolvePreviewEngineFrame(state, {
      terms,
      previewAtoms: atoms,
      editingActive: true,
      previewOnlyMode: true,
      synthHoldPreview: false,
      coeffEditing: true,
      layoutPending: false,
      lockPoolSize: true,
      hotCoeffEdit: true,
    })
  }
  run(1) // 3 слота — в preview/edit сразу dense latch
  assert.equal(state.denseLightLatch, true, 'dense latch from first preview edit')
  assert.equal(state.fullDetailLatch, false)
  run(6)
  assert.equal(state.denseLightLatch, true, 'dense latch after 8 slots')
  run(1) // обратно к 3 — latch НЕ должен сброситься в сессии
  assert.equal(state.denseLightLatch, true, 'dense latch sticky after shrink')
  assert.equal(state.fullDetailLatch, false)
  const pol = resolvePreviewFramePolicy({
    atomCount: 3,
    editingActive: true,
    coeffEditBurst: true,
    coeffEditing: true,
    flightActive: false,
    groupVisible: true,
    forceLite: false,
    frameBudgetLite: false,
    lowPowerProfile: lowPower,
  })
  assert.equal(pol.lockVisualTier, true)
}

// --- slotCount never 0 while terms active (empty starfield regression) ---
{
  const state = createPreviewEngineState()
  for (const cO of [1, 2, 3, 4, 5, 6, 7, 1, 7, 1]) {
    const terms = dichromate(1, 1, cO)
    // Имитация «пустого» layout-кадра между +/-
    const frame = resolvePreviewEngineFrame(state, {
      terms,
      previewAtoms: [],
      editingActive: true,
      previewOnlyMode: true,
      synthHoldPreview: false,
      coeffEditing: true,
      layoutPending: true,
      lockPoolSize: true,
      hotCoeffEdit: true,
    })
    assert.ok(frame.hasActiveTerms)
    assert.ok(frame.slotCount > 0, `slotCount=0 with O2=${cO} → empty screen`)
    assert.equal(frame.groupVisible, true)
  }
}

// --- previewLite defeats previewEmphasis (no full+nebula on +/-) ---
{
  const flags = resolveAtomStructurePreviewFlags({
    previewEmphasis: true,
    cosmicStyle: true,
    synthesisDetail: false,
    previewLite: true,
    hideOrbitRings: true,
    electronFrameSkip: 4,
    z: 24,
  })
  assert.equal(flags.fullPreview, false, 'sessionLite must defeat emphasis')
  assert.equal(flags.lite, true)
  assert.equal(flags.showNebula, false)
  assert.equal(flags.showRings, false)
  assert.ok(flags.effectiveFrameSkip >= 3, `skip=${flags.effectiveFrameSkip}`)
}

console.log('test-reactor-preview-shield: all passed')
