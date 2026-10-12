/**
 * npm run brain:live-selftest — наблюдение за сервером мозга без живого сервера (nextBuild #1–2):
 *   1) пороги и Markdown живого отчёта (scripts/brain/liveReportLib.mts);
 *   2) GET /admin/live-report на настоящем сервере мозга (mock-LLM, временные папки): 403 без ключа, 404 без отчётов,
 *      последний / за дату / список, кривая дата → 400, путь папки в ответ не попадает;
 *   3) brain:live-report (fetchLiveReport + Markdown) с этого сервера, неверный ключ → понятная ошибка;
 *   4) ночной прогон nightly-live.mts целиком: eval по HTTP (мало вопросов), картинки выключены → «пропущено»,
 *      STT — на заглушке voice:mock (WER по фикстурам), отчёт ложится в папку reports и отдаётся /admin/live-report;
 *      мозг лежит → отчёт всё равно пишется, код 0;
 *   5) монитор: probe (up / degraded / 500 / нет соединения), переходы с дребезгом и напоминанием, Telegram-заглушка,
 *      monitor.mts --once (журнал JSONL и state.json, токен бота нигде не пишется), сводка доступности.
 * Код выхода 1, если хоть одна проверка не прошла.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'atomlab-live-selftest-'))
const REPORTS = path.join(TMP, 'reports')
process.env.BRAIN_DATA_DIR = path.join(TMP, 'data')
process.env.BRAIN_REPORTS_DIR = REPORTS
process.env.BRAIN_NO_WARM = '1'
process.env.BRAIN_NO_DIALOG_LOG = '1'
delete process.env.BRAIN_PROFILE
delete process.env.BRAIN_ADMIN_TOKEN

const lib = await import('./liveReportLib.mts')
const { fetchLiveReport, writeLiveReport } = await import('./live-report.mts')
const mon = await import('./monitor.mts')

let failed = 0
let passed = 0
const ok = (cond: boolean, what: string, extra = '') => {
  if (cond) passed++
  else failed++
  console.log(`${cond ? '  ✓' : '  ✗'} ${what}${extra ? ' — ' + extra : ''}`)
}

// ——— 1) пороги и Markdown
console.log('1) пороги живого отчёта')
type Parts = Parameters<typeof lib.finalize>[0]['parts']
const goodParts = (): Parts => ({
  eval: { status: 'ok', durationMs: 60_000, n: 40, pass: 36, byCat: { 'dialog-ru': { n: 10, pass: 9 }, calc: { n: 5, pass: 5 } }, firstMs: { n: 30, p50: 1500, p95: 6000 }, busy: 0, r3: 0, cjk: 0, wikiLeak: 0, fails: [] },
  curriculum: { status: 'ok', durationMs: 90_000, n: 50, pass: 45, bySub: { calc: { n: 5, pass: 5 }, test: { n: 10, pass: 9 }, why: { n: 10, pass: 9 } }, waits: 2, r3: 0, cjk: 0, wikiLeak: 0, fails: [] },
  image: { status: 'ok', durationMs: 40_000, engine: 'z-image-turbo', items: [{ presetId: 'a', ok: true, ms: 12_000, genMs: 5000, nsfw: 0.01 }, { presetId: 'b', ok: true, ms: 9000, genMs: 4000, nsfw: 0.02 }], p50Ms: 9000, p95Ms: 12_000, nsfwMax: 0.02 },
  stt: { status: 'ok', durationMs: 20_000, engine: 'gigaam', device: 'cuda', clips: 10, wer: { ru: 0.08, uz: 0.15, en: 0.05 }, p95Ms: 600, evalOk: true },
})
const base = { version: 1 as const, date: '2026-10-12', startedAt: '2026-10-12T03:00:00.000Z', finishedAt: '2026-10-12T03:30:00.000Z', commit: 'abc12345', url: 'http://127.0.0.1:8787', health: { ok: true, version: '1.0', chatModel: 'gemma4:12b', llm: true, image: { enabled: true, ready: true, engine: 'z-image-turbo' }, stt: { available: true, device: 'cuda' } } }
const good = lib.finalize({ ...base, parts: goodParts() })
ok(good.ok && good.failed.length === 0 && good.thresholds.length >= 18, 'хорошая ночь: все пороги пройдены', `${good.thresholds.length} порогов`)
ok(Object.values(good.parts).every((p) => p.status === 'ok'), 'статусы частей — ok')
const badParts = goodParts()
badParts.eval!.byCat.calc = { n: 5, pass: 4 }
badParts.eval!.firstMs.p95 = 9000
badParts.curriculum!.wikiLeak = 1
badParts.image!.nsfwMax = 0.1
badParts.stt!.wer.uz = 0.2
badParts.stt!.wer.en = 0.1
const bad = lib.finalize({ ...base, parts: badParts })
const names = bad.failed.join(' | ')
ok(!bad.ok && bad.failed.length === 5, 'плохая ночь: ровно 5 провалов', names)
ok(/eval: calc/.test(names) && /первое слово p95/.test(names) && /curriculum: wikiLeak/.test(names) && /nsfw/.test(names) && /WER uz/.test(names), 'провалы: calc 100 %, p95 ≤ 8 с, wikiLeak 0, nsfw < 0,1, WER uz ≤ 18 %')
ok(!/WER en/.test(names), 'граница включительна: WER en 10 % при пороге ≤ 10 % — пройдено')
ok(bad.parts.eval!.status === 'fail' && bad.parts.stt!.status === 'fail' && bad.parts.image!.status === 'fail', 'части с провалом — status fail')
const skipped = lib.finalize({ ...base, parts: { image: { status: 'skipped', durationMs: 0, note: 'выключены', engine: null, items: [], p50Ms: null, p95Ms: null, nsfwMax: null }, stt: { status: 'error', durationMs: 0, note: 'нет scripts/voice', engine: null, device: null, clips: 0, wer: {}, p95Ms: null, evalOk: null } } })
ok(!skipped.thresholds.some((t) => t.part === 'image') && skipped.failed.length === 1 && /stt: прогон выполнен/.test(skipped.failed[0]!), 'пропущено — без порогов; ошибка части — один провал «прогон выполнен»')
const md = lib.renderMarkdown(bad, [{ date: '2026-10-11', ok: true, failed: 0 }])
ok(md.startsWith('# Живой отчёт качества ИИ-учителя — 2026-10-12') && md.includes('| ✗ |') && md.includes('abc12345') && md.includes('## Прошлые ночи') && md.includes('WER clean'), 'Markdown: заголовок, коммит, ✗, история, WER')
const cl = lib.consoleLines(bad, true).join('\n')
ok(cl.includes('\x1b[31m') && /НЕ останавливает/.test(cl), 'консоль: провал красным, «обновление не останавливает»')
ok(lib.normDate('2026-10-12') === '20261012' && lib.normDate('20261012') === '20261012' && lib.normDate('../x') === null, 'normDate: две записи даты, обход пути — null')

// ——— 2) GET /admin/live-report на настоящем сервере
console.log('2) GET /admin/live-report')
const { loadConfig } = await import('../../brain/config.ts')
const { createBrainLazy, createServer } = await import('../../brain/server.ts')
const { MockLlm } = await import('../../brain/llm/mock.ts')
const brain = createBrainLazy({ llm: new MockLlm(), config: { ...loadConfig(), profile: 'laptop' } })
const TOKEN = 'live-selftest-admin-5b1e'
brain.deps.config.adminToken = TOKEN
const server = createServer(brain)
await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
const URL_ = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
const get = async (p: string, admin = true) => {
  const r = await fetch(URL_ + p, { headers: admin ? { 'X-Brain-Admin': TOKEN } : {} })
  const text = await r.text()
  let j: Record<string, unknown> | null = null
  try {
    j = JSON.parse(text) as Record<string, unknown>
  } catch {
    /* не JSON */
  }
  return { status: r.status, j, text }
}
ok((await get('/admin/live-report', false)).status === 403, 'без ключа админа → 403')
const none = await get('/admin/live-report')
ok(none.status === 404 && /no_report|пока нет/.test(none.text), 'отчётов нет → 404 no_report', none.text.slice(0, 120))
fs.mkdirSync(REPORTS, { recursive: true })
fs.writeFileSync(path.join(REPORTS, 'live-20261010.json'), '﻿' + JSON.stringify({ ...good, date: '2026-10-10' }))
fs.writeFileSync(path.join(REPORTS, 'live-20261011.json'), JSON.stringify({ ...bad, date: '2026-10-11' }))
fs.writeFileSync(path.join(REPORTS, 'notes.txt'), 'не отчёт')
const latest = await get('/admin/live-report')
ok(latest.status === 200 && latest.j?.date === '2026-10-11' && (latest.j?.report as { ok?: boolean })?.ok === false, 'последний отчёт — 2026-10-11 (с провалами)')
ok(!latest.text.includes(REPORTS.replace(/\\/g, '\\\\')) && !latest.text.includes(TMP.replace(/\\/g, '\\\\')), 'путь папки отчётов в ответ не попадает')
const byDate = await get('/admin/live-report?date=2026-10-10')
ok(byDate.status === 200 && (byDate.j?.report as { ok?: boolean })?.ok === true, '?date=2026-10-10 → тот отчёт (BOM не мешает)')
ok((await get('/admin/live-report?date=..%2F..%2Fsecrets')).status === 400, 'кривая дата (обход пути) → 400')
ok((await get('/admin/live-report?date=20200101')).status === 404, 'нет отчёта за дату → 404')
const list = await get('/admin/live-report?list=1')
const reps = (list.j?.reports ?? []) as { date: string; ok: boolean | null; failed: number | null }[]
ok(list.status === 200 && reps.length === 2 && reps[0]!.date === '2026-10-11' && reps[0]!.failed === 5 && reps[1]!.ok === true, '?list=1: две даты, новые первыми, итог и число провалов')

// ——— 3) brain:live-report
console.log('3) brain:live-report → Markdown')
const fetched = await fetchLiveReport(URL_, TOKEN)
const mdOut = writeLiveReport(path.join(TMP, 'docs', 'live-report.md'), fetched)
const mdText = fs.readFileSync(mdOut, 'utf8')
ok(fetched.report.date === '2026-10-11' && fetched.history.length === 1 && fetched.history[0]!.date === '2026-10-10', 'отчёт + история прошлых ночей')
ok(mdText.includes('2026-10-11') && mdText.includes('| ✗ |') && fs.existsSync(path.join(TMP, 'docs', 'live-report.json')), 'docs/plans/live-report.md и .json рядом')
let err403 = ''
try {
  await fetchLiveReport(URL_, 'wrong-key')
} catch (e) {
  err403 = (e as Error).message
}
ok(/403/.test(err403) && !err403.includes(TOKEN), 'неверный ключ → понятная ошибка 403', err403)
let errDown = ''
try {
  await fetchLiveReport('http://127.0.0.1:1', TOKEN)
} catch (e) {
  errDown = (e as Error).message
}
ok(/не отвечает/.test(errDown), 'сервер молчит → «не отвечает»')

// ——— 4) ночной прогон целиком
console.log('4) nightly-live.mts (eval по HTTP, картинки выключены, STT на заглушке)')
const { startMockServer } = await import('../voice/stt-mock-server.mts')
const stt = await startMockServer({ port: 0, manifests: [path.join(ROOT, 'scripts', 'voice', 'fixtures', 'manifest.json')], quiet: true, inferMs: 5 })
const runNode = (script: string, args: string[], env: NodeJS.ProcessEnv): Promise<{ code: number | null; out: string }> =>
  new Promise((resolve) => {
    const c = spawn(process.execPath, [...process.execArgv, path.join(ROOT, script), ...args], { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    c.stdout.on('data', (d: Buffer) => (out += d.toString('utf8')))
    c.stderr.on('data', (d: Buffer) => (out += d.toString('utf8')))
    c.on('close', (code) => resolve({ code, out }))
  })
const nightOut = path.join(REPORTS, 'live-20261012.json')
const night = await runNode('scripts/brain/nightly-live.mts', [`--url=${URL_}`, `--out=${nightOut}`, '--skip=curriculum', '--sample=6', '--cats=calc,smalltalk', `--stt-url=${stt.url}`, '--stt-load=2', '--commit=selftest', '--no-color'], { BRAIN_ADMIN_TOKEN: TOKEN })
type R = import('./liveReportLib.mts').LiveReport
let nr: R | null = null
try {
  nr = JSON.parse(fs.readFileSync(nightOut, 'utf8')) as R
} catch {
  /* нет файла */
}
ok(night.code === 0 && !!nr, 'nightly-live: код 0, отчёт записан', night.code === 0 ? '' : night.out.split('\n').slice(-8).join(' | '))
ok(!!nr && nr.commit === 'selftest' && nr.health?.llm === true && nr.health.chatModel === 'mock-7b', 'отчёт: коммит и /health (модель)')
ok(!!nr?.parts.eval && nr.parts.eval.n >= 4 && nr.parts.eval.status !== 'error' && (nr.parts.eval.byCat.calc?.n ?? 0) > 0, 'eval по HTTP: вопросы прогнаны, calc есть', nr?.parts.eval ? `${nr.parts.eval.pass}/${nr.parts.eval.n}, ${nr.parts.eval.note ?? ''}` : '')
ok(nr?.parts.image?.status === 'skipped' && !nr.thresholds.some((t) => t.part === 'image'), 'картинки выключены → «пропущено», без порогов')
ok(!nr?.parts.curriculum, '--skip=curriculum — части нет')
ok(nr?.parts.stt?.status !== 'error' && (nr?.parts.stt?.clips ?? 0) > 0 && Object.keys(nr?.parts.stt?.wer ?? {}).length >= 2, 'STT на заглушке: клипы и WER по языкам', JSON.stringify(nr?.parts.stt?.wer ?? nr?.parts.stt?.note))
ok(!night.out.includes(TOKEN), 'ключ админа в выводе не печатается')
const served = await get('/admin/live-report')
ok(served.status === 200 && served.j?.date === '2026-10-12', '/admin/live-report отдаёт свежий ночной отчёт')
const downOut = path.join(TMP, 'down', 'live-x.json')
const down = await runNode('scripts/brain/nightly-live.mts', ['--url=http://127.0.0.1:1', `--out=${downOut}`, '--no-color'], {})
const dr = fs.existsSync(downOut) ? (JSON.parse(fs.readFileSync(downOut, 'utf8')) as R) : null
ok(down.code === 0 && !!dr && dr.health === null && !dr.ok && dr.failed.length === 4, 'мозг лежит → отчёт с 4 ошибками частей, код 0 (обновление не ломается)')
await stt.close()

// ——— 5) монитор
console.log('5) монитор доступности')
let mode: 'up' | 'degraded' | 'down' | 'html' = 'up'
const health = http.createServer((_req, res) => {
  if (mode === 'down') {
    res.writeHead(502)
    return res.end('bad gateway')
  }
  if (mode === 'html') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    return res.end('<html>')
  }
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: true, version: '1.0', llm: { available: mode === 'up', chatModel: 'gemma4:12b' }, image: { enabled: true, ready: true }, stt: { available: true } }))
})
const tgSeen: { path: string; body: Record<string, unknown> }[] = []
const tg = http.createServer((req, res) => {
  let b = ''
  req.on('data', (d: Buffer) => (b += d.toString('utf8')))
  req.on('end', () => {
    tgSeen.push({ path: req.url ?? '', body: JSON.parse(b || '{}') as Record<string, unknown> })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('{"ok":true}')
  })
})
await new Promise<void>((r) => health.listen(0, '127.0.0.1', () => r()))
await new Promise<void>((r) => tg.listen(0, '127.0.0.1', () => r()))
const HURL = `http://127.0.0.1:${(health.address() as AddressInfo).port}`
const TGAPI = `http://127.0.0.1:${(tg.address() as AddressInfo).port}`
const pUp = await mon.probe(HURL)
mode = 'degraded'
const pDeg = await mon.probe(HURL)
mode = 'down'
const pDown = await mon.probe(HURL)
mode = 'html'
const pHtml = await mon.probe(HURL)
const pRefused = await mon.probe('http://127.0.0.1:1', 3000)
ok(pUp.status === 'up' && pUp.model === 'gemma4:12b' && pUp.http === 200, 'probe: up (модель, HTTP 200)')
ok(pDeg.status === 'degraded' && /LLM/.test(pDeg.error ?? ''), 'probe: LLM недоступна → degraded')
ok(pDown.status === 'down' && pDown.http === 502 && pHtml.status === 'down' && pRefused.status === 'down' && pRefused.http === null, 'probe: 502, не JSON, нет соединения → down')

const at = (min: number, status: 'up' | 'degraded' | 'down'): import('./monitor.mts').Probe => ({ ts: new Date(Date.UTC(2026, 9, 12, 0, 0) + min * 60_000).toISOString(), status, ms: 100, http: status === 'down' ? null : 200 })
let st = mon.freshState(at(0, 'up').ts)
const seq: (import('./monitor.mts').Change | null)[] = []
for (const [m, s] of [[0, 'up'], [5, 'down'], [10, 'up'], [15, 'down'], [20, 'down'], [25, 'down'], [6 * 60 + 20, 'down'], [6 * 60 + 25, 'up']] as const) {
  const r = mon.step(st, at(m, s), 2, 6 * 3600_000)
  st = r.state
  seq.push(r.change)
}
ok(seq[0] === null && st.checks === 8, 'первый запуск на живом сервере — без сообщения')
ok(seq[1] === null && seq[2] === null, 'одиночный сбой (дребезг) — без сообщения')
ok(seq[3] === null && seq[4]?.to === 'down' && seq[4]?.from === 'up' && seq[5] === null, 'два сбоя подряд → «down» один раз')
ok(seq[6]?.reminder === true && seq[6]?.to === 'down', 'через 6 ч простоя — напоминание')
ok(seq[7]?.to === 'up' && seq[7]!.lastedMs === (6 * 60 + 25 - 20) * 60_000, 'восстановление — сразу, с длительностью простоя')
const msgDown = mon.message(seq[4]!, at(20, 'down'), 'https://win-x.tail.ts.net')
const msgUp = mon.message(seq[7]!, { ...at(385, 'up'), model: 'gemma4:12b' }, 'https://win-x.tail.ts.net')
ok(/НЕ отвечает/.test(msgDown) && /Наблюдение/.test(msgDown) && /простой 6 ч 5 мин/.test(msgUp), 'тексты: «НЕ отвечает» + куда смотреть; «простой 6 ч 5 мин»', msgUp)

const TGTOKEN = '123456:SELFTEST-secret-token'
ok((await mon.notifyTelegram('x', {})) === 'off', 'Telegram без ключей — выключен, без ошибок')
const sent = await mon.notifyTelegram('проверка', { ATOMLAB_TG_TOKEN: TGTOKEN, ATOMLAB_TG_CHAT: '42', ATOMLAB_TG_API: TGAPI })
ok(sent === 'sent' && tgSeen[0]?.path === `/bot${TGTOKEN}/sendMessage` && tgSeen[0]?.body.chat_id === '42' && tgSeen[0]?.body.text === 'проверка', 'Telegram: sendMessage с chat_id и текстом')
const tgErr = await mon.notifyTelegram('x', { ATOMLAB_TG_TOKEN: TGTOKEN, ATOMLAB_TG_CHAT: '42', ATOMLAB_TG_API: 'http://127.0.0.1:1' })
ok(tgErr !== 'sent' && !tgErr.includes(TGTOKEN), 'ошибка Telegram — без токена в тексте', tgErr)

const envFile = path.join(TMP, 'monitor.env')
fs.writeFileSync(envFile, `# ключи вне репозитория\nATOMLAB_TG_TOKEN=${TGTOKEN}\nATOMLAB_TG_CHAT="42"\nATOMLAB_TG_API=${TGAPI}\n`)
const dir = path.join(TMP, 'monitor')
tgSeen.length = 0
// дочерний монитор без ключей Telegram в env — они придут из --env-file (заданное в env файл не перезаписывает)
const runMonClean = (args: string[]) =>
  new Promise<{ code: number | null; out: string }>((resolve) => {
    const env = { ...process.env }
    delete env.ATOMLAB_TG_TOKEN
    delete env.ATOMLAB_TG_CHAT
    delete env.ATOMLAB_TG_API
    const c = spawn(process.execPath, [...process.execArgv, path.join(ROOT, 'scripts/brain/monitor.mts'), `--url=${HURL}`, `--dir=${dir}`, `--env-file=${envFile}`, '--once', '--fail-after=2', ...args], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    c.stdout.on('data', (d: Buffer) => (out += d.toString('utf8')))
    c.stderr.on('data', (d: Buffer) => (out += d.toString('utf8')))
    c.on('close', (code) => resolve({ code, out }))
  })
mode = 'up'
const m1 = await runMonClean([])
mode = 'down'
const m2 = await runMonClean([])
const m3 = await runMonClean([])
mode = 'up'
const m4 = await runMonClean([])
const logLines = fs.readFileSync(path.join(dir, 'log.jsonl'), 'utf8').trim().split('\n')
const stFile = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8')) as import('./monitor.mts').MonitorState
ok(m1.code === 0 && m2.code === 1 && m3.code === 1 && m4.code === 0, '--once: код 0 при up, 1 при down', [m1, m2, m3, m4].map((m) => m.code).join(','))
ok(/Telegram включён/.test(m1.out) && /СМЕНА СТАТУСА: up → down/.test(m3.out) && !/СМЕНА СТАТУСА/.test(m2.out) && /СМЕНА СТАТУСА: down → up/.test(m4.out), 'смена статуса печатается (после 2 сбоев) и при восстановлении')
ok(tgSeen.length === 2 && /НЕ отвечает/.test(String(tgSeen[0]?.body.text)) && /работает/.test(String(tgSeen[1]?.body.text)), 'Telegram (ключи из --env-file): «НЕ отвечает», затем «работает»')
ok(logLines.length === 4 && stFile.status === 'up' && stFile.checks === 4, 'журнал JSONL: 4 строки; state.json: up, 4 проверки')
const allOut = [m1, m2, m3, m4].map((m) => m.out).join('\n') + fs.readFileSync(path.join(dir, 'log.jsonl'), 'utf8') + fs.readFileSync(path.join(dir, 'state.json'), 'utf8')
ok(!allOut.includes(TGTOKEN), 'токен бота не попадает ни в вывод, ни в журнал, ни в состояние')
const sumMd = mon.summaryMarkdown(mon.readLog(path.join(dir, 'log.jsonl')), HURL)
const av = mon.availability(mon.readLog(path.join(dir, 'log.jsonl')), 86400_000)
ok(av.n === 4 && av.up === 2 && av.down === 2 && av.share === 0.5 && sumMd.includes('## Простои за 30 дней') && sumMd.includes('| 24 часа | 4 | 2 | 0 | 2 | 50.00 % |'), 'сводка: доступность 50 %, простой в таблице')

health.close()
tg.close()
server.close()
fs.rmSync(TMP, { recursive: true, force: true })
console.log(`\nlive-selftest: ${passed} ok, ${failed} ошибок`)
process.exit(failed ? 1 : 0)
