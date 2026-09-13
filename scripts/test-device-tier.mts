#!/usr/bin/env node
/**
 * Классификация устройства + губернатор качества (pure TS, без WebGL).
 * Запуск: npx tsx scripts/test-device-tier.mts
 */
import assert from 'node:assert/strict'
import {
  classifyDevice,
  classifyGpuRenderer,
  detectDeviceFormFactor,
  type DeviceSignals,
} from '../src/lab/synthesisDeviceTier.ts'
import { buildLowPowerDeviceProfile } from '../src/lab/lowPowerDeviceProfile.ts'
import {
  createSynthesisQualityGovernor,
  SYNTHESIS_QUALITY_BALANCED,
  SYNTHESIS_QUALITY_HIGH,
  SYNTHESIS_QUALITY_LITE,
  type SynthesisQualityGovernor,
} from '../src/lab/synthesisQualityLadder.ts'
import {
  applyResolutionScaleToDpr,
  resolveBaseDpr,
  resolveLabCanvasPolicy,
} from '../src/perf/deviceCanvasPolicy.ts'

let passed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ok  ${name}`)
  } catch (e) {
    console.error(`  FAIL ${name}`)
    throw e
  }
}

// ─── Классификация ──────────────────────────────────────────────────────────

const UA = {
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  winChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  androidRedmi:
    'Mozilla/5.0 (Linux; Android 12; Redmi 10C) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  androidSamsung:
    'Mozilla/5.0 (Linux; Android 11; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
}

function dev(p: Partial<DeviceSignals> & Pick<DeviceSignals, 'userAgent' | 'renderer'>): DeviceSignals {
  return { maxTouchPoints: 0, devicePixelRatio: 1, ...p }
}

console.log('classification')

test('Apple M1 desktop (Chrome, ANGLE Metal) → strong, normal, не mobile', () => {
  const c = classifyDevice(
    dev({
      userAgent: UA.macChrome,
      renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)',
      hardwareConcurrency: 8,
      deviceMemory: 8,
      devicePixelRatio: 2,
    }),
  )
  assert.equal(c.formFactor, 'desktop')
  assert.equal(c.gpu, 'strong')
  assert.equal(c.tier, 'normal')
  assert.equal(c.isMobileSoc, false)
  assert.equal(c.isAppleSiliconDesktop, true)
  const profile = buildLowPowerDeviceProfile(c.tier, c)
  assert.equal(profile.forceLiteReactor, false)
  assert.equal(profile.isMobileSoc, false)
})

test('Apple M2 desktop (Safari, «Apple GPU», без deviceMemory) → strong, normal', () => {
  const c = classifyDevice(
    dev({ userAgent: UA.macSafari, renderer: 'Apple GPU', hardwareConcurrency: 8, devicePixelRatio: 2 }),
  )
  assert.equal(c.formFactor, 'desktop')
  assert.equal(c.gpu, 'strong')
  assert.equal(c.tier, 'normal')
  assert.equal(c.isMobileSoc, false)
})

test('Apple M2 desktop, но 4 ядра + saveData — остаётся normal (сильный GPU), не mobile', () => {
  const c = classifyDevice(
    dev({ userAgent: UA.macChrome, renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)', hardwareConcurrency: 4, deviceMemory: 4, saveData: true }),
  )
  assert.equal(c.gpu, 'strong')
  assert.equal(c.isMobileSoc, false)
})

test('iPhone → phone, mobile SoC, low tier', () => {
  const c = classifyDevice(
    dev({ userAgent: UA.iphone, renderer: 'Apple GPU', hardwareConcurrency: 6, maxTouchPoints: 5, devicePixelRatio: 3 }),
  )
  assert.equal(c.formFactor, 'phone')
  assert.equal(c.gpu, 'mid')
  assert.equal(c.isMobileSoc, true)
  assert.equal(c.tier, 'low')
  assert.equal(buildLowPowerDeviceProfile(c.tier, c).forceLiteReactor, true)
})

test('iPadOS (UA «Macintosh» + multitouch) → tablet, mobile SoC', () => {
  const c = classifyDevice(
    dev({ userAgent: UA.macSafari, renderer: 'Apple GPU', hardwareConcurrency: 8, maxTouchPoints: 5, devicePixelRatio: 2 }),
  )
  assert.equal(c.formFactor, 'tablet')
  assert.equal(c.isMobileSoc, true)
  assert.notEqual(c.gpu, 'strong')
})

test('Intel Iris Xe → mid (не strong), normal, не mobile', () => {
  const renderer =
    'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)'
  const c = classifyDevice(dev({ userAgent: UA.winChrome, renderer, hardwareConcurrency: 8, deviceMemory: 8, devicePixelRatio: 1.25 }))
  assert.equal(c.gpu, 'mid')
  assert.equal(c.tier, 'normal')
  assert.equal(c.isMobileSoc, false)
})

test('Intel UHD 620 → weak, low (даже при 8 потоках и 8 ГБ)', () => {
  const renderer =
    'ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)'
  const c = classifyDevice(dev({ userAgent: UA.winChrome, renderer, hardwareConcurrency: 8, deviceMemory: 8 }))
  assert.equal(c.gpu, 'weak')
  assert.equal(c.tier, 'low')
  assert.equal(c.isMobileSoc, false)
  assert.equal(buildLowPowerDeviceProfile(c.tier, c).forceLiteReactor, true)
})

test('Intel UHD 770 и Tiger Lake «UHD Graphics (0x9A49)» (Xe-LP) → mid, normal; HD 620 → weak', () => {
  for (const renderer of [
    'ANGLE (Intel, Intel(R) UHD Graphics 770 (0x0000A780) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (Intel, Intel(R) UHD Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'Mesa Intel(R) UHD Graphics 770 (ADL-S GT1)',
  ]) {
    const c = classifyDevice(dev({ userAgent: UA.winChrome, renderer, hardwareConcurrency: 12, deviceMemory: 8 }))
    assert.equal(c.gpu, 'mid', renderer)
    assert.equal(c.tier, 'normal', renderer)
  }
  const old = classifyDevice(
    dev({ userAgent: UA.winChrome, renderer: 'ANGLE (Intel, Intel(R) HD Graphics 620 Direct3D11 vs_5_0 ps_5_0)', hardwareConcurrency: 8, deviceMemory: 8 }),
  )
  assert.equal(old.gpu, 'weak')
})

test('Mali-G52 (Android) → weak, low, mobile', () => {
  const c = classifyDevice(
    dev({ userAgent: UA.androidRedmi, renderer: 'Mali-G52 MC2', hardwareConcurrency: 8, deviceMemory: 4, maxTouchPoints: 5, devicePixelRatio: 2 }),
  )
  assert.equal(c.formFactor, 'phone')
  assert.equal(c.gpu, 'weak')
  assert.equal(c.tier, 'low')
  assert.equal(c.isMobileSoc, true)
})

test('Adreno 610 (Android) → weak, low, mobile', () => {
  const c = classifyDevice(
    dev({ userAgent: UA.androidSamsung, renderer: 'Adreno (TM) 610', hardwareConcurrency: 8, deviceMemory: 4, maxTouchPoints: 5, devicePixelRatio: 2.625 }),
  )
  assert.equal(c.gpu, 'weak')
  assert.equal(c.tier, 'low')
  assert.equal(c.isMobileSoc, true)
})

test('NVIDIA RTX → strong, normal, не mobile', () => {
  const renderer =
    'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Laptop GPU (0x00002560) Direct3D11 vs_5_0 ps_5_0, D3D11)'
  const c = classifyDevice(dev({ userAgent: UA.winChrome, renderer, hardwareConcurrency: 16, deviceMemory: 8 }))
  assert.equal(c.gpu, 'strong')
  assert.equal(c.tier, 'normal')
  assert.equal(c.isMobileSoc, false)
})

test('прочие рендереры', () => {
  assert.equal(
    classifyGpuRenderer('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)'),
    'software',
  )
  assert.equal(classifyGpuRenderer('Adreno (TM) 740'), 'mid')
  assert.equal(classifyGpuRenderer('Qualcomm(R) Adreno(TM) X1-85 GPU'), 'mid')
  assert.equal(classifyGpuRenderer('ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'mid')
  assert.equal(classifyGpuRenderer('ANGLE (AMD, AMD Radeon RX 6600 (0x000073FF) Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'strong')
  assert.equal(classifyGpuRenderer('ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics (0x000056A0) Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'strong')
  assert.equal(classifyGpuRenderer('Apple GPU', 'phone'), 'mid')
  assert.equal(classifyGpuRenderer(''), 'unknown')
  assert.equal(detectDeviceFormFactor({ userAgent: UA.winChrome, maxTouchPoints: 10 }), 'desktop')
  assert.equal(classifyDevice(dev({ userAgent: UA.winChrome, renderer: 'Qualcomm(R) Adreno(TM) X1-85 GPU', hardwareConcurrency: 12, deviceMemory: 8 })).isMobileSoc, false)
})

// ─── Губернатор ─────────────────────────────────────────────────────────────

console.log('governor')

type Change = { t: number; level: number; scale: number }

/** Прогон синтетической последовательности кадров; возвращает смены (время в с). */
function run(gov: SynthesisQualityGovernor, frames: Iterable<number>, t0 = 0): { changes: Change[]; t: number } {
  const changes: Change[] = []
  let t = t0
  for (const ms of frames) {
    t += ms / 1000
    if (gov.sample(ms / 1000)) changes.push({ t, level: gov.qualityLevel, scale: gov.resolutionScale })
  }
  return { changes, t }
}

function* steady(ms: number, seconds: number, jitterMs = 0): Generator<number> {
  let acc = 0
  let i = 0
  while (acc < seconds * 1000) {
    // Детерминированный «шум» ±jitter.
    const v = ms + (jitterMs ? jitterMs * Math.sin(i * 1.7) : 0)
    acc += v
    i++
    yield v
  }
}

function* concat(...parts: Iterable<number>[]): Generator<number> {
  for (const p of parts) yield* p
}

const newGov = (opts?: Parameters<typeof createSynthesisQualityGovernor>[0]) =>
  createSynthesisQualityGovernor({ floor: SYNTHESIS_QUALITY_LITE, cap: SYNTHESIS_QUALITY_HIGH, ...opts })

test('ровные 60 Гц 10 с → без смен', () => {
  const gov = newGov()
  const { changes } = run(gov, steady(16.67, 10, 0.8))
  assert.deepEqual(changes, [])
  assert.equal(gov.qualityLevel, SYNTHESIS_QUALITY_HIGH)
  assert.equal(gov.resolutionScale, 1)
  assert.ok(gov.p90FrameMs > 16 && gov.p90FrameMs < 18, `p90=${gov.p90FrameMs}`)
})

test('одиночные hitch (200 мс) и короткий всплеск 50 мс ×5 → без понижения', () => {
  const gov = newGov()
  const hitch = [200]
  const burst = [50, 50, 50, 50, 50]
  const { changes } = run(
    gov,
    concat(steady(16.67, 2), hitch, steady(16.67, 2), burst, steady(16.67, 3), hitch, hitch, steady(16.67, 2)),
  )
  assert.deepEqual(changes, [])
})

test('кадр > 1 с (свёрнутая вкладка) не учитывается; hitch 900/400 мс — не понижение', () => {
  const gov = newGov()
  const { changes } = run(gov, concat(steady(16.67, 1), [2000, 5000], steady(16.67, 1.5), [900, 400], steady(16.67, 3)))
  assert.deepEqual(changes, [])
})

test('очень медленно (4 fps, 250 мс) — губернатор всё равно реагирует', () => {
  const gov = newGov()
  const { changes } = run(gov, steady(250, 4))
  assert.ok(changes.length >= 1, 'мало кадров в окне — оценка всё равно идёт')
  assert.equal(changes[0].scale, 0.75)
})

test('устойчивые 40 fps (25 мс) → DPR 0.875 через окно + 1 с, не мгновенно', () => {
  const gov = newGov()
  const { changes } = run(gov, steady(25, 1.7))
  assert.deepEqual(changes, [], 'не раньше, чем через секунду устойчивой медлительности')
  const r = run(gov, steady(25, 0.7), 1.7)
  assert.equal(r.changes.length, 1)
  assert.equal(r.changes[0].scale, 0.875)
  assert.equal(r.changes[0].level, SYNTHESIS_QUALITY_HIGH, 'фичи не трогаем, пока есть запас по DPR')
})

test('rAF урезан до 30 Гц (энергосбережение): ровные 33.3 мс → понижение откатывается, качество полное', () => {
  const gov = newGov()
  const { changes } = run(gov, steady(33.3, 20))
  assert.ok(changes.length >= 2, `changes=${JSON.stringify(changes)}`)
  assert.equal(changes[0].scale, 0.75, 'сначала реагирует как на медленный кадр')
  assert.equal(changes[1].scale, 1, 'понижение не ускорило ровный кадр — это предел rAF, шаг откатан')
  assert.equal(changes[1].level, SYNTHESIS_QUALITY_HIGH)
  assert.equal(gov.resolutionScale, 1)
  assert.equal(gov.qualityLevel, SYNTHESIS_QUALITY_HIGH)
  assert.equal(changes.length, 2, 'после отката — без качелей')
  const after = run(gov, steady(33.3, 10))
  assert.deepEqual(after.changes, [], 'предел запомнен — больше не понижаем')
})

test('настоящая нагрузка 30 fps (кадр ускоряется от DPR, с разбросом) → DPR 0.75, затем уровень вниз до пола', () => {
  const gov = newGov()
  // Время кадра зависит от числа пикселей: 0.75² пикселей → заметно быстрее, но всё ещё медленно.
  function* gpuBound(seconds: number): Generator<number> {
    let acc = 0
    let i = 0
    while (acc < seconds * 1000) {
      const pixels = gov.resolutionScale ** 2
      const featureCost = 1 - (SYNTHESIS_QUALITY_HIGH - gov.qualityLevel) * 0.04
      const v = (14 + 26 * pixels) * featureCost + 3 * Math.sin(i * 1.7)
      acc += v
      i++
      yield v
    }
  }
  const { changes } = run(gov, gpuBound(25))
  assert.ok(changes.length >= 2, `changes=${JSON.stringify(changes)}`)
  assert.equal(changes[0].scale, 0.75)
  assert.equal(gov.resolutionScale, 0.75, 'откат не срабатывает: кадр реально ускорился')
  assert.ok(gov.qualityLevel < SYNTHESIS_QUALITY_HIGH, 'уровень фич понижен')
  for (let i = 1; i < changes.length; i++) {
    assert.ok(changes[i].t - changes[i - 1].t >= 1.2, `слишком частые смены: ${JSON.stringify(changes)}`)
  }
})

test('без adaptResolution уровень падает сразу (DPR = 1)', () => {
  const gov = newGov({ adaptResolution: false })
  const { changes } = run(gov, steady(33.3, 1.6))
  assert.equal(changes.length, 1)
  assert.equal(changes[0].level, SYNTHESIS_QUALITY_BALANCED)
  assert.equal(changes[0].scale, 1)
})

test('повышение на 60 Гц vsync: после восстановления через ~3 с (раньше — никогда)', () => {
  const gov = newGov({ initial: SYNTHESIS_QUALITY_LITE })
  const slow = run(gov, steady(33.3, 1.6))
  assert.equal(gov.resolutionScale, 0.75)
  const fast = run(gov, steady(16.67, 30, 0.6), slow.t)
  assert.ok(fast.changes.length >= 3, JSON.stringify(fast.changes))
  const first = fast.changes[0]
  assert.equal(first.scale, 0.875, 'сначала DPR')
  assert.ok(first.t - slow.t >= 3 && first.t - slow.t <= 4.5, `upgrade dt=${first.t - slow.t}`)
  assert.equal(gov.resolutionScale, 1)
  assert.equal(gov.qualityLevel, SYNTHESIS_QUALITY_HIGH, 'затем уровни до cap')
})

test('120 Гц: 70 fps (14 мс) — не понижаем (цель 60), refresh ≈ 8.33', () => {
  const gov = newGov()
  run(gov, steady(8.33, 3, 0.2))
  assert.ok(Math.abs(gov.refreshMs - 1000 / 120) < 0.2, `refresh=${gov.refreshMs}`)
  const { changes } = run(gov, steady(14, 10, 0.5))
  assert.deepEqual(changes, [])
})

test('качели: неудачные повышения удваивают выдержку (≤ 8 смен за 60 с)', () => {
  const gov = newGov({ initial: SYNTHESIS_QUALITY_LITE, adaptResolution: false })
  // Устройство держит 60 на LITE, но на BALANCED даёт 40 fps.
  let t = 0
  let changes = 0
  let i = 0
  const upgradeTimes: number[] = []
  while (t < 60) {
    const ms = gov.qualityLevel > SYNTHESIS_QUALITY_LITE ? 25 : 16.67 + 0.5 * Math.sin(i++)
    t += ms / 1000
    if (gov.sample(ms / 1000)) {
      changes++
      if (gov.qualityLevel > SYNTHESIS_QUALITY_LITE) upgradeTimes.push(t)
    }
  }
  assert.ok(changes <= 8, `changes=${changes}`)
  assert.ok(upgradeTimes.length >= 2, `upgrades=${upgradeTimes}`)
  const gap1 = upgradeTimes[1] - upgradeTimes[0]
  assert.ok(gap1 >= 6, `backoff gap=${gap1}`)
})

test('forceDown / reset / setCap', () => {
  const gov = newGov()
  assert.equal(gov.forceDown(SYNTHESIS_QUALITY_BALANCED), true)
  assert.equal(gov.qualityLevel, SYNTHESIS_QUALITY_BALANCED)
  assert.equal(gov.forceDown(SYNTHESIS_QUALITY_BALANCED), false)
  run(gov, steady(33.3, 1.5))
  assert.equal(gov.resolutionScale, 0.75)
  gov.reset(SYNTHESIS_QUALITY_HIGH)
  assert.equal(gov.qualityLevel, SYNTHESIS_QUALITY_HIGH)
  assert.equal(gov.resolutionScale, 0.75, 'reset сохраняет DPR по умолчанию')
  gov.setCap(SYNTHESIS_QUALITY_LITE)
  assert.equal(gov.qualityLevel, SYNTHESIS_QUALITY_LITE)
  assert.equal(gov.resetResolution(), true)
  assert.equal(gov.resolutionScale, 1)
  gov.reset(undefined, { resetResolution: true })
  assert.equal(gov.resolutionScale, 1)
})

test('tick(fps) совместимость: 30 fps 2 с → понижение', () => {
  const gov = newGov({ adaptResolution: false })
  for (let i = 0; i < 60; i++) gov.tick(30)
  assert.ok(gov.qualityLevel < SYNTHESIS_QUALITY_HIGH)
})

// ─── Canvas policy ──────────────────────────────────────────────────────────

console.log('canvas policy')

test('adaptive DPR: min 0.75 от базового; scale 1 — исходная политика', () => {
  assert.equal(resolveBaseDpr([1, 1.25], 2), 1.25)
  assert.equal(resolveBaseDpr([1, 1.25], 1), 1)
  assert.deepEqual(applyResolutionScaleToDpr([1, 1.25], 1, 2), [1, 1.25])
  assert.equal(applyResolutionScaleToDpr([1, 1.25], 0.875, 2), 1.09)
  assert.equal(applyResolutionScaleToDpr(1, 0.75, 3), 0.75)
  assert.equal(applyResolutionScaleToDpr(1, 0.5, 3), 0.75, 'не ниже 0.75 базового')
  const base = { deviceTier: 'normal' as const, perfLevel: 'high' as const, synthesisRunActive: true, reactorViewOpen: true, substanceView: false }
  assert.deepEqual(resolveLabCanvasPolicy(base).dpr, [1, 1.25])
  assert.equal(resolveLabCanvasPolicy({ ...base, resolutionScale: 0.75, devicePixelRatio: 1.5 }).dpr, 0.94)
  assert.equal(resolveLabCanvasPolicy({ ...base, gpuClass: 'mid' }).dpr, 1)
  assert.equal(resolveLabCanvasPolicy({ ...base, deviceTier: 'low', resolutionScale: 0.875 }).dpr, 0.88)
})

console.log(`\n${passed} passed`)
