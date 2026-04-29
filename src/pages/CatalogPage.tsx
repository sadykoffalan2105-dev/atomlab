import { useMemo, useState } from 'react'
import { CompoundDetailModal } from '../components/lab/CompoundDetailModal'
import { COMPOUND_CATEGORY_ORDER, COMPOUND_CATEGORY_SECTION_TITLE } from '../data/compoundCategoryLabels'
import { compoundById } from '../data/compounds'
import type { CompoundCategory } from '../types/chemistry'
import styles from './CatalogPage.module.css'

export function CatalogPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const list = useMemo(() => Object.values(compoundById), [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return list
    return list.filter(
      (c) =>
        c.nameRu.toLowerCase().includes(s) ||
        c.formulaUnicode.toLowerCase().includes(s) ||
        c.id.toLowerCase().includes(s),
    )
  }, [list, q])

  const byCategory = useMemo(() => {
    const m = new Map<CompoundCategory, typeof list>()
    for (const cat of COMPOUND_CATEGORY_ORDER) m.set(cat, [])
    for (const c of filtered) {
      const arr = m.get(c.category) ?? m.get('other')!
      arr.push(c)
    }
    return m
  }, [filtered])

  return (
    <div className={styles.page}>
      <h1 className={styles.h}>Каталог веществ</h1>
      <p className={styles.lead}>
        Неорганика школьного курса: оксиды, кислоты, основания и соли. Та же база веществ используется в лаборатории
        (атомы, просмотр 3D).
      </p>
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

      {COMPOUND_CATEGORY_ORDER.map((cat) => {
        const items = byCategory.get(cat) ?? []
        if (items.length === 0) return null
        return (
          <section key={cat} className={styles.section}>
            <h2 className={styles.sectionTitle}>{COMPOUND_CATEGORY_SECTION_TITLE[cat]}</h2>
            <ul className={styles.list}>
              {items.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={styles.cardBtn}
                    onClick={() => setSelectedId(c.id)}
                    aria-label={`Подробнее: ${c.nameRu}, ${c.formulaUnicode}`}
                  >
                    <span className={styles.formula}>{c.formulaUnicode}</span>
                    <span className={styles.name}>{c.nameRu}</span>
                    <p className={styles.desc}>{c.descriptionRu}</p>
                    <p className={styles.labRecipe}>{c.laboratoryRecipeRu}</p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      <CompoundDetailModal compoundId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  )
}
