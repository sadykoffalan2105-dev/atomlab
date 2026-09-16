import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { COMPOUND_CATEGORY_ORDER } from '../../data/compoundCategoryLabels'
import { filterCompoundsForCatalog } from '../../data/compoundCatalogFilter'
import { compoundById } from '../../data/compounds'
import { isCatalogVisibleId } from '../../data/textbook/catalogWhitelist'
import { compoundSearchBlob, getCompoundLocaleStrings } from '../../i18n/compoundLocale'
import type { MessageKey } from '../../i18n/useT'
import { useT } from '../../i18n/useT'
import type { CompoundCategory, CompoundDef } from '../../types/chemistry'
import { atomColor, CATEGORY_TONE, formatMolarMass, molarMass } from '../catalog/catalogVisuals'
import styles from './ReactorCompoundCatalogPanel.module.css'
import { useDialogFocus } from './useDialogFocus'

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

function categoryLabelKey(cat: CompoundCategory): MessageKey {
  const m: Record<CompoundCategory, MessageKey> = {
    oxide: 'catalog.category.oxide',
    acid: 'catalog.category.acid',
    base: 'catalog.category.base',
    salt: 'catalog.category.salt',
    other: 'catalog.category.other',
  }
  return m[cat]
}

/** Короткий знак класса в заголовке секции (как на странице каталога). */
const CATEGORY_GLYPH: Record<CompoundCategory, string> = {
  oxide: 'EₓOᵧ',
  acid: 'H⁺',
  base: 'OH⁻',
  salt: 'Me·A',
  other: '◇',
}

function toneStyle(cat: CompoundCategory): CSSProperties {
  const tone = CATEGORY_TONE[cat]
  return { '--tone-a': tone.a, '--tone-b': tone.b } as CSSProperties
}

function IconFlask() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 3h6M10 3v5.2L4.6 17.4A2.4 2.4 0 0 0 6.7 21h10.6a2.4 2.4 0 0 0 2.1-3.6L14 8.2V3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7.2 14.5h9.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="8.6" cy="8.6" r="5.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="m12.8 12.8 4.2 4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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

function IconArrow() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M4.5 10h11m-4.5-4.5L15.5 10 11 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ElementChips({ composition, max }: { composition: Readonly<Record<string, number>>; max: number }) {
  const symbols = Object.keys(composition)
  return (
    <span className={styles.elements} aria-hidden>
      {symbols.slice(0, max).map((el) => (
        <span key={el} className={styles.elChip} style={{ '--el': atomColor(el) } as CSSProperties}>
          {el}
        </span>
      ))}
      {symbols.length > max ? <span className={styles.elMore}>+{symbols.length - max}</span> : null}
    </span>
  )
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
  /* Родитель сбрасывает intent в момент закрытия: держим прежний режим, пока панель гаснет,
     иначе полноэкранный каталог уезжал бы вправо шторкой и перерисовывался строками. */
  const [shownIntent, setShownIntent] = useState<ReactorCatalogIntent>(intent)
  if (open && shownIntent !== intent) setShownIntent(intent)
  const isFull = shownIntent === 'generateEquation'

  /* Фокус внутрь окна при открытии (поиск — на мыши; на тач-экране — без клавиатуры, на кнопку закрытия),
     Tab не уходит за окно, при закрытии — возврат на кнопку, которая открыла каталог. */
  const dialogRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [finePointer] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches,
  )
  useDialogFocus(open, dialogRef, { initialFocus: finePointer ? searchRef : undefined })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const all = useMemo(() => (Object.values(compoundById) as CompoundDef[]).filter((c) => isCatalogVisibleId(c.id)), [])

  const scoped = useMemo(() => {
    if (!allowedProductIds?.length) return all
    const allowed = new Set(allowedProductIds)
    return all.filter((c) => allowed.has(c.id))
  }, [all, allowedProductIds])

  const searchBlob = useCallback((c: CompoundDef) => compoundSearchBlob(c, locale, t), [locale, t])

  /** Совпадения по запросу без учёта класса — для счётчиков на чипах. */
  const queryMatched = useMemo(
    () => filterCompoundsForCatalog(scoped, q, 'all', searchBlob),
    [scoped, q, searchBlob],
  )

  const filtered = useMemo(
    () => (category === 'all' ? queryMatched : queryMatched.filter((c) => c.category === category)),
    [queryMatched, category],
  )

  const countByCategory = useMemo(() => {
    const m = new Map<CompoundCategory, number>()
    for (const c of queryMatched) m.set(c.category, (m.get(c.category) ?? 0) + 1)
    return m
  }, [queryMatched])

  const byCategory = useMemo(() => {
    const m = new Map<CompoundCategory, CompoundDef[]>()
    for (const cat of COMPOUND_CATEGORY_ORDER) m.set(cat, [])
    for (const c of filtered) {
      const arr = m.get(c.category) ?? m.get('other')!
      arr.push(c)
    }
    return m
  }, [filtered])

  const pick = (id: string) => {
    onPick(id)
    onClose()
  }

  return (
    <>
      <div
        className={`${styles.backdrop} ${isFull ? styles.backdropFull : ''}`}
        data-open={open}
        data-intent={shownIntent}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`${styles.panel} ${isFull ? styles.panelFull : ''}`}
        data-open={open}
        data-intent={shownIntent}
        role="dialog"
        aria-modal="true"
        aria-labelledby={REACTOR_CATALOG_TITLE_ID}
        aria-hidden={!open}
        inert={open ? undefined : true}
      >
        <div className={styles.shell}>
          <header className={styles.head}>
            <span className={styles.headBadge} aria-hidden>
              <IconFlask />
            </span>
            <div className={styles.headText}>
              <h2 id={REACTOR_CATALOG_TITLE_ID} className={styles.title}>
                {t('catalogPanel.title')}
              </h2>
              <p className={styles.sub}>{isFull ? t('catalogPanel.subGenerate') : t('catalogPanel.subProduct')}</p>
            </div>
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label={t('catalogPanel.close')}
              title={t('catalogPanel.close')}
            >
              <IconClose />
            </button>
          </header>

          <div className={styles.toolbar}>
            <div className={styles.search}>
              <IconSearch className={styles.searchIcon} />
              <input
                ref={searchRef}
                className={styles.searchInput}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('catalog.placeholder')}
                aria-label={t('catalog.searchAria')}
              />
              {q ? (
                <button
                  type="button"
                  className={styles.searchClear}
                  onClick={() => setQ('')}
                  aria-label={t('catalog.searchClear')}
                  title={t('catalog.searchClear')}
                >
                  <IconClose />
                </button>
              ) : null}
            </div>

            <div className={styles.filterRow} role="group" aria-label={t('catalogPanel.filterAria')}>
              <button
                type="button"
                className={styles.filterChip}
                data-active={category === 'all'}
                aria-pressed={category === 'all'}
                onClick={() => setCategory('all')}
              >
                {t('catalogPanel.all')}
                <span className={styles.chipCount}>{queryMatched.length}</span>
              </button>
              {COMPOUND_CATEGORY_ORDER.map((cat) => {
                const n = countByCategory.get(cat) ?? 0
                if (n === 0 && category !== cat) return null
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`${styles.filterChip} ${styles.filterChipTone}`}
                    style={toneStyle(cat)}
                    data-active={category === cat}
                    aria-pressed={category === cat}
                    onClick={() => setCategory(cat)}
                  >
                    <span className={styles.chipDot} aria-hidden />
                    {t(sectionTitleKey(cat))}
                    <span className={styles.chipCount}>{n}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className={styles.list}>
            {filtered.length === 0 ? (
              <div className={styles.empty}>
                <IconSearch className={styles.emptyIcon} />
                <p className={styles.emptyText}>{t('catalogPanel.empty')}</p>
              </div>
            ) : (
              COMPOUND_CATEGORY_ORDER.map((cat) => {
                const items = byCategory.get(cat) ?? []
                if (items.length === 0) return null
                return (
                  <section key={cat} className={styles.section} style={toneStyle(cat)}>
                    <header className={styles.sectionHead}>
                      <span className={styles.sectionGlyph} aria-hidden>
                        {CATEGORY_GLYPH[cat]}
                      </span>
                      <h3 className={styles.sectionTitle}>{t(sectionTitleKey(cat))}</h3>
                      <span className={styles.sectionCount}>{items.length}</span>
                    </header>
                    {isFull ? (
                      <ul className={styles.grid}>
                        {items.map((c) => {
                          const loc = getCompoundLocaleStrings(c, locale, t)
                          const mass = molarMass(c.composition)
                          return (
                            <li key={c.id} className={styles.gridItem}>
                              <button
                                type="button"
                                className={styles.gridCard}
                                onClick={() => pick(c.id)}
                                aria-label={t('catalogPanel.pick', { name: loc.name, formula: c.formulaUnicode })}
                              >
                                <span className={styles.cardTop}>
                                  <span className={styles.catPill}>{t(categoryLabelKey(c.category))}</span>
                                  {mass != null ? (
                                    <span className={styles.mass}>
                                      {formatMolarMass(mass, locale)} <small>{t('catalog.molarMassUnit')}</small>
                                    </span>
                                  ) : null}
                                </span>
                                <span className={styles.gridFormula}>{c.formulaUnicode}</span>
                                <span className={styles.gridName}>{loc.name}</span>
                                <span className={styles.gridDesc}>{loc.description}</span>
                                <span className={styles.cardFoot}>
                                  <ElementChips composition={c.composition} max={5} />
                                  <span className={styles.go} aria-hidden>
                                    <IconArrow />
                                  </span>
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <ul className={styles.rows}>
                        {items.map((c) => {
                          const loc = getCompoundLocaleStrings(c, locale, t)
                          return (
                            <li key={c.id}>
                              <button
                                type="button"
                                className={styles.card}
                                onClick={() => pick(c.id)}
                                aria-label={t('catalogPanel.pick', { name: loc.name, formula: c.formulaUnicode })}
                              >
                                <span className={styles.formula}>{c.formulaUnicode}</span>
                                <span className={styles.rowText}>
                                  <span className={styles.name}>{loc.name}</span>
                                  <ElementChips composition={c.composition} max={4} />
                                </span>
                                <span className={styles.go} aria-hidden>
                                  <IconArrow />
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </section>
                )
              })
            )}
          </div>
        </div>
      </div>
    </>
  )
}
