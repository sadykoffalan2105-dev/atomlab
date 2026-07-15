import type { AppLocale } from '../i18n/types'
import type { TopicQuizItem } from './topicQuizTypes'

type ChoiceTuple = readonly [string, string, string, string]

function asChoices(value: readonly string[] | undefined, fallback: ChoiceTuple): ChoiceTuple {
  if (!value || value.length !== 4) return fallback
  return [value[0]!, value[1]!, value[2]!, value[3]!]
}

/** Подставляет EN/UZ текст в канонические поля; RU остаётся как есть. */
export function localizeTopicQuiz(item: TopicQuizItem, locale: AppLocale): TopicQuizItem {
  if (locale === 'ru') return item

  if (locale === 'en') {
    return {
      ...item,
      question: item.questionEn?.trim() || item.question,
      choices: asChoices(item.choicesEn, item.choices),
      explanation: item.explanationEn?.trim() || item.explanation,
      description: item.descriptionEn?.trim() || item.description,
    }
  }

  return {
    ...item,
    question: item.questionUz?.trim() || item.question,
    choices: asChoices(item.choicesUz, item.choices),
    explanation: item.explanationUz?.trim() || item.explanation,
    description: item.descriptionUz?.trim() || item.description,
  }
}

export type QuizI18nEntry = {
  questionEn?: string
  questionUz?: string
  choicesEn?: [string, string, string, string]
  choicesUz?: [string, string, string, string]
  explanationEn?: string
  explanationUz?: string
  descriptionEn?: string
  descriptionUz?: string
}

export function mergeQuizI18n(item: TopicQuizItem, i18n: QuizI18nEntry | undefined): TopicQuizItem {
  if (!i18n) return item
  return {
    ...item,
    questionEn: i18n.questionEn ?? item.questionEn,
    questionUz: i18n.questionUz ?? item.questionUz,
    choicesEn: i18n.choicesEn ?? item.choicesEn,
    choicesUz: i18n.choicesUz ?? item.choicesUz,
    explanationEn: i18n.explanationEn ?? item.explanationEn,
    explanationUz: i18n.explanationUz ?? item.explanationUz,
    descriptionEn: i18n.descriptionEn ?? item.descriptionEn,
    descriptionUz: i18n.descriptionUz ?? item.descriptionUz,
  }
}
