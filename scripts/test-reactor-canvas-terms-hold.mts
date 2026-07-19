import assert from 'node:assert/strict'
import {
  isStructuralTermsChange,
  shouldClearPreviewTermsShell,
  shouldFreezeCanvasTerms,
} from '../src/lab/reactorCanvasTermsHoldPolicy.ts'

{
  assert.equal(
    shouldFreezeCanvasTerms({ freezeCanvas: true, structuralChange: false }),
    true,
  )
  assert.equal(
    shouldFreezeCanvasTerms({ freezeCanvas: true, structuralChange: true }),
    false,
    'structural add/remove reagent must not freeze',
  )
  assert.equal(
    isStructuralTermsChange('a:24:0', 'a:24:0|b:19:0', 1, 2),
    true,
  )
  assert.equal(
    isStructuralTermsChange('a:24:0|b:19:0', 'a:24:0|b:19:0', 2, 2),
    false,
  )
  assert.equal(shouldClearPreviewTermsShell({ reactorViewOpen: true }), false)
  assert.equal(shouldClearPreviewTermsShell({ reactorViewOpen: false }), true)
}

console.log('test-reactor-canvas-terms-hold: all passed')
