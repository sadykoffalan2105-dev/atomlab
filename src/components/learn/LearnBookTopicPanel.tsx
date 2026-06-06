import { Link } from 'react-router-dom'
import type { LearnChapter, LearnGrade, LearnSection } from '../../types/learn'
import {
  buildGenerateEquationLabUrl,
  getSectionEquationOffer,
} from '../../data/learnSectionEquations'
import { g7TextbookSectionPage, gradeHasTextbook } from '../../data/learnTextbookG7'
import { useT } from '../../i18n/useT'
import { LearnTopicQuizCard } from './LearnTopicQuizCard'
import styles from './LearnBookTopicPanel.module.css'

type Props = {
  grade: LearnGrade
  chapter: LearnChapter
  section: LearnSection
  fromBook?: boolean
}

export function LearnBookTopicPanel({ grade, chapter, section, fromBook }: Props) {
  const { t } = useT()
  const offer = getSectionEquationOffer(grade.id, chapter.id, section.id)
  const labUrl = buildGenerateEquationLabUrl(offer)

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
          <p className={styles.equation}>{offer.equation}</p>
          <p className={styles.hint}>{offer.hint}</p>
          <Link className={styles.genBtn} to={labUrl}>
            {t('learn.bookTopic.generateEquation')}
          </Link>
        </div>
        <div className={styles.quizSlot}>
          <LearnTopicQuizCard grade={grade} chapter={chapter} section={section} autoReveal={fromBook} />
        </div>
      </div>
    </section>
  )
}
