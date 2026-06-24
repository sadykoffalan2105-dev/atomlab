import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { compoundById } from '../../data/compounds'
import { filterCatalogIndex, loadVrLabCatalogIndex, type VrLabCatalogEntry } from '../../vrLab/chemistry/vrLabCatalogIndex'
import { listVrLabStarterSubstanceIds } from '../../vrLab/mixEngine'
import { useT } from '../../i18n/useT'
import styles from './VrLabSubstancePicker.module.css'

const ROW_HEIGHT = 52

type Props = {
  selectedCompoundId: string | null
  onSelect: (compoundId: string) => void
}

function VirtualList({
  items,
  selectedCompoundId,
  onSelect,
}: {
  items: VrLabCatalogEntry[]
  selectedCompoundId: string | null
  onSelect: (id: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(320)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight))
    ro.observe(el)
    setViewportH(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  const onScroll = useCallback(() => {
    if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop)
  }, [])

  const totalH = items.length * ROW_HEIGHT
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 2)
  const visible = Math.ceil(viewportH / ROW_HEIGHT) + 4
  const end = Math.min(items.length, start + visible)
  const slice = items.slice(start, end)

  return (
    <div ref={scrollRef} className={styles.list} onScroll={onScroll}>
      <div style={{ height: totalH, position: 'relative' }}>
        {slice.map((c, i) => {
          const idx = start + i
          return (
            <button
              key={c.id}
              type="button"
              className={selectedCompoundId === c.id ? styles.itemOn : styles.item}
              onClick={() => onSelect(c.id)}
              style={{
                ['--substance-color' as string]: c.accentColor,
                position: 'absolute',
                top: idx * ROW_HEIGHT,
                left: 0,
                right: 0,
                height: ROW_HEIGHT - 4,
              }}
            >
              <span className={styles.swatch} aria-hidden />
              <span className={styles.formula}>{c.formulaUnicode}</span>
              <span className={styles.name}>{c.nameRu}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function VrLabSubstancePicker({ selectedCompoundId, onSelect }: Props) {
  const { t } = useT()
  const [query, setQuery] = useState('')
  const [starterOnly, setStarterOnly] = useState(false)
  const [catalog, setCatalog] = useState<VrLabCatalogEntry[] | null>(null)

  const starterSet = useMemo(() => new Set(listVrLabStarterSubstanceIds()), [])

  useEffect(() => {
    void loadVrLabCatalogIndex().then(setCatalog)
  }, [])

  const list = useMemo(() => {
    if (!catalog) return []
    return filterCatalogIndex(catalog, query, starterOnly, starterSet)
  }, [catalog, query, starterOnly, starterSet])

  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>{t('vrLab.picker.title')}</h2>
      <input
        className={styles.search}
        type="search"
        placeholder={t('vrLab.picker.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={starterOnly}
          onChange={(e) => setStarterOnly(e.target.checked)}
        />
        {t('vrLab.picker.starterOnly')}
      </label>
      {!catalog ? (
        <p className={styles.hint}>{t('vrLab.picker.loading')}</p>
      ) : list.length === 0 ? (
        <p className={styles.hint}>{t('vrLab.picker.empty')}</p>
      ) : (
        <VirtualList items={list} selectedCompoundId={selectedCompoundId} onSelect={onSelect} />
      )}
      {selectedCompoundId && compoundById[selectedCompoundId] ? (
        <p className={styles.hint}>
          {t('vrLab.picker.selected', {
            formula: compoundById[selectedCompoundId]!.formulaUnicode,
          })}
        </p>
      ) : null}
    </div>
  )
}
