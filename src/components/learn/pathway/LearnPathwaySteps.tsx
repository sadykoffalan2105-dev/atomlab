import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LearnPathwayDef } from '../../../types/learnPathway'
import type { LearnPathwayStepId } from '../../../types/learnPathway'
import { buildPathwayLabUrl } from '../../../data/learnPathways'
import { MoleculePreview } from '../../lab/MoleculePreview'
import { useT, type MessageKey } from '../../../i18n/useT'
import styles from './LearnPathway.module.css'

type StepProps = {
  pathway: LearnPathwayDef
  done: number
  onProgress: (done: number) => void
}

function McQuiz({
  questionKey,
  options,
  correctIndex,
  onCorrect,
}: {
  questionKey: MessageKey
  options: MessageKey[]
  correctIndex: number
  onCorrect: () => void
}) {
  const { t } = useT()
  const [picked, setPicked] = useState<number | null>(null)
  const ok = picked === correctIndex

  const pick = (i: number) => {
    setPicked(i)
    if (i === correctIndex) onCorrect()
  }

  return (
    <div className={styles.quizBlock}>
      <p className={styles.quizQ}>{t(questionKey)}</p>
      <div className={styles.optionGrid}>
        {options.map((key, i) => {
          let cls = styles.optionBtn
          if (picked === i) cls = i === correctIndex ? styles.optionBtnOk : styles.optionBtnBad
          else if (picked !== null && i === correctIndex) cls = styles.optionBtnOk
          return (
            <button key={key} type="button" className={cls} onClick={() => pick(i)}>
              {t(key)}
            </button>
          )
        })}
      </div>
      {picked !== null ? (
        <p className={`${styles.feedback} ${ok ? styles.feedbackOk : styles.feedbackBad}`}>
          {t(ok ? 'learn.pathway.predictions.correct' : 'learn.pathway.predictions.wrong')}
        </p>
      ) : null}
    </div>
  )
}

export function PathwayContextStep({ pathway, done, onProgress }: StepProps) {
  const { t } = useT()
  const checked = done >= 1

  return (
    <>
      <p className={styles.lead}>{t('learn.pathway.context.body')}</p>
      <p className={styles.equation} aria-label={t('learn.pathway.context.equationLabel')}>
        {pathway.equationUnicode}
      </p>
      <div className={styles.preview}>
        <MoleculePreview compoundId={pathway.productCompoundId} />
      </div>
      <label className={styles.checkRow}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onProgress(e.target.checked ? 1 : 0)}
        />
        {t('learn.pathway.context.readDone')}
      </label>
    </>
  )
}

export function PathwayPredictionsStep({ done, onProgress }: StepProps) {
  const answered = useRef(new Set<number>())

  const markCorrect = useCallback(
    (id: number) => {
      if (answered.current.has(id)) return
      answered.current.add(id)
      onProgress(answered.current.size)
    },
    [onProgress],
  )

  return (
    <>
      <McQuiz
        questionKey="learn.pathway.predictions.q1"
        options={[
          'learn.pathway.predictions.q1.a1',
          'learn.pathway.predictions.q1.a2',
          'learn.pathway.predictions.q1.a3',
        ]}
        correctIndex={0}
        onCorrect={() => markCorrect(0)}
      />
      <McQuiz
        questionKey="learn.pathway.predictions.q2"
        options={[
          'learn.pathway.predictions.q2.a1',
          'learn.pathway.predictions.q2.a2',
          'learn.pathway.predictions.q2.a3',
        ]}
        correctIndex={0}
        onCorrect={() => markCorrect(1)}
      />
      {done < 2 ? (
        <p className={styles.lead} aria-live="polite">
          {done}/2
        </p>
      ) : null}
    </>
  )
}

export function PathwayMaterialsStep({ pathway, done, onProgress }: StepProps) {
  const { t } = useT()
  const items: MessageKey[] = [
    'learn.pathway.materials.h2',
    'learn.pathway.materials.o2',
    'learn.pathway.materials.h2o',
  ]

  return (
    <>
      <ul className={styles.materialList}>
        {items.map((key) => (
          <li key={key} className={styles.materialItem}>
            {t(key)}
          </li>
        ))}
      </ul>
      <div className={styles.preview}>
        <MoleculePreview compoundId={pathway.productCompoundId} />
      </div>
      <label className={styles.checkRow}>
        <input
          type="checkbox"
          checked={done >= 1}
          onChange={(e) => onProgress(e.target.checked ? 1 : 0)}
        />
        {t('learn.pathway.materials.viewed')}
      </label>
    </>
  )
}

export function PathwayProtocolStep({ pathway, onProgress }: StepProps) {
  const { t } = useT()
  const labUrl = buildPathwayLabUrl(pathway)
  const [checks, setChecks] = useState([false, false, false])

  const toggle = (idx: number) => {
    const next = [...checks]
    next[idx] = !next[idx]
    setChecks(next)
    onProgress(next.filter(Boolean).length)
  }

  const labels: MessageKey[] = [
    'learn.pathway.protocol.check1',
    'learn.pathway.protocol.check2',
    'learn.pathway.protocol.check3',
  ]

  return (
    <>
      <p className={styles.lead}>{t('learn.pathway.protocol.lead')}</p>
      <a className={`${styles.btnPrimary} ${styles.btn}`} href={labUrl} target="_blank" rel="noreferrer">
        {t('learn.pathway.protocol.openLab')}
      </a>
      <div style={{ marginTop: '1rem' }}>
        {labels.map((key, i) => (
          <label key={key} className={styles.checkRow}>
            <input type="checkbox" checked={checks[i]} onChange={() => toggle(i)} />
            {t(key)}
          </label>
        ))}
      </div>
    </>
  )
}

export function PathwayResultsStep({ pathway, done, onProgress }: StepProps) {
  const { t } = useT()

  return (
    <>
      <p className={styles.lead}>{t('learn.pathway.results.lead')}</p>
      <div className={styles.preview}>
        <MoleculePreview compoundId={pathway.productCompoundId} />
      </div>
      <label className={styles.checkRow}>
        <input
          type="checkbox"
          checked={done >= 1}
          onChange={(e) => onProgress(e.target.checked ? 1 : 0)}
        />
        {t('learn.pathway.results.confirm')}
      </label>
    </>
  )
}

export function PathwayReflectionStep({ done, onProgress }: StepProps) {
  const answered = useRef(new Set<number>())

  const onQ = useCallback(
    (id: number) => {
      if (answered.current.has(id)) return
      answered.current.add(id)
      onProgress(answered.current.size)
    },
    [onProgress],
  )

  return (
    <>
      <McQuiz
        questionKey="learn.pathway.reflection.q1"
        options={[
          'learn.pathway.reflection.q1.a1',
          'learn.pathway.reflection.q1.a2',
        ]}
        correctIndex={0}
        onCorrect={() => onQ(0)}
      />
      <McQuiz
        questionKey="learn.pathway.reflection.q2"
        options={[
          'learn.pathway.reflection.q2.a1',
          'learn.pathway.reflection.q2.a2',
        ]}
        correctIndex={0}
        onCorrect={() => onQ(1)}
      />
      {done < 2 ? (
        <p className={styles.lead} aria-live="polite">
          {done}/2
        </p>
      ) : null}
    </>
  )
}

export function PathwaySummaryStep({ pathway, onProgress }: StepProps) {
  const { t } = useT()
  const labUrl = buildPathwayLabUrl(pathway)

  useEffect(() => {
    onProgress(1)
  }, [onProgress])

  return (
    <>
      <div className={styles.badge}>🏅 {t('learn.pathway.summary.badge')}</div>
      <p className={styles.lead}>{t('learn.pathway.summary.body')}</p>
      <div className={styles.summaryActions}>
        <Link className={`${styles.btnPrimary} ${styles.btn}`} to={`/learn/g/${pathway.gradeId}`}>
          {t('learn.pathway.summary.toGrade')}
        </Link>
        <a className={styles.btn} href={labUrl}>
          {t('learn.pathway.summary.toLab')}
        </a>
      </div>
    </>
  )
}

export function renderPathwayStep(
  stepId: LearnPathwayStepId,
  props: StepProps & { onCompletePathway?: () => void },
) {
  switch (stepId) {
    case 'context':
      return <PathwayContextStep {...props} />
    case 'predictions':
      return <PathwayPredictionsStep {...props} />
    case 'materials':
      return <PathwayMaterialsStep {...props} />
    case 'protocol':
      return <PathwayProtocolStep {...props} />
    case 'results':
      return <PathwayResultsStep {...props} />
    case 'reflection':
      return <PathwayReflectionStep {...props} />
    case 'summary':
      return <PathwaySummaryStep {...props} onProgress={() => props.onProgress(1)} />
    default:
      return null
  }
}
