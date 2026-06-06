import { useCallback, useEffect, useRef, useState } from 'react'
import { getQuizTeacherHint } from '../../learn/quizTeacherHints'
import type { TopicQuizItem } from '../../learn/topicQuizTypes'
import {
  isSpeechOutputSupported,
  LearnSpeechController,
  type LearnSpeechLocale,
} from '../../learn/learnSpeech'
import { useT } from '../../i18n/useT'
import styles from './QuizTeacherHint.module.css'

export function QuizTeacherHint({
  question,
  disabled,
  className,
}: {
  question: TopicQuizItem
  disabled?: boolean
  className?: string
}) {
  const { t, locale } = useT()
  const speechLocale: LearnSpeechLocale = locale === 'en' ? 'en' : 'ru'
  const speechRef = useRef(new LearnSpeechController())
  const [hintLevel, setHintLevel] = useState(-1)
  const [hintText, setHintText] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    setHintLevel(-1)
    setHintText(null)
    setHasMore(false)
    speechRef.current.stop()
    setSpeaking(false)
  }, [question.id])

  useEffect(() => () => speechRef.current.stop(), [])

  const revealHint = useCallback(
    async (nextLevel: number) => {
      const result = getQuizTeacherHint(question, nextLevel, speechLocale)
      if (!result) return
      setHintLevel(result.level)
      setHintText(result.text)
      setHasMore(result.hasMore)

      if (isSpeechOutputSupported()) {
        setSpeaking(true)
        speechRef.current.stop()
        await speechRef.current.speak(result.text, speechLocale, () => setSpeaking(false))
      }
    },
    [question, speechLocale],
  )

  const onTeacherHelp = useCallback(() => {
    if (disabled) return
    void revealHint(hintLevel + 1)
  }, [disabled, hintLevel, revealHint])

  const onMoreHint = useCallback(() => {
    if (disabled || !hasMore) return
    void revealHint(hintLevel + 1)
  }, [disabled, hasMore, hintLevel, revealHint])

  const stopVoice = useCallback(() => {
    speechRef.current.stop()
    setSpeaking(false)
  }, [])

  if (disabled) return null

  return (
    <div className={`${styles.wrap}${className ? ` ${className}` : ''}`}>
      <div className={styles.actions}>
        <button type="button" className={styles.teacherBtn} onClick={onTeacherHelp}>
          <span className={styles.teacherIcon} aria-hidden>
            ✦
          </span>
          {hintText ? t('learn.topicQuiz.teacherHintAgain') : t('learn.topicQuiz.teacherHint')}
        </button>
        {hintText && hasMore ? (
          <button type="button" className={styles.moreBtn} onClick={onMoreHint}>
            {t('learn.topicQuiz.teacherHintMore')}
          </button>
        ) : null}
        {speaking ? (
          <button type="button" className={styles.stopBtn} onClick={stopVoice}>
            {t('learn.assistant.stopSpeak')}
          </button>
        ) : null}
      </div>
      {hintText ? (
        <div className={styles.bubble} role="note" aria-live="polite">
          <span className={styles.bubbleLabel}>{t('learn.topicQuiz.teacherHintTitle')}</span>
          <p className={styles.bubbleText}>{hintText}</p>
          {!hasMore ? (
            <p className={styles.bubbleFoot}>{t('learn.topicQuiz.teacherHintFoot')}</p>
          ) : null}
        </div>
      ) : (
        <p className={styles.lead}>{t('learn.topicQuiz.teacherHintLead')}</p>
      )}
    </div>
  )
}
