import { useEffect, useLayoutEffect, useRef } from 'react'
import { useT } from '../../i18n/useT'
import { PeriodicTableTextbook } from './PeriodicTableTextbook'
import styles from './ElementSidePanel.module.css'
import { useDialogFocus } from './useDialogFocus'

const LEGEND = [
  { key: 's', label: 'periodic.legendS' },
  { key: 'p', label: 'periodic.legendP' },
  { key: 'd', label: 'periodic.legendD' },
  { key: 'f', label: 'periodic.legendF' },
  { key: 'noble', label: 'periodic.legendNoble' },
] as const

function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M14 17h6M17 14v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="m5.5 5.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

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
  const dialogRef = useRef<HTMLDivElement>(null)
  const lastCellHRef = useRef(0)
  const isLabCompact = layoutVariant === 'labCompact'

  /* Фокус внутрь при открытии и возврат на ⊞ при закрытии; над реактором окно немодальное — без ловушки Tab. */
  useDialogFocus(open, dialogRef, { trap: !isLabCompact })

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
        data-layout={layoutVariant}
        onClick={onClose}
        aria-hidden={!open}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal={isLabCompact ? undefined : true}
        aria-label={t('element.ptAriaLab')}
        className={
          isLabCompact
            ? `${styles.panelOpen} ${styles.panelOpenCompact}`
            : `${styles.panelOpen} ${styles.panelOpenCenter}`
        }
        data-open={open}
        data-layout={layoutVariant}
        aria-hidden={!open}
        inert={open ? undefined : true}
      >
        {!isLabCompact ? (
          <header className={styles.head}>
            <span className={styles.headBadge} aria-hidden>
              <IconGrid />
            </span>
            <div className={styles.headText}>
              <h2 className={styles.headTitle}>{t('element.ptTitle')}</h2>
              <p className={styles.headHint}>{t('element.ptHint')}</p>
            </div>
            <ul className={styles.headLegend} aria-label={t('periodic.legendAria')}>
              {LEGEND.map((item) => (
                <li key={item.key} className={styles.headLegendItem} data-block={item.key}>
                  <span className={styles.headLegendDot} aria-hidden />
                  {t(item.label)}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label={t('element.closeTable')}
              title={t('element.close')}
            >
              <IconClose />
            </button>
          </header>
        ) : null}
        <div
          ref={tableWrapRef}
          className={`${styles.tableWrapOpen} ${styles.tableWrapTextbook}`}
          data-layout={layoutVariant}
        >
          {isLabCompact ? (
            <button
              type="button"
              className={styles.closeFloat}
              onClick={onClose}
              aria-label={t('element.closeTable')}
              title={t('element.close')}
            >
              <IconClose />
            </button>
          ) : null}
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
