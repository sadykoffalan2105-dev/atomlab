import { memo, useState } from 'react'
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

/** Подсказка ячейки: для «—» (нет данных) отдельного ключа легенды нет. */
function markTitle(mark: SolubilityMark, t: ReturnType<typeof useT>['t']): string | undefined {
  if (mark === 'D') return undefined
  return t(`periodic.solubilityLegend${mark}` as MessageKey)
}

type Hover = { row: number; col: number } | null

export const SolubilityTable = memo(function SolubilityTable({
  wrapClassName,
}: {
  wrapClassName?: string
}) {
  const { t, locale } = useT()
  const [hover, setHover] = useState<Hover>(null)

  return (
    <div className={`${styles.wrap} ${wrapClassName ?? ''}`}>
      <div className={styles.panel}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <h2 className={styles.title}>{t('periodic.solubilityTitle')}</h2>
            <p className={styles.subtitle}>{t('periodic.solubilitySubtitle')}</p>
          </div>
          <div className={styles.legendRow} role="group" aria-label={t('periodic.solubilityLegendAria')}>
            {(['R', 'M', 'N', 'X'] as const).map((mark) => (
              <div key={mark} className={styles.legendItem}>
                <span className={`${styles.legendSwatch} ${MARK_CLASS[mark]}`} aria-hidden>
                  {markLabel(mark, t)}
                </span>
                <span>{t(`periodic.solubilityLegend${mark}` as MessageKey)}</span>
              </div>
            ))}
          </div>
        </header>

        <div className={styles.scroller}>
          <table
            className={styles.table}
            aria-label={t('periodic.solubilityTitle')}
            onMouseLeave={() => setHover(null)}
          >
            <thead>
              <tr>
                <th scope="col" className={styles.corner}>
                  {t('periodic.solubilityCorner')}
                </th>
                {SOLUBILITY_ANIONS.map((an, ci) => (
                  <th
                    key={an.id}
                    scope="col"
                    className={hover?.col === ci ? `${styles.anionHead} ${styles.headHot}` : styles.anionHead}
                  >
                    {locale === 'en' ? an.labelEn : an.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SOLUBILITY_CATIONS.map((cat, ri) => (
                <tr key={cat.id}>
                  <th
                    scope="row"
                    className={hover?.row === ri ? `${styles.cationHead} ${styles.headHot}` : styles.cationHead}
                  >
                    {locale === 'en' ? cat.labelEn : cat.label}
                  </th>
                  {SOLUBILITY_ANIONS.map((an, ci) => {
                    const mark = solubilityMark(cat.id, an.id)
                    const inCross = hover != null && (hover.row === ri || hover.col === ci)
                    const isTarget = hover != null && hover.row === ri && hover.col === ci
                    const tdClass = isTarget
                      ? `${styles.cell} ${styles.cellTarget}`
                      : inCross
                        ? `${styles.cell} ${styles.cellCross}`
                        : styles.cell
                    return (
                      <td
                        key={`${cat.id}-${an.id}`}
                        className={tdClass}
                        title={markTitle(mark, t)}
                        onMouseEnter={() => setHover({ row: ri, col: ci })}
                      >
                        <span className={`${styles.mark} ${MARK_CLASS[mark]}`}>{markLabel(mark, t)}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
})
