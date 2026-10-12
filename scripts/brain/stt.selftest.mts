/**
 * npm run brain:stt-selftest — распознавание речи /stt без GPU и без Python (контракт «Голос» v1):
 *   мозг на 127.0.0.1:8794 (или свободном) с временной папкой данных и ФЕЙКОВЫЙ сайдкар на 8795 (текст по длине аудио;
 *   режимы ok / медленный / лежит); WAV собирается в памяти (brain/stt/wav.ts buildWav).
 *   Проверки: ru/uz/en → lang по detectLang (en — повтор whisper), пустая речь; 48 кГц / стерео / 8 бит / не-WAV →
 *   400 bad_audio; 26 с и тело 2 МБ → 413; 0,2 с → 400 too_short; 415; CORS; лимиты сессии (30/мин, partial отдельно),
 *   независимость сессий с одного адреса, потолок адреса, «один в полёте» → 429 busy; сайдкар лежит / медленный →
 *   503 stt_unavailable + Retry-After; /stt/health и поле stt в /health; приватность: ни новых файлов в папке данных
 *   и %TEMP%, ни текста распознавания в журналах и выводе сервера; клиент /gpu release/acquire.
 *
 *   --live=<url мозга>  живая проверка на сервере (после установки stt.ps1): /stt/health, клипы scripts/voice/clips/*.wav
 *                       (16 кГц) или синтетический сигнал, задержка p50/p95 при 4 параллельных клиентах.
 * Код выхода 1, если хоть одна проверка не прошла.
 */
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const live = process.argv.find((a) => a.startsWith('--live='))?.slice(7)
let failed = 0
let passed = 0
const ok = (cond: boolean, what: string, extra = '') => {
  if (cond) passed++
  else failed++
  console.log(`${cond ? '  ✓' : '  ✗'} ${what}${extra ? ' — ' + extra : ''}`)
}

const { buildWav, parseWav } = await import('../../brain/stt/wav.ts')

if (live) {
  await runLive(live.replace(/\/+$/, ''))
  console.log(`\nstt live: прошло ${passed}, не прошло ${failed}`)
  process.exit(failed ? 1 : 0)
}

const PORT = Number(process.env.BRAIN_STT_SELFTEST_PORT || 8794)
const SIDE_PORT = Number(process.env.BRAIN_STT_SIDECAR_PORT || 8795)
const dataDir = path.join(os.tmpdir(), `atomlab-brain-stt-selftest-${process.pid}`)
process.env.BRAIN_DATA_DIR = dataDir
delete process.env.BRAIN_PROFILE
delete process.env.BRAIN_ADMIN_TOKEN
delete process.env.BRAIN_STT_URL
process.env.BRAIN_NO_WARM = '1'
const ORIGIN = 'https://sadykoffalan2105-dev.github.io'

// ——— фейковый сайдкар: текст по длине аудио (мс), режимы ok / slow / down
const TEXTS: Record<number, string> = {
  1000: 'сколько молекул воды в одном моле вещества',
  1100: 'sulfat kislotaning molyar massasi qancha boʻladi',
  1200: 'what is the molar mass of sulfuric acid',
  1300: '',
}
const SECRET = 'сколько молекул воды'
let sideMode: 'ok' | 'slow' = 'ok'
let slowMs = 600
const sideCalls: { engine: string; partial: string; lang: string }[] = []
let gpuState: 'cuda' | 'cpu' = 'cuda'
const sidecar = http.createServer((req, res) => {
  const chunks: Buffer[] = []
  req.on('data', (c: Buffer) => chunks.push(c))
  req.on('end', () => {
    const send = (status: number, obj: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(obj))
    }
    if (req.method === 'GET' && req.url === '/health')
      return send(200, {
        ok: true,
        engines: [
          { name: 'gigaam-large', device: gpuState, loaded: true, langs: ['ru', 'uz', 'en'] },
          { name: 'whisper-turbo', device: gpuState, loaded: true, langs: ['en'] },
        ],
        queue: { running: 0, waiting: 0 },
        maxSeconds: 25,
      })
    if (req.method === 'POST' && req.url === '/gpu') {
      const mode = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}').mode
      gpuState = mode === 'release' ? 'cpu' : 'cuda'
      return send(200, { ok: true, state: gpuState })
    }
    if (req.method === 'POST' && req.url === '/transcribe') {
      const body = Buffer.concat(chunks)
      const w = parseWav(body)
      const dur = 'error' in w ? 0 : w.durationMs
      const engine = String(req.headers['x-engine'] ?? 'auto')
      sideCalls.push({ engine, partial: String(req.headers['x-partial']), lang: String(req.headers['x-lang-hint']) })
      const whisper = engine === 'whisper'
      const reply = () =>
        send(200, {
          ok: true,
          text: TEXTS[dur] ?? 'проверка',
          engine: whisper ? 'whisper-turbo' : 'gigaam-large',
          device: gpuState,
          ms: { queue: 1, decode: 2, infer: 30 },
          durationMs: dur,
          ...(whisper ? { lang: 'en' } : {}),
        })
      if (sideMode === 'slow') setTimeout(reply, slowMs)
      else reply()
      return
    }
    send(404, { ok: false, code: 'not_found' })
  })
})
const sidePort = await listenFree(sidecar, SIDE_PORT)

// снимок файлов: папка данных и %TEMP% (новые аудиофайлы — провал)
const tmpBefore = new Set(safeList(os.tmpdir()))

// перехват вывода сервера: текст распознавания не должен попасть ни в один журнал
const captured: string[] = []
for (const k of ['log', 'warn', 'error', 'info'] as const) {
  const orig = console[k].bind(console)
  console[k] = (...a: unknown[]) => {
    captured.push(a.map(String).join(' '))
    orig(...a)
  }
}

const { DEFAULT_CONFIG, loadConfig } = await import('../../brain/config.ts')
const { createBrainLazy, createServer } = await import('../../brain/server.ts')
const { MockLlm } = await import('../../brain/llm/mock.ts')
const { sttLang, sttSidecarOf } = await import('../../brain/stt/route.ts')
const { SttSidecar } = await import('../../brain/stt/sidecar.ts')

const brain = createBrainLazy({ llm: new MockLlm({ tokenDelayMs: 1 }), config: { ...loadConfig(), profile: 'laptop' } })
const cfg = brain.deps.config
cfg.stt = { ...DEFAULT_CONFIG.stt, rate: { ...DEFAULT_CONFIG.stt.rate }, sidecarUrl: `http://127.0.0.1:${sidePort}` }
const server = createServer(brain)
const port = await listenFree(server, PORT)
const dataBefore = new Set(walk(dataDir))
console.log(`stt selftest: мозг 127.0.0.1:${port}, сайдкар 127.0.0.1:${sidePort}, данные ${dataDir}`)

type Res = { status: number; headers: http.IncomingHttpHeaders; json: Record<string, unknown> | null; ms: number }
function call(method: string, p: string, o: { headers?: Record<string, string>; body?: Buffer } = {}): Promise<Res> {
  const t0 = performance.now()
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: { ...(o.body ? { 'Content-Length': String(o.body.length) } : {}), ...o.headers } }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        let j: Record<string, unknown> | null = null
        try {
          j = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        } catch {
          j = null
        }
        resolve({ status: res.statusCode ?? 0, headers: res.headers, json: j, ms: performance.now() - t0 })
      })
    })
    r.on('error', (e: NodeJS.ErrnoException) => (e.code === 'ECONNRESET' || e.code === 'EPIPE' ? resolve({ status: 0, headers: {}, json: null, ms: 0 }) : reject(e)))
    if (o.body) r.write(o.body)
    r.end()
  })
}
// ученик через Funnel (адрес из прокси — лимиты считаются)
const fwd = (ip: string, extra: Record<string, string> = {}) => ({ 'X-Forwarded-For': ip, 'Tailscale-Funnel-Request': '?1', Host: 'atomlab.tail1234.ts.net', ...extra })
const WAVH = { 'Content-Type': 'audio/wav' }
const err = (r: Res) => (r.json?.error as { code?: string } | undefined)?.code
const stt = (q: string, body: Buffer, ip = '203.0.113.10', extra: Record<string, string> = {}) => call('POST', `/stt?${q}`, { headers: { ...fwd(ip), ...WAVH, ...extra }, body })
const wav = (ms: number, o: Record<string, number> = {}) => buildWav({ ms, tone: 440, ...o })

try {
  console.log('1) распознавание и язык')
  let r = await stt('lang=auto&session=s-ru', wav(1000))
  const j = r.json ?? {}
  ok(r.status === 200 && j.ok === true && j.text === TEXTS[1000] && j.lang === 'ru' && j.langSource === 'script', 'ru-WAV → 200, text, lang ru (script)', `${r.status} ${j.lang}`)
  const ms = j.ms as Record<string, number> | undefined
  ok(!!ms && ['queue', 'decode', 'infer', 'total'].every((k) => typeof ms[k] === 'number') && j.durationMs === 1000 && j.partial === false && j.device === 'cuda' && j.engine === 'gigaam-large' && j.confidence === null, 'ответ по контракту: ms{queue,decode,infer,total}, durationMs, partial, device, engine, confidence')
  r = await stt('lang=uz&session=s-uz', wav(1100))
  ok(r.status === 200 && r.json?.lang === 'uz', 'uz-текст → lang uz', String(r.json?.lang))
  sideCalls.length = 0
  r = await stt('lang=auto&session=s-en', wav(1200))
  ok(r.status === 200 && r.json?.lang === 'en' && r.json?.engine === 'whisper-turbo' && r.json?.langSource === 'whisper', 'en-текст → повтор whisper, lang en (whisper)', `${r.json?.engine}`)
  ok(sideCalls.length === 2 && sideCalls[0]!.engine === 'auto' && sideCalls[1]!.engine === 'whisper', 'en: сначала GigaAM, потом whisper')
  r = await stt('lang=uz&session=s-empty', wav(1300))
  ok(r.status === 200 && r.json?.text === '' && r.json?.lang === 'uz' && r.json?.langSource === 'hint', 'пустая речь → text "" и язык подсказки (не ошибка)')
  r = await stt('session=s-empty2', wav(1300))
  ok(r.status === 200 && r.json?.lang === 'unknown', 'пустая речь без подсказки → unknown')
  sideCalls.length = 0
  r = await stt('lang=auto&session=s-p&partial=1', wav(1200))
  ok(r.status === 200 && r.json?.partial === true && sideCalls.length === 1 && sideCalls[0]!.engine === 'gigaam' && sideCalls[0]!.partial === '1', 'partial: только GigaAM, без повтора whisper')
  ok(sttLang('', 'auto').lang === 'unknown' && sttLang('H2SO4', 'en').lang === 'en' && sttLang('кислота', 'uz').lang === 'ru', 'sttLang: пусто / короткая латиница по подсказке / кириллица = ru')

  console.log('2) проверка аудио')
  r = await stt('session=a1', wav(1000, { rate: 48000 }))
  ok(r.status === 400 && err(r) === 'bad_audio' && r.json?.detail === 'rate', '48 кГц → 400 bad_audio (detail rate)', JSON.stringify(r.json?.error))
  r = await stt('session=a1', wav(1000, { channels: 2 }))
  ok(r.status === 400 && err(r) === 'bad_audio' && r.json?.detail === 'channels', 'стерео → 400 bad_audio (channels)')
  r = await stt('session=a1', wav(1000, { bits: 8 }))
  ok(r.status === 400 && err(r) === 'bad_audio' && r.json?.detail === 'bits', '8 бит → 400 bad_audio (bits)')
  r = await stt('session=a1', Buffer.from('это не WAV, а просто текст'.repeat(20)))
  ok(r.status === 400 && err(r) === 'bad_audio', 'не-WAV → 400 bad_audio')
  r = await stt('session=a1', wav(26_000))
  ok(r.status === 413 && err(r) === 'too_long', '26 с → 413 too_long')
  r = await stt('session=a1', wav(200))
  ok(r.status === 400 && err(r) === 'too_short', '0,2 с → 400 too_short')
  r = await stt('session=a1', Buffer.alloc(2 * 1024 * 1024))
  ok(r.status === 413 && err(r) === 'too_long', 'тело 2 МБ → 413 too_long', `${r.status}`)
  r = await stt('session=a1', wav(1000), '203.0.113.10', { 'Content-Type': 'text/plain' })
  ok(r.status === 415 && err(r) === 'unsupported_media_type', 'Content-Type text/plain → 415')
  r = await stt('session=a1', wav(1000), '203.0.113.10', { 'Content-Type': 'application/octet-stream' })
  ok(r.status === 200, 'application/octet-stream тоже принимается')
  r = await stt('session=bad%20id!', wav(1000))
  ok(r.status === 400 && err(r) === 'bad_request', 'кривая session → 400')

  console.log('3) CORS')
  r = await stt('session=c1', wav(1000), '203.0.113.11', { Origin: ORIGIN })
  ok(r.status === 200 && r.headers['access-control-allow-origin'] === ORIGIN, 'разрешённый Origin → 200 и заголовки CORS')
  r = await stt('session=c1', wav(1000), '203.0.113.11', { Origin: 'https://evil.example' })
  ok(r.status === 403, 'чужой Origin → 403')
  r = await call('OPTIONS', '/stt?session=c1', { headers: { ...fwd('203.0.113.11'), Origin: ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } })
  ok(r.status === 204 && r.headers['access-control-allow-origin'] === ORIGIN, 'OPTIONS /stt → 204 (обработка server.ts)')

  console.log('4) лимиты')
  const ipA = '198.51.100.20'
  const codes: number[] = []
  for (let i = 0; i < 31; i++) codes.push((await stt('session=lim1', wav(1000), ipA)).status)
  const last = await stt('session=lim1', wav(1000), ipA)
  ok(codes.slice(0, 30).every((c) => c === 200) && codes[30] === 429 && err(last) === 'rate' && Number(last.headers['retry-after']) > 0, 'session: 30 финальных в минуту, 31-я → 429 rate + Retry-After', `${codes.filter((c) => c === 200).length}×200`)
  r = await stt('session=lim1&partial=1', wav(1000), ipA)
  ok(r.status === 200, 'partial у той же сессии считается отдельно → 200')
  r = await stt('session=lim2', wav(1000), ipA)
  ok(r.status === 200, 'другая сессия с того же адреса → 200 (школьный NAT)')
  cfg.stt.rate.partialPerMin = 5
  const pc: number[] = []
  for (let i = 0; i < 6; i++) pc.push((await stt('session=lim3&partial=1', wav(1000), ipA)).status)
  ok(pc.slice(0, 5).every((c) => c === 200) && pc[5] === 429, 'partial: свой лимит в минуту (5 при настройке 5)', pc.join(','))
  cfg.stt.rate.partialPerMin = DEFAULT_CONFIG.stt.rate.partialPerMin
  // потолок адреса — общий ограничитель server.ts (группа stt)
  cfg.stt.rate.ipPerMin = 4
  const ipc: number[] = []
  for (let i = 0; i < 5; i++) ipc.push((await stt(`session=ip${i}`, wav(1000), '198.51.100.30')).status)
  const ipLast = await stt('session=ip9', wav(1000), '198.51.100.30')
  ok(ipc.slice(0, 4).every((c) => c === 200) && ipc[4] === 429 && err(ipLast) === 'rate' && ipLast.json?.rule === 'stt_ip_minute' && Number(ipLast.headers['retry-after']) > 0, 'потолок адреса (4 при настройке 4) → 429 rate stt_ip_minute + Retry-After', ipc.join(','))
  cfg.stt.rate.ipPerMin = DEFAULT_CONFIG.stt.rate.ipPerMin
  r = await stt('session=ipother', wav(1000), '198.51.100.31')
  ok(r.status === 200, 'другой адрес не задет потолком соседа')
  // один в полёте на сессию
  sideMode = 'slow'
  slowMs = 500
  const p1 = stt('session=busy1', wav(1000), '198.51.100.40')
  await new Promise((s) => setTimeout(s, 100))
  const r2 = await stt('session=busy1', wav(1000), '198.51.100.40')
  const r1 = await p1
  ok(r1.status === 200 && r2.status === 429 && err(r2) === 'busy' && r2.headers['retry-after'] === '2', 'второй одновременный запрос той же сессии → 429 busy, Retry-After 2')
  r = await stt('session=busy1', wav(1000), '198.51.100.40')
  ok(r.status === 200, 'после ответа сессия снова свободна')
  // медленный сайдкар → таймаут → 503
  cfg.stt.timeoutMs = 300
  slowMs = 1000
  r = await stt('session=slow1', wav(1000), '198.51.100.41')
  ok(r.status === 503 && err(r) === 'stt_unavailable' && r.headers['retry-after'] === '10' && r.ms < 900, 'сайдкар медленнее таймаута → 503 stt_unavailable, Retry-After 10', `${Math.round(r.ms)} мс`)
  cfg.stt.timeoutMs = DEFAULT_CONFIG.stt.timeoutMs
  sideMode = 'ok'

  console.log('5) здоровье')
  r = await call('GET', '/stt/health', { headers: fwd('198.51.100.50') })
  const h = r.json ?? {}
  ok(r.status === 200 && h.ok === true && h.available === true && Array.isArray(h.engines) && (h.engines as unknown[]).length === 2 && JSON.stringify(h.langs) === '["ru","uz","en"]' && h.maxSeconds === 25 && typeof (h.queue as Record<string, number>)?.running === 'number', 'GET /stt/health: available, engines, langs, maxSeconds, queue')
  r = await call('GET', '/health')
  const hs = r.json?.stt as Record<string, unknown> | undefined
  ok(r.status === 200 && !!hs && hs.available === true && hs.device === 'cuda' && Array.isArray(hs.langs) && r.json?.ok === true, 'поле stt в /health: {available, langs, device}', JSON.stringify(hs))
  const sc = sttSidecarOf(brain)
  ok((await sc.release()) === 'cpu' && (await sc.acquire()) === 'cuda', 'клиент сайдкара: /gpu release → cpu, acquire → cuda')

  console.log('6) сайдкар лежит')
  sidecar.close()
  sidecar.closeAllConnections?.()
  await new Promise((s) => setTimeout(s, 100))
  r = await stt('session=down1', wav(1000), '198.51.100.60')
  ok(r.status === 503 && err(r) === 'stt_unavailable' && r.headers['retry-after'] === '10', 'сайдкар лежит → 503 stt_unavailable, Retry-After 10', `${Math.round(r.ms)} мс`)
  r = await stt('session=down2', wav(1000), '198.51.100.60')
  ok(r.status === 503 && r.ms < 200, 'повтор сразу → 503 быстрее 200 мс (не ждём соединения)', `${Math.round(r.ms)} мс`)
  const dead = new SttSidecar('http://127.0.0.1:9')
  ok((await dead.health(500)) === null && (await dead.gpu('release', 500)) === null, 'клиент: нет сайдкара → health null, gpu null')
  await new Promise((s) => setTimeout(s, 5100)) // кеш здоровья 5 с
  r = await call('GET', '/stt/health')
  ok(r.status === 200 && r.json?.available === false && r.json?.reason === 'sidecar_down', '/stt/health без сайдкара → available:false (не ошибка)')
  r = await call('GET', '/health')
  ok((r.json?.stt as Record<string, unknown>)?.available === false && r.json?.ok === true, '/health работает и без сайдкара (stt.available:false)')
  cfg.stt.enabled = false
  r = await stt('session=off', wav(1000), '198.51.100.61')
  ok(r.status === 503 && err(r) === 'stt_unavailable', 'config.stt.enabled=false → 503')
  cfg.stt.enabled = true

  console.log('7) приватность')
  const dataAfter = walk(dataDir).filter((f) => !dataBefore.has(f))
  const dataText = walk(dataDir)
    .map((f) => {
      try {
        return fs.readFileSync(f, 'utf8')
      } catch {
        return ''
      }
    })
    .join('\n')
  ok(!dataText.includes(SECRET) && !dataText.includes('molyar massasi'), 'в папке данных нет текста распознавания', `${dataAfter.length} новых файлов`)
  ok(!dataAfter.some((f) => /\.(wav|pcm|raw|webm|ogg)$/i.test(f)), 'в папке данных нет аудиофайлов')
  const tmpNew = safeList(os.tmpdir()).filter((f) => !tmpBefore.has(f) && /\.(wav|pcm|raw|webm|ogg)$/i.test(f))
  ok(tmpNew.length === 0, 'в %TEMP% нет новых аудиофайлов', tmpNew.join(', '))
  const out = captured.filter((l) => !l.startsWith('  ✓') && !l.startsWith('  ✗') && !/^\d\)/.test(l)).join('\n')
  ok(!out.includes(SECRET) && !out.includes('molyar massasi') && !out.includes('sulfuric'), 'в выводе сервера нет текста распознавания')
} finally {
  server.close()
  server.closeAllConnections?.()
  try {
    sidecar.close()
  } catch {
    /* уже закрыт */
  }
  fs.rmSync(dataDir, { recursive: true, force: true })
}

console.log(`\nstt: прошло ${passed}, не прошло ${failed}`)
process.exit(failed ? 1 : 0)

// ——— служебное
function listenFree(srv: http.Server, want: number): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    srv.once('listening', () => resolve((srv.address() as { port: number }).port))
    srv.once('error', (e: NodeJS.ErrnoException) => {
      if (e.code !== 'EADDRINUSE') return reject(e)
      srv.once('error', reject)
      srv.listen(0, '127.0.0.1')
    })
    srv.listen(want, '127.0.0.1')
  })
}
function safeList(dir: string): string[] {
  try {
    return fs.readdirSync(dir)
  } catch {
    return []
  }
}
function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of (() => {
    try {
      return fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return []
    }
  })()) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

/** Живая проверка сервера: /stt/health, клипы или синтетика, p50/p95 при 4 параллельных клиентах. */
async function runLive(base: string): Promise<void> {
  console.log(`stt live: ${base}`)
  const hr = await fetch(`${base}/stt/health`).then((r) => r.json() as Promise<Record<string, unknown>>).catch(() => null)
  const engines = (hr?.engines ?? []) as { name: string; device: string; loaded: boolean }[]
  ok(!!hr && hr.available === true, '/stt/health available', JSON.stringify(engines))
  ok(engines.some((e) => e.name.startsWith('gigaam') && e.device === 'cuda' && e.loaded), 'GigaAM на cuda')
  const dir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'voice', 'clips')
  const clips: { name: string; body: Buffer }[] = safeList(dir)
    .filter((f) => f.endsWith('.wav'))
    .map((f) => ({ name: f, body: fs.readFileSync(path.join(dir, f)) }))
    .filter((c) => {
      const w = parseWav(c.body)
      return !('error' in w) && w.sampleRate === 16000 && w.channels === 1
    })
  if (!clips.length) clips.push({ name: 'синтетика 3 с', body: buildWav({ ms: 3000, tone: 300 }) })
  const one = async (body: Buffer, i: number) => {
    const t0 = performance.now()
    const r = await fetch(`${base}/stt?lang=auto&session=live-${process.pid}-${i}`, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: new Uint8Array(body) })
    const j = (await r.json().catch(() => null)) as Record<string, unknown> | null
    return { status: r.status, ms: performance.now() - t0, j }
  }
  for (const c of clips.slice(0, 6)) {
    const r = await one(c.body, 0)
    ok(r.status === 200, `клип ${c.name}`, `${Math.round(r.ms)} мс, infer ${(r.j?.ms as Record<string, number> | undefined)?.infer} мс, ${r.j?.engine}/${r.j?.device}, lang ${r.j?.lang}: «${String(r.j?.text ?? '').slice(0, 60)}»`)
  }
  const times: number[] = []
  for (let round = 0; round < 5; round++) {
    const rs = await Promise.all([0, 1, 2, 3].map((i) => one(clips[(round + i) % clips.length]!.body, i + 1)))
    for (const r of rs) if (r.status === 200) times.push(r.ms)
  }
  times.sort((a, b) => a - b)
  const q = (p: number) => Math.round(times[Math.min(times.length - 1, Math.floor(p * times.length))] ?? NaN)
  ok(times.length >= 16, `4 параллельных клиента × 5 кругов: p50 ${q(0.5)} мс, p95 ${q(0.95)} мс`, `${times.length}/20 ответов 200`)
}
