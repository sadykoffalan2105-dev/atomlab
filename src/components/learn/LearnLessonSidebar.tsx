import { useCallback, useEffect, useId, useState } from 'react'
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
import { computeStudentMastery, computeStudentRating } from '../../learn/learnStudentStats'
import { useT, type MessageKey } from '../../i18n/useT'
import { LearnStudentTestHub } from './LearnStudentTestHub'
import { LearnStudentStatsModal } from './LearnStudentStatsModal'
import { ClassStudentConspectBtn } from './ClassStudentConspectBtn'
import { LearnSectionToolsCompact } from './LearnSectionToolsCompact'
import { LearnRosterAvatar, type RosterMasteryLevel } from './LearnRosterAvatar'
import { LearnSidebarIcon, type LearnSidebarIconName } from './LearnSidebarIcon'
import styles from './LearnLessonSidebar.module.css'

type SidebarTab = 'test' | 'class' | 'tools'

type Props = {
  grade: LearnGrade
  chapter: LearnChapter
  section: LearnSection
  rosterSectionId: string
  fromBook?: boolean
}

/** Сколько учеников показываем в быстром выборе на вкладке теста */
const QUICK_PICK_MAX = 6

const MASTERY_KEY: Record<RosterMasteryLevel, MessageKey> = {
  strong: 'learn.studentStats.mastery.strong',
  good: 'learn.studentStats.mastery.good',
  needsWork: 'learn.studentStats.mastery.needsWork',
  none: 'learn.studentStats.mastery.none',
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

/** Небольшая иллюстрация для пустого списка класса */
function EmptyRosterArt() {
  return (
    <svg className={styles.emptyArt} viewBox="0 0 96 72" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="lsEmptyA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="lsEmptyB" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id="lsEmptyC" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="64" rx="38" ry="6" fill="rgba(91,140,255,0.14)" />
      <circle cx="24" cy="30" r="9" fill="url(#lsEmptyA)" opacity="0.85" />
      <path d="M10 58c0-9 6.3-15 14-15s14 6 14 15" fill="url(#lsEmptyA)" opacity="0.55" />
      <circle cx="72" cy="30" r="9" fill="url(#lsEmptyC)" opacity="0.85" />
      <path d="M58 58c0-9 6.3-15 14-15s14 6 14 15" fill="url(#lsEmptyC)" opacity="0.55" />
      <circle cx="48" cy="24" r="11" fill="url(#lsEmptyB)" />
      <path d="M31 60c0-11 7.6-18 17-18s17 7 17 18" fill="url(#lsEmptyB)" opacity="0.8" />
      <circle cx="80" cy="10" r="7" fill="#0b1226" stroke="rgba(148,170,230,0.45)" />
      <path d="M80 7v6M77 10h6" stroke="#e8edff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function LearnLessonSidebar({
  grade,
  chapter,
  section,
  rosterSectionId,
  fromBook,
}: Props) {
  const { t } = useT()
  const uid = useId()
  const [tab, setTab] = useState<SidebarTab>('test')
  const [roster, setRoster] = useState<ClassRoster>(() => readClassRoster(rosterSectionId))
  const [paste, setPaste] = useState('')
  const [query, setQuery] = useState('')
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

  const tabs: { id: SidebarTab; label: MessageKey; icon: LearnSidebarIconName }[] = [
    { id: 'test', label: 'learn.studentTest.title', icon: 'test' },
    { id: 'class', label: 'learn.classRoster.title', icon: 'class' },
    { id: 'tools', label: 'learn.lesson.tabTools', icon: 'tools' },
  ]

  const studentCount = roster.students.length
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredStudents = normalizedQuery
    ? roster.students.filter((s) => s.name.toLocaleLowerCase().includes(normalizedQuery))
    : roster.students

  const quickStudents = (() => {
    const list = roster.students.slice(0, QUICK_PICK_MAX)
    const active = roster.students.find((s) => s.id === roster.activeStudentId)
    if (active && !list.some((s) => s.id === active.id)) {
      list[list.length - 1] = active
    }
    return list
  })()

  const statChips = (
    <div className={styles.statRow}>
      <span className={styles.statChip}>
        <LearnSidebarIcon name="users" size={14} />
        {t('learn.classRoster.count', { n: String(studentCount) })}
      </span>
      {avg !== null ? (
        <span className={`${styles.statChip} ${styles.statChipAccent}`}>
          <LearnSidebarIcon name="chart" size={14} />
          {t('learn.classRoster.classAvg', { pct: String(avg) })}
        </span>
      ) : null}
    </div>
  )

  return (
    <aside className={styles.sidebar} aria-label={t('learn.lesson.sidebar')}>
      <div className={styles.tabRow} role="tablist">
        {tabs.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? styles.tabOn : styles.tab}
            onClick={() => setTab(id)}
          >
            <span className={styles.tabIcon}>
              <LearnSidebarIcon name={icon} size={16} />
            </span>
            <span className={styles.tabLabel}>{t(label)}</span>
            {id === 'class' && studentCount > 0 ? (
              <span className={styles.tabCount}>{studentCount}</span>
            ) : null}
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
              onPickStudent={() => setTab('class')}
            />

            <section className={styles.quickCard} aria-labelledby={`${uid}-quick`}>
              <header className={styles.quickHead}>
                <span className={styles.quickIcon}>
                  <LearnSidebarIcon name="users" size={16} />
                </span>
                <h4 id={`${uid}-quick`} className={styles.quickTitle}>
                  {t('learn.classRoster.title')}
                </h4>
                {studentCount > 0 ? (
                  <button type="button" className={styles.quickMore} onClick={() => setTab('class')}>
                    <span>{t('learn.classRoster.count', { n: String(studentCount) })}</span>
                    <LearnSidebarIcon name="arrowRight" size={14} />
                  </button>
                ) : null}
              </header>

              {studentCount === 0 ? (
                <div className={styles.emptyState}>
                  <EmptyRosterArt />
                  <p className={styles.emptyText}>{t('learn.classRoster.empty')}</p>
                  <button type="button" className={styles.ctaBtn} onClick={() => setTab('class')}>
                    <LearnSidebarIcon name="upload" size={16} />
                    <span>{t('learn.classRoster.import')}</span>
                  </button>
                </div>
              ) : (
                <ul className={styles.quickList}>
                  {quickStudents.map((student) => {
                    const active = roster.activeStudentId === student.id
                    const level = computeStudentMastery(student).masteryLevel
                    return (
                      <li key={student.id}>
                        <button
                          type="button"
                          className={active ? styles.quickRowActive : styles.quickRow}
                          aria-pressed={active}
                          onClick={() => setActiveStudent(rosterSectionId, student.id)}
                        >
                          <LearnRosterAvatar
                            name={student.name}
                            size="sm"
                            status={level}
                            statusLabel={t(MASTERY_KEY[level])}
                          />
                          <span className={styles.quickName}>{student.name}</span>
                          {active ? (
                            <span className={styles.quickCheck} aria-hidden="true">
                              <LearnSidebarIcon name="check" size={12} />
                            </span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        ) : null}

        {tab === 'class' ? (
          <div className={styles.classPane}>
            {statChips}

            <div className={styles.importCard}>
              <label className={styles.fieldLabel} htmlFor={`${uid}-paste`}>
                <LearnSidebarIcon name="upload" size={14} />
                {t('learn.classRoster.pasteLabel')}
              </label>
              <div className={styles.importRow}>
                <textarea
                  id={`${uid}-paste`}
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
            </div>

            {roster.students.length === 0 ? (
              <div className={styles.emptyState}>
                <EmptyRosterArt />
                <p className={styles.emptyText}>{t('learn.classRoster.empty')}</p>
              </div>
            ) : (
              <>
                <div className={styles.searchWrap}>
                  <LearnSidebarIcon name="search" size={16} className={styles.searchIcon} />
                  <input
                    type="search"
                    className={styles.searchInput}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('catalog.search')}
                    aria-label={t('catalog.search')}
                  />
                </div>
                {filteredStudents.length === 0 ? (
                  <p className={styles.noMatch}>
                    <LearnSidebarIcon name="search" size={14} />
                    {t('learn.classRoster.count', { n: '0' })}
                  </p>
                ) : (
                  <ul className={styles.studentGrid}>
                    {filteredStudents.map((student) => {
                      const active = roster.activeStudentId === student.id
                      const rating = computeStudentRating(student)
                      const level = computeStudentMastery(student).masteryLevel
                      const showRating = student.attempts.length > 0 || rating.conspectBonus > 0
                      return (
                        <li key={student.id} className={styles.studentRow}>
                          <button
                            type="button"
                            className={`${styles.studentBtn} ${active ? styles.studentBtnActive : ''}`}
                            aria-pressed={active}
                            onClick={() => setActiveStudent(rosterSectionId, student.id)}
                          >
                            <LearnRosterAvatar
                              name={student.name}
                              status={level}
                              statusLabel={t(MASTERY_KEY[level])}
                            />
                            <span className={styles.studentText}>
                              <span className={styles.studentName}>{student.name}</span>
                              <span className={styles.studentScore}>{attemptLabel(t, student)}</span>
                            </span>
                            {showRating ? (
                              <span className={styles.ratingChip}>{rating.score}</span>
                            ) : null}
                          </button>
                          <div className={styles.studentActions}>
                            <ClassStudentConspectBtn
                              student={student}
                              rosterSectionId={rosterSectionId}
                              sectionTitle={t(section.titleKey)}
                              gradeId={grade.id}
                              chapterId={chapter.id}
                              sectionId={section.id}
                              className={roster.className}
                              compact
                            />
                            <button
                              type="button"
                              className={styles.statsBtn}
                              title={t('learn.studentStats.open')}
                              aria-label={t('learn.studentStats.open')}
                              onClick={() => setStatsStudentId(student.id)}
                            >
                              <LearnSidebarIcon name="chart" size={16} />
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
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
