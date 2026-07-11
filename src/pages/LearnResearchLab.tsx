import { useEffect } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ResearchBuilderMode } from '../components/learn/research/ResearchBuilderMode'
import { ORGANIC_BUILD_CHALLENGES } from '../data/researchLab/researchLabData'
import { useT } from '../i18n/useT'
import styles from './LearnResearchLab.module.css'

/** Всё в одной 3D-студии; старые URL режимов → builder. */
const LEGACY_REDIRECT = new Set(['attack', 'detective', 'equilibrium', 'isomers'])

function resolveChallenge(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  if (raw === 'hexane') return 'n-hexane'
  if (ORGANIC_BUILD_CHALLENGES.some((c) => c.id === raw)) return raw
  return undefined
}

export function LearnResearchLab() {
  const { t } = useT()
  const { mode: modeParam } = useParams<{ mode?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (modeParam && modeParam !== 'builder' && LEGACY_REDIRECT.has(modeParam)) {
      navigate(`/learn/research/builder`, { replace: true })
    }
  }, [modeParam, navigate])

  const initialBuilderChallenge = resolveChallenge(searchParams.get('challenge') ?? undefined)

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} to="/learn">
        {t('learn.research.back')}
      </Link>
      <h1 className={styles.h}>{t('learn.research.title')}</h1>
      <p className={styles.lead}>{t('learn.research.lead')}</p>

      <div className={styles.workspace}>
        <ResearchBuilderMode
          key={initialBuilderChallenge ?? 'default'}
          initialChallengeId={initialBuilderChallenge}
          onMacro={() => {}}
        />
      </div>
    </div>
  )
}
