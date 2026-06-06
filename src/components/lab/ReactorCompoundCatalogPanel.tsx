import { useCallback, useEffect, useMemo, useState } from 'react'
import { COMPOUND_CATEGORY_ORDER } from '../../data/compoundCategoryLabels'
import { filterCompoundsForCatalog } from '../../data/compoundCatalogFilter'
import { compoundById } from '../../data/compounds'
import { compoundSearchBlob, getCompoundLocaleStrings } from '../../i18n/compoundLocale'
import type { MessageKey } from '../../i18n/useT'
import { useT } from '../../i18n/useT'
import type { CompoundCategory, CompoundDef } from '../../types/chemistry'
import styles from './ReactorCompoundCatalogPanel.module.css'

const REACTOR_CATALOG_TITLE_ID = 'reactor-catalog-title'

export type ReactorCatalogIntent = 'selectProduct' | 'generateEquation'

function sectionTitleKey(cat: CompoundCategory): MessageKey {
  const m: Record<CompoundCategory, MessageKey> = {
    oxide: 'category.section.oxide',
    acid: 'category.section.acid',
    base: 'category.section.base',
    salt: 'category.section.salt',
    other: 'category.section.other',
  }
  return m[cat]
}

export function ReactorCompoundCatalogPanel({
  open,
  intent = 'selectProduct',
  onClose,
  onPick,
  allowedProductIds,
}: {
  open: boolean
  intent?: ReactorCatalogIntent
  onClose: () => void
  onPick: (id: string) => void
  /** Ограничение списка при переходе из урока (только уравнения темы) */
  allowedProductIds?: readonly string[]
}) {
  const { locale, t } = useT()
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

  const scoped = useMemo(() => {
    if (!allowedProductIds?.length) return all
    const allowed = new Set(allowedProductIds)
    return all.filter((c) => allowed.has(c.id))
  }, [all, allowedProductIds])

  const searchBlob = useCallback((c: CompoundDef) => compoundSearchBlob(c, locale, t), [locale, t])

  const filtered = useMemo(
    () => filterCompoundsForCatalog(scoped, q, category, searchBlob),
    [scoped, q, category, searchBlob],
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
              {t('catalogPanel.title')}
            </h2>
            <p className={styles.sub}>
              {intent === 'generateEquation' ? t('catalogPanel.subGenerate') : t('catalogPanel.subProduct')}
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('catalogPanel.close')}>
            ×
          </button>
        </header>

        <label className={styles.searchLabel}>
          <span className={styles.searchHint}>{t('catalog.search')}</span>
          <input
            className={styles.searchInput}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('catalog.placeholder')}
            aria-label={t('catalog.searchAria')}
          />
        </label>

        <div className={styles.filterRow} role="group" aria-label={t('catalogPanel.filterAria')}>
          <button
            type="button"
            className={styles.filterChip}
            data-active={category === 'all'}
            onClick={() => setCategory('all')}
          >
            {t('catalogPanel.all')}
          </button>
          {COMPOUND_CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              type="button"
              className={styles.filterChip}
              data-active={category === cat}
              onClick={() => setCategory(cat)}
            >
              {t(sectionTitleKey(cat))}
            </button>
          ))}
        </div>

        <div className={styles.list}>
          {filtered.length === 0 ? (
            <p className={styles.empty}>{t('catalogPanel.empty')}</p>
          ) : (
            COMPOUND_CATEGORY_ORDER.map((cat) => {
              const items = byCategory.get(cat) ?? []
              if (items.length === 0) return null
              return (
                <section key={cat}>
                  <h3 className={styles.sectionTitle}>{t(sectionTitleKey(cat))}</h3>
                  {intent === 'generateEquation' ? (
                    <ul className={styles.grid}>
                      {items.map((c) => {
                        const loc = getCompoundLocaleStrings(c, locale, t)
                        return (
                          <li key={c.id}>
                            <button
                              type="button"
                              className={styles.gridCard}
                              onClick={() => {
                                onPick(c.id)
                                onClose()
                              }}
                              aria-label={t('catalogPanel.pick', { name: loc.name, formula: c.formulaUnicode })}
                            >
                              <span className={styles.gridFormula}>{c.formulaUnicode}</span>
                              <span className={styles.gridName}>{loc.name}</span>
                              <p className={styles.gridDesc}>{loc.description}</p>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    items.map((c) => {
                      const loc = getCompoundLocaleStrings(c, locale, t)
                      return (
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
                          <div className={styles.name}>{loc.name}</div>
                        </button>
                      )
                    })
                  )}
                </section>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
