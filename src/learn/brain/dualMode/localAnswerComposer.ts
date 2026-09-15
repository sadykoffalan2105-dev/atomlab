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
]

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
    const parts = trimmed.split(/(?<=[.!?])\s+(?=[\p{Lu}\d«"(])/u)
    for (const p of parts) {
      const t = p.trim()
      // Заголовок списка/задания («Какие оксиды образуются при сжигании следующих веществ:») и обрывки «…» — не ответ.
      if (/[:：]$/.test(t) || /^…/.test(t)) continue
      // Хвост «, то есть E2Оп, где E – элемент …» после определения — обозначения, а не смысл.
      // «…увеличивается в 2—4 раза: t1 где t2 — скорость …» — хвост формулы без самой формулы.
      let s = t.replace(/:\s*(?:\S+\s+){0,3}где\s.*$/u, '.').replace(/,\s*(?:то есть|т\.\s?е\.)\s+[^,]*,\s*где\s.*$/u, '.').replace(/,\s*где\s+\S+\s*[–—-]\s.*$/u, '.').replace(/[;,]\s*$/, '.')
      // «Таким образом, 1 моль газа …» — связка с невидимым учеником текстом; сам факт остаётся.
      const connective = /^(Таким образом|Итак|Следовательно|Значит|Как видно),\s+(?=\S)/u
      if (connective.test(s)) {
        s = s.replace(connective, '')
        s = s.replace(/^(\p{Ll})/u, (c) => (/^[a-zα-ω]{1,2}\s*[(=]|^pH/u.test(s) ? c : c.toUpperCase()))
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
  if (CALC_RE.test(query)) return 'calc'
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
  const cut = (lastCommaCut || acc).replace(/[,;:—–-]+$/, '')
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
  return `${capitalizeFirst(keyTerm)} — это ${body}.`
}

/** «what oxides are» / «what a catalyst is». */
const enBe = (term: string) => (/[^s]s$/i.test(term.trim()) && !/(sis|ics)$/i.test(term.trim()) ? 'are' : 'is')
/** «what a catalyst is», «what electrolysis is» (неисчисляемые и множественное — без артикля). */
const enTerm = (term: string) =>
  enBe(term) === 'are' || /^(an?|the)\s/i.test(term) || /(sis|try|sion|ity|ence|ency|rium|ism|ics)$/i.test(term.trim()) ? term : `${/^[aeiou]/i.test(term) ? 'an' : 'a'} ${term}`

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
    quote: (book: string | null, text: string) => `${book ?? 'Справочник ATOMLAB'}: «${text}»`,
    exampleTerms: (terms: string) => `Пример из учебника: ${terms}.`,
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
    checkWhy: (r: string) => `Can you now explain why ${r}?`,
    checkHow: 'Can you retell it step by step in your own words?',
    checkCompare: 'Can you name the main difference in one sentence?',
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
    quote: (book: string | null, text: string) => `${book ? `From the ${book} textbook` : 'From the ATOMLAB reference cards'} (in Russian): «${text}»`,
    exampleTerms: (terms: string) => `An example from the textbook: ${terms}.`,
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
    quote: (book: string | null, text: string) => `${book ? `${book} darsligidan` : 'ATOMLAB ma’lumotnomasidan'} (rus tilida): «${text}»`,
    exampleTerms: (terms: string) => `Darslikdagi misol: ${terms}.`,
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
}

function analyzeQuestion(query: string, lang: StemLang, style: ComposeStyle, topicHint?: string): QuestionInfo {
  const kind = detectKind(query, style)
  const keyTerm = extractKeyTerm(query, lang)
  let concepts = buildConcepts(query)
  if (concepts.length === 0 && topicHint) concepts = buildConcepts(topicHint)
  const keyStems = keyTerm ? questionWords(keyTerm).flatMap((w) => w.split('-')).filter((w) => w.length >= 3).map(strictStem) : []
  const specific = concepts.filter((c) => !c.generic)
  const folded = foldText(query)
  const compounds = (folded.match(/[\p{L}]{3,}-[\p{L}]{3,}/gu) ?? []).filter((w) => !/^(что|кто|как|какой|какая|какие|как)-/u.test(w))
  const contrast = CONTRAST_PAIRS.filter(([a, b]) => folded.includes(a) && !folded.includes(b))
  const n = concepts.length
  const needed = n <= 1 ? 1 : n <= 3 ? 0.5 : 0.4
  return { query, lang, kind, keyTerm, keyStems, concepts, specific, terms: kind === 'compare' ? compareTerms(query) : [], compounds, contrast, needed }
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
      if (looksLikeOcrNoise(raw) || looksBroken(raw)) return
      if (!acceptableForLang(raw, lang)) return
      if (raw.length < 24 || raw.length > 420) return
      if (foldText(raw).replace(/[^\p{L}\p{N}]/gu, '') === foldText(hit.title).replace(/[^\p{L}\p{N}]/gu, '')) return
      if (lang === 'ru' && /^((В|На|Из|С|До|При|Для)\s)?(Какие|Какой|Какая|Каким|Какими|Какую|какой|какие|какая|какую|каким|какими|какого|Сколько|сколько|Почему|Что|Как|Чем)\s/u.test(raw) && !/[—–]|\sэто\s/u.test(raw)) return
      // Заголовок без сказуемого («Получение хлорида водорода в лаборатории физические свойства.»).
      if (lang === 'ru' && isHeadingLike(raw)) return
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
      const keyAll = keyStems.length > 0 && keyStems.every((k) => keyConceptIn(k, idx))
      const keyInHead = keyStems.length > 0 && keyStems.every((k) => keyConceptIn(k, headIdx))
      const namedPart =
        raw.match(/(?:называ(?:ется|ются|ют)|\b(?:is|are) called)\s+([^,.;:(]{3,48})/iu)?.[1] ??
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
      if (definitional && kind !== 'why') score += 0.3
      if (definesKey) score += isWhatIs ? (exactSubject ? 2.2 : 1.2) : kind === 'example' ? 0.3 : 1.0
      if (definesTerm >= 0) score += 1.2
      if (definesOther) score -= isWhatIs ? 1.6 : kind === 'compare' ? 0.3 : 0.7
      if (causal) score += kind === 'why' ? (keyAll || overlap >= 0.5 ? 1.6 : 0.5) : 0.1
      if (method && (kind === 'how' || kind === 'calc') && overlap >= info.needed - 1e-9) score += 0.9
      if (classify && kind === 'compare' && keyAll) score += /:\s*\S.*,.*,/u.test(raw) ? 2.2 : 1.0
      if (CONTRAST_WORDS_RE.test(raw) && kind === 'compare') score += 0.4
      if (example && style.wantExample) score += specific > 0 || keyAll ? 1.4 : 0.4
      if (keyInHead && kind !== 'example') score += 0.4
      if (imprecise) score -= 2.5
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
  switch (kind) {
    case 'definition': {
      const direct =
        usable.find((c) => c.definesKey && c.exactKey) ??
        usable.find((c) => c.definesKey) ??
        usable.find((c) => c.keyInHead && c.definitional && !c.definesOther) ??
        usable.find((c) => c.keyInHead && strong(c) && !c.definesOther)
      return direct ? { direct, missingWhy: false } : null
    }
    case 'why': {
      // Причина должна касаться того, о чём спросили (не только термина): «металлы … отражают свет, поэтому блеск»
      // — не ответ на «почему металлы проводят ток».
      const enough = (c: Candidate) => c.overlap >= Math.max(needed, 0.5) - 1e-9 || (info.concepts.length <= 2 && c.keyAll)
      const direct = usable.find((c) => c.causal && enough(c) && c.specific > 0 && !c.definesOther)
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
      const direct = usable.find((c) => c.method && strong(c) && (!c.definesOther || c.keyInHead)) ?? fallback()
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
        const a = usable.find((c) => c.definesTerm === 0)
        const b = usable.find((c) => c.definesTerm === 1 && c !== a)
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
      const direct =
        usable.find((c) => c.example && c.keyAll && c.formulas >= 1 && c.formulas <= 6) ??
        usable.find((c) => c.example && (c.keyAll || c.specific > 0))
      if (direct) return { direct, missingWhy: false }
      const def = usable.find((c) => c.definesKey) ?? fallback()
      // Пример из того же фрагмента, что и определение термина («Например, при горении углерода … CO2»).
      const near = def && cands.find((c) => c.example && c.hitIndex === def.hitIndex && c.score > 0 && !c.definesOther && c.formulas <= 6)
      if (near) return { direct: near, missingWhy: false }
      return def ? { direct: def, missingWhy: false } : null
    }
    default: {
      const direct = usable.find((c) => c.definesKey && strong(c)) ?? fallback()
      return direct ? { direct, missingWhy: false } : null
    }
  }
}

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

function sameDefinedTerm(a: Candidate, b: Candidate): boolean {
  if (a.definesKey && b.definesKey) return true
  return a.definesTerm >= 0 && a.definesTerm === b.definesTerm
}

function isDuplicate(c: Candidate, used: readonly Candidate[], kind?: QuestionKind): boolean {
  // Сравнение: определение второго термина («… называется полярной ковалентной связью») — не повтор первого,
  // даже если фразы почти одинаковы («одинаковой» ↔ «различной»).
  const otherSide = kind === 'compare' && c.definesTerm >= 0 && !used.some((u) => u.definesTerm === c.definesTerm)
  return used.some(
    (u) =>
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
  const perSentenceMax = detail === 'more' ? 40 : style.simpler ? 20 : 26
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
  const explanationCount = style.simpler
    ? 0
    : detail === 'more'
      ? 3
      : kind === 'example'
        ? 0
        : kind === 'compare' && second
          ? chat ? 1 : 0
          : kind === 'why' || kind === 'how' || kind === 'calc'
            ? chat ? 2 : 1
            : 1
  /** Уже сказано в прошлом ответе этого диалога (follow-up «пример», «почему», «подробнее»). */
  const said = (c: Candidate) => avoid.some((a) => saidAs(a, c))
  const ranked = cands
    .filter((c) => !used.includes(c) && c.score >= 0.8 && !c.imprecise && !c.definesOther && !c.offCondition)
    // «На них не действуют …», «Они …» — продолжение чужой мысли; только сразу после прямого ответа.
    .filter((c) => !/^(На них|Они|Их|Его|Её|Ее|Эти|Этот|Эта|Это|Такие|Там)\s/u.test(c.text) || (c.hitIndex === direct.hitIndex && c.pos === direct.pos + 1))
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
        !/^(На них|Они|Их|Его|Её|Ее|Эти|Этот|Эта|Это|Такие|Там)\s/u.test(c.text) &&
        c.formulas <= 6 &&
        (lang === 'ru' ? c.formulas >= 1 || REACTION_RE.test(c.text) || /(например|к примеру|такие как)/iu.test(c.text) : EXAMPLE_RE.test(c.text)) &&
        (c.keyAll || c.specific > 0 || c.hitIndex === direct.hitIndex) &&
        // «Например: отношение объёма … называется молярным объёмом» — определение, а не пример.
        (!/называ(ется|ются|ют)/u.test(c.text) || EXAMPLE_RE.test(c.text)) &&
        !(lang === 'ru' && /^[^:]{2,32}:\s*\p{Ll}/u.test(c.text) && c.hitType !== 'textbook') &&
        !looksLikeTaskNoise(c.text) &&
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
    if ((kind === 'how' || kind === 'calc') && !c.method && !c.causal && !(c.hitIndex === direct.hitIndex && Math.abs(c.pos - direct.pos) <= 1)) continue
    if (isDuplicate(c, used, kind) || said(c)) continue
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

function checkQuestion(info: QuestionInfo, style: ComposeStyle, seed: number, missingWhy: boolean, originalQuery: string): string {
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
  if (info.kind === 'how' || info.kind === 'calc') return t.checkHow
  if (info.kind === 'compare') return t.checkCompare
  if (info.kind === 'example') return t.checkExample
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
      parts.push(local ? t.related(local.local) : t.relatedGeneric)
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
  const ru: string[] = []
  for (const g of found) if (!ru.some((r) => r.toLowerCase().includes(g.ru.toLowerCase()))) ru.push(g.ru.toLowerCase())
  if (ru.length === 0) return null
  const body = ru.slice(0, 4).join(' ')
  switch (info.kind) {
    case 'definition':
      return `что такое ${body}`
    case 'why':
      return `почему ${body}`
    case 'example':
      return `пример ${body}`
    case 'how':
      return `как ${body}`
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
  const native = buildCandidates(nativeHits, info, style)
  input.debug?.(native)
  const nativePick = pickDirect(native, info)

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
          (info.kind === 'definition' ? c.definesKey : info.kind === 'why' ? c.causal && c.overlap >= 0.5 : c.keyAll),
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
      const terms = glossTerms(ruBody.direct.text, glossary.filter((g) => g.source === 'core' || g.source === 'class'), [], 5)
      if (terms.length) sentences.push(t.glossLead(terms.join(', ')))
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
    const terms = glossTerms(ruBody.used.map((c) => c.text).join(' '), glossary.filter((g) => g.source !== 'element' || lang === 'en'), [], 6)
    if (terms.length === 0 || !quote) return noAnswer(input, info, glossary)
    sentences.push(t.glossLead(terms.join(', ')))
    if (ruBody.missingWhy) sentences.push(t.noWhy)
    sentences.push(quote)
    usedTitles.push(...ruBody.used.map((c) => c.title))
  } else {
    return noAnswer(input, info, glossary)
  }
  if (!style.noCheckQuestion) sentences.push(capitalizeFirst(checkQuestion(info, style, seed, Boolean(ruBody?.missingWhy && !nativePick), input.query)))
  return { text: sentences.join(' '), sentences, confident: true, usedTitles: [...new Set(usedTitles)], keyTerm: info.keyTerm }
}

/* ---------------------------------------------------------------- calc solver */

/** Школьные округлённые относительные атомные массы (как в задачах Kimyo 7–11). */
const AR: Record<string, number> = {
  H: 1, C: 12, N: 14, O: 16, Na: 23, Mg: 24, Al: 27, Si: 28, P: 31, S: 32, Cl: 35.5, K: 39, Ca: 40, Fe: 56, Cu: 64, Zn: 65,
}
/** Название вещества в вопросе → формула (только частые школьные вещества). */
const SUBSTANCE_FORMULAS: Array<[RegExp, string]> = [
  [/(?<!\p{L})вод[аыуе](?!\p{L})/u, 'H2O'], [/углекисл\S*\s+газ|оксид\S*\s+углерода\s*\(IV\)/u, 'CO2'], [/серн\S*\s+кислот/u, 'H2SO4'],
  [/солян\S*\s+кислот|хлороводород/u, 'HCl'], [/аммиак/u, 'NH3'], [/метан/u, 'CH4'], [/азотн\S*\s+кислот/u, 'HNO3'],
  [/фосфорн\S*\s+кислот/u, 'H3PO4'], [/поварен\S*\s+сол|хлорид\S*\s+натрия/u, 'NaCl'], [/гидроксид\S*\s+натрия/u, 'NaOH'],
  [/карбонат\S*\s+кальция|(?<!\p{L})мел[аеу]?(?!\p{L})/u, 'CaCO3'], [/оксид\S*\s+кальция/u, 'CaO'], [/глюкоз/u, 'C6H12O6'],
  [/(?<!\p{L})кислород[аеу]?(?!\p{L})/u, 'O2'], [/(?<!\p{L})водород[аеу]?(?!\p{L})/u, 'H2'], [/(?<!\p{L})азот[аеу]?(?!\p{L})/u, 'N2'],
]
const fmtNum = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

/**
 * Расчётные вопросы: подставляем числа вопроса в правило/формулу из найденного текста и показываем ход решения.
 * Только арифметика по найденному правилу (без правила в фрагментах — не решаем).
 */
function solveCalc(info: QuestionInfo, cands: readonly Candidate[]): { sentences: string[]; used: Candidate[] } | null {
  const q = foldText(info.query)
  // 1) Относительная молекулярная масса вещества: Mr = сумма Ar.
  if (/молекулярн\S*\s+масс|молярн\S*\s+масс/u.test(q)) {
    const rule = cands.find((c) => /сумм/iu.test(c.text) && /атомн/iu.test(c.text) && /масс/iu.test(c.text))
    const formula = info.query.match(/\b([A-Z][a-z]?\d*){1,6}\b/u)?.[0] ?? SUBSTANCE_FORMULAS.find(([re]) => re.test(q))?.[1]
    const atoms = formula ? atomCounts(formula) : null
    if (!rule || !formula || !atoms || [...atoms.keys()].some((el) => AR[el] === undefined)) return null
    const parts = [...atoms].map(([el, n]) => (n > 1 ? `${n}·Ar(${el})` : `Ar(${el})`))
    const nums = [...atoms].map(([el, n]) => (n > 1 ? `${n}·${fmtNum(AR[el]!)}` : fmtNum(AR[el]!)))
    const total = [...atoms].reduce((acc, [el, n]) => acc + n * AR[el]!, 0)
    const molar = /молярн/u.test(q)
    const line = `${molar ? 'M' : 'Mr'}(${formula}) = ${parts.join(' + ')} = ${nums.join(' + ')} = ${fmtNum(total)}${molar ? ' г/моль' : ''}.`
    return { sentences: [ensureEnd(rule.text), line], used: [rule] }
  }
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
  return null
}

export function composeLocalAnswer(input: ComposeInput): ComposedAnswer {
  const lang = input.lang
  const style = input.style ?? {}
  const seed = input.seed ?? 0
  const detail = style.detail ?? 'brief'
  const maxWords = style.maxWords ?? (detail === 'more' ? 140 : style.simpler ? 50 : 60)
  const info = analyzeQuestion(input.query, lang, style, input.topicHint)

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
    style.continuation && (style.wantExample || style.wantWhy || detail === 'more')
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
  if (!style.noCheckQuestion) sentences.push(checkQuestion(info, style, seed, body.missingWhy, input.query))
  return {
    text: sentences.join(' '),
    sentences,
    confident: true,
    usedTitles: [...new Set(body.used.map((u) => u.title))],
    keyTerm: info.keyTerm,
  }
}
