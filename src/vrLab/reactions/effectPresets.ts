import type { VrLabMixResult, VrLabReactionEffect } from '../types'
import { clamp01, easeOutCubic } from '../vrLabAnimation'
import { findCuratedReaction } from './curatedReactions'

export type VfxPreset = {
  steamRate: number
  bubbleRate: number
  heatGlow: number
  condensation: number
  gasPlume: boolean
  rippleSpeed: number
  flashIntensity: number
  emissiveColor: string
  steamColor: string
  bubbleColor: string
  gasColor: string
  precipitateRate: number
  precipitateColor: string
  flameIntensity: number
  particleSpread: number
}

const VFX_DEFAULTS = {
  gasColor: '#c8e8ff',
  precipitateRate: 0,
  precipitateColor: '#f0f0f0',
  flameIntensity: 0,
} as const

function vfx(p: Partial<VfxPreset> & Pick<VfxPreset, 'steamRate' | 'bubbleRate' | 'heatGlow' | 'condensation' | 'gasPlume' | 'rippleSpeed' | 'flashIntensity' | 'emissiveColor' | 'steamColor' | 'bubbleColor' | 'particleSpread'>): VfxPreset {
  return { ...VFX_DEFAULTS, ...p }
}

export const REACTION_VFX: Record<VrLabReactionEffect, VfxPreset> = {
  neutralization: vfx({
    steamRate: 0.72,
    bubbleRate: 0.28,
    heatGlow: 0.58,
    condensation: 0.48,
    gasPlume: false,
    rippleSpeed: 1.2,
    flashIntensity: 0.55,
    emissiveColor: '#facc15',
    steamColor: '#e8f4ff',
    bubbleColor: '#fde68a',
    particleSpread: 0.22,
  }),
  precipitate: vfx({
    steamRate: 0.15,
    bubbleRate: 0.35,
    heatGlow: 0.25,
    condensation: 0.12,
    gasPlume: false,
    rippleSpeed: 0.6,
    flashIntensity: 0.2,
    emissiveColor: '#a78bfa',
    steamColor: '#ddd6fe',
    bubbleColor: '#c4b5fd',
    precipitateRate: 0.85,
    precipitateColor: '#f5f5f0',
    particleSpread: 0.18,
  }),
  gasEvolution: vfx({
    steamRate: 0.38,
    bubbleRate: 0.95,
    heatGlow: 0.35,
    condensation: 0.08,
    gasPlume: true,
    rippleSpeed: 2.4,
    flashIntensity: 0.45,
    emissiveColor: '#22d3ee',
    steamColor: '#a5f3fc',
    bubbleColor: '#67e8f9',
    gasColor: '#a5f3fc',
    particleSpread: 0.32,
  }),
  combustion: vfx({
    steamRate: 0.55,
    bubbleRate: 0.65,
    heatGlow: 0.92,
    condensation: 0.15,
    gasPlume: true,
    rippleSpeed: 3.2,
    flashIntensity: 0.85,
    emissiveColor: '#fb923c',
    steamColor: '#fed7aa',
    bubbleColor: '#fdba74',
    flameIntensity: 0.9,
    particleSpread: 0.38,
  }),
  hydration: vfx({
    steamRate: 0.88,
    bubbleRate: 0.52,
    heatGlow: 0.82,
    condensation: 0.62,
    gasPlume: true,
    rippleSpeed: 1.8,
    flashIntensity: 0.7,
    emissiveColor: '#d946ef',
    steamColor: '#f5d0fe',
    bubbleColor: '#e879f9',
    particleSpread: 0.26,
  }),
  colorShift: vfx({
    steamRate: 0.22,
    bubbleRate: 0.18,
    heatGlow: 0.32,
    condensation: 0.1,
    gasPlume: false,
    rippleSpeed: 0.9,
    flashIntensity: 0.35,
    emissiveColor: '#4ade80',
    steamColor: '#bbf7d0',
    bubbleColor: '#86efac',
    particleSpread: 0.16,
  }),
  exothermic: vfx({
    steamRate: 0.9,
    bubbleRate: 0.55,
    heatGlow: 0.95,
    condensation: 0.7,
    gasPlume: true,
    rippleSpeed: 2.6,
    flashIntensity: 0.9,
    emissiveColor: '#f97316',
    steamColor: '#ffedd5',
    bubbleColor: '#fdba74',
    flameIntensity: 0.75,
    particleSpread: 0.3,
  }),
  noReaction: vfx({
    steamRate: 0.05,
    bubbleRate: 0.08,
    heatGlow: 0.1,
    condensation: 0.02,
    gasPlume: false,
    rippleSpeed: 0.4,
    flashIntensity: 0.05,
    emissiveColor: '#94a3b8',
    steamColor: '#cbd5e1',
    bubbleColor: '#94a3b8',
    particleSpread: 0.12,
  }),
}

export type VfxRuntime = {
  preset: VfxPreset
  intensity: number
  steamIntensity: number
  bubbleIntensity: number
  precipitateIntensity: number
  condensation: number
  heatGlow: number
  showFlash: boolean
  flashStrength: number
}

export function resolveReactionVfx(
  result: VrLabMixResult | null,
  progress: number,
  phase: 'idle' | 'pouring' | 'combining' | 'reacting',
  mixing: boolean,
  reactionPair?: { a: string; b: string } | null,
): VfxRuntime | null {
  if (!result && !mixing) return null

  const effect = result?.effect ?? 'noReaction'
  let preset = REACTION_VFX[effect]
  const heat = result?.heat ?? 0.3
  const bubbles = result?.bubbleIntensity ?? 0.2
  const p = clamp01(progress)

  let intensity = 0
  if (phase === 'combining') {
    intensity = easeOutCubic(p) * 0.45
  } else if (phase === 'reacting') {
    intensity = 0.55 + easeOutCubic(p) * 0.45
  } else if (mixing) {
    intensity = 0.65
  }

  if (intensity <= 0.02) return null

  const curated = reactionPair ? findCuratedReaction(reactionPair.a, reactionPair.b) : null
  const vfxMul = curated?.vfx

  let steamIntensity = preset.steamRate * intensity * (0.4 + heat * 0.6)
  let bubbleIntensity = preset.bubbleRate * intensity * (0.35 + bubbles * 0.65)
  let precipitateIntensity = preset.precipitateRate * intensity
  let condensation = preset.condensation * intensity * (0.3 + heat * 0.7)
  let heatGlow = preset.heatGlow * intensity * (0.35 + heat * 0.65)

  if (result?.effect === 'precipitate') precipitateIntensity = Math.max(precipitateIntensity, 0.5 * intensity)

  if (vfxMul) {
    steamIntensity *= vfxMul.steamDensity
    bubbleIntensity *= vfxMul.bubbleRate
    heatGlow *= vfxMul.heatGlow
    if (vfxMul.gasPlume) preset = { ...preset, gasPlume: true }
  }
  const showFlash = phase === 'reacting' && p < 0.22
  const flashStrength = showFlash ? preset.flashIntensity * (1 - p / 0.22) : 0

  return {
    preset,
    intensity,
    steamIntensity,
    bubbleIntensity,
    precipitateIntensity,
    condensation,
    heatGlow,
    showFlash,
    flashStrength,
  }
}
