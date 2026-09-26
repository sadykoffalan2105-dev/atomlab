#!/usr/bin/env node
/**
 * Агент устройства (src/admin/deviceAgent.ts): инертность, подключение, пульс, команды, 401, события.
 * fetch, таймеры, хранилище и случайность подменены — сеть не нужна.
 * Запуск: npx tsx scripts/test-device-agent.mts
 */
import assert from 'node:assert/strict'
import {
  collectDeviceInfo,
  createDeviceAgent,
  DEVICE_STORAGE_KEY,
  HIDDEN_HEARTBEAT_FACTOR,
  normalizeEnrollCode,
  shortUserAgent,
  type DeviceAgentConfig,
  type DeviceAgentEnv,
} from '../src/admin/deviceAgent.ts'

type Call = { url: string; fn: string; headers: Record<string, string>; body: any; keepalive?: boolean }
type Reply = { status: number; body?: unknown } | Error

const CONFIG: DeviceAgentConfig = { baseUrl: 'https://demo.supabase.co/', anonKey: 'anon-public-key' }

function makeHarness(config: DeviceAgentConfig | null, opts?: { hidden?: boolean; storage?: Map<string, string> }) {
  const calls: Call[] = []
  const replies = new Map<string, Reply[]>()
  const store = opts?.storage ?? new Map<string, string>()
  let clock = 1_000_000
  let hidden = opts?.hidden ?? false
  const timers: { id: number; at: number; fn: () => void }[] = []
  let timerSeq = 0
  const effects: string[] = []

  const env: DeviceAgentEnv = {
    fetch: async (input, init) => {
      const fn = input.split('/functions/v1/')[1] ?? input
      calls.push({
        url: input,
        fn,
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: init?.body ? JSON.parse(String(init.body)) : null,
        keepalive: init?.keepalive,
      })
      const queue = replies.get(fn)
      const r: Reply = queue && queue.length ? queue.shift()! : { status: 200, body: {} }
      if (r instanceof Error) throw r
      const text = r.body === undefined ? '' : JSON.stringify(r.body)
      return new Response(text, { status: r.status })
    },
    storage: {
      getItem: (k) => (store.has(k) ? store.get(k)! : null),
      setItem: (k, v) => void store.set(k, v),
      removeItem: (k) => void store.delete(k),
    },
    now: () => clock,
    random: () => 0.5,
    setTimeout: (fn, ms) => {
      const id = ++timerSeq
      timers.push({ id, at: clock + ms, fn })
      return id
    },
    clearTimeout: (id) => {
      const i = timers.findIndex((t) => t.id === id)
      if (i >= 0) timers.splice(i, 1)
    },
    isHidden: () => hidden,
    getRoute: () => '/learn/g/g7',
    getAccountId: () => null,
    getScreen: () => '1920×1080',
    appVersion: '1.11.0',
    getDeviceInfo: (name) =>
      collectDeviceInfo(
        {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
          maxTouchPoints: 10,
          screenWidth: 1920,
          screenHeight: 1080,
          desktopApp: false,
          appVersion: '1.11.0',
        },
        name,
      ),
    onReload: () => void effects.push('reload'),
    onLogout: () => void effects.push('logout'),
    onUpdateNow: () => void effects.push('update_now'),
  }

  const agent = createDeviceAgent(config, env)

  async function settle() {
    for (let i = 0; i < 20; i++) await Promise.resolve()
    await new Promise((r) => setImmediate(r))
  }

  return {
    agent,
    calls,
    store,
    effects,
    timers,
    reply(fn: string, ...rs: Reply[]) {
      replies.set(fn, [...(replies.get(fn) ?? []), ...rs])
    },
    setHidden(v: boolean) {
      hidden = v
    },
    /** промотать время до ближайшего таймера и выполнить его */
    async fireNext(): Promise<number> {
      timers.sort((a, b) => a.at - b.at)
      const t = timers.shift()
      assert.ok(t, 'ожидался запланированный таймер')
      const waited = t.at - clock
      clock = t.at
      t.fn()
      await settle()
      return waited
    },
    advance(ms: number) {
      clock += ms
    },
    settle,
  }
}

const ENROLL_OK = {
  status: 200,
  body: { deviceId: 'dev-1', deviceToken: 'tok-secret', schoolId: 'sch-12', classId: 'cls-7a', heartbeatSec: 60, schoolName: 'Школа №12' },
}

let passed = 0
async function test(name: string, fn: () => Promise<void> | void) {
  await fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log('deviceAgent')

await test('код подключения: нормализация и проверка', () => {
  assert.equal(normalizeEnrollCode(' 7k2-qm9 '), '7K2-QM9')
  assert.equal(normalizeEnrollCode('ab12cd'), 'AB12CD')
  assert.equal(normalizeEnrollCode('12345'), null)
  assert.equal(normalizeEnrollCode('ABCDEFGHJ'), null)
  assert.equal(normalizeEnrollCode('AB<12>CD'), null)
})

await test('сведения об устройстве: доска, веб, короткий userAgent', () => {
  const info = collectDeviceInfo(
    {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36',
      maxTouchPoints: 10,
      screenWidth: 1920,
      screenHeight: 1080,
      desktopApp: false,
      appVersion: '1.11.0',
    },
    '',
  )
  assert.equal(info.kind, 'board')
  assert.equal(info.platform, 'web')
  assert.equal(info.screen, '1920×1080')
  assert.equal(info.userAgent, 'Chrome 130 / Windows 10/11')
  assert.match(info.name, /^ATOMLAB · /)
  assert.equal(shortUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel) Chrome/129.0 Mobile Safari/537.36'), 'Chrome 129 / Android 14')
  const desk = collectDeviceInfo(
    { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Electron/33.0.0 Chrome/130', maxTouchPoints: 0, screenWidth: 1366, screenHeight: 768, desktopApp: true, appVersion: '1.11.0' },
    'ПК-12 каб. 204',
  )
  assert.equal(desk.platform, 'windows')
  assert.equal(desk.kind, 'desktop')
  assert.equal(desk.name, 'ПК-12 каб. 204')
})

await test('без адреса сервера — полностью инертен (ни одного запроса, хранилище не читается)', async () => {
  const store = new Map([[DEVICE_STORAGE_KEY, JSON.stringify({ deviceId: 'x', deviceToken: 'y', schoolId: 'z', classId: null, heartbeatSec: 60 })]])
  const h = makeHarness(null, { storage: store })
  h.agent.start()
  assert.equal(h.agent.getState().configured, false)
  assert.equal(h.agent.getState().enrolled, false)
  const r = await h.agent.enroll('7K2-QM9')
  assert.deepEqual(r, { ok: false, error: 'not_configured' })
  await h.agent.heartbeatNow()
  h.agent.track('route_view', '/learn')
  await h.agent.flushUsage()
  assert.equal(h.calls.length, 0)
  assert.equal(h.timers.length, 0)
  assert.equal(h.agent.pendingUsage(), 0)
})

await test('адрес задан, но устройство не подключено — ни одного запроса', async () => {
  const h = makeHarness(CONFIG)
  h.agent.start()
  await h.agent.heartbeatNow()
  h.agent.track('lesson_open', 'g7/c1-s01')
  await h.agent.flushUsage()
  assert.equal(h.agent.getState().configured, true)
  assert.equal(h.agent.getState().enrolled, false)
  assert.equal(h.calls.length, 0)
  assert.equal(h.timers.length, 0)
  const bad = await h.agent.enroll('12')
  assert.deepEqual(bad, { ok: false, error: 'bad_code' })
  assert.equal(h.calls.length, 0, 'неверный код не уходит на сервер')
})

await test('подключение по коду: запрос, заголовки, хранение токена', async () => {
  const h = makeHarness(CONFIG)
  h.reply('device-enroll', ENROLL_OK)
  const r = await h.agent.enroll('7k2-qm9', 'Доска 7А')
  assert.deepEqual(r, { ok: true })
  assert.equal(h.calls.length, 1)
  const c = h.calls[0]
  assert.equal(c.url, 'https://demo.supabase.co/functions/v1/device-enroll')
  assert.equal(c.headers.apikey, 'anon-public-key')
  assert.equal(c.headers['Content-Type'], 'application/json')
  assert.equal(c.body.code, '7K2-QM9')
  assert.equal(c.body.device.name, 'Доска 7А')
  assert.equal(c.body.device.kind, 'board')
  assert.equal(c.body.device.appVersion, '1.11.0')
  const saved = JSON.parse(h.store.get(DEVICE_STORAGE_KEY)!)
  assert.equal(saved.deviceId, 'dev-1')
  assert.equal(saved.deviceToken, 'tok-secret')
  const s = h.agent.getState()
  assert.equal(s.enrolled, true)
  assert.equal(s.schoolName, 'Школа №12')
  assert.equal(s.classId, 'cls-7a')
})

await test('ошибки подключения: 404/410/409/сеть', async () => {
  const h = makeHarness(CONFIG)
  h.reply('device-enroll', { status: 404, body: { error: 'code_not_found' } }, { status: 410, body: { error: 'code_expired' } }, { status: 409, body: { error: 'seats_exceeded' } }, new Error('offline'))
  assert.deepEqual(await h.agent.enroll('AAA-BBB'), { ok: false, error: 'code_not_found' })
  assert.deepEqual(await h.agent.enroll('AAA-BBB'), { ok: false, error: 'code_expired' })
  assert.deepEqual(await h.agent.enroll('AAA-BBB'), { ok: false, error: 'seats_exceeded' })
  assert.deepEqual(await h.agent.enroll('AAA-BBB'), { ok: false, error: 'network' })
  assert.equal(h.agent.getState().enrolled, false)
  assert.equal(h.store.has(DEVICE_STORAGE_KEY), false)
})

await test('пульс: интервал heartbeatSec ±10 %, тело и токен устройства', async () => {
  const h = makeHarness(CONFIG)
  h.reply('device-enroll', ENROLL_OK)
  await h.agent.enroll('7K2-QM9')
  h.agent.start()
  h.reply('device-heartbeat', { status: 200, body: { serverTime: 'x', locked: false, commands: [], features: ['lab', 'learn'] } })
  await h.fireNext() // первый пульс вскоре после старта
  const hb = h.calls.find((c) => c.fn === 'device-heartbeat')!
  assert.ok(hb, 'пульс отправлен')
  assert.equal(hb.headers.Authorization, 'Bearer tok-secret')
  assert.deepEqual(hb.body, { appVersion: '1.11.0', route: '/learn/g/g7', accountId: null, screen: '1920×1080' })
  assert.deepEqual(h.agent.getState().features, ['lab', 'learn'])
  assert.equal(h.agent.getState().online, true)
  // следующий — через 60 с × (0.9 + 0.2 × 0.5) = 60 с
  h.reply('device-heartbeat', { status: 200, body: { serverTime: 'x', locked: false, commands: [] } })
  const waited = await h.fireNext()
  assert.ok(waited >= 54_000 && waited <= 66_000, `интервал ${waited} в пределах ±10 %`)
  assert.equal(h.calls.filter((c) => c.fn === 'device-heartbeat').length, 2)
})

await test('пульс реже при скрытой вкладке и сразу — при возвращении', async () => {
  const h = makeHarness(CONFIG)
  h.reply('device-enroll', ENROLL_OK)
  await h.agent.enroll('7K2-QM9')
  h.agent.start()
  await h.fireNext()
  h.setHidden(true)
  await h.fireNext() // этот пульс уже планирует следующий по «скрытому» интервалу
  assert.equal(h.timers.length, 1, 'следующий пульс запланирован')
  const waitedHidden = await h.fireNext()
  assert.equal(waitedHidden, 60_000 * HIDDEN_HEARTBEAT_FACTOR)
  h.setHidden(false)
  h.agent.notifyVisibility()
  const waitedVisible = await h.fireNext()
  assert.ok(waitedVisible <= 2000, `после возвращения пульс почти сразу (${waitedVisible} мс)`)
})

await test('команды: message, lock, reload, logout, update_now; отчёт device-command-done; без повторов', async () => {
  const h = makeHarness(CONFIG)
  h.reply('device-enroll', ENROLL_OK)
  await h.agent.enroll('7K2-QM9')
  h.reply('device-heartbeat', {
    status: 200,
    body: {
      serverTime: 'x',
      locked: true,
      lockMessage: 'Урок окончен',
      commands: [
        { id: 'c1', kind: 'message', text: 'Через 5 минут урок' },
        { id: 'c2', kind: 'lock' },
        { id: 'c3', kind: 'logout' },
        { id: 'c4', kind: 'reload' },
      ],
      update: { available: true, version: '1.12.0', mandatory: false, downloadUrl: null, notes: null },
    },
  })
  await h.agent.heartbeatNow()
  const s = h.agent.getState()
  assert.equal(s.locked, true)
  assert.equal(s.lockMessage, 'Урок окончен')
  assert.equal(s.messages.length, 1)
  assert.equal(s.messages[0].text, 'Через 5 минут урок')
  assert.equal(s.update?.version, '1.12.0')
  const done = h.calls.filter((c) => c.fn === 'device-command-done').map((c) => c.body.commandId)
  assert.deepEqual(done, ['c1', 'c2', 'c3', 'c4'])
  assert.deepEqual(h.effects, ['logout', 'reload'], 'reload — после отчёта о выполнении')
  // блокировка переживает перезагрузку страницы
  const saved = JSON.parse(h.store.get(DEVICE_STORAGE_KEY)!)
  assert.equal(saved.locked, true)
  assert.equal(saved.lockMessage, 'Урок окончен')
  const again = createDeviceAgent(CONFIG, { ...({} as DeviceAgentEnv), storage: { getItem: (k) => h.store.get(k) ?? null, setItem() {}, removeItem() {} } } as DeviceAgentEnv)
  assert.equal(again.getState().locked, true)
  // повторная доставка тех же команд не выполняет их второй раз
  h.reply('device-heartbeat', { status: 200, body: { serverTime: 'x', locked: false, commands: [{ id: 'c4', kind: 'reload' }] } })
  await h.agent.heartbeatNow()
  assert.deepEqual(h.effects, ['logout', 'reload'])
  assert.equal(h.agent.getState().locked, false, 'разблокировка по полю locked')
  assert.equal(h.agent.getState().lockMessage, null)
  // update_now важнее reload
  h.reply('device-heartbeat', { status: 200, body: { serverTime: 'x', locked: false, commands: [{ id: 'c5', kind: 'update_now' }, { id: 'c6', kind: 'reload' }] } })
  await h.agent.heartbeatNow()
  assert.deepEqual(h.effects, ['logout', 'reload', 'update_now'])
  h.agent.dismissMessage('c1')
  assert.equal(h.agent.getState().messages.length, 0)
})

await test('401 device_revoked: токен стёрт, пульс остановлен, «Устройство отключено»', async () => {
  const h = makeHarness(CONFIG)
  h.reply('device-enroll', ENROLL_OK)
  await h.agent.enroll('7K2-QM9')
  h.agent.start()
  h.reply('device-heartbeat', { status: 401, body: { error: 'device_revoked' } })
  await h.fireNext()
  const s = h.agent.getState()
  assert.equal(s.revoked, true)
  assert.equal(s.enrolled, false)
  assert.equal(s.locked, false)
  assert.equal(h.store.has(DEVICE_STORAGE_KEY), false)
  assert.equal(h.timers.length, 0, 'новых пульсов нет')
  const before = h.calls.length
  await h.agent.heartbeatNow()
  assert.equal(h.calls.length, before)
})

await test('сбой сети: пульс продолжает попытки с увеличенным интервалом', async () => {
  const h = makeHarness(CONFIG)
  h.reply('device-enroll', ENROLL_OK)
  await h.agent.enroll('7K2-QM9')
  h.agent.start()
  h.reply('device-heartbeat', new Error('offline'), { status: 500 })
  await h.fireNext()
  assert.equal(h.agent.getState().online, false)
  const w1 = await h.fireNext()
  const w2 = await h.fireNext()
  assert.ok(w1 >= 108_000, `первый повтор не чаще 2× интервала (${w1})`)
  assert.ok(w2 >= w1, 'интервал растёт')
  assert.equal(h.agent.getState().enrolled, true, 'сбой сети не отключает устройство')
})

await test('события использования: пачкой, без текста вопросов ИИ', async () => {
  const h = makeHarness(CONFIG)
  h.reply('device-enroll', ENROLL_OK)
  await h.agent.enroll('7K2-QM9')
  h.agent.start()
  h.agent.track('lesson_open', 'g7/c1-s01')
  h.agent.track('ai_question', 'Как получить соль из кислоты?')
  h.agent.track('session_end', null, { durationSec: 1260.4 })
  assert.equal(h.agent.pendingUsage(), 3)
  await h.agent.flushUsage({ keepalive: true })
  const ingest = h.calls.filter((c) => c.fn === 'usage-ingest')
  assert.equal(ingest.length, 1)
  assert.equal(ingest[0].keepalive, true)
  const evs = ingest[0].body.events
  assert.equal(evs.length, 3)
  assert.equal(evs[0].target, 'g7/c1-s01')
  assert.equal('target' in evs[1], false, 'текст вопроса ИИ не отправляется')
  assert.equal(evs[2].durationSec, 1260)
  assert.equal(h.agent.pendingUsage(), 0)
  // больше 100 — несколько пачек
  for (let i = 0; i < 150; i++) h.agent.track('route_view', `/r${i}`)
  await h.settle()
  await h.agent.flushUsage()
  const sizes = h.calls.filter((c) => c.fn === 'usage-ingest').slice(1).map((c) => c.body.events.length)
  assert.ok(sizes.every((n) => n <= 100), `пачки не больше 100: ${sizes}`)
  assert.equal(sizes.reduce((a, b) => a + b, 0), 150)
})

await test('отключение на устройстве: забыть токен без запросов', async () => {
  const h = makeHarness(CONFIG)
  h.reply('device-enroll', ENROLL_OK)
  await h.agent.enroll('7K2-QM9')
  const before = h.calls.length
  h.agent.disconnect()
  assert.equal(h.agent.getState().enrolled, false)
  assert.equal(h.agent.getState().revoked, false)
  assert.equal(h.store.has(DEVICE_STORAGE_KEY), false)
  assert.equal(h.calls.length, before)
})

console.log(`\nГотово: ${passed} проверок пройдено.`)
