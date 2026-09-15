#!/usr/bin/env node
/**
 * Живой ИИ-учитель: тесты чистых частей движка разговора (без браузера).
 *
 *   • потоковый делитель на предложения (первая фраза уходит в озвучку сразу);
 *   • FIFO-очередь реплик (ничего не теряется, пока учитель говорит);
 *   • перебивание (barge-in) и конец реплики — state machine с фейковым временем;
 *   • DuplexVoiceSession целиком: фейковые STT/VAD/озвучка, барджин < 150 мс;
 *   • LiveSpeechOutput: мгновенная отмена, prefetch следующей фразы, уход на системный голос;
 *   • learnSpeechPlayback.stopNeuralPlayback завершает ожидающий промис;
 *   • follow-up «почему / пример / проще / подробнее / повтори»;
 *   • локальный составитель ответа (без LLM, без выдумок) на примерах фрагментов;
 *   • адаптер знаний teacherKnowledge (кеш, таймаут, отмена);
 *   • устные экзаменационные пулы 8–11 класса не пустые.
 *
 * Запуск: npx tsx scripts/test-teacher-live-engine.mts
 */
import assert from 'node:assert/strict'
import {
  SentenceStreamSplitter,
  countWords,
  findSentenceBoundary,
  splitIntoSentences,
} from '../src/learn/brain/voice/sentenceStream.ts'
import { TurnQueue, type TurnInput } from '../src/learn/brain/voice/turnQueue.ts'
import {
  BargeInDetector,
  TurnEndDetector,
  type TimingScheduler,
  type TurnCommit,
} from '../src/learn/brain/voice/conversationTiming.ts'
import { looksLikeAnyTeacherEcho, looksLikeTeacherEcho, sameUtterance } from '../src/learn/brain/voice/echoFilter.ts'
import {
  LiveSpeechOutput,
  chooseLiveTtsPath,
  type LiveSpeechBackend,
  type LiveTtsEnvironment,
  type NeuralAudio,
} from '../src/learn/brain/voice/liveSpeechOutput.ts'
import {
  DuplexVoiceSession,
  type BargeInEvent,
  type RecognitionLike,
  type UserUtteranceMeta,
} from '../src/learn/brain/voice/duplexVoiceSession.ts'
import { detectFollowUp, isSubstantiveQuestion, resolveTurn, stripLeadingDiscourse } from '../src/learn/brain/dualMode/followUps.ts'
import { composeLocalAnswer, extractKeyTerm, type KnowledgeHitLike } from '../src/learn/brain/dualMode/localAnswerComposer.ts'
import { parseVoiceIntent } from '../src/learn/brain/dualMode/intentParser.ts'
import {
  clearTeacherKnowledgeCache,
  citationForDisplay,
  retrieveForTeacher,
  setTeacherKnowledgeProvider,
} from '../src/learn/teacherKnowledge.ts'

/* --------------------------------------------------------------- mini runner */

let passed = 0
let failed = 0
const failures: string[] = []
const report: Record<string, number | string> = {}

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  const t0 = performance.now()
  try {
    await fn()
    passed++
    console.log(`  ok  ${name} (${Math.round(performance.now() - t0)} ms)`)
  } catch (error) {
    failed++
    failures.push(name)
    console.error(`  FAIL ${name}\n       ${(error as Error)?.stack ?? error}`)
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Фейковые часы для state machine: время двигаем вручную. */
class FakeScheduler implements TimingScheduler {
  t = 0
  private seq = 0
  private timers = new Map<number, { at: number; fn: () => void }>()
  now(): number {
    return this.t
  }
  setTimeout(fn: () => void, ms: number): unknown {
    const id = ++this.seq
    this.timers.set(id, { at: this.t + ms, fn })
    return id
  }
  clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number)
  }
  advance(ms: number, step = 10): void {
    const end = this.t + ms
    while (this.t < end) {
      this.t = Math.min(end, this.t + step)
      for (const [id, timer] of [...this.timers].sort((a, b) => a[1].at - b[1].at)) {
        if (timer.at <= this.t && this.timers.has(id)) {
          this.timers.delete(id)
          timer.fn()
        }
      }
    }
  }
}

console.log('\n# Sentence stream splitter')

await test('first sentence is emitted as soon as it is complete (token stream)', () => {
  const s = new SentenceStreamSplitter({ firstMaxChars: 110, minChars: 12 })
  const tokens = ['Оксиды', ' —', ' это', ' сложные', ' вещества', ' из', ' двух', ' элементов', '.', ' Один', ' из', ' них', ' кислород', '.']
  const emittedAt: number[] = []
  const out: string[] = []
  tokens.forEach((tok, i) => {
    for (const sentence of s.push(tok)) {
      out.push(sentence)
      emittedAt.push(i)
    }
  })
  // «.» пришла 9-м токеном, следом пробел — граница подтверждается на следующем токене.
  assert.equal(out[0], 'Оксиды — это сложные вещества из двух элементов.')
  assert.equal(emittedAt[0], 9, 'first sentence must not wait for the end of the answer')
  out.push(...s.flush())
  assert.deepEqual(out, ['Оксиды — это сложные вещества из двух элементов.', 'Один из них кислород.'])
})

await test('abbreviations, decimals and initials are not sentence boundaries', () => {
  assert.deepEqual(splitIntoSentences('Металлы, т. е. простые вещества, проводят ток. Плотность 2.7 г/см³ у алюминия. Таблицу создал Д. И. Менделеев.'), [
    'Металлы, т. е. простые вещества, проводят ток.',
    'Плотность 2.7 г/см³ у алюминия.',
    'Таблицу создал Д. И. Менделеев.',
  ])
  assert.equal(findSentenceBoundary('H2O.Это вода'), -1)
  assert.deepEqual(splitIntoSentences('Water boils at 100 °C, e.g. at sea level. Really?'), ['Water boils at 100 °C, e.g. at sea level.', 'Really?'])
})

await test('§/№ numbers and «quoted titles» do not split a sentence (greeting «§1. Химия…»)', () => {
  assert.deepEqual(splitIntoSentences('Привет! Поговорим про «§1. Химия и её задачи». Спрашивай что угодно.'), [
    'Привет! Поговорим про «§1. Химия и её задачи».',
    'Спрашивай что угодно.',
  ])
  assert.deepEqual(splitIntoSentences('Решим задачу № 3. Потом проверим ответ.'), ['Решим задачу № 3. Потом проверим ответ.'])
  // В потоке закрывающая «ёлочка» ещё не пришла — не режем внутри названия.
  const sp = new SentenceStreamSplitter()
  const out: string[] = []
  for (const tok of ['Тема «§2. Окси', 'ды». Оксиды — это ', 'вещества. Пример: CO2.']) out.push(...sp.push(tok))
  out.push(...sp.flush())
  assert.deepEqual(out, ['Тема «§2. Оксиды».', 'Оксиды — это вещества.', 'Пример: CO2.'])
})

await test('markdown is cleaned, short sentences merge, long run-on is soft-cut', () => {
  const s = new SentenceStreamSplitter({ minChars: 16, firstMaxChars: 60, maxChars: 80 })
  const got = [...s.push('**Да.** Смотри: '), ...s.push('кислоты содержат водород, '.repeat(4)), ...s.flush()]
  assert.ok(got[0]!.startsWith('Да. Смотри:'), got[0])
  assert.ok(!got.join(' ').includes('**'))
  assert.ok(got.every((x) => x.length <= 90), JSON.stringify(got))
  assert.equal(countWords('Оксид CO2 — это газ.'), 4)
})

console.log('\n# Turn queue (FIFO, nothing lost)')

await test('inputs queued while the handler is busy are processed in order', async () => {
  const seen: string[] = []
  let release!: () => void
  const q = new TurnQueue({
    coalesceVoiceMs: 0,
    handler: async (item) => {
      seen.push(`${item.kind}:${item.text}`)
      if (item.text === 'greeting') await new Promise<void>((r) => (release = r))
    },
  })
  q.enqueue('command', 'greeting')
  q.enqueue('text', 'Что такое химия?')
  q.enqueue('voice', 'а почему')
  q.enqueue('command', 'ask_another')
  assert.equal(q.size, 3)
  assert.ok(q.isBusy())
  release()
  await q.whenIdle()
  assert.deepEqual(seen, ['command:greeting', 'text:Что такое химия?', 'voice:а почему', 'command:ask_another'])
})

await test('voice fragments within the window coalesce; empty/closed are ignored', async () => {
  let clock = 0
  const texts: string[] = []
  let release!: () => void
  const q = new TurnQueue({
    now: () => clock,
    coalesceVoiceMs: 1200,
    handler: async (item: TurnInput) => {
      texts.push(item.text)
      if (texts.length === 1) await new Promise<void>((r) => (release = r))
    },
  })
  q.enqueue('text', 'первый')
  q.enqueue('voice', 'расскажи про')
  clock += 800
  q.enqueue('voice', 'оксиды')
  clock += 5000
  q.enqueue('voice', 'и кислоты')
  assert.equal(q.enqueue('text', '   '), null)
  release()
  await q.whenIdle()
  assert.deepEqual(texts, ['первый', 'расскажи про оксиды', 'и кислоты'])
  q.close()
  assert.equal(q.enqueue('text', 'после закрытия'), null)
})

await test('a throwing handler does not stall the queue', async () => {
  const seen: string[] = []
  const errors: string[] = []
  const q = new TurnQueue({
    handler: async (item) => {
      seen.push(item.text)
      if (item.text === 'boom') throw new Error('x')
    },
    onError: (_e, item) => errors.push(item.text),
  })
  q.enqueue('text', 'boom')
  q.enqueue('text', 'next')
  await q.whenIdle()
  assert.deepEqual(seen, ['boom', 'next'])
  assert.deepEqual(errors, ['boom'])
})

console.log('\n# Barge-in state machine (fake timers)')

function makeBargeIn(opts: { teacher?: string[]; vad?: boolean } = {}) {
  const s = new FakeScheduler()
  const fired: { text: string; speechMs: number; at: number }[] = []
  const teacher = opts.teacher ?? ['Оксиды — это сложные вещества, в состав которых входит кислород.']
  const d = new BargeInDetector({
    scheduler: s,
    minSpeechMs: 220,
    energyThreshold: 0.04,
    vadAvailable: opts.vad ?? true,
    isEcho: (t) => looksLikeAnyTeacherEcho(t, teacher),
    onBargeIn: (info) => fired.push(info),
  })
  return { s, d, fired }
}

await test('loud ≥220 ms AND non-echo transcript → fires', () => {
  const { s, d, fired } = makeBargeIn()
  d.setAiSpeaking(true)
  s.advance(300)
  for (let i = 0; i < 10; i++) {
    d.level(0.09)
    s.advance(30)
    if (i === 3) d.transcript('подождите а почему')
  }
  assert.equal(fired.length, 1)
  assert.ok(fired[0]!.speechMs >= 220, `speechMs=${fired[0]!.speechMs}`)
  assert.equal(d.state, 'fired')
  report.bargeInDecisionAfterLoudMs = fired[0]!.speechMs
})

await test('echo of the teacher voice never fires, even when loud', () => {
  const { s, d, fired } = makeBargeIn()
  d.setAiSpeaking(true)
  s.advance(200)
  for (let i = 0; i < 20; i++) {
    d.level(0.12)
    s.advance(30)
    d.transcript('это сложные вещества в состав которых входит')
  }
  assert.equal(fired.length, 0)
})

await test('short noise (<220 ms) or transcript without energy does not fire', () => {
  const { s, d, fired } = makeBargeIn()
  d.setAiSpeaking(true)
  s.advance(200)
  for (let i = 0; i < 3; i++) {
    d.level(0.1)
    s.advance(30)
  }
  d.level(0.001)
  s.advance(300)
  d.level(0.001)
  d.transcript('ну и что дальше')
  assert.equal(fired.length, 0, 'noise 90 ms + later transcript must not fire')
  s.advance(3000)
  d.level(0.001)
  d.transcript('совсем другое предложение ученика')
  assert.equal(fired.length, 0, 'transcript without energy must not fire')
})

await test('"стоп" whose transcript arrives after the sound ended still fires', () => {
  const { s, d, fired } = makeBargeIn()
  d.setAiSpeaking(true)
  s.advance(200)
  for (let i = 0; i < 9; i++) {
    d.level(0.1)
    s.advance(30)
  }
  for (let i = 0; i < 6; i++) {
    d.level(0.002)
    s.advance(30)
  }
  d.transcript('стоп')
  assert.equal(fired.length, 1)
})

await test('without VAD a meaningful non-echo transcript is enough; disabled never fires', () => {
  const a = makeBargeIn({ vad: false })
  a.d.setAiSpeaking(true)
  a.s.advance(200)
  a.d.transcript('да')
  assert.equal(a.fired.length, 0, 'single short word is not a barge-in')
  a.d.transcript('подождите я не понял')
  assert.equal(a.fired.length, 1)
  const b = makeBargeIn()
  b.d.setEnabled(false)
  b.d.setAiSpeaking(true)
  b.s.advance(200)
  for (let i = 0; i < 12; i++) {
    b.d.level(0.2)
    b.s.advance(30)
    b.d.transcript('подождите я не понял')
  }
  assert.equal(b.fired.length, 0)
})

console.log('\n# End of turn')

await test('final STT result commits after ~220 ms', () => {
  const s = new FakeScheduler()
  const commits: TurnCommit[] = []
  const t = new TurnEndDetector({ scheduler: s, silenceMs: 450, finalSettleMs: 220, onCommit: (c) => commits.push(c) })
  t.interim('что такое')
  t.final('что такое оксиды')
  s.advance(200)
  assert.equal(commits.length, 0)
  s.advance(40)
  assert.equal(commits.length, 1)
  assert.equal(commits[0]!.text, 'что такое оксиды')
  assert.equal(commits[0]!.reason, 'final')
})

await test('VAD silence after speech commits (hangover 200 + 450 ≈ 650 ms) and continuing speech cancels', () => {
  const s = new FakeScheduler()
  const commits: TurnCommit[] = []
  const t = new TurnEndDetector({ scheduler: s, silenceMs: 450, finalSettleMs: 220, onCommit: (c) => commits.push(c) })
  t.speechStart()
  t.interim('расскажи про')
  s.advance(300)
  t.speechEnd()
  s.advance(300)
  t.speechStart() // ученик продолжил
  t.interim('расскажи про кислоты')
  s.advance(600)
  assert.equal(commits.length, 0)
  t.speechEnd()
  const endAt = s.now()
  s.advance(300)
  assert.equal(commits.length, 0, 'no final result yet → waits the full silence window')
  s.advance(160)
  assert.equal(commits.length, 1)
  assert.equal(commits[0]!.text, 'расскажи про кислоты')
  assert.equal(commits[0]!.reason, 'silence')
  assert.ok(commits[0]!.usedInterim)
  report.silenceCommitAfterVadEndMs = commits[0]!.at - endAt
})

await test('final result already there when VAD reports silence → commits after ~220 ms', () => {
  const s = new FakeScheduler()
  const commits: TurnCommit[] = []
  const t = new TurnEndDetector({ scheduler: s, silenceMs: 450, finalSettleMs: 220, onCommit: (c) => commits.push(c) })
  t.speechStart()
  t.final('что такое моль')
  s.advance(500)
  assert.equal(commits.length, 0, 'still speaking')
  t.speechEnd()
  s.advance(230)
  assert.equal(commits.length, 1)
  assert.equal(commits[0]!.reason, 'final')
})

await test('VAD said silence before any text → waits for the transcript (grace)', () => {
  const s = new FakeScheduler()
  const commits: TurnCommit[] = []
  const t = new TurnEndDetector({ scheduler: s, silenceMs: 450, onCommit: (c) => commits.push(c) })
  t.speechStart()
  s.advance(200)
  t.speechEnd()
  s.advance(700)
  assert.equal(commits.length, 0)
  t.final('кислоты')
  s.advance(250)
  assert.equal(commits.length, 1)
})

console.log('\n# Echo filter & intents')

await test('echo filter: teacher phrases are echo, student replies are not', () => {
  const teacher = 'Оксиды — это сложные вещества из двух элементов, один из которых кислород.'
  assert.ok(looksLikeTeacherEcho('это сложные вещества из двух элементов', teacher))
  assert.ok(!looksLikeTeacherEcho('а почему кислород', teacher))
  assert.ok(!looksLikeTeacherEcho('да', teacher))
  assert.ok(!looksLikeTeacherEcho('смотри я не понял что такое моль', 'Смотри.'), 'short teacher phrase inside a student reply is not echo')
  assert.ok(sameUtterance('что такое оксиды', 'Что такое оксиды?'))
})

await test('intents: hush / stop / mode switch / repeat', () => {
  assert.equal(parseVoiceIntent('Стоп!', 'ru').kind, 'hush')
  assert.equal(parseVoiceIntent('давай закончим урок', 'ru').kind, 'stop')
  assert.equal(parseVoiceIntent('включи режим экзамена', 'ru').kind, 'switch_mode')
  assert.equal(parseVoiceIntent('повтори', 'ru').kind, 'repeat')
  assert.equal(parseVoiceIntent('что такое оксиды', 'ru').kind, 'explain')
  assert.equal(parseVoiceIntent('оксиды состоят из двух элементов', 'ru').kind, 'answer')
})

console.log('\n# LiveSpeechOutput (fake backend)')

type BackendLog = { hardStops: number[]; synth: string[]; plays: string[]; browser: string[]; cancels: number[] }

function fakeBackend(env: Partial<LiveTtsEnvironment>, opts: { synthMs?: number; playMs?: number; browserMs?: number; synthHang?: boolean } = {}) {
  const log: BackendLog = { hardStops: [], synth: [], plays: [], browser: [], cancels: [] }
  let active: (() => void) | null = null
  const backend: LiveSpeechBackend = {
    ready: async () => undefined,
    environment: () => ({ desktop: false, edge: false, browserSupported: true, browserVoices: 1, puterSignedIn: false, ...env }),
    prepare: (t) => t,
    synthesize: (_path, text, _lang, signal) => {
      log.synth.push(text)
      if (opts.synthHang) return new Promise(() => undefined)
      return new Promise<NeuralAudio | null>((resolve) => {
        const timer = setTimeout(() => resolve({ audioBase64: text, mimeType: 'audio/mpeg' }), opts.synthMs ?? 30)
        signal.addEventListener('abort', () => {
          clearTimeout(timer)
          resolve(null)
        })
      })
    },
    play: (audio, signal) =>
      new Promise<void>((resolve, reject) => {
        log.plays.push(audio.audioBase64)
        const timer = setTimeout(resolve, opts.playMs ?? 200)
        active = () => {
          clearTimeout(timer)
          reject(new DOMException('Aborted', 'AbortError'))
        }
        signal.addEventListener('abort', () => active?.())
      }),
    speakBrowser: (text, _lang, onStart) => {
      log.browser.push(text)
      let resolveDone!: () => void
      const done = new Promise<void>((r) => (resolveDone = r))
      const startTimer = setTimeout(onStart, 10)
      const timer = setTimeout(resolveDone, opts.browserMs ?? 200)
      return {
        done,
        cancel: () => {
          log.cancels.push(performance.now())
          clearTimeout(timer)
          clearTimeout(startTimer)
          resolveDone()
        },
      }
    },
    claimChannel: async () => () => true,
    hardStop: () => {
      log.hardStops.push(performance.now())
      active?.()
    },
  }
  return { backend, log }
}

await test('path choice: electron > edge > browser voice > puter (signed in) > silent', () => {
  const base: LiveTtsEnvironment = { desktop: false, edge: false, browserSupported: true, browserVoices: 1, puterSignedIn: true }
  assert.equal(chooseLiveTtsPath({ ...base, desktop: true, edge: true }), 'electron')
  assert.equal(chooseLiveTtsPath({ ...base, edge: true }), 'edge')
  assert.equal(chooseLiveTtsPath(base), 'browser')
  assert.equal(chooseLiveTtsPath({ ...base, browserVoices: 0 }), 'puter')
  assert.equal(chooseLiveTtsPath({ ...base, browserVoices: 0, puterSignedIn: false }), 'browser')
  assert.equal(chooseLiveTtsPath({ ...base, browserSupported: false, browserVoices: 0, puterSignedIn: false }), 'silent')
})

await test('neural path prefetches the next sentence and cancels instantly', async () => {
  const { backend, log } = fakeBackend({ desktop: true }, { synthMs: 40, playMs: 300 })
  const starts: number[] = []
  const out = new LiveSpeechOutput({ lang: 'ru', backend, onSentenceStart: (_u, i) => starts.push(i) })
  const u = out.begin()
  u.push('Первая фраза учителя.')
  u.push('Вторая фраза учителя.')
  u.push('Третья фраза учителя.')
  u.end()
  await sleep(10)
  assert.deepEqual(log.synth, ['Первая фраза учителя.', 'Вторая фраза учителя.'], 'current + next are prefetched, not all')
  await sleep(120)
  assert.deepEqual(starts, [0])
  assert.equal(log.synth.length, 2, 'while #0 plays only #1 is prefetched')
  await sleep(300)
  assert.deepEqual(starts, [0, 1])
  assert.equal(log.synth.length, 3, '#2 is prefetched as soon as #1 starts')
  const t0 = performance.now()
  u.cancel()
  const outcome = await u.done
  const ms = performance.now() - t0
  assert.equal(outcome, 'cancelled')
  assert.ok(ms < 20, `cancel settled in ${ms} ms`)
  await sleep(400)
  assert.deepEqual(starts, [0, 1], 'nothing plays after cancel')
  report.outputCancelSettleMs = Math.round(ms * 10) / 10
})

await test('neural synthesis that hangs degrades to the browser voice (no silence)', async () => {
  const { backend, log } = fakeBackend({ edge: true }, { synthHang: true, browserMs: 40 })
  const paths: string[] = []
  const out = new LiveSpeechOutput({ lang: 'ru', backend, neuralTimeoutMs: 80, onPathChange: (p) => paths.push(p) })
  const u = out.begin()
  u.push('Фраза один.')
  u.push('Фраза два.')
  u.end()
  assert.equal(await u.done, 'completed')
  assert.deepEqual(log.browser, ['Фраза один.', 'Фраза два.'])
  assert.equal(out.getPath(), 'browser')
  assert.ok(paths.includes('edge') && paths.at(-1) === 'browser', JSON.stringify(paths))
})

await test('a new utterance cancels the previous one', async () => {
  const { backend } = fakeBackend({}, { browserMs: 500 })
  const out = new LiveSpeechOutput({ lang: 'ru', backend })
  const a = out.begin()
  a.push('Длинная фраза номер один.')
  a.end()
  await sleep(20)
  const b = out.begin()
  assert.equal(await a.done, 'cancelled')
  b.cancel()
  assert.equal(await b.done, 'cancelled')
})

console.log('\n# DuplexVoiceSession (fake STT / VAD / speech)')

function makeDuplex() {
  const { backend, log } = fakeBackend({}, { browserMs: 900 })
  const output = new LiveSpeechOutput({ lang: 'ru', backend })
  let onUpdate: ((full: string, interim: string) => void) | null = null
  let session: { committed: string } | null = null
  const recognition: RecognitionLike = {
    start: (_locale, s, cb) => {
      session = s
      onUpdate = cb
      return true
    },
    stop: () => undefined,
  }
  let vad!: { onSpeechStart: () => void; onSpeechEnd: (ms: number) => void; onLevel: (rms: number, speaking: boolean) => void }
  const utterances: { text: string; meta?: UserUtteranceMeta; at: number }[] = []
  const bargeIns: (BargeInEvent & { at: number })[] = []
  const partials: string[] = []
  const d = new DuplexVoiceSession({
    lang: 'ru',
    controller: {} as never,
    speechOutput: output,
    recognition,
    createVad: (h) => {
      vad = h
      return { attach: async () => true, detach: () => undefined }
    },
    onUserUtterance: (text, meta) => utterances.push({ text, meta, at: performance.now() }),
    onBargeIn: (ev) => bargeIns.push({ ...ev, at: performance.now() }),
    onPartial: (p) => partials.push(p),
  })
  const stt = {
    interim: (text: string) => onUpdate?.(session!.committed.trim(), text),
    final: (text: string) => {
      session!.committed = `${session!.committed}${text} `
      onUpdate?.(session!.committed.trim(), '')
    },
  }
  return { d, log, stt, vad: () => vad, utterances, bargeIns, partials }
}

await test('voice barge-in stops the teacher in <150 ms and the student turn is committed', async () => {
  const h = makeDuplex()
  await h.d.begin({} as MediaStream)
  const turn = h.d.beginTeacherTurn()
  const teacherLine = 'Оксиды — это сложные вещества, в состав которых входит кислород.'
  turn.push(teacherLine)
  turn.push('Например, углекислый газ и вода.')
  turn.end()
  await sleep(60)
  assert.ok(h.d.isAiSpeaking())
  // Эхо колонок: громко + транскрипт фразы учителя — учитель продолжает говорить.
  for (let i = 0; i < 10; i++) {
    h.vad().onLevel(0.1, true)
    if (i === 2) h.stt.interim('это сложные вещества в состав которых входит')
    await sleep(30)
  }
  assert.ok(h.d.isAiSpeaking(), 'echo must not interrupt')
  assert.equal(h.bargeIns.length, 0)
  // Тишина, затем ученик говорит сам.
  for (let i = 0; i < 6; i++) {
    h.vad().onLevel(0.002, false)
    await sleep(30)
  }
  let transcriptAt = 0
  let loudStart = 0
  for (let i = 0; i < 14 && h.bargeIns.length === 0; i++) {
    if (i === 0) loudStart = performance.now()
    h.vad().onLevel(0.09, true)
    if (i === 3) {
      transcriptAt = performance.now()
      h.stt.interim('подождите а почему кислород')
    }
    await sleep(25)
  }
  assert.equal(h.bargeIns.length, 1, 'barge-in fired')
  const ev = h.bargeIns[0]!
  assert.equal(ev.source, 'voice')
  assert.ok(ev.stopLatencyMs < 150, `stopLatencyMs=${ev.stopLatencyMs}`)
  const stopAt = h.log.cancels.at(-1) ?? h.log.hardStops.at(-1) ?? 0
  assert.ok(stopAt - ev.at < 150 && stopAt >= transcriptAt)
  assert.equal(await turn.done, 'interrupted')
  assert.ok(!h.d.isAiSpeaking())
  report.bargeInStopLatencyMs = ev.stopLatencyMs
  report.bargeInFromLoudStartMs = Math.round(ev.at - loudStart)
  // Ученик договорил: финал + конец речи по VAD → реплика уходит в движок.
  h.stt.final('подождите а почему кислород')
  const endAt = performance.now()
  h.vad().onSpeechEnd(900)
  for (let i = 0; i < 40 && h.utterances.length === 0; i++) await sleep(25)
  assert.equal(h.utterances.length, 1)
  assert.equal(h.utterances[0]!.text, 'подождите а почему кислород')
  assert.ok(h.utterances[0]!.meta?.afterBargeIn)
  report.commitAfterSpeechEndMs = Math.round(h.utterances[0]!.at - endAt)
  assert.ok(h.utterances[0]!.at - endAt < 700, `commit took ${h.utterances[0]!.at - endAt} ms`)
  h.d.end()
})

await test('manual interrupt ("перебить") stops instantly and does not create a user turn', async () => {
  const h = makeDuplex()
  await h.d.begin({} as MediaStream)
  const turn = h.d.beginTeacherTurn()
  turn.push('Длинное объяснение учителя про моль и число Авогадро.')
  turn.end()
  await sleep(40)
  const t0 = performance.now()
  assert.equal(h.d.interrupt('manual'), true)
  assert.equal(await turn.done, 'interrupted')
  report.manualInterruptMs = Math.round((performance.now() - t0) * 10) / 10
  assert.ok(performance.now() - t0 < 50)
  await sleep(700)
  assert.equal(h.utterances.length, 0)
  assert.equal(h.d.interrupt('manual'), false, 'nothing to interrupt')
  h.d.end()
})

await test('normal turn (teacher silent): final result commits fast', async () => {
  const h = makeDuplex()
  await h.d.begin({} as MediaStream)
  h.vad().onSpeechStart()
  h.stt.interim('что такое')
  await sleep(100)
  h.stt.final('что такое оксиды')
  const finalAt = performance.now()
  h.vad().onSpeechEnd(800)
  for (let i = 0; i < 40 && h.utterances.length === 0; i++) await sleep(20)
  assert.equal(h.utterances[0]?.text, 'что такое оксиды')
  report.commitAfterFinalMs = Math.round(h.utterances[0]!.at - finalAt)
  assert.ok(h.utterances[0]!.at - finalAt < 700)
  assert.ok(h.partials.includes('что такое'), 'interim transcript is exposed to the UI')
  h.d.end()
})

await test('speaking turn completes → aiSpeaking resets (never sticks)', async () => {
  const { backend } = fakeBackend({}, { browserMs: 30 })
  const d = new DuplexVoiceSession({
    lang: 'ru',
    controller: {} as never,
    speechOutput: new LiveSpeechOutput({ lang: 'ru', backend }),
    recognition: { start: () => true, stop: () => undefined },
    createVad: () => ({ attach: async () => true, detach: () => undefined }),
    onUserUtterance: () => undefined,
  })
  await d.begin(null)
  assert.equal(await d.speak('Раз. Два предложения тут.'), true)
  assert.equal(d.isAiSpeaking(), false)
  assert.equal(d.getTurn(), 'idle')
})

console.log('\n# learnSpeechPlayback')

await test('stopNeuralPlayback settles the pending playNeuralAudioBase64 promise', async () => {
  class FakeAudio {
    preload = ''
    muted = false
    volume = 1
    src = ''
    currentTime = 0
    onended: (() => void) | null = null
    onerror: (() => void) | null = null
    play() {
      return new Promise<void>(() => undefined) // «играет» бесконечно
    }
    pause() {}
    removeAttribute() {}
    load() {}
  }
  ;(globalThis as { Audio?: unknown }).Audio = FakeAudio
  const playback = await import('../src/learn/learnSpeechPlayback.ts')
  const p = playback.playNeuralAudioBase64(Buffer.from('fake').toString('base64'), 'audio/mpeg')
  const settled = p.then(
    () => 'resolved',
    (e: Error) => e.name,
  )
  await sleep(20)
  playback.stopNeuralPlayback()
  const result = await Promise.race([settled, sleep(200).then(() => 'hung')])
  assert.equal(result, 'AbortError')
  // Новый клип вытесняет старый — старый промис тоже завершается.
  const a = playback.playNeuralAudioBase64(Buffer.from('a').toString('base64'), 'audio/mpeg').then(
    () => 'resolved',
    (e: Error) => e.name,
  )
  await sleep(5)
  const b = playback.playNeuralAudioBase64(Buffer.from('b').toString('base64'), 'audio/mpeg').catch(() => undefined)
  assert.equal(await Promise.race([a, sleep(200).then(() => 'hung')]), 'AbortError')
  playback.stopNeuralPlayback()
  await b
})

console.log('\n# Follow-ups & session memory')

await test('"а почему?", "приведи пример", "проще", "повтори" refer to the previous question', () => {
  const prev = ['Что такое оксиды?']
  const why = resolveTurn('а почему?', prev, 'ru')
  assert.equal(why.query, 'Что такое оксиды?')
  assert.ok(why.style.wantWhy)
  const ex = resolveTurn('приведи пример', prev, 'ru')
  assert.equal(ex.query, 'Что такое оксиды?')
  assert.ok(ex.style.wantExample)
  const simpler = resolveTurn('объясни проще', prev, 'ru')
  assert.ok(simpler.style.simpler)
  assert.equal(simpler.query, 'Что такое оксиды?')
  const rep = resolveTurn('повтори', prev, 'ru')
  assert.ok(rep.repeatLast)
  const more = resolveTurn('расскажи подробнее про кислоты', prev, 'ru')
  assert.equal(more.query, 'кислоты')
  assert.equal(more.style.detail, 'more')
  assert.ok(!more.followUp.needsPrevious)
  const en = resolveTurn('why?', ['What is an oxide?'], 'en')
  assert.equal(en.query, 'What is an oxide?')
  assert.ok(!isSubstantiveQuestion('а почему?'))
  assert.ok(isSubstantiveQuestion('что такое моль'))
  assert.deepEqual(detectFollowUp('что такое оксиды').kinds, [])
})

await test('barge-in fillers «подождите, а почему…» / «слушай, что такое…» are not the topic', () => {
  const prev = ['Что такое оксиды?']
  const bare = resolveTurn('подождите, а почему?', prev, 'ru')
  assert.equal(bare.query, 'Что такое оксиды?')
  assert.ok(bare.style.wantWhy)
  const own = resolveTurn('подождите а почему соль растворяется в воде', prev, 'ru')
  assert.equal(own.query, 'соль растворяется в воде')
  const what = resolveTurn('слушай, что такое моль', prev, 'ru')
  assert.equal(what.query, 'что такое моль')
  assert.ok(!isSubstantiveQuestion('стоп, а почему?'))
  assert.equal(stripLeadingDiscourse('подождите'), 'подождите')
  assert.equal(stripLeadingDiscourse('wait, why is water polar'), 'why is water polar')
})

console.log('\n# Local answer composer (no LLM)')

await test('definition = key term is the subject: «Наука химия изучает…» yes, «Эпоха … химии (1860 – …)» no', () => {
  const hits: KnowledgeHitLike[] = [
    {
      title: 'История химии',
      type: 'textbook',
      text: 'Эпоха классической химии (1860-год – конец XIX века). Лавуазье В этот период химия как наука получила полное развитие.',
    },
    {
      title: 'Химия и ее задачи: главное',
      type: 'summary',
      text: 'Основные понятия: Наука химия изучает состав, строение, свойства и изменения веществ, а также явления и процессы, происходящие при этих изменениях.',
    },
    { title: 'Кислоты', type: 'textbook', text: 'Природные кислоты также называют органическими кислотами.' },
  ]
  const r = composeLocalAnswer({ query: 'Что такое химия?', hits, lang: 'ru', seed: 0 })
  assert.ok(r.confident, r.text)
  assert.ok(r.sentences[0]!.startsWith('Наука химия изучает состав'), r.text)
  assert.ok(!/Лавуазье В/.test(r.text), 'caption glued to a sentence is dropped')
  assert.ok(!r.text.includes('Основные понятия'), 'KB card label is stripped')
  const acid = composeLocalAnswer({ query: 'что такое кислота', hits, lang: 'ru', seed: 0 })
  assert.ok(!/Кислота — это природные/.test(acid.text), `bad reframe: ${acid.text}`)
})

const OXIDE_HITS: KnowledgeHitLike[] = [
  {
    title: '§ 12. Оксиды',
    type: 'definition',
    text:
      'Оксиды — это сложные вещества, состоящие из двух элементов, один из которых кислород. ' +
      'Оксиды образуются при горении простых веществ в кислороде, потому что кислород активно соединяется с другими элементами. ' +
      'Например, при горении углерода образуется углекислый газ CO2.',
  },
  {
    title: 'Кислоты',
    type: 'card',
    text: 'Кислоты — это сложные вещества, в состав которых входят атомы водорода и кислотный остаток.',
  },
]

function hitsCorpus(hits: readonly KnowledgeHitLike[]): string {
  return hits.map((h) => h.text).join(' ')
}

await test('RU "что такое": direct definition first, example, check question, ≤ ~60 words, no invented facts', () => {
  const r = composeLocalAnswer({ query: 'Что такое оксиды?', hits: OXIDE_HITS, lang: 'ru', seed: 1 })
  assert.ok(r.confident)
  assert.ok(r.sentences[0]!.startsWith('Оксиды — это сложные вещества'), r.text)
  assert.ok(r.text.includes('CO2'), 'example from the retrieved text')
  assert.ok(r.sentences.at(-1)!.endsWith('?'), 'ends with a check question')
  assert.ok(countWords(r.text) <= 70, `words=${countWords(r.text)}`)
  const corpus = hitsCorpus(OXIDE_HITS)
  // Все фактические фразы (кроме последней — вопроса) взяты из найденного текста.
  for (const s of r.sentences.slice(0, -1)) {
    const core = s.replace(/^(Например:|Почему так\?|Если проще:)\s*/i, '').replace(/\.$/, '')
    assert.ok(corpus.toLowerCase().includes(core.toLowerCase().slice(0, 40)), `invented? «${s}»`)
  }
  assert.deepEqual(r.usedTitles.includes('§ 12. Оксиды'), true)
  report.composerSampleRu = r.text
})

await test('RU "почему": cause first; "пример": example present; "подробнее": longer but bounded', () => {
  const why = composeLocalAnswer({ query: 'почему образуются оксиды', hits: OXIDE_HITS, lang: 'ru', style: { wantWhy: true } })
  assert.ok(why.confident)
  assert.ok(/потому что/.test(why.sentences[0]!), why.text)
  const ex = composeLocalAnswer({ query: 'Что такое оксиды?', hits: OXIDE_HITS, lang: 'ru', style: { wantExample: true } })
  assert.ok(/Например/.test(ex.text))
  const more = composeLocalAnswer({ query: 'Что такое оксиды?', hits: OXIDE_HITS, lang: 'ru', style: { detail: 'more' } })
  assert.ok(countWords(more.text) >= countWords(composeLocalAnswer({ query: 'Что такое оксиды?', hits: OXIDE_HITS, lang: 'ru' }).text))
  assert.ok(countWords(more.text) <= 160)
})

await test('nothing relevant retrieved → honest "no answer" with a related topic, no facts made up', () => {
  const none = composeLocalAnswer({ query: 'Кто выиграл чемпионат мира по футболу?', hits: [], lang: 'ru', topicHint: 'Оксиды', suggestSmartAi: true })
  assert.equal(none.confident, false)
  assert.ok(/нет/.test(none.text) && /выдумывать/.test(none.text), none.text)
  assert.ok(/Оксиды/.test(none.text))
  assert.ok(/умный ИИ/.test(none.text))
  const unrelated = composeLocalAnswer({ query: 'Кто выиграл чемпионат мира по футболу?', hits: OXIDE_HITS, lang: 'ru' })
  assert.equal(unrelated.confident, false, unrelated.text)
  assert.ok(!unrelated.text.includes('кислород'), 'must not read unrelated facts as an answer')
})

await test('EN and UZ answers are spoken-style and use only retrieved text', () => {
  const en = composeLocalAnswer({
    query: 'What is an oxide?',
    lang: 'en',
    hits: [
      {
        title: 'Oxides',
        type: 'definition',
        text: 'An oxide is a compound of two elements, one of which is oxygen. For example, water H2O and carbon dioxide CO2 are oxides.',
      },
    ],
  })
  assert.ok(en.confident, en.text)
  assert.ok(en.sentences[0]!.startsWith('An oxide is a compound'), en.text)
  assert.ok(en.sentences.at(-1)!.endsWith('?'))
  const uz = composeLocalAnswer({
    query: 'Oksid nima?',
    lang: 'uz',
    hits: [{ title: 'Oksidlar', type: 'definition', text: 'Oksidlar ikki elementdan iborat murakkab moddalar bo‘lib, ulardan biri kislorod hisoblanadi.' }],
  })
  assert.ok(uz.text.length > 0)
  assert.equal(extractKeyTerm('что такое валентность?', 'ru'), 'валентность')
})

console.log('\n# Speech text for TTS')

await test('formulas expand only as whole tokens; «и т. д.», «стр.», «(…).» read naturally; stress is one fast pass', async () => {
  const { prepareTextForHumanTts } = await import('../src/learn/learnSpeechText.ts')
  const { applyRussianStressMarks } = await import('../src/learn/learnRussianStress.ts')
  const strip = (x: string) => x.replace(/́/g, '')
  const a = strip(prepareTextForHumanTts('Фтор образует фторид кислорода OF2, а N2O — закись азота.', 'ru'))
  assert.ok(!/Oфтор|азотO/.test(a), a)
  const b = strip(prepareTextForHumanTts('Вода H2O и кислород O2, см. стр. 12 и т. д.', 'ru'))
  assert.ok(b.includes('страница 12') && b.includes('так далее') && !/H2O|O2/.test(b), b)
  const c = strip(prepareTextForHumanTts('Эпоха классической химии (1860-год – конец XIX века).', 'ru'))
  assert.ok(!/,\s*\./.test(c), c)
  assert.equal(strip(prepareTextForHumanTts('Те вещества растворимы.', 'ru')), 'Те вещества растворимы.')
  // Ударение ставится один раз на слово (раньше «ча́сти́ца», «осно́ва́ния»).
  const stressed = applyRussianStressMarks('Атом — мельчайшая частица. Основания и молярная масса.')
  for (const w of stressed.split(/[\s.,—]+/)) assert.ok((w.match(/́/g) ?? []).length <= 1, stressed)
  const t0 = performance.now()
  for (let i = 0; i < 200; i++) applyRussianStressMarks('Молярная масса вещества обозначается буквой M и выражается в граммах на моль.')
  const ms = performance.now() - t0
  report.stress200SentencesMs = Math.round(ms)
  assert.ok(ms < 1500, `stress marking must be fast (${Math.round(ms)} ms)`)
})

console.log('\n# teacherKnowledge adapter')

await test('retrieveForTeacher: cache, time cap (off the critical path), abort, citations', async () => {
  let calls = 0
  setTeacherKnowledgeProvider(async (query) => {
    calls++
    await sleep(query.includes('медленно') ? 300 : 5)
    return { text: `[Kimyo 8, §2, стр. 10]\n${query}`, citations: ['[Kimyo 8, §2, стр. 10]'], hits: [{ title: 'Оксиды', text: 'Оксиды — это…', source: 'Kimyo 8' }] }
  })
  const ctx = { locale: 'ru' as const, gradeId: 'g8', chapterId: 'c1', timeoutMs: 100 }
  const a = await retrieveForTeacher('что такое оксиды', ctx)
  assert.equal(a.hits.length, 1)
  assert.equal(a.cached, false)
  const b = await retrieveForTeacher('Что  такое ОКСИДЫ', ctx)
  assert.equal(b.cached, true)
  assert.equal(calls, 1)
  const t0 = performance.now()
  const slow = await retrieveForTeacher('медленно ищется', ctx)
  assert.ok(slow.timedOut && slow.hits.length === 0)
  assert.ok(performance.now() - t0 < 180, 'caller is not blocked beyond timeoutMs')
  await sleep(260)
  const slowAgain = await retrieveForTeacher('медленно ищется', ctx)
  assert.ok(slowAgain.cached && slowAgain.hits.length === 1, 'finished in background and cached')
  const ctrl = new AbortController()
  const pending = retrieveForTeacher('медленно другое', { ...ctx, timeoutMs: 5_000, signal: ctrl.signal })
  setTimeout(() => ctrl.abort(), 20)
  const t1 = performance.now()
  const aborted = await pending
  assert.ok(performance.now() - t1 < 100 && aborted.hits.length === 0)
  assert.equal(citationForDisplay('[Kimyo 8, §2, стр. 10]', 'ru'), '[Kimyo 8, §2, стр. 10]')
  assert.equal(citationForDisplay('[ATOMLAB — Оксиды]', 'ru'), '[Источник: ATOMLAB — Оксиды]')
  setTeacherKnowledgeProvider(null)
  clearTeacherKnowledgeCache()
})

console.log('\n# Exam pools for all grades')

await test('oral exam pools are non-empty with rubrics for g7–g11, every chapter', async () => {
  const pools = await import('../src/learn/brain/dualMode/gradeOralPools.ts')
  const sizes: Record<string, number> = {}
  for (const g of ['g8', 'g9', 'g10', 'g11']) {
    for (let c = 1; c <= 8; c++) {
      const items = await pools.loadOralPool(g, `c${c}`)
      assert.ok(items.length >= 3, `${g} c${c}: ${items.length}`)
      for (const it of items) {
        assert.ok(it.questionSpeak.trim().length > 5, it.id)
        assert.ok(it.rubric.length >= 1, `${it.id} has no rubric`)
      }
      if (c === 1) sizes[g] = items.length
    }
    const total = (await import(`../src/learn/brain/dualMode/examPools/oral-${g}.json`, { with: { type: 'json' } })).default as { items: unknown[] }
    sizes[`${g}_total`] = total.items.length
  }
  const g7 = await pools.loadOralPool('g7', 'c1')
  assert.ok(g7.length > 0)
  report.examPools = JSON.stringify(sizes)
})

/* ------------------------------------------------------------------ summary */

console.log('\n# Measured')
for (const [k, v] of Object.entries(report)) console.log(`  ${k}: ${v}`)
console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('Failed:', failures.join('; '))
  process.exit(1)
}
process.exit(0)
