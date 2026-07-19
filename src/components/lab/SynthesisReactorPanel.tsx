import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
} from 'react'
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

function clampCoeff(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function parseCoeffDraft(raw: string, min: number, max: number): number | null {
  const cleaned = raw.replace(/[^\d]/g, '')
  if (cleaned === '') return null
  const n = Number.parseInt(cleaned, 10)
  if (!Number.isFinite(n)) return null
  return clampCoeff(n, min, max)
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

/**
 * Коэффициент с клавиатуры.
 * Пока печатаешь / переключаешь поля — 3D не трогаем (холд в LaboratoryPage).
 * Commit на Enter / blur / ↑↓; onFocusChange для freeze Canvas.
 */
function CoeffKeyboardInput({
  value,
  min,
  max,
  onChange,
  onFocusChange,
  ariaLabel,
  highlightError,
  dimWhenOne = false,
}: {
  value: number
  min: number
  max: number
  onChange: (n: number) => void
  onFocusChange?: (focused: boolean) => void
  ariaLabel: string
  highlightError: boolean
  dimWhenOne?: boolean
}) {
  const inputId = useId()
  const focusedRef = useRef(false)
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(() => String(value))

  useEffect(() => {
    if (focusedRef.current) return
    setDraft(String(value))
  }, [value])

  const commit = useCallback(
    (raw: string) => {
      const parsed = parseCoeffDraft(raw, min, max)
      if (parsed == null) {
        setDraft(String(value))
        return
      }
      setDraft(String(parsed))
      if (parsed !== value) onChange(parsed)
    },
    [min, max, onChange, value],
  )

  const onFocus = () => {
    focusedRef.current = true
    setFocused(true)
    onFocusChange?.(true)
    setDraft(String(value))
  }

  const onBlur = (e: FocusEvent<HTMLInputElement>) => {
    focusedRef.current = false
    setFocused(false)
    commit(e.currentTarget.value)
    onFocusChange?.(false)
  }

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.replace(/[^\d]/g, '').slice(0, 4)
    setDraft(next)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit(e.currentTarget.value)
      e.currentTarget.blur()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setDraft(String(value))
      e.currentTarget.blur()
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const base = parseCoeffDraft(draft, min, max) ?? value
      const next = clampCoeff(base + 1, min, max)
      setDraft(String(next))
      if (next !== value) onChange(next)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const base = parseCoeffDraft(draft, min, max) ?? value
      const next = clampCoeff(base - 1, min, max)
      setDraft(String(next))
      if (next !== value) onChange(next)
    }
  }

  const showDim = dimWhenOne && !focused && value === 1 && draft === '1'

  return (
    <input
      id={inputId}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      spellCheck={false}
      className={`${panelStyles.coeffInput} ${highlightError ? panelStyles.coeffInputError : ''} ${showDim ? panelStyles.coeffInputOne : ''}`}
      value={draft}
      aria-label={ariaLabel}
      title={ariaLabel}
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={onInputChange}
      onKeyDown={onKeyDown}
      onClick={(e) => e.currentTarget.select()}
    />
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
  onCoeffUiFocusChange,
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
  /** true пока фокус в любом поле коэффициента (freeze 3D). */
  onCoeffUiFocusChange?: (focused: boolean) => void
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
  const coeffFocusGenRef = useRef(0)
  const coeffFocusReleaseTimerRef = useRef<number | null>(null)

  const reportCoeffFocus = useCallback(
    (focused: boolean) => {
      if (focused) {
        coeffFocusGenRef.current += 1
        if (coeffFocusReleaseTimerRef.current != null) {
          clearTimeout(coeffFocusReleaseTimerRef.current)
          coeffFocusReleaseTimerRef.current = null
        }
        onCoeffUiFocusChange?.(true)
        return
      }
      const gen = coeffFocusGenRef.current
      if (coeffFocusReleaseTimerRef.current != null) {
        clearTimeout(coeffFocusReleaseTimerRef.current)
      }
      coeffFocusReleaseTimerRef.current = window.setTimeout(() => {
        coeffFocusReleaseTimerRef.current = null
        // Новый focus (O₂→K) поднял gen — не снимаем freeze.
        if (coeffFocusGenRef.current !== gen) return
        onCoeffUiFocusChange?.(false)
      }, 140)
    },
    [onCoeffUiFocusChange],
  )

  useEffect(() => {
    if (open) return
    coeffFocusGenRef.current += 1
    if (coeffFocusReleaseTimerRef.current != null) {
      clearTimeout(coeffFocusReleaseTimerRef.current)
      coeffFocusReleaseTimerRef.current = null
    }
    onCoeffUiFocusChange?.(false)
  }, [open, onCoeffUiFocusChange])

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
      data-lab-reactor=""
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
                      <CoeffKeyboardInput
                        value={term.coeff}
                        min={1}
                        max={COEFF_MAX}
                        highlightError={coeffErr}
                        dimWhenOne
                        ariaLabel={t('reactor.coeffFor', { symbol: termSymbolDisplay(term) })}
                        onChange={(n) => onCoeffChange(term.id, n)}
                        onFocusChange={reportCoeffFocus}
                      />
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
                <CoeffKeyboardInput
                  value={productCoeff}
                  min={1}
                  max={COEFF_MAX}
                  highlightError={coeffErr}
                  dimWhenOne
                  ariaLabel={t('reactor.productCoeffAria')}
                  onChange={onProductCoeffChange}
                  onFocusChange={reportCoeffFocus}
                />
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
