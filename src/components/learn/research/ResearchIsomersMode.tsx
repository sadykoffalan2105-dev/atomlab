import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ISOMER_CHALLENGES,
  organicBuildByIsomerCandidate,
  type IsomerCandidate,
  type IsomerChallenge,
} from '../../../data/researchLab/researchLabData'
import { useLocale } from '../../../i18n/useLocale'
import { useT } from '../../../i18n/useT'
import styles from '../../../pages/LearnResearchLab.module.css'

function pickName(c: IsomerCandidate, locale: string) {
  if (locale === 'en') return c.nameEn
  if (locale === 'uz') return c.nameUz
  return c.nameRu
}

function pickHazard(c: IsomerCandidate, locale: string) {
  if (locale === 'en') return c.hazardEn
  if (locale === 'uz') return c.hazardUz
  return c.hazardRu
}

export function ResearchIsomersMode({
  onSpectrum,
  onMacro,
}: {
  onSpectrum: (peaks: IsomerCandidate['irPeaks'], label: string) => void
  onMacro: (text: string) => void
}) {
  const { t } = useT()
  const { locale } = useLocale()
  const [challengeId, setChallengeId] = useState(ISOMER_CHALLENGES[0]!.id)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [checked, setChecked] = useState(false)

  const challenge = useMemo(
    () => ISOMER_CHALLENGES.find((c) => c.id === challengeId) ?? ISOMER_CHALLENGES[0]!,
    [challengeId],
  )

  const title =
    locale === 'en' ? challenge.titleEn : locale === 'uz' ? challenge.titleUz : challenge.titleRu
  const hint =
    locale === 'en' ? challenge.hintEn : locale === 'uz' ? challenge.hintUz : challenge.hintRu

  const toggle = (id: string) => {
    setChecked(false)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const runIr = (c: IsomerCandidate) => {
    onSpectrum(c.irPeaks, pickName(c, locale))
    onMacro(pickHazard(c, locale))
  }

  const correctIds = challenge.candidates.filter((c) => c.correct).map((c) => c.id)
  const selectedCorrect = [...selected].filter((id) => correctIds.includes(id))
  const hasWrong = [...selected].some((id) => !correctIds.includes(id))
  const complete =
    selectedCorrect.length === challenge.targetCount &&
    !hasWrong &&
    selected.size === challenge.targetCount

  return (
    <div>
      <div className={styles.challengeBar}>
        {ISOMER_CHALLENGES.map((c: IsomerChallenge) => (
          <button
            key={c.id}
            type="button"
            className={challengeId === c.id ? `${styles.btn} ${styles.btnPrimary}` : styles.btn}
            onClick={() => {
              setChallengeId(c.id)
              setSelected(new Set())
              setChecked(false)
              onSpectrum([], '')
              onMacro('')
            }}
          >
            {c.formula}
          </button>
        ))}
      </div>
      <div className={styles.challengeBar}>
        <span className={styles.formulaBadge}>{challenge.formula}</span>
        <strong style={{ fontSize: '0.88rem' }}>{title}</strong>
      </div>
      <p className={styles.hint}>{hint}</p>
      <div className={styles.cardGrid} style={{ marginTop: '0.65rem' }}>
        {challenge.candidates.map((c) => {
          const isOn = selected.has(c.id)
          const build = organicBuildByIsomerCandidate(c.id)
          return (
            <div
              key={c.id}
              className={`${styles.isoCard} ${isOn ? styles.isoCardSelected : ''}`}
              style={{ ['--card-accent' as string]: c.color }}
            >
              <button
                type="button"
                onClick={() => toggle(c.id)}
                style={{
                  appearance: 'none',
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  width: '100%',
                  textAlign: 'left',
                  color: 'inherit',
                  font: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <div className={styles.molPreview} aria-hidden />
                <p className={styles.isoName}>{pickName(c, locale)}</p>
                <p className={styles.isoMeta}>{c.formula}</p>
              </button>
              <button
                type="button"
                className={styles.btn}
                style={{ marginTop: '0.45rem', width: '100%' }}
                onClick={() => runIr(c)}
              >
                {t('learn.research.irScan')}
              </button>
              {build ? (
                <Link
                  className={styles.btn}
                  style={{
                    marginTop: '0.35rem',
                    width: '100%',
                    textAlign: 'center',
                    display: 'block',
                    boxSizing: 'border-box',
                  }}
                  to={`/organic?mode=build&challenge=${build.id}&mol=${build.id}`}
                >
                  {t('learn.research.buildIn3d')}
                </Link>
              ) : null}
            </div>
          )
        })}
      </div>
      <div className={styles.challengeBar} style={{ marginTop: '0.75rem' }}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => setChecked(true)}
          disabled={selected.size === 0}
        >
          {t('learn.research.checkIsomers')}
        </button>
        {checked ? (
          complete ? (
            <span className={styles.statusOk}>{t('learn.research.isomersOk')}</span>
          ) : (
            <span className={styles.statusBad}>{t('learn.research.isomersBad')}</span>
          )
        ) : (
          <span className={styles.hint}>
            {t('learn.research.selectedCount', {
              n: selected.size,
              target: challenge.targetCount,
            })}
          </span>
        )}
      </div>
    </div>
  )
}
