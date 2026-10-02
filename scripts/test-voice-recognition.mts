#!/usr/bin/env node
/**
 * Обёртка Web Speech на моке SpeechRecognition (Chrome «не слышит»):
 *   • network / no-speech / not-allowed / language-not-supported;
 *   • перезапуски с паузой 250 → 500 → 1000 мс, без дублей;
 *   • 5 пустых сессий → 'unresponsive', два эпизода → push-to-talk;
 *   • uz → language-not-supported → повтор с ru-RU;
 *   • жёсткая пауза pause/resume без гонок поколений;
 *   • maxAlternatives = 5 и выбор альтернативы.
 *
 * Запуск: npx tsx scripts/test-voice-recognition.mts
 */
import assert from 'node:assert/strict'
import {
  LearnSpeechRecognition,
  type SpeechRecognitionLike,
} from '../src/learn/learnSpeechRecognition.ts'
import type { TimingScheduler } from '../src/learn/brain/voice/conversationTiming.ts'
import { getVoiceStatus } from '../src/learn/brain/speech/voiceStatus.ts'

let passed = 0
let failed = 0
function test(name: string, fn: () => void): void {
  try {
    fn()
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
  timers = new Map<number, { at: number; fn: () => void }>()
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

/** Мок SpeechRecognition: события генерирует тест. */
class MockRecognition implements SpeechRecognitionLike {
  static instances: MockRecognition[] = []
  lang = ''
  interimResults = false
  maxAlternatives = 1
  continuous = false
  onresult: ((e: SpeechRecognitionEvent) => void) | null = null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null = null
  onend: (() => void) | null = null
  started = false
  stopped = false
  startedAt = 0
  constructor() {
    MockRecognition.instances.push(this)
  }
  start() {
    this.started = true
  }
  stop() {
    this.stopped = true
    // как в браузере: onend приходит асинхронно, но тут — сразу
    this.onend?.()
  }
  error(code: string) {
    this.onerror?.({ error: code } as SpeechRecognitionErrorEvent)
  }
  end() {
    this.onend?.()
  }
  result(alts: { transcript: string; confidence?: number }[], isFinal = true) {
    const list = alts.map((a) => ({ transcript: a.transcript, confidence: a.confidence ?? 0.5 }))
    const result = Object.assign(list, { isFinal, length: list.length }) as unknown as SpeechRecognitionResult
    const results = Object.assign([result], { length: 1 }) as unknown as SpeechRecognitionResultList
    this.onresult?.({ resultIndex: 0, results } as SpeechRecognitionEvent)
  }
}

function setup() {
  MockRecognition.instances = []
  const s = new FakeScheduler()
  const rec = new LearnSpeechRecognition({ ctor: MockRecognition, scheduler: s })
  return { s, rec, inst: () => MockRecognition.instances, last: () => MockRecognition.instances.at(-1)! }
}

console.log('\n# Непрерывный режим')
test('параметры: continuous, interim, maxAlternatives = 5', () => {
  const { rec, last } = setup()
  rec.startOralListening('ru', { committed: '' }, () => {})
  assert.equal(last().continuous, true)
  assert.equal(last().interimResults, true)
  assert.equal(last().maxAlternatives, 5)
  assert.equal(last().lang, 'ru-RU')
})
test('no-speech → перезапуск через 250 мс, один новый экземпляр (без дублей)', () => {
  const { s, rec, inst, last } = setup()
  rec.startOralListening('ru', { committed: '' }, () => {})
  last().error('no-speech')
  last().end()
  assert.equal(inst().length, 1)
  s.advance(240)
  assert.equal(inst().length, 1)
  s.advance(20)
  assert.equal(inst().length, 2)
  assert.equal(last().started, true)
})
test('network: пауза растёт 250 → 500 → 1000, после 5 пустых — unresponsive (не фатально)', () => {
  const { s, rec, inst, last } = setup()
  const errors: [string, boolean][] = []
  rec.startOralListening('ru', { committed: '' }, () => {}, (c, f) => errors.push([c, f]))
  const gaps: number[] = []
  for (let i = 0; i < 4; i++) {
    const before = inst().length
    last().error('network')
    last().end()
    const t0 = s.t
    while (inst().length === before) s.advance(10)
    gaps.push(s.t - t0)
  }
  assert.deepEqual(gaps, [250, 500, 1000, 1000])
  last().error('network')
  last().end()
  assert.ok(errors.some(([c, f]) => c === 'unresponsive' && f === false), JSON.stringify(errors))
  assert.equal(rec.isListening(), true)
  assert.equal(getVoiceStatus().code, 'unresponsive')
})
test('второй эпизод «не отвечает» → push-to-talk, непрерывный режим остановлен', () => {
  const { s, rec, last } = setup()
  const errors: string[] = []
  rec.startOralListening('ru', { committed: '' }, () => {}, (c) => errors.push(c))
  for (let i = 0; i < 10; i++) {
    const r = last()
    if (!r.started || r.stopped) break
    r.end() // молча, без результата — Chrome без серверов Google
    s.advance(1100)
  }
  assert.ok(errors.includes('unresponsive'))
  assert.ok(errors.includes('push-to-talk'), JSON.stringify(errors))
  assert.equal(rec.isListening(), false)
  assert.equal(getVoiceStatus().mode, 'push_to_talk')
})
test('результат сбрасывает счётчик пустых сессий; финал берёт лучшую альтернативу', () => {
  const { s, rec, last } = setup()
  const session = { committed: '' }
  const updates: string[] = []
  const errors: string[] = []
  rec.startOralListening('ru', session, (full) => updates.push(full), (c) => errors.push(c))
  for (let i = 0; i < 4; i++) {
    last().end()
    s.advance(1100)
  }
  last().result([
    { transcript: 'что такое аксиома', confidence: 0.6 },
    { transcript: 'что такое оксид', confidence: 0.55 },
  ])
  assert.equal(session.committed.trim(), 'что такое оксид')
  for (let i = 0; i < 4; i++) {
    last().end()
    s.advance(1100)
  }
  assert.equal(errors.includes('unresponsive'), false)
})
test('not-allowed → фатально, сессия остановлена', () => {
  const { rec, last } = setup()
  const errors: [string, boolean][] = []
  rec.startOralListening('ru', { committed: '' }, () => {}, (c, f) => errors.push([c, f]))
  last().error('not-allowed')
  assert.deepEqual(errors, [['not-allowed', true]])
  assert.equal(rec.isListening(), false)
  assert.equal(getVoiceStatus().code, 'not_allowed')
})
test('uz → language-not-supported → повтор с ru-RU и пометка language-fallback', () => {
  const { s, rec, last } = setup()
  const errors: [string, boolean][] = []
  rec.startOralListening('uz', { committed: '' }, () => {}, (c, f) => errors.push([c, f]))
  assert.equal(last().lang, 'uz-UZ')
  last().error('language-not-supported')
  last().end()
  s.advance(300)
  assert.equal(last().lang, 'ru-RU')
  assert.deepEqual(errors, [['language-fallback', false]])
  assert.equal(rec.isListening(), true)
})
test('жёсткая пауза: pause останавливает, onend не перезапускает; resume — новый экземпляр через 500 мс', () => {
  const { s, rec, inst, last } = setup()
  rec.startOralListening('ru', { committed: '' }, () => {})
  const first = last()
  rec.pauseListening()
  assert.equal(first.stopped, true)
  s.advance(2000)
  assert.equal(inst().length, 1, 'на паузе перезапусков нет')
  rec.resumeListening(500)
  s.advance(490)
  assert.equal(inst().length, 1)
  s.advance(20)
  assert.equal(inst().length, 2)
  // Поздний onend старого экземпляра не плодит третий
  first.end()
  s.advance(2000)
  assert.equal(inst().length, 2)
})
test('stopListening → поздние события старого поколения игнорируются', () => {
  const { s, rec, inst, last } = setup()
  rec.startOralListening('ru', { committed: '' }, () => {})
  const old = last()
  rec.stopListening()
  old.error('network')
  old.end()
  s.advance(3000)
  assert.equal(inst().length, 1)
  assert.equal(rec.isListening(), false)
})

console.log('\n# Разовый режим и push-to-talk')
test('разовый: maxAlternatives = 5, лучшая альтернатива, uz → ru при language-not-supported', () => {
  const { rec, last, inst } = setup()
  const got: string[] = []
  rec.startListening('uz', (t) => got.push(t))
  assert.equal(last().maxAlternatives, 5)
  last().error('language-not-supported')
  assert.equal(inst().length, 2)
  assert.equal(last().lang, 'ru-RU')
  last().result([{ transcript: 'валентнасть', confidence: 0.7 }, { transcript: 'валентность', confidence: 0.6 }])
  assert.deepEqual(got, ['валентность'])
})
test('push-to-talk: continuous=false, interim показывается, финал после отпускания', () => {
  const { rec, last } = setup()
  const interim: string[] = []
  const finals: string[] = []
  rec.startPushToTalk('ru', (t) => interim.push(t), (t) => finals.push(t))
  assert.equal(last().continuous, false)
  assert.equal(last().interimResults, true)
  last().result([{ transcript: 'что та' }], false)
  last().result([{ transcript: 'что такое оксид' }], true)
  rec.stopPushToTalk()
  assert.deepEqual(interim, ['что та', ''])
  assert.deepEqual(finals, ['что такое оксид'])
  assert.equal(rec.isListening(), false)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
