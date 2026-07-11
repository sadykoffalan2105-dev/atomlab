import { useMemo, useState, type KeyboardEvent } from 'react'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { REACTOR_COEFF_MAX } from '../../chemistry/reactorLimits'
import { getElementByZ } from '../../data/elements'
import { targetCoeffForElement } from '../../data/organicLab/organicReactorBalance'
import type { OrganicMoleculeDef } from '../../data/organicLab/organicMoleculeTypes'
import { useLocale } from '../../i18n/useLocale'
import { useT } from '../../i18n/useT'
import styles from './OrganicSynthesisReactorPanel.module.css'

const COEFF_MAX = REACTOR_COEFF_MAX

function termSymbol(t: ReactorEquationTerm): string {
  return getElementByZ(t.z)?.symbol ?? '—'
}

function glow(z: number): string {
  const hex = getElementByZ(z)?.cpkHex
  return hex ? `#${hex}` : '#94a3b8'
}

function pickName(m: OrganicMoleculeDef, locale: string) {
  if (locale === 'en') return m.nameEn
  if (locale === 'uz') return m.nameUz
  return m.nameRu
}

function pickEq(m: OrganicMoleculeDef, locale: string) {
  if (locale === 'en') return m.equationEn
  if (locale === 'uz') return m.equationUz
  return m.equationRu
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.min(COEFF_MAX, Math.floor(n)))
}

/**
 * Коэффициент как в учебнике: крупное число перед формулой,
 * − / + по бокам, ввод с клавиатуры. Под числом — «нужно N», если известна цель.
 */
function StoichCoeff({
  value,
  onChange,
  target,
  ariaLabel,
  showNeed = true,
}: {
  value: number
  onChange: (n: number) => void
  target?: number | null
  ariaLabel: string
  /** Подсказка «нужно N» — только для реагентов. */
  showNeed?: boolean
}) {
  const { t } = useT()
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? String(value)
  const hasTarget = showNeed && target != null && target > 0
  const matched = hasTarget && value === target

  const commit = (raw: string) => {
    const parsed = Number.parseInt(raw.replace(/\D/g, ''), 10)
    onChange(clamp(Number.isFinite(parsed) ? parsed : value))
    setDraft(null)
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(clamp(value + 1))
      setDraft(null)
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(clamp(value - 1))
      setDraft(null)
    }
  }

  return (
    <div
      className={`${styles.stoich} ${matched ? styles.stoichOk : ''} ${hasTarget && !matched ? styles.stoichWait : ''}`}
      role="group"
      aria-label={ariaLabel}
    >
      <div className={styles.stoichRow}>
        <button
          type="button"
          className={styles.pm}
          disabled={value <= 1}
          onClick={() => onChange(clamp(value - 1))}
          aria-label={t('reactor.coeffDecrease')}
        >
          −
        </button>
        <input
          className={styles.num}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={shown}
          aria-label={ariaLabel}
          onFocus={(e) => {
            setDraft(String(value))
            e.currentTarget.select()
          }}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
          onBlur={() => commit(draft ?? String(value))}
          onKeyDown={onKey}
        />
        <button
          type="button"
          className={styles.pm}
          disabled={value >= COEFF_MAX}
          onClick={() => onChange(clamp(value + 1))}
          aria-label={t('reactor.coeffIncrease')}
        >
          +
        </button>
      </div>
      {showNeed ? (
        hasTarget ? (
          <span className={styles.need} data-ok={matched ? 'true' : undefined}>
            {matched ? t('organicLab.coeffOk') : t('organicLab.coeffNeed', { n: target })}
          </span>
        ) : (
          <span className={styles.needMuted}>{t('organicLab.coeffPickProduct')}</span>
        )
      ) : (
        <span className={styles.needMuted}>{t('organicLab.productCoeffLabel')}</span>
      )}
    </div>
  )
}

export function OrganicSynthesisReactorPanel({
  open,
  onOpenGenerateEquationCatalog,
  leftTerms,
  productMolecule,
  productCoeff,
  onRemoveTerm,
  onCoeffChange,
  onOpenCatalog,
  onProductCoeffChange,
  onClearSlots,
  onRequestRun,
  message,
  canRun,
  synthesisRunning = false,
  equationBalanced,
  highlightEquationError = false,
  ambiguousCount = 0,
}: {
  open: boolean
  onOpenGenerateEquationCatalog: () => void
  leftTerms: readonly ReactorEquationTerm[]
  productMolecule: OrganicMoleculeDef | null
  productCoeff: number
  onRemoveTerm: (id: string) => void
  onCoeffChange: (id: string, coeff: number) => void
  onOpenCatalog: () => void
  onProductCoeffChange: (coeff: number) => void
  onClearSlots: () => void
  onRequestRun: () => void
  message: string | null
  canRun: boolean
  synthesisRunning?: boolean
  equationBalanced: boolean
  highlightEquationError?: boolean
  ambiguousCount?: number
}) {
  const { t } = useT()
  const { locale } = useLocale()

  const productName = useMemo(
    () => (productMolecule ? pickName(productMolecule, locale) : null),
    [productMolecule, locale],
  )

  return (
    <div className={styles.reactor} data-open={open} role="region" aria-label={t('reactor.ariaRegion')}>
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>{t('organicLab.reactorTitle')}</h2>
          <p className={styles.sub}>{t('organicLab.reactorHintTextbook')}</p>
        </div>
        <div className={styles.headBtns}>
          <button type="button" className={styles.ghost} onClick={onOpenGenerateEquationCatalog}>
            {t('reactor.generateEquationShort')}
          </button>
          <button type="button" className={styles.ghost} onClick={onClearSlots}>
            {t('reactor.reset')}
          </button>
        </div>
      </header>

      <div
        className={`${styles.equation} ${equationBalanced ? styles.equationOk : ''} ${highlightEquationError ? styles.equationErr : ''}`}
        aria-label={t('reactor.equationAria')}
      >
        <div className={styles.left}>
          <span className={styles.colLabel}>{t('reactor.reagents')}</span>
          {leftTerms.length === 0 ? (
            <p className={styles.empty}>{t('organicLab.reactorEmptyTextbook')}</p>
          ) : (
            <div className={styles.terms}>
              {leftTerms.map((term, idx) => {
                const sym = termSymbol(term)
                const target = productMolecule
                  ? targetCoeffForElement(productMolecule, productCoeff, sym)
                  : null
                return (
                  <div key={term.id} className={styles.term}>
                    {idx > 0 ? (
                      <span className={styles.op} aria-hidden>
                        +
                      </span>
                    ) : null}
                    <div
                      className={styles.slot}
                      style={{ ['--glow' as string]: glow(term.z) }}
                    >
                      <StoichCoeff
                        value={term.coeff}
                        target={target && target > 0 ? target : null}
                        ariaLabel={t('reactor.coeffFor', { symbol: sym })}
                        onChange={(n) => onCoeffChange(term.id, n)}
                      />
                      <span className={styles.formula}>{sym}</span>
                      <button
                        type="button"
                        className={styles.x}
                        onClick={() => onRemoveTerm(term.id)}
                        aria-label={t('reactor.remove', { symbol: sym })}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <span className={styles.eq} aria-hidden>
          =
        </span>

        <div className={styles.right}>
          <span className={styles.colLabel}>
            {t('reactor.productGoal')}
            {equationBalanced ? (
              <span className={styles.badge} role="status">
                {t('reactor.balanced')}
              </span>
            ) : null}
          </span>

          {ambiguousCount > 1 ? (
            <p className={styles.warn}>{t('organicLab.reactorAmbiguous', { n: ambiguousCount })}</p>
          ) : null}

          <div className={styles.productSlot}>
            <StoichCoeff
              value={productCoeff}
              target={null}
              showNeed={false}
              ariaLabel={t('reactor.productCoeffAria')}
              onChange={onProductCoeffChange}
            />
            {productMolecule ? (
              <div className={styles.productText}>
                <strong className={styles.productFormula}>{productMolecule.formula}</strong>
                <span className={styles.productName}>{productName}</span>
              </div>
            ) : (
              <button type="button" className={styles.pick} onClick={onOpenCatalog}>
                {t('reactor.productEmpty')}
              </button>
            )}
            <button
              type="button"
              className={styles.catalog}
              onClick={onOpenCatalog}
              aria-label={t('reactor.openCatalog')}
              title={t('reactor.openCatalog')}
            >
              ◫
            </button>
          </div>

          {productMolecule ? (
            <p className={styles.recipe}>
              {t('reactor.recipeLabel', { recipe: pickEq(productMolecule, locale) })}
            </p>
          ) : null}
        </div>
      </div>

      <footer className={styles.footer}>
        <button
          type="button"
          className={`${styles.run} ${!canRun && !synthesisRunning ? styles.runMuted : ''}`}
          onClick={onRequestRun}
          disabled={!canRun || synthesisRunning}
          aria-busy={synthesisRunning}
        >
          {synthesisRunning ? t('reactor.runRunning') : t('reactor.run')}
        </button>
        {message ? (
          <p className={styles.msg} role="status">
            {message}
          </p>
        ) : null}
      </footer>
    </div>
  )
}
