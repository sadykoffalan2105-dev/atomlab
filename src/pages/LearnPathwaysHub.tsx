import { Link } from 'react-router-dom'
import { LEARN_PATHWAYS, pathwayTotalTasks } from '../data/learnPathways'
import {
  pathwayCompletedTaskCount,
  readPathwayProgress,
} from '../learn/learnPathwayProgressStorage'
import { useT } from '../i18n/useT'
import styles from './LearnPage.module.css'

export function LearnPathwaysHub() {
  const { t } = useT()

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} to="/learn">
        {t('learn.pathways.back')}
      </Link>
      <h1 className={styles.h}>{t('learn.pathways.title')}</h1>
      <p className={styles.lead}>{t('learn.pathways.lead')}</p>
      <div className={styles.topicGrid}>
        {LEARN_PATHWAYS.map((pathway) => {
          const progress = readPathwayProgress(pathway.id)
          const total = pathwayTotalTasks(pathway)
          const done = pathwayCompletedTaskCount(progress)
          const finished = Boolean(progress.completedAt)
          const resumeStep = progress.currentStep
          const to = finished
            ? `/learn/pathway/${pathway.id}/summary`
            : `/learn/pathway/${pathway.id}/${resumeStep}`

          return (
            <Link
              key={pathway.id}
              to={to}
              className={styles.topicCard}
              style={{ ['--learn-accent' as string]: pathway.accentColor }}
            >
              <div className={styles.topicCardVisual} aria-hidden />
              <h2 className={styles.topicCardTitle}>{t(pathway.titleKey)}</h2>
              <p className={styles.topicCardSummary}>{t(pathway.leadKey)}</p>
              <span className={styles.topicCardMeta}>
                {finished
                  ? t('learn.pathways.completed')
                  : done > 0
                    ? t('learn.pathways.progress', { done, total })
                    : t('learn.pathways.estimated', { n: pathway.estimatedMin })}
              </span>
              <span className={styles.btn} style={{ marginTop: '0.65rem', width: 'fit-content' }}>
                {done > 0 && !finished ? t('learn.pathways.continue') : t('learn.pathways.start')}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
