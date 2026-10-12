/**
 * WAV для /stt (контракт «Голос» v1): RIFF/WAVE, fmt PCM (1), 1 канал, 16000 Гц, 16 бит LE, 0,3–25 с.
 * Разбор только заголовков в памяти: аудио никуда не пишется (ни на диск, ни в журнал).
 * buildWav — тот же формат для селфтестов и живой проверки (синус/тишина).
 */

export type WavInfo = {
  /** 1 — PCM (WAVE_FORMAT_EXTENSIBLE с подформатом PCM тоже даёт 1) */
  format: number
  channels: number
  sampleRate: number
  bitsPerSample: number
  /** где начинаются отсчёты и сколько их байт (data-чанк, обрезанный по реальной длине тела) */
  dataOffset: number
  dataBytes: number
  durationMs: number
}

export type WavError = { code: 'bad_audio' | 'too_short' | 'too_long'; status: 400 | 413; message: string; detail?: string }

export const STT_RATE = 16_000
export const STT_MIN_MS = 300

/** Разобрать заголовок WAV; строка — что не так (detail для ответа 400 bad_audio). */
export function parseWav(buf: Buffer): WavInfo | { error: string } {
  if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WAVE') return { error: 'format' }
  let off = 12
  let fmt: { format: number; channels: number; sampleRate: number; bitsPerSample: number } | null = null
  while (off + 8 <= buf.length) {
    const id = buf.toString('latin1', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    const body = off + 8
    if (id === 'fmt ') {
      if (size < 16 || body + 16 > buf.length) return { error: 'format' }
      let format = buf.readUInt16LE(body)
      // WAVE_FORMAT_EXTENSIBLE: настоящий формат — первые 2 байта GUID подформата (смещение 24 в fmt)
      if (format === 0xfffe && size >= 40 && body + 26 <= buf.length) format = buf.readUInt16LE(body + 24)
      fmt = { format, channels: buf.readUInt16LE(body + 2), sampleRate: buf.readUInt32LE(body + 4), bitsPerSample: buf.readUInt16LE(body + 14) }
    } else if (id === 'data') {
      if (!fmt) return { error: 'format' }
      // потоковые кодировщики пишут размер 0 или 0xFFFFFFFF — берём то, что реально пришло
      const dataBytes = Math.min(size === 0 ? buf.length - body : size, buf.length - body)
      const bytesPerSec = fmt.sampleRate * fmt.channels * Math.max(1, fmt.bitsPerSample / 8)
      return { ...fmt, dataOffset: body, dataBytes, durationMs: bytesPerSec > 0 ? Math.round((dataBytes / bytesPerSec) * 1000) : 0 }
    }
    // чанки выровнены по 2 байта
    off = body + size + (size & 1)
  }
  return { error: fmt ? 'no_data' : 'format' }
}

/** Проверка по контракту: формат → длительность. maxMs — config.stt.maxSeconds × 1000. */
export function checkSttWav(buf: Buffer, maxMs: number): { ok: true; info: WavInfo } | { ok: false; error: WavError } {
  const w = parseWav(buf)
  if ('error' in w) return { ok: false, error: { code: 'bad_audio', status: 400, message: 'нужен WAV (RIFF/WAVE, PCM)', detail: w.error } }
  const bad = (detail: string, message: string) => ({ ok: false as const, error: { code: 'bad_audio' as const, status: 400 as const, message, detail } })
  if (w.format !== 1) return bad('format', 'нужен PCM без сжатия (fmt 1)')
  if (w.channels !== 1) return bad('channels', 'нужен 1 канал (моно)')
  if (w.sampleRate !== STT_RATE) return bad('rate', `нужно ${STT_RATE} Гц`)
  if (w.bitsPerSample !== 16) return bad('bits', 'нужно 16 бит')
  if (w.durationMs < STT_MIN_MS) return { ok: false, error: { code: 'too_short', status: 400, message: `аудио короче ${STT_MIN_MS} мс` } }
  if (w.durationMs > maxMs) return { ok: false, error: { code: 'too_long', status: 413, message: `аудио длиннее ${Math.round(maxMs / 1000)} с` } }
  return { ok: true, info: w }
}

/** WAV в памяти: PCM16 моно (или по opts) — тишина, синус tone Гц или готовые отсчёты. */
export function buildWav(o: { ms: number; rate?: number; channels?: number; bits?: number; tone?: number; format?: number; samples?: Int16Array }): Buffer {
  const rate = o.rate ?? STT_RATE
  const channels = o.channels ?? 1
  const bits = o.bits ?? 16
  const n = o.samples ? o.samples.length : Math.round((rate * o.ms) / 1000)
  const bytesPer = bits / 8
  const dataBytes = n * channels * bytesPer
  const buf = Buffer.alloc(44 + dataBytes)
  buf.write('RIFF', 0, 'latin1')
  buf.writeUInt32LE(36 + dataBytes, 4)
  buf.write('WAVE', 8, 'latin1')
  buf.write('fmt ', 12, 'latin1')
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(o.format ?? 1, 20)
  buf.writeUInt16LE(channels, 22)
  buf.writeUInt32LE(rate, 24)
  buf.writeUInt32LE(rate * channels * bytesPer, 28)
  buf.writeUInt16LE(channels * bytesPer, 32)
  buf.writeUInt16LE(bits, 34)
  buf.write('data', 36, 'latin1')
  buf.writeUInt32LE(dataBytes, 40)
  if (bits === 16) {
    for (let i = 0; i < n; i++) {
      const v = o.samples ? o.samples[i]! : o.tone ? Math.round(Math.sin((2 * Math.PI * o.tone * i) / rate) * 8000) : 0
      for (let c = 0; c < channels; c++) buf.writeInt16LE(v, 44 + (i * channels + c) * 2)
    }
  }
  return buf
}
