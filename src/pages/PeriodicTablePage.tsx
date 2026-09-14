import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { PeriodicTableTextbook } from '../components/lab/PeriodicTableTextbook'
import { PeriodicTableCosmos } from '../components/lab/PeriodicTableCosmos'
import { IconAtomGrid, IconInfoHud, IconSearch, IconSolubility } from '../components/lab/PeriodicTableHudIcons'
import { PeriodicElementPreview } from '../components/lab/periodic/PeriodicElementPreview'
import { PeriodicCategoryToolbar } from '../components/lab/periodic/PeriodicCategoryToolbar'
import { searchElements } from '../components/lab/periodic/periodicMeta'
import { SolubilityTable } from '../components/lab/SolubilityTable'
import { ElementDetailModal } from '../components/lab/ElementDetailModal'
import type { ElementCategoryFilterId } from '../data/elementCategory'
import { useT } from '../i18n/useT'
import pageStyles from './PeriodicTablePage.module.css'

type TableTab = 'mendeleev' | 'solubility'

/** Элемент карточки-предпросмотра, пока ничего не наведено. */
const FEATURED_Z = 26

/** С этой ширины карточка и фильтры встраиваются в пустые места самой таблицы. */
const WIDE_QUERY = '(min-width: 1100px)'

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/** Полноэкранная таблица: клик по ячейке — карточка со всеми данными элемента. */
export function PeriodicTablePage() {
  const { t, locale } = useT()
  const [detailZ, setDetailZ] = useState<number | null>(null)
  const [tab, setTab] = useState<TableTab>('mendeleev')
  const [showIntro, setShowIntro] = useState(false)
  const [hoverZ, setHoverZ] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ElementCategoryFilterId | null>(null)
  const wide = useMediaQuery(WIDE_QUERY)

  const pageRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const introRef = useRef<HTMLDivElement | null>(null)
  const introId = useId()
  const searchStatusId = useId()

  const search = useMemo(() => searchElements(query, locale), [query, locale])
  const previewZ = hoverZ ?? search?.best ?? FEATURED_Z
  const featured = hoverZ == null && search?.best == null

  /**
   * Высота таблицы на широком экране считается в CSS от окна: 100dvh − --pt-top.
   * JS только замеряет, где начинается сцена с таблицей (шапка может переноситься).
   */
  useLayoutEffect(() => {
    const page = pageRef.current
    const stage = stageRef.current
    if (!page || !stage) return

    const sync = () => {
      const top = stage.getBoundingClientRect().top + window.scrollY
      page.style.setProperty('--pt-top', `${Math.round(top + 24)}px`)
    }

    sync()
    const ro = new ResizeObserver(() => requestAnimationFrame(sync))
    ro.observe(page)
    window.addEventListener('resize', sync)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [tab, wide])

  useEffect(() => {
    if (!showIntro) return
    const onDown = (e: PointerEvent) => {
      if (introRef.current && !introRef.current.contains(e.target as Node)) setShowIntro(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setShowIntro(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [showIntro])

  const onQueryChange = useCallback((value: string) => {
    setQuery(value)
    setHoverZ(null)
  }, [])

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search?.best != null) {
      e.preventDefault()
      setDetailZ(search.best)
    } else if (e.key === 'Escape' && query) {
      e.preventDefault()
      e.stopPropagation()
      onQueryChange('')
    }
  }

  const matchCount = search?.matches.size ?? 0

  return (
    <div className={pageStyles.page} ref={pageRef}>
      <PeriodicTableCosmos />
      <div className={pageStyles.pageContent}>
        <header className={pageStyles.header}>
          <div className={pageStyles.titleBlock}>
            <span className={pageStyles.badge} aria-hidden>
              {tab === 'mendeleev' ? <IconAtomGrid /> : <IconSolubility />}
            </span>
            <div className={pageStyles.titleText}>
              <h1 className={pageStyles.title}>
                {tab === 'mendeleev' ? t('periodic.tabMendeleev') : t('periodic.tabSolubility')}
              </h1>
              <p className={pageStyles.subtitle}>
                <span className={pageStyles.eyebrow}>{t('periodic.pageEyebrow')}</span>
                {tab === 'mendeleev' ? <span>{t('periodic.pageSubtitle')}</span> : null}
              </p>
            </div>
          </div>

          <div className={pageStyles.headerTools}>
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

            {tab === 'mendeleev' ? (
              <div className={pageStyles.search}>
                <IconSearch className={pageStyles.searchIcon} />
                <input
                  type="search"
                  className={pageStyles.searchInput}
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  onKeyDown={onSearchKey}
                  placeholder={t('periodic.searchPlaceholder')}
                  aria-label={t('periodic.searchLabel')}
                  aria-describedby={query ? searchStatusId : undefined}
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="go"
                />
                {query ? (
                  <button
                    type="button"
                    className={pageStyles.searchClear}
                    onClick={() => onQueryChange('')}
                    aria-label={t('periodic.searchClear')}
                  >
                    ×
                  </button>
                ) : null}
                <span
                  id={searchStatusId}
                  className={`${pageStyles.searchStatus} ${matchCount === 0 ? pageStyles.searchStatusNone : ''}`}
                  role="status"
                  hidden={!query}
                >
                  {matchCount > 0 ? t('periodic.searchFound', { count: matchCount }) : t('periodic.searchNone')}
                </span>
              </div>
            ) : null}

            <div className={pageStyles.introWrap} ref={introRef}>
              <button
                type="button"
                className={pageStyles.introToggle}
                onClick={() => setShowIntro((v) => !v)}
                aria-expanded={showIntro}
                aria-controls={introId}
                title={showIntro ? t('periodic.introHide') : t('periodic.introShow')}
              >
                <IconInfoHud className={pageStyles.tabIcon} />
                <span>{t('periodic.introButton')}</span>
              </button>
              <div id={introId} className={pageStyles.introPop} hidden={!showIntro}>
                <p className={pageStyles.introLaw}>{t('periodic.lawTitle')}</p>
                <p className={pageStyles.headIntro}>{t('periodic.intro1')}</p>
                <p className={pageStyles.lead}>{t('periodic.intro2')}</p>
                <button type="button" className={pageStyles.introClose} onClick={() => setShowIntro(false)}>
                  {t('periodic.introHide')}
                </button>
              </div>
            </div>
          </div>
        </header>

        {tab === 'mendeleev' ? (
          <div className={pageStyles.layout}>
            {!wide ? (
              <div className={pageStyles.stripSlot}>
                <PeriodicElementPreview z={previewZ} featured={featured} onOpen={setDetailZ} variant="strip" />
              </div>
            ) : null}
            <p className={pageStyles.scrollHint} aria-hidden>
              {t('periodic.scrollHint')}
            </p>
            <div className={pageStyles.stage} ref={stageRef}>
              <PeriodicTableTextbook
                onPickElement={setDetailZ}
                onHoverElement={setHoverZ}
                searchMatches={search?.matches ?? null}
                categoryFilter={categoryFilter}
                onCategoryFilterChange={setCategoryFilter}
                hideLegend
                wrapClassName={pageStyles.tableWrapFit}
                pageFit
                centerSlot={
                  wide ? (
                    <PeriodicElementPreview z={previewZ} featured={featured} onOpen={setDetailZ} variant="strip" />
                  ) : undefined
                }
                triadSlot={
                  wide ? (
                    <PeriodicCategoryToolbar value={categoryFilter} onChange={setCategoryFilter} variant="compact" />
                  ) : undefined
                }
              />
            </div>
            {!wide ? <PeriodicCategoryToolbar value={categoryFilter} onChange={setCategoryFilter} /> : null}
          </div>
        ) : (
          <div className={pageStyles.solStage} ref={stageRef}>
            <SolubilityTable wrapClassName={pageStyles.ptWrapNoScroll} />
          </div>
        )}
        <ElementDetailModal z={detailZ} onClose={() => setDetailZ(null)} onNavigate={setDetailZ} />
      </div>
    </div>
  )
}
