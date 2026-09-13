import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const BASE = process.env.BASE ?? 'http://localhost:5173'
const OUT = join(process.cwd(), '.smoke', process.env.OUTDIR ?? 'clo2-freeze')
const W = Number(process.env.W ?? 1440), H = Number(process.env.H ?? 900)
const TIMES = (process.env.TIMES ?? '2,6.5,8.9,9.8,10.4,13,16.8,17.8,19.3,20.1,20.6,21.6,23,25,28.5,30.5').split(',').map(Number)
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: W, height: H } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(`${BASE}/#/?reactor=1&product=clo2&perf=1${process.env.TIER ? '&deviceTier=' + process.env.TIER : ''}`, { waitUntil: 'load', timeout: 120000 })
const run = page.getByRole('button', { name: 'Проверить и запустить синтез' })
await run.waitFor({ state: 'visible', timeout: 120000 })
await page.waitForTimeout(2500)
await run.click()
await page.locator('[data-lab-lesson-panel]').waitFor({ timeout: 60000 })
await page.waitForFunction(() => typeof window.__clo2Freeze === 'function', null, { timeout: 60000 })
let first = true
for (const t of TIMES) {
  await page.evaluate((tt) => window.__clo2Freeze(tt), t)
  await page.waitForTimeout(first ? 6000 : 1800)
  first = false
  writeFileSync(join(OUT, `t${String(t).replace('.', '_')}.png`), await page.screenshot())
  console.log('shot', t)
}
console.log('errors:', errors.slice(0, 8))
await browser.close()
