import { Link } from 'react-router-dom'
import { LearnTasksClassPanel } from '../components/learn/LearnTasksClassPanel'
import { LEARN_TASK_CATEGORIES } from '../data/learnTaskCategories'
import { useT, type MessageKey } from '../i18n/useT'
import styles from './LearnPage.module.css'

export function LearnTasksHub() {
  const { t } = useT()
  const quant = LEARN_TASK_CATEGORIES.filter((c) => c.group === 'quant')
  const qual = LEARN_TASK_CATEGORIES.filter((c) => c.group === 'qual')

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} to="/learn">
        {t('learn.tasksBack')}
      </Link>
      <h1 className={styles.h} id="learn-tasks-title">
        {t('learn.tasksTitle')}
      </h1>
      <p className={styles.lead}>{t('learn.tasksLead')}</p>

      <LearnTasksClassPanel />

      <h2 className={styles.tasksSectionTitle}>{t('learn.tasksGroupQuant')}</h2>
      <div className={styles.taskCategoryGrid} role="list">
        {quant.map((cat) => (
          <article key={cat.id} className={styles.taskCategoryCard} role="listitem">
            <h3 className={styles.taskCategoryTitle}>{t(cat.titleKey as MessageKey)}</h3>
            <p className={styles.taskWhatLabel}>{t('learn.tasksWhatLabel')}</p>
            <p className={styles.taskCategoryWhat}>{t(cat.whatKey as MessageKey)}</p>
            <p className={styles.taskExampleLabel}>{t('learn.tasksExampleLabel')}</p>
            <p className={styles.taskCategoryExample}>{t(cat.exampleKey as MessageKey)}</p>
            <Link
              className={`${styles.btn} ${styles.btnPrimary} ${styles.taskCardPractice}`}
              to={`/learn/tasks/${cat.id}`}
              aria-label={t('learn.tasks.practiceAria')}
            >
              {t('learn.tasks.practice')}
            </Link>
          </article>
        ))}
      </div>

      <h2 className={styles.tasksSectionTitle}>{t('learn.tasksGroupQual')}</h2>
      <div className={styles.taskCategoryGrid} role="list">
        {qual.map((cat) => (
          <article key={cat.id} className={styles.taskCategoryCard} role="listitem">
            <h3 className={styles.taskCategoryTitle}>{t(cat.titleKey as MessageKey)}</h3>
            <p className={styles.taskWhatLabel}>{t('learn.tasksWhatLabel')}</p>
            <p className={styles.taskCategoryWhat}>{t(cat.whatKey as MessageKey)}</p>
            <p className={styles.taskExampleLabel}>{t('learn.tasksExampleLabel')}</p>
            <p className={styles.taskCategoryExample}>{t(cat.exampleKey as MessageKey)}</p>
            <Link
              className={`${styles.btn} ${styles.btnPrimary} ${styles.taskCardPractice}`}
              to={`/learn/tasks/${cat.id}`}
              aria-label={t('learn.tasks.practiceAria')}
            >
              {t('learn.tasks.practice')}
            </Link>
          </article>
        ))}
      </div>
    </div>
  )
}
