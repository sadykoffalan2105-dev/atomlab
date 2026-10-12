/**
 * Шумы для тестового аудио: белый, розовый («гул комнаты»), «класс» (наложение двух других голосов),
 * смешивание с заданным SNR и простое «эхо комнаты». Детерминированно (сид), чтобы кэш и отчёты повторялись.
 */
import { rms } from './wavio.mts'

/** mulberry32 — маленький детерминированный генератор. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Белый шум с RMS = level. */
export function whiteNoise(len: number, level: number, seed: number): Float32Array {
  const r = rng(seed)
  const out = new Float32Array(len)
  // сумма 4 равномерных ≈ гаусс; дисперсия 4/12 → нормируем
  const k = level / Math.sqrt(4 / 12)
  for (let i = 0; i < len; i++) out[i] = (r() + r() + r() + r() - 2) * k
  return out
}

/** Розовый шум (фильтр Пола Келлета), RMS = level. */
export function pinkNoise(len: number, level: number, seed: number): Float32Array {
  const w = whiteNoise(len, 1, seed)
  const out = new Float32Array(len)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < len; i++) {
    const x = w[i]
    b0 = 0.99886 * b0 + x * 0.0555179
    b1 = 0.99332 * b1 + x * 0.0750759
    b2 = 0.969 * b2 + x * 0.153852
    b3 = 0.8665 * b3 + x * 0.3104856
    b4 = 0.55 * b4 + x * 0.5329522
    b5 = -0.7616 * b5 - x * 0.016898
    out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362
    b6 = x * 0.115926
  }
  const r = rms(out) || 1
  for (let i = 0; i < len; i++) out[i] *= level / r
  return out
}

/** «Класс»: два других голоса, зацикленные до длины, со сдвигом; RMS = level. */
export function babble(len: number, voices: Float32Array[], level: number, seed: number): Float32Array {
  const out = new Float32Array(len)
  const r = rng(seed)
  for (const v of voices) {
    if (!v.length) continue
    const shift = Math.floor(r() * v.length)
    for (let i = 0; i < len; i++) out[i] += v[(i + shift) % v.length]
  }
  const cur = rms(out) || 1
  for (let i = 0; i < len; i++) out[i] *= level / cur
  return out
}

/** Сигнал + шум: шум масштабируется так, чтобы RMS(речь)/RMS(шум) = snrDb (по активной речи). */
export function mixAtSnr(speech: Float32Array, noise: Float32Array, snrDb: number, speechRms: number): Float32Array {
  const nr = rms(noise) || 1
  const g = speechRms / 10 ** (snrDb / 20) / nr
  const out = new Float32Array(speech.length)
  for (let i = 0; i < speech.length; i++) out[i] = speech[i] + noise[i % noise.length] * g
  return clipSoft(out)
}

/** «Эхо комнаты»: ослабленный сигнал + две задержанные копии (как учитель из динамика ноутбука). */
export function roomEcho(x: Float32Array, rate: number, gainDb = -8): Float32Array {
  const g = 10 ** (gainDb / 20)
  const d1 = Math.round(0.035 * rate)
  const d2 = Math.round(0.09 * rate)
  const out = new Float32Array(x.length + d2)
  for (let i = 0; i < x.length; i++) {
    out[i] += x[i] * g
    out[i + d1] += x[i] * g * 0.35
    out[i + d2] += x[i] * g * 0.15
  }
  return clipSoft(out)
}

/** Мягкое ограничение, чтобы смесь не уходила за ±1. */
export function clipSoft(x: Float32Array): Float32Array {
  let peak = 0
  for (const v of x) peak = Math.max(peak, Math.abs(v))
  if (peak <= 0.98) return x
  const g = 0.98 / peak
  for (let i = 0; i < x.length; i++) x[i] *= g
  return x
}

/** RMS активной речи: средний квадрат по кадрам 20 мс выше −35 дБ от пика (без пауз). */
export function activeRms(x: Float32Array, rate: number): number {
  const step = Math.round(rate * 0.02)
  const frames: number[] = []
  for (let i = 0; i + step <= x.length; i += step) frames.push(rms(x, i, i + step))
  const peak = Math.max(0, ...frames)
  const thr = peak * 10 ** (-35 / 20)
  const act = frames.filter((f) => f >= thr && f > 0)
  if (!act.length) return 0
  return Math.sqrt(act.reduce((s, f) => s + f * f, 0) / act.length)
}
