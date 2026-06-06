export type TopicQuizItem = {
  id: string
  question: string
  choices: readonly [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation?: string
}

export type SectionEquationOffer = {
  /** Пример уравнения для § */
  equation: string
  /** id вещества-продукта в каталоге */
  productCompoundId: string
  /** Подсказка ученику */
  hint: string
}
