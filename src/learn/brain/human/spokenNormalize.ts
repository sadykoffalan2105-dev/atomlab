import { spokenFormulasToText } from '../speech/chemTranscript'

/**
 * Нормализация живой, надиктованной речи (STT) → канонический вопрос. Без зависимостей, чисто текст.
 *
 *  • заполнители и слова-паразиты (RU/EN/UZ): «э… ну… это самое… короче… типа… как бы… значит… в общем»,
 *    «слушай», «скажи» в начале, «блин»; en: um, uh, you know, i mean, like (в начале/между запятыми);
 *    uz: xo‘sh, ya’ni, demak, anavi, hali;
 *  • вопросительные хвосты: «…, да?», «…а?», «…нет?», «…правильно?», «…так?», «right?», «to‘g‘rimi?» → «?»;
 *  • самоповторы и оборванные повторы: «что такое что такое оксид» → «что такое оксид», «моль моль» → «моль»;
 *  • числа словами → цифры: «двести грамм» → «200 г», «два моль» → «2 моль», «twenty five grams» → «25 g»,
 *    «ikki mol» → «2 mol»; одиночные «один/два» без единицы измерения не трогаем («один вопрос»);
 *  • регистр остальных слов и формулы («H2SO4», «аш два о») не меняем — ими занимается голосовой слой.
 *
 * Применяется в humanTurn, answerFromQaBank и признаках классификатора намерений — то есть во всех слоях.
 */

const RU_FILLERS = [
  'это самое', 'как бы', 'в общем', 'в общем-то', 'так сказать', 'на самом деле', 'то есть',
  'короче говоря', 'короче', 'типа', 'значит', 'собственно', 'блин', 'вот', 'ну', 'э', 'эм', 'ээ', 'эээ', 'мм', 'ммм', 'хм', 'хмм', 'эмм', 'м-м', 'э-э',
  'слушай', 'слышишь', 'слышь', 'прикинь', 'в принципе', 'получается', 'допустим',
]
const RU_LEAD = ['скажи мне', 'скажи', 'подскажи мне', 'подскажи', 'расскажи-ка', 'слушай', 'учитель', 'алло', 'окей', 'ок', 'так', 'а', 'и', 'да']
const RU_TAILS = ['да', 'а', 'нет', 'правильно', 'так', 'верно', 'же', 'ведь', 'что ли', 'или как', 'или нет', 'не так ли', 'понимаешь', 'да или нет']
const EN_FILLERS = ['um', 'umm', 'uh', 'uhh', 'erm', 'er', 'hmm', 'hm', 'you know', 'i mean', 'kind of', 'sort of', 'basically', 'actually', 'well', 'so', 'like']
const EN_LEAD = ['tell me', 'teacher', 'hey', 'ok', 'okay', 'so', 'and', 'listen']
const EN_TAILS = ['right', 'yeah', 'ok', 'okay', 'huh', 'isn\'t it', 'no', 'or not', 'you know']
const UZ_FILLERS = ['xo\'sh', 'ya\'ni', 'demak', 'anavi', 'hali', 'anaqa', 'shunaqa', 'nima desam', 'xullas', 'endi', 'mana', 'bilasizmi', 'bilasanmi']
const UZ_LEAD = ['ayting-chi', 'aytingchi', 'ayt-chi', 'aytchi', 'ustoz', 'qarang', 'xo\'sh']
const UZ_TAILS = ['to\'g\'rimi', 'shundaymi', 'a', 'ha', 'yo\'qmi', 'to\'g\'ri', 'shunday']

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['ʻʼ‘’`]").replace(/-/g, '[-‑]')
const alt = (list: string[]) => list.sort((a, b) => b.length - a.length).map(esc).join('|')
const NOT_L = String.raw`(?<![\p{L}\p{N}-])`
const NOT_R = String.raw`(?![\p{L}\p{N}-])`

/** «э», «ну», «типа» внутри фразы — только как отдельные слова, не части слов. */
const FILLER_INNER = new RegExp(`${NOT_L}(?:${alt([...RU_FILLERS, ...UZ_FILLERS])})${NOT_R}[\\s,…]*`, 'giu')
const FILLER_EN = new RegExp(`${NOT_L}(?:${alt(EN_FILLERS.filter((f) => !['so', 'like', 'well', 'actually'].includes(f)))})${NOT_R}[\\s,…]*`, 'giu')
/** «like» и «so» — заполнители только в начале или между запятыми («so, um, what is…»). */
const FILLER_EN_SOFT = new RegExp(`(^|,\\s*)(?:so|like|well|actually)(?:\\s*,|\\s+(?=(?:um|uh|like|what|how|why|is|do|does|can|could|tell|i)\\b))|(\\s)like\\s+(?=(?:the|a|an|what|how|why|is)\\b)`, 'giu')
const LEAD = new RegExp(`^(?:(?:${alt([...RU_LEAD, ...EN_LEAD, ...UZ_LEAD])})${NOT_R}[\\s,:…!-]*)+`, 'iu')
const TAIL = new RegExp(`[\\s,]+(?:${alt([...RU_TAILS, ...EN_TAILS, ...UZ_TAILS])})\\s*[?!.…]*\\s*$`, 'iu')

/* ------------------------------------------------------------- числа словами */

const RU_NUM: Record<string, number> = {
  ноль: 0, нуль: 0, один: 1, одна: 1, одно: 1, одного: 1, одной: 1, два: 2, две: 2, двух: 2, три: 3, трех: 3, четыре: 4, четырех: 4, пять: 5, пяти: 5,
  шесть: 6, шести: 6, семь: 7, семи: 7, восемь: 8, восьми: 8, девять: 9, девяти: 9, десять: 10, десяти: 10, одиннадцать: 11, двенадцать: 12, тринадцать: 13,
  четырнадцать: 14, пятнадцать: 15, шестнадцать: 16, семнадцать: 17, восемнадцать: 18, девятнадцать: 19, двадцать: 20, двадцати: 20, тридцать: 30, тридцати: 30,
  сорок: 40, сорока: 40, пятьдесят: 50, пятидесяти: 50, шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90, сто: 100, ста: 100, двести: 200, двухсот: 200,
  триста: 300, четыреста: 400, пятьсот: 500, шестьсот: 600, семьсот: 700, восемьсот: 800, девятьсот: 900, тысяча: 1000, тысячи: 1000, тысяч: 1000, полтора: 1.5, полторы: 1.5,
  // порядковые — для «в восьмом классе», «седьмой класс», «третья группа»
  первом: 1, первый: 1, первая: 1, первой: 1, втором: 2, второй: 2, вторая: 2, третьем: 3, третий: 3, третья: 3, третьей: 3, четвертом: 4, четвертый: 4, четвертая: 4,
  пятом: 5, пятый: 5, пятая: 5, шестом: 6, шестой: 6, шестая: 6, седьмом: 7, седьмой: 7, седьмая: 7, восьмом: 8, восьмой: 8, восьмая: 8, девятом: 9, девятый: 9, девятая: 9,
  десятом: 10, десятый: 10, десятая: 10, одиннадцатом: 11, одиннадцатый: 11, одиннадцатая: 11,
}
const EN_NUM: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
}
const UZ_NUM: Record<string, number> = {
  nol: 0, bir: 1, ikki: 2, uch: 3, "to'rt": 4, besh: 5, olti: 6, yetti: 7, sakkiz: 8, "to'qqiz": 9, "o'n": 10, yigirma: 20, "o'ttiz": 30, qirq: 40, ellik: 50,
  oltmish: 60, yetmish: 70, sakson: 80, "to'qson": 90, yuz: 100, ming: 1000,
}
const UNIT_AFTER = /^(?:моль|молей|моля|грамм\p{L}*|г|кг|килограмм\p{L}*|мг|миллиграмм\p{L}*|литр\p{L}*|л|мл|миллилитр\p{L}*|процент\p{L}*|%|градус\p{L}*|атом\p{L}*|молекул\p{L}*|электрон\p{L}*|протон\p{L}*|нейтрон\p{L}*|валентн\p{L}*|класс\p{L}*|группа|группе|группы|период\p{L}*|mol(?:es?)?|grams?|g|kg|kilograms?|mg|liters?|litres?|l|ml|percent|degrees?|atoms?|molecules?|electrons?|protons?|neutrons?|grade|group|period|gramm|litr|foiz|atom|molekula|elektron|proton|neytron|sinf|guruh|davr)$/iu
const UNIT_SHORT: Record<string, string> = { грамм: 'г', грамма: 'г', граммов: 'г', килограмм: 'кг', килограмма: 'кг', килограммов: 'кг', миллилитр: 'мл', миллилитра: 'мл', миллилитров: 'мл', литр: 'л', литра: 'л', литров: 'л', grams: 'g', gram: 'g', kilograms: 'kg', kilogram: 'kg', milliliters: 'ml', millilitres: 'ml', liters: 'l', litres: 'l' }

function numValue(words: string[]): number | null {
  // «двести пятьдесят три» = 253; «две тысячи» = 2000; «twenty five» = 25; «bir yuz ellik» = 150.
  let total = 0
  let current = 0
  for (const w of words) {
    const v = RU_NUM[w] ?? EN_NUM[w] ?? UZ_NUM[w]
    if (v == null) return null
    if (v === 1000) {
      current = (current || 1) * 1000
      total += current
      current = 0
    } else if (v === 100) current = (current || 1) * 100
    else if (v >= 100) current += v
    else current += v
  }
  return total + current
}

const NUM_WORD = new RegExp(`^(?:${Object.keys(RU_NUM).concat(Object.keys(EN_NUM), Object.keys(UZ_NUM)).map(esc).join('|')})$`, 'iu')

function wordsToDigits(text: string): string {
  const tokens = text.split(/(\s+)/)
  const out: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    if (!NUM_WORD.test(t.replace(/^[^\p{L}]+|[^\p{L}']+$/gu, ''))) {
      out.push(t)
      continue
    }
    // Собираем цепочку числительных.
    const chain: string[] = []
    let j = i
    let last = i
    while (j < tokens.length) {
      const w = tokens[j]!
      if (/^\s+$/.test(w)) {
        j++
        continue
      }
      const clean = w.toLowerCase().replace(/^[^\p{L}]+|[^\p{L}']+$/gu, '')
      if (!NUM_WORD.test(clean) || (chain.length && /[,.;:?!]$/.test(tokens[last] ?? ''))) break
      chain.push(clean)
      last = j
      j++
    }
    const value = numValue(chain)
    const nextWord = (tokens.slice(last + 1).find((w) => !/^\s+$/.test(w)) ?? '').toLowerCase().replace(/[?!.,]+$/g, '')
    const hasUnit = UNIT_AFTER.test(nextWord)
    const prevWord = (out.filter((w) => !/^\s+$/.test(w)).slice(-1)[0] ?? '').toLowerCase()
    const afterKeyword = /^(?:номер|номером|класс|классе|группа|группе|период|периоде|валентность|grade|group|period|number|sinf|guruh|davr)$/iu.test(prevWord)
    if (value == null || (!hasUnit && !afterKeyword && chain.length === 1 && value < 10)) {
      out.push(t)
      continue
    }
    const trailing = tokens[last]!.match(/[?!.,]+$/)?.[0] ?? ''
    out.push(String(value).replace('.', ',') + trailing)
    i = last
  }
  return out
    .join('')
    .replace(/(\d)\s+(\p{L}+)/gu, (m, d: string, u: string) => (UNIT_SHORT[u.toLowerCase()] ? `${d} ${UNIT_SHORT[u.toLowerCase()]}` : m))
}

/* ------------------------------------------------------------- повторы */

function collapseRepeats(text: string): string {
  const words = text.split(/\s+/)
  const out: string[] = []
  const key = (w: string) => w.toLowerCase().replace(/[,.!?…]+$/g, '')
  for (let i = 0; i < words.length; i++) {
    let skipped = false
    // n-граммы от 3 до 1: «что такое что такое» → «что такое»; «моль моль» → «моль».
    for (let n = 3; n >= 1 && !skipped; n--) {
      if (out.length < n) continue
      const prev = out.slice(-n).map(key).join(' ')
      const next = words.slice(i, i + n).map(key).join(' ')
      if (prev && prev === next && !/^\d+$/.test(prev)) {
        i += n - 1
        skipped = true
      }
    }
    if (!skipped) out.push(words[i]!)
  }
  // Оборванное слово + полное: «окси оксид», «вален валентность» (без цифр, ≥3 букв, не формула).
  return out
    .filter((w, i, a) => {
      const nx = a[i + 1]
      const k = key(w)
      return !(nx && k.length >= 3 && /^\p{Ll}+$/u.test(k) && key(nx).startsWith(k) && key(nx).length > k.length)
    })
    .join(' ')
}

/* ------------------------------------------------------------- главная функция */

/** Убрать речевой мусор, не меняя регистр и формулы. Пустая строка → пустая. */
export function spokenNormalize(raw: string): string {
  if (!raw) return ''
  let t = raw.replace(/\s+/g, ' ').replace(/\s*…\s*/g, ' ').replace(/(\s*\.){2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim()
  if (!t) return ''
  const before = t
  // 1) хвосты («…, да?», «right?», «to‘g‘rimi?») — только если перед ними есть что-то содержательное.
  for (let k = 0; k < 2; k++) {
    const m = t.match(TAIL)
    if (!m || m.index === 0 || t.slice(0, m.index).split(/\s+/).filter((w) => /\p{L}/u.test(w)).length < 2) break
    t = `${t.slice(0, m.index)}?`
  }
  // 2) заполнители внутри и в начале.
  t = t.replace(FILLER_EN_SOFT, '$1$2').replace(FILLER_EN, ' ').replace(FILLER_INNER, ' ')
  t = t.replace(/\s+/g, ' ').replace(/^[\s,:;…!.-]+/, '').trim()
  t = t.replace(LEAD, '').replace(/^(?:это|that|bu)\s*,\s*/iu, '')
  t = t.replace(FILLER_INNER, ' ').replace(/\s+/g, ' ').replace(/^[\s,:;…!.-]+/, '').trim()
  // 3) мусорная пунктуация: «, ,» → «,», «что ,» → «что,», висячие запятые в конце.
  t = t
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/([,;:])\s*(?:[,;:]\s*)+/g, '$1 ')
    .replace(/,\s*\?/g, '?')
    .replace(/[,;:\s-]+$/g, (m) => (/[?!.]/.test(m) ? m : ''))
    .trim()
  // 4) повторы и числа словами.
  t = collapseRepeats(t)
  t = wordsToDigits(t)
  // 5) формулы словами — в запись («аш два эс о четыре» → H₂SO₄, «h two o» → H₂O): и для микрофона, и для напечатанного
  t = spokenFormulasToText(t, /[а-яё]/i.test(t) ? 'ru' : 'en')
  // Ничего содержательного не осталось (одни «э… ну…») — отдаём исходник, пусть решает движок.
  if (!/[\p{L}\p{N}]/u.test(t)) return before
  // Вопрос без знака, но с вопросительным словом — добавим «?» для единообразия поиска.
  if (!/[?!.]$/.test(t) && /^(что|как|почему|зачем|сколько|какой|какая|какое|какие|где|когда|чем|кто|what|how|why|which|where|when|who|nima|qanday|nega|nechta|qancha|qayer)\b/iu.test(t)) t += '?'
  return t
}

/** Канонический ключ для сравнений в тестах: нижний регистр, ё→е, без пунктуации и лишних пробелов. */
export function spokenKey(text: string): string {
  return spokenNormalize(text)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[ʻʼ‘’`]/g, "'")
    .replace(/[?!.,;:…]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Есть ли в реплике речевой мусор (для статистики и отладки). */
export function hasSpokenNoise(text: string): boolean {
  return spokenKey(text) !== text.toLowerCase().replace(/ё/g, 'е').replace(/[?!.,;:…]+/g, ' ').replace(/\s+/g, ' ').trim()
}
