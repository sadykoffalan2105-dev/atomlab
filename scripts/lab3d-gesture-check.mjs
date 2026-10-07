// Проходит все шаги опытов 3D-лаборатории так, как ученик: тап — по цели, перетаскивание — от начала к концу жеста.
// Нужен собранный сайт в vite preview (не dev-сервер):
//   npx vite build --outDir .tmp/dist-x && npx vite preview --outDir .tmp/dist-x --port 4801 --strictPort
//   node scripts/lab3d-gesture-check.mjs 4801                         — все опыты и задачи
//   node scripts/lab3d-gesture-check.mjs 4801 task-g7-zn-moles co2    — выбранные
//   SHOTS=1 node scripts/lab3d-gesture-check.mjs 4801 task-g7-zn-moles — кадр после каждого шага (.smoke/lab3d-gestures/)
import { chromium } from 'playwright'
import fs from 'node:fs'

const [port, ...only] = process.argv.slice(2)
if (!port) {
  console.error('node scripts/lab3d-gesture-check.mjs <port> [id…]')
  process.exit(2)
}
const OUT = process.env.OUT ?? '.smoke/lab3d-gestures'
fs.mkdirSync(OUT, { recursive: true })
const SHOTS = process.env.SHOTS === '1'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ALL = ['baso4', 'zn-hcl', 'ch4-burn', 'h2-practical', 'salt-purify', 'nh3', 'halogens', 'water-oxides', 'co2', 'metals-acids']
const b = await chromium.launch({ args: ['--use-angle=d3d11'] })

// какие задачи-опыты есть на доске (берём из страницы — список меняется вместе с данными)
async function taskIds() {
  const page = await b.newPage()
  await page.goto(`http://localhost:${port}/#/vr-lab?debugLab=1`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForFunction(() => typeof window.__labTaskIds === 'function', null, { timeout: 60000 }).catch(() => {})
  const ids = await page.evaluate(() => (typeof window.__labTaskIds === 'function' ? window.__labTaskIds() : []))
  await page.close()
  return ids
}

const ids = only.length ? only : [...ALL, ...(await taskIds())]
let bad = 0
for (const id of ids) {
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.goto(`http://localhost:${port}/#/vr-lab?exp=${id}&debugLab=1&debugHand=1`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForFunction(() => typeof window.__labGesture === 'function', null, { timeout: 60000 })
  await page.waitForFunction(() => !document.querySelector('[class*="loading"][role="status"]'), null, { timeout: 60000 })
  await sleep(2500)
  const log = []
  let stuck = false
  for (let guard = 0; guard < 16; guard++) {
    const g = await page.evaluate(() => window.__labGesture())
    if (!g) break
    const before = g.step
    if (g.kind === 'tap') {
      if (g.at) await page.mouse.click(g.at[0], g.at[1])
      else {
        const take = page.getByRole('button', { name: /^Взять/ }).first()
        if (await take.count()) await take.click().catch(() => {})
      }
    } else {
      const [sx, sy] = g.at ?? g.from
      const ex = sx + (g.to[0] - g.from[0])
      const ey = sy + (g.to[1] - g.from[1])
      await page.mouse.move(sx, sy)
      await page.mouse.down()
      for (let i = 1; i <= 26; i++) {
        await page.mouse.move(sx + ((ex - sx) * i) / 26, sy + ((ey - sy) * i) / 26)
        await sleep(30)
      }
      await page.mouse.up()
    }
    let after = before
    for (let w = 0; w < 30 && after <= before; w++) {
      await sleep(500)
      after = await page.evaluate(() => window.__labGesture()?.step ?? 99)
    }
    await sleep(1500)
    if (SHOTS) await page.screenshot({ path: `${OUT}/${id}-s${before}.png` })
    log.push(`${before}:${g.kind}${after > before ? '✓' : '✗'}`)
    if (after <= before) {
      stuck = true
      await page.screenshot({ path: `${OUT}/${id}-stuck-${before}.png` })
      break
    }
  }
  await page.screenshot({ path: `${OUT}/${id}-end.png` })
  if (stuck || errs.length) bad++
  console.log(id, log.join(' '), errs.length ? `ошибки: ${errs.slice(0, 2).join(' | ')}` : '')
  await page.close()
}
await b.close()
if (bad) {
  console.error(`\nне прошли: ${bad}`)
  process.exit(1)
}
