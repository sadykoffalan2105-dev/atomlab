#!/usr/bin/env node
/**
 * Живой прогон стенда InstancedAtoms в настоящем WebGL (headless SwiftShader).
 *
 * test-instanced-atoms.mts проверяет данные, а здесь — то, что без GPU не поймать:
 * шейдеры импостора и икосферы компилируются, в консоли нет ошибок WebGL,
 * все атомы (~200) идут одним draw call, кадр не пустой.
 *
 * Нужен уже запущенный дев-сервер (npm run dev). Стенд не встроен в приложение:
 * скрипт подменяет ответ на служебный URL минимальной HTML-страницей, которая
 * импортирует src/lab/cinema/react/__demo__/mountInstancedAtomsDemo.tsx.
 *
 * Запуск: node scripts/smoke-instanced-atoms.mjs
 *   SMOKE_BASE_URL (по умолчанию http://localhost:5173), SMOKE_OUT — папка скриншотов.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:5173'
const OUT = process.env.SMOKE_OUT ?? join(tmpdir(), 'atomlab-smoke-instanced-atoms')
const DEMO_PATH = '/__instanced-atoms-demo'
const FRAMES = 20

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>InstancedAtoms demo</title>
<style>html,body{margin:0;height:100%;background:#02030a}</style></head>
<body><script type="module">
  import RefreshRuntime from '/@react-refresh'
  RefreshRuntime.injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true
  const q = new URLSearchParams(location.search)
  const m = await import('/src/lab/cinema/react/__demo__/mountInstancedAtomsDemo.tsx')
  m.mountInstancedAtomsDemo(document.body, q.get('mode') || 'impostor', q.has('t') ? Number(q.get('t')) : undefined)
</script></body></html>`

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
let failed = false
try {
  for (const mode of ['impostor', 'mesh']) {
    const page = await browser.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1.5 })
    const errors = []
    page.on('console', (msg) => {
      const text = msg.text()
      // HMR-сокет Vite в headless блокируется политикой локальной сети — к стенду не относится.
      if (/\[vite\]|WebSocket/.test(text)) return
      if (msg.type() === 'error' || /Shader Error|WebGLProgram|GL_INVALID/i.test(text)) errors.push(text)
    })
    page.on('pageerror', (err) => errors.push(String(err)))
    await page.route(`${BASE}${DEMO_PATH}*`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }),
    )
    // Модульный граф стенда дев-сервер собирает на лету — load ждать не нужно.
    await page.goto(`${BASE}${DEMO_PATH}?mode=${mode}&t=1.3`, { waitUntil: 'commit' })
    await page.waitForFunction((n) => (window.__instancedAtomsDemo?.frame ?? 0) > n, FRAMES, { timeout: 180_000 })
    const info = await page.evaluate(() => ({ ...window.__instancedAtomsDemo }))
    const file = join(OUT, `instanced-atoms-${mode}.png`)
    await page.screenshot({ path: file })
    // Крупный план ClO₂: силуэты, пересечения сфер, связь-цилиндр.
    await page.screenshot({ path: join(OUT, `instanced-atoms-${mode}-closeup.png`), clip: { x: 300, y: 150, width: 360, height: 260 } })
    const ok = errors.length === 0 && info.calls > 0 && info.calls <= 4
    failed ||= !ok
    console.log(
      `${ok ? '✓' : '✗'} ${mode}: draw calls ${info.calls}, triangles ${info.triangles}, programs ${info.programs} → ${file}`,
    )
    for (const e of errors.slice(0, 5)) console.log(`    ${e.slice(0, 400)}`)
    await page.close()
  }
} finally {
  await browser.close()
}
process.exit(failed ? 1 : 0)
