import { compoundById } from '../data/compounds'
import { colorFromPalette, hslToHex, resolveLiquidHex } from './colorPalette'
import type { VrLabSubstanceVisual } from './types'

const visualCache = new Map<string, VrLabSubstanceVisual>()

export function substanceVisual(compoundId: string): VrLabSubstanceVisual {
  const cached = visualCache.get(compoundId)
  if (cached) return cached

  const c = compoundById[compoundId]
  const baseHex = resolveLiquidHex(compoundId, c?.accentColor)
  const paletteHex = hslToHex(colorFromPalette(compoundId))
  const liquidColor = c?.accentColor?.startsWith('#') ? c.accentColor : baseHex

  let glow = 0.62
  let opacity = 0.92
  let viscosity = 0.5
  if (c?.category === 'acid') {
    glow = 0.78
    viscosity = 0.42
  } else if (c?.category === 'base') {
    glow = 0.74
    viscosity = 0.55
  } else if (c?.category === 'salt') {
    glow = 0.58
    opacity = 0.9
    viscosity = 0.48
  } else if (c?.category === 'oxide') {
    glow = 0.65
    viscosity = 0.6
  }

  const visual: VrLabSubstanceVisual = {
    compoundId,
    liquidColor,
    emissive: paletteHex,
    opacity,
    viscosity,
    glow,
  }
  visualCache.set(compoundId, visual)
  return visual
}

export function productVisualAfterMix(productId: string, effectHeat: number): VrLabSubstanceVisual {
  const base = substanceVisual(productId)
  return {
    ...base,
    glow: Math.min(1, base.glow + effectHeat * 0.35),
    opacity: Math.min(0.95, base.opacity + effectHeat * 0.05),
  }
}
