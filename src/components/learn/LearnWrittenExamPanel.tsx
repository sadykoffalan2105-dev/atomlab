import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LearnChapter, LearnGrade, LearnSection } from '../../types/learn'
import {
  getActiveStudent,
  recordStudentTestResult,
} from '../../learn/learnClassRosterStorage'
import { pickWrittenExamQuestions, writtenExamPoolSize } from '../../learn/g7ExamPools'
import {
  examGradeLabelFromRatio,
  examPointsToTestScore,
  gradeExamAnswer,
  type ExamGradeResult,
} from '../../learn/learnExamGrader'
import type { WrittenExamItem } from '../../learn/topicQuizTypes'
import { useT, type MessageKey } from '../../i18n/useT'
import styles from './TeacherExamShell.module.css'

type Props = {
  grade: LearnGrade
  chapter: LearnChapter
  section: LearnSection
  rosterSectionId?: string
  disabled?: boolean
  embedded?: boolean
}

type Phase = 'running' | 'results'

function ExamScoreRing({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? score / max : 0
  const offset = 283 * (1 - pct)
  return (
    <div className={styles.scoreRing}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <defs>
          <linearGradient id="examScoreGradWritten" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5cffd4" />
            <stop offset="100%" stopColor="#3dd4b0" />
          </linearGradient>
        </defs>
        <circle className={styles.scoreRingBg} cx="50" cy="50" r="45" />
        <circle
          className={styles.scoreRingFill}
          cx="50"
          cy="50"
          r="45"
          style={{ strokeDashoffset: offset, stroke: 'url(#examScoreGradWritten)' }}
        />
      </svg>
      <div className={styles.scoreValue}>
        <span className={styles.scoreNumber}>{score}</span>
        <span className={styles.scoreOf}>/ {max}</span>
      </div>
    </div>
  )
}

function WrittenExamOverlay({
  grade,
  chapter,
  section,
  count,
  rosterSectionId,
  onClose,
}: Props & { count: 3 | 5; onClose: () => void }) {
  const { t } = useT()
  const [phase, setPhase] = useState<Phase>('running')
  const [questions] = useState<WrittenExamItem[]>(() =>
    pickWrittenExamQuestions(grade.id, chapter.id, count),
  )
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [grading, setGrading] = useState(false)
  const [grades, setGrades] = useState<ExamGradeResult[]>([])
  const [lastFeedback, setLastFeedback] = useState<ExamGradeResult | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [saved, setSaved] = useState(false)

  const question = questions[index] ?? null
  const total = questions.length
  const totalPoints = grades.reduce((s, g) => s + g.score, 0)
  const maxPoints = total * 2
  const displayScore = examPointsToTestScore(totalPoints, maxPoints, count)
  const gradeKey = examGradeLabelFromRatio(maxPoints > 0 ? totalPoints / maxPoints : 0)
  const progressPct = total > 0 ? ((phase === 'results' ? total : index) / total) * 100 : 0

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

  const saveResult = useCallback(() => {
    if (saved || !rosterSectionId) return
    const student = getActiveStudent(rosterSectionId)
    if (!student) return
    recordStudentTestResult(rosterSectionId, student.id, {
      kind: 'written',
      score: displayScore,
      total: count,
      correct: Math.round(totalPoints / 2),
    })
    setSaved(true)
  }, [count, displayScore, rosterSectionId, saved, totalPoints])

  const submitAnswer = useCallback(async () => {
    if (!question || !answer.trim() || grading) return
    setGrading(true)
    const result = await gradeExamAnswer({
      question: question.question,
      rubric: question.rubric,
      sampleAnswer: question.sampleAnswer,
      studentAnswer: answer,
      mode: 'written',
      gradeId: grade.id,
      chapterId: chapter.id,
      sectionTitle: section.titleKey,
    })
    setGrades((prev) => [...prev, result])
    setLastFeedback(result)
    setShowFeedback(true)
    setGrading(false)
  }, [answer, chapter.id, grade.id, grading, question, section.titleKey])

  const handleNext = useCallback(() => {
    if (index + 1 >= total) {
      saveResult()
      setPhase('results')
      return
    }
    setIndex((i) => i + 1)
    setAnswer('')
    setLastFeedback(null)
    setShowFeedback(false)
  }, [index, saveResult, total])

  const restart = useCallback(() => {
    setIndex(0)
    setAnswer('')
    setGrades([])
    setLastFeedback(null)
    setShowFeedback(false)
    setSaved(false)
    setPhase('running')
  }, [])

  const gradeClass =
    gradeKey === 'excellent'
      ? styles.gradeExcellent
      : gradeKey === 'good'
        ? styles.gradeGood
        : gradeKey === 'fair'
          ? styles.gradeFair
          : styles.gradeRetry

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <header className={styles.toolbar}>
        <h2 className={styles.toolbarTitle}>{t('learn.teacherExam.writtenTitle')}</h2>
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
          <div className={styles.body}>
            <div className={styles.teacherBubble}>
              <span className={styles.teacherBadge}>{t('learn.teacherExam.writePrompt')}</span>
              <p className={styles.question}>{question.question}</p>
            </div>

            {!showFeedback ? (
              <>
                <textarea
                  className={styles.textarea}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={t('learn.teacherExam.answerPlaceholder')}
                  disabled={grading}
                  rows={6}
                />
                <div className={styles.actionRow}>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    disabled={!answer.trim() || grading}
                    onClick={() => void submitAnswer()}
                  >
                    {grading ? t('learn.teacherExam.grading') : t('learn.teacherExam.submitAnswer')}
                  </button>
                </div>
              </>
            ) : null}

            {showFeedback && lastFeedback ? (
              <>
                <p
                  className={`${styles.feedback} ${
                    lastFeedback.verdict === 'correct'
                      ? styles.feedbackOk
                      : lastFeedback.verdict === 'partial'
                        ? styles.feedbackPartial
                        : styles.feedbackBad
                  }`}
                >
                  {lastFeedback.feedback}
                </p>
                {question.explanation ? <p className={styles.hint}>{question.explanation}</p> : null}
                <p className={styles.hint}>
                  {t('learn.teacherExam.pointsEarned', {
                    score: lastFeedback.score,
                    max: lastFeedback.maxScore,
                  })}
                </p>
                <div className={styles.actionRow}>
                  <button type="button" className={styles.primaryBtn} onClick={handleNext}>
                    {index + 1 >= total ? t('learn.studentTest.seeResults') : t('learn.studentTest.next')}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {phase === 'results' ? (
          <div className={`${styles.results} ${styles.body}`}>
            <ExamScoreRing score={displayScore} max={count} />
            <h3 className={styles.resultsTitle}>{t('learn.studentTest.resultsTitle')}</h3>
            <p className={`${styles.resultsGrade} ${gradeClass}`}>
              {t(`learn.studentTest.grade.${gradeKey}` as MessageKey)}
            </p>
            {rosterSectionId && saved ? (
              <p className={styles.savedHint}>{t('learn.studentStats.saved')}</p>
            ) : null}
            <div className={styles.statsRow}>
              <div>
                <div className={styles.statValue}>{totalPoints}</div>
                <div className={styles.statLabel}>{t('learn.teacherExam.totalPoints')}</div>
              </div>
              <div>
                <div className={styles.statValue}>{maxPoints}</div>
                <div className={styles.statLabel}>{t('learn.teacherExam.maxPoints')}</div>
              </div>
            </div>
            <div className={styles.actionRow} style={{ justifyContent: 'center' }}>
              <button type="button" className={styles.secondaryBtn} onClick={restart}>
                {t('learn.studentTest.retry')}
              </button>
              <button type="button" className={styles.primaryBtn} onClick={onClose}>
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

export function LearnWrittenExamPanel({
  grade,
  chapter,
  section,
  rosterSectionId,
  disabled = false,
}: Props) {
  const { t } = useT()
  const poolSize = writtenExamPoolSize(grade.id, chapter.id)
  const [count, setCount] = useState<3 | 5>(3)
  const [active, setActive] = useState(false)

  const canStart = poolSize >= 2 && !disabled
  const effectiveCount = useMemo(() => (count === 5 && poolSize < 5 ? 3 : count), [count, poolSize])

  return (
    <section className={styles.panel}>
      <div className={styles.setupRow}>
        <div className={styles.countPicker} role="group" aria-label={t('learn.studentTest.pickCount')}>
          <button
            type="button"
            className={count === 3 ? styles.countBtnActive : styles.countBtn}
            onClick={() => setCount(3)}
          >
            3
          </button>
          <button
            type="button"
            className={count === 5 ? styles.countBtnActive : styles.countBtn}
            onClick={() => setCount(5)}
            disabled={poolSize < 5}
          >
            5
          </button>
        </div>
        <button type="button" className={styles.primaryBtn} disabled={!canStart} onClick={() => setActive(true)}>
          {t('learn.teacherExam.startWritten')}
        </button>
      </div>
      <p className={styles.hint}>
        {disabled
          ? t('learn.molecules.structure.testNoStudent')
          : canStart
            ? t('learn.teacherExam.writtenPoolHint', { n: poolSize })
            : t('learn.studentTest.notEnough')}
      </p>
      {active ? (
        <WrittenExamOverlay
          grade={grade}
          chapter={chapter}
          section={section}
          rosterSectionId={rosterSectionId}
          count={effectiveCount}
          onClose={() => setActive(false)}
        />
      ) : null}
    </section>
  )
}
