import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  CLASS_ROSTER_CHANGED,
  getStudentById,
  type ClassStudent,
  type StudentTestKind,
} from '../../learn/learnClassRosterStorage'
import {
  issueStudentGapConspect,
  resolveStudentGaps,
} from '../../learn/learnStudentGapConspect'
import {
  computeStudentMastery,
  computeStudentRating,
  type StudentMasteryStats,
} from '../../learn/learnStudentStats'
import { useT, type MessageKey } from '../../i18n/useT'
import { StudentProgressChart } from './StudentProgressChart'
import styles from './LearnStudentStatsModal.module.css'

type Props = {
  student: ClassStudent
  sectionTitle: string
  rosterSectionId: string
  gradeId?: string
  chapterId?: string
  sectionId?: string
  className?: string
  onClose: () => void
  onSelect: () => void
}

const KINDS: StudentTestKind[] = ['molecule', 'topic', 'oral', 'written', 'ai', 'task']

function kindLabel(t: (k: MessageKey) => string, kind: StudentTestKind) {
  const map: Record<StudentTestKind, MessageKey> = {
    molecule: 'learn.studentStats.kind.molecule',
    topic: 'learn.studentStats.kind.topic',
    ai: 'learn.studentStats.kind.ai',
    oral: 'learn.studentStats.kind.oral',
    written: 'learn.studentStats.kind.written',
    task: 'learn.studentStats.kind.task',
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

export function LearnStudentStatsModal({
  student: studentProp,
  sectionTitle,
  rosterSectionId,
  gradeId,
  chapterId,
  sectionId,
  className,
  onClose,
  onSelect,
}: Props) {
  const { t, locale } = useT()
  const [student, setStudent] = useState(studentProp)
  const [conspectNotice, setConspectNotice] = useState<string | null>(null)

  useEffect(() => {
    setStudent(studentProp)
  }, [studentProp])

  useEffect(() => {
    const sync = () => {
      const fresh = getStudentById(rosterSectionId, studentProp.id)
      if (fresh) setStudent(fresh)
    }
    window.addEventListener(CLASS_ROSTER_CHANGED, sync)
    return () => window.removeEventListener(CLASS_ROSTER_CHANGED, sync)
  }, [rosterSectionId, studentProp.id])

  const stats = useMemo(() => computeStudentMastery(student), [student])
  const rating = useMemo(() => computeStudentRating(student), [student])
  const gaps = useMemo(
    () =>
      resolveStudentGaps(student, {
        locale,
        gradeId,
        chapterId,
        sectionId,
      }),
    [student, locale, gradeId, chapterId, sectionId],
  )

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

  const onGenerateConspect = () => {
    const updated = issueStudentGapConspect({
      student,
      sectionTitle,
      locale,
      gradeId,
      chapterId,
      sectionId,
      className,
      rosterSectionId,
    })
    if (updated) setStudent(updated)
    setConspectNotice(t('learn.studentStats.conspect.saved'))
  }

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

        <div className={styles.ratingRow}>
          <span className={styles.ratingLabel}>{t('learn.studentStats.rating')}</span>
          <strong className={styles.ratingValue}>{rating.score}/100</strong>
          {rating.conspectBonus > 0 ? (
            <span className={styles.ratingBonus}>
              {t('learn.studentStats.ratingBonus', { n: String(rating.conspectBonus) })}
            </span>
          ) : null}
        </div>

        <StudentProgressChart series={stats.progressSeries} trend={stats.progressTrend} />

        <div className={styles.kindGrid}>
          {KINDS.map((kind) => {
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

        <section className={styles.conspectBlock}>
          <h3 className={styles.weakTitle}>{t('learn.studentStats.conspect.title')}</h3>
          <p className={styles.conspectLead}>{t('learn.studentStats.conspect.lead')}</p>
          <button
            type="button"
            className={styles.conspectBtn}
            onClick={onGenerateConspect}
          >
            {t('learn.studentStats.conspect.generate')}
          </button>
          {student.gapConspect ? (
            <p className={styles.conspectMeta}>
              {t('learn.studentStats.conspect.issued', {
                n: String(student.gapConspect.count),
                date: new Date(student.gapConspect.issuedAt).toLocaleDateString(undefined, {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })}
            </p>
          ) : null}
          {conspectNotice ? <p className={styles.conspectOk}>{conspectNotice}</p> : null}
        </section>

        {gaps.length > 0 ? (
          <section className={styles.weakBlock}>
            <h3 className={styles.weakTitle}>{t('learn.studentStats.weakTopics')}</h3>
            <ul className={styles.weakList}>
              {gaps.map((g) => (
                <li key={g.id}>
                  <span className={styles.gapTitle}>{g.title}</span>
                  {g.explanation ? <span className={styles.gapHint}>{g.explanation}</span> : null}
                </li>
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
