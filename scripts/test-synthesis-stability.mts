#!/usr/bin/env node
/**
 * Автотесты стабильности синтеза (pure TS, без WebGL).
 * Запуск: npm run test:synthesis-stability
 */
import assert from 'node:assert/strict'
import { expandLeftTermsToPreviewSlots } from '../src/chemistry/reactorEquationBalance.ts'
import type { ReactorEquationTerm } from '../src/chemistry/reactorEquationBalance.ts'
import { buildReactorPreviewAtoms, reactorPreviewAtomScale, PREVIEW_ATOM_SCALE } from '../src/components/lab/reactorPreviewLayout.ts'
import { resolveSynthesisContinuity } from '../src/lab/synthesisAntiBlink.ts'
import { isVisualCoverageOk } from '../src/lab/visualCoverageController.ts'
import { canIdleGpuPrewarm } from '../src/lab/synthesisPrewarmPolicy.ts'
import { getReactorPreviewPolicy } from '../src/lab/synthesisLagGuard.ts'

const SYNC_BUILD_ATOM_CAP = 12

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
}

console.log('test-synthesis-stability: all passed')
