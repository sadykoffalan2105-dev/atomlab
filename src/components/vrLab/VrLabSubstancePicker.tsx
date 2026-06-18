import { useMemo, useState } from 'react'
import { compoundById, compoundsListAlphabeticalRu } from '../../data/compounds'
import { listVrLabStarterSubstanceIds } from '../../vrLab/mixEngine'
import { useT } from '../../i18n/useT'
import styles from './VrLabSubstancePicker.module.css'

type Props = {
  selectedCompoundId: string | null
  onSelect: (compoundId: string) => void
}

export function VrLabSubstancePicker({ selectedCompoundId, onSelect }: Props) {
  const { t } = useT()
  const [query, setQuery] = useState('')
  const [starterOnly, setStarterOnly] = useState(true)

  const starterSet = useMemo(() => new Set(listVrLabStarterSubstanceIds()), [])

  const list = useMemo(() => {
    const all = compoundsListAlphabeticalRu()
    const filtered = starterOnly ? all.filter((c) => starterSet.has(c.id)) : all
    const q = query.trim().toLowerCase()
    if (!q) return filtered.slice(0, starterOnly ? 80 : 60)
    return filtered
      .filter(
        (c) =>
          c.id.includes(q) ||
          c.formulaUnicode.toLowerCase().includes(q) ||
          c.nameRu.toLowerCase().includes(q),
      )
      .slice(0, 40)
  }, [query, starterOnly, starterSet])

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
      <ul className={styles.list}>
        {list.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className={selectedCompoundId === c.id ? styles.itemOn : styles.item}
              onClick={() => onSelect(c.id)}
              style={{ ['--substance-color' as string]: c.accentColor }}
            >
              <span className={styles.swatch} aria-hidden />
              <span className={styles.formula}>{c.formulaUnicode}</span>
              <span className={styles.name}>{c.nameRu}</span>
            </button>
          </li>
        ))}
      </ul>
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
