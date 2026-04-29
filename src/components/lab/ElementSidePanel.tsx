import { useEffect, useRef } from 'react'
import { PeriodicTableGrid } from './PeriodicTableGrid'
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

  return (
    <>
      <div
        className={styles.backdrop}
        data-open={open}
        onClick={onClose}
        aria-hidden={!open}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={layoutVariant === 'labCompact' ? undefined : PT_LAB_TITLE_ID}
        aria-label={layoutVariant === 'labCompact' ? 'Периодическая таблица для выбора элементов' : undefined}
        className={
          layoutVariant === 'labCompact'
            ? `${styles.panel} ${styles.panelModal} ${styles.panelModalLabCompact}`
            : `${styles.panel} ${styles.panelModal}`
        }
        data-open={open}
        data-layout={layoutVariant}
        aria-hidden={!open}
      >
        {layoutVariant === 'modal' ? <div className={styles.orbitDecor} aria-hidden /> : null}
        {layoutVariant === 'modal' ? <div className={styles.stars} aria-hidden /> : null}
        <header
          className={
            layoutVariant === 'labCompact' ? `${styles.headModal} ${styles.headModalLabCompact}` : styles.headModal
          }
        >
          {layoutVariant === 'modal' ? (
            <div>
              <h2 id={PT_LAB_TITLE_ID} className={styles.headTitle}>
                Периодическая система
              </h2>
              <p className={styles.hintSub}>
                Тап по ячейке — 3D-структура в центре. Alt+тап — добавить атом-шар на сцену.
              </p>
            </div>
          ) : null}
          <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть таблицу элементов">
            ×
          </button>
        </header>

        <div
          ref={tableWrapRef}
          className={
            layoutVariant === 'labCompact' ? `${styles.tableWrap} ${styles.tableWrapLabCompact}` : styles.tableWrap
          }
        >
          <PeriodicTableGrid
            mode="interactive"
            onPickElement={onPickElement}
            onAltPickElement={onAltPickElement}
            compact={layoutVariant === 'labCompact'}
          />
        </div>
      </div>
    </>
  )
}
