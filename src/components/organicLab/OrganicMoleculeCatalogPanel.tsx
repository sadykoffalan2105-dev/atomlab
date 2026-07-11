import { useEffect, useMemo, useState } from 'react'
import {
  ORGANIC_LAB_CLASS_ORDER,
  ORGANIC_MOLECULES,
  pickOrganicClassLabel,
} from '../../data/organicLab/organicMoleculeRegistry'
import type { OrganicClassId } from '../../data/researchLab/organicBuildCatalog'
import { useLocale } from '../../i18n/useLocale'
import { useT } from '../../i18n/useT'
import styles from '../lab/ReactorCompoundCatalogPanel.module.css'

const TITLE_ID = 'organic-reactor-catalog-title'

export type OrganicCatalogIntent = 'selectProduct' | 'generateEquation'

export function OrganicMoleculeCatalogPanel({
  open,
  intent = 'selectProduct',
  onClose,
  onPick,
}: {
  open: boolean
  intent?: OrganicCatalogIntent
  onClose: () => void
  onPick: (id: string) => void
}) {
  const { t } = useT()
  const { locale } = useLocale()
  const [q, setQ] = useState('')
  const [classFilter, setClassFilter] = useState<OrganicClassId | 'all'>('all')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return ORGANIC_MOLECULES.filter((m) => {
      if (classFilter !== 'all' && m.classId !== classFilter) return false
      if (!qq) return true
      const blob = `${m.id} ${m.formula} ${m.nameRu} ${m.nameEn} ${m.nameUz}`.toLowerCase()
      return blob.includes(qq)
    })
  }, [q, classFilter])

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
        aria-labelledby={TITLE_ID}
        aria-hidden={!open}
      >
        <header className={styles.head}>
          <div>
            <h2 id={TITLE_ID} className={styles.title}>
              {t('organicLab.catalogPanelTitle')}
            </h2>
            <p className={styles.sub}>
              {intent === 'generateEquation'
                ? t('organicLab.catalogPanelSubGen')
                : t('organicLab.catalogPanelSubProduct')}
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

        <div className={styles.filterRow} role="group">
          <button
            type="button"
            className={styles.filterChip}
            data-active={classFilter === 'all' ? 'true' : undefined}
            onClick={() => setClassFilter('all')}
          >
            {t('organicLab.allClasses')}
          </button>
          {ORGANIC_LAB_CLASS_ORDER.map((cid) => (
            <button
              key={cid}
              type="button"
              className={styles.filterChip}
              data-active={classFilter === cid ? 'true' : undefined}
              onClick={() => setClassFilter(cid)}
            >
              {pickOrganicClassLabel(cid, locale)}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className={styles.empty}>{t('organicLab.catalogEmpty')}</p>
        ) : intent === 'generateEquation' ? (
          <ul className={styles.grid}>
            {filtered.map((m) => (
              <li key={m.id}>
                <button type="button" className={styles.gridCard} onClick={() => onPick(m.id)}>
                  <span className={styles.gridFormula}>{m.formula}</span>
                  <span className={styles.gridName}>
                    {locale === 'en' ? m.nameEn : locale === 'uz' ? m.nameUz : m.nameRu}
                  </span>
                  <p className={styles.gridDesc}>{pickOrganicClassLabel(m.classId, locale)}</p>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className={styles.list}>
            {filtered.map((m) => (
              <li key={m.id}>
                <button type="button" className={styles.card} onClick={() => onPick(m.id)}>
                  <div className={styles.formula}>{m.formula}</div>
                  <div className={styles.name}>
                    {locale === 'en' ? m.nameEn : locale === 'uz' ? m.nameUz : m.nameRu}
                    {' · '}
                    {pickOrganicClassLabel(m.classId, locale)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
