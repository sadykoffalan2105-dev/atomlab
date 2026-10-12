/**
 * WAV PCM16 моно: запись, разбор с проверкой по контракту «Голос» v1, ресемплинг, простые операции.
 * Чистый модуль (только Buffer/crypto) — его используют make-test-audio, stt-mock-server, stt-eval и e2e-voice.
 *
 * Контракт v1: RIFF/WAVE, fmt PCM (1), 1 канал, 16000 Гц, 16 бит LE, data 0,3–25 с (≤ 800 000 байт), тело ≤ 1 МиБ.
 */
import { createHash } from 'node:crypto'

export const STT_RATE = 16_000
export const STT_MIN_SECONDS = 0.3
export const STT_MAX_SECONDS = 25
export const STT_MAX_DATA_BYTES = 800_000
export const STT_MAX_BODY_BYTES = 1_048_576

/** Float32 [-1, 1] → WAV PCM16 моно. */
export function encodeWav(samples: Float32Array, rate: number): Buffer {
  const dataBytes = samples.length * 2
  const buf = Buffer.alloc(44 + dataBytes)
  buf.write('RIFF', 0, 'latin1')
  buf.writeUInt32LE(36 + dataBytes, 4)
  buf.write('WAVE', 8, 'latin1')
  buf.write('fmt ', 12, 'latin1')
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // моно
  buf.writeUInt32LE(rate, 24)
  buf.writeUInt32LE(rate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36, 'latin1')
  buf.writeUInt32LE(dataBytes, 40)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    buf.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), 44 + i * 2)
  }
  return buf
}

export interface WavInfo {
  format: number
  channels: number
  rate: number
  bits: number
  dataOffset: number
  dataBytes: number
  durationMs: number
}

/** Разбор заголовка RIFF (чанки по порядку, fmt и data обязательны). null — не WAV. */
export function parseWavHeader(buf: Buffer): WavInfo | null {
  if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WAVE') return null
  let off = 12
  let fmt: { format: number; channels: number; rate: number; bits: number } | null = null
  while (off + 8 <= buf.length) {
    const id = buf.toString('latin1', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    const body = off + 8
    if (id === 'fmt ' && body + 16 <= buf.length) {
      fmt = {
        format: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        rate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      }
    } else if (id === 'data') {
      if (!fmt) return null
      const dataBytes = Math.min(size, buf.length - body)
      const bytesPerSec = fmt.rate * fmt.channels * Math.max(1, fmt.bits / 8)
      return { ...fmt, dataOffset: body, dataBytes, durationMs: Math.round((dataBytes / bytesPerSec) * 1000) }
    }
    off = body + size + (size & 1)
  }
  return null
}

export type WavCheck =
  | { ok: true; info: WavInfo }
  | { ok: false; status: 400 | 413; code: 'bad_audio' | 'too_short' | 'too_long'; detail?: string; info?: WavInfo }

/** Проверка тела запроса /stt по контракту v1 (то же, что делает сервер). */
export function checkSttWav(body: Buffer): WavCheck {
  if (body.length > STT_MAX_BODY_BYTES) return { ok: false, status: 413, code: 'too_long', detail: 'body' }
  const info = parseWavHeader(body)
  if (!info) return { ok: false, status: 400, code: 'bad_audio', detail: 'format' }
  if (info.format !== 1) return { ok: false, status: 400, code: 'bad_audio', detail: 'format', info }
  if (info.channels !== 1) return { ok: false, status: 400, code: 'bad_audio', detail: 'channels', info }
  if (info.rate !== STT_RATE) return { ok: false, status: 400, code: 'bad_audio', detail: 'rate', info }
  if (info.bits !== 16) return { ok: false, status: 400, code: 'bad_audio', detail: 'bits', info }
  if (info.dataBytes > STT_MAX_DATA_BYTES || info.durationMs > STT_MAX_SECONDS * 1000) {
    return { ok: false, status: 413, code: 'too_long', detail: 'duration', info }
  }
  if (info.durationMs < STT_MIN_SECONDS * 1000) return { ok: false, status: 400, code: 'too_short', info }
  return { ok: true, info }
}

/** WAV PCM16 (моно или первый канал) → Float32. */
export function decodeWav(buf: Buffer): { rate: number; samples: Float32Array } {
  const info = parseWavHeader(buf)
  if (!info || info.format !== 1 || info.bits !== 16) throw new Error('decodeWav: нужен PCM16')
  const frames = Math.floor(info.dataBytes / (2 * info.channels))
  const out = new Float32Array(frames)
  for (let i = 0; i < frames; i++) out[i] = buf.readInt16LE(info.dataOffset + i * 2 * info.channels) / 0x8000
  return { rate: info.rate, samples: out }
}

/** Ресемплинг windowed-sinc (окно Блэкмана, 16 нулей): 16↔48 кГц для фейкового микрофона и мок-сервера. */
export function resample(x: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return x.slice()
  const ratio = to / from
  const n = Math.floor(x.length * ratio)
  const out = new Float32Array(n)
  const fc = Math.min(1, ratio) * 0.95 // срез чуть ниже Найквиста
  const half = Math.ceil(16 / fc)
  for (let i = 0; i < n; i++) {
    const t = i / ratio
    const c = Math.floor(t)
    let acc = 0
    let wsum = 0
    for (let k = c - half + 1; k <= c + half; k++) {
      if (k < 0 || k >= x.length) continue
      const d = t - k
      const arg = Math.PI * d * fc
      const sinc = d === 0 ? 1 : Math.sin(arg) / arg
      const w = 0.42 + 0.5 * Math.cos((Math.PI * d) / half) + 0.08 * Math.cos((2 * Math.PI * d) / half)
      const v = sinc * w
      acc += x[k] * v
      wsum += v
    }
    out[i] = wsum ? acc / wsum : 0
  }
  return out
}

export function rms(x: Float32Array, from = 0, to = x.length): number {
  let s = 0
  const a = Math.max(0, from)
  const b = Math.min(x.length, to)
  for (let i = a; i < b; i++) s += x[i] * x[i]
  return b > a ? Math.sqrt(s / (b - a)) : 0
}

export function silence(seconds: number, rate: number): Float32Array {
  return new Float32Array(Math.round(seconds * rate))
}

export function concat(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

export function gainDb(x: Float32Array, db: number): Float32Array {
  const g = 10 ** (db / 20)
  return x.map((v) => v * g)
}

/** Огибающая RMS по кадрам (мс). */
export function envelope(x: Float32Array, rate: number, frameMs = 20): Float32Array {
  const step = Math.max(1, Math.round((rate * frameMs) / 1000))
  const n = Math.floor(x.length / step)
  const env = new Float32Array(n)
  for (let i = 0; i < n; i++) env[i] = rms(x, i * step, (i + 1) * step)
  return env
}

/** Границы речи [startMs, endMs] по порогу огибающей (−40 дБ от пика, но не ниже 0,004); null — речи нет. */
export function speechBounds(x: Float32Array, rate: number): { startMs: number; endMs: number } | null {
  const env = envelope(x, rate, 10)
  let peak = 0
  for (const v of env) peak = Math.max(peak, v)
  const thr = Math.max(0.004, peak * 0.01)
  let a = -1
  let b = -1
  for (let i = 0; i < env.length; i++) {
    if (env[i] >= thr) {
      if (a < 0) a = i
      b = i
    }
  }
  return a < 0 ? null : { startMs: a * 10, endMs: (b + 1) * 10 }
}

export function sha1(buf: Buffer | string): string {
  return createHash('sha1').update(buf).digest('hex')
}
