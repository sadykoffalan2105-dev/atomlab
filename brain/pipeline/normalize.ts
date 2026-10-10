/**
 * Шаг 1 конвейера: нормализация текста, язык вопроса и «набор букв» (gibberish).
 * Логика gibberish перенесена из src/learn/brain/dualMode/gibberish.ts (без импорта elements:
 * слова-элементы подставляет загрузчик знаний через setElementWords).
 */
import { detectLocale } from '../../src/learn/kb/analyzer.ts'
import { ub } from './rx.ts'

export type Lang = 'ru' | 'en' | 'uz'

export type Normalized = {
  /** NFC, без лишних пробелов — для показа и поиска */
  text: string
  /** нижний регистр, ё→е, апострофы → «'» — для сравнений регулярками */
  cmp: string
  lang: Lang
  gibberish: boolean
}

export function cmpForm(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[ʻʼ‘’`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

const UZ_WORDS =
  /\b(salom|assalomu|alaykum|rahmat|qalay|qalaysiz|xayr|yaxshi|yaxshimisiz|kimyo|kimyoviy|nima|nimaga|nega|qanday|qaysi|qachon|kim|haqida|uchun|bilan|emas|bo'ladi|bo'lsa|deb|ataladi|ayting|aytib|tushuntir|tushuntiring|modda|moddalar|kislota|asos|tuz|eritma|massa|necha|qancha|hisobla|toping|savol|javob|men|sen|siz|biz|ular|bu|shu|ham|lekin|ammo|yoki|va|ko'rishguncha|kechirasiz|ismingiz|ishlar|zo'r|ajoyib|charchadim|zerikdim|tushunmadim|ning|dagi|lar|molyar|massasi|ulushi|darajasi|hisoblang|aniqlang|tenglashtiring|eritmasi|nechta|formulasi|tuzilishi|xossalari|olinishi|oksidlanish|ustoz|domla)\b/

const FORMULA_LIKE = /(?<![\p{L}])(?:[A-Z][a-z]?\d*|\((?:[A-Z][a-z]?\d*)+\)\d*)+(?![\p{L}])/gu

const UZ_CYR = ub(/\b(нима|қандай|учун|билан|нега|ҳақида|кимё|модда)\b/)

/** Язык вопроса: кириллица → ru (узбекская кириллица ў/қ/ғ/ҳ → uz); латиница + узбекские маркеры → uz; иначе en. */
export function detectLang(text: string): Lang {
  // формулы («HCl», «Ca(OH)2», «KMnO4») и «pH» — не язык: убираем до подсчёта букв
  const stripFormula = (m: string) => (m !== 'OK' && (/\d/.test(m) || (m.match(/[A-Z]/g) ?? []).length >= 2) ? ' ' : m)
  const t = cmpForm(text.replace(FORMULA_LIKE, stripFormula).replace(/\bp[Hh]\b/g, ' '))
  const noFormula = t.replace(/\b[a-z]{0,2}\d[a-z0-9()]*\b/g, ' ')
  const cyr = (noFormula.match(/[а-яўқғҳ]/g) ?? []).length
  const lat = (noFormula.match(/[a-z]/g) ?? []).length
  if (cyr > 0 && cyr >= lat) {
    if (/[ўқғҳ]/.test(noFormula) || UZ_CYR.test(noFormula)) return 'uz'
    return 'ru'
  }
  if (!lat) return 'ru'
  if (/[og]'/.test(noFormula)) return 'uz'
  const uzHits = (noFormula.match(new RegExp(UZ_WORDS.source, 'g')) ?? []).length
  const enHits = (noFormula.match(/\b(the|what|is|are|how|why|of|which|does|do|you|hello|hi|thanks|thank|please|explain|can|i|my|and|with|in|a|an)\b/g) ?? []).length
  if (uzHits > enHits) return 'uz'
  if (enHits > uzHits) return 'en'
  if (/[a-z]{3,}(ning|dagi|lari|lar|si|ni|ga|da|dan)\b/.test(noFormula)) return 'uz'
  return detectLocale(text) === 'uz' ? 'uz' : 'en'
}

// ---------------------------------------------------------------- gibberish (из dualMode/gibberish.ts)

const KEYBOARD_ROWS = ['йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm']
const VOWEL_RE = /[аеёиоуыэюяaeiouäöü]/i
const NEUTRAL_RE = /[ьъʼ'‘’`йy]/i

const COMMON_WORDS = new Set(
  (
    'что это как почему зачем где когда какой какая какое какие чем кто ли если то так вот еще ещё' +
    ' не ни да нет мне мы вы ты он она они его ее её их нам вам им есть был была было быть будет' +
    ' для про над под при без через между из-за из у в во на о об от до по за с со к ку и а но или' +
    ' скажи расскажи объясни покажи помоги реши дай можно нужно надо хочу знаю понял понятно' +
    ' урок тема задача пример вопрос ответ учитель ученик класс книга учебник параграф' +
    ' вода воздух соль сахар огонь газ жидкость металл раствор опыт масса объем объём' +
    ' привет пока спасибо здравствуйте дела хорошо ладно ок' +
    ' what why how when where which who is are was were the a an and or but not for with without' +
    ' this that these those can could do does did have has had will would should please tell explain' +
    ' show help solve give me you it they them his her their about into from between under over hi hello bye thanks ok' +
    ' nima nega qanday qachon qayerda qaysi kim va yoki lekin ammo bu shu ular biz siz men sen' +
    " bor yoq yo'q kerak mumkin ayt tushuntir ko'rsat yordam ber savol javob dars mavzu misol" +
    ' suv havo tuz shakar olov gaz suyuqlik metall eritma tajriba massa hajm salom rahmat xayr'
  ).split(/\s+/),
)

const ELEMENT_WORDS = new Set<string>()

/** Символы и названия элементов (ru/en/uz) — любой из них означает настоящий вопрос. */
export function setElementWords(words: Iterable<string>): void {
  for (const w of words) if (w) ELEMENT_WORDS.add(w.toLowerCase())
}

const CHEM_STEMS = [
  'хими', 'атом', 'молекул', 'ион', 'элемент', 'веществ', 'реакц', 'формул', 'валент', 'оксид',
  'кислот', 'основан', 'соль', 'сол', 'раствор', 'масс', 'моль', 'связ', 'заряд', 'электрон',
  'протон', 'нейтрон', 'ядр', 'катализ', 'плотн', 'кристалл', 'металл', 'газ', 'жидк', 'тверд',
  'chem', 'atom', 'molecul', 'ion', 'element', 'substanc', 'react', 'formul', 'valen', 'oxid',
  'acid', 'base', 'salt', 'solut', 'mass', 'mole', 'bond', 'charg', 'electron', 'proton',
  'neutron', 'nucle', 'catalys', 'dens', 'crystal', 'metal', 'gas', 'liquid', 'solid',
  'kimyo', 'modda', 'reaksiya', 'zichlik', 'zaryad', 'birikma', 'eritma', 'valentlik', 'oksid',
  'kislota', 'asos', 'tuz', "bog'", 'bog', 'elektron', 'katalizator', 'suyuq', 'qattiq',
]

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}ʼ'‘’]{2,}/gu) ?? []).map((t) => t.replace(/^['‘’ʼ]+|['‘’ʼ]+$/g, ''))
}

function maxConsonantRun(token: string): number {
  let run = 0
  let best = 0
  for (const ch of token) {
    if (VOWEL_RE.test(ch)) {
      run = 0
      continue
    }
    if (NEUTRAL_RE.test(ch)) continue
    run++
    if (run > best) best = run
  }
  return best
}

function tailConsonants(token: string): number {
  let n = 0
  for (let i = token.length - 1; i >= 0; i--) {
    const ch = token[i]!
    if (VOWEL_RE.test(ch)) break
    if (NEUTRAL_RE.test(ch)) continue
    n++
  }
  return n
}

function keyboardMash(token: string): boolean {
  if (token.length < 4) return false
  return KEYBOARD_ROWS.some((row) => [...token].every((ch) => row.includes(ch)))
}

function knownToken(token: string): boolean {
  if (COMMON_WORDS.has(token) || ELEMENT_WORDS.has(token)) return true
  return CHEM_STEMS.some((stem) => token.startsWith(stem) || (stem.length >= 5 && stem.startsWith(token) && token.length >= 4))
}

function nonWordToken(token: string): boolean {
  if (knownToken(token)) return false
  if (!VOWEL_RE.test(token)) return true
  if (maxConsonantRun(token) >= 4) return true
  if (tailConsonants(token) >= 3) return true
  return keyboardMash(token)
}

export function looksLikeGibberish(text: string): boolean {
  const clean = text.trim()
  if (!clean || clean.length > 80) return false
  if (/\d/.test(clean)) return false
  const tokens = tokenize(clean)
  if (tokens.length === 0) return /^[^\p{L}\p{N}]+$/u.test(clean) && clean.length >= 3
  if (tokens.length > 8) return false
  if (tokens.some(knownToken)) return false
  const bad = tokens.filter(nonWordToken).length
  return tokens.length === 1 ? bad === 1 && tokens[0]!.length >= 3 : bad / tokens.length >= 0.6
}

export function normalizeInput(raw: string, requested: Lang | 'auto' = 'auto'): Normalized {
  const text = raw.normalize('NFC').replace(/[   ]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  const lang = requested === 'auto' ? detectLang(text) : requested
  return { text, cmp: cmpForm(text), lang, gibberish: looksLikeGibberish(text) }
}

/** Переспрос на «набор букв» — без цитирования мусора. */
export const GIBBERISH_REPLY: Record<Lang, string> = {
  ru: 'Кажется, сообщение получилось случайным набором букв — я не разобрал вопрос. Напишите его словами: например, «что такое моль?» или «уравняй Fe + O₂».',
  uz: 'Xabar tasodifiy harflar toʻplamiga oʻxshaydi — savolni tushunmadim. Iltimos, soʻz bilan yozing: masalan, «mol nima?» yoki «Fe + O₂ ni tenglashtir».',
  en: 'That looks like a random set of letters — I could not make out the question. Please type it in words, e.g. “what is a mole?” or “balance Fe + O₂”.',
}

/** Языковая проверка ответа: доля букв нужной письменности. */
export function scriptShare(text: string): { cyr: number; lat: number } {
  const clean = text.replace(/\b[A-Z][a-z]?[₀-₉0-9A-Za-z()]*[₀-₉0-9]\b/g, ' ')
  const cyr = (clean.match(/[а-яёА-ЯЁўқғҳЎҚҒҲ]/g) ?? []).length
  const lat = (clean.match(/[A-Za-z]/g) ?? []).length
  const all = cyr + lat || 1
  return { cyr: cyr / all, lat: lat / all }
}

/** Похож ли текст ответа на язык lang (формулы не считаются). */
export function matchesLang(text: string, lang: Lang): boolean {
  const { cyr, lat } = scriptShare(text)
  if (cyr + lat === 0) return true
  if (lang === 'ru') return cyr >= 0.6
  const latinOk = lat >= 0.6
  if (!latinOk) return false
  if (lang === 'en') return detectLang(text) !== 'uz' || !/[og][ʻ'‘’]/.test(text)
  return detectLang(text) === 'uz' || /[og][ʻ'‘’]/.test(text)
}
