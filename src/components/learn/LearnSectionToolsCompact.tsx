import { Link } from 'react-router-dom'
import type { LearnChapter, LearnGrade, LearnSection } from '../../types/learn'
import {
  buildGenerateEquationLabUrl,
  getSectionEquations,
} from '../../data/learnSectionEquations'
import { useT } from '../../i18n/useT'
import { LearnTopicQuizCard } from './LearnTopicQuizCard'
import styles from './LearnLessonSidebar.module.css'

type Props = {
  grade: LearnGrade
  chapter: LearnChapter
  section: LearnSection
  fromBook?: boolean
}

export function LearnSectionToolsCompact({ grade, chapter, section, fromBook }: Props) {
  const { t } = useT()
  const equations = getSectionEquations(grade.id, chapter.id, section.id)
  const labUrl = buildGenerateEquationLabUrl(grade.id, chapter.id, section.id)

  return (
    <div className={styles.toolsPane}>
      {equations.length > 0 ? (
        <div className={styles.equationBlock}>
          <p className={styles.toolsLabel}>{t('learn.bookTopic.equationTitle')}</p>
          <ul className={styles.equationList}>
            {equations.slice(0, 2).map((entry) => (
              <li key={`${entry.productCompoundId}-${entry.equation}`}>
                <span className={styles.equation}>{entry.equation}</span>
              </li>
            ))}
          </ul>
          <Link className={styles.toolsLink} to={labUrl}>
            {t('learn.bookTopic.generateEquation')}
          </Link>
        </div>
      ) : null}
      <div className={styles.quizCompact}>
        <LearnTopicQuizCard grade={grade} chapter={chapter} section={section} autoReveal={fromBook} />
      </div>
      <Link className={styles.toolsLink} to="/learn/tasks">
        {t('learn.lesson.openTasks')}
      </Link>
      <p className={styles.toolsLabel}>{t('learn.balance.title')}</p>
      <p className={styles.toolsHint}>{t('learn.teacherExam.balanceHint')}</p>
    </div>
  )
}
