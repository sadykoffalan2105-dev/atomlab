import { useEffect, useMemo } from 'react'
import { primaryReactionForCompound } from '../../chemistry/schoolReactionBank'
import { compoundById } from '../../data/compounds'
import { getCompoundLocaleStrings, type CompoundLocaleStrings } from '../../i18n/compoundLocale'
import type { MessageKey } from '../../i18n/useT'
import { useT } from '../../i18n/useT'
import type { CompoundCategory, CompoundDef } from '../../types/chemistry'
import { CatalogMoleculeHero } from './CatalogMoleculeHero'
import styles from './CompoundDetailModal.module.css'

function formatComposition(comp: Record<string, number>): string {
  return Object.entries(comp)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sym, n]) => `${sym}×${n}`)
    .join(', ')
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

  const titleId = 'compound-detail-title'

  if (compoundId == null) return null

  if (detail === 'missing') {
    return (
      <div className={styles.backdrop} role="presentation" onClick={onClose}>
        <div
          className={styles.card}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
          <header className={styles.head}>
            <p id={titleId} className={styles.name}>
              {t('compound.notFound')}
            </p>
            <button type="button" className={styles.close} onClick={onClose} aria-label={t('element.close')}>
              ×
            </button>
          </header>
        </div>
      </div>
    )
  }

  if (!detail) return null

  const { compound: c, loc } = detail
  const kind = t(kindKey(c.category))

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.head}>
          <div>
            <h2 id={titleId} className={styles.formula}>
              {c.formulaUnicode}
            </h2>
            <p className={styles.name}>{loc.name}</p>
            <span className={styles.kind}>{kind}</span>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('element.close')}>
            ×
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.textCol}>
            <span className={styles.metaLabel}>{t('compound.composition')}</span>
            <p className={styles.compLine}>{formatComposition(c.composition)}</p>
            <span className={styles.metaLabel}>{t('compound.about')}</span>
            <p className={styles.description}>{loc.description}</p>
            <span className={styles.metaLabel}>{t('compound.obtainingSteps')}</span>
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
            {schoolRx ? (
              <>
                <span className={styles.metaLabel}>{t('compound.schoolReaction')}</span>
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
                  </button>
                ) : null}
              </>
            ) : null}
            <span className={styles.metaLabel}>{t('compound.synthConditions')}</span>
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
          </div>
          <div className={styles.previewWrap} aria-label={t('compound.preview3d')}>
            <CatalogMoleculeHero compoundId={compoundId} />
          </div>
        </div>
      </div>
    </div>
  )
}
