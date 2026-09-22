/**
 * Эвристика «это не слово»: ученик ткнул в клавиатуру или распознавание речи выдало шум.
 *
 * Раньше на «фыва олдж пррр» учитель отвечал отказом и ЦИТИРОВАЛ этот набор букв обратно
 * («точного ответа на „фыва олдж пррр“ в моей базе нет») — выглядело так, будто он принял
 * мусор за тему вопроса. Теперь такой ввод распознаётся и получает переспрос БЕЗ цитаты.
 *
 * Признаки «не слова» (проверяются по каждому токену):
 *   • токен есть в словаре (элементы, школьные термины, частотные слова языка) → это слово;
 *   • нет ни одной гласной («пррр», «mnbvxz»);
 *   • подряд 4+ согласных («qwrtplzk») или 3+ согласных в конце («олдж»);
 *   • токен целиком лежит на одном ряду клавиатуры («фыва», «asdf»).
 *
 * Вердикт «мусор» выносится только когда таких токенов большинство и ни один токен
 * не опознан как химический термин — настоящий вопрос так не потерять.
 */
import { ELEMENTS } from '../../../data/elements'

/** Ряды клавиатуры: «фыва», «asdf», «олдж» — типичный «ввод от скуки». */
const KEYBOARD_ROWS = [
  'йцукенгшщзхъ',
  'фывапролджэ',
  'ячсмитьбю',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
]

/** Гласные трёх языков; ь/ъ/ʼ считаем нейтральными (они не рвут «согласный ряд»). */
const VOWEL_RE = /[аеёиоуыэюяaeiouäöü]/i
const NEUTRAL_RE = /[ьъʼ'‘’`йy]/i

/**
 * Частотные слова ru/en/uz — их достаточно, чтобы обычная фраза ученика никогда
 * не попала под «мусор» целиком (список намеренно короткий: он только страхует).
 */
const COMMON_WORDS = new Set(
  (
    'что это как почему зачем где когда какой какая какое какие чем кто ли если то так вот еще ещё' +
    ' не ни да нет мне мы вы ты он она они его ее её их нам вам им есть был была было быть будет' +
    ' для про над под при без через между из-за из у в во на о об от до по за с со к ку и а но или' +
    ' скажи расскажи объясни покажи помоги реши дай можно нужно надо хочу знаю понял понятно' +
    ' урок тема задача пример вопрос ответ учитель ученик класс книга учебник параграф' +
    ' вода воздух соль сахар огонь газ жидкость металл раствор опыт масса объем объём' +
    ' what why how when where which who is are was were the a an and or but not for with without' +
    ' this that these those can could do does did have has had will would should please tell explain' +
    ' show help solve give me you it they them his her their about into from between under over' +
    ' nima nega qanday qachon qayerda qaysi kim va yoki lekin ammo bu shu ular biz siz men sen' +
    ' bor yoq yoʻq kerak mumkin ayt tushuntir koʻrsat yordam ber savol javob dars mavzu misol' +
    ' suv havo tuz shakar olov gaz suyuqlik metall eritma tajriba massa hajm'
  ).split(/\s+/),
)

/** Названия и символы элементов — любой из них означает, что вопрос настоящий. */
const ELEMENT_WORDS = new Set<string>()
for (const el of ELEMENTS) {
  ELEMENT_WORDS.add(el.symbol.toLowerCase())
  const ru = (el as { nameRu?: string }).nameRu
  if (ru) ELEMENT_WORDS.add(ru.toLowerCase())
}

/** Школьные основы: если основа встретилась, это вопрос по химии, а не шум. */
const CHEM_STEMS = [
  'хими', 'атом', 'молекул', 'ион', 'элемент', 'веществ', 'реакц', 'формул', 'валент', 'оксид',
  'кислот', 'основан', 'соль', 'сол', 'раствор', 'масс', 'моль', 'связ', 'заряд', 'электрон',
  'протон', 'нейтрон', 'ядр', 'катализ', 'плотн', 'кристалл', 'металл', 'газ', 'жидк', 'тверд',
  'chem', 'atom', 'molecul', 'ion', 'element', 'substanc', 'react', 'formul', 'valen', 'oxid',
  'acid', 'base', 'salt', 'solut', 'mass', 'mole', 'bond', 'charg', 'electron', 'proton',
  'neutron', 'nucle', 'catalys', 'dens', 'crystal', 'metal', 'gas', 'liquid', 'solid',
  'kimyo', 'modda', 'reaksiya', 'zichlik', 'zaryad', 'birikma', 'eritma', 'valentlik', 'oksid',
  'kislota', 'asos', 'tuz', 'bogʻ', 'bog', 'elektron', 'katalizator', 'suyuq', 'qattiq',
]

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}ʼ'‘’]{2,}/gu) ?? []).map((t) => t.replace(/^['‘’ʼ]+|['‘’ʼ]+$/g, ''))
}

/** Самый длинный ряд согласных подряд (ь/ъ/й и апострофы ряд не рвут и не удлиняют). */
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

/** Согласных подряд в самом конце слова: «олдж» — так русские слова не кончаются. */
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

/** Токен целиком лежит на одном ряду клавиатуры («фыва», «олдж», «asdf»). */
function keyboardMash(token: string): boolean {
  if (token.length < 4) return false
  return KEYBOARD_ROWS.some((row) => [...token].every((ch) => row.includes(ch)))
}

/** Токен опознан словарём: элемент, химическая основа или частотное слово языка. */
export function knownToken(token: string): boolean {
  if (COMMON_WORDS.has(token)) return true
  if (ELEMENT_WORDS.has(token)) return true
  return CHEM_STEMS.some((stem) => token.startsWith(stem) || (stem.length >= 5 && stem.startsWith(token) && token.length >= 4))
}

/** Один токен не похож на слово ни одного из трёх языков. */
export function nonWordToken(token: string): boolean {
  if (knownToken(token)) return false
  if (!VOWEL_RE.test(token)) return true
  if (maxConsonantRun(token) >= 4) return true
  if (tailConsonants(token) >= 3) return true
  return keyboardMash(token)
}

/**
 * Вердикт «это не вопрос, а набор букв».
 * Осторожный: нужен короткий ввод, отсутствие знакомых слов и большинство «не слов».
 */
export function looksLikeGibberish(text: string): boolean {
  const clean = text.trim()
  if (!clean || clean.length > 80) return false
  // Цифры и формулы — признак настоящего вопроса («Сколько граммов в 2 молях?»).
  if (/\d/.test(clean)) return false
  const tokens = tokenize(clean)
  if (tokens.length === 0 || tokens.length > 8) return false
  if (tokens.some(knownToken)) return false
  const bad = tokens.filter(nonWordToken).length
  // Один токен — нужен явный мусор; несколько — достаточно большинства.
  return tokens.length === 1 ? bad === 1 && tokens[0]!.length >= 3 : bad / tokens.length >= 0.6
}
