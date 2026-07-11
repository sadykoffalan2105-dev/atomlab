import { useState } from 'react'
import { DETECTIVE_CASES, type DetectiveCase } from '../../../data/researchLab/researchLabData'
import { useLocale } from '../../../i18n/useLocale'
import { useT } from '../../../i18n/useT'
import styles from '../../../pages/LearnResearchLab.module.css'

export function ResearchDetectiveMode({
  onSpectrum,
  onMacro,
}: {
  onSpectrum: (peaks: DetectiveCase['irPeaks'], label: string) => void
  onMacro: (text: string) => void
}) {
  const { t } = useT()
  const { locale } = useLocale()
  const caseData = DETECTIVE_CASES[0]!
  const [picked, setPicked] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  const title =
    locale === 'en' ? caseData.titleEn : locale === 'uz' ? caseData.titleUz : caseData.titleRu
  const clue =
    locale === 'en' ? caseData.clueEn : locale === 'uz' ? caseData.clueUz : caseData.clueRu
  const macroHint =
    locale === 'en'
      ? caseData.macroHintEn
      : locale === 'uz'
        ? caseData.macroHintUz
        : caseData.macroHintRu

  const labelOf = (o: (typeof caseData.options)[number]) =>
    locale === 'en' ? o.labelEn : locale === 'uz' ? o.labelUz : o.labelRu

  const runScan = () => {
    onSpectrum(caseData.irPeaks, title)
    onMacro(macroHint)
  }

  const ok = picked === caseData.answerId

  return (
    <div>
      <p className={styles.hint}>
        <strong>{title}</strong>
      </p>
      <p className={styles.hint}>{clue}</p>
      <button type="button" className={styles.btn} style={{ margin: '0.45rem 0' }} onClick={runScan}>
        {t('learn.research.irScan')}
      </button>
      <div className={styles.optionList}>
        {caseData.options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`${styles.optionBtn} ${picked === o.id ? styles.optionBtnSelected : ''}`}
            onClick={() => {
              setPicked(o.id)
              setChecked(false)
            }}
          >
            {labelOf(o)}
          </button>
        ))}
      </div>
      <div className={styles.challengeBar} style={{ marginTop: '0.65rem' }}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={!picked}
          onClick={() => {
            setChecked(true)
            onMacro(
              ok ? t('learn.research.detectiveOkMacro') : t('learn.research.detectiveBadMacro'),
            )
          }}
        >
          {t('learn.research.detectiveCheck')}
        </button>
        {checked ? (
          ok ? (
            <span className={styles.statusOk}>{t('learn.research.detectiveOk')}</span>
          ) : (
            <span className={styles.statusBad}>{t('learn.research.detectiveBad')}</span>
          )
        ) : null}
      </div>
    </div>
  )
}
