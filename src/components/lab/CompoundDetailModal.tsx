import { useEffect, useMemo, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { primaryReactionForCompound } from '../../chemistry/schoolReactionBank'
import { isBankReactionReactorReady, reactorHrefForBank } from '../../lab/reactorDeepLink'
import { compoundById } from '../../data/compounds'
import { getElementBySymbol } from '../../data/elements'
import { getCompoundLocaleStrings, type CompoundLocaleStrings } from '../../i18n/compoundLocale'
import type { MessageKey } from '../../i18n/useT'
import { useT } from '../../i18n/useT'
import type { CompoundCategory, CompoundDef } from '../../types/chemistry'
import { CatalogMoleculeHero } from './CatalogMoleculeHero'
import { useDialogFocus } from './useDialogFocus'
import styles from './CompoundDetailModal.module.css'

const METAL_LIKE = new Set([
  'Li',
  'Na',
  'K',
  'Rb',
  'Cs',
  'Ag',
  'Mg',
  'Ca',
  'Ba',
  'Sr',
  'Zn',
  'Cu',
  'Fe',
  'Al',
  'Pb',
  'Sn',
  'Mn',
  'Ni',
  'Co',
  'Cr',
])

/** Элементы состава в школьном порядке: металлы → неметаллы → кислород. */
function compositionEntries(comp: Record<string, number>): [string, number][] {
  return Object.entries(comp)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => {
      const am = METAL_LIKE.has(a)
      const bm = METAL_LIKE.has(b)
      if (am !== bm) return am ? -1 : 1
      if (a === 'O') return 1
      if (b === 'O') return -1
      return a.localeCompare(b)
    })
}

function formatComposition(comp: Record<string, number>): string {
  return compositionEntries(comp)
    .map(([sym, n]) => `${sym}×${n}`)
    .join(', ')
}

/** Относительная молекулярная масса Mr по составу (null, если элемент не найден). */
function relativeMolecularMass(entries: readonly (readonly [string, number])[]): number | null {
  let sum = 0
  for (const [sym, n] of entries) {
    const el = getElementBySymbol(sym)
    if (!el || !Number.isFinite(el.atomicMass)) return null
    sum += el.atomicMass * n
  }
  return sum > 0 ? sum : null
}

function formatMr(mr: number, locale: string): string {
  return mr.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU', { maximumFractionDigits: 2 })
}

function kindKey(category: CompoundCategory): MessageKey {
  const m: Record<CompoundCategory, MessageKey> = {
    oxide: 'category.kind.oxide',
    acid: 'category.kind.acid',
    base: 'category.kind.base',
    salt: 'category.kind.salt',
    other: 'category.kind.other',
  }
  return m[category] ?? 'category.kind.other'
}

/** Модалка поверх шапки приложения (z-index 80) и любых stacking-контекстов страницы. */
export function DetailModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return <>{children}</>
  return createPortal(children, document.body)
}

/** Плитки состава: Mr + элементы с числом атомов. */
export function CompositionTiles({
  entries,
  locale,
  ariaLabel,
}: {
  entries: readonly (readonly [string, number])[]
  locale: string
  ariaLabel: string
}) {
  const mr = relativeMolecularMass(entries)
  return (
    <ul className={styles.compTiles} aria-label={ariaLabel}>
      {mr != null ? (
        <li className={`${styles.compTile} ${styles.compTileAccent}`}>
          <span className={styles.compTileValue}>{formatMr(mr, locale)}</span>
          <span className={styles.compTileLabel}>
            M<sub>r</sub>
          </span>
        </li>
      ) : null}
      {entries.map(([sym, n]) => {
        const el = getElementBySymbol(sym)
        return (
          <li key={sym} className={styles.compTile} title={el ? `${el.z} · ${sym}` : sym}>
            <span className={styles.compTileValue}>
              {el ? <span className={styles.cpkDot} style={{ background: `#${el.cpkHex}` }} aria-hidden /> : null}
              {sym}
              <span className={styles.compTileCount}>×{n}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function CloseIconButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className={styles.close} onClick={onClick} aria-label={label}>
      <span className={styles.closeIcon} aria-hidden />
    </button>
  )
}

/** Фокус в диалог при открытии и возврат фокуса при закрытии. */
export function CompoundDetailModal({
  compoundId,
  onClose,
  onOpenSchoolReaction,
}: {
  compoundId: string | null
  onClose: () => void
  /** Перейти к карточке реакции в каталоге «Реакции». */
  onOpenSchoolReaction?: (reactionId: string) => void
}) {
  const { locale, t } = useT()

  const detail = useMemo((): { compound: CompoundDef; loc: CompoundLocaleStrings } | 'missing' | null => {
    if (!compoundId) return null
    const compound = compoundById[compoundId]
    if (!compound) return 'missing'
    return { compound, loc: getCompoundLocaleStrings(compound, locale, t) }
  }, [compoundId, locale, t])

  const schoolRx = useMemo(
    () => (compoundId ? primaryReactionForCompound(compoundId) : undefined),
    [compoundId],
  )

  useEffect(() => {
    if (compoundId == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [compoundId, onClose])

  const cardRef = useDialogFocus(compoundId != null)

  const titleId = 'compound-detail-title'

  if (compoundId == null) return null

  if (detail === 'missing') {
    return (
      <DetailModalPortal>
        <div className={styles.backdrop} role="presentation" onClick={onClose}>
          <div
            ref={cardRef}
            tabIndex={-1}
            className={`${styles.card} ${styles.cardFallback}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <header className={styles.headFallback}>
              <p id={titleId} className={styles.nameFallback}>
                {t('compound.notFound')}
              </p>
              <CloseIconButton onClick={onClose} label={t('element.close')} />
            </header>
          </div>
        </div>
      </DetailModalPortal>
    )
  }

  if (!detail) return null

  const { compound: c, loc } = detail
  const kind = t(kindKey(c.category))
  const entries = compositionEntries(c.composition)

  return (
    <DetailModalPortal>
      <div className={styles.backdrop} role="presentation" onClick={onClose}>
        <div
          ref={cardRef}
          tabIndex={-1}
          className={styles.card}
          data-category={c.category}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
          <header className={styles.head}>
            <div className={styles.formulaPlate}>
              <h2 id={titleId} className={styles.formula}>
                {c.formulaUnicode}
              </h2>
            </div>
            <div className={styles.headTitle}>
              <p className={styles.name}>{loc.name}</p>
            </div>
            <div className={styles.headChips}>
              <span className={styles.kind}>
                <span className={styles.kindDot} aria-hidden />
                {kind}
              </span>
            </div>
            <div className={styles.headActions}>
              <CloseIconButton onClick={onClose} label={t('element.close')} />
            </div>
          </header>

          <div className={styles.body}>
            <div className={styles.textCol}>
              <section className={styles.section}>
                <h3 className={styles.metaLabel}>{t('compound.about')}</h3>
                <p className={styles.description}>{loc.description}</p>
              </section>

              <section className={styles.section}>
                <h3 className={styles.metaLabel}>{t('compound.facts')}</h3>
                <dl className={styles.factsBlock}>
                  <div className={styles.factsRow}>
                    <dt className={styles.factsDt}>{t('compound.factsSource')}</dt>
                    <dd className={styles.factsDd}>{loc.facts.source}</dd>
                  </div>
                  <div className={styles.factsRow}>
                    <dt className={styles.factsDt}>{t('compound.factsUsage')}</dt>
                    <dd className={styles.factsDd}>{loc.facts.usage}</dd>
                  </div>
                  <div className={styles.factsRow}>
                    <dt className={styles.factsDt}>{t('compound.factsImportance')}</dt>
                    <dd className={styles.factsDd}>{loc.facts.importance}</dd>
                  </div>
                </dl>
              </section>

              <section className={styles.section}>
                <h3 className={styles.metaLabel}>{t('compound.obtainingSteps')}</h3>
                {loc.obtainingSteps.length > 1 ? (
                  <ol className={styles.obtainingSteps}>
                    {loc.obtainingSteps.map((s) => (
                      <li key={s.step} className={styles.obtainingStep}>
                        <span className={styles.obtainingEq}>{s.equation}</span>
                        {s.note ? <span className={styles.obtainingNote}>{s.note}</span> : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={styles.labExample} aria-label={t('compound.labExampleAria')}>
                    {loc.laboratoryRecipe}
                  </p>
                )}
              </section>

              {schoolRx ? (
                <section className={styles.section}>
                  <h3 className={styles.metaLabel}>{t('compound.schoolReaction')}</h3>
                  <div className={styles.schoolRx}>
                    <p className={styles.schoolRxEq}>
                      {locale === 'en' ? schoolRx.equationEn : schoolRx.equationRu}
                    </p>
                    {onOpenSchoolReaction ? (
                      <button
                        type="button"
                        className={styles.schoolRxBtn}
                        aria-label={t('compound.schoolReactionAria')}
                        onClick={() => onOpenSchoolReaction(schoolRx.id)}
                      >
                        {t('compound.openInReactions')}
                        <span className={styles.btnArrow} aria-hidden>
                          →
                        </span>
                      </button>
                    ) : null}
                    {isBankReactionReactorReady(schoolRx.id) ? (
                      <Link
                        className={styles.schoolRxBtn}
                        to={reactorHrefForBank(schoolRx.id, { main: c.id })}
                        data-rx-lab-link={schoolRx.id}
                      >
                        {t('catalog.rx.openLab')}
                        <span className={styles.btnArrow} aria-hidden>
                          →
                        </span>
                      </Link>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <section className={styles.section}>
                <h3 className={styles.metaLabel}>{t('compound.synthConditions')}</h3>
                <dl className={styles.synthConditions}>
                  <div className={styles.synthRow}>
                    <dt className={styles.synthDt}>{t('compound.temp')}</dt>
                    <dd className={styles.synthDd}>{loc.synthesisConditions.temperature ?? '—'}</dd>
                  </div>
                  <div className={styles.synthRow}>
                    <dt className={styles.synthDt}>{t('compound.pressure')}</dt>
                    <dd className={styles.synthDd}>{loc.synthesisConditions.pressure ?? '—'}</dd>
                  </div>
                  <div className={styles.synthRow}>
                    <dt className={styles.synthDt}>{t('compound.catalyst')}</dt>
                    <dd className={styles.synthDd}>{loc.synthesisConditions.catalyst ?? '—'}</dd>
                  </div>
                  <div className={styles.synthRow}>
                    <dt className={styles.synthDt}>{t('compound.equipment')}</dt>
                    <dd className={styles.synthDd}>{loc.synthesisConditions.equipment ?? '—'}</dd>
                  </div>
                </dl>
              </section>
            </div>
            <div className={styles.previewCol}>
              <div className={styles.previewWrap} aria-label={t('compound.preview3d')}>
                <CatalogMoleculeHero compoundId={compoundId} />
                <span className={styles.previewBadge} aria-hidden>
                  3D
                </span>
              </div>
              <section className={styles.section}>
                <h3 className={styles.metaLabel}>{t('compound.composition')}</h3>
                <CompositionTiles
                  entries={entries}
                  locale={locale}
                  ariaLabel={formatComposition(c.composition)}
                />
              </section>
            </div>
          </div>
        </div>
      </div>
    </DetailModalPortal>
  )
}
