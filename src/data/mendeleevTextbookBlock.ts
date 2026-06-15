import type { ElementViewModel } from '../types/chemistry'
import { mendeleevBlock } from './mendeleevBlock'

export type TextbookBlockClass = 'tbS' | 'tbP' | 'tbD' | 'tbF' | 'tbNoble'

const NOBLE_Z = new Set([2, 10, 18, 36, 54, 86, 118])

/** Раскраска ячеек как в школьной краткой ПСХЭ. */
export function textbookBlockClass(el: ElementViewModel): TextbookBlockClass {
  if (NOBLE_Z.has(el.z)) return 'tbNoble'
  const b = mendeleevBlock(el)
  if (b === 's') return 'tbS'
  if (b === 'p') return 'tbP'
  if (b === 'd') return 'tbD'
  return 'tbF'
}
