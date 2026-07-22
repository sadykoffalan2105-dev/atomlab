import { useLayoutEffect, useRef, useState } from 'react'
import { PeriodicTableTextbook } from '../components/lab/PeriodicTableTextbook'
import { PeriodicTableCosmos } from '../components/lab/PeriodicTableCosmos'
import { IconAtomGrid, IconInfoHud, IconSolubility } from '../components/lab/PeriodicTableHudIcons'
import { SolubilityTable } from '../components/lab/SolubilityTable'
import { ElementDetailModal } from '../components/lab/ElementDetailModal'
import { useT } from '../i18n/useT'
import pageStyles from './PeriodicTablePage.module.css'

type TableTab = 'mendeleev' | 'solubility'

/** Полноэкранная таблица: клик по ячейке — карточка со всеми данными элемента. */
export function PeriodicTablePage() {
  const { t } = useT()
  const [detailZ, setDetailZ] = useState<number | null>(null)
  const [tab, setTab] = useState<TableTab>('mendeleev')
  const fitRef = useRef<HTMLDivElement | null>(null)
  const innerRef = useRef<HTMLDivElement | null>(null)
  const [showIntro, setShowIntro] = useState(false)

  /**
   * Сетка сама делит высоту (1fr). JS только синхронизирует --pt-cell-h
   * с реальной высотой ячейки для шрифтов / fallback.
   */
  useLayoutEffect(() => {
    const fit = fitRef.current
    const inner = innerRef.current
    if (!fit || !inner) return

    const syncCellVar = () => {
      const sample =
        inner.querySelector<HTMLElement>('button[class*="tbCellBtn"]') ??
        inner.querySelector<HTMLElement>('[class*="tbCellStatic"]')
      if (!sample) return
      const h = sample.getBoundingClientRect().height
      if (h > 8) {
        inner.style.setProperty('--pt-cell-h', `${Math.round(h * 10) / 10}px`)
      }
    }

    syncCellVar()
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(syncCellVar)
    })
    ro.observe(fit)
    window.addEventListener('resize', syncCellVar)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', syncCellVar)
    }
  }, [tab, showIntro])

  return (
    <div className={pageStyles.page}>
      <PeriodicTableCosmos />
      <div className={pageStyles.pageContent}>
        <div className={pageStyles.introRow}>
          <div className={pageStyles.tabBar} role="tablist" aria-label={t('periodic.tabListAria')}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'mendeleev'}
              className={tab === 'mendeleev' ? pageStyles.tabActive : pageStyles.tab}
              onClick={() => setTab('mendeleev')}
            >
              <IconAtomGrid className={pageStyles.tabIcon} />
              <span>{t('periodic.tabMendeleev')}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'solubility'}
              className={tab === 'solubility' ? pageStyles.tabActive : pageStyles.tab}
              onClick={() => setTab('solubility')}
            >
              <IconSolubility className={pageStyles.tabIcon} />
              <span>{t('periodic.tabSolubility')}</span>
            </button>
          </div>
          <button
            type="button"
            className={pageStyles.introToggle}
            onClick={() => setShowIntro((v) => !v)}
            aria-expanded={showIntro}
          >
            <IconInfoHud className={pageStyles.tabIcon} />
            <span>{showIntro ? t('periodic.introHide') : t('periodic.introShow')}</span>
          </button>
        </div>
        {showIntro ? (
          <>
            <p className={pageStyles.headIntro}>{t('periodic.intro1')}</p>
            <p className={pageStyles.lead}>{t('periodic.intro2')}</p>
          </>
        ) : null}
        <div className={pageStyles.tableWrap}>
          <div className={pageStyles.tableFit} ref={fitRef}>
            <div className={pageStyles.tableFitInner} ref={innerRef}>
              {tab === 'mendeleev' ? (
                <PeriodicTableTextbook
                  onPickElement={setDetailZ}
                  wrapClassName={pageStyles.ptWrapNoScroll}
                  pageFit
                />
              ) : (
                <SolubilityTable wrapClassName={pageStyles.ptWrapNoScroll} />
              )}
            </div>
          </div>
        </div>
        <ElementDetailModal z={detailZ} onClose={() => setDetailZ(null)} onNavigate={setDetailZ} />
      </div>
    </div>
  )
}
