/**
 * Органика v2 — проверка страницы #/organic в браузере (Playwright, Chromium --use-angle=d3d11) на собранном сайте:
 *  1) все 26 уроков × все их режимы открываются без ошибок в консоли;
 *  2) 310 ссылок учебника (equations-g10/-g11.json) → нужный урок, режим «Реакции», нужная реакция (rx из src);
 *     src (ссылка назад) переживает переключение режима;
 *  3) ссылки каталога: mode=molecule|synthesis|constructor & mol=<id> для всех 329 молекул;
 *  4) старые адреса: /learn/research?challenge=…, chapter/section, mode=view/build/isomer/name;
 *  5) --shots: кадры всех режимов на ПК и телефоне (светлая и тёмная тема) → .smoke/organic-v2-shell/;
 *  6) Конструктор в странице: мышью (ПК) и касанием (телефон) собрать 2,2-диметилбутан (задание урока «Изомерия»),
 *     этанол, уксусную кислоту, бензол (кольцо из палитры), цис-бут-2-ен; все изомеры C₅H₁₂; 3D — общий Molecule3D;
 *  7) прогресс: два урока проходятся целиком (Изомеры — все карточки, Синтез/Реакции — по onDone проигрывателя);
 *  8) EN и UZ: все режимы без русских строк и пустых подписей. Кадры 6–8 (--shots) → .smoke/organic-v2-qa-shell/.
 * --only-new — только 6–8 (быстро).
 * Сайт: npx vite build --outDir .tmp/dist-x && npx vite preview --outDir .tmp/dist-x --port 4734 --strictPort
 * Запуск: npx tsx scripts/test-organic-v2-page.mts [порт] [--shots] [--quick]
 */
import fs from 'node:fs'
import { chromium, type Page } from 'playwright'
import { CT, GROUP_TITLE } from '../src/components/organicV2/constructor/i18n.ts'
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
const onlyNew = args.includes('--only-new')
const QA = '.smoke/organic-v2-qa-shell'
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

async function openPage(width: number, height: number, theme: 'dark' | 'light' = 'dark', touch = false, lang: 'ru' | 'en' | 'uz' = 'ru') {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch })
  await ctx.addInitScript(([t, l]) => {
    try {
      localStorage.setItem('atomlab-theme', t)
      localStorage.setItem('atomlab.locale', l)
    } catch {
      /* */
    }
  }, [theme, lang] as const)
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
for (const l of onlyNew ? [] : ORGANIC_CURRICULUM) {
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
for (const href of onlyNew ? [] : quick ? links.slice(0, 40) : links) {
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
for (const id of onlyNew ? [] : quick ? ids.slice(0, 25) : ids) {
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
for (const [href, lesson, mode] of onlyNew ? [] : legacy) {
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

// ── 6) Конструктор в реальной странице: мышью/касанием собрать молекулы, найти все изомеры C₅H₁₂ ──
type Pt = { x: number; y: number }
const CTOR = '[data-ov2-constructor]'
async function atomIds(p: Page): Promise<number[]> {
  return p.$$eval(`${CTOR} [data-atom]`, (els) => els.map((e) => Number(e.getAttribute('data-atom'))))
}
async function atomAt(p: Page, id: number): Promise<Pt> {
  const b = (await p.locator(`${CTOR} [data-atom="${id}"] > rect`).first().boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
/** касание (мышь или палец) */
async function tap(p: Page, pt: Pt, touch: boolean) {
  if (touch) await p.touchscreen.tap(pt.x, pt.y)
  else await p.mouse.click(pt.x, pt.y)
  await p.waitForTimeout(60)
}
async function newAtom(p: Page, before: number[]): Promise<number> {
  const after = await atomIds(p)
  return after.find((x) => !before.includes(x)) ?? -1
}
/** касание пустого места холста (доля ширины/высоты) → новый C */
async function tapEmpty(p: Page, fx: number, fy: number, touch: boolean): Promise<number> {
  const b = (await p.locator(`${CTOR} svg[data-tool]`).boundingBox())!
  const before = await atomIds(p)
  await tap(p, { x: b.x + b.width * fx, y: b.y + b.height * fy }, touch)
  return newAtom(p, before)
}
/** касание атома → цепь растёт зигзагом */
async function grow(p: Page, id: number, touch: boolean): Promise<number> {
  const before = await atomIds(p)
  await tap(p, await atomAt(p, id), touch)
  return newAtom(p, before)
}
/** протянуть связь от атома под углом (градусы, экранные: 0 — вправо, 90 — вниз) */
async function drag(p: Page, id: number, deg: number): Promise<number> {
  const a = await atomAt(p, id)
  const ids = await atomIds(p)
  // длина связи на экране: по любой соседней паре, иначе 60 px
  let L = 60
  if (ids.length > 1) {
    const q = await atomAt(p, ids.find((x) => x !== id)!)
    L = Math.max(40, Math.min(90, Math.hypot(q.x - a.x, q.y - a.y)))
  }
  const r = (deg * Math.PI) / 180
  await p.mouse.move(a.x, a.y)
  await p.mouse.down()
  for (let k = 1; k <= 6; k++) await p.mouse.move(a.x + (Math.cos(r) * L * k) / 6, a.y + (Math.sin(r) * L * k) / 6)
  await p.mouse.up()
  await p.waitForTimeout(60)
  return newAtom(p, ids)
}
async function tapBond(p: Page, a: number, b: number, touch: boolean) {
  const A = await atomAt(p, a), B = await atomAt(p, b)
  await tap(p, { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }, touch)
}
async function pickTool(p: Page, label: string) {
  await p.click(`${CTOR} button[aria-label="${label}"]`)
}
async function nameNow(p: Page): Promise<string> {
  await p.waitForTimeout(250)
  return p.$eval(`${CTOR} [data-name]`, (e) => e.getAttribute('data-name') ?? '')
}
async function openCtor(p: Page, lesson: string, task: string, lang: 'ru' | 'en' | 'uz' = 'ru') {
  await go(p, `/organic?lesson=${lesson}&mode=constructor&task=${encodeURIComponent(task)}${lang === 'ru' ? '' : ''}`)
  await p.waitForSelector(`${CTOR}[data-task]`, { timeout: 20000 })
  await p.waitForSelector(`[data-task="${task}"][aria-selected="true"]`, { timeout: 10000 })
}
/** 3D собранного — общий Molecule3D (а не самодельный canvas) */
async function has3d(p: Page, kind: 'exact' | 'approx'): Promise<boolean> {
  try {
    await p.waitForSelector(`${CTOR} [data-ctor-3d="${kind}"] [data-ov2-mol3d] canvas`, { timeout: 15000 })
    return true
  } catch {
    return false
  }
}

const CT_RU = CT.ru
async function ctorSuite(touch: boolean, tag: string, w: number, h: number) {
  const s = await openPage(w, h, 'dark', touch)
  const p = s.page
  await p.goto(`${BASE}#/organic`, { waitUntil: 'load', timeout: 60000 })
  await settled(p)
  const shot = async (name: string) => {
    if (shots) {
      fs.mkdirSync(QA, { recursive: true })
      await p.waitForTimeout(500)
      await p.screenshot({ path: `${QA}/ctor-${tag}-${name}.png`, fullPage: touch })
    }
  }

  // 2,2-диметилбутан — задание урока «Изомерия»: CH3–C(CH3)2–CH2–CH3
  await openCtor(p, 'isomers', 'build:2-2-dimethylbutane')
  if (shots) await shot('0-intro')
  // подсказка первого входа — пройти три шага
  for (let k = 0; k < 3; k++) {
    const btn = await p.$(`${CTOR} [role="dialog"] button`)
    if (!btn) break
    await btn.click()
  }
  const c1 = await tapEmpty(p, 0.3, 0.45, touch)
  const c2 = await grow(p, c1, touch)
  const c3 = await grow(p, c2, touch)
  await grow(p, c3, touch)
  await grow(p, c2, touch)
  await grow(p, c2, touch)
  ok((await nameNow(p)).toLowerCase() === '2,2-диметилбутан', `${tag}: 2,2-диметилбутан — получилось «${await nameNow(p)}»`)
  ok(await p.$(`${CTOR} section[data-solved="1"]`), `${tag}: задание «собери 2,2-диметилбутан» не засчитано`)
  ok(await has3d(p, 'exact'), `${tag}: 3D 2,2-диметилбутана (RDKit) не показан общим Molecule3D`)
  ok(await p.$('[data-task="build:2-2-dimethylbutane"] span:last-child'), `${tag}: нет ✓ у задания`)
  await shot('1-dimethylbutane')

  // этанол: C–C, затем O на конец цепи
  await openCtor(p, 'alcohols', 'build:ethanol')
  const e1 = await tapEmpty(p, 0.35, 0.5, touch)
  const e2 = await grow(p, e1, touch)
  const e3 = await grow(p, e2, touch)
  await pickTool(p, `${CT_RU.elements} O`)
  await tap(p, await atomAt(p, e3), touch)
  ok((await nameNow(p)).toLowerCase() === 'этанол', `${tag}: этанол — «${await nameNow(p)}»`)
  ok(await p.$(`${CTOR} section[data-solved="1"]`), `${tag}: этанол не засчитан`)
  ok(await has3d(p, 'exact'), `${tag}: 3D этанола`)
  await shot('2-ethanol')

  // уксусная кислота: C + группа –COOH из палитры
  await openCtor(p, 'acids', 'build:acetic-acid')
  const a1 = await tapEmpty(p, 0.35, 0.5, touch)
  await pickTool(p, GROUP_TITLE.ru.COOH)
  await tap(p, await atomAt(p, a1), touch)
  const acid = (await nameNow(p)).toLowerCase()
  ok(acid === 'этановая кислота' || acid === 'уксусная кислота', `${tag}: уксусная кислота — «${acid}»`)
  ok(await p.$(`${CTOR} section[data-solved="1"]`), `${tag}: уксусная кислота не засчитана`)
  await shot('3-acetic')

  // бензол: кольцо из палитры
  await openCtor(p, 'arenes', 'build:benzene')
  await pickTool(p, GROUP_TITLE.ru.benzene)
  await tapEmpty(p, 0.45, 0.5, touch)
  ok((await nameNow(p)).toLowerCase() === 'бензол', `${tag}: бензол — «${await nameNow(p)}»`)
  ok(await p.$(`${CTOR} section[data-solved="1"]`), `${tag}: бензол не засчитан`)
  ok(await has3d(p, 'exact'), `${tag}: 3D бензола`)
  await shot('4-benzene')

  // цис-бут-2-ен: C=C по горизонтали, оба CH3 вниз («буквой П»)
  if (!touch) {
    await openCtor(p, 'alkenes', 'free')
    const b1 = await tapEmpty(p, 0.4, 0.4, touch)
    const b2 = await drag(p, b1, 0)
    await drag(p, b1, 120)
    await drag(p, b2, 60)
    await tapBond(p, b1, b2, touch)
    const cis = (await nameNow(p)).toLowerCase()
    ok(/цис/.test(cis) && /бут-?2-ен|бутен-2/.test(cis), `${tag}: цис-бут-2-ен — «${cis}»`)
    await shot('5-cis-butene')
    // вне реестра: 3-этилгептан-подобная цепь → приближённое 3D встраивателя
    await openCtor(p, 'alkanes', 'free')
    await pickTool(p, CT_RU.clear)
    let x = await tapEmpty(p, 0.2, 0.5, touch)
    for (let k = 0; k < 7; k++) x = await grow(p, x, touch)
    const ids = await atomIds(p)
    const mid = ids[3]!
    let br = await grow(p, mid, touch)
    br = await grow(p, br, touch)
    await grow(p, ids[5]!, touch)
    ok(await has3d(p, 'approx'), `${tag}: 3D молекулы вне реестра (встраиватель) не показано`)
    await shot('6-approx3d')
  }

  // все изомеры C₅H₁₂
  await openCtor(p, 'isomers', 'iso:C5H12')
  const add = async () => {
    await p.click(`${CTOR} button:has-text("${CT_RU.addIsomer}")`)
    await p.waitForTimeout(150)
  }
  // пентан
  let q = await tapEmpty(p, 0.25, 0.5, touch)
  for (let k = 0; k < 4; k++) q = await grow(p, q, touch)
  await add()
  // 2-метилбутан
  q = await tapEmpty(p, 0.25, 0.5, touch)
  const m2 = await grow(p, q, touch)
  q = await grow(p, m2, touch)
  await grow(p, q, touch)
  await grow(p, m2, touch)
  await add()
  // повтор пентана — распознать
  q = await tapEmpty(p, 0.25, 0.5, touch)
  for (let k = 0; k < 4; k++) q = await grow(p, q, touch)
  await add()
  const dup = await p.$eval(`${CTOR} [role="status"]`, (e) => e.textContent ?? '').catch(() => '')
  ok(/тот же|same/i.test(dup), `${tag}: повтор пентана не распознан: «${dup}»`)
  await pickTool(p, CT_RU.clear)
  // 2,2-диметилпропан
  q = await tapEmpty(p, 0.3, 0.5, touch)
  const n2 = await grow(p, q, touch)
  await grow(p, n2, touch)
  await grow(p, n2, touch)
  await grow(p, n2, touch)
  await add()
  const cnt = await p.$eval(`${CTOR} [data-found]`, (e) => `${e.getAttribute('data-found')}/${e.getAttribute('data-total')}`)
  ok(cnt === '3/3', `${tag}: изомеры C5H12 найдено ${cnt}`)
  await shot('7-isomers-C5H12')
  ok(s.errors.length === 0, `${tag}: ошибки консоли Конструктора: ${s.errors.slice(0, 4).join(' | ')}`)
  await s.ctx.close()
  console.log(`Конструктор (${tag}): собраны 2,2-диметилбутан, этанол, уксусная кислота, бензол${touch ? '' : ', цис-бут-2-ен, вне реестра'}; изомеры C5H12 ${cnt}`)
}
await ctorSuite(false, 'pc', 1280, 720)
await ctorSuite(true, 'phone', 390, 844)

// ── 7) прогресс: урок проходится целиком (2 урока) ──
async function passLesson(lessonId: string) {
  const s = await openPage(1280, 720, 'dark')
  const p = s.page
  await p.goto(`${BASE}#/organic?lesson=${lessonId}`, { waitUntil: 'load', timeout: 60000 })
  await settled(p)
  const tabs = await p.$$eval('[data-mode-tab]', (els) => els.map((e) => e.getAttribute('data-mode-tab')!))
  const tick = (m: string) => p.$(`[data-mode-tab="${m}"] span:nth-of-type(2)`)
  for (const m of tabs) {
    await p.click(`[data-mode-tab="${m}"]`)
    await p.waitForSelector(`[data-stage="${m}"]`)
    await settled(p)
    if (m === 'molecule') {
      await p.waitForSelector('[data-ov2-mol3d]', { timeout: 20000 })
    } else if (m === 'constructor') {
      // первое задание урока — собрать по названию
      const task = await p.getAttribute('[data-task][aria-selected="true"]', 'data-task')
      const target = task?.startsWith('build:') ? task.slice(6) : ''
      for (let k = 0; k < 3; k++) {
        const btn = await p.$(`${CTOR} [role="dialog"] button`)
        if (!btn) break
        await btn.click()
      }
      if (target === 'methane') await tapEmpty(p, 0.4, 0.5, false)
      else if (target === 'ethane') await grow(p, await tapEmpty(p, 0.4, 0.5, false), false)
      else ok(false, `${lessonId}: неожиданное первое задание ${task}`)
      await p.waitForSelector(`${CTOR} section[data-solved="1"]`, { timeout: 5000 }).catch(() => ok(false, `${lessonId}: задание ${task} не засчитано`))
    } else if (m === 'isomers') {
      ok(!(await tick('isomers')), `${lessonId}: «Изомеры» засчитаны просто за открытие`)
      const cards = await p.$$eval('[data-ov2-isomer]', (els) => els.map((e) => e.getAttribute('data-ov2-isomer')!))
      for (const id of cards) {
        await p.click(`[data-mode-tab="isomers"]`)
        await p.waitForSelector(`[data-ov2-isomer="${id}"]`)
        await p.click(`[data-ov2-isomer="${id}"]`)
        await p.waitForSelector(`[data-stage="molecule"]`)
      }
      await p.click(`[data-mode-tab="isomers"]`)
      await p.waitForSelector('[data-iso-seen]')
      const seen = await p.$eval('[data-iso-seen]', (e) => `${e.getAttribute('data-iso-seen')}/${e.getAttribute('data-iso-total')}`)
      ok(seen === `${cards.length}/${cards.length}`, `${lessonId}: открыто карточек ${seen}`)
    } else if (m === 'synthesis' || m === 'reactions') {
      ok(!(await tick(m)), `${lessonId}: «${m}» засчитан до конца проигрывания`)
      await p.waitForSelector('[data-ov2-synthesis] input[type="range"]', { timeout: 20000 })
      await p.focus('[data-ov2-synthesis] input[type="range"]')
      await p.keyboard.press('End')
      await p.waitForTimeout(400)
    } else if (m === 'name') {
      ok(false, `${lessonId}: тест «Название» в e2e не проходится`)
    }
    ok(await tick(m), `${lessonId}: режим «${m}» не засчитан`)
  }
  await p.waitForSelector(`[data-lesson="${lessonId}"] [data-done="true"]`, { timeout: 3000 }).catch(() => ok(false, `${lessonId}: урок не отмечен пройденным в пути`))
  if (shots) {
    fs.mkdirSync(QA, { recursive: true })
    await p.screenshot({ path: `${QA}/progress-${lessonId}.png` })
  }
  ok(s.errors.length === 0, `${lessonId}: ошибки консоли ${s.errors.slice(0, 4).join(' | ')}`)
  await s.ctx.close()
  console.log(`прогресс: урок ${lessonId} пройден целиком (${tabs.join(', ')})`)
}
await passLesson('intro-structure')
await passLesson('reaction-types')

// ── 8) EN и UZ: все режимы без русских строк и пустых подписей ──
for (const lang of ['en', 'uz'] as const) {
  const s = await openPage(1280, 720, 'dark', false, lang)
  const p = s.page
  await p.goto(`${BASE}#/organic?lesson=nomenclature`, { waitUntil: 'load', timeout: 60000 })
  await settled(p)
  const tabs = await p.$$eval('[data-mode-tab]', (els) => els.map((e) => e.getAttribute('data-mode-tab')!))
  for (const m of tabs) {
    await p.click(`[data-mode-tab="${m}"]`)
    await p.waitForSelector(`[data-stage="${m}"]`)
    await settled(p)
    await p.waitForTimeout(m === 'synthesis' || m === 'reactions' ? 1200 : 500)
    const bad = await p.evaluate(() => {
      const out: string[] = []
      const root = document.querySelector('[data-ov2-shell] main')!
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = n.textContent ?? ''
        // кириллица, кроме названий учебника «Kimyo»/«Химия»
        if (/[А-Яа-яЁё]/.test(t)) out.push(t.trim().slice(0, 60))
      }
      for (const el of root.querySelectorAll('button, [role="tab"]')) {
        if (!(el.textContent ?? '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('title')) out.push(`пустая кнопка: ${el.outerHTML.slice(0, 80)}`)
      }
      return out
    })
    ok(bad.length === 0, `${lang}/${m}: русские строки/пустые подписи: ${[...new Set(bad)].slice(0, 6).join(' | ')}`)
    if (shots) {
      fs.mkdirSync(QA, { recursive: true })
      await p.screenshot({ path: `${QA}/${lang}-${m}.png` })
    }
  }
  ok(s.errors.length === 0, `${lang}: ошибки консоли ${s.errors.slice(0, 4).join(' | ')}`)
  await s.ctx.close()
  console.log(`${lang}: режимов проверено ${tabs.length}`)
}


// ── 5) кадры ──
if (shots && !onlyNew) {
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
