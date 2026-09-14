import { memo, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { describePassportRu } from '../chemistry/reactionPassport'
import { reactantsSummaryRu } from '../chemistry/reactionReactantLabels'
import { passportForReaction, SCHOOL_REACTION_BANK } from '../chemistry/schoolReactionBank'
import { REACTION_CLASS_META, type ReactionClass } from '../chemistry/reactionTypeTaxonomy'
import {
  atomColor,
  CATEGORY_TONE,
  formatMolarMass,
  molarMass,
  REACTION_TONE,
} from '../components/catalog/catalogVisuals'
import { MoleculeThumb, MoleculeThumbDefs, type ThumbAtom, type ThumbBond } from '../components/catalog/MoleculeThumb'
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
import { ORGANIC_MOLECULES, organicMoleculeById } from '../data/organicLab/organicMoleculeRegistry'
import type { OrganicMoleculeDef } from '../data/organicLab/organicMoleculeTypes'
import { compoundSearchBlob, getCompoundLocaleStrings } from '../i18n/compoundLocale'
import type { MessageKey } from '../i18n/useT'
import { useT } from '../i18n/useT'
import type { CompoundCategory, CompoundDef } from '../types/chemistry'
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

/** Короткий знак класса в заголовке секции. */
const CATEGORY_GLYPH: Record<CompoundCategory, string> = {
  oxide: 'EₓOᵧ',
  acid: 'H⁺',
  base: 'OH⁻',
  salt: 'Me·A',
  other: '◇',
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

function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s
}

function toneStyle(a: string, b: string): CSSProperties {
  return { '--tone-a': a, '--tone-b': b } as CSSProperties
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="8.6" cy="8.6" r="5.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="m12.8 12.8 4.2 4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function IconFlask({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 3h6M10 3v5.2L4.6 17.4A2.4 2.4 0 0 0 6.7 21h10.6a2.4 2.4 0 0 0 2.1-3.6L14 8.2V3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7.2 14.5h9.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
      <circle cx="10.5" cy="17.4" r="1" fill="currentColor" />
      <circle cx="14" cy="16.6" r="0.7" fill="currentColor" opacity="0.8" />
    </svg>
  )
}

function IconEmpty({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="21" cy="21" r="12" stroke="currentColor" strokeWidth="2.4" />
      <path d="m30 30 9 9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16.5 21h9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

const compoundThumbCache = new Map<string, { atoms: ThumbAtom[]; bonds: ThumbBond[] }>()

function compoundThumb(c: CompoundDef) {
  let v = compoundThumbCache.get(c.id)
  if (!v) {
    v = {
      atoms: c.atoms.map((a) => ({ el: a.symbol, pos: a.pos })),
      bonds: c.bonds.map(([a, b]) => ({ a, b })),
    }
    compoundThumbCache.set(c.id, v)
  }
  return v
}

const organicThumbCache = new Map<string, { atoms: ThumbAtom[]; bonds: ThumbBond[] }>()

function organicThumb(m: OrganicMoleculeDef) {
  let v = organicThumbCache.get(m.id)
  if (!v) {
    const index = new Map(m.graph.atoms.map((a, i) => [a.id, i]))
    v = {
      atoms: m.graph.atoms.map((a) => ({ el: a.element, pos: a.pos })),
      bonds: m.graph.bonds
        .map((b) => ({ a: index.get(b.a) ?? -1, b: index.get(b.b) ?? -1, order: b.order }))
        .filter((b) => b.a >= 0 && b.b >= 0),
    }
    organicThumbCache.set(m.id, v)
  }
  return v
}

function ElementChips({ symbols }: { symbols: readonly string[] }) {
  return (
    <span className={styles.elements} aria-hidden>
      {symbols.slice(0, 5).map((el) => (
        <span key={el} className={styles.elChip} style={{ '--el': atomColor(el) } as CSSProperties}>
          {el}
        </span>
      ))}
      {symbols.length > 5 ? <span className={styles.elMore}>+{symbols.length - 5}</span> : null}
    </span>
  )
}

const SubstanceCard = memo(function SubstanceCard({
  c,
  onOpen,
}: {
  c: CompoundDef
  onOpen: (id: string) => void
}) {
  const { locale, t } = useT()
  const loc = getCompoundLocaleStrings(c, locale, t)
  const tone = CATEGORY_TONE[c.category]
  const mass = molarMass(c.composition)
  const thumb = compoundThumb(c)
  const grades = inorganicGradesForId(c.id)

  return (
    <button
      type="button"
      className={styles.card}
      style={toneStyle(tone.a, tone.b)}
      onClick={() => onOpen(c.id)}
      aria-label={t('catalog.moreDetails', { name: loc.name, formula: c.formulaUnicode })}
    >
      <span className={styles.visual}>
        <span className={styles.catPill}>{t(categoryLabelKey(c.category))}</span>
        <span className={styles.gradePill}>
          {grades.join('·')} {t('catalog.gradeShort')}
        </span>
        <MoleculeThumb className={styles.thumb} atoms={thumb.atoms} bonds={thumb.bonds} />
      </span>
      <span className={styles.body}>
        <span className={styles.formula}>{c.formulaUnicode}</span>
        <span className={styles.name}>{loc.name}</span>
        <span className={styles.desc}>{loc.description}</span>
      </span>
      <span className={styles.foot}>
        <ElementChips symbols={Object.keys(c.composition)} />
        {mass != null ? (
          <span className={styles.mass}>
            {formatMolarMass(mass, locale)} <small>{t('catalog.molarMassUnit')}</small>
          </span>
        ) : null}
        <span className={styles.go} aria-hidden>
          →
        </span>
      </span>
    </button>
  )
})

const OrganicCard = memo(function OrganicCard({
  m,
  onOpen,
}: {
  m: OrganicMoleculeDef
  onOpen: (m: OrganicMoleculeDef) => void
}) {
  const { locale, t } = useT()
  const thumb = organicThumb(m)
  const counts: Record<string, number> = {}
  for (const a of m.graph.atoms) counts[a.element] = (counts[a.element] ?? 0) + 1
  const mass = molarMass(counts)
  const groups = [...new Map(m.functionalGroups.map((g) => [g.label, g])).values()].slice(0, 2)

  return (
    <button
      type="button"
      className={styles.card}
      style={toneStyle(m.accentColor || '#34d399', '#6366f1')}
      onClick={() => onOpen(organicMoleculeById[m.id] ?? m)}
      aria-label={t('catalog.moreDetails', { name: organicName(m, locale), formula: m.formula })}
    >
      <span className={styles.visual}>
        <span className={styles.catPill}>{m.grade === 'g11' ? t('catalog.grade11') : t('catalog.grade10')}</span>
        <MoleculeThumb className={styles.thumb} atoms={thumb.atoms} bonds={thumb.bonds} />
      </span>
      <span className={styles.body}>
        <span className={styles.formula}>{m.formula}</span>
        <span className={styles.name}>{organicName(m, locale)}</span>
        <span className={styles.desc}>{organicDesc(m, locale)}</span>
      </span>
      <span className={styles.foot}>
        {groups.length > 0 ? (
          <span className={styles.groups}>
            {groups.map((g) => (
              <span key={g.id} className={styles.groupChip}>
                {g.label}
              </span>
            ))}
          </span>
        ) : (
          <ElementChips symbols={Object.keys(counts)} />
        )}
        {mass != null ? (
          <span className={styles.mass}>
            {formatMolarMass(mass, locale)} <small>{t('catalog.molarMassUnit')}</small>
          </span>
        ) : null}
        <span className={styles.go} aria-hidden>
          →
        </span>
      </span>
    </button>
  )
})

export function CatalogPage() {
  const { locale, t } = useT()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedOrganic, setSelectedOrganic] = useState<OrganicMoleculeDef | null>(null)
  const [q, setQ] = useState('')
  const [domain, setDomain] = useState<CatalogDomain>('inorganic')
  const [inorganicGrade, setInorganicGrade] = useState<InorganicSchoolGrade | 'all'>('all')
  const [inorganicChapter, setInorganicChapter] = useState<InorganicChapter | 'all'>('all')
  const [inorganicView, setInorganicView] = useState<'substances' | 'reactions'>('substances')
  const [category, setCategory] = useState<CompoundCategory | 'all'>('all')
  const [reactionClass, setReactionClass] = useState<ReactionClass | 'all'>('all')
  const [highlightReactionId, setHighlightReactionId] = useState<string | null>(null)
  const [organicGrade, setOrganicGrade] = useState<OrganicSchoolGrade | 'all'>('all')

  const openSchoolReaction = useCallback((reactionId: string) => {
    setSelectedId(null)
    setDomain('inorganic')
    setInorganicView('reactions')
    setReactionClass('all')
    setInorganicGrade('all')
    setQ('')
    setHighlightReactionId(reactionId)
  }, [])

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

  /** Поиск без фильтра по типу — из него же считаются счётчики чипов типа. */
  const searched = useMemo(
    () => filterCompoundsForCatalog(inorganicBase, q, 'all', searchBlob),
    [inorganicBase, q, searchBlob],
  )

  const categoryCounts = useMemo(() => {
    const m = new Map<CompoundCategory, number>()
    for (const c of searched) m.set(c.category, (m.get(c.category) ?? 0) + 1)
    return m
  }, [searched])

  const filtered = useMemo(
    () => (category === 'all' ? searched : searched.filter((c) => c.category === category)),
    [searched, category],
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

  const organicBase = useMemo(() => filterOrganicByGrade(ORGANIC_MOLECULES, organicGrade), [organicGrade])

  const organicFiltered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    if (!qq) return organicBase
    return organicBase.filter((m) => {
      const blob = `${m.id} ${m.formula} ${m.nameRu} ${m.nameEn} ${m.nameUz}`.toLowerCase()
      return blob.includes(qq)
    })
  }, [organicBase, q])

  const reactionsBeforeClass = useMemo(() => {
    let rows = [...SCHOOL_REACTION_BANK]
    if (inorganicGrade !== 'all') {
      rows = rows.filter((r) => r.grades.includes(inorganicGrade))
    }
    const qq = q.trim().toLowerCase()
    if (qq) {
      rows = rows.filter((r) => `${r.equationRu} ${r.howToRu} ${r.id}`.toLowerCase().includes(qq))
    }
    return rows
  }, [inorganicGrade, q])

  const reactionClassCounts = useMemo(() => {
    const m = new Map<ReactionClass, number>()
    for (const r of reactionsBeforeClass) m.set(r.reactionClass, (m.get(r.reactionClass) ?? 0) + 1)
    return m
  }, [reactionsBeforeClass])

  const reactionsFiltered = useMemo(
    () =>
      reactionClass === 'all' ? reactionsBeforeClass : reactionsBeforeClass.filter((r) => r.reactionClass === reactionClass),
    [reactionsBeforeClass, reactionClass],
  )

  useEffect(() => {
    if (!highlightReactionId || inorganicView !== 'reactions') return
    const el = document.getElementById(`school-rx-${highlightReactionId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Карточка, открывшая модалку, размонтирована — фокус переносим на найденную реакцию.
    el?.focus({ preventScroll: true })
    const timer = window.setTimeout(() => setHighlightReactionId(null), 4500)
    return () => window.clearTimeout(timer)
  }, [highlightReactionId, inorganicView, reactionsFiltered.length])

  const onOpenSubstance = useCallback((id: string) => setSelectedId(id), [])
  const onOpenOrganic = useCallback((m: OrganicMoleculeDef) => setSelectedOrganic(m), [])

  const resetFilters = useCallback(() => {
    setQ('')
    setInorganicGrade('all')
    setInorganicChapter('all')
    setCategory('all')
    setReactionClass('all')
    setOrganicGrade('all')
  }, [])

  const isOrganic = domain === 'organic'
  const isReactions = !isOrganic && inorganicView === 'reactions'
  const shownCount = isOrganic ? organicFiltered.length : isReactions ? reactionsFiltered.length : filtered.length
  const totalCount = isOrganic ? ORGANIC_MOLECULES.length : isReactions ? SCHOOL_REACTION_BANK.length : list.length

  const empty = (
    <div className={styles.empty}>
      <IconEmpty className={styles.emptyIcon} />
      <p className={styles.emptyTitle}>{t('catalog.emptyTitle')}</p>
      <p className={styles.emptyText}>{t('catalog.emptyFilter')}</p>
      <button type="button" className={styles.resetBtn} onClick={resetFilters}>
        {t('catalog.resetFilters')}
      </button>
    </div>
  )

  const stats = [
    {
      id: 'substances',
      value: list.length,
      label: t('catalog.statSubstances'),
      active: !isOrganic && !isReactions,
      tone: ['#38bdf8', '#6366f1'],
      go: () => {
        setDomain('inorganic')
        setInorganicView('substances')
      },
    },
    {
      id: 'reactions',
      value: SCHOOL_REACTION_BANK.length,
      label: t('catalog.statReactions'),
      active: isReactions,
      tone: ['#fb7185', '#f97316'],
      go: () => {
        setDomain('inorganic')
        setInorganicView('reactions')
      },
    },
    {
      id: 'organic',
      value: ORGANIC_MOLECULES.length,
      label: t('catalog.statOrganic'),
      active: isOrganic,
      tone: ['#34d399', '#14b8a6'],
      go: () => setDomain('organic'),
    },
  ] as const

  return (
    <div className={styles.page}>
      <div className={styles.backdrop} aria-hidden />
      <MoleculeThumbDefs />
      <div className={styles.inner}>
        <header className={styles.hero}>
          <div className={styles.heroMain}>
            <span className={styles.heroBadge} aria-hidden>
              <IconFlask />
            </span>
            <div className={styles.heroText}>
              <p className={styles.eyebrow}>{t('catalog.eyebrow')}</p>
              <h1 className={styles.title}>{t('catalog.title')}</h1>
              <p className={styles.lead}>{t('catalog.lead')}</p>
            </div>
          </div>
          <div className={styles.stats}>
            {stats.map((s) => (
              <button
                key={s.id}
                type="button"
                className={s.active ? `${styles.stat} ${styles.statOn}` : styles.stat}
                style={toneStyle(s.tone[0], s.tone[1])}
                onClick={s.go}
                aria-pressed={s.active}
              >
                <span className={styles.statValue}>{s.value}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </button>
            ))}
          </div>
        </header>

        <div className={styles.toolbar}>
          <div className={styles.toolbarRow}>
            <div className={styles.segment} role="tablist" aria-label={t('catalog.domainAria')}>
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
                  className={domain === id ? `${styles.segBtn} ${styles.segBtnOn}` : styles.segBtn}
                  onClick={() => setDomain(id)}
                >
                  {t(key)}
                </button>
              ))}
            </div>

            {!isOrganic ? (
              <div className={styles.segment} role="group" aria-label={t('catalog.inorganicViewAria')}>
                {(
                  [
                    ['substances', 'catalog.viewSubstances'],
                    ['reactions', 'catalog.viewReactions'],
                  ] as const
                ).map(([id, key]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={inorganicView === id}
                    className={inorganicView === id ? `${styles.segBtn} ${styles.segBtnOn}` : styles.segBtn}
                    onClick={() => setInorganicView(id)}
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            ) : null}

            <label className={styles.search}>
              <IconSearch className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('catalog.placeholder')}
                aria-label={t('catalog.searchAria')}
                autoComplete="off"
                spellCheck={false}
              />
              {q ? (
                <button
                  type="button"
                  className={styles.searchClear}
                  onClick={() => setQ('')}
                  aria-label={t('catalog.searchClear')}
                >
                  ×
                </button>
              ) : null}
            </label>
          </div>

          <div className={styles.toolbarRow}>
            <div
              className={styles.filterGroup}
              role="group"
              aria-label={isOrganic ? t('catalog.organicGradeAria') : t('catalog.inorganicGradeAria')}
            >
              <span className={styles.filterLabel}>{t('catalog.gradeLabel')}</span>
              {isOrganic
                ? (
                    [
                      ['all', t('catalog.gradeAll')],
                      ['g10', '10'],
                      ['g11', '11'],
                    ] as const
                  ).map(([g, label]) => (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={organicGrade === g}
                      className={organicGrade === g ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                      onClick={() => setOrganicGrade(g)}
                    >
                      {label}
                    </button>
                  ))
                : (
                    [
                      ['all', t('catalog.gradeAll')],
                      [7, '7'],
                      [8, '8'],
                      [9, '9'],
                    ] as const
                  ).map(([g, label]) => (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={inorganicGrade === g}
                      className={inorganicGrade === g ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                      onClick={() => setInorganicGrade(g)}
                    >
                      {label}
                    </button>
                  ))}
            </div>

            {!isOrganic && !isReactions ? (
              <div className={styles.filterGroup} role="group" aria-label={t('catalog.categoryLabel')}>
                <span className={styles.filterLabel}>{t('catalog.categoryLabel')}</span>
                <button
                  type="button"
                  aria-pressed={category === 'all'}
                  className={category === 'all' ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                  onClick={() => setCategory('all')}
                >
                  {t('catalog.gradeAll')}
                  <span className={styles.chipCount}>{searched.length}</span>
                </button>
                {COMPOUND_CATEGORY_ORDER.map((cat) => {
                  const n = categoryCounts.get(cat) ?? 0
                  const tone = CATEGORY_TONE[cat]
                  return (
                    <button
                      key={cat}
                      type="button"
                      aria-pressed={category === cat}
                      disabled={n === 0 && category !== cat}
                      className={category === cat ? `${styles.chip} ${styles.chipTone} ${styles.chipOn}` : `${styles.chip} ${styles.chipTone}`}
                      style={toneStyle(tone.a, tone.b)}
                      onClick={() => setCategory(category === cat ? 'all' : cat)}
                    >
                      <span className={styles.chipDot} aria-hidden />
                      {t(sectionTitleKey(cat))}
                      <span className={styles.chipCount}>{n}</span>
                    </button>
                  )
                })}
              </div>
            ) : null}

            <span className={styles.results} role="status">
              {t('catalog.results', { count: shownCount })}
              <span className={styles.resultsTotal}> / {totalCount}</span>
            </span>
          </div>

          {!isOrganic ? (
            <div className={styles.scrollRow}>
              <span className={styles.filterLabel}>
                {isReactions ? t('catalog.reactionClassAria') : t('catalog.chapterLabel')}
              </span>
              <div
                className={styles.scrollChips}
                role="group"
                aria-label={isReactions ? t('catalog.reactionClassAria') : t('catalog.chapterAria')}
              >
                {isReactions ? (
                  <>
                    <button
                      type="button"
                      aria-pressed={reactionClass === 'all'}
                      className={reactionClass === 'all' ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                      onClick={() => setReactionClass('all')}
                    >
                      {t('catalog.gradeAll')}
                    </button>
                    {REACTION_CLASS_META.map((meta) => {
                      const n = reactionClassCounts.get(meta.id) ?? 0
                      const tone = REACTION_TONE[meta.id]
                      return (
                        <button
                          key={meta.id}
                          type="button"
                          aria-pressed={reactionClass === meta.id}
                          disabled={n === 0 && reactionClass !== meta.id}
                          className={
                            reactionClass === meta.id
                              ? `${styles.chip} ${styles.chipTone} ${styles.chipOn}`
                              : `${styles.chip} ${styles.chipTone}`
                          }
                          style={toneStyle(tone, tone)}
                          onClick={() => setReactionClass(reactionClass === meta.id ? 'all' : meta.id)}
                        >
                          <span className={styles.chipDot} aria-hidden />
                          {locale === 'en' ? meta.titleEn : meta.titleRu}
                          <span className={styles.chipCount}>{n}</span>
                        </button>
                      )
                    })}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-pressed={inorganicChapter === 'all'}
                      className={inorganicChapter === 'all' ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                      onClick={() => setInorganicChapter('all')}
                    >
                      {t('catalog.gradeAll')}
                    </button>
                    {INORGANIC_CHAPTERS.map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        aria-pressed={inorganicChapter === ch}
                        className={inorganicChapter === ch ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                        onClick={() => setInorganicChapter(inorganicChapter === ch ? 'all' : ch)}
                      >
                        {capitalize(ch)}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {isOrganic ? (
          organicFiltered.length > 0 ? (
            <section className={styles.section} style={toneStyle('#34d399', '#14b8a6')}>
              <header className={styles.sectionHead}>
                <span className={styles.sectionGlyph} aria-hidden>
                  C–H
                </span>
                <div className={styles.sectionText}>
                  <h2 className={styles.sectionTitle}>{t('organicLab.catalogSection')}</h2>
                  <p className={styles.sectionLead}>{t('organicLab.catalogLead')}</p>
                </div>
                <span className={styles.sectionCount}>{organicFiltered.length}</span>
              </header>
              <ul className={styles.grid}>
                {organicFiltered.map((m) => (
                  <li key={m.id} className={styles.item}>
                    <OrganicCard m={m} onOpen={onOpenOrganic} />
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            empty
          )
        ) : isReactions ? (
          reactionsFiltered.length > 0 ? (
            <section className={styles.section} style={toneStyle('#fb7185', '#f97316')}>
              <header className={styles.sectionHead}>
                <span className={styles.sectionGlyph} aria-hidden>
                  A+B
                </span>
                <div className={styles.sectionText}>
                  <h2 className={styles.sectionTitle}>{t('catalog.reactionsSection')}</h2>
                </div>
                <span className={styles.sectionCount}>{reactionsFiltered.length}</span>
              </header>
              <ul className={`${styles.grid} ${styles.gridWide}`}>
                {reactionsFiltered.map((r) => {
                  const meta = REACTION_CLASS_META.find((m) => m.id === r.reactionClass)
                  const passport = passportForReaction(r)
                  const title = locale === 'en' ? r.titleEn : r.titleRu
                  const tone = REACTION_TONE[r.reactionClass] ?? '#60a5fa'
                  const highlighted = highlightReactionId === r.id
                  return (
                    <li key={r.id} id={`school-rx-${r.id}`} className={styles.item} tabIndex={-1}>
                      <article
                        className={highlighted ? `${styles.rxCard} ${styles.rxCardHighlight}` : styles.rxCard}
                        style={toneStyle(tone, tone)}
                      >
                        <header className={styles.rxHead}>
                          <span className={styles.rxClass}>
                            <span className={styles.chipDot} aria-hidden />
                            {meta ? (locale === 'en' ? meta.titleEn : meta.titleRu) : r.reactionClass}
                          </span>
                          <span className={styles.gradePillInline}>
                            {r.grades.join('·')} {t('catalog.gradeShort')}
                          </span>
                        </header>
                        <h3 className={styles.rxTitle}>{title}</h3>
                        <p className={styles.equation}>{r.equationRu}</p>
                        <p className={styles.rxReactants}>{reactantsSummaryRu(r.reactants)}</p>
                        <p className={styles.rxHow}>{locale === 'en' ? r.howToEn : r.howToRu}</p>
                        <p className={styles.rxPassport}>{describePassportRu(passport)}</p>
                      </article>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : (
            empty
          )
        ) : filtered.length > 0 ? (
          COMPOUND_CATEGORY_ORDER.map((cat) => {
            const items = byCategory.get(cat) ?? []
            if (items.length === 0) return null
            const tone = CATEGORY_TONE[cat]
            return (
              <section key={cat} className={styles.section} style={toneStyle(tone.a, tone.b)}>
                <header className={styles.sectionHead}>
                  <span className={styles.sectionGlyph} aria-hidden>
                    {CATEGORY_GLYPH[cat]}
                  </span>
                  <div className={styles.sectionText}>
                    <h2 className={styles.sectionTitle}>{t(sectionTitleKey(cat))}</h2>
                  </div>
                  <span className={styles.sectionCount}>{items.length}</span>
                </header>
                <ul className={styles.grid}>
                  {items.map((c) => (
                    <li key={c.id} className={styles.item} title={capitalize(inorganicChapterForId(c.id))}>
                      <SubstanceCard c={c} onOpen={onOpenSubstance} />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })
        ) : (
          empty
        )}
      </div>

      <CompoundDetailModal
        compoundId={selectedId}
        onClose={() => setSelectedId(null)}
        onOpenSchoolReaction={openSchoolReaction}
      />
      <OrganicMoleculeDetailModal mol={selectedOrganic} onClose={() => setSelectedOrganic(null)} />
    </div>
  )
}
