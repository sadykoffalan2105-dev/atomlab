import { getElementByZ } from '../../data/elements'
import type { CompoundDef } from '../../types/chemistry'
import type { LeftCatalogMatch, ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { expandLeftTermsToZSlots, REACTOR_EQUATION_MAX_FLY_ATOMS } from '../../chemistry/reactorEquationBalance'
import panelStyles from './SynthesisReactorPanel.module.css'

const COEFF_MAX_TERM = 999
const COEFF_MAX_PRODUCT = 99

const EMPTY_REAGENTS_HINT =
  'Элементы — кнопка ⊞ справа (таблица Менделеева). «Сгенерировать уравнение» — каталог и эталон без коэффициентов.'

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
}: {
  value: number
  min: number
  max: number
  onChange: (n: number) => void
  ariaLabel: string
  highlightError: boolean
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
        aria-label="Уменьшить коэффициент"
      >
        −
      </button>
      <button
        type="button"
        className={panelStyles.coeffStepBtn}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="Увеличить коэффициент"
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
  message: string | null
  canRun: boolean
  equationBalanced: boolean
  highlightEquationError?: boolean
  ambiguousProductMatches?: readonly LeftCatalogMatch[]
  dimInCatalogHeroView?: boolean
}) {
  const coeffErr = highlightEquationError

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
      aria-label="Реактор синтеза"
    >
      <div className={panelStyles.reactorHead}>
        <span className={panelStyles.reactorTitle}>Реактор</span>
        <div className={panelStyles.reactorActions}>
          <button type="button" className={panelStyles.reactorBtnSecondary} onClick={onClearSlots}>
            Сбросить
          </button>
        </div>
      </div>

      <div className={`${panelStyles.equationWrap} ${panelStyles.equationWrapWithFab}`}>
        <div
          className={panelStyles.equationRow}
          aria-label="Уравнение реакции"
          data-balanced={equationBalanced ? 'true' : undefined}
        >
          <div className={`${panelStyles.equationMain} ${panelStyles.equationMainEquationRow}`}>
            <div className={panelStyles.equationTermsCol}>
              <span className={panelStyles.equationSideLabel}>Реагенты</span>
              <div className={`${panelStyles.equationTerms} ${panelStyles.equationTermsEquation}`}>
                {leftTerms.length === 0 ? (
                  <div className={panelStyles.equationEmpty} role="note">
                    {EMPTY_REAGENTS_HINT}
                  </div>
                ) : null}
                {leftTerms.map((t, idx) => (
                  <div key={t.id} className={panelStyles.termCluster}>
                    {idx > 0 ? (
                      <span className={panelStyles.equationPlus} aria-hidden>
                        +
                      </span>
                    ) : null}
                    <div
                      className={`${panelStyles.reagentBubble} ${coeffErr ? panelStyles.reagentBubbleError : ''}`}
                      style={{ ['--reagent-glow' as string]: reagentGlowHex(t.z) }}
                    >
                      <CoeffStepper
                        value={t.coeff}
                        min={1}
                        max={COEFF_MAX_TERM}
                        highlightError={coeffErr}
                        ariaLabel={`Коэффициент для ${termSymbolDisplay(t)}`}
                        onChange={(n) => {
                          if (!termCoeffWithinAtomLimit(t.id, n)) return
                          onCoeffChange(t.id, n)
                        }}
                      />
                      <span
                        className={`${panelStyles.stoichCoeff} ${t.coeff === 1 ? panelStyles.stoichCoeffOne : ''}`}
                        aria-hidden={t.coeff === 1}
                      >
                        {t.coeff === 1 ? '1' : t.coeff}
                      </span>
                      <span className={panelStyles.termSymbol}>{termSymbolDisplay(t)}</span>
                      <button
                        type="button"
                        className={panelStyles.termRemove}
                        onClick={() => onRemoveTerm(t.id)}
                        aria-label={`Убрать ${termSymbolDisplay(t)}`}
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
                <span className={panelStyles.productLabelCompact}>Продукт (цель)</span>
                {equationBalanced ? (
                  <span className={panelStyles.balanceBadge} role="status" aria-label="Уравнение сбалансировано">
                    <IconCheck className={panelStyles.balanceCheck} />
                  </span>
                ) : null}
              </div>
              {ambiguousProductMatches.length > 1 ? (
                <p className={panelStyles.ambiguousHint} role="status">
                  Несколько веществ с этим составом — выберите в каталоге.
                </p>
              ) : null}
              <div
                className={`${panelStyles.productBubble} ${coeffErr ? panelStyles.productBubbleError : ''}`}
                aria-label="Продукт и коэффициент"
              >
                <CoeffStepper
                  value={productCoeff}
                  min={1}
                  max={COEFF_MAX_PRODUCT}
                  highlightError={coeffErr}
                  ariaLabel="Коэффициент перед продуктом"
                  onChange={onProductCoeffChange}
                />
                <span
                  className={`${panelStyles.stoichCoeff} ${panelStyles.stoichCoeffProduct} ${productCoeff === 1 ? panelStyles.stoichCoeffOne : ''}`}
                >
                  {productCoeff === 1 ? '1' : productCoeff}
                </span>
                <button
                  type="button"
                  className={`${panelStyles.catalogOpenBtn} ${panelStyles.catalogOpenBtnInBubble} ${coeffErr ? panelStyles.catalogOpenBtnError : ''}`}
                  onClick={onOpenCatalog}
                >
                  {productCompound ? (
                    <span className={panelStyles.catalogOpenSummary}>
                      <span className={panelStyles.catalogFormula}>{productCompound.formulaUnicode}</span>
                      <span className={panelStyles.catalogName}>{productCompound.nameRu}</span>
                    </span>
                  ) : (
                    <span className={panelStyles.catalogOpenPlaceholder}>Открыть каталог…</span>
                  )}
                </button>
              </div>
              {productCompound ? (
                <span
                  className={`${panelStyles.productHint} ${panelStyles.productHintEquation}`}
                  title={productCompound.laboratoryRecipeRu}
                >
                  Эталон: {productCompound.laboratoryRecipeRu}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <button
          type="button"
          className={panelStyles.reactorPeriodicFab}
          onClick={onOpenGenerateEquationCatalog}
          title="Открыть каталог: эталон вещества как реагенты с коэффициентом 1 — уравняйте вручную"
        >
          Сгенерировать уравнение
        </button>
      </div>

      <div className={panelStyles.hintBox} role="note">
        Уравняйте атомы слева и справа. Запуск — при верном балансе и выбранном продукте из каталога.
      </div>

      <div className={panelStyles.reactorFooter}>
        <button
          type="button"
          className={`${panelStyles.reactorBtnPrimary} ${!canRun ? panelStyles.reactorBtnPrimaryMuted : ''}`}
          onClick={onRequestRun}
          disabled={!canRun}
        >
          Проверить и запустить синтез
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
