import { useCallback, useEffect, useState } from 'react'
import type { LearnChapter, LearnGrade, LearnSection } from '../../types/learn'
import {
  CLASS_ROSTER_CHANGED,
  classAverageScore,
  importClassNames,
  lastAttemptForKind,
  parsePastedNames,
  readClassRoster,
  setActiveStudent,
  type ClassRoster,
  type ClassStudent,
  type StudentTestKind,
} from '../../learn/learnClassRosterStorage'
import { useT, type MessageKey } from '../../i18n/useT'
import { LearnStudentTestHub } from './LearnStudentTestHub'
import { LearnStudentStatsModal } from './LearnStudentStatsModal'
import styles from './LearnClassRosterPanel.module.css'

type Props = {
  sectionId: string
  grade: LearnGrade
  chapter: LearnChapter
  section: LearnSection
}

function attemptLabel(
  t: (key: MessageKey, params?: Readonly<Record<string, string | number>>) => string,
  student: ClassStudent,
) {
  const kinds: StudentTestKind[] = ['molecule', 'topic', 'ai']
  for (const kind of kinds) {
    const last = lastAttemptForKind(student, kind)
    if (last) {
      return t('learn.classRoster.lastScoreKind', {
        score: String(last.score),
        total: String(last.total),
        kind: t(
          kind === 'molecule'
            ? 'learn.studentStats.kind.molecule'
            : kind === 'topic'
              ? 'learn.studentStats.kind.topic'
              : 'learn.studentStats.kind.ai',
        ),
      })
    }
  }
  return t('learn.classRoster.noAttempts')
}

export function LearnClassRosterPanel({ sectionId, grade, chapter, section }: Props) {
  const { t } = useT()
  const [roster, setRoster] = useState<ClassRoster>(() => readClassRoster(sectionId))
  const [className, setClassName] = useState(roster.className)
  const [paste, setPaste] = useState('')
  const [statsStudentId, setStatsStudentId] = useState<string | null>(null)

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
  const statsStudent = statsStudentId
    ? roster.students.find((s) => s.id === statsStudentId) ?? null
    : null

  const onImport = () => {
    const names = parsePastedNames(paste)
    if (names.length === 0) return
    importClassNames(sectionId, className, names)
    setPaste('')
  }

  return (
    <div className={styles.panel}>
      <LearnStudentTestHub
        grade={grade}
        chapter={chapter}
        section={section}
        rosterSectionId={sectionId}
      />

      <div className={styles.head}>
        <h2 className={styles.title}>{t('learn.classRoster.title')}</h2>
        <p className={styles.lead}>{t('learn.classRoster.leadExtended')}</p>
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
              <li key={student.id} className={styles.studentRow}>
                <button
                  type="button"
                  className={`${styles.studentBtn} ${active ? styles.studentBtnActive : ''}`}
                  onClick={() => setActiveStudent(sectionId, student.id)}
                >
                  <span className={styles.studentName}>{student.name}</span>
                  <span className={styles.studentScore}>{attemptLabel(t, student)}</span>
                </button>
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
          sectionTitle={t(section.titleKey)}
          onClose={() => setStatsStudentId(null)}
          onSelect={() => {
            setActiveStudent(sectionId, statsStudent.id)
            setStatsStudentId(null)
          }}
        />
      ) : null}
    </div>
  )
}
