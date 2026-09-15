/**
 * Короткие «follow-up» реплики живого диалога: «а почему?», «приведи пример»,
 * «проще», «подробнее», «повтори». Без собственной темы они относятся к
 * предыдущему вопросу ученика — так разговор звучит по-человечески.
 *
 * Чистый модуль (без DOM) — покрыт тестами (scripts/test-teacher-live-engine.mts).
 */
import type { ComposeStyle } from './localAnswerComposer'
import { contentStems, foldText, type StemLang } from './textStems'

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
    return { query, style, followUp, repeatLast: false }
  }
  const onlyRepeat = followUp.kinds.length === 1 && followUp.kinds[0] === 'repeat'
  const base = prev ?? fallbackTopic?.trim() ?? clean
  if (onlyRepeat) return { query: base || clean, style, followUp, repeatLast: true }
  return { query: base || clean, style, followUp, repeatLast: false }
}

/** Является ли реплика содержательным вопросом (для памяти «предыдущих вопросов»). */
export function isSubstantiveQuestion(text: string): boolean {
  const clean = stripLeadingDiscourse(text)
  const f = detectFollowUp(clean)
  if (f.kinds.length > 0 && f.needsPrevious) return false
  return contentStems(clean).length > 0
}
