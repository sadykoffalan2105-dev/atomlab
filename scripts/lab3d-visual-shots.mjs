// Кадры и замеры 3D-лаборатории (по собранному сайту: npx vite preview --port <port>).
//   node scripts/lab3d-visual-shots.mjs <port> [out=.smoke/lab3d-visual] [only=desk|board|phone|all]
// 1) 1440×900 high: виды desk/board/hood/shelves для опытов baso4, co2, nh3, task-g8-cuso4-hydrate;
// 2) 1920×1080 ?board=1 (режим электронной доски): размеры кнопок, шрифт инструкции, контраст (светлая и тёмная тема);
// 3) 390×844 low (телефон).
// В каждом замере — средний fps за 3 с (счётчик requestAnimationFrame) и window.__labPerf.info() (?debugPerf=1).
// Доп. флаги адреса через переменную окружения EXTRA (например EXTRA='&fx=0' или '&tm=aces').
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const [port = '4701', out = '.smoke/lab3d-visual', only = 'all'] = process.argv.slice(2)
const EXTRA = process.env.EXTRA ?? ''
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
const log = []
const say = (s) => {
  log.push(s)
  console.log(s)
}
const VIEW_INDEX = { desk: 0, board: 1, shelves: 2, hood: 3 }
const FPS = `new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; const dt = performance.now() - t0; if (dt < 3000) requestAnimationFrame(f); else r(Math.round((n * 1000 / dt) * 10) / 10) }; requestAnimationFrame(f) })`
const READY = `!document.querySelector('[role=status] [class*=spinner]') && !!window.__labPerf`
const INFO = `window.__labPerf ? window.__labPerf.info() : null`

async function open(page, hash) {
  await page.goto(`http://localhost:${port}/#/vr-lab?${hash}&debugPerf=1${EXTRA}`, { waitUntil: 'load', timeout: 90000 })
  await page.waitForFunction(READY, null, { timeout: 90000 })
  await page.waitForTimeout(2500)
}
async function view(page, v) {
  await page.evaluate(`(() => { const bs = document.querySelectorAll('[role=toolbar] button'); const x = bs[${VIEW_INDEX[v]}]; if (x) x.click() })()`)
  await page.waitForTimeout(2600)
}
async function measure(page, label) {
  const fps = await page.evaluate(FPS)
  const info = await page.evaluate(INFO)
  say(`${label}: fps ${fps}, ${info ? `programs ${info.programs}, calls ${info.calls}, tris ${info.triangles}, tex ${info.textures}, dpr ${info.dpr}${info.fx !== undefined ? `, fx ${info.fx}` : ''}` : 'нет __labPerf'}`)
  return { fps, info }
}

const errors = []
function watch(page) {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 200)}`)
  })
}

// 1) ПК, высокое качество
if (only === 'all' || only === 'desk') {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
  watch(page)
  for (const exp of ['baso4', 'co2', 'nh3', 'task-g8-cuso4-hydrate']) {
    await open(page, `exp=${exp}&q=high`)
    for (const v of ['desk', 'board', 'hood', 'shelves']) {
      await view(page, v)
      await page.screenshot({ path: `${out}/${exp}-${v}-1440.png` })
      await measure(page, `${exp} ${v} 1440 high`)
    }
  }
  await page.close()
}

// 2) Электронная доска 1920×1080
const BOARD_AUDIT = `(() => {
  const lum = (c) => { const m = c.match(/[\\d.]+/g); if (!m) return null; const [r, g, b, a = 1] = m.map(Number); return { r, g, b, a } }
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  const L = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
  const bgOf = (el) => {
    const stack = []
    for (let e = el; e; e = e.parentElement) { const c = lum(getComputedStyle(e).backgroundColor); if (c && c.a > 0) stack.push(c); if (c && c.a >= 1) break }
    let acc = { r: 233, g: 238, b: 243 }
    for (const c of stack.reverse()) acc = { r: acc.r * (1 - c.a) + c.r * c.a, g: acc.g * (1 - c.a) + c.g * c.a, b: acc.b * (1 - c.a) + c.b * c.a }
    return acc
  }
  const contrast = (el) => { const fg = lum(getComputedStyle(el).color); const bg = bgOf(el); const a = L(fg) + 0.05, b = L(bg) + 0.05; return Math.round((Math.max(a, b) / Math.min(a, b)) * 100) / 100 }
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth }
  const small = []
  let minSide = 999
  for (const el of document.querySelectorAll('[class*=wrap] button, [class*=wrap] a, [class*=wrap] summary, [class*=wrap] input')) {
    if (!vis(el)) continue
    const r = el.getBoundingClientRect()
    const side = Math.min(r.width, r.height)
    minSide = Math.min(minSide, side)
    if (side < 56) small.push((el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30) + ' ' + Math.round(r.width) + '×' + Math.round(r.height))
  }
  const ins = document.querySelector('aside [class*=instruction]')
  const insPx = ins ? parseFloat(getComputedStyle(ins).fontSize) : 0
  const lowC = []
  for (const el of document.querySelectorAll('[class*=wrap] [class*=instruction], [class*=wrap] [class*=observation], [class*=wrap] [class*=chip], [class*=wrap] [class*=btn], [class*=wrap] [class*=cardTitle], [class*=wrap] [class*=eq], [class*=wrap] [class*=stepCount], [class*=wrap] [class*=headTitle]')) {
    if (!vis(el) || el.disabled) continue
    const c = contrast(el)
    if (c < 4.5) lowC.push((el.className + '').split(' ')[0].slice(0, 26) + ' ' + c)
  }
  // Наложение панелей: рука/огнетушитель/виджеты/виды
  const boxes = ['[class*=handBar]', '[class*=dock]', '[role=toolbar]', 'aside'].map((s) => { const e = document.querySelector(s); return e && vis(e) ? [s, e.getBoundingClientRect()] : null }).filter(Boolean)
  const overlaps = []
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i][1], c = boxes[j][1]; if (a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom) overlaps.push(boxes[i][0] + ' × ' + boxes[j][0]) }
  return { board: document.querySelector('[data-lab-board]') ? 1 : 0, minSide: Math.round(minSide), small: small.slice(0, 12), smallCount: small.length, instructionPx: insPx, instructionRem: Math.round((insPx / parseFloat(getComputedStyle(document.documentElement).fontSize)) * 100) / 100, lowContrast: lowC.slice(0, 10), lowCount: lowC.length, overlaps }
})()`
if (only === 'all' || only === 'board') {
  for (const theme of ['light', 'dark']) {
    const page = await b.newPage({ viewport: { width: 1920, height: 1080 } })
    watch(page)
    if (theme === 'dark') await page.addInitScript(`try { localStorage.setItem('atomlab-theme', 'dark') } catch {}`)
    for (const exp of ['baso4', 'task-g8-cuso4-hydrate']) {
      await open(page, `exp=${exp}&q=high&board=1`)
      // виджеты раскрыты — чтобы проверить и их кнопки
      await page.evaluate(`(() => { const h = document.querySelector('[class*=dockHead]'); if (h && h.getAttribute('aria-expanded') === 'false') h.click() })()`)
      await page.waitForTimeout(600)
      await page.screenshot({ path: `${out}/${exp}-board1-1920-${theme}.png` })
      const audit = await page.evaluate(BOARD_AUDIT)
      say(`${exp} ?board=1 1920 ${theme}: ${JSON.stringify(audit)}`)
      await measure(page, `${exp} ?board=1 1920 ${theme}`)
      await view(page, 'board')
      await page.screenshot({ path: `${out}/${exp}-board1-1920-${theme}-boardview.png` })
    }
    await page.close()
  }
}

// 3) Телефон, низкое качество
if (only === 'all' || only === 'phone') {
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  watch(page)
  for (const exp of ['baso4', 'co2']) {
    await open(page, `exp=${exp}&q=low`)
    await page.screenshot({ path: `${out}/${exp}-phone-390.png` })
    await measure(page, `${exp} phone 390 low`)
  }
  await page.close()
}

say(errors.length ? `ошибки (${errors.length}): ${[...new Set(errors)].slice(0, 6).join(' | ')}` : 'без ошибок')
writeFileSync(`${out}/log.txt`, log.join('\n') + '\n')
await b.close()
