#!/usr/bin/env node
/**
 * E2E голоса через настоящий интерфейс урока: Chromium с фейковым микрофоном (WAV 48 кГц PCM16 моно, %noloop)
 * + заглушка мозга scripts/voice/stt-mock-server.mts (/health, /stt, /stt/health, /chat SSE).
 * Сайт ищет мозг в public/brain.json — перехватываем его (page.route) и подставляем адрес заглушки: src не трогаем.
 * К запросам /stt добавляем X-Mock-Clip — заглушка выравнивает присланный сегмент с клипом и отвечает его текстом.
 *
 * Сценарии (контракт «Голос» v1, data-testid: voice-lamp-mic/stt, voice-path-chip, live-transcript-you,
 * voice-check-record/result/copy):
 *  a  ru-клип → реплика ученика (WER ≤ 15 %) ≤ 4 с после конца звука, лампы «слышит»/«распознаю» были on, ответ учителя;
 *  b  uz и en клипы → текст и язык (lang из ответа заглушки);
 *  c  тишина 5 с → ни одной реплики, «распознаю» не красная, через 8 с нет жёлтой «не отвечает»;
 *  d  длинная речь ~45 с → ≥ 2 сегмента /stt, объединённый WER ≤ 20 %;
 *  e  эхо (фраза учителя в микрофон во время озвучки) → реплики ученика нет (нет озвучки — пропуск);
 *  f  микрофон запрещён (NotAllowedError) → баннер с «Повторить», текстовый ввод работает;
 *  g  нет устройства (NotFoundError) → понятный баннер, текстовый ввод работает;
 *  h  заглушка mode=down → путь не server / баннер «сервер недоступен», текстовый ввод работает;
 *  i  заглушка mode=rate → реплика доходит после Retry-After;
 *  j  экран #/voice-check: запись → текст и путь, «Скопировать отчёт» даёт JSON;
 *  k  --live: Edge/Chrome с настоящим Web Speech (ручной режим: Web Speech слушает настоящий микрофон ПК, фразу говорит
 *     человек; мозг — заглушка, --live-brain — public/brain.json); не обязан проходить.
 * Если на странице нет элементов контракта (сайт без site-voice) — сценарий «ждёт слияния» (не провал; --strict → провал).
 *
 * Запуск: npm run e2e:voice [-- --only=a,b,f] [--base=http://127.0.0.1:5173] [--port=5197] [--lead=6] [--headed]
 *         [--strict] [--live[=msedge,chrome]] [--live-brain] [--keep]
 * Отчёт: .tmp/e2e-voice/report.json + скриншоты .tmp/e2e-voice/<сценарий>.png; exit 1 при провале.
 */
import { chromium } from 'playwright'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startMockServer } from './voice/stt-mock-server.mts'
import { concat, decodeWav, encodeWav, resample, silence } from './voice/wavio.mts'
import { whiteNoise } from './voice/noise.mts'
import { wer } from './voice/wer.mts'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const FIX = join(HERE, 'voice', 'fixtures')
const OUT = join(ROOT, '.tmp', 'e2e-voice')
// путь к WAV для флага Chrome — без кириллицы (короткое имя TEMP), иначе флаг может не прочитаться
const MIC_DIR = join(tmpdir(), 'atomlab-e2e-voice')

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.length ? v.join('=') : '1']
  }),
)
const PORT = args.port ?? '5197'
const BASE = (args.base ?? `http://127.0.0.1:${PORT}`).replace(/\/+$/, '')
const LEAD_S = Number(args.lead ?? 6)
const STRICT = args.strict === '1'
const HEADED = args.headed === '1'
const ONLY = args.only ? new Set(args.only.split(',')) : null
const LESSON = '#/learn/g/g7/c/c1/s/s01'
const RATE48 = 48_000

const YOU_SEL = '[data-testid="live-transcript-you"]'
// до слияния site-voice реплики ученика без data-testid — запасной селектор по CSS-модулю ленты
const YOU_FALLBACK = '[role="log"] [class*="msgYou"]:not([class*="msgPartial"])'
const TEACHER_SEL = '[role="log"] [class*="msgTeacher"]'

mkdirSync(OUT, { recursive: true })
mkdirSync(MIC_DIR, { recursive: true })

/* ------------------------------------------------------------ аудио для фейкового микрофона */

const manifest = JSON.parse(readFileSync(join(FIX, 'manifest.json'), 'utf8'))
const fx = Object.fromEntries(manifest.entries.map((e) => [e.phrase ?? e.id, e]))

function loadFixture(phrase) {
  const e = fx[phrase]
  if (!e) throw new Error(`нет клипа ${phrase} в fixtures/manifest.json`)
  const { rate, samples } = decodeWav(readFileSync(join(FIX, e.file16)))
  return { e, samples: rate === 16_000 ? samples : resample(samples, rate, 16_000) }
}

/**
 * Собрать «звук в микрофоне»: тишина lead → фразы с паузами → хвост 3 с. Возвращает 16 кГц (для заглушки),
 * путь к 48 кГц WAV (для Chrome) и сегменты речи (мс от начала файла).
 */
function buildMic(name, phrases, { gapS = 1.2, leadS = LEAD_S, tailS = 3, noiseOnly = 0 } = {}) {
  const parts = [silence(leadS, 16_000)]
  const segments = []
  let at = leadS * 1000
  for (const p of phrases) {
    const { e, samples } = loadFixture(p)
    parts.push(samples)
    if (e.speech) segments.push({ startMs: at + e.speech.startMs, endMs: at + e.speech.endMs, text: e.text })
    at += (samples.length / 16_000) * 1000
    parts.push(silence(gapS, 16_000))
    at += gapS * 1000
  }
  if (noiseOnly > 0) parts.push(whiteNoise(Math.round(noiseOnly * 16_000), 0.0004, 7))
  parts.push(silence(tailS, 16_000))
  // очень тихий фон (−68 дБ): совсем «цифровой ноль» Chrome может счесть мёртвой дорожкой
  const s16 = concat(parts)
  const floor = whiteNoise(s16.length, 0.0004, 11)
  for (let i = 0; i < s16.length; i++) s16[i] += floor[i]
  const file = join(MIC_DIR, `${name}.wav`)
  writeFileSync(file, encodeWav(resample(s16, 16_000, RATE48), RATE48))
  const speechEndMs = segments.length ? segments[segments.length - 1].endMs : leadS * 1000
  return { id: name, samples16: s16, file, segments, speechEndMs, totalMs: (s16.length / 16_000) * 1000 }
}

/* ------------------------------------------------------------ сервер сайта */

let vite = null
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
async function ensureSite() {
  if (await up(BASE, 3)) return
  if (args.base) throw new Error(`нет сайта на ${BASE}`)
  vite = spawn('npx', ['vite', '--port', PORT, '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, shell: true, stdio: 'ignore' })
  if (!(await up(BASE, 180))) throw new Error(`vite не поднялся на ${BASE}`)
}
function stopSite() {
  if (!vite) return
  // синхронно: иначе process.exit обгоняет taskkill и vite остаётся висеть на порту
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(vite.pid), '/T', '/F'], { stdio: 'ignore' })
  else vite.kill('SIGTERM')
}

/* ------------------------------------------------------------ сторож в странице */

/** gum: 'pass' (настоящий фейковый микрофон, отмечаем время) | 'denied' | 'nodevice' */
const PROBE = ({ gum, YOU_SEL, YOU_FALLBACK, TEACHER_SEL }) => {
  const ve = { lamps: { mic: {}, stt: {} }, lampTrail: [], path: {}, you: [], teacher: [], speaking: [], micAt: 0, gumCalls: 0, gumErr: null }
  window.__ve = ve
  const md = navigator.mediaDevices
  if (md && md.getUserMedia) {
    const orig = md.getUserMedia.bind(md)
    md.getUserMedia = async (c) => {
      ve.gumCalls++
      if (c && c.audio) {
        if (gum === 'denied') {
          ve.gumErr = 'NotAllowedError'
          throw new DOMException('Permission denied', 'NotAllowedError')
        }
        if (gum === 'nodevice') {
          ve.gumErr = 'NotFoundError'
          throw new DOMException('Requested device not found', 'NotFoundError')
        }
      }
      const s = await orig(c)
      if (c && c.audio && !ve.micAt) ve.micAt = Date.now()
      return s
    }
  }
  const textOf = (el) => {
    const c = el.cloneNode(true)
    c.querySelectorAll('[class*="srOnly"]').forEach((x) => x.remove())
    return (c.textContent || '').replace(/\s+/g, ' ').trim()
  }
  setInterval(() => {
    const now = Date.now()
    for (const k of ['mic', 'stt']) {
      const el = document.querySelector(`[data-testid="voice-lamp-${k}"]`)
      if (!el) continue
      const s = el.getAttribute('data-state') || '?'
      ve.lamps[k][s] = (ve.lamps[k][s] || 0) + 1
      const last = ve.lampTrail.filter((x) => x.k === k).pop()
      if (!last || last.s !== s) ve.lampTrail.push({ k, s, t: now })
    }
    const chip = document.querySelector('[data-testid="voice-path-chip"]')
    if (chip) {
      const p = chip.getAttribute('data-path') || '?'
      ve.path[p] = (ve.path[p] || 0) + 1
    }
    let you = [...document.querySelectorAll(YOU_SEL)]
    if (!you.length) you = [...document.querySelectorAll(YOU_FALLBACK)]
    you.forEach((el, i) => {
      const text = textOf(el)
      if (!ve.you[i]) ve.you[i] = { t: now, text }
      else ve.you[i].text = text
    })
    const teacher = [...document.querySelectorAll(TEACHER_SEL)]
    teacher.forEach((el, i) => {
      const text = textOf(el)
      if (!ve.teacher[i]) ve.teacher[i] = { t: now, text }
      else ve.teacher[i].text = text
      if (el.getAttribute('data-speaking') === '1') ve.speaking.push(now)
    })
  }, 100)
}

/* ------------------------------------------------------------ браузер и страница */

const results = []
let mock = null

const SCENARIO_LIMIT_S = Number(args['scenario-limit'] ?? 150)
const openBrowsers = new Set()

async function launch(micFile, channel) {
  const a = ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required']
  if (micFile) a.push('--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${micFile}%noloop`)
  const b = await chromium.launch({ headless: !HEADED, channel: channel ?? 'chromium', args: a })
  openBrowsers.add(b)
  b.on('disconnected', () => openBrowsers.delete(b))
  return b
}

async function openPage(browser, { gum = 'pass', clipId = null, brain = true, permissions = ['microphone'], hash = LESSON, query = 'stt=server&debugVoice=1' } = {}) {
  const ctx = await browser.newContext({ locale: 'ru-RU', permissions: [...permissions, 'clipboard-read', 'clipboard-write'], viewport: { width: 1280, height: 860 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e.message || e)))
  await page.addInitScript(PROBE, { gum, YOU_SEL, YOU_FALLBACK, TEACHER_SEL })
  await page.addInitScript(() => {
    try {
      localStorage.setItem('atomlab.locale', 'ru')
    } catch {
      /* без хранилища */
    }
  })
  if (brain) {
    await page.route('**/brain.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ urls: [mock.url], localFallback: false }) }))
    if (clipId) {
      await page.route(`${mock.url}/stt**`, (r) => {
        const u = new URL(r.request().url())
        if (u.pathname !== '/stt') return r.continue()
        return r.continue({ headers: { ...r.request().headers(), 'x-mock-clip': clipId } })
      })
    }
  }
  const sep = hash.includes('?') ? '&' : '?'
  await page.goto(`${BASE}/?${query}${hash}${sep}${query}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  return { ctx, page, errors }
}

/** Урок → «Начать онлайн-диалог» → «Начать урок». false — кнопок нет. */
async function startLive(page) {
  const live = page.getByRole('button', { name: /Начать онлайн-диалог|Onlayn muloqotni boshlash|Start live dialogue/ }).first()
  // студия урока сначала спрашивает «Как проведём урок?» — выбираем «ИИ-учитель»
  const chooser = page.locator('[data-studio-chooser] button', { hasText: /ИИ-учитель|AI teacher|AI o'qituvchi|AI oʻqituvchi/ }).first()
  try {
    await Promise.race([chooser.waitFor({ state: 'visible', timeout: 60_000 }), live.waitFor({ state: 'visible', timeout: 60_000 })])
    if (await chooser.isVisible().catch(() => false)) await chooser.click()
  } catch {
    return false
  }
  try {
    await live.waitFor({ state: 'visible', timeout: 60_000 })
  } catch {
    return false
  }
  await live.click()
  const start = page.getByRole('button', { name: /^(Начать урок|Darsni boshlash|Start lesson)/ }).first()
  try {
    await start.waitFor({ state: 'visible', timeout: 15_000 })
    await start.click()
  } catch {
    return false
  }
  return true
}

async function hasContract(page, ms = 12_000) {
  try {
    await page.locator('[data-testid="voice-lamp-mic"], [data-testid="voice-path-chip"]').first().waitFor({ state: 'attached', timeout: ms })
    return true
  } catch {
    return false
  }
}

const ve = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__ve)))

async function waitYou(page, n, ms) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const v = await ve(page)
    if (v.you.filter((x) => x.text).length >= n) return v
    await page.waitForTimeout(200)
  }
  return ve(page)
}

async function typeQuestion(page, text) {
  const box = page.locator('textarea').last()
  await box.waitFor({ state: 'visible', timeout: 10_000 })
  await box.fill(text)
  await box.press('Enter')
}

async function shot(page, name) {
  try {
    await page.screenshot({ path: join(OUT, `${name}.png`) })
  } catch {
    /* окно закрыто */
  }
}

function record(id, title, status, detail, extra = {}) {
  results.push({ id, title, status, detail, ...extra })
  const mark = status === 'ok' ? 'ok  ' : status === 'fail' ? 'FAIL' : status === 'skip' ? 'skip' : 'wait'
  console.log(`  ${mark} ${id}  ${title} — ${detail}`)
}

/* ------------------------------------------------------------ сценарии */

/** Общий сценарий «клип → реплика ученика» (a, b, i). */
async function clipScenario(id, title, phrases, { lang, mode = 'normal', maxWer = 0.15, needLamps = false, needTeacher = false, needRetry = false }) {
  const mic = buildMic(`${id}-${phrases.join('+')}`, phrases)
  mock.reset()
  mock.setMode(mode)
  mock.registerClip({ id: mic.id, samples: mic.samples16, segments: mic.segments })
  const browser = await launch(mic.file)
  try {
    const { page, errors } = await openPage(browser, { clipId: mic.id })
    if (!(await startLive(page))) return record(id, title, 'fail', 'не открылся онлайн-диалог урока')
    if (!(await hasContract(page))) {
      await shot(page, id)
      return record(id, title, 'pending', 'нет data-testid контракта (ждёт слияния site-voice)')
    }
    const expected = mic.segments.map((s) => s.text).join(' ')
    const v = await waitYou(page, 1, mic.totalMs + 12_000)
    await page.waitForTimeout(needTeacher ? 2500 : 300)
    const v2 = await ve(page)
    await shot(page, id)
    const you = v2.you.filter((x) => x.text)
    const st = mock.stats.stt.filter((x) => x.status === 200 && !x.partial)
    const issues = []
    if (!you.length) issues.push('нет реплики ученика')
    const got = you.map((x) => x.text).join(' ')
    const w = you.length ? wer(expected, got, lang).wer : 1
    if (you.length && w > maxWer) issues.push(`WER ${(w * 100).toFixed(0)} % > ${maxWer * 100} % («${got}»)`)
    let lagMs = null
    if (you.length && v.micAt) {
      lagMs = you[0].t - (v.micAt + mic.speechEndMs)
      if (lagMs > 4000) issues.push(`реплика через ${(lagMs / 1000).toFixed(1)} с после конца звука (> 4 с)`)
    }
    const langs = [...new Set(st.map((x) => x.lang))]
    if (lang && st.length && !langs.includes(lang)) issues.push(`язык ${langs.join(',')} ≠ ${lang}`)
    if (needLamps) {
      if (!v2.lamps.mic.on) issues.push('лампа «слышит» ни разу не горела')
      if (!v2.lamps.stt.on) issues.push('лампа «распознаю» ни разу не горела')
      if (v2.lamps.stt.lost || v2.lamps.stt.warn) issues.push('лампа «распознаю» красная/жёлтая')
    }
    if (needTeacher && !v2.teacher.some((x) => x.t >= (you[0]?.t ?? 0) && x.text)) issues.push('нет ответа учителя после реплики')
    if (needRetry) {
      const r429 = mock.stats.stt.filter((x) => x.status === 429).length
      if (!r429) issues.push('заглушка не отдала 429 (сайт не слал /stt?)')
    }
    if (errors.length) issues.push(`ошибки страницы: ${errors.slice(0, 2).join(' | ')}`)
    const detail = issues.length ? issues.join('; ') : `«${got}» WER ${(w * 100).toFixed(0)} %, ${lagMs === null ? '' : `+${lagMs} мс, `}lang ${langs.join(',') || '—'}, /stt ${st.length}`
    record(id, title, issues.length ? 'fail' : 'ok', detail, { you, lamps: v2.lamps, path: v2.path, lagMs, wer: w })
  } finally {
    mock.setMode('normal')
    await browser.close()
  }
}

async function scenarioSilence() {
  const id = 'c'
  const title = 'тишина 5 с → нет реплик, «распознаю» не красная, через 8 с нет «не отвечает»'
  const mic = buildMic('c-silence', [], { tailS: 14, noiseOnly: 5 })
  mock.reset()
  mock.registerClip({ id: mic.id, samples: mic.samples16, segments: [] })
  const browser = await launch(mic.file)
  try {
    const { page } = await openPage(browser, { clipId: mic.id })
    if (!(await startLive(page))) return record(id, title, 'fail', 'не открылся онлайн-диалог урока')
    if (!(await hasContract(page))) {
      await shot(page, id)
      return record(id, title, 'pending', 'нет data-testid контракта (ждёт слияния site-voice)')
    }
    await page.waitForTimeout(LEAD_S * 1000 + 5000 + 8000)
    const v = await ve(page)
    await shot(page, id)
    const issues = []
    const you = v.you.filter((x) => x.text)
    if (you.length) issues.push(`ложные реплики: ${you.map((x) => `«${x.text}»`).join(', ')}`)
    if (v.lamps.stt.lost) issues.push('лампа «распознаю» красная')
    if (v.lamps.stt.warn) issues.push('жёлтая «не отвечает» на тишине')
    const nonEmpty = mock.stats.stt.filter((x) => x.status === 200 && x.text).length
    record(id, title, issues.length ? 'fail' : 'ok', issues.join('; ') || `реплик 0, /stt ${mock.stats.stt.length} (с текстом ${nonEmpty})`, { lamps: v.lamps })
  } finally {
    await browser.close()
  }
}

async function scenarioLong() {
  const id = 'd'
  const title = 'длинная речь ~45 с → ≥ 2 сегмента, объединённый WER ≤ 20 %'
  // 12 фраз подряд с короткими паузами (0,3 с < конца реплики 450 мс) — непрерывная речь ~45 с
  const seq = ['ru-03', 'ru-01', 'ru-26', 'echo-02', 'ru-03', 'ru-01', 'ru-26', 'echo-02', 'ru-03', 'ru-01', 'ru-26', 'echo-02', 'ru-03', 'ru-26']
  const mic = buildMic('d-long', seq, { gapS: 0.3, tailS: 4 })
  mock.reset()
  mock.registerClip({ id: mic.id, samples: mic.samples16, segments: mic.segments })
  const browser = await launch(mic.file)
  try {
    const { page } = await openPage(browser, { clipId: mic.id })
    if (!(await startLive(page))) return record(id, title, 'fail', 'не открылся онлайн-диалог урока')
    if (!(await hasContract(page))) {
      await shot(page, id)
      return record(id, title, 'pending', 'нет data-testid контракта (ждёт слияния site-voice)')
    }
    await page.waitForTimeout(mic.totalMs + 8000)
    const v = await ve(page)
    await shot(page, id)
    const finals = mock.stats.stt.filter((x) => x.status === 200 && !x.partial && x.text)
    const too = mock.stats.stt.filter((x) => x.status === 413).length
    const you = v.you.filter((x) => x.text)
    const expected = mic.segments.map((s) => s.text).join(' ')
    const got = you.map((x) => x.text).join(' ')
    const w = wer(expected, got, 'ru').wer
    const issues = []
    if (finals.length < 2) issues.push(`сегментов /stt ${finals.length} (< 2)`)
    if (too) issues.push(`413 too_long: ${too} (сайт прислал > 25 с)`)
    if (w > 0.2) issues.push(`объединённый WER ${(w * 100).toFixed(0)} % > 20 %`)
    record(id, title, issues.length ? 'fail' : 'ok', issues.join('; ') || `сегментов ${finals.length}, реплик ${you.length}, WER ${(w * 100).toFixed(0)} %`, { wer: w })
  } finally {
    await browser.close()
  }
}

async function scenarioEcho() {
  const id = 'e'
  const title = 'эхо фразы учителя во время озвучки → реплики ученика нет'
  // учитель отвечает на набранный вопрос и озвучивает ответ; в это время в микрофон звучит его же голос (Dmitry)
  const mic = buildMic('e-echo', ['echo-02', 'echo-02'], { leadS: LEAD_S + 3, gapS: 0.4 })
  mock.reset()
  mock.registerClip({ id: mic.id, samples: mic.samples16, segments: mic.segments })
  const browser = await launch(mic.file)
  try {
    const { page } = await openPage(browser, { clipId: mic.id })
    if (!(await startLive(page))) return record(id, title, 'fail', 'не открылся онлайн-диалог урока')
    if (!(await hasContract(page))) {
      await shot(page, id)
      return record(id, title, 'pending', 'нет data-testid контракта (ждёт слияния site-voice)')
    }
    await page.waitForTimeout(Math.max(0, LEAD_S * 1000 - 1500))
    await typeQuestion(page, 'Молярная масса воды равна восемнадцати граммам на моль. Объясни подробно, почему так.')
    await page.waitForTimeout(mic.totalMs - LEAD_S * 1000 + 6000)
    const v = await ve(page)
    await shot(page, id)
    const echoStart = v.micAt + mic.segments[0].startMs
    const echoEnd = v.micAt + mic.segments[mic.segments.length - 1].endMs
    const spokeDuring = v.speaking.some((t) => t >= echoStart && t <= echoEnd)
    const echoed = v.you.filter((x) => x.text && wer('молярная масса воды равна восемнадцати граммам на моль', x.text, 'ru').wer < 0.5 && !/объясни/i.test(x.text))
    if (!spokeDuring) return record(id, title, 'skip', 'учитель не озвучивал во время эха (нет TTS в этом браузере) — проверить вручную/--live')
    record(id, title, echoed.length ? 'fail' : 'ok', echoed.length ? `эхо попало в ленту: «${echoed[0].text}»` : 'эхо не попало в ленту')
  } finally {
    await browser.close()
  }
}

async function scenarioGumError(id, title, gum, bannerRe) {
  mock.reset()
  const browser = await launch(null)
  try {
    const { page } = await openPage(browser, { gum, permissions: gum === 'denied' ? [] : ['microphone'] })
    if (!(await startLive(page))) return record(id, title, 'fail', 'не открылся онлайн-диалог урока')
    await page.waitForTimeout(3000)
    const issues = []
    const banner = page.getByText(bannerRe).first()
    const hasBanner = await banner.isVisible().catch(() => false)
    if (!hasBanner) issues.push('нет понятного баннера про микрофон')
    if (gum === 'denied') {
      const retry = page.getByRole('button', { name: /Повторить/ }).first()
      if (!(await retry.isVisible().catch(() => false))) issues.push('нет кнопки «Повторить»')
    }
    // текстовый ввод работает
    try {
      await typeQuestion(page, 'что такое валентность')
      const v = await waitYou(page, 1, 8000)
      if (!v.you.some((x) => /валентност/i.test(x.text))) issues.push('набранный вопрос не появился в ленте')
    } catch (e) {
      issues.push(`текстовый ввод: ${String(e.message || e).split('\n')[0]}`)
    }
    await shot(page, id)
    const contract = await hasContract(page, 1500)
    if (issues.length && !contract) return record(id, title, 'pending', `${issues.join('; ')} (до слияния site-voice)`)
    record(id, title, issues.length ? 'fail' : 'ok', issues.join('; ') || 'баннер есть, текстовый ввод работает')
  } finally {
    await browser.close()
  }
}

async function scenarioDown() {
  const id = 'h'
  const title = 'заглушка mode=down → путь не server / баннер, текстовый ввод работает'
  const mic = buildMic('h-down', ['ru-01'])
  mock.reset()
  mock.setMode('down')
  mock.registerClip({ id: mic.id, samples: mic.samples16, segments: mic.segments })
  const browser = await launch(mic.file)
  try {
    const { page } = await openPage(browser, { clipId: mic.id })
    if (!(await startLive(page))) return record(id, title, 'fail', 'не открылся онлайн-диалог урока')
    if (!(await hasContract(page))) {
      await shot(page, id)
      return record(id, title, 'pending', 'нет data-testid контракта (ждёт слияния site-voice)')
    }
    await page.waitForTimeout(mic.totalMs + 2000)
    const issues = []
    const v = await ve(page)
    const lastPath = await page.locator('[data-testid="voice-path-chip"]').first().getAttribute('data-path').catch(() => null)
    const bannerDown = await page.getByText(/сервер[^.]{0,40}недоступ|распознавание[^.]{0,40}недоступ/i).first().isVisible().catch(() => false)
    if (lastPath === 'server' && !bannerDown) issues.push('путь остался server без баннера при 503')
    await typeQuestion(page, 'что такое валентность')
    const v2 = await waitYou(page, 1, 8000)
    if (!v2.you.some((x) => /валентност/i.test(x.text))) issues.push('набранный вопрос не появился в ленте')
    await shot(page, id)
    record(id, title, issues.length ? 'fail' : 'ok', issues.join('; ') || `путь ${lastPath ?? '—'}${bannerDown ? ', баннер' : ''}, текст работает`, { path: v.path })
  } finally {
    mock.setMode('normal')
    await browser.close()
  }
}

async function scenarioVoiceCheck() {
  const id = 'j'
  const title = 'экран #/voice-check: запись → текст и путь, «Скопировать отчёт» = JSON'
  const mic = buildMic('j-check', ['check-kislorod'], { leadS: 1.5, tailS: 4 })
  mock.reset()
  mock.registerClip({ id: mic.id, samples: mic.samples16, segments: mic.segments })
  const browser = await launch(mic.file)
  try {
    const { page } = await openPage(browser, { clipId: mic.id, hash: '#/voice-check' })
    const rec = page.locator('[data-testid="voice-check-record"]').first()
    try {
      await rec.waitFor({ state: 'visible', timeout: 30_000 })
    } catch {
      await shot(page, id)
      return record(id, title, 'pending', 'нет экрана #/voice-check (ждёт слияния site-voice)')
    }
    await rec.click()
    const res = page.locator('[data-testid="voice-check-result"]').first()
    const issues = []
    let text = ''
    try {
      await page.waitForFunction(() => (document.querySelector('[data-testid="voice-check-result"]')?.textContent || '').trim().length > 0, null, { timeout: 15_000 })
      text = ((await res.textContent()) || '').trim()
    } catch {
      issues.push('нет текста результата')
    }
    if (text && !/кислород/i.test(text)) issues.push(`в результате нет «кислород»: «${text.slice(0, 80)}»`)
    let report = null
    try {
      await page.locator('[data-testid="voice-check-copy"]').first().click()
      await page.waitForTimeout(300)
      report = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))
      for (const k of ['ua', 'path', 'brainUrl', 'levels', 'errors', 'text', 'lang']) if (!(k in report)) issues.push(`в отчёте нет поля ${k}`)
    } catch (e) {
      issues.push(`отчёт не JSON: ${String(e.message || e).split('\n')[0]}`)
    }
    await shot(page, id)
    record(id, title, issues.length ? 'fail' : 'ok', issues.join('; ') || `«${text.slice(0, 60)}», путь ${report?.path}`)
  } finally {
    await browser.close()
  }
}

/**
 * --live: настоящий браузер (Edge/Chrome) и настоящий Web Speech; только отчёт, на код выхода не влияет.
 * ВАЖНО (замер 12.10): Web Speech в Chrome и Edge берёт звук с НАСТОЯЩЕГО микрофона ПК по умолчанию — флаг
 * --use-file-for-fake-audio-capture на него не действует (фейковый файл получает только getUserMedia).
 * Поэтому живой режим ручной и окно видимое: человек сам говорит LIVE_PHRASE в микрофон. Звук комнаты уходит
 * в облачное распознавание браузера — запускать только у себя и только по своей воле.
 */
const LIVE_PHRASE = 'молярная масса воды восемнадцать грамм на моль'
async function scenarioLive(channel) {
  const id = `k-${channel}`
  // по умолчанию мозг — заглушка (сервер друга не трогаем); --live-brain — мозг из public/brain.json (только владелец)
  const realBrain = args['live-brain'] === '1'
  const title = `живой режим ${channel}: настоящий Web Speech + ${realBrain ? 'мозг из brain.json' : 'заглушка мозга'} (ручной, не обязан проходить)`
  mock.reset()
  let browser
  try {
    browser = await chromium.launch({ headless: false, channel, args: ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] })
  } catch (e) {
    return record(id, title, 'skip', `браузер ${channel} не запустился: ${String(e.message || e).split('\n')[0]}`)
  }
  try {
    const { page } = await openPage(browser, { brain: !realBrain, query: realBrain ? 'stt=auto&debugVoice=1' : 'stt=web&debugVoice=1' })
    if (!(await startLive(page))) return record(id, title, 'skip', 'не открылся онлайн-диалог урока')
    await page.waitForTimeout(LEAD_S * 1000)
    console.log(`  >>> ${channel}: скажите в микрофон «${LIVE_PHRASE}» (ждём 20 с)`)
    const tAsk = Date.now()
    const v = await waitYou(page, 1, 20_000)
    await page.waitForTimeout(4000)
    const v2 = await ve(page)
    await shot(page, id)
    const you = v2.you.filter((x) => x.text && x.t >= tAsk)
    const got = you.map((x) => x.text).join(' ')
    const w = you.length ? wer(LIVE_PHRASE, got, 'ru').wer : 1
    record(id, title, 'skip', you.length ? `«${got}» WER ${(w * 100).toFixed(0)} %, путь ${JSON.stringify(v2.path)}, учитель: ${v2.teacher.length > 1 ? 'ответил' : 'нет'}` : `реплики нет; путь ${JSON.stringify(v2.path)}`, {
      live: true,
      wer: w,
      micAt: v.micAt,
    })
  } finally {
    await browser.close()
  }
}

/* ------------------------------------------------------------ прогон */

const SCENARIOS = {
  a: () => clipScenario('a', 'ru-клип → реплика (WER ≤ 15 %, ≤ 4 с), лампы, ответ учителя', ['ru-03'], { lang: 'ru', needLamps: true, needTeacher: true }),
  b: async () => {
    await clipScenario('b-uz', 'uz-клип → текст и язык uz', ['uz-01'], { lang: 'uz' })
    await clipScenario('b-en', 'en-клип → текст и язык en', ['en-01'], { lang: 'en' })
  },
  c: scenarioSilence,
  d: scenarioLong,
  e: scenarioEcho,
  f: () => scenarioGumError('f', 'микрофон запрещён → баннер «Повторить», текст работает', 'denied', /микрофон[^.]{0,60}(запрещ|разреш|доступ)/i),
  g: () => scenarioGumError('g', 'нет микрофона → понятный баннер, текст работает', 'nodevice', /микрофон[^.]{0,60}(не найден|нет|подключ)|нет микрофона/i),
  h: scenarioDown,
  i: () => clipScenario('i', 'заглушка mode=rate → реплика доходит после Retry-After', ['ru-01'], { lang: 'ru', mode: 'rate', needRetry: true }),
  j: scenarioVoiceCheck,
}

async function main() {
  const t0 = Date.now()
  mock = await startMockServer({ port: Number(args['mock-port'] ?? 0), quiet: true })
  console.log(`заглушка мозга: ${mock.url}`)
  await ensureSite()
  console.log(`сайт: ${BASE}${vite ? ' (vite dev поднят скриптом)' : ''}; lead ${LEAD_S} с; WAV микрофона: ${MIC_DIR}`)
  for (const [k, fn] of Object.entries(SCENARIOS)) {
    if (ONLY && !ONLY.has(k)) continue
    // сторож: зависший сценарий (браузер не закрывается, страница не отвечает) не держит весь прогон
    let timer
    const watchdog = new Promise((_, j) => {
      timer = setTimeout(() => j(new Error(`сценарий завис дольше ${SCENARIO_LIMIT_S} с`)), SCENARIO_LIMIT_S * 1000)
    })
    try {
      await Promise.race([fn(), watchdog])
    } catch (e) {
      record(k, 'сценарий', 'fail', `исключение: ${String(e.stack || e).split('\n').slice(0, 2).join(' ')}`)
      for (const b of [...openBrowsers]) await Promise.race([b.close().catch(() => {}), new Promise((r) => setTimeout(r, 3000))])
      openBrowsers.clear()
    } finally {
      clearTimeout(timer)
    }
  }
  if (args.live) {
    const chans = args.live === '1' ? ['msedge', 'chrome'] : args.live.split(',')
    for (const c of chans) await scenarioLive(c)
  }
  const fails = results.filter((r) => r.status === 'fail')
  const pend = results.filter((r) => r.status === 'pending')
  const ok = results.filter((r) => r.status === 'ok')
  const sec = Math.round((Date.now() - t0) / 1000)
  writeFileSync(join(OUT, 'report.json'), JSON.stringify({ at: new Date().toISOString(), base: BASE, seconds: sec, results }, null, 1) + '\n')
  console.log(`\nитог: ok ${ok.length}, провал ${fails.length}, ждёт слияния ${pend.length}, пропуск ${results.length - ok.length - fails.length - pend.length}; ${sec} с; отчёт .tmp/e2e-voice/report.json`)
  return fails.length || (STRICT && pend.length) ? 1 : 0
}

main()
  .then(async (code) => {
    if (mock) await Promise.race([mock.close(), new Promise((r) => setTimeout(r, 1500))])
    if (!args.keep) stopSite()
    process.exit(code)
  })
  .catch(async (e) => {
    console.error(e)
    if (mock) await Promise.race([mock.close(), new Promise((r) => setTimeout(r, 1500))])
    stopSite()
    process.exit(1)
  })
