/** Строки формул оксидов и гидридов под краткой ПСХЭ (российский стандарт). */
export const RU_OXIDE_FORMULAS: readonly { group: number; formula: string }[] = [
  { group: 1, formula: 'R₂O' },
  { group: 2, formula: 'RO' },
  { group: 3, formula: 'R₂O₃' },
  { group: 4, formula: 'RO₂' },
  { group: 5, formula: 'R₂O₅' },
  { group: 6, formula: 'RO₃' },
  { group: 7, formula: 'R₂O₇' },
  { group: 8, formula: 'RO₄' },
]

export const RU_HYDRIDE_FORMULAS: readonly { group: number; formula: string }[] = [
  { group: 4, formula: 'RH₄' },
  { group: 5, formula: 'RH₃' },
  { group: 6, formula: 'RH₂' },
  { group: 7, formula: 'RH' },
]
