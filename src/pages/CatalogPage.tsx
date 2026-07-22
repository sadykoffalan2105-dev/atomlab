import { useCallback, useMemo, useState } from 'react'
import { describePassportRu } from '../chemistry/reactionPassport'
import { reactantsSummaryRu } from '../chemistry/reactionReactantLabels'
import { passportForReaction, SCHOOL_REACTION_BANK } from '../chemistry/schoolReactionBank'
import { REACTION_CLASS_META, type ReactionClass } from '../chemistry/reactionTypeTaxonomy'
import { CompoundDetailModal } from '../components/lab/CompoundDetailModal'
import { OrganicMoleculeDetailModal } from '../components/organicLab/OrganicMoleculeDetailModal'
import { COMPOUND_CATEGORY_ORDER } from '../data/compoundCategoryLabels'
import { filterCompoundsForCatalog } from '../data/compoundCatalogFilter'
import {
  filterInorganicCompoundsByChapter,
  filterInorganicCompoundsByGrade,
  filterOrganicByGrade,
  inorganicChapterForId,
  inorganicGradesForId,
  INORGANIC_CHAPTERS,
  type CatalogDomain,
  type InorganicChapter,
  type InorganicSchoolGrade,
  type OrganicSchoolGrade,
} from '../data/curriculum/compoundGradeIndex'
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
  const [domain, setDomain] = useState<CatalogDomain>('inorganic')
  const [inorganicGrade, setInorganicGrade] = useState<InorganicSchoolGrade | 'all'>('all')
  const [inorganicChapter, setInorganicChapter] = useState<InorganicChapter | 'all'>('all')
  const [inorganicView, setInorganicView] = useState<'substances' | 'reactions'>('substances')
  const [reactionClass, setReactionClass] = useState<ReactionClass | 'all'>('all')
  const [organicGrade, setOrganicGrade] = useState<OrganicSchoolGrade | 'all'>('all')

  const list = useMemo(() => Object.values(compoundById), [])

  const searchBlob = useCallback((c: (typeof list)[number]) => compoundSearchBlob(c, locale, t), [locale, t])

  const inorganicByGrade = useMemo(
    () => filterInorganicCompoundsByGrade(list, inorganicGrade),
    [list, inorganicGrade],
  )

  const inorganicBase = useMemo(
    () => filterInorganicCompoundsByChapter(inorganicByGrade, inorganicChapter),
    [inorganicByGrade, inorganicChapter],
  )

  const filtered = useMemo(
    () => filterCompoundsForCatalog(inorganicBase, q, 'all', searchBlob),
    [inorganicBase, q, searchBlob],
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

  const organicBase = useMemo(
    () => filterOrganicByGrade(ORGANIC_MOLECULES, organicGrade),
    [organicGrade],
  )

  const organicFiltered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    if (!qq) return organicBase
    return organicBase.filter((m) => {
      const blob = `${m.id} ${m.formula} ${m.nameRu} ${m.nameEn} ${m.nameUz}`.toLowerCase()
      return blob.includes(qq)
    })
  }, [organicBase, q])

  const reactionsFiltered = useMemo(() => {
    let rows = [...SCHOOL_REACTION_BANK]
    if (inorganicGrade !== 'all') {
      rows = rows.filter((r) => r.grades.includes(inorganicGrade))
    }
    if (reactionClass !== 'all') {
      rows = rows.filter((r) => r.reactionClass === reactionClass)
    }
    const qq = q.trim().toLowerCase()
    if (qq) {
      rows = rows.filter((r) => `${r.equationRu} ${r.howToRu} ${r.id}`.toLowerCase().includes(qq))
    }
    return rows
  }, [inorganicGrade, reactionClass, q])

  const inorganicCount = inorganicView === 'substances' ? filtered.length : reactionsFiltered.length
  const organicCount = organicFiltered.length

  return (
    <div className={styles.page}>
      <h1 className={styles.h}>{t('catalog.title')}</h1>
      <p className={styles.lead}>{t('catalog.lead')}</p>

      <div className={styles.domainRow} role="tablist" aria-label={t('catalog.domainAria')}>
        {(
          [
            ['inorganic', 'catalog.domainInorganic'],
            ['organic', 'catalog.domainOrganic'],
          ] as const
        ).map(([id, key]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={domain === id}
            className={domain === id ? `${styles.domainBtn} ${styles.domainBtnOn}` : styles.domainBtn}
            onClick={() => setDomain(id)}
          >
            {t(key)}
          </button>
        ))}
      </div>

      {domain === 'inorganic' ? (
        <>
        <div className={styles.viewRow} role="group" aria-label={t('catalog.inorganicViewAria')}>
          {(
            [
              ['substances', 'catalog.viewSubstances'],
              ['reactions', 'catalog.viewReactions'],
            ] as const
          ).map(([id, key]) => (
            <button
              key={id}
              type="button"
              className={
                inorganicView === id ? `${styles.viewChip} ${styles.viewChipOn}` : styles.viewChip
              }
              onClick={() => setInorganicView(id)}
            >
              {t(key)}
            </button>
          ))}
        </div>
        <div className={styles.gradeRow} role="group" aria-label={t('catalog.inorganicGradeAria')}>
          {(
            [
              ['all', 'catalog.gradeAll'],
              ['7', 'catalog.grade7'],
              ['8', 'catalog.grade8'],
              ['9', 'catalog.grade9'],
            ] as const
          ).map(([g, key]) => (
            <button
              key={g}
              type="button"
              className={
                inorganicGrade === g ? `${styles.gradeChip} ${styles.gradeChipOn}` : styles.gradeChip
              }
              onClick={() => setInorganicGrade(g === 'all' ? 'all' : (Number(g) as InorganicSchoolGrade))}
            >
              {t(key)}
            </button>
          ))}
          <span className={styles.countBadge}>
            {inorganicCount} / {list.length}
          </span>
        </div>
        {inorganicView === 'substances' ? (
          <div className={styles.chapterRow} role="group" aria-label={t('catalog.chapterAria')}>
            <button
              type="button"
              className={
                inorganicChapter === 'all' ? `${styles.chapterChip} ${styles.chapterChipOn}` : styles.chapterChip
              }
              onClick={() => setInorganicChapter('all')}
            >
              {t('catalog.gradeAll')}
            </button>
            {INORGANIC_CHAPTERS.map((ch) => (
              <button
                key={ch}
                type="button"
                className={
                  inorganicChapter === ch ? `${styles.chapterChip} ${styles.chapterChipOn}` : styles.chapterChip
                }
                onClick={() => setInorganicChapter(ch)}
              >
                {ch}
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.chapterRow} role="group" aria-label={t('catalog.reactionClassAria')}>
            <button
              type="button"
              className={
                reactionClass === 'all' ? `${styles.chapterChip} ${styles.chapterChipOn}` : styles.chapterChip
              }
              onClick={() => setReactionClass('all')}
            >
              {t('catalog.gradeAll')}
            </button>
            {REACTION_CLASS_META.map((meta) => (
              <button
                key={meta.id}
                type="button"
                className={
                  reactionClass === meta.id ? `${styles.chapterChip} ${styles.chapterChipOn}` : styles.chapterChip
                }
                onClick={() => setReactionClass(meta.id)}
              >
                {locale === 'en' ? meta.titleEn : meta.titleRu}
              </button>
            ))}
          </div>
        )}
        </>
      ) : (
        <div className={styles.gradeRow} role="group" aria-label={t('catalog.organicGradeAria')}>
          {(
            [
              ['all', 'catalog.gradeAll'],
              ['g10', 'catalog.grade10'],
              ['g11', 'catalog.grade11'],
            ] as const
          ).map(([g, key]) => (
            <button
              key={g}
              type="button"
              className={
                organicGrade === g ? `${styles.gradeChip} ${styles.gradeChipOn}` : styles.gradeChip
              }
              onClick={() => setOrganicGrade(g === 'all' ? 'all' : (g as OrganicSchoolGrade))}
            >
              {t(key)}
            </button>
          ))}
          <span className={styles.countBadge}>{organicCount}</span>
        </div>
      )}

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

      {domain === 'organic' ? (
        organicFiltered.length > 0 ? (
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
                    <span className={styles.gradeTag}>
                      {m.grade === 'g11' ? t('catalog.grade11') : t('catalog.grade10')}
                    </span>
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
        ) : (
          <p className={styles.empty}>{t('catalog.emptyFilter')}</p>
        )
      ) : inorganicView === 'reactions' ? (
        reactionsFiltered.length > 0 ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('catalog.reactionsSection')}</h2>
            <ul className={styles.list}>
              {reactionsFiltered.map((r) => {
                const meta = REACTION_CLASS_META.find((m) => m.id === r.reactionClass)
                const passport = passportForReaction(r)
                const title = locale === 'en' ? r.titleEn : r.titleRu
                const reactantsLine = reactantsSummaryRu(r.reactants)
                return (
                  <li key={r.id}>
                    <article className={styles.reactionCard}>
                      <span className={styles.name}>{title}</span>
                      <span className={styles.formula}>{r.equationRu}</span>
                      <span className={styles.gradeTag}>
                        {meta?.titleRu ?? r.reactionClass} · {r.grades.map((g) => `${g} кл.`).join(', ')}
                      </span>
                      <p className={styles.reactantsLine} title="3D: реагенты">
                        {reactantsLine}
                      </p>
                      <p className={styles.desc}>{locale === 'en' ? r.howToEn : r.howToRu}</p>
                      <p className={styles.passportLine}>{describePassportRu(passport)}</p>
                    </article>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : (
          <p className={styles.empty}>{t('catalog.emptyFilter')}</p>
        )
      ) : (
        <>
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
                          <span className={styles.gradeTag}>
                            {inorganicGradesForId(c.id).join('·')} кл. · {inorganicChapterForId(c.id)}
                          </span>
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
          {inorganicCount === 0 ? <p className={styles.empty}>{t('catalog.emptyFilter')}</p> : null}
        </>
      )}

      <CompoundDetailModal compoundId={selectedId} onClose={() => setSelectedId(null)} />
      <OrganicMoleculeDetailModal mol={selectedOrganic} onClose={() => setSelectedOrganic(null)} />
    </div>
  )
}
