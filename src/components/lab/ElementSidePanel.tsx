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
      // 8 групп + 2 колонки триады VIII (Fe/Co/Ni…) — как в школьной сетке.
      const sideFr = 0.18
      const elemCols = 10
      const totalFr = sideFr + elemCols
      const usableW = Math.max(1, aw - gapPx * 12)
      const elemColW = (usableW * elemCols) / totalFr / elemCols
      // Влезают все ряды в высоту; ширина колонки даёт более «квадратные» ячейки.
      const hByHeight = (ah - chromePx - gapPx * (bodyRows + 3)) / bodyRows
      const byWidth = elemColW * 0.92
      const maxCell = isLabCompact ? 48 : 54
      const cellPx = Math.max(20, Math.min(hByHeight, byWidth, maxCell))
      wrap.style.setProperty('--pt-cell-h', `${cellPx}px`)
      wrap.style.setProperty('--pt-cell-w', `${Math.max(cellPx * 1.1, elemColW)}px`)
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
