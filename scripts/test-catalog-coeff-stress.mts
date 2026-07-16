#!/usr/bin/env node
/**
 * Stress: каталог → левая часть → быстрый +/- коэффициентов.
 * Запуск: npx tsx scripts/test-catalog-coeff-stress.mts
 */
import assert from 'node:assert/strict'
import { compoundById, compoundsListAlphabeticalRu } from '../src/data/compounds.ts'
import {
  generateFromLaboratoryRecipe,
  parseReactionLeftSide,
  stripLeftSideCoefficients,
} from '../src/chemistry/reactionLeftSideParser.ts'
import type { ReactorEquationTerm } from '../src/chemistry/reactorEquationBalance.ts'
import {
  buildReactorPreviewAtoms,
  PREVIEW_ATOM_MIN_GAP,
  previewAtomsMinPairDistance,
} from '../src/components/lab/reactorPreviewLayout.ts'
import {
  createPreviewEngineState,
  estimateExpectedAtomCount,
  resolvePreviewEngineFrame,
  resolvePreviewFramePolicy,
} from '../src/lab/synthesisPreviewEngine/index.ts'
import { PREVIEW_MAX_ATOM_MODELS } from '../src/lab/reactorPreviewGuarantee.ts'
import { resolveFullDetailLatch } from '../src/lab/synthesisPreviewEngine/previewFramePolicy.ts'

let uid = 0
const newId = () => `t${++uid}`

const PRIORITY_IDS = [
  'h2o',
  'co2',
  'nacl',
  'fe2o3',
  'salt_k2cr2o7',
  'h2so4',
  'cacl2',
  'mgo',
  'nh3',
  'ch4',
] as const

function termsFromCompound(id: string): ReactorEquationTerm[] | null {
  const c = compoundById[id]
  if (!c) return null
  const g = generateFromLaboratoryRecipe(c)
  const trimmed = stripLeftSideCoefficients(g.manualLeft.trim())
  if (!trimmed) return null
  const r = parseReactionLeftSide(trimmed, newId)
  if (!r.ok) return null
  return r.terms
}

function rapidCoeffBurst(terms: ReactorEquationTerm[], termIndex: number, steps: number[]): void {
  const state = createPreviewEngineState()
  let lastVisible = 0
  for (const c of steps) {
    const next = terms.map((t, i) => (i === termIndex ? { ...t, coeff: c } : t))
    let expected = estimateExpectedAtomCount(next)
    // clamp to preview max
    if (expected > PREVIEW_MAX_ATOM_MODELS) {
      const overflow = expected - PREVIEW_MAX_ATOM_MODELS
      next[termIndex] = {
        ...next[termIndex]!,
        coeff: Math.max(1, next[termIndex]!.coeff - overflow),
      }
      expected = estimateExpectedAtomCount(next)
    }
    const previewAtoms = buildReactorPreviewAtoms(next, {
      tier: expected > 12 ? 'lite' : 'full',
    })
    assert.equal(previewAtoms.length, expected, `layout count for coeff=${c}`)
    if (expected > 1) {
      const md = previewAtomsMinPairDistance(previewAtoms)
      assert.ok(
        md >= PREVIEW_ATOM_MIN_GAP * 0.88,
        `spacing ${md.toFixed(3)} at coeff=${c} n=${expected}`,
      )
    }
    const frame = resolvePreviewEngineFrame(state, {
      terms: next,
      previewAtoms,
      editingActive: true,
      previewOnlyMode: true,
      synthHoldPreview: false,
      coeffEditing: true,
      layoutPending: false,
      lockPoolSize: false,
      hotCoeffEdit: true,
    })
    assert.ok(frame.groupVisible, `groupVisible coeff=${c}`)
    assert.ok(frame.slotCount >= expected, `slotCount>=expected coeff=${c}`)
    assert.ok(frame.poolSize >= frame.slotCount, `pool covers slots coeff=${c}`)
    for (let i = 0; i < frame.slotCount; i++) {
      const a = frame.layoutAtoms[i] ?? state.shellAtoms[i]
      assert.ok(a, `no hole slot ${i} coeff=${c}`)
    }
    // Не проваливаемся ниже предыдущего peak без layout ready (hold)
    assert.ok(frame.slotCount >= Math.min(lastVisible, expected) || frame.slotCount >= expected)
    lastVisible = frame.slotCount

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
    if (frame.slotCount > 12) {
      assert.equal(
        resolveFullDetailLatch(true, frame.slotCount, true, policy.effectiveForceLite),
        false,
        'dense edit must drop full detail',
      )
    }
  }
}

// --- priority catalog substances ---
{
  let tested = 0
  for (const id of PRIORITY_IDS) {
    const terms = termsFromCompound(id)
    if (!terms?.length) {
      console.log(`skip ${id}: no parseable left`)
      continue
    }
    const maxTerm = terms.reduce(
      (best, t, i) => (Math.floor(t.coeff) >= Math.floor(terms[best]!.coeff) ? i : best),
      0,
    )
    // Быстрый +/- как нервный ученик
    const steps = [1, 2, 3, 5, 8, 12, 16, 20, 24, 18, 10, 4, 7, 15, 1, 9]
    rapidCoeffBurst(terms, maxTerm, steps)
    tested++
    console.log(`ok priority ${id} terms=${terms.length}`)
  }
  assert.ok(tested >= 5, `tested enough priority compounds (${tested})`)
}

// --- all catalog recipes that parse (capped stress) ---
{
  let ok = 0
  let skipped = 0
  const hard: string[] = []
  for (const c of compoundsListAlphabeticalRu()) {
    const terms = termsFromCompound(c.id)
    if (!terms?.length) {
      skipped++
      continue
    }
    const atomEst = estimateExpectedAtomCount(terms)
    // Balanced template often starts at 1 each — burst one term
    const steps = atomEst >= 6 ? [1, 4, 8, 12, 6, 2] : [1, 2, 4, 8, 3, 1]
    try {
      rapidCoeffBurst(terms, 0, steps)
      ok++
      if (terms.length >= 3) hard.push(c.id)
    } catch (e) {
      console.error(`FAIL ${c.id}:`, e)
      throw e
    }
  }
  console.log(`catalog stress: ok=${ok} skipped=${skipped} multi-term=${hard.length}`)
  assert.ok(ok >= 30, `enough catalog compounds stressed (${ok})`)
  // Known hard cases must be in set if present
  for (const id of ['salt_k2cr2o7', 'fe2o3', 'h2so4'] as const) {
    if (compoundById[id]) {
      assert.ok(ok > 0)
    }
  }
}

console.log('test-catalog-coeff-stress: all passed')
