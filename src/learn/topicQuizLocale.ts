import type { AppLocale } from '../i18n/types'
import type { OralExamItem, TopicQuizItem, WrittenExamItem } from './topicQuizTypes'

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
    question: item.questionUz?.trim() || item.questionEn?.trim() || item.question,
    choices: asChoices(item.choicesUz, item.choicesEn ?? item.choices),
    explanation: item.explanationUz?.trim() || item.explanationEn?.trim() || item.explanation,
    description: item.descriptionUz?.trim() || item.descriptionEn?.trim() || item.description,
  }
}

export type QuizI18nEntry = {
  questionEn?: string
  questionUz?: string
  choicesEn?: readonly string[]
  choicesUz?: readonly string[]
  explanationEn?: string
  explanationUz?: string
  descriptionEn?: string
  descriptionUz?: string
}

export function mergeQuizI18n(item: TopicQuizItem, i18n: QuizI18nEntry | undefined): TopicQuizItem {
  if (!i18n) return item
  return {
    ...item,
    questionEn: i18n.questionEn?.trim() || item.questionEn,
    questionUz: i18n.questionUz?.trim() || item.questionUz,
    choicesEn: asChoices(i18n.choicesEn, item.choicesEn ?? item.choices),
    choicesUz: asChoices(i18n.choicesUz, item.choicesUz ?? item.choices),
    explanationEn: i18n.explanationEn?.trim() || item.explanationEn,
    explanationUz: i18n.explanationUz?.trim() || item.explanationUz,
    descriptionEn: i18n.descriptionEn?.trim() || item.descriptionEn,
    descriptionUz: i18n.descriptionUz?.trim() || item.descriptionUz,
  }
}

export type ExamQuestionI18n = {
  questionEn?: string
  questionUz?: string
  questionSpeakEn?: string
  questionSpeakUz?: string
  questionDisplayEn?: string
  questionDisplayUz?: string
  sampleAnswerEn?: string
  sampleAnswerUz?: string
  explanationEn?: string
  explanationUz?: string
  rubricEn?: readonly string[]
  rubricUz?: readonly string[]
}

export function mergeWrittenExamI18n(
  item: WrittenExamItem,
  i18n: ExamQuestionI18n | undefined,
): WrittenExamItem {
  if (!i18n) return item
  return {
    ...item,
    questionEn: i18n.questionEn?.trim() || item.questionEn,
    questionUz: i18n.questionUz?.trim() || item.questionUz,
    sampleAnswerEn: i18n.sampleAnswerEn?.trim() || item.sampleAnswerEn,
    sampleAnswerUz: i18n.sampleAnswerUz?.trim() || item.sampleAnswerUz,
    explanationEn: i18n.explanationEn?.trim() || item.explanationEn,
    explanationUz: i18n.explanationUz?.trim() || item.explanationUz,
    rubricEn: i18n.rubricEn ?? item.rubricEn,
    rubricUz: i18n.rubricUz ?? item.rubricUz,
  }
}

export function mergeOralExamI18n(item: OralExamItem, i18n: ExamQuestionI18n | undefined): OralExamItem {
  if (!i18n) return item
  return {
    ...item,
    questionSpeakEn: i18n.questionSpeakEn?.trim() || i18n.questionEn?.trim() || item.questionSpeakEn,
    questionSpeakUz: i18n.questionSpeakUz?.trim() || i18n.questionUz?.trim() || item.questionSpeakUz,
    questionDisplayEn:
      i18n.questionDisplayEn?.trim() || i18n.questionEn?.trim() || item.questionDisplayEn,
    questionDisplayUz:
      i18n.questionDisplayUz?.trim() || i18n.questionUz?.trim() || item.questionDisplayUz,
    sampleAnswerEn: i18n.sampleAnswerEn?.trim() || item.sampleAnswerEn,
    sampleAnswerUz: i18n.sampleAnswerUz?.trim() || item.sampleAnswerUz,
    explanationEn: i18n.explanationEn?.trim() || item.explanationEn,
    explanationUz: i18n.explanationUz?.trim() || item.explanationUz,
    rubricEn: i18n.rubricEn ?? item.rubricEn,
    rubricUz: i18n.rubricUz ?? item.rubricUz,
  }
}

/** Письменный вопрос → язык интерфейса. */
export function localizeWrittenExam(item: WrittenExamItem, locale: AppLocale): WrittenExamItem {
  if (locale === 'ru') return item
  if (locale === 'en') {
    return {
      ...item,
      question: item.questionEn?.trim() || item.question,
      rubric: item.rubricEn?.length ? item.rubricEn : item.rubric,
      sampleAnswer: item.sampleAnswerEn?.trim() || item.sampleAnswer,
      explanation: item.explanationEn?.trim() || item.explanation,
    }
  }
  return {
    ...item,
    question: item.questionUz?.trim() || item.questionEn?.trim() || item.question,
    rubric: item.rubricUz?.length ? item.rubricUz : item.rubricEn?.length ? item.rubricEn : item.rubric,
    sampleAnswer: item.sampleAnswerUz?.trim() || item.sampleAnswerEn?.trim() || item.sampleAnswer,
    explanation: item.explanationUz?.trim() || item.explanationEn?.trim() || item.explanation,
  }
}

/** Устный / видео-вопрос → язык интерфейса и озвучки. */
export function localizeOralExam(item: OralExamItem, locale: AppLocale): OralExamItem {
  if (locale === 'ru') return item
  if (locale === 'en') {
    const speak = item.questionSpeakEn?.trim() || item.questionSpeak
    return {
      ...item,
      questionSpeak: speak,
      questionDisplay: item.questionDisplayEn?.trim() || item.questionDisplay || speak,
      rubric: item.rubricEn?.length ? item.rubricEn : item.rubric,
      sampleAnswer: item.sampleAnswerEn?.trim() || item.sampleAnswer,
      explanation: item.explanationEn?.trim() || item.explanation,
    }
  }
  const speak = item.questionSpeakUz?.trim() || item.questionSpeakEn?.trim() || item.questionSpeak
  return {
    ...item,
    questionSpeak: speak,
    questionDisplay:
      item.questionDisplayUz?.trim() ||
      item.questionDisplayEn?.trim() ||
      item.questionDisplay ||
      speak,
    rubric: item.rubricUz?.length ? item.rubricUz : item.rubricEn?.length ? item.rubricEn : item.rubric,
    sampleAnswer: item.sampleAnswerUz?.trim() || item.sampleAnswerEn?.trim() || item.sampleAnswer,
    explanation: item.explanationUz?.trim() || item.explanationEn?.trim() || item.explanation,
  }
}
