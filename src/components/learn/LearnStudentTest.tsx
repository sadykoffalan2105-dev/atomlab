import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LearnChapter, LearnGrade, LearnSection } from '../../types/learn'
import {
  getActiveStudent,
  recordStudentTestResult,
  type StudentTestKind,
} from '../../learn/learnClassRosterStorage'
import { pickStudentTestQuestions, studentTestMaxQuestions } from '../../learn/studentTestEngine'
import {
  computeStudentTestScore,
  studentTestGradeLabel,
  type StudentTestLength,
} from '../../learn/studentTestScoring'
import type { TopicQuizItem } from '../../learn/topicQuizTypes'
import { useT, type MessageKey } from '../../i18n/useT'
import { LearnSidebarIcon } from './LearnSidebarIcon'
import styles from './LearnStudentTest.module.css'

type Props = {
  grade: LearnGrade
  chapter: LearnChapter
  section: LearnSection
  rosterSectionId?: string
  testKind?: StudentTestKind
  variant?: 'default' | 'ai'
  disabled?: boolean
  embedded?: boolean
  /**
   * Внешняя настройка (кабинет учителя рисует свой выбор длины и кнопку старта):
   * компонент показывает только оверлей теста, пока `active` истинно.
   */
  external?: { length: StudentTestLength; active: boolean; onClose: () => void }
}

type Phase = 'setup' | 'running' | 'results'

function ScoreRing({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? score / max : 0
  const circumference = 283
  const offset = circumference * (1 - pct)

  return (
    <div className={styles.scoreRing}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5b8cff" />
            <stop offset="55%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#d946ef" />
          </linearGradient>
        </defs>
        <circle className={styles.scoreRingBg} cx="50" cy="50" r="45" />
        <circle
          className={styles.scoreRingFill}
          cx="50"
          cy="50"
          r="45"
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      <div className={styles.scoreValue}>
        <span className={styles.scoreNumber}>{score}</span>
        <span className={styles.scoreOf}>/ {max}</span>
      </div>
    </div>
  )
}

function StudentTestOverlay({
  grade,
  chapter,
  section,
  length,
  rosterSectionId,
  testKind,
  variant,
  onClose,
}: Props & { length: StudentTestLength; onClose: () => void }) {
  const { t, locale } = useT()
  const [phase, setPhase] = useState<Phase>('running')
  const [questions, setQuestions] = useState<TopicQuizItem[]>(() =>
    pickStudentTestQuestions(grade.id, chapter.id, section.id, length, locale),
  )
  const [index, setIndex] = useState(0)
  const [correctFlags, setCorrectFlags] = useState<boolean[]>([])
  const [wrongIds, setWrongIds] = useState<string[]>([])
  const [pick, setPick] = useState<number | null>(null)
  const [showNext, setShowNext] = useState(false)
  const [saved, setSaved] = useState(false)

  const question = questions[index] ?? null
  const total = questions.length
  const correctCount = correctFlags.filter(Boolean).length
  const score = computeStudentTestScore(correctCount, length)
  const gradeKey = studentTestGradeLabel(score, length)

  const progressPct = total > 0 ? ((phase === 'results' ? total : index) / total) * 100 : 0

  const saveResult = useCallback(
    (flags: boolean[], wrong: string[]) => {
      if (saved || !rosterSectionId) return
      const student = getActiveStudent(rosterSectionId)
      if (!student) return
      const correct = flags.filter(Boolean).length
      recordStudentTestResult(rosterSectionId, student.id, {
        kind: testKind ?? 'topic',
        score: computeStudentTestScore(correct, length),
        total: length,
        correct,
        wrongQuestionIds: wrong.length > 0 ? wrong : undefined,
      })
      setSaved(true)
    },
    [length, rosterSectionId, saved, testKind],
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

  const handlePick = useCallback(
    (idx: number) => {
      if (!question || pick !== null) return
      const ok = idx === question.correctIndex
      setPick(idx)
      setCorrectFlags((prev) => [...prev, ok])
      if (!ok) setWrongIds((prev) => [...prev, question.id])
      setShowNext(true)
    },
    [pick, question],
  )

  const handleNext = useCallback(() => {
    if (index + 1 >= total) {
      saveResult(correctFlags, wrongIds)
      setPhase('results')
      return
    }
    setIndex((i) => i + 1)
    setPick(null)
    setShowNext(false)
  }, [correctFlags, index, saveResult, total, wrongIds])

  const restart = useCallback(() => {
    setQuestions(pickStudentTestQuestions(grade.id, chapter.id, section.id, length, locale))
    setIndex(0)
    setCorrectFlags([])
    setWrongIds([])
    setPick(null)
    setShowNext(false)
    setSaved(false)
    setPhase('running')
  }, [grade.id, chapter.id, section.id, length, locale])

  const gradeClass =
    gradeKey === 'excellent'
      ? styles.gradeExcellent
      : gradeKey === 'good'
        ? styles.gradeGood
        : gradeKey === 'fair'
          ? styles.gradeFair
          : styles.gradeRetry

  const gradeMessage = t(`learn.studentTest.grade.${gradeKey}` as MessageKey)

  const status =
    pick !== null && question ? (pick === question.correctIndex ? 'ok' : 'bad') : null

  const overlayTitle =
    variant === 'ai' ? t('learn.studentTestHub.modeAi') : t('learn.studentTest.title')

  return createPortal(
    <div
      className={`${styles.overlay} ${variant === 'ai' ? styles.overlayAi : ''}`}
      role="dialog"
      aria-modal="true"
    >
      <header className={styles.toolbar}>
        <h2 className={styles.toolbarTitle}>{overlayTitle}</h2>
        {phase === 'running' ? (
          <>
            <div className={styles.progressWrap}>
              <div className={styles.progressBar} style={{ width: `${progressPct}%` }} />
            </div>
            <span className={styles.progressMeta}>
              {t('learn.studentTest.progress', { current: index + 1, total })}
            </span>
          </>
        ) : null}
        <button type="button" className={styles.closeBtn} onClick={onClose}>
          {t('learn.studentTest.close')}
        </button>
      </header>

      <main className={styles.main}>
        {phase === 'running' && question ? (
          <div key={question.id} className={styles.quizBody}>
            {variant === 'ai' ? (
              <div className={styles.aiBubble}>
                <span className={styles.aiBadge}>
                  <LearnSidebarIcon name="sparkle" size={12} />
                  {t('learn.topicQuiz.teacherHintTitle')}
                </span>
                <p className={styles.aiQuestion}>{question.question}</p>
              </div>
            ) : (
              <p className={styles.question}>{question.question}</p>
            )}
            <ul className={styles.choices}>
              {question.choices.map((choice, idx) => {
                const isCorrect = idx === question.correctIndex
                let cls = styles.choice
                if (pick !== null) {
                  if (isCorrect) cls += ` ${styles.choiceOk}`
                  else if (pick === idx) cls += ` ${styles.choiceBad}`
                }
                return (
                  <li key={idx}>
                    <button
                      type="button"
                      className={cls}
                      disabled={pick !== null}
                      onClick={() => handlePick(idx)}
                    >
                      <span className={styles.choiceLetter}>{String.fromCharCode(65 + idx)}</span>
                      <span>{choice}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {status === 'ok' ? (
              <p className={`${styles.feedback} ${styles.feedbackOk}`}>{t('learn.topicQuiz.correct')}</p>
            ) : null}
            {status === 'bad' ? (
              <p className={`${styles.feedback} ${styles.feedbackBad}`}>{t('learn.topicQuiz.wrong')}</p>
            ) : null}
            {showNext ? (
              <button type="button" className={styles.nextBtn} onClick={handleNext}>
                {index + 1 >= total ? t('learn.studentTest.seeResults') : t('learn.studentTest.next')}
              </button>
            ) : null}
          </div>
        ) : null}

        {phase === 'results' ? (
          <div className={styles.results}>
            <ScoreRing score={score} max={length} />
            <h3 className={styles.resultsTitle}>{t('learn.studentTest.resultsTitle')}</h3>
            <p className={`${styles.resultsGrade} ${gradeClass}`}>{gradeMessage}</p>
            {rosterSectionId && saved ? (
              <p className={styles.savedHint}>{t('learn.studentStats.saved')}</p>
            ) : null}
            <div className={styles.statsRow}>
              <div className={styles.stat}>
                <div className={styles.statValue}>{correctCount}</div>
                <div className={styles.statLabel}>{t('learn.studentTest.correctCount')}</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>{total - correctCount}</div>
                <div className={styles.statLabel}>{t('learn.studentTest.wrongCount')}</div>
              </div>
            </div>
            <p className={styles.hint}>{t('learn.studentTest.scoringHint', { max: length })}</p>
            <div className={styles.resultsActions}>
              <button type="button" className={styles.retryBtn} onClick={restart}>
                {t('learn.studentTest.retry')}
              </button>
              <button type="button" className={styles.doneBtn} onClick={onClose}>
                {t('learn.studentTest.done')}
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </div>,
    document.body,
  )
}

export function LearnStudentTest({
  grade,
  chapter,
  section,
  rosterSectionId,
  testKind = 'topic',
  variant = 'default',
  disabled = false,
  embedded = false,
  external,
}: Props) {
  if (external) {
    return external.active ? (
      <StudentTestOverlay
        grade={grade}
        chapter={chapter}
        section={section}
        rosterSectionId={rosterSectionId}
        testKind={testKind}
        variant={variant}
        length={external.length}
        onClose={external.onClose}
      />
    ) : null
  }
  return (
    <LearnStudentTestSetup
      grade={grade}
      chapter={chapter}
      section={section}
      rosterSectionId={rosterSectionId}
      testKind={testKind}
      variant={variant}
      disabled={disabled}
      embedded={embedded}
    />
  )
}

function LearnStudentTestSetup({
  grade,
  chapter,
  section,
  rosterSectionId,
  testKind = 'topic',
  variant = 'default',
  disabled = false,
  embedded = false,
}: Props) {
  const { t } = useT()
  const maxPool = studentTestMaxQuestions(grade.id, chapter.id, section.id)
  const [length, setLength] = useState<StudentTestLength>(5)
  const [active, setActive] = useState(false)

  const canStart = maxPool >= 3 && !disabled

  const start = useCallback(() => {
    if (!canStart) return
    setActive(true)
  }, [canStart])

  const close = useCallback(() => setActive(false), [])

  const effectiveLength = useMemo(() => {
    if (length === 10 && maxPool < 10) return 5 as StudentTestLength
    return length
  }, [length, maxPool])

  const panelClass = embedded ? styles.panelEmbedded : styles.panel

  /* Во встроенном режиме причину «нет ученика» уже показывает выноска хаба над панелью. */
  const showStudentReason = disabled && !embedded
  const hintWarn = showStudentReason || maxPool < 3
  const hintText = showStudentReason
    ? t('learn.molecules.structure.testNoStudent')
    : maxPool >= 3
      ? t('learn.studentTest.poolHint', { n: maxPool })
      : t('learn.studentTest.notEnough')
  const disabledReason = disabled
    ? t('learn.molecules.structure.testNoStudent')
    : !canStart
      ? t('learn.studentTest.notEnough')
      : undefined

  return (
    <section className={panelClass} aria-labelledby="learn-student-test-title">
      {!embedded ? (
        <div className={styles.head}>
          <h3 id="learn-student-test-title" className={styles.title}>
            {t('learn.studentTest.title')}
          </h3>
          <p className={styles.lead}>{t('learn.studentTest.lead')}</p>
        </div>
      ) : null}
      <div className={styles.setupRow}>
        <div className={styles.countField}>
          <span className={styles.countLabel} aria-hidden="true">
            {t('learn.studentTest.pickCount')}
          </span>
          <div className={styles.countPicker} role="group" aria-label={t('learn.studentTest.pickCount')}>
            <button
              type="button"
              className={length === 5 ? styles.countBtnActive : styles.countBtn}
              aria-pressed={length === 5}
              onClick={() => setLength(5)}
            >
              {t('learn.studentTest.questions5')}
            </button>
            <button
              type="button"
              className={length === 10 ? styles.countBtnActive : styles.countBtn}
              aria-pressed={length === 10}
              onClick={() => setLength(10)}
              disabled={maxPool < 10}
            >
              {t('learn.studentTest.questions10')}
            </button>
          </div>
        </div>
        <button
          type="button"
          className={styles.startBtn}
          onClick={start}
          disabled={!canStart}
          title={disabledReason}
        >
          <LearnSidebarIcon name={canStart ? 'play' : 'lock'} size={16} />
          <span>{t('learn.studentTest.start')}</span>
        </button>
      </div>
      <p className={`${styles.hint} ${hintWarn ? styles.hintWarn : ''}`}>
        <LearnSidebarIcon name={hintWarn ? 'lock' : 'info'} size={14} className={styles.hintIcon} />
        <span>{hintText}</span>
      </p>
      {active ? (
        <StudentTestOverlay
          grade={grade}
          chapter={chapter}
          section={section}
          rosterSectionId={rosterSectionId}
          testKind={testKind}
          variant={variant}
          length={effectiveLength}
          onClose={close}
        />
      ) : null}
    </section>
  )
}
