#!/usr/bin/env node
/**
 * Camera rescue + motion engine (анти чёрный центр / white-screen).
 * Запуск: npx tsx scripts/test-reactor-preview-motion.mts
 */
import assert from 'node:assert/strict'
import {
  needsReactorPreviewCameraRescue,
  REACTOR_PREVIEW_CAMERA,
  isCameraFarFromPreviewPose,
} from '../src/lab/reactorPreviewCamera.ts'
import {
  PREVIEW_MOTION,
  resolvePreviewMotionPolicy,
  samplePreviewAtomMotion,
  samplePreviewRootSpin,
} from '../src/lab/reactorPreviewMotionEngine.ts'

{
  const pose = REACTOR_PREVIEW_CAMERA.few
  // Catalog hero MUST trigger rescue (мёртвая зона старого maxDist=3.5).
  assert.equal(
    needsReactorPreviewCameraRescue({
      position: { x: 0, y: 0.12, z: 3.6 },
      pose,
    }),
    true,
    'catalog hero → rescue',
  )
  assert.equal(
    needsReactorPreviewCameraRescue({
      position: { x: pose.position[0], y: pose.position[1], z: pose.position[2] },
      pose,
    }),
    false,
    'home pose → no rescue',
  )
  // Лёгкий zoom от home — не thrash.
  assert.equal(
    needsReactorPreviewCameraRescue({
      position: { x: pose.position[0] + 0.3, y: pose.position[1], z: pose.position[2] - 0.4 },
      pose,
    }),
    false,
    'small orbit offset → no rescue',
  )
  assert.equal(
    isCameraFarFromPreviewPose({ x: 0, y: 0.12, z: 3.6 }, pose, 3.0),
    true,
    'catalog far from few at threshold 3.0',
  )
}

{
  const dense = resolvePreviewMotionPolicy(22)
  assert.equal(dense.forceLiteMaterials, true, 'дихромат → lite materials')
  assert.equal(dense.ultraDense, true)
  assert.ok(dense.driftAmp <= PREVIEW_MOTION.driftAmpDense)

  const small = resolvePreviewMotionPolicy(3)
  assert.equal(small.forceLiteMaterials, false)
  assert.ok(small.driftAmp >= PREVIEW_MOTION.driftAmpNormal)

  const d = samplePreviewAtomMotion({
    elapsedSec: 1.5,
    slotIndex: 2,
    atomicZ: 24,
    driftAmp: dense.driftAmp,
  })
  assert.equal(d.length, 3)
  assert.ok(Math.abs(d[0]) <= dense.driftAmp + 1e-9)
  assert.ok(samplePreviewRootSpin(10, dense.spinRate) > 0)
}

console.log('test-reactor-preview-motion: all passed')
