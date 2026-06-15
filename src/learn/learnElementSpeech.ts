import { ELEMENTS } from '../data/elements'

/** Символ → как говорит учитель (строчное русское название). */
const SYMBOL_SPOKEN_RU = new Map<string, string>(
  ELEMENTS.map((el) => [el.symbol, el.nameRu.toLowerCase()]),
)

const MULTI_SYMBOLS = [...SYMBOL_SPOKEN_RU.keys()]
  .filter((s) => s.length >= 2)
  .sort((a, b) => b.length - a.length)

const COEFF_ELEMENT =
  /(\d+)\s*([A-Z][a-z]?)(?=\s*(?:[+]|$|[,.;:!?)]|(?:\s+(?:и|или|с|в)\s)))/g

/** 4 Cr + 7 O2 → «4 хром + 7 кислород» — TTS не читает латиницу по буквам. */
export function expandElementSymbolsForRussianSpeech(text: string): string {
  let out = text.replace(COEFF_ELEMENT, (match, num: string, sym: string) => {
    const name = SYMBOL_SPOKEN_RU.get(sym)
    if (!name) return match
    return `${num} ${name}`
  })

  for (const sym of MULTI_SYMBOLS) {
    const name = SYMBOL_SPOKEN_RU.get(sym)!
    const escaped = sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(?<![A-Za-zА-Яа-яЁё])${escaped}(?![A-Za-zА-Яа-яЁё])`, 'g')
    out = out.replace(re, name)
  }

  return out
}
