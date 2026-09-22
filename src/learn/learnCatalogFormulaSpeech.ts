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
    // Коэффициент уравнения («2AlCl3») формулу не закрывает: слева запрещена только буква,
    // иначе вещество с коэффициентом оставалось непрочитанным и читалось по элементам.
    const pattern =
      uni === ascii
        ? `(?<![\\p{L}])${escapeRe(ascii)}(?![\\p{L}\\d])`
        : `(?:${escapeRe(uni)}|(?<![\\p{L}])${escapeRe(ascii)}(?![\\p{L}\\d]))`
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

let formulaNames: Set<string> | null = null

/**
 * Есть ли у формулы название в каталоге («AlCl₃» → «хлорид алюминия»).
 * Нужно правилу «один стиль чтения на уравнение»: вещество с названием читается названием.
 */
export function hasCatalogFormulaName(token: string): boolean {
  if (!formulaNames) {
    formulaNames = new Set<string>()
    for (const c of compoundsListAlphabeticalRu()) {
      if (!c.nameRu?.trim()) continue
      const uni = c.formulaUnicode.trim()
      if (uni.length < 2) continue
      formulaNames.add(uni)
      formulaNames.add(toAsciiFormula(uni))
    }
  }
  return formulaNames.has(token) || formulaNames.has(toAsciiFormula(token))
}

export function expandCatalogFormulasForSpeech(text: string): string {
  let out = text
  for (const [re, spoken] of getCatalogFormulaSpeechRules()) {
    // Название в каталоге записано с заглавной («Хлорид цинка»), а в середине фразы
    // оно звучит как обычное слово: «образуется хлорид цинка», а не «образуется Хлорид».
    out = out.replace(re, (_m, ...rest) => {
      const offset = rest[rest.length - 2] as number
      const before = out.slice(0, offset).replace(/\s+$/u, '')
      const midSentence = before.length > 0 && !/[.!?:;»"(]$/u.test(before)
      return midSentence ? spoken.charAt(0).toLowerCase() + spoken.slice(1) : spoken
    })
  }
  return out
}
