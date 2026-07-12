import { useMemo, useState } from 'react'
import {
  ISOMER_CHALLENGES,
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

/** Режим «Изомеры» для органической программы (Kimyo 10). */
export function ResearchIsomersMode({
  allowedChallengeIds,
  onComplete,
}: {
  allowedChallengeIds?: readonly string[]
  onComplete?: () => void
}) {
  const { t } = useT()
  const { locale } = useLocale()
  const pool = useMemo(() => {
    if (!allowedChallengeIds?.length) return [...ISOMER_CHALLENGES]
    const set = new Set(allowedChallengeIds)
    const filtered = ISOMER_CHALLENGES.filter((c) => set.has(c.id))
    return filtered.length > 0 ? filtered : [...ISOMER_CHALLENGES]
  }, [allowedChallengeIds])

  const [challengeId, setChallengeId] = useState(pool[0]!.id)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [checked, setChecked] = useState(false)

  const challenge = useMemo(
    () => pool.find((c) => c.id === challengeId) ?? pool[0]!,
    [challengeId, pool],
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
        {pool.map((c: IsomerChallenge) => (
          <button
            key={c.id}
            type="button"
            className={challengeId === c.id ? `${styles.btn} ${styles.btnPrimary}` : styles.btn}
            onClick={() => {
              setChallengeId(c.id)
              setSelected(new Set())
              setChecked(false)
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
            </div>
          )
        })}
      </div>
      <div className={styles.challengeBar} style={{ marginTop: '0.75rem' }}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => {
            setChecked(true)
            if (
              selectedCorrect.length === challenge.targetCount &&
              !hasWrong &&
              selected.size === challenge.targetCount
            ) {
              onComplete?.()
            }
          }}
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
