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
import { computeStudentRating } from '../../learn/learnStudentStats'
import { useT, type MessageKey } from '../../i18n/useT'
import { LearnStudentTestHub } from './LearnStudentTestHub'
import { LearnStudentStatsModal } from './LearnStudentStatsModal'
import { LearnSectionToolsCompact } from './LearnSectionToolsCompact'
import styles from './LearnLessonSidebar.module.css'

type SidebarTab = 'test' | 'class' | 'tools'

type Props = {
  grade: LearnGrade
  chapter: LearnChapter
  section: LearnSection
  rosterSectionId: string
  fromBook?: boolean
}

function attemptLabel(
  t: (key: MessageKey, params?: Readonly<Record<string, string | number>>) => string,
  student: ClassStudent,
) {
  const kinds: StudentTestKind[] = ['task', 'molecule', 'topic', 'ai']
  for (const kind of kinds) {
    const last = lastAttemptForKind(student, kind)
    if (last) {
      return t('learn.classRoster.lastScoreKind', {
        score: String(last.score),
        total: String(last.total),
        kind: t(
          kind === 'task'
            ? 'learn.studentStats.kind.task'
            : kind === 'molecule'
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

export function LearnLessonSidebar({
  grade,
  chapter,
  section,
  rosterSectionId,
  fromBook,
}: Props) {
  const { t } = useT()
  const [tab, setTab] = useState<SidebarTab>('test')
  const [roster, setRoster] = useState<ClassRoster>(() => readClassRoster(rosterSectionId))
  const [paste, setPaste] = useState('')
  const [statsStudentId, setStatsStudentId] = useState<string | null>(null)

  const reload = useCallback(() => {
    setRoster(readClassRoster(rosterSectionId))
  }, [rosterSectionId])

  useEffect(() => {
    reload()
    const onChange = () => reload()
    window.addEventListener(CLASS_ROSTER_CHANGED, onChange)
    return () => window.removeEventListener(CLASS_ROSTER_CHANGED, onChange)
  }, [reload])

  const avg = classAverageScore(rosterSectionId)
  const statsStudent = statsStudentId
    ? roster.students.find((s) => s.id === statsStudentId) ?? null
    : null

  const onImport = () => {
    const names = parsePastedNames(paste)
    if (names.length === 0) return
    importClassNames(rosterSectionId, roster.className, names)
    setPaste('')
  }

  const tabs: { id: SidebarTab; label: MessageKey }[] = [
    { id: 'test', label: 'learn.studentTest.title' },
    { id: 'class', label: 'learn.classRoster.title' },
    { id: 'tools', label: 'learn.lesson.tabTools' },
  ]

  return (
    <aside className={styles.sidebar} aria-label={t('learn.lesson.sidebar')}>
      <div className={styles.tabRow} role="tablist">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? styles.tabOn : styles.tab}
            onClick={() => setTab(id)}
          >
            {t(label)}
          </button>
        ))}
      </div>

      <div className={styles.body}>
        {tab === 'test' ? (
          <div className={styles.testPane}>
            <LearnStudentTestHub
              grade={grade}
              chapter={chapter}
              section={section}
              rosterSectionId={rosterSectionId}
              compact
              showMoleculeHint={false}
            />
          </div>
        ) : null}

        {tab === 'class' ? (
          <div className={styles.classPane}>
            <div className={styles.importRow}>
              <textarea
                className={styles.importInput}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={t('learn.classRoster.pastePh')}
                rows={1}
                aria-label={t('learn.classRoster.pasteLabel')}
              />
              <button type="button" className={styles.importBtn} onClick={onImport}>
                {t('learn.classRoster.import')}
              </button>
            </div>
            <div className={styles.statRow}>
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
              <ul className={styles.studentGrid}>
                {roster.students.map((student) => {
                  const active = roster.activeStudentId === student.id
                  const rating = computeStudentRating(student)
                  return (
                    <li key={student.id} className={styles.studentRow}>
                      <button
                        type="button"
                        className={`${styles.studentBtn} ${active ? styles.studentBtnActive : ''}`}
                        onClick={() => setActiveStudent(rosterSectionId, student.id)}
                      >
                        <span className={styles.studentName}>{student.name}</span>
                        <span className={styles.studentScore}>
                          {attemptLabel(t, student)}
                          {student.attempts.length > 0 || rating.conspectBonus > 0
                            ? ` · ${rating.score}`
                            : ''}
                        </span>
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
          </div>
        ) : null}

        {tab === 'tools' ? (
          <LearnSectionToolsCompact
            grade={grade}
            chapter={chapter}
            section={section}
            fromBook={fromBook}
          />
        ) : null}
      </div>

      {statsStudent ? (
        <LearnStudentStatsModal
          student={statsStudent}
          sectionTitle={t(section.titleKey)}
          rosterSectionId={rosterSectionId}
          gradeId={grade.id}
          chapterId={chapter.id}
          sectionId={section.id}
          className={roster.className}
          onClose={() => setStatsStudentId(null)}
          onSelect={() => {
            setActiveStudent(rosterSectionId, statsStudent.id)
            setStatsStudentId(null)
          }}
        />
      ) : null}
    </aside>
  )
}
