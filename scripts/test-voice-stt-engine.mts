#!/usr/bin/env node
/**
 * Движок серверного распознавания без браузера (контракт «Голос» v1):
 *   • выбор пути server / web_speech / none (+ ?stt=server|web|auto);
 *   • кеш /stt/health (ответ живёт 60 с, запрос не чаще раза в 30 с);
 *   • postStt: URL, тело WAV, разбор ошибок 429 Retry-After / 503;
 *   • ServerRecognition на фейковом fetch: финал → committed, partial → interim,
 *     503×2 → onFailure, 429 → повтор сегмента без потерь, hard_pause не шлёт во время озвучки,
 *     ранний partial для барджина во время речи учителя;
 *   • SttEngine: 503×2 → браузерный путь со статусом server_unavailable, возврат на сервер;
 *   • DuplexVoiceSession.begin(): VAD, у которого attach() никогда не завершается, — STT ≤ 800 мс.
 *
 * Запуск: npx tsx scripts/test-voice-stt-engine.mts  (npm run test:voice-stt-engine)
 */
import assert from 'node:assert/strict'
import { FRAME_MS, FRAME_SAMPLES } from '../src/learn/brain/voice/wavEncode.ts'
import { ServerRecognition, type CaptureListener, type CaptureSource } from '../src/learn/brain/voice/serverRecognition.ts'
import { chooseSttPath, sttOverride, SttEngine } from '../src/learn/brain/voice/sttEngine.ts'
import { postStt, SttHealthCache, SttHttpError, type FetchLike, type SttResult } from '../src/learn/brain/speech/serverStt.ts'
import { getVoiceStatus, setVoiceStatus } from '../src/learn/brain/speech/voiceStatus.ts'
import type { TimingScheduler } from '../src/learn/brain/voice/conversationTiming.ts'
import { DuplexVoiceSession, VAD_ATTACH_WAIT_MS, type RecognitionLike } from '../src/learn/brain/voice/duplexVoiceSession.ts'
import { LiveSpeechOutput, type LiveSpeechBackend } from '../src/learn/brain/voice/liveSpeechOutput.ts'

let passed = 0
let failed = 0
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn()
    passed++
    console.log(`  ok  ${name}`)
  } catch (e) {
    failed++
    console.error(`  FAIL ${name}\n       ${(e as Error).stack ?? e}`)
  }
}

class FakeScheduler implements TimingScheduler {
  t = 0
  private seq = 0
  private timers = new Map<number, { at: number; fn: () => void }>()
  now() {
    return this.t
  }
  setTimeout(fn: () => void, ms: number): unknown {
    const id = ++this.seq
    this.timers.set(id, { at: this.t + ms, fn })
    return id
  }
  clearTimeout(h: unknown) {
    this.timers.delete(h as number)
  }
  advance(ms: number, step = 10) {
    const end = this.t + ms
    while (this.t < end) {
      this.t = Math.min(end, this.t + step)
      for (const [id, tm] of [...this.timers].sort((a, b) => a[1].at - b[1].at)) {
        if (tm.at <= this.t && this.timers.has(id)) {
          this.timers.delete(id)
          tm.fn()
        }
      }
    }
  }
}

/** Источник кадров: кольцо пре-ролла + события речи (VAD «снаружи»). */
class FakeSource implements CaptureSource {
  ring: { pcm: Int16Array; at: number }[] = []
  listeners = new Set<CaptureListener>()
  constructor(private readonly s: FakeScheduler) {}
  subscribe(l: CaptureListener) {
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }
  preRoll(ms: number) {
    return this.ring.slice(-Math.ceil(ms / FRAME_MS))
  }
  frames(n: number, value = 1000) {
    for (let i = 0; i < n; i++) {
      this.s.advance(FRAME_MS, FRAME_MS)
      const pcm = new Int16Array(FRAME_SAMPLES).fill(value)
      this.ring.push({ pcm, at: this.s.now() })
      if (this.ring.length > 50) this.ring.shift()
      this.listeners.forEach((l) => l.frame?.(pcm, value / 32768, this.s.now()))
    }
  }
  speechStart() {
    this.listeners.forEach((l) => l.speechStart?.(this.s.now()))
  }
  speechEnd() {
    this.listeners.forEach((l) => l.speechEnd?.(0, this.s.now()))
  }
}

const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve()
}

const ok = (text: string, lang: SttResult['lang'] = 'ru'): SttResult => ({ ok: true, text, lang, ms: { total: 120 } })

/** Фейковый poster: очередь ответов/ошибок, журнал вызовов. */
function fakePoster(plan: ((partial: boolean, n: number) => SttResult | SttHttpError | 'hang')[] | ((partial: boolean, n: number) => SttResult | SttHttpError | 'hang')) {
  const calls: { partial: boolean; bytes: number; signal: AbortSignal }[] = []
  const post = (wav: Uint8Array, partial: boolean, signal: AbortSignal): Promise<SttResult> => {
    const n = calls.length
    calls.push({ partial, bytes: wav.length, signal })
    const step = Array.isArray(plan) ? plan[Math.min(n, plan.length - 1)]! : plan
    const r = step(partial, n)
    if (r === 'hang')
      return new Promise((_res, rej) => signal.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError'))))
    return r instanceof SttHttpError ? Promise.reject(r) : Promise.resolve(r)
  }
  return { post, calls }
}

function startServer(rec: ServerRecognition) {
  const session = { committed: '' }
  const updates: { full: string; interim: string; lang?: string | null }[] = []
  const errors: string[] = []
  rec.start('ru-RU', session, (full, interim, info) => updates.push({ full, interim, lang: info?.lang }), (c) => errors.push(c))
  return { session, updates, errors }
}

console.log('# Выбор пути')

await test('server / web_speech / none по health, мозгу и конструктору Web Speech', () => {
  const base = { override: 'auto' as const, brainOnline: true, serverAvailable: true, hasWebSpeech: true, hasCapture: true }
  assert.equal(chooseSttPath(base), 'server')
  assert.equal(chooseSttPath({ ...base, serverAvailable: false }), 'web_speech')
  assert.equal(chooseSttPath({ ...base, serverAvailable: null }), 'web_speech')
  assert.equal(chooseSttPath({ ...base, brainOnline: false }), 'web_speech')
  assert.equal(chooseSttPath({ ...base, hasCapture: false }), 'web_speech')
  assert.equal(chooseSttPath({ ...base, serverAvailable: false, hasWebSpeech: false }), 'none')
  // Firefox: Web Speech нет, сервер есть.
  assert.equal(chooseSttPath({ ...base, hasWebSpeech: false }), 'server')
  // Переопределения для отладки.
  assert.equal(chooseSttPath({ ...base, override: 'web' }), 'web_speech')
  assert.equal(chooseSttPath({ ...base, override: 'server', serverAvailable: false }), 'server')
  assert.equal(chooseSttPath({ ...base, override: 'web', hasWebSpeech: false }), 'none')
})

await test('?stt=server|web|auto читается из search и из hash', () => {
  assert.equal(sttOverride({ search: '?stt=server', hash: '' }), 'server')
  assert.equal(sttOverride({ search: '', hash: '#/voice-check?stt=web' }), 'web')
  assert.equal(sttOverride({ search: '?debugVoice=1', hash: '#/learn' }), 'auto')
})

console.log('\n# /stt/health и POST /stt')

await test('кеш /stt/health: ответ живёт 60 с, запрос не чаще раза в 30 с', async () => {
  let t = 0
  let calls = 0
  let available = true
  const fetchImpl: FetchLike = async () => {
    calls++
    return new Response(JSON.stringify({ ok: true, available, langs: ['ru', 'uz', 'en'] }), { status: 200 })
  }
  const cache = new SttHealthCache({ getBaseUrl: () => 'https://brain.example', fetchImpl, now: () => t })
  assert.equal(cache.peek(), null)
  assert.equal(await cache.check(), true)
  assert.equal(calls, 1)
  assert.equal(cache.peek(), true)
  t = 20_000
  assert.equal(await cache.check(true), true)
  assert.equal(calls, 1, 'force раньше 30 с не ходит в сеть')
  t = 45_000
  assert.equal(await cache.check(), true)
  assert.equal(calls, 1, 'без force кеш 60 с')
  available = false
  t = 61_000
  assert.equal(cache.peek(), null, 'устарело')
  assert.equal(await cache.check(), false)
  assert.equal(calls, 2)
  // Сервер упал — недоступен до следующей проверки.
  available = true
  cache.markUnavailable()
  assert.equal(cache.peek(), false)
  // Мозг offline — сервера нет без запроса.
  const off = new SttHealthCache({ getBaseUrl: () => null, fetchImpl, now: () => t })
  assert.equal(off.peek(), false)
  assert.equal(await off.check(), false)
  assert.equal(calls, 2)
})

await test('postStt: URL с lang/session/partial, тело — ровно WAV, Content-Type audio/wav', async () => {
  let seenUrl = ''
  let seenType = ''
  let seenBytes = 0
  const fetchImpl: FetchLike = async (url, init) => {
    seenUrl = url
    seenType = new Headers(init?.headers).get('Content-Type') ?? ''
    seenBytes = (init?.body as ArrayBuffer).byteLength
    return new Response(JSON.stringify({ ok: true, text: 'кислород', lang: 'ru', engine: 'mock', ms: { total: 90 }, partial: false }))
  }
  const big = new Uint8Array(4000)
  const wav = big.subarray(100, 1100) // view в чужом буфере — уйти должны ровно 1000 байт
  const r = await postStt({ baseUrl: 'https://brain.example/', wav, lang: 'uz', session: 'abc def!', partial: true, fetchImpl })
  assert.equal(seenUrl, 'https://brain.example/stt?lang=uz&session=abcdef&partial=1')
  assert.equal(seenType, 'audio/wav')
  assert.equal(seenBytes, 1000)
  assert.equal(r.text, 'кислород')
  assert.equal(r.lang, 'ru')
  assert.equal(r.ms?.total, 90)
})

await test('postStt: 429 → SttHttpError с Retry-After, 503 → unavailable, сеть → status 0', async () => {
  const mk = (status: number, body: unknown, headers: Record<string, string> = {}): FetchLike => async () =>
    new Response(JSON.stringify(body), { status, headers })
  const base = { baseUrl: 'https://b', wav: new Uint8Array(10), lang: 'ru' as const, session: 's', partial: false }
  const e429 = await postStt({ ...base, fetchImpl: mk(429, { ok: false, error: { code: 'rate', message: 'r' } }, { 'Retry-After': '3' }) }).catch((e) => e)
  assert.ok(e429 instanceof SttHttpError)
  assert.equal(e429.status, 429)
  assert.equal(e429.code, 'rate')
  assert.equal(e429.retryAfterMs, 3000)
  assert.equal(e429.unavailable, false)
  const e503 = await postStt({ ...base, fetchImpl: mk(503, { ok: false, error: { code: 'stt_unavailable', message: 'x' } }, { 'Retry-After': '10' }) }).catch((e) => e)
  assert.equal(e503.code, 'stt_unavailable')
  assert.equal(e503.unavailable, true)
  const eNet = await postStt({ ...base, fetchImpl: async () => { throw new TypeError('Failed to fetch') } }).catch((e) => e)
  assert.equal(eNet.status, 0)
  assert.equal(eNet.code, 'network')
  assert.equal(eNet.unavailable, true)
  const eTimeout = await postStt({
    ...base,
    timeoutMs: 20,
    fetchImpl: (_u, init) => new Promise((_r, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError')))),
  }).catch((e) => e)
  assert.equal(eTimeout.code, 'timeout')
})

console.log('\n# ServerRecognition (фейковый fetch)')

await test('финал реплики → committed, язык ответа уходит в onUpdate', async () => {
  const s = new FakeScheduler()
  const src = new FakeSource(s)
  const { post, calls } = fakePoster([() => ok('kislorod nima', 'uz')])
  const rec = new ServerRecognition({ source: src, post, scheduler: s, partialEveryMs: 100_000 })
  const h = startServer(rec)
  src.frames(30, 0) // тишина в кольце (пре-ролл)
  src.speechStart()
  src.frames(40)
  src.speechEnd()
  await rec.idle()
  await flush()
  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.partial, false)
  // пре-ролл 400 мс (20 кадров) + 40 кадров речи = 1,2 с → 38 400 байт + 44 заголовок
  assert.equal(calls[0]!.bytes, 44 + 60 * FRAME_SAMPLES * 2)
  assert.equal(h.session.committed.trim(), 'kislorod nima')
  const last = h.updates.at(-1)!
  assert.deepEqual([last.full, last.interim, last.lang], ['kislorod nima', '', 'uz'])
  rec.stop()
})

await test('partial каждые 1,2 с речи → interim, не больше одного в полёте', async () => {
  const s = new FakeScheduler()
  const src = new FakeSource(s)
  let hang = true
  const { post, calls } = fakePoster((partial) => (partial ? (hang ? 'hang' : ok('что такое')) : ok('что такое оксид')))
  const rec = new ServerRecognition({ source: src, post, scheduler: s })
  const h = startServer(rec)
  src.speechStart()
  src.frames(70) // 1,4 с → один partial ушёл и «висит»
  assert.equal(calls.filter((c) => c.partial).length, 1)
  src.frames(70) // ещё 1,4 с: следующий partial не уходит, пока первый в полёте
  assert.equal(calls.filter((c) => c.partial).length, 1)
  calls[0]!.signal.dispatchEvent(new Event('abort'))
  hang = false
  await flush()
  src.frames(70)
  await flush()
  const partials = calls.filter((c) => c.partial)
  assert.ok(partials.length >= 2, 'после ответа partial снова уходит')
  assert.ok(h.updates.some((u) => u.interim === 'что такое' && u.full === ''), 'interim показан')
  src.speechEnd()
  await rec.idle()
  await flush()
  assert.equal(h.session.committed.trim(), 'что такое оксид')
  assert.equal(h.updates.at(-1)!.interim, '')
  rec.stop()
})

await test('503 два раза подряд → onFailure (переключение пути)', async () => {
  const s = new FakeScheduler()
  const src = new FakeSource(s)
  const unavailable = new SttHttpError(503, 'stt_unavailable', 'down', 10_000)
  const { post } = fakePoster(() => unavailable)
  const failures: string[] = []
  const rec = new ServerRecognition({ source: src, post, scheduler: s, partialEveryMs: 100_000, onFailure: (e) => failures.push(e.code) })
  const h = startServer(rec)
  for (let i = 0; i < 2; i++) {
    src.speechStart()
    src.frames(30)
    src.speechEnd()
    await rec.idle()
    await flush()
  }
  assert.deepEqual(failures, ['stt_unavailable'])
  assert.deepEqual(h.errors, ['stt_stt_unavailable', 'stt_stt_unavailable'])
  rec.stop()
})

await test('429 Retry-After → ждём и повторяем тот же сегмент один раз (слова не теряются)', async () => {
  const s = new FakeScheduler()
  const src = new FakeSource(s)
  const { post, calls } = fakePoster([() => new SttHttpError(429, 'rate', 'slow down', 3_000), () => ok('натрий')])
  const rec = new ServerRecognition({ source: src, post, scheduler: s, partialEveryMs: 100_000 })
  const h = startServer(rec)
  src.speechStart()
  src.frames(30)
  src.speechEnd()
  await flush()
  assert.equal(calls.length, 1)
  s.advance(2_900)
  await flush()
  assert.equal(calls.length, 1, 'до Retry-After не повторяем')
  s.advance(200)
  await rec.idle()
  await flush()
  assert.equal(calls.length, 2)
  assert.equal(calls[1]!.bytes, calls[0]!.bytes, 'тот же сегмент')
  assert.equal(h.session.committed.trim(), 'натрий')
  rec.stop()
})

await test('hard_pause: сегмент во время озвучки учителя не уходит; после resume — отрез 200 мс', async () => {
  const s = new FakeScheduler()
  const src = new FakeSource(s)
  const { post, calls } = fakePoster(() => ok('ответ ученика'))
  const rec = new ServerRecognition({ source: src, post, scheduler: s, partialEveryMs: 100_000 })
  const h = startServer(rec)
  rec.pause() // учитель заговорил (hard_pause)
  src.speechStart()
  src.frames(40) // эхо/речь во время озвучки
  src.speechEnd()
  await rec.idle()
  await flush()
  assert.equal(calls.length, 0, 'ничего не отправлено во время озвучки')
  rec.resume(500)
  src.speechStart()
  src.frames(40)
  src.speechEnd()
  await rec.idle()
  await flush()
  assert.equal(calls.length, 1)
  assert.equal(h.session.committed.trim(), 'ответ ученика')
  rec.stop()
})

await test('«нажми и говори» во время паузы: сегмент уходит, Promise ждёт финал', async () => {
  const s = new FakeScheduler()
  const src = new FakeSource(s)
  const { post, calls } = fakePoster(() => ok('серная кислота'))
  const rec = new ServerRecognition({ source: src, post, scheduler: s, partialEveryMs: 100_000 })
  const h = startServer(rec)
  rec.pause()
  rec.hold(true)
  src.frames(40)
  src.speechEnd() // VAD не режет удержание
  assert.equal(calls.length, 0)
  let done = false
  const p = rec.hold(false) as Promise<void>
  void p.then(() => (done = true))
  s.advance(250)
  await rec.idle()
  await flush()
  assert.equal(calls.length, 1)
  assert.ok(done, 'финал готов → Promise завершён')
  assert.equal(h.session.committed.trim(), 'серная кислота')
  rec.stop()
})

await test('барджин: во время речи учителя первый partial уже через 300 мс речи', async () => {
  const s = new FakeScheduler()
  const src = new FakeSource(s)
  const { post, calls } = fakePoster((partial) => ok(partial ? 'стоп подождите' : 'стоп подождите'))
  const rec = new ServerRecognition({ source: src, post, scheduler: s })
  const h = startServer(rec)
  rec.setAiSpeaking(true)
  src.speechStart()
  src.frames(10) // 200 мс
  assert.equal(calls.length, 0)
  src.frames(6) // 320 мс
  assert.equal(calls.filter((c) => c.partial).length, 1)
  await flush()
  assert.ok(h.updates.some((u) => u.interim === 'стоп подождите'), 'текст partial → сессия решит, эхо это или ученик')
  rec.stop()
})

console.log('\n# SttEngine (пути и переключение)')

function fakeWeb() {
  const log: string[] = []
  const web: RecognitionLike = {
    start: () => {
      log.push('start')
      return true
    },
    stop: () => log.push('stop'),
    pause: () => log.push('pause'),
    resume: () => log.push('resume'),
  }
  return { web, log }
}

await test('сервер 503×2 → браузерный путь + статус server_unavailable; через 60 с — назад на сервер', async () => {
  const s = new FakeScheduler()
  const src = new FakeSource(s)
  const { web, log } = fakeWeb()
  let healthOk = true
  const fetchImpl: FetchLike = async () => new Response(JSON.stringify({ ok: true, available: healthOk }))
  let t = 0
  const health = new SttHealthCache({ getBaseUrl: () => 'https://b', fetchImpl, now: () => t })
  await health.check()
  const unavailable = new SttHttpError(503, 'stt_unavailable', 'down', 10_000)
  const { post, calls } = fakePoster(() => unavailable)
  const paths: string[] = []
  setVoiceStatus('listening')
  const engine = new SttEngine({
    lang: 'ru',
    capture: src,
    web,
    brainOnline: () => true,
    getBaseUrl: () => 'https://b',
    sessionId: () => 's1',
    health,
    scheduler: s,
    override: 'auto',
    post,
    onPathChange: (p) => paths.push(p),
  })
  engine.start('ru-RU', { committed: '' }, () => undefined)
  assert.equal(engine.getPath(), 'server')
  for (let i = 0; i < 2; i++) {
    src.speechStart()
    src.frames(30)
    src.speechEnd()
    await flush()
    s.advance(100)
    await flush()
  }
  assert.equal(calls.length, 2)
  assert.equal(engine.getPath(), 'web_speech')
  assert.equal(getVoiceStatus().code, 'server_unavailable')
  assert.ok(log.includes('start'), 'браузерное распознавание запущено')
  // Через 60 с сервер снова здоров → переход в паузе между репликами.
  healthOk = true
  t = 61_000
  s.advance(60_100, 100)
  await flush()
  s.advance(100)
  await flush()
  assert.equal(engine.getPath(), 'server')
  assert.ok(log.includes('stop'), 'браузерное распознавание остановлено')
  assert.deepEqual(paths, ['server', 'web_speech', 'server'])
  engine.stop()
})

await test('здоровье ещё не проверено: старт на браузере, после health ok — сервер (в паузе)', async () => {
  const s = new FakeScheduler()
  const src = new FakeSource(s)
  const { web } = fakeWeb()
  const fetchImpl: FetchLike = async () => new Response(JSON.stringify({ ok: true, available: true }))
  const engine = new SttEngine({
    lang: 'ru',
    capture: src,
    web,
    brainOnline: () => true,
    getBaseUrl: () => 'https://b',
    sessionId: () => 's1',
    fetchImpl,
    scheduler: s,
    override: 'auto',
    post: fakePoster(() => ok('x')).post,
  })
  engine.start('ru-RU', { committed: '' }, () => undefined)
  assert.equal(engine.getPath(), 'web_speech')
  await flush()
  await new Promise((r) => setTimeout(r, 5))
  s.advance(100)
  assert.equal(engine.getPath(), 'server')
  engine.stop()
})

await test('мозг offline и Web Speech нет → none (только текст)', () => {
  const engine = new SttEngine({
    lang: 'ru',
    capture: null,
    web: null,
    brainOnline: () => false,
    getBaseUrl: () => null,
    sessionId: () => 's1',
    scheduler: new FakeScheduler(),
    override: 'auto',
  })
  const errors: string[] = []
  engine.start('ru-RU', { committed: '' }, () => undefined, (c) => errors.push(c))
  assert.equal(engine.getPath(), 'none')
  assert.deepEqual(errors, ['stt_none'])
  engine.stop()
})

console.log('\n# DuplexVoiceSession.begin (RC6)')

await test(`attach() VAD никогда не завершается → STT стартует ≤ 800 мс (ожидание ${VAD_ATTACH_WAIT_MS} мс)`, async () => {
  const backend: LiveSpeechBackend = {
    ready: async () => undefined,
    environment: () => ({ desktop: false, edge: false, browserSupported: true, browserVoices: 1 }),
    prepare: (t) => t,
    synthesize: async () => null,
    play: async () => undefined,
    speakBrowser: (_t, _l, onStart) => {
      onStart?.()
      return { done: Promise.resolve(), cancel: () => undefined }
    },
    cancelBrowser: () => undefined,
    hardStop: () => undefined,
  } as unknown as LiveSpeechBackend
  let sttStartedAt = -1
  const t0 = performance.now()
  const d = new DuplexVoiceSession({
    lang: 'ru',
    controller: {} as never,
    speechOutput: new LiveSpeechOutput({ lang: 'ru', backend }),
    recognition: {
      start: () => {
        sttStartedAt = performance.now() - t0
        return true
      },
      stop: () => undefined,
    },
    createVad: () => ({ attach: () => new Promise<boolean>(() => undefined), detach: () => undefined }),
    onUserUtterance: () => undefined,
  })
  const vadOk = await d.begin({} as MediaStream)
  assert.equal(vadOk, false)
  assert.ok(sttStartedAt >= 0, 'STT запущен')
  assert.ok(sttStartedAt <= 800, `STT стартовал через ${Math.round(sttStartedAt)} мс`)
  assert.equal(d.getListenMode(), 'hard_pause', 'без VAD — жёсткая пауза на время речи учителя')
  assert.equal(d.holdToTalk(true), true, '«нажми и говори» работает без VAD')
  d.holdToTalk(false)
  d.end()
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
