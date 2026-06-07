import { useCallback, useEffect, useState } from 'react'
import {
  CLASS_ROSTER_CHANGED,
  classAverageScore,
  importClassNames,
  parsePastedNames,
  readClassRoster,
  setActiveStudent,
  type ClassRoster,
} from '../../learn/learnClassRosterStorage'
import { useT } from '../../i18n/useT'
import styles from './LearnClassRosterPanel.module.css'

type Props = {
  sectionId: string
}

export function LearnClassRosterPanel({ sectionId }: Props) {
  const { t } = useT()
  const [roster, setRoster] = useState<ClassRoster>(() => readClassRoster(sectionId))
  const [className, setClassName] = useState(roster.className)
  const [paste, setPaste] = useState('')

  const reload = useCallback(() => {
    const next = readClassRoster(sectionId)
    setRoster(next)
    setClassName(next.className)
  }, [sectionId])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ sectionId?: string }>).detail
      if (!detail?.sectionId || detail.sectionId === sectionId) reload()
    }
    window.addEventListener(CLASS_ROSTER_CHANGED, onChange)
    return () => window.removeEventListener(CLASS_ROSTER_CHANGED, onChange)
  }, [reload, sectionId])

  const avg = classAverageScore(sectionId)

  const onImport = () => {
    const names = parsePastedNames(paste)
    if (names.length === 0) return
    importClassNames(sectionId, className, names)
    setPaste('')
  }

  const lastAttemptLabel = (studentId: string) => {
    const student = roster.students.find((s) => s.id === studentId)
    const last = student?.attempts[student.attempts.length - 1]
    if (!last) return t('learn.classRoster.noAttempts')
    return t('learn.classRoster.lastScore', {
      score: String(last.score),
      total: String(last.total),
    })
  }

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <h2 className={styles.title}>{t('learn.classRoster.title')}</h2>
        <p className={styles.lead}>{t('learn.classRoster.lead')}</p>
      </div>

      <div className={styles.fieldRow}>
        <label className={styles.label} htmlFor="class-name">
          {t('learn.classRoster.className')}
        </label>
        <input
          id="class-name"
          className={styles.input}
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          placeholder={t('learn.classRoster.classNamePh')}
        />
      </div>

      <div className={styles.fieldRow}>
        <label className={styles.label} htmlFor="class-paste">
          {t('learn.classRoster.pasteLabel')}
        </label>
        <textarea
          id="class-paste"
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
        <p className={styles.empty}>{t('learn.classRoster.empty')}</p>
      ) : (
        <ul className={styles.studentList}>
          {roster.students.map((student) => {
            const active = roster.activeStudentId === student.id
            return (
              <li key={student.id}>
                <button
                  type="button"
                  className={`${styles.studentBtn} ${active ? styles.studentBtnActive : ''}`}
                  onClick={() => setActiveStudent(sectionId, student.id)}
                >
                  <span className={styles.studentName}>{student.name}</span>
                  <span className={styles.studentScore}>{lastAttemptLabel(student.id)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
