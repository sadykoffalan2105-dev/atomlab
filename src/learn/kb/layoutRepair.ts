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
  [/про\s+текторы/gu, 'протекторы'],
  [/окислительно\s+восстановительн/gu, 'окислительно-восстановительн'],
  // Garbled sentences of the printed text (lost/duplicated words that invert or hide the meaning).
  [/является азот, накопленный в атмосфере нашей планеты оксид/gu, 'являются накопленные в атмосфере нашей планеты оксид'],
  [/разбавленные растворы которых также имеют малые значения,/gu, 'разбавленные растворы которых имеют малые значения степени диссоциации,'],
  [/Соотношение количества вещества на объем\s*[—–-]\s*раствора/gu, 'Отношение количества вещества к объему раствора'],
  // «при соединение их к ионам» — «при» never takes the nominative: an OCR split of «присоединение/приготовление».
  [/(?<![\p{L}-])([Пп]ри)\s+(\p{Ll}{4,}(?:ение|ание))(?![\p{L}])/gu, '$1$2'],
]

/**
 * Reviewed errata of the printed textbooks (factual slips, not layout). `skip` drops the whole sentence that contains
 * the span (the composer then falls back to another definition, e.g. a reference card); a string replaces the span.
 * Add an entry only after checking the fact against a second source.
 */
const ERRATA: Array<{ span: RegExp; fix: string | { skip: true }; note: string }> = [
  // Simple substances (H₂, O₂, N₂) are molecular too; the sentence restricts molecules to compounds.
  { span: /мельчайшая частица любого сложного вещества/u, fix: { skip: true }, note: 'Kimyo 7 §2.7: molecule ≠ only compounds' },
  // Glucose is grape sugar; fruit sugar is fructose.
  { span: /глюкоз(ы|а)\s*\(фруктового сахара\)/gu, fix: 'глюкоз$1 (виноградного сахара)', note: 'Kimyo 7 §2.7: glucose = grape sugar' },
  // The sum of protons and neutrons is the mass number A; Ar compares the atom mass with 1/12 of the ¹²C atom mass.
  { span: /Относительная атомная масса\s*[–—-]\s*это сумма протонов и нейтронов/gu, fix: 'Массовое число – это сумма протонов и нейтронов', note: 'Kimyo 7 §2.5 p49: Ar ≠ p + n (mass number)' },
  // Alcoholic fermentation is caused by yeast enzymes (translation slip «digestive»).
  { span: /пищеварительных ферментов/gu, fix: 'ферментов дрожжей', note: 'Kimyo 10 §3.2 p113: fermentation by yeast enzymes' },
  // Alkenes have one C=C double bond (the sentence says «single bonds»).
  { span: /органические вещества с одинарными связями между атомами углерода/gu, fix: 'органические вещества с одной двойной связью между атомами углерода', note: 'Kimyo 10 §2.7 p56: alkenes C=C' },
  // −196 °C is lower than −183 °C: nitrogen boils first because its boiling point is LOWER.
  { span: /(температура кипения\s*\(\s*[–—−-]\s*196\s*°\s*C\s*\)\s*)выше(,\s*чем)/gu, fix: '$1ниже$2', note: 'Kimyo 8 §36 p157: N₂ boils lower than O₂' },
]

function applyErrata(text: string): string {
  let out = text
  for (const { span, fix } of ERRATA) {
    if (typeof fix === 'string') out = out.replace(span, fix)
    else
      out = out
        .split('\n')
        .map((line) => (span.test(line) ? line.split(/(?<=[.!?])\s+/u).filter((s) => !span.test(s)).join(' ') : line))
        .join('\n')
  }
  return out
}

/** Generic OCR classes: a missing space after a period, spaced ion charges, garbled element-symbol lists. */
function repairOcrClasses(text: string): string {
  return (
    text
      // «атомов.Например, …» → «атомов. Например, …»
      .replace(/([\p{Ll}\d)»])\.(?=[А-ЯЁ]\p{Ll}{2,})/gu, '$1. ')
      // «H+ +OH – = H2O» → «H⁺ + OH⁻ = H2O»: a charge sign separated from its ion by spaces.
      .replace(/(?<![\p{L}\d])([A-Z][a-z]?\d*)\+(?=\s+\+\s*[A-Z])/gu, '$1⁺')
      .replace(/(?<![\p{L}\d])([A-Z][A-Za-z\d]*)\s+[–-](?=\s*(?:[=+→]|$))/gmu, '$1⁻')
      .replace(/([⁺⁻])\s+\+([A-Z])/gu, '$1 + $2')
      // Ionic equations «Ba2+ + SO42– = BaSO4↓»: the last digit before the sign is the charge.
      .split('\n')
      .map((line) =>
        /[=→]/u.test(line) && /[↓↑]|ионн/u.test(line)
          ? line
              .replace(/(?<![\p{L}\d])([A-Z][a-z]?)([1-4])[+⁺](?=[\s,.;]|$)/gu, (_m, el: string, d: string) => `${el}${SUPERSCRIPT[d]}⁺`)
              .replace(/(?<![\p{L}\d])((?:[A-Z][a-z]?\d*)*[A-Z][a-z]?\d)([1-4])[–⁻-](?=[\s,.;]|$)/gu, (_m, f: string, d: string) => `${f}${SUPERSCRIPT[d]}⁻`)
          : line,
      )
      .join('\n')
      // «(О, Е, №)» — an element-symbol list read with Cyrillic lookalikes / «№»: unreadable, drop it.
      .replace(/\s*\((?:\s*[^\s,()]{1,2}\s*,){1,6}\s*[^\s,()]{1,2}\s*\)/gu, (m) => (/[А-ЯЁа-яё№›]/u.test(m) ? '' : m))
  )
}

/** Task text: «Пример. … ? Решение: … Ответ: …», «Тестовые задания», numbered task items «6. В реакции … определите …». */
const TASK_HEADING_RE = /^\s*(Тестовые задания|Задачи и упражнения|Вопросы и задания|Упражнения|Test topshiriqlari)(?!\p{L})/u
const TASK_START_RE = /^\s*(Пример|Задача)\s*\d*\s*[.:]/u
const TASK_WORD_RE = /\?|Решение|Дано|Ответ\s*:|(Определите|Найдите|Вычислите|Рассчитайте|определите|найдите|вычислите|рассчитайте)(?!\p{L})/u
const NUMBERED_RE = /^\s*\d{1,2}[.)]\s/u

function dropTaskText(lines: readonly string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (TASK_HEADING_RE.test(line)) break
    if (TASK_START_RE.test(line) && lines.slice(i, i + 8).some((l) => TASK_WORD_RE.test(l))) {
      const answerAt = lines.findIndex((l, j) => j >= i && /Ответ\s*:/u.test(l))
      if (answerAt < 0) break
      i = answerAt
      continue
    }
    // «6. В реакции между … установилось равновесие. Если концентрации … определите …» — a numbered task item.
    if (NUMBERED_RE.test(line)) {
      let end = i
      while (end + 1 < lines.length && !NUMBERED_RE.test(lines[end + 1]!) && end - i < 2) end++
      if (lines.slice(i, end + 1).some((l) => TASK_WORD_RE.test(l))) {
        i = end
        continue
      }
    }
    out.push(line)
  }
  return out
}

/** «KMnO 4» → «KMnO4»: a formula of ≥ 2 element symbols split before its last index. */
const SPACED_FORMULA_RE = /(?<![\p{L}\d])((?:[A-Z][a-z]?\d*){2,})\s(\d)(?=[\s,.;)↓↑]|$)/gmu

const SUPERSCRIPT: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }

const CAPTION_LINE_RE = /^\s*(Рис|Rasm|Fig)\.\s*\d+\s*[.:]/u

/** Join broken lines, drop figure captions, fix exponents / «H2SO» / known OCR slips. */
export function repairLayout(raw: string): string {
  let text = applyErrata(raw)
  for (const [re, to] of OCR_FIXES) text = text.replace(re, to)
  const out: string[] = []
  for (const line of dropTaskText(text.split('\n'))) {
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
  text = text.replace(SPACED_FORMULA_RE, '$1$2')
  // An equilibrium is reversible: «равновесие диссоциации воды H2O → H+ + OH–» → «⇌».
  text = text
    .split('\n')
    .map((l) => (/равновеси/u.test(l) ? l.split(/(?<=[.!?])\s+/u).map((s) => (/равновеси/u.test(s) ? s.replace(/\s→\s/gu, ' ⇌ ') : s)).join(' ') : l))
    .join('\n')
  text = text.replace(/(\d[,.]\d+)\s*[∙•·×]\s*10\s?([12]\d)(?!\d)/gu, (_m, a: string, e: string) => `${a}·10${[...e].map((d) => SUPERSCRIPT[d]).join('')}`)
  if (/H2SO4/u.test(text) && !/H2SO3/u.test(text)) text = text.replace(/H2SO(?![0-9₀-₉])/gu, 'H2SO4')
  return repairOcrClasses(text)
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
