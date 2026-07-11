import { useCallback, useMemo, useState } from 'react'
import { CompoundDetailModal } from '../components/lab/CompoundDetailModal'
import { OrganicMoleculeDetailModal } from '../components/organicLab/OrganicMoleculeDetailModal'
import { COMPOUND_CATEGORY_ORDER } from '../data/compoundCategoryLabels'
import { filterCompoundsForCatalog } from '../data/compoundCatalogFilter'
import { compoundById } from '../data/compounds'
import {
  ORGANIC_MOLECULES,
  organicMoleculeById,
} from '../data/organicLab/organicMoleculeRegistry'
import type { OrganicMoleculeDef } from '../data/organicLab/organicMoleculeTypes'
import { compoundSearchBlob, getCompoundLocaleStrings } from '../i18n/compoundLocale'
import type { MessageKey } from '../i18n/useT'
import { useT } from '../i18n/useT'
import type { CompoundCategory } from '../types/chemistry'
import styles from './CatalogPage.module.css'

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

function organicName(m: OrganicMoleculeDef, locale: string): string {
  if (locale === 'en') return m.nameEn
  if (locale === 'uz') return m.nameUz
  return m.nameRu
}

function organicDesc(m: OrganicMoleculeDef, locale: string): string {
  if (locale === 'en') return m.descriptionEn
  if (locale === 'uz') return m.descriptionUz
  return m.descriptionRu
}

export function CatalogPage() {
  const { locale, t } = useT()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedOrganic, setSelectedOrganic] = useState<OrganicMoleculeDef | null>(null)
  const [q, setQ] = useState('')
  const list = useMemo(() => Object.values(compoundById), [])

  const searchBlob = useCallback((c: (typeof list)[number]) => compoundSearchBlob(c, locale, t), [locale, t])

  const filtered = useMemo(
    () => filterCompoundsForCatalog(list, q, 'all', searchBlob),
    [list, q, searchBlob],
  )

  const byCategory = useMemo(() => {
    const m = new Map<CompoundCategory, typeof list>()
    for (const cat of COMPOUND_CATEGORY_ORDER) m.set(cat, [])
    for (const c of filtered) {
      const arr = m.get(c.category) ?? m.get('other')!
      arr.push(c)
    }
    return m
  }, [filtered])

  const organicFiltered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    if (!qq) return ORGANIC_MOLECULES
    return ORGANIC_MOLECULES.filter((m) => {
      const blob = `${m.id} ${m.formula} ${m.nameRu} ${m.nameEn} ${m.nameUz}`.toLowerCase()
      return blob.includes(qq)
    })
  }, [q])

  return (
    <div className={styles.page}>
      <h1 className={styles.h}>{t('catalog.title')}</h1>
      <p className={styles.lead}>{t('catalog.lead')}</p>
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

      {organicFiltered.length > 0 ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('organicLab.catalogSection')}</h2>
          <p className={styles.lead}>{t('organicLab.catalogLead')}</p>
          <ul className={styles.list}>
            {organicFiltered.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className={styles.cardBtn}
                  onClick={() => setSelectedOrganic(organicMoleculeById[m.id] ?? m)}
                  aria-label={t('catalog.moreDetails', {
                    name: organicName(m, locale),
                    formula: m.formula,
                  })}
                >
                  <span className={styles.formula}>{m.formula}</span>
                  <span className={styles.name}>{organicName(m, locale)}</span>
                  <p className={styles.desc}>{organicDesc(m, locale)}</p>
                  <p className={styles.labRecipe}>{t('organicLab.openInLab')}</p>
                  <div className={styles.atomDots} aria-hidden>
                    {m.graph.atoms.some((a) => a.element === 'C') ? (
                      <span className={styles.dotC} title="C" />
                    ) : null}
                    {m.graph.atoms.some((a) => a.element === 'H') ? (
                      <span className={styles.dotH} title="H" />
                    ) : null}
                    {m.graph.atoms.some((a) => a.element === 'O') ? (
                      <span className={styles.dotO} title="O" />
                    ) : null}
                    {m.graph.atoms.some((a) => a.element === 'N') ? (
                      <span className={styles.dotN} title="N" />
                    ) : null}
                    {m.graph.atoms.some((a) => a.element === 'Cl') ? (
                      <span className={styles.dotCl} title="Cl" />
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {COMPOUND_CATEGORY_ORDER.map((cat) => {
        const items = byCategory.get(cat) ?? []
        if (items.length === 0) return null
        return (
          <section key={cat} className={styles.section}>
            <h2 className={styles.sectionTitle}>{t(sectionTitleKey(cat))}</h2>
            <ul className={styles.list}>
              {items.map((c) => {
                const loc = getCompoundLocaleStrings(c, locale, t)
                const synth = loc.synthesisConditions
                const synthTitle = `T: ${synth.temperature ?? ''}\n${synth.pressure ?? ''}\n${synth.catalyst ?? ''}`
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={styles.cardBtn}
                      onClick={() => setSelectedId(c.id)}
                      aria-label={t('catalog.moreDetails', { name: loc.name, formula: c.formulaUnicode })}
                    >
                      <span className={styles.formula}>{c.formulaUnicode}</span>
                      <span className={styles.name}>{loc.name}</span>
                      <p className={styles.desc}>{loc.description}</p>
                      <p className={styles.labRecipe}>{loc.laboratoryRecipe}</p>
                      <p className={styles.synthPreview} title={synthTitle}>
                        <span className={styles.synthPreviewLabel}>{t('catalog.synthPreviewLabel')}</span>{' '}
                        <span className={styles.synthPreviewT}>{t('catalog.synthPreviewT')}</span>
                        <span className={styles.synthPreviewDot}>·</span>
                        <span className={styles.synthPreviewP}>{t('catalog.synthPreviewP')}</span>
                        <span className={styles.synthPreviewDot}>·</span>
                        <span className={styles.synthPreviewK}>{t('catalog.synthPreviewK')}</span>
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      <CompoundDetailModal compoundId={selectedId} onClose={() => setSelectedId(null)} />
      <OrganicMoleculeDetailModal mol={selectedOrganic} onClose={() => setSelectedOrganic(null)} />
    </div>
  )
}
