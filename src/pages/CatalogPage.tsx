import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { atomColor, CATEGORY_TONE, formatMolarMass, molarMass } from '../components/catalog/catalogVisuals'
import { MoleculeThumb, MoleculeThumbDefs, type ThumbAtom, type ThumbBond } from '../components/catalog/MoleculeThumb'
import { CompoundDetailModal } from '../components/lab/CompoundDetailModal'
import { OrganicMoleculeDetailModal } from '../components/organicLab/OrganicMoleculeDetailModal'
import { COMPOUND_CATEGORY_ORDER } from '../data/compoundCategoryLabels'
import { filterCompoundsForCatalog } from '../data/compoundCatalogFilter'
import {
  catalogReactionHref,
  compareByTextbookOrder,
  countReactionTypes,
  countRows,
  filterUnits,
  gradeReactionStats,
  gradeToReaderId,
  labHrefWithSrc,
  normalizeFormulaQuery,
  paginateUnits,
  parseGradeParam,
  REACTION_TYPE_ORDER,
  type CatalogTab,
  type FilteredUnit,
  type ReactionFilter,
} from '../data/curriculum/catalogGradeStructure'
import {
  filterInorganicCompoundsByChapter,
  filterInorganicCompoundsByGrade,
  filterOrganicByGrade,
  formatGradeRange,
  inorganicChapterForId,
  inorganicFirstPageForId,
  inorganicGradesForId,
  INORGANIC_CHAPTERS,
  organicFirstPageForId,
  organicGradesForMolecule,
  SCHOOL_GRADES,
  type InorganicChapter,
  type SchoolGrade,
} from '../data/curriculum/compoundGradeIndex'
import { compoundById } from '../data/compounds'
import { ORGANIC_MOLECULES as ALL_ORGANIC_MOLECULES, organicMoleculeById } from '../data/organicLab/organicMoleculeRegistry'
import type { OrganicMoleculeDef } from '../data/organicLab/organicMoleculeTypes'
import { ORGANIC_CLASS_LABELS, type OrganicClassId } from '../data/researchLab/organicBuildCatalog'
import { isCatalogVisibleId } from '../data/textbook/catalogWhitelist'
import {
  isReaderGradeId,
  loadReaderGrade,
  READER_GRADE_IDS,
  type ReaderGrade,
  type ReaderGradeId,
  type ReaderReaction,
  type ReaderUnit,
} from '../data/textbook/bookReader'
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

/** Каталог показывает только вещества из учебников «Химия» 7–11. */
const ORGANIC_MOLECULES = ALL_ORGANIC_MOLECULES.filter((m) => isCatalogVisibleId(m.id))

const ORGANIC_CLASS_ORDER = Object.keys(ORGANIC_CLASS_LABELS) as OrganicClassId[]

function organicClassLabel(classId: string, locale: string): string {
  const l = ORGANIC_CLASS_LABELS[classId as OrganicClassId]
  if (!l) return classId
  return locale === 'en' ? l.en : locale === 'uz' ? l.uz : l.ru
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

const REACTION_TYPE_TONE: Record<string, string> = {
  combination: '#38bdf8',
  decomposition: '#f97316',
  substitution: '#a78bfa',
  exchange: '#34d399',
  neutralization: '#2dd4bf',
  combustion: '#fb7185',
  redox: '#fbbf24',
  hydrolysis: '#60a5fa',
  polymerization: '#c084fc',
  other: '#94a3b8',
}

const KNOWN_TYPES = new Set(REACTION_TYPE_ORDER)
const KNOWN_REASONS = new Set([
  'ionic',
  'scheme',
  'unknownSubstance',
  'organic',
  'noCompoundProduct',
  'tooManyTerms',
  'unbalanced',
])

function reactionTypeKey(type: string): MessageKey {
  return (KNOWN_TYPES.has(type) ? `learn.book.rx.type.${type}` : 'learn.book.rx.type.other') as MessageKey
}

function unsupportedKey(reason: string): MessageKey {
  return (
    KNOWN_REASONS.has(reason) ? `learn.book.rx.unsupported.${reason}` : 'learn.book.rx.unsupported.other'
  ) as MessageKey
}

function gradeLabelKey(g: SchoolGrade): MessageKey {
  return `catalog.grade${g}` as MessageKey
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
          {formatGradeRange(grades)} {t('catalog.gradeShort')}
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
  const grades = organicGradesForMolecule(m)

  return (
    <button
      type="button"
      className={styles.card}
      style={toneStyle(m.accentColor || '#34d399', '#6366f1')}
      onClick={() => onOpen(organicMoleculeById[m.id] ?? m)}
      aria-label={t('catalog.moreDetails', { name: organicName(m, locale), formula: m.formula })}
    >
      <span className={styles.visual}>
        <span className={styles.catPill}>{organicClassLabel(m.classId, locale)}</span>
        <span className={styles.gradePill}>
          {formatGradeRange(grades)} {t('catalog.gradeShort')}
        </span>
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

/** Сегмент «Все · 7 класс · 8 · 9 · 10 · 11» со счётчиками. */
function GradeSegment({
  value,
  onChange,
  counts,
  allowAll,
  ariaLabel,
}: {
  value: SchoolGrade | 'all'
  onChange: (g: SchoolGrade | 'all') => void
  counts: Partial<Record<SchoolGrade | 'all', number>>
  allowAll: boolean
  ariaLabel: string
}) {
  const { t } = useT()
  const items: (SchoolGrade | 'all')[] = allowAll ? ['all', ...SCHOOL_GRADES] : [...SCHOOL_GRADES]
  return (
    <div className={`${styles.segment} ${styles.gradeSeg}`} role="group" aria-label={ariaLabel}>
      {items.map((g) => {
        const on = value === g
        const n = counts[g]
        return (
          <button
            key={g}
            type="button"
            aria-pressed={on}
            className={on ? `${styles.segBtn} ${styles.segBtnOn}` : styles.segBtn}
            onClick={() => onChange(g)}
          >
            {g === 'all' ? t('catalog.gradeAll') : g === 7 ? t(gradeLabelKey(7)) : String(g)}
            {n != null ? <span className={styles.segCount}>{n}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

function pagesLabel(t: ReturnType<typeof useT>['t'], from: number | null, to: number | null): string | null {
  if (from == null && to == null) return null
  if (from != null && to != null && to !== from) return t('catalog.rx.pages', { from, to })
  return t('catalog.rx.page', { page: (from ?? to)! })
}

const TextbookReactionRow = memo(function TextbookReactionRow({
  r,
  gradeId,
  unitId,
  highlighted,
}: {
  r: ReaderReaction
  gradeId: ReaderGradeId
  unitId: string
  highlighted: boolean
}) {
  const { t } = useT()
  const [revealed, setRevealed] = useState(false)
  const tone = REACTION_TYPE_TONE[r.type] ?? REACTION_TYPE_TONE.other!
  const src = catalogReactionHref(gradeId, unitId, r.id)
  const showLab = !r.exercise || revealed
  const domId = `tb-rx-${unitId}-${r.id}`

  return (
    <li
      id={domId}
      className={highlighted ? `${styles.rxRow} ${styles.rxCardHighlight}` : styles.rxRow}
      style={toneStyle(tone, tone)}
      tabIndex={-1}
    >
      <div className={styles.rxRowTop}>
        <span className={styles.rxClass}>
          <span className={styles.chipDot} aria-hidden />
          {t(reactionTypeKey(r.type))}
        </span>
        {r.exercise ? <span className={styles.rxBadge}>{t('learn.book.rx.exerciseBadge')}</span> : null}
        {r.isIonic ? <span className={styles.rxBadge}>{t('learn.book.rx.ionicBadge')}</span> : null}
        {r.isGeneralScheme ? <span className={styles.rxBadge}>{t('learn.book.rx.schemeBadge')}</span> : null}
        {r.page != null ? <span className={styles.rxPage}>{t('catalog.rx.page', { page: r.page })}</span> : null}
      </div>

      {r.exercise ? (
        <>
          <p className={styles.rxAsInBook}>
            <span className={styles.rxMetaLabel}>{t('learn.book.rx.asInBook')}:</span>{' '}
            {r.asInBook ?? t('learn.book.rx.exerciseTitle')}
          </p>
          {revealed ? (
            <p className={styles.equation}>
              <span className={styles.rxAnswerTag}>{t('learn.book.rx.answer')}</span>
              {r.equation}
            </p>
          ) : null}
          <div className={styles.rxBtns}>
            <button
              type="button"
              className={styles.rxToggle}
              onClick={() => setRevealed((v) => !v)}
              aria-expanded={revealed}
            >
              {revealed ? t('catalog.rx.hideAnswer') : t('learn.book.rx.showAnswer')}
            </button>
          </div>
        </>
      ) : (
        <p className={styles.equation}>{r.equation}</p>
      )}

      {r.conditions ? (
        <p className={styles.rxMeta}>
          <span className={styles.rxMetaLabel}>{t('learn.book.rx.conditions')}:</span> {r.conditions}
        </p>
      ) : null}

      {showLab ? (
        r.lab.ok ? (
          <div className={styles.rxBtns}>
            <Link
              className={styles.rxLabLink}
              to={labHrefWithSrc(r.lab.href, src)}
              data-rx-lab-link={`${unitId}-${r.id}`}
            >
              {t('catalog.rx.openLab')}
              <span aria-hidden>→</span>
            </Link>
            <Link className={`${styles.rxLabLink} ${styles.rxLabLinkGhost}`} to={labHrefWithSrc(r.lab.href, src, true)}>
              {t('learn.book.rx.balanceSelf')}
            </Link>
          </div>
        ) : (
          <p className={styles.rxReason}>
            <span className={styles.rxMetaLabel}>{t('learn.book.rx.unsupportedTitle')}.</span>{' '}
            {t(unsupportedKey(r.lab.reason))}
            {r.lab.altHref ? (
              <>
                {' '}
                <Link className={styles.rxAltLink} to={r.lab.altHref}>
                  {t('learn.book.rx.openOrganic')} →
                </Link>
              </>
            ) : null}
          </p>
        )
      ) : null}
    </li>
  )
})

function UnitGroup({
  fu,
  gradeId,
  highlightKey,
}: {
  fu: FilteredUnit
  gradeId: ReaderGradeId
  highlightKey: string | null
}) {
  const { t } = useT()
  const u: ReaderUnit = fu.unit
  const pages = pagesLabel(t, u.pageStart, u.pageEnd)
  return (
    <section className={styles.rxUnit} id={`tb-unit-${u.unitId}`}>
      <header className={styles.rxUnitHead}>
        <h3 className={styles.rxUnitTitle}>
          {u.kp ? <span className={styles.rxUnitKp}>§ {u.kp}</span> : null}
          {u.title}
        </h3>
        <span className={styles.rxUnitMeta}>
          {pages ? <span>{pages}</span> : null}
          <span className={styles.sectionCount}>{fu.reactions.length}</span>
        </span>
      </header>
      <ul className={styles.rxList}>
        {fu.reactions.map((r) => (
          <TextbookReactionRow
            key={r.id}
            r={r}
            gradeId={gradeId}
            unitId={u.unitId}
            highlighted={highlightKey === `${u.unitId}:${r.id}`}
          />
        ))}
      </ul>
    </section>
  )
}

type RxTarget = { gradeId: ReaderGradeId; unitId: string; rxId: string | null }

const PAGE_ROWS = 60

/**
 * Параметры каталога: ?view=reactions|organic&grade=g8&unit=p24&rx=r3 (ссылка из интерактивного учебника).
 * Старый формат ?rx=<id банка> без unit — ищем реакцию учебника с таким bankId.
 */
function parseCatalogParams(sp: URLSearchParams): {
  tab: CatalogTab | null
  grade: SchoolGrade | null
  target: RxTarget | null
  legacyBankId: string | null
} {
  const view = sp.get('view')
  const gradeRaw = sp.get('grade')
  const grade = parseGradeParam(gradeRaw)
  const unit = sp.get('unit')
  const rx = sp.get('rx')
  const target: RxTarget | null = unit && isReaderGradeId(gradeRaw) ? { gradeId: gradeRaw, unitId: unit, rxId: rx } : null
  const legacyBankId = !unit && rx ? rx : null
  const tab: CatalogTab | null =
    view === 'reactions' || legacyBankId ? 'reactions' : view === 'organic' ? 'organic' : view === 'inorganic' ? 'inorganic' : null
  return { tab, grade, target, legacyBankId }
}

export function CatalogPage() {
  const { locale, t } = useT()
  /**
   * ?view=reactions&grade=g8&unit=p24&rx=r3 — вкладка «Реакции», класс, прокрутка к реакции параграфа
   * (ссылка из интерактивного учебника). Старый формат ?rx=<id банка> — ищем реакцию с таким bankId.
   */
  const [searchParams] = useSearchParams()
  const paramsKey = searchParams.toString()
  const [initial] = useState(() => parseCatalogParams(searchParams))
  const [appliedParamsKey, setAppliedParamsKey] = useState(paramsKey)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedOrganic, setSelectedOrganic] = useState<OrganicMoleculeDef | null>(null)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<CatalogTab>(initial.tab ?? 'inorganic')
  const [grade, setGrade] = useState<SchoolGrade | 'all'>(
    initial.grade ?? (initial.tab === 'reactions' ? 7 : 'all'),
  )
  const [inorganicChapter, setInorganicChapter] = useState<InorganicChapter | 'all'>('all')
  const [category, setCategory] = useState<CompoundCategory | 'all'>('all')
  const [reactionType, setReactionType] = useState<string | 'all'>('all')
  /** Лимит строк «показать ещё» привязан к ключу фильтров: смена класса/типа/поиска сбрасывает его. */
  const [rowLimitState, setRowLimitState] = useState<{ key: string; limit: number }>({ key: '', limit: PAGE_ROWS })

  // —— Реакции учебника: ленивые данные по классам ——
  const [readerGrades, setReaderGrades] = useState<Partial<Record<ReaderGradeId, ReaderGrade>>>({})
  const [readerErrors, setReaderErrors] = useState<Partial<Record<ReaderGradeId, true>>>({})
  const [rxTarget, setRxTarget] = useState<RxTarget | null>(initial.target)
  const [pendingBankId, setPendingBankId] = useState<string | null>(initial.legacyBankId)
  const [highlightKey, setHighlightKey] = useState<string | null>(null)
  const highlightTimer = useRef<number | null>(null)

  /** Ссылка изменилась без размонтирования (#/catalog → #/catalog?view=reactions…): применяем параметры. */
  if (paramsKey !== appliedParamsKey) {
    setAppliedParamsKey(paramsKey)
    const p = parseCatalogParams(searchParams)
    if (p.tab) setTab(p.tab)
    if (p.grade) setGrade(p.grade)
    if (p.target) setRxTarget(p.target)
    if (p.legacyBankId) setPendingBankId(p.legacyBankId)
  }

  const ensureGrade = useCallback((id: ReaderGradeId) => {
    loadReaderGrade(id)
      .then((g) => {
        setReaderGrades((prev) => (prev[id] ? prev : { ...prev, [id]: g }))
        setReaderErrors((prev) => {
          if (!prev[id]) return prev
          const next = { ...prev }
          delete next[id]
          return next
        })
      })
      .catch(() => setReaderErrors((prev) => ({ ...prev, [id]: true })))
  }, [])

  const isReactions = tab === 'reactions'
  const isOrganic = tab === 'organic'
  const rxGrade: SchoolGrade = grade === 'all' ? 7 : grade
  const rxGradeId = gradeToReaderId(rxGrade)
  const reader = readerGrades[rxGradeId]

  useEffect(() => {
    if (isReactions && !readerGrades[rxGradeId]) ensureGrade(rxGradeId)
  }, [isReactions, rxGradeId, readerGrades, ensureGrade])

  /** Остальные классы — в фоне, для счётчиков и общего числа реакций в шапке. */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const id of READER_GRADE_IDS) ensureGrade(id)
    }, 2000)
    return () => window.clearTimeout(timer)
  }, [ensureGrade])

  /** Старая ссылка ?rx=<id банка>: найти реакцию учебника с таким bankId (классы по порядку). */
  useEffect(() => {
    if (!pendingBankId) return
    let cancelled = false
    ;(async () => {
      for (const id of READER_GRADE_IDS) {
        const g = await loadReaderGrade(id).catch(() => null)
        if (cancelled) return
        if (!g) continue
        for (const u of g.units) {
          const hit = u.reactions.find((r) => r.bankId === pendingBankId)
          if (hit) {
            setGrade(g.grade)
            setReactionType('all')
            setQ('')
            setRxTarget({ gradeId: id, unitId: u.unitId, rxId: hit.id })
            setPendingBankId(null)
            return
          }
        }
      }
      setPendingBankId(null)
    })()
    return () => {
      cancelled = true
    }
  }, [pendingBankId])

  const openSchoolReaction = useCallback((reactionId: string) => {
    setSelectedId(null)
    setTab('reactions')
    setPendingBankId(reactionId)
  }, [])

  const list = useMemo(() => Object.values(compoundById).filter((c) => isCatalogVisibleId(c.id)), [])

  const searchBlob = useCallback((c: (typeof list)[number]) => compoundSearchBlob(c, locale, t), [locale, t])

  const inorganicByChapter = useMemo(
    () => filterInorganicCompoundsByChapter(list, inorganicChapter),
    [list, inorganicChapter],
  )

  /** Поиск + тема, без класса — из него считаются счётчики классов. */
  const inorganicSearched = useMemo(
    () => filterCompoundsForCatalog(inorganicByChapter, q, 'all', searchBlob),
    [inorganicByChapter, q, searchBlob],
  )

  const inorganicGradeCounts = useMemo(() => {
    const m: Partial<Record<SchoolGrade | 'all', number>> = { all: inorganicSearched.length }
    for (const g of SCHOOL_GRADES) m[g] = 0
    for (const c of inorganicSearched) for (const g of inorganicGradesForId(c.id)) m[g] = (m[g] ?? 0) + 1
    return m
  }, [inorganicSearched])

  const searched = useMemo(
    () => filterInorganicCompoundsByGrade(inorganicSearched, grade),
    [inorganicSearched, grade],
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
    const nameOf = (c: CompoundDef) => getCompoundLocaleStrings(c, locale, t).name
    for (const arr of m.values()) {
      arr.sort((a, b) => compareByTextbookOrder(a, b, (c) => inorganicFirstPageForId(c.id), nameOf, locale))
    }
    return m
  }, [filtered, locale, t])

  const organicSearched = useMemo(() => {
    const qq = q.trim().toLowerCase()
    if (!qq) return ORGANIC_MOLECULES
    return ORGANIC_MOLECULES.filter((m) => {
      const blob = `${m.id} ${m.formula} ${m.nameRu} ${m.nameEn} ${m.nameUz}`.toLowerCase()
      return blob.includes(qq)
    })
  }, [q])

  const organicGradeCounts = useMemo(() => {
    const m: Partial<Record<SchoolGrade | 'all', number>> = { all: organicSearched.length }
    for (const g of SCHOOL_GRADES) m[g] = 0
    for (const mol of organicSearched) for (const g of organicGradesForMolecule(mol)) m[g] = (m[g] ?? 0) + 1
    return m
  }, [organicSearched])

  const organicFiltered = useMemo(() => filterOrganicByGrade(organicSearched, grade), [organicSearched, grade])

  const organicByClass = useMemo(() => {
    const m = new Map<string, OrganicMoleculeDef[]>()
    for (const mol of organicFiltered) {
      const arr = m.get(mol.classId) ?? []
      arr.push(mol)
      m.set(mol.classId, arr)
    }
    for (const arr of m.values()) {
      arr.sort((a, b) =>
        compareByTextbookOrder(a, b, (x) => organicFirstPageForId(x.id), (x) => organicName(x, locale), locale),
      )
    }
    const known = ORGANIC_CLASS_ORDER as readonly string[]
    const order = [...known, ...[...m.keys()].filter((k) => !known.includes(k))]
    return order.filter((k) => m.has(k)).map((k) => [k, m.get(k)!] as const)
  }, [organicFiltered, locale])

  // —— Реакции: фильтр, счётчики, пагинация ——
  const reactionFilter = useMemo<ReactionFilter>(() => {
    const query = normalizeFormulaQuery(q.trim())
    const queryFormulas: string[] = []
    if (query.length >= 2) {
      const raw = q.trim().toLowerCase()
      for (const c of list) {
        if (queryFormulas.length >= 24) break
        const loc = getCompoundLocaleStrings(c, locale, t)
        if (loc.name.toLowerCase().includes(raw) || c.nameRu.toLowerCase().includes(raw)) {
          queryFormulas.push(normalizeFormulaQuery(c.formulaUnicode))
        }
      }
      for (const m of ORGANIC_MOLECULES) {
        if (queryFormulas.length >= 32) break
        if (`${m.nameRu} ${m.nameEn} ${m.nameUz}`.toLowerCase().includes(raw)) {
          queryFormulas.push(normalizeFormulaQuery(m.formula))
        }
      }
    }
    return { type: reactionType, query, queryFormulas }
  }, [q, reactionType, list, locale, t])

  const reactionTypeCounts = useMemo(
    () => (reader ? countReactionTypes(reader, reactionFilter) : new Map<string, number>()),
    [reader, reactionFilter],
  )

  const filteredUnits = useMemo(() => (reader ? filterUnits(reader, reactionFilter) : []), [reader, reactionFilter])
  const filteredRows = useMemo(() => countRows(filteredUnits), [filteredUnits])

  const targetUnitIndex = useMemo(() => {
    if (!rxTarget || rxTarget.gradeId !== rxGradeId) return -1
    return filteredUnits.findIndex((fu) => fu.unit.unitId === rxTarget.unitId)
  }, [rxTarget, rxGradeId, filteredUnits])

  const filterKey = `${rxGradeId}|${reactionType}|${q}`
  const rowLimit = rowLimitState.key === filterKey ? rowLimitState.limit : PAGE_ROWS
  const showMoreRows = useCallback(
    () => setRowLimitState((prev) => ({ key: filterKey, limit: (prev.key === filterKey ? prev.limit : PAGE_ROWS) + PAGE_ROWS + 20 })),
    [filterKey],
  )

  const visibleUnits = useMemo(
    () => paginateUnits(filteredUnits, rowLimit, targetUnitIndex),
    [filteredUnits, rowLimit, targetUnitIndex],
  )
  const visibleRows = useMemo(() => countRows(visibleUnits), [visibleUnits])

  const reactionGradeCounts = useMemo(() => {
    const m: Partial<Record<SchoolGrade | 'all', number>> = {}
    for (const g of SCHOOL_GRADES) {
      const rg = readerGrades[gradeToReaderId(g)]
      if (rg) m[g] = gradeReactionStats(rg).total
    }
    return m
  }, [readerGrades])

  const reactionsTotal = useMemo(() => {
    let n = 0
    for (const g of SCHOOL_GRADES) n += reactionGradeCounts[g] ?? 0
    return n
  }, [reactionGradeCounts])

  const currentGradeStats = useMemo(() => (reader ? gradeReactionStats(reader) : null), [reader])

  /** Прокрутка к реакции из ссылки после загрузки класса. */
  useEffect(() => {
    if (!isReactions || !rxTarget || rxTarget.gradeId !== rxGradeId || !reader) return
    const target = rxTarget
    const raf = window.requestAnimationFrame(() => {
      const el = document.getElementById(
        target.rxId ? `tb-rx-${target.unitId}-${target.rxId}` : `tb-unit-${target.unitId}`,
      )
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        if (target.rxId) {
          ;(el as HTMLElement).focus({ preventScroll: true })
          setHighlightKey(`${target.unitId}:${target.rxId}`)
        }
      }
      setRxTarget(null)
    })
    return () => window.cancelAnimationFrame(raf)
  }, [isReactions, rxTarget, rxGradeId, reader, visibleUnits])

  useEffect(() => {
    if (!highlightKey) return
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current)
    highlightTimer.current = window.setTimeout(() => setHighlightKey(null), 4500)
    return () => {
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current)
    }
  }, [highlightKey])

  const onOpenSubstance = useCallback((id: string) => setSelectedId(id), [])
  const onOpenOrganic = useCallback((m: OrganicMoleculeDef) => setSelectedOrganic(m), [])

  const resetFilters = useCallback(() => {
    setQ('')
    setGrade(tab === 'reactions' ? 7 : 'all')
    setInorganicChapter('all')
    setCategory('all')
    setReactionType('all')
  }, [tab])

  const shownCount = isOrganic ? organicFiltered.length : isReactions ? filteredRows : filtered.length
  const totalCount = isOrganic
    ? ORGANIC_MOLECULES.length
    : isReactions
      ? (currentGradeStats?.total ?? 0)
      : list.length

  const empty = (
    <div className={styles.empty}>
      <IconEmpty className={styles.emptyIcon} />
      <p className={styles.emptyTitle}>{t('catalog.emptyTitle')}</p>
      <p className={styles.emptyText}>{isReactions ? t('catalog.rx.emptyFilter') : t('catalog.emptyFilter')}</p>
      <button type="button" className={styles.resetBtn} onClick={resetFilters}>
        {t('catalog.resetFilters')}
      </button>
    </div>
  )

  const stats = [
    {
      id: 'substances',
      value: String(list.length),
      label: t('catalog.statSubstances'),
      active: tab === 'inorganic',
      tone: ['#38bdf8', '#6366f1'],
      go: () => setTab('inorganic'),
    },
    {
      id: 'reactions',
      value: reactionsTotal > 0 ? String(reactionsTotal) : '…',
      label: t('catalog.statReactions'),
      active: isReactions,
      tone: ['#fb7185', '#f97316'],
      go: () => setTab('reactions'),
    },
    {
      id: 'organic',
      value: String(ORGANIC_MOLECULES.length),
      label: t('catalog.statOrganic'),
      active: isOrganic,
      tone: ['#34d399', '#14b8a6'],
      go: () => setTab('organic'),
    },
  ] as const

  const rxLoadFailed = readerErrors[rxGradeId] === true

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
                  ['reactions', 'catalog.viewReactions'],
                ] as const
              ).map(([id, key]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={tab === id ? `${styles.segBtn} ${styles.segBtnOn}` : styles.segBtn}
                  onClick={() => setTab(id)}
                >
                  {t(key)}
                </button>
              ))}
            </div>

            <label className={styles.search}>
              <IconSearch className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={isReactions ? t('catalog.rx.searchPlaceholder') : t('catalog.placeholder')}
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
            <GradeSegment
              value={isReactions ? rxGrade : grade}
              onChange={setGrade}
              counts={isOrganic ? organicGradeCounts : isReactions ? reactionGradeCounts : inorganicGradeCounts}
              allowAll={!isReactions}
              ariaLabel={
                isOrganic
                  ? t('catalog.organicGradeAria')
                  : isReactions
                    ? t('catalog.rx.gradeAria')
                    : t('catalog.inorganicGradeAria')
              }
            />

            <span className={styles.results} role="status">
              {t('catalog.results', { count: shownCount })}
              <span className={styles.resultsTotal}> / {totalCount}</span>
            </span>
          </div>

          {tab === 'inorganic' ? (
            <div className={styles.toolbarRow}>
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
                      className={
                        category === cat
                          ? `${styles.chip} ${styles.chipTone} ${styles.chipOn}`
                          : `${styles.chip} ${styles.chipTone}`
                      }
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
            </div>
          ) : null}

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
                      aria-pressed={reactionType === 'all'}
                      className={reactionType === 'all' ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                      onClick={() => setReactionType('all')}
                    >
                      {t('catalog.gradeAll')}
                    </button>
                    {REACTION_TYPE_ORDER.map((type) => {
                      const n = reactionTypeCounts.get(type) ?? 0
                      const tone = REACTION_TYPE_TONE[type] ?? REACTION_TYPE_TONE.other!
                      return (
                        <button
                          key={type}
                          type="button"
                          aria-pressed={reactionType === type}
                          disabled={n === 0 && reactionType !== type}
                          className={
                            reactionType === type
                              ? `${styles.chip} ${styles.chipTone} ${styles.chipOn}`
                              : `${styles.chip} ${styles.chipTone}`
                          }
                          style={toneStyle(tone, tone)}
                          onClick={() => setReactionType(reactionType === type ? 'all' : type)}
                        >
                          <span className={styles.chipDot} aria-hidden />
                          {t(reactionTypeKey(type))}
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
          organicByClass.length > 0 ? (
            organicByClass.map(([classId, items]) => (
              <section
                key={classId}
                className={styles.section}
                style={toneStyle(items[0]?.accentColor || '#34d399', '#14b8a6')}
              >
                <header className={styles.sectionHead}>
                  <span className={styles.sectionGlyph} aria-hidden>
                    C–H
                  </span>
                  <div className={styles.sectionText}>
                    <h2 className={styles.sectionTitle}>{organicClassLabel(classId, locale)}</h2>
                    <p className={styles.sectionLead}>{t('catalog.sectionOrderHint')}</p>
                  </div>
                  <span className={styles.sectionCount}>{items.length}</span>
                </header>
                <ul className={styles.grid}>
                  {items.map((m) => (
                    <li key={m.id} className={styles.item}>
                      <OrganicCard m={m} onOpen={onOpenOrganic} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          ) : (
            empty
          )
        ) : isReactions ? (
          <section className={styles.section} style={toneStyle('#fb7185', '#f97316')}>
            <header className={styles.sectionHead}>
              <span className={styles.sectionGlyph} aria-hidden>
                A+B
              </span>
              <div className={styles.sectionText}>
                <h2 className={styles.sectionTitle}>{t('catalog.rx.sectionTitle', { grade: rxGrade })}</h2>
                {currentGradeStats ? (
                  <p className={styles.sectionLead}>
                    {t('catalog.rx.labOkStat', { ok: currentGradeStats.labOk, total: currentGradeStats.total })}
                  </p>
                ) : null}
              </div>
              <span className={styles.sectionCount}>{filteredRows}</span>
            </header>

            {!reader && rxLoadFailed ? (
              <div className={styles.rxState} role="alert">
                <p>{t('catalog.rx.loadError')}</p>
                <button type="button" className={styles.resetBtn} onClick={() => ensureGrade(rxGradeId)}>
                  {t('catalog.rx.retry')}
                </button>
              </div>
            ) : !reader ? (
              <div className={styles.rxState} role="status" aria-live="polite">
                <span className={styles.spinner} aria-hidden />
                <p>{t('catalog.rx.loading')}</p>
              </div>
            ) : filteredUnits.length === 0 ? (
              empty
            ) : (
              <>
                <div className={styles.rxUnits}>
                  {visibleUnits.map((fu) => (
                    <UnitGroup key={fu.unit.unitId} fu={fu} gradeId={rxGradeId} highlightKey={highlightKey} />
                  ))}
                </div>
                {visibleRows < filteredRows ? (
                  <button type="button" className={styles.showMore} onClick={showMoreRows}>
                    {t('catalog.rx.showMore', { count: filteredRows - visibleRows })}
                  </button>
                ) : null}
              </>
            )}
          </section>
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
                    <p className={styles.sectionLead}>{t('catalog.sectionOrderHint')}</p>
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
