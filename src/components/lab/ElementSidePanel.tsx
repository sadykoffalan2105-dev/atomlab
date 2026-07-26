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
  const lastCellHRef = useRef(0)
  const isLabCompact = layoutVariant === 'labCompact'

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  /** Сетка 1fr заполняет высоту; синхронизируем --pt-cell-h с реальной ячейкой. */
  useLayoutEffect(() => {
    if (!open) return
    const wrap = tableWrapRef.current
    if (!wrap) return

    const sync = () => {
      const sample =
        wrap.querySelector<HTMLElement>('button[class*="tbCellBtn"]') ??
        wrap.querySelector<HTMLElement>('[class*="tbCellStatic"]')
      if (!sample) return
      const h = sample.getBoundingClientRect().height
      if (h < 8) return
      const cellPx = Math.round(h * 2) / 2
      if (Math.abs(cellPx - lastCellHRef.current) < 0.4) return
      lastCellHRef.current = cellPx
      wrap.style.setProperty('--pt-cell-h', `${cellPx}px`)
    }

    sync()
    const ro = new ResizeObserver(() => requestAnimationFrame(sync))
    ro.observe(wrap)
    return () => {
      ro.disconnect()
      lastCellHRef.current = 0
    }
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
        <div
          ref={tableWrapRef}
          className={`${styles.tableWrapOpen} ${styles.tableWrapTextbook}`}
        >
          <button
            type="button"
            className={styles.closeFloat}
            onClick={onClose}
            aria-label={t('element.closeTable')}
          >
            ×
          </button>
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
