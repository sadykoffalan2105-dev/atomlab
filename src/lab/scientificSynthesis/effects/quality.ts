/** Качество микромира: full на десктопе, lite на слабых/мобильных. */
export type SciFxQuality = 'full' | 'lite'

export type SciFxQualityOpts = {
  quality: SciFxQuality
  /** Искры / sparkles */
  sparkles: number
  sparklesSecondary: number
  /** Сегменты сферы атома */
  atomSegW: number
  atomSegH: number
  /** Подписи атомов */
  atomLabels: boolean
  /** transmission / clearcoat */
  richMaterials: boolean
  /** Trail dots */
  trailCount: number
  /** Частицы вспышки образования */
  burstCount: number
}

export function resolveSciFxQuality(lowPower: boolean): SciFxQualityOpts {
  if (lowPower) {
    return {
      quality: 'lite',
      sparkles: 12,
      sparklesSecondary: 0,
      atomSegW: 16,
      atomSegH: 12,
      atomLabels: false,
      richMaterials: false,
      trailCount: 4,
      burstCount: 48,
    }
  }
  return {
    quality: 'full',
    sparkles: 36,
    sparklesSecondary: 18,
    atomSegW: 28,
    atomSegH: 20,
    atomLabels: true,
    richMaterials: true,
    trailCount: 8,
    burstCount: 96,
  }
}
