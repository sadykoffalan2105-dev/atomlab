import { useMemo, useState } from 'react'
import {
  NOMENCLATURE_QUIZ_BY_ID,
  type NomenclatureQuestion,
} from '../../data/organicLab/organicNomenclatureQuizzes'
import { useLocale } from '../../i18n/useLocale'
import { useT } from '../../i18n/useT'
import styles from './OrganicNomenclatureMode.module.css'

function pickPrompt(q: NomenclatureQuestion, locale: string) {
  if (locale === 'en') return q.promptEn
  if (locale === 'uz') return q.promptUz
  return q.promptRu
}

function pickOpt(label: { labelRu: string; labelEn: string; labelUz: string }, locale: string) {
  if (locale === 'en') return label.labelEn
  if (locale === 'uz') return label.labelUz
  return label.labelRu
}

export function OrganicNomenclatureMode({
  quizId,
  onComplete,
}: {
  quizId: string
  onComplete?: () => void
}) {
  const { t } = useT()
  const { locale } = useLocale()
  const quiz = NOMENCLATURE_QUIZ_BY_ID[quizId]

  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [done, setDone] = useState(false)

  const question = quiz?.questions[index]
  const title =
    quiz == null
      ? ''
      : locale === 'en'
        ? quiz.titleEn
        : locale === 'uz'
          ? quiz.titleUz
          : quiz.titleRu

  const feedback = useMemo(() => {
    if (!question || !picked) return null
    const opt = question.options.find((o) => o.id === picked)
    return opt?.correct === true
  }, [question, picked])

  if (!quiz || !question) {
    return <p className={styles.empty}>{t('organicLab.nameEmpty')}</p>
  }

  const advance = () => {
    if (picked == null) return
    const opt = question.options.find((o) => o.id === picked)
    const nextCorrect = correctCount + (opt?.correct ? 1 : 0)
    if (index + 1 >= quiz.questions.length) {
      setCorrectCount(nextCorrect)
      setDone(true)
      if (nextCorrect === quiz.questions.length) onComplete?.()
      else if (nextCorrect >= Math.ceil(quiz.questions.length * 0.75)) onComplete?.()
      return
    }
    setCorrectCount(nextCorrect)
    setIndex((i) => i + 1)
    setPicked(null)
  }

  const restart = () => {
    setIndex(0)
    setPicked(null)
    setCorrectCount(0)
    setDone(false)
  }

  if (done) {
    const pass = correctCount >= Math.ceil(quiz.questions.length * 0.75)
    return (
      <div className={styles.wrap}>
        <h2 className={styles.title}>{title}</h2>
        <p className={pass ? styles.ok : styles.bad}>
          {t('organicLab.nameScore', { n: correctCount, total: quiz.questions.length })}
        </p>
        <button type="button" className={styles.primary} onClick={restart}>
          {t('organicLab.nameRetry')}
        </button>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.progress}>
        {t('organicLab.nameProgress', { n: index + 1, total: quiz.questions.length })}
      </p>
      <p className={styles.prompt}>{pickPrompt(question, locale)}</p>
      {question.formula ? <code className={styles.formula}>{question.formula}</code> : null}
      <div className={styles.options} role="listbox" aria-label={t('organicLab.modeName')}>
        {question.options.map((o) => {
          const selected = picked === o.id
          let stateClass = ''
          if (picked && selected) stateClass = o.correct ? styles.optOk : styles.optBad
          else if (picked && o.correct) stateClass = styles.optReveal
          return (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={picked != null}
              className={`${styles.opt} ${selected ? styles.optSelected : ''} ${stateClass}`}
              onClick={() => setPicked(o.id)}
            >
              {pickOpt(o, locale)}
            </button>
          )
        })}
      </div>
      {picked != null ? (
        <div className={styles.footer}>
          <span className={feedback ? styles.ok : styles.bad}>
            {feedback ? t('organicLab.nameCorrect') : t('organicLab.nameWrong')}
          </span>
          <button type="button" className={styles.primary} onClick={advance}>
            {index + 1 >= quiz.questions.length ? t('organicLab.nameFinish') : t('organicLab.nameNext')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
