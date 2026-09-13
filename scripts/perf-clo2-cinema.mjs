#!/usr/bin/env node
/**
 * Стенд производительности урока ClO₂: сцена до запуска и ключевые моменты механизма.
 *
 * Меряет в настоящем WebGL (headless Chromium): время кадра p50/p95/p99, draw calls,
 * треугольники, число шейдерных программ. В headless нет GPU — абсолютные FPS ниже
 * реальных, но сравнение «до/после» на одной машине честное: программный рендер
 * чувствителен и к числу draw calls, и к перерисовке пикселей.
 *
 * Запуск: node scripts/perf-clo2-cinema.mjs [--label=before] [--tier=normal|low] [--mobile] [--base=http://localhost:5173]
 * Результат: .smoke/perf/clo2-<label>.json
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? '1']
  }),
)
const PORT = process.env.PERF_PORT ?? '5189'
const BASE = args.base ?? `http://localhost:${PORT}`
const LABEL = args.label ?? 'run'
const MOBILE = args.mobile === '1'
const SAMPLE_MS = Number(args.sample ?? 3500)
const MOMENTS = (args.times ?? '2,9,10.4,19.5,20.6,23,28.5').split(',').map(Number)
const OUT = join(process.cwd(), '.smoke', 'perf')

let server = null
let browser = null

async function up(url, attempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url)
      if (r.status > 0 && r.status < 500) return true
    } catch {
      /* ещё поднимается */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function ensureServer() {
  if (args.base || (await up(BASE, 2))) return
  server = spawn('npm', ['run', 'preview', '--', '--port', PORT, '--strictPort'], { shell: true, stdio: 'ignore' })
  if (!(await up(BASE, 120))) throw new Error(`preview не поднялся на ${BASE}`)
}

async function sample(page, name) {
  await page.evaluate(() => window.__atomlabPerf?.reset())
  await page.waitForTimeout(SAMPLE_MS)
  const s = await page.evaluate(() => window.__atomlabPerf?.snapshot() ?? null)
  if (!s) throw new Error('perf probe недоступен: откройте с ?perf=1 или в dev')
  return { name, ...s }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  await ensureServer()
  browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const context = MOBILE
    ? await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
    : await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.addInitScript(() => {
    try {
      localStorage.setItem('atomlab-clo2-autoplay', '0')
    } catch {
      /* private mode */
    }
  })
  const tierParam = args.tier ? `&deviceTier=${args.tier}` : ''
  await page.goto(`${BASE}/#/?reactor=1&product=clo2&perf=1${tierParam}`, { waitUntil: 'load', timeout: 120_000 })
  const run = page.getByRole('button', { name: 'Проверить и запустить синтез' })
  await run.waitFor({ state: 'visible', timeout: 120_000 })
  await page.waitForFunction(() => Boolean(window.__atomlabPerf), null, { timeout: 60_000 })
  await page.waitForTimeout(2500)

  const rows = [await sample(page, 'prelaunch-stage')]
  await run.click()
  await page.waitForFunction(() => typeof window.__clo2Freeze === 'function', null, { timeout: 60_000 })
  await page.waitForTimeout(2500)
  rows.push(await sample(page, 'lesson-live-step1'))
  for (const t of MOMENTS) {
    await page.evaluate((tt) => window.__clo2Freeze(tt), t)
    // Прогрев: новые слои (орбитали, волны) компилируют шейдеры в первые кадры — их не считаем.
    await page.waitForTimeout(2500)
    rows.push(await sample(page, `t=${t}`))
  }

  const result = { label: LABEL, mobile: MOBILE, date: new Date().toISOString(), rows, errors }
  const file = join(OUT, `clo2-${LABEL}${args.tier ? `-${args.tier}` : ''}${MOBILE ? '-mobile' : ''}.json`)
  writeFileSync(file, JSON.stringify(result, null, 2))
  console.table(
    rows.map((r) => ({
      moment: r.name,
      fps: r.fps.toFixed(1),
      p50: r.frameMs.p50.toFixed(1),
      p95: r.frameMs.p95.toFixed(1),
      p99: r.frameMs.p99.toFixed(1),
      calls: r.calls,
      tris: r.triangles,
      programs: r.programs,
      dpr: r.dpr,
    })),
  )
  if (errors.length) console.log('ошибки страницы:', errors.slice(0, 5))
  console.log(`→ ${file}`)
}

main()
  .catch((e) => {
    console.error(`perf-clo2-cinema: ${e.message ?? e}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await browser?.close().catch(() => {})
    if (server && !server.killed) server.kill()
  })
