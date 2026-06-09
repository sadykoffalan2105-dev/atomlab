import { useCallback, useEffect, useRef, useState } from 'react'
import type { LearnTaskGenerated } from '../../learn/learnTaskProblems'
import { buildTaskCoachContext } from '../../learn/learnTaskCoachTypes'
import {
  buildTaskCoachBaseContext,
  requestTaskCoachReply,
  type TaskCoachMessage,
} from '../../learn/learnTaskCoachClient'
import {
  isSpeechOutputSupported,
  LearnSpeechController,
  type LearnSpeechLocale,
} from '../../learn/learnSpeech'
import { useT, type MessageKey } from '../../i18n/useT'
import styles from './TaskAiCoach.module.css'

type Feedback = 'idle' | 'correct' | 'wrong'

type Props = {
  problem: LearnTaskGenerated
  categoryId: string
  categoryTitle: string
  questionText: string
  answerLabel?: string
  choiceLabels?: string[]
  staticHintsRevealed: number
  feedback: Feedback
  userAttempt?: string
  disabled?: boolean
  onAiHintsChange: (count: number) => void
}

export function TaskAiCoach({
  problem,
  categoryId,
  categoryTitle,
  questionText,
  answerLabel,
  choiceLabels,
  staticHintsRevealed,
  feedback,
  userAttempt,
  disabled,
  onAiHintsChange,
}: Props) {
  const { t, locale } = useT()
  const speechLocale: LearnSpeechLocale = locale === 'en' ? 'en' : 'ru'
  const speechRef = useRef(new LearnSpeechController())
  const [scratchpad, setScratchpad] = useState('')
  const [aiHintsGiven, setAiHintsGiven] = useState(0)
  const [messages, setMessages] = useState<TaskCoachMessage[]>([])
  const [coachText, setCoachText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setScratchpad('')
    setAiHintsGiven(0)
    setMessages([])
    setCoachText(null)
    setError(null)
    speechRef.current.stop()
    setSpeaking(false)
  }, [problem, categoryId])

  useEffect(() => () => speechRef.current.stop(), [])

  useEffect(() => {
    onAiHintsChange(aiHintsGiven)
  }, [aiHintsGiven, onAiHintsChange])

  const speak = useCallback(
    async (text: string) => {
      if (!isSpeechOutputSupported()) return
      setSpeaking(true)
      speechRef.current.stop()
      await speechRef.current.speak(text, speechLocale, () => setSpeaking(false))
    },
    [speechLocale],
  )

  const askCoach = useCallback(
    async (userContent: string, countAsHint: boolean) => {
      if (disabled || loading) return
      setLoading(true)
      setError(null)

      const nextAi = countAsHint ? aiHintsGiven + 1 : aiHintsGiven
      const taskCoach = buildTaskCoachContext(problem, {
        categoryId,
        categoryTitle,
        questionText,
        answerLabel,
        choiceLabels,
        staticHintsRevealed,
        aiHintsGiven: nextAi,
        feedback,
        userAttempt,
        scratchpad,
      })

      const userMsg: TaskCoachMessage = { role: 'user', content: userContent }
      const nextMessages = [...messages, userMsg]

      try {
        const baseCtx = buildTaskCoachBaseContext(locale, categoryTitle)
        const { text } = await requestTaskCoachReply(nextMessages, baseCtx, taskCoach, problem)
        const assistantMsg: TaskCoachMessage = { role: 'assistant', content: text }
        setMessages([...nextMessages, assistantMsg])
        setCoachText(text)
        if (countAsHint) setAiHintsGiven(nextAi)
        void speak(text)
      } catch {
        setError(t('learn.task.aiCoach.error'))
      } finally {
        setLoading(false)
      }
    },
    [
      disabled,
      loading,
      aiHintsGiven,
      problem,
      categoryId,
      categoryTitle,
      questionText,
      answerLabel,
      choiceLabels,
      staticHintsRevealed,
      feedback,
      userAttempt,
      scratchpad,
      messages,
      locale,
      speak,
      t,
    ],
  )

  const onNextStep = useCallback(() => {
    void askCoach(t('learn.task.aiCoach.promptNext' as MessageKey), true)
  }, [askCoach, t])

  const onCheckReasoning = useCallback(() => {
    const pad = scratchpad.trim()
    const prompt = pad
      ? `${t('learn.task.aiCoach.promptCheck' as MessageKey)}\n${pad}`
      : t('learn.task.aiCoach.promptCheckEmpty' as MessageKey)
    void askCoach(prompt, true)
  }, [askCoach, scratchpad, t])

  const stopVoice = useCallback(() => {
    speechRef.current.stop()
    setSpeaking(false)
  }, [])

  if (disabled) return null

  return (
    <section className={styles.panel} aria-label={t('learn.task.aiCoach.title' as MessageKey)}>
      <header className={styles.head}>
        <span className={styles.icon} aria-hidden>
          ✦
        </span>
        <div>
          <h3 className={styles.title}>{t('learn.task.aiCoach.title' as MessageKey)}</h3>
          <p className={styles.lead}>{t('learn.task.aiCoach.lead' as MessageKey)}</p>
        </div>
      </header>

      <label className={styles.scratchLabel} htmlFor="task-coach-scratch">
        {t('learn.task.aiCoach.scratchLabel' as MessageKey)}
      </label>
      <textarea
        id="task-coach-scratch"
        className={styles.scratch}
        value={scratchpad}
        onChange={(e) => setScratchpad(e.target.value)}
        placeholder={t('learn.task.aiCoach.scratchPh' as MessageKey)}
        rows={3}
        disabled={loading}
      />

      <div className={styles.actions}>
        <button type="button" className={styles.primaryBtn} onClick={onNextStep} disabled={loading}>
          {coachText
            ? t('learn.task.aiCoach.nextAgain' as MessageKey)
            : t('learn.task.aiCoach.next' as MessageKey)}
        </button>
        <button type="button" className={styles.btn} onClick={onCheckReasoning} disabled={loading}>
          {t('learn.task.aiCoach.check' as MessageKey)}
        </button>
        {speaking ? (
          <button type="button" className={styles.stopBtn} onClick={stopVoice}>
            {t('learn.assistant.stopSpeak')}
          </button>
        ) : null}
      </div>

      {loading ? <p className={styles.status}>{t('learn.assistant.thinking')}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      {coachText ? (
        <div className={styles.bubble} role="note" aria-live="polite">
          <span className={styles.bubbleLabel}>{t('learn.task.aiCoach.bubbleLabel' as MessageKey)}</span>
          <p className={styles.bubbleText}>{coachText}</p>
          <p className={styles.bubbleFoot}>{t('learn.task.aiCoach.foot' as MessageKey)}</p>
        </div>
      ) : null}
    </section>
  )
}
