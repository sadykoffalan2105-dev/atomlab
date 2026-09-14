import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ELEMENTS, getElementByZ } from '../../data/elements'
import { useT } from '../../i18n/useT'
import { ElementDetailContent } from './ElementDetailContent'
import styles from './ElementDetailModal.module.css'

type Props = {
  z: number | null
  onClose: () => void
  onNavigate?: (z: number) => void
}

function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg className={styles.navIcon} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        d={dir === 'left' ? 'M14.5 5.5 8 12l6.5 6.5' : 'M9.5 5.5 16 12l-6.5 6.5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Модалка поверх шапки приложения (z-index 80) и любых stacking-контекстов страницы. */
function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return <>{children}</>
  return createPortal(children, document.body)
}

export function ElementDetailModal({ z, onClose, onNavigate }: Props) {
  const { t } = useT()
  const cardRef = useRef<HTMLDivElement>(null)
  const isOpen = z != null

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

  /* При открытии — фокус в диалог (клавиатура/скринридер), при закрытии — вернуть назад. */
  useEffect(() => {
    if (!isOpen) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    cardRef.current?.focus({ preventScroll: true })
    return () => {
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true })
    }
  }, [isOpen])

  /* Смена элемента — прокрутка карточки к началу. */
  useEffect(() => {
    if (z != null) cardRef.current?.scrollTo({ top: 0 })
  }, [z])

  if (z == null) return null

  const el = getElementByZ(z)
  const prev = ELEMENTS.find((e) => e.z === z - 1)
  const next = ELEMENTS.find((e) => e.z === z + 1)

  const closeButton = (
    <button type="button" className={styles.close} onClick={onClose} aria-label={t('element.close')}>
      <span className={styles.closeIcon} aria-hidden />
    </button>
  )

  if (!el) {
    return (
      <ModalPortal>
        <div className={styles.backdrop} role="presentation" onClick={onClose}>
          <div
            ref={cardRef}
            tabIndex={-1}
            className={`${styles.card} ${styles.cardFallback}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="el-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className={styles.headFallback}>
              <p id="el-detail-title" className={styles.nameFallback}>
                {t('element.notFound')}
              </p>
              {closeButton}
            </header>
          </div>
        </div>
      </ModalPortal>
    )
  }

  const actions = (
    <>
      {onNavigate ? (
        <div className={styles.navGroup}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => prev && onNavigate(prev.z)}
            disabled={!prev}
            aria-label={t('elementDetail.prevElement')}
            title={prev ? `${prev.z} · ${prev.symbol}` : undefined}
          >
            <ChevronIcon dir="left" />
            {prev ? <span className={styles.navSymbol}>{prev.symbol}</span> : null}
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => next && onNavigate(next.z)}
            disabled={!next}
            aria-label={t('elementDetail.nextElement')}
            title={next ? `${next.z} · ${next.symbol}` : undefined}
          >
            {next ? <span className={styles.navSymbol}>{next.symbol}</span> : null}
            <ChevronIcon dir="right" />
          </button>
        </div>
      ) : null}
      {closeButton}
    </>
  )

  return (
    <ModalPortal>
      <div className={styles.backdrop} role="presentation" onClick={onClose}>
        <div
          ref={cardRef}
          tabIndex={-1}
          className={styles.card}
          role="dialog"
          aria-modal="true"
          aria-labelledby="el-detail-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.cardInner}>
            <ElementDetailContent z={z} titleId="el-detail-title" variant="default" headerEnd={actions} />
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
