#!/usr/bin/env node
/**
 * Живой прогон кинематографической сцены ClO₂ в настоящем WebGL.
 *
 * Данные раскадровки проверяет test-clo2-cinema.mts, а здесь проверяется то,
 * что тестом на данных не поймать: шейдеры компилируются, three.quarks стартует,
 * контекст WebGL не теряется, кадр не остаётся чёрным и картинка реально меняется
 * от фазы к фазе. Кадры кладутся в .smoke/clo2 — их можно посмотреть глазами.
 *
 * Запуск: node scripts/smoke-clo2-cinema.mjs
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PORT = process.env.SMOKE_PORT ?? '5188'
const BASE = process.env.SMOKE_BASE_URL ?? `http://localhost:${PORT}`
const OUT = join(process.cwd(), '.smoke', 'clo2')
const RUN_BUTTON = 'Проверить и запустить синтез'
/** Экранная длительность раскадровки + запас на разгон WebGL. */
const SCENE_MS = 16_000
const FRAME_STEP_MS = 500
/** Область кадра, где идёт реакция — крупный план для разбора глазами. */
const ACTION_CLIP = { x: 360, y: 250, width: 720, height: 410 }

let preview = null
let browser = null

async function waitForServer(url, attempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, { redirect: 'follow' })
      if (r.status > 0 && r.status < 500) return true
    } catch {
      /* сервер ещё поднимается */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function ensurePreview() {
  if (await waitForServer(BASE, 2)) return
  preview = spawn('npm', ['run', 'preview', '--', '--port', PORT, '--strictPort'], {
    cwd: process.cwd(),
    shell: true,
    stdio: 'ignore',
  })
  if (!(await waitForServer(BASE, 80))) throw new Error(`preview не поднялся на ${BASE}`)
}

function stopPreview() {
  if (preview && !preview.killed) {
    preview.kill()
    preview = null
  }
}

async function main() {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  await ensurePreview()

  browser = await chromium.launch({
    headless: true,
    // Программный WebGL: у headless-агента нет GPU, но шейдеры компилируются те же.
    args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  await page.addInitScript(() => {
    window.__contextLost = 0
    window.addEventListener(
      'webglcontextlost',
      () => {
        window.__contextLost += 1
      },
      true,
    )
  })

  console.log('→', `${BASE}/#/?reactor=1&product=clo2`)
  await page.goto(`${BASE}/#/?reactor=1&product=clo2`, { waitUntil: 'load', timeout: 90_000 })
  await page.waitForSelector('[data-reactor-open="true"]', { timeout: 60_000 })
  await page.waitForSelector('[data-lab-reactor][data-open="true"]', { timeout: 60_000 })

  const run = page.getByRole('button', { name: RUN_BUTTON })
  await run.waitFor({ state: 'visible', timeout: 60_000 })
  await page.waitForTimeout(1200)

  // Опорный кадр до запуска: с ним сравниваются кадры сцены, иначе «сцена идёт»
  // можно спутать с «реактор просто стоит на экране».
  writeFileSync(join(OUT, 'page-before-run.png'), await page.screenshot({ type: 'png' }))
  const before = await page.screenshot({ type: 'png', clip: ACTION_CLIP })
  writeFileSync(join(OUT, 'frame-before-run.png'), before)
  const baseline = createHash('sha1').update(before).digest('hex')

  await run.click()
  console.log('синтез запущен, снимаю кадры…')

  const frames = []
  const phases = new Set()
  const started = Date.now()

  // Снимается область реакции, а не элемент canvas: лаборатория подменяет канвас
  // между видом реактора и видом вещества, и локатор бы отвалился. Кроп заодно
  // делает проверку «картинка меняется» честной — интерфейс в неё не попадает.
  while (Date.now() - started < SCENE_MS) {
    const t = Date.now() - started
    const shot = await page.screenshot({ type: 'png', clip: ACTION_CLIP })
    const name = `frame-${String(t).padStart(5, '0')}ms.png`
    writeFileSync(join(OUT, name), shot)
    frames.push({ name, t, hash: createHash('sha1').update(shot).digest('hex') })
    const phase = await page.getAttribute('[data-synth-phase]', 'data-synth-phase').catch(() => null)
    if (phase) phases.add(phase)
    await page.waitForTimeout(FRAME_STEP_MS)
  }

  writeFileSync(join(OUT, 'page-after-run.png'), await page.screenshot({ type: 'png' }))
  const contextLost = await page.evaluate(() => window.__contextLost ?? 0)
  const unique = new Set(frames.map((f) => f.hash)).size

  console.log(`\nкадров: ${frames.length}, уникальных: ${unique}`)
  console.log(`фазы синтеза: ${[...phases].join(', ') || '—'}`)
  console.log(`потерь контекста WebGL: ${contextLost}`)

  const problems = []
  if (pageErrors.length) problems.push(`ошибки страницы:\n  ${pageErrors.join('\n  ')}`)
  if (consoleErrors.length) problems.push(`ошибки консоли:\n  ${consoleErrors.join('\n  ')}`)
  if (contextLost > 0) problems.push(`WebGL context lost ×${contextLost}`)
  if (unique < Math.ceil(frames.length * 0.6)) problems.push(`сцена почти не меняется: ${unique}/${frames.length}`)
  if (baseline && frames.some((f) => f.hash === baseline)) {
    problems.push('кадр совпал с реактором до запуска — сцена не отрисовалась')
  }
  if (!phases.size) problems.push('лаборатория не сообщила ни одной фазы синтеза')

  if (problems.length) throw new Error(`FAIL\n${problems.join('\n')}`)
  console.log(`\nsmoke-clo2-cinema: pass · кадры в ${OUT}`)
}

main()
  .catch((e) => {
    console.error(`smoke-clo2-cinema: ${e.message ?? e}`)
    process.exitCode = 1
  })
  .finally(async () => {
    // Браузер закрываем всегда: упавший прогон не должен оставлять headless-процесс.
    await browser?.close().catch(() => {})
    stopPreview()
  })
