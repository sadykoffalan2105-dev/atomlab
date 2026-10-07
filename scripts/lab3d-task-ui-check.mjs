// Задача-опыт целиком: жесты как ученик → журнал → ввод ответа учебника → проверка → сверка; кадры ПК и телефона.
// node scripts/lab3d-task-ui-check.mjs <port> <id> [phone|phone-dark|dark] — кадры в .smoke/task-ui/<id>/
import { chromium } from 'playwright'
import fs from 'node:fs'

const [port, id, mode] = process.argv.slice(2)
const OUT = `.smoke/task-ui/${id}`
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const phone = mode === 'phone' || mode === 'phone-dark'
const dark = mode === 'phone-dark' || mode === 'dark'
const sfx = (phone ? '-phone' : '') + (dark ? '-dark' : '')
const b = await chromium.launch({ args: ['--use-angle=d3d11'] })
const page = await b.newPage(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } })
const errs = []
if (dark) await page.addInitScript(() => { try { localStorage.setItem('atomlab-theme', 'dark') } catch {} })
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto(`http://localhost:${port}/#/vr-lab?task=${id}&debugLab=1&from=/learn/tasks`, { waitUntil: 'load', timeout: 60000 })
await page.waitForFunction(() => typeof window.__labGesture === 'function', null, { timeout: 60000 })
await page.waitForFunction(() => !document.querySelector('[class*="loading"][role="status"]'), null, { timeout: 60000 })
await sleep(2500)
await page.screenshot({ path: `${OUT}/0-start${sfx}.png` })
const log = []
for (let guard = 0; guard < 16; guard++) {
  const g = await page.evaluate(() => window.__labGesture())
  if (!g) break
  const before = g.step
  if (phone) {
    // на телефоне жесты проверяет отдельный скрипт; здесь — кнопкой «Далее» (то, что увидит ученик в панели)
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')]
      const next = btns.find((x) => /Далее/.test(x.textContent || '') && !x.disabled)
      next?.click()
    })
  } else if (g.kind === 'tap') {
    if (g.at) await page.mouse.click(g.at[0], g.at[1])
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
  await sleep(1200)
  log.push(`${before}${after > before ? '✓' : '✗'}`)
  if (!phone && (before === 2 || before === 4)) await page.screenshot({ path: `${OUT}/step${before}.png` })
  if (after <= before) break
}
await sleep(1500)
// панель: открыть, если свёрнута (телефон)
if (phone) {
  await page.evaluate(() => {
    const head = document.querySelector('aside button[aria-expanded="false"]')
    head?.click()
  })
  await sleep(600)
}
const panel = page.locator('aside')
// ответ: в первое поле — заведомо неверное число, проверка → «Пока нет»; потом верные числа учебника
const inputs = page.locator('aside [data-lab3d-answer]')
const n = await inputs.count()
const book = await page.evaluate(() => (window.__labTaskBook ? window.__labTaskBook() : null))
for (let i = 0; i < n; i++) await inputs.nth(i).fill('1')
await page.locator('aside [data-lab3d-check]').click()
await sleep(500)
await page.locator('aside [data-lab3d-task-solve]').screenshot({ path: `${OUT}/1-wrong${sfx}.png` }).catch(() => {})
if (book) for (let i = 0; i < n; i++) await inputs.nth(i).fill(String(book[i]).replace('.', ','))
await page.locator('aside [data-lab3d-check]').click()
await sleep(800)
await page.screenshot({ path: `${OUT}/2-solved${sfx}.png`, fullPage: false })
await page.locator('aside [data-lab3d-task-solve]').screenshot({ path: `${OUT}/3-solve-panel${sfx}.png` }).catch(() => {})
// доска
if (!phone) {
  await page.getByRole('button', { name: /^Доска$/ }).first().click().catch(() => {})
  await sleep(2500)
  await page.screenshot({ path: `${OUT}/4-board.png` })
}
const text = await panel.innerText().catch(() => '')
fs.writeFileSync(`${OUT}/panel${sfx}.txt`, text)
console.log(id, phone ? 'phone' : 'pc', log.join(' '), 'answers:', n, 'book:', JSON.stringify(book), errs.length ? `ошибки: ${errs.slice(0, 3).join(' | ')}` : '')
await b.close()
