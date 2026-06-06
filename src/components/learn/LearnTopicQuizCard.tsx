import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LearnChapter, LearnGrade, LearnSection } from '../../types/learn'
import { pickRandomTopicQuiz, topicQuizPoolSize } from '../../learn/g7TopicQuizEngine'
import type { TopicQuizItem } from '../../learn/topicQuizTypes'
import { useT } from '../../i18n/useT'
import styles from './LearnTopicQuizCard.module.css'

type Props = {
  grade: LearnGrade
  chapter: LearnChapter
  section: LearnSection
  autoReveal?: boolean
}

export function LearnTopicQuizCard({ grade, chapter, section, autoReveal = false }: Props) {
  const { t } = useT()
  const poolSize = topicQuizPoolSize(grade.id, chapter.id, section.id)
  const [revealed, setRevealed] = useState(autoReveal)
  const [question, setQuestion] = useState<TopicQuizItem | null>(null)
  const [pick, setPick] = useState<number | null>(null)
  const [seen, setSeen] = useState<Set<string>>(() => new Set())
  const [animKey, setAnimKey] = useState(0)

  const drawQuestion = useCallback(() => {
    const next = pickRandomTopicQuiz(grade.id, chapter.id, section.id, seen)
    setQuestion(next)
    setPick(null)
    setRevealed(true)
    setAnimKey((k) => k + 1)
    setSeen((prev) => {
      const n = new Set(prev)
      n.add(next.id)
      if (n.size >= poolSize * 0.8) return new Set([next.id])
      return n
    })
  }, [chapter.id, grade.id, poolSize, section.id, seen])

  useEffect(() => {
    if (autoReveal && !question) drawQuestion()
  }, [autoReveal, drawQuestion, question])

  const status = useMemo(() => {
    if (pick === null || !question) return null
    return pick === question.correctIndex ? 'ok' : 'bad'
  }, [pick, question])

  return (
    <section className={styles.card} aria-labelledby="learn-topic-quiz-title">
      <div className={styles.cardHead}>
        <div>
          <h3 id="learn-topic-quiz-title" className={styles.cardTitle}>
            {t('learn.topicQuiz.title')}
          </h3>
          <p className={styles.cardMeta}>
            {t('learn.topicQuiz.poolMeta', { n: poolSize })} · {t(section.titleKey)}
          </p>
        </div>
        <button type="button" className={styles.drawBtn} onClick={drawQuestion}>
          {revealed && question ? t('learn.topicQuiz.next') : t('learn.topicQuiz.draw')}
        </button>
      </div>

      {!revealed || !question ? (
        <div className={styles.placeholder}>
          <p>{t('learn.topicQuiz.placeholder')}</p>
        </div>
      ) : (
        <div key={animKey} className={styles.questionWrap}>
          <p className={styles.question}>{question.question}</p>
          <ul className={styles.choices}>
            {question.choices.map((choice, idx) => {
              const selected = pick === idx
              const isCorrect = idx === question.correctIndex
              let cls = styles.choice
              if (pick !== null) {
                if (isCorrect) cls += ` ${styles.choiceOk}`
                else if (selected) cls += ` ${styles.choiceBad}`
              } else if (selected) cls += ` ${styles.choiceSelected}`
              return (
                <li key={idx}>
                  <button
                    type="button"
                    className={cls}
                    disabled={pick !== null}
                    onClick={() => setPick(idx)}
                  >
                    <span className={styles.choiceLetter}>{String.fromCharCode(65 + idx)}</span>
                    <span>{choice}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {status === 'ok' ? (
            <p className={styles.feedbackOk}>{t('learn.topicQuiz.correct')}</p>
          ) : null}
          {status === 'bad' ? (
            <p className={styles.feedbackBad}>{t('learn.topicQuiz.wrong')}</p>
          ) : null}
          {status && question.explanation ? (
            <p className={styles.explain}>{question.explanation}</p>
          ) : null}
        </div>
      )}
    </section>
  )
}
