import { ELEMENTS } from '../elements'
import { ELEMENT_NAMES_EN } from '../elementNamesEn'
import profilesJson from './elementRealLifeProfiles.json'
import type { ElementRealLifeCard, ElementRealLifeProfile } from './types'

const profiles = profilesJson as ElementRealLifeProfile[]

const profileByZ = new Map(profiles.map((p) => [p.z, p]))

/** Путь от `public/` без ведущего «/» — дальше через publicAssetUrl (GitHub Pages /atomlab/). */
export function elementLifeImagePath(z: number, symbol: string): string {
  return `learn/elements/${String(z).padStart(3, '0')}-${symbol}.webp`
}

export function buildElementLifeCard(z: number): ElementRealLifeCard | null {
  const el = ELEMENTS.find((e) => e.z === z)
  const profile = profileByZ.get(z)
  if (!el || !profile) return null
  return {
    ...profile,
    nameRu: el.nameRu,
    nameEn: ELEMENT_NAMES_EN[z - 1] ?? el.symbol,
    cpkHex: el.cpkHex,
    image: elementLifeImagePath(z, el.symbol),
  }
}

export const ELEMENT_LIFE_CARDS: readonly ElementRealLifeCard[] = ELEMENTS.map((el) =>
  buildElementLifeCard(el.z),
).filter((c): c is ElementRealLifeCard => c != null)

export function getElementLifeCard(z: number): ElementRealLifeCard | undefined {
  return ELEMENT_LIFE_CARDS.find((c) => c.z === z)
}

export function shuffleArray<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** Случайные неправильные варианты для викторины */
export function pickQuizDistractors(correctZ: number, count = 3): number[] {
  const pool = ELEMENT_LIFE_CARDS.filter((c) => c.z !== correctZ).map((c) => c.z)
  return shuffleArray(pool).slice(0, count)
}

export type { ElementRealLifeCard, ElementRealLifeProfile } from './types'
