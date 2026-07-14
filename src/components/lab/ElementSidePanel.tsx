import { useEffect, useLayoutEffect, useRef } from 'react'
import { useT } from '../../i18n/useT'
import { PeriodicTableTextbook } from './PeriodicTableTextbook'
import styles from './ElementSidePanel.module.css'

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
  const tableWrapRef = useRef<HTMLDivElement>(null)
  const isLabCompact = layoutVariant === 'labCompact'

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  /** Широкие ячейки: приоритет ширине колонки, хватает места под символ + название. */
  useLayoutEffect(() => {
    if (!open) return
    const wrap = tableWrapRef.current
    if (!wrap) return

    const compute = () => {
      const aw = Math.max(1, wrap.clientWidth - 2)
      const ah = Math.max(1, wrap.clientHeight - 2)
      // 11 основных рядов + лантаноиды + актиноиды; запас под заголовки I–VIII / A·B и f-gap.
      const bodyRows = 13
      const chromePx = isLabCompact ? 44 : 52
      const gapPx = 3
      const sideFr = 0.2
      const elemCols = 10
      const totalFr = sideFr + elemCols
      const usableW = Math.max(1, aw - gapPx * 12)
      const elemColW = (usableW * elemCols) / totalFr / elemCols
      // Сначала влезают все ряды (включая актиноиды), потом ограничиваем шириной.
      const hByHeight = (ah - chromePx - gapPx * (bodyRows + 3)) / bodyRows
      const byWidth = elemColW * 0.88
      const maxCell = isLabCompact ? 50 : 56
      const cellPx = Math.max(22, Math.min(hByHeight, byWidth, maxCell))
      wrap.style.setProperty('--pt-cell-h', `${cellPx}px`)
      wrap.style.setProperty('--pt-cell-w', `${Math.max(cellPx * 1.12, elemColW)}px`)
    }

    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [open, isLabCompact])

  return (
    <>
      <div
        className={styles.backdropSoft}
        data-open={open}
        onClick={onClose}
        aria-hidden={!open}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('element.ptAriaLab')}
        className={
          isLabCompact
            ? `${styles.panelOpen} ${styles.panelOpenCompact}`
            : `${styles.panelOpen} ${styles.panelOpenCenter}`
        }
        data-open={open}
        data-layout={layoutVariant}
        aria-hidden={!open}
      >
        <button
          type="button"
          className={styles.closeFloat}
          onClick={onClose}
          aria-label={t('element.closeTable')}
        >
          ×
        </button>

        <div
          ref={tableWrapRef}
          className={`${styles.tableWrapOpen} ${styles.tableWrapTextbook}`}
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
