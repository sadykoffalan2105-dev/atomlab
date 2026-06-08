import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import type { ClassStudent } from '../../learn/learnClassRosterStorage'
import {
  collectWeakTopics,
  computeStudentMastery,
  type StudentMasteryStats,
} from '../../learn/learnStudentStats'
import { useT, type MessageKey } from '../../i18n/useT'
import styles from './LearnStudentStatsModal.module.css'

type Props = {
  student: ClassStudent
  sectionTitle: string
  onClose: () => void
  onSelect: () => void
}

function kindLabel(t: (k: MessageKey) => string, kind: keyof StudentMasteryStats['byKind']) {
  const map: Record<typeof kind, MessageKey> = {
    molecule: 'learn.studentStats.kind.molecule',
    topic: 'learn.studentStats.kind.topic',
    ai: 'learn.studentStats.kind.ai',
  }
  return t(map[kind])
}

function masteryLabel(t: (k: MessageKey) => string, level: StudentMasteryStats['masteryLevel']) {
  const map: Record<typeof level, MessageKey> = {
    strong: 'learn.studentStats.mastery.strong',
    good: 'learn.studentStats.mastery.good',
    needsWork: 'learn.studentStats.mastery.needsWork',
    none: 'learn.studentStats.mastery.none',
  }
  return t(map[level])
}

export function LearnStudentStatsModal({ student, sectionTitle, onClose, onSelect }: Props) {
  const { t } = useT()
  const stats = computeStudentMastery(student)
  const weakTopics = collectWeakTopics(student.attempts)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const masteryClass =
    stats.masteryLevel === 'strong'
      ? styles.masteryStrong
      : stats.masteryLevel === 'good'
        ? styles.masteryGood
        : stats.masteryLevel === 'needsWork'
          ? styles.masteryNeedsWork
          : styles.masteryNone

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.card}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>{sectionTitle}</p>
            <h2 className={styles.title}>{student.name}</h2>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            {t('learn.studentStats.close')}
          </button>
        </header>

        <div className={`${styles.masteryBanner} ${masteryClass}`}>
          <span className={styles.masteryLabel}>{t('learn.studentStats.masteryTitle')}</span>
          <strong>{masteryLabel(t, stats.masteryLevel)}</strong>
          {stats.overallAvgPct !== null ? (
            <span className={styles.masteryPct}>
              {t('learn.studentStats.overallAvg', { pct: String(stats.overallAvgPct) })}
            </span>
          ) : null}
        </div>

        <div className={styles.kindGrid}>
          {(['molecule', 'topic', 'ai'] as const).map((kind) => {
            const k = stats.byKind[kind]
            return (
              <div key={kind} className={styles.kindCard}>
                <h3 className={styles.kindTitle}>{kindLabel(t, kind)}</h3>
                <p className={styles.kindMeta}>
                  {t('learn.studentStats.attempts', { n: String(k.attempts) })}
                </p>
                <p className={styles.kindScore}>
                  {k.avgPct !== null
                    ? t('learn.studentStats.avgScore', { pct: String(k.avgPct) })
                    : t('learn.classRoster.noAttempts')}
                </p>
                {k.last ? (
                  <p className={styles.kindLast}>
                    {t('learn.studentStats.lastResult', {
                      score: String(k.last.score),
                      total: String(k.last.total),
                    })}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>

        {weakTopics.length > 0 ? (
          <section className={styles.weakBlock}>
            <h3 className={styles.weakTitle}>{t('learn.studentStats.weakTopics')}</h3>
            <ul className={styles.weakList}>
              {weakTopics.map((id) => (
                <li key={id}>{id.replace(/^q_/, '§ ')}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {stats.recentAttempts.length > 0 ? (
          <section className={styles.historyBlock}>
            <h3 className={styles.historyTitle}>{t('learn.studentStats.history')}</h3>
            <ul className={styles.historyList}>
              {stats.recentAttempts.map((a, i) => (
                <li key={`${a.at}-${i}`} className={styles.historyItem}>
                  <span className={styles.historyKind}>{kindLabel(t, a.kind ?? 'molecule')}</span>
                  <span className={styles.historyScore}>
                    {a.score}/{a.total}
                  </span>
                  <span className={styles.historyDate}>
                    {new Date(a.at).toLocaleDateString(undefined, {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className={styles.footer}>
          <button type="button" className={styles.selectBtn} onClick={onSelect}>
            {t('learn.studentStats.selectForTest')}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
