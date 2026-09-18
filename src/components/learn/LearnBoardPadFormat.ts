/**
 * Чистые помощники «Рабочей зоны»: оформление химических формул
 * (H2SO4 → H₂SO₄) и вставка текста в позицию курсора. Без React и DOM —
 * их проверяет scripts/test-workzone-format.mts.
 */

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉'

export function toSubscriptDigits(digits: string): string {
  let out = ''
  for (const ch of digits) {
    const code = ch.charCodeAt(0) - 48
    out += code >= 0 && code <= 9 ? SUBSCRIPT_DIGITS[code] : ch
  }
  return out
}

function isAsciiDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

function isLatinLetter(ch: string): boolean {
  return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')
}

function isUpperLatin(ch: string): boolean {
  return ch >= 'A' && ch <= 'Z'
}

function isSubscriptDigit(ch: string): boolean {
  return SUBSCRIPT_DIGITS.includes(ch)
}

/** Символ может входить в «формульный» токен: буквы, цифры, скобки, уже готовые индексы. */
function isFormulaChar(ch: string): boolean {
  return isLatinLetter(ch) || isAsciiDigit(ch) || isSubscriptDigit(ch) || '()[]'.includes(ch)
}

/**
 * Токен считается формулой, если после ведущего коэффициента (обычные цифры)
 * первым идёт заглавный символ элемента или открывающая скобка: H2SO4, 2H2O, Ca(OH)2, (NH4)2SO4.
 * «x2», «mol», «abc123» формулами не считаются и не трогаются.
 */
function isFormulaToken(token: string): boolean {
  let i = 0
  while (i < token.length && isAsciiDigit(token[i])) i += 1
  if (i >= token.length) return false
  const first = token[i]
  return isUpperLatin(first) || first === '(' || first === '['
}

function formatToken(token: string): string {
  if (!isFormulaToken(token)) return token
  let out = ''
  let i = 0
  // Ведущий коэффициент остаётся обычными цифрами.
  while (i < token.length && isAsciiDigit(token[i])) {
    out += token[i]
    i += 1
  }
  let prev = ''
  for (; i < token.length; i += 1) {
    const ch = token[i]
    if (isAsciiDigit(ch)) {
      const afterSymbol = isLatinLetter(prev) || prev === ')' || prev === ']' || isSubscriptDigit(prev)
      const converted = afterSymbol ? toSubscriptDigits(ch) : ch
      out += converted
      prev = converted
      continue
    }
    out += ch
    prev = ch
  }
  return out
}

/** Заменяет ASCII-стрелки на химические: -> → ; <-> / <=> ⇄. */
export function normalizeArrows(text: string): string {
  return text.replace(/<->|<=>|<-->/g, '⇄').replace(/-->|->|=>/g, '→')
}

/**
 * Превращает цифры после символов элементов и закрывающих скобок в нижние индексы,
 * сохраняя ведущие коэффициенты: «2H2O» → «2H₂O», «Fe2(SO4)3» → «Fe₂(SO₄)₃»,
 * «CuSO4·5H2O» → «CuSO₄·5H₂O». Заодно приводит стрелки к → и ⇄.
 */
export function formatChemistry(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (isFormulaChar(ch)) {
      let j = i
      while (j < text.length && isFormulaChar(text[j])) j += 1
      out += formatToken(text.slice(i, j))
      i = j
      continue
    }
    out += ch
    i += 1
  }
  return normalizeArrows(out)
}

export type CaretRange = { start: number; end: number }

/**
 * Оформляет выделенный фрагмент (или весь текст, если выделения нет) и возвращает
 * новый текст с новым положением выделения.
 */
export function formatChemistryInRange(
  text: string,
  range: CaretRange,
): { text: string; range: CaretRange; changed: boolean } {
  const hasSelection = range.end > range.start
  const start = hasSelection ? range.start : 0
  const end = hasSelection ? range.end : text.length
  const before = text.slice(0, start)
  const middle = text.slice(start, end)
  const after = text.slice(end)
  const formatted = formatChemistry(middle)
  const next = before + formatted + after
  return {
    text: next,
    range: hasSelection
      ? { start, end: start + formatted.length }
      : { start: range.start, end: range.start },
    changed: next !== text,
  }
}

/** Вставляет фрагмент вместо выделения и ставит курсор после него. */
export function insertAtRange(
  text: string,
  range: CaretRange,
  insert: string,
): { text: string; caret: number } {
  const start = Math.max(0, Math.min(range.start, text.length))
  const end = Math.max(start, Math.min(range.end, text.length))
  const next = text.slice(0, start) + insert + text.slice(end)
  return { text: next, caret: start + insert.length }
}

/**
 * Вставляет шаблон «блоком»: с новой строки, если курсор не в начале строки,
 * и с пустой строкой после — чтобы продолжать писать было удобно.
 */
export function insertBlockAtRange(
  text: string,
  range: CaretRange,
  block: string,
): { text: string; caret: number } {
  const start = Math.max(0, Math.min(range.start, text.length))
  const before = text.slice(0, start)
  const needsLeadingBreak = before.length > 0 && !before.endsWith('\n')
  const lead = needsLeadingBreak ? (before.endsWith('\n\n') ? '' : '\n') : ''
  return insertAtRange(text, range, `${lead}${block}\n`)
}

export function countTextStats(text: string): { chars: number; lines: number } {
  if (!text) return { chars: 0, lines: 0 }
  return { chars: text.length, lines: text.split('\n').length }
}
