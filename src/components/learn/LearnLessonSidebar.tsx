import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
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
import { StudioEmptyState } from './studio/StudioKit'
import kit from './studio/StudioKit.module.css'
import styles from './LearnLessonSidebar.module.css'

type SidebarTab = 'test' | 'class' | 'tools'

type Props = {
  grade: LearnGrade
  chapter: LearnChapter
  section: LearnSection
  rosterSectionId: string
  fromBook?: boolean
}

const MASTERY_KEY: Record<RosterMasteryLevel, MessageKey> = {
  strong: 'learn.studentStats.mastery.strong',
  good: 'learn.studentStats.mastery.good',
  needsWork: 'learn.studentStats.mastery.needsWork',
  none: 'learn.studentStats.mastery.none',
}

const TABS: { id: SidebarTab; label: MessageKey; full: MessageKey; icon: LearnSidebarIconName }[] = [
  { id: 'test', label: 'learn.studio.cockpit.tabTest', full: 'learn.studentTest.title', icon: 'test' },
  { id: 'class', label: 'learn.studio.cockpit.tabClass', full: 'learn.classRoster.title', icon: 'class' },
  { id: 'tools', label: 'learn.studio.cockpit.tabTools', full: 'learn.lesson.tabTools', icon: 'tools' },
]

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
  const uid = useId()
  const [tab, setTab] = useState<SidebarTab>('test')
  const [roster, setRoster] = useState<ClassRoster>(() => readClassRoster(rosterSectionId))
  const [paste, setPaste] = useState('')
  const [query, setQuery] = useState('')
  const [statsStudentId, setStatsStudentId] = useState<string | null>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

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

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = TABS.findIndex((x) => x.id === tab)
    let next = -1
    if (e.key === 'ArrowRight') next = (idx + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    if (next < 0) return
    e.preventDefault()
    setTab(TABS[next].id)
    tabRefs.current[next]?.focus()
  }

  /** Быстрое действие в списке: выбрать ученика и перейти к тесту */
  const testStudent = (id: string) => {
    setActiveStudent(rosterSectionId, id)
    setTab('test')
  }

  const studentCount = roster.students.length
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredStudents = normalizedQuery
    ? roster.students.filter((s) => s.name.toLocaleLowerCase().includes(normalizedQuery))
    : roster.students

  return (
    <aside className={styles.sidebar} aria-label={t('learn.lesson.sidebar')}>
      <div className={styles.tabs} role="tablist" aria-label={t('learn.lesson.sidebar')} onKeyDown={onTabKey}>
        {TABS.map(({ id, label, full, icon }, i) => {
          const on = tab === id
          return (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              id={`${uid}-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`${uid}-pane-${id}`}
              tabIndex={on ? 0 : -1}
              title={t(full)}
              className={`${on ? kit.tabActive : ''} ${styles.tab}`}
              onClick={() => setTab(id)}
            >
              <span className={styles.tabIcon} aria-hidden="true">
                <LearnSidebarIcon name={icon} size={16} />
              </span>
              <span className={styles.tabLabel}>{t(label)}</span>
              {id === 'class' && studentCount > 0 ? (
                <span className={`${kit.badge} ${styles.tabCount}`}>{studentCount}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className={`${kit.scrollArea} ${styles.body}`}>
        {tab === 'test' ? (
          <div
            id={`${uid}-pane-test`}
            role="tabpanel"
            aria-labelledby={`${uid}-tab-test`}
            className={styles.pane}
          >
            <LearnStudentTestHub
              grade={grade}
              chapter={chapter}
              section={section}
              rosterSectionId={rosterSectionId}
              compact
              showMoleculeHint={false}
              onPickStudent={() => setTab('class')}
            />
          </div>
        ) : null}

        {tab === 'class' ? (
          <div
            id={`${uid}-pane-class`}
            role="tabpanel"
            aria-labelledby={`${uid}-tab-class`}
            className={styles.pane}
          >
            <div className={styles.statRow}>
              <span className={kit.chipTone}>
                <LearnSidebarIcon name="users" size={13} />
                {t('learn.classRoster.count', { n: String(studentCount) })}
              </span>
              {avg !== null ? (
                <span className={kit.chip}>
                  <LearnSidebarIcon name="chart" size={13} />
                  {t('learn.classRoster.classAvg', { pct: String(avg) })}
                </span>
              ) : null}
            </div>

            <section className={styles.importCard} aria-labelledby={`${uid}-import`}>
              <header className={styles.importHead}>
                <span className={`${kit.iconTile} ${kit.iconTileSoft}`} aria-hidden="true">
                  <LearnSidebarIcon name="upload" size={15} />
                </span>
                <span className={styles.importText}>
                  <label id={`${uid}-import`} className={styles.importTitle} htmlFor={`${uid}-paste`}>
                    {t('learn.classRoster.pasteLabel')}
                  </label>
                  <span className={styles.importHint}>{t('learn.studio.cockpit.importHint')}</span>
                </span>
              </header>
              <textarea
                id={`${uid}-paste`}
                className={`${kit.input} ${styles.importInput}`}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={t('learn.classRoster.pastePh')}
                rows={2}
              />
              <button
                type="button"
                className={`${kit.btn} ${styles.importBtn}`}
                onClick={onImport}
                disabled={parsePastedNames(paste).length === 0}
              >
                <LearnSidebarIcon name="upload" size={15} />
                <span>{t('learn.classRoster.import')}</span>
              </button>
            </section>

            {studentCount === 0 ? (
              <StudioEmptyState
                icon="users"
                title={t('learn.studio.cockpit.noStudentsTitle')}
                lead={t('learn.classRoster.empty')}
              />
            ) : (
              <>
                {studentCount > 5 ? (
                  <label className={kit.searchField}>
                    <LearnSidebarIcon name="search" size={15} />
                    <input
                      type="search"
                      className={kit.input}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t('learn.studio.cockpit.searchStudent')}
                      aria-label={t('catalog.search')}
                    />
                  </label>
                ) : null}
                {filteredStudents.length === 0 ? (
                  <p className={styles.noMatch}>
                    <LearnSidebarIcon name="search" size={14} />
                    {t('learn.studio.cockpit.searchNone')}
                  </p>
                ) : (
                  <ul className={styles.list}>
                    {filteredStudents.map((student) => {
                      const active = roster.activeStudentId === student.id
                      const rating = computeStudentRating(student)
                      const level = computeStudentMastery(student).masteryLevel
                      const showRating = student.attempts.length > 0 || rating.conspectBonus > 0
                      return (
                        <li key={student.id} className={active ? styles.rowActive : styles.row}>
                          <button
                            type="button"
                            className={styles.rowMain}
                            aria-pressed={active}
                            title={active ? t('learn.studio.cockpit.rowSelected') : student.name}
                            onClick={() => setActiveStudent(rosterSectionId, student.id)}
                          >
                            <LearnRosterAvatar
                              name={student.name}
                              status={level}
                              statusLabel={t(MASTERY_KEY[level])}
                            />
                            <span className={styles.rowText}>
                              <span className={styles.rowName}>{student.name}</span>
                              <span className={styles.rowMeta}>{attemptLabel(t, student)}</span>
                            </span>
                            {showRating ? (
                              <span className={styles.rowRating} title={t('learn.studentStats.open')}>
                                {rating.score}
                              </span>
                            ) : null}
                            {active ? (
                              <span className={styles.rowCheck} aria-hidden="true">
                                <LearnSidebarIcon name="check" size={12} />
                              </span>
                            ) : null}
                          </button>
                          <div className={styles.rowActions}>
                            <button
                              type="button"
                              className={`${kit.iconBtn} ${styles.actionBtn} ${styles.actionPrimary}`}
                              title={t('learn.studio.cockpit.rowTest')}
                              aria-label={`${t('learn.studio.cockpit.rowTest')}: ${student.name}`}
                              onClick={() => testStudent(student.id)}
                            >
                              <LearnSidebarIcon name="play" size={15} />
                            </button>
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
                              className={`${kit.iconBtn} ${styles.actionBtn}`}
                              title={t('learn.studentStats.open')}
                              aria-label={`${t('learn.studentStats.open')}: ${student.name}`}
                              onClick={() => setStatsStudentId(student.id)}
                            >
                              <LearnSidebarIcon name="chart" size={15} />
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
          <div
            id={`${uid}-pane-tools`}
            role="tabpanel"
            aria-labelledby={`${uid}-tab-tools`}
            className={styles.pane}
          >
            <LearnSectionToolsCompact
              grade={grade}
              chapter={chapter}
              section={section}
              fromBook={fromBook}
            />
          </div>
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
