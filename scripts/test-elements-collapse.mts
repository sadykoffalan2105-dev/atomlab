#!/usr/bin/env node
/**
 * Collapse FX: lab quality + accent theme + birth timing.
 * Запуск: npx tsx scripts/test-elements-collapse.mts
 */
import assert from 'node:assert/strict'
import {
  COLLAPSE_DEMO_QUALITY,
  COLLAPSE_LAB_QUALITY,
  PRODUCT_BIRTH_FROM_COLLAPSE_SEC,
  buildCollapseAccentTheme,
  estimateCollapseDurationSec,
  resolveCollapseOptionsForDevice,
} from '../src/lab/synthesisCollapseEffect/elementsCollapseAnimation.ts'
import { synthesisLaunchWatchdogMs } from '../src/lab/synthesisLaunchTiming.ts'

{
  const demo = estimateCollapseDurationSec(COLLAPSE_DEMO_QUALITY)
  assert.ok(demo > 4.2 && demo < 4.8, `demo duration ~4.5s, got ${demo}`)
}

{
  const lab = estimateCollapseDurationSec()
  assert.ok(lab > 1.5 && lab < 2.3, `lab duration ~1.85s, got ${lab}`)
  assert.ok(COLLAPSE_LAB_QUALITY.max_particles <= 420)
  assert.ok(PRODUCT_BIRTH_FROM_COLLAPSE_SEC > 0.4 && PRODUCT_BIRTH_FROM_COLLAPSE_SEC < 1)
}

{
  const theme = buildCollapseAccentTheme('#ff9ec9')
  assert.ok(theme)
  assert.ok(theme!.particle_colors.includes(theme!.accent_hex))
  assert.ok(theme!.core_gradient.some((g) => g.color.includes('255')))
  assert.notEqual(theme!.ring_color, 0xaaddff)
  assert.equal(buildCollapseAccentTheme(null), null)
  assert.equal(buildCollapseAccentTheme(''), null)
}

{
  const water = buildCollapseAccentTheme('#6ec8ff')
  const salt = buildCollapseAccentTheme('#ff9ec9')
  assert.ok(water && salt)
  assert.notEqual(water!.accent_hex, salt!.accent_hex)
  assert.notEqual(water!.light_color, salt!.light_color)
}

{
  const low = resolveCollapseOptionsForDevice(true, false)
  const dense = resolveCollapseOptionsForDevice(false, true)
  const hi = resolveCollapseOptionsForDevice(false, false)
  assert.ok((low.max_particles ?? 0) <= (hi.max_particles ?? 0))
  assert.ok((dense.max_particles ?? 0) <= (hi.max_particles ?? 0))
}

{
  const wd = synthesisLaunchWatchdogMs(2, 4, 'full')
  assert.ok(wd >= 3500, `watchdog must cover collapse+paint, got ${wd}`)
}

console.log('test-elements-collapse: ok')
