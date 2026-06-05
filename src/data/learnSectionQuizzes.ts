import type { MessageKey } from '../i18n/messagesRu'
import { learnSectionPathKey } from './learnFgosMatrix'

export type LearnExtraQuiz = {
  questionKey: MessageKey
  choiceKeys: readonly MessageKey[]
  correctIndex: number
}

/** Дополнительные вопросы к § (мини-тест после основного checkpoint). */
export const LEARN_SECTION_EXTRA_QUIZZES: Readonly<Record<string, readonly LearnExtraQuiz[]>> = {
  [learnSectionPathKey('g7', 'c1', 's01')]: [
    {
      questionKey: 'learn.quiz.g7c1s01.q2',
      choiceKeys: [
        'learn.quiz.g7c1s01.q2c0',
        'learn.quiz.g7c1s01.q2c1',
        'learn.quiz.g7c1s01.q2c2',
        'learn.quiz.g7c1s01.q2c3',
      ],
      correctIndex: 1,
    },
    {
      questionKey: 'learn.quiz.g7c1s01.q3',
      choiceKeys: [
        'learn.quiz.g7c1s01.q3c0',
        'learn.quiz.g7c1s01.q3c1',
        'learn.quiz.g7c1s01.q3c2',
        'learn.quiz.g7c1s01.q3c3',
      ],
      correctIndex: 0,
    },
  ],
  [learnSectionPathKey('g8', 'c1', 's03')]: [
    {
      questionKey: 'learn.quiz.g8c1s03.q2',
      choiceKeys: [
        'learn.quiz.g8c1s03.q2c0',
        'learn.quiz.g8c1s03.q2c1',
        'learn.quiz.g8c1s03.q2c2',
        'learn.quiz.g8c1s03.q2c3',
      ],
      correctIndex: 1,
    },
  ],
  [learnSectionPathKey('g9', 'c3', 's05')]: [
    {
      questionKey: 'learn.quiz.g9c3s05.q2',
      choiceKeys: [
        'learn.quiz.g9c3s05.q2c0',
        'learn.quiz.g9c3s05.q2c1',
        'learn.quiz.g9c3s05.q2c2',
        'learn.quiz.g9c3s05.q2c3',
      ],
      correctIndex: 1,
    },
  ],
}

export function getExtraQuizzesForSection(
  gradeId: string,
  chapterId: string,
  sectionId: string,
): readonly LearnExtraQuiz[] {
  return LEARN_SECTION_EXTRA_QUIZZES[learnSectionPathKey(gradeId, chapterId, sectionId)] ?? []
}
