import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LearnChapter, LearnGrade, LearnSection } from '../../types/learn'
import { pickRandomTopicQuiz, quizDedupeKey, topicQuizPoolSize } from '../../learn/g7TopicQuizEngine'
import type { TopicQuizItem } from '../../learn/topicQuizTypes'
import { useT } from '../../i18n/useT'
import { LearnTopicQuizFullscreen } from './LearnTopicQuizFullscreen'
import { prefetchLearnImage } from './LearnSlideVisual'
import { hasTopicQuizVisual, TopicQuizVisual } from './TopicQuizVisual'
import { getQuizVisualSpec } from '../../learn/quizVisualManifest'
import { QuizTeacherHint } from './QuizTeacherHint'
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
  descPanel?: string
  descPanelOpen?: string
  descTitle?: string
  descGrid?: string
  descVisual?: string
  descText?: string
  descTextBlock?: string
  descBtn?: string
  actionRow?: string
  nextBtn?: string
  questionWrapSplit?: string
  quizCol?: string
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
  descPanel: styles.descPanel,
  descPanelOpen: styles.descPanelOpen,
  descTitle: styles.descTitle,
  descGrid: styles.descGrid,
  descVisual: styles.descVisual,
  descText: styles.descText,
  descTextBlock: styles.descTextBlock,
  descBtn: styles.descBtn,
  actionRow: styles.actionRow,
  nextBtn: styles.nextBtn,
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
  descPanel: fsStyles.descPanel,
  descPanelOpen: fsStyles.descPanelOpen,
  descTitle: fsStyles.descTitle,
  descGrid: fsStyles.descGrid,
  descVisual: fsStyles.descVisual,
  descText: fsStyles.descText,
  descTextBlock: fsStyles.descTextBlock,
  descBtn: fsStyles.descBtn,
  actionRow: fsStyles.actionRow,
  nextBtn: fsStyles.nextBtn,
  questionWrapSplit: fsStyles.questionWrapSplit,
  quizCol: fsStyles.quizCol,
}

function TopicQuizDescription({
  ui,
  question,
  open,
  visualCompact,
  visualFullscreen,
  visualSplit = false,
}: {
  ui: QuizUi
  question: TopicQuizItem
  open: boolean
  visualCompact: boolean
  visualFullscreen: boolean
  visualSplit?: boolean
}) {
  const { t } = useT()
  const text = question.description ?? question.explanation
  if (!open || !text) return null

  const showVisual = question.visualId && hasTopicQuizVisual(question.visualId)

  return (
    <div className={`${ui.descPanel} ${ui.descPanelOpen}`} role="region" aria-label={t('learn.topicQuiz.descriptionTitle')}>
      <h4 className={ui.descTitle}>{t('learn.topicQuiz.descriptionTitle')}</h4>
      <div className={showVisual ? ui.descGrid : undefined}>
        {showVisual ? (
          <div className={ui.descVisual}>
            <TopicQuizVisual
              visualId={question.visualId!}
              compact={visualCompact}
              fullscreen={visualFullscreen && !visualSplit}
              split={visualSplit}
            />
          </div>
        ) : null}
        <div className={ui.descTextBlock}>
          {text.split(/\n\n+/).map((para) => (
            <p key={para.slice(0, 48)} className={ui.descText}>
              {para}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
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
  showDescription,
  onToggleDescription,
  visualCompact,
  visualFullscreen,
  onDraw,
  drawLabel,
}: {
  ui: QuizUi
  revealed: boolean
  question: TopicQuizItem | null
  pick: number | null
  onPick: (idx: number) => void
  status: 'ok' | 'bad' | null
  animKey: number
  placeholder: string
  showDescription: boolean
  onToggleDescription: () => void
  visualCompact: boolean
  visualFullscreen: boolean
  onDraw?: () => void
  drawLabel?: string
}) {
  const { t } = useT()

  if (!revealed || !question) {
    return (
      <div className={ui.placeholder}>
        <p>{placeholder}</p>
      </div>
    )
  }

  const hasDescription = !!(question.description ?? question.explanation)
  const answered = pick !== null
  const splitLayout = visualFullscreen && showDescription && hasDescription

  const quizBlock = (
    <>
      <p className={ui.question}>{question.question}</p>
      <QuizTeacherHint question={question} disabled={pick !== null} />
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
      {answered && status === 'bad' && !showDescription && hasDescription && question.explanation ? (
        <p className={ui.explain}>{question.explanation}</p>
      ) : null}
      {answered && onDraw && ui.actionRow ? (
        <div className={ui.actionRow}>
          {hasDescription && ui.descBtn ? (
            <button type="button" className={ui.descBtn} onClick={onToggleDescription}>
              {showDescription ? t('learn.topicQuiz.hideDescription') : t('learn.topicQuiz.showDescription')}
            </button>
          ) : null}
          <button type="button" className={ui.nextBtn ?? ui.descBtn} onClick={onDraw}>
            {drawLabel ?? t('learn.topicQuiz.next')}
          </button>
        </div>
      ) : null}
    </>
  )

  return (
    <div
      key={animKey}
      className={`${ui.questionWrap}${splitLayout && ui.questionWrapSplit ? ` ${ui.questionWrapSplit}` : ''}`}
    >
      {splitLayout && ui.quizCol ? <div className={ui.quizCol}>{quizBlock}</div> : quizBlock}
      <TopicQuizDescription
        ui={ui}
        question={question}
        open={showDescription && hasDescription}
        visualCompact={visualCompact}
        visualFullscreen={visualFullscreen}
        visualSplit={splitLayout}
      />
    </div>
  )
}

export function LearnTopicQuizCard({ grade, chapter, section, autoReveal = false }: Props) {
  const { t, locale } = useT()
  const poolSize = topicQuizPoolSize(grade.id, chapter.id, section.id)
  const [revealed, setRevealed] = useState(autoReveal)
  const [question, setQuestion] = useState<TopicQuizItem | null>(null)
  const [pick, setPick] = useState<number | null>(null)
  const [seen, setSeen] = useState<Set<string>>(() => new Set())
  const [animKey, setAnimKey] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [showDescription, setShowDescription] = useState(false)

  const drawQuestion = useCallback(() => {
    const next = pickRandomTopicQuiz(grade.id, chapter.id, section.id, seen, locale)
    setQuestion(next)
    setPick(null)
    setRevealed(true)
    setShowDescription(false)
    setAnimKey((k) => k + 1)
    setSeen((prev) => {
      const n = new Set(prev)
      n.add(quizDedupeKey(next))
      if (n.size >= poolSize * 0.8) return new Set([quizDedupeKey(next)])
      return n
    })
  }, [chapter.id, grade.id, locale, poolSize, section.id, seen])

  useEffect(() => {
    setSeen(new Set())
    setQuestion(null)
    setPick(null)
    setRevealed(autoReveal)
  }, [grade.id, chapter.id, section.id, autoReveal, locale])

  useEffect(() => {
    if (autoReveal && !question) drawQuestion()
  }, [autoReveal, drawQuestion, question, grade.id, chapter.id, section.id])

  const handlePick = useCallback((idx: number) => {
    setPick(idx)
    if (!question) return
    const ok = idx === question.correctIndex
    setShowDescription(!ok)
  }, [question])

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

  useEffect(() => {
    if (!question?.visualId) return
    const spec = getQuizVisualSpec(question.visualId)
    if (spec) prefetchLearnImage(spec.src)
  }, [question?.visualId])

  const bodyProps = {
    revealed,
    question,
    pick,
    onPick: handlePick,
    status,
    animKey,
    placeholder,
    showDescription,
    onToggleDescription: () => setShowDescription((v) => !v),
    visualCompact: false,
    visualFullscreen: true,
    onDraw: drawQuestion,
    drawLabel,
  }

  const cardBodyProps = { ...bodyProps, visualCompact: true, visualFullscreen: false }
  const showHeaderDraw = !revealed || pick === null

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
            {showHeaderDraw ? (
              <button type="button" className={styles.drawBtn} onClick={drawQuestion}>
                {drawLabel}
              </button>
            ) : null}
          </div>
        </div>
        <TopicQuizBody ui={CARD_UI} {...cardBodyProps} />
      </section>

      {fullscreen ? (
        <LearnTopicQuizFullscreen
          title={t('learn.topicQuiz.title')}
          meta={`${poolMeta} · ${sectionTitle}`}
          onClose={closeFullscreen}
        >
          <TopicQuizBody ui={FS_UI} {...bodyProps} />
        </LearnTopicQuizFullscreen>
      ) : null}
    </>
  )
}
