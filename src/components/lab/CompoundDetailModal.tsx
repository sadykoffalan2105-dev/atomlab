import { useEffect, useRef } from 'react'
import { compoundById } from '../../data/compounds'
import { COMPOUND_CATEGORY_KIND_LABEL } from '../../data/compoundCategoryLabels'
import type { CompoundDef } from '../../types/chemistry'
import { CatalogMoleculeHero } from './CatalogMoleculeHero'
import styles from './CompoundDetailModal.module.css'

function formatComposition(comp: Record<string, number>): string {
  return Object.entries(comp)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sym, n]) => `${sym}×${n}`)
    .join(', ')
}

export function CompoundDetailModal({
  compoundId,
  onClose,
}: {
  compoundId: string | null
  onClose: () => void
}) {
  // #region agent log
  const loggedRef = useRef<string | null>(null)
  useEffect(() => {
    if (compoundId == null) return
    if (loggedRef.current === compoundId) return
    loggedRef.current = compoundId
    const c = compoundById[compoundId]
    fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c09a52' },
      body: JSON.stringify({
        sessionId: 'c09a52',
        runId: 'pre-fix',
        hypothesisId: 'H_modal',
        location: 'CompoundDetailModal.tsx:CompoundDetailModal',
        message: 'modal open',
        data: { compoundId, found: !!c, category: c?.category ?? null, atomsLen: c?.atoms.length ?? null, bondsLen: c?.bonds.length ?? null },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
  }, [compoundId])
  // #endregion

  useEffect(() => {
    if (compoundId == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [compoundId, onClose])

  if (compoundId == null) return null

  const c: CompoundDef | undefined = compoundById[compoundId]
  const titleId = 'compound-detail-title'

  if (!c) {
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
              Вещество не найдено.
            </p>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          </header>
        </div>
      </div>
    )
  }

  const kind = COMPOUND_CATEGORY_KIND_LABEL[c.category] ?? c.category

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
            <p className={styles.name}>{c.nameRu}</p>
            <span className={styles.kind}>{kind}</span>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.textCol}>
            <span className={styles.metaLabel}>Состав</span>
            <p className={styles.compLine}>{formatComposition(c.composition)}</p>
            <span className={styles.metaLabel}>О веществе</span>
            <p className={styles.description}>{c.descriptionRu}</p>
            <p className={styles.labExample} aria-label="Упрощённый пример сопоставления атомов с формулой">
              {c.laboratoryRecipeRu}
            </p>
            <span className={styles.metaLabel}>Условия синтеза (ориентир)</span>
            <dl className={styles.synthConditions}>
              <div className={styles.synthRow}>
                <dt className={styles.synthDt}>Температура</dt>
                <dd className={styles.synthDd}>{c.synthesisConditionsRu.temperature ?? '—'}</dd>
              </div>
              <div className={styles.synthRow}>
                <dt className={styles.synthDt}>Давление</dt>
                <dd className={styles.synthDd}>{c.synthesisConditionsRu.pressure ?? '—'}</dd>
              </div>
              <div className={styles.synthRow}>
                <dt className={styles.synthDt}>Катализатор</dt>
                <dd className={styles.synthDd}>{c.synthesisConditionsRu.catalyst ?? '—'}</dd>
              </div>
            </dl>
          </div>
          <div className={styles.previewWrap} aria-label="Трёхмерная модель вещества">
            <CatalogMoleculeHero compoundId={compoundId} />
          </div>
        </div>
      </div>
    </div>
  )
}
