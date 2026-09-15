/**
 * Runtime repair of textbook layout noise in KB chunk text (pure module, no data imports).
 *
 * The corpus keeps the printed line breaks, figure captions and a few OCR slips. They are harmless for BM25
 * search but break the sentences the local teacher reads aloud:
 *   • a sentence broken by a line break: «…содержащий более\n2,14 % углерода» (the split lost the numbers);
 *   • a figure caption inside a sentence: «…проводят электрический ток,\nРис. 1. Прибор …\nназываются электролитами»;
 *   • a stray «!» at a line start: «…разными физическими\n! и химическими свойствами называются изомерами»;
 *   • a lost exponent «6,02∙1023» → «6,02·10²³»; «H2SO» next to «H2SO4» in the same chunk;
 *   • letter-spaced words of the OCR («обуслов ливает хорош у ю …»).
 * Only spelling/layout is changed — never facts.
 */

/** Known OCR slips that change the meaning or break the sentence (spelling fixes, not facts). */
const OCR_FIXES: Array<[RegExp, string]> = [
  [/обуслов\s+ливает/gu, 'обусловливает'],
  [/хорош\s+у\s+ю/gu, 'хорошую'],
  [/электро\s+и\s+т\s*еп\s*лоп\s*роводнос\s*т\s*ь/gu, 'электро- и теплопроводность'],
  [/составля\s+ется/gu, 'составляется'],
  [/Жирыпредставляют/gu, 'Жиры представляют'],
  [/\s*\(с тягой\)/gu, ''],
]

const SUPERSCRIPT: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }

const CAPTION_LINE_RE = /^\s*(Рис|Rasm|Fig)\.\s*\d+\s*[.:]/u

/** Join broken lines, drop figure captions, fix exponents / «H2SO» / known OCR slips. */
export function repairLayout(raw: string): string {
  let text = raw
  for (const [re, to] of OCR_FIXES) text = text.replace(re, to)
  const out: string[] = []
  for (const line of text.split('\n')) {
    let cur = line.replace(/^\s*!\s+(?=\p{Ll})/u, '')
    const prev = out[out.length - 1]
    if (CAPTION_LINE_RE.test(cur)) {
      // «…проводят электрический ток,\nРис. 1. Прибор для … растворов называются электролитами.» — подпись
      // вклеена перед окончанием фразы: оставляем только окончание.
      const tail = prev !== undefined && /,\s*$/u.test(prev) ? cur.match(/\s((?:называ|явля|относ)\p{L}*\s.*)$/u) : null
      if (!tail) continue
      cur = tail[1]!
    }
    const continues =
      prev !== undefined &&
      !/[.!?:;»]\s*$/u.test(prev) &&
      /^\s*(\p{Ll}|\d+[,.]\d|\d+\s*%|\d+\s+\p{Ll})/u.test(cur) &&
      !/^\s*\d+[.)]\s/u.test(cur)
    if (continues) out[out.length - 1] = `${prev.replace(/\s+$/, '')} ${cur.trim()}`
    else out.push(cur)
  }
  text = out.join('\n')
  text = text.replace(/(\p{L})\s+!\s+(\p{Ll})/gu, '$1 $2')
  text = text.replace(/(\d[,.]\d+)\s*[∙•·×]\s*10\s?([12]\d)(?!\d)/gu, (_m, a: string, e: string) => `${a}·10${[...e].map((d) => SUPERSCRIPT[d]).join('')}`)
  if (/H2SO4/u.test(text) && !/H2SO3/u.test(text)) text = text.replace(/H2SO(?![0-9₀-₉])/gu, 'H2SO4')
  return text
}

const splitSentences = (text: string) =>
  text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[\p{Lu}«])/u))
    .map((s) => s.trim())
    .filter(Boolean)

/**
 * Definition chunks were cut from the raw text, so a line can start in the middle of a sentence
 * («и химическими свойствами называются изомерами.») or carry a caption as its subject («Прибор для определения
 * … называются электролитами.»). Replace such a line with the full sentence of the same paragraph's textbook text
 * that ends the same way («… называются электролитами.»), when that sentence is different.
 */
export function repairDefinitionText(definitionText: string, paragraphTexts: readonly string[]): string {
  if (paragraphTexts.length === 0) return definitionText
  const sentences = splitSentences(paragraphTexts.map(repairLayout).join('\n'))
  const norm = (s: string) => s.replace(/\s+/g, ' ').replace(/[.!]+$/u, '').trim()
  return definitionText
    .split('\n')
    .map((line) => {
      const clean = norm(line)
      const at = clean.search(/\s(называ(ется|ются|ют)|принято называть)\s/u)
      const tail = at >= 0 && clean.length - at <= 70 ? clean.slice(at) : clean.slice(-32)
      if (tail.length < 18) return line
      const full = sentences.map(norm).find((s) => s !== clean && s.endsWith(tail) && s.length > clean.length && s.length <= 420)
      // Only a longer sentence that contains the line's defined part; never a different definition.
      return full && (full.endsWith(clean) || /^\p{Ll}/u.test(clean) || captionInside(line, paragraphTexts)) ? `${full}.` : line
    })
    .join('\n')
}

/** The raw paragraph text has a caption line right before the definition's tail (the line's subject is a caption). */
function captionInside(line: string, paragraphTexts: readonly string[]): boolean {
  const head = line.trim().slice(0, 24)
  return head.length >= 12 && paragraphTexts.some((t) => t.split('\n').some((l) => CAPTION_LINE_RE.test(l) && l.includes(head)))
}
