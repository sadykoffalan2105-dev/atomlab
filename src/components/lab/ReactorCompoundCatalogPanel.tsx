import { useEffect, useMemo, useState } from 'react'
import { COMPOUND_CATEGORY_ORDER, COMPOUND_CATEGORY_SECTION_TITLE } from '../../data/compoundCategoryLabels'
import { filterCompoundsForCatalog } from '../../data/compoundCatalogFilter'
import { compoundById } from '../../data/compounds'
import type { CompoundCategory, CompoundDef } from '../../types/chemistry'
import styles from './ReactorCompoundCatalogPanel.module.css'

const REACTOR_CATALOG_TITLE_ID = 'reactor-catalog-title'

export type ReactorCatalogIntent = 'selectProduct' | 'generateEquation'

export function ReactorCompoundCatalogPanel({
  open,
  intent = 'selectProduct',
  onClose,
  onPick,
}: {
  open: boolean
  intent?: ReactorCatalogIntent
  onClose: () => void
  onPick: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<CompoundCategory | 'all'>('all')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const all = useMemo(() => Object.values(compoundById) as CompoundDef[], [])

  const filtered = useMemo(
    () => filterCompoundsForCatalog(all, q, category),
    [all, q, category],
  )

  const byCategory = useMemo(() => {
    const m = new Map<CompoundCategory, CompoundDef[]>()
    for (const cat of COMPOUND_CATEGORY_ORDER) m.set(cat, [])
    for (const c of filtered) {
      const arr = m.get(c.category) ?? m.get('other')!
      arr.push(c)
    }
    return m
  }, [filtered])

  return (
    <>
      <div
        className={`${styles.backdrop} ${intent === 'generateEquation' ? styles.backdropFull : ''}`}
        data-open={open}
        onClick={onClose}
        aria-hidden={!open}
      />
      <div
        className={`${styles.panel} ${intent === 'generateEquation' ? styles.panelFull : ''}`}
        data-open={open}
        data-intent={intent}
        role="dialog"
        aria-modal="true"
        aria-labelledby={REACTOR_CATALOG_TITLE_ID}
        aria-hidden={!open}
      >
        <header className={styles.head}>
          <div>
            <h2 id={REACTOR_CATALOG_TITLE_ID} className={styles.title}>
              Каталог веществ
            </h2>
            <p className={styles.sub}>
              {intent === 'generateEquation'
                ? 'Выберите вещество: реагенты подставятся из эталона без коэффициентов — уравняйте вручную перед запуском. Поиск по названию, формуле или id.'
                : 'Выберите продукт реакции. Поиск по названию, формуле или id.'}
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть каталог">
            ×
          </button>
        </header>

        <label className={styles.searchLabel}>
          <span className={styles.searchHint}>Поиск</span>
          <input
            className={styles.searchInput}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Формула, название или id…"
            aria-label="Поиск по каталогу"
          />
        </label>

        <div className={styles.filterRow} role="group" aria-label="Фильтр по типу">
          <button
            type="button"
            className={styles.filterChip}
            data-active={category === 'all'}
            onClick={() => setCategory('all')}
          >
            Все
          </button>
          {COMPOUND_CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              type="button"
              className={styles.filterChip}
              data-active={category === cat}
              onClick={() => setCategory(cat)}
            >
              {COMPOUND_CATEGORY_SECTION_TITLE[cat]}
            </button>
          ))}
        </div>

        <div className={styles.list}>
          {filtered.length === 0 ? (
            <p className={styles.empty}>Ничего не найдено — измените запрос или фильтр.</p>
          ) : (
            COMPOUND_CATEGORY_ORDER.map((cat) => {
              const items = byCategory.get(cat) ?? []
              if (items.length === 0) return null
              return (
                <section key={cat}>
                  <h3 className={styles.sectionTitle}>{COMPOUND_CATEGORY_SECTION_TITLE[cat]}</h3>
                  {items.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={styles.card}
                      onClick={() => {
                        onPick(c.id)
                        onClose()
                      }}
                    >
                      <div className={styles.formula}>{c.formulaUnicode}</div>
                      <div className={styles.name}>{c.nameRu}</div>
                    </button>
                  ))}
                </section>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
