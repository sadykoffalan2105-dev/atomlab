/**
 * Лёгкая нормализация и «стемминг» для локального учителя (ru/en/uz).
 * Не лингвистически точный — достаточно, чтобы «оксиды»/«оксидов»/«оксид»
 * совпадали, а вопросительные слова не мешали поиску. Чистый модуль.
 */

export type StemLang = 'ru' | 'en' | 'uz'

export function foldText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ʻʼ‘’`']/g, "'")
}

/** Слова вопроса и связки — не несут темы. */
export const QUESTION_STOPWORDS = new Set([
  // ru
  'а', 'и', 'но', 'или', 'ли', 'же', 'ну', 'вот', 'да', 'нет', 'не', 'ни', 'то', 'это', 'эта', 'этот', 'эти',
  'что', 'чем', 'чего', 'кто', 'как', 'какой', 'какая', 'какое', 'какие', 'каков', 'где', 'когда', 'куда',
  'зачем', 'почему', 'отчего', 'сколько', 'такое', 'такой', 'такая', 'такие', 'так', 'же', 'ведь',
  'мне', 'меня', 'мы', 'ты', 'вы', 'он', 'она', 'они', 'его', 'ее', 'их', 'нам', 'вам', 'тебе', 'себе',
  'про', 'для', 'при', 'над', 'под', 'без', 'из', 'от', 'до', 'на', 'в', 'во', 'с', 'со', 'к', 'ко', 'о', 'об', 'у', 'по',
  'объясни', 'объясните', 'расскажи', 'расскажите', 'скажи', 'скажите', 'поясни', 'подскажи', 'помоги',
  'пожалуйста', 'можно', 'нужно', 'надо', 'хочу', 'знать', 'узнать', 'понять', 'значит', 'называют',
  'называется', 'приведи', 'приведите', 'пример', 'примеры', 'например', 'проще', 'попроще', 'подробнее',
  'подробно', 'простыми', 'словами', 'еще', 'раз', 'повтори', 'давай', 'учитель', 'вопрос', 'ответ',
  'будет', 'был', 'была', 'были', 'есть', 'бывает', 'происходит', 'вообще', 'очень', 'все', 'всё', 'весь',
  // en
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'with',
  'what', 'why', 'how', 'who', 'when', 'where', 'which', 'does', 'do', 'did', 'can', 'could', 'please',
  'explain', 'tell', 'me', 'about', 'give', 'example', 'examples', 'simpler', 'more', 'detail', 'again',
  'it', 'this', 'that', 'these', 'those', 'i', 'you', 'we', 'they', 'mean', 'means', 'called',
  // uz
  'nima', 'nega', 'qanday', 'qaysi', 'kim', 'qachon', 'qayerda', 'uchun', 'bu', 'u', 'va', 'yoki', 'haqida',
  'tushuntir', 'tushuntiring', 'ayting', 'aytib', 'bering', 'misol', 'keltir', 'batafsil', 'iltimos',
  'men', 'menga', 'siz', 'sizga', 'degani', 'deb', 'ataladi', 'ham', 'endi',
])

const RU_ENDINGS = [
  'иями', 'ями', 'ами', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ией', 'ией', 'иях', 'ах', 'ях', 'ов', 'ев',
  'ей', 'ой', 'ий', 'ый', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ую', 'юю', 'ом', 'ем', 'ам', 'ям', 'ых', 'их',
  'ать', 'ять', 'ить', 'еть', 'ться', 'тся', 'ет', 'ит', 'ют', 'ят', 'ут', 'ат',
  'ия', 'ие', 'ию', 'ии', 'а', 'я', 'ы', 'и', 'у', 'ю', 'е', 'о', 'ь',
]

/** Грубый стем: убираем окончание, оставляем основу ≥ 3 символов. */
export function stemWord(word: string): string {
  const w = foldText(word)
  if (/[а-я]/.test(w)) {
    if (w.length <= 4) return w
    for (const end of RU_ENDINGS) {
      if (w.endsWith(end) && w.length - end.length >= 3) {
        return w.slice(0, w.length - end.length).slice(0, 8)
      }
    }
    return w.slice(0, 8)
  }
  if (w.length <= 4) return w
  return w
    .replace(/(ies)$/, 'y')
    .replace(/(ing|ed|es|s|lar|ning|ni|ga|da|dan)$/, '')
    .slice(0, 9)
}

export function tokenizeWords(text: string): string[] {
  return foldText(text)
    .split(/[^\p{L}\p{N}']+/u)
    .map((t) => t.replace(/^'+|'+$/g, ''))
    .filter(Boolean)
}

/** Смысловые стемы запроса (без вопросительных слов). */
export function contentStems(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const tok of tokenizeWords(text)) {
    if (tok.length < 3 && !/\d/.test(tok)) continue
    if (QUESTION_STOPWORDS.has(tok)) continue
    const stem = stemWord(tok)
    if (!stem || seen.has(stem)) continue
    seen.add(stem)
    out.push(stem)
  }
  return out
}

/** Только падежные/числовые окончания существительных и прилагательных (без глагольных «-ит», «-ет»). */
const RU_CASE_ENDINGS = [
  'иями', 'ями', 'ами', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ией', 'иях', 'ах', 'ях', 'ов', 'ев', 'ей', 'ой',
  'ий', 'ый', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ую', 'юю', 'ом', 'ем', 'ам', 'ям', 'ых', 'их', 'ия', 'ию', 'ии',
  'а', 'я', 'ы', 'и', 'у', 'ю', 'е', 'о', 'ь',
]

/**
 * Строгая основа слова: снимаем только падежное окончание («оксидов» → «оксид», «графит» → «графит»).
 * В отличие от stemWord не склеивает разные слова с общим началом («графен» ≠ «графит»).
 */
export function strictStem(word: string): string {
  const w = foldText(word)
  if (/[а-я]/.test(w)) {
    for (const end of RU_CASE_ENDINGS) {
      if (w.endsWith(end) && w.length - end.length >= 3) return w.slice(0, w.length - end.length)
    }
    return w
  }
  if (w.length <= 4) return w
  return w.replace(/(ies)$/, 'y').replace(/(es|s|lari|larni|lar|ning|ni|ga|da|dan|i)$/, '')
}

const LAT_SUFFIX_RE = /^(|s|es|ies|'s|ed|ing|ly|lar|lari|larni|larning|larga|larda|lardan|ning|ni|ga|da|dan|dagi|i|ini|ga|dir|lardir)$/

/** Слово текста — форма того же слова, что и строгая основа вопроса («кислотного» ~ «кислот»). */
export function wordHasStem(textWord: string, stem: string): boolean {
  if (!stem || stem.length < 3) return false
  const w = foldText(textWord)
  // Латиница (en/uz): после основы — только окончание («metallarni» ~ «metall», но «elektroliz» ≠ «elektr»).
  if (w.startsWith(stem) && (/[а-я]/.test(stem) || LAT_SUFFIX_RE.test(w.slice(stem.length)))) return true
  const ws = strictStem(w)
  return ws.length >= 4 && ws.length >= stem.length - 1 && stem.startsWith(ws)
}

/** Совпадают ли два стема (префиксное сравнение для разных форм слова). */
export function stemsMatch(a: string, b: string): boolean {
  if (a === b) return true
  const min = Math.min(a.length, b.length)
  if (min < 4) return false
  return a.startsWith(b.slice(0, Math.max(4, min))) || b.startsWith(a.slice(0, Math.max(4, min)))
}
