#!/usr/bin/env node
/**
 * Collapse FX timing profiles — порт expl_threejs_effect_v02gm_dev (demo quality).
 * Запуск: npx tsx scripts/test-elements-collapse.mts
 */
import assert from 'node:assert/strict'
import {
  COLLAPSE_DEMO_QUALITY,
  estimateCollapseDurationSec,
  resolveCollapseOptionsForDevice,
} from '../src/lab/synthesisCollapseEffect/elementsCollapseAnimation.ts'

{
  const d = estimateCollapseDurationSec()
  assert.ok(d > 4.2 && d < 4.8, `demo duration ~4.5s, got ${d}`)
  assert.equal(COLLAPSE_DEMO_QUALITY.end_scale, 3)
  assert.equal(COLLAPSE_DEMO_QUALITY.particles_per_sec, 350)
}

{
  const low = resolveCollapseOptionsForDevice(true)
  const hi = resolveCollapseOptionsForDevice(false)
  assert.ok((low.max_particles ?? 0) <= (hi.max_particles ?? 0))
  assert.equal(hi.burst_time, 1.5)
  assert.equal(hi.end_scale, 3)
  assert.ok((hi.max_particles ?? 0) >= 1000, 'full spark budget')
}

console.log('test-elements-collapse: ok')
