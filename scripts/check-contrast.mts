/**
 * Контраст текста (WCAG 2.x) на ключевых экранах ATOMLAB — в светлой и тёмной теме.
 *
 *   npm run build && npx vite preview --port 4831 --strictPort
 *   npx tsx scripts/check-contrast.mts 4831                       — все экраны, обе темы
 *   npx tsx scripts/check-contrast.mts 4831 live-session catalog-rx-g7 --theme=light
 *   SHOTS=.smoke/contrast npx tsx scripts/check-contrast.mts 4831  — кадр каждого экрана
 *   JSON=.smoke/contrast/report.json …                             — полный отчёт
 *
 * Как считается:
 *  • цвет текста — getComputedStyle (color или -webkit-text-fill-color) с прозрачностью самого цвета и
 *    opacity всех предков; любые форматы (oklch, color-mix…) приводятся к sRGB через 2D-холст;
 *  • фон под текстом — пиксели кадра, снятого с «невидимым» текстом (color: transparent): так учитываются
 *    градиенты, полупрозрачные «пелены», картинки и 3D-холсты, которые getComputedStyle не видит;
 *  • в прямоугольнике текста берётся сетка точек; вердикт — по 25-му процентилю контраста (не по лучшей точке);
 *  • порог 4,5 : 1 для обычного текста, 3 : 1 для крупного (≥ 24 px или ≥ 18,66 px жирный) и плейсхолдеров;
 *  • пропускаются: невидимое (opacity < 0,1, вне экрана, перекрыто модальным слоем), отключённые элементы,
 *    aria-hidden-декор и текст-градиент (background-clip: text).
 * Код выхода 1 — есть нарушения.
 */
import { chromium, type Page } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

type Theme = 'light' | 'dark'
interface Step {
  readonly click?: string
  readonly wait?: number
  readonly scroll?: number
}
interface Screen {
  readonly id: string
  readonly hash: string
  readonly steps?: readonly Step[]
  /** Сколько раз дополнительно прокрутить главный скроллер на экран вниз и проверить снова. */
  readonly scrolls?: number
}

const SECTION = '#/learn/g/g7/c/c1/s/s01'
const SCREENS: readonly Screen[] = [
  { id: 'home', hash: '#/' },
  { id: 'learn', hash: '#/learn', scrolls: 1 },
  { id: 'learn-g7', hash: '#/learn/g/g7', scrolls: 1 },
  { id: 'chapter', hash: '#/learn/g/g7/c/c1', scrolls: 1 },
  { id: 'lesson-picker', hash: SECTION },
  { id: 'lesson', hash: SECTION, steps: [{ click: '^Урок 3D' }] },
  { id: 'board', hash: SECTION, steps: [{ click: '^Интерактивная доска' }] },
  { id: 'chat', hash: SECTION, steps: [{ click: '^ИИ-учитель Диалог' }] },
  { id: 'live-lobby', hash: SECTION, steps: [{ click: '^ИИ-учитель Диалог' }, { click: '^Начать онлайн-диалог' }], scrolls: 1 },
  {
    id: 'live-session',
    hash: SECTION,
    steps: [{ click: '^ИИ-учитель Диалог' }, { click: '^Начать онлайн-диалог' }, { click: '^Начать урок' }, { wait: 2500 }],
  },
  {
    id: 'live-session-text',
    hash: SECTION,
    steps: [
      { click: '^ИИ-учитель Диалог' },
      { click: '^Начать онлайн-диалог' },
      { click: '^Без микрофона' },
      { wait: 1500 },
    ],
  },
  { id: 'teacher-hub', hash: '#/learn/teacher', scrolls: 1 },
  { id: 'talk', hash: '#/learn/talk' },
  { id: 'catalog', hash: '#/catalog', scrolls: 1 },
  { id: 'catalog-rx-g7', hash: '#/catalog?view=reactions&grade=g7', scrolls: 2 },
  { id: 'catalog-rx-g9', hash: '#/catalog?view=reactions&grade=g9', scrolls: 1 },
]

/** Код страницы — строкой (tsx/esbuild вставляет в функции служебные __name, которых в браузере нет). */
const BROWSER = String.raw`
(() => {
  if (window.__cc) return
  const cv = document.createElement('canvas')
  cv.width = cv.height = 1
  const cx = cv.getContext('2d', { willReadFrequently: true })
  const rgba = (str) => {
    cx.clearRect(0, 0, 1, 1)
    cx.fillStyle = 'rgba(0,0,0,0)'
    cx.fillStyle = str
    cx.fillRect(0, 0, 1, 1)
    const d = cx.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2], d[3] / 255]
  }
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
  const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  const ratio = (a, b) => { const x = Math.max(a, b), y = Math.min(a, b); return (x + 0.05) / (y + 0.05) }
  const short = (el) => {
    const parts = []
    for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) {
      const cls = [...e.classList].map((c) => c.replace(/^_?([A-Za-z0-9-]+?)_[a-z0-9]{5}_\d+$/, '$1')).slice(0, 2).join('.')
      parts.unshift(e.tagName.toLowerCase() + (cls ? '.' + cls : ''))
    }
    return parts.join(' > ')
  }
  let seq = 0
  const HIDE_ID = '__cc_hide'
  window.__cc = {
    freeze() {
      for (const a of document.getAnimations()) { try { a.pause() } catch {} }
    },
    hideText(on) {
      let st = document.getElementById(HIDE_ID)
      if (on && !st) {
        st = document.createElement('style')
        st.id = HIDE_ID
        st.textContent = '*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important;text-decoration-color:transparent!important;transition:none!important}::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important}'
        document.head.appendChild(st)
      } else if (!on && st) st.remove()
    },
    scroller() {
      const se = document.scrollingElement
      if (se && se.scrollHeight > se.clientHeight + 60) return se
      let best = null, bestH = 0
      for (const el of document.querySelectorAll('*')) {
        if (el.clientHeight < 200) continue
        const oy = getComputedStyle(el).overflowY
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 60) {
          const r = el.getBoundingClientRect()
          const area = r.width * r.height
          if (area > bestH) { bestH = area; best = el }
        }
      }
      return best
    },
    scrollBy(f) {
      const s = this.scroller()
      if (!s) return false
      const before = s.scrollTop
      s.scrollTop = before + s.clientHeight * f
      return s.scrollTop !== before
    },
    collect() {
      const vw = innerWidth, vh = innerHeight
      const items = []
      const push = (el, rect, color, kind, text) => {
        const cs = getComputedStyle(el)
        let op = 1
        for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity
        if (op < 0.1) return
        const c = rgba(color)
        const a = c[3] * op
        if (a < 0.05) return
        const px = parseFloat(cs.fontSize) || 16
        const w = parseInt(cs.fontWeight, 10) || 400
        const large = px >= 24 || (px >= 18.66 && w >= 700)
        if (!el.dataset.ccId) el.dataset.ccId = String(++seq)
        items.push({
          id: el.dataset.ccId, kind, text: text.replace(/\s+/g, ' ').trim().slice(0, 60), path: short(el),
          color: [c[0], c[1], c[2], a], need: large || kind === 'placeholder' ? 3 : 4.5,
          rect: [Math.max(0, rect.left), Math.max(0, rect.top), Math.min(vw, rect.right), Math.min(vh, rect.bottom)],
          px, w,
        })
      }
      const visibleAt = (el, r) => {
        const x = r.left + r.width / 2, y = r.top + r.height / 2
        if (x < 0 || y < 0 || x >= vw || y >= vh) return false
        // элементы с pointer-events: none «прозрачны» для elementFromPoint — сверяемся с ближайшим «кликабельным» предком
        let probe = el
        while (probe && getComputedStyle(probe).pointerEvents === 'none') probe = probe.parentElement
        if (!probe) return true
        const hit = document.elementFromPoint(x, y)
        return !!hit && (hit === probe || probe.contains(hit) || hit.contains(probe))
      }
      const skip = (el) => !!el.closest('script,style,noscript,template,[aria-hidden="true"],[hidden],button:disabled,input:disabled,textarea:disabled,select:disabled,fieldset:disabled,[aria-disabled="true"]')
      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      const seen = new Set()
      const range = document.createRange()
      let n
      while ((n = tw.nextNode())) {
        if (!n.nodeValue || !n.nodeValue.trim()) continue
        const el = n.parentElement
        if (!el || seen.has(el)) continue
        seen.add(el)
        if (el.closest('svg') || skip(el)) continue
        const cs = getComputedStyle(el)
        if (cs.visibility !== 'visible' || cs.display === 'none') continue
        // «только для читалок экрана»: обрезано clip/clip-path до точки
        const box = el.getBoundingClientRect()
        if (box.width <= 2 || box.height <= 2 || (cs.clip && cs.clip !== 'auto') || /inset\(50%/.test(cs.clipPath)) continue
        range.selectNodeContents(n)
        const rects = [...range.getClientRects()].filter((r) => r.width > 2 && r.height > 4 && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw)
        if (!rects.length) continue
        const r = rects[0]
        if (!visibleAt(el, r)) continue
        const clipText = (cs.backgroundClip || cs.webkitBackgroundClip || '').includes('text') || (cs.webkitBackgroundClip || '').includes('text')
        const fill = cs.webkitTextFillColor
        const fillA = fill ? rgba(fill)[3] : 1
        if (clipText && fillA < 0.05) continue
        const color = fill && fillA > 0 && fill !== cs.color ? fill : cs.color
        push(el, r, color, 'text', n.nodeValue)
      }
      for (const el of document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]),textarea')) {
        if (skip(el)) continue
        const r = el.getBoundingClientRect()
        if (r.width < 4 || r.height < 4 || !visibleAt(el, r)) continue
        const cs = getComputedStyle(el)
        if (cs.visibility !== 'visible') continue
        const pad = parseFloat(cs.paddingLeft) || 0
        const lh = Math.min(r.height, (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3))
        const top = el.tagName === 'TEXTAREA' ? r.top + (parseFloat(cs.paddingTop) || 0) : r.top + (r.height - lh) / 2
        const box = { left: r.left + pad, top, right: Math.min(r.right - pad, r.left + pad + 260), bottom: top + lh }
        if (el.value) push(el, box, cs.color, 'value', el.value)
        else if (el.placeholder) push(el, box, getComputedStyle(el, '::placeholder').color, 'placeholder', el.placeholder)
      }
      return items
    },
    /** «Пелены» светлой темы: крупный блок с тёмной полупрозрачной заливкой (ночная подложка на белом = серое пятно). */
    veils() {
      if (document.documentElement.dataset.appTheme !== 'light') return []
      const vw = innerWidth, vh = innerHeight
      const out = []
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('[data-app-night],canvas,svg,video')) continue
        const cs = getComputedStyle(el)
        if (cs.visibility !== 'visible') continue
        const r = el.getBoundingClientRect()
        if (r.width < 120 || r.height < 36 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue
        if (cs.position === 'fixed' && r.width >= vw * 0.95 && r.height >= vh * 0.95) continue
        const tones = []
        const bc = rgba(cs.backgroundColor)
        if (bc[3] > 0.12) tones.push(bc)
        for (const m of (cs.backgroundImage || '').matchAll(/rgba?\([^)]*\)/g)) tones.push(rgba(m[0]))
        const dark = tones.filter((c) => c[3] >= 0.12 && c[3] <= 0.94 && lum(c[0], c[1], c[2]) < 0.03)
        if (!dark.length) continue
        if (el.parentElement && el.parentElement.closest('[data-cc-veil]')) continue
        // тёмная плашка на тёмном же острове (3D-вьюпорт, видео) — так задумано, это не пелена
        let darkCtx = false
        for (let a = el.parentElement, k = 0; a && a !== document.body && !darkCtx; a = a.parentElement, k++) {
          const c = rgba(getComputedStyle(a).backgroundColor)
          if (c[3] >= 0.5 && lum(c[0], c[1], c[2]) < 0.03) darkCtx = true
          if (k < 3 && a.querySelector(':scope > canvas, :scope > div > canvas, :scope > video')) darkCtx = true
        }
        if (darkCtx) continue
        el.dataset.ccVeil = '1'
        const top = dark.sort((a, b) => b[3] - a[3])[0]
        out.push({ path: short(el), tone: 'rgba(' + top.join(',') + ')', size: Math.round(r.width) + '×' + Math.round(r.height) })
      }
      return out
    },
    async measure(items, png) {
      const blob = await (await fetch('data:image/png;base64,' + png)).blob()
      const bmp = await createImageBitmap(blob)
      const oc = new OffscreenCanvas(bmp.width, bmp.height)
      const ox = oc.getContext('2d', { willReadFrequently: true })
      ox.drawImage(bmp, 0, 0)
      const sx = bmp.width / innerWidth, sy = bmp.height / innerHeight
      const res = []
      for (const it of items) {
        const [x0, y0, x1, y1] = it.rect
        const w = x1 - x0, h = y1 - y0
        if (w < 1 || h < 1) continue
        const nx = Math.max(2, Math.min(14, Math.round(w / 10))), ny = Math.max(2, Math.min(4, Math.round(h / 6)))
        const ratios = []
        let bgSum = [0, 0, 0]
        const [tr, tg, tb, ta] = it.color
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
          const px = Math.min(bmp.width - 1, Math.floor((x0 + (i + 0.5) * w / nx) * sx))
          const py = Math.min(bmp.height - 1, Math.floor((y0 + (j + 0.5) * h / ny) * sy))
          const d = ox.getImageData(px, py, 1, 1).data
          const fr = ta * tr + (1 - ta) * d[0], fg = ta * tg + (1 - ta) * d[1], fb = ta * tb + (1 - ta) * d[2]
          ratios.push(ratio(lum(fr, fg, fb), lum(d[0], d[1], d[2])))
          bgSum[0] += d[0]; bgSum[1] += d[1]; bgSum[2] += d[2]
        }
        ratios.sort((a, b) => a - b)
        const k = ratios.length
        const p25 = ratios[Math.floor((k - 1) * 0.25)]
        const bg = bgSum.map((v) => Math.round(v / k))
        res.push({ ...it, ratio: Math.round(p25 * 100) / 100, min: Math.round(ratios[0] * 100) / 100, bg })
      }
      return res
    },
  }
})()
`

const args = process.argv.slice(2)
const port = args.find((a) => /^\d+$/.test(a))
if (!port) {
  console.error('npx tsx scripts/check-contrast.mts <port> [screen…] [--theme=light|dark]')
  process.exit(2)
}
const themeArg = args.find((a) => a.startsWith('--theme='))?.slice(8) as Theme | undefined
const themes: Theme[] = themeArg ? [themeArg] : ['light', 'dark']
const only = args.filter((a) => !a.startsWith('--') && a !== port)
const screens = only.length ? SCREENS.filter((s) => only.includes(s.id)) : SCREENS
const SHOTS = process.env.SHOTS
const JSON_OUT = process.env.JSON
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true })

interface Hit {
  id: string
  kind: string
  text: string
  path: string
  color: number[]
  bg: number[]
  need: number
  ratio: number
  min: number
  px: number
  w: number
}

interface Veil {
  path: string
  tone: string
  size: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const hex = (c: readonly number[]) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

/** Ждём, пока число видимых текстов перестанет расти (ленивые чанки, заставки, данные учебника). */
async function waitStable(page: Page, maxMs = 20000): Promise<void> {
  const count = `(() => { let k = 0; const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = tw.nextNode())) { if (!n.nodeValue.trim()) continue; const r = n.parentElement.getBoundingClientRect();
      if (r.width > 1 && r.bottom > 0 && r.top < innerHeight) k++ } return k })()`
  let prev = -1
  let same = 0
  const t0 = Date.now()
  while (Date.now() - t0 < maxMs) {
    const k = (await page.evaluate(count)) as number
    if (k === prev && k > 4) {
      if (++same >= 3) return
    } else same = 0
    prev = k
    await sleep(500)
  }
}

async function runSteps(page: Page, steps: readonly Step[]): Promise<void> {
  for (const s of steps) {
    if (s.click) {
      const btn = page.getByRole('button', { name: new RegExp(s.click) }).first()
      await btn.waitFor({ state: 'visible', timeout: 20000 })
      await btn.click()
      await sleep(1200)
      await waitStable(page, 8000)
    }
    if (s.wait) await sleep(s.wait)
  }
}

async function measureView(page: Page): Promise<Hit[]> {
  await page.evaluate('window.__cc.freeze()')
  const items = await page.evaluate('window.__cc.collect()')
  await page.evaluate('window.__cc.hideText(true)')
  await page.evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))')
  const png = (await page.screenshot({ animations: 'disabled' })).toString('base64')
  await page.evaluate('window.__cc.hideText(false)')
  return (await page.evaluate(`window.__cc.measure(${JSON.stringify(items)}, ${JSON.stringify(png)})`)) as Hit[]
}

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
const report: Record<string, { checked: number; bad: Hit[]; veils: Veil[] }> = {}
let totalBad = 0
const perTheme: Record<Theme, { checked: number; bad: number; veils: number }> = {
  light: { checked: 0, bad: 0, veils: 0 },
  dark: { checked: 0, bad: 0, veils: 0 },
}

for (const theme of themes) {
  for (const sc of screens) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme, locale: 'ru-RU' })
    await ctx.addInitScript(`try { localStorage.setItem('atomlab-theme', '${theme}'); localStorage.setItem('atomlab.locale', 'ru') } catch {}`)
    const page = await ctx.newPage()
    const key = `${sc.id} [${theme}]`
    try {
      await page.goto(`http://localhost:${port}/${sc.hash}`, { waitUntil: 'load', timeout: 60000 })
      await sleep(1000)
      await waitStable(page)
      await runSteps(page, sc.steps ?? [])
      await sleep(800)
      await page.evaluate(BROWSER)
      const byId = new Map<string, Hit>()
      const veils = new Map<string, Veil>()
      for (let pass = 0; pass <= (sc.scrolls ?? 0); pass++) {
        if (pass > 0) {
          const moved = await page.evaluate('window.__cc.scrollBy(0.85)')
          if (!moved) break
          await sleep(900)
        }
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${sc.id}-${theme}${pass ? `-${pass}` : ''}.png`) })
        for (const v of (await page.evaluate('window.__cc.veils()')) as Veil[]) veils.set(v.path, v)
        for (const h of await measureView(page)) {
          const prev = byId.get(h.id)
          if (!prev || h.ratio < prev.ratio) byId.set(h.id, h)
        }
      }
      const all = [...byId.values()]
      const bad = all.filter((h) => h.ratio < h.need).sort((a, b) => a.ratio / a.need - b.ratio / b.need)
      const veilList = [...veils.values()]
      report[key] = { checked: all.length, bad, veils: veilList }
      perTheme[theme].checked += all.length
      perTheme[theme].bad += bad.length
      perTheme[theme].veils += veilList.length
      totalBad += bad.length + veilList.length
      console.log(
        `${bad.length || veilList.length ? '✗' : '✓'} ${key}: проверено ${all.length}, нарушений ${bad.length}${veilList.length ? `, пелен ${veilList.length}` : ''}`,
      )
      for (const v of veilList.slice(0, 6)) console.log(`    пелена ${v.tone} ${v.size}  ${v.path}`)
      for (const h of bad.slice(0, Number(process.env.LIMIT ?? 12))) {
        console.log(
          `    ${h.ratio.toFixed(2)} < ${h.need}  «${h.text}»  ${hex(h.color)}${h.color[3] < 0.99 ? `/${h.color[3].toFixed(2)}` : ''} на ${hex(h.bg)}  ${h.px}px/${h.w}  ${h.kind === 'text' ? '' : `[${h.kind}] `}${h.path}`,
        )
      }
      if (bad.length > Number(process.env.LIMIT ?? 12)) console.log(`    … ещё ${bad.length - Number(process.env.LIMIT ?? 12)}`)
    } catch (e) {
      totalBad += 1
      console.log(`! ${key}: ошибка — ${(e as Error).message.split('\n')[0]}`)
    }
    await ctx.close()
  }
}
await browser.close()

console.log('\nИтого:')
for (const t of themes) {
  console.log(`  ${t}: проверено текстов ${perTheme[t].checked}, нарушений контраста ${perTheme[t].bad}, пелен ${perTheme[t].veils}`)
}
if (JSON_OUT) {
  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true })
  fs.writeFileSync(JSON_OUT, JSON.stringify({ perTheme, report }, null, 1))
}
process.exit(totalBad ? 1 : 0)
