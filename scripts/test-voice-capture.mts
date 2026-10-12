#!/usr/bin/env node
/**
 * Захват голоса без браузера: WAV-энкодер, ресемплинг 48/44,1 → 16 кГц, пре-ролл 400 мс,
 * адаптивный порог VAD (тихий микрофон и шумный класс), сегментация реплики ≤ 25 с.
 *
 * Запуск: npx tsx scripts/test-voice-capture.mts  (npm run test:voice-capture)
 */
import assert from 'node:assert/strict'
import {
  encodeWavPcm16,
  floatToPcm16,
  FRAME_MS,
  FRAME_SAMPLES,
  resampleLinear,
  StreamResampler,
  STT_SAMPLE_RATE,
} from '../src/learn/brain/voice/wavEncode.ts'
import { AdaptiveVad, NoiseFloor } from '../src/learn/brain/voice/noiseFloor.ts'
import { MicCapture } from '../src/learn/brain/voice/micCapture.ts'
import { ServerRecognition, type CaptureListener, type CaptureSource } from '../src/learn/brain/voice/serverRecognition.ts'
import type { SttResult } from '../src/learn/brain/speech/serverStt.ts'
import type { TimingScheduler } from '../src/learn/brain/voice/conversationTiming.ts'

let passed = 0
let failed = 0
function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++
      console.log(`  ok  ${name}`)
    })
    .catch((e) => {
      failed++
      console.error(`  FAIL ${name}\n       ${(e as Error).stack ?? e}`)
    })
}

/** Частота синуса по пересечениям нуля снизу вверх (с линейной интерполяцией). */
function estimateHz(x: Float32Array | Int16Array, rate: number): number {
  const crossings: number[] = []
  for (let i = 1; i < x.length; i++) {
    const a = x[i - 1]!
    const b = x[i]!
    if (a < 0 && b >= 0) crossings.push(i - 1 + -a / (b - a))
  }
  assert.ok(crossings.length > 10, 'мало пересечений нуля')
  const periods = (crossings[crossings.length - 1]! - crossings[0]!) / (crossings.length - 1)
  return rate / periods
}

function sine(hz: number, rate: number, seconds: number, amp = 0.5): Float32Array {
  const n = Math.round(rate * seconds)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * hz * i) / rate)
  return out
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

/** Источник кадров для ServerRecognition: кольцо пре-ролла + события речи. */
class FakeSource implements CaptureSource {
  ring: { pcm: Int16Array; at: number }[] = []
  listeners = new Set<CaptureListener>()
  constructor(private readonly s: FakeScheduler) {}
  subscribe(l: CaptureListener) {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
  preRoll(ms: number) {
    return this.ring.slice(-Math.ceil(ms / FRAME_MS))
  }
  /** n кадров по 20 мс (часы двигаются). */
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
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

async function main() {
  console.log('\n# WAV-энкодер')
  await test('заголовок RIFF/WAVE fmt PCM 1 канал 16 кГц 16 бит + data', () => {
    const pcm = new Int16Array([0, 1, -1, 32767, -32768, 1234])
    const wav = encodeWavPcm16(pcm)
    const v = new DataView(wav.buffer, wav.byteOffset, wav.byteLength)
    const str = (o: number, n: number) => String.fromCharCode(...wav.subarray(o, o + n))
    assert.equal(wav.length, 44 + pcm.length * 2)
    assert.equal(str(0, 4), 'RIFF')
    assert.equal(v.getUint32(4, true), 36 + pcm.length * 2)
    assert.equal(str(8, 4), 'WAVE')
    assert.equal(str(12, 4), 'fmt ')
    assert.equal(v.getUint32(16, true), 16)
    assert.equal(v.getUint16(20, true), 1, 'PCM')
    assert.equal(v.getUint16(22, true), 1, 'моно')
    assert.equal(v.getUint32(24, true), 16000)
    assert.equal(v.getUint32(28, true), 32000)
    assert.equal(v.getUint16(32, true), 2)
    assert.equal(v.getUint16(34, true), 16)
    assert.equal(str(36, 4), 'data')
    assert.equal(v.getUint32(40, true), pcm.length * 2)
    for (let i = 0; i < pcm.length; i++) assert.equal(v.getInt16(44 + i * 2, true), pcm[i])
  })
  await test('float → PCM16 с ограничением ±1', () => {
    const p = floatToPcm16(new Float32Array([0, 1, -1, 2, -2, 0.5]))
    assert.equal(p[0], 0)
    assert.equal(p[1], 32767)
    assert.equal(p[2], -32768)
    assert.equal(p[3], 32767)
    assert.equal(p[4], -32768)
    assert.ok(Math.abs(p[5]! - 16384) <= 1)
  })
  await test('25 с аудио укладывается в контракт (data ≤ 800 000 байт, тело ≤ 1 МиБ)', () => {
    const wav = encodeWavPcm16(new Int16Array(STT_SAMPLE_RATE * 25))
    assert.equal(wav.length - 44, 800_000)
    assert.ok(wav.length <= 1_048_576)
  })

  console.log('\n# Ресемплинг → 16 кГц')
  for (const [rate, hz] of [
    [48_000, 440],
    [48_000, 1_000],
    [44_100, 440],
  ] as const) {
    await test(`${rate} Гц, синус ${hz} Гц: частота сохраняется (< 1 %), длина ≈ 1 с`, () => {
      const input = sine(hz, rate, 1)
      // Кусками по 128 отсчётов — как render quantum AudioWorklet.
      const rs = new StreamResampler(rate, STT_SAMPLE_RATE)
      const parts: Float32Array[] = []
      for (let i = 0; i < input.length; i += 128) parts.push(rs.process(input.subarray(i, i + 128)))
      const total = parts.reduce((n, p) => n + p.length, 0)
      const out = new Float32Array(total)
      let off = 0
      for (const p of parts) {
        out.set(p, off)
        off += p.length
      }
      assert.ok(Math.abs(out.length - STT_SAMPLE_RATE) <= 3, `длина ${out.length}`)
      const est = estimateHz(out, STT_SAMPLE_RATE)
      assert.ok(Math.abs(est - hz) / hz < 0.01, `оценка ${est.toFixed(2)} Гц`)
      // Поток без стыков = разовый ресемплинг.
      const once = resampleLinear(input, rate)
      assert.ok(Math.abs(once.length - out.length) <= 1)
    })
  }

  console.log('\n# Пре-ролл')
  await test('кольцо захвата отдаёт последние 400 мс (20 кадров), хранит ≤ 1 с', () => {
    const cap = new MicCapture(null)
    const push = (cap as unknown as { pushFrame(p: Int16Array, r: number): void }).pushFrame.bind(cap)
    for (let i = 0; i < 80; i++) push(new Int16Array(FRAME_SAMPLES).fill(i), 0.001)
    const pre = cap.preRoll(400)
    assert.equal(pre.length, 20)
    assert.equal(pre[0]!.pcm[0], 60)
    assert.equal(pre[19]!.pcm[0], 79)
    assert.equal(cap.preRoll(5_000).length, 50, 'кольцо 1 с')
    assert.equal(cap.frameCount(), 80)
    cap.stop()
  })
  await test('сегмент реплики начинается с пре-ролла 400 мс', async () => {
    const s = new FakeScheduler()
    const src = new FakeSource(s)
    const sent: Uint8Array[] = []
    const rec = new ServerRecognition({
      source: src,
      scheduler: s,
      post: async (wav, partial) => {
        if (!partial) sent.push(wav)
        return { ok: true, text: 'кислород', lang: 'ru' } as SttResult
      },
    })
    rec.start('ru', { committed: '' }, () => {})
    src.frames(30, 10) // тишина до речи: 600 мс
    src.speechStart()
    src.frames(25, 5000) // речь 500 мс
    src.speechEnd()
    await rec.idle()
    await flush()
    assert.equal(sent.length, 1)
    const samples = (sent[0]!.length - 44) / 2
    // 20 кадров пре-ролла + 25 кадров речи.
    assert.equal(samples, (20 + 25) * FRAME_SAMPLES)
    const v = new DataView(sent[0]!.buffer, sent[0]!.byteOffset)
    assert.equal(v.getInt16(44, true), 10, 'первые отсчёты — из пре-ролла (тишина)')
  })

  console.log('\n# Адаптивный порог VAD')
  await test('тихий микрофон: шум 0.006, речь 0.02 → VAD срабатывает', () => {
    let starts = 0
    const vad = new AdaptiveVad({ onSpeechStart: () => starts++ })
    let t = 0
    for (let i = 0; i < 100; i++) vad.process(0.006, FRAME_MS, (t += FRAME_MS)) // 2 с калибровки
    assert.equal(starts, 0)
    assert.ok(Math.abs(vad.noise.floor - 0.006) < 1e-6)
    assert.ok(vad.noise.startThreshold <= 0.02, `порог ${vad.noise.startThreshold}`)
    for (let i = 0; i < 10; i++) vad.process(0.02, FRAME_MS, (t += FRAME_MS))
    assert.equal(starts, 1, 'старый фиксированный порог 0.03 тут молчал бы')
  })
  await test('шумный класс: шум 0.02 не «говорит», порог поднялся, речь 0.06 → VAD', () => {
    let starts = 0
    let ends = 0
    const vad = new AdaptiveVad({ onSpeechStart: () => starts++, onSpeechEnd: () => ends++ })
    let t = 0
    for (let i = 0; i < 100; i++) vad.process(0.02, FRAME_MS, (t += FRAME_MS))
    assert.ok(vad.noise.startThreshold >= 0.059, `порог ${vad.noise.startThreshold}`)
    assert.equal(starts, 0, 'шум калибровки не включает речь')
    for (let i = 0; i < 10; i++) vad.process(0.06, FRAME_MS, (t += FRAME_MS))
    assert.equal(starts, 1)
    for (let i = 0; i < 20; i++) vad.process(0.02, FRAME_MS, (t += FRAME_MS)) // 400 мс > hangover 250
    assert.equal(ends, 1)
    // Шум «гуляет» ±20 % — VAD всё равно молчит (старый порог 0.03 «говорил» бы на 0.024).
    for (let i = 0; i < 100; i++) vad.process(0.02 + (i % 2 ? 0.004 : -0.004), FRAME_MS, (t += FRAME_MS))
    assert.equal(starts, 1, 'шум не включает речь')
    assert.equal(vad.isSpeaking(), false)
  })
  await test('калибровка: порог не ниже прежнего 0.03, пока шум не измерен', () => {
    let a = 0
    const vadA = new AdaptiveVad({ onSpeechStart: () => a++ })
    vadA.process(0.025, FRAME_MS, 20)
    assert.equal(a, 0, 'адаптивный порог дал бы 0.012 — но шум ещё не измерен')
    let b = 0
    const vadB = new AdaptiveVad({ onSpeechStart: () => b++ })
    vadB.process(0.031, FRAME_MS, 20)
    assert.equal(b, 1)
  })
  await test('шум в тишине отслеживается EMA; нормированный уровень: 0 на шуме, ≈0.03 на пороге', () => {
    const nf = new NoiseFloor()
    for (let i = 0; i < 80; i++) nf.push(0.005, FRAME_MS, false)
    const f0 = nf.floor
    for (let i = 0; i < 200; i++) nf.push(0.009, FRAME_MS, false)
    assert.ok(nf.floor > f0, 'шум вырос (вентилятор)')
    assert.ok(nf.normalized(nf.floor) < 1e-9)
    assert.ok(Math.abs(nf.normalized(nf.startThreshold) - 0.03) < 1e-6)
  })

  console.log('\n# Сегментация реплики ≤ 25 с')
  await test('30 с речи без паузы → финал на 25 с + финал остатка; каждый ≤ 800 000 байт', async () => {
    const s = new FakeScheduler()
    const src = new FakeSource(s)
    const finals: number[] = []
    const rec = new ServerRecognition({
      source: src,
      scheduler: s,
      partialEveryMs: 1e9,
      post: async (wav, partial) => {
        if (!partial) finals.push(wav.length - 44)
        return { ok: true, text: 'слово', lang: 'ru' } as SttResult
      },
    })
    const session = { committed: '' }
    rec.start('ru', session, () => {})
    src.frames(5, 10)
    src.speechStart()
    src.frames(1_500, 3000) // 30 с
    src.speechEnd()
    await rec.idle()
    await flush()
    assert.equal(finals.length, 2, `финалов ${finals.length}`)
    assert.ok(finals[0]! <= 800_000, `первый ${finals[0]}`)
    assert.ok(finals[0]! >= 790_000, 'первый — почти 25 с')
    assert.ok(finals[1]! > 0 && finals[1]! < 200_000, `второй ${finals[1]}`)
    assert.equal(session.committed.trim(), 'слово слово')
  })

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) process.exit(1)
}

void main()
