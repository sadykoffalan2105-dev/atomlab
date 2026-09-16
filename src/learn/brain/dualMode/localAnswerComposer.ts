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
import { ELEMENT_NAMES_EN } from '../../../data/elementNamesEn'
import { ELEMENT_NAMES_UZ } from '../../../data/elementNamesUz'
import { contentStems, foldText, stemsMatch, strictStem, tokenizeWords, wordHasStem, QUESTION_STOPWORDS, type StemLang } from './textStems'
import { answerFromBookIndex, detectPropertyQuestion, exampleFromBookIndex, obtainFromBookIndex, reactionsWithReagent, sameWord, type PropertyQuestion } from './bookIndexAnswer'

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
  /** Подписи фрагментов, из которых взяты фразы ответа (в порядке фраз) — для значков источников. */
  usedCitations?: string[]
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
  /** «X — оксид.»: определение без отличительного признака. */
  thin: boolean
  /** «Двойные соли — соли, …» на вопрос «что такое соли»: определение подвида, а не самого термина. */
  subClass: boolean
  /** Гейт тождества: определяемое подлежащее — ровно спрошенный термин (не подвид, не производное слово). */
  headIdentity: boolean
  /** Фраза привязана к разобранному примеру («в этом примере», «то есть обратная реакция») — не общее правило. */
  exampleBound: boolean
  /** Фраза про другой тип реакции, чем спросили («окисления» на вопрос про «присоединения»). */
  typeMismatch: boolean
  /** «[Kimyo 8, §20, стр. 85]» фрагмента — чтобы пояснения к определению брать из того же параграфа. */
  citation: string
  stems: string[]
  score: number
}

const JUNK_RE =
  /Тема школьной программы|Путает близкие термины|Заучивает без понимания|В данном § такой информации нет|неверная формулировка по учебнику|Так описывается другое явление|Program \(FGOS\)|Content tier in app|Slide excerpt|^\s*Current slide|Изучаемые понятия|Элементы ЗУН|Типичная ошибка|Исправь мягко|Чек-лист|^\s*(Пример|Задача|Решение|Дано|Ответ)(\s+задач\S*)?\s*\d*[.:]|(Выведите|Определите|Найдите|Найти|Охарактеризуйте|Опишите|Назовите|Перечислите|Рассмотрите|Вычислите|Рассчитайте|Составьте|Напишите уравнени|Сколько граммов|Какой объ[её]м|самостоятельн)|(^|\s)(Find|Calculate|Determine)\s|^\s*(Рис|Таблица)\.?\s*\d|^\s*(Реактивы|Оборудование|Приборы и реактивы|Материалы)\s*:/i

/** Символы химических элементов (для отличия формулы «Zn + 2HCl» от буквенной схемы «AB + C → AC + B»). */
const ELEMENT_SYMBOLS = new Set(
  'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr'.split(' '),
)

/**
 * Структурный шум (по форме строки, а не по словам): поля паспорта карточки («Условия получения: температура: …;
 * давление: …»), названия лабораторных/практических работ, «4 Гипс лабораторная …», тестовые варианты «А) … В) …»,
 * шапка карточки «Угарный газ (CO) — оксид.» (≤ 3 слов после тире, без сказуемого).
 */
function isStructuralNoise(raw: string, hitType: string): boolean {
  if ((raw.match(/(?:^|[;.]\s*)\p{L}[\p{L} ()-]{1,30}:\s/gu) ?? []).length >= 2 || /^[\p{L} ()-]{2,30}:\s*\p{L}[\p{L} ]{1,25}:\s/u.test(raw)) return true
  if (/^(Условия получения|Условия реакции|Паспорт реакции|Паспорт вещества)\s*:/u.test(raw)) return true
  if (/(лабораторн\S*|практическ\S*)\s+(работ\S*|заняти\S*|опыт\S*)\s*(№\s*)?\d+/iu.test(raw)) return true
  if (/^\d+\s+\p{Lu}\p{Ll}+\s+\p{Ll}/u.test(raw)) return true
  if (/(^|\s)[АБВГA-D]\)\s.*\s[АБВГA-D]\)\s/u.test(raw)) return true
  if (hitType === 'card' || hitType === 'summary' || hitType === 'faq') {
    const header = raw.match(/^[^—–:]{2,80}\s[—–]\s*((?:[\p{L}()-]+\s?){1,3})\.?$/u)
    if (header && !hasFiniteVerbRu(header[1]!)) return true
  }
  return false
}

/** Буквенная схема «AB + C → AC + B» / «A + BC»: в уравнении нет ни одной настоящей формулы. */
function realFormulaToken(tok: string): boolean {
  const atoms = atomCounts(tok)
  return Boolean(atoms) && [...atoms!.keys()].every((el) => ELEMENT_SYMBOLS.has(el))
}

/**
 * Число настоящих формул в тексте, включая «2HCl», «H₂↑», «Zn + …» (FORMULA_TOKEN_RE не видит коэффициенты и
 * подстрочные цифры в конце); одиночный символ элемента считается только рядом со знаком реакции.
 */
function equationFormulaCount(text: string): number {
  let n = 0
  for (const m of text.matchAll(/(?<![\p{L}\d])\d*((?:[A-Z][a-z]?[₀-₉0-9]*|\((?:[A-Z][a-z]?[₀-₉0-9]*)+\)[₀-₉0-9]*)+)[↑↓]?(?![\p{L}])/gu)) {
    const tok = m[1]!
    if (/^[IVXLCDM]+$/u.test(tok) || !realFormulaToken(tok)) continue
    const single = /^[A-Z][a-z]?$/u.test(tok)
    if (single && !/[+→=⇌]\s*$/u.test(text.slice(0, m.index)) && !/^\s*[+→=⇌]/u.test(text.slice(m.index! + m[0].length))) continue
    n++
  }
  return n
}

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
  /(получа|получени|способ|метод|магнит|фильтр|отстаива|выпарива|дистилл|перегон|декантац|с помощью|реактив|образовани|равн[аоы] сумме|складыва|отношени[ея] масс|действием|воздейств|нагрева|разложени|при электролизе|на катоде|на аноде|выделя|образует|влия|завис|увеличива|уменьша|возраста|смеща|повышени|понижени|защит|покрыт|устран|кипячен|→|=|produce|obtain|prepare|heating|olinadi|hosil)/i
const CLASSIFY_RE = /(дел(ят|ит)ся на|подраздел|различают|бывают|классифиц|по (их )?(химическим )?свойствам|групп|типа|вида|are divided|types of|turlari|bo['‘’]linadi)/i
const CONTRAST_WORDS_RE = /(в отличие|тогда как|отлича|а у |однако|whereas|unlike|while|farqli)/i
const EXAMPLE_RE = /(например|к примеру|пример[:\s]|такие как|for example|for instance|e\.g\.|such as|examples? of|masalan|misol uchun|misollar)/i
/** Причина в широком смысле (ворота доказательств): связки причины, «, у него самая низкая …», сравнительная степень. */
const CAUSE_EVIDENCE_RE =
  /(потому что|так как|поскольку|благодаря|из-за|вследствие|за сч[её]т|по причине|объясня\S*ся|обусловл|приводит к|в результате|,\s*что\s+способству\S*|because|since|due to|chunki|sababli|tufayli|,\s*(?:у него|у неё|у нее|у них)\s|(?<!\p{L})сам(?:ая|ый|ое|ые|ой|ую)\s+(?:низк|высок|слаб|сильн|мал|больш|прочн|тв[её]рд|мягк|л[её]гк)\S*|(?<!\p{L})(?:ниже|выше|слабее|сильнее|легче|тяжелее|прочнее|активнее|мягче|тверже|твёрже)(?!\p{L}))/iu
/** Процесс/способ для «как …?»: электролиз, восстановление, брожение, гидратация … */
const PROCESS_RE =
  /(электролиз|восстановлени|восстанавлива|брожени|гидратаци|гидрировани|разложени|разлага|способом|методом|путём|путем|взаимодейств|обжиг|перегонк|ректификац|нагревани|сжигани|окислени|→|electrolys|reduction|fermentation|hydration)/iu
/** Механизм причины: «соединяется с …», «, что ухудшает …», «так как», «за счёт» — раньше исхода («приводит к гибели»). */
const MECHANISM_RE =
  /(соединя\S*ся\s+с|связыва\S*(ся)?\s+с|взаимодейству\S*\s+с|,\s*что\s+(ухудша|наруша|препятству|блокиру|уменьша|увеличива|затрудня)|потому что|так как|поскольку|благодаря|за сч[её]т|вследствие|обусловл|объясня\S*ся)/iu
const OUTCOME_ONLY_RE = /(приводит|приводят|привести)\s+к\s+(летальн|гибел|смерт|отравлен|заболеван)|вызыва\S*\s+(отравлен|гибел|смерт)/iu
const DETECT_RE = /(распозна|обнаружи|определ\S*\s+(налич|ион)|качественн)/iu
const OBSERVABLE_RE = /(осад|↓|цвет|окраш|газ|↑|запах|помутнен|белый|ж[её]лт|голуб|бурый|черн)/iu
const SEPARATE_RE = /(отдел|раздел|очисти|очистк)/iu
const SEPARATION_TOOL_RE = /(магнит|фильтр|отстаива|выпарива|дистилл|перегон|декантац|делительн|сито|просеива)/iu
/** Реактив для распознавания: вещество/класс, которым действуют («с кислотой», «добавить щёлочь», «AgNO3»). */
const REAGENT_RE = /(кислот|щелоч|щёлоч|реактив|раствор\S*\s+\p{L}|индикатор|лакмус|фенолфталеин|нитрат серебра|AgNO3|BaCl2|известков)/iu
/** Риторический зачин без химического содержания («Все мы знаем, что …») — не первая фраза ответа. */
const RHETORIC_RE =
  /^(Все мы знаем|Всем известно|Как известно|Известно,\s*что|Каждый (знает|из нас)|Мы (часто|ежедневно|постоянно|все)|В (повседневной|обыденной|нашей) жизни|С \p{L}+ мы сталкиваемся|Трудно представить|Невозможно представить)/u
/** Строение вещества как причина школьного «почему»: решётка, связи между атомами, расстояния. */
const STRUCTURE_CAUSE_RE =
  /(кристаллическ\S*\s+реш[её]тк|реш[её]тк\S*\s|кажд\S*\s+атом|все\s+атомы|атомы\s+\S+\s+(?:связаны|соединены|расположены)|на\s+одинаковом\s+расстоянии|образу\S*\s+(?:с\s+\S+\s+){0,3}\S*\s*связ|прочн\S*\s+связ|делокализ|двойн\S*\s+связ|тройн\S*\s+связ)/iu
/** Назначение («защищающий …», «служит для …») — ответ на «почему X важен/нужен». */
const PURPOSE_RE = /(защища\S*|предохраня\S*|обеспечива\S*|служит\s+для|нужен\s+для|необходим\S*\s+для|поглоща\S*)/iu
/** Безличный обрывок правила карточки («Считается как сумма …») — без подлежащего, не первая фраза ответа. */
const VERB_INITIAL_RE = /^(Счита|Определя|Выража|Вычисля|Рассчитыва|Измеря|Обознача|Находи|Записыва|Изобража)\p{Ll}*(ется|ются)\s/u

/**
 * ГРАНИЦА ПРИМЕРА (r9): фраза описывает разобранный в учебнике частный случай («в этом примере», «в рассмотренном
 * нами случае», «то есть ускоряется обратная реакция» — направление верно только для того равновесия) и общим
 * правилом выдана быть не может.
 */
const EXAMPLE_BOUND_RE =
  /(в\s+(?:эт(?:ом|ой)|данн\S+|рассмотренн\S+|привед[её]нн\S+|наш\S+|указанн\S+)\s+(?:пример\S*|случа\S*|опыт\S*|реакци\S*|уравнени\S*)|в\s+рассмотренном\s+нами|,\s*то\s+есть\s+[^.;]*(?:обратн|пряма|прямая|правую|левую|вправо|влево))/iu
/** «До начала XX в. … получали», «Раньше …»: как делали прежде — не ответ на «как получают» сейчас. */
const HISTORICAL_RE = /^(До\s+(начала|конца|\d)|Раньше|Ранее|В\s+(XVI{0,3}|XI?X|прошлом)(?!\p{L}))/u
const PAST_QUERY_RE = /(раньше|ранее|истори|впервые|получали)/iu
/** Указательное слово при существительном («эти оксиды», «этот газ»): фраза продолжает предыдущую. */
const ANAPHOR_RE = /(?<!\p{L})(эти|этот|эта|этих|этим|этого|этой|такие|таких|данные|данный|данная)\s+\p{Ll}{3,}/u
/** Хвост «, то есть … в правую сторону» — направление из чужого примера: обрезаем, фраза без него цела. */
const DIRECTION_TAIL_RE = /,\s*то\s+есть\s+[^.;]*(?:обратн|пряма|прямая|правую|левую|вправо|влево)[^.;]*/iu
/** Тип реакции, названный в вопросе или во фразе («присоединения», «окисления»): причина должна касаться своего. */
const reactionTypes = (text: string): string[] => [
  ...new Set([...text.matchAll(/(окислени|присоединени|замещени|разложени|соединени|обмена|полимеризаци|гидролиз|восстановлени|этерификаци|гидрировани|нейтрализаци)/giu)].map((m) => m[1]!.toLowerCase())),
]

/** Пример: «Например», «Примеры:», «такие как», термохимическое уравнение (кДж, +Q). */
const EXAMPLE_EVIDENCE_RE = /(например|к примеру|примеры?\s*:|такие как|for example|such as|masalan|кДж|\+\s*Q(?!\p{L}))/iu
const REACTION_RE = /(→|⇌|=\s*[A-Z]|\+\s*[A-Z][a-z]?[₀-₉0-9]*)/
const FORMULA_TOKEN_RE = /\b[A-Z][a-z]?[₀-₉0-9]*(?:\([A-Za-z0-9]+\)[₀-₉0-9]*)?(?:[A-Z][a-z]?[₀-₉0-9]*)+\b|\b[A-Z][a-z]?[₀-₉0-9]+\b/g

/** Родовое понятие определения: «сложные вещества», «процесс», «сплав», «способность атома» … */
const CLASS_NOUN_RE =
  /(вещест|соединени|эфир|смес|процесс|реакци|частиц|атом|ион|молекул|свойств|способност|наук|разрушени|распад|взаимодейств|величин|число|сплав|материал|связь|углеводород|разновидност|substance|compound|process|atoms?|modda|jarayon)/iu

const WHAT_IS_RE =/что так(ое|ая|ой|ие)|что значит|что называ|what (is|are)\b|\bnima\b|degani nima/i
const COMPARE_RE = /отлича|отличи[ея]|разниц|сравн|какие\s+(?:\S+\s+){0,3}бывают|какие (есть )?(виды|типы)|виды |типы |классифик|difference|differ|compare|farq/i
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
  ['фильтрован', [['фильтрац']]],
  ['фильтрац', [['фильтрован']]],
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

/** Слово называет элемент («хлорпреновый» → Cl): для проверки «названный элемент есть в формуле». */
const ELEMENT_BY_WORD: Array<[RegExp, string]> = [
  [/^хлор(?!елл)/u, 'Cl'], [/^бром/u, 'Br'], [/^фтор/u, 'F'], [/^(йод|иод)/u, 'I'], [/^(нитро|азот)/u, 'N'],
  [/^(сульфо|сернист|серн)/u, 'S'], [/^фосфор/u, 'P'], [/^кремни/u, 'Si'], [/^натри/u, 'Na'], [/^кали[йеян]/u, 'K'],
  [/^кальци/u, 'Ca'], [/^магни/u, 'Mg'], [/^алюмини/u, 'Al'], [/^(железн|ферр)/u, 'Fe'], [/^медн/u, 'Cu'], [/^цинков/u, 'Zn'],
]

/**
 * ПРОВЕРКА ФОРМУЛ (r9): написанная углеродная цепь должна сходиться по валентности, уравнение — по числу атомов,
 * а элемент, названный рядом словом («хлорпреновый каучук»), должен стоять в самой формуле. OCR учебника роняет
 * атомы («CH2=C–CH=CH2 → хлорпреновый каучук»), и такую формулу ученику показывать нельзя.
 */
function formulaSane(sentence: string): boolean {
  if (hasUnbalancedEquation(sentence)) return false
  // «4N2 + O,,» — OCR съел индекс и оставил двойную запятую: формула испорчена.
  if (/[A-Z][a-z]?[\d₀-₉]*\s*,\s*,/u.test(sentence)) return false
  const chains = sentence.match(/(?:\d*C[H\d₀-₉]*)(?:\s*[=≡–—-]\s*\d*[A-Za-z][A-Za-z\d₀-₉]*)+/gu) ?? []
  for (const chain of chains) {
    if (/[()]/u.test(chain)) continue
    const parts = chain.split(/\s*([=≡–—-])\s*/u)
    const nodes: string[] = []
    const bonds: number[] = []
    parts.forEach((p, i) => (i % 2 === 0 ? nodes.push(p) : bonds.push(p === '=' ? 2 : p === '≡' ? 3 : 1)))
    // Только чистые углеводородные звенья «CH2», «CH», «C», «CH3» — иначе не берёмся судить.
    if (nodes.length < 2 || !nodes.every((n) => /^C(?:H[\d₀-₉]?)?$/u.test(n.replace(/[₀-₉]/g, (d) => SUBSCRIPT_DIGITS[d]!)))) continue
    const ok = nodes.every((n, i) => {
      const plain = n.replace(/[₀-₉]/g, (d) => SUBSCRIPT_DIGITS[d]!)
      const h = plain.startsWith('CH') ? Number(plain.slice(2) || 1) : 0
      return h + (bonds[i - 1] ?? 0) + (bonds[i] ?? 0) === 4
    })
    if (!ok) return false
    // «хлорпреновый», «бромистый» рядом с цепью — названный элемент должен быть в ней.
    const at = sentence.indexOf(chain)
    const around = `${sentence.slice(Math.max(0, at - 60), at)} ${sentence.slice(at + chain.length, at + chain.length + 60)}`
    for (const w of tokenizeWords(around)) {
      const el = ELEMENT_BY_WORD.find(([re]) => re.test(w) && ADJ_RU_RE.test(w))?.[1]
      if (el && !new RegExp(`${el}(?![a-z])`, 'u').test(chain)) return false
    }
  }
  return true
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
    if (near.some((w) => /^(его|её|ее|их)$/u.test(w))) return false
    // r10: термин из нескольких слов («уксусную кислоту») — рядом с глаголом должны стоять все его слова:
    // «валериановую кислоту получают» — другое вещество того же класса
    if (keyStems.length > 1) {
      // дополнение стоит вплотную к глаголу; после предлога («при взаимодействии азотной кислоты», «из … кислоты») — сырьё
      let a = i + 1
      while (a < words.length && /^(обычно|также|можно|часто|сейчас|теперь|чаще|всего|главным|образом)$/u.test(words[a]!)) a++
      const after = /^(в|во|на|из|при|с|со|путем|путём|от|под|за|через|действием|взаимодействием)$/u.test(words[a] ?? '') ? [] : words.slice(a, a + 2)
      const windows = [words.slice(Math.max(0, j - 1), j + 1), after]
      if (windows.some((win) => win.length > 0 && keyStems.every((st) => win.some((w) => wordHasStem(w, st))))) return false
    } else if (near.some((w) => keyStems.some((st) => wordHasStem(w, st)))) return false
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
  // r10: кислая соль — водород в кислотном остатке (NaHCO₃, KHSO₄, NaH₂PO₄), а не «соль с кислой средой» (NH₄Cl)
  if (/кисл(ая|ые|ой|ых|ую)\s+сол|nordon\s+tuz|acid(ic)?\s+salts?/u.test(q)) {
    return formulas.some((x) => /(HSO4|HSO3|HCO3|H2PO4|HPO4|HS(?![a-z\d]))/u.test(x.f.replace(/[₀-₉]/gu, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d)))))
  }
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
  // r10: данные задачи с единицами «g»/«mol» («из 30 g уксусной кислоты образуется 41 g соли») — не факт о веществе
  if (/\d\s*(g|mol)(?!\p{L})[^.]*\d\s*(g|mol)(?!\p{L})/u.test(sentence)) return true
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
  // r10: пропущенная формула-картинка («образованные замещением , называются альдегидами») и оборванное «т. е.»
  // («метаналь т. соединения») — фраза без смысла; из неё нельзя делать определение.
  if (/\p{L}\s+,/u.test(sentence) || /(?<!\p{L})т\.\s+(?!е\.|к\.|д\.|п\.|н\.)\p{Ll}/u.test(sentence)) return true
  // r10: потерянные степени «(106 ––103– моль/л)» вместо «10⁻⁶–10⁻³» — числа в такой фразе неверны
  if (/\d\s*[–—-]{2,}\s*\d|\d{2,}[–—-]\s*[а-яё]/u.test(sentence) && /[–—-]{2,}/u.test(sentence)) return true
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

/**
 * Строка-объявление, кончающаяся двоеточием, и следующая строка-уравнение — одна фраза:
 * «…выделяется углекислый газ:\nNa2CO3 + 2HCl → 2NaCl + CO2 + H2O.» (иначе объявление отбрасывается как заголовок).
 */
function joinColonEquations(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const next = lines[i + 1]?.trim() ?? ''
    const isEquation = /^[A-Z(\d]/u.test(next) && /[→⇌=]/u.test(next) && equationFormulaCount(next) >= 2
    // Объявление реакции («… выделяется газ:»), а не определение с перечнем («… называются карбонатами:»).
    const announcesReaction = /(выдел\S*|образ\S*|получ\S*|происход\S*|взаимодейств\S*|разлага\S*|реакци\S*|уравнени\S*|идет|ид[её]т)/iu.test(line)
    if (/[:：]\s*$/.test(line) && isEquation && announcesReaction && line.trim().length >= 24 && hasFiniteVerbRu(line)) {
      out.push(`${line.trim()} ${next.replace(/[;,]\s*$/, '.')}`)
      i++
      continue
    }
    out.push(line)
  }
  return out.join('\n')
}

/**
 * Обрыв вёрстки на незакрытой скобке («… называются солями (вместо атомов металла может быть и ион Nh +.») —
 * оставляем законченную часть до скобки вместо того, чтобы терять всю фразу.
 */
function trimUnclosedParen(s: string): string {
  const opens = (s.match(/\(/g) ?? []).length
  const closes = (s.match(/\)/g) ?? []).length
  if (opens <= closes) return s
  const stack: number[] = []
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') stack.push(i)
    else if (s[i] === ')') stack.pop()
  }
  const at = stack[0]
  if (at === undefined) return s
  const head = s.slice(0, at).replace(/[\s,;:–—-]+$/u, '')
  if (countWords(head) < 6 || !hasFiniteVerbRu(head) || /\(/.test(head) !== /\)/.test(head)) return s
  return `${head}.`
}

/**
 * Нумерованный список внутри одной строки («… группы: 1. Средние соли: NaCl, KCl. 2. Кислые соли — …») — по строке
 * на пункт: иначе весь перечень остаётся одной фразой и теряется вместе с её служебным началом.
 */
function splitInlineNumberedItems(text: string): string {
  const mark = /(?<=[:.])\s+(\d{1,2})[.)]\s+(?=\p{Lu})/gu
  return text
    .split('\n')
    .map((line) => {
      const nums = [...line.matchAll(mark)].map((m) => Number(m[1]))
      if (nums.length < 2 || !nums.every((n, i) => i === 0 || n === nums[i - 1]! + 1)) return line
      return line.replace(mark, '\n$1. ')
    })
    .join('\n')
}

function cleanKnowledgeText(raw: string): string {
  return joinColonEquations(mergeNumberedLists(splitInlineNumberedItems(repairLayout(raw))))
    .replace(LEAD_LABEL_RE, '$1')
    // «Основные понятия Относительная атомная масса …» — подпись рамки без двоеточия.
    .replace(/(^|\n)\s*Основные понятия\s+(?=\p{Lu})/gu, '$1')
    .replace(/\s*\((?:рис|табл|fig)\.?\s*\d+[^)]*\)/giu, '')
    .replace(/^\s*\[[^\]\n]{0,160}\]\s*$/gm, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\s)\*([^*\s][^*]*)\*/g, '$1$2')
    .replace(/^#+\s*/gm, '')
    // «• электролиты с … называются сильными.» — пункт списка с маленькой буквы — целая фраза.
    .replace(/^\s*[-•*·]\s+([а-яё])/gmu, (_m, c: string) => c.toUpperCase())
    .replace(/^\s*[-•*·]\s+/gm, '')
    .replace(/\.{2,}/g, '.')
    .replace(/[ \t]+/g, ' ')
}

function splitCandidates(text: string): string[] {
  const out: string[] = []
  let outline = false
  // Решённая задача («Решение. 1. Запишем уравнение …» / «Дано: …») до строки «Ответ» — не объяснение и не пример.
  let task = 0
  for (const line of cleanKnowledgeText(text).split(/\n+|\s•\s/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^(Решение|Дано)(\s+задач\S*)?\s*[.:]/u.test(trimmed)) {
      task = 8
      continue
    }
    if (task > 0) {
      task = /^Ответ\s*[.:]/u.test(trimmed) ? 0 : task - 1
      continue
    }
    // Оглавление главы («ЧТО ВЫ БУДЕТЕ ИЗУЧАТЬ?», «Изучаемые понятия:», «Элементы ЗУН») и его пункты — не фразы ответа.
    if (/ЧТО\s+ВЫ\s+(БУДЕТЕ\s+)?(ИЗУЧАТЬ|УЗНАЕТЕ)|Изучаемые понятия|Элементы ЗУН|Ключевые (слова|понятия)\s*:|^Основные понятия\s*•/iu.test(trimmed)) {
      outline = true
      continue
    }
    if (outline && (!hasFiniteVerbRu(trimmed) || trimmed.split(/\s+/).length <= 12)) continue
    outline = false
    // «Например, бутен-2 имеет цис- и транс-изомеры. плоскость π-связи цис-бутен-2 …» — подписи рисунка с маленькой
    // буквы без сказуемого после точки — не часть фразы.
    const parts = trimmed
      .split(/(?<=[.!?])\s+(?=[\p{Lu}\d«"(])/u)
      .map((p) => p.split(/(?<=[.!?])\s+(?=\p{Ll})/u).map((frag, i) => (i > 0 && /(?<!\p{L})\p{Ll}{1,3}\s+\p{Ll}{1,2}\.$/u.test(frag) ? frag.replace(/,[^,]*$/u, '.') : frag)).filter((frag, i) => i === 0 || hasFiniteVerbRu(frag)).join(' '))
    for (const p of parts) {
      const t = p.trim()
      // Заголовок списка/задания («Какие оксиды образуются при сжигании следующих веществ:») и обрывки «…» — не ответ.
      if (/^…/.test(t)) continue
      let colonFull = ''
      if (/[:：]$/.test(t)) {
        // «Несмотря на …, бензол не обесцвечивает бромную воду … — характерны реакции замещения:» — законченная мысль,
        // двоеточие лишь вводит перечень; объявление списка («…делятся на следующие группы:») — нет.
        const body = t.replace(/[:：]$/, '').trim()
        const announce = /(следующ|таки[ем]|ниже|вид[ыу]|групп|способ|метод|пример|типа|образом|в виде)\S*\s*$/iu.test(body)
        if (announce || !hasFiniteVerbRu(body) || tokenizeWords(body).filter((w) => w.length >= 3).length < 8 || isHeadingLike(body)) continue
        colonFull = `${body}.`
      }
      // Хвост «, то есть E2Оп, где E – элемент …» после определения — обозначения, а не смысл.
      // «…увеличивается в 2—4 раза: t1 где t2 — скорость …» — хвост формулы без самой формулы.
      let s = colonFull || t
        // «…с самой низкой — цезий, то есть 0,79.» — число без единицы и шкалы ученику ничего не говорит.
        .replace(/,\s*(?:то есть|т\.\s?е\.)\s+\d+(?:[,.]\d+)?\s*(?=[.;]?$)/u, '')
        // «путем кипячения (Ca(HCO3)2 → CaCO3 Mg(HCO3)2 → MgCO3)» — неполные уравнения в скобках: способ оставляем.
        .replace(/\s*\((?:[^()]|\([^()]*\))*→(?:[^()]|\([^()]*\))*\)/gu, (paren) => (hasUnbalancedEquation(paren.trim().slice(1, -1)) || (paren.match(/→/g) ?? []).length >= 2 ? '' : paren))
        .replace(/:\s*(?:\S+\s+){0,3}где\s.*$/u, '.').replace(/,\s*(?:то есть|т\.\s?е\.)\s+[^,]*,\s*где\s.*$/u, '.').replace(/,\s*где\s+\S+\s*[–—-]\s.*$/u, '.').replace(/[;,]\s*$/, '.')
      // «Таким образом, 1 моль газа …» — связка с невидимым учеником текстом; сам факт остаётся.
      const connective = /^(Таким образом|Итак|Так|Следовательно|Значит|Как видно),\s+(?=\S)/u
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
      s = trimUnclosedParen(s)
      if (!s) continue
      // r10: два определения в одной фразе («…, присоединивший электрон, называется окислителем, атом …, отдавший
      // электрон, называется восстановителем») — два кандидата, иначе второе определение закрыто первым термином.
      const pair = /^(.*?\sназыва(?:ется|ются|ют)\s+[^,;]+?)[,;]\s+((?:а\s+)?\p{Ll}.*?\sназыва(?:ется|ются|ют)\s+[^,;]+?)\.?$/u.exec(s)
      if (pair && pair[1]!.split(/\s+/).length >= 4 && pair[2]!.split(/\s+/).length >= 4) {
        out.push(`${pair[1]}.`, `${capitalizeFirst(pair[2]!.replace(/^а\s+/u, ''))}.`)
        continue
      }
      out.push(s)
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
  if (lang !== 'ru') return st.lat / st.letters >= 0.6
  // Формулы («NaCl, KCl, Ba(NO3)2») — не иностранные слова: на язык самой фразы они не влияют.
  const bare = letterStats(sentence.replace(FORMULA_TOKEN_RE, ' ').replace(/(?<!\p{L})[A-Z][a-z]?(?!\p{L})/gu, ' '))
  return bare.letters >= 12 && bare.cyr / bare.letters >= 0.55
}

/** Фраза продолжает чужую мысль: местоимение/указание в начале («Она …», «Такой же процесс …»). */
const DEICTIC_START_RE = /^(?:(?:Кроме того|Также|Однако|Поэтому|Кроме этого),\s+)?(На них|Они|Она|Оно|Он|Их|Его|Её|Ее|Эти|Этот|Эта|Это|Такие|Такой|Такая|Такое|Таким|Там|Данн\S+|При этом|В этом|Этим|Здесь|Тогда|он|она|оно|они|его|её|их)\s/u
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

type Concept = { alts: string[][]; generic: boolean; stem: string; formula?: RegExp }

/** Анион ↔ его формула в записи ионных уравнений и карточек («сульфат-ион» ~ «SO₄²⁻», «BaSO₄»). */
const ANION_FORMULAS: Array<[string, RegExp]> = [
  ['сульфат', /so[4₄]/u], ['сульфит', /so[3₃]/u], ['карбонат', /co[3₃]/u], ['нитрат', /no[3₃]/u], ['фосфат', /po[4₄]/u], ['силикат', /sio[3₃]/u],
]

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
      const formula = ANION_FORMULAS.find(([name]) => stem.startsWith(name))?.[1]
      // «сульфат-ион»: «ион» — служебная часть термина (в формуле иона слова «ион» нет).
      const generic = isGenericStem(stem) || (stem === 'ион' && /[\p{L}]{4,}-ион/u.test(foldText(query)))
      out.push({ alts, generic, stem, formula })
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

const conceptIn = (c: Concept, idx: SentenceIndex) => c.alts.some((alt) => alt.every((s) => hasStem(s, idx))) || Boolean(c.formula?.test(idx.compact))

/** «растворимость» ≠ «раствор», «окисление» ≠ «окислитель»: производное существительное — другое понятие. */
function derivedNoun(word: string, stem: string): boolean {
  if (stem.length < 4 || !word.startsWith(stem)) return false
  return /^(имост|ост[ьия]|ени|ани|тель|щик|изаци|ация|ност)/u.test(word.slice(stem.length))
}

/** Термин назван сам по себе (не производным словом): «называется раствором», но не «называется растворимостью». */
const termIn = (stem: string, where: SentenceIndex) => where.words.some((w) => wordHasStem(w, stem) && !derivedNoun(foldText(w), stem))

/**
 * Окончание прилагательного, образованного от существительного: словообразовательный суффикс обязателен
 * («ион» + «н» + «ой» = «ионной»), иначе «водой» и «окислителем» тоже считались бы прилагательными.
 */
const ADJ_ENDING_RE = /^(?:н|ов|ев|ск|ическ|ичн|альн|ярн|ивн|лив|чат|ист|онн|енн)(ый|ой|ая|ое|ые|ий|яя|ее|ие|ого|его|ому|ему|ым|им|ых|их|ую|юю|ыми|ими)$/u
/** «Связь … называется ионной»: «ионной» — прилагательное от «ион», значит определяют «ионную связь», а не «ионы». */
function derivedAdjectiveOf(word: string, stem: string): boolean {
  if (stem.length < 3 || !word.startsWith(stem)) return false
  return ADJ_ENDING_RE.test(word.slice(stem.length))
}

/**
 * ГЕЙТ ТОЖДЕСТВА ТЕРМИНА (r9): то, что фраза определяет, — сам спрошенный термин, а не слово от него образованное.
 * Отсекает «Полимеризация — это реакция …» на «что такое полимеры» (производное существительное) и
 * «… называется ионной» на «что такое ионы» (производное прилагательное). Сужение класса лишним определением
 * («Двойные соли — …») проверяется отдельно, по лишним словам подлежащего.
 *
 * `adjStems` — основы, которые в самом вопросе стоят прилагательными («ионная связь»): для них проверка
 * прилагательного не применяется, иначе определение «ионной связи» отбрасывалось бы вместе с ошибочными.
 */
function sameHeadTerm(definedWords: readonly string[], keyStems: readonly string[], adjStems: ReadonlySet<string>): boolean {
  if (keyStems.length === 0 || definedWords.length === 0) return false
  const words = definedWords.map((w) => foldText(w))
  const wrongForm = (w: string, k: string) => derivedNoun(w, k) || (!adjStems.has(k) && derivedAdjectiveOf(w, k))
  // Ни одно слово определяемого не должно быть производным от термина …
  if (words.some((w) => keyStems.some((k) => wordHasStem(w, k) && wrongForm(w, k)))) return false
  // … и хотя бы одно должно быть самим термином.
  return keyStems.some((k) => words.some((w) => wordHasStem(w, k) && !wrongForm(w, k)))
}

/** Правая часть уравнения («CaCO3 + 2HCl → CaCl2 + CO2 + H2O» → «CaCl2 + CO2 + H2O»); null — уравнения нет. */
function productSide(text: string): string | null {
  const m = text.match(/([^.:;]*)[→⇌=]([^.;]*)/u)
  if (!m || equationFormulaCount(m[0]!) < 2) return null
  return m[2]!.trim()
}

/**
 * Спрошенное вещество — среди продуктов: его формула или название (со всеми синонимами) в правой части уравнения.
 * «Как получают углекислый газ» + «CO + Cl2 = COCl2» → нет (CO₂ там не образуется).
 */
function conceptInProducts(info: QuestionInfo, text: string): boolean {
  const side = productSide(text)
  if (side === null) return false
  const idx = indexSentence(side)
  const named = info.specific.filter((c) => !info.keyStems.length || info.keyStems.some((k) => c.stem.startsWith(k.slice(0, 4))) || info.keyStems.some((k) => k.startsWith(c.stem.slice(0, 4))))
  const wanted = named.length > 0 ? named : info.specific
  if (wanted.length === 0) return true
  // Формулы продуктов сравниваем по атомам: «оксид углерода(IV)» ~ CO2, но не CO и не COCl2.
  const tokens = (side.match(FORMULA_TOKEN_RE) ?? []).filter(realFormulaToken)
  const compact = foldText(tokens.join(' ')).replace(/[^\p{L}\p{N}]/gu, '')
  return wanted.some((c) => conceptIn(c, idx) || Boolean(c.formula?.test(compact)) || c.alts.some((alt) => alt.length === 1 && alt[0]!.length >= 3 && /^[a-z0-9]+$/u.test(alt[0]!) && compact.includes(alt[0]!)))
}

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
  // r10: «Так как A, B» без B — придаточное без главного («Так как фтор … заряжены отрицательно.») звучит как причина
  // чего угодно; такую фразу не режем (или режем только внутри главного предложения).
  if (/^(Так как|Поскольку|Если(?! проще)|Когда|Хотя|Благодаря тому,? что|Из-за того,? что)\s/u.test(sentence) && words.length <= maxWords * 2) return sentence
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
  // «…решетку определенной формы, которая называется X» — определяемое слово внутри придаточного: перестановка дала бы
  // «X — это …, которая.»; цитируем фразу учебника как есть.
  if (/,?\s*котор\p{L}*$/iu.test(body) || /^(так|итак|например|таким образом)[,\s]/iu.test(body)) return null
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
    checkPlain: 'Понятно? Если хочешь — объясню проще.',
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
    quoteMode: (book: string | null, text: string) => `${book ? `В учебнике ${book} об этом сказано так` : 'В справочнике ATOMLAB об этом сказано так'}: «${text}»`,
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
    checkPlain: 'Is that clear? I can explain it more simply.',
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
    quoteMode: (book: string | null, text: string) => `${book ? `In the ${book} textbook (in Russian) it says` : 'In the ATOMLAB reference cards (in Russian) it says'}: «${text}»`,
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
    checkPlain: 'Tushunarlimi? Xohlasangiz, soddaroq tushuntiraman.',
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
    quoteMode: (book: string | null, text: string) => `${book ? `${book} darsligida (rus tilida) shunday deyilgan` : 'ATOMLAB ma’lumotnomasida (rus tilida) shunday deyilgan'}: «${text}»`,
    exampleTerms: (terms: string) => `Darslikdagi misol: ${terms}.`,
    equation: (eq: string) => `Reaksiya tenglamasi: ${eq}.`,
  },
} as const

function shortQuery(query: string): string {
  // «Ishqorga misol keltiring» → «Ishqor …»: падежные окончания узбекского не повторяем в эхо.
  const q = query
    .trim()
    .replace(/[?!.]+$/, '')
    .replace(/(?<=[a-z'‘’]{4,})(larning|larni|larga|ning|dan|ga|ni|da)(?=\s|$)/giu, '')
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
  /** Основы, стоящие в самом вопросе прилагательными («ионная связь») — для гейта тождества термина. */
  adjStems: ReadonlySet<string>
}

function analyzeQuestion(query: string, lang: StemLang, style: ComposeStyle, topicHint?: string): QuestionInfo {
  const kind = detectKind(query, style)
  const keyTerm = extractKeyTerm(query, lang)
  let concepts = buildConcepts(query)
  const fromHint = concepts.length === 0
  if (fromHint && topicHint) concepts = buildConcepts(topicHint)
  let keyStems = keyTerm ? questionWords(keyTerm).flatMap((w) => w.split('-')).filter((w) => w.length >= 3).map(strictStem) : []
  // «Что такое моль?»: термин — служебное для задач слово (моль, грамм, литр); он и есть тема вопроса.
  // «углекислый газ» ~ «оксид углерода(IV)»: синоним заменяет всё словосочетание — второе слово («газ») отдельно не ищем.
  if (keyStems.length > 1) {
    const syn = keyStems.find((k) => SYNONYMS.some(([key, alts]) => k.startsWith(key) && alts.some((a) => a.length > 1)))
    if (syn) keyStems = [syn]
  }
  if (keyTerm && keyStems.length === 0 && kind === 'definition') {
    keyStems = keyTerm.split(/\s+/).filter((w) => w.length >= 3).map((w) => (strictStem(w).length >= 4 ? strictStem(w) : foldText(w)))
    const own = keyStems.map((stem) => ({ alts: [[stem]], generic: false, stem }))
    concepts = fromHint ? own : [...own, ...concepts.filter((c) => !keyStems.includes(c.stem))]
  }
  const folded = foldText(query)
  if (/[\p{L}]{4,}-ион/u.test(folded) && keyStems.length > 1) keyStems = keyStems.filter((k) => k !== 'ион')
  const specific = concepts.filter((c) => !c.generic)
  // «сульфат-ион» ищем как анион (слово или формула), а не как слитное «сульфатион».
  const compounds = (folded.match(/[\p{L}]{3,}-[\p{L}]{3,}/gu) ?? []).filter((w) => !/^(что|кто|как|какой|какая|какие|как)-/u.test(w) && !/-ион/u.test(w))
  const contrast = CONTRAST_PAIRS.filter(([a, b]) => folded.includes(a) && !folded.includes(b))
  const n = concepts.length
  const needed = n <= 1 ? 1 : n <= 3 ? 0.5 : 0.4
  // «А из чего он состоит?» после подстановки темы — «из чего воздух состоит?»: между «чего» и глаголом стоит термин.
  const composition = /из\s+чего\s+(?:\S+\s+){0,2}состо|что\s+входит\s+в\s+состав|в\s+состав\S*\s+чего|made\s+(up\s+)?of|consists?\s+of|tarkibi/iu.test(folded)
  const factors = /от\s+чего\s+завис|фактор|depend/iu.test(folded)
  // «ионная связь»: основа «ионн» в вопросе — прилагательное, и определение «… называется ионной» термину отвечает.
  const adjStems = new Set(
    (keyTerm ? keyTerm.split(/\s+/) : []).filter((w) => ADJ_RU_RE.test(foldText(w))).map((w) => strictStem(w)).filter((k) => keyStems.includes(k)),
  )
  return { query, lang, kind, keyTerm, keyStems, concepts, specific, terms: kind === 'compare' ? compareTerms(query) : [], compounds, contrast, needed, composition, factors, adjStems }
}

/**
 * Посылка вопроса, названная превосходной степенью: «Почему алмаз твёрдый?» → «Алмаз — самое твёрдое вещество».
 * Такая фраза не объясняет, а повторяет вопрос, поэтому причиной («у него самая низкая …») она не считается.
 */
function premiseEcho(text: string, info: QuestionInfo): boolean {
  const qStems = questionWords(info.query).filter((w) => w.length >= 4).map(strictStem)
  if (qStems.length === 0) return false
  for (const m of text.matchAll(/(?<!\p{L})сам\p{Ll}{1,3}\s+(\p{L}{4,})/gu)) {
    if (qStems.some((q) => q.length >= 4 && wordHasStem(foldText(m[1]!), q))) return true
  }
  return false
}

/**
 * Пересказ посылки вопроса вместо причины: «Почему алмаз такой твёрдый?» → «Алмаз — самое твёрдое вещество в природе».
 * Смысловые слова фразы почти целиком взяты из вопроса, и в ней нет ни связки причины, ни строения.
 */
function premiseRestatement(raw: string, info: QuestionInfo): boolean {
  // Сравнительная степень («самое твёрдое») — это и есть посылка вопроса, поэтому её в оправдание не засчитываем.
  if (/(потому что|так как|поскольку|благодаря|из-за|вследствие|за сч[её]т|объясня\S*ся|обусловл|в результате|приводит к|причин)/iu.test(raw)) return false
  if (MECHANISM_RE.test(raw) || STRUCTURE_CAUSE_RE.test(raw) || PURPOSE_RE.test(raw)) return false
  if (premiseEcho(raw, info)) return true
  const own = contentStems(raw).filter((s) => !isGenericStem(s))
  if (own.length === 0 || own.length > 8) return false
  const qStems = questionWords(info.query).filter((w) => w.length >= 3).map(strictStem)
  const shared = own.filter((s) => qStems.some((q) => stemsMatch(q, s))).length
  return shared / own.length >= 0.7
}

function buildCandidates(hits: readonly KnowledgeHitLike[], info: QuestionInfo, style: ComposeStyle): Candidate[] {
  const { lang, kind, keyStems, concepts } = info
  const isWhatIs = kind === 'definition'
  const queryWordStems = questionWords(info.query).filter((w) => w.length >= 3).map(strictStem)
  // «Как получают углекислый газ?» — вещество вопроса должно стоять среди продуктов уравнения.
  const obtainQuery = lang === 'ru' && kind === 'how' && /получ|производ|синтез/iu.test(info.query)
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
      // Формула/уравнение не сходится (OCR потерял атом) — такую фразу ученику не показываем.
      if (!formulaSane(raw)) return
      if (raw.length < 24 || raw.length > 420) return
      if (isStructuralNoise(raw, hit.type ?? '')) return
      // Обрыв перестановки/вёрстки: фраза кончается относительным местоимением («…, которая.») или «— это так, …».
      if (/(?<!\p{L})котор\p{L}*\.?$/iu.test(raw.trim()) || /[—–]\s*это\s+(так|итак|например|таким образом),/iu.test(raw)) return
      // Тест/перевод теста: обрыв без сказуемого на послелог («… qistirma orqali.»).
      if (lang !== 'ru' && /(?<!\p{L})(orqali|bilan|uchun|through|by means of|with)\.?$/iu.test(raw.trim())) return
      if (lang === 'ru') {
        // Подпись таблицы/рисунка: именные группы без сказуемого с заглавной внутри («… в кислотах и основаниях Индикаторная бумага»).
        if (/\p{Ll}{3,}\s+\p{Lu}\p{Ll}{3,}/u.test(raw) && !/[.!?…»)]$/u.test(raw.trim()) && !/[—–=→:]|\sэто\s/u.test(raw)) return
        // Обрыв фразы: кончается предлогом/союзом или парой коротких обрывков («… графит при по.»).
        if (/(?<!\p{L})(при|по|на|в|во|с|со|к|от|до|из|за|для|без|под|над|и|а|но|или|что|как|чем)\.$|(?<!\p{L})\p{Ll}{1,3}\s+\p{Ll}{1,2}\.$/u.test(raw.trim())) return
        // «… восстанавливается до следующих веществ.» — объявление перечня, которого во фразе нет.
        if (/следующ\p{L}*(?:\s+\p{L}+){0,2}\s*\.?$/u.test(raw.trim())) return
        // Фраза с маленькой буквы — обрывок (обозначения «m(в-ва) = …», «pH» — латиница, их не трогаем).
        if (/^[а-яё]/u.test(raw)) return
      }
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
      // r10: «Так как A, B» / «A, в результате чего B» отвечает на «почему Q», только если следствие B — про Q
      // (признак из вопроса: «активный», «щелочную», «тушат»); иначе это причина другого факта.
      const causal = CAUSAL_RE.test(raw) && !(kind === 'why' && effectOffQuestion(raw, info))
      const formulas = (raw.match(FORMULA_TOKEN_RE) ?? []).filter((tok) => !/^[IVXLCDM]+$/.test(tok) && realFormulaToken(tok)).length
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
        (stems.every((k) => termIn(k, namedIdx)) ||
          (stems.length >= 2 && stems.some((k) => termIn(k, namedIdx)) && stems.every((k) => termIn(k, namedIdx) || hasStem(k, firstIdx)))))
      // Определение термина: «Термин — …», «Наука химия изучает …», «… называются термином».
      // Подлежащее до связки — сам термин (± 2 слова: «Наука», «Термин»), скобки не считаем:
      // «Эпоха классической химии (1860 – …)» и «Единственный элемент, который не образует оксид, — фтор»
      // определениями «химии»/«оксидов» не являются.
      const noParen = raw.replace(/\([^)]*\)/g, ' ')
      const copulaAt = noParen.search(COPULA_RE)
      const subject = copulaAt > 0 ? noParen.slice(0, copulaAt) : ''
      const subjectIdx = indexSentence(subject)
      const subjectIs = (stems: readonly string[]) =>
        stems.length > 0 && subjectIdx.words.length > 0 && subjectIdx.words.length <= stems.length + 2 && stems.every((k) => hasStem(k, subjectIdx) || (stems.length === 1 && keyConceptIn(k, subjectIdx)))
      const definesStems = (stems: readonly string[]) =>
        isNamed(stems) || (definitional && copulaAt >= 0 && copulaAt <= 60 && subjectIs(stems))
      // uz: «Oksidlar ikki elementdan … kisloroddir.» — термин первым словом, сказуемое «-dir»/«hisoblanadi» в конце.
      const uzDefinition =
        lang === 'uz' && keyStems.length > 0 && keyStems.every((k) => hasStem(k, indexSentence(raw.split(/\s+/).slice(0, keyStems.length).join(' ')))) &&
        /(dir|hisoblanadi|deyiladi)[.!]?$/iu.test(raw)
      const demonstrative = /^(Этот|Эта|Это|Эти|Такой|Такая|Такое|Такие|Данный|Данная)\s\S+\s+называ/u.test(raw)
      // «Амфотерный гидроксид — растворяется и в кислотах …»: после тире сразу глагол — свойство, а не определение.
      const verbAfterDash =
        lang === 'ru' && copulaAt >= 0 && /^\s*[—–-]\s*(?!явля)\p{Ll}+(ется|ются|ится|ятся|ает|яет|ует|ит|ют|ут|ят|ат)(?!\p{L})/u.test(noParen.slice(copulaAt))
      // «Оксид углерода(II) CO (угарный газ) – бесцветный газ …»: термин вопроса — синоним в скобках при подлежащем.
      const rawCopulaAt = raw.search(COPULA_RE)
      const parenInSubject = rawCopulaAt > 0 && rawCopulaAt <= 90 ? [...raw.slice(0, rawCopulaAt).matchAll(/\(([^()]{3,40})\)/gu)].map((x) => x[1]!).join(' ') : ''
      const parenIdx = indexSentence(parenInSubject)
      const parenSubject =
        definitional && keyStems.length > 0 && parenInSubject.length > 0 && parenIdx.words.length <= keyStems.length + 2 && subjectIdx.words.length <= 6 &&
        keyStems.every((k) => keyConceptIn(k, parenIdx))
      const definesKey = ((definesStems(keyStems) || parenSubject) && !demonstrative && !(verbAfterDash && isWhatIs && hit.score === 0)) || uzDefinition
      // «Оксиды — …» точнее, чем «Амфотерные оксиды — …»: подлежащее ровно из слов термина (± «наука», артикль).
      const subjectWords = subjectIdx.words.filter((w) => !/^(the|an?|наука|термин)$/.test(w))
      const exactSubject =
        definesKey &&
        (uzDefinition ||
          (isNamed(keyStems) ? namedWords <= keyStems.length : subjectWords.length === keyStems.length) ||
          (parenSubject && parenIdx.words.filter((w) => /[а-яa-z]{2,}/u.test(w) && !/^[a-z]{1,2}\d*$/u.test(w)).length === keyStems.length))
      // «X — оксид.»: после связки только родовое слово (без отличительного признака) — слишком тонкое определение.
      const predicateText = copulaAt >= 0 ? noParen.slice(copulaAt).replace(/^\s*(?:[—–-]|это|явля\S*|представля\S* собой)\s*(?:это\s+)?/u, '') : ''
      const thinDefinition =
        lang === 'ru' && definesKey && !isNamed(keyStems) && predicateText.length > 0 && !hasFiniteVerbRu(predicateText) &&
        tokenizeWords(predicateText).filter((w) => w.length >= 3 && /[а-я]/u.test(w)).length <= 2
      // «Двойные соли — соли, состоящие из двух металлов …» на вопрос «что такое соли»: подлежащее — термин с лишним
      // определением, которого в вопросе не было (подвид), значит это не определение спрошенного понятия.
      // Лишние слова — только прилагательные перед термином («двойные», «кислые»); «Основной причиной кислотных
      // дождей являются …» — не подвид, а причина, там лишнее слово — существительное.
      const subjectExtra = subjectWords.filter((w) => !keyStems.some((k) => wordHasStem(w, k)) && !queryWordStems.some((q) => wordHasStem(w, q)))
      const subClass =
        definesKey && !exactSubject && keyStems.length > 0 && !isNamed(keyStems) &&
        keyStems.every((k) => hasStem(k, subjectIdx)) &&
        subjectExtra.length > 0 && subjectExtra.every((w) => w.length >= 3 && ADJ_RU_RE.test(w)) &&
        keyStems.some((k) => wordHasStem(subjectWords[subjectWords.length - 1] ?? '', k)) &&
        // Родовое слово сказуемого — сам термин («Двойные соли — соли, состоящие из …»): это определение подвида.
        keyStems.some((k) => hasStem(k, indexSentence(predicateText)))
      // uz: «Ion birikmalari …dir» — подлежащее «ионные соединения» (изафет -lari/-si), а не сам «ion»: сужение класса.
      const uzCompoundSubject =
        uzDefinition && /^\p{L}{6,}(?:lari|ligi|chasi|si)$/u.test(foldText(raw.split(/\s+/)[keyStems.length] ?? ''))
      // Гейт тождества (r9): слова, которые фраза действительно определяет, — и они должны быть самим термином.
      const definedWords = isNamed(keyStems)
        ? namedIdx.words
        : parenSubject
          ? parenIdx.words
          : subjectWords.length > 0
            ? subjectWords
            : indexSentence(raw.split(/\s+/).slice(0, keyStems.length).join(' ')).words
      // Лишние слова определяемого, которых нет ни в термине, ни в вопросе, сужают класс («Двойные соли — …»).
      const definedExtra = definedWords.filter(
        (w) => !keyStems.some((k) => wordHasStem(w, k)) && !queryWordStems.some((q) => wordHasStem(w, q)) && !/^(the|an?|наука|термин|понятие)$/u.test(foldText(w)),
      )
      // «Коррозия – это разрушение металла …» на «что такое коррозия металлов»: подлежащее — вершина термина (первое слово,
      // существительное той же леммы), остальные слова термина стоят в сказуемом. Это определение того же понятия.
      const headNounDefinition =
        lang === 'ru' && definitional && keyStems.length >= 2 && copulaAt > 0 && copulaAt <= 60 && !verbAfterDash && !demonstrative &&
        subjectWords.length === 1 && wordHasStem(subjectWords[0]!, keyStems[0]!) && !ADJ_RU_RE.test(foldText(subjectWords[0]!)) &&
        sameHeadTerm([subjectWords[0]!], [keyStems[0]!], info.adjStems) &&
        keyStems.slice(1).every((k) => hasStem(k, indexSentence(predicateText)))
      const headIdentity =
        (definesKey && !subClass && !uzCompoundSubject && definedExtra.length === 0 && sameHeadTerm(definedWords, keyStems, info.adjStems)) || headNounDefinition
      let definesTerm = -1
      info.terms.forEach((t, i) => {
        if (definesTerm < 0 && definesStems(t)) definesTerm = i
      })
      // «Если … можно растворить ещё …, то такой раствор называется ненасыщенным»: название — отличительное слово стороны,
      // остальные слова стороны — в самой фразе.
      if (definesTerm < 0 && info.terms.length === 2 && namedPart.length > 0 && !demonstrative) {
        info.terms.forEach((t, i) => {
          const other = info.terms[1 - i]!
          const distinct = t.filter((s) => !other.some((o) => o === s))
          if (definesTerm < 0 && distinct.length > 0 && namedWords <= t.length && distinct.every((s) => hasStem(s, namedIdx)) && t.every((s) => hasStem(s, idx))) definesTerm = i
        })
      }
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
        !definesKey && !headNounDefinition && definesTerm < 0 && /\s[—–]\s/u.test(noParen.slice(0, 64)) && copulaAt > 0 && copulaAt <= 60 && subjectIdx.words.length <= 5 && !subjectIs(keyStems)
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
      if (obtainQuery) {
        if (/(получ|производ|синтез|добыва)/iu.test(raw)) score += 0.6
        else if (/(разложени|разлага|применени|использу)/iu.test(raw)) score -= 1.2
        if (/отлича\S*\s+от/iu.test(raw) && !/отлича/iu.test(info.query)) score -= 1.2
        if (keyStems.length > 0 && otherObtainedObject(raw, keyStems)) score -= 1.8
        // Уравнение есть, а спрошенного вещества среди продуктов нет («CO + Cl2 = COCl2» на вопрос про CO₂).
        const side = productSide(raw)
        if (side !== null) score += conceptInProducts(info, raw) ? 0.9 : -2.4
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
      if (thinDefinition) score -= isWhatIs ? 3.2 : 1.2
      if (subClass) score -= isWhatIs ? 3.4 : 1.0
      // Гейт тождества: определение не того термина («Полимеризация — …» на «что такое полимеры») — не ответ.
      if (isWhatIs && definesKey && !headIdentity) score -= 3.4
      if (headNounDefinition && !definesKey) score += isWhatIs ? 2.2 : 0.6
      // Частный случай учебника выдан за общее правило — не ответ на общий вопрос.
      const exampleBound = lang === 'ru' && EXAMPLE_BOUND_RE.test(raw)
      if (exampleBound && kind !== 'example') score -= 2.2
      // «Почему алкены вступают в реакции присоединения?» — причина другого типа реакции («окисления») не годится.
      const askedTypes = kind === 'why' || kind === 'how' ? reactionTypes(info.query) : []
      const ownTypes = askedTypes.length > 0 ? reactionTypes(raw) : []
      const typeMismatch = askedTypes.length > 0 && ownTypes.length > 0 && !ownTypes.some((ty) => askedTypes.includes(ty))
      if (typeMismatch) score -= 2.6
      else if (askedTypes.length > 0 && ownTypes.some((ty) => askedTypes.includes(ty))) score += 0.8
      // Риторический зачин («Все мы знаем, что …») — подводка, а не факт.
      if (RHETORIC_RE.test(raw)) score -= 2
      // Безличный обрывок правила из карточки («Считается как сумма атомных масс …») — без подлежащего.
      if (VERB_INITIAL_RE.test(raw)) score -= 1.6
      // Причина строения («каждый атом образует ковалентную связь …») и назначения («защищающий … от излучения»).
      if (kind === 'why' && STRUCTURE_CAUSE_RE.test(raw)) score += 0.9
      if (kind === 'why' && /(важ|нужен|нужна|необходим|значени)/iu.test(info.query) && PURPOSE_RE.test(raw)) score += 0.9
      // «Почему алмаз твёрдый?» → «Алмаз — самое твёрдое вещество»: пересказ посылки вопроса, а не причина.
      if (kind === 'why' && premiseRestatement(raw, info)) score -= 2.2
      // «Как распознать ион?» — реактив обязателен вместе с признаком; «при нагревании» на вопрос «в растворе» — нет.
      if (kind === 'how' && DETECT_RE.test(info.query)) {
        if (/распозна|обнаружи|определ/iu.test(raw)) score += 0.8
        if (!REAGENT_RE.test(raw)) score -= 0.8
        if (/(при нагревании|при прокаливании|термическ)/iu.test(raw) && /раствор/iu.test(info.query)) score -= 1.4
      }
      // Почему: исход («приводит к летальному исходу») — не механизм; механизм («соединяется с гемоглобином, что …») выше.
      if (kind === 'why' && MECHANISM_RE.test(raw) && !OUTCOME_ONLY_RE.test(raw)) score += 0.8
      if (kind === 'why' && OUTCOME_ONLY_RE.test(raw) && !MECHANISM_RE.test(raw)) score -= 1.2
      // «Как распознать/определить ион?» — реактив и наблюдаемый признак (осадок, цвет, газ).
      if (kind === 'how' && DETECT_RE.test(info.query)) score += OBSERVABLE_RE.test(raw) ? 1.2 : -0.6
      // «Как отделить/разделить …?» — способ с прибором/методом (магнит, фильтр, отстаивание), а не получение вещества.
      if (kind === 'how' && SEPARATE_RE.test(info.query)) score += SEPARATION_TOOL_RE.test(raw) ? 1.4 : /(получ|образует|→|=)/u.test(raw) ? -1.2 : 0
      // «До начала XX в. азотную кислоту получали …» — как делали раньше, а не «как получают» сейчас.
      if (kind === 'how' && HISTORICAL_RE.test(raw) && !PAST_QUERY_RE.test(info.query)) score -= 1.6
      // «… используются электрохимические методы.» — абстрактный «метод» без самих мер.
      if (kind === 'how' && /(методы|способы|меры)\.?$/u.test(raw.trim()) && !/[:,].*,/u.test(raw)) score -= 1.2
      if (FILLER_RE.test(raw) && !FILLER_RE.test(info.query)) score -= 1
      if (offCondition) score -= 1.8
      // Условие вопроса названо в самой фразе («В лаборатории … получают») — точнее общего описания; «В природе …» — про другое.
      if (info.contrast.length > 0 && !offCondition) {
        if (info.contrast.some(([a]) => hasStem(a, idx))) score += 1.2
        else if (/^В\s+природе|встречается в природе/iu.test(raw)) score -= 1.2
      }
      if (/^[a-zа-яё]/.test(raw)) score -= 0.9
      // Без сказуемого, связки и формулы — подпись/пункт плана, а не утверждение.
      if (lang === 'ru' && formulas === 0 && !hasFiniteVerbRu(raw) && !/[—–=→]|\sэто\s/u.test(raw)) score -= 1.5
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
        thin: thinDefinition,
        subClass,
        headIdentity,
        exampleBound,
        typeMismatch,
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
  // r9: причина/способ про другой тип реакции и частный случай учебника прямым ответом быть не могут.
  // r10: «как получают X» — «Y получают из X» не ответ ни в одной ветке (X — сырьё, а не продукт).
  const obtainQuery = kind === 'how' && info.lang === 'ru' && /получ|производ/iu.test(info.query)
  const usable = cands.filter(
    (c) =>
      c.score > 0.6 && !c.imprecise && compoundsIn(info, c) && !c.typeMismatch && !(c.exampleBound && kind !== 'example') &&
      !(obtainQuery && info.keyStems.length > 0 && otherObtainedObject(c.text, info.keyStems) && !conceptInProducts(info, c.text)),
  )
  const strong = (c: Candidate) => c.overlap >= needed - 1e-9 && (info.keyStems.length === 0 || c.keyAll)
  // «Ответ из того же места, что нашёл поиск»: фраза из лучших фрагментов с совпадением понятий ≥ половины.
  const fallback = () =>
    usable.find((c) => strong(c) && !c.definesOther) ??
    usable.find((c) => c.hitIndex <= 2 && c.keyAll && c.overlap >= Math.min(0.5, needed) - 1e-9 && !c.definesOther)
  // «Из чего состоит X», «от чего зависит X»: лучший по оценке состав/перечень, а не определение X.
  if ((info.composition || info.factors) && kind !== 'compare' && kind !== 'calc') {
    // Состав — это части: доли в процентах, «состоит из …», перечисление веществ. Фразы без частей не отвечают.
    const parts = (c: Candidate) =>
      !info.composition ||
      /\d+(?:[,.]\d+)?\s*%|(?:состо\S*|содерж\S*|включа\S*|входят|образован\S*|имеет|имеют)\s+(?:из\s+|\S+\s+){0,2}\S+\s*[,:]|(?:состо\S*|содерж\S*|включа\S*|входят|имеет|имеют)\s+(?:из\s+|\S+\s+){0,2}\S+\s+и\s+\S+/iu.test(c.text)
    const direct = usable.find((c) => strong(c) && parts(c) && !c.definesOther && !c.subjectOther && !c.subClass) ?? usable.find((c) => strong(c) && !c.definesOther && !c.subjectOther && !info.composition)
    if (direct) return { direct, missingWhy: false }
  }
  switch (kind) {
    case 'definition': {
      // Два определения одного термина расходятся (Жаккар сказуемых < 0.3): верим тому, что подтверждает другой фрагмент
      // (карточка/второй параграф), при равенстве — определению из параграфа урока (первый фрагмент учебника).
      const defs = usable.filter((c) => c.headIdentity)
      if (defs.length >= 2) {
        const pred = (c: Candidate) => c.stems.filter((s) => s.length >= 3 && !isGenericStem(s) && !info.keyStems.some((k) => stemsMatch(k, s)))
        const top = defs[0]!
        // Приоритет урока: верхнее определение из другого § и расходится с определением из § урока — берём урочное,
        // если его подтверждает не меньше фрагментов.
        const lessonCand = cands.find((c) => !c.extra && c.hitType === 'textbook' && c.citation)
        const lessonSec = lessonCand ? sectionOf(lessonCand.citation) : ''
        if (lessonSec && sectionOf(top.citation) !== lessonSec) {
          const support = (d: Candidate) => new Set(cands.filter((x) => x.hitIndex !== d.hitIndex && jaccard(pred(d), pred(x)) >= 0.3).map((x) => x.hitIndex)).size
          const own = defs.find((d) => d !== top && !d.extra && sectionOf(d.citation) === lessonSec && jaccard(pred(top), pred(d)) < 0.3)
          if (own && support(own) >= support(top)) return { direct: own, missingWhy: false }
        }
      }
      // Определение из найденного по уроку важнее подтянутого из другого § (score 0): «добавки» — только если своего нет.
      // r9 ГЕЙТ ТОЖДЕСТВА: определением считается только фраза, чьё подлежащее — ровно спрошенный термин.
      // Если такой нет — определения нет: дальше сработает режим цитаты, а не определение соседнего понятия.
      const own = usable.filter((c) => c.headIdentity)
      const direct =
        own.find((c) => !c.extra && !c.thin) ??
        own.find((c) => !c.thin) ??
        own.find((c) => !c.extra) ??
        own[0]
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
      // r9: причина именно того, о чём спросили — фраза со ВСЕМИ смысловыми понятиями вопроса («накипь», а не «мыло»).
      const fullScope = (c: Candidate) => info.specific.every((k) => conceptIn(k, indexSentence(c.text)))
      const causal = (c: Candidate) =>
        c.causal && enough(c) && c.specific > 0 && !c.definesOther && !/^(Поэтому|Следовательно)[\s,]/u.test(c.text)
      // «… эти оксиды превращаются …» отсылает к предыдущей фразе — самостоятельным ответом быть не может.
      const standalone = (c: Candidate) => !ANAPHOR_RE.test(c.text.split(/\s+/).slice(0, 6).join(' '))
      const causalPick = usable.find((c) => causal(c) && fullScope(c) && standalone(c)) ?? usable.find(causal)
      // Механизм раньше исхода: «легче соединяется с гемоглобином, что ухудшает …» вместо «приводит к летальному исходу».
      const mechanism =
        causalPick && OUTCOME_ONLY_RE.test(causalPick.text) && !MECHANISM_RE.test(causalPick.text)
          ? usable.find((c) => c !== causalPick && enough(c) && c.keyAll && MECHANISM_RE.test(c.text) && !OUTCOME_ONLY_RE.test(c.text) && !c.definesOther && !DEICTIC_START_RE.test(c.text) && !isTelegraphicCard(c.text, c.hitType))
          : undefined
      if (mechanism) return { direct: mechanism, second: causalPick, missingWhy: false }
      const direct = causalPick
      if (direct) return { direct, missingWhy: false }
      // Ворота доказательств: причина в широком смысле («, у него самая низкая температура кипения», «слабее, чем …»).
      const gated = evidenceGate(usable, info)
      if (gated && enough(gated)) return { direct: gated, missingWhy: false }
      const fact = fallback()
      if (!fact) return null
      // Объяснение рядом с фактом в том же фрагменте учебника («Характерные свойства металлов объясняются …»).
      const near = usable
        .filter((c) => c !== fact && c.hitIndex === fact.hitIndex && Math.abs(c.pos - fact.pos) <= 4 && c.keyAll && !c.definesOther)
        .filter((c) => /объясня|обусловл|explained by|tushuntiriladi/iu.test(c.text))
      return near[0] ? { direct: fact, second: near[0], missingWhy: false } : { direct: fact, missingWhy: !causeEvidence(fact.text, info) }
    }
    case 'how': {
      // «Реакция образования сложного эфира из спирта с кислотой называется …» — тоже ответ на «как получают».
      // «В промышленности?» — лабораторный способ не ответ (и наоборот), если есть способ с нужным условием.
      // «Как получают X?»: способ с названным процессом (электролиз, брожение, восстановление) — раньше «получают из <сырьё>».
      const obtain = info.lang === 'ru' && /получ|производ/iu.test(info.query)
      // r10: «Нитраты получают … азотной кислоты …», «Ацетон получают из … уксусной кислоты» — получают другое вещество,
      // а X лишь исходное; такая фраза не отвечает на «как получают X», если X не стоит среди продуктов уравнения.
      const obtains = (c: Candidate) =>
        (/(получ|производ|синтез|добыва|(?<!(?:^|\s)с\s)образовани)/iu.test(c.text) || conceptInProducts(info, c.text)) &&
        (!HISTORICAL_RE.test(c.text) || PAST_QUERY_RE.test(info.query)) &&
        (!otherObtainedObject(c.text, info.keyStems) || conceptInProducts(info, c.text))
      // «Как распознать ион?»: реактив + наблюдаемый признак (осадок/цвет/газ) по термину вопроса.
      if (DETECT_RE.test(info.query)) {
        // Проба = реактив + наблюдаемый признак. Фраза без обоих не отвечает на «как распознать», какой бы ни была оценка.
        const test = (c: Candidate) =>
          OBSERVABLE_RE.test(c.text) && REAGENT_RE.test(c.text) && !c.definesOther && !c.offCondition && !c.subClass &&
          !(/раствор/iu.test(info.query) && /(при нагревании|при прокаливании)/iu.test(c.text))
        const detect =
          usable.find((c) => c.keyAll && test(c) && /распозна|обнаружи|определ/iu.test(c.text)) ??
          usable.find((c) => c.keyAll && test(c) && (c.method || REACTION_RE.test(c.text))) ??
          usable.find((c) => (c.keyAll || c.titleKey) && test(c) && REACTION_RE.test(c.text))
        if (detect) return { direct: detect, missingWhy: false }
      }
      // «Как отделить …?»: способ с прибором/методом (магнит, фильтр) из найденного.
      if (SEPARATE_RE.test(info.query)) {
        const tool = usable.find((c) => SEPARATION_TOOL_RE.test(c.text) && c.overlap >= Math.min(0.5, needed) - 1e-9 && !c.definesOther && !c.offCondition)
        if (tool) return { direct: tool, missingWhy: false }
      }
      const direct =
        (obtain ? usable.find((c) => c.method && strong(c) && obtains(c) && PROCESS_RE.test(c.text) && (!c.definesOther || c.keyInHead) && !c.offCondition && c.score > 1) : undefined) ??
        // r9: «как получают X» — во фразе должно быть само получение X (глагол получения или X среди продуктов), а не
        // процесс, где X — исходное вещество («она восстанавливается до …», «вулканизация — нагревание каучука»).
        (obtain ? usable.find((c) => c.method && strong(c) && obtains(c) && (!c.definesOther || c.keyInHead) && !c.offCondition) : undefined) ??
        usable.find((c) => !obtain && c.method && strong(c) && (!c.definesOther || c.keyInHead) && !c.offCondition) ??
        // r10: «как получают X» — без фразы о получении X ответа нет (дальше — цитата или реакции из указателя учебника)
        (obtain ? undefined : usable.find((c) => c.method && strong(c) && (!c.definesOther || c.keyInHead)) ?? fallback())
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
        // Сравнение двух понятий: перечень «бывают: A, B, C» — не отличие; нужна фраза с противопоставлением или определение стороны.
        const notList = usable.filter((c) => !(c.classify && /:\s*\S.*,/u.test(c.text)))
        const one =
          notList.find((c) => strong(c) && CONTRAST_WORDS_RE.test(c.text)) ??
          notList.find((c) => c.definesTerm >= 0)
        if (one) return { direct: one, missingWhy: false }
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
      // r9: «обратимые … (синтез NH₃, этерификация)» — спрошенный класс лишь в скобочном ПЕРЕЧНЕ представителей другого
      // понятия: это пример обратимых реакций, а не пример этерификации. Скобка-роль без перечня («участвует MnO2 в
      // качестве катализатора») — часть самого примера и остаётся.
      const keyOnlyInParens = (text: string) =>
        info.keyStems.length > 0 && !info.keyStems.some((k) => hasStem(k, indexSentence(text.replace(/\([^()]*,[^()]*\)/gu, ' ')))) && info.keyStems.every((k) => hasStem(k, indexSentence(text)))
      const fits = (c: Candidate) =>
        qualifierOk(info.query, c.text) && formulaClassOk(info.query, c.text) && !conditionedExample(c, cands) && !c.subjectOther && !DEICTIC_START_RE.test(c.text) && !DANGLING_RE.test(c.text) && !RESTRICT_NEXT_RE.test(c.text) && !/\s[—–]\s*это\s/u.test(c.text) &&
        !keyOnlyInParens(c.text)
      const exUsable = usable.filter((c) => fits(c) && !c.subClass)
      // «Средние, или нормальные соли: NaCl, KCl, CaCl2, …» — перечень представителей класса: лучший пример.
      const members = exUsable.find(
        (c) => (c.keyAll || c.titleKey) && /^[^:]{3,60}:\s*[A-Z(]/u.test(c.text) && !/[→⇌]/u.test(c.text) && equationFormulaCount(c.text) >= 2,
      )
      if (members) return { direct: members, missingWhy: false }
      const direct =
        exUsable.find((c) => c.example && c.keyAll && c.formulas >= 1 && c.formulas <= 6 && isRealExample(c.text)) ??
        exUsable.find((c) => c.example && (c.keyAll || c.specific > 0) && isRealExample(c.text)) ??
        exUsable.find((c) => c.example && c.keyAll && c.formulas >= 1 && c.formulas <= 6 && !c.definitional)
      if (direct) return { direct, missingWhy: false }
      // «Примеры: горение, нейтрализация …», «C + O2 = CO2 + 393 кДж» — пример по термину вопроса из любого найденного фрагмента.
      const gated = evidenceGate(usable.filter(fits), info)
      if (gated) return { direct: gated, missingWhy: false }
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
  const exampleWord = /(например|к примеру|такие как|примеры?\s*:)/iu.test(text)
  if (CAUSAL_RE.test(text) && !exampleWord) return false
  // «Соединение Na2SO4•10H2O называется глауберовой солью» — название вещества, а не пример класса.
  if (/называ(ется|ются|ют)|deb ataladi|is called/iu.test(text) && !exampleWord) return false
  if ((text.match(/например/giu) ?? []).length >= 2) return false
  // «2H2O + 4ē = O2 + 4H+. при электролизе раствора …» — полуреакция с обрывком текста.
  if (/[.!?]\s+\p{Ll}|ē/u.test(text)) return false
  if (/^(Составляют|Получают|Образуют|Пишут|Записывают|Определяют|Применяют|Используют)\s/u.test(text)) return false
  const outside = text.replace(/\((?:[^()]|\([^()]*\))*\)/gu, ' ')
  const formulasOutside = equationFormulaCount(outside)
  // «2KClO3 → 2KCl + 3O2↑ (участвует MnO2 в качестве катализатора)» — представитель понятия только в скобках-пояснении.
  if (/\([^()]*(в качестве|участву|в роли)[^()]*\)/u.test(text)) return false
  // «Реакции замещения AB + C → AC + B» — буквенная схема; «…: + Br₂ (Fe) → …» — уравнение без левой части.
  if (/[→⇌=]/u.test(outside) && formulasOutside === 0) return false
  if (/(^|:\s*)\+\s*[A-Z]/u.test(text)) return false
  // «щелочной гидролиз жиров → мыла + глицерин» — стрелка между словами: запись карточки, а не уравнение.
  if (/[→⇌]/u.test(text) && formulasOutside < 2) return false
  // «(управление реакцией светом, пример HOD → HO+D)» — вещества только в скобках пояснения.
  return formulasOutside > 0 || exampleWord
}

const CLASSIFY_QUERY_RE = /какие\s+(?:\S+\s+){0,3}(бывают|есть)|виды|типы|классифик|types of|turlari/iu
const COUNT_WORDS: Record<string, number> = { два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6 }

/**
 * Объявление классификации без самих групп («они делятся на четыре типа.») + нумерованные заголовки пунктов того же §
 * («1. Ионная кристаллическая решетка.») → «…делятся на четыре типа: ионная кристаллическая решетка, атомная …».
 */
function classifyWithHeads(direct: Candidate, hits: readonly KnowledgeHitLike[], info: QuestionInfo): Candidate | null {
  const announce = direct.text.match(/на\s+(два|две|три|четыре|пять|шесть|\d)\s+(тип\S*|вид\S*|групп\S*|класс\S*)\.?$/u)
  if (!announce) return null
  const want = COUNT_WORDS[announce[1]!] ?? Number(announce[1])
  const section = sectionOf(direct.citation)
  const heads = new Map<number, string>()
  for (const hit of hits) {
    if (section && hit.citation && sectionOf(hit.citation) !== section) continue
    for (const m of repairLayout(hit.text).matchAll(/(?:^|\n)\s*(\d)[.)]\s*(\p{Lu}[^.:\n]{2,60}?)\s*[.:](?=\s|$)/gu)) {
      const n = Number(m[1])
      const head = m[2]!.trim()
      const idx = indexSentence(head)
      if (heads.has(n) || tokenizeWords(head).length > 5 || !info.keyStems.every((k) => hasStem(k, idx))) continue
      heads.set(n, head.charAt(0).toLowerCase() + head.slice(1))
    }
  }
  const list = [...heads.entries()].sort((a, b) => a[0] - b[0]).map(([, h]) => h)
  if (list.length < 2 || list.length > want) return null
  return { ...direct, text: `${direct.text.replace(/\.$/u, '')}: ${list.join(', ')}.` }
}

/** Строка карточки без подлежащего: «Необратимые идут …», «Образуется в растворе …», «Временная (…) снимается … → …», «Получение: …». */
function isTelegraphicCard(text: string, hitType: string): boolean {
  if (hitType !== 'card' && hitType !== 'faq' && hitType !== 'summary') return false
  return (
    /^\p{Lu}\p{Ll}+(ые|ие|ая|ое)\s+(\([^)]*\)\s+)?(\p{Ll}+о\s+)?\p{Ll}+(ут|ют|ят|ат|ется|ится)\s/u.test(text) ||
    /^(Образуется|Получают|Применяют|Используют|Встречается|Содержится)\s|^(Получение|Применение|Нахождение в природе)\s*:/u.test(text) ||
    // «Бесцветный ядовитый газ без запаха, образуется при …» — признаки без названия вещества.
    /^\p{Lu}\p{Ll}+(ый|ий|ой|ая|ое|ые|ие)\s+[^,.;]{3,60},\s*\p{Ll}+(ется|ются|ится|ятся|ет|ит|ут|ют)\s/u.test(text) ||
    // «Соль сильной кислоты и сильного основания (NaCl) — гидролиза практически нет, pH≈7.»
    /\s[—–]\s*(?:\p{Ll}+\s+){1,2}(?:практически\s+)?(нет|есть)[,.;]/u.test(text) ||
    /\p{Ll}\s*→\s*[A-Z][^+]*$/u.test(text)
  )
}

/**
 * Причина для «почему»: связка причины, строение вещества («каждый атом образует связь»), назначение («защищает от …»)
 * или уступка с продолжением («Несмотря на …, бензол не обесцвечивает … — характерны реакции замещения»).
 * Пересказ посылки вопроса («самое твёрдое вещество») причиной не считается.
 */
function causeEvidence(text: string, info: QuestionInfo): boolean {
  if (premiseEcho(text, info)) return false
  if (CAUSE_EVIDENCE_RE.test(text) || STRUCTURE_CAUSE_RE.test(text)) return true
  if (/(важ|нужен|нужна|нужно|необходим|значени|польз)/iu.test(info.query) && PURPOSE_RE.test(text)) return true
  // «Несмотря на …, X не … — характерны реакции замещения»: продолжение после тире и есть причина.
  return /(несмотря на|в отличие от)[^.]*[—–-]\s*\p{L}/iu.test(text) || /[—–-]\s*характерн\S*\s/iu.test(text)
}

/** Фраза проходит проверку своего типа вопроса: определение / причина / способ / пример. */
function kindEvidence(c: Candidate, info: QuestionInfo): boolean {
  switch (info.kind) {
    case 'definition':
      // r9: определением считается только фраза о самом спрошенном термине (гейт тождества).
      return c.headIdentity
    case 'why':
      return causeEvidence(c.text, info)
    case 'how':
      // r10: «как получают X» — «Y получают из X» не доказательство (X — сырьё)
      if (info.lang === 'ru' && /получ|производ/iu.test(info.query) && info.keyStems.length > 0 && otherObtainedObject(c.text, info.keyStems) && !conceptInProducts(info, c.text)) return false
      // «Как X влияет на Y?» — ответ и «не смещает / не влияет».
      return PROCESS_RE.test(c.text) || c.method || (/влия/iu.test(info.query) && /(смеща|сдвига|влия|ускоря|замедля|увеличива|уменьша)/iu.test(c.text))
    case 'example':
      return (EXAMPLE_EVIDENCE_RE.test(c.text) || c.formulas >= 1) && isRealExample(c.text) && qualifierOk(info.query, c.text) && formulaClassOk(info.query, c.text)
    default:
      return c.keyAll
  }
}

/**
 * Ворота доказательств перед отказом/оговоркой: лучшая фраза из найденного (включая добавленные фрагменты), где есть термин
 * вопроса, понятия вопроса и признак нужного типа ответа. Нет такой фразы — только тогда «нет в базе».
 */
function evidenceGate(cands: readonly Candidate[], info: QuestionInfo, exclude: readonly Candidate[] = []): Candidate | undefined {
  const needSpecific = Math.min(2, info.specific.length)
  return cands.find(
    (c) =>
      !exclude.includes(c) &&
      c.score > 0.3 &&
      !c.imprecise &&
      !c.definesOther &&
      !c.offCondition &&
      !c.typeMismatch &&
      !(c.exampleBound && info.kind !== 'example') &&
      (info.keyStems.length === 0 ? c.specific > 0 : c.keyAll || (info.kind === 'example' && c.titleKey)) &&
      (c.specific >= needSpecific || c.overlap >= 0.5 || (info.kind === 'example' && c.titleKey)) &&
      !DEICTIC_START_RE.test(c.text) &&
      !DANGLING_RE.test(c.text) &&
      (info.lang !== 'ru' || hasFiniteVerbRu(c.text) || /\s[—–]\s|[=→]/u.test(c.text) || (info.kind === 'example' && /:\s*\S/u.test(c.text))) &&
      !isTelegraphicCard(c.text, c.hitType) &&
      !looksLikeTaskNoise(c.text) &&
      !(FILLER_RE.test(c.text) && !FILLER_RE.test(info.query)) &&
      compoundsIn(info, c) &&
      kindEvidence(c, info),
  )
}

/** «X – это разрушение металла под воздействием среды» → «X происходит под воздействием среды» (ответ на «почему»). */
function causeFromDefinition(text: string): string | null {
  const m = text.match(
    /^(\p{Lu}[\p{L} -]{2,40}?)\s+[—–-]\s*(?:это\s+)?(?:.{3,90}?),?\s*(?:(?:возника\p{L}+|происходя\p{L}+|образующ\p{L}+|обусловленн\p{L}+)\s+)?(в результате|из-за|вследствие|под воздействием|под действием|при непосредственном контакте с)\s+(.{6,120})$/u,
  )
  if (!m) return null
  return `${m[1]!.trim()} происходит ${m[2]} ${m[3]!.replace(/[.;]$/u, '')}.`
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
  if (/^[\p{Lu}]{2}/u.test(text) || /^[A-Z][a-z]?[\d₀-₉⁰-⁹⁺⁻]/.test(text)) return text
  return first.toLowerCase() + text.slice(1)
}

/** Подписи источников фраз ответа: без повторов, в порядке фраз. */
const citationsOf = (used: readonly { citation?: string }[]): string[] => [...new Set(used.map((u) => u.citation ?? '').filter(Boolean))]

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
    // r9: хвост «…, то есть ускоряется обратная реакция» верен только для того примера, где он написан:
    // без самого уравнения направление ученику не показываем — фраза без хвоста остаётся целой.
    const scoped = lang === 'ru' && !/[=→⇌]/u.test(s) ? s.replace(DIRECTION_TAIL_RE, '') : s
    const clean = ensureEnd(shortenForVoice(scoped, perSentenceMax))
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
        !DEICTIC_START_RE.test(c.text) && !RHETORIC_RE.test(c.text) && !VERB_INITIAL_RE.test(c.text) &&
        !DANGLING_RE.test(c.text) && info.keyStems.some((k) => c.stems.some((x) => x.length >= 4 && k.length >= 4 && x.startsWith(k.slice(0, 4)))),
    )
    if (prev) {
      used.push(prev)
      add(prev.text, true)
    }
  }
  // «Почему …?»: определение с причиной внутри («Коррозия – это разрушение металла под воздействием среды») читается как
  // причина: «Коррозия происходит под воздействием среды».
  const asCause = kind === 'why' && lang === 'ru' ? causeFromDefinition(direct.text) : null
  const directText = asCause ?? reframeDefinition(direct.text, kind === 'compare' ? null : keyTerm, lang) ?? direct.text
  const labelled = kind === 'example' ? directText.match(/^\p{Lu}[\p{L} ()-]{2,40}\s[—–]\s(.{8,120}?):\s*([^:]*[→=⇌][^:]*?)\.?$/u) : null
  if (labelled && equationFormulaCount(labelled[2]!) >= 2) add(`${t.exampleLead} ${labelled[2]!.trim()} — ${labelled[1]!.trim()}.`, true)
  else if (kind === 'example' && direct.example && !EXAMPLE_RE.test(direct.text.slice(0, 24))) add(`${t.exampleLead} ${lowerFirst(directText, lang)}`, true)
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
            ? chat ? (second && OUTCOME_ONLY_RE.test(second.text) ? 0 : 1) : second || /(потому что|так как|благодаря|обусловл|из-за|вследствие|позволя|because|chunki)/iu.test(direct.text) ? 0 : 1
            : kind === 'how' || kind === 'calc'
              ? chat ? 2 : 1
              : 1
  /** Уже сказано в прошлом ответе этого диалога (follow-up «пример», «почему», «подробнее»). */
  const said = (c: Candidate) => avoid.some((a) => saidAs(a, c))
  const ranked = cands
    .filter((c) => !used.includes(c) && c.score >= 0.8 && !c.imprecise && !c.definesOther && !c.offCondition)
    .filter((c) => !/^(Поэтому|Следовательно)\s/u.test(c.text) || (c.hitIndex === direct.hitIndex && c.pos === direct.pos + 1))
    // Риторическая подводка и безличный обрывок правила — не фразы ответа.
    .filter((c) => !RHETORIC_RE.test(c.text) && !VERB_INITIAL_RE.test(c.text))
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
    // r10: после «точной причины нет» — только фраза о спрошенном признаке («щелочную среду»), не соседний опыт
    if (missingWhy && kind === 'why' && whyPredicateStems(info).length > 0 && !whyPredicateStems(info).some((st) => tokenizeWords(c.text).some((w) => foldText(w).startsWith(st)))) continue
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
    const whyLead = kind === 'why' && !c.causal && explained === 0 && !direct.causal && !missingWhy
    // r10: «Почему так? Название радикала образуется …» — под «Почему так?» только фраза с признаком причины
    if (whyLead && lang === 'ru' && !causeEvidence(c.text, info) && !MECHANISM_RE.test(c.text)) continue
    const text = whyLead ? `${t.why} ${base}` : base
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
  // Перечень представителей («Средние соли: NaCl, KCl …») — это и есть пример: «примера нет» после него противоречиво.
  if (kind === 'example' && !direct.example && direct.formulas < 2 && !REACTION_RE.test(direct.text)) {
    // Ворота доказательств: пример по термину есть в найденном — называем его вместо «примера нет».
    const ex = evidenceGate(cands, info, used)
    if (ex && !said(ex) && !conditionedExample(ex, cands)) {
      used.push(ex)
      add(EXAMPLE_RE.test(ex.text.slice(0, 24)) ? ex.text : `${t.exampleLead} ${lowerFirst(ex.text, lang)}`, true)
    } else add(t.noExample, true)
  }
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
  // r10: «What is the formula of sulfuric acid?» — вопрос о формуле: «what is a formula of sulfuric» не спрашиваем
  if (info.kind === 'definition' && term && /^(an?\s+|the\s+)?(formula|symbol|name|colou?r|mass|charge|valency|формул\S*|цвет\S*)(\s+of)?\s/iu.test(term)) return t.checkGeneric
  if (info.kind === 'definition' && term) return pick(t.checks, seed)(term)
  if (info.composition) return t.checkComposition
  // «Перечисли факторы» — только если в ответе есть перечень (≥ 3 пункта через запятую), иначе — пересказ.
  if (info.factors) return answer && !/[^.]*,[^.]*,[^.]*/u.test(answer) ? t.checkHow : t.checkFactors
  if (info.kind === 'how' || info.kind === 'calc') return t.checkHow
  // «Какие бывают оксиды?», «виды связи» — перечень групп, а не отличие двух понятий.
  if (info.kind === 'compare' && (info.terms.length < 2 || /какие\s+(бывают|есть)|виды|типы|классифик|types|turlari/iu.test(originalQuery))) return t.checkClassify
  // «Назови главное отличие» — только если отличие прозвучало (слово противопоставления или обе стороны с «—»).
  if (info.kind === 'compare') return CONTRAST_WORDS_RE.test(answer) || (answer.match(/\s[—–]\s|называ/gu) ?? []).length >= 2 ? t.checkCompare : t.checkPlain
  // «Ещё один пример» — только после названного примера; после «примера нет» не предлагаем «приведу пример».
  if (info.kind === 'example') return answer.includes(t.noExample) ? t.checkPlain : t.checkExample
  if (answer.includes(t.noExample)) return t.checkPlain
  return t.checkGeneric
}

/**
 * РЕЖИМ ЦИТАТЫ (r9) — общий запасной выход. Ни один кандидат не прошёл проверки своего типа и гейт тождества
 * термина: пересказывать нельзя (пересказ и есть источник ошибок), поэтому приводим 1–2 фразы учебника
 * дословно, с рамкой «в учебнике сказано так» и подписью источника. Работает во всех локалях, в чате и голосом.
 */
function quoteAnswer(
  input: ComposeInput,
  info: QuestionInfo,
  cands: readonly Candidate[],
  hits: readonly KnowledgeHitLike[],
  style: ComposeStyle,
  seed: number,
): ComposedAnswer | null {
  const t = L[info.lang]
  // «… называется степенью диссоциации и обозначается …»: сразу после «называется» — сам термин.
  const namedAsKey = (text: string) => {
    const after = text.split(/называ(?:ется|ются|ют)\s+/u)[1]
    return Boolean(after) && info.keyStems.length > 0 && info.keyStems.every((k) => termIn(k, indexSentence(after!.split(/\s+/).slice(0, info.keyStems.length + 1).join(' '))))
  }
  const fit = (c: Candidate): boolean =>
    c.score > 0.6 &&
    !c.imprecise &&
    !c.definesOther &&
    !c.subjectOther &&
    !c.subClass &&
    !c.offCondition &&
    !c.typeMismatch &&
    (info.kind === 'example' || !c.exampleBound) &&
    // r10: пример в цитате — того класса, о котором спросили («кислая соль» — не NH₄Cl)
    (info.kind !== 'example' || formulaClassOk(info.query, c.text)) &&
    // Определение соседнего понятия цитатой тоже не отдаём — иначе ошибка просто меняет обложку.
    !(info.kind === 'definition' && c.definesKey && !c.headIdentity) &&
    (c.keyAll || c.titleKey) &&
    // На «что такое X» цитируем только фразу, где X — тема (в начале или после «называется»), а не строку «Защита: …».
    (info.kind !== 'definition' || c.keyInHead || namedAsKey(c.text)) &&
    // Строка-подпись «Защита: …» — не цитата; «Принцип Ле Шателье: если …» (подпись — сам термин) — определение.
    (info.kind === 'example' || !/^[^:]{2,32}:\s/u.test(c.text) || info.keyStems.every((k) => hasStem(k, indexSentence(c.text.split(':')[0]!)))) &&
    !isTelegraphicCard(c.text, c.hitType) &&
    !RHETORIC_RE.test(c.text) &&
    !VERB_INITIAL_RE.test(c.text) &&
    !DEICTIC_START_RE.test(c.text) &&
    !DANGLING_RE.test(c.text) &&
    !looksLikeTaskNoise(c.text) &&
    // r10: на «как получают X» цитата должна говорить о получении X (глагол получения или X среди продуктов), а не
    // быть шапкой карточки «Уксусная кислота (C₂H₄O₂) — кислоты, 10 класс.»
    !(info.kind === 'how' && info.lang === 'ru' && /получ|производ/iu.test(info.query) && !(/(получ|производ|синтез|образу)/iu.test(c.text) && !otherObtainedObject(c.text, info.keyStems)) && !conceptInProducts(info, c.text)) &&
    (!/[а-яё]/iu.test(c.text) || hasFiniteVerbRu(c.text) || /\s[—–]\s|[=→⇌]/u.test(c.text))
  // На «что такое X» сначала ищем фразу-определение самого термина, иначе — лучшую фразу про него.
  const best =
    (info.kind === 'definition'
      ? cands.find((c) => fit(c) && c.headIdentity) ?? cands.find((c) => fit(c) && c.definitional && (c.keyInHead || namedAsKey(c.text)))
      : undefined) ?? cands.find(fit)
  if (!best) return null
  const maxWords = (style.detail ?? 'brief') === 'more' ? 44 : style.channel === 'chat' ? 36 : 26
  const parts = [shortenForVoice(ensureEnd(best.text), maxWords)]
  // Вторая фраза — только продолжение той же мысли того же фрагмента (в чате и «подробнее»).
  if (style.channel === 'chat' || (style.detail ?? 'brief') === 'more') {
    const next = cands.find((c) => c !== best && c.hitIndex === best.hitIndex && c.pos === best.pos + 1 && fit(c) && !isDuplicate(c, [best]))
    if (next) parts.push(shortenForVoice(ensureEnd(next.text), maxWords))
  }
  const sentences = [t.quoteMode(bookLabel(hits[best.hitIndex]), parts.join(' '))]
  if (!style.noCheckQuestion) sentences.push(capitalizeFirst(checkQuestion(info, style, seed, false, input.query, sentences.join(' '))))
  return {
    text: sentences.join(' '),
    sentences,
    confident: true,
    usedTitles: [best.title],
    usedCitations: best.citation ? [best.citation] : [],
    keyTerm: info.keyTerm,
  }
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
      const shares = local ? phraseStems(local.local).some((st) => info.keyStems.some((k) => stemsMatch(st, k))) : false
      parts.push(local && !asked && shares ? t.related(local.local) : t.relatedGeneric)
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
  if (stems.length === 0) return false
  if (stems.every((s) => (s.length <= 3 ? idx.words.includes(s) : hasStem(s, idx)))) return true
  // «metall bog'» ⊂ «metall bog'lanish»: последнее слово фразы — префикс, остальные совпали подряд.
  if (stems.length < 2) return false
  const last = stems[stems.length - 1]!
  for (let i = 0; i + stems.length <= idx.words.length; i++) {
    if (stems.slice(0, -1).every((s, j) => stemsMatch(strictStem(idx.words[i + j]!), s)) && idx.words[i + stems.length - 1]!.startsWith(last)) return true
  }
  return false
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

/* ------------------------------------------------ en/uz native gloss (no MT) */

/** Родовое слово определения → en/uz (закрытый список школьных понятий). */
const CLASS_GLOSS: Array<[RegExp, string, string, boolean]> = [
  [/^реакци/u, 'reaction', 'reaksiya', true], [/^процесс/u, 'process', 'jarayon', true], [/^способ(?!н)|^метод/u, 'method', 'usul', true], [/^способност/u, 'ability', 'qobiliyat', false],
  [/^расщеплени/u, 'splitting', 'parchalanish', true], [/^разложени/u, 'decomposition', 'parchalanish', true], [/^разделени|^отделени/u, 'separation', 'ajratish', true],
  [/^соединени/u, 'compound', 'birikma', false], [/^вещест/u, 'substance', 'modda', false], [/^смес/u, 'mixture', 'aralashma', false],
  [/^частиц/u, 'particle', 'zarracha', false], [/^наук/u, 'science', 'fan', false], [/^газ(?!\p{L}{3})/u, 'gas', 'gaz', false], [/^металл/u, 'metal', 'metall', false],
  [/^раствор/u, 'solution', 'eritma', false], [/^связ/u, 'bond', 'bog‘lanish', false], [/^величин/u, 'quantity', 'kattalik', false], [/^элемент/u, 'element', 'element', false],
  [/^углеводород/u, 'hydrocarbon', 'uglevodorod', false], [/^сплав/u, 'alloy', 'qotishma', false], [/^ион/u, 'ion', 'ion', false], [/^атом/u, 'atom', 'atom', false],
]
/** Свойства из сравнения «В отличие от A, B — неядовитое несветящееся вещество красного цвета» (закрытый список). */
const PROPERTY_GLOSS: Array<[RegExp, string, string]> = [
  [/(?<!\p{L})неядовит/u, 'non-poisonous', 'zaharsiz'], [/(?<!\p{L})ядовит/u, 'poisonous', 'zaharli'], [/(?<!\p{L})несветящ/u, 'non-glowing', 'nur chiqarmaydigan'],
  [/(?<!\p{L})светящ|светится/u, 'glowing', 'nur chiqaradigan'], [/самовоспламен/u, 'self-igniting in air', 'havoda o‘z-o‘zidan yonadigan'], [/(?<!\p{L})бесцветн/u, 'colourless', 'rangsiz'],
  [/без запаха/u, 'odourless', 'hidsiz'], [/(?<!\p{L})нерастворим/u, 'insoluble in water', 'suvda erimaydigan'], [/(?<!\p{L})растворим/u, 'soluble', 'eriydigan'],
  [/красного цвета|(?<!\p{L})красн/u, 'red', 'qizil'], [/б[еe]лого цвета/u, 'white', 'oq'], [/ж[её]лт/u, 'yellow', 'sariq'], [/тв[её]рд/u, 'solid', 'qattiq'],
  [/(?<!\p{L})жидк/u, 'liquid', 'suyuq'], [/(?<!\p{L})мягк/u, 'soft', 'yumshoq'], [/(?<!\p{L})хрупк/u, 'brittle', 'mo‘rt'], [/(?<!\p{L})пластичн/u, 'ductile', 'plastik'],
  [/легче воздуха/u, 'lighter than air', 'havodan yengil'], [/тяжелее воздуха/u, 'heavier than air', 'havodan og‘ir'], [/электропроводн|проводит электрический ток/u, 'electrically conductive', 'elektr o‘tkazuvchan'],
]
const COLOR_ADJ: Array<[RegExp, string, string]> = [
  [/^бел/u, 'white', 'oq'], [/^красн/u, 'red', 'qizil'], [/^ж[её]лт/u, 'yellow', 'sariq'], [/^ч[её]рн/u, 'black', 'qora'], [/^сер(ый|ого|ая)/u, 'grey', 'kulrang'],
]
const ELEMENT_ORDER = [...ELEMENT_SYMBOLS]

const joinList = (items: readonly string[], lang: StemLang) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} ${lang === 'en' ? 'and' : 'va'} ${items[items.length - 1]}`
const enPlural = (w: string) => (/(s|x|sh|ch)$/i.test(w) ? `${w}es` : /[^aeiou]y$/i.test(w) ? `${w.slice(0, -1)}ies` : /(ium|sis|water|heat|matter)$/i.test(w) ? w : `${w}s`)

/** Местный термин глоссария для русского слова/фразы (последнее слово — префикс). */
function localTermFor(ruPhrase: string, glossary: readonly GlossPair[]): string | null {
  const idx = indexSentence(ruPhrase)
  const g = [...glossary].sort((a, b) => b.ru.length - a.ru.length).find((x) => phraseIn(x.ru, idx))
  return g ? g.local.toLowerCase() : null
}

/**
 * Короткий ответ на языке ученика из русского определения: «Оксиды — это сложные вещества …» → «Oxides are compounds.»
 *
 * r9: родовое слово берётся ТОЛЬКО из самого русского определения и только если оно — вершина сказуемого
 * (перед ним могут стоять лишь согласованные прилагательные: «сложные вещества»). «Валентность – это способность
 * атома …» родового слова из списка не имеет, «атома» вершиной не является — отдаём null, и ответ станет цитатой.
 * Машинные связки («is a method involving A and B», «molekula ishtirok etadigan reaksiya») не строим никогда:
 * отличительный признак дословно перевести нечем, поэтому его даёт цитата учебника следующей фразой.
 */
function glossDefinition(ruText: string, head: string, lang: StemLang): string | null {
  const m = ruText.match(/^(.{2,80}?)\s(?:[—–-]\s(?:это\s)?|это\s|явля\S+\s|представля\S+ собой\s)(.+)$/u)
  if (!m) return null
  const predicate = m[2]!.replace(/[.!]$/u, '')
  const words = tokenizeWords(predicate)
  const classAt = words.findIndex((w) => CLASS_GLOSS.some(([re]) => re.test(w)))
  if (classAt < 0 || classAt > 2) return null
  // Вершина сказуемого: до родового слова — только прилагательные («сложные вещества»), иначе это не род понятия.
  if (!words.slice(0, classAt).every((w) => ADJ_RU_RE.test(w))) return null
  const found = CLASS_GLOSS.find(([re]) => re.test(words[classAt]!))!
  // «сложные вещества» — «compounds».
  const cls: [RegExp, string, string, boolean] = /^вещест/u.test(words[classAt]!) && /^сложн/u.test(words[classAt - 1] ?? '') ? [found[0], 'compound', 'murakkab modda', false] : found
  const genus = lang === 'en' ? cls[1] : cls[2]
  // Родовое слово должно и правда стоять в цитируемой русской фразе — иначе ответ противоречил бы своей же цитате.
  if (!CLASS_GLOSS.find(([re]) => re === cls[0])) return null
  const Term = capitalizeFirst(head)
  if (lang === 'en') {
    const plural = enBe(head) === 'are'
    return `${Term} ${enBe(head)} ${plural ? enPlural(genus) : `${/^[aeiou]/i.test(genus) ? 'an' : 'a'} ${genus}`}.`
  }
  return `${Term} — ${genus}.`
}

/** Фраза на языке ученика согласуется с русским определением: ≥ половины её терминов глоссария (кроме термина вопроса) есть в нём. */
function nativeAgrees(nativeText: string, ruText: string, glossary: readonly GlossPair[], headStems: readonly string[]): boolean {
  const nIdx = indexSentence(nativeText)
  const rIdx = indexSentence(ruText)
  const terms = glossary.filter((g) => g.alts.some((a) => phraseIn(a, nIdx)) && !phraseStems(g.local).some((st) => headStems.some((k) => stemsMatch(k, st))))
  if (terms.length === 0) return true
  return terms.filter((g) => phraseIn(g.ru, rIdx)).length / terms.length >= 0.5
}

/** «В отличие от белого фосфора, красный фосфор … неядовитое несветящееся вещество красного цвета.» → en/uz. */
function glossContrast(ruText: string, glossary: readonly GlossPair[], lang: StemLang): string | null {
  const m = ruText.match(/^В отличие от\s+(\p{L}+)\s+(\p{L}+),\s+(\p{L}+)\s+(\p{L}+)\s+(.+)$/u)
  if (!m) return null
  const side = (adj: string, noun: string) => {
    const color = COLOR_ADJ.find(([re]) => re.test(foldText(adj)))
    const n = localTermFor(noun, glossary)
    return color && n ? `${lang === 'en' ? color[1] : color[2]} ${n}` : null
  }
  const a = side(m[1]!, m[2]!)
  const b = side(m[3]!, m[4]!)
  const rest = foldText(m[5]!)
  const props: string[] = []
  for (const [re, en, uz] of PROPERTY_GLOSS) {
    if (!re.test(rest)) continue
    const p = lang === 'en' ? en : uz
    // «неядовит» уже взят — «ядовит» внутри него не считаем.
    if (props.some((x) => x.includes(p) || p.includes(x))) continue
    props.push(p)
  }
  if (!a || !b || props.length === 0) return null
  return lang === 'en' ? `Unlike ${a}, ${b} is ${joinList(props, 'en')}.` : `${capitalizeFirst(a)}dan farqli ravishda, ${b} — ${joinList(props, 'uz')}.`
}

/** «Галогены (F₂, Cl₂, Br₂, I₂)» → «fluorine (F₂), chlorine (Cl₂) …» / «ftor (F₂), xlor (Cl₂) …». */
function glossMembers(ruTexts: readonly string[], classStem: string, glossary: readonly GlossPair[], lang: StemLang): string[] {
  if (classStem.length < 4) return []
  const names = lang === 'en' ? ELEMENT_NAMES_EN : ELEMENT_NAMES_UZ
  for (const text of ruTexts) {
    const stem = classStem.slice(0, Math.max(4, classStem.length - 1))
    const re = new RegExp(`(?:${stem}|${capitalizeFirst(stem)})\\p{L}*\\s*(?:\\(([^()]{2,80})\\)|[—–:]\\s*((?:[A-Z][a-z]?[₀-₉0-9]*,\\s*){1,6}[A-Z][a-z]?[₀-₉0-9]*))`, 'u')
    const m = text.match(re)
    const list = m ? (m[1] ?? m[2] ?? '') : ''
    const items: string[] = []
    for (const tok of list.split(/\s*,\s*|\s+и\s+/u).map((x) => x.trim()).filter((x) => /^[A-Z][A-Za-z₀-₉0-9()]*$/u.test(x) && realFormulaToken(x))) {
      const atoms = atomCounts(tok)!
      const el = atoms.size === 1 ? [...atoms.keys()][0]! : null
      const z = el ? ELEMENT_ORDER.indexOf(el) : -1
      const compound = el ? null : glossary.find((g) => g.formula && g.formula.replace(/[₀-₉]/gu, (d) => SUBSCRIPT_DIGITS[d]!) === tok.replace(/[₀-₉]/gu, (d) => SUBSCRIPT_DIGITS[d]!))
      const local = z >= 0 && names[z] ? names[z]!.toLowerCase() : compound ? compound.local.toLowerCase() : null
      items.push(local ? `${local} (${tok})` : tok)
    }
    if (items.length >= 2) return items.slice(0, 6)
  }
  return []
}

/** «Катализатор — …» второй раз: «It …» (без повторного определения термина). */
function pronounForm(c: Candidate, lang: StemLang): string | null {
  const m = c.text.match(/^(.{2,40}?)\s[—–]\s(.+)$/u)
  if (!m) return null
  return `${L[lang].pronoun} ${lowerFirst(m[2]!, lang)}`
}

/**
 * Уравнение реакции спрошенного класса из русской карточки/параграфа: «Parchalanish reaksiyasiga misol» →
 * «2H₂O₂ → 2H₂O + O₂↑». Формулы не переводятся, поэтому такой пример годится на любом языке.
 */
function equationForClass(
  hits: readonly KnowledgeHitLike[],
  info: QuestionInfo,
  glossary: readonly GlossPair[],
): { equation: string; hit: KnowledgeHitLike } | null {
  const qIdx = indexSentence(info.query)
  const ruStems = glossary
    .filter((g) => g.alts.some((a) => phraseIn(a, qIdx)))
    .flatMap((g) => tokenizeWords(g.ru).filter((w) => w.length >= 4).map(strictStem))
    .filter((s) => !isGenericStem(s))
  if (ruStems.length === 0) return null
  for (const hit of hits) {
    if (hit.type === 'glossary' || hit.type === 'i18n') continue
    const idx = indexSentence(`${hit.title} ${hit.text}`)
    if (!ruStems.some((s) => hasStem(s, idx))) continue
    for (const line of repairLayout(hit.text).split(/\n|(?<=[.!?])\s+/u)) {
      const eq = line.match(/(?:\d*[A-Z][A-Za-z0-9₀-₉()]*\s*\+\s*)*\d*[A-Z][A-Za-z0-9₀-₉()]*\s*(?:→|=|⇌)\s*[^.;:,а-яё]+/u)?.[0]?.trim()
      if (eq && equationFormulaCount(eq) >= 2 && isBalancedEquation(eq)) return { equation: eq.replace(/\s*[.;]$/, ''), hit }
    }
  }
  return null
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
  // r9: на «Ion nima?» фраза «Ion birikmalari …» определяет другое понятие — гейт тождества термина и здесь.
  let nativePick =
    nativeRaw && ((info.kind === 'definition' && !nativeRaw.direct.headIdentity) || (info.kind === 'example' && !nativeRaw.direct.example)) ? null : nativeRaw

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
  const usedCitations: string[] = []
  // Короткий ответ на языке ученика из русского учебника (глоссарий + закрытые списки): определение, отличие, члены группы.
  // Машинные фразы тестов (без подписи источника) — не источник определений, если есть определение учебника.
  const quizOnly = coreHits.length === 0
  let gloss: string | null = null
  let glossFrom: Candidate | undefined
  if (ruBody && ruInfo && info.keyTerm) {
    // r9: глоссарный пересказ строится только на ДЕЙСТВИТЕЛЬНОМ определении спрошенного термина (гейт тождества).
    if (info.kind === 'definition' && ruBody.direct.headIdentity && (ruBody.direct.hitType === 'textbook' || ruBody.direct.hitType === 'definition')) {
      gloss = glossDefinition(reframeDefinition(ruBody.direct.text, ruInfo.keyTerm, 'ru') ?? ruBody.direct.text, info.keyTerm, lang)
      glossFrom = ruBody.direct
    } else if (info.kind === 'compare') {
      glossFrom = [ruBody.direct, ...ruBody.used, ...ruCands].find((c) => /^В отличие от\s/u.test(c.text) && c.score > 0.6)
      gloss = glossFrom ? glossContrast(glossFrom.text, glossary, lang) : null
    }
  }
  let members: string[] = []
  let membersHit: KnowledgeHitLike | undefined
  if (info.kind === 'example' && ruInfo?.keyTerm) {
    const stem = strictStem(ruInfo.keyTerm.split(/\s+/)[0] ?? '')
    for (const h of ruHits) {
      members = glossMembers([h.text], stem, glossary, lang)
      if (members.length) {
        membersHit = h
        break
      }
    }
  }
  // Фраза теста расходится с определением учебника (термины глоссария из неё не встречаются в русском определении) — не источник.
  if (gloss && quizOnly && nativePick && glossFrom && (info.kind === 'definition' || info.kind === 'compare') && !nativeAgrees(nativePick.direct.text, glossFrom.text, glossary, info.keyStems)) nativePick = null
  if (members.length && (!nativePick || quizOnly)) {
    sentences.push(`${t.exampleLead} ${members.join(', ')}.`)
    if (membersHit) {
      usedTitles.push(membersHit.title)
      if (membersHit.citation) usedCitations.push(membersHit.citation)
    }
  } else if (gloss && !nativePick) {
    const glossQuote = quote || (glossFrom ? t.quote(bookLabel(ruHits[glossFrom.hitIndex]), shortenForVoice(ensureEnd(glossFrom.text), quoteWords)) : '')
    sentences.push(gloss)
    if (glossQuote) sentences.push(glossQuote)
    for (const c of [glossFrom, quote ? quoteCand : undefined]) {
      if (!c) continue
      usedTitles.push(c.title)
      if (c.citation) usedCitations.push(c.citation)
    }
  } else if (nativePick) {
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
    usedCitations.push(...[sourceQuote?.citation ?? quoteCand?.citation ?? '', ...body.used.map((c) => c.citation)].filter(Boolean))
    // Фразы тестов без своей подписи: источник — параграф русского учебника по той же теме.
    if (usedCitations.length === 0 && ruBody?.direct.citation) usedCitations.push(ruBody.direct.citation)
  } else if (ruBody && ruBody.direct) {
    // Перевода нет: честно говорим, что ответ есть только в русском учебнике, и цитируем его (без перечня терминов).
    // Русский путь нашёл ответ, но строгая цитата не подошла — цитируем сам прямой ответ (фразу учебника), а не отказываем.
    const direct = ruBody.direct
    // Выверенная цитата (source-quote) относится к переводу, которого в ответе нет («Кислоты – …» на «кислотный оксид»).
    const ruQuote = sourceQuote ? (quoteText && quoteCand ? t.quote(bookLabel(ruHits[quoteCand.hitIndex]), shortenForVoice(quoteText, quoteWords)) : '') : quote
    const directQuote =
      !ruQuote && !ruBody.missingWhy && !direct.offCondition && direct.keyAll && (direct.hitType === 'textbook' || direct.hitType === 'definition') && !isTelegraphicCard(direct.text, direct.hitType) &&
      // r9: на «почему» цитата без причины («молекулы твёрдых веществ не рассеиваются») отвечает на другой вопрос.
      (info.kind !== 'why' || (ruInfo !== null && causeEvidence(direct.text, ruInfo)))
        ? t.quote(bookLabel(ruHits[direct.hitIndex]), shortenForVoice(ensureEnd(direct.text), quoteWords))
        : ''
    const finalQuote = ruQuote || directQuote
    if (!finalQuote) {
      // Цитаты нет, но уравнение реакции нужного класса понятно без перевода — это и есть пример.
      const eq = info.kind === 'example' ? equationForClass(input.hits, info, glossary) : null
      // r9: цитата русского учебника с родной рамкой — общий запасной выход вместо отказа.
      if (!eq) return quoteAnswer(input, info, ruCands, ruHits, style, seed) ?? noAnswer(input, info, glossary)
      const ask = style.noCheckQuestion ? [] : [capitalizeFirst(checkQuestion(info, style, seed, false, input.query, ''))]
      const out = [t.equation(eq.equation), ...ask]
      return {
        text: out.join(' '),
        sentences: out,
        confident: true,
        usedTitles: [eq.hit.title],
        usedCitations: eq.hit.citation ? [eq.hit.citation] : [],
        keyTerm: info.keyTerm,
      }
    }
    // «Ответ есть только в русском учебнике» и «причина не написана» вместе — противоречие: говорим одно.
    if (!ruBody.missingWhy) sentences.push(t.onlyRussian)
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
    usedCitations.push(...[directQuote ? direct.citation : (quoteCand?.citation ?? ''), ...ruBody.used.map((c) => c.citation)].filter(Boolean))
  } else {
    // «Parchalanish reaksiyasiga misol»: уравнение реакции нужного класса понятно на любом языке — лучше отказа.
    const eq = info.kind === 'example' ? equationForClass(input.hits, info, glossary) : null
    // r9: цитата русского учебника с родной рамкой — общий запасной выход вместо отказа.
    if (!eq) return quoteAnswer(input, info, ruCands, ruHits, style, seed) ?? noAnswer(input, info, glossary)
    sentences.push(t.equation(eq.equation))
    usedTitles.push(eq.hit.title)
    if (eq.hit.citation) usedCitations.push(eq.hit.citation)
  }
  if (!style.noCheckQuestion) sentences.push(capitalizeFirst(checkQuestion(info, style, seed, Boolean(ruBody?.missingWhy && !nativePick), input.query, sentences.join(" "))))
  return { text: sentences.join(' '), sentences, confident: true, usedTitles: [...new Set(usedTitles)], usedCitations: [...new Set(usedCitations)], keyTerm: info.keyTerm }
}

/* ---------------------------------------------------------------- calc solver */

/** Школьные округлённые относительные атомные массы (как в задачах Kimyo 7–11). */
const AR: Record<string, number> = {
  H: 1, He: 4, Li: 7, B: 11, C: 12, N: 14, O: 16, F: 19, Ne: 20, Na: 23, Mg: 24, Al: 27, Si: 28, P: 31, S: 32, Cl: 35.5, Ar: 40, K: 39, Ca: 40,
  Cr: 52, Mn: 55, Fe: 56, Cu: 64, Zn: 65, Br: 80, Ag: 108, I: 127, Ba: 137, Au: 197, Hg: 201, Pb: 207,
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
  [/цинк|zinc|(?<!\p{L})rux/u, 'Zn'], [/желез|(?<!\p{L})temir/u, 'Fe'], [/(?<!\p{L})сер[аыуе]?(?!\p{L})|(?<!\p{L})серой(?!\p{L})/u, 'S'], [/серебр|silver|kumush/u, 'Ag'],
  [/(?<!\p{L})лити|lithium|(?<!\p{L})litiy/u, 'Li'], [/свин[ец]|свинц|(?<!\p{L})lead(?!\p{L})|qo['‘’]rg['‘’]oshin/u, 'Pb'], [/бари[йяюе]|barium|bariy/u, 'Ba'],
  [/марган|manganese|marganets/u, 'Mn'], [/(?<!\p{L})хром|chromium|(?<!\p{L})xrom/u, 'Cr'], [/(?<!\p{L})золот|(?<!\p{L})gold(?!\p{L})|(?<!\p{L})oltin/u, 'Au'],
  [/(?<!\p{L})ртут|mercury|simob/u, 'Hg'], [/(?<!\p{L})гели|helium|geliy/u, 'He'], [/(?<!\p{L})неон|(?<!\p{L})neon/u, 'Ne'], [/(?<!\p{L})аргон|(?<!\p{L})argon/u, 'Ar'],
]
/** Двухатомные простые вещества: M(H₂) = 2·Ar. */
const DIATOMIC = new Set(['H', 'N', 'O', 'F', 'Cl', 'Br', 'I'])
const fmtNum = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

/** Формула вещества из вопроса: явная запись («CO2», «H2SO4») или школьное название. */
function questionFormula(query: string, folded: string): string | null {
  const tokens = query.match(/(?<![\p{L}\d])(?:[A-Z][a-z]?\d*|\((?:[A-Z][a-z]?\d*)+\)\d*){1,6}(?![\p{L}\d])/gu) ?? []
  const explicit = tokens.find((f) => /\d|[A-Z].*[A-Z]/.test(f) && atomCounts(f))
  // Простое вещество символом («11,2 г Fe»): M = Ar (у двухатомных газов — 2·Ar).
  const symbol = tokens.find((f) => /^[A-Z][a-z]?$/u.test(f) && AR[f] !== undefined && (f.length === 2 || /[а-яё]/iu.test(query)))
  const byName = ELEMENT_NAMES.find(([re]) => re.test(folded))?.[1]
  const simple = (el: string | undefined) => (el ? (DIATOMIC.has(el) ? `${el}2` : el) : null)
  return explicit ?? SUBSTANCE_FORMULAS.find(([re]) => re.test(folded))?.[1] ?? simple(symbol) ?? simple(byName)
}

function molarOf(formula: string): { M: number; atoms: Map<string, number>; parts: string; nums: string } | null {
  const atoms = atomCounts(formula)
  if (!atoms || [...atoms.keys()].some((el) => AR[el] === undefined)) return null
  return {
    atoms,
    M: [...atoms].reduce((acc, [el, n]) => acc + n * AR[el]!, 0),
    parts: [...atoms].map(([el, n]) => (n > 1 ? `${n}·Ar(${el})` : `Ar(${el})`)).join(' + '),
    // Простое вещество из одного атома: «M(Fe) = Ar(Fe) = 56 г/моль».
    nums: atoms.size === 1 && [...atoms.values()][0] === 1 ? `Ar(${[...atoms.keys()][0]})` : [...atoms].map(([el, n]) => (n > 1 ? `${n}·${fmtNum(AR[el]!)}` : fmtNum(AR[el]!))).join(' + '),
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

/** 12,04·10²³ (en: 12.04·10²³). */
function sci(x: number, lang: StemLang): string {
  let exp = 23
  let mant = x / 1e23
  while (Math.abs(mant) >= 100 && exp < 40) { mant /= 10; exp++ }
  while (Math.abs(mant) < 1 && mant !== 0 && exp > 0) { mant *= 10; exp-- }
  const sup = String(exp).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]).join('')
  const m = fmtNum(Math.round(mant * 100) / 100)
  return `${lang === 'en' ? m.replace(',', '.') : m}·10${sup}`
}

/**
 * Таблица школьных формул (все языки): n = m/M, m = n·M, N = n·NA, n = N/NA, V = n·Vm, n = V/Vm,
 * ω(в-ва) = m(в-ва) / (m(в-ва) + m(воды)), m(в-ва) = ω·m(р-ра), разбавление m1·w1 = m2·w2.
 * Числа и единицы — только из вопроса, M — из таблицы Ar; ищем спрошенную величину.
 */
function solveByTable(info: QuestionInfo, cands: readonly Candidate[]): { sentences: string[]; used: Candidate[] } | null {
  const q = foldText(info.query)
  const lang = info.lang
  const en = lang === 'en'
  const num = (x: number) => (en ? fmtNum(x).replace(',', '.') : fmtNum(x))
  const U =
    lang === 'ru'
      ? { g: 'г', mol: 'моль', l: 'л', gmol: 'г/моль', lmol: 'л/моль', formula: 'Формула', sol: 'р-ра', solute: 'в-ва', water: 'воды', inv: 'моль⁻¹' }
      : { g: 'g', mol: 'mol', l: 'L', gmol: 'g/mol', lmol: 'L/mol', formula: 'Formula', sol: en ? 'solution' : 'eritma', solute: en ? 'solute' : 'modda', water: en ? 'water' : 'suv', inv: 'mol⁻¹' }
  type Q = { v: number; at: number; end: number }
  const find = (re: RegExp): Q[] => [...q.matchAll(re)].map((m) => ({ v: Number(m[1]!.replace(',', '.')), at: m.index!, end: m.index! + m[0].length }))
  const masses = find(/(\d+(?:[.,]\d+)?)\s*(?:г|грамм\S*|g|grams?|gramm)(?![\p{L}\d])/gu)
  const moles = find(/(\d+(?:[.,]\d+)?)\s*(?:моль|молей|mol|moles?|mo'l)(?![\p{L}\d])/gu)
  const litres = find(/(\d+(?:[.,]\d+)?)\s*(?:л|литр\S*|дм3|дм³|l|litres?|liters?|litr)(?![\p{L}\d])/gu)
  const percents = find(/(\d+(?:[.,]\d+)?)\s*%/gu)
  const waterAfter = (x: Q) => /^\s*(?:чистой\s+)?(?:воды|вод|water|suv)/u.test(q.slice(x.end, x.end + 16))
  const solutionNear = (x: Q) => /раствор|solution|eritma/u.test(q.slice(x.end, x.end + 24))
  const cite = (re: RegExp) => cands.filter((c) => re.test(c.text) && !/\d\s*%/u.test(c.text) && !JUNK_RE.test(c.text)).slice(0, 1)
  const askW = /массов\S*\s+дол|mass\s+fraction|percentage|massa\s+ulush|процентн\S*\s+концентрац/u.test(q)
  const askN = /(сколько|число|количество)\s+(молекул|атомов|частиц|ионов)|how\s+many\s+(molecules|atoms|particles)|(molekula|atom)\S*\s+(soni|bor)|nechta\s+(molekula|atom)/u.test(q)
  const askV = /объ[её]м|volume|hajm/u.test(q)
  const askMol = /количеств\S*\s+веществ|сколько\s+моль|число\s+моль|how\s+many\s+moles|amount\s+of\s+substance|necha\s+mol|modda\s+miqdor/u.test(q)
  const askM = /(?<!\p{L})масс[аеуы]?(?!\S*\s+дол)(?!\p{L})|сколько\s+грамм|(?<!\p{L})mass(?!\s+fraction)|massasi|how\s+many\s+grams/u.test(q)

  // Растворы: ω = m(в-ва)/m(р-ра); m(р-ра) = m(в-ва) + m(воды); разбавление; m(в-ва) = ω·m(р-ра).
  if (/раствор|solution|eritma|растворили|dissolv|eritildi/u.test(q)) {
    if (askW && percents.length === 1 && masses.length >= 2) {
      const water = masses.find(waterAfter)
      const first = masses.find((m) => m !== water)
      if (water && first) {
        const w1 = percents[0]!.v / 100
        const solute = first.v * w1
        const w2 = (solute / (first.v + water.v)) * 100
        return {
          sentences: [
            `m(${U.solute}) = ${num(w1)} · ${num(first.v)} ${U.g} = ${num(solute)} ${U.g}; m(${U.sol}) = ${num(first.v)} ${U.g} + ${num(water.v)} ${U.g} = ${num(first.v + water.v)} ${U.g}.`,
            `ω = ${num(solute)} ${U.g} / ${num(first.v + water.v)} ${U.g} · 100% = ${num(Math.round(w2 * 100) / 100)}%.`,
          ],
          used: cite(/массов\S*\s+дол|разбавлен|m₁·w₁|m1\s*·\s*w1/u),
        }
      }
    }
    if (askW && percents.length === 0 && masses.length >= 2) {
      const water = masses.find(waterAfter)
      const sol = masses.find((m) => m !== water && solutionNear(m))
      const solute = masses.find((m) => m !== water && m !== sol)
      if (solute && (water || sol)) {
        const total = sol ? sol.v : solute.v + water!.v
        const totalLine = sol ? '' : `m(${U.sol}) = ${num(solute.v)} ${U.g} + ${num(water!.v)} ${U.g} = ${num(total)} ${U.g}.`
        const w = (solute.v / total) * 100
        return {
          sentences: [
            `${U.formula}: ω = m(${U.solute}) / m(${U.sol}) · 100%.`,
            ...(totalLine ? [totalLine] : []),
            `ω = ${num(solute.v)} ${U.g} / ${num(total)} ${U.g} · 100% = ${num(Math.round(w * 100) / 100)}%.`,
          ],
          used: cite(/массов\S*\s+дол|ω\s*=|w\s*=/u),
        }
      }
    }
    if (!askW && percents.length === 1 && masses.length === 1 && askM) {
      const w = percents[0]!.v / 100
      const m = masses[0]!.v * w
      return {
        sentences: [
          `${U.formula}: m(${U.solute}) = ω · m(${U.sol}).`,
          `m(${U.solute}) = ${num(w)} · ${num(masses[0]!.v)} ${U.g} = ${num(m)} ${U.g}; m(${U.water}) = ${num(masses[0]!.v)} ${U.g} − ${num(m)} ${U.g} = ${num(masses[0]!.v - m)} ${U.g}.`,
        ],
        used: cite(/массов\S*\s+дол|процентн\S*\s+концентрац/u),
      }
    }
  }
  // Количество вещества и связанные с ним величины.
  const formula = questionFormula(info.query, q)
  const mol = formula ? molarOf(formula) : null
  const lines: string[] = []
  let n: number | null = null
  if (moles.length) n = moles[0]!.v
  else if (litres.length && !askV) {
    n = litres[0]!.v / 22.4
    lines.push(`n = V / Vm = ${num(litres[0]!.v)} ${U.l} : 22${en ? '.' : ','}4 ${U.lmol} = ${num(n)} ${U.mol}.`)
  } else if (masses.length && mol && !askM) {
    n = masses[0]!.v / mol.M
    lines.push(`M(${formula}) = ${mol.nums} = ${num(mol.M)} ${U.gmol}.`, `n = m / M = ${num(masses[0]!.v)} ${U.g} : ${num(mol.M)} ${U.gmol} = ${num(n)} ${U.mol}.`)
  }
  if (n === null) return null
  if (askN) {
    lines.push(`${U.formula}: N = n · NA, NA = ${en ? '6.02' : '6,02'}·10²³ ${U.inv}.`, `N = ${num(n)} ${U.mol} · ${en ? '6.02' : '6,02'}·10²³ ${U.inv} = ${sci(n * 6.02e23, lang)}.`)
    return { sentences: lines, used: cite(/авогадро|avogadro|N\s*=\s*NA|NA\s*[·•∙]\s*n|6[,.]02/iu) }
  }
  if (askV) {
    lines.push(`${U.formula}: V = n · Vm, Vm = 22${en ? '.' : ','}4 ${U.lmol}.`, `V = ${num(n)} ${U.mol} · 22${en ? '.' : ','}4 ${U.lmol} = ${num(n * 22.4)} ${U.l}.`)
    return { sentences: lines, used: cite(/22[,.]4|молярн\S*\s+объ/u) }
  }
  if (askM && mol && (moles.length || litres.length)) {
    lines.push(`${U.formula}: m = n · M.`, `M(${formula}) = ${mol.nums} = ${num(mol.M)} ${U.gmol}.`, `m = ${num(n)} ${U.mol} · ${num(mol.M)} ${U.gmol} = ${num(n * mol.M)} ${U.g}.`)
    return { sentences: lines, used: cite(/m\s*=\s*n|молярн\S*\s+масс|количеств\S*\s+веществ/u) }
  }
  if (askMol && lines.length) return { sentences: [`${U.formula}: ${litres.length ? 'n = V / Vm' : 'n = m / M'}.`, ...lines], used: cite(/количеств\S*\s+веществ|молярн/u) }
  return null
}

/**
 * Расчётные вопросы: подставляем числа вопроса в школьную формулу и показываем ход решения.
 * Правило из найденного текста (если есть) — первой фразой; числа — только из вопроса и таблицы Ar.
 */
function solveCalc(info: QuestionInfo, all: readonly Candidate[]): { sentences: string[]; used: Candidate[] } | null {
  // Правило расчёта — фраза с подлежащим: «Считается как сумма атомных масс …» — обрывок строки карточки, не зачин ответа.
  const cands = all.filter((c) => !VERB_INITIAL_RE.test(c.text) && !RHETORIC_RE.test(c.text))
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
    const line = `${molar ? 'M' : 'Mr'}(${formula}) = ${[...new Set([mol.parts, mol.nums])].join(' = ')} = ${fmtNum(mol.M)}${molar ? ` ${u.gmol}` : ''}.`
    return { sentences: [...ruleOf(rule), line], used: cite(rule, /молярн\S*\s+масс|молекулярн\S*\s+масс/u) }
  }
  if (lang !== 'ru') return solveByTable(info, cands)
  // 2) Масса растворённого вещества: m(в-ва) = w · m(р-ра).
  const mass = q.match(/(\d+(?:[,.]\d+)?)\s*(?:г|грамм\S*)(?![\p{L}])/u)
  const percent = q.match(/(\d+(?:[,.]\d+)?)\s*%/u)
  if (mass && percent && /сколько\s+грамм|какую\s+массу|масс\S*\s+(соли|вещества|сахара)/u.test(q)) {
    const rule = cands.find((c) => /(w|ω)\s*[·•*×]?\s*m\s*\(|массов\S*\s+дол|процентн\S*\s+концентрац/iu.test(c.text) && /раствор|р-ра/iu.test(c.text))
    if (!rule) return solveByTable(info, cands)
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
    if (!rule) return solveByTable(info, cands)
    return {
      sentences: [ensureEnd(rule.text), `V = n · Vm = ${fmtNum(moles)} моль · 22,4 л/моль = ${fmtNum(moles * 22.4)} л.`],
      used: [rule],
    }
  }
  if (litres !== null && /(количеств\S*\s+веществ|сколько\s+моль|число\s+моль)/u.test(q)) {
    const rule = vmRule()
    if (!rule) return solveByTable(info, cands)
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
    if (!rule || !formula || !atoms || [...atoms.keys()].some((el) => AR[el] === undefined)) return solveByTable(info, cands)
    const M = [...atoms].reduce((acc, [el, n]) => acc + n * AR[el]!, 0)
    return {
      sentences: [ensureEnd(rule.text), `M(${formula}) = ${fmtNum(M)} г/моль; m = n · M = ${fmtNum(moles)} моль · ${fmtNum(M)} г/моль = ${fmtNum(moles * M)} г.`],
      used: [rule],
    }
  }
  return solveByTable(info, cands)
}

/** У расчёта всегда есть источник: правило/формула из найденного, иначе фрагмент про моль/молярную массу/массовую долю. */
function withCalcSource(solved: { sentences: string[]; used: Candidate[] } | null, cands: readonly Candidate[]): { sentences: string[]; used: Candidate[] } | null {
  if (!solved || solved.used.some((u) => u.citation)) return solved
  const text = solved.sentences.join(' ')
  const re = /Vm|V\s*=/u.test(text) ? /22[,.]4|молярн\S*\s+объ/iu : /ω/u.test(text) ? /массов\S*\s+дол/iu : /NA/u.test(text) ? /авогадро|6[,.]02/iu : /молярн\S*\s+масс|количеств\S*\s+веществ|моль/iu
  const source = cands.find((c) => c.citation && re.test(c.text) && !/\d\s*%/u.test(c.text)) ?? cands.find((c) => c.citation && /моль|молярн/iu.test(c.text))
  return source ? { ...solved, used: [...solved.used, source] } : solved
}

/* ------------------------------------------------------------------ r10: свойства вещества */

const PHYSICAL_PROPERTY_RE =
  /(цвет|окраш|запах|вкус|бесцветн|газ(?!\p{L}*образн)|газообразн|жидкост|тв[её]рд|кристаллическ\p{Ll}*\s+веществ|порошк|плотност|легче|тяжелее|раствор(им|яется|яются)|нераствор|температур\S*\s+(плавлен|кипен)|плав(ится|ятся|ления)|кип(ит|ения|ят)|электропровод|теплопровод|проводит|пластичн|ковк|блеск|мягк|прочн|тугоплав|летуч|(?<!\p{L})(серебрист|ж[её]лт|зел[её]н|желтовато|красн|бур|бел|ч[её]рн|голуб|фиолетов|синий|оранжев)\p{Ll}*)/iu
const CHEMICAL_PROPERTY_RE = /(реагир|взаимодейств|(?<!\p{L})гор(ит|ят|ени)|сгора|окисля|восстанавлива|замещени|присоединени|разлага|разложени|вступа\S*\s+в\s+реакци)/iu

/**
 * «Какими физическими свойствами обладает кислород?», «Какого цвета хлор?», «Какие химические свойства у метана?»:
 * фразы, в которых вещество вопроса — подлежащее (в начале фразы или своей части «хлор — тяжелый газ …») и есть признак
 * свойства нужного вида; для химических свойств — ещё реакции этого вещества из указателя учебника.
 */
function propertyAnswer(input: ComposeInput, prop: PropertyQuestion, style: ComposeStyle): ComposedAnswer | null {
  const lang = input.lang
  const hits = input.hits.filter((h) => h.type !== 'index')
  const info = analyzeQuestion(input.query, lang, style, input.topicHint)
  const cands = buildCandidates(hits, { ...info, kind: 'general' }, style)
  const subjectAt = (text: string): number => {
    const words = foldText(text).match(/[а-я]{2,}/g) ?? []
    const at = prop.words.map((w) => words.findIndex((x) => sameWord(x, w)))
    return at.every((i) => i >= 0) ? Math.min(...at) : -1
  }
  const wantRe = prop.type === 'chemical' ? CHEMICAL_PROPERTY_RE : prop.type === 'physical' ? PHYSICAL_PROPERTY_RE : null
  type Scored = { text: string; score: number; c: Candidate }
  const scored: Scored[] = []
  for (const c of cands) {
    if (c.exampleBound || c.typeMismatch) continue
    // «Фтор — газ …, хлор — тяжелый газ желтовато-зеленого цвета, бром — …»: берём часть с веществом вопроса;
    // «… равна 2 При нормальных условиях кислород …» — потерянная точка после числа тоже граница фразы
    const parts = c.text.split(/[,;]\s+(?=\p{Ll}[\p{Ll}\s()]{1,40}\s[—–-]\s)|(?<=[\d₀-₉])\s+(?=\p{Lu}\p{Ll}{1,}\s)/u)
    for (const part of parts) {
      const at = subjectAt(part)
      if (at < 0 || at > 4) continue
      if (DEICTIC_START_RE.test(part)) continue
      // слова самого вопроса («атомной кристаллической решёткой») — не признак свойства
      const rest = (foldText(part).match(/[а-яa-z]+|[^а-яa-z]+/g) ?? []).filter((w) => !prop.words.some((q) => sameWord(q, w))).join('')
      const physical = PHYSICAL_PROPERTY_RE.test(rest)
      const chemical = CHEMICAL_PROPERTY_RE.test(rest) || /[→=]/u.test(part)
      if (prop.type === 'physical' && (chemical || !physical)) continue
      if (prop.type === 'chemical' && !chemical) continue
      const re = wantRe ?? (physical ? PHYSICAL_PROPERTY_RE : CHEMICAL_PROPERTY_RE)
      const matches = rest.match(new RegExp(re.source, 'giu'))?.length ?? 0
      if (!matches) continue
      // «Озон обладает … по сравнению с кислородом»: вещество вопроса — не подлежащее
      if (/по\s+сравнению\s+с|в\s+отличие\s+от|кроме/iu.test(part) && at > 0) continue
      let text = part.trim().replace(/[,;:]$/u, '')
      text = ensureEnd(capitalizeFirst(text))
      const score = 3 - at * 0.4 + Math.min(3, matches) * 0.8 + (c.hitType === 'textbook' || c.hitType === 'definition' ? 0.4 : 0) + (c.titleKey ? 0.3 : 0) - (c.extra ? 0.3 : 0)
      scored.push({ text, score, c })
    }
  }
  scored.sort((a, b) => b.score - a.score)
  const picked: Scored[] = []
  const max = style.channel === 'voice' ? 1 : 2
  for (const s of scored) {
    if (picked.length >= max) break
    if (picked.some((p) => jaccard(contentStems(p.text), contentStems(s.text)) >= 0.5)) continue
    picked.push(s)
  }
  const sentences = picked.map((p) => p.text)
  const citations = citationsOf(picked.map((p) => p.c))
  const titles = picked.map((p) => p.c.title)
  if (prop.type !== 'physical') {
    const reactions = reactionsWithReagent(prop.subject, input.hits, style.channel === 'voice' ? 2 : 3)
    if (reactions.length && sentences.length < max) {
      // «Тип: реакция замещения» указателя → «(замещение)» не выдумываем: пишем как в указателе, без слова «реакция»
      const list = reactions.map((r) => `${r.equation}${r.type ? ` (${r.type})` : ''}`)
      sentences.push(`Реакции вещества «${reactions[0]!.name}» в учебнике «Химия ${reactions[0]!.grade}»: ${list.join('; ')}.`)
      citations.push(...reactions.map((r) => r.citation ?? '').filter((x) => x && !citations.includes(x)))
      titles.push(...reactions.map((r) => r.title))
    }
  }
  if (!sentences.length) return null
  if (!style.noCheckQuestion) sentences.push('Сможешь перечислить эти свойства?')
  return { text: sentences.join(' '), sentences, confident: true, usedTitles: [...new Set(titles)], usedCitations: citations.slice(0, 3), keyTerm: info.keyTerm }
}

/**
 * r10: следствие явной причинно-следственной фразы: «Так как A, B» → B; «A, в результате чего / поэтому B» → B;
 * «A, так как / потому что B» → A. null — структура не распознана (такие фразы не трогаем).
 */
function effectClause(text: string): string | null {
  const t = text.trim().replace(/[.!]$/u, '')
  const after = /,\s*(?:в результате чего|вследствие чего|из-за чего|благодаря чему|поэтому)\s+(.+)$/iu.exec(t)
  if (after) return after[1]!
  const before = /^(.+?),\s*(?:так как|потому что|поскольку)\s/iu.exec(t)
  if (before) return before[1]!
  if (/^(Так как|Поскольку)\s/u.test(t)) {
    const segments = t.split(/,\s+/u)
    let seenVerb = false
    let effect: string | null = null
    for (const seg of segments) {
      if (!hasFiniteVerbRu(seg)) continue
      if (seenVerb) effect = seg
      seenVerb = true
    }
    return effect
  }
  return null
}

/** Признаки вопроса «почему»: прилагательные и глаголы без слов самого термина («фтор — самый активный» → «активн»). */
function whyPredicateStems(info: QuestionInfo): string[] {
  const key = new Set(info.keyStems)
  return questionWords(info.query)
    .filter(
      (w) =>
        w.length >= 4 &&
        (ADJ_RU_RE.test(foldText(w)) || VERB_RU_RE.test(foldText(w))) &&
        // связки и общие глаголы («имеет», «является», «называют») признаком вопроса не считаются
        !/^(сам|очень|такой|так|более|менее|име|явля|называ|быва|происход|станов|содерж|существу|счита)/u.test(foldText(w)),
    )
    .map((w) => strictStem(w).slice(0, Math.max(4, strictStem(w).length - 1)))
    .filter((st) => st.length >= 4 && ![...key].some((k) => k.startsWith(st) || st.startsWith(k)))
}

function effectOffQuestion(text: string, info: QuestionInfo): boolean {
  const effect = effectClause(text)
  if (!effect) return false
  const stems = whyPredicateStems(info)
  if (!stems.length) return false
  const words = tokenizeWords(effect).map((w) => foldText(w))
  return !stems.some((st) => words.some((w) => w.startsWith(st)))
}

/** r10: расчёт важнее «указателя учебника» («вычисли молярную массу … формула H2SO4»). */
const BOOK_SKIP_RE = /(вычисл|рассчита|посчита|сколько|молярн|массов\S*\s+дол|найди\S*\s+(масс|объ|количеств)|\d\s*(г|грамм\S*|моль|л|мл)(?![\p{L}]))/iu

export function composeLocalAnswer(input: ComposeInput): ComposedAnswer {
  const style = input.style ?? {}
  // r10: формула/название вещества, продукты реакции, реакции §, место в учебнике — по указателю учебника
  // (фрагменты type 'index' из проверенной инвентаризации: формулы и уравнения как в книге, с § и страницей).
  if (!style.helper && !style.continuation && !BOOK_SKIP_RE.test(input.query)) {
    const book = answerFromBookIndex(input.query, input.hits, input.lang, { channel: style.channel, noCheckQuestion: style.noCheckQuestion, topicHint: input.topicHint })
    if (book) {
      return {
        text: book.sentences.join(' '),
        sentences: book.sentences,
        confident: true,
        usedTitles: [...new Set(book.usedTitles)],
        usedCitations: book.usedCitations,
        keyTerm: extractKeyTerm(input.query, input.lang),
      }
    }
  }
  // «Какими свойствами обладает X?» — фразы о свойствах самого X (+ его реакции из указателя учебника).
  const prop = !style.helper && !style.continuation ? detectPropertyQuestion(input.query, input.lang) : null
  if (prop) {
    const answer = propertyAnswer(input, prop, style)
    if (answer) return answer
  }
  // Указатель — только для этого пути: его строки («Серная кислота — формула H₂SO₄.») не фразы для пересказа.
  const hits = input.hits.filter((h) => h.type !== 'index')
  const core = composeLocalAnswerCore(hits.length === input.hits.length ? input : { ...input, hits })
  // «Приведи пример реакции присоединения»: ответ без уравнения (рассуждение о катализаторах) — пример из указателя учебника.
  if (hits.length < input.hits.length && !style.helper && input.lang === 'ru' && !core.sentences.some((s) => /[A-Z][a-z]?[₀-₉\d]*[^.]*\s(→|=|⇌)\s/u.test(s))) {
    const example = exampleFromBookIndex(input.query, input.hits, input.lang, !!style.wantExample)
    if (example) {
      const sentences = style.noCheckQuestion ? example.sentences.slice(0, -1) : example.sentences
      return { text: sentences.join(' '), sentences, confident: true, usedTitles: example.usedTitles, usedCitations: example.usedCitations, keyTerm: core.keyTerm }
    }
  }
  // «Что такое гидрид кальция?» без определения в базе: формула и место в учебнике вместо честного «нет ответа».
  if (!core.confident && hits.length < input.hits.length && !style.helper && !style.continuation) {
    const book =
      answerFromBookIndex(input.query, input.hits, input.lang, { channel: style.channel, noCheckQuestion: style.noCheckQuestion, fallbackWhatIs: true }) ??
      obtainFromBookIndex(input.query, input.hits, input.lang, style.channel === 'voice' ? 'voice' : 'chat')
    if (book) {
      if (style.noCheckQuestion && /\?$/.test(book.sentences[book.sentences.length - 1] ?? '')) book.sentences = book.sentences.slice(0, -1)
      return { text: book.sentences.join(' '), sentences: book.sentences, confident: true, usedTitles: [...new Set(book.usedTitles)], usedCitations: book.usedCitations, keyTerm: core.keyTerm }
    }
  }
  return core
}

function composeLocalAnswerCore(input: ComposeInput): ComposedAnswer {
  const lang = input.lang
  const style = input.style ?? {}
  const seed = input.seed ?? 0
  const detail = style.detail ?? 'brief'
  const maxWords = style.maxWords ?? (detail === 'more' ? 140 : style.simpler ? 50 : 60)
  const info = analyzeQuestion(input.query, lang, style, input.topicHint)

  // Расчёт по формулировке вопроса — на любом языке (числа из вопроса, Ar из таблицы, правило учебника — если найдено).
  if ((info.kind === 'calc' || CALC_INTENT_RE.test(foldText(input.query))) && !style.helper && !style.continuation) {
    // Кандидаты русского учебника (и для en/uz) — только как подпись источника формулы, текст правила берётся лишь в ru.
    const calcCands = buildCandidates(input.hits.filter((h) => h.type !== 'i18n'), { ...info, kind: 'how', lang: 'ru' }, style)
    const solved = withCalcSource(solveCalc(info, calcCands), calcCands)
    if (solved) {
      const sentences = [...solved.sentences]
      if (!style.noCheckQuestion) sentences.push(L[lang].checkHow)
      return { text: sentences.join(' '), sentences, confident: true, usedTitles: [...new Set(solved.used.map((u) => u.title))], usedCitations: citationsOf(solved.used), keyTerm: info.keyTerm }
    }
  }

  if (lang !== 'ru') return composeForeign(input, info, style, maxWords)

  const cands = buildCandidates(input.hits, info, style)
  input.debug?.(cands)
  if (info.kind === 'calc' && !style.helper) {
    const calcAll = buildCandidates(input.hits, { ...info, kind: 'how' }, style).concat(cands)
    const solved = withCalcSource(solveCalc(info, calcAll), calcAll)
    if (solved) {
      const sentences = [...solved.sentences]
      if (!style.noCheckQuestion) sentences.push(L.ru.checkHow)
      return { text: sentences.join(' '), sentences, confident: true, usedTitles: [...new Set(solved.used.map((u) => u.title))], usedCitations: citationsOf(solved.used), keyTerm: info.keyTerm }
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
  if (!picked || picked.direct.score <= 1.0) {
    // Ворота доказательств: термин вопроса + признак типа ответа в любом найденном фрагменте — отвечаем из него.
    const gated = info.concepts.length > 0 && !style.helper ? evidenceGate(avoid.length ? fresh : cands, info) : undefined
    // r9: пересказ невозможен — цитируем учебник дословно, и только если и цитировать нечего, честно отказываем.
    if (!gated) {
      const quoted = info.concepts.length > 0 && !style.helper ? quoteAnswer(input, info, avoid.length ? fresh : cands, input.hits, style, seed) : null
      return quoted ?? noAnswer(input, info, [])
    }
    picked = { direct: gated, missingWhy: false }
  }

  // «Какие бывают X?»: «… делятся на четыре типа.» без названий — собираем пункты «1. Ионная … 2. Атомная …» того же §.
  if (info.kind === 'compare' && info.terms.length < 2 && CLASSIFY_QUERY_RE.test(input.query)) {
    const listed = classifyWithHeads(picked.direct, input.hits, info)
    if (listed) picked = { ...picked, direct: listed }
  }
  const body = composeBody(cands, picked, info, style, maxWords, avoid)
  const sentences = body.sentences
  // После «точной причины нет — проверим по учебнику?» второй вопрос на проверку не задаём.
  if (!style.noCheckQuestion && !body.missingWhy) sentences.push(checkQuestion(info, style, seed, body.missingWhy, input.query, sentences.join(" ")))
  return {
    text: sentences.join(' '),
    sentences,
    confident: true,
    usedTitles: [...new Set(body.used.map((u) => u.title))],
    usedCitations: citationsOf([body.direct, ...body.used]),
    keyTerm: info.keyTerm,
  }
}
