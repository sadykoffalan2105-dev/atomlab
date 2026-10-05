/**
 * Органика v2 — проверка страницы #/organic в браузере (Playwright, Chromium --use-angle=d3d11) на собранном сайте:
 *  1) все 26 уроков × все их режимы открываются без ошибок в консоли;
 *  2) 310 ссылок учебника (equations-g10/-g11.json) → нужный урок, режим «Реакции», нужная реакция (rx из src);
 *     src (ссылка назад) переживает переключение режима;
 *  3) ссылки каталога: mode=molecule|synthesis|constructor & mol=<id> для всех 329 молекул;
 *  4) старые адреса: /learn/research?challenge=…, chapter/section, mode=view/build/isomer/name;
 *  5) --shots: кадры всех режимов на ПК и телефоне (светлая и тёмная тема) → .smoke/organic-v2-shell/.
 * Сайт: npx vite build --outDir .tmp/dist-x && npx vite preview --outDir .tmp/dist-x --port 4734 --strictPort
 * Запуск: npx tsx scripts/test-organic-v2-page.mts [порт] [--shots] [--quick]
 */
import fs from 'node:fs'
import { chromium, type Page } from 'playwright'
import { ORGANIC_CURRICULUM } from '../src/data/organicLab/organicCurriculum.ts'
import { reactionIdFromSrc } from '../src/components/organicV2/shell/organicUrl.ts'
import mols from '../src/data/organicV2/molecules.json' with { type: 'json' }
import rxFile from '../src/data/organicV2/reactions.json' with { type: 'json' }
import g10 from '../src/data/textbook/equations-g10.json' with { type: 'json' }
import g11 from '../src/data/textbook/equations-g11.json' with { type: 'json' }

const args = process.argv.slice(2)
const port = args.find((a) => /^\d+$/.test(a)) ?? '4734'
const shots = args.includes('--shots')
const quick = args.includes('--quick')
const BASE = `http://localhost:${port}/`
const OUT = '.smoke/organic-v2-shell'
const problems: string[] = []
let checks = 0
const ok = (cond: unknown, msg: string) => {
  checks++
  if (!cond) problems.push(msg)
}
const rxIds = new Set((rxFile as unknown as { reactions: { id: string }[] }).reactions.map((r) => r.id))

const browser = await chromium.launch({ args: ['--use-angle=d3d11'] })

async function openPage(width: number, height: number, theme: 'dark' | 'light' = 'dark') {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem('atomlab-theme', t)
    } catch {
      /* */
    }
  }, theme)
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`)
  })
  return { page, errors, ctx }
}

/** Переход внутри SPA (hash) без перезагрузки — 1000+ адресов за минуты. */
async function go(page: Page, href: string) {
  await page.evaluate((h) => {
    window.location.hash = h
  }, href.startsWith('/') ? href : `/${href}`)
}

async function settled(page: Page) {
  await page.waitForSelector('[data-ov2-shell]', { timeout: 30000 })
  await page.waitForFunction(() => !document.querySelector('[data-stage] [role="status"]'), null, { timeout: 30000 })
}

const { page, errors } = await openPage(1366, 860)
await page.goto(`${BASE}#/organic`, { waitUntil: 'load', timeout: 60000 })
await settled(page)

// ── 1) 26 уроков × режимы ──
let modeOpens = 0
for (const l of ORGANIC_CURRICULUM) {
  await go(page, `/organic?lesson=${l.id}`)
  await page.waitForSelector(`[data-lesson="${l.id}"][aria-current="page"]`, { timeout: 15000 })
  await settled(page)
  const tabs = await page.$$eval('[data-mode-tab]', (els) => els.map((e) => e.getAttribute('data-mode-tab')!))
  ok(tabs.includes('molecule') && tabs.includes('constructor') && tabs.includes('synthesis'), `${l.id}: вкладки ${tabs.join(',')}`)
  for (const m of tabs) {
    const before = errors.length
    await page.click(`[data-mode-tab="${m}"]`)
    await page.waitForSelector(`[data-stage="${m}"]`, { timeout: 15000 })
    await settled(page)
    const hasContent = await page.$eval(`[data-stage="${m}"]`, (el) => el.children.length > 0)
    ok(hasContent, `${l.id}/${m}: пустая сцена`)
    if (m === 'synthesis' || m === 'reactions') {
      ok(await page.$('[data-rx-current]'), `${l.id}/${m}: нет выбранной реакции`)
    }
    ok(errors.length === before, `${l.id}/${m}: ошибки ${errors.slice(before).join(' | ')}`)
    modeOpens++
  }
}
console.log('уроки × режимы:', modeOpens)

// ── 2) ссылки учебника ──
const links: string[] = []
const walk = (o: unknown) => {
  if (!o || typeof o !== 'object') return
  for (const v of Object.values(o as Record<string, unknown>)) {
    if (typeof v === 'string' && v.startsWith('/organic?')) links.push(v)
    else walk(v)
  }
}
walk(g10)
walk(g11)
ok(links.length === 310, `ссылок учебника ${links.length}, ожидалось 310`)
let exact = 0
for (const href of quick ? links.slice(0, 40) : links) {
  const p = new URL('http://x' + href).searchParams
  const lesson = p.get('lesson')!
  const want = reactionIdFromSrc(p.get('src'))
  await go(page, href)
  try {
    await page.waitForSelector(`[data-lesson="${lesson}"][aria-current="page"]`, { timeout: 10000 })
    await page.waitForSelector('[data-stage="reactions"] [data-rx-current]', { timeout: 15000 })
  } catch {
    ok(false, `учебник ${href}: не открылся урок/реакции`)
    continue
  }
  const cur = await page.getAttribute('[data-rx-current]', 'data-rx-current')
  if (want && rxIds.has(want)) {
    exact++
    ok(cur === want, `учебник ${href}: реакция ${cur}, ожидалась ${want}`)
  }
  ok(await page.$('[data-lab-back-to-book]'), `учебник ${href}: нет ссылки назад`)
}
console.log('ссылки учебника:', quick ? 40 : links.length, 'точная реакция:', exact)

// src переживает смену режима и молекулы
await go(page, links[0]!)
await page.waitForSelector('[data-stage="reactions"] [data-rx-current]')
await page.click('[data-mode-tab="molecule"]')
await page.waitForSelector('[data-stage="molecule"]')
await page.click('[data-mol]:not([aria-selected="true"])')
const hashAfter = await page.evaluate(() => decodeURIComponent(location.hash))
ok(hashAfter.includes('src=/learn/g/g10/book'), `src потерян после переключений: ${hashAfter}`)
ok(await page.$('[data-lab-back-to-book]'), 'ссылка назад пропала после переключений')

// ── 3) ссылки каталога ──
const ids = Object.keys(mols as object)
let catalog = 0
for (const id of quick ? ids.slice(0, 25) : ids) {
  for (const mode of ['molecule', 'synthesis', 'constructor'] as const) {
    await go(page, `/organic?mode=${mode}&mol=${id}`)
    try {
      await page.waitForSelector(`[data-stage="${mode}"]`, { timeout: 10000 })
      await settled(page)
      if (mode === 'molecule') await page.waitForSelector(`[data-mol="${id}"][aria-selected="true"]`, { timeout: 5000 })
      if (mode === 'synthesis') await page.waitForSelector('[data-rx-current]', { timeout: 10000 })
      if (mode === 'constructor') await page.waitForSelector(`[data-task="build:${id}"][aria-selected="true"]`, { timeout: 5000 })
      catalog++
    } catch {
      ok(false, `каталог ${mode}&mol=${id}: не открылось`)
    }
  }
}
console.log('ссылки каталога:', catalog)

// ── 4) старые адреса ──
const legacy: [string, string, string][] = [
  ['/learn/research?challenge=ethanol', 'reaction-types', 'constructor'],
  ['/learn/research?challenge=hexane', 'isomers', 'constructor'],
  ['/organic?chapter=2&section=5', 'cycloalkanes', 'molecule'],
  ['/organic?lesson=isomers&mode=isomer', 'isomers', 'isomers'],
  ['/organic?lesson=nomenclature&mode=name', 'nomenclature', 'name'],
  ['/organic?lesson=alkanes&mode=view', 'alkanes', 'molecule'],
  ['/organic?mol=iodoform', 'halo', 'molecule'],
]
for (const [href, lesson, mode] of legacy) {
  await go(page, href)
  try {
    await page.waitForSelector(`[data-lesson="${lesson}"][aria-current="page"]`, { timeout: 10000 })
    await page.waitForSelector(`[data-stage="${mode}"]`, { timeout: 10000 })
    checks++
  } catch {
    ok(false, `старый адрес ${href}: ожидалось ${lesson}/${mode}`)
  }
}
ok(errors.length === 0, `ошибки консоли: ${[...new Set(errors)].slice(0, 8).join(' | ')}`)

// ── 5) кадры ──
if (shots) {
  fs.mkdirSync(OUT, { recursive: true })
  const views: [string, number, number, 'dark' | 'light'][] = [
    ['pc', 1440, 900, 'dark'],
    ['pc-light', 1440, 900, 'light'],
    ['phone', 390, 844, 'dark'],
    ['phone-light', 390, 844, 'light'],
  ]
  for (const [tag, w, h, theme] of views) {
    const s = await openPage(w, h, theme)
    await s.page.goto(`${BASE}#/organic?lesson=isomers`, { waitUntil: 'load' })
    await settled(s.page)
    const modes = await s.page.$$eval('[data-mode-tab]', (els) => els.map((e) => e.getAttribute('data-mode-tab')!))
    for (const m of modes) {
      if (tag.endsWith('light') && !['molecule', 'reactions', 'name'].includes(m)) continue
      await s.page.click(`[data-mode-tab="${m}"]`)
      await s.page.waitForSelector(`[data-stage="${m}"]`)
      await settled(s.page)
      await s.page.waitForTimeout(400)
      await s.page.screenshot({ path: `${OUT}/${tag}-${m}.png`, fullPage: tag.startsWith('phone') })
    }
    // «Название» — урок с тестами; «Синтез» по ссылке каталога (молекула вне урока по умолчанию)
    for (const [name, href] of [
      ['name', '/organic?lesson=nomenclature&mode=name'],
      ['catalog-synthesis', '/organic?mode=synthesis&mol=aspirin'],
      ['book-link', links[1]!],
    ] as const) {
      await go(s.page, href)
      await s.page.waitForTimeout(300)
      await settled(s.page)
      await s.page.screenshot({ path: `${OUT}/${tag}-${name}.png`, fullPage: tag.startsWith('phone') })
    }
    if (tag.startsWith('phone')) {
      await s.page.click('[aria-controls="ov2-path"]')
      await s.page.waitForTimeout(400)
      await s.page.screenshot({ path: `${OUT}/${tag}-path.png` })
    }
    await s.ctx.close()
  }
  console.log('кадры:', OUT)
}

await browser.close()
console.log(`проверок ${checks}, проблем ${problems.length}`)
for (const p of problems.slice(0, 40)) console.log('  ✗', p)
process.exit(problems.length ? 1 : 0)
