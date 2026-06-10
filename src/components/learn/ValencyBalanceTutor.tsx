import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildGenerateEquationLabUrl } from '../../data/learnSectionEquations'
import {
  G7_BALANCE_LESSONS,
  asciiToUnicodeFormula,
  checkBalanceAnswer,
  formatEquationSide,
  initialCoeffs,
  unbalancedElements,
  type BalanceLesson,
} from '../../learn/valencyBalanceEngine'
import { useT, type MessageKey } from '../../i18n/useT'
import { getBalanceLessonVisual, getBalanceStepPhoto } from '../../learn/balanceLessonVisuals'
import { BalanceLessonPhoto } from './BalanceLessonPhoto'
import styles from './ValencyBalanceTutor.module.css'

type Props = {
  gradeId?: string
  chapterId?: string
  sectionId?: string
  embedded?: boolean
}

function CoeffControl({
  termId,
  formula,
  value,
  onChange,
  disabled,
}: {
  termId: string
  formula: string
  value: number
  onChange: (id: string, v: number) => void
  disabled?: boolean
}) {
  return (
    <div className={styles.termRow}>
      <div className={styles.termControls}>
        <button
          type="button"
          className={styles.coeffBtn}
          disabled={disabled || value <= 1}
          onClick={() => onChange(termId, value - 1)}
          aria-label="-"
        >
          −
        </button>
        <span className={styles.coeffValue}>{value}</span>
        <button
          type="button"
          className={styles.coeffBtn}
          disabled={disabled || value >= 12}
          onClick={() => onChange(termId, value + 1)}
          aria-label="+"
        >
          +
        </button>
      </div>
      <span className={styles.termFormula}>{asciiToUnicodeFormula(formula)}</span>
    </div>
  )
}

function BalanceLessonCard({
  lesson,
  gradeId,
  chapterId,
  sectionId,
}: {
  lesson: BalanceLesson
  gradeId?: string
  chapterId?: string
  sectionId?: string
}) {
  const { t } = useT()
  const [coeffs, setCoeffs] = useState(() => initialCoeffs(lesson))
  const [step, setStep] = useState(0)
  const [checked, setChecked] = useState<'idle' | 'ok' | 'bad'>('idle')

  const result = useMemo(() => checkBalanceAnswer(lesson, coeffs), [lesson, coeffs])
  const badAtoms = useMemo(
    () => unbalancedElements(lesson.left, lesson.right, coeffs),
    [lesson, coeffs],
  )

  const onCoeff = useCallback((id: string, v: number) => {
    setCoeffs((prev) => ({ ...prev, [id]: Math.max(1, Math.min(12, v)) }))
    setChecked('idle')
  }, [])

  const onCheck = () => {
    setChecked(result.ok ? 'ok' : 'bad')
  }

  const onReset = () => {
    setCoeffs(initialCoeffs(lesson))
    setStep(0)
    setChecked('idle')
  }

  const onShowAnswer = () => {
    setCoeffs({ ...lesson.correct })
    setChecked('ok')
  }

  const labUrl =
    gradeId && chapterId && sectionId
      ? buildGenerateEquationLabUrl(gradeId, chapterId, sectionId)
      : '/#/?reactor=1&genEq=1'

  const maxStep = lesson.stepKeys.length - 1
  const visual = getBalanceLessonVisual(lesson.id)
  const stepPhoto = getBalanceStepPhoto(lesson.id, step)

  return (
    <article className={styles.lessonCard}>
      <div className={styles.lessonTop}>
        <header className={styles.lessonHead}>
          <h4 className={styles.lessonTitle}>{t(lesson.titleKey as MessageKey)}</h4>
          <p className={styles.equationDisplay}>{lesson.equationDisplay}</p>
        </header>
        {visual ? <BalanceLessonPhoto spec={visual.hero} variant="hero" /> : null}
      </div>

      {lesson.diatomicNoteKey ? (
        <p className={styles.diatomicNote}>{t(lesson.diatomicNoteKey as MessageKey)}</p>
      ) : null}

      <div className={styles.valencyGrid}>
        {[...lesson.left, ...lesson.right].map((term) =>
          term.valencyKey ? (
            <span key={term.id} className={styles.valencyChip}>
              {asciiToUnicodeFormula(term.formula)} — {t(term.valencyKey as MessageKey)}
            </span>
          ) : null,
        )}
      </div>

      <div className={styles.equationBuilder}>
        <div className={styles.equationSide}>
          <span className={styles.sideLabel}>{t('learn.balance.reagents')}</span>
          {lesson.left.map((term) => (
            <CoeffControl
              key={term.id}
              termId={term.id}
              formula={term.formula}
              value={coeffs[term.id] ?? 1}
              onChange={onCoeff}
            />
          ))}
        </div>
        <span className={styles.arrow}>→</span>
        <div className={styles.equationSide}>
          <span className={styles.sideLabel}>{t('learn.balance.products')}</span>
          {lesson.right.map((term) => (
            <CoeffControl
              key={term.id}
              termId={term.id}
              formula={term.formula}
              value={coeffs[term.id] ?? 1}
              onChange={onCoeff}
            />
          ))}
        </div>
      </div>

      <p className={styles.preview}>
        {formatEquationSide(lesson.left, coeffs)} → {formatEquationSide(lesson.right, coeffs)}
      </p>

      {badAtoms.length > 0 && checked !== 'ok' ? (
        <p className={styles.atomHint}>
          {t('learn.balance.unbalanced', { atoms: badAtoms.join(', ') })}
        </p>
      ) : null}

      <div className={styles.stepBox}>
        {stepPhoto ? <BalanceLessonPhoto spec={stepPhoto} variant="step" /> : null}
        <div className={styles.stepBody}>
          <span className={styles.stepBadge}>
            {t('learn.balance.stepLabel', { n: String(step + 1), total: String(lesson.stepKeys.length) })}
          </span>
          <p className={styles.stepText}>{t(lesson.stepKeys[step]! as MessageKey)}</p>
          <div className={styles.stepNav}>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={step <= 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            {t('learn.balance.prevStep')}
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={step >= maxStep}
            onClick={() => setStep((s) => Math.min(maxStep, s + 1))}
          >
            {t('learn.balance.nextStep')}
          </button>
        </div>
        </div>
      </div>

      <div className={styles.actionRow}>
        <button type="button" className={styles.primaryBtn} onClick={onCheck}>
          {t('learn.balance.check')}
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={onReset}>
          {t('learn.balance.reset')}
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={onShowAnswer}>
          {t('learn.balance.showAnswer')}
        </button>
      </div>

      {checked === 'ok' ? (
        <p className={styles.feedbackOk}>{t('learn.balance.correct')}</p>
      ) : null}
      {checked === 'bad' ? (
        <p className={styles.feedbackBad}>
          {result.balanced ? t('learn.balance.wrongRatio') : t('learn.balance.wrongAtoms')}
        </p>
      ) : null}

      {lesson.labProductId ? (
        <Link className={styles.labLink} to={`${labUrl}&product=${lesson.labProductId}`}>
          {t('learn.balance.openLab')}
        </Link>
      ) : null}
    </article>
  )
}

export function ValencyBalanceTutor({ gradeId, chapterId, sectionId, embedded = false }: Props) {
  const { t } = useT()
  const [lessonId, setLessonId] = useState(G7_BALANCE_LESSONS[0]!.id)

  const lesson = G7_BALANCE_LESSONS.find((l) => l.id === lessonId) ?? G7_BALANCE_LESSONS[0]!

  return (
    <section className={embedded ? styles.embedded : styles.shell}>
      {!embedded ? (
        <header className={styles.head}>
          <span className={styles.badge}>{t('learn.balance.badge')}</span>
          <h3 className={styles.title}>{t('learn.balance.title')}</h3>
          <p className={styles.lead}>{t('learn.balance.lead')}</p>
        </header>
      ) : null}

      <div className={styles.lessonPicker} role="tablist" aria-label={t('learn.balance.pickLesson')}>
        {G7_BALANCE_LESSONS.map((l) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            aria-selected={l.id === lessonId}
            className={l.id === lessonId ? styles.lessonTabActive : styles.lessonTab}
            onClick={() => setLessonId(l.id)}
          >
            {t(l.titleKey as MessageKey)}
          </button>
        ))}
      </div>

      <BalanceLessonCard
        key={lessonId}
        lesson={lesson}
        gradeId={gradeId}
        chapterId={chapterId}
        sectionId={sectionId}
      />
    </section>
  )
}
