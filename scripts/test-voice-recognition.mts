#!/usr/bin/env node
/**
 * Обёртка Web Speech на моке SpeechRecognition (Chrome «не слышит»):
 *   • network / no-speech / not-allowed / language-not-supported;
 *   • перезапуски с паузой 250 → 500 → 1000 мс, без дублей;
 *   • 5 пустых сессий → 'unresponsive', два эпизода → push-to-talk;
 *   • uz → language-not-supported → повтор с ru-RU;
 *   • жёсткая пауза pause/resume без гонок поколений;
 *   • maxAlternatives = 5 и выбор альтернативы;
 *   • склейка сегментов, interim при onend не теряется, перезапуск 60/250 мс, 'aborted' (Edge);
 *   • Chrome + uz → сразу ru-RU, Chrome/Edge: network → перезапуск, повтор после not-allowed;
 *   • умный конец фразы (endOfUtterance + TurnEndDetector.holdMs), длинный вопрос не режется;
 *   • эмуляция живого разговора LearnSpeechRecognition → DuplexVoiceSession, «нажми и говори».
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
import { ABORTED_SILENT_RESTARTS, RESTART_AFTER_RESULT_MS } from '../src/learn/learnSpeechRecognition.ts'
import { browserVoiceProfile } from '../src/learn/brain/speech/browserProfile.ts'
import { HOLD_MS, utteranceHold, utteranceHoldMs } from '../src/learn/brain/speech/endOfUtterance.ts'
import { TurnEndDetector, type TurnCommit } from '../src/learn/brain/voice/conversationTiming.ts'
import { DuplexVoiceSession, HOLD_RELEASE_FLUSH_MS } from '../src/learn/brain/voice/duplexVoiceSession.ts'

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
const EDGE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0'

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

async function atest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
    passed++
    console.log(`  ok  ${name}`)
  } catch (e) {
    failed++
    console.error(`  FAIL ${name}\n       ${(e as Error).stack ?? e}`)
  }
}

console.log('\n# Не терять сказанное: склейка сегментов, interim при onend, перезапуски')
test('склейка: три финала в разных сессиях (Chrome закрывает сессию) → одна строка без потерь', () => {
  const { s, rec, inst, last } = setup()
  const session = { committed: '' }
  rec.startOralListening('ru', session, () => {})
  last().result([{ transcript: 'почему железо' }])
  last().end()
  s.advance(RESTART_AFTER_RESULT_MS + 10)
  assert.equal(inst().length, 2, 'новая сессия через 60 мс')
  last().result([{ transcript: 'ржавеет во влажном воздухе' }])
  last().end()
  s.advance(RESTART_AFTER_RESULT_MS + 10)
  last().result([{ transcript: 'а в сухом нет' }])
  assert.equal(session.committed.trim(), 'почему железо ржавеет во влажном воздухе а в сухом нет')
})
test('сессия закрылась на interim (финал не пришёл) → хвост дописан в committed', () => {
  const { s, rec, last } = setup()
  const session = { committed: '' }
  const updates: [string, string][] = []
  rec.startOralListening('ru', session, (f, i) => updates.push([f, i]))
  last().result([{ transcript: 'что такое' }])
  last().result([{ transcript: 'электроотрицательность' }], false)
  last().end()
  assert.equal(session.committed.trim(), 'что такое электроотрицательность')
  assert.deepEqual(updates.at(-1), ['что такое электроотрицательность', ''])
  s.advance(100)
  last().result([{ transcript: 'фтора' }])
  assert.equal(session.committed.trim(), 'что такое электроотрицательность фтора')
})
test('после речи — перезапуск через 60 мс; после тишины (no-speech) — через 250 мс', () => {
  const { s, rec, inst, last } = setup()
  rec.startOralListening('ru', { committed: '' }, () => {})
  last().result([{ transcript: 'привет' }])
  last().end()
  s.advance(50)
  assert.equal(inst().length, 1)
  s.advance(20)
  assert.equal(inst().length, 2)
  last().error('no-speech')
  last().end()
  s.advance(240)
  assert.equal(inst().length, 2)
  s.advance(20)
  assert.equal(inst().length, 3)
})
test(`'aborted' (Edge) → тихий перезапуск ${ABORTED_SILENT_RESTARTS} раза, без «не отвечает»`, () => {
  const { s, rec, inst, last } = setup()
  const errors: string[] = []
  rec.startOralListening('ru', { committed: '' }, () => {}, (c) => errors.push(c))
  for (let i = 0; i < ABORTED_SILENT_RESTARTS; i++) {
    last().error('aborted')
    last().end()
    s.advance(260)
  }
  assert.equal(inst().length, ABORTED_SILENT_RESTARTS + 1)
  assert.deepEqual(errors, [])
  assert.equal(rec.isListening(), true)
})
test('Chrome + uz: профиль браузера → сразу ru-RU (без лишней ошибки); Edge + uz → uz-UZ', () => {
  MockRecognition.instances = []
  const s = new FakeScheduler()
  const errors: string[] = []
  const chrome = new LearnSpeechRecognition({ ctor: MockRecognition, scheduler: s, profile: browserVoiceProfile(CHROME_UA) })
  chrome.startOralListening('uz', { committed: '' }, () => {}, (c) => errors.push(c))
  assert.equal(MockRecognition.instances.at(-1)!.lang, 'ru-RU')
  assert.deepEqual(errors, ['language-fallback'])
  chrome.stopListening()
  const edge = new LearnSpeechRecognition({ ctor: MockRecognition, scheduler: s, profile: browserVoiceProfile(EDGE_UA) })
  edge.startOralListening('uz', { committed: '' }, () => {})
  assert.equal(MockRecognition.instances.at(-1)!.lang, 'uz-UZ')
  edge.stopListening()
  const edgeRu = new LearnSpeechRecognition({ ctor: MockRecognition, scheduler: s, profile: browserVoiceProfile(EDGE_UA) })
  edgeRu.startOralListening('ru', { committed: '' }, () => {})
  assert.equal(MockRecognition.instances.at(-1)!.lang, 'ru-RU')
})
test('Chrome и Edge: network → перезапуск с паузой, повторный запуск после фатальной ошибки возможен', () => {
  for (const ua of [CHROME_UA, EDGE_UA]) {
    MockRecognition.instances = []
    const s = new FakeScheduler()
    const rec = new LearnSpeechRecognition({ ctor: MockRecognition, scheduler: s, profile: browserVoiceProfile(ua) })
    const session = { committed: '' }
    assert.ok(rec.startOralListening('ru', session, () => {}))
    MockRecognition.instances.at(-1)!.error('network')
    MockRecognition.instances.at(-1)!.end()
    s.advance(260)
    assert.equal(MockRecognition.instances.length, 2, ua)
    MockRecognition.instances.at(-1)!.error('not-allowed')
    assert.equal(rec.isListening(), false)
    // Разрешили микрофон → снова «Начать» работает.
    assert.ok(rec.startOralListening('ru', session, () => {}), 'restart after not-allowed')
    MockRecognition.instances.at(-1)!.result([{ transcript: 'теперь слышно' }])
    assert.equal(session.committed.trim(), 'теперь слышно')
    rec.stopListening()
  }
})
test('push-to-talk: отпустили до финала → отдаём последний interim', () => {
  const { rec, last } = setup()
  const finals: string[] = []
  rec.startPushToTalk('ru', () => {}, (t) => finals.push(t))
  last().result([{ transcript: 'сколько протонов у' }], false)
  last().result([{ transcript: 'сколько протонов у кислорода' }], false)
  rec.stopPushToTalk()
  assert.deepEqual(finals, ['сколько протонов у кислорода'])
})

console.log('\n# Умный конец фразы (endOfUtterance)')
test('висящий хвост / команда / вопрос / короткая / законченная', () => {
  const cases: [string, string][] = [
    ['что такое', 'dangling'], ['расскажи про', 'dangling'], ['а если взять например', 'dangling'],
    ['это потому что', 'dangling'], ['масса двадцать', 'dangling'], ['формула аш', 'dangling'], ['это аш два эс о четыре', 'complete'],
    ['я думаю что', 'dangling'], ['почему железо ржавеет и', 'dangling'], ['ну э', 'dangling'], ['what is the', 'dangling'],
    ['bu nima va', 'dangling'], ['кислота,', 'dangling'],
    ['стоп', 'command'], ['да', 'command'], ['не знаю', 'command'], ['следующий вопрос', 'command'], ['повтори', 'command'],
    ['что такое оксиды?', 'question'], ['а ты что?', 'question'],
    ['оксиды', 'short'], ['серная кислота', 'short'],
    ['что такое оксиды', 'complete'], ['почему железо ржавеет', 'complete'], ['расскажи про кислоты', 'complete'],
  ]
  const bad: string[] = []
  for (const [text, want] of cases) {
    const got = utteranceHold(text).ending
    if (got !== want) bad.push(`${text}: ${got} (надо ${want})`)
  }
  assert.deepEqual(bad, [])
  assert.ok(HOLD_MS.dangling >= 1000 && HOLD_MS.complete <= 300 && HOLD_MS.command === 0)
})
test('TurnEndDetector + holdMs: «что такое» ждёт ≈ 1,3 с, «что такое оксиды» — ≈ 0,47 с', () => {
  const s = new FakeScheduler()
  const commits: TurnCommit[] = []
  const t = new TurnEndDetector({ scheduler: s, silenceMs: 450, finalSettleMs: 220, holdMs: utteranceHoldMs, onCommit: (c) => commits.push(c) })
  t.final('что такое')
  s.advance(1000)
  assert.equal(commits.length, 0, 'после «что такое» не обрываем')
  s.advance(400)
  assert.equal(commits.length, 1)
  assert.equal(commits[0]!.text, 'что такое')
  const t0 = s.now()
  t.final('что такое оксиды')
  s.advance(500)
  assert.equal(commits.length, 2)
  assert.ok(commits[1]!.at - t0 <= 480 && commits[1]!.at - t0 >= 460, `${commits[1]!.at - t0}`)
})
test('длинный вопрос (27 слов) с паузами 0,5–0,9 с внутри не режется: один коммит', () => {
  const s = new FakeScheduler()
  const commits: TurnCommit[] = []
  const t = new TurnEndDetector({ scheduler: s, silenceMs: 450, finalSettleMs: 220, holdMs: utteranceHoldMs, onCommit: (c) => commits.push(c) })
  const parts = [
    'скажите пожалуйста почему когда мы',
    'добавляем фенолфталеин в раствор гидроксида натрия и',
    'он становится малиновым а в кислоте',
    'остаётся бесцветным это потому что',
    'щёлочь меняет цвет индикатора',
  ]
  let acc = ''
  for (const [i, p] of parts.entries()) {
    t.speechStart()
    t.interim(p)
    s.advance(900)
    acc = `${acc} ${p}`.trim()
    t.final(acc)
    t.speechEnd()
    if (i < parts.length - 1) {
      // Пауза «подумать» после союза/местоимения — 0,9 с; между законченными частями — 0,5 с (плюс ~0,2 с VAD).
      s.advance(utteranceHold(acc).ending === 'dangling' ? 900 : 500)
      assert.equal(commits.length, 0, `оборвали после «${p}»`)
    }
  }
  s.advance(1500)
  assert.equal(commits.length, 1)
  assert.equal(commits[0]!.text, acc)
  assert.equal(acc.split(' ').length, 27)
})

console.log('\n# Эмуляция живого разговора: LearnSpeechRecognition → DuplexVoiceSession')
function duplexOnMock() {
  MockRecognition.instances = []
  const s = new FakeScheduler()
  const rec = new LearnSpeechRecognition({ ctor: MockRecognition, scheduler: s })
  let vad!: { onSpeechStart: () => void; onSpeechEnd: (ms: number) => void }
  const utterances: string[] = []
  const partials: string[] = []
  const output = {
    ready: async () => undefined,
    cancel: () => undefined,
    getPath: () => 'browser',
    prepare: (x: string) => x,
  }
  const d = new DuplexVoiceSession({
    lang: 'ru',
    controller: {} as never,
    scheduler: s,
    speechOutput: output as never,
    listenWhileSpeaking: 'soft_echo_filter',
    recognition: {
      start: (l, sess, u, e) => rec.startOralListening(l, sess, u, e),
      stop: () => rec.stopListening(),
      pause: () => rec.pauseListening(),
      resume: (ms) => rec.resumeListening(ms),
    },
    createVad: (h) => {
      vad = h
      return { attach: async () => true, detach: () => undefined }
    },
    onUserUtterance: (text) => utterances.push(text),
    onPartial: (p) => partials.push(p),
  })
  return { s, d, rec, vad: () => vad, utterances, partials, last: () => MockRecognition.instances.at(-1)! }
}
await atest('«что такое» … пауза 0,8 с … «оксиды» (новая сессия Chrome) → одна реплика «что такое оксиды»', async () => {
  const h = duplexOnMock()
  await h.d.begin({} as MediaStream)
  h.vad().onSpeechStart()
  h.last().result([{ transcript: 'что та' }], false)
  h.last().result([{ transcript: 'что такое' }])
  h.s.advance(300)
  h.vad().onSpeechEnd(600)
  h.last().end() // Chrome закрыл сессию после паузы
  h.s.advance(800)
  assert.deepEqual(h.utterances, [], 'не оборвали на «что такое»')
  h.vad().onSpeechStart()
  h.last().result([{ transcript: 'оксиды' }])
  h.s.advance(400)
  h.vad().onSpeechEnd(400)
  h.s.advance(600)
  assert.deepEqual(h.utterances, ['что такое оксиды'])
  assert.ok(h.partials.includes('что та'), 'interim сразу на экране')
  h.d.end()
})
await atest('ослышки и формулы в реплике исправлены: «малярная масса аш два эс о четыре»', async () => {
  const h = duplexOnMock()
  await h.d.begin({} as MediaStream)
  h.vad().onSpeechStart()
  h.last().result([{ transcript: 'какая малярная масса аш два эс о четыре' }])
  h.vad().onSpeechEnd(900)
  h.s.advance(800)
  assert.deepEqual(h.utterances, ['какая молярная масса H₂SO₄'])
  h.d.end()
})
await atest('«нажми и говори»: пока зажато — паузы не обрывают; отпустил — коммит за ≤ 300 мс', async () => {
  const h = duplexOnMock()
  await h.d.begin({} as MediaStream)
  assert.ok(h.d.holdToTalk(true))
  h.vad().onSpeechStart()
  h.last().result([{ transcript: 'значит так' }])
  h.vad().onSpeechEnd(500)
  h.s.advance(3000)
  assert.deepEqual(h.utterances, [], 'зажато — ждём')
  h.vad().onSpeechStart()
  h.last().result([{ transcript: 'кальций реагирует с водой' }], false)
  const t0 = h.s.now()
  h.d.holdToTalk(false)
  h.s.advance(HOLD_RELEASE_FLUSH_MS + 20)
  assert.deepEqual(h.utterances, ['значит так кальций реагирует с водой'])
  assert.ok(h.s.now() - t0 <= 300)
  assert.equal(h.d.isHoldingToTalk(), false)
  h.d.end()
})
await atest('«нажми и говори» при выключенном микрофоне: включаем на время удержания, потом снова выключен', async () => {
  const h = duplexOnMock()
  await h.d.begin({} as MediaStream)
  h.d.setMuted(true)
  assert.equal(h.rec.isListening(), false)
  h.d.holdToTalk(true)
  assert.equal(h.rec.isListening(), true)
  h.last().result([{ transcript: 'ответ три' }])
  h.d.holdToTalk(false)
  h.s.advance(400)
  assert.deepEqual(h.utterances, ['ответ три'])
  assert.equal(h.d.isMuted(), true)
  assert.equal(h.rec.isListening(), false)
  h.d.end()
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
