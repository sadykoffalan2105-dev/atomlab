// Доска 3D-лаборатории: «не отлетает» и «не видна сквозь стены/мебель».
// Нужен собранный сайт в vite preview (не dev-сервер):
//   npm run build && npx vite preview --port 4831 --strictPort
//   node scripts/lab3d-board-check.mjs 4831            — проверка; кадры в .smoke/lab3d-board/
//
// 1) Действия у доски (Tab по кнопкам, протяжка-выделение текста, колесо, клавиши прокрутки, «Далее», щелчки по сцене):
//    после каждого HTML-доска совпадает со своей рамкой (window.__labBoard.probe().drift ≤ 3 px).
// 2) Повороты камеры, при которых доску частично закрывают вытяжка, шкафы, стена или стол: HTML-доска меняет пиксели
//    кадра только там, где плоскость доски видна с учётом глубины (window.__labBoard.mark — см. labBoardProbe.ts).
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
const probe = () => page.evaluate('window.__labBoard.probe()')
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
]
const cam = () => page.evaluate('window.__labCam.get()')
const camMoved = (a, b) => Math.max(...a.position.map((v, i) => Math.abs(v - b.position[i])), ...(a.target ?? []).map((v, i) => Math.abs(v - b.target[i])))
for (const [name, act] of actions) {
  const c0 = await cam()
  await act()
  await sleep(900)
  await frames()
  const p = await probe()
  const moved = camMoved(c0, await cam())
  // действие НА доске не двигает камеру: иначе доска «улетает» из вида (протяжка крутила OrbitControls)
  const ok = p && (p.drift == null || p.drift <= MAX_DRIFT) && moved < 0.01
  if (!ok) bad++
  console.log(`${ok ? '✓' : '✗'} ${name}: drift ${p?.drift ?? '—'} px, камера сдвинулась на ${moved.toFixed(3)} м`)
}
// вращение камеры протяжкой по сцене: HTML-доска едет вместе с рамкой и во время движения (не отстаёт на кадр)
{
  const x = Math.min(1270, (p0?.dom[2] ?? 1100) + 30)
  await page.mouse.move(x, 700)
  await page.mouse.down()
  let worst = 0
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(x - i * 14, 700 - i * 9)
    await sleep(40)
    const d = (await probe())?.drift
    if (d != null) worst = Math.max(worst, d)
  }
  await page.mouse.up()
  const ok = worst <= MAX_DRIFT + 1
  if (!ok) bad++
  console.log(`${ok ? '✓' : '✗'} вращение камеры протяжкой по сцене: наибольший drift в движении ${worst} px`)
  await sleep(1500)
}
await page.screenshot({ path: `${OUT}/after-actions.png` })

// ── 2. Доска не видна сквозь стены и мебель ─────────────────────────────────────────────────────────────────────
// Три кадра: обычный (N), HTML-доска в негативе (I) и «краска» (P: HTML спрятана, плоскость-дыра drei пурпурная с
// проверкой глубины — пурпур ровно там, где доска должна быть видна). Точка, которая меняется от негатива (N≠I,
// при этом сцена между двумя обычными кадрами стоит), но вдали от пурпура в P, — доска видна сквозь стену/мебель.
const PIX = String.raw`(async (shots, rect) => {
  const load = async (png) => {
    const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + png)).blob())
    const c = new OffscreenCanvas(bmp.width, bmp.height)
    const x = c.getContext('2d', { willReadFrequently: true })
    x.drawImage(bmp, 0, 0)
    return { d: x.getImageData(0, 0, bmp.width, bmp.height).data, w: bmp.width, h: bmp.height }
  }
  const [N, I, N2, P] = await Promise.all(shots.map(load))
  const sx = N.w / innerWidth, sy = N.h / innerHeight
  const px = (img, x, y) => { const i = (Math.floor(y * sy) * img.w + Math.floor(x * sx)) * 4; return [img.d[i], img.d[i + 1], img.d[i + 2]] }
  const diff = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))
  const magenta = (c) => c[0] > 170 && c[1] < 110 && c[2] > 170 && c[0] - c[1] > 90
  const nearMagenta = (x, y) => {
    for (let dx = -5; dx <= 5; dx += 2.5) for (let dy = -5; dy <= 5; dy += 2.5) {
      const xx = x + dx, yy = y + dy
      if (xx >= 0 && yy >= 0 && xx < innerWidth && yy < innerHeight && magenta(px(P, xx, yy))) return true
    }
    return false
  }
  const [x0, y0, x1, y1] = rect
  const out = { painted: 0, shown: 0, leaks: [], stable: 0 }
  const NX = 48, NY = 30
  for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
    const x = x0 + ((i + 0.5) * (x1 - x0)) / NX, y = y0 + ((j + 0.5) * (y1 - y0)) / NY
    if (x < 1 || y < 1 || x > innerWidth - 1 || y > innerHeight - 1) continue
    const n = px(N, x, y)
    if (diff(n, px(N2, x, y)) > 24) continue // сцена шевелится (пламя, пузыри) — точку не судим
    out.stable++
    const changed = diff(n, px(I, x, y)) > 60
    const m = magenta(px(P, x, y))
    if (m) { out.painted++; if (changed) out.shown++ }
    else if (changed && !nearMagenta(x, y)) out.leaks.push([Math.round(x), Math.round(y), diff(n, px(I, x, y))])
  }
  return out
})`
const POSES = [
  ['вид «Доска»', null],
  ['справа у стены (шкафы, мойка)', [[2.95, 1.75, -0.75], [0, 1.6, -1.15]]],
  ['справа сверху', [[2.8, 2.6, 0.2], [0, 1.6, -1.1]]],
  ['слева у вытяжки', [[-2.95, 1.7, -0.7], [0, 1.6, -1.15]]],
  ['слева издалека', [[-2.6, 1.6, 2.4], [0.2, 1.6, -1.15]]],
  ['низко из-за стола', [[0.2, 1.13, 1.6], [0, 1.45, -1.15]]],
  ['поворот головы вправо', [[0.6, 1.6, 1.2], [2.2, 1.6, -0.9]]],
  ['поворот головы влево', [[-0.6, 1.6, 1.2], [-2.2, 1.6, -0.9]]],
  ['вплотную справа (вид 188.png)', [[1.9, 1.7, -0.55], [-0.4, 1.6, -1.15]]],
]
const shot = async () => (await page.screenshot({ animations: 'disabled' })).toString('base64')
const settle = async () => {
  await frames()
  await sleep(160)
  await frames()
}
let occludedPoses = 0
for (const [k, [name, pose]] of POSES.entries()) {
  if (pose) await page.evaluate(`window.__labCam.set(${JSON.stringify(pose[0])}, ${JSON.stringify(pose[1])})`)
  await sleep(1400)
  await settle()
  const p = await probe()
  if (!p) {
    bad++
    console.log(`✗ ${name}: щуп доски недоступен`)
    continue
  }
  const N = await shot()
  if (!(await page.evaluate("window.__labBoard.mark('invert')")) && k === 0) console.log('    (плоскость-дыра drei не найдена)')
  await settle()
  const I = await shot()
  await page.evaluate('window.__labBoard.mark(null)')
  await settle()
  const N2 = await shot()
  await page.evaluate("window.__labBoard.mark('paint')")
  await settle()
  const P = await shot()
  await page.evaluate('window.__labBoard.mark(null)')
  // прямоугольник доски с запасом: просвет мог бы быть и за краем рамки
  const r = p.proj ?? p.dom
  const rect = [r[0] - 20, r[1] - 20, r[2] + 20, r[3] + 20]
  const res = await page.evaluate(`${PIX}(${JSON.stringify([N, I, N2, P])}, ${JSON.stringify(rect)})`)
  fs.writeFileSync(`${OUT}/pose-${k}.png`, Buffer.from(N, 'base64'))
  fs.writeFileSync(`${OUT}/pose-${k}-paint.png`, Buffer.from(P, 'base64'))
  const covered = res.stable - res.painted
  if (res.painted < res.stable * 0.9) occludedPoses++
  // доска на виду — HTML действительно рисуется (иначе «дыра» пустая или доска под холстом)
  const okShown = res.painted < 20 || res.shown >= res.painted * 0.6
  const okLeak = res.leaks.length <= 2 // 1–2 точки — сглаживание на кромке мебели
  if (!okShown || !okLeak) bad++
  console.log(
    `${okShown && okLeak ? '✓' : '✗'} ${name}: точек ${res.stable}, доска на виду ${res.painted} (рисуется ${res.shown}), закрыто/вне доски ${covered}, просвечивает ${res.leaks.length}, drift ${p.drift ?? '—'} px`,
  )
  if (res.leaks.length) console.log(`    просвет: ${res.leaks.slice(0, 6).map((q) => `(${q[0]},${q[1]}) Δ${q[2]}`).join(' ')} — кадр ${OUT}/pose-${k}.png`)
}
if (!occludedPoses) {
  bad++
  console.log('✗ ни в одном ракурсе мебель не закрыла доску — проверка «сквозь стены» ничего не проверила')
}
await b.close()
console.log(`\nракурсов, где доска частично закрыта или за кадром: ${occludedPoses}/${POSES.length}${errs.length ? `; ошибки страницы: ${errs.slice(0, 2).join(' | ')}` : ''}`)
if (bad || errs.length) {
  console.error(`не прошло проверок: ${bad + (errs.length ? 1 : 0)}`)
  process.exit(1)
}
console.log('доска: неподвижна и не просвечивает')
