export type TopicQuizItem = {
  id: string
  /** Ключ шаблона для подсказок учителя (без выдачи ответа) */
  templateKey?: string
  question: string
  choices: readonly [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  /** Краткая подсказка после ответа */
  explanation?: string
  /** Развёрнутое описание темы вопроса */
  description?: string
  /** Ключ SVG-иллюстрации (TopicQuizVisual) */
  visualId?: string
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
