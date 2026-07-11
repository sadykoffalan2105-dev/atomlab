import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { IrSpectrumChart } from '../components/learn/research/IrSpectrumChart'
import { ResearchAttackMode } from '../components/learn/research/ResearchAttackMode'
import { ResearchBuilderMode } from '../components/learn/research/ResearchBuilderMode'
import { ResearchDetectiveMode } from '../components/learn/research/ResearchDetectiveMode'
import { ResearchEquilibriumMode } from '../components/learn/research/ResearchEquilibriumMode'
import { ResearchIsomersMode } from '../components/learn/research/ResearchIsomersMode'
import {
  ORGANIC_BUILD_CHALLENGES,
  RESEARCH_LAB_MODES,
  type IrPeak,
  type ResearchLabModeId,
} from '../data/researchLab/researchLabData'
import { useT } from '../i18n/useT'
import type { MessageKey } from '../i18n/useT'
import styles from './LearnResearchLab.module.css'

const MODE_IDS = new Set<ResearchLabModeId>([
  'builder',
  'isomers',
  'attack',
  'equilibrium',
  'detective',
])

const MODE_TITLE_KEYS: Record<ResearchLabModeId, MessageKey> = {
  builder: 'learn.research.mode.builder',
  isomers: 'learn.research.mode.isomers',
  attack: 'learn.research.mode.attack',
  equilibrium: 'learn.research.mode.equilibrium',
  detective: 'learn.research.mode.detective',
}

function parseMode(raw: string | undefined): ResearchLabModeId {
  if (raw && MODE_IDS.has(raw as ResearchLabModeId)) return raw as ResearchLabModeId
  return 'builder'
}

export function LearnResearchLab() {
  const { t } = useT()
  const { mode: modeParam } = useParams<{ mode?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const mode = parseMode(modeParam)

  const challengeParam = searchParams.get('challenge') ?? undefined
  const initialBuilderChallenge =
    challengeParam && ORGANIC_BUILD_CHALLENGES.some((c) => c.id === challengeParam)
      ? challengeParam
      : undefined

  const [peaks, setPeaks] = useState<readonly IrPeak[]>([])
  const [irLabel, setIrLabel] = useState('')
  const [macro, setMacro] = useState('')

  const setMode = (id: ResearchLabModeId) => {
    setPeaks([])
    setIrLabel('')
    setMacro('')
    navigate(`/learn/research/${id}`, { replace: true })
  }

  const onSpectrum = (next: readonly IrPeak[], label: string) => {
    setPeaks(next)
    setIrLabel(label)
  }

  const modeTitleKey = MODE_TITLE_KEYS[mode]

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} to="/learn">
        {t('learn.research.back')}
      </Link>
      <h1 className={styles.h}>{t('learn.research.title')}</h1>
      <p className={styles.lead}>{t('learn.research.lead')}</p>

      <div className={styles.modeRow} role="tablist" aria-label={t('learn.research.modesAria')}>
        {RESEARCH_LAB_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            className={`${styles.modeBtn} ${mode === m.id ? styles.modeBtnActive : ''}`}
            style={{ ['--mode-accent' as string]: m.accent }}
            onClick={() => setMode(m.id)}
          >
            {t(MODE_TITLE_KEYS[m.id])}
          </button>
        ))}
      </div>

      <div className={styles.zones}>
        <section
          className={`${styles.zone} ${mode === 'builder' ? styles.zoneWide : ''}`}
          aria-labelledby="research-micro"
        >
          <h2 className={styles.zoneTitle} id="research-micro">
            {t('learn.research.zoneMicro')} · {t(modeTitleKey)}
          </h2>
          <div className={styles.zoneBody}>
            {mode === 'builder' ? (
              <ResearchBuilderMode
                key={initialBuilderChallenge ?? 'default'}
                initialChallengeId={initialBuilderChallenge}
                onSpectrum={onSpectrum}
                onMacro={setMacro}
              />
            ) : null}
            {mode === 'isomers' ? (
              <ResearchIsomersMode onSpectrum={onSpectrum} onMacro={setMacro} />
            ) : null}
            {mode === 'attack' ? <ResearchAttackMode onMacro={setMacro} /> : null}
            {mode === 'equilibrium' ? <ResearchEquilibriumMode onMacro={setMacro} /> : null}
            {mode === 'detective' ? (
              <ResearchDetectiveMode onSpectrum={onSpectrum} onMacro={setMacro} />
            ) : null}
          </div>
        </section>

        <section className={styles.zone} aria-labelledby="research-macro">
          <h2 className={styles.zoneTitle} id="research-macro">
            {t('learn.research.zoneMacro')}
          </h2>
          <div className={styles.macroPane}>{macro || t('learn.research.macroEmpty')}</div>
        </section>

        <section className={`${styles.zone} ${styles.zoneWide}`} aria-labelledby="research-ir">
          <h2 className={styles.zoneTitle} id="research-ir">
            {t('learn.research.zoneAnalytics')}
          </h2>
          <IrSpectrumChart
            peaks={peaks}
            title={irLabel ? `${t('learn.research.irTitle')}: ${irLabel}` : t('learn.research.irTitle')}
            emptyLabel={t('learn.research.irEmpty')}
          />
        </section>
      </div>
    </div>
  )
}
