/** Качество микромира: full = красиво и ~60fps, lite = слабые устройства. */
export type SciFxQuality = 'full' | 'lite'

export type SciFxQualityOpts = {
  quality: SciFxQuality
  sparkles: number
  sparklesSecondary: number
  atomSegW: number
  atomSegH: number
  atomLabels: boolean
  /** emissive standard (не transmission — слишком дорого на 16+ атомах) */
  richMaterials: boolean
  trailCount: number
  burstCount: number
  /** кастомный GLSL plasma на связях */
  plasmaBonds: boolean
}

export function resolveSciFxQuality(lowPower: boolean): SciFxQualityOpts {
  if (lowPower) {
    return {
      quality: 'lite',
      sparkles: 0,
      sparklesSecondary: 0,
      atomSegW: 12,
      atomSegH: 10,
      atomLabels: false,
      richMaterials: false,
      trailCount: 0,
      burstCount: 28,
      plasmaBonds: false,
    }
  }
  return {
    quality: 'full',
    sparkles: 10,
    sparklesSecondary: 0,
    atomSegW: 16,
    atomSegH: 12,
    atomLabels: false,
    richMaterials: true,
    trailCount: 0,
    burstCount: 40,
    // Дешёвый fragment-шейдер, геометрия общая — не влияет на FPS при ≤10 связях.
    plasmaBonds: true,
  }
}
