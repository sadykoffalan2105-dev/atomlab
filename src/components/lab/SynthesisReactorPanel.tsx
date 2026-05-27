import { useMemo } from 'react'
import { getElementByZ } from '../../data/elements'
import { getCompoundLocaleStrings } from '../../i18n/compoundLocale'
import { useT } from '../../i18n/useT'
import type { CompoundDef } from '../../types/chemistry'
import type { LeftCatalogMatch, ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { expandLeftTermsToZSlots, REACTOR_EQUATION_MAX_FLY_ATOMS } from '../../chemistry/reactorEquationBalance'
import { ReagentValencyInteract } from './ReagentValencyInteract'
import panelStyles from './SynthesisReactorPanel.module.css'

const COEFF_MAX_TERM = 999
const COEFF_MAX_PRODUCT = 99

function termSymbolDisplay(t: ReactorEquationTerm): string {
  const e = getElementByZ(t.z)
  if (!e) return '—'
  if (t.diatomic) return `${e.symbol}\u2082`
  return e.symbol
}

function reagentGlowHex(z: number): string {
  const hex = getElementByZ(z)?.cpkHex
  return hex ? `#${hex}` : '#8899aa'
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12l5 5L20 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CoeffStepper({
  value,
  min,
  max,
  onChange,
  ariaLabel,
  highlightError,
  decLabel,
  incLabel,
}: {
  value: number
  min: number
  max: number
  onChange: (n: number) => void
  ariaLabel: string
  highlightError: boolean
  decLabel: string
  incLabel: string
}) {
  return (
    <div
      className={`${panelStyles.coeffStepper} ${highlightError ? panelStyles.coeffStepperError : ''}`}
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        className={panelStyles.coeffStepBtn}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label={decLabel}
      >
        −
      </button>
      <button
        type="button"
        className={panelStyles.coeffStepBtn}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label={incLabel}
      >
        +
      </button>
    </div>
  )
}

export function SynthesisReactorPanel({
  open,
  onOpenGenerateEquationCatalog,
  leftTerms,
  productCompound,
  productCoeff,
  onRemoveTerm,
  onCoeffChange,
  onOpenCatalog,
  onProductCoeffChange,
  onClearSlots,
  onRequestRun,
  valencyPins,
  onValencyChange,
  valencyComplete,
  message,
  canRun,
  equationBalanced,
  highlightEquationError = false,
  ambiguousProductMatches = [],
  dimInCatalogHeroView = false,
}: {
  open: boolean
  onOpenGenerateEquationCatalog: () => void
  leftTerms: readonly ReactorEquationTerm[]
  productCompound: CompoundDef | null
  productCoeff: number
  onRemoveTerm: (id: string) => void
  onCoeffChange: (id: string, coeff: number) => void
  onOpenCatalog: () => void
  onProductCoeffChange: (coeff: number) => void
  onClearSlots: () => void
  onRequestRun: () => void
  valencyPins: Readonly<Record<string, number>>
  onValencyChange: (termId: string, bonds: number) => void
  valencyComplete: boolean
  message: string | null
  canRun: boolean
  equationBalanced: boolean
  highlightEquationError?: boolean
  ambiguousProductMatches?: readonly LeftCatalogMatch[]
  dimInCatalogHeroView?: boolean
}) {
  const { locale, t } = useT()
  const coeffErr = highlightEquationError

  const productStrings = useMemo(
    () => (productCompound ? getCompoundLocaleStrings(productCompound, locale, t) : null),
    [productCompound, locale, t],
  )

  const termCoeffWithinAtomLimit = (id: string, next: number) => {
    const trial = leftTerms.map((t) => (t.id === id ? { ...t, coeff: next } : t))
    return expandLeftTermsToZSlots(trial).length <= REACTOR_EQUATION_MAX_FLY_ATOMS
  }

  return (
    <div
      className={dimInCatalogHeroView ? `${panelStyles.reactor} ${panelStyles.reactorDimHero}` : panelStyles.reactor}
      data-open={open}
      data-dim-hero={dimInCatalogHeroView && open}
      role="region"
      aria-label={t('reactor.ariaRegion')}
    >
      <div className={panelStyles.reactorHead}>
        <span className={panelStyles.reactorTitle}>{t('reactor.title')}</span>
        <div className={panelStyles.reactorActions}>
          <button type="button" className={panelStyles.reactorBtnSecondary} onClick={onClearSlots}>
            {t('reactor.reset')}
          </button>
        </div>
      </div>

      <div className={`${panelStyles.equationWrap} ${panelStyles.equationWrapWithFab}`}>
        <div
          className={`${panelStyles.equationRow} ${panelStyles.equationMissionBoard}`}
          aria-label={t('reactor.equationAria')}
          data-balanced={equationBalanced ? 'true' : undefined}
        >
          <div className={`${panelStyles.equationMain} ${panelStyles.equationMainEquationRow}`}>
            <div className={panelStyles.equationTermsCol}>
              <span className={panelStyles.equationSideLabel}>{t('reactor.reagents')}</span>
              <div className={`${panelStyles.equationTerms} ${panelStyles.equationTermsEquation}`}>
                {leftTerms.length === 0 ? (
                  <div className={panelStyles.equationEmpty} role="note">
                    {t('reactor.emptyHint')}
                  </div>
                ) : null}
                {leftTerms.map((term, idx) => (
                  <div key={term.id} className={panelStyles.termCluster}>
                    {idx > 0 ? (
                      <span className={panelStyles.equationPlus} aria-hidden>
                        +
                      </span>
                    ) : null}
                    <div
                      className={`${panelStyles.reagentBubble} ${coeffErr ? panelStyles.reagentBubbleError : ''}`}
                      style={{ ['--reagent-glow' as string]: reagentGlowHex(term.z) }}
                    >
                      <CoeffStepper
                        value={term.coeff}
                        min={1}
                        max={COEFF_MAX_TERM}
                        highlightError={coeffErr}
                        ariaLabel={t('reactor.coeffFor', { symbol: termSymbolDisplay(term) })}
                        decLabel={t('reactor.coeffDecrease')}
                        incLabel={t('reactor.coeffIncrease')}
                        onChange={(n) => {
                          if (!termCoeffWithinAtomLimit(term.id, n)) return
                          onCoeffChange(term.id, n)
                        }}
                      />
                      <span
                        className={`${panelStyles.stoichCoeff} ${term.coeff === 1 ? panelStyles.stoichCoeffOne : ''}`}
                        aria-hidden={term.coeff === 1}
                      >
                        {term.coeff === 1 ? '1' : term.coeff}
                      </span>
                      <span className={panelStyles.termSymbol}>{termSymbolDisplay(term)}</span>
                      <ReagentValencyInteract
                        termId={term.id}
                        z={term.z}
                        symbol={termSymbolDisplay(term)}
                        activeBonds={valencyPins[term.id] ?? 0}
                        onChange={onValencyChange}
                      />
                      <button
                        type="button"
                        className={panelStyles.termRemove}
                        onClick={() => onRemoveTerm(term.id)}
                        aria-label={t('reactor.remove', { symbol: termSymbolDisplay(term) })}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={panelStyles.equalsColumn} aria-hidden="true">
              <span className={panelStyles.equalsSign}>=</span>
            </div>

            <div className={`${panelStyles.productBlock} ${panelStyles.productBlockEquation}`}>
              <div className={panelStyles.productEquationMeta}>
                <span className={panelStyles.productLabelCompact}>{t('reactor.productGoal')}</span>
                {equationBalanced ? (
                  <span className={panelStyles.balanceBadge} role="status" aria-label={t('reactor.balanced')}>
                    <IconCheck className={panelStyles.balanceCheck} />
                  </span>
                ) : null}
              </div>
              {ambiguousProductMatches.length > 1 ? (
                <p className={panelStyles.ambiguousHint} role="status">
                  {t('reactor.ambiguous')}
                </p>
              ) : null}
              <div
                className={`${panelStyles.productBubble} ${coeffErr ? panelStyles.productBubbleError : ''}`}
                aria-label={t('reactor.productCoeffAria')}
              >
                <CoeffStepper
                  value={productCoeff}
                  min={1}
                  max={COEFF_MAX_PRODUCT}
                  highlightError={coeffErr}
                  ariaLabel={t('reactor.productCoeffAria')}
                  decLabel={t('reactor.coeffDecrease')}
                  incLabel={t('reactor.coeffIncrease')}
                  onChange={onProductCoeffChange}
                />
                <span
                  className={`${panelStyles.stoichCoeff} ${panelStyles.stoichCoeffProduct} ${productCoeff === 1 ? panelStyles.stoichCoeffOne : ''}`}
                >
                  {productCoeff === 1 ? '1' : productCoeff}
                </span>
                {productCompound ? (
                  <span className={panelStyles.catalogProductChip}>
                    <span className={panelStyles.catalogFormula}>{productCompound.formulaUnicode}</span>
                    <span className={panelStyles.catalogName}>
                      {productStrings?.name ?? productCompound.nameRu}
                    </span>
                  </span>
                ) : (
                  <span className={panelStyles.catalogOpenPlaceholder}>{t('reactor.productEmpty')}</span>
                )}
                <button
                  type="button"
                  className={`${panelStyles.catalogFabCompact} ${coeffErr ? panelStyles.catalogFabCompactError : ''}`}
                  onClick={onOpenCatalog}
                  title={t('reactor.openCatalog')}
                  aria-label={t('reactor.openCatalog')}
                >
                  ◫
                </button>
              </div>
              {productCompound ? (
                <span
                  className={`${panelStyles.productHint} ${panelStyles.productHintEquation}`}
                  title={productStrings?.laboratoryRecipe ?? productCompound.laboratoryRecipeRu}
                >
                  {t('reactor.recipeLabel', {
                    recipe: productStrings?.laboratoryRecipe ?? productCompound.laboratoryRecipeRu,
                  })}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <button
          type="button"
          className={panelStyles.reactorGenerateFab}
          onClick={onOpenGenerateEquationCatalog}
          title={t('reactor.generateEquationTitle')}
          aria-label={t('reactor.generateEquation')}
        >
          <span className={panelStyles.reactorGenerateFabIcon} aria-hidden>
            ⚗
          </span>
          <span className={panelStyles.reactorGenerateFabLabel}>{t('reactor.generateEquationShort')}</span>
        </button>
      </div>

      <div className={panelStyles.hintBox} role="note">
        {valencyComplete ? t('reactor.hintBalance') : t('reactor.hintValency')}
      </div>

      <div className={panelStyles.reactorFooter}>
        <button
          type="button"
          className={`${panelStyles.reactorBtnPrimary} ${!canRun ? panelStyles.reactorBtnPrimaryMuted : ''}`}
          onClick={onRequestRun}
          disabled={!canRun}
        >
          {t('reactor.run')}
        </button>
        {message ? (
          <p className={panelStyles.reactorMsg} role="status">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  )
}
