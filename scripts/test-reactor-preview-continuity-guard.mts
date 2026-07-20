#!/usr/bin/env node
/**
 * Continuity guard не должен гасить Bohr в pre-synth.
 * Запуск: npx tsx scripts/test-reactor-preview-continuity-guard.mts
 */
import assert from 'node:assert/strict'
import { createReactorPreviewContinuityGuard } from '../src/lab/reactorPreviewContinuityGuard.ts'

function mockRoot(visible = true) {
  return { visible }
}

{
  const guard = createReactorPreviewContinuityGuard()
  const root = mockRoot(true)
  const previewRootRef = { current: root as never }
  let invalidated = 0

  // Pre-synth: previewVisible=false раньше прятал атомы — теперь restore.
  guard.tick({
    reactorViewOpen: true,
    synthLive: false,
    previewMounted: true,
    previewVisible: false,
    previewAtomCount: 15,
    productPrewarm: false,
    productPainted: false,
    previewRootRef,
    invalidate: () => {
      invalidated += 1
    },
  })
  assert.equal(root.visible, true, 'pre-synth must keep Bohr root visible')
  assert.ok(invalidated >= 1, 'pre-synth restore invalidates')
}

{
  const guard = createReactorPreviewContinuityGuard()
  const root = mockRoot(true)
  const previewRootRef = { current: root as never }

  // Synth + painted: hide OK.
  guard.tick({
    reactorViewOpen: true,
    synthLive: true,
    previewMounted: true,
    previewVisible: false,
    previewAtomCount: 8,
    productPrewarm: false,
    productPainted: true,
    previewRootRef,
    invalidate: () => {},
  })
  assert.equal(root.visible, false, 'synth after paint may hide Bohr')
}

console.log('test-reactor-preview-continuity-guard: all passed')
