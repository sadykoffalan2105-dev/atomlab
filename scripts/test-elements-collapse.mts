#!/usr/bin/env node
/**
 * Collapse FX timing profiles — lab quality (snappy) + demo reference.
 * Запуск: npx tsx scripts/test-elements-collapse.mts
 */
import assert from 'node:assert/strict'
import {
  COLLAPSE_DEMO_QUALITY,
  COLLAPSE_LAB_QUALITY,
  estimateCollapseDurationSec,
  resolveCollapseOptionsForDevice,
} from '../src/lab/synthesisCollapseEffect/elementsCollapseAnimation.ts'
import { synthesisLaunchWatchdogMs } from '../src/lab/synthesisLaunchTiming.ts'

{
  const demo = estimateCollapseDurationSec(COLLAPSE_DEMO_QUALITY)
  assert.ok(demo > 4.2 && demo < 4.8, `demo duration ~4.5s, got ${demo}`)
  assert.equal(COLLAPSE_DEMO_QUALITY.end_scale, 3)
  assert.equal(COLLAPSE_DEMO_QUALITY.particles_per_sec, 350)
}

{
  const lab = estimateCollapseDurationSec()
  assert.ok(lab > 1.3 && lab < 2.0, `lab duration ~1.56s, got ${lab}`)
  assert.equal(COLLAPSE_LAB_QUALITY.max_particles, 380)
  assert.ok(COLLAPSE_LAB_QUALITY.particles_per_sec <= 200)
}

{
  const low = resolveCollapseOptionsForDevice(true, false)
  const dense = resolveCollapseOptionsForDevice(false, true)
  const hi = resolveCollapseOptionsForDevice(false, false)
  assert.ok((low.max_particles ?? 0) <= (hi.max_particles ?? 0))
  assert.ok((dense.max_particles ?? 0) <= (hi.max_particles ?? 0))
  assert.ok((hi.max_particles ?? 0) <= 420, 'lab spark budget')
  assert.ok((hi.max_particles ?? 0) >= 200)
  assert.ok((dense.particles_per_sec ?? 0) < (hi.particles_per_sec ?? 0))
}

{
  // Instant watchdog must cover collapse + product paint (не ~630ms).
  const wd = synthesisLaunchWatchdogMs(2, 4, 'full')
  assert.ok(wd >= 3500, `watchdog must cover collapse+paint, got ${wd}`)
  const wdDense = synthesisLaunchWatchdogMs(4, 22, 'full')
  assert.ok(wdDense >= 3000, `dense watchdog got ${wdDense}`)
}

console.log('test-elements-collapse: ok')
