import type { G7TextbookSection } from './learnG7TextbookKnowledge'
import { pickVariedItem } from './learnConversationVariety'
import { extractRememberBullets } from './learnTextbookTextClean'
import type { AssistantLocale } from './learnAssistantLocale'
import { knowledgeSourceLocale } from './learnAssistantLocale'

export type LessonFooterInput = {
  locale: AssistantLocale
  /** @deprecated use locale */
  ru?: boolean
  seed: number
  topic: string
  kp?: number
  rememberRaw?: string
  concepts?: string[]
  definitions?: string[]
}

const ADVICE_RU = [
  'Перескажите тему своими словами вслух — так информация «оседает» в памяти.',
  'Запишите три главных слова по теме на стикере и повесьте на стол.',
  'Сравните определение из учебника с примером из жизни — связь помогает запомнить.',
  'Пройдите слайды параграфа ещё раз и отметьте, что было непонятно — спросите об этом.',
  'Нарисуйте простую схему или таблицу по теме — зрительная память работает отлично.',
  'Объясните тему однокласснику или родителям — если получилось, вы поняли.',
] as const

const ADVICE_EN = [
  'Explain the topic aloud in your own words — that locks it into memory.',
  'Write three key terms on a sticky note and keep them visible while studying.',
  'Link the textbook definition to a real-life example you know.',
  'Review the section slides and note what is still unclear.',
] as const

const ADVICE_UZ = [
  'Mavzuni o‘z so‘zlaringiz bilan ovoz chiqarib aytib bering — shunda yaxshi esda qoladi.',
  'Uchta asosiy so‘zni yozib qo‘ying va ko‘z oldingizda saqlang.',
  'Darslikdagi ta’rifni hayotdagi misol bilan bog‘lang.',
  'Slaydlarni yana ko‘rib chiqing va noaniq joylarni belgilang.',
] as const

const QUESTION_TEMPLATES_RU = [
  'Можете своими словами объяснить, что такое «{term}»?',
  'Приведите один пример из жизни, связанный с темой «{topic}».',
  'Чем {a} отличается от {b}? Сформулируйте одним предложением.',
  'Как бы вы объяснили параграф {kp} однокласснику, который пропустил урок?',
  'Назовите три главных понятия параграфа {kp} и свяжите их в одну фразу.',
  'Что было бы непонятно, если убрать из параграфа {kp} понятие «{term}»?',
] as const

const QUESTION_TEMPLATES_EN = [
  'Can you explain «{term}» in your own words?',
  'Give one real-life example related to «{topic}».',
  'How would you explain paragraph {kp} to a classmate who missed the lesson?',
] as const

const QUESTION_TEMPLATES_UZ = [
  '«{term}» nima ekanini o‘z so‘zlaringiz bilan tushuntira olasizmi?',
  '«{topic}» mavzusiga bog‘liq hayotdan bitta misol keltiring.',
  'Paragraf {kp} ni darsga kelmagan sinfdoshga qanday tushuntirardingiz?',
] as const

function resolveLocale(input: LessonFooterInput): AssistantLocale {
  if (input.locale) return input.locale
  return input.ru === false ? 'en' : 'ru'
}

function pickTerms(input: LessonFooterInput): { term: string; a: string; b: string } {
  const fromConcepts = input.concepts?.filter((c) => c.length >= 4 && c.length <= 40) ?? []
  const fromDefs =
    input.definitions
      ?.map((d) => d.split(/[.—]/)[0]?.trim())
      .filter((d): d is string => !!d && d.length >= 8 && d.length <= 50) ?? []

  const term = fromConcepts[0] ?? fromDefs[0]?.slice(0, 45) ?? input.topic.split(/[.,(]/)[0]?.trim() ?? input.topic
  const a = fromConcepts[0] ?? (resolveLocale(input) === 'en' ? 'pure substance' : resolveLocale(input) === 'uz' ? 'sof modda' : 'чистое вещество')
  const b = fromConcepts[1] ?? (resolveLocale(input) === 'en' ? 'mixture' : resolveLocale(input) === 'uz' ? 'aralashma' : 'смесь')
  return { term, a, b }
}

function fillTemplate(template: string, input: LessonFooterInput, terms: ReturnType<typeof pickTerms>): string {
  return template
    .replace(/\{topic\}/g, input.topic)
    .replace(/\{term\}/g, terms.term)
    .replace(/\{a\}/g, terms.a)
    .replace(/\{b\}/g, terms.b)
    .replace(/\{kp\}/g, String(input.kp ?? ''))
}

/** Стандартный хвост учебного ответа: запомнить + совет + вопрос для самопроверки. */
export function buildLessonFooter(input: LessonFooterInput): string {
  const locale = resolveLocale(input)
  const bullets = input.rememberRaw
    ? extractRememberBullets(input.rememberRaw, 4)
    : input.concepts?.slice(0, 3).map((c) => `${c}.`) ?? []

  const parts: string[] = []

  parts.push('')
  parts.push(
    locale === 'uz'
      ? '**Eslab qoling:**'
      : locale === 'en'
        ? '**Must remember:**'
        : '**Обязательно запомнить:**',
  )
  if (bullets.length > 0) {
    for (const b of bullets) parts.push(`• ${b}`)
  } else {
    parts.push(
      locale === 'uz'
        ? `• Paragraf ${input.kp ?? ''} asosiy g‘oyasi: ${input.topic}.`
        : locale === 'en'
          ? `• Main idea of paragraph ${input.kp ?? ''}: ${input.topic}.`
          : `• Главная идея параграфа ${input.kp ?? ''}: ${input.topic}.`,
    )
  }

  parts.push('')
  parts.push(
    locale === 'uz' ? '**O‘qituvchi maslahati:**' : locale === 'en' ? '**Teacher tip:**' : '**Совет учителя:**',
  )
  parts.push(
    pickVariedItem(
      locale === 'uz' ? ADVICE_UZ : locale === 'en' ? ADVICE_EN : ADVICE_RU,
      input.seed + 31,
    ),
  )

  const terms = pickTerms(input)
  const qTemplates =
    locale === 'uz' ? QUESTION_TEMPLATES_UZ : locale === 'en' ? QUESTION_TEMPLATES_EN : QUESTION_TEMPLATES_RU
  const question = fillTemplate(pickVariedItem(qTemplates, input.seed + 53), input, terms)

  parts.push('')
  parts.push(
    locale === 'uz'
      ? '**O‘zingizni tekshiring — chatga javob yozing:**'
      : locale === 'en'
        ? '**Check yourself — reply in chat:**'
        : '**Проверь себя — ответь в чат:**',
  )
  parts.push(question)

  return parts.join('\n')
}

export function buildLessonFooterFromSection(
  section: G7TextbookSection,
  localeOrRu: AssistantLocale | boolean,
  seed: number,
  localizedTopic?: string,
): string {
  const locale: AssistantLocale =
    typeof localeOrRu === 'boolean' ? (localeOrRu ? 'ru' : 'en') : localeOrRu
  const src = knowledgeSourceLocale(locale)
  // Для EN/UZ не тащим русские «запомнить» — иначе смешение языков.
  const rememberRaw =
    locale === 'ru'
      ? section.rememberRu
      : locale === 'en' && section.rememberEn && !/[\u0400-\u04FF]/.test(section.rememberEn)
        ? section.rememberEn
        : undefined
  return buildLessonFooter({
    locale,
    seed,
    topic: localizedTopic || (src === 'en' ? section.topicEn : section.topicRu),
    kp: section.kp,
    rememberRaw,
    concepts: locale === 'ru' ? section.conceptsRu : undefined,
    definitions: locale === 'ru' ? section.definitionsRu : undefined,
  })
}

/** Добавить хвост к любому учебному ответу (не для режима «проверь мой ответ»). */
export function appendLessonFooterIfEducational(
  body: string,
  input: LessonFooterInput,
  skipFooter: boolean,
): string {
  if (skipFooter) return body
  if (
    body.includes('**Обязательно запомнить:**') ||
    body.includes('**Must remember:**') ||
    body.includes('**Eslab qoling:**')
  ) {
    return body
  }
  return body + buildLessonFooter(input)
}
