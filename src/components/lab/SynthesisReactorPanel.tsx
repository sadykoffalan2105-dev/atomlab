import { useMemo } from 'react'
import { getElementByZ } from '../../data/elements'
import { getCompoundLocaleStrings } from '../../i18n/compoundLocale'
import { useT } from '../../i18n/useT'
import type { CompoundDef } from '../../types/chemistry'
import type { LeftCatalogMatch, ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { REACTOR_COEFF_MAX } from '../../chemistry/reactorLimits'
import { getReactorVisualTier } from '../../chemistry/reactorVisualTier'
import panelStyles from './SynthesisReactorPanel.module.css'

const COEFF_MAX = REACTOR_COEFF_MAX

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
  onSynthesisPrewarmIntent,
  message,
  canRun,
  synthesisRunning = false,
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
  onSynthesisPrewarmIntent?: () => void
  message: string | null
  canRun: boolean
  synthesisRunning?: boolean
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

  const visualTier = useMemo(() => (leftTerms.length > 0 ? getReactorVisualTier(leftTerms) : 'full'), [leftTerms])
  const hasDiatomic = leftTerms.some((t) => t.diatomic)

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
                        max={COEFF_MAX}
                        highlightError={coeffErr}
                        ariaLabel={t('reactor.coeffFor', { symbol: termSymbolDisplay(term) })}
                        decLabel={t('reactor.coeffDecrease')}
                        incLabel={t('reactor.coeffIncrease')}
                        onChange={(n) => onCoeffChange(term.id, n)}
                      />
                      <span
                        className={`${panelStyles.stoichCoeff} ${term.coeff === 1 ? panelStyles.stoichCoeffOne : ''}`}
                        aria-hidden={term.coeff === 1}
                      >
                        {term.coeff === 1 ? '1' : term.coeff}
                      </span>
                      <span className={panelStyles.termSymbol}>{termSymbolDisplay(term)}</span>
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
                  max={COEFF_MAX}
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

      {visualTier !== 'full' && leftTerms.length > 0 ? (
        <p className={panelStyles.visualTierBadge} role="status">
          {t(`reactor.visualTier.${visualTier}`)}
        </p>
      ) : null}
      {hasDiatomic ? (
        <p className={panelStyles.diatomicHint} role="note">
          {t('reactor.diatomicPreviewHint')}
        </p>
      ) : null}

      <div className={panelStyles.hintBox} role="note">
        {t('reactor.hintBalance')}
      </div>

      <div className={panelStyles.reactorFooter}>
        <button
          type="button"
          className={`${panelStyles.reactorBtnPrimary} ${!canRun && !synthesisRunning ? panelStyles.reactorBtnPrimaryMuted : ''} ${synthesisRunning ? panelStyles.reactorBtnPrimaryRunning : ''}`}
          onClick={onRequestRun}
          onMouseEnter={() => {
            if (canRun && !synthesisRunning) onSynthesisPrewarmIntent?.()
          }}
          onFocus={() => {
            if (canRun && !synthesisRunning) onSynthesisPrewarmIntent?.()
          }}
          disabled={!canRun || synthesisRunning}
          aria-busy={synthesisRunning}
        >
          {synthesisRunning ? t('reactor.runRunning') : t('reactor.run')}
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
