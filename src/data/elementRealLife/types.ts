export type ElementRealLifeProfile = {
  z: number
  symbol: string
  captionRu: string
  captionEn: string
  appearanceRu: string
  appearanceEn: string
  usesRu: readonly string[]
  usesEn: readonly string[]
  extractionRu: string
  extractionEn: string
}

export type ElementRealLifeCard = ElementRealLifeProfile & {
  nameRu: string
  nameEn: string
  cpkHex: string
  image: string
}
