/**
 * Лёгкие процедурные SFX для cue синтеза (без тяжёлых ассетов).
 */

type SfxKind = 'spark' | 'snap' | 'dust'

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(
  audio: AudioContext,
  {
    freq,
    dur,
    type = 'sine',
    gain = 0.08,
    slideTo,
  }: {
    freq: number
    dur: number
    type?: OscillatorType
    gain?: number
    slideTo?: number
  },
) {
  const now = audio.currentTime
  const osc = audio.createOscillator()
  const g = audio.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, now)
  if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), now + dur)
  g.gain.setValueAtTime(0.0001, now)
  g.gain.exponentialRampToValueAtTime(gain, now + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  osc.connect(g)
  g.connect(audio.destination)
  osc.start(now)
  osc.stop(now + dur + 0.02)
}

function noiseBurst(audio: AudioContext, dur: number, gain = 0.05) {
  const n = Math.max(1, Math.floor(audio.sampleRate * dur))
  const buffer = audio.createBuffer(1, n, audio.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n)
  const src = audio.createBufferSource()
  src.buffer = buffer
  const g = audio.createGain()
  const filter = audio.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1800
  filter.Q.value = 0.7
  g.gain.value = gain
  src.connect(filter)
  filter.connect(g)
  g.connect(audio.destination)
  src.start()
}

/** Разблокировка AudioContext на user gesture. */
export function primeLabReactionSfx(): void {
  getCtx()
}

export function playLabReactionSfx(kind: SfxKind): void {
  const audio = getCtx()
  if (!audio) return
  try {
    if (kind === 'spark') {
      tone(audio, { freq: 920, dur: 0.09, type: 'square', gain: 0.045, slideTo: 240 })
      noiseBurst(audio, 0.07, 0.035)
    } else if (kind === 'snap') {
      tone(audio, { freq: 520, dur: 0.06, type: 'triangle', gain: 0.05, slideTo: 180 })
    } else {
      noiseBurst(audio, 0.14, 0.028)
      tone(audio, { freq: 160, dur: 0.18, type: 'sine', gain: 0.03, slideTo: 90 })
    }
  } catch {
    /* ignore */
  }
}
