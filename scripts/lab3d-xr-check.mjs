// Проверка VR-слоя в эмуляции без шлема (?xrEmulate=1): все опыты и задачи проходятся «лучом» (мышь = луч из
// камеры, кнопка = курок), VR-доска шлёт uiCommand (next/back/restart/select), площадки телепорта меняют
// __labXr.state().stand, нет pageerror. Кадры — в .smoke/lab3d-xr/.
// Нужен собранный сайт в vite preview:
//   npx vite build --outDir .tmp/dist-x && npx vite preview --outDir .tmp/dist-x --port 4701 --strictPort
//   node scripts/lab3d-xr-check.mjs 4701                 — все 25 сценариев + доска, телепорт, кадры
//   node scripts/lab3d-xr-check.mjs 4701 co2 nh3         — выбранные опыты
import { chromium } from 'playwright'
import fs from 'node:fs'

const [port, ...only] = process.argv.slice(2)
if (!port) {
  console.error('node scripts/lab3d-xr-check.mjs <port> [id…]')
  process.exit(2)
}
const OUT = process.env.OUT ?? '.smoke/lab3d-xr'
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ALL = ['baso4', 'zn-hcl', 'ch4-burn', 'h2-practical', 'salt-purify', 'nh3', 'halogens', 'water-oxides', 'co2', 'metals-acids']
const VIEW = { width: 1440, height: 900 }
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
const url = (id) => `http://localhost:${port}/#/vr-lab?exp=${id}&xrEmulate=1&debugLab=1&debugPerf=1`

async function open(id) {
  const page = await b.newPage({ viewport: VIEW })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push(`console: ${m.text().slice(0, 160)}`)
  })
  await page.goto(url(id), { waitUntil: 'load', timeout: 60000 })
  await page.waitForFunction('typeof window.__labGesture === "function" && !!window.__labXr', null, { timeout: 60000 })
  await page.waitForFunction('!document.querySelector(\'[class*="loading"][role="status"]\')', null, { timeout: 60000 })
  await sleep(2500)
  return { page, errs }
}

async function taskIds() {
  const { page } = await open('baso4')
  const ids = await page.evaluate('window.__labTaskIds()')
  await page.close()
  return ids
}

/** Пройти все шаги опыта лучом эмуляции: тап — нажать курок на цели, жест — держать курок и вести луч. */
async function runAll(page, id) {
  const log = []
  for (let guard = 0; guard < 16; guard++) {
    const g = await page.evaluate('window.__labGesture()')
    if (!g) return { ok: true, log }
    const before = g.step
    if (g.kind === 'tap') {
      if (g.at) await page.mouse.click(g.at[0], g.at[1])
      else {
        // реактив со стеллажа — «Взять» (кнопка интерфейса работает и в VR-эмуляции)
        const take = page.getByRole('button', { name: /^Взять/ }).first()
        if (await take.count()) await take.click().catch(() => {})
      }
    } else {
      const [sx, sy] = g.at ?? g.from
      const ex = sx + (g.to[0] - g.from[0])
      const ey = sy + (g.to[1] - g.from[1])
      await page.mouse.move(sx, sy)
      await sleep(60)
      await page.mouse.down()
      for (let i = 1; i <= 26; i++) {
        await page.mouse.move(sx + ((ex - sx) * i) / 26, sy + ((ey - sy) * i) / 26)
        await sleep(30)
      }
      await page.mouse.up()
    }
    let after = before
    for (let w = 0; w < 30 && after <= before; w++) {
      await sleep(400)
      after = await page.evaluate('window.__labGesture()?.step ?? 99')
    }
    log.push(`${before}:${g.kind}${after > before ? '✓' : '✗'}`)
    if (after <= before) {
      await page.screenshot({ path: `${OUT}/${id}-stuck-${before}.png` })
      return { ok: false, log }
    }
    await sleep(900)
  }
  return { ok: true, log }
}

const ids = only.length ? only : [...ALL, ...(await taskIds())]
let bad = 0
let passed = 0
for (const id of ids) {
  const { page, errs } = await open(id)
  const st = await page.evaluate('window.__labXr.state()')
  if (!st.presenting || !st.emulated) errs.push('эмуляция VR не включилась')
  const r = await runAll(page, id)
  if (!r.ok || errs.length) bad++
  else passed++
  console.log(id, `[${st.stand}]`, r.log.join(' '), errs.length ? `ошибки: ${errs.slice(0, 2).join(' | ')}` : '')
  await page.close()
}

// VR-доска, телепорт, HUD, подсказка-спрайт, кадры
if (!only.length || process.env.BOARD === '1') {
  const { page, errs } = await open('baso4')
  const checks = []
  // fps в эмуляции 1440×900
  const fps = await page.evaluate(
    'new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(Math.round((n * 1000) / (performance.now() - t0))) }; requestAnimationFrame(f) })',
  )
  const info = await page.evaluate('window.__labPerf ? window.__labPerf.info() : null')
  console.log(`fps (эмуляция, 1440×900): ${fps}; perf: ${JSON.stringify(info)}`)
  await page.screenshot({ path: `${OUT}/xr-desk.png` })
  // подсказка-спрайт над целью первого шага
  const g = await page.evaluate('window.__labGesture()')
  if (g?.at) {
    const [x, y] = g.at
    await page.screenshot({ path: `${OUT}/xr-hint-sprite.png`, clip: { x: Math.max(0, x - 260), y: Math.max(0, y - 220), width: 520, height: 340 } })
  }
  // наручный HUD (в эмуляции — слева внизу)
  await page.screenshot({ path: `${OUT}/xr-hud.png`, clip: { x: 0, y: VIEW.height * 0.5, width: VIEW.width * 0.5, height: VIEW.height * 0.5 } })
  // телепорт к доске
  await page.evaluate('window.__labXr.teleport("board")')
  await sleep(1000)
  const stand = await page.evaluate('window.__labXr.state().stand')
  checks.push(`телепорт → board: ${stand === 'board' ? '✓' : '✗ ' + stand}`)
  await page.screenshot({ path: `${OUT}/xr-board.png` })
  // кнопки доски лучом: next, back, restart, карточка опыта
  for (const btn of ['next', 'back', 'restart', 'card:zn-hcl']) {
    const pt = await page.evaluate(`window.__labXr.boardPoint(${JSON.stringify(btn)})`)
    if (!pt) {
      checks.push(`${btn}: ✗ нет кнопки на кадре`)
      continue
    }
    const n0 = await page.evaluate('window.__labXrLog.length')
    // «курок» контроллера в точку кнопки (луч эмуляции; DOM поверх холста лучу не мешает)
    await page.evaluate(`window.__labXr.select(${pt[0]}, ${pt[1]})`)
    await sleep(300)
    const last = await page.evaluate('window.__labXrLog.slice(-1)[0] ?? null')
    const n1 = await page.evaluate('window.__labXrLog.length')
    const want = btn.startsWith('card:') ? 'select' : btn
    checks.push(`доска «${btn}»: ${n1 > n0 && last?.cmd === want ? '✓' : '✗'} ${JSON.stringify(last)}`)
  }
  // площадка телепорта лучом: смотрим с доски на пол у стола нельзя — переходим колесом (squeeze) и площадкой
  await page.mouse.move(VIEW.width / 2, VIEW.height / 2)
  await page.mouse.wheel(0, 120)
  await sleep(900)
  const afterWheel = await page.evaluate('window.__labXr.state().stand')
  checks.push(`squeeze (колесо): board → ${afterWheel} ${afterWheel === 'shelves' ? '✓' : '✗'}`)
  await page.evaluate('window.__labXr.teleport("hood")')
  await sleep(900)
  await page.screenshot({ path: `${OUT}/xr-hood.png` })
  const hoodStand = await page.evaluate('window.__labXr.state().stand')
  checks.push(`телепорт → hood: ${hoodStand === 'hood' ? '✓' : '✗'}`)
  // площадка «стол» с вытяжки: повернуть голову вправо назад и нажать на неё лучом
  await page.evaluate('window.__labXr.look(-105, -6)')
  await sleep(500)
  await page.screenshot({ path: `${OUT}/xr-teleport-pads.png` })
  const pad = await page.evaluate('window.__labXr.padPoint("desk")')
  if (pad && pad[0] > 0 && pad[0] < VIEW.width && pad[1] > 0 && pad[1] < VIEW.height) {
    await page.evaluate(`window.__labXr.select(${pad[0]}, ${pad[1]})`)
    await sleep(80)
    await page.screenshot({ path: `${OUT}/xr-teleport-fade.png` })
    await sleep(900)
    const s2 = await page.evaluate('window.__labXr.state().stand')
    checks.push(`площадка лучом → desk: ${s2 === 'desk' ? '✓' : '✗ ' + s2}`)
  } else checks.push(`площадка «стол»: ✗ вне кадра (${JSON.stringify(pad)})`)
  await page.evaluate('window.__labXr.look(0, 0)')
  console.log(checks.join('\n'))
  if (checks.some((c) => c.includes('✗')) || errs.length) bad++
  if (errs.length) console.log('ошибки:', errs.slice(0, 3).join(' | '))
  await page.close()
}

await b.close()
console.log(`\nсценариев пройдено: ${passed}/${ids.length}`)
if (bad) {
  console.error(`не прошли: ${bad}`)
  process.exit(1)
}
