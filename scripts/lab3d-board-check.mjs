// Доска 3D-лаборатории: «не отлетает» и «не видна сквозь стены/мебель».
// Нужен собранный сайт в vite preview (не dev-сервер):
//   npm run build && npx vite preview --port 4831 --strictPort
//   node scripts/lab3d-board-check.mjs 4831            — проверка; кадры в .smoke/lab3d-board/
//
// 1) Действия у доски (Tab по кнопкам, протяжка-выделение текста, колесо, клавиши прокрутки, «Далее», щелчки по сцене):
//    после каждого HTML-доска совпадает со своей рамкой (window.__labBoard.probe().drift ≤ 3 px).
// 2) Повороты камеры, при которых доску частично закрывают вытяжка, шкафы, стена или стол: в точках экрана доски,
//    закрытых непрозрачной мебелью (луч из камеры), пиксель кадра не меняется, если спрятать HTML-доску.
import { chromium } from 'playwright'
import fs from 'node:fs'

const [port] = process.argv.slice(2)
if (!port) {
  console.error('node scripts/lab3d-board-check.mjs <port>')
  process.exit(2)
}
const OUT = process.env.OUT ?? '.smoke/lab3d-board'
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const MAX_DRIFT = 3

const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
const page = await b.newPage({ viewport: { width: 1280, height: 800 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.goto(`http://localhost:${port}/#/vr-lab?debugLab=1`, { waitUntil: 'load', timeout: 60000 })
await page.waitForFunction('typeof window.__labBoard === "object" && typeof window.__labCam === "object"', null, { timeout: 90000 })
await page.waitForFunction('!document.querySelector(\'[class*="loading"][role="status"]\')', null, { timeout: 60000 })
await sleep(2500)

const frames = () => page.evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))')
const probe = () => page.evaluate('window.__labBoard.probe(11, 6)')
let bad = 0

// ── 1. Доска не отлетает ─────────────────────────────────────────────────────────────────────────────────────────
// камера — вид «Доска» (как у ученика, когда он работает с доской)
const boardBtn = page.getByRole('button', { name: /^Доска$/ }).first()
if (await boardBtn.count()) {
  await boardBtn.click().catch(() => {})
  await sleep(1800)
}
const p0 = await probe()
console.log(`исходно: drift ${p0?.drift} px, HTML [${p0?.dom}] рамка [${p0?.proj}]`)
if (!p0 || p0.drift == null || p0.drift > MAX_DRIFT) bad++
const center = p0 ? [(p0.dom[0] + p0.dom[2]) / 2, (p0.dom[1] + p0.dom[3]) / 2] : [640, 400]
const at = (fx, fy) => (p0 ? [p0.dom[0] + (p0.dom[2] - p0.dom[0]) * fx, p0.dom[1] + (p0.dom[3] - p0.dom[1]) * fy] : [640, 400])

const actions = [
  ['Tab ×10 по кнопкам доски', async () => {
    await page.mouse.click(...at(0.5, 0.06))
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      await sleep(80)
    }
  }],
  ['протяжка-выделение текста', async () => {
    const [x0, y0] = at(0.3, 0.3)
    const [x1, y1] = at(0.98, 0.98)
    await page.mouse.move(x0, y0)
    await page.mouse.down()
    for (let i = 1; i <= 20; i++) {
      await page.mouse.move(x0 + ((x1 - x0) * i) / 20, y0 + ((y1 - y0) * i) / 20 + 60)
      await sleep(25)
    }
    await page.mouse.up()
  }],
  ['клавиши прокрутки (Пробел, PageDown, ↓, End)', async () => {
    await page.mouse.click(...at(0.5, 0.06))
    for (const k of ['Space', 'PageDown', 'ArrowDown', 'ArrowRight', 'End']) {
      await page.keyboard.press(k)
      await sleep(120)
    }
  }],
  ['колесо над доской', async () => {
    await page.mouse.move(...center)
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 240)
      await sleep(80)
    }
  }],
  ['«Далее» на доске', async () => {
    const next = page.getByRole('button', { name: /Далее/ }).first()
    if (await next.count()) await next.click({ timeout: 3000 }).catch(() => {})
  }],
  ['щелчок и протяжка по сцене рядом с доской', async () => {
    const x = Math.min(1270, (p0?.dom[2] ?? 1100) + 40)
    await page.mouse.move(x, 600)
    await page.mouse.down()
    await page.mouse.move(x - 30, 590, { steps: 6 })
    await page.mouse.up()
  }],
]
for (const [name, act] of actions) {
  await act()
  await sleep(900)
  await frames()
  const p = await probe()
  const ok = p && (p.drift == null || p.drift <= MAX_DRIFT)
  if (!ok) bad++
  console.log(`${ok ? '✓' : '✗'} ${name}: drift ${p?.drift ?? '—'} px`)
}
await page.screenshot({ path: `${OUT}/after-actions.png` })

// ── 2. Доска не видна сквозь стены и мебель ─────────────────────────────────────────────────────────────────────
const PIX = String.raw`(async (a, b, pts) => {
  const load = async (png) => {
    const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + png)).blob())
    const c = new OffscreenCanvas(bmp.width, bmp.height)
    const x = c.getContext('2d', { willReadFrequently: true })
    x.drawImage(bmp, 0, 0)
    return { x, sx: bmp.width / innerWidth, sy: bmp.height / innerHeight }
  }
  const A = await load(a), B = await load(b)
  return pts.map((p) => {
    const px = Math.floor(p.x * A.sx), py = Math.floor(p.y * A.sy)
    const da = A.x.getImageData(px - 1, py - 1, 3, 3).data, db = B.x.getImageData(px - 1, py - 1, 3, 3).data
    let d = 0
    for (let i = 0; i < da.length; i += 4) d = Math.max(d, Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]))
    return d
  })
})`
const POSES = [
  ['вид по умолчанию', null],
  ['справа у стены (шкафы, мойка)', [[2.95, 1.75, -0.75], [0, 1.6, -1.15]]],
  ['справа сверху', [[2.8, 2.6, 0.2], [0, 1.6, -1.1]]],
  ['слева у вытяжки', [[-2.95, 1.7, -0.7], [0, 1.6, -1.15]]],
  ['слева издалека', [[-2.6, 1.6, 2.4], [0.2, 1.6, -1.15]]],
  ['низко из-за стола', [[0.2, 1.13, 1.6], [0, 1.45, -1.15]]],
  ['поворот головы вправо', [[0.6, 1.6, 1.2], [2.2, 1.6, -0.9]]],
  ['поворот головы влево', [[-0.6, 1.6, 1.2], [-2.2, 1.6, -0.9]]],
]
let occludedTotal = 0
let posesWithOcclusion = 0
for (const [name, pose] of POSES) {
  if (pose) await page.evaluate(`window.__labCam.set(${JSON.stringify(pose[0])}, ${JSON.stringify(pose[1])})`)
  await sleep(1400)
  await frames()
  const p = await probe()
  if (!p) {
    bad++
    console.log(`✗ ${name}: щуп доски недоступен`)
    continue
  }
  const shotA = (await page.screenshot({ animations: 'disabled' })).toString('base64')
  await page.evaluate('window.__labBoard.hide(true)')
  await frames()
  const shotB = (await page.screenshot({ animations: 'disabled' })).toString('base64')
  await page.evaluate('window.__labBoard.hide(false)')
  const diffs = await page.evaluate(`${PIX}(${JSON.stringify(shotA)}, ${JSON.stringify(shotB)}, ${JSON.stringify(p.pts)})`)
  const occ = p.pts.map((q, i) => ({ ...q, d: diffs[i] })).filter((q) => q.occluded)
  const vis = p.pts.map((q, i) => ({ ...q, d: diffs[i] })).filter((q) => !q.occluded)
  const leaks = occ.filter((q) => q.d > 40)
  const shown = vis.filter((q) => q.d > 40)
  occludedTotal += occ.length
  if (occ.length) posesWithOcclusion++
  const fname = `${OUT}/pose-${POSES.findIndex((x) => x[0] === name)}.png`
  fs.writeFileSync(fname, Buffer.from(shotA, 'base64'))
  // утечка — хоть одна закрытая мебелью точка доски видна; «пусто» — доска на виду, но HTML не рисуется
  const okLeak = leaks.length === 0
  const okShown = vis.length < 6 || shown.length >= vis.length * 0.5
  if (!okLeak || !okShown) bad++
  console.log(
    `${okLeak && okShown ? '✓' : '✗'} ${name}: точек ${p.pts.length}, закрыто мебелью ${occ.length} (просвечивает ${leaks.length}), на виду ${vis.length} (доска видна в ${shown.length}), drift ${p.drift ?? '—'} px`,
  )
  if (leaks.length) console.log(`    просвечивает в ${leaks.slice(0, 5).map((q) => `(${q.x},${q.y}) Δ${q.d}`).join(' ')}  кадр ${fname}`)
}
if (!posesWithOcclusion) {
  bad++
  console.log('✗ ни в одном ракурсе мебель не закрыла доску — проверка «сквозь стены» ничего не проверила')
}
await b.close()
console.log(`\nракурсов с перекрытием ${posesWithOcclusion}/${POSES.length}, закрытых точек ${occludedTotal}${errs.length ? `, ошибки страницы: ${errs.slice(0, 2).join(' | ')}` : ''}`)
if (bad || errs.length) {
  console.error(`не прошло проверок: ${bad + (errs.length ? 1 : 0)}`)
  process.exit(1)
}
console.log('доска: неподвижна и не просвечивает')
