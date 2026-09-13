import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:5173'
const TIER = process.env.TIER ?? 'low'
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(`${BASE}/#/?reactor=1&product=clo2&perf=1&deviceTier=${TIER}`, { waitUntil: 'load', timeout: 120000 })
const run = page.getByRole('button', { name: 'Проверить и запустить синтез' })
await run.waitFor({ state: 'visible', timeout: 120000 })
await page.waitForTimeout(2000)
await run.click()
await page.waitForFunction(() => typeof window.__clo2Freeze === 'function', null, { timeout: 60000 })
await page.evaluate(() => window.__clo2Freeze(9))
for (let i = 0; i < 12; i++) {
  await page.evaluate(() => window.__atomlabPerf.reset())
  await page.waitForTimeout(2000)
  const s = await page.evaluate(() => window.__atomlabPerf.snapshot())
  console.log(i, 'p50', s.frameMs.p50.toFixed(1), 'p95', s.frameMs.p95.toFixed(1), 'dpr', s.dpr, 'calls', s.calls, 'programs', s.programs, 'frames', s.frames)
}
await browser.close()
