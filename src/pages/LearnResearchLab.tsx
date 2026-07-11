import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { lessonForChallengeId } from '../data/organicLab/organicCurriculum'
import { ORGANIC_BUILD_CHALLENGES } from '../data/researchLab/researchLabData'
import { useT } from '../i18n/useT'
import styles from './LearnResearchLab.module.css'

function resolveChallenge(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  if (raw === 'hexane') return 'n-hexane'
  if (ORGANIC_BUILD_CHALLENGES.some((c) => c.id === raw)) return raw
  return undefined
}

function organicLabUrl(challenge?: string): string {
  const p = new URLSearchParams()
  if (challenge) {
    const lesson = lessonForChallengeId(challenge)
    if (lesson) p.set('lesson', lesson.id)
    p.set('challenge', challenge)
    p.set('mol', challenge)
    p.set('mode', 'build')
  }
  const qs = p.toString()
  return qs ? `/organic?${qs}` : '/organic'
}

/** Старые URL research lab → программа органической лаборатории. */
export function LearnResearchLab() {
  const { t } = useT()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const challenge = resolveChallenge(searchParams.get('challenge') ?? undefined)
  const target = organicLabUrl(challenge)

  useEffect(() => {
    navigate(target, { replace: true })
  }, [target, navigate])

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} to="/learn">
        {t('learn.research.back')}
      </Link>
      <h1 className={styles.h}>{t('learn.research.title')}</h1>
      <p className={styles.lead}>{t('learn.research.lead')}</p>
      <p className={styles.lead}>
        <Link to={target}>{t('organicLab.openInLab')}</Link>
      </p>
    </div>
  )
}
