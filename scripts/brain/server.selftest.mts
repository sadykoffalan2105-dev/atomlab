/**
 * npm run brain:server-selftest — проверка «мозга» как ПУБЛИЧНОГО сервера (за туннелем Tailscale Funnel), без Ollama:
 *   1) адрес ученика: заголовки прокси — только с loopback, правый адрес X-Forwarded-For, IPv6 по /64, только хеш;
 *   2) профиль 'gpu' / 'laptop' (keep_alive, окно, очередь), явные правки владельца важнее профиля;
 *   3) сервер на порту 8790 (BRAIN_SELFTEST_PORT) с подменой модели, временная папка данных:
 *      /health без путей и ключей; CORS (разрешён / чужой / localhost / Private Network); 415, 413, 400 на лимиты;
 *      админ 403/200 (пустой ключ — только этот ПК; ключ — заголовок X-Brain-Admin); лимит 429 (минута, сутки)
 *      по адресу из прокси; потоков на ученика; очередь: события queue {position}, переполнение и долгое ожидание →
 *      запасной путь с reason 'busy'; журнал диалогов без адресов, режим 'local';
 *   4) школьный NAT: лимиты на ученика по паре «адрес + X-Brain-Session» (30 сессий за одним адресом проходят, одна
 *      сессия сверх 8/мин → 429), потолок адреса (config.server.rate.perIp), кривой заголовок игнорируется (лимит по адресу),
 *      потоки /chat и фото — на ученика, preflight OPTIONS класса не упирается в лимит «прочего».
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
const { clientInfo, hashAddress, studentKey } = await import('../../brain/http/clientIp.ts')
const { RateLimiter } = await import('../../brain/http/rateLimit.ts')
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

// ——— 1б) ученик за школьным NAT: адрес + сессия сайта
console.log('1б) ученик = адрес + X-Brain-Session')
{
  const SID = 's-0f6c2a9e-3b1d-4c8e-9a7f-2d5e6b8c1a40'
  const withS = clientInfo(fake('127.0.0.1', { 'x-forwarded-for': '203.0.113.7', 'x-brain-session': SID }))
  ok(withS.session && withS.key === hashAddress('203.0.113.7') && withS.student !== withS.key && withS.student === studentKey(withS.key, SID), 'верная сессия: ключ ученика ≠ ключ адреса, ключ адреса прежний')
  ok(!withS.student.includes(SID) && /^s[0-9a-f]{16}$/.test(withS.student), 'ключ ученика — солёный хеш, сессии в нём нет')
  const otherIp = clientInfo(fake('127.0.0.1', { 'x-forwarded-for': '203.0.113.8', 'x-brain-session': SID }))
  ok(otherIp.student !== withS.student, 'та же сессия с другого адреса — другой ученик (чужую сессию извне не «занять»)')
  const bad = ['short', 'плохая-сессия-123', 'bad id with spaces', 'a'.repeat(65), 'abc.def.ghi', '']
  ok(
    bad.every((v) => {
      const c = clientInfo(fake('127.0.0.1', { 'x-forwarded-for': '203.0.113.7', 'x-brain-session': v }))
      return !c.session && c.student === c.key
    }),
    'кривой заголовок (короткий, кириллица, пробелы, > 64, точки, пустой) игнорируется: ученик = адрес',
  )
  const dup = clientInfo({ socket: { remoteAddress: '127.0.0.1' }, headers: { host: '127.0.0.1:8787', 'x-forwarded-for': '203.0.113.7', 'x-brain-session': ['sessionA-123', 'sessionB-456'] } } as unknown as FakeReq)
  ok(!dup.session && dup.student === dup.key, 'заголовок повторён — игнорируется')
  // ограничитель: отказ по потолку не съедает лимит ученика (и наоборот)
  let t = 0
  const rl = new RateLimiter(() => t)
  const stu = [{ name: 's_min', windowMs: 60_000, max: 2 }]
  const ceil = [{ name: 'ip_min', windowMs: 60_000, max: 3 }]
  const both = (st: string) => rl.hitAll([{ group: 'g', key: st, rules: stu }, { group: 'g_ip', key: 'ip', rules: ceil }])
  const v = ['st1', 'st2', 'st3'].map((k) => both(k).ok)
  const v4 = both('st1')
  t += 61_000
  const v5 = both('st1')
  const v6 = both('st1')
  const v7 = both('st1')
  ok(v.every(Boolean) && !v4.ok && v4.rule === 'ip_min' && v5.ok && v6.ok && !v7.ok && v7.rule === 's_min', 'hitAll: потолок адреса и лимит ученика, отказ не засчитывается ни в один счётчик')
}

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

console.log('  школьный NAT: лимиты на ученика (адрес + X-Brain-Session), потолок адреса')
{
  const SCHOOL = '203.0.113.77'
  const sess = (i: number) => `s-school-${String(i).padStart(3, '0')}-7f3a`
  const S = (i: number) => ({ ...fwd(SCHOOL), ...JSONH, 'X-Brain-Session': sess(i) })
  // 30 учеников класса за одним адресом, по 2 вопроса каждый (60 > 8/мин адреса по-старому) — никто не упёрся в лимит
  const codes: number[] = []
  for (let round = 0; round < 2; round++) for (let i = 0; i < 30; i++) codes.push((await call('POST', '/chat', { headers: S(i), body: '{}' })).status)
  ok(codes.length === 60 && codes.every((c) => c === 400), '30 сессий за одним адресом, по 2 вопроса — все прошли лимит (нет 429)', `${codes.filter((c) => c === 429).length}×429`)
  // один ученик (сессия) сверх 8/мин — 429; соседи по классу не задеты
  const over: number[] = []
  for (let i = 0; i < cfg.server.rate.chatPerMin - 2; i++) over.push((await call('POST', '/chat', { headers: S(0), body: '{}' })).status)
  const r429 = await call('POST', '/chat', { headers: S(0), body: '{}' })
  ok(over.every((c) => c === 400) && r429.status === 429 && r429.json?.rule === 'chat_minute' && Number(r429.headers['retry-after']) > 0, `одна сессия: ${cfg.server.rate.chatPerMin}/мин, дальше 429 rule chat_minute`, `${r429.status} ${String(r429.json?.rule)}`)
  ok((await call('POST', '/chat', { headers: S(1), body: '{}' })).status === 400, 'сосед по классу (другая сессия, тот же адрес) не ограничен')
  ok((await call('POST', '/chat', { headers: { ...fwd('203.0.113.78'), ...JSONH, 'X-Brain-Session': sess(0) }, body: '{}' })).status === 400, 'та же сессия с другого адреса — другой ученик')
  // кривой заголовок игнорируется: лимит по адресу, как без заголовка
  const B = fwd('203.0.113.79')
  const badCodes: number[] = []
  for (let i = 0; i < cfg.server.rate.chatPerMin; i++) badCodes.push((await call('POST', '/chat', { headers: { ...B, ...JSONH, 'X-Brain-Session': `bad id ${i}` }, body: '{}' })).status)
  const badOver = await call('POST', '/chat', { headers: { ...B, ...JSONH, 'X-Brain-Session': 'x' }, body: '{}' })
  ok(badCodes.every((c) => c === 400) && badOver.status === 429 && badOver.json?.rule === 'chat_minute', 'кривой X-Brain-Session игнорируется: смена кривых значений лимит адреса не обходит')
  ok((await call('POST', '/chat', { headers: { ...B, ...JSONH }, body: '{}' })).status === 429, 'без заголовка — лимит по адресу (как раньше)')
  // потолок адреса: смена сессий не обходит защиту
  const ip = cfg.server.rate.perIp
  const keep = ip.chatPerMin
  ip.chatPerMin = 20
  const C = fwd('203.0.113.80')
  const rot: number[] = []
  for (let i = 0; i < 20; i++) rot.push((await call('POST', '/chat', { headers: { ...C, ...JSONH, 'X-Brain-Session': `s-rotate-${i}-abcdef` }, body: '{}' })).status)
  const ceil = await call('POST', '/chat', { headers: { ...C, ...JSONH, 'X-Brain-Session': 's-rotate-new-abcdef' }, body: '{}' })
  ok(rot.every((c) => c === 400) && ceil.status === 429 && ceil.json?.rule === 'chat_ip_minute' && Number(ceil.headers['retry-after']) > 0, 'потолок адреса (perIp.chatPerMin): новые сессии сверх него → 429 rule chat_ip_minute', `${ceil.status} ${String(ceil.json?.rule)}`)
  ip.chatPerMin = keep
  ip.chatPerDay = 25
  const E = fwd('203.0.113.81')
  for (let i = 0; i < 25; i++) await call('POST', '/chat', { headers: { ...E, ...JSONH, 'X-Brain-Session': `s-day-${i}-abcdef` }, body: '{}' })
  const dayCeil = await call('POST', '/chat', { headers: { ...E, ...JSONH, 'X-Brain-Session': 's-day-new-abcdef' }, body: '{}' })
  ok(dayCeil.status === 429 && dayCeil.json?.rule === 'chat_ip_day' && Number(dayCeil.json?.retryAfterSec) > 3600, 'суточный потолок адреса (perIp.chatPerDay) → 429 rule chat_ip_day', `${dayCeil.status} ${String(dayCeil.json?.rule)}`)
  ip.chatPerDay = DEFAULT_CONFIG.server.rate.perIp.chatPerDay
  // preflight класса: OPTIONS — свой щедрый потолок адреса, а не «прочее» 60/мин
  const PRE = { ...fwd('203.0.113.82'), Origin: ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-brain-session' }
  const pre: number[] = []
  for (let i = 0; i < cfg.server.rate.otherPerMin + 15; i++) pre.push((await call('OPTIONS', '/chat', { headers: PRE })).status)
  ok(pre.every((c) => c === 204), `preflight OPTIONS: ${pre.length} с одного адреса (> прочих ${cfg.server.rate.otherPerMin}/мин) → все 204`)
  const pf = await call('OPTIONS', '/chat', { headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-brain-session' } })
  ok(/x-brain-session/i.test(String(pf.headers['access-control-allow-headers'])), 'CORS Allow-Headers: X-Brain-Session')
  const adm = await call('GET', '/admin/status')
  ok(((adm.json?.rate as { limits?: { perIp?: { chatPerMin?: number } } })?.limits?.perIp?.chatPerMin ?? 0) > cfg.server.rate.chatPerMin, '/admin/status показывает потолок адреса')
}

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

console.log('  потоки за школьным NAT')
{
  queue.opts = { parallel: 1, queueCap: 8, queueWaitMs: 15_000 }
  const N = (i: number) => ({ ...fwd('198.51.100.35'), 'X-Brain-Session': `s-stream-${i}-abcdef` })
  const all = await Promise.all([chat(Q, N(1)), chat(Q, N(2)), chat(Q, N(3))])
  ok(all.every((r) => r.status === 200), `3 одновременных потока с одного адреса от разных сессий — все 200 (лимит ${cfg.server.chatStreamsPerClient} — на ученика)`, all.map((r) => r.status).join(','))
  const ip = cfg.server.rate.perIp
  ip.chatStreams = 2
  const M = (i: number) => ({ ...fwd('198.51.100.36'), 'X-Brain-Session': `s-ceil-${i}-abcdef` })
  const mp = [chat(Q, M(1)), chat(Q, M(2))]
  await new Promise((r) => setTimeout(r, 100))
  const m3 = await chat(Q, M(3))
  await Promise.all(mp)
  ok(m3.status === 429 && m3.json?.rule === 'streams_ip', 'потолок потоков адреса (perIp.chatStreams=2): третий → 429 rule streams_ip', `${m3.status} ${String(m3.json?.rule)}`)
  ip.chatStreams = DEFAULT_CONFIG.server.rate.perIp.chatStreams
  const after = await chat(Q, M(4))
  ok(after.status === 200, 'потоки закрылись — счётчики адреса и ученика освобождены')
}

console.log('  оценка ожидания')
queue.opts = { parallel: 1, queueCap: 5, queueWaitMs: 600 }
const p6 = chat(Q, fwd('198.51.100.26'))
await new Promise((r) => setTimeout(r, 150))
const t7 = Date.now()
const q7 = await chat(Q, fwd('198.51.100.27'))
const ms7 = Date.now() - t7
await p6
ok(!q7.queue.length && q7.done?.reason === 'busy' && queue.stats().busyPredicted >= 1, 'по замерам не дождаться за queueWaitMs → сразу запасной путь (reason busy), без пустого ожидания', `${ms7} мс, оценка по ${queue.stats().served} ответам`)

console.log('  фото задачи (лимиты, сигнатура, журнал)')
{
  // модель подменная без зрения: фото проходят проверки, а ответ — честное «фото не читаю» (reason no_vision)
  const ph = cfg.server.photo
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(90 * 1024, 5)]).toString('base64')
  const photoBody = (images: string[], q = 'Объясни задачу') =>
    JSON.stringify({ sessionId: 'selftest-photo', lang: 'ru', stream: true, messages: [{ role: 'user', content: q, images }], context: { gradeId: 'g8', mode: 'chat', detail: 'brief' } })
  const F = fwd('198.51.100.60')
  const big = photoBody([jpeg])
  const p1 = await call('POST', '/chat', { headers: { ...F, ...JSONH, Origin: ORIGIN }, body: big })
  const ev1 = p1.status === 200 ? (parseSse(p1.text) as { event: string; data: Record<string, unknown> }[]) : []
  const d1 = ev1.find((e) => e.event === 'done')?.data
  ok(Buffer.byteLength(big) > cfg.server.bodyLimitBytes && p1.status === 200 && d1?.reason === 'no_vision' && /не умеет работать с картинками/.test(String(d1?.text)), 'фото > 64 КБ: тело принято (лимит с фото выше), модель без зрения → честно, reason no_vision', `${p1.status} ${String(d1?.reason)}`)
  const meta1 = ev1.find((e) => e.event === 'meta')?.data
  ok(meta1?.reason === 'no_vision', 'meta: reason no_vision')
  const three = await call('POST', '/chat', { headers: { ...fwd('198.51.100.61'), ...JSONH }, body: photoBody([jpeg, jpeg, jpeg]) })
  ok(three.status === 400 && (three.json?.error as { code?: string })?.code === 'too_many_images', 'три фото → 400 too_many_images')
  const hugeImg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(ph.maxImageBytes + 10, 1)]).toString('base64')
  const r413 = await call('POST', '/chat', { headers: { ...fwd('198.51.100.62'), ...JSONH }, body: photoBody([hugeImg]) })
  ok(r413.status === 413 && (r413.json?.error as { code?: string })?.code === 'image_too_large', 'фото > 1,5 МБ → 413 image_too_large')
  // тело больше лимита с фото: отказ по Content-Length сразу, без чтения (само тело не шлём — иначе сокет рвётся раньше ответа)
  const r413b = await call('POST', '/chat', { headers: { ...fwd('198.51.100.63'), ...JSONH, 'Content-Length': String(ph.bodyLimitBytes + 1) } })
  ok(r413b.status === 413 && (r413b.json?.error as { code?: string })?.code === 'too_large', `тело > ${Math.round(ph.bodyLimitBytes / 1048576)} МБ → 413 too_large (и с фото)`)
  const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(200, 3)]).toString('base64')
  const r415 = await call('POST', '/chat', { headers: { ...fwd('198.51.100.64'), ...JSONH }, body: photoBody([gif]) })
  ok(r415.status === 415 && (r415.json?.error as { code?: string })?.code === 'bad_image', 'не JPEG/PNG/WebP (сигнатура GIF) → 415')
  const fake = Buffer.from('<script>alert(1)</script>'.repeat(4)).toString('base64')
  ok((await call('POST', '/chat', { headers: { ...fwd('198.51.100.65'), ...JSONH }, body: photoBody([fake]) })).status === 415, 'текст под видом фото → 415')
  // отдельный лимит фото: perMin в минуту, дальше 429 rule photo_minute; текстовые вопросы того же ученика идут
  const L = fwd('198.51.100.66')
  const small = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 5)]).toString('base64')
  let photosOk = true
  for (let i = 0; i < ph.perMin; i++) if ((await call('POST', '/chat', { headers: { ...L, ...JSONH }, body: photoBody([small]) })).status !== 200) photosOk = false
  const r429 = await call('POST', '/chat', { headers: { ...L, ...JSONH }, body: photoBody([small]) })
  ok(photosOk && r429.status === 429 && r429.json?.rule === 'photo_minute' && Number(r429.headers['retry-after']) > 0, `фото: ${ph.perMin} в минуту, дальше 429 rule photo_minute`, `${r429.status} ${String(r429.json?.rule)}`)
  const nb = await call('POST', '/chat', { headers: { ...L, ...JSONH, 'X-Brain-Session': 's-photo-neighbour-01' }, body: photoBody([small]) })
  ok(nb.status === 200, 'фото: сосед с тем же адресом, но своей сессией — не ограничен чужим лимитом фото', String(nb.status))
  const ipPh = cfg.server.rate.perIp
  const keepPh = ipPh.photoPerMin
  ipPh.photoPerMin = 2
  const PI = fwd('198.51.100.68')
  for (let i = 0; i < 2; i++) await call('POST', '/chat', { headers: { ...PI, ...JSONH, 'X-Brain-Session': `s-photo-ip-${i}-ab` }, body: photoBody([small]) })
  const phCeil = await call('POST', '/chat', { headers: { ...PI, ...JSONH, 'X-Brain-Session': 's-photo-ip-new-ab' }, body: photoBody([small]) })
  ok(phCeil.status === 429 && phCeil.json?.rule === 'photo_ip_minute', 'потолок фото адреса (perIp.photoPerMin) → 429 rule photo_ip_minute', `${phCeil.status} ${String(phCeil.json?.rule)}`)
  ipPh.photoPerMin = keepPh
  const txt = await call('POST', '/chat', { headers: { ...L, ...JSONH }, body: chatBody('Что такое моль?') })
  ok(txt.status === 200, 'тот же ученик без фото — не ограничен лимитом фото')
  const empty = await call('POST', '/chat', { headers: { ...fwd('198.51.100.67'), ...JSONH }, body: photoBody([small], '') })
  ok(empty.status === 200 && /не умеет работать с картинками/.test(empty.text), 'фото без подписи (content "") — принято, текст по умолчанию')
  const logNow = fs.existsSync(FILES.dialogs) ? fs.readFileSync(FILES.dialogs, 'utf8') : ''
  const photoLines = logNow.split('\n').filter((l) => l.includes('"hasImage":true'))
  ok(photoLines.length >= ph.perMin + 1 && !logNow.includes(small.slice(0, 40)) && !logNow.includes(jpeg.slice(0, 40)), 'журнал: строки с фото помечены hasImage, base64 картинок нет', `${photoLines.length} строк с фото`)
}

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
