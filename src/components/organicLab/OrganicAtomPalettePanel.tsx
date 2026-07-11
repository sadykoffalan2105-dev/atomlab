import { getElementByZ } from '../../data/elements'
import { ORGANIC_PALETTE } from '../../data/organicLab/organicReactorBalance'
import { useT } from '../../i18n/useT'
import styles from './OrganicAtomPalettePanel.module.css'

export function OrganicAtomPalettePanel({
  open,
  onClose,
  onPickZ,
}: {
  open: boolean
  onClose: () => void
  onPickZ: (z: number) => void
}) {
  const { t } = useT()

  return (
    <>
      <div className={styles.backdrop} data-open={open} onClick={onClose} aria-hidden={!open} />
      <aside
        className={styles.panel}
        data-open={open}
        role="dialog"
        aria-modal="true"
        aria-label={t('organicLab.paletteTitle')}
        aria-hidden={!open}
      >
        <header className={styles.head}>
          <h2 className={styles.title}>{t('organicLab.paletteTitle')}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('element.close')}>
            ×
          </button>
        </header>
        <p className={styles.lead}>{t('organicLab.paletteLead')}</p>
        <div className={styles.grid}>
          {ORGANIC_PALETTE.map((row) => {
            const el = getElementByZ(row.z)
            const cpk = el?.cpkHex ? `#${el.cpkHex}` : '#8899aa'
            return (
              <button
                key={row.z}
                type="button"
                className={styles.atom}
                style={{ ['--cpk' as string]: cpk }}
                onClick={() => onPickZ(row.z)}
              >
                <span className={styles.orb}>{row.symbol}</span>
                <span className={styles.meta}>
                  <strong>{row.symbol}</strong>
                  <small>Z={row.z}</small>
                </span>
              </button>
            )
          })}
        </div>
      </aside>
    </>
  )
}
