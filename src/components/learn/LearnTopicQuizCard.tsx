import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LearnChapter, LearnGrade, LearnSection } from '../../types/learn'
import { pickRandomTopicQuiz, topicQuizPoolSize } from '../../learn/g7TopicQuizEngine'
import type { TopicQuizItem } from '../../learn/topicQuizTypes'
import { useT } from '../../i18n/useT'
import { LearnTopicQuizFullscreen } from './LearnTopicQuizFullscreen'
import styles from './LearnTopicQuizCard.module.css'
import fsStyles from './LearnTopicQuizFullscreen.module.css'

type Props = {
  grade: LearnGrade
  chapter: LearnChapter
  section: LearnSection
  autoReveal?: boolean
}

type QuizUi = {
  placeholder: string
  questionWrap: string
  question: string
  choices: string
  choice: string
  choiceSelected: string
  choiceOk: string
  choiceBad: string
  choiceLetter: string
  feedbackOk: string
  feedbackBad: string
  explain: string
}

const CARD_UI: QuizUi = {
  placeholder: styles.placeholder,
  questionWrap: styles.questionWrap,
  question: styles.question,
  choices: styles.choices,
  choice: styles.choice,
  choiceSelected: styles.choiceSelected,
  choiceOk: styles.choiceOk,
  choiceBad: styles.choiceBad,
  choiceLetter: styles.choiceLetter,
  feedbackOk: styles.feedbackOk,
  feedbackBad: styles.feedbackBad,
  explain: styles.explain,
}

const FS_UI: QuizUi = {
  placeholder: fsStyles.placeholder,
  questionWrap: fsStyles.questionWrap,
  question: fsStyles.question,
  choices: fsStyles.choices,
  choice: fsStyles.choice,
  choiceSelected: fsStyles.choiceSelected,
  choiceOk: fsStyles.choiceOk,
  choiceBad: fsStyles.choiceBad,
  choiceLetter: fsStyles.choiceLetter,
  feedbackOk: fsStyles.feedbackOk,
  feedbackBad: fsStyles.feedbackBad,
  explain: fsStyles.explain,
}

function TopicQuizBody({
  ui,
  revealed,
  question,
  pick,
  onPick,
  status,
  animKey,
  placeholder,
}: {
  ui: QuizUi
  revealed: boolean
  question: TopicQuizItem | null
  pick: number | null
  onPick: (idx: number) => void
  status: 'ok' | 'bad' | null
  animKey: number
  placeholder: string
}) {
  const { t } = useT()

  if (!revealed || !question) {
    return (
      <div className={ui.placeholder}>
        <p>{placeholder}</p>
      </div>
    )
  }

  return (
    <div key={animKey} className={ui.questionWrap}>
      <p className={ui.question}>{question.question}</p>
      <ul className={ui.choices}>
        {question.choices.map((choice, idx) => {
          const selected = pick === idx
          const isCorrect = idx === question.correctIndex
          let cls = ui.choice
          if (pick !== null) {
            if (isCorrect) cls += ` ${ui.choiceOk}`
            else if (selected) cls += ` ${ui.choiceBad}`
          } else if (selected) cls += ` ${ui.choiceSelected}`
          return (
            <li key={idx}>
              <button
                type="button"
                className={cls}
                disabled={pick !== null}
                onClick={() => onPick(idx)}
              >
                <span className={ui.choiceLetter}>{String.fromCharCode(65 + idx)}</span>
                <span>{choice}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {status === 'ok' ? <p className={ui.feedbackOk}>{t('learn.topicQuiz.correct')}</p> : null}
      {status === 'bad' ? <p className={ui.feedbackBad}>{t('learn.topicQuiz.wrong')}</p> : null}
      {status && question.explanation ? (
        <p className={ui.explain}>{question.explanation}</p>
      ) : null}
    </div>
  )
}

export function LearnTopicQuizCard({ grade, chapter, section, autoReveal = false }: Props) {
  const { t } = useT()
  const poolSize = topicQuizPoolSize(grade.id, chapter.id, section.id)
  const [revealed, setRevealed] = useState(autoReveal)
  const [question, setQuestion] = useState<TopicQuizItem | null>(null)
  const [pick, setPick] = useState<number | null>(null)
  const [seen, setSeen] = useState<Set<string>>(() => new Set())
  const [animKey, setAnimKey] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)

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

  const status = useMemo((): 'ok' | 'bad' | null => {
    if (pick === null || !question) return null
    return pick === question.correctIndex ? 'ok' : 'bad'
  }, [pick, question])

  const poolMeta = t('learn.topicQuiz.poolMeta', { n: poolSize })
  const sectionTitle = t(section.titleKey)
  const drawLabel = revealed && question ? t('learn.topicQuiz.next') : t('learn.topicQuiz.draw')
  const placeholder = t('learn.topicQuiz.placeholder')

  const openFullscreen = useCallback(() => {
    if (!revealed || !question) drawQuestion()
    setFullscreen(true)
  }, [drawQuestion, question, revealed])

  const closeFullscreen = useCallback(() => setFullscreen(false), [])

  const bodyProps = {
    revealed,
    question,
    pick,
    onPick: setPick,
    status,
    animKey,
    placeholder,
  }

  return (
    <>
      <section className={styles.card} aria-labelledby="learn-topic-quiz-title">
        <div className={styles.cardHead}>
          <div>
            <h3 id="learn-topic-quiz-title" className={styles.cardTitle}>
              {t('learn.topicQuiz.title')}
            </h3>
            <p className={styles.cardMeta}>
              {poolMeta} · {sectionTitle}
            </p>
          </div>
          <div className={styles.cardActions}>
            <button
              type="button"
              className={styles.fullscreenBtn}
              onClick={openFullscreen}
              title={t('learn.topicQuiz.fullscreen')}
              aria-label={t('learn.topicQuiz.fullscreen')}
            >
              ⛶
            </button>
            <button type="button" className={styles.drawBtn} onClick={drawQuestion}>
              {drawLabel}
            </button>
          </div>
        </div>
        <TopicQuizBody ui={CARD_UI} {...bodyProps} />
      </section>

      {fullscreen ? (
        <LearnTopicQuizFullscreen
          title={t('learn.topicQuiz.title')}
          meta={`${poolMeta} · ${sectionTitle}`}
          drawLabel={drawLabel}
          onDraw={drawQuestion}
          onClose={closeFullscreen}
        >
          <TopicQuizBody ui={FS_UI} {...bodyProps} />
        </LearnTopicQuizFullscreen>
      ) : null}
    </>
  )
}
