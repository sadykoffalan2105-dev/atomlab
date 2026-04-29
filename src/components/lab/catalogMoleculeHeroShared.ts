import type { CompoundCategory, Vec3 } from '../../types/chemistry'

/** Тот же масштаб героя, что в карточке каталога; лаба может передать 1+ для крупнее. */
export const CATALOG_HERO_DEFAULT_LAB_SCALE = 1

export function categoryAccentRgb(category: CompoundCategory): [number, number, number] {
  switch (category) {
    case 'acid':
      return [0.35, 0.92, 0.58]
    case 'base':
      return [0.98, 0.42, 0.78]
    case 'salt':
      return [0.48, 0.58, 1]
    case 'oxide':
      return [0.38, 0.88, 1]
    default:
      return [0.58, 0.64, 0.82]
  }
}

export function rgbToHex(r: number, g: number, b: number): string {
  const t = (x: number) => Math.min(255, Math.round(x * 255)).toString(16).padStart(2, '0')
  return `#${t(r)}${t(g)}${t(b)}`
}

export function catalogMoleculeFitScale(atoms: readonly { pos: Vec3 }[]): number {
  let m = 0
  for (const a of atoms) {
    m = Math.max(m, Math.hypot(a.pos[0], a.pos[1], a.pos[2]))
  }
  const atomPad = 0.52
  const ext = m + atomPad
  if (ext < 1e-4) return 1
  return Math.min(1.28, Math.max(0.68, 0.94 / ext))
}

