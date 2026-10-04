/**
 * Быстрый ответ «об учёном» без поиска по базе: «кто такой Бутлеров», «расскажи о Менделееве»,
 * «что открыл Лавуазье», «who was Dalton», «Mendeleyev haqida».
 *
 * Фамилия ищется по стеммам (падежи: «о Менделееве», «Ломоносова») и по латинице с вариантами
 * транслитерации (Mendeleev / Mendeleyev). Нужен «человеческий» сигнал (кто такой / расскажи о / что открыл …)
 * либо реплика из одной-двух слов-фамилий; «закон Авогадро», «таблица Менделеева», «число Авогадро»
 * без такого сигнала — вопрос о законе, а не о человеке → null (ответит база знаний).
 *
 * Текст — только из записи learnScientistsKnowledge (ничего не выдумываем), 3–5 предложений,
 * через speakLikeHuman(kind 'encyclopedia'), подпись «[ATOMLAB — учёные]».
 * Модуль самодостаточен: большая энциклопедия (type 'encyclopedia') параллельного агента не требуется.
 */
import { stemRussian } from '../../kb/stemRu'
import { SCIENTIST_DISPLAY_NAME, SCIENTIST_ENTRIES, type ScientistEntry } from '../../knowledge/learnScientistsKnowledge'
import { speakLikeHuman, splitVoiceSentences, type VoiceLang } from './personaVoice'

export const SCIENTIST_SIGNATURE = '[ATOMLAB — учёные]'

export interface ScientistTalk {
  text: string
  ids: string[]
}

/* ------------------------------------------------------------ индекс имён */

const CYR_STOP = new Set(
  [
    'закон', 'период', 'периодическ', 'таблиц', 'теори', 'атомн', 'ядр', 'числ', 'правил', 'модел', 'орбит', 'моль', 'ион', 'радиоактивн', 'полоний',
    'радий', 'электролит', 'диссоциац', 'строен', 'органическ', 'сохранен', 'масс', 'кислород', 'назвал', 'нобелевск', 'преми', 'динамит', 'бензол',
    'уголь', 'активированн', 'горелк', 'синтез', 'аммиак', 'мочевин', 'протон', 'нейтрон', 'электрон', 'ядерн', 'веществ', 'хими', 'учён', 'открыл',
    'вклад', 'реакци', 'уравнен', 'постоянн', 'принцип', 'равновеси', 'катализ', 'каучук', 'цепн', 'изотоп', 'спектр', 'газ', 'благородн', 'инертн',
    'полимер', 'нейлон', 'пластмасс', 'пенициллин', 'витамин', 'сахар', 'брожен', 'пастеризац', 'алкалоид', 'хроматографи', 'кислот', 'основани',
    'связь', 'ковалентн', 'координацион', 'сода', 'вулканизац', 'резин', 'рентген', 'днк', 'дифракци', 'мономер', 'макромолекул', 'термохими',
  ].map((w) => stemRussian(w)),
)
const LAT_STOP = new Set([
  'law', 'periodic', 'table', 'theory', 'atomic', 'nucleus', 'number', 'rule', 'model', 'orbit', 'process', 'synthesis', 'reaction', 'acid', 'gas',
  'radioactivity', 'mass', 'conservation', 'dissociation', 'electrolytic', 'structure', 'organic', 'element', 'equation', 'constant', 'principle',
  'scientist', 'chemist', 'discovery', 'bond', 'the', 'and', 'niels', 'marie', 'john', 'robert', 'joseph', 'ibn', 'al', 'ar', 'prize', 'nobel', 'free',
  'energy', 'rubber', 'chain', 'noble', 'gases', 'isotopes', 'polymer', 'nylon', 'plastic', 'penicillin', 'sugar', 'fission', 'pile', 'battery', 'soda',
  'chromatography', 'projection', 'dna', 'alkaloids', 'burner', 'ammonia', 'urea', 'benzene', 'dynamite', 'coal',
])

/** Латиница без вариантов транслитерации: Mendeleyev → mendelev, Lomonossov → lomonosov, Kekulé → kekule. */
export function foldLatinName(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ʼ'’`]/g, '')
    .replace(/ye/g, 'e')
    .replace(/yo/g, 'o')
    .replace(/kh/g, 'h')
    .replace(/ou/g, 'u')
    .replace(/ck/g, 'k')
    .replace(/w/g, 'v')
    .replace(/(.)\1+/g, '$1')
}

const isCyr = (w: string) => /^[\p{Script=Cyrillic}ʼ'’-]+$/u.test(w)
const isLat = (w: string) => /^[A-Za-zÀ-ɏ'’ʼ-]+$/u.test(w)

interface NameIndex {
  cyr: Map<string, Set<string>>
  lat: Map<string, Set<string>>
}

let index: NameIndex | null = null

function add(map: Map<string, Set<string>>, key: string, id: string): void {
  if (!key) return
  const set = map.get(key) ?? new Set<string>()
  set.add(id)
  map.set(key, set)
}

/** Стеммы падежных форм фамилии: «Менделеев» → менделе; «Менделеева/Менделееве» → менделеев (стеммер режет по-разному). */
function cyrForms(word: string): string[] {
  const base = word.replace(/ё/g, 'е')
  const forms = [base, `${base}а`, `${base}у`, `${base}ом`, `${base}е`, `${base}ым`, `${base}ой`, `${base}ую`, `${base}ы`, `${base}я`, `${base}ю`, `${base}ем`, `${base}и`]
  return [...new Set(forms.map((f) => stemRussian(f)))]
}

function addCyr(map: Map<string, Set<string>>, word: string, id: string): void {
  for (const st of cyrForms(word)) if (st.length >= 3 && !CYR_STOP.has(st)) add(map, st, id)
}

/** Ключевое слово «Имя Фамилия» (оба слова — не термины): индексируем только фамилию. */
function isPersonPair(kw: string): boolean {
  const parts = kw.toLowerCase().split(/\s+/)
  return parts.length === 2 && parts.every((p) => (isCyr(p) ? !CYR_STOP.has(stemRussian(p)) : !LAT_STOP.has(p))) && !/^(ибн|ibn|ван|van|ле|de|al|аль|ар)$/.test(parts[0]!)
}

function buildIndex(): NameIndex {
  const cyr = new Map<string, Set<string>>()
  const lat = new Map<string, Set<string>>()
  for (const e of SCIENTIST_ENTRIES) {
    const display = SCIENTIST_DISPLAY_NAME[e.id] ?? ''
    // Только фамилия (последнее слово имени; в скобках — латинский вариант): «Николай Коперник» ≠ «Николай Зинин».
    const surnameWords = display
      .split(/[()]/)
      .map((part) => part.trim().split(/\s+/).filter((w) => w.length >= 3 && !/\./.test(w)).pop())
      .filter((w): w is string => Boolean(w))
    for (const w of surnameWords) {
      const low = w.toLowerCase()
      if (isCyr(low)) {
        addCyr(cyr, low, e.id)
      } else if (isLat(low)) {
        const f = foldLatinName(low)
        if (f.length >= 4 && !LAT_STOP.has(low)) add(lat, f, e.id)
      }
    }
    for (const kw of e.keywords) {
      const parts = kw.toLowerCase().split(/\s+/)
      if (parts.length > 2) continue
      // «нильс бор», «мария кюри», «отто ган» — имя не индексируем, только фамилию (второе слово)
      for (const p of parts.length === 2 && isPersonPair(kw) ? parts.slice(1) : parts) {
        if (isCyr(p)) {
          if (!CYR_STOP.has(stemRussian(p))) addCyr(cyr, p, e.id)
        } else if (isLat(p)) {
          if (LAT_STOP.has(p)) continue
          const f = foldLatinName(p)
          if (f.length >= 4) add(lat, f, e.id)
        }
      }
    }
  }
  // Короткий стемм «бор» (Нильс Бор) совпадает с элементом бором: оставляем, но только при личном сигнале (см. ниже).
  return { cyr, lat }
}

function getIndex(): NameIndex {
  if (!index) index = buildIndex()
  return index
}

/* ------------------------------------------------------------ распознавание */

const PERSON_CUE =
  /(кто\s+так\p{L}*|кто\s+(это|был|была|такие)|расскажи\s+(мне\s+)?(о|об|про)(?!\p{L})|(о|об|про)\s+(учён|химик)|что\s+(открыл|сделал|изучал|создал|доказал|предложил|изобрёл|изобрел|внёс|внес)|чем\s+(извест|знаменит|прославил)|вклад|биограф|заслуг|годы\s+жизни|когда\s+(родил|жил|умер)|учён\p{L}*|химик\p{L}*|физик\p{L}*|who\s+(was|is|were)\b|tell\s+(me\s+)?about|what\s+did\s+\p{L}+\s+(discover|do|invent|create|find)|famous\s+for|biography|scientist|contribution|discoverer|haqida|kim\s+(edi|boʻlgan|bo'lgan|u|bu)|\bkim\b|nima\s+(kashf|qildi|yaratdi|ochdi)|hissasi|\bolim\p{L}*)/iu

/** Перед фамилией стоит «закон/число/таблица/правило …» — вопрос о понятии, а не о человеке. */
const THING_BEFORE =
  /(закон|числ|правил|таблиц|принцип|уравнен|модел|опыт|реакци|теори|постоянн|формул|проекци|реактив|горелк|метод|процесс|синтез|элемент|преми|law|number|constant|rule|table|principle|equation|model|experiment|reaction|theory|process|method|projection|element|qonun|son|qoida|jadval|tenglama|nazariya|usul|element)\p{L}*\s*$/iu

const THING_AFTER = /^\s+(jadvali|qonuni|soni|qoidasi|davriy|tenglamasi|nazariyasi|modeli|usuli|prinsipi|doimiysi)\b/iu

function tokens(text: string): { raw: string; start: number }[] {
  const out: { raw: string; start: number }[] = []
  const re = /[\p{L}'’ʼ-]+/gu
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) out.push({ raw: m[0], start: m.index })
  return out
}

/** Найти учёных, о которых спрашивают (с учётом падежей и транслитерации). Пусто — если речь о законе/таблице. */
export function findScientists(text: string): ScientistEntry[] {
  const idx = getIndex()
  const t = text.trim()
  if (!t || t.length > 300) return []
  const toks = tokens(t)
  if (!toks.length) return []
  const hasCue = PERSON_CUE.test(t)
  const found = new Map<string, number>()
  for (const tok of toks) {
    const low = tok.raw.toLowerCase().replace(/^[-'’ʼ]+|[-'’ʼ]+$/g, '')
    if (low.length < 3) continue
    let ids: Set<string> | undefined
    if (isCyr(low)) {
      ids = idx.cyr.get(stemRussian(low))
    } else if (isLat(low)) {
      const f = foldLatinName(low)
      ids = idx.lat.get(f)
      if (!ids && f.length >= 6) {
        for (const [k, v] of idx.lat) if (Math.abs(k.length - f.length) <= 1 && editDistance(k, f) <= 1) ids = v
      }
    }
    if (!ids || ids.size !== 1) continue
    const before = t.slice(0, tok.start)
    if (THING_BEFORE.test(before)) continue
    // Узбекский порядок: «Mendeleyev jadvali», «Avogadro soni» — понятие, не человек.
    const after = t.slice(tok.start + tok.raw.length)
    if (THING_AFTER.test(after)) continue
    const id = [...ids][0]!
    found.set(id, (found.get(id) ?? 0) + 1)
  }
  if (!found.size) return []
  // Без личного сигнала: только «голая» фамилия (1–2 слова) — ученик просто назвал имя.
  if (!hasCue) {
    const wordCount = toks.length
    if (wordCount > 2) return []
    // «бор» без сигнала — элемент, не Нильс Бор.
    if (found.has('bohr') && wordCount === 1) return []
  }
  return SCIENTIST_ENTRIES.filter((e) => found.has(e.id)).slice(0, 2)
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i)
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0]!
    dp[0] = j
    for (let i = 1; i <= a.length; i++) {
      const cur = dp[i]!
      dp[i] = Math.min(dp[i]! + 1, dp[i - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = cur
    }
  }
  return dp[a.length]!
}

/* ------------------------------------------------------------ ответ */

function entryText(e: ScientistEntry, lang: VoiceLang): string {
  if (lang === 'ru') return e.ru
  if (lang === 'uz') return e.uz ?? e.en ?? e.ru
  return e.en ?? e.ru
}

/**
 * Ответ об учёном (3–5 предложений из записи) или null, если реплика не о человеке.
 */
export function scientistTalk(text: string, lang: VoiceLang, seed = 0): ScientistTalk | null {
  const entries = findScientists(text)
  if (!entries.length) return null
  const perEntry = entries.length > 1 ? 2 : 5
  const body = entries
    .map((e) => splitVoiceSentences(entryText(e, lang)).filter(Boolean).slice(0, perEntry).join(' '))
    .join('\n\n')
  const voiced = speakLikeHuman(`${body}\n\n${SCIENTIST_SIGNATURE}`, {
    lang,
    kind: 'encyclopedia',
    intent: 'scientist',
    seed,
    query: text,
  })
  return { text: voiced, ids: entries.map((e) => e.id) }
}
