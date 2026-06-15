import { memo } from 'react'
import {
  SOLUBILITY_ANIONS,
  SOLUBILITY_CATIONS,
  solubilityMark,
  type SolubilityMark,
} from '../../data/solubilityTableData'
import { useT, type MessageKey } from '../../i18n/useT'
import styles from './SolubilityTable.module.css'

const MARK_CLASS: Record<SolubilityMark, string> = {
  R: styles.markR,
  M: styles.markM,
  N: styles.markN,
  X: styles.markX,
  D: styles.markD,
}

function markLabel(mark: SolubilityMark, t: ReturnType<typeof useT>['t']): string {
  if (mark === 'D') return '—'
  return t(`periodic.solubilityMark${mark}` as MessageKey)
}

export const SolubilityTable = memo(function SolubilityTable({
  wrapClassName,
}: {
  wrapClassName?: string
}) {
  const { t, locale } = useT()

  return (
    <div className={`${styles.wrap} ${wrapClassName ?? ''}`}>
      <h2 className={styles.title}>{t('periodic.solubilityTitle')}</h2>
      <p className={styles.subtitle}>{t('periodic.solubilitySubtitle')}</p>

      <div className={styles.grid} role="table" aria-label={t('periodic.solubilityTitle')}>
        <div className={styles.corner} style={{ gridColumn: 1, gridRow: 1 }} role="columnheader">
          {t('periodic.solubilityCorner')}
        </div>
        {SOLUBILITY_ANIONS.map((an, ci) => (
          <div
            key={an.id}
            className={styles.anionHead}
            style={{ gridColumn: ci + 2, gridRow: 1 }}
            role="columnheader"
          >
            {locale === 'en' ? an.labelEn : an.label}
          </div>
        ))}

        {SOLUBILITY_CATIONS.map((cat, ri) => {
          const row = ri + 2
          return (
            <div key={cat.id} style={{ display: 'contents' }}>
              <div className={styles.cationHead} style={{ gridColumn: 1, gridRow: row }} role="rowheader">
                {locale === 'en' ? cat.labelEn : cat.label}
              </div>
              {SOLUBILITY_ANIONS.map((an, ci) => {
                const mark = solubilityMark(cat.id, an.id)
                return (
                  <div
                    key={`${cat.id}-${an.id}`}
                    className={`${styles.cell} ${MARK_CLASS[mark]}`}
                    style={{ gridColumn: ci + 2, gridRow: row }}
                    role="cell"
                    title={t(`periodic.solubilityLegend${mark}` as MessageKey)}
                  >
                    {markLabel(mark, t)}
                  </div>
                )
              })}
            </div>
          )
        })}

        <div
          className={styles.legendRow}
          style={{ gridRow: 14 }}
          aria-label={t('periodic.solubilityLegendAria')}
        >
          {(['R', 'M', 'N', 'X'] as const).map((mark) => (
            <div key={mark} className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${MARK_CLASS[mark]}`}>{mark}</span>
              <span>{t(`periodic.solubilityLegend${mark}` as MessageKey)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})
