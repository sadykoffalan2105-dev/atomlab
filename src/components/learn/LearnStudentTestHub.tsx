import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { LearnChapter, LearnGrade, LearnSection } from '../../types/learn'
import {
  CLASS_ROSTER_CHANGED,
  getActiveStudent,
  importClassNames,
  readClassRoster,
  setActiveStudent as storeActiveStudent,
  type ClassRoster,
  type ClassStudent,
} from '../../learn/learnClassRosterStorage'
import { studentTestMaxQuestions } from '../../learn/studentTestEngine'
import type { StudentTestLength } from '../../learn/studentTestScoring'
import { computeStudentMastery } from '../../learn/learnStudentStats'
import { useT, type MessageKey } from '../../i18n/useT'
import { FormulaLearningPanel } from './FormulaLearningPanel'
import { ChemProblemTutor } from './ChemProblemTutor'
import { LearnOralExamPanel } from './LearnOralExamPanel'
import { LearnStudentTest } from './LearnStudentTest'
import { LearnWrittenExamPanel } from './LearnWrittenExamPanel'
import { ValencyBalanceTutor } from './ValencyBalanceTutor'
import { LearnRosterAvatar, type RosterMasteryLevel } from './LearnRosterAvatar'
import { LearnSidebarIcon, type LearnSidebarIconName } from './LearnSidebarIcon'
import { StudioEmptyState } from './studio/StudioKit'
import kit from './studio/StudioKit.module.css'
import styles from './TeacherExamShell.module.css'
import cockpit from './LearnStudentTestHub.module.css'

type ExamMode = 'mcq' | 'oral' | 'written' | 'balance' | 'formulas' | 'problems'

type Props = {
  grade: LearnGrade
  chapter: LearnChapter
  section: LearnSection
  rosterSectionId: string
  requireStudent?: boolean
  showMoleculeHint?: boolean
  compact?: boolean
  /** Открыть список класса (например, переключить вкладку боковой панели) */
  onPickStudent?: () => void
}

const MODE_HINT: Record<ExamMode, MessageKey> = {
  mcq: 'learn.teacherExam.mcqHint',
  oral: 'learn.teacherExam.oralHint',
  written: 'learn.teacherExam.writtenHint',
  balance: 'learn.teacherExam.balanceHint',
  formulas: 'learn.teacherExam.formulasHint',
  problems: 'learn.teacherExam.problemsHint',
}

const MODE_DESC: Record<ExamMode, MessageKey> = {
  mcq: 'learn.studio.cockpit.mode.mcq.desc',
  oral: 'learn.studio.cockpit.mode.oral.desc',
  written: 'learn.studio.cockpit.mode.written.desc',
  balance: 'learn.studio.cockpit.mode.balance.desc',
  formulas: 'learn.studio.cockpit.mode.formulas.desc',
  problems: 'learn.studio.cockpit.mode.problems.desc',
}

const MODE_ICON: Record<ExamMode, LearnSidebarIconName> = {
  mcq: 'mcq',
  oral: 'oral',
  written: 'written',
  balance: 'balance',
  formulas: 'formulas',
  problems: 'problems',
}

const MODE_TONE: Record<ExamMode, string | undefined> = {
  mcq: styles.toneMcq,
  oral: styles.toneOral,
  written: styles.toneWritten,
  balance: styles.toneBalance,
  formulas: styles.toneFormulas,
  problems: styles.toneProblems,
}

/** Тон карточки формата в кабинете (переопределяет --studio-tone внутри карточки). */
const COCKPIT_TONE: Record<ExamMode, string> = {
  mcq: cockpit.toneMcq,
  oral: cockpit.toneOral,
  written: cockpit.toneWritten,
  balance: cockpit.toneBalance,
  formulas: cockpit.toneFormulas,
  problems: cockpit.toneProblems,
}

const START_KEY: Partial<Record<ExamMode, MessageKey>> = {
  mcq: 'learn.studentTest.start',
  oral: 'learn.teacherExam.startOral',
  written: 'learn.teacherExam.startWritten',
}

/** Форматы, где результат пишется в статистику ученика (нужен выбранный ученик). */
const MODE_NEEDS_STUDENT: Record<ExamMode, boolean> = {
  mcq: true,
  oral: true,
  written: true,
  balance: false,
  formulas: false,
  problems: false,
}

const MASTERY_KEY: Record<RosterMasteryLevel, MessageKey> = {
  strong: 'learn.studentStats.mastery.strong',
  good: 'learn.studentStats.mastery.good',
  needsWork: 'learn.studentStats.mastery.needsWork',
  none: 'learn.studentStats.mastery.none',
}

const MODES: ExamMode[] = ['mcq', 'oral', 'written', 'balance', 'formulas', 'problems']

/** Сколько учеников показываем чипами без поиска */
const CHIP_LIMIT = 12
/** С какого размера класса показываем поле поиска */
const SEARCH_FROM = 7
/** Короткая «подготовка» перед открытием теста — тактильный отклик кнопки старта */
const START_DELAY_MS = 220

type StepState = 'done' | 'current' | 'idle'

function modeLabelKey(m: ExamMode): MessageKey {
  if (m === 'mcq') return 'learn.teacherExam.modeMcq'
  if (m === 'oral') return 'learn.teacherExam.modeOral'
  if (m === 'written') return 'learn.teacherExam.modeWritten'
  if (m === 'balance') return 'learn.teacherExam.modeBalance'
  if (m === 'formulas') return 'learn.teacherExam.modeFormulas'
  return 'learn.teacherExam.modeProblems'
}

function lastAttemptAt(student: ClassStudent): number {
  let max = 0
  for (const a of student.attempts) {
    const ts = Date.parse(a.at)
    if (Number.isFinite(ts) && ts > max) max = ts
  }
  return max
}

export function LearnStudentTestHub(props: Props) {
  if (props.compact) return <CockpitTestHub {...props} />
  return <ClassicTestHub {...props} />
}

/* ————————————————————————————————————————————————————————————————
 * Кабинет учителя (compact): «кто отвечает» → «формат» → настройка → старт
 * ———————————————————————————————————————————————————————————————— */

function CockpitTestHub({
  grade,
  chapter,
  section,
  rosterSectionId,
  requireStudent = true,
  onPickStudent,
}: Props) {
  const { t } = useT()
  const uid = useId()
  const [mode, setMode] = useState<ExamMode>('mcq')
  const [roster, setRoster] = useState<ClassRoster>(() => readClassRoster(rosterSectionId))
  const [query, setQuery] = useState('')
  const [newName, setNewName] = useState('')
  const [changing, setChanging] = useState(false)
  const [length, setLength] = useState<StudentTestLength>(5)
  const [starting, setStarting] = useState(false)
  const [active, setActive] = useState(false)
  const modeRefs = useRef<(HTMLButtonElement | null)[]>([])
  const startTimer = useRef<number | null>(null)

  // Смена § (другой список класса) — пересчитываем состав прямо в рендере,
  // чтобы не дёргать setState внутри эффекта (каскадные рендеры).
  const [rosterKey, setRosterKey] = useState(rosterSectionId)
  if (rosterKey !== rosterSectionId) {
    setRosterKey(rosterSectionId)
    setRoster(readClassRoster(rosterSectionId))
  }

  useEffect(() => {
    const onChange = () => setRoster(readClassRoster(rosterSectionId))
    window.addEventListener(CLASS_ROSTER_CHANGED, onChange)
    return () => window.removeEventListener(CLASS_ROSTER_CHANGED, onChange)
  }, [rosterSectionId])

  useEffect(
    () => () => {
      if (startTimer.current !== null) window.clearTimeout(startTimer.current)
    },
    [],
  )

  const activeStudent = useMemo(
    () => roster.students.find((s) => s.id === roster.activeStudentId) ?? null,
    [roster],
  )
  const studentCount = roster.students.length
  const maxPool = studentTestMaxQuestions(grade.id, chapter.id, section.id)
  const hasQuestions = maxPool >= 3
  const needsStudent = requireStudent && MODE_NEEDS_STUDENT[mode]
  const testDisabled = requireStudent && !activeStudent
  const canStart = hasQuestions && !(needsStudent && !activeStudent)
  const effectiveLength: StudentTestLength = length === 10 && maxPool < 10 ? 5 : length

  /* Недавно отвечавшие — первыми */
  const ordered = useMemo(() => {
    const withTs = roster.students.map((s, i) => ({ s, i, ts: lastAttemptAt(s) }))
    withTs.sort((a, b) => (b.ts !== a.ts ? b.ts - a.ts : a.i - b.i))
    return withTs
  }, [roster.students])

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visible = useMemo(() => {
    const list = normalizedQuery
      ? ordered.filter(({ s }) => s.name.toLocaleLowerCase().includes(normalizedQuery))
      : ordered
    return normalizedQuery ? list : list.slice(0, CHIP_LIMIT)
  }, [normalizedQuery, ordered])
  const hiddenCount = normalizedQuery ? 0 : Math.max(0, ordered.length - CHIP_LIMIT)
  const hasRecent = ordered.some((x) => x.ts > 0)

  const pickStudent = (id: string | null) => {
    storeActiveStudent(rosterSectionId, id)
    setChanging(false)
    setQuery('')
  }

  const addStudent = () => {
    const name = newName.trim()
    if (!name) return
    importClassNames(rosterSectionId, roster.className, [
      ...roster.students.map((s) => s.name),
      name,
    ])
    const next = readClassRoster(rosterSectionId)
    const added = next.students.find((s) => s.name.toLowerCase() === name.toLowerCase())
    if (added) storeActiveStudent(rosterSectionId, added.id)
    setNewName('')
  }

  const onModeKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = MODES.indexOf(mode)
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % MODES.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + MODES.length) % MODES.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = MODES.length - 1
    if (next < 0) return
    e.preventDefault()
    setMode(MODES[next])
    modeRefs.current[next]?.focus()
  }

  const start = () => {
    if (!canStart || starting || active) return
    setStarting(true)
    startTimer.current = window.setTimeout(() => {
      startTimer.current = null
      setStarting(false)
      setActive(true)
    }, START_DELAY_MS)
  }

  const helper: { key: MessageKey; tone: 'ok' | 'warn' | 'busy' } = starting
    ? { key: 'learn.studio.cockpit.starting', tone: 'busy' }
    : !hasQuestions
      ? { key: 'learn.studentTest.notEnough', tone: 'warn' }
      : needsStudent && !activeStudent
        ? { key: 'learn.studio.cockpit.whyNoStudent', tone: 'warn' }
        : { key: 'learn.studio.cockpit.ready', tone: 'ok' }

  const showPicker = MODE_NEEDS_STUDENT[mode]
  const pickerExpanded = !activeStudent || changing

  /* Степпер — живое состояние */
  const studentStep: StepState = activeStudent ? 'done' : needsStudent ? 'current' : 'idle'
  const steps: { key: string; label: string; sub?: string; state: StepState }[] = []
  if (MODE_NEEDS_STUDENT[mode]) {
    steps.push({
      key: 'student',
      label: t('learn.studio.cockpit.stepStudent'),
      sub: activeStudent?.name,
      state: studentStep,
    })
  }
  steps.push({ key: 'mode', label: t('learn.studio.cockpit.stepMode'), sub: t(modeLabelKey(mode)), state: 'done' })
  if (mode === 'mcq') {
    steps.push({
      key: 'count',
      label: t('learn.studio.cockpit.stepCount'),
      sub: String(effectiveLength),
      state: hasQuestions ? 'done' : 'idle',
    })
  }
  const startState: StepState = active ? 'done' : canStart && studentStep !== 'current' ? 'current' : 'idle'
  steps.push({
    key: 'start',
    label: START_KEY[mode] ? t(START_KEY[mode]) : t('learn.studio.cockpit.stepStart'),
    state: startState,
  })
  if (START_KEY[mode]) {
    steps.push({ key: 'result', label: t('learn.studentTest.resultsTitle'), state: 'idle' })
  }

  return (
    <div className={cockpit.hub}>
      {/* ——— Кто отвечает ——— */}
      <section className={cockpit.block} aria-labelledby={`${uid}-who`}>
        <header className={cockpit.blockHead}>
          <span className={`${kit.iconTile} ${kit.iconTileSoft}`} aria-hidden="true">
            <LearnSidebarIcon name="user" size={15} />
          </span>
          <h4 id={`${uid}-who`} className={cockpit.blockTitle}>
            {t('learn.studio.cockpit.who')}
          </h4>
          {studentCount > 0 ? (
            <button
              type="button"
              className={cockpit.blockLink}
              onClick={onPickStudent}
              disabled={!onPickStudent}
            >
              <LearnSidebarIcon name="users" size={14} />
              <span>{t('learn.classRoster.count', { n: String(studentCount) })}</span>
            </button>
          ) : null}
        </header>

        {!showPicker ? (
          <p className={cockpit.note}>
            <LearnSidebarIcon name="info" size={14} />
            <span>{t('learn.studio.cockpit.noStudentNeeded')}</span>
          </p>
        ) : studentCount === 0 ? (
          <StudioEmptyState
            icon="users"
            className={cockpit.empty}
            title={t('learn.studio.cockpit.noStudentsTitle')}
            lead={t('learn.classRoster.empty')}
            actions={
              <>
                <form
                  className={cockpit.addForm}
                  onSubmit={(e) => {
                    e.preventDefault()
                    addStudent()
                  }}
                >
                  <input
                    className={`${kit.input} ${cockpit.addInput}`}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t('learn.studio.cockpit.addStudentPh')}
                    aria-label={t('learn.studio.cockpit.addStudent')}
                    autoComplete="off"
                  />
                  <button type="submit" className={kit.btn} disabled={!newName.trim()}>
                    <LearnSidebarIcon name="plus" size={15} />
                    <span>{t('learn.studio.cockpit.add')}</span>
                  </button>
                </form>
                {onPickStudent ? (
                  <button type="button" className={kit.btnGhost} onClick={onPickStudent}>
                    <LearnSidebarIcon name="upload" size={15} />
                    <span>{t('learn.classRoster.import')}</span>
                  </button>
                ) : null}
              </>
            }
          />
        ) : (
          <>
            {activeStudent ? (
              <div className={cockpit.selected} data-changing={changing ? '1' : undefined}>
                <LearnRosterAvatar
                  name={activeStudent.name}
                  size="md"
                  status={computeStudentMastery(activeStudent).masteryLevel}
                  statusLabel={t(MASTERY_KEY[computeStudentMastery(activeStudent).masteryLevel])}
                />
                <span className={cockpit.selectedText}>
                  <span className={cockpit.selectedLabel}>{t('learn.studio.cockpit.selected')}</span>
                  <span className={cockpit.selectedName} title={activeStudent.name}>
                    {activeStudent.name}
                  </span>
                </span>
                <span className={cockpit.selectedActions}>
                  <button
                    type="button"
                    className={`${kit.btnGhost} ${cockpit.smallBtn}`}
                    aria-pressed={changing}
                    aria-expanded={changing}
                    onClick={() => setChanging((v) => !v)}
                  >
                    {t('learn.studio.cockpit.change')}
                  </button>
                  <button
                    type="button"
                    className={kit.iconBtn}
                    title={t('learn.studio.cockpit.clear')}
                    aria-label={t('learn.studio.cockpit.clear')}
                    onClick={() => pickStudent(null)}
                  >
                    <LearnSidebarIcon name="close" size={15} />
                  </button>
                </span>
              </div>
            ) : null}

            {pickerExpanded ? (
              <div className={cockpit.picker}>
                {studentCount >= SEARCH_FROM ? (
                  <label className={kit.searchField}>
                    <LearnSidebarIcon name="search" size={15} />
                    <input
                      type="search"
                      className={kit.input}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t('learn.studio.cockpit.searchStudent')}
                      aria-label={t('learn.studio.cockpit.searchStudent')}
                    />
                  </label>
                ) : null}
                {hasRecent && !normalizedQuery ? (
                  <p className={cockpit.pickerCaption}>
                    <LearnSidebarIcon name="history" size={13} />
                    <span>{t('learn.studio.cockpit.recent')}</span>
                  </p>
                ) : null}
                {visible.length === 0 ? (
                  <p className={cockpit.note}>
                    <LearnSidebarIcon name="search" size={14} />
                    <span>{t('learn.studio.cockpit.searchNone')}</span>
                  </p>
                ) : (
                  <ul className={cockpit.chips} aria-label={t('learn.classRoster.title')}>
                    {visible.map(({ s, ts }) => {
                      const on = s.id === roster.activeStudentId
                      const level = computeStudentMastery(s).masteryLevel
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            className={on ? cockpit.chipOn : cockpit.chip}
                            aria-pressed={on}
                            title={s.name}
                            onClick={() => pickStudent(s.id)}
                          >
                            <LearnRosterAvatar
                              name={s.name}
                              size="sm"
                              status={level}
                              statusLabel={t(MASTERY_KEY[level])}
                            />
                            <span className={cockpit.chipName}>{s.name}</span>
                            {ts > 0 && !on ? (
                              <LearnSidebarIcon name="history" size={12} className={cockpit.chipMeta} />
                            ) : null}
                            {on ? <LearnSidebarIcon name="check" size={13} className={cockpit.chipMeta} /> : null}
                          </button>
                        </li>
                      )
                    })}
                    {hiddenCount > 0 && onPickStudent ? (
                      <li>
                        <button type="button" className={cockpit.chipMore} onClick={onPickStudent}>
                          +{hiddenCount}
                          <LearnSidebarIcon name="arrowRight" size={13} />
                        </button>
                      </li>
                    ) : null}
                  </ul>
                )}
              </div>
            ) : null}

            {!requireStudent && !activeStudent ? (
              <p className={cockpit.note}>
                <LearnSidebarIcon name="info" size={14} />
                <span>{t('learn.studentTestHub.classMode')}</span>
              </p>
            ) : null}
          </>
        )}
      </section>

      {/* ——— Формат проверки ——— */}
      <section className={cockpit.block} aria-labelledby={`${uid}-how`}>
        <header className={cockpit.blockHead}>
          <span className={`${kit.iconTile} ${kit.iconTileSoft}`} aria-hidden="true">
            <LearnSidebarIcon name="test" size={15} />
          </span>
          <h4 id={`${uid}-how`} className={cockpit.blockTitle}>
            {t('learn.teacherExam.modeLabel')}
          </h4>
          <span className={cockpit.kbdHint} title={t('learn.studio.cockpit.kbdHint')}>
            <kbd className={kit.kbd}>←</kbd>
            <kbd className={kit.kbd}>→</kbd>
          </span>
        </header>

        <div
          className={cockpit.modeGrid}
          role="radiogroup"
          aria-label={t('learn.teacherExam.modeLabel')}
          onKeyDown={onModeKey}
        >
          {MODES.map((m, i) => {
            const on = mode === m
            return (
              <button
                key={m}
                ref={(el) => {
                  modeRefs.current[i] = el
                }}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                className={`${on ? kit.cardSelected : kit.cardInteractive} ${cockpit.modeCard} ${COCKPIT_TONE[m]}`}
                title={t(MODE_HINT[m])}
                onClick={() => setMode(m)}
              >
                <span className={`${kit.iconTile} ${on ? '' : kit.iconTileSoft} ${cockpit.modeIcon}`} aria-hidden="true">
                  <LearnSidebarIcon name={MODE_ICON[m]} size={17} />
                </span>
                <span className={cockpit.modeText}>
                  <span className={cockpit.modeName}>{t(modeLabelKey(m))}</span>
                  <span className={cockpit.modeDesc}>{t(MODE_DESC[m])}</span>
                </span>
                {on ? (
                  <span className={kit.cardCheck} aria-hidden="true">
                    <LearnSidebarIcon name="check" size={12} />
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </section>

      {/* ——— Настройка и старт ——— */}
      {mode === 'mcq' ? (
        <section className={`${cockpit.block} ${cockpit.setup}`} aria-label={t('learn.studentTest.title')}>
          <div className={cockpit.setupRow}>
            <div className={kit.field}>
              <span id={`${uid}-count`}>{t('learn.studentTest.pickCount')}</span>
              <div className={kit.segmented} role="group" aria-labelledby={`${uid}-count`}>
                <button
                  type="button"
                  className={`${kit.segmentedItem} ${length === 5 ? kit.segmentedItemActive : ''}`}
                  aria-pressed={length === 5}
                  onClick={() => setLength(5)}
                >
                  {t('learn.studentTest.questions5')}
                </button>
                <button
                  type="button"
                  className={`${kit.segmentedItem} ${length === 10 ? kit.segmentedItemActive : ''}`}
                  aria-pressed={length === 10}
                  onClick={() => setLength(10)}
                  disabled={maxPool < 10}
                  title={maxPool < 10 ? t('learn.studentTest.poolHint', { n: maxPool }) : undefined}
                >
                  {t('learn.studentTest.questions10')}
                </button>
              </div>
            </div>
            <div className={cockpit.poolStat} title={t('learn.studentTest.poolHint', { n: maxPool })}>
              <span className={cockpit.poolValue}>{maxPool}</span>
              <span className={cockpit.poolLabel}>{t('learn.studio.cockpit.poolStat')}</span>
            </div>
          </div>

          <button
            type="button"
            className={`${kit.btnPrimary} ${cockpit.startBtn}`}
            onClick={start}
            disabled={!canStart || starting}
            aria-busy={starting || undefined}
            aria-describedby={`${uid}-why`}
          >
            {starting ? (
              <span className={cockpit.spinner} aria-hidden="true" />
            ) : (
              <LearnSidebarIcon name={canStart ? 'play' : 'lock'} size={18} />
            )}
            <span>{t('learn.studentTest.start')}</span>
          </button>
          <p id={`${uid}-why`} className={cockpit.helper} data-tone={helper.tone} role="status" aria-live="polite">
            <LearnSidebarIcon
              name={helper.tone === 'ok' ? 'check' : helper.tone === 'busy' ? 'sparkle' : 'lock'}
              size={14}
            />
            <span>{t(helper.key)}</span>
          </p>

          <LearnStudentTest
            grade={grade}
            chapter={chapter}
            section={section}
            rosterSectionId={rosterSectionId}
            testKind="topic"
            variant="default"
            external={{ length: effectiveLength, active, onClose: () => setActive(false) }}
          />
        </section>
      ) : null}

      {mode === 'oral' ? (
        <div className={cockpit.embedded}>
          <LearnOralExamPanel
            grade={grade}
            chapter={chapter}
            section={section}
            rosterSectionId={rosterSectionId}
            disabled={testDisabled}
            embedded
          />
        </div>
      ) : null}

      {mode === 'written' ? (
        <div className={cockpit.embedded}>
          <LearnWrittenExamPanel
            grade={grade}
            chapter={chapter}
            section={section}
            rosterSectionId={rosterSectionId}
            disabled={testDisabled}
            embedded
          />
        </div>
      ) : null}

      {mode === 'balance' ? (
        <div className={cockpit.embedded}>
          <ValencyBalanceTutor gradeId={grade.id} chapterId={chapter.id} sectionId={section.id} embedded />
        </div>
      ) : null}

      {mode === 'formulas' ? (
        <div className={cockpit.embedded}>
          <FormulaLearningPanel embedded />
        </div>
      ) : null}

      {mode === 'problems' ? (
        <div className={cockpit.embedded}>
          <ChemProblemTutor embedded />
        </div>
      ) : null}

      {/* ——— Проверка знаний: живой степпер ——— */}
      <section className={`${cockpit.block} ${cockpit.stepsBlock}`} aria-labelledby={`${uid}-steps`}>
        <header className={cockpit.blockHead}>
          <span className={`${kit.iconTile} ${kit.iconTileSoft}`} aria-hidden="true">
            <LearnSidebarIcon name="chart" size={15} />
          </span>
          <h4 id={`${uid}-steps`} className={cockpit.blockTitle}>
            {t('learn.teacherExam.hubTitle')}
          </h4>
        </header>
        <ol className={kit.stepper}>
          {steps.map((step) => (
            <li
              key={step.key}
              className={`${kit.step} ${step.state === 'done' ? kit.stepDone : step.state === 'current' ? kit.stepActive : ''}`}
              aria-current={step.state === 'current' ? 'step' : undefined}
            >
              <span className={cockpit.stepText}>
                <span>{step.label}</span>
                {step.sub ? <span className={cockpit.stepSub}>{step.sub}</span> : null}
              </span>
            </li>
          ))}
        </ol>
        {mode === 'mcq' ? (
          <p className={cockpit.stepsNote}>{t('learn.studentTest.scoringHint', { max: 5 })}</p>
        ) : null}
      </section>
    </div>
  )
}

/* ————————————————————————————————————————————————————————————————
 * Классический хаб (страница учебника и другие полноразмерные места)
 * ———————————————————————————————————————————————————————————————— */

function ClassicTestHub({
  grade,
  chapter,
  section,
  rosterSectionId,
  requireStudent = true,
  showMoleculeHint = true,
  onPickStudent,
}: Props) {
  const { t } = useT()
  const [mode, setMode] = useState<ExamMode>('mcq')
  const [activeStudent, setActiveStudent] = useState<ClassStudent | null>(() =>
    getActiveStudent(rosterSectionId),
  )

  const reload = useCallback(() => {
    setActiveStudent(getActiveStudent(rosterSectionId))
  }, [rosterSectionId])

  useEffect(() => {
    reload()
    const onChange = () => reload()
    window.addEventListener(CLASS_ROSTER_CHANGED, onChange)
    return () => window.removeEventListener(CLASS_ROSTER_CHANGED, onChange)
  }, [reload])

  const testDisabled = requireStudent && !activeStudent

  return (
    <div className={styles.hub}>
      <div className={styles.head}>
        <span className={styles.badge}>
          <LearnSidebarIcon name="sparkle" size={12} />
          {t('learn.teacherExam.hubBadge')}
        </span>
        <h3 className={styles.title}>{t('learn.teacherExam.hubTitle')}</h3>
        <p className={styles.lead}>{t('learn.teacherExam.hubLead')}</p>
      </div>

      <div className={styles.modeRow} role="tablist" aria-label={t('learn.teacherExam.modeLabel')}>
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={`${mode === m ? styles.modeBtnActive : styles.modeBtn} ${MODE_TONE[m] ?? ''}`}
            onClick={() => setMode(m)}
          >
            <span className={styles.modeIcon}>
              <LearnSidebarIcon name={MODE_ICON[m]} size={18} />
            </span>
            <span className={styles.modeName}>{t(modeLabelKey(m))}</span>
            {mode === m ? (
              <span className={styles.modeCheck} aria-hidden="true">
                <LearnSidebarIcon name="check" size={11} />
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <p className={`${styles.featureHint} ${MODE_TONE[mode] ?? ''}`}>
        <LearnSidebarIcon name="sparkle" size={16} className={styles.featureHintIcon} />
        <span>{t(MODE_HINT[mode])}</span>
      </p>

      {showMoleculeHint && mode === 'mcq' ? (
        <p className={styles.featureHint}>
          <LearnSidebarIcon name="info" size={16} className={styles.featureHintIcon} />
          <span>{t('learn.studentTestHub.moleculeHint')}</span>
        </p>
      ) : null}

      {activeStudent ? (
        <div className={styles.studentLine}>
          <LearnRosterAvatar name={activeStudent.name} size="sm" />
          <span className={styles.studentLineText}>
            {t('learn.molecules.structure.testForStudent', { name: activeStudent.name })}
          </span>
          {onPickStudent ? (
            <button type="button" className={styles.studentLink} onClick={onPickStudent}>
              <LearnSidebarIcon name="users" size={14} />
              <span>{t('learn.classRoster.title')}</span>
            </button>
          ) : null}
        </div>
      ) : (
        <div
          className={requireStudent ? styles.studentHint : styles.studentHintOptional}
          role="note"
        >
          <span className={styles.calloutIcon}>
            <LearnSidebarIcon name="info" size={16} />
          </span>
          <div className={styles.calloutBody}>
            <p className={styles.calloutText}>
              {requireStudent
                ? t('learn.molecules.structure.testNoStudent')
                : t('learn.studentTestHub.classMode')}
            </p>
            {onPickStudent ? (
              <button type="button" className={styles.calloutBtn} onClick={onPickStudent}>
                <span>{t('learn.classRoster.title')}</span>
                <LearnSidebarIcon name="arrowRight" size={14} />
              </button>
            ) : null}
          </div>
        </div>
      )}

      {mode === 'mcq' ? (
        <LearnStudentTest
          grade={grade}
          chapter={chapter}
          section={section}
          rosterSectionId={rosterSectionId}
          testKind="topic"
          variant="default"
          disabled={testDisabled}
          embedded
        />
      ) : null}

      {mode === 'oral' ? (
        <LearnOralExamPanel
          grade={grade}
          chapter={chapter}
          section={section}
          rosterSectionId={rosterSectionId}
          disabled={testDisabled}
          embedded
        />
      ) : null}

      {mode === 'written' ? (
        <LearnWrittenExamPanel
          grade={grade}
          chapter={chapter}
          section={section}
          rosterSectionId={rosterSectionId}
          disabled={testDisabled}
          embedded
        />
      ) : null}

      {mode === 'balance' ? (
        <ValencyBalanceTutor
          gradeId={grade.id}
          chapterId={chapter.id}
          sectionId={section.id}
          embedded
        />
      ) : null}

      {mode === 'formulas' ? <FormulaLearningPanel embedded /> : null}

      {mode === 'problems' ? <ChemProblemTutor embedded /> : null}
    </div>
  )
}
