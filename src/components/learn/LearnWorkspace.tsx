import { useCallback, useEffect, useState } from 'react'
import { useT, type MessageKey } from '../../i18n/useT'
import { generateTaskProblem, answersClose, type LearnTaskGenerated } from '../../learn/learnTaskProblems'
import { readWorkspaceDraft, writeWorkspaceDraft } from '../../learn/learnProgressStorage'
import { LearnBoardPad } from './LearnBoardPad'
import styles from '../../pages/LearnPage.module.css'

function parseLocaleNumber(raw: string): number | null {
  const t = raw.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

type Feedback = 'idle' | 'correct' | 'wrong'

export function LearnWorkspace({
  sectionPathId,
  taskCategoryId,
  presentationMode = false,
}: {
  sectionPathId: string
  taskCategoryId?: string
  presentationMode?: boolean
}) {
  const { t } = useT()
  const [scratch, setScratch] = useState(() => readWorkspaceDraft(sectionPathId))
  const [problem, setProblem] = useState<LearnTaskGenerated | null>(null)
  const [userText, setUserText] = useState('')
  const [feedback, setFeedback] = useState<Feedback>('idle')

  useEffect(() => {
    setScratch(readWorkspaceDraft(sectionPathId))
    setUserText('')
    setFeedback('idle')
    if (taskCategoryId) {
      setProblem(generateTaskProblem(taskCategoryId))
    } else {
      setProblem(null)
    }
  }, [sectionPathId, taskCategoryId])

  useEffect(() => {
    const timer = window.setTimeout(() => writeWorkspaceDraft(sectionPathId, scratch), 400)
    return () => window.clearTimeout(timer)
  }, [scratch, sectionPathId])

  const checkNumeric = useCallback(() => {
    if (!problem || problem.kind !== 'numeric') return
    const u = parseLocaleNumber(userText)
    if (u === null) {
      setFeedback('wrong')
      return
    }
    setFeedback(answersClose(u, problem.correct, problem.decimals) ? 'correct' : 'wrong')
  }, [problem, userText])

  const pickMcq = useCallback(
    (idx: number) => {
      if (!problem || problem.kind !== 'mcq') return
      setFeedback(idx === problem.correctIndex ? 'correct' : 'wrong')
    },
    [problem],
  )

  const newProblem = useCallback(() => {
    if (!taskCategoryId) return
    setProblem(generateTaskProblem(taskCategoryId))
    setUserText('')
    setFeedback('idle')
  }, [taskCategoryId])

  return (
    <aside className={styles.learnWorkspace} aria-label={t('learn.workspace.title')}>
      <h3 className={styles.learnWorkspaceH}>{t('learn.workspace.title')}</h3>
      <LearnBoardPad
        sectionPathId={sectionPathId}
        text={scratch}
        onTextChange={setScratch}
        presentationMode={presentationMode}
      />
      <p className={styles.learnWorkspaceSaved} role="status">
        {t('learn.workspace.saved')}
      </p>

      {problem && taskCategoryId ? (
        <section className={styles.learnWorkspaceTask}>
          <h4 className={styles.learnWorkspaceTaskH}>{t('learn.practiceOpen')}</h4>
          <p className={styles.learnWorkspaceTaskQ}>
            { problem.kind === 'numeric'
              ? t(problem.questionKey as MessageKey, problem.params)
              : problem.kind === 'mcq'
                ? t(problem.questionKey as MessageKey)
                : ''}
          </p>
          {problem.kind === 'numeric' ? (
            <>
              <input
                className={styles.taskInput}
                type="text"
                inputMode="decimal"
                value={userText}
                onChange={(e) => {
                  setUserText(e.target.value)
                  setFeedback('idle')
                }}
                aria-label={t('learn.task.check')}
              />
              <div className={styles.learnWorkspaceTaskActions}>
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={checkNumeric}>
                  {t('learn.workspace.check')}
                </button>
                <button type="button" className={styles.btn} onClick={newProblem}>
                  {t('learn.task.newTask')}
                </button>
              </div>
            </>
          ) : problem.kind === 'mcq' ? (
            <ul className={styles.taskMcqList}>
              {problem.choiceKeys.map((key, idx) => (
                <li key={key}>
                  <button type="button" className={styles.taskMcqBtn} onClick={() => pickMcq(idx)}>
                    {t(key as MessageKey)}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {feedback === 'correct' ? (
            <p className={styles.taskOk}>{t('learn.checkpointCorrect')}</p>
          ) : feedback === 'wrong' ? (
            <p className={styles.taskBad}>{t('learn.checkpointWrong')}</p>
          ) : null}
        </section>
      ) : null}
    </aside>
  )
}
