/**
 * Формулы каталога → произношение по nameRu (для TTS).
 * Длинные формулы первыми.
 */
import { compoundsListAlphabeticalRu } from '../data/compounds'

const SUB = '₀₁₂₃₄₅₆₇₈₉'

function toAsciiFormula(u: string): string {
  return u
    .split('')
    .map((ch) => {
      const i = SUB.indexOf(ch)
      return i >= 0 ? String(i) : ch
    })
    .join('')
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

let cached: ReadonlyArray<readonly [RegExp, string]> | null = null

/** Пары [regex формулы, nameRu] из каталога — без выдуманных названий. */
export function getCatalogFormulaSpeechRules(): ReadonlyArray<readonly [RegExp, string]> {
  if (cached) return cached
  const rows: Array<{ len: number; re: RegExp; name: string }> = []
  for (const c of compoundsListAlphabeticalRu()) {
    const name = c.nameRu?.trim()
    if (!name) continue
    const uni = c.formulaUnicode.trim()
    const ascii = toAsciiFormula(uni)
    if (uni.length < 2) continue
    // Не затирать очень короткие совпадения вроде «CO» внутри слов — только как формула-токен.
    const pattern =
      uni === ascii
        ? `(?<![\\p{L}\\d])${escapeRe(ascii)}(?![\\p{L}\\d])`
        : `(?:${escapeRe(uni)}|(?<![\\p{L}\\d])${escapeRe(ascii)}(?![\\p{L}\\d]))`
    rows.push({
      len: Math.max(uni.length, ascii.length),
      re: new RegExp(pattern, 'gu'),
      name,
    })
  }
  rows.sort((a, b) => b.len - a.len)
  cached = rows.map((r) => [r.re, r.name] as const)
  return cached
}

export function expandCatalogFormulasForSpeech(text: string): string {
  let out = text
  for (const [re, spoken] of getCatalogFormulaSpeechRules()) {
    out = out.replace(re, spoken)
  }
  return out
}
