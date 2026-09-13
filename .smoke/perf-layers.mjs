import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:5173'
const TIER = process.env.TIER ?? 'low'
const T = Number(process.env.T ?? 9)
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(`${BASE}/#/?reactor=1&product=clo2&perf=1&deviceTier=${TIER}`, { waitUntil: 'load', timeout: 120000 })
const run = page.getByRole('button', { name: 'Проверить и запустить синтез' })
await run.waitFor({ state: 'visible', timeout: 120000 })
await page.waitForTimeout(2000)
await run.click()
await page.waitForFunction(() => typeof window.__clo2Freeze === 'function', null, { timeout: 60000 })
await page.evaluate((t) => window.__clo2Freeze(t), T)
await page.waitForTimeout(4000)
const measure = async () => {
  await page.evaluate(() => window.__atomlabPerf.reset())
  await page.waitForTimeout(3000)
  return page.evaluate(() => window.__atomlabPerf.snapshot())
}
const cats = await page.evaluate(() => {
  const scene = window.__atomlabPerf.scene
  const map = {}
  scene.traverse((o) => {
    if (!o.isMesh && !o.isPoints) return
    const m = Array.isArray(o.material) ? o.material[0] : o.material
    const key = [o.type, m?.type, m?.blending === 2 ? 'add' : 'norm', m?.uniforms ? Object.keys(m.uniforms).slice(0, 3).join('+') : '', o.geometry?.type].join('|')
    ;(map[key] ??= []).push(o.uuid)
    o.userData.__perfKey = key
  })
  window.__perfCats = map
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.length]))
})
console.log('categories', cats)
await page.waitForTimeout(2000)
const base = await measure()
console.log('BASE', base.frameMs.p50.toFixed(1), 'calls', base.calls, 'dpr', base.dpr)
for (const key of Object.keys(cats)) {
  await page.evaluate((k) => window.__atomlabPerf.scene.traverse((o) => { if (o.userData.__perfKey === k) { o.userData.__vis = o.visible; o.visible = false } }), key)
  await page.waitForTimeout(2000)
  const r = await measure()
  await page.evaluate((k) => window.__atomlabPerf.scene.traverse((o) => { if (o.userData.__perfKey === k) o.visible = o.userData.__vis }), key)
  console.log('hide', key.padEnd(90), 'p50', r.frameMs.p50.toFixed(1), 'Δ', (base.frameMs.p50 - r.frameMs.p50).toFixed(1), 'calls', r.calls)
}
await browser.close()
