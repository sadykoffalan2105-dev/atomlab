import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LEARN_GRADES } from '../data/learnCurriculumUz'
import { useT } from '../i18n/useT'
import { IconArrowLeft, IconSparkles } from '../components/learn/hub/HubIcons'
import hub from './LearnHubs.module.css'
import styles from './LearnTalkPage.module.css'

const LearnAssistantPanel = lazy(() =>
  import('../components/learn/LearnAssistantPanel').then((m) => ({ default: m.LearnAssistantPanel })),
)

const GRADE_STORAGE_KEY = 'atomlab-talk-grade'

function readStoredGrade(): string | null {
  try {
    return localStorage.getItem(GRADE_STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * Прямой вход к ИИ-учителю с хаба «Обучение»: без выбора параграфа. Контекст — первый параграф
 * выбранного класса, чтобы учитель опирался на нужный учебник (Kimyo 7–11); диалог голосом
 * запускается той же кнопкой «Начать онлайн-диалог», что и внутри урока.
 */
export function LearnTalkPage() {
  const { t } = useT()
  const [params, setParams] = useSearchParams()
  const requested = params.get('g')
  const [gradeId, setGradeId] = useState<string>(() => {
    const wanted = requested ?? readStoredGrade()
    return LEARN_GRADES.some((g) => g.id === wanted) ? (wanted as string) : LEARN_GRADES[0]!.id
  })

  useEffect(() => {
    try {
      localStorage.setItem(GRADE_STORAGE_KEY, gradeId)
    } catch {
      /* приватный режим */
    }
    if (params.get('g') !== gradeId) {
      const next = new URLSearchParams(params)
      next.set('g', gradeId)
      setParams(next, { replace: true })
    }
  }, [gradeId, params, setParams])

  const grade = useMemo(() => LEARN_GRADES.find((g) => g.id === gradeId) ?? LEARN_GRADES[0]!, [gradeId])
  const chapter = grade.chapters[0]
  const section = chapter?.sections[0]

  return (
    <div className={hub.page}>
      <section className={`${hub.glass} ${styles.head}`}>
        <div className={styles.headText}>
          <span className={hub.eyebrow}>
            <IconSparkles />
            {t('learn.talk.open')}
          </span>
          <h1 className={styles.title}>{t('learn.talk.title')}</h1>
          <p className={hub.lead}>{t('learn.talk.sub')}</p>
          <div className={styles.grades} role="radiogroup" aria-label={t('learn.talk.grade')}>
            <span className={styles.gradesLabel}>{t('learn.talk.grade')}</span>
            {LEARN_GRADES.map((g) => (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={g.id === gradeId}
                className={g.id === gradeId ? styles.gradeOn : styles.grade}
                onClick={() => setGradeId(g.id)}
              >
                {g.id.replace(/\D/g, '')}
              </button>
            ))}
          </div>
        </div>
        <Link className={`${hub.btn} ${styles.back}`} to="/learn">
          <IconArrowLeft />
          {t('learn.talk.back')}
        </Link>
      </section>

      {chapter && section ? (
        <section className={styles.panel} aria-label={t('learn.talk.title')}>
          <Suspense fallback={<div className={styles.loading} aria-busy="true" />}>
            <LearnAssistantPanel
              key={grade.id}
              gradeId={grade.id}
              chapterId={chapter.id}
              section={section}
              slideIndex={0}
              slideTitle={t(section.titleKey)}
              slideBody=""
              grade={grade}
              chapter={chapter}
            />
          </Suspense>
        </section>
      ) : null}
    </div>
  )
}
