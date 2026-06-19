import type { CuratedReactionId } from './reactions/curatedReactions'
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

function noiseBurst(duration: number, volume = 0.04, filterHz = 900) {
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
  filter.frequency.value = filterHz
  filter.Q.value = 0.6

  gain.gain.value = volume
  src.connect(filter)
  filter.connect(gain)
  gain.connect(ac.destination)
  src.start()
}

function fizzBurst(heat: number) {
  noiseBurst(0.38, 0.055 * heat, 1200)
  tone(640, 0.12, 'square', 0.022)
  tone(480, 0.18, 'triangle', 0.018, 30)
}

function steamHiss(heat: number) {
  noiseBurst(0.28, 0.04 * heat, 700)
  tone(260, 0.24, 'sine', 0.045 * heat)
  tone(180, 0.32, 'sine', 0.028 * heat, -20)
}

function chimePing() {
  tone(720, 0.18, 'sine', 0.035)
  tone(960, 0.14, 'triangle', 0.022, 12)
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

export function playVrLabCuratedReactionSound(reactionId: CuratedReactionId, heat: number) {
  const h = Math.max(0.2, heat)

  switch (reactionId) {
    case 'gas_co2_carbonate':
    case 'gas_h2o2_catalysis':
    case 'gas_co2_water':
      fizzBurst(h)
      return
    case 'gas_nh3_hcl':
      noiseBurst(0.22, 0.03, 1400)
      chimePing()
      return
    case 'hydration_cao':
      steamHiss(h * 1.15)
      tone(140, 0.28, 'sine', 0.04)
      return
    case 'color_cuo_h2so4':
      tone(520, 0.2, 'sine', 0.04)
      tone(780, 0.16, 'triangle', 0.025)
      return
    case 'color_fe2o3_hcl':
      tone(380, 0.22, 'triangle', 0.038)
      return
    case 'neutralization_h2so4_naoh':
      steamHiss(h * 1.2)
      return
    case 'neutralization_hcl_naoh':
    case 'neutralization_hcl_koh':
      steamHiss(h)
      return
    default:
      break
  }
}

export function playVrLabReactionSound(
  effect: VrLabReactionEffect,
  heat: number,
  curatedId?: CuratedReactionId | null,
) {
  if (curatedId) {
    playVrLabCuratedReactionSound(curatedId, heat)
    return
  }

  const h = Math.max(0.2, heat)

  if (effect === 'gasEvolution') {
    fizzBurst(h)
    return
  }

  if (effect === 'neutralization' || effect === 'hydration' || effect === 'exothermic') {
    steamHiss(h)
    return
  }

  if (effect === 'combustion') {
    noiseBurst(0.45, 0.06, 500)
    tone(160, 0.35, 'sawtooth', 0.03)
    return
  }

  if (effect === 'colorShift') {
    chimePing()
    return
  }

  tone(360, 0.15, 'triangle', 0.04)
}

export function playVrLabCombineSound() {
  tone(440, 0.12, 'sine', 0.045)
  tone(660, 0.1, 'sine', 0.03)
}
