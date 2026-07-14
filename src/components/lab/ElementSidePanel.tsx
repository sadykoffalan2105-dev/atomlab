import { useEffect, useLayoutEffect, useRef } from 'react'
import { useT } from '../../i18n/useT'
import { PeriodicTableTextbook } from './PeriodicTableTextbook'
import styles from './ElementSidePanel.module.css'

const PT_LAB_TITLE_ID = 'pt-lab-title'

export function ElementSidePanel({
  open,
  onClose,
  onPickElement,
  onAltPickElement,
  layoutVariant = 'modal',
}: {
  open: boolean
  onClose: () => void
  onPickElement: (z: number) => void
  onAltPickElement?: (z: number) => void
  layoutVariant?: 'modal' | 'labCompact'
}) {
  const { t } = useT()
  const panelRef = useRef<HTMLDivElement>(null)
  const tableWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  /** Подгонка ячеек школьной таблицы под размер панели лаборатории. */
  useLayoutEffect(() => {
    if (!open) return
    const wrap = tableWrapRef.current
    if (!wrap) return

    const compute = () => {
      const aw = Math.max(1, wrap.clientWidth - 4)
      const ah = Math.max(1, wrap.clientHeight - 4)
      const rows = layoutVariant === 'labCompact' ? 13.6 : 16.5
      const gapPx = layoutVariant === 'labCompact' ? 1 : 2
      const sideFr = 0.42
      const elemCols = 10
      const totalFr = sideFr + elemCols
      const usableW = Math.max(1, aw - gapPx * 14)
      const elemColW = (usableW * elemCols) / totalFr / elemCols
      const hByHeight = (ah - gapPx * (rows + 1)) / rows
      const cell = Math.min(hByHeight, elemColW * 1.12)
      const maxCell = layoutVariant === 'labCompact' ? 58 : 72
      const cellPx = Math.max(22, Math.min(cell, maxCell))
      wrap.style.setProperty('--pt-cell-h', `${cellPx}px`)
    }

    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [open, layoutVariant])

  const isLabCompact = layoutVariant === 'labCompact'

  return (
    <>
      {!isLabCompact ? (
        <div
          className={styles.backdrop}
          data-open={open}
          onClick={onClose}
          aria-hidden={!open}
        />
      ) : null}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={!isLabCompact}
        aria-labelledby={isLabCompact ? undefined : PT_LAB_TITLE_ID}
        aria-label={isLabCompact ? t('element.ptAriaLab') : undefined}
        className={
          isLabCompact
            ? `${styles.panel} ${styles.panelModal} ${styles.panelModalLabCompact}`
            : `${styles.panel} ${styles.panelModal}`
        }
        data-open={open}
        data-layout={layoutVariant}
        aria-hidden={!open}
      >
        {!isLabCompact ? <div className={styles.orbitDecor} aria-hidden /> : null}
        {!isLabCompact ? <div className={styles.stars} aria-hidden /> : null}
        {isLabCompact ? (
          <button
            type="button"
            className={`${styles.close} ${styles.closeLabCompact}`}
            onClick={onClose}
            aria-label={t('element.closeTable')}
          >
            ×
          </button>
        ) : (
          <header className={styles.headModal}>
            <div>
              <h2 id={PT_LAB_TITLE_ID} className={styles.headTitle}>
                {t('element.ptTitle')}
              </h2>
              <p className={styles.hintSub}>{t('element.ptHint')}</p>
            </div>
            <button type="button" className={styles.close} onClick={onClose} aria-label={t('element.closeTable')}>
              ×
            </button>
          </header>
        )}

        <div
          ref={tableWrapRef}
          className={
            isLabCompact
              ? `${styles.tableWrap} ${styles.tableWrapLabCompact} ${styles.tableWrapTextbook}`
              : `${styles.tableWrap} ${styles.tableWrapTextbook}`
          }
        >
          <PeriodicTableTextbook
            embedMode
            onPickElement={onPickElement}
            onAltPickElement={onAltPickElement}
            wrapClassName={styles.textbookInLab}
          />
        </div>
      </div>
    </>
  )
}
