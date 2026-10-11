/**
 * npm run brain:server-selftest — проверка «мозга» как ПУБЛИЧНОГО сервера (за туннелем Tailscale Funnel), без Ollama:
 *   1) адрес ученика: заголовки прокси — только с loopback, правый адрес X-Forwarded-For, IPv6 по /64, только хеш;
 *   2) профиль 'gpu' / 'laptop' (keep_alive, окно, очередь), явные правки владельца важнее профиля;
 *   3) сервер на порту 8790 (BRAIN_SELFTEST_PORT) с подменой модели, временная папка данных:
 *      /health без путей и ключей; CORS (разрешён / чужой / localhost / Private Network); 415, 413, 400 на лимиты;
 *      админ 403/200 (пустой ключ — только этот ПК; ключ — заголовок X-Brain-Admin); лимит 429 (минута, сутки)
 *      по адресу из прокси; потоков на ученика; очередь: события queue {position}, переполнение и долгое ожидание →
 *      запасной путь с reason 'busy'; журнал диалогов без адресов, режим 'local'.
 * Код выхода 1, если хоть одна проверка не прошла.
 */
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const PORT = Number(process.env.BRAIN_SELFTEST_PORT || 8790)
const dataDir = path.join(os.tmpdir(), `atomlab-brain-server-selftest-${process.pid}`)
process.env.BRAIN_DATA_DIR = dataDir
delete process.env.BRAIN_PROFILE
delete process.env.BRAIN_ADMIN_TOKEN
delete process.env.BRAIN_NO_DIALOG_LOG
process.env.BRAIN_NO_WARM = '1'
const ORIGIN = 'https://sadykoffalan2105-dev.github.io'

const { applyProfile, DEFAULT_CONFIG, FILES, loadConfig } = await import('../../brain/config.ts')
const { createBrainLazy, createServer } = await import('../../brain/server.ts')
const { MockLlm } = await import('../../brain/llm/mock.ts')
const { clientInfo, hashAddress } = await import('../../brain/http/clientIp.ts')
const { parseSse } = await import('../../brain/sse.ts')

let failed = 0
let passed = 0
const ok = (cond: boolean, what: string, extra = '') => {
  if (cond) passed++
  else failed++
  console.log(`${cond ? '  ✓' : '  ✗'} ${what}${extra ? ' — ' + extra : ''}`)
}

// ——— 1) адрес ученика
console.log('1) адрес ученика (заголовки прокси)')
type FakeReq = Parameters<typeof clientInfo>[0]
const fake = (remoteAddress: string, headers: Record<string, string> = {}): FakeReq => ({ socket: { remoteAddress }, headers: { host: '127.0.0.1:8787', ...headers } }) as unknown as FakeReq
const viaFunnel = clientInfo(fake('127.0.0.1', { 'x-forwarded-for': '203.0.113.7', 'tailscale-funnel-request': '?1', host: 'atomlab.tail1234.ts.net' }))
ok(viaFunnel.key === hashAddress('203.0.113.7') && viaFunnel.forwarded && viaFunnel.funnel && !viaFunnel.local, 'loopback + Funnel: адрес из X-Forwarded-For, не владелец')
ok(clientInfo(fake('::1', { 'x-forwarded-for': '6.6.6.6, 203.0.113.7' })).key === hashAddress('203.0.113.7'), 'X-Forwarded-For: берётся правый адрес (левый мог подставить клиент)')
ok(clientInfo(fake('::ffff:127.0.0.1', { 'x-forwarded-for': '203.0.113.7' })).key === hashAddress('203.0.113.7'), '::ffff:127.0.0.1 — тоже loopback')
const lan = clientInfo(fake('192.168.1.50', { 'x-forwarded-for': '203.0.113.7' }))
ok(lan.key === hashAddress('192.168.1.50') && !lan.local, 'не loopback: X-Forwarded-For игнорируется (подделка из сети)')
ok(clientInfo(fake('127.0.0.1', { 'x-forwarded-for': '203.0.113.7' }), false).key === hashAddress('127.0.0.1'), 'trustProxy=false: заголовкам прокси не верим')
ok(clientInfo(fake('127.0.0.1')).local === true, 'loopback без прокси, Host 127.0.0.1 → владелец')
ok(clientInfo(fake('127.0.0.1', { host: 'evil.example:8787' })).local === false, 'чужой Host (DNS rebinding) → не владелец')
ok(clientInfo(fake('127.0.0.1', { forwarded: 'for="[2001:db8::1]:4711"' })).key === hashAddress('2001:db8::1'), 'Forwarded: for="[v6]:port" разбирается')
ok(hashAddress('2001:db8:1:2::5') === hashAddress('2001:db8:1:2:aaaa::9') && hashAddress('2001:db8:1:2::5') !== hashAddress('2001:db8:1:3::5'), 'IPv6: один ключ на сеть /64')
const k = hashAddress('203.0.113.7')
ok(/^[0-9a-f]{16}$/.test(k) && !k.includes('203') && k !== hashAddress('203.0.113.8'), 'ключ — солёный хеш (16 hex), не адрес')

// ——— 2) профиль
console.log('2) профиль железа')
const gpu = applyProfile({ ...DEFAULT_CONFIG, profile: 'gpu' })
ok(gpu.keepAlive === '-1m' && gpu.keepAliveRefreshMs === 0 && gpu.numCtx === 8192 && gpu.llm.parallel === 4 && gpu.server.rate.exemptLocal === false, "gpu: keep_alive навсегда, без продления, окно 8192, очередь 4, «без прокси» не владелец")
const lap = applyProfile(DEFAULT_CONFIG)
ok(lap.profile === 'laptop' && lap.llm.parallel === 1 && lap.keepAlive === DEFAULT_CONFIG.keepAlive && lap.numCtx === DEFAULT_CONFIG.numCtx, 'laptop: очередь 1, остальное как было')
const own = applyProfile({ ...DEFAULT_CONFIG, profile: 'gpu', numCtx: 6000, llm: { ...DEFAULT_CONFIG.llm, parallel: 2 } })
ok(own.numCtx === 6000 && own.llm.parallel === 2 && own.keepAlive === '-1m', 'явные правки владельца важнее профиля')
process.env.BRAIN_PROFILE = 'gpu'
process.env.BRAIN_ADMIN_TOKEN = 'env-token'
const envCfg = applyProfile(DEFAULT_CONFIG)
ok(envCfg.profile === 'gpu' && envCfg.adminToken === 'env-token' && JSON.stringify(applyProfile(envCfg)) === JSON.stringify(envCfg), 'env BRAIN_PROFILE / BRAIN_ADMIN_TOKEN важнее файла; повторное применение ничего не меняет')
delete process.env.BRAIN_PROFILE
delete process.env.BRAIN_ADMIN_TOKEN

// ——— 3) сервер
console.log(`3) сервер на 127.0.0.1 (данные: ${dataDir})`)
const mock = new MockLlm({ tokenDelayMs: 40 })
const brain = createBrainLazy({ llm: mock, config: { ...loadConfig(), profile: 'laptop' } })
const server = createServer(brain)
// порт 8790 занят (например, забытый тестовый сервер) — берём свободный: проверка не должна падать из-за порта
// (порт — из server.address() после 'listening': колбэк первого listen сработал бы и после второго)
const port = await new Promise<number>((resolve, reject) => {
  server.once('listening', () => resolve((server.address() as { port: number }).port))
  server.once('error', (err: NodeJS.ErrnoException) => {
    if (err.code !== 'EADDRINUSE') return reject(err)
    console.log(`  (порт ${PORT} занят — беру свободный)`)
    server.once('error', reject)
    server.listen(0, '127.0.0.1')
  })
  server.listen(PORT, '127.0.0.1')
})
console.log(`  слушает 127.0.0.1:${port}`)
const cfg = brain.deps.config
const queue = brain.queue!

type Res = { status: number; headers: http.IncomingHttpHeaders; text: string; json: Record<string, unknown> | null }
function call(method: string, p: string, o: { headers?: Record<string, string>; body?: string | Buffer } = {}): Promise<Res> {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: { ...(o.body !== undefined ? { 'Content-Length': String(Buffer.byteLength(o.body)) } : {}), ...o.headers } }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let j: Record<string, unknown> | null = null
        try {
          j = JSON.parse(text)
        } catch {
          j = null
        }
        resolve({ status: res.statusCode ?? 0, headers: res.headers, text, json: j })
      })
    })
    r.on('error', reject)
    if (o.body !== undefined) r.write(o.body)
    r.end()
  })
}
const fwd = (ip: string, extra: Record<string, string> = {}) => ({ 'X-Forwarded-For': ip, 'Tailscale-Funnel-Request': '?1', Host: 'atomlab.tail1234.ts.net', ...extra })
const JSONH = { 'Content-Type': 'application/json' }
const chatBody = (q: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ sessionId: 'selftest', studentId: 'selftest', lang: 'ru', stream: true, messages: [{ role: 'user', content: q }], context: { gradeId: 'g8', mode: 'chat', detail: 'brief' }, ...extra })
type Chat = Res & { events: { event: string; data: Record<string, unknown> }[]; done: Record<string, unknown> | null; meta: Record<string, unknown> | null; queue: Record<string, unknown>[] }
async function chat(q: string, headers: Record<string, string>): Promise<Chat> {
  const r = await call('POST', '/chat', { headers: { ...JSONH, Origin: ORIGIN, ...headers }, body: chatBody(q) })
  const events = r.status === 200 ? (parseSse(r.text) as { event: string; data: Record<string, unknown> }[]) : []
  return {
    ...r,
    events,
    done: events.find((e) => e.event === 'done')?.data ?? null,
    meta: events.find((e) => e.event === 'meta')?.data ?? null,
    queue: events.filter((e) => e.event === 'queue').map((e) => e.data),
  }
}

const h0 = await call('GET', '/health', { headers: { Origin: ORIGIN } })
// защита: отвечает именно наш экземпляр (а не другой сервер на том же порту) — иначе проверки бессмысленны
if (Math.abs(Number(h0.json?.uptimeMs) - (Date.now() - brain.startedAt)) > 3000) {
  console.error(`[brain:server-selftest] на порту ${port} отвечает чужой сервер — остановите его или задайте BRAIN_SELFTEST_PORT`)
  process.exit(1)
}
await brain.ready
const hs = h0.text
ok(h0.status === 200 && h0.json?.ok === true && typeof h0.json?.queue === 'object', '/health отвечает (и пока знания грузятся), есть нагрузка очереди')
ok(!hs.includes(dataDir) && !/dataDir|adminToken|[A-Z]:\\\\|\/Users\/|\/home\//i.test(hs), '/health: ни путей, ни ключей')

console.log('  CORS')
const o1 = await call('OPTIONS', '/chat', { headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Private-Network': 'true' } })
ok(o1.status === 204 && o1.headers['access-control-allow-origin'] === ORIGIN && o1.headers['access-control-allow-private-network'] === 'true', 'GitHub Pages → 204 + Allow-Origin + Allow-Private-Network')
ok(/x-brain-admin/i.test(String(o1.headers['access-control-allow-headers'])), 'Allow-Headers: X-Brain-Admin')
ok((await call('GET', '/health', { headers: { Origin: 'http://localhost:5173' } })).headers['access-control-allow-origin'] === 'http://localhost:5173', 'localhost (разработка) разрешён')
ok((await call('GET', '/health', { headers: { Origin: 'https://evil.example' } })).status === 403, 'чужой Origin → 403')
cfg.server.corsOrigins = [...cfg.server.corsOrigins, 'https://school.example']
cfg.server.corsLocalhost = false
ok((await call('GET', '/health', { headers: { Origin: 'https://school.example' } })).status === 200, 'Origin из config.server.corsOrigins разрешён')
ok((await call('GET', '/health', { headers: { Origin: 'http://localhost:5173' } })).status === 403, 'corsLocalhost=false → localhost запрещён')
cfg.server.corsOrigins = [...DEFAULT_CONFIG.server.corsOrigins]
cfg.server.corsLocalhost = true

console.log('  тело запроса')
const P = fwd('198.51.100.1')
ok((await call('POST', '/chat', { headers: { ...P, 'Content-Type': 'text/plain' }, body: chatBody('Что такое оксид?') })).status === 415, 'text/plain → 415 (простые запросы без preflight не принимаются)')
const big = await call('POST', '/chat', { headers: { ...P, ...JSONH }, body: chatBody('x'.repeat(70 * 1024)) })
ok(big.status === 413 && (big.json?.error as { code?: string })?.code === 'too_large', 'тело > 64 КБ → 413')
const many = JSON.stringify({ messages: Array.from({ length: 13 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'оксид' })) })
ok((await call('POST', '/chat', { headers: { ...P, ...JSONH }, body: many })).status === 400, '13 сообщений → 400')
ok((await call('POST', '/chat', { headers: { ...P, ...JSONH }, body: chatBody('а'.repeat(4001)) })).status === 400, 'сообщение > 4000 символов → 400')

console.log('  админ')
const entry = JSON.stringify({ kind: 'note', lang: 'ru', text: 'Проверка server-selftest: запись админа.', tags: ['selftest'] })
ok((await call('POST', '/kb/append', { headers: JSONH, body: entry })).status === 200, 'ключ пуст: этот ПК напрямую → /kb/append 200')
ok((await call('POST', '/kb/append', { headers: { ...JSONH, ...fwd('203.0.113.50') }, body: entry })).status === 403, 'ключ пуст: через туннель → 403')
ok((await call('POST', '/kb/append', { headers: { ...JSONH, Host: 'evil.example' }, body: entry })).status === 403, 'ключ пуст: чужой Host → 403')
const st403 = await call('GET', '/kb/stats', { headers: fwd('203.0.113.50') })
ok(st403.status === 403 && !st403.text.includes(dataDir), '/kb/stats через туннель → 403, путь не виден')
ok((await call('GET', '/kb/stats')).status === 200, '/kb/stats с этого ПК → 200')
cfg.adminToken = 'selftest-admin-7f3a9c'
ok((await call('GET', '/kb/stats')).status === 403, 'ключ задан: без заголовка → 403 (даже с этого ПК)')
ok((await call('GET', '/kb/stats', { headers: { 'X-Brain-Admin': 'wrong' } })).status === 403, 'неверный ключ → 403')
ok((await call('POST', '/kb/append', { headers: { ...JSONH, ...fwd('203.0.113.50'), 'X-Brain-Admin': cfg.adminToken }, body: entry })).status === 200, 'верный ключ через туннель → 200')
const adm = await call('GET', '/admin/status', { headers: { 'X-Brain-Admin': cfg.adminToken } })
ok(adm.status === 200 && adm.json?.adminToken === 'set' && !adm.text.includes(cfg.adminToken), '/admin/status: ключ не показывается')
cfg.adminToken = ''

console.log('  лимиты частоты')
const A = fwd('203.0.113.10')
let allBad = true
for (let i = 0; i < cfg.server.rate.chatPerMin; i++) if ((await call('POST', '/chat', { headers: { ...A, ...JSONH }, body: '{}' })).status !== 400) allBad = false
const r429 = await call('POST', '/chat', { headers: { ...A, ...JSONH }, body: '{}' })
ok(allBad && r429.status === 429 && r429.json?.error === 'rate' && Number(r429.json?.retryAfterSec) > 0 && Number(r429.headers['retry-after']) > 0, `/chat: ${cfg.server.rate.chatPerMin} в минуту, дальше 429 {error:'rate', retryAfterSec}`, `retryAfterSec=${r429.json?.retryAfterSec}`)
ok((await call('POST', '/chat', { headers: { ...JSONH, 'X-Forwarded-For': '9.9.9.9, 203.0.113.10' }, body: '{}' })).status === 429, 'подставной левый адрес X-Forwarded-For лимит не обходит')
ok((await call('POST', '/chat', { headers: { ...fwd('203.0.113.11'), ...JSONH }, body: '{}' })).status === 400, 'другой ученик (другой адрес из прокси) не ограничен')
ok((await call('POST', '/chat', { headers: JSONH, body: '{}' })).status === 400, 'владелец с этого ПК (exemptLocal) не ограничен')
let healthOk = true
for (let i = 0; i < 20; i++) if ((await call('GET', '/health', { headers: A })).status !== 200) healthOk = false
ok(healthOk, '/health щедрый: 20 подряд от ограниченного ученика → 200')
cfg.server.rate.chatPerDay = 3
const D = fwd('203.0.113.12')
for (let i = 0; i < 3; i++) await call('POST', '/chat', { headers: { ...D, ...JSONH }, body: '{}' })
const day = await call('POST', '/chat', { headers: { ...D, ...JSONH }, body: '{}' })
ok(day.status === 429 && day.json?.rule === 'chat_day' && Number(day.json?.retryAfterSec) > 3600, 'суточный лимит → 429 rule chat_day, ждать часы', `retryAfterSec=${day.json?.retryAfterSec}`)
cfg.server.rate.chatPerDay = DEFAULT_CONFIG.server.rate.chatPerDay

console.log('  очередь к модели (parallel 1)')
queue.opts = { parallel: 1, queueCap: 1, queueWaitMs: 15_000 }
const Q = 'Что такое оксиды?'
const p1 = chat(Q, fwd('198.51.100.21'))
await new Promise((r) => setTimeout(r, 150))
const p2 = chat(Q, fwd('198.51.100.22'))
await new Promise((r) => setTimeout(r, 150))
const p3 = chat(Q, fwd('198.51.100.23'))
const [q1, q2, q3] = await Promise.all([p1, p2, p3])
ok(q1.status === 200 && q1.done?.route === 'llm' && !q1.queue.length, 'первый — сразу к модели', `route=${q1.done?.route}`)
ok(q2.queue[0]?.position === 1 && q2.queue.some((e) => e.position === 0) && q2.done?.route === 'llm' && q2.done?.reason !== 'busy', 'второй — событие queue {position:1}, дождался (position 0) и ответила модель', JSON.stringify(q2.queue))
ok(q3.done?.reason === 'busy' && q3.meta?.reason === 'busy' && q3.done?.route !== 'llm' && String(q3.done?.text ?? '').length > 20, 'третий (очередь полна) — сразу запасной путь, reason busy', `route=${q3.done?.route}`)
queue.opts = { parallel: 1, queueCap: 5, queueWaitMs: 300 }
const p4 = chat(Q, fwd('198.51.100.24'))
await new Promise((r) => setTimeout(r, 150))
const q5 = await chat(Q, fwd('198.51.100.25'))
const q4 = await p4
ok(q5.queue[0]?.position === 1 && q5.done?.reason === 'busy' && q5.done?.route !== 'llm' && !!q5.done?.text, 'ждал дольше queueWaitMs — запасной путь, reason busy', `ждал ≥ 300 мс, route=${q5.done?.route}`)
ok(q4.done?.route === 'llm', 'тот, кто занимал модель, ответил моделью')
const qs = queue.stats()
ok(qs.running === 0 && qs.waiting === 0 && qs.busyOverflow >= 1 && qs.busyTimeout >= 1, 'очередь пуста после ответов, счётчики busy', JSON.stringify({ served: qs.served, overflow: qs.busyOverflow, timeout: qs.busyTimeout }))

console.log('  потоки на ученика')
// ждать можно долго: второй поток ученика стоит в очереди (не уходит сразу в busy), пока приходит третий
queue.opts = { parallel: 1, queueCap: 5, queueWaitMs: 15_000 }
const S = fwd('198.51.100.30')
const sp = [chat(Q, S), chat(Q, S)]
await new Promise((r) => setTimeout(r, 100))
const s3 = await chat(Q, S)
await Promise.all(sp)
ok(s3.status === 429 && s3.json?.rule === 'streams', `третий одновременный поток одного ученика → 429 (лимит ${cfg.server.chatStreamsPerClient})`)

console.log('  оценка ожидания')
queue.opts = { parallel: 1, queueCap: 5, queueWaitMs: 600 }
const p6 = chat(Q, fwd('198.51.100.26'))
await new Promise((r) => setTimeout(r, 150))
const t7 = Date.now()
const q7 = await chat(Q, fwd('198.51.100.27'))
const ms7 = Date.now() - t7
await p6
ok(!q7.queue.length && q7.done?.reason === 'busy' && queue.stats().busyPredicted >= 1, 'по замерам не дождаться за queueWaitMs → сразу запасной путь (reason busy), без пустого ожидания', `${ms7} мс, оценка по ${queue.stats().served} ответам`)

console.log('  журнал диалогов')
const lines = () => (fs.existsSync(FILES.dialogs) ? fs.readFileSync(FILES.dialogs, 'utf8').split('\n').filter(Boolean).length : 0)
const log = fs.existsSync(FILES.dialogs) ? fs.readFileSync(FILES.dialogs, 'utf8') : ''
ok(lines() > 0 && !/198\.51\.100|203\.0\.113|ts\.net|x-forwarded/i.test(log), 'в журнале диалогов нет адресов и заголовков прокси', `${lines()} строк`)
cfg.server.dialogLog = 'local'
const n0 = lines()
await chat('Что такое моль?', fwd('198.51.100.40'))
const n1 = lines()
await chat('Что такое моль?', {})
const n2 = lines()
ok(n1 === n0 && n2 === n0 + 1, "dialogLog 'local': ученики из интернета не пишутся, владелец — пишется", `${n0} → ${n1} → ${n2}`)
cfg.server.dialogLog = 'off'
await chat('Что такое моль?', {})
ok(lines() === n2, "dialogLog 'off': не пишется никто")

server.close()
server.closeAllConnections?.()
try {
  fs.rmSync(dataDir, { recursive: true, force: true })
} catch {
  /* временная папка — не страшно */
}
console.log(`\n[brain:server-selftest] ${passed} ✓, ${failed} ✗`)
process.exit(failed ? 1 : 0)
