import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CatalogMoleculeHero } from '../components/lab/CatalogMoleculeHero'
import { TaskAiCoach } from '../components/learn/TaskAiCoach'
import { TaskTeacherHint } from '../components/learn/TaskTeacherHint'
import { LEARN_TASK_CATEGORIES, type LearnTaskCategoryDef } from '../data/learnTaskCategories'
import { generateTaskProblem, answersClose, type LearnTaskGenerated } from '../learn/learnTaskProblems'
import { computeTaskScore } from '../learn/learnTaskScoring'
import {
  getActiveStudent,
  recordStudentTaskResult,
  TASKS_ROSTER_SECTION_ID,
} from '../learn/learnClassRosterStorage'
import { useT, type MessageKey } from '../i18n/useT'
import { isWebGLAvailable } from '../utils/webgl'
import styles from './LearnPage.module.css'

function parseLocaleNumber(raw: string): number | null {
  const t = raw.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

type Feedback = 'idle' | 'correct' | 'wrong'

type Props = {
  categoryId: string
  rosterSectionId?: string
}

export function LearnTaskRunner({ categoryId, rosterSectionId = TASKS_ROSTER_SECTION_ID }: Props) {
  const { t } = useT()
  const cat = useMemo(
    () => LEARN_TASK_CATEGORIES.find((c: LearnTaskCategoryDef) => c.id === categoryId),
    [categoryId],
  )
  const [problem, setProblem] = useState<LearnTaskGenerated>(() => generateTaskProblem(categoryId))
  const [heroTick, setHeroTick] = useState(0)
  const [userText, setUserText] = useState('')
  const [feedback, setFeedback] = useState<Feedback>('idle')
  const [staticHints, setStaticHints] = useState(0)
  const [aiHints, setAiHints] = useState(0)
  const hintsUsed = staticHints + aiHints
  const recordedRef = useRef(false)
  const webglOk = isWebGLAvailable()

  useEffect(() => {
    setProblem(generateTaskProblem(categoryId))
    setUserText('')
    setFeedback('idle')
    setStaticHints(0)
    setAiHints(0)
    recordedRef.current = false
    setHeroTick((k) => k + 1)
  }, [categoryId])

  const saveResult = useCallback(
    (correct: boolean, hints: number) => {
      if (recordedRef.current) return
      const student = getActiveStudent(rosterSectionId)
      if (!student) return
      const { score, total } = computeTaskScore(correct, hints)
      recordStudentTaskResult(rosterSectionId, student.id, {
        taskCategoryId: categoryId,
        correct,
        hintsUsed: hints,
        score,
        total,
      })
      recordedRef.current = true
    },
    [rosterSectionId, categoryId],
  )

  const newProblem = useCallback(() => {
    setProblem(generateTaskProblem(categoryId))
    setUserText('')
    setFeedback('idle')
    setStaticHints(0)
    setAiHints(0)
    recordedRef.current = false
    setHeroTick((k) => k + 1)
  }, [categoryId])

  const checkNumeric = useCallback(() => {
    if (problem.kind !== 'numeric') return
    const u = parseLocaleNumber(userText)
    if (u === null) {
      setFeedback('wrong')
      saveResult(false, hintsUsed)
      return
    }
    const ok = answersClose(u, problem.correct, problem.decimals)
    setFeedback(ok ? 'correct' : 'wrong')
    saveResult(ok, hintsUsed)
  }, [problem, userText, hintsUsed, saveResult])

  const pickMcq = useCallback(
    (idx: number) => {
      if (problem.kind !== 'mcq') return
      const ok = idx === problem.correctIndex
      setFeedback(ok ? 'correct' : 'wrong')
      saveResult(ok, hintsUsed)
    },
    [problem, hintsUsed, saveResult],
  )

  const onStaticHintUsed = useCallback((count: number) => {
    setStaticHints(count)
  }, [])

  const onAiHintsChange = useCallback((count: number) => {
    setAiHints(count)
  }, [])

  const questionText =
    problem.kind === 'numeric'
      ? t(problem.questionKey as MessageKey, problem.params as Record<string, string | number>)
      : t(problem.questionKey as MessageKey)

  const choiceLabels =
    problem.kind === 'mcq' ? problem.choiceKeys.map((key) => t(key as MessageKey)) : undefined

  const expectedDisplay =
    problem.kind === 'numeric'
      ? problem.correct.toFixed(problem.decimals)
      : problem.kind === 'mcq'
        ? t(problem.choiceKeys[problem.correctIndex]! as MessageKey)
        : ''

  const activeStudent = getActiveStudent(rosterSectionId)

  if (!cat) return null

  const compoundId = problem.kind === 'numeric' || problem.kind === 'mcq' ? problem.compoundId : null
  const showHero = compoundId && webglOk

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} to="/learn/tasks">
        {t('learn.tasksBack')}
      </Link>
      <h1 className={styles.h}>{t(cat.titleKey as MessageKey)}</h1>
      <p className={styles.lead}>{t(cat.whatKey as MessageKey)}</p>

      {activeStudent ? (
        <p className={styles.taskActiveStudent} role="status">
          {t('learn.task.activeStudent', { name: activeStudent.name })}
        </p>
      ) : null}

      {compoundId ? (
        <div className={styles.taskHero3d} key={heroTick}>
          <div className={styles.taskHero3dInner}>
            {showHero ? (
              <CatalogMoleculeHero key={`task-${compoundId}-${heroTick}`} compoundId={compoundId} />
            ) : (
              <div className={styles.taskHeroFallback} role="status">
                {t('learn.task.heroFallback')}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <section className={styles.taskPanel} aria-labelledby="task-q">
        <h2 className={styles.taskQTitle} id="task-q">
          {problem.kind === 'numeric'
            ? t(problem.questionKey as MessageKey, problem.params as Record<string, string | number>)
            : t(problem.questionKey as MessageKey)}
        </h2>

        <TaskTeacherHint
          problem={problem}
          disabled={feedback === 'correct'}
          onHintUsed={onStaticHintUsed}
        />

        <TaskAiCoach
          problem={problem}
          categoryId={categoryId}
          categoryTitle={t(cat.titleKey as MessageKey)}
          questionText={questionText}
          answerLabel={
            problem.kind === 'numeric' ? t(problem.answerLabelKey as MessageKey) : undefined
          }
          choiceLabels={choiceLabels}
          staticHintsRevealed={staticHints}
          feedback={feedback}
          userAttempt={problem.kind === 'numeric' ? userText : undefined}
          disabled={feedback === 'correct'}
          onAiHintsChange={onAiHintsChange}
        />

        {problem.kind === 'numeric' ? (
          <>
            <p className={styles.taskSyntax}>{t('learn.task.syntaxHint')}</p>
            <label className={styles.taskAnswerLabel} htmlFor="task-answer-input">
              {t(problem.answerLabelKey as MessageKey)}
            </label>
            <input
              id="task-answer-input"
              className={styles.taskAnswerInput}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={userText}
              onChange={(e) => {
                setUserText(e.target.value)
                if (feedback !== 'idle') setFeedback('idle')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') checkNumeric()
              }}
              placeholder={t('learn.task.answerPlaceholder')}
              disabled={feedback === 'correct'}
            />
            <div className={styles.taskActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={checkNumeric}
                disabled={feedback === 'correct'}
              >
                {t('learn.task.check')}
              </button>
              <button type="button" className={styles.btn} onClick={newProblem}>
                {t('learn.task.newTask')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.taskSyntax}>{t('learn.task.mcqHint')}</p>
            <ul className={styles.taskMcqList}>
              {problem.choiceKeys.map((key: string, idx: number) => (
                <li key={key}>
                  <button
                    type="button"
                    className={`${styles.taskMcqBtn} ${feedback !== 'idle' && idx === problem.correctIndex ? styles.taskMcqCorrect : ''} ${feedback === 'wrong' && idx !== problem.correctIndex ? styles.taskMcqDim : ''}`}
                    onClick={() => pickMcq(idx)}
                    disabled={feedback === 'correct'}
                  >
                    {t(key as MessageKey)}
                  </button>
                </li>
              ))}
            </ul>
            <div className={styles.taskActions}>
              <button type="button" className={styles.btn} onClick={newProblem}>
                {t('learn.task.newTask')}
              </button>
            </div>
          </>
        )}

        {feedback === 'correct' ? (
          <p className={styles.taskFeedbackOk} role="status">
            {t('learn.task.correct')}
            {activeStudent ? ` ${t('learn.studentStats.saved')}` : ''}
          </p>
        ) : null}
        {feedback === 'wrong' ? (
          <p className={styles.taskFeedbackBad} role="status">
            {t('learn.task.wrong')} {t('learn.task.expected', { value: expectedDisplay })}
            {activeStudent ? ` ${t('learn.studentStats.saved')}` : ''}
          </p>
        ) : null}
      </section>
    </div>
  )
}
