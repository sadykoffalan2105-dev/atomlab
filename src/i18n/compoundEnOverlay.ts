/** Английские подписи для выбранных веществ (остальные — fallback через формулу + категорию). */
export const COMPOUND_EN_OVERLAY: Partial<
  Record<string, { nameEn: string; descriptionEn: string }>
> = {
  h2o: {
    nameEn: 'Water',
    descriptionEn: 'Polar molecule; common solvent.',
  },
  co2: {
    nameEn: 'Carbon dioxide',
    descriptionEn: 'Linear molecule.',
  },
  nacl: {
    nameEn: 'Sodium chloride',
    descriptionEn: 'Ionic salt.',
  },
}
