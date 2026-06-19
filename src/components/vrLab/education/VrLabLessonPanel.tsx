import { useMemo, useState } from 'react'
import { compoundById } from '../../../data/compounds'
import { useT, type MessageKey } from '../../../i18n/useT'
import type { LessonPhase } from '../../../vrLab/lessons/types'
import {
  isLessonPracticeUnlocked,
  markQuizResult,
  markTheoryDone,
  readLessonProgress,
} from '../../../vrLab/lessons/vrLabLessonProgress'
import { VR_LAB_LESSONS, vrLabLessonById } from '../../../vrLab/lessons/vrLabLessonModules'
import styles from '../../../pages/VrLabPage.module.css'

type Props = {
  activeLessonId: string | null
  onSelectLesson: (id: string | null) => void
  onStartPractice: (lessonId: string, compoundA: string, compoundB: string) => void
  practiceDone: boolean
}

export function VrLabLessonPanel({
  activeLessonId,
  onSelectLesson,
  onStartPractice,
  practiceDone,
}: Props) {
  const { t } = useT()
  const [phase, setPhase] = useState<LessonPhase>('theory')
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)

  const lesson = activeLessonId ? vrLabLessonById(activeLessonId) : VR_LAB_LESSONS[0]
  const progress = useMemo(
    () => (lesson ? readLessonProgress(lesson.id) : null),
    [lesson, practiceDone, quizSubmitted],
  )

  if (!lesson) return null

  const score = useMemo(() => {
    if (!quizSubmitted) return 0
    let correct = 0
    for (const q of lesson.quiz) {
      if (quizAnswers[q.id] === q.options.find((o) => o.correct)?.id) correct++
    }
    return lesson.quiz.length > 0 ? correct / lesson.quiz.length : 1
  }, [lesson.quiz, quizAnswers, quizSubmitted])

  const passed = progress?.quizPassed || score >= 0.8

  const allQuizAnswered = lesson.quiz.every((q) => quizAnswers[q.id] != null)

  const onSubmitQuiz = () => {
    let correct = 0
    for (const q of lesson.quiz) {
      if (quizAnswers[q.id] === q.options.find((o) => o.correct)?.id) correct++
    }
    const finalScore = lesson.quiz.length > 0 ? correct / lesson.quiz.length : 1
    setQuizSubmitted(true)
    markQuizResult(lesson.id, finalScore, finalScore >= 0.8)
  }

  return (
    <div className={styles.lessonPanel}>
      <div className={styles.lessonHeader}>
        <p className={styles.lessonKicker}>{t('vrLab.lesson.kicker')}</p>
        <h2 className={styles.lessonTitle}>{t(lesson.titleKey as MessageKey)}</h2>
        <select
          className={styles.lessonSelect}
          value={lesson.id}
          onChange={(e) => {
            onSelectLesson(e.target.value)
            setPhase('theory')
            setQuizSubmitted(false)
            setQuizAnswers({})
          }}
        >
          {VR_LAB_LESSONS.map((l) => (
            <option key={l.id} value={l.id}>
              {t(l.titleKey as MessageKey)}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.lessonTabs}>
        {(['theory', 'quiz', 'practice'] as LessonPhase[]).map((tab) => (
          <button
            key={tab}
            type="button"
            className={phase === tab ? styles.lessonTabOn : styles.lessonTab}
            disabled={
              (tab === 'quiz' && !progress?.theoryDone) ||
              (tab === 'practice' && !isLessonPracticeUnlocked(lesson.id))
            }
            onClick={() => setPhase(tab)}
          >
            {t(`vrLab.lesson.phase.${tab}` as MessageKey)}
          </button>
        ))}
      </div>

      {phase === 'theory' ? (
        <div className={styles.lessonBody}>
          {lesson.theoryKeys.map((key) => (
            <p key={key} className={styles.lessonPara}>
              {t(key as MessageKey)}
            </p>
          ))}
          <ul className={styles.lessonSafety}>
            {lesson.safetyKeys.map((key) => (
              <li key={key}>{t(key as MessageKey)}</li>
            ))}
          </ul>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => {
              markTheoryDone(lesson.id)
              setPhase('quiz')
            }}
          >
            {t('vrLab.lesson.toQuiz')}
          </button>
        </div>
      ) : null}

      {phase === 'quiz' ? (
        <div className={styles.lessonBody}>
          {lesson.quiz.map((q) => (
            <fieldset key={q.id} className={styles.quizBlock}>
              <legend>{t(q.promptKey as MessageKey)}</legend>
              {q.options.map((opt) => (
                <label key={opt.id} className={styles.quizOption}>
                  <input
                    type="radio"
                    name={q.id}
                    checked={quizAnswers[q.id] === opt.id}
                    disabled={quizSubmitted}
                    onChange={() => setQuizAnswers((a) => ({ ...a, [q.id]: opt.id }))}
                  />
                  {t(opt.labelKey as MessageKey)}
                </label>
              ))}
              {quizSubmitted ? (
                <p className={styles.quizExp}>{t(q.explanationKey as MessageKey)}</p>
              ) : null}
            </fieldset>
          ))}
          {!quizSubmitted ? (
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={!allQuizAnswered}
              onClick={onSubmitQuiz}
            >
              {t('vrLab.lesson.submitQuiz')}
            </button>
          ) : (
            <p className={styles.quizScore}>
              {t('vrLab.lesson.quizScore', { n: Math.round(score * 100) })}
              {passed ? ` · ${t('vrLab.lesson.quizPassed')}` : ` · ${t('vrLab.lesson.quizRetry')}`}
            </p>
          )}
          {passed ? (
            <button type="button" className={styles.btnPrimary} onClick={() => setPhase('practice')}>
              {t('vrLab.lesson.toPractice')}
            </button>
          ) : null}
        </div>
      ) : null}

      {phase === 'practice' ? (
        <div className={styles.lessonBody}>
          <p className={styles.lessonPara}>{t(lesson.practiceMissionKey as MessageKey)}</p>
          <ul className={styles.practiceChecklist}>
            <li>
              {compoundById[lesson.compounds[0]]?.formulaUnicode ?? lesson.compounds[0]} +{' '}
              {compoundById[lesson.compounds[1]]?.formulaUnicode ?? lesson.compounds[1]}
            </li>
            <li>{t('vrLab.lesson.practiceStepPour')}</li>
            <li>{t('vrLab.lesson.practiceStepObserve')}</li>
          </ul>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => onStartPractice(lesson.id, lesson.compounds[0], lesson.compounds[1])}
          >
            {t('vrLab.lesson.startPractice')}
          </button>
          {progress?.practiceDone ? (
            <p className={styles.lessonComplete}>{t('vrLab.lesson.practiceComplete')}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
