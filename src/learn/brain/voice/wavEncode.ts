/**
 * WAV для серверного распознавания (контракт «Голос» v1): RIFF/WAVE, PCM 16 бит LE, моно, 16 кГц.
 *
 *  • resampleLinear — разовый ресемплинг (48 → 16 кГц и т. п.) с простым НЧ-фильтром (усреднение окна);
 *  • StreamResampler — то же потоково (запасной ScriptProcessor без AudioWorklet);
 *  • encodeWavPcm16 — заголовок 44 байта + данные.
 *
 * Чистый модуль без DOM — тесты: scripts/test-voice-capture.mts.
 */

/** Частота, которую ждёт /stt. */
export const STT_SAMPLE_RATE = 16_000
/** Длина кадра захвата (мс) — 320 отсчётов при 16 кГц. */
export const FRAME_MS = 20
export const FRAME_SAMPLES = (STT_SAMPLE_RATE * FRAME_MS) / 1000

export function clamp16(v: number): number {
  const s = Math.max(-1, Math.min(1, v))
  return s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff)
}

export function floatToPcm16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) out[i] = clamp16(input[i]!)
  return out
}

export function pcm16ToFloat(input: Int16Array): Float32Array {
  const out = new Float32Array(input.length)
  for (let i = 0; i < input.length; i++) out[i] = input[i]! / 0x8000
  return out
}

/** RMS кадра (0..1). */
export function rmsOf(samples: Float32Array | Int16Array): number {
  if (samples.length === 0) return 0
  const scale = samples instanceof Int16Array ? 1 / 0x8000 : 1
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i]! * scale
    sum += v * v
  }
  return Math.sqrt(sum / samples.length)
}

/**
 * Потоковый ресемплер: линейная интерполяция + усреднение окна шириной ratio (анти-алиасинг
 * при понижении частоты). Состояние между кусками сохраняется — стыков нет.
 */
export class StreamResampler {
  private readonly ratio: number
  /** Дробная позиция следующего выходного отсчёта во входном потоке (относительно начала буфера). */
  private pos = 0
  private tail: Float32Array = new Float32Array(0)

  constructor(fromRate: number, toRate: number = STT_SAMPLE_RATE) {
    this.ratio = fromRate / toRate
  }

  process(chunk: Float32Array): Float32Array {
    if (this.ratio === 1) return chunk.slice()
    // Буфер = хвост прошлого куска + новый.
    const buf = new Float32Array(this.tail.length + chunk.length)
    buf.set(this.tail, 0)
    buf.set(chunk, this.tail.length)
    const out: number[] = []
    const half = this.ratio > 1 ? this.ratio / 2 : 0
    while (this.pos + half + 1 < buf.length) {
      if (this.ratio > 1) {
        // Среднее по окну [pos - half, pos + half] — грубый, но устойчивый НЧ-фильтр.
        const a = Math.max(0, Math.floor(this.pos - half))
        const b = Math.min(buf.length - 1, Math.ceil(this.pos + half))
        let sum = 0
        for (let i = a; i <= b; i++) sum += buf[i]!
        out.push(sum / (b - a + 1))
      } else {
        const i = Math.floor(this.pos)
        const f = this.pos - i
        out.push(buf[i]! * (1 - f) + buf[i + 1]! * f)
      }
      this.pos += this.ratio
    }
    // Оставляем хвост, нужный для следующих отсчётов.
    const keepFrom = Math.max(0, Math.floor(this.pos - half) - 1)
    this.tail = buf.slice(keepFrom)
    this.pos -= keepFrom
    return Float32Array.from(out)
  }
}

/** Разовый ресемплинг всего сигнала. */
export function resampleLinear(input: Float32Array, fromRate: number, toRate: number = STT_SAMPLE_RATE): Float32Array {
  if (fromRate === toRate) return input.slice()
  return new StreamResampler(fromRate, toRate).process(input)
}

export function concatPcm16(chunks: readonly Int16Array[]): Int16Array {
  let n = 0
  for (const c of chunks) n += c.length
  const out = new Int16Array(n)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.length
  }
  return out
}

/** WAV RIFF/WAVE PCM16 LE моно. */
export function encodeWavPcm16(samples: Int16Array, sampleRate: number = STT_SAMPLE_RATE): Uint8Array {
  const dataBytes = samples.length * 2
  const buf = new ArrayBuffer(44 + dataBytes)
  const v = new DataView(buf)
  const ascii = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  v.setUint32(4, 36 + dataBytes, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  v.setUint32(16, 16, true) // размер fmt-блока
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // моно
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true) // байт/с
  v.setUint16(32, 2, true) // байт на отсчёт
  v.setUint16(34, 16, true) // бит
  ascii(36, 'data')
  v.setUint32(40, dataBytes, true)
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, samples[i]!, true)
  return new Uint8Array(buf)
}

/** Длительность PCM16 при 16 кГц (мс). */
export function pcmDurationMs(samples: number, sampleRate: number = STT_SAMPLE_RATE): number {
  return Math.round((samples / sampleRate) * 1000)
}
