import { Link } from 'react-router-dom'
import type { LearnChapter, LearnGrade, LearnSection } from '../../types/learn'
import {
  buildGenerateEquationLabUrl,
  getSectionEquations,
} from '../../data/learnSectionEquations'
import { useT } from '../../i18n/useT'
import { LearnTopicQuizCard } from './LearnTopicQuizCard'
import { LearnSidebarIcon } from './LearnSidebarIcon'
import kit from './studio/StudioKit.module.css'
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
        <section className={`${kit.card} ${styles.toolCard} ${styles.toneTeal}`}>
          <header className={styles.toolHead}>
            <span className={kit.iconTile} aria-hidden="true">
              <LearnSidebarIcon name="flask" size={15} />
            </span>
            <span className={styles.toolText}>
              <span className={styles.toolTitle}>{t('learn.bookTopic.equationTitle')}</span>
              <span className={styles.toolDesc}>{t('learn.studio.cockpit.tools.equationsDesc')}</span>
            </span>
          </header>
          <ul className={styles.equationList}>
            {equations.slice(0, 2).map((entry) => (
              <li key={`${entry.productCompoundId}-${entry.equation}`}>
                <span className={styles.equation}>{entry.equation}</span>
              </li>
            ))}
          </ul>
          <Link className={`${kit.btn} ${styles.toolAction}`} to={labUrl}>
            <LearnSidebarIcon name="sparkle" size={14} />
            <span>{t('learn.bookTopic.generateEquation')}</span>
          </Link>
        </section>
      ) : null}

      <section className={`${kit.card} ${styles.toolCard} ${styles.tonePrimary}`}>
        <header className={styles.toolHead}>
          <span className={kit.iconTile} aria-hidden="true">
            <LearnSidebarIcon name="mcq" size={15} />
          </span>
          <span className={styles.toolText}>
            <span className={styles.toolTitle}>{t('learn.studio.cockpit.tabTest')}</span>
            <span className={styles.toolDesc}>{t('learn.studio.cockpit.tools.quizDesc')}</span>
          </span>
        </header>
        <div className={styles.quizWrap}>
          <LearnTopicQuizCard grade={grade} chapter={chapter} section={section} autoReveal={fromBook} />
        </div>
      </section>

      <Link className={`${kit.cardInteractive} ${styles.linkCard} ${styles.tonePink}`} to="/learn/tasks">
        <span className={kit.iconTile} aria-hidden="true">
          <LearnSidebarIcon name="problems" size={15} />
        </span>
        <span className={styles.toolText}>
          <span className={styles.toolTitle}>{t('learn.lesson.openTasks')}</span>
          <span className={styles.toolDesc}>{t('learn.studio.cockpit.tools.tasksDesc')}</span>
        </span>
        <LearnSidebarIcon name="arrowRight" size={16} className={styles.linkArrow} />
      </Link>

      <section className={`${kit.card} ${styles.infoCard} ${styles.toneAmber}`}>
        <span className={`${kit.iconTile} ${kit.iconTileSoft}`} aria-hidden="true">
          <LearnSidebarIcon name="balance" size={15} />
        </span>
        <span className={styles.toolText}>
          <span className={styles.toolTitle}>{t('learn.balance.title')}</span>
          <span className={styles.toolDesc}>{t('learn.teacherExam.balanceHint')}</span>
        </span>
      </section>
    </div>
  )
}
