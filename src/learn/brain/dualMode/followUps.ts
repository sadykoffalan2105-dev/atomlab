/**
 * Короткие «follow-up» реплики живого диалога: «а почему?», «приведи пример»,
 * «проще», «подробнее», «повтори». Без собственной темы они относятся к
 * предыдущему вопросу ученика — так разговор звучит по-человечески.
 *
 * Чистый модуль (без DOM) — покрыт тестами (scripts/test-teacher-live-engine.mts).
 */
import { extractKeyTerm, type ComposeStyle } from './localAnswerComposer'
import { contentStems, foldText, type StemLang } from './textStems'
import { explainerHint } from '../../knowledge/learnExplainerAnswer'
import { looksLikeGibberish } from './gibberish'

export type FollowUpKind = 'why' | 'example' | 'simpler' | 'more' | 'repeat' | 'topic'

export interface FollowUpInfo {
  kinds: FollowUpKind[]
  /** В реплике нет своей темы — нужно взять тему предыдущего вопроса. */
  needsPrevious: boolean
}

const PATTERNS: Record<FollowUpKind, RegExp> = {
  why: /(^|[^\p{L}])(почему|зачем|отчего|с чего бы|why|how come|nega|nima uchun|nimaga)([^\p{L}]|$)/iu,
  example: /(пример|например|for example|an example|example|misol)/iu,
  simpler: /(проще|попроще|простыми словами|не понял|не понятно|непонятно|не поняла|simpler|simply|don'?t understand|do not understand|soddaroq|oddiyroq|tushunmadim)/iu,
  more: /(подробн|расскажи (?:ещ[её] |больше)|больше деталей|поглубже|more detail|in detail|tell me more|go deeper|batafsil|ko['‘ʻ]?proq)/iu,
  repeat: /(повтор|ещ[её] раз|скажи снова|не расслышал|repeat|say (?:it )?again|once more|takrorla|qayta ayt)/iu,
  /** «Что запомнить?», «Связь с уроком» — про текущую тему. */
  topic: /(запомнить|главное|связь с урок|по теме урока|key takeaway|link to (?:the )?lesson|eslab qol|asosiy fikr|dars bilan)/iu,
}

/** Слова, которые сами по себе не задают тему (кроме вопросительных стоп-слов). */
const FOLLOW_UP_FILLER = new Set([
  'почему', 'зачем', 'отчего', 'пример', 'примеры', 'приведи', 'приведите', 'например', 'проще', 'попроще',
  'подробнее', 'подробно', 'повтори', 'повторите', 'понял', 'поняла', 'понятно', 'непонятно', 'объясни',
  'объясните', 'расскажи', 'расскажите', 'больше', 'поглубже', 'снова', 'можно', 'пожалуйста', 'давай',
  'ещё', 'еще', 'раз', 'скажи', 'деталей', 'словами', 'простыми', 'сначала', 'this', 'that', 'again',
  'simpler', 'more', 'detail', 'details', 'example', 'examples', 'repeat', 'explain', 'please', 'deeper',
  'understand', 'once', 'nega', 'misol', 'keltiring', 'batafsil', 'takrorla', 'soddaroq', 'tushunmadim',
  // «Пример из жизни», «Что запомнить?», «Связь с уроком» — про текущую тему, а не новая тема.
  'жизни', 'жизнь', 'жизненный', 'запомнить', 'главное', 'урок', 'урока', 'уроком', 'связь', 'тема', 'тему', 'теме',
  'темы', 'параграф', 'параграфа', 'life', 'real', 'lesson', 'topic', 'takeaway', 'key', 'hayotdan', 'hayotiy', 'mavzu',
])

/**
 * Вводные слова в начале живой реплики («подождите, а почему…», «слушай, что такое…»,
 * «wait, why…») — не тема вопроса, а перебивание/связка. Иначе поиск идёт по «подождите»,
 * а вопрос-проверка звучит «почему подождите соль растворяется».
 */
const LEADING_DISCOURSE = new Set([
  'подожди', 'подождите', 'погоди', 'погодите', 'стоп', 'секунду', 'секундочку', 'минутку', 'слушай', 'слушайте',
  'ну', 'так', 'вот', 'ой', 'эм', 'э', 'хм', 'ага', 'извини', 'извините', 'прости', 'простите', 'а', 'и', 'но',
  'окей', 'ок', 'ладно', 'хорошо', 'учитель', 'wait', 'hold', 'on', 'sorry', 'well', 'so', 'ok', 'okay', 'um', 'uh',
  'hmm', 'and', 'but', 'teacher', 'kuting', "to'xta", 'ustoz', 'xo\'p', 'mayli',
])

/** Убрать вводные слова в начале реплики; если после них ничего нет — вернуть как было. */
export function stripLeadingDiscourse(text: string): string {
  const words = text.trim().split(/\s+/)
  let i = 0
  while (i < words.length - 1) {
    const bare = foldText(words[i]!.replace(/[^\p{L}\p{N}']/gu, ''))
    if (!bare || !LEADING_DISCOURSE.has(bare)) break
    i++
  }
  if (i === 0) return text.trim()
  const rest = words.slice(i).join(' ').replace(/^[,;:.!—–-]+\s*/, '').trim()
  return rest || text.trim()
}

export function detectFollowUp(text: string): FollowUpInfo {
  const t = foldText(stripLeadingDiscourse(text))
  const kinds = (Object.keys(PATTERNS) as FollowUpKind[]).filter((k) => PATTERNS[k].test(t))
  if (kinds.length === 0) return { kinds, needsPrevious: false }
  const own = contentStems(t).filter((s) => !FOLLOW_UP_FILLER.has(s) && ![...FOLLOW_UP_FILLER].some((f) => f.startsWith(s)))
  return { kinds, needsPrevious: own.length === 0 }
}

/** Стиль локального ответа по типу follow-up. */
export function styleForFollowUp(kinds: readonly FollowUpKind[]): ComposeStyle {
  return {
    wantWhy: kinds.includes('why'),
    wantExample: kinds.includes('example'),
    simpler: kinds.includes('simpler'),
    detail: kinds.includes('more') ? 'more' : 'brief',
  }
}

export interface ResolvedTurn {
  /** Запрос для поиска знаний и ответа. */
  query: string
  style: ComposeStyle
  followUp: FollowUpInfo
  /** «Повтори» без новой темы — повторить последнюю реплику учителя. */
  repeatLast: boolean
}

/**
 * Разрешить реплику ученика с учётом памяти сессии.
 * `previousQuestions` — последние содержательные вопросы ученика (старые → новые).
 */
export function resolveTurn(
  text: string,
  previousQuestions: readonly string[],
  _lang: StemLang,
  /** Тема урока — если follow-up без предыдущего вопроса («Объясни проще» в начале). */
  fallbackTopic?: string,
): ResolvedTurn {
  const clean = stripLeadingDiscourse(text)
  const followUp = detectFollowUp(clean)
  const style = styleForFollowUp(followUp.kinds)
  const prev = [...previousQuestions].reverse().find((q) => contentStems(q).length > 0)
  if (!followUp.needsPrevious) {
    // «Расскажи подробнее про кислоты» → ищем «кислоты» (служебные слова мешают поиску).
    const query =
      followUp.kinds.length > 0
        ? clean
            .split(/\s+/)
            .filter((w) => {
              const bare = foldText(w.replace(/[^\p{L}\p{N}-]/gu, ''))
              return bare && !FOLLOW_UP_FILLER.has(bare) && !/^(про|о|об|мне|about|me|haqida|a|а)$/iu.test(bare)
            })
            .join(' ')
            .trim() || clean
        : clean
    // «А как это доказать на опыте?»: местоимение без своего предмета — подставляем термин прошлого вопроса.
    const deictic = /(?<!\p{L})(это|этого|этим|их|они|она|оно|он|его|её|ее|такой|такие|it|this|they|them|bu|ular|uni)(?!\p{L})/iu
    if (prev && deictic.test(query)) {
      const parentTerm = extractKeyTerm(prev, _lang)
      const parentStems = contentStems(prev)
      const own = contentStems(query).filter((st) => !parentStems.some((p) => p.startsWith(st.slice(0, 4)) || st.startsWith(p.slice(0, 4))))
      if (parentTerm && own.length <= 2 && !contentStems(parentTerm).some((st) => contentStems(query).includes(st))) {
        return { query: query.replace(deictic, parentTerm), style, followUp, repeatLast: false }
      }
    }
    return { query, style, followUp, repeatLast: false }
  }
  const onlyRepeat = followUp.kinds.length === 1 && followUp.kinds[0] === 'repeat'
  const base = prev ?? fallbackTopic?.trim() ?? clean
  if (onlyRepeat) return { query: base || clean, style, followUp, repeatLast: true }
  // Продолжение прошлого вопроса: локальный ответ не повторяет уже сказанное (пример, причина, подробности).
  return { query: base || clean, style: prev ? { ...style, continuation: true } : style, followUp, repeatLast: false }
}

/** Является ли реплика содержательным вопросом (для памяти «предыдущих вопросов»). */
export function isSubstantiveQuestion(text: string): boolean {
  const clean = stripLeadingDiscourse(text)
  const f = detectFollowUp(clean)
  if (f.kinds.length > 0 && f.needsPrevious) return false
  return contentStems(clean).length > 0
}

/* ------------------------------------------------- реплики без вопроса */

export type NonQuestionKind = 'dontknow' | 'filler' | 'ack' | 'gibberish'

/** «Не знаю», «хз», «не помню» — ученик сдаётся, ему нужна наводка, а не поиск по базе. */
const DONT_KNOW_RE =
  /^(я\s+)?(не\s+знаю|незнаю|не\s+помню|не\s+могу|затрудняюсь|хз|без\s+понятия|понятия\s+не\s+имею|сложно|трудно|не\s+получается|i\s+do\s?n'?t\s+know|dunno|no\s+idea|not\s+sure|bilmayman|bilmadim|eslay\s+olmayman)[\s.!?]*$/iu

/** «Ммм», «эээ», «ну», «чё» — шум распознавания, на него отвечаем переспросом. */
const FILLER_RE = /^(м+|э+|а+|у+|ну|так|что|чё|че|а\s*что|ага\s*что|hmm+|um+|uh+|eh+|well|so|nima|ha)[\s.!?]*$/iu

/** «Понятно», «спасибо», «ок» — подтверждение, отвечаем коротко и идём дальше. */
const ACK_RE =
  /^(ага|угу|ок|окей|хорошо|ладно|понял|поняла|понятно|ясно|спасибо|спс|благодарю|всё\s+понятно|да|ok|okay|got\s+it|i\s+see|thanks|thank\s+you|clear|tushundim|rahmat|xo'?p|mayli|ha)[\s.!?]*$/iu

/**
 * Реплика ученика без вопроса: «не знаю» / мычание / подтверждение.
 * Срабатывает только на короткой реплике — «не знаю, почему вода кипит» остаётся вопросом.
 */
export function detectNonQuestion(text: string): NonQuestionKind | null {
  // «э-э», «м-м-м» — тянущиеся звуки пишутся через дефис, для разбора их склеиваем.
  const t = stripLeadingDiscourse(text).trim().replace(/[«»"']/g, '').replace(/(?<=\p{L})-(?=\p{L})/gu, '')
  if (!t || t.length > 40) return null
  if (DONT_KNOW_RE.test(t)) return 'dontknow'
  if (ACK_RE.test(t)) return 'ack'
  if (FILLER_RE.test(t)) return 'filler'
  // «фыва олдж пррр», «qwrtplzk mnbvxz» — не слова: переспрашиваем, ввод не цитируем.
  if (looksLikeGibberish(t)) return 'gibberish'
  return null
}

const NON_QUESTION_REPLIES: Record<StemLang, Record<NonQuestionKind, string[]>> = {
  ru: {
    dontknow: [
      'Ничего страшного — давай вместе.',
      'Это нормально, разберём по шагам.',
      'Не беда, подскажу.',
    ],
    filler: [
      'Повтори, пожалуйста, я не расслышал.',
      'Скажи ещё раз — что именно непонятно: определение или пример?',
      'Не разобрал вопрос. Повтори чуть медленнее.',
    ],
    ack: ['Отлично. Идём дальше?', 'Хорошо. Спрашивай, если что-то ещё непонятно.', 'Рад, что понятно. Двигаемся дальше?'],
    // Ввод не цитируем: набор букв в ответе выглядел бы как принятая тема вопроса.
    gibberish: [
      'Кажется, вопрос набрался случайно — я не разобрал ни одного слова. Повтори, пожалуйста.',
      'Тут только набор букв, я не понял вопрос. Напиши ещё раз словами — о чём спрашиваешь?',
      'Не разобрал вопрос: в нём нет знакомых слов. Уточни, пожалуйста, что именно интересует.',
    ],
  },
  en: {
    dontknow: ['No problem — let us do it together.', 'That is fine, step by step.', 'No worries, I will give you a hint.'],
    filler: ['Could you repeat that, please?', 'Say it again — what exactly is unclear: the definition or the example?'],
    ack: ['Great. Shall we go on?', 'Good. Ask me if anything else is unclear.'],
    gibberish: [
      'That looks like random letters — I could not read a single word. Could you repeat the question?',
      'I did not catch the question: there are no words I know. Please say again what exactly you mean.',
    ],
  },
  uz: {
    dontknow: ['Hechqisi yoʻq — birga koʻramiz.', 'Bu normal, bosqichma-bosqich koʻramiz.', 'Xavotir olma, yoʻl-yoʻriq beraman.'],
    filler: ['Iltimos, qaytar — eshitmadim.', 'Yana bir bor ayt: nimasi tushunarsiz — taʼrifmi yoki misolmi?'],
    ack: ['Zoʻr. Davom etamizmi?', 'Yaxshi. Yana tushunarsiz joyi boʻlsa, soʻra.'],
    gibberish: [
      'Bu tasodifiy harflarga oʻxshaydi — birorta soʻzni ajrata olmadim. Iltimos, savolni qaytar.',
      'Savolni tushunmadim: tanish soʻz yoʻq. Iltimos, nimani soʻrayotganingni soʻz bilan yoz.',
    ],
  },
}

/**
 * Ответ на реплику без вопроса. Для «не знаю» подмешивает наводку по текущей теме
 * (слот hint карточки объяснения) и снова задаёт вопрос проще — база при этом не опрашивается.
 */
export function replyForNonQuestion(
  kind: NonQuestionKind,
  lang: StemLang,
  options: { topic?: string; seed?: number } = {},
): string {
  const pool = NON_QUESTION_REPLIES[lang] ?? NON_QUESTION_REPLIES.ru
  const seed = options.seed ?? 0
  const lines = pool[kind]
  const opener = lines[((seed % lines.length) + lines.length) % lines.length]!
  if (kind !== 'dontknow' || !options.topic) return opener
  const card = explainerHint(options.topic, lang)
  if (!card) return opener
  return `${opener} ${card.hint} ${card.check}`
}
