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
  ORGANIC_REACTION_TYPES,
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
import { buildSchoolHeroModel } from '../components/lab/hero/schoolHeroModel'
import { FAMILIES, familyName, familyOf, type FamilyId } from '../data/catalog/catalogFamilies'
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
import {
  MAIN_REACTIONS_200,
  MAIN_REACTION_TYPE_ORDER,
  mainReactionSkeleton,
  reactorHrefForMainReaction,
  type MainReaction,
  type MainReactionType,
} from '../data/catalog/mainReactions'
import { useMainReactionSearch } from '../components/catalog/mainReactionSearch'
import { FilterSheet } from '../components/catalog/FilterSheet'
import { ScrollChips } from '../components/catalog/ScrollChips'
import { useCollapsingToolbar, useMediaQuery } from '../components/catalog/useCollapsingToolbar'
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
  addition: '#22d3ee',
  elimination: '#fb923c',
  isomerization: '#e879f9',
  condensation: '#a3e635',
  polycondensation: '#818cf8',
  radical: '#facc15',
  other: '#94a3b8',
}

const KNOWN_TYPES = new Set(REACTION_TYPE_ORDER)
const KNOWN_REASONS = new Set([
  'ionic',
  'scheme',
  'generalFormula',
  'unknownSubstance',
  'organic',
  'nuclear',
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

function IconSliders({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M3 5.5h8M15 5.5h2M3 14.5h2M9 14.5h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="13" cy="5.5" r="2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="7" cy="14.5" r="2" stroke="currentColor" strokeWidth="1.7" />
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

/** Координаты школьной модели в масштабе превью каталога: медиана длины связи = 1,2. */
function thumbScale(m: { atoms: readonly { pos: readonly [number, number, number] }[]; bonds: readonly { a: number; b: number }[] }): [number, number, number][] {
  const lens = m.bonds
    .map((b) => {
      const p = m.atoms[b.a]!.pos
      const q = m.atoms[b.b]!.pos
      return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
    })
    .filter((x) => x > 1e-9)
    .sort((x, y) => x - y)
  const k = lens.length ? 1.2 / lens[Math.floor(lens.length / 2)]! : 1
  return m.atoms.map((a) => [a.pos[0] * k, a.pos[1] * k, a.pos[2] * k])
}

const compoundThumbCache = new Map<string, { atoms: ThumbAtom[]; bonds: ThumbBond[] }>()

function compoundThumb(c: CompoundDef) {
  let v = compoundThumbCache.get(c.id)
  if (!v) {
    // Превью — та же молекула, что в 3D карточки (hero/schoolHeroModel): геометрия и кратность связей
    // школьной сцены / ядра. Решётку (125 ионов) в превью не рисуем — остаётся пара ионов каталога.
    const m = buildSchoolHeroModel(c)
    v =
      m && m.kind === 'molecule'
        ? {
            // Школьная модель — в мировых единицах сцены (C=O ≈ 0,33); радиусы шаров превью рассчитаны на ångström
            // каталога (C=O ≈ 1,16) — приводим медиану длины связи к 1,2, иначе шары сливаются в кляксу.
            atoms: thumbScale(m).map((pos, i) => ({ el: m.atoms[i]!.el, pos })),
            bonds: m.bonds.map((b) => ({ a: b.a, b: b.b, order: Math.max(1, Math.min(3, b.order)) as 1 | 2 | 3 })),
          }
        : {
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

      {r.note ? (
        <p className={styles.rxMeta}>
          <span className={styles.rxMetaLabel}>{t('learn.book.rx.note')}:</span> {r.note}
        </p>
      ) : null}

      {showLab && r.lab.example ? (
        <p className={styles.rxMeta} data-rx-lab-example={`${unitId}-${r.id}`}>
          <span className={styles.rxMetaLabel}>
            {t(r.lab.ok ? 'learn.book.rx.labExample' : 'learn.book.rx.labExampleWaiting')}:
          </span>{' '}
          {r.lab.example}
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
              {r.lab.altHref ? t('learn.book.rx.openReactor') : t('catalog.rx.openLab')}
              <span aria-hidden>→</span>
            </Link>
            {r.lab.altHref ? (
              // органика: реактор «шарами» + органическая лаборатория второй кнопкой
              <Link
                className={`${styles.rxLabLink} ${styles.rxLabLinkGhost}`}
                to={r.lab.altHref}
                data-rx-organic-link={`${unitId}-${r.id}`}
              >
                {t('learn.book.rx.openOrganicLab')}
              </Link>
            ) : null}
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

/** «нагрев · давление · кат. Fe» — условия реакции в реакторе. */
function mainReactionConditions(t: ReturnType<typeof useT>['t'], r: MainReaction): string | null {
  const parts: string[] = []
  if (r.lab.heat) parts.push(t('catalog.rx.condHeat'))
  if (r.lab.pressure) parts.push(t('catalog.rx.condPressure'))
  if (r.lab.catalyst) parts.push(t('catalog.rx.condCatalyst', { name: r.lab.catalyst }))
  return parts.length ? parts.join(' · ') : null
}

/**
 * Одна из 200 основных реакций: уравнение без коэффициентов (их расставляет ученик), «Уравнять в реакторе»,
 * ответ — по кнопке.
 */
const MainReactionRow = memo(function MainReactionRow({ r }: { r: MainReaction }) {
  const { locale, t } = useT()
  const [revealed, setRevealed] = useState(false)
  const tone = REACTION_TYPE_TONE[r.type] ?? REACTION_TYPE_TONE.other!
  const cond = mainReactionConditions(t, r)
  const grades = formatGradeRange(r.grades.filter((g): g is SchoolGrade => (SCHOOL_GRADES as readonly number[]).includes(g)))
  const title = r.titleRu && locale === 'ru' ? r.titleRu : null
  return (
    <li className={styles.mrRow} style={toneStyle(tone, tone)} data-main-rx={r.id}>
      <div className={styles.mrTop}>
        <span className={revealed ? `${styles.mrEq} ${styles.mrEqAnswer}` : styles.mrEq}>
          {revealed ? r.equation : mainReactionSkeleton(r.equation)}
        </span>
        {grades ? <span className={styles.mrGrades}>{t('catalog.rx.gradesShort', { grades })}</span> : null}
      </div>
      {title || cond || r.qualitative || (r.redox && r.type !== 'redox') ? (
        <div className={styles.mrMeta}>
          {title ? <span>{title}</span> : null}
          {r.qualitative ? <span className={styles.mrBadge}>{t('catalog.rx.qualitative', { ion: r.qualitative })}</span> : null}
          {r.redox && r.type !== 'redox' ? <span className={styles.mrBadge}>{t('catalog.rx.redox')}</span> : null}
          {cond ? <span>{`${t('learn.book.rx.conditions')}: ${cond}`}</span> : null}
        </div>
      ) : null}
      <div className={styles.mrBtns}>
        <Link
          className={styles.rxLabLink}
          to={reactorHrefForMainReaction(r.id, { src: '/catalog?view=reactions' })}
          data-main-rx-link={r.id}
        >
          {t('catalog.rx.balanceInReactor')}
          <span aria-hidden>→</span>
        </Link>
        <button type="button" className={styles.mrAnswerBtn} onClick={() => setRevealed((v) => !v)} aria-expanded={revealed}>
          {revealed ? t('catalog.rx.hideAnswer') : t('learn.book.rx.showAnswer')}
        </button>
      </div>
    </li>
  )
})

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
  /**
   * Вкладка «Реакции»: 200 основных (по умолчанию) или реакции учебника по параграфам — для ссылок из книги
   * (?view=reactions&grade=g8&unit=p24&rx=r3 и старые ?rx=<id банка>).
   */
  // Школьная программа — по умолчанию: реакции учебников 7–11 (как было); «200 основных» — отдельный режим (решение владельца 01.10).
  const [rxMode, setRxMode] = useState<'main' | 'book'>('book')
  const [grade, setGrade] = useState<SchoolGrade | 'all'>(
    initial.grade ?? (initial.tab === 'reactions' && (initial.target || initial.legacyBankId) ? 7 : 'all'),
  )
  /** Тип основной реакции или «качественные». */
  const [mainType, setMainType] = useState<MainReactionType | 'qualitative' | 'all'>('all')
  const [inorganicChapter, setInorganicChapter] = useState<InorganicChapter | 'all'>('all')
  const [category, setCategory] = useState<CompoundCategory | 'all'>('all')
  /** семейство «по корню» (хлориды, сульфаты …) — docs/plans/catalog-top200.md, §1 */
  const [family, setFamily] = useState<FamilyId | 'all'>('all')
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
    if (p.target || p.legacyBankId) setRxMode('book')
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
  const isMainRx = isReactions && rxMode === 'main'
  const isBookRx = isReactions && rxMode === 'book'
  const isOrganic = tab === 'organic'
  const rxGrade: SchoolGrade = grade === 'all' ? 7 : grade
  const rxGradeId = gradeToReaderId(rxGrade)
  const reader = readerGrades[rxGradeId]

  useEffect(() => {
    if (isBookRx && !readerGrades[rxGradeId]) ensureGrade(rxGradeId)
  }, [isBookRx, rxGradeId, readerGrades, ensureGrade])

  /** Остальные классы учебника — в фоне, для счётчиков классов (только в режиме «По учебнику»). */
  useEffect(() => {
    if (!isBookRx) return
    const timer = window.setTimeout(() => {
      for (const id of READER_GRADE_IDS) ensureGrade(id)
    }, 2000)
    return () => window.clearTimeout(timer)
  }, [ensureGrade, isBookRx])

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
    setRxMode('book')
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

  const inCategory = useMemo(
    () => (category === 'all' ? searched : searched.filter((c) => c.category === category)),
    [searched, category],
  )

  /** Счётчики семейств — по уже выбранному классу (чипы «Хлориды · Сульфаты · …»). */
  const familyCounts = useMemo(() => {
    const m = new Map<FamilyId, number>()
    for (const c of inCategory) {
      const f = familyOf(c.id)?.family.id
      if (f) m.set(f, (m.get(f) ?? 0) + 1)
    }
    return m
  }, [inCategory])

  const filtered = useMemo(
    () => (family === 'all' ? inCategory : inCategory.filter((c) => familyOf(c.id)?.family.id === family)),
    [inCategory, family],
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

  // —— 200 основных реакций: класс, поиск, тип ——
  const mainSearched = useMainReactionSearch(isMainRx ? q : '', locale, t)
  const mainGradeCounts = useMemo(() => {
    const m: Partial<Record<SchoolGrade | 'all', number>> = { all: mainSearched.length }
    for (const g of SCHOOL_GRADES) m[g] = mainSearched.filter((r) => r.grades.includes(g)).length
    return m
  }, [mainSearched])
  const mainInGrade = useMemo(
    () => (grade === 'all' ? mainSearched : mainSearched.filter((r) => r.grades.includes(grade))),
    [mainSearched, grade],
  )
  const mainTypeCounts = useMemo(() => {
    const m = new Map<MainReactionType | 'qualitative', number>()
    for (const r of mainInGrade) {
      m.set(r.type, (m.get(r.type) ?? 0) + 1)
      if (r.qualitative) m.set('qualitative', (m.get('qualitative') ?? 0) + 1)
    }
    return m
  }, [mainInGrade])
  const mainFiltered = useMemo(
    () =>
      mainType === 'all'
        ? mainInGrade
        : mainType === 'qualitative'
          ? mainInGrade.filter((r) => r.qualitative)
          : mainInGrade.filter((r) => r.type === mainType),
    [mainInGrade, mainType],
  )
  const mainByType = useMemo(
    () =>
      MAIN_REACTION_TYPE_ORDER.map((type) => [type, mainFiltered.filter((r) => r.type === type)] as const).filter(
        ([, items]) => items.length > 0,
      ),
    [mainFiltered],
  )

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
    setGrade(tab === 'reactions' && rxMode === 'book' ? 7 : 'all')
    setInorganicChapter('all')
    setCategory('all')
    setFamily('all')
    setReactionType('all')
    setMainType('all')
  }, [tab, rxMode])

  const shownCount = isOrganic
    ? organicFiltered.length
    : isMainRx
      ? mainFiltered.length
      : isReactions
        ? filteredRows
        : filtered.length
  const totalCount = isOrganic
    ? ORGANIC_MOLECULES.length
    : isMainRx
      ? MAIN_REACTIONS_200.length
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

  /* ── «Шторка» фильтров: сворачивается при прокрутке вниз, на телефоне фильтры — в нижней панели ── */
  const isPhone = useMediaQuery('(max-width: 720px)')
  const pageRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const fullRef = useRef<HTMLDivElement>(null)
  const filtersBtnRef = useRef<HTMLButtonElement>(null)
  const collapseBtnRef = useRef<HTMLButtonElement>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { collapsed, stuck, expand, collapse } = useCollapsingToolbar(pageRef, anchorRef, toolbarRef, fullRef)
  const sheetVisible = sheetOpen && isPhone
  const closeSheet = useCallback(() => setSheetOpen(false), [])
  const onFiltersBtn = useCallback(() => {
    if (isPhone) {
      setSheetOpen(true)
      return
    }
    expand()
    // фокус — в развёрнутую панель (кнопка «Свернуть»), а не на спрятанную кнопку
    requestAnimationFrame(() => collapseBtnRef.current?.focus({ preventScroll: true }))
  }, [isPhone, expand])
  const collapseNow = useCallback(() => {
    collapse()
    requestAnimationFrame(() => filtersBtnRef.current?.focus({ preventScroll: true }))
  }, [collapse])

  const activeFilters = useMemo(() => {
    const out: { key: string; label: string; clear: () => void }[] = []
    const gradeShort = t('catalog.gradeShort')
    if (q.trim() && isPhone) out.push({ key: 'q', label: `«${q.trim()}»`, clear: () => setQ('') })
    if (isBookRx) {
      // учебник всегда по одному классу: «фильтром» считаем всё, кроме класса по умолчанию (7)
      if (rxGrade !== 7) out.push({ key: 'grade', label: `${rxGrade} ${gradeShort}`, clear: () => setGrade(7) })
    } else if (grade !== 'all') {
      out.push({ key: 'grade', label: `${grade} ${gradeShort}`, clear: () => setGrade('all') })
    }
    if (tab === 'inorganic') {
      if (category !== 'all') out.push({ key: 'cat', label: t(sectionTitleKey(category)), clear: () => setCategory('all') })
      if (family !== 'all') {
        const f = FAMILIES.find((x) => x.id === family)
        out.push({ key: 'fam', label: f ? familyName(f, locale) : String(family), clear: () => setFamily('all') })
      }
      if (inorganicChapter !== 'all')
        out.push({ key: 'ch', label: capitalize(inorganicChapter), clear: () => setInorganicChapter('all') })
    } else if (isMainRx) {
      if (mainType !== 'all')
        out.push({
          key: 'mt',
          label: mainType === 'qualitative' ? t('catalog.rx.qualitativeChip') : t(reactionTypeKey(mainType)),
          clear: () => setMainType('all'),
        })
    } else if (isReactions) {
      if (reactionType !== 'all')
        out.push({ key: 'rt', label: t(reactionTypeKey(reactionType)), clear: () => setReactionType('all') })
    }
    return out
  }, [t, q, isPhone, isBookRx, rxGrade, grade, tab, category, family, locale, inorganicChapter, isMainRx, mainType, isReactions, reactionType])

  const resultsEl = (
    <span className={styles.results} role="status">
      {t('catalog.results', { count: shownCount })}
      <span className={styles.resultsTotal}> / {totalCount}</span>
    </span>
  )

  // ряды фильтров: на ПК — в развёрнутой «шторке», на телефоне — в нижней выезжающей панели
  const filterRows = (
    <>
    {isReactions ? (
      <div className={styles.toolbarRow}>
        <div className={styles.segment} role="tablist" aria-label={t('catalog.rx.modeAria')}>
          {(
            [
              ['book', 'catalog.rx.modeBook'],
              ['main', 'catalog.rx.modeMain'],
            ] as const
          ).map(([id, key]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={rxMode === id}
              className={rxMode === id ? `${styles.segBtn} ${styles.segBtnOn}` : styles.segBtn}
              onClick={() => {
                setRxMode(id)
                // учебник — по одному классу, основные реакции — все классы сразу
                setGrade(id === 'book' ? (grade === 'all' ? 7 : grade) : 'all')
              }}
              data-rx-mode={id}
            >
              {t(key)}
            </button>
          ))}
        </div>
      </div>
    ) : null}

    <div className={styles.toolbarRow}>
      <GradeSegment
        value={isBookRx ? rxGrade : grade}
        onChange={setGrade}
        counts={
          isOrganic
            ? organicGradeCounts
            : isMainRx
              ? mainGradeCounts
              : isReactions
                ? reactionGradeCounts
                : inorganicGradeCounts
        }
        allowAll={!isBookRx}
        ariaLabel={
          isOrganic
            ? t('catalog.organicGradeAria')
            : isReactions
              ? t('catalog.rx.gradeAria')
              : t('catalog.inorganicGradeAria')
        }
      />

      {isPhone ? null : (
        <>
          {resultsEl}
          {stuck ? (
            <button
              ref={collapseBtnRef}
              type="button"
              className={styles.collapseBtn}
              onClick={collapseNow}
              aria-expanded
              aria-controls="catalog-filters"
            >
              {t('catalog.filtersCollapse')}
              <span className={styles.caret} aria-hidden>
                ▴
              </span>
            </button>
          ) : null}
        </>
      )}
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

    {tab === 'inorganic' ? (
      <div className={styles.scrollRow}>
        <span className={styles.filterLabel}>{t('catalog.familyLabel')}</span>
        <ScrollChips ariaLabel={t('catalog.familyAria')}>
          <button
            type="button"
            aria-pressed={family === 'all'}
            className={family === 'all' ? `${styles.chip} ${styles.chipOn}` : styles.chip}
            onClick={() => setFamily('all')}
          >
            {t('catalog.gradeAll')}
          </button>
          {FAMILIES.map((f) => {
            const n = familyCounts.get(f.id) ?? 0
            if (n === 0 && family !== f.id) return null
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={family === f.id}
                className={family === f.id ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                title={f.root ? f.root.formula : undefined}
                onClick={() => setFamily(family === f.id ? 'all' : f.id)}
              >
                {familyName(f, locale)}
                {f.root ? <span className={styles.chipRoot}>{f.root.formula}</span> : null}
                <span className={styles.chipCount}>{n}</span>
              </button>
            )
          })}
        </ScrollChips>
      </div>
    ) : null}

    {!isOrganic ? (
      <div className={styles.scrollRow}>
        <span className={styles.filterLabel}>
          {isReactions ? t('catalog.reactionClassAria') : t('catalog.chapterLabel')}
        </span>
        <ScrollChips ariaLabel={isReactions ? t('catalog.reactionClassAria') : t('catalog.chapterAria')}>
          {isMainRx ? (
            <>
              <button
                type="button"
                aria-pressed={mainType === 'all'}
                className={mainType === 'all' ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                onClick={() => setMainType('all')}
              >
                {t('catalog.gradeAll')}
                <span className={styles.chipCount}>{mainInGrade.length}</span>
              </button>
              {([...MAIN_REACTION_TYPE_ORDER, 'qualitative'] as const).map((type) => {
                const n = mainTypeCounts.get(type) ?? 0
                const tone = REACTION_TYPE_TONE[type] ?? '#e879f9'
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={mainType === type}
                    disabled={n === 0 && mainType !== type}
                    className={
                      mainType === type
                        ? `${styles.chip} ${styles.chipTone} ${styles.chipOn}`
                        : `${styles.chip} ${styles.chipTone}`
                    }
                    style={toneStyle(tone, tone)}
                    onClick={() => setMainType(mainType === type ? 'all' : type)}
                    data-main-type={type}
                  >
                    <span className={styles.chipDot} aria-hidden />
                    {type === 'qualitative' ? t('catalog.rx.qualitativeChip') : t(reactionTypeKey(type))}
                    <span className={styles.chipCount}>{n}</span>
                  </button>
                )
              })}
            </>
          ) : isReactions ? (
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
                // органические типы § 1.6 — только там, где такие реакции есть (иначе 6 пустых чипов в 7–9 классах)
                if (n === 0 && reactionType !== type && ORGANIC_REACTION_TYPES.has(type)) return null
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
        </ScrollChips>
      </div>
    ) : null}
    </>
  )

  const renderFiltersBtn = (withRef: boolean) => (
    <button
      ref={withRef ? filtersBtnRef : undefined}
      type="button"
      className={activeFilters.length > 0 ? `${styles.filtersBtn} ${styles.filtersBtnOn}` : styles.filtersBtn}
      onClick={onFiltersBtn}
      aria-expanded={isPhone ? sheetOpen : !collapsed}
      aria-controls={isPhone ? 'catalog-filter-sheet' : 'catalog-filters'}
      aria-haspopup={isPhone ? 'dialog' : undefined}
      data-filters-btn=""
    >
      <IconSliders className={styles.filtersIcon} />
      {t('catalog.filtersBtn')}
      {activeFilters.length > 0 ? <span className={styles.filtersCount}>{activeFilters.length}</span> : null}
      <span className={styles.caret} aria-hidden>
        ▾
      </span>
    </button>
  )

  const activeChips =
    activeFilters.length > 0 ? (
      <ul className={styles.activeChips} aria-label={t('catalog.activeFiltersAria')}>
        {activeFilters.map((f) => (
          <li key={f.key}>
            <button
              type="button"
              className={styles.activeChip}
              onClick={f.clear}
              aria-label={t('catalog.filterRemove', { name: f.label })}
              title={t('catalog.filterRemove', { name: f.label })}
            >
              <span className={styles.activeChipText}>{f.label}</span>
              <span className={styles.activeChipX} aria-hidden>
                ×
              </span>
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <span className={styles.activeNone}>{t('catalog.filtersNone')}</span>
    )

  const renderTabs = (compact: boolean) => (
    <div
      className={compact ? `${styles.segment} ${styles.segmentCompact}` : styles.segment}
      role="tablist"
      aria-label={t('catalog.domainAria')}
    >
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
  )

  const renderSearch = (compact: boolean) => (
    <label className={compact ? `${styles.search} ${styles.searchCompact}` : styles.search}>
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
        <button type="button" className={styles.searchClear} onClick={() => setQ('')} aria-label={t('catalog.searchClear')}>
          ×
        </button>
      ) : null}
    </label>
  )

  return (
    <div ref={pageRef} className={styles.page}>
      <div className={styles.backdrop} aria-hidden />
      <MoleculeThumbDefs />
      <div className={styles.inner}>
        <header ref={anchorRef} className={styles.hero}>
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

        <div
          ref={toolbarRef}
          className={[styles.toolbar, collapsed ? styles.toolbarCollapsed : '', stuck ? styles.toolbarStuck : ''].filter(Boolean).join(' ')}
          data-collapsed={collapsed ? '' : undefined}
          data-catalog-toolbar=""
        >
          <div ref={fullRef} id="catalog-filters" className={styles.toolbarFull} inert={collapsed}>
            <div className={styles.toolbarRow}>
              {renderTabs(false)}
              {renderSearch(false)}
            </div>
            {isPhone ? (
              <div className={`${styles.toolbarRow} ${styles.phoneFilterRow}`}>
                {renderFiltersBtn(!collapsed)}
                {activeChips}
                {resultsEl}
              </div>
            ) : (
              filterRows
            )}
          </div>

          <div className={styles.compact} inert={!collapsed} data-catalog-compact="">
            <div className={styles.compactTabs}>{renderTabs(true)}</div>
            <div className={styles.compactSearch}>{renderSearch(true)}</div>
            {collapsed ? renderFiltersBtn(true) : null}
            <div className={styles.compactChips}>{activeChips}</div>
            <span className={styles.compactCount} aria-hidden>
              {t('catalog.results', { count: shownCount })}
            </span>
          </div>
        </div>

        <FilterSheet
          id="catalog-filter-sheet"
          open={sheetVisible}
          onClose={closeSheet}
          title={t('catalog.filtersBtn')}
          closeLabel={t('catalog.filtersClose')}
          returnFocusRef={filtersBtnRef}
          footer={
            <>
              <button type="button" className={styles.sheetReset} onClick={resetFilters}>
                {t('catalog.resetFilters')}
              </button>
              <button type="button" className={styles.sheetApply} onClick={closeSheet}>
                {t('catalog.filtersShow', { count: shownCount })}
              </button>
            </>
          }
        >
          <div className={styles.sheetRows}>{filterRows}</div>
        </FilterSheet>

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
        ) : isMainRx ? (
          <section className={styles.section} style={toneStyle('#fb7185', '#f97316')} data-main-reactions="">
            <header className={styles.sectionHead}>
              <span className={styles.sectionGlyph} aria-hidden>
                A+B
              </span>
              <div className={styles.sectionText}>
                <h2 className={styles.sectionTitle}>{t('catalog.rx.mainTitle')}</h2>
                <p className={styles.sectionLead}>{t('catalog.rx.mainLead')}</p>
              </div>
              <span className={styles.sectionCount}>{mainFiltered.length}</span>
            </header>
            {mainByType.length === 0 ? (
              empty
            ) : (
              <div className={styles.rxUnits}>
                {mainByType.map(([type, items]) => (
                  <section
                    key={type}
                    className={styles.rxUnit}
                    id={`main-rx-${type}`}
                    style={toneStyle(REACTION_TYPE_TONE[type] ?? '#94a3b8', REACTION_TYPE_TONE[type] ?? '#94a3b8')}
                  >
                    <header className={styles.rxUnitHead}>
                      <h3 className={`${styles.rxUnitTitle} ${styles.mrGroupTitle}`}>
                        <span className={styles.chipDot} aria-hidden />
                        {t(reactionTypeKey(type))}
                      </h3>
                      <span className={styles.rxUnitMeta}>
                        <span className={styles.sectionCount}>{items.length}</span>
                      </span>
                    </header>
                    <ul className={styles.mrList}>
                      {items.map((r) => (
                        <MainReactionRow key={r.id} r={r} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </section>
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
