import { useEffect } from 'react'
import { ELEMENTS, getElementByZ } from '../../data/elements'
import { useT } from '../../i18n/useT'
import { ElementDetailContent } from './ElementDetailContent'
import styles from './ElementDetailModal.module.css'

type Props = {
  z: number | null
  onClose: () => void
  onNavigate?: (z: number) => void
}

export function ElementDetailModal({ z, onClose, onNavigate }: Props) {
  const { t } = useT()

  useEffect(() => {
    if (z == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (onNavigate) {
        if (e.key === 'ArrowLeft') {
          const prev = ELEMENTS.find((el) => el.z === z - 1)
          if (prev) onNavigate(prev.z)
        }
        if (e.key === 'ArrowRight') {
          const next = ELEMENTS.find((el) => el.z === z + 1)
          if (next) onNavigate(next.z)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [z, onClose, onNavigate])

  if (z == null) return null

  const el = getElementByZ(z)
  const prev = ELEMENTS.find((e) => e.z === z - 1)
  const next = ELEMENTS.find((e) => e.z === z + 1)

  if (!el) {
    return (
      <div className={styles.backdrop} role="presentation" onClick={onClose}>
        <div
          className={styles.card}
          role="dialog"
          aria-modal="true"
          aria-labelledby="el-detail-title"
          onClick={(e) => e.stopPropagation()}
        >
          <header className={styles.headFallback}>
            <p id="el-detail-title" className={styles.nameFallback}>
              {t('element.notFound')}
            </p>
            <button type="button" className={styles.close} onClick={onClose} aria-label={t('element.close')}>
              <span className={styles.closeIcon} aria-hidden />
            </button>
          </header>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="el-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        {onNavigate && prev ? (
          <button
            type="button"
            className={styles.navPrev}
            onClick={() => onNavigate(prev.z)}
            aria-label={t('elementDetail.prevElement')}
          >
            ‹
          </button>
        ) : null}
        {onNavigate && next ? (
          <button
            type="button"
            className={styles.navNext}
            onClick={() => onNavigate(next.z)}
            aria-label={t('elementDetail.nextElement')}
          >
            ›
          </button>
        ) : null}

        <button type="button" className={styles.close} onClick={onClose} aria-label={t('element.close')}>
          <span className={styles.closeIcon} aria-hidden />
        </button>

        <div className={styles.cardInner}>
          <ElementDetailContent z={z} titleId="el-detail-title" variant="default" />
        </div>
      </div>
    </div>
  )
}
