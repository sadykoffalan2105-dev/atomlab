import { useCallback, useEffect, useRef, useState } from 'react'
import { useT, type MessageKey } from '../../i18n/useT'
import { generateTaskProblem, answersClose, type LearnTaskGenerated } from '../../learn/learnTaskProblems'
import { readWorkspaceDraft, writeWorkspaceDraft } from '../../learn/learnProgressStorage'
import { LearnBoardPad, type BoardSaveState } from './LearnBoardPad'
import { LearnShellIcon } from './LearnShellIcon'
import kit from './studio/StudioKit.module.css'
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
  // Статус автосохранения черновика — показывает сама «тетрадь» (чип в тулбаре).
  const [saveState, setSaveState] = useState<BoardSaveState>('idle')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const dirtyRef = useRef(false)

  const editScratch = useCallback((value: string) => {
    dirtyRef.current = true
    setSaveState('pending')
    setScratch(value)
  }, [])

  useEffect(() => {
    setScratch(readWorkspaceDraft(sectionPathId))
    setUserText('')
    setFeedback('idle')
    dirtyRef.current = false
    setSaveState('idle')
    setSavedAt(null)
    if (taskCategoryId) {
      setProblem(generateTaskProblem(taskCategoryId))
    } else {
      setProblem(null)
    }
  }, [sectionPathId, taskCategoryId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      writeWorkspaceDraft(sectionPathId, scratch)
      if (!dirtyRef.current) return
      dirtyRef.current = false
      setSavedAt(Date.now())
      setSaveState('saved')
    }, 400)
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
      <div className={styles.learnWorkspaceBoard}>
        <LearnBoardPad
          sectionPathId={sectionPathId}
          text={scratch}
          onTextChange={editScratch}
          presentationMode={presentationMode}
          saveState={saveState}
          savedAt={savedAt}
        />
      </div>

      {problem && taskCategoryId ? (
        <section className={styles.learnWorkspaceTask}>
          <h4 className={styles.learnWorkspaceTaskH}>
            <span className={styles.learnWorkspaceTaskIcon} aria-hidden="true">
              <LearnShellIcon name="tasks" size={14} />
            </span>
            {t('learn.practiceOpen')}
          </h4>
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
                className={`${styles.learnWorkspaceInput} ${
                  feedback === 'correct'
                    ? styles.learnWorkspaceInputOk
                    : feedback === 'wrong'
                      ? styles.learnWorkspaceInputBad
                      : ''
                }`}
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
                <button
                  type="button"
                  className={`${kit.btn} ${kit.btnPrimary}`}
                  onClick={checkNumeric}
                >
                  <LearnShellIcon name="check" size={15} strokeWidth={2.4} />
                  <span>{t('learn.workspace.check')}</span>
                </button>
                <button
                  type="button"
                  className={`${kit.btn} ${kit.btnGhost}`}
                  onClick={newProblem}
                >
                  <LearnShellIcon name="plus" size={15} />
                  <span>{t('learn.task.newTask')}</span>
                </button>
              </div>
            </>
          ) : problem.kind === 'mcq' ? (
            <ul className={styles.learnWorkspaceChoices}>
              {problem.choiceKeys.map((key, idx) => (
                <li key={key}>
                  <button type="button" className={styles.learnWorkspaceChoice} onClick={() => pickMcq(idx)}>
                    <span className={styles.learnWorkspaceChoiceMark} aria-hidden="true">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{t(key as MessageKey)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {feedback === 'correct' ? (
            <p className={styles.learnWorkspaceOk}>
              <LearnShellIcon name="check" size={15} strokeWidth={2.6} />
              {t('learn.checkpointCorrect')}
            </p>
          ) : feedback === 'wrong' ? (
            <p className={styles.learnWorkspaceBad}>
              <LearnShellIcon name="close" size={15} strokeWidth={2.6} />
              {t('learn.checkpointWrong')}
            </p>
          ) : null}
        </section>
      ) : null}
    </aside>
  )
}
