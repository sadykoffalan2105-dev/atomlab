import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LearnPathwayDef } from '../../../types/learnPathway'
import { buildPathwayLabUrl } from '../../../data/learnPathways'
import { readLessonProgress } from '../../../vrLab/lessons/vrLabLessonProgress'
import type { CuratedReactionId } from '../../../vrLab/reactions/curatedReactions'
import { useT, type MessageKey } from '../../../i18n/useT'
import styles from './LearnPathway.module.css'

type StepProps = {
  pathway: LearnPathwayDef
  done: number
  onProgress: (done: number) => void
}

function VrMcQuiz({
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

  return (
    <div className={styles.quizBlock}>
      <p className={styles.quizQ}>{t(questionKey)}</p>
      <div className={styles.optionGrid}>
        {options.map((key, i) => {
          let cls = styles.optionBtn
          if (picked === i) cls = i === correctIndex ? styles.optionBtnOk : styles.optionBtnBad
          else if (picked !== null && i === correctIndex) cls = styles.optionBtnOk
          return (
            <button
              key={key}
              type="button"
              className={cls}
              onClick={() => {
                setPicked(i)
                if (i === correctIndex) onCorrect()
              }}
            >
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

export function VrPathwayContextStep({ pathway, done, onProgress }: StepProps) {
  const { t } = useT()

  return (
    <>
      <p className={styles.lead}>{t('learn.pathway.vrNeutralization.context')}</p>
      <p className={styles.equation}>{pathway.equationUnicode}</p>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={done >= 1} onChange={(e) => onProgress(e.target.checked ? 1 : 0)} />
        {t('learn.pathway.context.readDone')}
      </label>
    </>
  )
}

export function VrPathwayPredictionsStep({ onProgress }: StepProps) {
  const answered = useRef(false)

  const markCorrect = useCallback(() => {
    if (answered.current) return
    answered.current = true
    onProgress(1)
  }, [onProgress])

  return (
    <VrMcQuiz
      questionKey="learn.pathway.vrNeutralization.q1"
      options={[
        'learn.pathway.vrNeutralization.q1a',
        'learn.pathway.vrNeutralization.q1b',
        'learn.pathway.vrNeutralization.q1c',
      ]}
      correctIndex={0}
      onCorrect={markCorrect}
    />
  )
}

export function VrPathwayProtocolStep({ pathway, onProgress }: StepProps) {
  const { t } = useT()
  const vrUrl = buildPathwayLabUrl(pathway)
  const reactionId = (pathway.vrReactionId ?? 'neutralization_hcl_naoh') as CuratedReactionId
  const lessonId = pathway.vrLessonId ?? ''
  const [opened, setOpened] = useState(false)
  const [practiced, setPracticed] = useState(false)

  useEffect(() => {
    if (!lessonId) return
    const tick = window.setInterval(() => {
      const p = readLessonProgress(lessonId)
      if (p.completedReactionIds.includes(reactionId)) setPracticed(true)
    }, 1500)
    return () => window.clearInterval(tick)
  }, [lessonId, reactionId])

  useEffect(() => {
    onProgress((opened ? 1 : 0) + (practiced ? 1 : 0))
  }, [opened, practiced, onProgress])

  return (
    <>
      <p className={styles.lead}>{t('learn.pathway.vrNeutralization.protocol')}</p>
      <a
        className={`${styles.btnPrimary} ${styles.btn}`}
        href={vrUrl}
        target="_blank"
        rel="noreferrer"
        onClick={() => setOpened(true)}
      >
        {t('learn.pathway.vrNeutralization.openVr')}
      </a>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={opened} readOnly />
        {t('learn.pathway.vrNeutralization.openedLab')}
      </label>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={practiced} readOnly />
        {t('learn.pathway.vrNeutralization.practiceDone')}
      </label>
    </>
  )
}

export function VrPathwaySummaryStep({ pathway, onProgress }: StepProps) {
  const { t } = useT()
  const vrUrl = buildPathwayLabUrl(pathway)

  useEffect(() => {
    onProgress(1)
  }, [onProgress])

  return (
    <>
      <div className={styles.badge}>🏅 {t('learn.pathway.summary.badge')}</div>
      <p className={styles.lead}>{t('learn.pathway.vrNeutralization.summary')}</p>
      <div className={styles.summaryActions}>
        <Link className={`${styles.btnPrimary} ${styles.btn}`} to="/learn/pathways">
          {t('learn.pathways.back')}
        </Link>
        <a className={styles.btn} href={vrUrl}>
          {t('learn.pathway.vrNeutralization.openVr')}
        </a>
      </div>
    </>
  )
}

export function renderVrPathwayStep(stepId: string, props: StepProps) {
  switch (stepId) {
    case 'context':
      return <VrPathwayContextStep {...props} />
    case 'predictions':
      return <VrPathwayPredictionsStep {...props} />
    case 'protocol':
      return <VrPathwayProtocolStep {...props} />
    case 'summary':
      return <VrPathwaySummaryStep {...props} />
    default:
      return null
  }
}
