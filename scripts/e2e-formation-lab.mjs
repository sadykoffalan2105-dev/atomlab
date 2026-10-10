#!/usr/bin/env node
/**
 * E2E «Как образуется» в лаборатории (preview по кнопке реактора и synth по Run) + HUD каталога.
 * По образцу scripts/perf-clo2-cinema.mjs: прод-сборка (vite preview), Chromium, ?perf=1 (window.__atomlabPerf.scene).
 *
 * Для каждого вещества и окна:
 *  (i)   клик [data-reactor-formation] → 'formation-lab:click' … 'formation-lab:first-frame': холодный ≤ 700 мс, прогретый ≤ 300 мс;
 *  (ii)  N мс показа: кадры rAF — ни одного > 100 мс (ПК) / 120 мс (телефон), p95 ≤ 40 мс;
 *  (iii) панель внутри окна, не пересекает открытый реактор; HUD внутри холста и не под панелью;
 *  (iv)  Run при открытом preview: в любой момент ≤ 1 [data-formation-lab], ≤ 1 группа formation-lab-fx|route-lab-fx,
 *        lab-product-hero-root невидим, пока показ жив; после — показа нет, герой виден;
 *  (v)   HUD-карточки без переполнения (scrollWidth ≤ clientWidth+1, scrollHeight ≤ clientHeight+1).
 * Каталог: карточка K₂O₂ при 673×900 и 390×844 — «Как образуется» → (v).
 *
 * Запуск: node scripts/e2e-formation-lab.mjs [--label=after] [--port=5189] [--base=http://localhost:5189]
 *         [--only=tb_p4o10,k2o] [--vp=desk,wide,phone] [--sample=8000] [--no-run] [--no-catalog] [--headed]
 * Отчёт: .smoke/e2e/formation-lab-<label>.json; exit 1 при нарушении.
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? '1']
  }),
)
const PORT = args.port ?? process.env.PERF_PORT ?? '5189'
const BASE = args.base ?? `http://localhost:${PORT}`
const LABEL = args.label ?? 'run'
const SAMPLE_MS = Number(args.sample ?? 8000)
const OUT = join(process.cwd(), '.smoke', 'e2e')

/** Вещества: id каталога + уравнение образования (то же, что играет показ: formationEquation). */
const SUBSTANCES = [
  { id: 'tb_p4o10', label: 'P₄O₁₀', eq: '4P + 5O₂ → P₄O₁₀' },
  { id: 'k2o', label: 'K₂O', eq: 'K₂O₂ + 2K → 2K₂O' },
  { id: 'tb_k2o2', label: 'K₂O₂', eq: '2K + O₂ → K₂O₂' },
  { id: 'nacl', label: 'NaCl', eq: '2Na + Cl₂ → 2NaCl' },
  { id: 'h2o', label: 'H₂O', eq: '2H₂ + O₂ → 2H₂O' },
  { id: 'co2', label: 'CO₂ (путь mr156)', mr: 'mr156', route: true },
  { id: 'nh3', label: 'NH₃', eq: 'N₂ + 3H₂ → 2NH₃' },
  { id: 'cu2o', label: 'Cu₂O', eq: '4CuO → 2Cu₂O + O₂' },
  { id: 'mg_oh_2', label: 'Mg(OH)₂', eq: 'MgCl₂ + 2NaOH → Mg(OH)₂ + 2NaCl' },
  { id: 'hcl', label: 'HCl', eq: 'H₂ + Cl₂ → 2HCl' },
]
const VIEWPORTS = {
  desk: { name: '1440×900', viewport: { width: 1440, height: 900 }, phone: false },
  wide: { name: '2000×1180', viewport: { width: 2000, height: 1180 }, phone: false },
  phone: { name: '390×844', viewport: { width: 390, height: 844 }, phone: true, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
}
const only = args.only ? new Set(args.only.split(',')) : null
const vps = (args.vp ?? 'desk,wide,phone').split(',').map((k) => VIEWPORTS[k]).filter(Boolean)

let server = null
let browser = null

async function up(url, attempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url)
      if (r.status > 0 && r.status < 500) return true
    } catch {
      /* ещё поднимается */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function ensureServer() {
  if (await up(BASE, 4)) return
  if (args.base) {
    if (!(await up(BASE, 60))) throw new Error(`нет сервера на ${BASE}`)
    return
  }
  server = spawn('npx', ['vite', 'preview', '--port', PORT, '--strictPort'], { shell: true, stdio: 'ignore' })
  if (!(await up(BASE, 120))) throw new Error(`preview не поднялся на ${BASE}`)
}

/** Сторож в странице: кадры, длинные задачи, инварианты «один показ» (строкой — page.evaluate). */
const PROBE = `(() => {
  if (window.__fl) return
  // видимость с учётом предков: в слоте героя есть одноимённая вложенная группа
  window.__effVis = (o) => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true }
  const fl = { frames: [], long: [], viol: [], maxPanels: 0, maxGroups: 0, heroLeak: 0, sampling: false, last: 0 }
  window.__fl = fl
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) fl.long.push(e.duration) }).observe({ type: 'longtask', buffered: false })
  } catch {}
  const loop = (t) => {
    if (fl.sampling && fl.last) fl.frames.push(t - fl.last)
    fl.last = t
    const panels = document.querySelectorAll('[data-formation-lab]').length
    fl.maxPanels = Math.max(fl.maxPanels, panels)
    const sc = window.__atomlabPerf && window.__atomlabPerf.scene
    if (sc && fl.watch) {
      let groups = 0
      let heroVisible = null
      sc.traverse((o) => {
        if ((o.name === 'formation-lab-fx' || o.name === 'route-lab-fx') && window.__effVis(o) && o.scale.x > 1e-3) groups++
        if (o.name === 'lab-product-hero-root') heroVisible = heroVisible === true || window.__effVis(o)
      })
      fl.maxGroups = Math.max(fl.maxGroups, groups)
      const live = window.__showDirector && window.__showDirector.kind !== 'none'
      if (live && heroVisible === true) fl.heroLeak++
    }
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
})()`

const pct = (a, p) => {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}

async function markDelta(page) {
  return page.evaluate(`(() => {
    const c = performance.getEntriesByName('formation-lab:click').pop()
    const f = performance.getEntriesByName('formation-lab:first-frame').filter((e) => c && e.startTime >= c.startTime).pop()
    return c && f ? Math.round(f.startTime - c.startTime) : null
  })()`)
}

async function geometry(page, phone) {
  return page.evaluate(`(() => {
    const out = { panel: null, issues: [] }
    const W = innerWidth, H = innerHeight
    const p = document.querySelector('[data-formation-lab]') || document.querySelector('[data-route-lab]')
    const hud = document.querySelector('[data-formation-lab-hud]')
    const reactor = document.querySelector('[data-lab-reactor][data-open="true"]')
    const canvas = document.querySelector('canvas')
    const R = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } }
    const inter = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t))
    if (p) {
      const pr = R(p)
      out.panel = pr
      if (pr.r > W + 0.5 || pr.b > H + 0.5 || pr.l < -0.5 || pr.t < -0.5) out.issues.push('панель вне окна ' + JSON.stringify(pr))
      if (reactor && reactor.getAttribute('data-collapsed') !== 'true') {
        const rr = R(reactor)
        const a = inter(pr, rr)
        if (rr.h > 0 && a > 0) out.issues.push('панель на реакторе: ' + Math.round(a) + ' px²')
      }
    }
    if (${phone ? 'true' : 'false'} && reactor && reactor.getAttribute('data-collapsed') !== 'true' && p) out.issues.push('телефон: реактор не свёрнут во время показа')
    if (hud) {
      const hr = R(hud)
      const cr = canvas ? R(canvas) : { l: 0, t: 0, r: W, b: H }
      if (hr.l < cr.l - 1 || hr.t < cr.t - 1 || hr.r > cr.r + 1 || hr.b > cr.b + 1) out.issues.push('HUD вне холста')
      const card = hud.querySelector('[data-formation-hud]')
      if (card && p) {
        const a = inter(R(card), R(p))
        if (a > 0) out.issues.push('HUD под панелью: ' + Math.round(a) + ' px²')
      }
      for (const c of hud.querySelectorAll('[data-hud-card]')) {
        if (c.scrollWidth > c.clientWidth + 1 || c.scrollHeight > c.clientHeight + 1) out.issues.push('HUD-карточка переполнена: ' + c.getAttribute('data-hud-card') + ' ' + c.scrollWidth + '/' + c.clientWidth + ' × ' + c.scrollHeight + '/' + c.clientHeight)
        const cr2 = R(c)
        if (cr2.r > hr.r + 1 || cr2.l < hr.l - 1) out.issues.push('HUD-карточка вне слоя HUD')
      }
    }
    return out
  })()`)
}

async function sampleFrames(page, ms) {
  await page.evaluate(`(() => { window.__fl.frames = []; window.__fl.long = []; window.__fl.sampling = true; window.__fl.last = 0 })()`)
  await page.waitForTimeout(ms)
  return page.evaluate(`(() => { window.__fl.sampling = false; return { frames: window.__fl.frames.slice(1), long: window.__fl.long.slice() } })()`)
}

async function openReactor(page, s) {
  const q = s.mr ? `reactor=1&mr=${s.mr}` : `reactor=1&eq=${encodeURIComponent(s.eq)}`
  await page.goto(`${BASE}/#/?${q}&perf=1`, { waitUntil: 'load', timeout: 120_000 })
  await page.evaluate(PROBE)
}

async function runOne(page, vp, s) {
  const r = { id: s.id, label: s.label, vp: vp.name, issues: [] }
  const limitFrame = vp.phone ? 120 : 100
  await openReactor(page, s)
  if (s.route) {
    r.preview = 'нет (путь CO₂ — свой показ по Run)'
  } else {
    const btn = page.locator('[data-reactor-formation]').first()
    try {
      await btn.waitFor({ state: 'visible', timeout: 30_000 })
    } catch {
      r.issues.push('нет кнопки «Как образуется» в реакторе')
      return r
    }
    // дать реактору простоять: прогрев CPU/GPU в простое (как у ученика, который читает уравнение)
    await page.waitForTimeout(2500)
    await btn.click()
    await page.waitForSelector('[data-formation-lab]', { timeout: 10_000 })
    await page.waitForTimeout(600)
    r.coldMs = await markDelta(page)
    await btn.click() // закрыть
    await page.waitForTimeout(500)
    await btn.click() // прогретый
    await page.waitForSelector('[data-formation-lab]', { timeout: 10_000 })
    await page.waitForTimeout(400)
    r.warmMs = await markDelta(page)
    if (r.coldMs == null || r.coldMs > 700) r.issues.push(`холодный click→first-frame ${r.coldMs} мс > 700`)
    if (r.warmMs == null || r.warmMs > 300) r.issues.push(`прогретый click→first-frame ${r.warmMs} мс > 300`)
    const fr = await sampleFrames(page, SAMPLE_MS)
    r.frames = { n: fr.frames.length, p50: Math.round(pct(fr.frames, 50)), p95: Math.round(pct(fr.frames, 95)), p99: Math.round(pct(fr.frames, 99)), max: Math.round(Math.max(0, ...fr.frames)), longtasks: fr.long.length }
    if (r.frames.max > limitFrame) r.issues.push(`кадр ${r.frames.max} мс > ${limitFrame}`)
    if (r.frames.p95 > 40) r.issues.push(`p95 ${r.frames.p95} мс > 40`)
    const g = await geometry(page, vp.phone)
    r.issues.push(...g.issues)
    if (args.shots) await page.screenshot({ path: join(OUT, `${LABEL}-${vp.name}-${s.id}-preview.png`) })
  }
  if (args['no-run']) return r
  // (iv) Run при открытом preview → один показ, герой невидим, в конце — герой
  const run = page.locator('[data-reactor-run]').first()
  try {
    await run.waitFor({ state: 'visible', timeout: 10_000 })
    if (await run.isDisabled()) {
      r.issues.push('Run недоступен (уравнение не уравнено?)')
      return r
    }
  } catch {
    r.issues.push('нет кнопки Run')
    return r
  }
  await page.evaluate(`(() => { const f = window.__fl; f.maxPanels = 0; f.maxGroups = 0; f.heroLeak = 0; f.watch = true })()`)
  const t0 = Date.now()
  await run.click()
  // «Этап 1/n» на кнопке
  try {
    await page.waitForSelector('[data-run-showing]', { timeout: 4000 })
    r.runToStageMs = Date.now() - t0
  } catch {
    r.issues.push('Run: нет «Идёт показ · этап k/n»')
  }
  await page.waitForTimeout(2500)
  const g2 = await geometry(page, vp.phone)
  r.issues.push(...g2.issues.map((x) => 'synth: ' + x))
  if (args.shots) await page.screenshot({ path: join(OUT, `${LABEL}-${vp.name}-${s.id}-synth.png`) })
  // к концу: «Закрыть показ» в synth отдаёт продукт сразу
  const close = page.locator('[data-formation-lab-close]').first()
  if (await close.count()) await close.click().catch(() => {})
  try {
    await page.waitForFunction(`!document.querySelector('[data-formation-lab]') && !document.querySelector('[data-route-lab]')`, null, { timeout: 60_000 })
  } catch {
    r.issues.push('показ не закончился за 60 с')
  }
  await page.waitForTimeout(2500)
  const fin = await page.evaluate(`(() => {
    const f = window.__fl; f.watch = false
    let hero = null, groups = 0
    const sc = window.__atomlabPerf && window.__atomlabPerf.scene
    if (sc) sc.traverse((o) => { if (o.name === 'lab-product-hero-root') hero = hero === true || window.__effVis(o); if ((o.name === 'formation-lab-fx' || o.name === 'route-lab-fx') && window.__effVis(o) && o.scale.x > 1e-3) groups++ })
    return { maxPanels: f.maxPanels, maxGroups: f.maxGroups, heroLeak: f.heroLeak, hero, groups, scene: !!sc, kind: window.__showDirector ? window.__showDirector.kind : null,
      showing: !!document.querySelector('[data-run-showing]') }
  })()`)
  r.synth = fin
  if (fin.maxPanels > 1) r.issues.push(`две панели показа одновременно (${fin.maxPanels})`)
  if (fin.maxGroups > 1) r.issues.push(`две группы показа в сцене (${fin.maxGroups})`)
  if (fin.heroLeak > 0) r.issues.push(`герой продукта виден во время показа (${fin.heroLeak} кадров)`)
  if (fin.groups > 0) r.issues.push('после конца группа показа видна')
  if (fin.scene && fin.hero === false) r.issues.push('после конца герой продукта невидим')
  if (fin.kind && fin.kind !== 'none') r.issues.push(`после конца режиссёр ${fin.kind}`)
  if (fin.showing) r.issues.push('после конца кнопка Run всё ещё «Идёт показ»')
  if (args.shots) await page.screenshot({ path: join(OUT, `${LABEL}-${vp.name}-${s.id}-done.png`) })
  return r
}

async function catalogCheck(browser) {
  const out = []
  for (const vp of [
    { name: '673×900', viewport: { width: 673, height: 900 } },
    { name: '390×844', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  ]) {
    const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor ?? 1 })
    const page = await ctx.newPage()
    const r = { vp: vp.name, issues: [] }
    try {
      await page.goto(`${BASE}/#/catalog?q=${encodeURIComponent('K₂O₂')}`, { waitUntil: 'load', timeout: 120_000 })
      const search = page.locator('input[type="search"], input[inputmode="search"]').first()
      if (await search.count()) await search.fill('K₂O₂').catch(() => {})
      await page.waitForTimeout(1200)
      const card = page.locator('[data-compound-id="tb_k2o2"], [data-id="tb_k2o2"]').first()
      if (await card.count()) await card.click()
      else await page.getByText('K₂O₂', { exact: true }).first().click({ timeout: 8000 })
      const play = page.locator('[data-formation-play]').first()
      await play.waitFor({ state: 'visible', timeout: 15_000 })
      await play.click()
      for (const t of [3000, 9000, 15000]) {
        await page.waitForTimeout(t === 3000 ? 3000 : 6000)
        const iss = await page.evaluate(`(() => {
          const out = []
          for (const c of document.querySelectorAll('[data-hud-card]')) {
            if (c.scrollWidth > c.clientWidth + 1 || c.scrollHeight > c.clientHeight + 1) out.push('карточка ' + c.getAttribute('data-hud-card') + ' переполнена ' + c.scrollWidth + '/' + c.clientWidth)
            const w = c.closest('[data-formation-3d]')
            if (w) { const a = c.getBoundingClientRect(), b = w.getBoundingClientRect(); if (a.right > b.right + 1 || a.left < b.left - 1) out.push('карточка вне 3D-окна') }
          }
          return out
        })()`)
        r.issues.push(...iss.map((x) => `t≈${t / 1000}s: ${x}`))
        if (args.shots) await page.screenshot({ path: join(OUT, `${LABEL}-catalog-${vp.name}-${t}.png`) })
      }
    } catch (e) {
      r.issues.push('каталог: ' + String(e).split('\n')[0])
    }
    out.push(r)
    await ctx.close()
  }
  return out
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  await ensureServer()
  browser = await chromium.launch({ headless: !args.headed, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
  const results = []
  for (const vp of vps) {
    const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor ?? 1 })
    for (const s of SUBSTANCES) {
      if (only && !only.has(s.id)) continue
      const page = await ctx.newPage()
      const errors = []
      page.on('pageerror', (e) => errors.push(String(e)))
      let r
      try {
        r = await runOne(page, vp, s)
      } catch (e) {
        r = { id: s.id, label: s.label, vp: vp.name, issues: ['исключение: ' + String(e).split('\n')[0]] }
      }
      if (errors.length) r.issues.push(...errors.slice(0, 3).map((x) => 'pageerror: ' + x.slice(0, 160)))
      results.push(r)
      const f = r.frames
      console.log(
        `${r.issues.length ? '✗' : '✓'} ${vp.name.padEnd(9)} ${String(s.label).padEnd(16)} cold ${r.coldMs ?? '–'} / warm ${r.warmMs ?? '–'} мс` +
          (f ? ` · кадры p95 ${f.p95} p99 ${f.p99} max ${f.max}` : '') +
          (r.runToStageMs != null ? ` · Run→этап ${r.runToStageMs} мс` : '') +
          (r.issues.length ? `\n    ${r.issues.join('\n    ')}` : ''),
      )
      await page.close()
    }
    await ctx.close()
  }
  const catalog = args['no-catalog'] ? [] : await catalogCheck(browser)
  for (const c of catalog) console.log(`${c.issues.length ? '✗' : '✓'} каталог K₂O₂ ${c.vp}${c.issues.length ? '\n    ' + c.issues.join('\n    ') : ''}`)
  const file = join(OUT, `formation-lab-${LABEL}.json`)
  writeFileSync(file, JSON.stringify({ label: LABEL, base: BASE, sampleMs: SAMPLE_MS, at: new Date().toISOString(), results, catalog }, null, 2))
  const bad = results.filter((r) => r.issues.length).length + catalog.filter((c) => c.issues.length).length
  console.log(`\ne2e-formation-lab: ${results.length + catalog.length - bad}/${results.length + catalog.length} без нарушений → ${file}`)
  return bad
}

main()
  .then(async (bad) => {
    await browser?.close()
    server?.kill()
    process.exit(bad ? 1 : 0)
  })
  .catch(async (e) => {
    console.error(e)
    await browser?.close()
    server?.kill()
    process.exit(1)
  })
