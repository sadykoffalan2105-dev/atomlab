import { useCallback, useEffect, useState } from 'react'
import {
  CLASS_ROSTER_CHANGED,
  classAverageScore,
  importClassNames,
  lastAttemptForKind,
  parsePastedNames,
  readClassRoster,
  setActiveStudent,
  TASKS_ROSTER_SECTION_ID,
  type ClassRoster,
  type ClassStudent,
  type StudentTestKind,
} from '../../learn/learnClassRosterStorage'
import { computeStudentRating } from '../../learn/learnStudentStats'
import { useT, type MessageKey } from '../../i18n/useT'
import { LearnStudentStatsModal } from './LearnStudentStatsModal'
import { ClassStudentConspectBtn } from './ClassStudentConspectBtn'
import styles from './LearnClassRosterPanel.module.css'

const SECTION_ID = TASKS_ROSTER_SECTION_ID

function attemptLabel(
  t: (key: MessageKey, params?: Readonly<Record<string, string | number>>) => string,
  student: ClassStudent,
) {
  const kinds: StudentTestKind[] = ['task', 'molecule', 'topic', 'ai']
  for (const kind of kinds) {
    const last = lastAttemptForKind(student, kind)
    if (last) {
      const kindLabel =
        kind === 'task'
          ? 'learn.studentStats.kind.task'
          : kind === 'molecule'
            ? 'learn.studentStats.kind.molecule'
            : kind === 'topic'
              ? 'learn.studentStats.kind.topic'
              : 'learn.studentStats.kind.ai'
      return t('learn.classRoster.lastScoreKind', {
        score: String(last.score),
        total: String(last.total),
        kind: t(kindLabel),
      })
    }
  }
  return t('learn.classRoster.noAttempts')
}

export function LearnTasksClassPanel() {
  const { t } = useT()
  const [roster, setRoster] = useState<ClassRoster>(() => readClassRoster(SECTION_ID))
  const [className, setClassName] = useState(roster.className)
  const [paste, setPaste] = useState('')
  const [statsStudentId, setStatsStudentId] = useState<string | null>(null)

  const reload = useCallback(() => {
    const next = readClassRoster(SECTION_ID)
    setRoster(next)
    setClassName(next.className)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ sectionId?: string }>).detail
      if (!detail?.sectionId || detail.sectionId === SECTION_ID) reload()
    }
    window.addEventListener(CLASS_ROSTER_CHANGED, onChange)
    return () => window.removeEventListener(CLASS_ROSTER_CHANGED, onChange)
  }, [reload])

  const avg = classAverageScore(SECTION_ID)
  const statsStudent = statsStudentId
    ? roster.students.find((s) => s.id === statsStudentId) ?? null
    : null

  const onImport = () => {
    const names = parsePastedNames(paste)
    if (names.length === 0) return
    importClassNames(SECTION_ID, className, names)
    setPaste('')
  }

  return (
    <section className={styles.panel} aria-labelledby="tasks-class-title">
      <div className={styles.head}>
        <h2 id="tasks-class-title" className={styles.title}>
          {t('learn.tasksClass.title')}
        </h2>
        <p className={styles.lead}>{t('learn.tasksClass.lead')}</p>
      </div>

      <div className={styles.fieldRow}>
        <label className={styles.label} htmlFor="tasks-class-name">
          {t('learn.classRoster.className')}
        </label>
        <input
          id="tasks-class-name"
          className={styles.input}
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          placeholder={t('learn.classRoster.classNamePh')}
        />
      </div>

      <div className={styles.fieldRow}>
        <label className={styles.label} htmlFor="tasks-class-paste">
          {t('learn.classRoster.pasteLabel')}
        </label>
        <textarea
          id="tasks-class-paste"
          className={styles.textarea}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={t('learn.classRoster.pastePh')}
        />
        <button type="button" className={styles.importBtn} onClick={onImport}>
          {t('learn.classRoster.import')}
        </button>
      </div>

      <div className={styles.stats}>
        <span className={styles.statChip}>
          {t('learn.classRoster.count', { n: String(roster.students.length) })}
        </span>
        {avg !== null ? (
          <span className={styles.statChip}>
            {t('learn.classRoster.classAvg', { pct: String(avg) })}
          </span>
        ) : null}
      </div>

      {roster.students.length === 0 ? (
        <p className={styles.empty}>{t('learn.tasksClass.empty')}</p>
      ) : (
        <ul className={styles.studentList}>
          {roster.students.map((student) => {
            const active = roster.activeStudentId === student.id
            const rating = computeStudentRating(student)
            return (
              <li key={student.id} className={styles.studentRow}>
                <button
                  type="button"
                  className={`${styles.studentBtn} ${active ? styles.studentBtnActive : ''}`}
                  onClick={() => setActiveStudent(SECTION_ID, student.id)}
                >
                  <span className={styles.studentName}>
                    {student.name}
                    {active ? (
                      <span className={styles.activeTag}> · {t('learn.tasksClass.active')}</span>
                    ) : null}
                  </span>
                  <span className={styles.studentScore}>
                    {attemptLabel(t, student)}
                    {student.attempts.length > 0 || rating.conspectBonus > 0
                      ? ` · ${rating.score}`
                      : ''}
                  </span>
                </button>
                <ClassStudentConspectBtn
                  student={student}
                  rosterSectionId={SECTION_ID}
                  sectionTitle={t('learn.tasksClass.title')}
                  className={roster.className}
                />
                <button
                  type="button"
                  className={styles.statsBtn}
                  title={t('learn.studentStats.open')}
                  aria-label={t('learn.studentStats.open')}
                  onClick={() => setStatsStudentId(student.id)}
                >
                  📊
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {statsStudent ? (
        <LearnStudentStatsModal
          student={statsStudent}
          sectionTitle={t('learn.tasksClass.title')}
          rosterSectionId={SECTION_ID}
          className={roster.className}
          onClose={() => setStatsStudentId(null)}
          onSelect={() => {
            setActiveStudent(SECTION_ID, statsStudent.id)
            setStatsStudentId(null)
          }}
        />
      ) : null}
    </section>
  )
}
