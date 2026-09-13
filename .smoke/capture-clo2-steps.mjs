import { chromium } from 'playwright'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const OUT = join(process.cwd(), '.smoke', 'clo2-steps')
const W = Number(process.env.W ?? 1440), H = Number(process.env.H ?? 900)
const LOW = process.env.LOW === '1'
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: W, height: H } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.addInitScript(() => { try { localStorage.setItem('atomlab-clo2-autoplay', '0') } catch {} })
await page.goto(`${BASE}/#/?reactor=1&product=clo2`, { waitUntil: 'load', timeout: 120000 })
const run = page.getByRole('button', { name: 'Проверить и запустить синтез' })
await run.waitFor({ state: 'visible', timeout: 120000 })
await page.waitForTimeout(3000)
writeFileSync(join(OUT, '00-prelaunch.png'), await page.screenshot())
await run.click()

const panel = page.locator('section[data-status]')
await panel.waitFor({ timeout: 60000 })
const shots = Number(process.env.SHOTS ?? 3)
for (let step = 0; step < 8; step++) {
  const t0 = Date.now()
  let i = 0
  while (true) {
    const status = await panel.getAttribute('data-status')
    if (status === 'paused') break
    if (Date.now() - t0 > 60000) { errors.push(`step ${step} never paused (status ${status})`); break }
    if (i < shots) {
      await page.waitForTimeout(900)
      writeFileSync(join(OUT, `s${step + 1}-${i}.png`), await page.screenshot())
      i++
    } else {
      await page.waitForTimeout(250)
    }
  }
  writeFileSync(join(OUT, `s${step + 1}-end.png`), await page.screenshot())
  console.log('step', step + 1, 'paused after', Date.now() - t0, 'ms')
  if (step < 7) await page.getByRole('button', { name: 'Далее' }).click()
}
await page.getByRole('button', { name: 'Завершить' }).click()
await page.waitForTimeout(6000)
writeFileSync(join(OUT, '99-after.png'), await page.screenshot())
console.log('errors:', errors.slice(0, 10))
await browser.close()
