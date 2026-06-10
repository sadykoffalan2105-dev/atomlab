import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  composeByValency,
  formatFormulaUnicode,
  formulasMatch,
  G7_FORMULA_TOPICS,
  lessonsForTopic,
  pickFormulaPractice,
  type FormulaLessonItem,
} from '../../learn/formulaValencyEngine'
import { routeTaskCoachReply } from '../../learn/learnTaskCoachRouter'
import { buildTaskCoachBaseContext } from '../../learn/learnTaskCoachClient'
import type { LearnTaskCoachContext } from '../../learn/learnTaskCoachTypes'
import type { LearnTaskGenerated } from '../../learn/learnTaskProblems'
import { useT, type MessageKey } from '../../i18n/useT'
import styles from './FormulaLearningPanel.module.css'

type PanelMode = 'study' | 'practice'
type Feedback = 'idle' | 'ok' | 'bad'

type Props = {
  embedded?: boolean
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const

function roman(n: number): string {
  return ROMAN[n] ?? String(n)
}

export function FormulaLearningPanel({ embedded = false }: Props) {
  const { t, locale } = useT()
  const [panelMode, setPanelMode] = useState<PanelMode>('study')
  const [topicId, setTopicId] = useState(G7_FORMULA_TOPICS[0]!.id)
  const [studyIndex, setStudyIndex] = useState(0)
  const [practiceItem, setPracticeItem] = useState<FormulaLessonItem>(() => pickFormulaPractice())
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<Feedback>('idle')
  const [hintStep, setHintStep] = useState(0)
  const [aiText, setAiText] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiHintsGiven, setAiHintsGiven] = useState(0)
  const messagesRef = useRef<{ role: string; content: string }[]>([])

  const topicLessons = useMemo(() => lessonsForTopic(topicId), [topicId])
  const studyItem = topicLessons[studyIndex] ?? topicLessons[0]
  const currentTopic = G7_FORMULA_TOPICS.find((x) => x.id === topicId)!

  useEffect(() => {
    setStudyIndex(0)
  }, [topicId])

  useEffect(() => {
    setPracticeItem(pickFormulaPractice(topicId))
    setAnswer('')
    setFeedback('idle')
    setHintStep(0)
    setAiText(null)
    setAiHintsGiven(0)
    messagesRef.current = []
  }, [topicId, panelMode])

  const fakeProblem = useMemo(
    (): LearnTaskGenerated => ({
      kind: 'mcq',
      categoryId: 'formulas',
      compoundId: null,
      questionKey: 'learn.formulas.practiceQuestion',
      choiceKeys: ['learn.formulas.placeholder'],
      correctIndex: 0,
    }),
    [],
  )

  const newPractice = useCallback(() => {
    setPracticeItem(pickFormulaPractice(topicId))
    setAnswer('')
    setFeedback('idle')
    setHintStep(0)
    setAiText(null)
    messagesRef.current = []
  }, [topicId])

  const checkAnswer = () => {
    const ok = formulasMatch(answer, practiceItem.formula)
    setFeedback(ok ? 'ok' : 'bad')
  }

  const staticHints = [
    t('learn.formulas.hint.s1', {
      a: practiceItem.elementA,
      va: roman(practiceItem.valencyA),
      b: practiceItem.elementB,
      vb: roman(practiceItem.valencyB),
    }),
    t('learn.formulas.hint.s2'),
    t('learn.formulas.hint.s3', {
      crossA: String(practiceItem.valencyB),
      crossB: String(practiceItem.valencyA),
    }),
  ]

  const askAi = async () => {
    setAiLoading(true)
    const question = t('learn.formulas.practiceQuestion', {
      a: practiceItem.elementA,
      va: roman(practiceItem.valencyA),
      b: practiceItem.elementB,
      vb: roman(practiceItem.valencyB),
    })
    const userMsg = t('learn.formulas.aiAsk')
    messagesRef.current = [...messagesRef.current, { role: 'user', content: userMsg }]

    const taskCoach: LearnTaskCoachContext = {
      categoryId: 'formulas',
      categoryTitle: t('learn.formulas.title'),
      problemKind: 'mcq',
      questionText: question,
      staticHintsRevealed: hintStep,
      aiHintsGiven: aiHintsGiven + 1,
      feedback: feedback === 'ok' ? 'correct' : feedback === 'bad' ? 'wrong' : 'idle',
      userAttempt: answer || undefined,
      scratchpad: answer,
    }

    try {
      const ctx = {
        ...buildTaskCoachBaseContext(locale, t('learn.formulas.title')),
        gradeId: 'g7' as const,
        mode: 'helper' as const,
        taskCoach,
      }
      const routed = await routeTaskCoachReply(messagesRef.current, ctx, fakeProblem)
      const text = routed.text.trim()
      if (text) {
        setAiHintsGiven((n) => n + 1)
        setAiText(text)
        messagesRef.current = [...messagesRef.current, { role: 'assistant', content: text }]
      } else {
        setAiText(t('learn.formulas.aiOffline'))
      }
    } catch {
      setAiText(t('learn.formulas.aiOffline'))
    } finally {
      setAiLoading(false)
    }
  }

  const composedPreview = studyItem
    ? composeByValency(
        studyItem.elementA,
        studyItem.valencyA,
        studyItem.elementB,
        studyItem.valencyB,
      )
    : ''

  return (
    <section className={embedded ? styles.embedded : styles.shell}>
      {!embedded ? (
        <header className={styles.head}>
          <span className={styles.badge}>{t('learn.formulas.badge')}</span>
          <h3 className={styles.title}>{t('learn.formulas.title')}</h3>
          <p className={styles.lead}>{t('learn.formulas.lead')}</p>
        </header>
      ) : null}

      <div className={styles.modeRow} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={panelMode === 'study'}
          className={panelMode === 'study' ? styles.modeBtnActive : styles.modeBtn}
          onClick={() => setPanelMode('study')}
        >
          {t('learn.formulas.modeStudy')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={panelMode === 'practice'}
          className={panelMode === 'practice' ? styles.modeBtnActive : styles.modeBtn}
          onClick={() => setPanelMode('practice')}
        >
          {t('learn.formulas.modePractice')}
        </button>
      </div>

      <div className={styles.topicRow} role="tablist" aria-label={t('learn.formulas.topics')}>
        {G7_FORMULA_TOPICS.map((topic) => (
          <button
            key={topic.id}
            type="button"
            role="tab"
            aria-selected={topic.id === topicId}
            className={topic.id === topicId ? styles.topicActive : styles.topicBtn}
            onClick={() => setTopicId(topic.id)}
          >
            {t(topic.titleKey as MessageKey)}
          </button>
        ))}
      </div>

      {panelMode === 'study' && studyItem ? (
        <article className={styles.card}>
          <p className={styles.topicLead}>{t(currentTopic.leadKey as MessageKey)}</p>
          <h4 className={styles.cardTitle}>{t(studyItem.nameKey as MessageKey)}</h4>

          <div className={styles.crossGrid}>
            <div className={styles.crossCol}>
              <span className={styles.crossLabel}>{studyItem.elementA}</span>
              <span className={styles.crossValency}>{roman(studyItem.valencyA)}</span>
            </div>
            <div className={styles.crossArrows} aria-hidden>
              ↘ ↗
            </div>
            <div className={styles.crossCol}>
              <span className={styles.crossLabel}>{studyItem.elementB}</span>
              <span className={styles.crossValency}>{roman(studyItem.valencyB)}</span>
            </div>
          </div>

          <p className={styles.formulaResult}>
            {t('learn.formulas.result')}: <strong>{formatFormulaUnicode(studyItem.formula)}</strong>
          </p>
          {composedPreview && composedPreview !== studyItem.formula ? (
            <p className={styles.formulaNote}>{t('learn.formulas.complexNote')}</p>
          ) : null}
          <p className={styles.note}>{t(studyItem.noteKey as MessageKey)}</p>

          <div className={styles.navRow}>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={studyIndex <= 0}
              onClick={() => setStudyIndex((i) => Math.max(0, i - 1))}
            >
              {t('learn.formulas.prev')}
            </button>
            <span className={styles.counter}>
              {studyIndex + 1} / {topicLessons.length}
            </span>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={studyIndex >= topicLessons.length - 1}
              onClick={() => setStudyIndex((i) => Math.min(topicLessons.length - 1, i + 1))}
            >
              {t('learn.formulas.next')}
            </button>
          </div>
        </article>
      ) : null}

      {panelMode === 'practice' ? (
        <article className={styles.card}>
          <p className={styles.practiceQ}>
            {t('learn.formulas.practiceQuestion', {
              a: practiceItem.elementA,
              va: roman(practiceItem.valencyA),
              b: practiceItem.elementB,
              vb: roman(practiceItem.valencyB),
            })}
          </p>

          <label className={styles.inputLabel} htmlFor="formula-answer">
            {t('learn.formulas.answerLabel')}
          </label>
          <input
            id="formula-answer"
            className={styles.input}
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value)
              setFeedback('idle')
            }}
            placeholder={t('learn.formulas.placeholder')}
            autoComplete="off"
            spellCheck={false}
          />

          <div className={styles.actionRow}>
            <button type="button" className={styles.primaryBtn} onClick={checkAnswer}>
              {t('learn.formulas.check')}
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={newPractice}>
              {t('learn.formulas.newTask')}
            </button>
          </div>

          {feedback === 'ok' ? <p className={styles.feedbackOk}>{t('learn.formulas.correct')}</p> : null}
          {feedback === 'bad' ? (
            <p className={styles.feedbackBad}>
              {t('learn.formulas.wrong', { ans: formatFormulaUnicode(practiceItem.formula) })}
            </p>
          ) : null}

          <div className={styles.hintBox}>
            <p className={styles.hintTitle}>{t('learn.formulas.hintsTitle')}</p>
            {staticHints.slice(0, hintStep + 1).map((h, i) => (
              <p key={i} className={styles.hintLine}>
                {i + 1}. {h}
              </p>
            ))}
            <div className={styles.hintActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={hintStep >= staticHints.length - 1}
                onClick={() => setHintStep((s) => Math.min(staticHints.length - 1, s + 1))}
              >
                {t('learn.formulas.nextHint')}
              </button>
              <button type="button" className={styles.secondaryBtn} disabled={aiLoading} onClick={() => void askAi()}>
                {aiLoading ? t('learn.formulas.aiLoading') : t('learn.formulas.aiHint')}
              </button>
            </div>
            {aiText ? <p className={styles.aiReply}>{aiText}</p> : null}
            <p className={styles.aiNote}>{t('learn.formulas.aiNote')}</p>
          </div>
        </article>
      ) : null}
    </section>
  )
}
