import { Link } from 'react-router-dom'
import type { LearnChapter, LearnGrade, LearnSection } from '../../types/learn'
import {
  buildGenerateEquationLabUrl,
  getSectionEquations,
} from '../../data/learnSectionEquations'
import { g7TextbookSectionPage, gradeHasTextbook } from '../../data/learnTextbookG7'
import { useT } from '../../i18n/useT'
import { learnSectionPathId } from '../../data/learnCurriculumUz'
import { LearnTopicQuizCard } from './LearnTopicQuizCard'
import { LearnStudentTestHub } from './LearnStudentTestHub'
import styles from './LearnBookTopicPanel.module.css'

type Props = {
  grade: LearnGrade
  chapter: LearnChapter
  section: LearnSection
  fromBook?: boolean
  /** false = тест уже в панели класса слева (без дубля) */
  showStudentTest?: boolean
}

export function LearnBookTopicPanel({
  grade,
  chapter,
  section,
  fromBook,
  showStudentTest = true,
}: Props) {
  const { t } = useT()
  const equations = getSectionEquations(grade.id, chapter.id, section.id)
  const labUrl = buildGenerateEquationLabUrl(grade.id, chapter.id, section.id)

  return (
    <section id="learn-topic-tools" className={styles.panel}>
      {fromBook ? (
        <div className={styles.bookBadge}>{t('learn.bookTopic.fromBook')}</div>
      ) : null}

      <div className={styles.hero}>
        <div>
          <p className={styles.kicker}>{t(chapter.titleKey)}</p>
          <h2 className={styles.title}>{t(section.titleKey)}</h2>
          <p className={styles.lead}>{t('learn.bookTopic.lead')}</p>
        </div>
        {gradeHasTextbook(grade.id) ? (
          <Link
            className={styles.bookLink}
            to={`/learn/g/${grade.id}/book?chapter=${chapter.id}&section=${section.id}&page=${g7TextbookSectionPage(chapter.id, section.id)}`}
          >
            {t('learn.textbook.openSection')}
          </Link>
        ) : null}
      </div>

      <div className={styles.toolsRow}>
        <div className={styles.equationCard}>
          <h3 className={styles.toolTitle}>{t('learn.bookTopic.equationTitle')}</h3>
          <ul className={styles.equationList}>
            {equations.map((entry) => (
              <li key={`${entry.productCompoundId}-${entry.equation}`} className={styles.equationItem}>
                <p className={styles.equation}>{entry.equation}</p>
                <p className={styles.hint}>{entry.hint}</p>
              </li>
            ))}
          </ul>
          <p className={styles.equationScopeHint}>{t('learn.bookTopic.equationScopeHint')}</p>
          <Link className={styles.genBtn} to={labUrl}>
            {t('learn.bookTopic.generateEquation')}
          </Link>
        </div>
        <div className={styles.quizSlot}>
          <LearnTopicQuizCard grade={grade} chapter={chapter} section={section} autoReveal={fromBook} />
        </div>
      </div>

      {showStudentTest ? (
        <LearnStudentTestHub
          grade={grade}
          chapter={chapter}
          section={section}
          rosterSectionId={learnSectionPathId(section)}
          requireStudent={false}
          showMoleculeHint={false}
        />
      ) : null}
    </section>
  )
}
