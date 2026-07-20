#!/usr/bin/env node
/**
 * Hard WebGL recovery: мёртвый context → remount, иначе вечный белый canvas.
 * Запуск: npx tsx scripts/test-webgl-hard-recover.mts
 */
import assert from 'node:assert/strict'
import { REACTOR_SHIELD } from '../src/lab/reactorPreviewShield/reactorPreviewShield.ts'
import {
  createSoftWebGlRecovery,
  isWebGlDrawingBufferAlive,
} from '../src/lab/reactorPreviewShield/shieldWebgl.ts'

assert.ok(REACTOR_SHIELD.hardRecoverAfterMs >= 1000, 'hardRecoverAfterMs configured')

{
  const soft = createSoftWebGlRecovery()
  assert.equal(soft.wasLost(), false)
  assert.equal(soft.shouldHardRemount(), false)

  soft.onContextLost()
  assert.equal(soft.wasLost(), true)
  assert.equal(soft.shouldHardRemount(performance.now()), false, 'too early for remount')

  const later = performance.now() + REACTOR_SHIELD.hardRecoverAfterMs + 10
  assert.equal(soft.shouldHardRemount(later), true, 'allow remount after timeout')

  soft.acknowledgeHardRemount()
  assert.equal(soft.wasLost(), false)
  assert.equal(soft.shouldHardRemount(later + 100), false, 'no double remount')
}

{
  const soft = createSoftWebGlRecovery()
  soft.onContextLost()
  const ok = soft.onContextRestored(() => {}, true)
  assert.equal(ok, true)
  assert.equal(soft.wasLost(), false)
  assert.equal(
    soft.shouldHardRemount(performance.now() + REACTOR_SHIELD.hardRecoverAfterMs + 50),
    false,
    'alive restored → no remount',
  )
}

{
  const soft = createSoftWebGlRecovery()
  soft.onContextLost()
  const ok = soft.onContextRestored(() => {}, false)
  assert.equal(ok, false, 'fake restored rejected')
  assert.equal(soft.wasLost(), true, 'still lost after fake restored')
  const later = performance.now() + REACTOR_SHIELD.hardRecoverAfterMs + 10
  assert.equal(soft.shouldHardRemount(later), true, 'hard remount after fake restored')
}

{
  assert.equal(isWebGlDrawingBufferAlive({ drawingBufferWidth: 0, drawingBufferHeight: 0 }), false)
  assert.equal(isWebGlDrawingBufferAlive({ drawingBufferWidth: 800, drawingBufferHeight: 600 }), true)
  assert.equal(
    isWebGlDrawingBufferAlive({
      drawingBufferWidth: 800,
      drawingBufferHeight: 600,
      isContextLost: () => true,
    }),
    false,
  )
}

console.log('test-webgl-hard-recover: all passed')
