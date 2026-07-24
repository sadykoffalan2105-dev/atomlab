#!/usr/bin/env node
/**
 * Lab3DVisibilityEngine — контракт: центр никогда не пустой.
 * Запуск: npx tsx scripts/test-lab3d-visibility.mts
 */
import assert from 'node:assert/strict'
import {
  canHideBohrForProduct,
  isCenterCovered,
  isInstantProductScreenReady,
  isProductFullScaleVisible,
  resolveLab3dFrameRescue,
  shouldPersistGpuCompileCache,
  createEmptyCenterFrameCounter,
} from '../src/lab/lab3dVisibilityEngine.ts'
import { isVisualCoverageOk } from '../src/lab/visualCoverageController.ts'
import { resolveSynthesisProductSlot } from '../src/lab/synthesisProductSlot.ts'
import type { CompoundDef } from '../src/types/chemistry.ts'

{
  assert.equal(isInstantProductScreenReady(false), false)
  assert.equal(isInstantProductScreenReady(true), true)
}

{
  assert.equal(
    isProductFullScaleVisible({ slotVisible: true, prewarm: true }),
    false,
    'micro-prewarm is not visible',
  )
  assert.equal(
    isProductFullScaleVisible({ slotVisible: true, prewarm: false, scaleX: 0.001 }),
    false,
    'micro scale is not visible',
  )
  assert.equal(
    isProductFullScaleVisible({ slotVisible: true, prewarm: false, scaleX: 1 }),
    true,
  )
}

{
  assert.equal(
    canHideBohrForProduct({
      productPainted: true,
      slotVisible: false,
      prewarm: true,
      coeffEditing: false,
      preSynthesis: false,
    }),
    false,
    'cannot hide Bohr while product only prewarm',
  )
  assert.equal(
    canHideBohrForProduct({
      productPainted: true,
      slotVisible: true,
      prewarm: false,
      coeffEditing: true,
      preSynthesis: false,
    }),
    false,
    'cannot hide Bohr while editing',
  )
  assert.equal(
    canHideBohrForProduct({
      productPainted: true,
      slotVisible: true,
      prewarm: false,
      coeffEditing: false,
      preSynthesis: false,
    }),
    true,
  )
}

{
  assert.equal(
    isCenterCovered({
      bohrVisible: false,
      bohrMounted: true,
      productSlotVisible: false,
      productPrewarm: true,
    }),
    false,
    'prewarm alone = empty center (screenshot bug)',
  )
  assert.equal(
    isCenterCovered({
      bohrVisible: true,
      bohrMounted: true,
      productSlotVisible: false,
      productPrewarm: true,
    }),
    true,
  )
}

{
  const continuity = {
    reactorPreviewVisible: false,
    reactorPreviewMounted: true,
    productMeshMounted: true,
    productSlotVisible: false,
    productPrewarm: true,
    holdVisualOverlap: false,
  }
  assert.equal(
    isVisualCoverageOk({
      continuity,
      mergeFx: false,
      convergeFx: false,
      editMode: false,
    }),
    false,
    'coverage: prewarm never counts',
  )
}

{
  const rescue = resolveLab3dFrameRescue({
    reactorOpen: true,
    hasPreviewTerms: true,
    coeffEditing: false,
    preSynthesis: true,
    synthLive: false,
    showSettledHero: false,
    productPainted: true,
    productSlotVisible: false,
    productPrewarm: true,
  })
  assert.equal(rescue.forceBohrRootVisible, true)
  assert.equal(rescue.invalidatePaint, true, 'false paint during pre-synth')
}

{
  assert.equal(
    canHideBohrForProduct({
      productPainted: false,
      slotVisible: true,
      prewarm: false,
      coeffEditing: false,
      preSynthesis: false,
      showSettledHero: true,
    }),
    true,
    'settled slot owns screen without paint',
  )
  const settledRescue = resolveLab3dFrameRescue({
    reactorOpen: true,
    hasPreviewTerms: true,
    coeffEditing: false,
    preSynthesis: false,
    synthLive: false,
    showSettledHero: true,
    productPainted: true,
    productSlotVisible: true,
    productPrewarm: false,
    productScaleX: 0.5,
  })
  assert.equal(settledRescue.invalidatePaint, false, 'settled: never invalidate paint')
  assert.equal(settledRescue.forceBohrRootVisible, false, 'settled: do not restore Bohr')
}

{
  assert.equal(
    shouldPersistGpuCompileCache({ fromFullScaleCompile: false, fromVisiblePaint: false }),
    false,
  )
  assert.equal(
    shouldPersistGpuCompileCache({ fromFullScaleCompile: true, fromVisiblePaint: false }),
    true,
  )
}

{
  const compound = { id: 'salt_k2cr2o7' } as CompoundDef
  const settled = resolveSynthesisProductSlot({
    productForSlot: compound,
    productSlotVisible: false,
    productPrewarmActive: false,
    showSettledHero: true,
    synthLive: false,
    prewarmReady: false,
    prewarmCompoundId: null,
  })
  assert.equal(settled.visible, true, 'settled always full-scale visible')
  assert.equal(settled.prewarm, false)
}

{
  assert.equal(
    shouldPersistGpuCompileCache({ fromFullScaleCompile: false, fromVisiblePaint: false }),
    false,
  )
  const counter = createEmptyCenterFrameCounter()
  assert.equal(counter.tick(false), false)
  assert.equal(counter.tick(false), false)
  assert.equal(counter.tick(false), true, 'empty after 3 frames — one rescue')
  assert.equal(counter.tick(false), false, 'same streak — no thrash')
  assert.equal(counter.tick(false), false)
  counter.reset()
  assert.equal(counter.tick(true), false)
  assert.equal(counter.tick(false), false)
  assert.equal(counter.tick(false), false)
  assert.equal(counter.tick(false), true, 'new streak after covered')
}

console.log('test-lab3d-visibility: all passed')
