import { getElementBySymbol } from '../data/elements'
import type { CompoundCategory } from '../types/chemistry'

/** Множитель радиуса CPK-шара в каталоге: «каркас», связи остаются видны между сферами. */
export const CATALOG_BALL_STICK_RADIUS_SCALE = 0.55

function cpkHex(symbol: string): string {
  const e = getElementBySymbol(symbol)
  return e ? '#' + e.cpkHex : '#8899aa'
}

export interface HeroAtomStyle {
  baseColor: string
  emissive: string
  emissiveIntensity: number
  metalness: number
  roughness: number
  transmission: number
  thickness: number
  clearcoat: number
  clearcoatRoughness: number
  opacity: number
  envMapIntensity: number
  radius: number
}

/**
 * «Кино»-палитра каталога (референс: тёмно-синий S, рубиновый O, бледный H).
 * Остальные элементы — стекло поверх CPK.
 */
export function heroAtomStyle(
  symbol: string,
  _category: CompoundCategory,
  opts: { degree: number; maxDegree: number },
): HeroAtomStyle {
  const s = symbol
  const hub = opts.maxDegree > 0 && opts.degree >= opts.maxDegree

  if (s === 'S') {
    return {
      baseColor: '#153d8c',
      emissive: '#1e4aa8',
      emissiveIntensity: 0.48,
      metalness: 0.32,
      roughness: 0.12,
      transmission: 0.58,
      thickness: 0.58,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      opacity: 0.88,
      envMapIntensity: 1.45,
      radius: hub ? 0.37 : 0.33,
    }
  }
  if (s === 'O') {
    return {
      baseColor: '#b01028',
      emissive: '#ff2a4a',
      emissiveIntensity: 0.42,
      metalness: 0.26,
      roughness: 0.14,
      transmission: 0.48,
      thickness: 0.45,
      clearcoat: 0.95,
      clearcoatRoughness: 0.12,
      opacity: 0.9,
      envMapIntensity: 1.25,
      radius: 0.3,
    }
  }
  if (s === 'H') {
    return {
      baseColor: '#dceeff',
      emissive: '#b8d8ff',
      emissiveIntensity: 0.36,
      metalness: 0.18,
      roughness: 0.1,
      transmission: 0.68,
      thickness: 0.26,
      clearcoat: 0.9,
      clearcoatRoughness: 0.14,
      opacity: 0.86,
      envMapIntensity: 1.2,
      radius: 0.21,
    }
  }

  const c = cpkHex(s)
  return {
    baseColor: c,
    emissive: c,
    emissiveIntensity: 0.36,
    metalness: 0.38,
    roughness: 0.16,
    transmission: 0.38,
    thickness: 0.42,
    clearcoat: 0.9,
    clearcoatRoughness: 0.15,
    opacity: 0.9,
    envMapIntensity: 1.15,
    radius: hub ? 0.35 : s.length <= 1 ? 0.26 : 0.3,
  }
}

export interface HeroBondStyle {
  core: string
  halo: string
}

/** Смесь магенты / акцент категории для светящихся связей под bloom. */
export function heroBondStyle(category: CompoundCategory): HeroBondStyle {
  switch (category) {
    case 'acid':
      return { core: '#e040f0', halo: '#5dffe8' }
    case 'base':
      return { core: '#ff50c8', halo: '#c080ff' }
    case 'salt':
      return { core: '#a070ff', halo: '#6ec8ff' }
    case 'oxide':
      return { core: '#c060ff', halo: '#40d0ff' }
    default:
      return { core: '#d060f0', halo: '#88a8ff' }
  }
}

/**
 * Органика: стекло поверх настоящего CPK (C серый, H белый, O красный, N синий, Cl зелёный).
 * Без «кино»-перекраски O/H как в неорганическом каталоге.
 */
export function organicHeroAtomStyle(
  symbol: string,
  opts: { degree: number; maxDegree: number },
): HeroAtomStyle {
  const hub = opts.maxDegree > 0 && opts.degree >= opts.maxDegree
  const c = cpkHex(symbol)
  const s = symbol

  if (s === 'H') {
    return {
      baseColor: c,
      emissive: '#e8f0ff',
      emissiveIntensity: 0.28,
      metalness: 0.12,
      roughness: 0.14,
      transmission: 0.55,
      thickness: 0.22,
      clearcoat: 0.95,
      clearcoatRoughness: 0.12,
      opacity: 0.9,
      envMapIntensity: 1.1,
      radius: 0.2,
    }
  }
  if (s === 'C') {
    return {
      baseColor: c,
      emissive: '#4a5568',
      emissiveIntensity: 0.22,
      metalness: 0.28,
      roughness: 0.22,
      transmission: 0.22,
      thickness: 0.4,
      clearcoat: 0.75,
      clearcoatRoughness: 0.2,
      opacity: 0.96,
      envMapIntensity: 1.05,
      radius: hub ? 0.34 : 0.28,
    }
  }
  if (s === 'O') {
    return {
      baseColor: c,
      emissive: '#ff3344',
      emissiveIntensity: 0.38,
      metalness: 0.22,
      roughness: 0.16,
      transmission: 0.42,
      thickness: 0.4,
      clearcoat: 0.95,
      clearcoatRoughness: 0.12,
      opacity: 0.92,
      envMapIntensity: 1.2,
      radius: 0.29,
    }
  }
  if (s === 'N') {
    return {
      baseColor: c,
      emissive: '#3b82f6',
      emissiveIntensity: 0.34,
      metalness: 0.24,
      roughness: 0.18,
      transmission: 0.35,
      thickness: 0.38,
      clearcoat: 0.9,
      clearcoatRoughness: 0.14,
      opacity: 0.93,
      envMapIntensity: 1.15,
      radius: 0.28,
    }
  }
  if (s === 'Cl') {
    return {
      baseColor: c,
      emissive: '#22c55e',
      emissiveIntensity: 0.32,
      metalness: 0.26,
      roughness: 0.18,
      transmission: 0.38,
      thickness: 0.4,
      clearcoat: 0.9,
      clearcoatRoughness: 0.14,
      opacity: 0.92,
      envMapIntensity: 1.15,
      radius: 0.31,
    }
  }

  return {
    baseColor: c,
    emissive: c,
    emissiveIntensity: 0.3,
    metalness: 0.3,
    roughness: 0.18,
    transmission: 0.32,
    thickness: 0.4,
    clearcoat: 0.85,
    clearcoatRoughness: 0.16,
    opacity: 0.93,
    envMapIntensity: 1.1,
    radius: hub ? 0.33 : 0.27,
  }
}

export function organicHeroBondStyle(accent?: string): HeroBondStyle {
  return { core: accent ?? '#34d399', halo: '#67e8f9' }
}
