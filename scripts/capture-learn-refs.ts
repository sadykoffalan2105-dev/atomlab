/**
 * Рендер PNG-постеров для всех § (public/learn/posters/). В уроке — интерактивная 3D.
 * Сам поднимает `vite preview`, если сервер не запущен.
 *
 * npm run learn:capture-refs
 */
import { chromium, type Browser } from 'playwright'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'

const PORT = process.env.CAPTURE_PORT ?? '5199'
const BASE = process.env.CAPTURE_BASE_URL ?? `http://localhost:${PORT}`
const OUT = join(process.cwd(), 'public', 'learn', 'posters')
const JSON_PATH = join(process.cwd(), 'public', 'learn', 'nano-banana-prompts.json')
const SKIP_EXISTING = process.env.CAPTURE_SKIP_EXISTING !== '0'
const ONLY = process.env.CAPTURE_ONLY?.split(',').filter(Boolean)

type Entry = { sceneId: string; title: string }

let previewProc: ChildProcess | null = null

async function waitForServer(url: string, attempts = 40): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, { redirect: 'follow' })
      if (r.status > 0 && r.status < 500) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Dev server not reachable at ${url}`)
}

async function ensurePreviewServer(): Promise<void> {
  try {
    await waitForServer(BASE, 3)
    return
  } catch {
    /* start preview */
  }
  previewProc = spawn('npm', ['run', 'preview', '--', '--port', PORT, '--strictPort'], {
    cwd: process.cwd(),
    shell: true,
    stdio: 'ignore',
  })
  await waitForServer(BASE, 80)
}

function stopPreviewServer() {
  if (previewProc && !previewProc.killed) {
    previewProc.kill()
    previewProc = null
  }
}

async function captureAll(browser: Browser, list: Entry[]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  let done = 0
  let skipped = 0
  for (const e of list) {
    const outPath = join(OUT, `${e.sceneId}.png`)
    if (SKIP_EXISTING && existsSync(outPath)) {
      skipped++
      continue
    }

    const url = `${BASE}/#/learn/ref/${e.sceneId}`
    process.stdout.write(`[${done + skipped + 1}/${list.length}] ${e.sceneId} … `)
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 })
      await page.waitForSelector('[data-ref-ready="true"]', { timeout: 60_000 })
      await page.waitForTimeout(500)
      await page.locator('[data-learn-ref-frame]').screenshot({ path: outPath, type: 'png' })
      done++
      console.log('ok')
    } catch (err) {
      console.log('FAIL')
      console.error(err)
    }
  }
  await page.close()
  return { done, skipped }
}

async function main() {
  const entries: Entry[] = JSON.parse(readFileSync(JSON_PATH, 'utf8'))
  const list = ONLY?.length ? entries.filter((e) => ONLY.includes(e.sceneId)) : entries

  mkdirSync(OUT, { recursive: true })
  await ensurePreviewServer()

  const browser = await chromium.launch({ headless: true })
  try {
    const { done, skipped } = await captureAll(browser, list)
    console.log(`\nГотово: ${done} новых, ${skipped} пропущено, всего ${list.length}`)
  } finally {
    await browser.close()
    stopPreviewServer()
  }
}

main().catch((e) => {
  stopPreviewServer()
  console.error(e)
  process.exit(1)
})
