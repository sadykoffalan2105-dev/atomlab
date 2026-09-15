/**
 * Локальный «учитель без LLM»: из найденных фрагментов базы знаний собирает
 * живой устный ответ — прямой ответ (1–2 фразы) → короткое объяснение →
 * пример (формула/реакция, если есть) → один вопрос на проверку.
 *
 * Правило: НИЧЕГО не выдумывать. Все фактические фразы — из найденного текста
 * (допускается только чистка разметки, мягкая обрезка и перестановка
 * «A называются B» → «B — это A»). Если в найденном нет ответа на вопрос —
 * честно говорим об этом и предлагаем близкую тему. Чистый модуль (без DOM).
 *
 * Как выбирается ответ:
 *   • тип вопроса (определение / почему / как / пример / сравнение / расчёт) задаёт первую фразу:
 *     «X — это …», причина («потому что», «благодаря» …), способ/уравнение, пример с формулой, оба термина;
 *   • фразы оцениваются по совпадению с понятиями вопроса (строгие основы слов + синонимы) и с
 *     выбранным определением; чужие определения, «шапки» и итоги других параграфов отбрасываются;
 *   • почти одинаковые фразы (Жаккар по основам ≥ 0.55) и повторные определения термина не повторяются;
 *   • en/uz: сначала фразы на языке ученика (тесты/глоссарий из базы — hits type 'i18n'), затем цитата из
 *     русского учебника с пометкой «(in Russian)»; без таких фраз — ключевые термины из глоссария
 *     (hit type 'glossary') + цитата. Русский «нет ответа» на английский вопрос не отдаём.
 */
import { countWords } from '../voice/sentenceStream'
import { sameUtterance } from '../voice/echoFilter'
import { repairLayout } from '../../kb/layoutRepair'
import { contentStems, foldText, stemsMatch, strictStem, tokenizeWords, wordHasStem, QUESTION_STOPWORDS, type StemLang } from './textStems'

export interface KnowledgeHitLike {
  title: string
  text: string
  source?: string
  /** Тип фрагмента базы знаний: definition / card / faq / summary / textbook / i18n / glossary … */
  type?: string
  /** «[Kimyo 8, §2, стр. 10]» — для подписи цитаты в ответах en/uz. */
  citation?: string
  /** Оценка поиска; 0 — фрагмент добавлен к результатам (соседний фрагмент, определение из другого §). */
  score?: number
}

export interface ComposeStyle {
  /** brief ≈ 60 слов для голоса; more ≈ 140 слов («подробнее»). */
  detail?: 'brief' | 'more'
  simpler?: boolean
  wantExample?: boolean
  wantWhy?: boolean
  /** Режим «помощник»: наводим, не выдаём готовое решение. */
  helper?: boolean
  maxWords?: number
  /** Не добавлять вопрос на проверку. */
  noCheckQuestion?: boolean
  /** Чат урока (текст) или живой голос: голосом короче (1 поясняющая фраза), в чате — до 2. */
  channel?: 'chat' | 'voice'
  /**
   * Реплика продолжает прошлый вопрос («приведи пример», «а почему?», «подробнее» без своей темы): фразы
   * обычного ответа на этот вопрос уже прозвучали — не повторяем их.
   */
  continuation?: boolean
}

export interface ComposeInput {
  query: string
  hits: readonly KnowledgeHitLike[]
  lang: StemLang
  style?: ComposeStyle
  /** Тема урока — для честного «давай вернёмся к теме…». */
  topicHint?: string
  /** Детерминированная вариативность формулировок. */
  seed?: number
  /** Предложить подключить умный ИИ, если ответа нет. */
  suggestSmartAi?: boolean
  /** Диагностика (скрипты качества): ранжированные фразы-кандидаты. */
  debug?: (candidates: readonly unknown[]) => void
}

export interface ComposedAnswer {
  text: string
  sentences: string[]
  confident: boolean
  usedTitles: string[]
  keyTerm: string | null
}

export type QuestionKind = 'definition' | 'why' | 'how' | 'example' | 'compare' | 'calc' | 'general'

type Candidate = {
  text: string
  hitIndex: number
  /** Порядковый номер фразы внутри фрагмента (соседняя фраза — продолжение мысли). */
  pos: number
  title: string
  hitType: string
  /** Из добавленного фрагмента (score 0): годится как прямой ответ, но не как пояснение к ответу из урока. */
  extra: boolean
  overlap: number
  /** Совпавшие специфичные (не общие) понятия вопроса. */
  specific: number
  keyAll: boolean
  keyInHead: boolean
  definitional: boolean
  definesKey: boolean
  /** Про другое условие («в промышленности» на вопрос «в лаборатории», расплав вместо раствора). */
  offCondition: boolean
  /** Заголовок фрагмента содержит термин вопроса (карточка «Кислород», параграф «Хлороводород»). */
  titleKey: boolean
  /** Подлежащее определения — ровно термин вопроса («Оксиды — …», а не «Амфотерные оксиды — …»). */
  exactKey: boolean
  /** Определение другого термина («IUPAC номенклатура – это …» на вопрос о химии). */
  definesOther: boolean
  /** Для сравнения: индекс определяемого термина. */
  definesTerm: number
  causal: boolean
  method: boolean
  classify: boolean
  example: boolean
  formulas: number
  imprecise: boolean
  /** «Окисление — рост степени окисления» на вопрос о степени окисления: определение другого (родственного) термина. */
  subjectOther: boolean
  /** «[Kimyo 8, §20, стр. 85]» фрагмента — чтобы пояснения к определению брать из того же параграфа. */
  citation: string
  stems: string[]
  score: number
}

const JUNK_RE =
  /Тема школьной программы|Путает близкие термины|Заучивает без понимания|В данном § такой информации нет|неверная формулировка по учебнику|Так описывается другое явление|Program \(FGOS\)|Content tier in app|Slide excerpt|^\s*Current slide|Изучаемые понятия|Элементы ЗУН|Типичная ошибка|Исправь мягко|Чек-лист|^\s*(Пример|Задача|Решение|Дано|Ответ)\s*\d*[.:]|(Выведите|Определите|Найдите|Найти|Охарактеризуйте|Опишите|Назовите|Перечислите|Рассмотрите|Вычислите|Рассчитайте|Составьте|Напишите уравнени|Сколько граммов|Какой объ[её]м|самостоятельн)|(^|\s)(Find|Calculate|Determine)\s|^\s*(Рис|Таблица)\.?\s*\d/i

/** Известные неточные формулировки (итоговые карточки): «Смесь – вещество, …» — смесь не одно вещество. */
const IMPRECISE_RE = /^Смесь\s*[–—-]\s*вещество/iu

const MOJIBAKE_RE = /[À-ÿ]/g

const DEFINITION_RE =
  /(\s—\s|\s–\s|\sэто\s|называ(ют|ется|ются)|явля(ется|ются)|представля(ет|ют) собой|\sизуча(ет|ют)\s|наука о\s|\bis an?\b|\bare\b|refers to|is called|is the (science|study) of|\sstud(y|ies)\s|deb ataladi|deyiladi|hisoblanadi|o['‘’]rganadi|\sbu\s)/i
/** Связка «термин ↔ определение» (позиция нужна, чтобы проверить подлежащее). */
const COPULA_RE =
  /\s[—–-]\s|\sэто\s|\sявля(?:ется|ются)\s|\sпредставля(?:ет|ют) собой|\sизуча(?:ет|ют)\s|\s(?:is|are) (?:an?|the)?\s?|\srefers to|\sstud(?:y|ies)\s|\so['‘’]rganadi|\sbu\s/iu
/** Служебные подписи карточек базы знаний: «Основные понятия: …», «Вывод: …». */
const LEAD_LABEL_RE = /(^|\n)\s*(Основные понятия|Вывод|Значение|Главное|Запомни|Key (?:points|ideas)|Conclusion|Asosiy tushunchalar|Xulosa)\s*:\s*/gi
const CAUSAL_RE =
  /(потому что|так как|поэтому|благодаря|из-за|вследствие|по причине|приводит к|объясня(ет|ют)ся|обусловл|позволя|в результате|под воздействием|причин|because|since|therefore|due to|so that|chunki|sababli|shuning uchun|tufayli)/i
const METHOD_RE =
  /(получа|получени|способ|метод|образовани|равн[аоы] сумме|складыва|отношени[ея] масс|действием|воздейств|нагрева|разложени|при электролизе|на катоде|на аноде|выделя|образует|влия|завис|увеличива|уменьша|возраста|смеща|повышени|понижени|защит|покрыт|устран|кипячен|→|=|produce|obtain|prepare|heating|olinadi|hosil)/i
const CLASSIFY_RE = /(дел(ят|ит)ся на|подраздел|различают|бывают|классифиц|по (их )?(химическим )?свойствам|групп|типа|вида|are divided|types of|turlari|bo['‘’]linadi)/i
const CONTRAST_WORDS_RE = /(в отличие|тогда как|отлича|а у |однако|whereas|unlike|while|farqli)/i
const EXAMPLE_RE = /(например|к примеру|пример[:\s]|такие как|for example|for instance|e\.g\.|such as|examples? of|masalan|misol uchun|misollar)/i
const REACTION_RE = /(→|⇌|=\s*[A-Z]|\+\s*[A-Z][a-z]?[₀-₉0-9]*)/
const FORMULA_TOKEN_RE = /\b[A-Z][a-z]?[₀-₉0-9]*(?:\([A-Za-z0-9]+\)[₀-₉0-9]*)?(?:[A-Z][a-z]?[₀-₉0-9]*)+\b|\b[A-Z][a-z]?[₀-₉0-9]+\b/g

/** Родовое понятие определения: «сложные вещества», «процесс», «сплав», «способность атома» … */
const CLASS_NOUN_RE =
  /(вещест|соединени|эфир|смес|процесс|реакци|частиц|атом|ион|молекул|свойств|способност|наук|разрушени|распад|взаимодейств|величин|число|сплав|материал|связь|углеводород|разновидност|substance|compound|process|atoms?|modda|jarayon)/iu

const WHAT_IS_RE =/что так(ое|ая|ой|ие)|что значит|что называ|what (is|are)\b|\bnima\b|degani nima/i
const COMPARE_RE = /отлича|отличи[ея]|разниц|сравн|какие бывают|какие (есть )?(виды|типы)|виды |типы |классифик|difference|differ|compare|farq/i
const CALC_RE = /рассчита|вычисл|сколько|calculate|how (much|many)|hisobla|qancha/i
const HOW_RE = /^(как|каким образом)\s|способ|получа|получить|что происходит|от чего завис|как влия|^когда\s|^how\s|qanday/i

/** Слишком общие для «темы» слова (не делают фразу относящейся к вопросу). */
const GENERIC_STEMS = [
  'вещест', 'химическ', 'химич', 'реакци', 'элемент', 'свойств', 'соединен', 'образ', 'явля', 'называ', 'котор',
  'также', 'можно', 'други', 'один', 'одно', 'такж', 'част', 'основн', 'получа', 'использ', 'имеет', 'будет',
  'substan', 'chemic', 'reaction', 'element', 'propert', 'compound', 'modda', 'kimyo', 'reaksiya',
]
const isGenericStem = (stem: string) => GENERIC_STEMS.some((g) => stem.startsWith(g) || (stem.length >= 5 && g.startsWith(stem)))

/** Общие слова вопроса, по которым нельзя предлагать «близкую тему» («правило», «закон», «тип»). */
const SUGGEST_STOP_RE = /^(правил|закон|тип|вид|свойств|способ|пример|процесс|явлени|устро|работ)/u
/** Явно не химия: спорт, кино, музыка, политика (и нет понятий вопроса в найденном). */
const OFF_DOMAIN_RE = /(футбол|хоккей|чемпионат|матч|олимпиад|фильм|сериал|музык|песн|певец|певиц|актер|актрис|президент|выбор|столиц|погод|кто выиграл)/u

/** Наречия/служебные слова вопроса, не несущие темы. */
const QUESTION_FILLER = new Set([
  'хорошо', 'плохо', 'лучше', 'хуже', 'быстро', 'медленно', 'легко', 'сильно', 'слабо', 'часто', 'обычно', 'всегда',
  'никогда', 'более', 'менее', 'нужно', 'устроен', 'устроена', 'устроено', 'устроены', 'работает', 'работают',
  'выглядит', 'бывают', 'зависит', 'влияет', 'отличаются', 'отличается', 'чтобы', 'нужен', 'нужна', 'well', 'good',
  'do', 'does', 'why', 'yaxshi',
  // единицы в условиях задач
  'мир', 'мира', 'мире', 'миру', 'год', 'году', 'года', 'лет', 'всего', 'люди', 'людей',
  'грамм', 'граммов', 'грамма', 'моль', 'молей', 'литр', 'литров', 'литра', 'кг', 'мл', 'gram', 'grams', 'mol',
])

/** Синонимы школьных названий: концепт вопроса ↔ формы в учебнике. */
const SYNONYMS: Array<[string, string[][]]> = [
  ['хлороводород', [['хлорид', 'водород'], ['hcl']]],
  ['поварен', [['хлорид', 'натри'], ['nacl']]],
  ['nacl', [['хлорид', 'натри'], ['поварен']]],
  ['углекисл', [['оксид', 'углерод'], ['co2']]],
  ['щелоч', [['гидроксид'], ['щелоч']]],
  ['алкан', [['предельн', 'углеводород'], ['парафин']]],
  ['алкен', [['этиленов', 'углеводород']]],
  ['малоактив', [['инертн'], ['неактив']]],
  ['инертн', [['малоактив'], ['неактив']]],
  ['неактив', [['малоактив'], ['инертн']]],
]

/**
 * Родовое существительное, при котором вещество — лишь определение: «хлорид водорода», «оксид азота», «раствор аммиака»
 * (ru — перед термином в родительном падеже; en/uz — после термина: «hydrogen chloride», «vodorod xlorid»).
 */
const HEAD_NOUN_RU_RE = /^(хлорид|бромид|[ий]одид|фторид|оксид|гидроксид|пероксид|сульфид|сульфат|сульфит|нитрат|нитрит|нитрид|карбид|карбонат|фосфат|силикат|гидрид|ацетат|соединени|сол[иеья]$|солей|раствор)/u
const HEAD_NOUN_LAT_RE = /^(chlorides?|bromides?|iodides?|fluorides?|oxides?|dioxides?|hydroxides?|peroxides?|sulfides?|sulfates?|nitrates?|nitrides?|carbides?|carbonates?|phosphates?|compounds?|salts?|xlorid|oksid|gidroksid|sulfat|nitrat|karbonat|birikma)/u

/** Термин вопроса встречается только как определение к другому веществу («хлорид водорода» на «как получают водород»). */
function keyOnlyAsModifier(raw: string, stem: string, lang: StemLang): boolean {
  const words = tokenizeWords(raw)
  let seen = 0
  for (let i = 0; i < words.length; i++) {
    if (!wordHasStem(words[i]!, stem)) continue
    seen++
    const modifier = lang === 'ru' ? HEAD_NOUN_RU_RE.test(words[i - 1] ?? '') : HEAD_NOUN_LAT_RE.test(words[i + 1] ?? '')
    if (!modifier) return false
  }
  return seen > 0
}

/** Взаимоисключающие условия: вопрос про раствор — фраза про расплав не подходит. */
const CONTRAST_PAIRS: Array<[string, string]> = [
  ['раствор', 'расплав'],
  ['расплав', 'раствор'],
  ['лаборатор', 'промышлен'],
  ['промышлен', 'лаборатор'],
]

const SMALL_RU = /^(и|в|во|на|с|со|к|ко|о|об|у|по|за|из|от|до|не|ни|же|ли|а|но|то|их|её|ее|он|мы|вы|ей|им|ею|т|е|д|п)$/i

/** Короткая строка без глагола, связки, формулы и знаков «—», «=» — заголовок, а не утверждение. */
function isHeadingLike(sentence: string): boolean {
  const bare = sentence.replace(/\([^)]*\)/g, ' ').replace(/[.!]\s*$/, '').trim()
  const words = bare.split(/\s+/).filter(Boolean)
  if (words.length === 0 || words.length > 9 || /[—–=→:]|\sэто\s|\d/u.test(bare)) return false
  return !words.some((w) => /(ет|ит|ут|ют|ят|ат|ется|ются|ится|ятся|ался|ился|ал|ил|ел|ла|ли|ло|ть|ся|ен|ены|ан|аны|ым|им|но|ны)$/iu.test(w.replace(/[,;]$/, '')) && !/ост[ьи]$|ст[ьи]$/iu.test(w.replace(/[,;.]$/, '')) && w.length > 3)
}

/** Есть ли личная форма глагола или краткое причастие («имеет», «образуется», «называют», «связаны»). */
function hasFiniteVerbRu(fragment: string): boolean {
  return fragment
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}-]/gu, '').toLowerCase())
    .some((w) => w.length > 3 && /(ет|ит|ут|ют|ят|ат|ется|ются|ится|ятся|ался|ился|ал|ил|ел|ла|ли|ло|ны|на|ен|ан)$/u.test(w) && !/(ост|ств|ени|ани|ция|ции|кат|лат|мат|рат|нат|тат|ит[ао]в)$/u.test(w.slice(-3)))
}

/** OCR-шум учебника: «осНовНые», «ме та л ло в», слипшиеся колонки. */
function looksLikeOcrNoise(sentence: string): boolean {
  if (/[а-яё][А-ЯЁ]/.test(sentence)) return true
  const tiny = sentence.split(/\s+/).filter((w) => /^[а-яё]{1,2}[.,]?$/i.test(w) && !SMALL_RU.test(w.replace(/[.,]$/, '')))
  return tiny.length >= 2
}

function hasRepeatedPairs(sentence: string): boolean {
  const w = sentence.split(/\s+/)
  const counts = new Map<string, number>()
  for (let i = 0; i + 1 < w.length; i++) {
    const k = `${w[i]} ${w[i + 1]}`.toLowerCase()
    const n = (counts.get(k) ?? 0) + 1
    counts.set(k, n)
    if (n >= 3) return true
  }
  return false
}

const SUBSCRIPT_DIGITS: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }

/** Атомы формулы «Ca(HCO3)2» → {Ca:1,H:2,C:2,O:6}; null — не формула. */
function atomCounts(formula: string): Map<string, number> | null {
  const f = formula.replace(/[₀-₉]/g, (d) => SUBSCRIPT_DIGITS[d]!).replace(/[↑↓]/g, '')
  if (!/^[A-Z][A-Za-z0-9()]*$/.test(f)) return null
  const stack: Array<Map<string, number>> = [new Map()]
  const re = /([A-Z][a-z]?)(\d*)|(\()|(\))(\d*)/g
  let consumed = 0
  for (let m = re.exec(f); m; m = re.exec(f)) {
    consumed += m[0].length
    const top = stack[stack.length - 1]!
    if (m[1]) top.set(m[1], (top.get(m[1]) ?? 0) + Number(m[2] || 1))
    else if (m[3]) stack.push(new Map())
    else if (m[4]) {
      const inner = stack.pop()
      const outer = stack[stack.length - 1]
      if (!inner || !outer) return null
      for (const [el, n] of inner) outer.set(el, (outer.get(el) ?? 0) + n * Number(m[5] || 1))
    }
  }
  return consumed === f.length && stack.length === 1 ? stack[0]! : null
}

/** Уравнение с ≥ 2 веществами с каждой стороны, где число атомов не сходится («2Al + HCl → AlCl3 + 3H2»). */
function hasUnbalancedEquation(sentence: string): boolean {
  const eq = sentence.match(/((?:\d*[A-Z][A-Za-z0-9()₀-₉]*\s*\+\s*)+\d*[A-Z][A-Za-z0-9()₀-₉]*)\s*(?:→|=|⇌)\s*((?:\d*[A-Z][A-Za-z0-9()₀-₉↑↓]*\s*\+\s*)+\d*[A-Z][A-Za-z0-9()₀-₉↑↓]*)/u)
  if (!eq) return false
  const side = (s: string): Map<string, number> | null => {
    const total = new Map<string, number>()
    for (const part of s.split('+').map((p) => p.trim())) {
      const m = part.match(/^(\d*)(.+)$/)
      const atoms = m ? atomCounts(m[2]!) : null
      if (!atoms) return null
      for (const [el, n] of atoms) total.set(el, (total.get(el) ?? 0) + n * Number(m![1] || 1))
    }
    return total
  }
  const left = side(eq[1]!)
  const right = side(eq[2]!)
  if (!left || !right) return false
  const els = new Set([...left.keys(), ...right.keys()])
  return [...els].some((el) => (left.get(el) ?? 0) !== (right.get(el) ?? 0))
}

/** Уравнение «A + B → C» (≥ 1 вещества с каждой стороны) разобрано и сбалансировано по атомам. */
function isBalancedEquation(eq: string): boolean {
  const sides = eq.replace(/[↑↓]/gu, '').split(/\s*(?:→|=|⇌)\s*/u)
  if (sides.length !== 2) return false
  const side = (str: string): Map<string, number> | null => {
    const total = new Map<string, number>()
    for (const part of str.split('+').map((x) => x.trim().replace(/\s*[+-]?\s*Q$/u, ''))) {
      const m = part.match(/^(\d*)\s*(\S+)$/u)
      const atoms = m ? atomCounts(m[2]!) : null
      if (!atoms) return null
      for (const [el, n] of atoms) total.set(el, (total.get(el) ?? 0) + n * Number(m![1] || 1))
    }
    return total
  }
  const left = side(sides[0]!)
  const right = side(sides[1]!)
  if (!left || !right) return false
  return [...new Set([...left.keys(), ...right.keys()])].every((el) => (left.get(el) ?? 0) === (right.get(el) ?? 0))
}

/** «В лабораторных условиях азот получают … аммиака» на «как получают аммиак»: получают другое вещество. */
const OBTAIN_SKIP_RE =
  /^(в|во|на|из|при|с|со|и|а|но|же|путем|путём|лаборатори\S*|лабораторн\S*|промышленн\S*|услови\S*|обычно|также|можно|часто|основном|больш\S*|количеств\S*|небольш\S*|сейчас|современн\S*|чист\S*|техник\S*)$/u
function otherObtainedObject(raw: string, keyStems: readonly string[]): boolean {
  const words = tokenizeWords(raw)
  for (let i = 0; i < words.length; i++) {
    if (!/^получа(ют|ет|ется|ются)$/u.test(words[i]!)) continue
    let j = i - 1
    while (j >= 0 && OBTAIN_SKIP_RE.test(words[j]!)) j--
    let k = i + 1
    while (k < words.length && OBTAIN_SKIP_RE.test(words[k]!)) k++
    const near = [words[j], words[k]].filter((w): w is string => Boolean(w))
    if (near.some((w) => keyStems.some((st) => wordHasStem(w, st)) || /^(его|её|ее|их)$/u.test(w))) return false
    return near.some((w) => w.length >= 4 && !VERB_RU_RE.test(w))
  }
  return false
}

/** Инструкция лабораторной работы: инфинитив-указание, «Ход работы:» или дозировка каплями. */
const LAB_STEP_RE =
  /^Ход\s+работы|(?<!\p{L})(добавить|прилить|налить|поместить|нагреть|опустить|закрыть\s+пробк|перемешать|встряхнуть|пропустить\s+газ)(?!\p{L})|\d+\s*капл|в\s+пробирк\S*\s+(добав|прилив|налива|помещ)/iu

/** Число атомов углерода по названию («виниловый спирт» — 2, «пропан» — 3). */
const CARBON_PREFIXES: Array<[RegExp, number]> = [
  [/^(метил|метан|метанол|муравьин|формальдегид)/u, 1], [/^(этил|этан|этен|этилен|этин|ацетилен|винил|уксусн|ацетальдегид)/u, 2],
  [/^(пропил|пропан|пропен|пропилен|пропин|аллил|ацетон|глицерин)/u, 3], [/^(бутил|бутан|бутен|бутадиен|бутин)/u, 4],
  [/^(пентил|пентан|пентен)/u, 5], [/^(гексил|гексан|гексен|бензол|фенол|циклогексан)/u, 6],
]
/** «Виниловый спирт: CH2=CH–CH2–OH» — формула рядом с названием содержит другое число атомов углерода (опечатка учебника). */
function nameFormulaMismatch(sentence: string): boolean {
  const re = /(?<!\p{L})(\p{L}{4,})(?:ов\S*|\S*)\s*(?:спирт\S*|кислот\S*|альдегид\S*)?\s*[:(—–-]?\s*((?:C[A-Za-z0-9₀-₉]*)(?:\s*[=≡–—-]\s*[A-Z][A-Za-z0-9₀-₉]*)*)/gu
  for (const m of sentence.matchAll(re)) {
    const word = foldText(m[1]!)
    const n = CARBON_PREFIXES.find(([p]) => p.test(word))?.[1]
    if (!n) continue
    const formula = m[2]!.replace(/[₀-₉]/g, (d) => SUBSCRIPT_DIGITS[d]!)
    const carbons = [...formula.matchAll(/C(?![a-z])(\d*)/g)].reduce((acc, x) => acc + Number(x[1] || 1), 0)
    if (carbons > 0 && carbons !== n) return true
  }
  return false
}

/** Школьный класс вещества по формуле: оксид — два элемента, один из них O; кислота — начинается с H; основание — (OH). */
const NONMETALS = new Set(['C', 'N', 'P', 'S', 'Si', 'Cl', 'Br', 'I', 'Se', 'B', 'As'])
function formulaClassOk(query: string, text: string): boolean {
  const q = foldText(query)
  const formulas = (text.match(FORMULA_TOKEN_RE) ?? []).map((f) => ({ f, atoms: atomCounts(f) })).filter((x) => x.atoms)
  if (formulas.length === 0) return true
  const isOxide = (a: Map<string, number>) => a.size === 2 && a.has('O')
  if (/оксид|oxide|oksid/u.test(q)) {
    const oxides = formulas.filter((x) => isOxide(x.atoms!))
    if (oxides.length === 0 || oxides.length < formulas.length) return false
    const other = (a: Map<string, number>) => [...a.keys()].find((el) => el !== 'O')!
    if (/кислотн|acidic|kislotali/u.test(q)) return oxides.every((x) => NONMETALS.has(other(x.atoms!)) || ['Mn', 'Cr'].includes(other(x.atoms!)))
    if (/основн|basic|asosli/u.test(q)) return oxides.every((x) => !NONMETALS.has(other(x.atoms!)) && other(x.atoms!) !== 'H')
    return true
  }
  if (/кислот|acids?(?!\p{L})|kislota/u.test(q) && !/кислород|kislorod/u.test(q)) return formulas.some((x) => x.f.startsWith('H') && x.f !== 'H2O' && x.f !== 'H2O2' && !x.f.startsWith('He') && x.atoms!.size >= 2)
  if (/гидроксид|основани|hydroxide|bases?(?!\p{L})|asos/u.test(q)) return formulas.some((x) => /\(OH\)|OH$/u.test(x.f))
  return true
}

/**
 * Задачник и вёрстка, а не объяснение: указания ученику («Покажите…», «изобразите…»), данные задачи («x 112 л»,
 * «кислоте B», «[HCl]=0,7»), таблицы «|», ссылки на невидимый ученику текст («выше рассмотренных», «в этой
 * реакции»), «§ 23 …», обрыв «содержащий более.», объявление списка без самого списка, несбалансированное уравнение.
 */
function looksLikeTaskNoise(sentence: string): boolean {
  if (/(Покажите|Нарисуйте|Изобразите|изобразите|Обратите внимание|Проверьте|Сделайте вывод|Докажите|Заполните)/u.test(sentence)) return true
  if (/(^|[\s:])x\s+\d|\s[xX]\s*[+=→]|кислот[аеуыой]{1,2}\s+[A-DБВ]\b|\[[A-ZА-Я0-9,]{1,6}\]\s*[=-]|\d+[,.]\d+\s*g\s|\|/u.test(sentence)) return true
  if (/(^|[\s(])h\d|(^|\s)h\+/u.test(sentence)) return true
  if (/(выше\s?рассмотренн|рассмотренн\S*\s+выше|в этой реакции|данной реакции|этой реакции|этой модели|этой схеме|на рисунке|в таблице|§\s*\d)/iu.test(sentence)) return true
  if (/^(Эту|Этой|Этим)\s/u.test(sentence)) return true
  if (/\s(более|менее|больше|меньше)\s*[.;]?$/u.test(sentence.trim())) return true
  if (/((следующими|несколькими|такими)\s+(способами|методами|путями)|следующим образом)\.?$/u.test(sentence.trim())) return true
  return hasUnbalancedEquation(sentence)
}

/** Повторы токенов («1 моль 1 моль 1 моль»), OCR-формулы «СН, + О,», обрыв на сокращении «… т.». */
function looksBroken(sentence: string): boolean {
  if (hasRepeatedPairs(sentence)) return true
  if (/^\p{Lu}\p{Ll}+\s\p{Lu}\s\p{Ll}/u.test(sentence)) return true
  if (/[A-ZА-ЯЁ][a-zа-яё]?,\s*[+—=]/u.test(sentence)) return true
  if (/(^|\s)(т|др|см|рис|стр|напр)\.$/iu.test(sentence.trim())) return true
  if (/^(следовательно|поэтому|то есть|т\.\s?е\.|значит|итак|однако|также|здесь|тогда|отсюда|где)[\s,]/iu.test(sentence)) return true
  // «Но учитывая то, что давление не влияет …» — придаточное без главного предложения.
  if (/^(Но|А|И)\s+(учитывая|несмотря на)\s/u.test(sentence)) return true
  // «11 приводятся вещества, …» — номер таблицы/рисунка, оторванный от «В таблице».
  if (/^\d+\s+\p{Ll}/u.test(sentence)) return true
  // «При n<2 кислота считается слабой» — обозначение без объяснения, что это за величина.
  if (/(^|[\s(])[nxyk]\s*[<>≤≥]\s*\d/u.test(sentence)) return true
  if (/(^|\s)\d+\)\s|\d+\.\s+[а-яё]/u.test(sentence)) return true
  if (/[—–-]\s*\.?$/u.test(sentence.trim())) return true
  // Разрозненные буквы («С Н О, + О») — шум; обычные союзы/предлоги «и», «а», «в», «a» — нет.
  if (sentence.split(/\s+/).filter((w) => /^[\p{L}][.,]?$/u.test(w) && !/^[иавскоуяai]$/iu.test(w)).length >= 3) return true
  if (/\d+\s*-\s*Задача|Задача\s*\d|Упражнени/iu.test(sentence)) return true
  if (/\s[.,]\s|[a-zа-яё]\.\s*[a-zа-яё]{3,}\s[a-zа-яё]/u.test(sentence) && /[→=]|ē/u.test(sentence)) return true
  if (/[a-z]{1,2}\s\d[A-Z]/u.test(sentence)) return true
  if (looksLikeTaskNoise(sentence)) return true
  if (/(^|[\s:])(объясните|укажите|приведите|сравните|напишите|докажите|предложите|разделите|запишите|заполните|составьте|выпишите|проведите|explain|compare|write)\s/iu.test(sentence)) return true
  // Кириллица, смешанная с латиницей внутри слова («Ма’», «СГ-»), и незакрытые скобки — OCR-мусор уравнений.
  // Скобки — разделитель: «m(в-ва)» — нормальная запись, «E2Оп», «СГ-» — нет.
  if (/[а-яё][a-z]|[a-z][а-яё]/iu.test(sentence.replace(/[\d₀-₉⁺⁻+-]/g, ''))) return true
  if ((sentence.match(/\(/g) ?? []).length !== (sentence.match(/\)/g) ?? []).length) return true
  // Колонтитул страницы внутри фразы: «Важнейшим лабораторным Водород методом …».
  if (/[а-яё]{3,}(ым|ой|ый|ая|ое|ие|ых|им)\s[А-ЯЁ][а-яё]{3,}\s[а-яё]{3,}/u.test(sentence)) return true
  return false
}

/**
 * Нумерованный список учебника в одну фразу: «…выделяют в несколько групп:\n1. Основные оксиды: Na2O, BaO и др.\n2. …»
 * → «…выделяют в несколько групп: основные оксиды (Na2O, BaO), кислотные оксиды (CO2, SO3), …». Только перестановка текста.
 */
function mergeNumberedLists(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()
    // «…можно устранить следующими способами.\n1. Путем кипячения: …» — тоже вводная строка списка.
    const announce = /(следующими|такими|несколькими)\s+(способами|методами|путями)\.\s*$|следующим образом\.\s*$/u.test(line)
    const numbered = /^\s*1[.)]\s/.test(lines[i + 1] ?? '')
    // Список без номеров: «…от коррозии:\nСоздание защитного слоя.\nУменьшение активности …».
    const plainItem = (s: string | undefined) => !!s && /^\p{Lu}[^:]{3,90}\.$/u.test(s.trim()) && s.trim().split(/\s+/).length <= 10 && !/\d/.test(s)
    const plain = !numbered && /[:：]\s*$/.test(line) && plainItem(lines[i + 1]) && plainItem(lines[i + 2])
    if (!((/[:：]\s*$/.test(line) || announce) && numbered) && !plain) {
      out.push(lines[i]!)
      continue
    }
    const items: string[] = []
    let j = i + 1
    while (j < lines.length && items.length < 6) {
      const cur = lines[j]!.trim()
      if (numbered && /^\d+[.)]\s/.test(cur)) items.push(cur.replace(/^\d+[.)]\s*/, ''))
      else if (numbered && items.length && /[:：]\s*$/.test(items[items.length - 1]!) && cur.length < 60) items[items.length - 1] += ` ${cur}`
      else if (plain && plainItem(cur)) items.push(cur.replace(/\.$/, ''))
      else break
      j++
    }
    if (items.length < (announce ? 1 : 2)) {
      out.push(lines[i]!)
      continue
    }
    const parsed = items.map((it) => {
      const m = it.match(/^([^:()]{3,60}?)\s*(?:\([^)]*\))?\s*:\s*(.+)$/u)
      const name = (m ? m[1]! : it).trim().replace(/[.;,]+$/, '')
      const formulas = m ? m[2]!.replace(/\s*и\s+др\.?|\s*etc\.?/giu, '').replace(/[.;]+$/, '').trim() : ''
      return { name: name.charAt(0).toLowerCase() + name.slice(1), formulas }
    })
    const withFormulas = parsed.map((p) => (p.formulas && /[A-Z]/.test(p.formulas) ? `${p.name} (${p.formulas.split(/,\s*/).slice(0, 2).join(', ')})` : p.name))
    const intro = line.replace(/[:：.]\s*$/, '')
    const long = countWords(`${intro} ${withFormulas.join(' ')}`) > 30
    out.push(`${intro}: ${(long ? parsed.map((p) => p.name) : withFormulas).join(', ')}.`)
    // Пункты с формулами остаются отдельными строками — это готовые примеры («Основные оксиды: Na2O, BaO, CuO»).
    for (const p of parsed) if (p.formulas && /[A-Z]/.test(p.formulas)) out.push(`${p.name.charAt(0).toUpperCase()}${p.name.slice(1)}: ${p.formulas}.`)
    i = j - 1
  }
  return out.join('\n')
}

function cleanKnowledgeText(raw: string): string {
  return mergeNumberedLists(repairLayout(raw))
    .replace(LEAD_LABEL_RE, '$1')
    .replace(/\s*\((?:рис|табл|fig)\.?\s*\d+[^)]*\)/giu, '')
    .replace(/^\s*\[[^\]\n]{0,160}\]\s*$/gm, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\s)\*([^*\s][^*]*)\*/g, '$1$2')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[-•*·]\s+/gm, '')
    .replace(/\.{2,}/g, '.')
    .replace(/[ \t]+/g, ' ')
}

function splitCandidates(text: string): string[] {
  const out: string[] = []
  for (const line of cleanKnowledgeText(text).split(/\n+|\s•\s/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    // «Например, бутен-2 имеет цис- и транс-изомеры. плоскость π-связи цис-бутен-2 …» — подписи рисунка с маленькой
    // буквы без сказуемого после точки — не часть фразы.
    const parts = trimmed
      .split(/(?<=[.!?])\s+(?=[\p{Lu}\d«"(])/u)
      .map((p) => p.split(/(?<=[.!?])\s+(?=\p{Ll})/u).filter((frag, i) => i === 0 || hasFiniteVerbRu(frag)).join(' '))
    for (const p of parts) {
      const t = p.trim()
      // Заголовок списка/задания («Какие оксиды образуются при сжигании следующих веществ:») и обрывки «…» — не ответ.
      if (/[:：]$/.test(t) || /^…/.test(t)) continue
      // Хвост «, то есть E2Оп, где E – элемент …» после определения — обозначения, а не смысл.
      // «…увеличивается в 2—4 раза: t1 где t2 — скорость …» — хвост формулы без самой формулы.
      let s = t
        // «…с самой низкой — цезий, то есть 0,79.» — число без единицы и шкалы ученику ничего не говорит.
        .replace(/,\s*(?:то есть|т\.\s?е\.)\s+\d+(?:[,.]\d+)?\s*(?=[.;]?$)/u, '')
        // «путем кипячения (Ca(HCO3)2 → CaCO3 Mg(HCO3)2 → MgCO3)» — неполные уравнения в скобках: способ оставляем.
        .replace(/\s*\((?:[^()]|\([^()]*\))*→(?:[^()]|\([^()]*\))*\)/gu, (paren) => (hasUnbalancedEquation(paren.trim().slice(1, -1)) || (paren.match(/→/g) ?? []).length >= 2 ? '' : paren))
        .replace(/:\s*(?:\S+\s+){0,3}где\s.*$/u, '.').replace(/,\s*(?:то есть|т\.\s?е\.)\s+[^,]*,\s*где\s.*$/u, '.').replace(/,\s*где\s+\S+\s*[–—-]\s.*$/u, '.').replace(/[;,]\s*$/, '.')
      // «Таким образом, 1 моль газа …» — связка с невидимым учеником текстом; сам факт остаётся.
      const connective = /^(Таким образом|Итак|Следовательно|Значит|Как видно),\s+(?=\S)/u
      if (connective.test(s)) {
        s = s.replace(connective, '')
        s = s.replace(/^(\p{Ll})/u, (c) => (/^[a-zα-ω]{1,2}\s*[(=]|^pH/u.test(s) ? c : c.toUpperCase()))
      }
      // «… можно устранить следующими способами: путем кипячения.» — перечень из одного пункта.
      const leadIn = s.match(/^(.*?\S)\s*(?:следующими|несколькими|различными|разными|такими|двумя|тремя)\s+(?:способами|методами|путями)\s*:\s*([^:]+?)\.?$/u)
      if (leadIn && !/[,;]|\s(и|или)\s/u.test(leadIn[2]!)) {
        if (!/^(путем|путём|с помощью|при|методом|действием|из)\s/u.test(leadIn[2]!)) continue
        s = `${leadIn[1]} ${leadIn[2]}.`
      }
      if (s) out.push(s)
    }
  }
  return out
}

function letterStats(text: string): { letters: number; cyr: number; lat: number; mojibake: number } {
  let letters = 0
  let cyr = 0
  let lat = 0
  for (const ch of text) {
    if (/\p{L}/u.test(ch)) {
      letters++
      if (/[а-яё]/i.test(ch)) cyr++
      else if (/[a-z]/i.test(ch)) lat++
    }
  }
  const mojibake = (text.match(MOJIBAKE_RE) ?? []).length
  return { letters, cyr, lat, mojibake }
}

function acceptableForLang(sentence: string, lang: StemLang): boolean {
  const st = letterStats(sentence)
  if (st.letters < 12) return false
  if (st.mojibake / st.letters > 0.04) return false
  if (lang === 'ru') return st.cyr / st.letters >= 0.55
  return st.lat / st.letters >= 0.6
}

/** Фраза продолжает чужую мысль: местоимение/указание в начале («Она …», «Такой же процесс …»). */
const DEICTIC_START_RE = /^(На них|Они|Она|Оно|Он|Их|Его|Её|Ее|Эти|Этот|Эта|Это|Такие|Такой|Такая|Такое|Таким|Там|Данн\S+|При этом|В этом|Этим|Здесь|Тогда)\s/u
/** Висящая отсылка внутри фразы: «… определяется в сравнении с ним», «такой же процесс». */
const DANGLING_RE = /(?<!\p{L})(с ним|с ней|с ними|к нему|к ней|у него|у неё|от него|от неё|по сравнению с ним|такой же|таким же|такая же|такое же|то же самое|эт(?:ой|ого|их|ими)\s+\p{Ll}{3,})(?!\p{L})/iu
/** Условие, при котором верен пример соседней фразы, и ограничение следом («В обычных условиях … только»). */
const CONDITION_RE = /(при нагревании|при высокой температуре|при определ\S+ услови|в присутствии катализатор|при облучении)/iu
const RESTRICT_NEXT_RE = /^(Однако|Но|В обычных условиях|При обычных условиях|При комнатной температуре)[\s,]/u

/** Пример отвечает уточнению вопроса: «… образуется осадок» → ↓/осадок, «… выделяется газ» → ↑/газ, «… вода» → H2O. */
function qualifierOk(query: string, text: string): boolean {
  const q = foldText(query)
  if (/осад/u.test(q) && !/↓|осад|нераствор/iu.test(text)) return false
  if (/(?<!\p{L})газ(?!ообразн)/u.test(q) && !/↑|газ/iu.test(text)) return false
  if (/образу\S*\s+вод|(?<!\p{L})вод[аы]\s+образу/u.test(q) && !/H2O|H₂O|вод/u.test(text)) return false
  return true
}

/** Пример верен только при условии соседней фразы («При нагревании …» / «Однако в обычных условиях только …»). */
function conditionedExample(c: Candidate, cands: readonly Candidate[]): boolean {
  const prev = cands.find((x) => x.hitIndex === c.hitIndex && x.pos === c.pos - 1)
  const next = cands.find((x) => x.hitIndex === c.hitIndex && x.pos === c.pos + 1)
  if (next && (RESTRICT_NEXT_RE.test(next.text) || /(?<!\p{L})только(?!\p{L})/u.test(next.text) && /^(В|При)\s/u.test(next.text))) return !CONDITION_RE.test(c.text)
  if (prev && CONDITION_RE.test(prev.text) && !CONDITION_RE.test(c.text) && /^(Например|К примеру)/u.test(c.text)) return true
  return false
}

const FOLLOW_UP_WORDS =
  /^(подробнее|подробно|проще|попроще|пожалуйста|мне|про|о|об|ещё|еще|пример|примеры|приведи|приведите|more|about|please|simpler|batafsil|haqida)$/i

const VERB_RU_RE = /(ют|ут|ет|ит|ат|ят|ется|ются|ится|ятся|атся|ся|сь|ть|ти|ешь|ишь|ил|ал|ел|ла|ли|ло)$/
const ADJ_RU_RE = /(ый|ий|ой|ая|яя|ое|ее|ые|ие|ых|их|ого|его|ую|юю|ым|им|ыми|ими|ной|ного)$/

/** Смысловые слова вопроса (исходные формы, дефисные составные слова не делим). */
function questionWords(query: string): string[] {
  return query
    .split(/\s+/)
    .map((w) => foldText(w).replace(/[^\p{L}\p{N}'-]/gu, '').replace(/^-+|-+$/g, ''))
    .filter((w) => (w.length >= 3 || /\d/.test(w)) && !QUESTION_STOPWORDS.has(w) && !FOLLOW_UP_WORDS.test(w) && !QUESTION_FILLER.has(w))
}

/** Ключевой термин вопроса: «что такое X», «what is X», «X nima»; иначе первое предметное слово. */
export function extractKeyTerm(query: string, lang: StemLang): string | null {
  const q = query.trim().replace(/[?!.]+$/, '')
  const patterns: RegExp[] =
    lang === 'en'
      ? [/what (?:is|are) (?:an? |the )?(.+)$/i, /(?:explain|about|define) (?:an? |the )?(.+)$/i]
      : lang === 'uz'
        ? [/^(.+?) (?:nima|degani nima|nima degani)$/i, /^(.+?) haqida/i]
        : [
            /что так(?:ое|ая|ой|ие) (.+)$/i,
            /что значит (.+)$/i,
            /что называ\p{L}* (.+)$/iu,
            /(?:объясни|расскажи|поясни)(?:те)?(?: мне)?(?: подробнее| подробно| проще)?(?: про| о| об)? (.+)$/i,
            /пример(?:ы)? (.+)$/i,
          ]
  for (const re of patterns) {
    const m = q.match(re)
    if (m?.[1]) {
      const words = m[1]
        .split(/\s+/)
        .map((w) => w.replace(/[^\p{L}\p{N}₀-₉()-]/gu, ''))
        .filter((w) => w.length >= 2 && !FOLLOW_UP_WORDS.test(w))
      if (words.length > 0) return words.slice(0, 3).join(' ').toLowerCase()
    }
  }
  const words = questionWords(q).filter((w) => !/\d/.test(w))
  const topical = words.filter((w) => {
    const stem = strictStem(w)
    if (isGenericStem(stem)) return false
    if (lang === 'ru' && w.length > 4 && VERB_RU_RE.test(w) && !ADJ_RU_RE.test(w) && !/(ость|есть|ет$)/.test(w.slice(-4))) return false
    return true
  })
  const first = topical[0] ?? words.sort((a, b) => b.length - a.length)[0]
  if (!first) return null
  const idx = words.indexOf(first)
  const next = words[idx + 1]
  if (lang === 'ru' && ADJ_RU_RE.test(first) && next && !VERB_RU_RE.test(next)) return `${first} ${next}`
  return first
}

function detectKind(query: string, style: ComposeStyle): QuestionKind {
  if (style.wantExample) return 'example'
  if (style.wantWhy) return 'why'
  if (COMPARE_RE.test(query)) return 'compare'
  if (CALC_RE.test(query) || (/чему\s+равн|как\S*\s+(объ[её]м|масс\S*|количеств\S*)\s/iu.test(query) && /\d|[A-Z][a-z]?\d/u.test(query))) return 'calc'
  if (WHAT_IS_RE.test(query)) return 'definition'
  if (HOW_RE.test(query.trim())) return 'how'
  return 'general'
}

/** «Чем X отличаются от Y» → [стемы X, стемы Y] (Y наследует существительное X: «… от химических»). */
function compareTerms(query: string): string[][] {
  const q = foldText(query).replace(/[?!.]+$/, '')
  const m = q.match(/чем\s+(.+?)\s+отлича\S*\s+от\s+(.+)$/u) ?? q.match(/difference between (.+?) and (.+)$/u)
  if (!m) return []
  const a = questionWords(m[1]!)
  let b = questionWords(m[2]!)
  if (b.length === 1 && a.length >= 2 && ADJ_RU_RE.test(b[0]!)) b = [b[0]!, ...a.slice(1)]
  return [a.map(strictStem), b.map(strictStem)].filter((t) => t.length > 0)
}

type Concept = { alts: string[][]; generic: boolean; stem: string }

function buildConcepts(query: string): Concept[] {
  const out: Concept[] = []
  const seen = new Set<string>()
  for (const word of questionWords(query)) {
    // Числа условия («200», «10%-го») — не тема вопроса.
    if (/\d/.test(word)) continue
    for (const part of word.split('-').filter((p) => p.length >= 3)) {
      // Инфинитив «приготовить» ~ «приготовление»: основа без «-ить/-ать».
      const stem = /^[а-я]{5,}(ить|ать|ять|еть)$/u.test(part)
        ? part.slice(0, -3)
        : /^[а-я]{5,}(ят|ют|ут)$/u.test(part) // «проводят» ~ «проводимость», «теплопроводность»
          ? part.slice(0, -2)
          : strictStem(part)
      if (!stem || seen.has(stem)) continue
      seen.add(stem)
      const alts: string[][] = [[stem]]
      for (const [key, syn] of SYNONYMS) if (stem.startsWith(key)) alts.push(...syn)
      out.push({ alts, generic: isGenericStem(stem), stem })
    }
  }
  return out
}

type SentenceIndex = { words: string[]; compact: string }

function indexSentence(text: string): SentenceIndex {
  return { words: tokenizeWords(text), compact: foldText(text).replace(/[^\p{L}\p{N}]/gu, '') }
}

function hasStem(stem: string, idx: SentenceIndex): boolean {
  // «эфирное масло» — не «эфиры», «кислородный» — не «кислород»: прилагательное от существительного — другое понятие.
  const derivedAdjective = (w: string) => /[бвгджзклмпрстфхцчшщ]$/u.test(stem) && /^н(ый|ое|ая|ые|ого|ому|ым|ых|ой|ую|ыми|ом)$/u.test(w.slice(stem.length))
  if (idx.words.some((w) => wordHasStem(w, stem) && !derivedAdjective(w))) return true
  // Слипшиеся слова OCR («оксидыметаллов») — только для кириллицы (латиница: «elektr» ≠ «elektroliz»).
  // «неэлектролитами» — другое понятие (отрицание), а не «электролит».
  if (stem.length < 6 || !/[а-я]/.test(stem) || stem.startsWith('не')) return false
  for (let at = idx.compact.indexOf(stem); at >= 0; at = idx.compact.indexOf(stem, at + 1)) {
    if (idx.compact.slice(Math.max(0, at - 2), at) !== 'не') return true
  }
  return false
}

const conceptIn = (c: Concept, idx: SentenceIndex) => c.alts.some((alt) => alt.every((s) => hasStem(s, idx)))

function jaccard(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const matchedA = a.filter((x) => b.some((y) => stemsMatch(x, y))).length
  const matchedB = b.filter((y) => a.some((x) => stemsMatch(x, y))).length
  const inter = Math.min(matchedA, matchedB)
  return inter / (a.length + b.length - inter)
}

/** Остаток вопроса «почему …» — для вопроса на проверку. */
function whyRemainder(query: string): string | null {
  const m = query.trim().replace(/[?!.]+$/, '').match(/(?:почему|зачем|отчего|why|nega)\s+(.{3,60})$/i)
  return m?.[1]?.trim() ?? null
}

function shortenForVoice(sentence: string, maxWords: number): string {
  const words = sentence.split(/\s+/)
  if (words.length <= maxWords) return sentence
  let acc = ''
  let lastCommaCut = ''
  for (let i = 0; i < words.length && i < maxWords; i++) {
    acc = acc ? `${acc} ${words[i]}` : words[i]!
    if (/[,;:]$/.test(words[i]!) && i >= Math.floor(maxWords * 0.45)) lastCommaCut = acc
  }
  let cut = (lastCommaCut || acc).replace(/[,;:—–-]+$/, '')
  // «…, то есть в сторону реакции.» — не обрываем пояснение на половине: без хвоста «то есть …» фраза цела.
  cut = cut.replace(/,\s*(?:то есть|т\.\s?е\.|а также|а|но|и|или|где|который|которая|которое|которые)(?:\s+\S+){0,4}$/u, '')
  return `${cut}.`
}

function ensureEnd(s: string): string {
  const t = capitalizeFirst(s.trim().replace(/[,;:]+$/, ''))
  return /[.!?…»]$/.test(t) ? t : `${t}.`
}

function capitalizeFirst(s: string): string {
  // «m(соли) = w·m(р-ра)», «pH», «n = m/M» — обозначения величин с маленькой буквы не трогаем.
  if (/^[a-zα-ω]{1,2}\s*[(=₀-₉]|^pH\b/u.test(s)) return s
  return s ? s[0]!.toUpperCase() + s.slice(1) : s
}

function pick<T>(items: readonly T[], seed: number): T {
  return items[Math.abs(seed) % items.length]!
}

/**
 * «Сложные вещества …, называются оксидами» → «Оксиды — это сложные вещества …».
 * Только перестановка найденного текста (без новых фактов).
 */
function reframeDefinition(sentence: string, keyTerm: string | null, lang: StemLang): string | null {
  if (!keyTerm) return null
  if (lang === 'en') {
    const e = sentence.match(/^(.{8,200}?)\s+(is|are) called\s+([^,.;:]{3,40})\.?$/i)
    if (!e) return null
    const keyStems = keyTerm.split(/\s+/).map(strictStem)
    if (!keyStems.every((k) => tokenizeWords(e[3]!).some((w) => wordHasStem(w, k)))) return null
    return `${capitalizeFirst(e[3]!.trim())} ${e[2]} ${lowerFirst(e[1]!.trim(), 'en')}.`
  }
  if (lang === 'uz') {
    // «… jarayoni elektroliz deb ataladi.» → «Elektroliz — … jarayoni.»
    const u = sentence.match(/^(.{8,200}?)\s+(\S{3,30})\s+(?:deb ataladi|deyiladi)\.?$/iu)
    if (!u) return null
    const keyStems = keyTerm.split(/\s+/).map(strictStem)
    if (!keyStems.every((k) => wordHasStem(u[2]!, k))) return null
    return `${capitalizeFirst(u[2]!)} — ${lowerFirst(u[1]!.trim(), 'uz')}.`
  }
  if (lang !== 'ru') return null
  const m = sentence.match(/^(.{12,220}?),?\s+называ(?:ется|ются|ют)\s+([^,.;:(]{3,48})(?:\s*\([^)]*\))?(?:[,;:].*)?[.!]?$/u)
  if (!m) return null
  const keyStems = contentStems(keyTerm)
  const namedCompact = foldText(m[2]!).replace(/\s+/g, '')
  if (keyStems.length === 0 || !keyStems.every((k) => namedCompact.includes(k.slice(0, Math.min(5, k.length))))) return null
  // «… называются неэлектролитами» — определение противоположного понятия.
  if (namedCompact.startsWith('не') && !keyStems.some((k) => k.startsWith('не'))) return null
  if (tokenizeWords(m[2]!).length > keyStems.length) return null
  let body = m[1]!.trim().replace(/,\s*то есть.*$/iu, '').replace(/,\s*где\s.*$/iu, '')
  // «Этот процесс называется …» — определение в предыдущей фразе, само по себе не ответ.
  if (/^(этот|эта|это|эти|такой|такая|такое|такие|он|она|оно|они|данный|данная)\s/iu.test(body) || body.split(/\s+/).length < 3) return null
  // «Поскольку …, разновидности атомов … называются изотопами» и «… ! и химическими свойствами» — перестановка
  // исказит фразу («Изотопы — это поскольку …»): цитируем как есть.
  if (/^(поскольку|так как|если|когда|хотя|потому что|и|а|но|или|либо)\s/iu.test(body)) return null
  body = body[0]!.toLowerCase() + body.slice(1)
  // «в окислительно-восстановительных реакциях атом …, присоединивший электрон» → «атом …, присоединивший электрон,
  // в окислительно-восстановительных реакциях»: обстоятельство не встаёт перед родовым словом.
  const adjunct = body.match(/^((?:в|во|при)\s+(?:\S+\s+){0,2}?(?:реакци\S*|процесс\S*|услови\S*|раствор\S*|соединени\S*))\s+(\S.*)$/u)
  if (adjunct && !/^(?:(?:и|или|а|но)\s|,)/u.test(adjunct[2]!)) body = `${adjunct[2]!.replace(/,\s*$/u, '')} ${adjunct[1]}`
  // «вещества изменяющие скорость» → «вещества, изменяющие скорость».
  body = body.replace(/^(\p{L}+(?:\s\p{L}+)?)\s+(\p{L}+(?:ющие|ящие|ащие|вшие|емые|имые|нные|ющий|ящий|ащий|вший|емый|имый))\s/u, (m, head: string, part: string) => (/,$/.test(head) ? m : `${head}, ${part} `))
  // Термин в единственном числе, а родовое слово во множественном («Катализатор — это вещества …»): подлежащее —
  // форма из самой фразы учебника («… называются катализаторами» → «Катализаторы»).
  let subject = capitalizeFirst(keyTerm)
  const pluralBody = /^(вещества|соединения|частицы|атомы|ионы|молекулы|элементы|реакции|явления|процессы|электролиты|металлы|разновидности)[\s,]/u.test(body)
  if (pluralBody && !/[ыи]$/u.test(keyTerm.trim())) {
    const named = tokenizeWords(m[2]!)
    const plural = named.map((w) => w.replace(/ыми$/u, 'ые').replace(/ими$/u, 'ие').replace(/ами$/u, 'ы').replace(/ями$/u, 'и'))
    if (named.length > 0 && named.every((w, i) => w !== plural[i]) && plural.length === keyTerm.trim().split(/\s+/).length) subject = capitalizeFirst(plural.join(' '))
  }
  return `${subject} — это ${body}.`
}

/** «what oxides are» / «what a catalyst is». */
const enBe = (term: string) => (/[^s]s$/i.test(term.trim()) && !/(sis|ics)$/i.test(term.trim()) ? 'are' : 'is')
/** «what a catalyst is», «what electrolysis is» (неисчисляемые и множественное — без артикля). */
const enTerm = (term: string) =>
  enBe(term) === 'are' || /^(an?|the)\s/i.test(term) || /(sis|try|sion|ity|ence|ency|rium|ism|ics|ergy|mass|ation)$/i.test(term.trim()) ? term : `${/^[aeiou]/i.test(term) ? 'an' : 'a'} ${term}`

const L = {
  ru: {
    why: 'Почему так?',
    exampleLead: 'Например:',
    simplerLead: 'Если проще:',
    checks: [
      (t: string) => `Сможешь своими словами сказать, что такое ${t}?`,
      (t: string) => `А теперь ты: что такое ${t} — одной фразой?`,
      (t: string) => `Как бы ты сам объяснил, что такое ${t}?`,
    ],
    checkWhy: (r: string) => `Сможешь теперь сам объяснить, почему ${r}?`,
    checkHow: 'Сможешь пересказать это своими словами по шагам?',
    checkCompare: 'Сможешь назвать главное отличие одной фразой?',
    checkClassify: 'Сможешь перечислить эти группы?',
    checkComposition: 'Сможешь назвать, из каких частей это состоит?',
    checkFactors: 'Сможешь перечислить эти факторы?',
    checkExample: 'Сможешь привести ещё один пример сам?',
    checkGeneric: 'Понятно? Если хочешь — приведу пример или объясню проще.',
    helperLead: 'Подсказка, а решишь ты сам.',
    helperAsk: (t: string) => `Как это помогает с вопросом про «${t}»? Попробуй сделать следующий шаг.`,
    noAnswer: (q: string) => `Честно скажу: точного ответа на «${q}» в моей базе нет, а выдумывать я не буду.`,
    offDomain: (q: string) => `Честно скажу: точного ответа на «${q}» в моей базе нет — это вопрос не по химии (я помогаю с химией 7–11 классов), а выдумывать я не буду.`,
    noWhy: 'А точной причины в моей базе не написано — проверим по учебнику?',
    related: (title: string) => `Зато могу рассказать про «${title}».`,
    relatedGeneric: 'Зато могу рассказать про тему нашего урока.',
    topic: (t: string) => `Давай вернёмся к теме «${t}» — спроси, что в ней главное.`,
    smartAi: 'Или подключи умный ИИ — он ответит шире.',
    noExample: 'Готового примера в моей базе по этому вопросу нет.',
    pronoun: 'Он',
    glossLead: (terms: string) => terms,
    onlyRussian: '',
    quote: (book: string | null, text: string) => `${book ?? 'Справочник ATOMLAB'}: «${text}»`,
    exampleTerms: (terms: string) => `Пример из учебника: ${terms}.`,
    equation: (eq: string) => `Уравнение реакции: ${eq}.`,
  },
  en: {
    why: 'Why is that?',
    exampleLead: 'For example:',
    simplerLead: 'Put simply:',
    checks: [
      (t: string) => `Can you explain what ${enTerm(t)} ${enBe(t)} in your own words?`,
      (t: string) => `Your turn: what ${enBe(t)} ${enTerm(t)}, in one sentence?`,
      (t: string) => `How would you explain ${t} to a friend?`,
    ],
    // «why do metals conduct electricity» → «why metals conduct electricity» (косвенный вопрос без инверсии).
    checkWhy: (r: string) =>
      /^(does|did|is|are|was|were|can|will)\s/i.test(r) ? 'Can you now explain the reason in your own words?' : `Can you now explain why ${r.replace(/^do\s+/i, '')}?`,
    checkHow: 'Can you retell it step by step in your own words?',
    checkCompare: 'Can you name the main difference in one sentence?',
    checkClassify: 'Can you list these groups?',
    checkComposition: 'Can you name what it consists of?',
    checkFactors: 'Can you list these factors?',
    checkExample: 'Can you think of one more example yourself?',
    checkGeneric: 'Is that clear? I can give an example or explain it more simply.',
    helperLead: 'Here is a hint — the solving is yours.',
    helperAsk: (t: string) => `How does this help with “${t}”? Try the next step yourself.`,
    noAnswer: (q: string) => `To be honest, my knowledge base has no exact answer to “${q}”, and I will not make one up.`,
    noWhy: 'The exact reason is not written in my knowledge base — shall we check the textbook?',
    related: (title: string) => `I can tell you about “${title}” instead.`,
    relatedGeneric: 'I can tell you about the topic of our lesson instead.',
    topic: (t: string) => `Let us go back to “${t}” — ask me what matters most there.`,
    smartAi: 'Or connect the smart AI for a broader answer.',
    noExample: 'I have no ready example for this in my knowledge base.',
    pronoun: 'It',
    glossLead: (terms: string) => `My textbooks are in Russian. The key terms of the answer are: ${terms}.`,
    onlyRussian: 'I have this answer only in my Russian textbook, so here is its exact sentence.',
    quote: (book: string | null, text: string) => `${book ? `From the ${book} textbook` : 'From the ATOMLAB reference cards'} (in Russian): «${text}»`,
    exampleTerms: (terms: string) => `An example from the textbook: ${terms}.`,
    equation: (eq: string) => `The reaction equation: ${eq}.`,
  },
  uz: {
    why: 'Nega shunday?',
    exampleLead: 'Masalan:',
    simplerLead: 'Soddaroq aytganda:',
    checks: [
      (t: string) => `${t} nima ekanini o‘z so‘zingiz bilan ayta olasizmi?`,
      (t: string) => `Endi siz: ${t} nima — bitta gap bilan?`,
    ],
    checkWhy: (r: string) => `Endi nega ${r} — o‘zingiz tushuntira olasizmi?`,
    checkHow: 'Buni o‘z so‘zingiz bilan bosqichma-bosqich aytib bera olasizmi?',
    checkCompare: 'Asosiy farqni bitta gap bilan ayta olasizmi?',
    checkClassify: 'Bu guruhlarni sanab bera olasizmi?',
    checkComposition: 'U nimalardan iboratligini ayta olasizmi?',
    checkFactors: 'Bu omillarni sanab bera olasizmi?',
    checkExample: 'Yana bitta misolni o‘zingiz keltira olasizmi?',
    checkGeneric: 'Tushunarlimi? Xohlasangiz, misol keltiraman yoki soddaroq tushuntiraman.',
    helperLead: 'Mana maslahat — yechimni o‘zingiz topasiz.',
    helperAsk: (t: string) => `Bu «${t}» bilan qanday bog‘liq? Keyingi qadamni o‘zingiz qiling.`,
    noAnswer: (q: string) => `Rostini aytsam, «${q}» bo‘yicha bazamda aniq javob yo‘q, o‘ylab topmayman.`,
    noWhy: 'Aniq sababi bazamda yozilmagan — darslikdan tekshiramizmi?',
    related: (title: string) => `Lekin «${title}» haqida aytib bera olaman.`,
    relatedGeneric: 'Lekin darsimiz mavzusi haqida aytib bera olaman.',
    topic: (t: string) => `Keling, «${t}» mavzusiga qaytamiz — undagi asosiy narsani so‘rang.`,
    smartAi: 'Yoki aqlli SI ni ulang — u kengroq javob beradi.',
    noExample: 'Bu savol bo‘yicha bazamda tayyor misol yo‘q.',
    pronoun: 'U',
    glossLead: (terms: string) => `Darsliklarim rus tilida. Javobning asosiy atamalari: ${terms}.`,
    onlyRussian: 'Bu javob menda faqat rus tilidagi darslikda bor, uning aynan gapini keltiraman.',
    quote: (book: string | null, text: string) => `${book ? `${book} darsligidan` : 'ATOMLAB ma’lumotnomasidan'} (rus tilida): «${text}»`,
    exampleTerms: (terms: string) => `Darslikdagi misol: ${terms}.`,
    equation: (eq: string) => `Reaksiya tenglamasi: ${eq}.`,
  },
} as const

function shortQuery(query: string): string {
  const q = query.trim().replace(/[?!.]+$/, '')
  const words = q.split(/\s+/)
  return words.length > 8 ? `${words.slice(0, 8).join(' ')}…` : q
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s*\(\d+\/\d+\)\s*$/, '')
    .replace(/^§\s*\d+(?:\.\d+)?\.?\s*/, '')
    .replace(/:\s*определения$/i, '')
    .replace(/^(Ошибка|Типичная ошибка)[:\s—-]+/i, '')
    .replace(/[«»"]/g, '')
    .trim()
    .slice(0, 80)
}

const DEFINITION_TYPES = new Set(['definition', 'card', 'faq', 'summary'])
const SERVICE_TYPES = new Set(['glossary'])

/* ------------------------------------------------------------------ analysis */

type QuestionInfo = {
  query: string
  lang: StemLang
  kind: QuestionKind
  keyTerm: string | null
  keyStems: string[]
  concepts: Concept[]
  specific: Concept[]
  terms: string[][]
  /** Дефисные составные слова вопроса («литий-ионный») — должны встретиться целиком. */
  compounds: string[]
  contrast: Array<[string, string]>
  needed: number
  /** «Из чего состоит атом?» */
  composition: boolean
  /** «От чего зависит скорость реакции?», «Какие факторы влияют …?» */
  factors: boolean
}

function analyzeQuestion(query: string, lang: StemLang, style: ComposeStyle, topicHint?: string): QuestionInfo {
  const kind = detectKind(query, style)
  const keyTerm = extractKeyTerm(query, lang)
  let concepts = buildConcepts(query)
  const fromHint = concepts.length === 0
  if (fromHint && topicHint) concepts = buildConcepts(topicHint)
  let keyStems = keyTerm ? questionWords(keyTerm).flatMap((w) => w.split('-')).filter((w) => w.length >= 3).map(strictStem) : []
  // «Что такое моль?»: термин — служебное для задач слово (моль, грамм, литр); он и есть тема вопроса.
  if (keyTerm && keyStems.length === 0 && kind === 'definition') {
    keyStems = keyTerm.split(/\s+/).filter((w) => w.length >= 3).map((w) => (strictStem(w).length >= 4 ? strictStem(w) : foldText(w)))
    const own = keyStems.map((stem) => ({ alts: [[stem]], generic: false, stem }))
    concepts = fromHint ? own : [...own, ...concepts.filter((c) => !keyStems.includes(c.stem))]
  }
  const specific = concepts.filter((c) => !c.generic)
  const folded = foldText(query)
  const compounds = (folded.match(/[\p{L}]{3,}-[\p{L}]{3,}/gu) ?? []).filter((w) => !/^(что|кто|как|какой|какая|какие|как)-/u.test(w))
  const contrast = CONTRAST_PAIRS.filter(([a, b]) => folded.includes(a) && !folded.includes(b))
  const n = concepts.length
  const needed = n <= 1 ? 1 : n <= 3 ? 0.5 : 0.4
  const composition = /из\s+чего\s+состо|made\s+of|consist/iu.test(folded)
  const factors = /от\s+чего\s+завис|фактор|depend/iu.test(folded)
  return { query, lang, kind, keyTerm, keyStems, concepts, specific, terms: kind === 'compare' ? compareTerms(query) : [], compounds, contrast, needed, composition, factors }
}

function buildCandidates(hits: readonly KnowledgeHitLike[], info: QuestionInfo, style: ComposeStyle): Candidate[] {
  const { lang, kind, keyStems, concepts } = info
  const isWhatIs = kind === 'definition'
  const candidates: Candidate[] = []
  const seenText = new Set<string>()
  hits.forEach((hit, hitIndex) => {
    if (!hit.text || SERVICE_TYPES.has(hit.type ?? '')) return
    const titleIdx = indexSentence(hit.title)
    const titleOverlap = concepts.length === 0 ? 0 : concepts.filter((c) => conceptIn(c, titleIdx)).length / concepts.length
    const defType = DEFINITION_TYPES.has(hit.type ?? '')
    const textbookLike = hit.type === 'textbook' || hit.type === 'definition' || hit.type === 'i18n'
    splitCandidates(hit.text).forEach((raw, pos) => {
      if (JUNK_RE.test(raw)) return
      if (raw.endsWith('?') || raw.startsWith('(')) return
      // «Поэтому азот считается инертным» — вывод без причины; для «почему» берём его вместе с предыдущей фразой (pickDirect).
      const conclusionLead = kind === 'why' && /^(Поэтому|Следовательно)\s/u.test(raw)
      if (looksLikeOcrNoise(raw) || (looksBroken(raw) && !(conclusionLead && !looksBroken(raw.replace(/^(Поэтому|Следовательно)\s+/u, 'Итог '))))) return
      if (!acceptableForLang(raw, lang)) return
      // Шаг лабораторной работы («в пробирку добавить 1 каплю …») и название, не совпадающее с формулой — не факт для ответа.
      if (LAB_STEP_RE.test(raw) || nameFormulaMismatch(raw)) return
      if (raw.length < 24 || raw.length > 420) return
      if (foldText(raw).replace(/[^\p{L}\p{N}]/gu, '') === foldText(hit.title).replace(/[^\p{L}\p{N}]/gu, '')) return
      if (lang === 'ru' && /^((В|На|Из|С|До|При|Для)\s)?(Какие|Какой|Какая|Каким|Какими|Какую|какой|какие|какая|какую|каким|какими|какого|Сколько|сколько|Почему|Что|Как|Чем)\s/u.test(raw) && !/[—–]|\sэто\s/u.test(raw)) return
      // Заголовок без сказуемого («Получение хлорида водорода в лаборатории физические свойства.»).
      if (lang === 'ru' && isHeadingLike(raw)) return
      // Склеенные колонки глоссария: подлежащее повторяется после запятой («Молекула – частица, Молекула состоящая …»).
      if (/^(\p{Lu}\p{Ll}{3,})\s*[–—-][^.]*,\s*\1\s/u.test(raw)) return
      // Происхождение слова («„Молекула“ – в дословном переводе означает …») — не факт для ответа.
      if (/(в дословном переводе|в переводе с \p{L}+ (языка )?означает|означает\s+«|происходит от (греческ|латинск))/iu.test(raw)) return
      // Тавтология «Если связь ближе к ионной, то её называют ионной связью».
      {
        const named = raw.match(/^Если\s(.+?),\s*то\s.*?называ\S*\s+(\p{L}+)/u)
        if (named && strictStem(named[2]!).length >= 4 && foldText(named[1]!).includes(strictStem(named[2]!))) return
      }
      const key = foldText(raw).replace(/\s+/g, ' ')
      if (seenText.has(key)) return
      seenText.add(key)

      const idx = indexSentence(raw)
      const matchedConcepts = concepts.filter((c) => conceptIn(c, idx))
      const overlap = concepts.length === 0 ? 0 : matchedConcepts.length / concepts.length
      const specific = matchedConcepts.filter((c) => !c.generic).length
      const definitional = DEFINITION_RE.test(raw)
      const causal = CAUSAL_RE.test(raw)
      const formulas = (raw.match(FORMULA_TOKEN_RE) ?? []).filter((tok) => !/^[IVXLCDM]+$/.test(tok)).length
      const example = EXAMPLE_RE.test(raw) || REACTION_RE.test(raw) || (formulas >= 1 && formulas <= 4 && !definitional)
      const headIdx = indexSentence(raw.split(/\s+/).slice(0, 7).join(' '))
      const keyConceptIn = (k: string, where: SentenceIndex) => {
        const c = concepts.find((x) => x.stem === k)
        return c ? conceptIn(c, where) : hasStem(k, where)
      }
      // Термин — лишь определение к другому веществу («хлорид водорода получают …» ≠ «водород получают …»).
      const keyAsModifier = keyStems.length === 1 && keyOnlyAsModifier(raw, keyStems[0]!, lang)
      const keyAll = keyStems.length > 0 && keyStems.every((k) => keyConceptIn(k, idx)) && !keyAsModifier
      const keyInHead = keyStems.length > 0 && keyStems.every((k) => keyConceptIn(k, headIdx)) && !keyAsModifier
      const namedPart =
        raw.match(/(?:называ(?:ется|ются|ют)|\b(?:is|are) called)\s+(?:(?:его|её|ее|их)\s+)?([^,.;:(]{3,48})/iu)?.[1] ??
        raw.match(/\s([^\s,.;:()]{3,30})\s+(?:deb ataladi|deyiladi)\.?$/iu)?.[1] ??
        ''
      const namedIdx = indexSentence(namedPart)
      const namedWords = namedIdx.words.length
      const firstIdx = indexSentence(raw.split(/[\s,]+/).slice(0, 1).join(' '))
      // Синоним термина в названии: «… такие соединения называют предельными углеводородами» — это «алканы».
      const synonymNamed = (stems: readonly string[]) =>
        stems.length === 1 &&
        namedPart.length > 0 &&
        (concepts.find((x) => x.stem === stems[0])?.alts ?? []).some((alt) => alt[0] !== stems[0] && namedWords <= alt.length && alt.every((s) => hasStem(s, namedIdx)))
      const isNamed = (stems: readonly string[]) =>
        synonymNamed(stems) ||
        (stems.length > 0 &&
        namedPart.length > 0 &&
        // На «что такое кислоты» «называют органическими кислотами» — название подвида, а не определение «кислот»;
        // на другие вопросы «называется молярным объёмом» годится.
        namedWords <= stems.length + (isWhatIs ? 0 : 1) &&
        (stems.every((k) => hasStem(k, namedIdx)) ||
          (stems.length >= 2 && stems.some((k) => hasStem(k, namedIdx)) && stems.every((k) => hasStem(k, namedIdx) || hasStem(k, firstIdx)))))
      // Определение термина: «Термин — …», «Наука химия изучает …», «… называются термином».
      // Подлежащее до связки — сам термин (± 2 слова: «Наука», «Термин»), скобки не считаем:
      // «Эпоха классической химии (1860 – …)» и «Единственный элемент, который не образует оксид, — фтор»
      // определениями «химии»/«оксидов» не являются.
      const noParen = raw.replace(/\([^)]*\)/g, ' ')
      const copulaAt = noParen.search(COPULA_RE)
      const subject = copulaAt > 0 ? noParen.slice(0, copulaAt) : ''
      const subjectIdx = indexSentence(subject)
      const subjectIs = (stems: readonly string[]) =>
        stems.length > 0 && subjectIdx.words.length > 0 && subjectIdx.words.length <= stems.length + 2 && stems.every((k) => hasStem(k, subjectIdx))
      const definesStems = (stems: readonly string[]) =>
        isNamed(stems) || (definitional && copulaAt >= 0 && copulaAt <= 60 && subjectIs(stems))
      // uz: «Oksidlar ikki elementdan … kisloroddir.» — термин первым словом, сказуемое «-dir»/«hisoblanadi» в конце.
      const uzDefinition =
        lang === 'uz' && keyStems.length > 0 && keyStems.every((k) => hasStem(k, indexSentence(raw.split(/\s+/).slice(0, keyStems.length).join(' ')))) &&
        /(dir|hisoblanadi|deyiladi)[.!]?$/iu.test(raw)
      const demonstrative = /^(Этот|Эта|Это|Эти|Такой|Такая|Такое|Такие|Данный|Данная)\s\S+\s+называ/u.test(raw)
      const definesKey = (definesStems(keyStems) && !demonstrative) || uzDefinition
      // «Оксиды — …» точнее, чем «Амфотерные оксиды — …»: подлежащее ровно из слов термина (± «наука», артикль).
      const subjectWords = subjectIdx.words.filter((w) => !/^(the|an?|наука|термин)$/.test(w))
      const exactSubject =
        definesKey && (uzDefinition || (isNamed(keyStems) ? namedWords <= keyStems.length : subjectWords.length === keyStems.length))
      let definesTerm = -1
      info.terms.forEach((t, i) => {
        if (definesTerm < 0 && definesStems(t)) definesTerm = i
      })
      const definesOther =
        !definesKey &&
        definesTerm < 0 &&
        ((namedPart.length > 0 && namedWords <= 3) ||
          (definitional && copulaAt > 0 && copulaAt <= 60 && subjectIdx.words.length >= 1 && subjectIdx.words.length <= 5 &&
            !keyStems.some((k) => hasStem(k, subjectIdx))))
      const method = METHOD_RE.test(raw)
      const classify = CLASSIFY_RE.test(raw)
      const imprecise = IMPRECISE_RE.test(raw)
      const offCondition = info.contrast.some(([, b]) => hasStem(b, idx)) && !info.contrast.some(([a]) => hasStem(a, idx))
      const subjectOther =
        !definesKey && definesTerm < 0 && /\s[—–]\s/u.test(noParen.slice(0, 64)) && copulaAt > 0 && copulaAt <= 60 && subjectIdx.words.length <= 5 && !subjectIs(keyStems)
      // «Атом имеет две области: ядро и электронную оболочку» — ответ на «из чего состоит атом»; «Ядро атома … состоит из
      // протонов» (подлежащее — часть X) и «Атом гелия состоит …» (частный случай) — нет.
      const composition = info.composition && /(состо\S*\s+из|имеет\s+\S+\s+област|содерж\S*\s|входят)/iu.test(raw)
      const firstIsKey = keyStems.length > 0 && hasStem(keyStems[0]!, firstIdx)
      const secondWord = raw.split(/\s+/)[1] ?? ''

      const digits = (raw.match(/\d/g) ?? []).length
      const commas = (raw.match(/,/g) ?? []).length
      let score = overlap * 3 + titleOverlap * 0.8 + 0.6 / (hitIndex + 1)
      if (defType && (isWhatIs || !style.wantWhy)) score += 0.3
      if (textbookLike && definesKey) score += 0.3
      if (exactSubject) score += isWhatIs ? 0.8 : 0.3
      // Из двух определений — полнее (больше смысловых слов: «состав, строение, свойства и изменения»).
      if (definesKey && isWhatIs) score += Math.min(contentStems(raw).length, 16) * 0.06
      // «Жиры представляют собой сложные эфиры …» (родовое понятие) точнее, чем «Жиры – это строительный материал
      // и энергетический резерв организма» (роль/применение).
      if (definesKey && isWhatIs) {
        const predicate = isNamed(keyStems) ? raw.split(/\s+/).slice(0, 5).join(' ') : noParen.slice(copulaAt).split(/\s+/).slice(0, 7).join(' ')
        if (CLASS_NOUN_RE.test(predicate)) score += 0.5
        if (/(организм|в жизни|в быту|применя|использу|значение)/iu.test(raw)) score -= 0.8
      }
      // Определение из учебника — точнее пересказа карточки/итога.
      if (isWhatIs && definesKey && (hit.type === 'card' || hit.type === 'summary')) score -= 0.4
      // «„Молекула“ – в дословном переводе означает …» — происхождение слова, а не определение.
      if (definitional && kind !== 'why') score += 0.3
      if (definesKey) score += isWhatIs ? (exactSubject ? 2.2 : 1.2) : kind === 'example' ? 0.3 : 1.0
      if (definesTerm >= 0) score += 1.2
      if (definesOther) score -= isWhatIs ? 1.6 : kind === 'compare' ? 0.3 : 0.7
      if (causal) score += kind === 'why' ? (keyAll || overlap >= 0.5 ? 1.6 : 0.5) : 0.1
      if (method && (kind === 'how' || kind === 'calc') && overlap >= info.needed - 1e-9) score += 0.9
      // «Как получают X?»: способ получения, а не разложение/применение X и не «способы … отличаются от …».
      if (kind === 'how' && lang === 'ru' && /получ|производ|синтез/iu.test(info.query)) {
        if (/(получ|производ|синтез|добыва)/iu.test(raw)) score += 0.6
        else if (/(разложени|разлага|применени|использу)/iu.test(raw)) score -= 1.2
        if (/отлича\S*\s+от/iu.test(raw) && !/отлича/iu.test(info.query)) score -= 1.2
        if (keyStems.length > 0 && otherObtainedObject(raw, keyStems)) score -= 1.8
      }
      if (classify && kind === 'compare' && keyAll) score += /:\s*\S.*,.*,/u.test(raw) ? 2.2 : 1.0
      if (CONTRAST_WORDS_RE.test(raw) && kind === 'compare') score += 0.4
      if (example && style.wantExample) score += specific > 0 || keyAll ? 1.4 : 0.4
      if (keyInHead && kind !== 'example') score += 0.4
      if (imprecise) score -= 2.5
      if (keyAsModifier) score -= 1.5
      // Подлежащее — сам X («Атом имеет …»), а не «Атом гелия» / «Ядро атома».
      if (composition) score += firstIsKey && /^(имеет|имеют|состоит|состоят|содержит|включает)$/u.test(secondWord) ? 3 : -0.8
      // «Скорость реакции зависит от: природы …, концентрации …, температуры …» — перечень факторов целиком.
      if (info.factors && /завис\S*\s+от\s*:?\s*\S.*,.*,/u.test(raw)) score += 2.4
      // Строка карточки без подлежащего («Необратимые идут …», «Образуется в растворе …», «Получение: …»).
      if (isTelegraphicCard(raw, hit.type ?? '')) score -= 2
      if (FILLER_RE.test(raw) && !FILLER_RE.test(info.query)) score -= 1
      if (offCondition) score -= 1.8
      if (/^[a-zа-яё]/.test(raw)) score -= 0.9
      const numericKind = kind === 'how' || kind === 'calc' || kind === 'example'
      if (digits / raw.length > 0.06 || /[=]|\d\)/.test(raw)) score -= numericKind ? 0.4 : 1.1
      // Числа с единицами («2,55 g сложного эфира», «15 МПа») — условие задачи/справка, не объяснение.
      if (kind !== 'calc' && /\d[\d,.]*\s*(g|г|кг|мл|л|моль|mol|МПа|кПа)(?![\p{L}])/u.test(raw)) score -= 1.2
      if (formulas >= 5 || (commas >= 4 && formulas >= 3)) score -= 1.3
      else if (formulas >= 3 && !numericKind) score -= 0.8
      if (raw.length > 240) score -= 0.5
      if (style.simpler && raw.length > 160) score -= 0.6

      candidates.push({
        text: raw.trim(),
        hitIndex,
        pos,
        title: hit.title,
        hitType: hit.type ?? '',
        extra: hit.score === 0,
        overlap,
        specific,
        keyAll,
        keyInHead,
        definitional,
        definesKey,
        exactKey: exactSubject,
        offCondition,
        titleKey: keyStems.length > 0 && keyStems.every((k) => keyConceptIn(k, titleIdx)),
        definesOther,
        definesTerm,
        causal,
        method,
        classify,
        example,
        formulas,
        imprecise,
        subjectOther,
        citation: hit.citation ?? '',
        stems: contentStems(raw),
        score,
      })
    })
  })
  candidates.sort((a, b) => b.score - a.score)
  return candidates
}

type Picked = { direct: Candidate; second?: Candidate; missingWhy: boolean }

function compoundsIn(info: QuestionInfo, c: Candidate): boolean {
  if (info.compounds.length === 0) return true
  const compact = foldText(c.text).replace(/[^\p{L}\p{N}]/gu, '')
  return info.compounds.every((w) => {
    const parts = w.split('-')
    return compact.includes(parts.map((p, i) => (i === parts.length - 1 ? strictStem(p) : p)).join(''))
  })
}

function pickDirect(cands: readonly Candidate[], info: QuestionInfo): Picked | null {
  const { kind, needed } = info
  const usable = cands.filter((c) => c.score > 0.6 && !c.imprecise && compoundsIn(info, c))
  const strong = (c: Candidate) => c.overlap >= needed - 1e-9 && (info.keyStems.length === 0 || c.keyAll)
  // «Ответ из того же места, что нашёл поиск»: фраза из лучших фрагментов с совпадением понятий ≥ половины.
  const fallback = () =>
    usable.find((c) => strong(c) && !c.definesOther) ??
    usable.find((c) => c.hitIndex <= 2 && c.keyAll && c.overlap >= Math.min(0.5, needed) - 1e-9 && !c.definesOther)
  // «Из чего состоит X», «от чего зависит X»: лучший по оценке состав/перечень, а не определение X.
  if ((info.composition || info.factors) && kind !== 'compare' && kind !== 'calc') {
    const direct = usable.find((c) => strong(c) && !c.definesOther && !c.subjectOther)
    if (direct) return { direct, missingWhy: false }
  }
  switch (kind) {
    case 'definition': {
      // Определение из найденного по уроку важнее подтянутого из другого § (score 0): «добавки» — только если своего нет.
      const direct =
        usable.find((c) => c.definesKey && c.exactKey && !c.extra) ??
        usable.find((c) => c.definesKey && c.exactKey) ??
        usable.find((c) => c.definesKey && !c.extra) ??
        usable.find((c) => c.definesKey) ??
        usable.find((c) => c.keyInHead && c.definitional && !c.definesOther) ??
        usable.find((c) => c.keyInHead && strong(c) && !c.definesOther)
      return direct ? { direct, missingWhy: false } : null
    }
    case 'why': {
      // Причина должна касаться того, о чём спросили (не только термина): «металлы … отражают свет, поэтому блеск»
      // — не ответ на «почему металлы проводят ток».
      const enough = (c: Candidate) => c.overlap >= Math.max(needed, 0.5) - 1e-9 || (info.concepts.length <= 2 && c.keyAll)
      // «… за счёт трёх пар электронов. Поэтому азот считается инертным»: причина — предыдущая фраза того же фрагмента.
      const conclusion = usable.find((c) => /^(Поэтому|Следовательно|Вот почему|Именно поэтому|Therefore|Shuning uchun)[\s,]/u.test(c.text) && enough(c) && c.keyAll && !c.definesOther)
      const premise =
        conclusion &&
        cands.find((c) => c.hitIndex === conclusion.hitIndex && c.pos === conclusion.pos - 1 && c.score > 0 && !isTelegraphicCard(c.text, c.hitType) && !DEICTIC_START_RE.test(c.text))
      if (conclusion && premise) return { direct: premise, second: conclusion, missingWhy: false }
      const direct = usable.find((c) => c.causal && enough(c) && c.specific > 0 && !c.definesOther && !/^(Поэтому|Следовательно)[\s,]/u.test(c.text))
      if (direct) return { direct, missingWhy: false }
      const fact = fallback()
      if (!fact) return null
      // Объяснение рядом с фактом в том же фрагменте учебника («Характерные свойства металлов объясняются …»).
      const near = usable
        .filter((c) => c !== fact && c.hitIndex === fact.hitIndex && Math.abs(c.pos - fact.pos) <= 4 && c.keyAll && !c.definesOther)
        .filter((c) => /объясня|обусловл|explained by|tushuntiriladi/iu.test(c.text))
      return near[0] ? { direct: fact, second: near[0], missingWhy: false } : { direct: fact, missingWhy: true }
    }
    case 'how': {
      // «Реакция образования сложного эфира из спирта с кислотой называется …» — тоже ответ на «как получают».
      // «В промышленности?» — лабораторный способ не ответ (и наоборот), если есть способ с нужным условием.
      const direct =
        usable.find((c) => c.method && strong(c) && (!c.definesOther || c.keyInHead) && !c.offCondition) ??
        usable.find((c) => c.method && strong(c) && (!c.definesOther || c.keyInHead)) ??
        fallback()
      return direct ? { direct, missingWhy: false } : null
    }
    case 'calc': {
      // Расчёт: только способ/формула из найденного (условия чужих задач — не ответ).
      const direct =
        usable.find((c) => c.method && /[=·×]/u.test(c.text) && c.overlap >= needed - 1e-9 && !c.definesOther) ??
        usable.find((c) => c.method && strong(c) && !c.definesOther)
      return direct ? { direct, missingWhy: false } : null
    }
    case 'compare': {
      if (info.terms.length === 2) {
        // Определение стороны с явным противопоставлением («вещество остаётся тем же», «новые вещества не образуются»)
        // точнее, чем признак только одной стороны («только при изменении агрегатного состояния»).
        const NEGATED_RE = /(не\s+образу|не\s+возника|оста[её]тся\s+(тем\s+же|прежним)|не\s+меня|не\s+изменя)/iu
        const side = (i: number) => usable.find((c) => c.definesTerm === i && NEGATED_RE.test(c.text) && !isTelegraphicCard(c.text, c.hitType)) ?? usable.find((c) => c.definesTerm === i)
        const a = side(0)
        const b = usable.find((c) => c.definesTerm === 1 && c !== a && NEGATED_RE.test(c.text)) ?? usable.find((c) => c.definesTerm === 1 && c !== a)
        if (a && b) return { direct: a, second: b, missingWhy: false }
      }
      const direct =
        usable.find((c) => c.classify && c.keyAll && c.specific > 0) ??
        usable.find((c) => strong(c) && CONTRAST_WORDS_RE.test(c.text)) ??
        (info.terms.length === 2 ? usable.find((c) => c.definesTerm >= 0) : undefined) ??
        fallback()
      return direct ? { direct, missingWhy: false } : null
    }
    case 'example': {
      // Пример: отвечает уточнению вопроса (осадок/газ), не условен соседней фразой, без другого подлежащего.
      const fits = (c: Candidate) =>
        qualifierOk(info.query, c.text) && formulaClassOk(info.query, c.text) && !conditionedExample(c, cands) && !c.subjectOther && !DEICTIC_START_RE.test(c.text) && !DANGLING_RE.test(c.text) && !RESTRICT_NEXT_RE.test(c.text) && !/\s[—–]\s*это\s/u.test(c.text)
      const exUsable = usable.filter(fits)
      const direct =
        exUsable.find((c) => c.example && c.keyAll && c.formulas >= 1 && c.formulas <= 6 && isRealExample(c.text)) ??
        exUsable.find((c) => c.example && (c.keyAll || c.specific > 0) && isRealExample(c.text)) ??
        exUsable.find((c) => c.example && c.keyAll && c.formulas >= 1 && c.formulas <= 6 && !c.definitional)
      if (direct) return { direct, missingWhy: false }
      const def = usable.find((c) => c.definesKey) ?? fallback()
      // Пример из того же фрагмента, что и определение термина («Например, при горении углерода … CO2»).
      const near =
        def &&
        cands.find(
          (c) =>
            c.example && c.hitIndex === def.hitIndex && Math.abs(c.pos - def.pos) <= 2 && c.score > 0 && !c.definesOther && !c.definitional && c.formulas <= 6 && isRealExample(c.text) && fits(c),
        )
      if (near) return { direct: near, missingWhy: false }
      return def ? { direct: def, missingWhy: false } : null
    }
    default: {
      const direct = usable.find((c) => c.definesKey && strong(c)) ?? fallback()
      return direct ? { direct, missingWhy: false } : null
    }
  }
}

/**
 * Пример — конкретный представитель понятия (формула, вещество, реакция с веществами), а не правило («зависит»,
 * «усиливается»), общая формула («ExOy», «CnH2n+2»), подпись карточки или формулы только в скобках пояснения.
 */
function isRealExample(text: string): boolean {
  if (/общ(ая|ей|ую)\s+формул|C[nₙ]\s*H|[EЭ]\s*[xₓ]\s*O\s*[yᵧ]|\(Э\)/u.test(text)) return false
  if (/(завис|усилива|ослабева|использу|применя|смеща|объясня)/iu.test(text)) return false
  const exampleWord = /(например|к примеру|такие как)/iu.test(text)
  if (CAUSAL_RE.test(text) && !exampleWord) return false
  if ((text.match(/например/giu) ?? []).length >= 2) return false
  // «2H2O + 4ē = O2 + 4H+. при электролизе раствора …» — полуреакция с обрывком текста.
  if (/[.!?]\s+\p{Ll}|ē/u.test(text)) return false
  if (/^(Составляют|Получают|Образуют|Пишут|Записывают|Определяют|Применяют|Используют)\s/u.test(text)) return false
  const outside = text.replace(/\((?:[^()]|\([^()]*\))*\)/gu, ' ')
  const formulasOutside = (outside.match(FORMULA_TOKEN_RE) ?? []).filter((tok) => !/^[IVXLCDM]+$/.test(tok)).length
  // «щелочной гидролиз жиров → мыла + глицерин» — стрелка между словами: запись карточки, а не уравнение.
  if (/[→⇌]/u.test(text) && formulasOutside < 2) return false
  // «(управление реакцией светом, пример HOD → HO+D)» — вещества только в скобках пояснения.
  return formulasOutside > 0 || exampleWord
}

/** Строка карточки без подлежащего: «Необратимые идут …», «Образуется в растворе …», «Временная (…) снимается … → …», «Получение: …». */
function isTelegraphicCard(text: string, hitType: string): boolean {
  if (hitType !== 'card' && hitType !== 'faq' && hitType !== 'summary') return false
  return (
    /^\p{Lu}\p{Ll}+(ые|ие|ая|ое)\s+(\([^)]*\)\s+)?(\p{Ll}+о\s+)?\p{Ll}+(ут|ют|ят|ат|ется|ится)\s/u.test(text) ||
    /^(Образуется|Получают|Применяют|Используют|Встречается|Содержится)\s|^(Получение|Применение|Нахождение в природе)\s*:/u.test(text) ||
    /\p{Ll}\s*→\s*[A-Z][^+]*$/u.test(text)
  )
}

/** Наполнитель вместо пояснения: применение, производство, экология, «вы узнали», «в свою очередь делятся». */
const FILLER_RE =
  /(использу|применя|промышленност|народн\S* хозяйств|завод|комбинат|загрязня|вы узнали|вы уже|мы знаем|известно, что|в свою очередь|Узбекистан|аромат|в быту|парфюмер)/iu
/** Физические свойства и «также» без предыдущей фразы — не пояснение к «что такое» и не пример. */
const PROPERTY_RE = /(летуч|запах|цвет[аоу]?\s|вкус|физическ\S* свойств)/iu

/** Фраза относится к теме: ≥ 2 специфичных совпадения (вопрос + прямой ответ) или термин в начале. */
function onTopic(c: Candidate, info: QuestionInfo, anchor: Candidate): boolean {
  const idx = indexSentence(c.text)
  const qHits = info.specific.filter((k) => conceptIn(k, idx)).length
  const anchorStems = anchor.stems.filter((s) => !isGenericStem(s) && !info.concepts.some((k) => stemsMatch(k.stem, s)))
  const xHits = anchorStems.filter((s) => c.stems.some((x) => stemsMatch(s, x))).length
  const head = indexSentence(c.text.split(/\s+/).slice(0, 6).join(' '))
  const keyInHead = info.specific.some((k) => conceptIn(k, head))
  return qHits + xHits >= 2 || (qHits >= 1 && keyInHead)
}

/** «Kimyo 8, §20» из подписи «[Kimyo 8, §20, стр. 85–86]». */
const sectionOf = (citation: string) => citation.match(/Kimyo\s*\d+,\s*§\s*[\d.]+/u)?.[0] ?? citation

const adjacentTo = (c: Candidate, d: Candidate) => c.hitIndex === d.hitIndex && Math.abs(c.pos - d.pos) <= 1

function sameDefinedTerm(a: Candidate, b: Candidate): boolean {
  if (a.definesKey && b.definesKey) return true
  return a.definesTerm >= 0 && a.definesTerm === b.definesTerm
}

/** «KMnO₄, H2O2» → «H2O2,KMnO4» (нормализованный набор формул фразы; '' — формул нет). */
function formulaSet(text: string): string {
  const toks = (text.replace(/[₀-₉]/gu, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d))).match(FORMULA_TOKEN_RE) ?? []).filter((tok) => !/^[IVXLCDM]+$/.test(tok))
  return [...new Set(toks)].sort().join(',')
}

function isDuplicate(c: Candidate, used: readonly Candidate[], kind?: QuestionKind): boolean {
  // Сравнение: определение второго термина («… называется полярной ковалентной связью») — не повтор первого,
  // даже если фразы почти одинаковы («одинаковой» ↔ «различной»).
  const otherSide = kind === 'compare' && c.definesTerm >= 0 && !used.some((u) => u.definesTerm === c.definesTerm)
  // Тот же факт другими словами: тот же набор формул или ≥ 3 общих смысловых понятия (≥ 60 % короткой фразы).
  const cSet = formulaSet(c.text)
  const cSpec = c.stems.filter((x) => x.length >= 3 && !isGenericStem(x))
  const sameFact = (u: Candidate) => {
    if (otherSide) return false
    if (cSet && cSet === formulaSet(u.text)) return true
    const uSpec = u.stems.filter((x) => x.length >= 3 && !isGenericStem(x))
    const shared = cSpec.filter((x) => uSpec.some((y) => stemsMatch(x, y))).length
    return shared >= 3 && shared / Math.max(1, Math.min(cSpec.length, uSpec.length)) >= 0.6
  }
  return used.some(
    (u) =>
      sameFact(u) ||
      u.text === c.text ||
      sameUtterance(u.text, c.text) ||
      (!otherSide && c.stems.length >= 3 && u.stems.length >= 3 && jaccard(c.stems, u.stems) >= 0.55) ||
      sameDefinedTerm(u, c),
  )
}

/**
 * Фраза уже прозвучала в прошлом ответе (строже, чем sameUtterance эхо-фильтра: «Коррозия – это разрушение …
 * окружающей среды» и «Химическая коррозия – это разрушение …, возникающее в результате …» — разные фразы).
 */
function saidAs(spoken: string, c: Candidate): boolean {
  const a = foldText(spoken).replace(/^(например|если проще|почему так\?)[:\s]*/u, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const b = foldText(c.text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  if (!a || !b) return false
  return a === b || (b.length >= 24 && a.includes(b)) || (a.length >= 24 && b.includes(a)) || jaccard(contentStems(spoken), c.stems) >= 0.8
}

/** Новых (не из вопроса и не из уже сказанного) неслужебных понятий во фразе — «добавляет ли она что-то». */
function novelty(c: Candidate, info: QuestionInfo, used: readonly Candidate[]): number {
  return c.stems.filter(
    (s) =>
      s.length >= 4 &&
      !isGenericStem(s) &&
      !info.concepts.some((k) => stemsMatch(k.stem, s)) &&
      !used.some((u) => u.stems.some((x) => stemsMatch(x, s))),
  ).length
}

function lowerFirst(text: string, lang: StemLang): string {
  const first = text[0]
  if (!first) return text
  if (lang === 'en' && /^[A-Z][a-z]/.test(text) && !/^(The|A|An|It|This|These|Such|Substances?|Atoms?|Oxides?|Acids?)\b/.test(text)) return text
  if (/^[\p{Lu}]{2}/u.test(text) || /^[A-Z][a-z]?\d/.test(text)) return text
  return first.toLowerCase() + text.slice(1)
}

/* ------------------------------------------------------------------- compose */

type Body = { sentences: string[]; used: Candidate[]; direct: Candidate; missingWhy: boolean }

function composeBody(
  cands: readonly Candidate[],
  picked: Picked,
  info: QuestionInfo,
  style: ComposeStyle,
  maxWords: number,
  avoid: readonly string[] = [],
): Body {
  const lang = info.lang
  const t = L[lang]
  const { kind, keyTerm } = info
  const detail = style.detail ?? 'brief'
  const used: Candidate[] = []
  const sentences: string[] = []
  let words = 0
  const perSentenceMax = detail === 'more' || style.channel === 'chat' ? 40 : style.simpler ? 20 : 26
  const add = (s: string, force = false): boolean => {
    const clean = ensureEnd(shortenForVoice(s, perSentenceMax))
    const w = countWords(clean)
    if (!force && words + w > maxWords && sentences.length > 0) return false
    sentences.push(clean)
    words += w
    return true
  }
  const { direct, second, missingWhy } = picked
  if (style.helper) add(t.helperLead, true)

  used.push(direct)
  // «Наличие этих свободных электронов обусловливает …» — «этих» отсылает к предыдущей фразе того же фрагмента: она идёт первой.
  if (lang === 'ru' && /^(\S+\s+){0,2}(этих|этого|этой|этим|этими)\s/iu.test(direct.text)) {
    const prev = cands.find((c) => c.hitIndex === direct.hitIndex && c.pos === direct.pos - 1 && !c.definesOther)
    if (prev && hasFiniteVerbRu(prev.text) && !/^(\S+\s+){0,2}(этих|этого|этой|этим|этими)\s/iu.test(prev.text)) {
      used.push(prev)
      add(prev.text, true)
    }
  }
  // Короткое определение («Связь, которая возникает между ионами, называется ионной») — без сути; предыдущая фраза того же
  // фрагмента про тот же термин (притяжение разноимённых ионов) идёт первой.
  if (lang === 'ru' && kind === 'definition' && direct.definesKey && direct.hitType === 'textbook' && contentStems(direct.text).length <= 7 && !style.simpler) {
    const prev = cands.find(
      (c) =>
        c.hitIndex === direct.hitIndex && c.pos === direct.pos - 1 && !used.includes(c) && !c.definesOther && !c.example && hasFiniteVerbRu(c.text) &&
        !DEICTIC_START_RE.test(c.text) && !DANGLING_RE.test(c.text) && info.keyStems.some((k) => c.stems.some((x) => x.length >= 4 && k.length >= 4 && x.startsWith(k.slice(0, 4)))),
    )
    if (prev) {
      used.push(prev)
      add(prev.text, true)
    }
  }
  const directText = reframeDefinition(direct.text, kind === 'compare' ? null : keyTerm, lang) ?? direct.text
  if (kind === 'example' && direct.example && !EXAMPLE_RE.test(direct.text.slice(0, 24))) add(`${t.exampleLead} ${lowerFirst(directText, lang)}`, true)
  else add(style.simpler ? `${t.simplerLead} ${lowerFirst(directText, lang)}` : directText, true)
  if (second) {
    used.push(second)
    add(second.text, true)
  }
  if (missingWhy) add(t.noWhy, true)

  // Объяснение: фразы той же темы, без повторов и чужих определений; ближе к прямому ответу — лучше.
  // Прямой ответ + не больше 1 поясняющей фразы голосом и 2 в чате (для «что такое» — 1 и пример);
  // «подробнее» — до 3.
  const chat = style.channel === 'chat'
  // Почему: голосом — только причина, в чате — причина и одно пояснение по тому же сказуемому.
  const explanationCount = style.simpler
    ? 0
    : detail === 'more'
      ? 3
      : kind === 'example'
        ? 0
        : kind === 'compare' && second
          ? chat ? 1 : 0
          : kind === 'why'
            ? chat ? 1 : second || /(потому что|так как|благодаря|обусловл|из-за|вследствие|позволя|because|chunki)/iu.test(direct.text) ? 0 : 1
            : kind === 'how' || kind === 'calc'
              ? chat ? 2 : 1
              : 1
  /** Уже сказано в прошлом ответе этого диалога (follow-up «пример», «почему», «подробнее»). */
  const said = (c: Candidate) => avoid.some((a) => saidAs(a, c))
  const ranked = cands
    .filter((c) => !used.includes(c) && c.score >= 0.8 && !c.imprecise && !c.definesOther && !c.offCondition)
    .filter((c) => !/^(Поэтому|Следовательно)\s/u.test(c.text) || (c.hitIndex === direct.hitIndex && c.pos === direct.pos + 1))
    // «На них не действуют …», «Они …» — продолжение чужой мысли; только сразу после прямого ответа.
    .filter((c) => !DEICTIC_START_RE.test(c.text) || (c.hitIndex === direct.hitIndex && c.pos === direct.pos + 1))
    // «… определяется в сравнении с ним» — отсылка к фразе, которой в ответе нет.
    .filter((c) => !DANGLING_RE.test(c.text) || used.some((u) => u.hitIndex === c.hitIndex && u.pos === c.pos - 1))
    .filter((c) => !(c.example && !c.definitional && kind !== 'how' && kind !== 'calc'))
    // Условие задачи («содержится оксид с 49,6 % марганца») — не объяснение.
    .filter((c) => kind === 'calc' || !/\d\s*%/u.test(c.text))
    // Обрывок с маленькой буквы («относительную молекулярную массу – Мг») — не самостоятельная фраза.
    .filter((c) => info.lang !== 'ru' || !/^[a-zа-яё]/u.test(c.text) || /^[a-z]{1,2}\s*[(=]|^pH/u.test(c.text))
    .map((c) => {
      let bonus = 0
      if (c.hitIndex === direct.hitIndex) bonus += 0.5
      if (c.hitIndex === direct.hitIndex && Math.abs(c.pos - direct.pos) === 1) {
        const sharesKey = info.keyStems.some((k) => c.stems.some((x) => x.length >= 3 && (x.startsWith(k.slice(0, 3)) || k.startsWith(x))))
        bonus += c.pos > direct.pos ? 0.9 : kind === 'definition' && sharesKey ? 1.2 : 0.4
      }
      if (kind === 'why' && c.causal) bonus += 0.6
      if ((kind === 'how' || kind === 'calc') && c.method) bonus += 0.5
      return { c, rank: c.score + bonus }
    })
    .sort((a, b) => b.rank - a.rank)
  // Пример — только из найденного (фраза с «например», реакцией или формулой) и по той же теме.
  const findExample = () =>
    cands.find(
      (c) =>
        c.example &&
        !used.includes(c) &&
        c.score > 1 &&
        !/^[a-zа-яё]/.test(c.text) &&
        !DEICTIC_START_RE.test(c.text) &&
        !DANGLING_RE.test(c.text) &&
        !RESTRICT_NEXT_RE.test(c.text) &&
        qualifierOk(info.query, c.text) &&
        !conditionedExample(c, cands) &&
        // Пример про сам термин, а не «сложное вещество … вода (H2O) – это соединение» с другим подлежащим.
        !(lang === 'ru' && (c.subjectOther || /\s[—–]\s*это\s/u.test(c.text))) &&
        c.formulas <= 6 &&
        (lang === 'ru' ? c.formulas >= 1 || REACTION_RE.test(c.text) || /(например|к примеру|такие как)/iu.test(c.text) : EXAMPLE_RE.test(c.text)) &&
        (c.keyAll || c.specific > 0 || c.hitIndex === direct.hitIndex) &&
        // «Например: отношение объёма … называется молярным объёмом» — определение, а не пример.
        (!/называ(ется|ются|ют)/u.test(c.text) || EXAMPLE_RE.test(c.text)) &&
        !(lang === 'ru' && /^[^:]{2,32}:\s*\p{Ll}/u.test(c.text) && c.hitType !== 'textbook') &&
        !looksLikeTaskNoise(c.text) &&
        (lang !== 'ru' || (isRealExample(c.text) && !isTelegraphicCard(c.text, c.hitType))) &&
        !(PROPERTY_RE.test(c.text) && !PROPERTY_RE.test(info.query)) &&
        !/(^|\s)(также|тоже)\s/u.test(c.text.replace(/а также/gu, '')) &&
        !(FILLER_RE.test(c.text) && !FILLER_RE.test(info.query)) &&
        // Пример из другого параграфа — только если он про сам термин (термин в начале фразы).
        (c.hitIndex === direct.hitIndex || c.keyInHead || !c.citation || !direct.citation || sectionOf(c.citation) === sectionOf(direct.citation)) &&
        !said(c) &&
        !isDuplicate(c, used, kind) &&
        !c.definesOther,
    )
  // Голосом «что такое»: определение + пример (если он есть в найденном) — пример нагляднее ещё одной фразы.
  const exampleInstead = !chat && detail !== 'more' && !style.helper && !style.simpler && kind === 'definition' && Boolean(findExample())
  let explained = exampleInstead ? explanationCount : 0
  for (const { c } of ranked) {
    if (explained >= explanationCount) break
    if (style.helper && explained >= 1) break
    // Сказали «точной причины нет» — чужие «поэтому …» (про другое свойство) дальше не приводим.
    if (missingWhy && (explained >= 1 || c.causal)) continue
    // Вторая и дальше фразы объяснения — только с понятиями вопроса (или сразу следом за прямым ответом).
    if (explained >= 1 && c.overlap < info.needed - 1e-9 && !(c.hitIndex === direct.hitIndex && c.pos === direct.pos + 1)) continue
    if (!onTopic(c, info, direct)) continue
    // «Как …?»: объяснение — способ, причина или продолжение той же мысли, а не свойства вещества.
    if ((kind === 'how' || kind === 'calc') && !c.method && !c.causal && !(c.hitIndex === direct.hitIndex && Math.abs(c.pos - direct.pos) <= 1 && c.hitType === 'textbook')) continue
    // «Как получают X?»: пояснение сохраняет сказуемое (получение), не свойства X («тримеризуется») и не «способы отличаются».
    if (kind === 'how' && lang === 'ru' && /получ|производ|синтез/iu.test(info.query)) {
      if (!/(получ|производ|синтез|добыва|→|=)/iu.test(c.text) || (/отлича\S*\s+от/iu.test(c.text) && !/отлича/iu.test(info.query))) continue
      if (info.keyStems.length && otherObtainedObject(c.text, info.keyStems)) continue
      if (info.keyStems.length === 1 && keyOnlyAsModifier(c.text, info.keyStems[0]!, lang)) continue
    }
    if (isDuplicate(c, used, kind) || said(c)) continue
    // Применение, производство, экология, «вы узнали» — не пояснение (если о них не спрашивали).
    if (FILLER_RE.test(c.text) && !FILLER_RE.test(info.query)) continue
    // «Кислоты, такие как …, также являются летучими» — «также» без предыдущей фразы в ответе.
    if (/(^|\s)(также|тоже)\s/u.test(c.text.replace(/а также/gu, '')) && !used.some((u) => u.hitIndex === c.hitIndex && u.pos === c.pos - 1)) continue
    if (lang === 'ru' && c.subjectOther && kind !== 'compare') continue
    // Сравнение: третья фраза — только с обоими терминами и словом противопоставления.
    if (kind === 'compare') {
      const cIdx = indexSentence(c.text)
      if (!CONTRAST_WORDS_RE.test(c.text) || !info.terms.every((term) => term.some((s) => hasStem(s, cIdx)))) continue
    }
    // Определение: пояснение из того же параграфа, что и определение (или про сам термин из справочной карточки).
    if (kind === 'definition' && c.citation && direct.citation && sectionOf(c.citation) !== sectionOf(direct.citation)) continue
    if (kind === 'definition' && PROPERTY_RE.test(c.text) && !PROPERTY_RE.test(info.query)) continue
    // Определение: пояснение — соседняя фраза или фраза, где подлежащее — сам термин («Эпоха классической химии …» — нет).
    if (kind === 'definition' && !adjacentTo(c, direct) && !(info.keyStems[0] && hasStem(info.keyStems[0], indexSentence(c.text.split(/\s+/)[0] ?? '')))) continue
    // Подпись рисунка/заголовок без сказуемого и телеграфная строка карточки — не фраза для ученика.
    if (lang === 'ru' && !hasFiniteVerbRu(c.text) && !/\s[—–]\s|[=→]/u.test(c.text)) continue
    if (isTelegraphicCard(c.text, c.hitType)) continue
    // Как/почему: пояснение не рядом с прямым ответом — только с понятием вопроса помимо термина (скорость, хранение).
    if ((kind === 'how' || kind === 'why') && !adjacentTo(c, direct) && info.specific.some((k) => !info.keyStems.includes(k.stem))) {
      const cIdx = indexSentence(c.text)
      if (!info.specific.some((k) => !info.keyStems.includes(k.stem) && conceptIn(k, cIdx))) continue
    }
    // Почему: пояснение сохраняет спрошенное сказуемое и не уходит в получение/выделение вещества.
    if (kind === 'why' && /(получа|получени|выделени)/iu.test(c.text) && !/(получа|получени|выделени)/iu.test(info.query)) continue
    // Причина уже названа парой «факт. Поэтому …» — пояснение без причины («азот малоактивен») лишь пересказывает вопрос.
    if (kind === 'why' && second?.causal && /^(Поэтому|Следовательно)\s/u.test(second.text) && !c.causal) continue
    // «Почему алкены вступают в реакции присоединения?»: пояснение про другой тип реакции («… окисления») — не по вопросу.
    if (kind === 'why' || kind === 'how') {
      const types = (text: string) => [...text.matchAll(/(окислени|присоединени|замещени|разложени|полимеризаци|гидролиз|восстановлени|этерификаци|гидрировани)/giu)].map((m) => m[1]!.toLowerCase())
      const asked = types(info.query)
      if (asked.length && types(c.text).some((ty) => !asked.includes(ty))) continue
    }
    if (kind === 'why' && adjacentTo(c, direct)) {
      const cIdx = indexSentence(c.text)
      if (!info.specific.some((k) => !info.keyStems.includes(k.stem) && conceptIn(k, cIdx)) && !/^(Поэтому|Это|Благодаря этому)\s/u.test(c.text)) continue
    }
    // «Примерами ярких достижений органической химии …» — не пояснение определения.
    if (/^Пример(ами|ом)\s/u.test(c.text)) continue
    // Строка-подпись карточки «В химии уже: вещество — …», «Обратимость: физические чаще …» — не фраза для ученика.
    if (lang === 'ru' && /^[^:]{2,32}:\s*\p{Ll}/u.test(c.text) && (c.hitType === 'card' || c.hitType === 'summary' || c.hitType === 'faq')) continue
    const adjacent = c.hitIndex === direct.hitIndex && Math.abs(c.pos - direct.pos) <= 1
    // «Что такое ионная связь?»: «По положению электронов … вещества делятся на …» — классификация, не пояснение.
    if (kind === 'definition' && !adjacent && !c.keyInHead) continue
    // Определение из другого § подтянуто для прямого ответа — его соседние факты («Единственный элемент, который не
    // образует оксид, — фтор») к ответу из урока не добавляем.
    if (kind === 'definition' && c.extra && c.hitIndex !== direct.hitIndex) continue
    // «Почему металлы проводят ток?»: «Металлы … отражают свет, поэтому блеск» — про другое свойство. Пояснение
    // должно касаться того, о чём спросили (не только термина), или продолжать причину.
    if (kind === 'why' && !adjacent) {
      const cIdx = indexSentence(c.text)
      if (!info.specific.some((k) => !info.keyStems.includes(k.stem) && conceptIn(k, cIdx))) continue
    }
    // Фраза должна добавлять новое (не пересказ вопроса и сказанного): «В науке эти изменения подразделяются на
    // физические и химические явления» после «Чем физические явления отличаются от химических» — нет.
    const continuation = c.hitIndex === direct.hitIndex && c.pos === direct.pos + 1
    if (novelty(c, info, used) < (continuation || kind === 'how' || kind === 'calc' ? 1 : 2)) continue
    if (c.hitIndex !== direct.hitIndex && c.overlap < Math.min(0.5, info.needed) - 1e-9 && !c.keyAll) continue
    // Без термина вопроса — только соседняя фраза того же фрагмента (продолжение мысли).
    if (info.keyStems.length && !c.keyAll && !(c.hitIndex === direct.hitIndex && Math.abs(c.pos - direct.pos) <= 2) && !(c.titleKey && c.overlap >= 0.5)) continue
    const base = reframeDefinition(c.text, keyTerm, lang) ?? c.text
    const text = kind === 'why' && !c.causal && explained === 0 && !direct.causal && !missingWhy ? `${t.why} ${base}` : base
    if (!add(text)) continue
    used.push(c)
    explained++
  }

  // Голосом пример — вместо поясняющей фразы (не вдобавок), в чате — после неё.
  if (!style.helper && kind !== 'example' && (kind === 'definition' || kind === 'general' || style.wantExample) && (chat || detail === 'more' || explained === 0 || exampleInstead)) {
    const ex = findExample()
    if (ex) {
      const already = EXAMPLE_RE.test(ex.text.slice(0, 24))
      // «Например: среди трех изотопов углерода, например, 12C …» — второе «например» лишнее.
      const exText = already ? ex.text : `${t.exampleLead} ${lowerFirst(ex.text.replace(/,\s*(например|к примеру),\s*/iu, ' '), lang)}`
      if (add(exText)) used.push(ex)
    }
  }
  if (kind === 'example' && !direct.example) add(t.noExample, true)
  return { sentences, used, direct, missingWhy }
}

function checkQuestion(info: QuestionInfo, style: ComposeStyle, seed: number, missingWhy: boolean, originalQuery: string, answer = ""): string {
  const t = L[info.lang]
  const term = info.keyTerm && info.keyTerm.length <= 40 ? info.keyTerm : null
  if (style.helper && term) return t.helperAsk(term)
  const whyRest =
    whyRemainder(originalQuery) ??
    (info.kind === 'why' && !missingWhy && !WHAT_IS_RE.test(originalQuery) && originalQuery.split(/\s+/).length <= 6
      ? originalQuery.trim().replace(/[?!.]+$/, '')
      : null)
  if (whyRest && !missingWhy) return t.checkWhy(whyRest)
  if (info.kind === 'definition' && term) return pick(t.checks, seed)(term)
  if (info.composition) return t.checkComposition
  // «Перечисли факторы» — только если в ответе есть перечень (≥ 3 пункта через запятую), иначе — пересказ.
  if (info.factors) return answer && !/[^.]*,[^.]*,[^.]*/u.test(answer) ? t.checkHow : t.checkFactors
  if (info.kind === 'how' || info.kind === 'calc') return t.checkHow
  // «Какие бывают оксиды?», «виды связи» — перечень групп, а не отличие двух понятий.
  if (info.kind === 'compare' && (info.terms.length < 2 || /какие\s+(бывают|есть)|виды|типы|классифик|types|turlari/iu.test(originalQuery))) return t.checkClassify
  if (info.kind === 'compare') return t.checkCompare
  // «Ещё один пример» — только после названного примера.
  if (info.kind === 'example') return answer.includes(t.noExample) ? t.checkGeneric : t.checkExample
  return t.checkGeneric
}

function noAnswer(input: ComposeInput, info: QuestionInfo, glossary: readonly GlossPair[]): ComposedAnswer {
  const t = L[input.lang]
  const parts: string[] = [t.noAnswer(shortQuery(input.query))]
  // Предложение близкой темы — только по смысловому слову вопроса («правило Хунда» → не «Правило Вант-Гоффа»).
  const topical = info.specific.filter((c) => !SUGGEST_STOP_RE.test(c.stem))
  const hitIdx = input.lang === 'ru' ? input.hits.map((h) => indexSentence(`${h.title} ${h.text}`)) : []
  const offDomain = input.lang === 'ru' && OFF_DOMAIN_RE.test(foldText(input.query)) && !topical.some((c) => hitIdx.some((idx) => conceptIn(c, idx)))
  const related = offDomain
    ? undefined
    : input.hits.find(
        (h) =>
          !SERVICE_TYPES.has(h.type ?? '') &&
          cleanTitle(h.title).length >= 4 &&
          !/ошибка|чек-лист/i.test(h.title) &&
          (input.lang !== 'ru' || topical.some((c) => conceptIn(c, indexSentence(cleanTitle(h.title))))),
      )
  if (offDomain) parts.splice(0, 1, L.ru.offDomain(shortQuery(input.query)))
  if (related) {
    const title = cleanTitle(related.title)
    if (input.lang === 'ru') parts.push(t.related(title))
    else {
      const local = glossary.find((g) => title.toLowerCase().includes(g.ru.toLowerCase()))
      // «Нет ответа на „Mol nima“ … но могу рассказать про „mol“» — противоречие: термин самого вопроса не предлагаем.
      const asked = local ? phraseIn(local.local, indexSentence(input.query)) : false
      parts.push(local && !asked ? t.related(local.local) : t.relatedGeneric)
    }
  } else if (input.topicHint) {
    if (input.lang === 'ru') parts.push(t.topic(cleanTitle(input.topicHint)))
    else parts.push(t.relatedGeneric)
  }
  if (input.suggestSmartAi) parts.push(t.smartAi)
  return { text: parts.join(' '), sentences: parts, confident: false, usedTitles: related && input.lang === 'ru' ? [related.title] : [], keyTerm: info.keyTerm }
}

/* ------------------------------------------------------------ en/uz support */

type GlossPair = { ru: string; local: string; alts: string[]; source?: string; formula?: string }

/** Пары глоссария из hit type 'glossary': строки «ru<TAB>local1|local2[<TAB>source<TAB>formula]». */
function readGlossary(hits: readonly KnowledgeHitLike[]): GlossPair[] {
  const out: GlossPair[] = []
  for (const h of hits) {
    if (h.type !== 'glossary') continue
    for (const line of h.text.split('\n')) {
      const [ru, local, source, formula] = line.split('\t')
      if (!ru || !local) continue
      const alts = local.split('|').map((s) => s.trim()).filter(Boolean)
      if (alts.length) out.push({ ru: ru.trim(), local: alts[0]!, alts, source: source || undefined, formula: formula || undefined })
    }
  }
  return out
}

const phraseStems = (phrase: string) => tokenizeWords(phrase).filter((w) => w.length >= 2).map(strictStem)

function phraseIn(phrase: string, idx: SentenceIndex): boolean {
  const stems = phraseStems(phrase)
  return stems.length > 0 && stems.every((s) => (s.length <= 3 ? idx.words.includes(s) : hasStem(s, idx)))
}

/** Русский запрос из терминов глоссария, найденных в вопросе на en/uz. */
function translateQuery(info: QuestionInfo, glossary: readonly GlossPair[]): string | null {
  const idx = indexSentence(info.query)
  const found = glossary
    .filter((g) => g.alts.some((a) => phraseIn(a, idx)))
    .sort((a, b) => b.ru.length - a.ru.length)
  const ru: Array<{ term: string; at: number }> = []
  const folded = foldText(info.query)
  // Порядок терминов — как в вопросе («How is ammonia produced in industry» → «аммиак промышленность»): первый — тема.
  const position = (g: GlossPair) => Math.min(...g.alts.map((a) => folded.indexOf(phraseStems(a)[0] ?? a)).filter((i) => i >= 0), 999)
  for (const g of found) if (!ru.some((r) => r.term.includes(g.ru.toLowerCase()))) ru.push({ term: g.ru.toLowerCase(), at: position(g) })
  if (ru.length === 0) return null
  ru.sort((a, b) => a.at - b.at)
  const body = ru.slice(0, 4).map((r) => r.term).join(' ')
  switch (info.kind) {
    case 'definition':
      return `что такое ${body}`
    case 'why':
      return `почему ${body}`
    case 'example':
      return `пример ${body}`
    case 'how':
      // «How is ammonia produced» → «как получают аммиак»: сказуемое вопроса сохраняем.
      return /produc|obtain|prepar|made|synthes|olin|ishlab\s+chiqar|hosil\s+qilin/iu.test(info.query) ? `как получают ${body}` : `как ${body}`
    default:
      return body
  }
}

function bookLabel(hit: KnowledgeHitLike | undefined): string | null {
  const m = hit?.citation?.match(/Kimyo\s*\d+/)
  return m ? m[0] : null
}

/** Термины глоссария (на языке ученика), встреченные в русском тексте; без самого термина вопроса. */
function glossTerms(text: string, glossary: readonly GlossPair[], skipStems: readonly string[], max: number, formulaOnly = false): string[] {
  const idx = indexSentence(text)
  const terms: string[] = []
  for (const g of [...glossary].sort((a, b) => b.ru.length - a.ru.length)) {
    if (!phraseIn(g.ru, idx)) continue
    if (skipStems.length && phraseStems(g.local).some((s) => skipStems.some((k) => stemsMatch(k, s)))) continue
    const label = formulaOnly && g.formula ? g.formula : g.formula && g.source !== 'core' ? `${g.local} (${g.formula})` : g.local
    if (terms.some((x) => x.toLowerCase().includes(g.local.toLowerCase()) || x === label)) continue
    terms.push(label)
    if (terms.length >= max) break
  }
  return terms
}

/** «Катализатор — …» второй раз: «It …» (без повторного определения термина). */
function pronounForm(c: Candidate, lang: StemLang): string | null {
  const m = c.text.match(/^(.{2,40}?)\s[—–]\s(.+)$/u)
  if (!m) return null
  return `${L[lang].pronoun} ${lowerFirst(m[2]!, lang)}`
}

function composeForeign(input: ComposeInput, info: QuestionInfo, style: ComposeStyle, maxWords: number): ComposedAnswer {
  const lang = input.lang
  const t = L[lang]
  const seed = input.seed ?? 0
  const glossary = readGlossary(input.hits)
  // Фразы на языке ученика: переводы из базы (type 'i18n') или фрагменты, целиком написанные на en/uz
  // (не строка «English: Silver.» внутри русской карточки).
  const allNative = input.hits.filter((h) => {
    if (h.type === 'glossary') return false
    if (h.type === 'i18n') return true
    const st = letterStats(h.text)
    return st.letters > 0 && st.lat / st.letters >= 0.6
  })
  // Выверенные переводы определений учебника (i18n с подписью источника) — без машинных фраз из тестов рядом.
  const coreHits = allNative.filter((h) => h.type === 'i18n' && h.citation)
  const nativeHits = coreHits.length ? coreHits : allNative
  // Самый длинный термин глоссария в вопросе — тема («kislotali oksid», а не «kislota»).
  {
    const qIdx = indexSentence(info.query)
    const longest = glossary
      .flatMap((g) => g.alts.filter((a) => phraseIn(a, qIdx)))
      .sort((a, b) => phraseStems(b).length - phraseStems(a).length)[0]
    const stems = longest ? phraseStems(longest).filter((st) => st.length >= 3) : []
    if (longest && stems.length > info.keyStems.length && info.keyStems.every((k) => stems.some((st) => stemsMatch(st, k)))) {
      info.keyTerm = longest.toLowerCase()
      info.keyStems = stems
    }
  }
  const native = buildCandidates(nativeHits, info, style)
  input.debug?.(native)
  const nativeRaw = pickDirect(native, info)
  // «Urush tuzlari … tuzlardir» на «Tuz nima?» — определение подвида, а не термина: не ответ.
  // «Kislotali oksidga misol»: вместо примера — определение другого термина; лучше пример из русского учебника.
  const nativePick =
    nativeRaw && ((info.kind === 'definition' && !nativeRaw.direct.definesKey) || (info.kind === 'example' && !nativeRaw.direct.example)) ? null : nativeRaw

  // Русский учебник: тот же вопрос, переведённый терминами глоссария.
  const ruHits = input.hits.filter((h) => h.type !== 'glossary' && h.type !== 'source-quote' && !allNative.includes(h))
  // Фраза учебника, которую переводит выверенное утверждение, — цитата по умолчанию для него.
  const sourceQuote = input.hits.find((h) => h.type === 'source-quote' && coreHits.some((c) => c.title === h.title))
  const ruQuery = translateQuery(info, glossary)
  const ruInfo = ruQuery ? analyzeQuestion(ruQuery, 'ru', style) : null
  if (ruInfo && info.kind !== ruInfo.kind) ruInfo.kind = info.kind
  const ruCands = ruInfo ? buildCandidates(ruHits, ruInfo, style) : []
  const ruPick = ruInfo ? pickDirect(ruCands, ruInfo) : null
  const ruBody = ruPick && ruInfo ? composeBody(ruCands, ruPick, ruInfo, { ...style, detail: 'brief' }, 45) : null

  const quoteWords = (style.detail ?? 'brief') === 'more' ? 40 : 24
  // Цитата — одна фраза учебника (не строка карточки «Название: …»): прямой ответ или причина/определение из ответа.
  const quoteCand = ruBody
    ? [ruBody.direct, ...ruBody.used].find(
        (c) =>
          (c.hitType === 'textbook' || c.hitType === 'definition') &&
          (!c.example || c === ruBody.direct) &&
          // Цитата подтверждает ответ: определение термина, причина по вопросу, иначе хотя бы термин вопроса.
          (info.kind === 'definition'
            ? c.definesKey && c.exactKey
            : info.kind === 'why'
              ? c.causal && c.overlap >= 0.5 && c.keyAll
              : info.kind === 'compare'
                ? c.definesTerm >= 0
                : c.keyAll),
      )
    : undefined
  const quoteText = quoteCand ? ensureEnd(quoteCand.text) : ''
  const quote = sourceQuote
    ? t.quote(bookLabel(sourceQuote), ensureEnd(sourceQuote.text))
    : quoteText && quoteCand
      ? t.quote(bookLabel(ruHits[quoteCand.hitIndex]), shortenForVoice(quoteText, quoteWords).replace(/[.]$/, '.'))
      : ''

  const sentences: string[] = []
  const usedTitles: string[] = []
  if (nativePick) {
    const body = composeBody(native, nativePick, info, style, Math.max(20, maxWords - (quote ? countWords(quote) : 0)))
    // Второе «X — …» после определения X звучит как «It …», а не как повтор определения.
    const extra = native.filter((c) => !body.used.includes(c) && c.exactKey && body.direct.definesKey && c.hitType === 'i18n')
    if (body.missingWhy && ruBody && !ruBody.missingWhy) {
      // Причина есть в русском учебнике: факт на языке ученика + ключевые термины + цитата с причиной.
      sentences.push(body.sentences[0]!)
      // Причина — в цитате учебника ниже (без перечня терминов).
    } else sentences.push(...body.sentences)
    // Нет готового примера на языке ученика: называем вещества из русского примера учебника (перевод глоссария).
    const noEx = sentences.indexOf(t.noExample)
    if (noEx >= 0 && ruBody) {
      const substances = glossary.filter((g) => g.formula && (g.source === 'element' || g.source === 'compound' || g.source === 'core'))
      const exSource = ruCands.find((c) => c.keyAll && !c.definesOther && c.score > 0.6 && glossTerms(c.text, substances, info.keyStems, 1).length > 0)
      const exTerms = exSource ? glossTerms(exSource.text, substances, info.keyStems, 3, lang === 'uz') : []
      if (exTerms.length) sentences[noEx] = t.exampleTerms(exTerms.join(', '))
    }
    if (body.used.length < 2 && extra[0]) {
      const p = pronounForm(extra[0], lang)
      if (p && !sentences.some((s) => sameUtterance(s, p))) sentences.push(ensureEnd(p))
    }
    if (quote) sentences.push(quote)
    // Подпись источника — у той фразы учебника, что процитирована.
    if (sourceQuote) usedTitles.push(sourceQuote.title)
    else if (quoteCand) usedTitles.push(quoteCand.title)
    usedTitles.push(...body.used.filter((c) => c.hitType !== 'i18n' || nativeHits[c.hitIndex]?.citation).map((c) => c.title))
  } else if (ruBody && ruBody.direct) {
    // Перевода нет: честно говорим, что ответ есть только в русском учебнике, и цитируем его (без перечня терминов).
    // Русский путь нашёл ответ, но строгая цитата не подошла — цитируем сам прямой ответ (фразу учебника), а не отказываем.
    const direct = ruBody.direct
    // Выверенная цитата (source-quote) относится к переводу, которого в ответе нет («Кислоты – …» на «кислотный оксид»).
    const ruQuote = sourceQuote ? (quoteText && quoteCand ? t.quote(bookLabel(ruHits[quoteCand.hitIndex]), shortenForVoice(quoteText, quoteWords)) : '') : quote
    const directQuote =
      !ruQuote && !ruBody.missingWhy && !direct.offCondition && (direct.hitType === 'textbook' || direct.hitType === 'definition') && !isTelegraphicCard(direct.text, direct.hitType)
        ? t.quote(bookLabel(ruHits[direct.hitIndex]), shortenForVoice(ensureEnd(direct.text), quoteWords))
        : ''
    const finalQuote = ruQuote || directQuote
    if (!finalQuote) return noAnswer(input, info, glossary)
    sentences.push(t.onlyRussian)
    // Уравнение реакции из ответа учебника понятно на любом языке.
    const equation = [direct, ...ruBody.used]
      .map((c) => c.text.match(/(?:\d*[A-Z][A-Za-z0-9₀-₉()]*\s*\+\s*)+\d*[A-Z][A-Za-z0-9₀-₉()]*\s*(?:→|=|⇌)\s*[^.;:,а-яё]+/u)?.[0]?.trim())
      .find((eq) => eq && isBalancedEquation(eq))
    if (equation && !finalQuote.includes(equation)) sentences.push(t.equation(equation.replace(/\s*[.;]$/, '')))
    // «Пример кислотного оксида»: формулы из примера учебника (того же класса) — без перевода.
    if (info.kind === 'example' && !equation) {
      const formulas = [...new Set(direct.text.match(FORMULA_TOKEN_RE) ?? [])].filter((f) => atomCounts(f) && formulaClassOk(info.query, f)).slice(0, 4)
      if (formulas.length) sentences.push(t.exampleTerms(formulas.join(', ')))
    }
    if (ruBody.missingWhy) sentences.push(t.noWhy)
    sentences.push(finalQuote)
    usedTitles.push(...(directQuote ? [direct.title] : []), ...ruBody.used.map((c) => c.title))
  } else {
    return noAnswer(input, info, glossary)
  }
  if (!style.noCheckQuestion) sentences.push(capitalizeFirst(checkQuestion(info, style, seed, Boolean(ruBody?.missingWhy && !nativePick), input.query, sentences.join(" "))))
  return { text: sentences.join(' '), sentences, confident: true, usedTitles: [...new Set(usedTitles)], keyTerm: info.keyTerm }
}

/* ---------------------------------------------------------------- calc solver */

/** Школьные округлённые относительные атомные массы (как в задачах Kimyo 7–11). */
const AR: Record<string, number> = {
  H: 1, C: 12, N: 14, O: 16, Na: 23, Mg: 24, Al: 27, Si: 28, P: 31, S: 32, Cl: 35.5, K: 39, Ca: 40, Fe: 56, Cu: 64, Zn: 65,
}
/** Название вещества в вопросе (ru/en/uz) → формула (только частые школьные вещества). */
const SUBSTANCE_FORMULAS: Array<[RegExp, string]> = [
  [/(?<!\p{L})вод[аыуе](?!\p{L})|(?<!\p{L})water(?!\p{L})|(?<!\p{L})suv/u, 'H2O'],
  [/углекисл\S*\s+газ|оксид\S*\s+углерода\s*\(IV\)|carbon\s+dioxide|karbonat\s+angidrid|uglerod\s*\(IV\)\s*oksid/u, 'CO2'],
  [/серн\S*\s+кислот|sulfuric\s+acid|sulfat\s+kislota/u, 'H2SO4'],
  [/солян\S*\s+кислот|хлороводород|hydrochloric\s+acid|hydrogen\s+chloride|xlorid\s+kislota/u, 'HCl'],
  [/аммиак|ammonia|ammiak/u, 'NH3'], [/метан(?!ол)|methane|metan(?!ol)/u, 'CH4'], [/азотн\S*\s+кислот|nitric\s+acid|nitrat\s+kislota/u, 'HNO3'],
  [/фосфорн\S*\s+кислот|phosphoric\s+acid|fosfat\s+kislota/u, 'H3PO4'], [/поварен\S*\s+сол|хлорид\S*\s+натрия|sodium\s+chloride|osh\s+tuzi|natriy\s+xlorid/u, 'NaCl'],
  [/гидроксид\S*\s+натрия|sodium\s+hydroxide|natriy\s+gidroksid/u, 'NaOH'],
  [/карбонат\S*\s+кальция|(?<!\p{L})мел[аеу]?(?!\p{L})|calcium\s+carbonate|kalsiy\s+karbonat/u, 'CaCO3'], [/оксид\S*\s+кальция|calcium\s+oxide|kalsiy\s+oksid/u, 'CaO'],
  [/глюкоз|glucose|glyukoza/u, 'C6H12O6'], [/этанол|этилов\S*\s+спирт|ethanol|etanol|etil\s+spirt/u, 'C2H5OH'],
  [/(?<!\p{L})кислород[аеу]?(?!\p{L})|(?<!\p{L})oxygen(?!\p{L})|(?<!\p{L})kislorod/u, 'O2'], [/(?<!\p{L})водород[аеу]?(?!\p{L})|(?<!\p{L})hydrogen(?!\p{L})|(?<!\p{L})vodorod/u, 'H2'],
  [/(?<!\p{L})азот[аеу]?(?!\p{L})|(?<!\p{L})nitrogen(?!\p{L})|(?<!\p{L})azot(?!\p{L})/u, 'N2'],
]
/** Элемент в вопросе о массовой доле: «массовая доля кислорода», «mass fraction of oxygen», «kislorodning massa ulushi». */
const ELEMENT_NAMES: Array<[RegExp, string]> = [
  [/водород|hydrogen|vodorod/u, 'H'], [/углерод|carbon|uglerod/u, 'C'], [/азот(?!н)|nitrogen|azot/u, 'N'], [/кислород|oxygen|kislorod/u, 'O'],
  [/натри|sodium|natriy/u, 'Na'], [/магни|magnesium|magniy/u, 'Mg'], [/алюмини|alumin|alyuminiy/u, 'Al'], [/кремни|silicon|kremniy/u, 'Si'],
  [/фосфор|phosphorus|fosfor/u, 'P'], [/(?<!\p{L})сер[ыа](?!\p{L})|sulfur|oltingugurt/u, 'S'], [/(?<!\p{L})хлор[аеу]?(?!\p{L})|chlorine|(?<!\p{L})xlor(?!\p{L})/u, 'Cl'],
  [/(?<!\p{L})кали[яй]|potassium|(?<!\p{L})kaliy/u, 'K'], [/кальци|calcium|kalsiy/u, 'Ca'], [/железа|iron|temir/u, 'Fe'], [/(?<!\p{L})мед[иь]|copper|(?<!\p{L})mis(?!\p{L})/u, 'Cu'],
  [/цинк|zinc|(?<!\p{L})rux/u, 'Zn'],
]
const fmtNum = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

/** Формула вещества из вопроса: явная запись («CO2», «H2SO4») или школьное название. */
function questionFormula(query: string, folded: string): string | null {
  const explicit = (query.match(/(?<![\p{L}\d])(?:[A-Z][a-z]?\d*|\((?:[A-Z][a-z]?\d*)+\)\d*){1,6}(?![\p{L}\d])/gu) ?? []).find((f) => /\d|[A-Z].*[A-Z]/.test(f) && atomCounts(f))
  return explicit ?? SUBSTANCE_FORMULAS.find(([re]) => re.test(folded))?.[1] ?? null
}

function molarOf(formula: string): { M: number; atoms: Map<string, number>; parts: string; nums: string } | null {
  const atoms = atomCounts(formula)
  if (!atoms || [...atoms.keys()].some((el) => AR[el] === undefined)) return null
  return {
    atoms,
    M: [...atoms].reduce((acc, [el, n]) => acc + n * AR[el]!, 0),
    parts: [...atoms].map(([el, n]) => (n > 1 ? `${n}·Ar(${el})` : `Ar(${el})`)).join(' + '),
    nums: [...atoms].map(([el, n]) => (n > 1 ? `${n}·${fmtNum(AR[el]!)}` : fmtNum(AR[el]!))).join(' + '),
  }
}

const CALC_UNITS = {
  ru: { gmol: 'г/моль', g: 'г', mol: 'моль' },
  en: { gmol: 'g/mol', g: 'g', mol: 'mol' },
  uz: { gmol: 'g/mol', g: 'g', mol: 'mol' },
} as const

/** Расчётный вопрос по формулировке (молярная масса, массовая доля, число с единицей) — на любом языке. */
const CALC_INTENT_RE =
  /(молярн\S*\s+масс|молекулярн\S*\s+масс|массов\S*\s+дол|molar\s+mass|molecular\s+mass|mass\s+fraction|molyar\s+massa|molekulyar\s+massa|massa\s+ulush|\d\s*(г|грамм\S*|моль|л|g|grams?|mol|moles?)(?![\p{L}]))/u

/**
 * Расчётные вопросы: подставляем числа вопроса в школьную формулу и показываем ход решения.
 * Правило из найденного текста (если есть) — первой фразой; числа — только из вопроса и таблицы Ar.
 */
function solveCalc(info: QuestionInfo, cands: readonly Candidate[]): { sentences: string[]; used: Candidate[] } | null {
  const q = foldText(info.query)
  const lang = info.lang
  const u = CALC_UNITS[lang]
  const ruleOf = (c: Candidate | undefined) => (c && lang === 'ru' ? [ensureEnd(c.text)] : [])
  // Без правила — подпись к фрагменту учебника с тем же понятием (молярная масса, массовая доля), а не пустой ответ без источника.
  const cite = (rule: Candidate | undefined, re: RegExp) => (rule ? [rule] : cands.filter((c) => (c.hitType === 'textbook' || c.hitType === 'definition') && re.test(c.text)).slice(0, 1))
  // 0) Массовая доля элемента в веществе: ω(E) = n·Ar(E) / Mr · 100 %.
  if (/массов\S*\s+дол|mass\s+fraction|massa\s+ulush/u.test(q)) {
    const el = ELEMENT_NAMES.find(([re]) => re.test(q))
    const rest = el ? q.replace(new RegExp(el[0].source, 'gu'), ' ') : q
    const formula = el ? questionFormula(info.query, rest) : null
    const mol = formula ? molarOf(formula) : null
    const n = el && mol ? mol.atoms.get(el[1]) : undefined
    if (el && formula && mol && n && mol.atoms.size > 1) {
      // Правило — фраза со сказуемым («равна», «отношение»), а не сплющенная легенда формулы («ω (E) – … n – … Ar (E) – …»).
      const rule = cands.find(
        (c) => /(ω|w)\s*\(|массов\S*\s+дол/u.test(c.text) && /(равн|отношени)/u.test(c.text) && (c.text.match(/\s[–—-]\s/gu) ?? []).length < 2 && !/\d\s*%/u.test(c.text),
      )
      const share = ((n * AR[el[1]]!) / mol.M) * 100
      const k = n > 1 ? `${n}·` : ''
      return {
        sentences: [
          ...ruleOf(rule),
          `Mr(${formula}) = ${mol.nums} = ${fmtNum(mol.M)}.`,
          `ω(${el[1]}) = ${k}Ar(${el[1]}) / Mr(${formula}) · 100% = ${k}${fmtNum(AR[el[1]]!)} / ${fmtNum(mol.M)} · 100% ≈ ${fmtNum(Math.round(share * 10) / 10)}%.`,
        ],
        used: cite(rule, /массов\S*\s+дол/u),
      }
    }
  }
  // 0б) Количество вещества по массе: n = m / M.
  const gramsM = q.match(/(\d+(?:[,.]\d+)?)\s*(?:г|грамм\S*|g|grams?|gramm)(?![\p{L}])/u)
  const grams = gramsM ? Number(gramsM[1]!.replace(',', '.')) : null
  if (grams !== null && /(сколько\s+моль|количеств\S*\s+веществ|число\s+моль|how\s+many\s+moles?|amount\s+of\s+substance|necha\s+mol|modda\s+miqdor)/u.test(q) && !/%|раствор|solution|eritma/u.test(q)) {
    const formula = questionFormula(info.query, q)
    const mol = formula ? molarOf(formula) : null
    if (formula && mol) {
      const rule = cands.find((c) => /n\s*=\s*m\s*\/?\s*M|m\s*=\s*n\s*[·•*×]?\s*M/u.test(c.text) && !/\d\s*%/u.test(c.text))
      return {
        sentences: [
          ...ruleOf(rule),
          `M(${formula}) = ${mol.nums} = ${fmtNum(mol.M)} ${u.gmol}.`,
          `n = m / M = ${fmtNum(grams)} ${u.g} : ${fmtNum(mol.M)} ${u.gmol} = ${fmtNum(grams / mol.M)} ${u.mol}.`,
        ],
        used: cite(rule, /количеств\S*\s+веществ|молярн\S*\s+масс/u),
      }
    }
  }
  // 1) Относительная молекулярная / молярная масса вещества: Mr = сумма Ar.
  if (/молекулярн\S*\s+масс|молярн\S*\s+масс|molar\s+mass|molecular\s+(mass|weight)|molyar\s+massa|molekulyar\s+massa/u.test(q) && !/\d\s*(г|g|моль|mol)(?![\p{L}])/u.test(q)) {
    const rule = cands.find((c) => /(сумм|складыва)/iu.test(c.text) && /атомн/iu.test(c.text) && /масс/iu.test(c.text))
    const formula = questionFormula(info.query, q)
    const mol = formula ? molarOf(formula) : null
    if (!formula || !mol) return null
    const molar = /молярн|molar|molyar/u.test(q)
    const line = `${molar ? 'M' : 'Mr'}(${formula}) = ${mol.parts} = ${mol.nums} = ${fmtNum(mol.M)}${molar ? ` ${u.gmol}` : ''}.`
    return { sentences: [...ruleOf(rule), line], used: cite(rule, /молярн\S*\s+масс|молекулярн\S*\s+масс/u) }
  }
  if (lang !== 'ru') return null
  // 2) Масса растворённого вещества: m(в-ва) = w · m(р-ра).
  const mass = q.match(/(\d+(?:[,.]\d+)?)\s*(?:г|грамм\S*)(?![\p{L}])/u)
  const percent = q.match(/(\d+(?:[,.]\d+)?)\s*%/u)
  if (mass && percent && /сколько\s+грамм|какую\s+массу|масс\S*\s+(соли|вещества|сахара)/u.test(q)) {
    const rule = cands.find((c) => /(w|ω)\s*[·•*×]?\s*m\s*\(|массов\S*\s+дол|процентн\S*\s+концентрац/iu.test(c.text) && /раствор|р-ра/iu.test(c.text))
    if (!rule) return null
    const mSol = Number(mass[1]!.replace(',', '.'))
    const w = Number(percent[1]!.replace(',', '.')) / 100
    const solute = /сахар/u.test(q) ? 'сахара' : /сол/u.test(q) ? 'соли' : 'в-ва'
    const mSolute = mSol * w
    return {
      sentences: [
        ensureEnd(rule.text),
        `m(${solute}) = w · m(р-ра) = ${fmtNum(w)} · ${fmtNum(mSol)} г = ${fmtNum(mSolute)} г.`,
        `Воды нужно: ${fmtNum(mSol)} г − ${fmtNum(mSolute)} г = ${fmtNum(mSol - mSolute)} г.`,
      ],
      used: [rule],
    }
  }
  // 3) Газ при н. у.: V = n · Vm (объём по количеству) и n = V / Vm (количество по объёму) — по правилу «22,4 л».
  const num = (re: RegExp) => {
    const m = q.match(re)
    return m ? Number(m[1]!.replace(',', '.')) : null
  }
  const moles = num(/(\d+(?:[,.]\d+)?)\s*моль(?!\p{L})/u)
  const litres = num(/(\d+(?:[,.]\d+)?)\s*(?:л|литр\S*|дм3|дм³)(?![\p{L}\d])/u)
  const vmRule = () => cands.find((c) => /22[,.]4/u.test(c.text) && /(объ[её]м|л\/моль|молярн)/iu.test(c.text) && !/\d\s*%/u.test(c.text))
  if (moles !== null && /объ[её]м/u.test(q) && !/раствор/u.test(q)) {
    const rule = vmRule()
    if (!rule) return null
    return {
      sentences: [ensureEnd(rule.text), `V = n · Vm = ${fmtNum(moles)} моль · 22,4 л/моль = ${fmtNum(moles * 22.4)} л.`],
      used: [rule],
    }
  }
  if (litres !== null && /(количеств\S*\s+веществ|сколько\s+моль|число\s+моль)/u.test(q)) {
    const rule = vmRule()
    if (!rule) return null
    return {
      sentences: [ensureEnd(rule.text), `n = V / Vm = ${fmtNum(litres)} л : 22,4 л/моль ≈ ${fmtNum(litres / 22.4)} моль.`],
      used: [rule],
    }
  }
  // 4) Масса по количеству вещества: m = n · M, M = сумма Ar (формула или название вещества из вопроса).
  if (moles !== null && /масс/u.test(q)) {
    const formula = info.query.match(/\b(?:[A-Z][a-z]?\d*){1,6}\b/u)?.[0] ?? SUBSTANCE_FORMULAS.find(([re]) => re.test(q))?.[1]
    const atoms = formula ? atomCounts(formula) : null
    const rule = cands.find((c) => /(m\s*=\s*n\s*[·•*×]?\s*M|молярн\S*\s+масс)/iu.test(c.text) && !/\d\s*%/u.test(c.text))
    if (!rule || !formula || !atoms || [...atoms.keys()].some((el) => AR[el] === undefined)) return null
    const M = [...atoms].reduce((acc, [el, n]) => acc + n * AR[el]!, 0)
    return {
      sentences: [ensureEnd(rule.text), `M(${formula}) = ${fmtNum(M)} г/моль; m = n · M = ${fmtNum(moles)} моль · ${fmtNum(M)} г/моль = ${fmtNum(moles * M)} г.`],
      used: [rule],
    }
  }
  return null
}

export function composeLocalAnswer(input: ComposeInput): ComposedAnswer {
  const lang = input.lang
  const style = input.style ?? {}
  const seed = input.seed ?? 0
  const detail = style.detail ?? 'brief'
  const maxWords = style.maxWords ?? (detail === 'more' ? 140 : style.simpler ? 50 : 60)
  const info = analyzeQuestion(input.query, lang, style, input.topicHint)

  // Расчёт по формулировке вопроса — на любом языке (числа из вопроса, Ar из таблицы, правило учебника — если найдено).
  if ((info.kind === 'calc' || CALC_INTENT_RE.test(foldText(input.query))) && !style.helper && !style.continuation) {
    const calcCands = buildCandidates(input.hits.filter((h) => h.type !== 'i18n'), { ...info, kind: 'how' }, style)
    const solved = solveCalc(info, calcCands)
    if (solved) {
      const sentences = [...solved.sentences]
      if (!style.noCheckQuestion) sentences.push(L[lang].checkHow)
      return { text: sentences.join(' '), sentences, confident: true, usedTitles: [...new Set(solved.used.map((u) => u.title))], keyTerm: info.keyTerm }
    }
  }

  if (lang !== 'ru') return composeForeign(input, info, style, maxWords)

  const cands = buildCandidates(input.hits, info, style)
  input.debug?.(cands)
  if (info.kind === 'calc' && !style.helper) {
    const solved = solveCalc(info, buildCandidates(input.hits, { ...info, kind: 'how' }, style).concat(cands))
    if (solved) {
      const sentences = [...solved.sentences]
      if (!style.noCheckQuestion) sentences.push(L.ru.checkHow)
      return { text: sentences.join(' '), sentences, confident: true, usedTitles: [...new Set(solved.used.map((u) => u.title))], keyTerm: info.keyTerm }
    }
  }
  // Follow-up без своей темы: обычный ответ на этот вопрос уже прозвучал — его фразы не повторяем.
  const avoid =
    style.continuation && (style.wantExample || style.wantWhy || style.simpler || detail === 'more')
      ? composeLocalAnswer({ ...input, style: { channel: style.channel, helper: style.helper, noCheckQuestion: true, maxWords: style.channel === 'chat' ? 80 : undefined }, debug: undefined }).sentences
      : []
  const saidBefore = (c: Candidate) => avoid.some((a) => saidAs(a, c))
  // «А почему?»: причину можно повторить (это и есть ответ), остальное сказанное — нет.
  // Первую фразу прошлого ответа (обычно определение) не повторяем даже как «причину».
  const saidFirst = (c: Candidate) => avoid.length > 0 && saidAs(avoid[0]!, c)
  const fresh = avoid.length ? cands.filter((c) => !saidBefore(c) || (style.wantWhy && c.causal && !saidFirst(c))) : cands
  const notSaid = avoid.length && style.wantWhy ? pickDirect(cands.filter((c) => !saidBefore(c)), info) : null
  let picked =
    info.concepts.length > 0 ? ((notSaid && !notSaid.missingWhy ? notSaid : null) ?? pickDirect(fresh, info) ?? (avoid.length ? pickDirect(cands, info) : null)) : null
  // «Приведи пример»: нового примера нет — лучше уже названный пример, чем «примера нет».
  if (picked && style.wantExample && avoid.length && !picked.direct.example) {
    const again = pickDirect(cands, info)
    if (again?.direct.example) picked = again
  }
  if (!picked || picked.direct.score <= 1.0) return noAnswer(input, info, [])

  const body = composeBody(cands, picked, info, style, maxWords, avoid)
  const sentences = body.sentences
  if (!style.noCheckQuestion) sentences.push(checkQuestion(info, style, seed, body.missingWhy, input.query, sentences.join(" ")))
  return {
    text: sentences.join(' '),
    sentences,
    confident: true,
    usedTitles: [...new Set(body.used.map((u) => u.title))],
    keyTerm: info.keyTerm,
  }
}
