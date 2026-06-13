import type { G7TextbookSection } from './learnG7TextbookKnowledge'
import { pickVariedItem } from './learnConversationVariety'
import { extractRememberBullets } from './learnTextbookTextClean'

export type LessonFooterInput = {
  ru: boolean
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
  'Пройдите слайды § ещё раз и отметьте, что было непонятно — спросите об этом.',
  'Нарисуйте простую схему или таблицу по теме — зрительная память работает отлично.',
  'Объясните тему однокласснику или родителям — если получилось, вы поняли.',
] as const

const ADVICE_EN = [
  'Explain the topic aloud in your own words — that locks it into memory.',
  'Write three key terms on a sticky note and keep them visible while studying.',
  'Link the textbook definition to a real-life example you know.',
  'Review the section slides and note what is still unclear.',
] as const

const QUESTION_TEMPLATES_RU = [
  'Можете своими словами объяснить, что такое «{term}»?',
  'Приведите один пример из жизни, связанный с темой «{topic}».',
  'Чем {a} отличается от {b}? Сформулируйте одним предложением.',
  'Как бы вы объяснили §{kp} однокласснику, который пропустил урок?',
  'Назовите три главных понятия §{kp} и свяжите их в одну фразу.',
  'Что было бы непонятно, если убрать из §{kp} понятие «{term}»?',
] as const

const QUESTION_TEMPLATES_EN = [
  'Can you explain «{term}» in your own words?',
  'Give one real-life example related to «{topic}».',
  'How would you explain §{kp} to a classmate who missed the lesson?',
] as const

function pickTerms(input: LessonFooterInput): { term: string; a: string; b: string } {
  const fromConcepts = input.concepts?.filter((c) => c.length >= 4 && c.length <= 40) ?? []
  const fromDefs =
    input.definitions
      ?.map((d) => d.split(/[.—]/)[0]?.trim())
      .filter((d): d is string => !!d && d.length >= 8 && d.length <= 50) ?? []

  const term = fromConcepts[0] ?? fromDefs[0]?.slice(0, 45) ?? input.topic.split(/[.,(]/)[0]?.trim() ?? input.topic
  const a = fromConcepts[0] ?? 'чистое вещество'
  const b = fromConcepts[1] ?? 'смесь'
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
  const ru = input.ru
  const bullets = input.rememberRaw
    ? extractRememberBullets(input.rememberRaw, 4)
    : input.concepts?.slice(0, 3).map((c) => `${c}.`) ?? []

  const parts: string[] = []

  parts.push('')
  parts.push(ru ? '**Обязательно запомнить:**' : '**Must remember:**')
  if (bullets.length > 0) {
    for (const b of bullets) parts.push(`• ${b}`)
  } else {
    parts.push(
      ru
        ? `• Главная идея §${input.kp ?? ''}: ${input.topic}.`
        : `• Main idea: ${input.topic}.`,
    )
  }

  parts.push('')
  parts.push(ru ? '**Совет учителя:**' : '**Teacher tip:**')
  parts.push(pickVariedItem(ru ? ADVICE_RU : ADVICE_EN, input.seed + 31))

  const terms = pickTerms(input)
  const qTemplates = ru ? QUESTION_TEMPLATES_RU : QUESTION_TEMPLATES_EN
  const question = fillTemplate(pickVariedItem(qTemplates, input.seed + 53), input, terms)

  parts.push('')
  parts.push(ru ? '**Проверь себя — ответь в чат:**' : '**Check yourself — reply in chat:**')
  parts.push(question)

  return parts.join('\n')
}

export function buildLessonFooterFromSection(
  section: G7TextbookSection,
  ru: boolean,
  seed: number,
): string {
  return buildLessonFooter({
    ru,
    seed,
    topic: ru ? section.topicRu : section.topicEn,
    kp: section.kp,
    rememberRaw: ru ? section.rememberRu : section.rememberEn,
    concepts: section.conceptsRu,
    definitions: section.definitionsRu,
  })
}

/** Добавить хвост к любому учебному ответу (не для режима «проверь мой ответ»). */
export function appendLessonFooterIfEducational(
  body: string,
  input: LessonFooterInput,
  skipFooter: boolean,
): string {
  if (skipFooter) return body
  if (body.includes('**Обязательно запомнить:**') || body.includes('**Must remember:**')) {
    return body
  }
  return body + buildLessonFooter(input)
}
