import { compoundById } from '../data/compounds'
import { getVrLabPhysProps } from './chemistry/vrLabPhysProps'
import { colorFromPalette, hslToHex, resolveLiquidHex } from './colorPalette'
import type { VrLabSubstanceVisual } from './types'

const visualCache = new Map<string, VrLabSubstanceVisual>()

export function substanceVisual(compoundId: string): VrLabSubstanceVisual {
  const cached = visualCache.get(compoundId)
  if (cached) return cached

  const c = compoundById[compoundId]
  const phys = getVrLabPhysProps(compoundId)
  const baseHex = resolveLiquidHex(compoundId, c?.accentColor)
  const paletteHex = hslToHex(colorFromPalette(compoundId))
  const liquidColor = phys.liquidColor ?? (c?.accentColor?.startsWith('#') ? c.accentColor : baseHex)

  let glow = 0.62
  let opacity = 0.92
  let viscosity = phys.viscosity
  if (c?.category === 'acid') {
    glow = 0.78
  } else if (c?.category === 'base') {
    glow = 0.74
  } else if (c?.category === 'salt') {
    glow = 0.58
    opacity = 0.9
  } else if (c?.category === 'oxide') {
    glow = 0.65
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

export function precipitateColorFor(compoundId: string): string {
  return getVrLabPhysProps(compoundId).precipitateColor ?? '#f0f0f0'
}

export function gasColorFor(compoundId: string): string {
  return getVrLabPhysProps(compoundId).gasColor ?? '#c8e8ff'
}
