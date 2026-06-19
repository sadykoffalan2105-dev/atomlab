import type { VrLabReactionEffect } from './types'

let ctx: AudioContext | null = null
let muted = false

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined' || muted) return null
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.08,
  detune = 0,
) {
  const ac = audioContext()
  if (!ac) return

  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.value = frequency
  osc.detune.value = detune
  gain.gain.value = 0
  osc.connect(gain)
  gain.connect(ac.destination)

  const t0 = ac.currentTime
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration)

  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

function noiseBurst(duration: number, volume = 0.04) {
  const ac = audioContext()
  if (!ac) return

  const bufferSize = ac.sampleRate * duration
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
  }

  const src = ac.createBufferSource()
  src.buffer = buffer
  const gain = ac.createGain()
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 900
  filter.Q.value = 0.6

  gain.gain.value = volume
  src.connect(filter)
  filter.connect(gain)
  gain.connect(ac.destination)
  src.start()
}

export function setVrLabSoundMuted(value: boolean) {
  muted = value
}

export function isVrLabSoundMuted() {
  return muted
}

export function playVrLabPourSound() {
  tone(520, 0.18, 'sine', 0.06)
  tone(780, 0.14, 'triangle', 0.035, 40)
}

export function playVrLabReactionSound(effect: VrLabReactionEffect, heat: number) {
  const h = Math.max(0.2, heat)

  if (effect === 'gasEvolution') {
    noiseBurst(0.35, 0.05 * h)
    tone(420, 0.2, 'square', 0.025)
    return
  }

  if (effect === 'neutralization' || effect === 'hydration' || effect === 'exothermic') {
    noiseBurst(0.25, 0.035 * h)
    tone(280, 0.22, 'sine', 0.05 * h)
    tone(190, 0.3, 'sine', 0.03 * h, -20)
    return
  }

  if (effect === 'combustion') {
    noiseBurst(0.45, 0.06)
    tone(160, 0.35, 'sawtooth', 0.03)
    return
  }

  tone(360, 0.15, 'triangle', 0.04)
}

export function playVrLabCombineSound() {
  tone(440, 0.12, 'sine', 0.045)
  tone(660, 0.1, 'sine', 0.03)
}
