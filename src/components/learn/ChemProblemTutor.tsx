import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  answersMatch,
  CHEM_FORMULAS,
  CHEM_PRACTICE_TASKS,
  CHEM_WORKED_EXAMPLES,
  parseNumericAnswer,
  pickPracticeTask,
  type ChemFormulaCard,
  type ChemWorkedExample,
} from '../../learn/chemProblemEngine'
import { getProblemVisual } from '../../learn/chemProblemVisuals'
import { useT, type MessageKey } from '../../i18n/useT'
import { ProblemLessonPhoto } from './ProblemLessonPhoto'
import styles from './ChemProblemTutor.module.css'

type PanelMode = 'formulas' | 'examples' | 'practice'
type Feedback = 'idle' | 'ok' | 'bad'

type Props = {
  embedded?: boolean
}

function FormulaCard({ card, index, total }: { card: ChemFormulaCard; index: number; total: number }) {
  const { t } = useT()
  const visual = getProblemVisual(card.id)

  return (
    <article className={styles.formulaCard}>
      <div className={styles.cardTop}>
        <div className={styles.cardHead}>
          <span className={styles.cardIndex}>
            {index + 1} / {total}
          </span>
          <h4 className={styles.cardTitle}>{t(card.titleKey as MessageKey)}</h4>
          <p className={styles.cardLead}>{t(card.leadKey as MessageKey)}</p>
          <div className={styles.formulaBox}>
            <code className={styles.formulaMain}>{card.mainFormula}</code>
          </div>
        </div>
        {visual ? <ProblemLessonPhoto spec={visual.hero} variant="hero" /> : null}
      </div>

      <div className={styles.varBlock}>
        <span className={styles.varLabel}>{t('learn.problems.where')}</span>
        <ul className={styles.varList}>
          {card.variableKeys.map((key) => (
            <li key={key}>{t(key as MessageKey)}</li>
          ))}
        </ul>
      </div>

      {card.transformKeys?.length ? (
        <div className={styles.transformBlock}>
          <span className={styles.varLabel}>{t('learn.problems.transforms')}</span>
          <ul className={styles.transformList}>
            {card.transformKeys.map((key) => (
              <li key={key}>
                <code>{t(key as MessageKey)}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {card.exampleKey ? (
        <p className={styles.exampleLine}>
          <span className={styles.exampleBadge}>{t('learn.problems.exampleBadge')}</span>
          {t(card.exampleKey as MessageKey)}
        </p>
      ) : null}
    </article>
  )
}

function WorkedExampleCard({
  example,
  step,
  onStep,
}: {
  example: ChemWorkedExample
  step: number
  onStep: (n: number) => void
}) {
  const { t } = useT()
  const visual = getProblemVisual(example.id)
  const maxStep = example.steps.length

  return (
    <article className={styles.exampleCard}>
      <div className={styles.cardTop}>
        <div className={styles.cardHead}>
          <h4 className={styles.cardTitle}>{t(example.titleKey as MessageKey)}</h4>
          <div className={styles.givenBlock}>
            <span className={styles.blockLabel}>{t('learn.problems.given')}</span>
            <ul className={styles.givenList}>
              {example.givenKeys.map((key) => (
                <li key={key}>{t(key as MessageKey)}</li>
              ))}
            </ul>
            <p className={styles.findLine}>
              <strong>{t('learn.problems.find')}:</strong> {t(example.findKey as MessageKey)}
            </p>
          </div>
        </div>
        {visual ? <ProblemLessonPhoto spec={visual.hero} variant="hero" /> : null}
      </div>

      <div className={styles.stepBox}>
        <div className={styles.stepBody}>
          <span className={styles.stepBadge}>
            {t('learn.problems.stepLabel', { n: String(step + 1), total: String(maxStep) })}
          </span>
          {example.steps.slice(0, step + 1).map((s, i) => (
            <div key={i} className={styles.stepLine}>
              <p className={styles.stepText}>{t(s.textKey as MessageKey)}</p>
              {s.formula ? <code className={styles.stepFormula}>{s.formula}</code> : null}
            </div>
          ))}
          <div className={styles.stepNav}>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={step <= 0}
              onClick={() => onStep(Math.max(0, step - 1))}
            >
              {t('learn.problems.prevStep')}
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={step >= maxStep - 1}
              onClick={() => onStep(Math.min(maxStep - 1, step + 1))}
            >
              {t('learn.problems.nextStep')}
            </button>
          </div>
          {step >= maxStep - 1 ? (
            <p className={styles.answerLine}>
              <span className={styles.answerBadge}>{t('learn.problems.answer')}</span>
              {t(example.answerKey as MessageKey)}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export function ChemProblemTutor({ embedded = false }: Props) {
  const { t } = useT()
  const [panelMode, setPanelMode] = useState<PanelMode>('formulas')
  const [formulaIndex, setFormulaIndex] = useState(0)
  const [exampleId, setExampleId] = useState(CHEM_WORKED_EXAMPLES[0]!.id)
  const [exampleStep, setExampleStep] = useState(0)
  const [practiceTask, setPracticeTask] = useState(() => pickPracticeTask())
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<Feedback>('idle')
  const [hintStep, setHintStep] = useState(0)
  const [formulaFilter, setFormulaFilter] = useState<string | 'all'>('all')

  const formula = CHEM_FORMULAS[formulaIndex]!
  const example = CHEM_WORKED_EXAMPLES.find((e) => e.id === exampleId) ?? CHEM_WORKED_EXAMPLES[0]!

  const filteredPractice = useMemo(() => {
    if (formulaFilter === 'all') return CHEM_PRACTICE_TASKS
    return CHEM_PRACTICE_TASKS.filter((x) => x.formulaId === formulaFilter)
  }, [formulaFilter])

  useEffect(() => {
    setExampleStep(0)
  }, [exampleId])

  useEffect(() => {
    setPracticeTask(pickPracticeTask(formulaFilter === 'all' ? undefined : formulaFilter))
    setAnswer('')
    setFeedback('idle')
    setHintStep(0)
  }, [formulaFilter, panelMode])

  const newPractice = useCallback(() => {
    setPracticeTask(pickPracticeTask(formulaFilter === 'all' ? undefined : formulaFilter))
    setAnswer('')
    setFeedback('idle')
    setHintStep(0)
  }, [formulaFilter])

  const checkAnswer = () => {
    const n = parseNumericAnswer(answer)
    if (n === null) {
      setFeedback('bad')
      return
    }
    setFeedback(answersMatch(n, practiceTask.correctAnswer, practiceTask.tolerance) ? 'ok' : 'bad')
  }

  const showAnswer = () => {
    setAnswer(String(practiceTask.correctAnswer).replace('.', ','))
    setFeedback('ok')
  }

  return (
    <section className={embedded ? styles.embedded : styles.shell}>
      {!embedded ? (
        <header className={styles.head}>
          <span className={styles.badge}>{t('learn.problems.badge')}</span>
          <h3 className={styles.title}>{t('learn.problems.title')}</h3>
          <p className={styles.lead}>{t('learn.problems.lead')}</p>
        </header>
      ) : null}

      <div className={styles.modeRow} role="tablist">
        {(['formulas', 'examples', 'practice'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={panelMode === m}
            className={panelMode === m ? styles.modeBtnActive : styles.modeBtn}
            onClick={() => setPanelMode(m)}
          >
            {t(`learn.problems.mode.${m}` as MessageKey)}
          </button>
        ))}
      </div>

      {panelMode === 'formulas' ? (
        <>
          <div className={styles.pickerRow} role="tablist">
            {CHEM_FORMULAS.map((f, i) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={i === formulaIndex}
                className={i === formulaIndex ? styles.pickerActive : styles.pickerBtn}
                onClick={() => setFormulaIndex(i)}
              >
                {t(f.titleKey as MessageKey)}
              </button>
            ))}
          </div>
          <FormulaCard card={formula} index={formulaIndex} total={CHEM_FORMULAS.length} />
          <div className={styles.navRow}>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={formulaIndex <= 0}
              onClick={() => setFormulaIndex((i) => Math.max(0, i - 1))}
            >
              {t('learn.problems.prev')}
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={formulaIndex >= CHEM_FORMULAS.length - 1}
              onClick={() => setFormulaIndex((i) => Math.min(CHEM_FORMULAS.length - 1, i + 1))}
            >
              {t('learn.problems.next')}
            </button>
          </div>
        </>
      ) : null}

      {panelMode === 'examples' ? (
        <>
          <div className={styles.pickerRow} role="tablist">
            {CHEM_WORKED_EXAMPLES.map((ex) => (
              <button
                key={ex.id}
                type="button"
                role="tab"
                aria-selected={ex.id === exampleId}
                className={ex.id === exampleId ? styles.pickerActive : styles.pickerBtn}
                onClick={() => setExampleId(ex.id)}
              >
                {t(ex.titleKey as MessageKey)}
              </button>
            ))}
          </div>
          <WorkedExampleCard
            key={exampleId}
            example={example}
            step={exampleStep}
            onStep={setExampleStep}
          />
        </>
      ) : null}

      {panelMode === 'practice' ? (
        <article className={styles.practiceCard}>
          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>{t('learn.problems.practiceFilter')}</span>
            <div className={styles.pickerRow}>
              <button
                type="button"
                className={formulaFilter === 'all' ? styles.pickerActive : styles.pickerBtn}
                onClick={() => setFormulaFilter('all')}
              >
                {t('learn.problems.filterAll')}
              </button>
              {CHEM_FORMULAS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={formulaFilter === f.id ? styles.pickerActive : styles.pickerBtn}
                  onClick={() => setFormulaFilter(f.id)}
                >
                  {t(f.titleKey as MessageKey)}
                </button>
              ))}
            </div>
          </div>

          <p className={styles.practiceCount}>
            {t('learn.problems.practicePool', { n: String(filteredPractice.length) })}
          </p>

          <p className={styles.practiceQ}>
            {t(practiceTask.questionKey as MessageKey, practiceTask.params)}
          </p>

          <label className={styles.inputLabel} htmlFor="problem-answer">
            {t('learn.problems.answerLabel')} ({t(practiceTask.unitKey as MessageKey)})
          </label>
          <input
            id="problem-answer"
            className={styles.input}
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value)
              setFeedback('idle')
            }}
            placeholder={t('learn.problems.placeholder')}
            inputMode="decimal"
            autoComplete="off"
          />

          <div className={styles.actionRow}>
            <button type="button" className={styles.primaryBtn} onClick={checkAnswer}>
              {t('learn.problems.check')}
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={newPractice}>
              {t('learn.problems.newTask')}
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={showAnswer}>
              {t('learn.problems.showAnswer')}
            </button>
          </div>

          {feedback === 'ok' ? <p className={styles.feedbackOk}>{t('learn.problems.correct')}</p> : null}
          {feedback === 'bad' ? <p className={styles.feedbackBad}>{t('learn.problems.wrong')}</p> : null}

          <div className={styles.hintBox}>
            <p className={styles.hintTitle}>{t('learn.problems.hintsTitle')}</p>
            {practiceTask.hintKeys.slice(0, hintStep + 1).map((key, i) => (
              <p key={key} className={styles.hintLine}>
                {i + 1}. {t(key as MessageKey)}
              </p>
            ))}
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={hintStep >= practiceTask.hintKeys.length - 1}
              onClick={() => setHintStep((s) => Math.min(practiceTask.hintKeys.length - 1, s + 1))}
            >
              {t('learn.problems.nextHint')}
            </button>
          </div>
        </article>
      ) : null}
    </section>
  )
}
