import { useEffect } from 'react'
import { getElementByZ } from '../../data/elements'
import { ElementDetailContent } from './ElementDetailContent'
import styles from './ElementDetailModal.module.css'

export function ElementDetailModal({ z, onClose }: { z: number | null; onClose: () => void }) {
  useEffect(() => {
    if (z == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [z, onClose])

  if (z == null) return null

  const el = getElementByZ(z)
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
              Элемент не найден.
            </p>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
              ×
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
        <ElementDetailContent
          z={z}
          titleId="el-detail-title"
          headerEnd={
            <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          }
        />
      </div>
    </div>
  )
}
