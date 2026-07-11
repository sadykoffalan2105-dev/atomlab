import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { compositionOf } from '../../chemistry/organic/organicGraph'
import {
  pickOrganicClassLabel,
} from '../../data/organicLab/organicMoleculeRegistry'
import type { OrganicMoleculeDef } from '../../data/organicLab/organicMoleculeTypes'
import { useLocale } from '../../i18n/useLocale'
import { useT } from '../../i18n/useT'
import { OrganicMoleculeHero } from './OrganicMoleculeHero'
import styles from '../lab/CompoundDetailModal.module.css'
import own from './OrganicMoleculeDetailModal.module.css'

function formatComposition(comp: Record<string, number>): string {
  return Object.entries(comp)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
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

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={`${styles.card} ${own.wideCard}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.head}>
          <div>
            <h2 id={titleId} className={styles.formula}>
              {mol.formula}
            </h2>
            <p className={styles.name}>{pickName(mol, locale)}</p>
            <span className={styles.kind}>{pickOrganicClassLabel(mol.classId, locale)}</span>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('element.close')}>
            ×
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.textCol}>
            <span className={styles.metaLabel}>{t('compound.composition')}</span>
            <p className={styles.compLine}>{formatComposition(composition)}</p>
            <span className={styles.metaLabel}>{t('compound.about')}</span>
            <p className={styles.description}>{pickDesc(mol, locale)}</p>
            <span className={styles.metaLabel}>{t('organicLab.equation')}</span>
            <p className={styles.labExample}>{pickEq(mol, locale)}</p>
            {mol.functionalGroups.length > 0 ? (
              <>
                <span className={styles.metaLabel}>{t('organicLab.functionalGroups')}</span>
                <ul className={own.fgList}>
                  {mol.functionalGroups.map((fg) => (
                    <li key={fg.id}>
                      <code>{fg.label}</code>{' '}
                      {locale === 'en' ? fg.labelEn : locale === 'uz' ? fg.labelUz : fg.labelRu}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <div className={own.actions}>
              <Link className={own.openLab} to={`/organic?mol=${encodeURIComponent(mol.id)}`} onClick={onClose}>
                {t('organicLab.openInLab')}
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
          <div className={styles.previewWrap} aria-label={t('compound.preview3d')}>
            <OrganicMoleculeHero mol={mol} />
          </div>
        </div>
      </div>
    </div>
  )
}
