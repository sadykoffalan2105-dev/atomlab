/**
 * Лист кадров 3D-моделей 200 веществ каталога (docs/plans/catalog-top200.md, §2 — «просмотр глазами»).
 *
 *  1. npx vite build --config scripts/sheet/vite.sheet.config.ts --outDir .tmp/dist-sheet
 *  2. npx vite preview --config scripts/sheet/vite.sheet.config.ts --outDir .tmp/dist-sheet --port 4641 --strictPort
 *  3. npx tsx scripts/sheet/capture-models-sheet.mts --url http://127.0.0.1:4641/models-sheet.html --out .smoke/sheet
 *
 * Снимает каждое вещество (тот же SchoolCatalogCanvas, что в карточке каталога), складывает листы по 50 кадров
 * (светлая и тёмная подложка) и крупные кадры — по одному на семейство. Chromium с --use-angle=d3d11.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium, type Page } from 'playwright'
import { familiesWithMembers } from '../../src/data/catalog/catalogFamilies'

const arg = (name: string, def: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1]! : def
}
const url = arg('url', 'http://127.0.0.1:4641/models-sheet.html')
const out = resolve(arg('out', '.smoke/sheet'))
const only = arg('only', '')
const TILE = 300
const BIG = 720
mkdirSync(join(out, 'tiles'), { recursive: true })
mkdirSync(join(out, 'families'), { recursive: true })

type Info = { formula: string; family: string; root: string; source: string; ions: string; schematic: string[] }

async function shot(page: Page, id: string, size: number, file: string): Promise<void> {
  await page.evaluate(([i, s]) => window.__sheetSet!(i as string, s as number), [id, size] as const)
  await page.waitForSelector('#tile canvas')
  // кадр R3F + подписи в шарах (DOM): два rAF и пауза на первый кадр покачивания
  await page.waitForTimeout(450)
  await page.locator('#tile').screenshot({ path: file })
}

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.error('pageerror', e.message))
await page.goto(url)
await page.waitForFunction(() => !!window.__sheetSet)
const ids = (await page.evaluate(() => [...window.__sheetIds!])).filter((id) => !only || only.split(',').includes(id))
const info: Record<string, Info> = {}
for (const id of ids) {
  info[id] = (await page.evaluate((i) => window.__sheetInfo!(i), id))!
  await shot(page, id, TILE, join(out, 'tiles', `${id}.png`))
}
const fams = familiesWithMembers()
const famFiles: { file: string; title: string; id: string }[] = []
if (!only) {
  for (const { family, ids: fIds } of fams) {
    const id = fIds[0]!
    const file = join(out, 'families', `${family.id}.png`)
    await shot(page, id, BIG, file)
    famFiles.push({ file, title: `${family.ru}${family.root ? ` · ${family.root.formula}` : ''}`, id })
  }
}

// ─── листы ───────────────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const img = (file: string) => `data:image/png;base64,${readFileSync(file).toString('base64')}`
function sheetHtml(title: string, list: string[], dark: boolean, big = false): string {
  const bg = dark ? '#0f1320' : '#f4f6fb'
  const fg = dark ? '#e8ecf6' : '#1b2233'
  const mute = dark ? '#98a2b8' : '#5b6477'
  const cards = list
    .map((id) => {
      const i = info[id]!
      const f = big ? famFiles.find((x) => x.id === id)! : null
      return `<figure><img src="${img(f ? f.file : join(out, 'tiles', `${id}.png`))}"/><figcaption><b>${esc(i.formula)}</b> <span>${esc(f ? f.title : i.family)}</span><br/><small>${esc(i.ions || '')}${i.ions ? ' · ' : ''}${esc(i.source)} · ${esc(id)}</small>${big && i.schematic.length ? `<br/><small class="s">схема: ${esc(i.schematic.join(' | '))}</small>` : ''}</figcaption></figure>`
    })
    .join('')
  const w = big ? 360 : 150
  return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:16px;background:${bg};color:${fg};font:12px system-ui,Segoe UI,sans-serif}
h1{font-size:16px;margin:0 0 12px}
main{display:grid;grid-template-columns:repeat(auto-fill,${w}px);gap:10px}
figure{margin:0;background:${dark ? '#161b2c' : '#fff'};border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.15)}
img{display:block;width:${w}px;height:${w}px}
figcaption{padding:5px 7px 7px;line-height:1.3}
figcaption span,small{color:${mute}}
small.s{color:${dark ? '#f0b86e' : '#9a5a00'}}
</style><h1>${esc(title)}</h1><main>${cards}</main>`
}
async function render(html: string, file: string, width: number): Promise<void> {
  const tmp = `${file}.html`
  writeFileSync(tmp, html)
  const p = await browser.newPage({ viewport: { width, height: 800 } })
  await p.goto(pathToFileURL(tmp).href)
  await p.screenshot({ path: file, fullPage: true })
  await p.close()
}
const sheets: string[] = []
for (let k = 0; k < ids.length; k += 50) {
  const part = ids.slice(k, k + 50)
  for (const dark of [false, true]) {
    const file = join(out, `sheet-${String(k / 50 + 1)}-${dark ? 'dark' : 'light'}.png`)
    await render(sheetHtml(`Модели каталога ${k + 1}–${k + part.length} из ${ids.length}`, part, dark), file, 1640)
    sheets.push(file)
  }
}
if (famFiles.length) {
  for (const dark of [false, true]) {
    const file = join(out, `families-${dark ? 'dark' : 'light'}.png`)
    await render(sheetHtml('Крупные кадры: по одному на семейство', famFiles.map((f) => f.id), dark, true), file, 1540)
    sheets.push(file)
  }
}
await browser.close()
console.log(sheets.join('\n'))
