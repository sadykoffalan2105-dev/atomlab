import { Link } from 'react-router-dom'
import type { LearnChapter, LearnGrade, LearnSection } from '../../types/learn'
import {
  buildGenerateEquationLabUrl,
  getSectionEquations,
} from '../../data/learnSectionEquations'
import { useT } from '../../i18n/useT'
import { LearnTopicQuizCard } from './LearnTopicQuizCard'
import { LearnSidebarIcon } from './LearnSidebarIcon'
import styles from './LearnSectionToolsCompact.module.css'

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
        <section className={`${styles.toolCard} ${styles.toneTeal}`}>
          <header className={styles.toolHead}>
            <span className={styles.toolIcon}>
              <LearnSidebarIcon name="flask" size={16} />
            </span>
            <p className={styles.toolsLabel}>{t('learn.bookTopic.equationTitle')}</p>
          </header>
          <ul className={styles.equationList}>
            {equations.slice(0, 2).map((entry) => (
              <li key={`${entry.productCompoundId}-${entry.equation}`}>
                <span className={styles.equation}>{entry.equation}</span>
              </li>
            ))}
          </ul>
          <Link className={styles.toolAction} to={labUrl}>
            <LearnSidebarIcon name="sparkle" size={14} />
            <span>{t('learn.bookTopic.generateEquation')}</span>
          </Link>
        </section>
      ) : null}

      <div className={styles.quizWrap}>
        <LearnTopicQuizCard grade={grade} chapter={chapter} section={section} autoReveal={fromBook} />
      </div>

      <div className={styles.toolGrid}>
        <Link className={`${styles.linkCard} ${styles.tonePink}`} to="/learn/tasks">
          <span className={styles.toolIcon}>
            <LearnSidebarIcon name="problems" size={16} />
          </span>
          <span className={styles.linkText}>{t('learn.lesson.openTasks')}</span>
        </Link>

        <section className={`${styles.infoCard} ${styles.toneAmber}`}>
          <span className={styles.toolIcon}>
            <LearnSidebarIcon name="balance" size={16} />
          </span>
          <div className={styles.infoBody}>
            <p className={styles.toolsLabel}>{t('learn.balance.title')}</p>
            <p className={styles.toolsHint}>{t('learn.teacherExam.balanceHint')}</p>
          </div>
        </section>
      </div>
    </div>
  )
}
