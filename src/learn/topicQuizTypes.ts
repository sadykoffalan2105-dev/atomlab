export type TopicQuizItem = {
  id: string
  /** Ключ шаблона для подсказок учителя (без выдачи ответа) */
  templateKey?: string
  /** Канонический текст (русский) */
  question: string
  choices: readonly [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  /** Краткая подсказка после ответа */
  explanation?: string
  /** Развёрнутое описание темы вопроса */
  description?: string
  /** EN/UZ — тот же порядок вариантов, что у `choices` (correctIndex не меняется) */
  questionEn?: string
  questionUz?: string
  choicesEn?: readonly [string, string, string, string]
  choicesUz?: readonly [string, string, string, string]
  explanationEn?: string
  explanationUz?: string
  descriptionEn?: string
  descriptionUz?: string
  /** Ключ SVG-иллюстрации (TopicQuizVisual) */
  visualId?: string
  /** Логический / развивающий вопрос */
  logical?: boolean
}

export type WrittenExamItem = {
  id: string
  kind: 'written'
  question: string
  /** Ключевые пункты для оценки ответа */
  rubric: readonly string[]
  sampleAnswer?: string
  explanation?: string
  chapterNum?: number
  questionEn?: string
  questionUz?: string
  rubricEn?: readonly string[]
  rubricUz?: readonly string[]
  sampleAnswerEn?: string
  sampleAnswerUz?: string
  explanationEn?: string
  explanationUz?: string
}

export type OralExamItem = {
  id: string
  kind: 'oral'
  /** Текст для озвучки учителем */
  questionSpeak: string
  /** Текст на экране (если отличается) */
  questionDisplay?: string
  rubric: readonly string[]
  sampleAnswer?: string
  explanation?: string
  chapterNum?: number
  questionSpeakEn?: string
  questionSpeakUz?: string
  questionDisplayEn?: string
  questionDisplayUz?: string
  rubricEn?: readonly string[]
  rubricUz?: readonly string[]
  sampleAnswerEn?: string
  sampleAnswerUz?: string
  explanationEn?: string
  explanationUz?: string
}

export type SectionEquationEntry = {
  /** Пример уравнения для § */
  equation: string
  /** id вещества-продукта в каталоге */
  productCompoundId: string
  /** Подсказка ученику */
  hint: string
}

/** @deprecated используйте SectionEquationEntry */
export type SectionEquationOffer = SectionEquationEntry
