import { useEffect, useMemo, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { compositionOf } from '../../chemistry/organic/organicGraph'
import {
  pickOrganicClassLabel,
} from '../../data/organicLab/organicMoleculeRegistry'
import type { OrganicMoleculeDef } from '../../data/organicLab/organicMoleculeTypes'
import { useLocale } from '../../i18n/useLocale'
import { useT } from '../../i18n/useT'
import { CloseIconButton, CompositionTiles, DetailModalPortal } from '../lab/CompoundDetailModal'
import { useDialogFocus } from '../lab/useDialogFocus'
import { OrganicMoleculeHero } from './OrganicMoleculeHero'
import styles from '../lab/CompoundDetailModal.module.css'
import own from './OrganicMoleculeDetailModal.module.css'

function compositionEntries(comp: Record<string, number>): [string, number][] {
  return Object.entries(comp)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
}

function formatComposition(comp: Record<string, number>): string {
  return compositionEntries(comp)
    .map(([sym, n]) => `${sym}×${n}`)
    .join(', ')
}

function pickName(m: OrganicMoleculeDef, locale: string) {
  if (locale === 'en') return m.nameEn
  if (locale === 'uz') return m.nameUz
  return m.nameRu
}

function pickDesc(m: OrganicMoleculeDef, locale: string) {
  if (locale === 'en') return m.descriptionEn
  if (locale === 'uz') return m.descriptionUz
  return m.descriptionRu
}

function pickEq(m: OrganicMoleculeDef, locale: string) {
  if (locale === 'en') return m.equationEn
  if (locale === 'uz') return m.equationUz
  return m.equationRu
}

export function OrganicMoleculeDetailModal({
  mol,
  onClose,
}: {
  mol: OrganicMoleculeDef | null
  onClose: () => void
}) {
  const { t } = useT()
  const { locale } = useLocale()
  const cardRef = useDialogFocus(mol != null)

  useEffect(() => {
    if (!mol) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mol, onClose])

  const composition = useMemo(() => (mol ? compositionOf(mol.graph) : {}), [mol])

  if (!mol) return null

  const titleId = 'organic-detail-title'
  const accentStyle = { '--cat-a': mol.accentColor } as CSSProperties

  return (
    <DetailModalPortal>
      <div className={styles.backdrop} role="presentation" onClick={onClose}>
        <div
          ref={cardRef}
          tabIndex={-1}
          className={`${styles.card} ${own.wideCard}`}
          style={accentStyle}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
          <header className={styles.head}>
            <div className={styles.formulaPlate}>
              <h2 id={titleId} className={styles.formula}>
                {mol.formula}
              </h2>
            </div>
            <div className={styles.headTitle}>
              <p className={styles.name}>{pickName(mol, locale)}</p>
            </div>
            <div className={styles.headChips}>
              <span className={styles.kind}>
                <span className={styles.kindDot} aria-hidden />
                {pickOrganicClassLabel(mol.classId, locale)}
              </span>
              <span className={styles.chip}>
                {mol.grade === 'g11' ? t('catalog.grade11') : t('catalog.grade10')}
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
                <p className={styles.description}>{pickDesc(mol, locale)}</p>
              </section>

              <section className={styles.section}>
                <h3 className={styles.metaLabel}>{t('organicLab.equation')}</h3>
                <p className={styles.labExample}>{pickEq(mol, locale)}</p>
              </section>

              {mol.functionalGroups.length > 0 ? (
                <section className={styles.section}>
                  <h3 className={styles.metaLabel}>{t('organicLab.functionalGroups')}</h3>
                  <ul className={own.fgList}>
                    {mol.functionalGroups.map((fg) => (
                      <li key={fg.id} className={own.fgItem}>
                        <code className={own.fgCode}>{fg.label}</code>{' '}
                        <span className={own.fgName}>
                          {locale === 'en' ? fg.labelEn : locale === 'uz' ? fg.labelUz : fg.labelRu}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <div className={own.actions}>
                <Link className={own.openLab} to={`/organic?mol=${encodeURIComponent(mol.id)}`} onClick={onClose}>
                  {t('organicLab.open3d')}
                  <span className={own.linkArrow} aria-hidden>
                    →
                  </span>
                </Link>
                {mol.challengeId ? (
                  <Link
                    className={own.buildLink}
                    to={`/organic?mode=build&challenge=${encodeURIComponent(mol.challengeId)}&mol=${encodeURIComponent(mol.challengeId)}`}
                    onClick={onClose}
                  >
                    {t('organicLab.buildYourself')}
                  </Link>
                ) : null}
              </div>
            </div>

            <div className={styles.previewCol}>
              <div className={styles.previewWrap} aria-label={t('compound.preview3d')}>
                <OrganicMoleculeHero mol={mol} />
                <span className={styles.previewBadge} aria-hidden>
                  3D
                </span>
              </div>
              <section className={styles.section}>
                <h3 className={styles.metaLabel}>{t('compound.composition')}</h3>
                <CompositionTiles
                  entries={compositionEntries(composition)}
                  locale={locale}
                  ariaLabel={formatComposition(composition)}
                />
              </section>
            </div>
          </div>
        </div>
      </div>
    </DetailModalPortal>
  )
}
