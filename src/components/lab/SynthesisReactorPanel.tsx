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
import type { ReactorCoProductTerm } from '../../chemistry/scientificReactorRecipes'
import { REACTOR_COEFF_MAX } from '../../chemistry/reactorLimits'
import { getReactorVisualTier } from '../../chemistry/reactorVisualTier'
import { compoundById } from '../../data/compounds'
import { ReactorBalancePanel } from './ReactorBalancePanel'
import type { BalanceLesson } from '../../chemistry/balanceLessonBank'
import panelStyles from './SynthesisReactorPanel.module.css'

const COEFF_MAX = REACTOR_COEFF_MAX

function termSymbolDisplay(t: ReactorEquationTerm): string {
  if (t.compoundId) {
    const c = compoundById[t.compoundId]
    if (c) return c.formulaUnicode
  }
  const e = getElementByZ(t.z)
  if (!e) return '—'
  if (t.diatomic) return `${e.symbol}\u2082`
  return e.symbol
}

function coProductSymbolDisplay(cp: ReactorCoProductTerm): string {
  return compoundById[cp.compoundId]?.formulaUnicode ?? cp.compoundId
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
  coProducts = [],
  productCompound,
  productCoeff,
  onRemoveTerm,
  onCoeffChange,
  onCoProductCoeffChange,
  onOpenCatalog,
  onProductCoeffChange,
  onClearSlots,
  onRequestRun,
  onSynthesisPrewarmIntent,
  onCoeffUiFocusChange,
  onApplyBalanceCoeffs,
  onLoadBalanceLesson,
  message,
  canRun,
  synthesisRunning = false,
  equationBalanced,
  highlightEquationError = false,
  ambiguousProductMatches = [],
  dimInCatalogHeroView = false,
  labHeatOn = false,
  labPressureOn = false,
  labCatalystOn = false,
  onLabHeatChange,
  onLabPressureChange,
  onLabCatalystChange,
  scientificMode = false,
  teacherAvailable = false,
  teacherVoiceOn = true,
  teacherSpeaking = false,
  onTeacherVoiceToggle,
  onTeacherReplay,
}: {
  open: boolean
  onOpenGenerateEquationCatalog: () => void
  leftTerms: readonly ReactorEquationTerm[]
  coProducts?: readonly ReactorCoProductTerm[]
  productCompound: CompoundDef | null
  productCoeff: number
  onRemoveTerm: (id: string) => void
  onCoeffChange: (id: string, coeff: number) => void
  onCoProductCoeffChange?: (id: string, coeff: number) => void
  onOpenCatalog: () => void
  onProductCoeffChange: (coeff: number) => void
  onClearSlots: () => void
  onRequestRun: () => void
  onSynthesisPrewarmIntent?: () => void
  /** true пока фокус в любом поле коэффициента (freeze 3D). */
  onCoeffUiFocusChange?: (focused: boolean) => void
  onApplyBalanceCoeffs?: (left: Record<string, number>, productCoeff: number) => void
  onLoadBalanceLesson?: (lesson: BalanceLesson) => void
  message: string | null
  canRun: boolean
  synthesisRunning?: boolean
  equationBalanced: boolean
  highlightEquationError?: boolean
  ambiguousProductMatches?: readonly LeftCatalogMatch[]
  dimInCatalogHeroView?: boolean
  labHeatOn?: boolean
  labPressureOn?: boolean
  labCatalystOn?: boolean
  onLabHeatChange?: (on: boolean) => void
  onLabPressureChange?: (on: boolean) => void
  onLabCatalystChange?: (on: boolean) => void
  scientificMode?: boolean
  /** ИИ-преподаватель доступен для текущего продукта (ClO₂). */
  teacherAvailable?: boolean
  teacherVoiceOn?: boolean
  teacherSpeaking?: boolean
  onTeacherVoiceToggle?: () => void
  onTeacherReplay?: () => void
}) {
  const { locale, t } = useT()
  const coeffErr = highlightEquationError
  const coeffFocusGenRef = useRef(0)
  const coeffFocusReleaseTimerRef = useRef<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)

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
    if (!open) {
      setCollapsed(false)
      coeffFocusGenRef.current += 1
      if (coeffFocusReleaseTimerRef.current != null) {
        clearTimeout(coeffFocusReleaseTimerRef.current)
        coeffFocusReleaseTimerRef.current = null
      }
      onCoeffUiFocusChange?.(false)
      return
    }
    if (!collapsed) return
    // Скрытая панель не должна держать 3D в режиме редактирования коэффициентов.
    coeffFocusGenRef.current += 1
    if (coeffFocusReleaseTimerRef.current != null) {
      clearTimeout(coeffFocusReleaseTimerRef.current)
      coeffFocusReleaseTimerRef.current = null
    }
    onCoeffUiFocusChange?.(false)
  }, [open, collapsed, onCoeffUiFocusChange])

  const productStrings = useMemo(
    () => (productCompound ? getCompoundLocaleStrings(productCompound, locale, t) : null),
    [productCompound, locale, t],
  )

  const visualTier = useMemo(() => (leftTerms.length > 0 ? getReactorVisualTier(leftTerms) : 'full'), [leftTerms])
  const hasDiatomic = leftTerms.some((t) => t.diatomic)

  return (
    <>
    <div
      className={dimInCatalogHeroView ? `${panelStyles.reactor} ${panelStyles.reactorDimHero}` : panelStyles.reactor}
      data-open={open}
      data-collapsed={open && collapsed ? 'true' : undefined}
      data-lab-reactor=""
      data-dim-hero={dimInCatalogHeroView && open}
      role="region"
      aria-label={t('reactor.ariaRegion')}
      aria-hidden={open && collapsed ? true : undefined}
      inert={open && collapsed ? true : undefined}
    >
      <div className={panelStyles.reactorHead}>
        <span className={panelStyles.reactorTitle}>{t('reactor.title')}</span>
        <div className={panelStyles.reactorActions}>
          {teacherAvailable ? (
            <div className={panelStyles.teacherControls} role="group" aria-label={t('lab.teacher.aria')}>
              <span
                className={panelStyles.teacherBadge}
                data-speaking={teacherSpeaking ? '1' : undefined}
              >
                {t('lab.teacher.badge')}
              </span>
              <button
                type="button"
                className={panelStyles.reactorBtnSecondary}
                onClick={() => onTeacherReplay?.()}
                title={t('lab.teacher.replay')}
                aria-label={t('lab.teacher.replay')}
              >
                {t('lab.teacher.replayShort')}
              </button>
              <button
                type="button"
                className={`${panelStyles.reactorBtnSecondary} ${teacherVoiceOn ? panelStyles.teacherVoiceOn : panelStyles.teacherVoiceOff}`}
                onClick={() => onTeacherVoiceToggle?.()}
                aria-pressed={teacherVoiceOn}
                title={teacherVoiceOn ? t('lab.teacher.mute') : t('lab.teacher.unmute')}
              >
                {teacherVoiceOn ? t('lab.teacher.voiceOn') : t('lab.teacher.voiceOff')}
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className={`${panelStyles.reactorBtnSecondary} ${panelStyles.reactorBtnHide}`}
            onClick={() => setCollapsed(true)}
            aria-label={t('reactor.hidePanel')}
            title={t('reactor.hidePanel')}
          >
            <span className={panelStyles.reactorBtnHideIcon} aria-hidden>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            {t('reactor.hidePanel')}
          </button>
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
                      {term.locked ? null : (
                      <button
                        type="button"
                        className={panelStyles.termRemove}
                        onClick={() => onRemoveTerm(term.id)}
                        aria-label={t('reactor.remove', { symbol: termSymbolDisplay(term) })}
                      >
                        ×
                      </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={panelStyles.equalsColumn} aria-hidden="true">
              <span className={panelStyles.equalsSign}>{scientificMode ? '→' : '='}</span>
            </div>

            <div className={`${panelStyles.productBlock} ${panelStyles.productBlockEquation}`}>
              <div className={panelStyles.productEquationMeta}>
                <span className={panelStyles.productLabelCompact}>
                  {scientificMode ? 'Продукты' : t('reactor.productGoal')}
                </span>
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
              <div className={panelStyles.equationTerms} style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
                {coProducts.map((cp, idx) => (
                  <div key={cp.id} className={panelStyles.termCluster}>
                    {idx > 0 ? (
                      <span className={panelStyles.equationPlus} aria-hidden>
                        +
                      </span>
                    ) : null}
                    <div
                      className={`${panelStyles.reagentBubble} ${coeffErr ? panelStyles.reagentBubbleError : ''}`}
                      style={{ ['--reagent-glow' as string]: '#ab5cf2' }}
                    >
                      <CoeffKeyboardInput
                        value={cp.coeff}
                        min={1}
                        max={COEFF_MAX}
                        highlightError={coeffErr}
                        dimWhenOne
                        ariaLabel={t('reactor.coeffFor', { symbol: coProductSymbolDisplay(cp) })}
                        onChange={(n) => onCoProductCoeffChange?.(cp.id, n)}
                        onFocusChange={reportCoeffFocus}
                      />
                      <span className={panelStyles.termSymbol}>{coProductSymbolDisplay(cp)}</span>
                    </div>
                  </div>
                ))}
                {coProducts.length > 0 ? (
                  <span className={panelStyles.equationPlus} aria-hidden>
                    +
                  </span>
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
                  {scientificMode ? null : (
                    <button
                      type="button"
                      className={`${panelStyles.catalogFabCompact} ${coeffErr ? panelStyles.catalogFabCompactError : ''}`}
                      onClick={onOpenCatalog}
                      title={t('reactor.openCatalog')}
                      aria-label={t('reactor.openCatalog')}
                    >
                      ◫
                </button>
                  )}
                </div>
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

      {productCompound &&
      (productCompound.synthesisLab?.needsHeat ||
        productCompound.synthesisLab?.needsPressure ||
        productCompound.synthesisLab?.needsCatalyst) ? (
        <div className={panelStyles.labConditions} role="group" aria-label={t('reactor.labConditionsAria')}>
          <div className={panelStyles.labCondHead}>
            <span className={panelStyles.labCondTitle}>{t('reactor.labConditionsTitle')}</span>
            {(() => {
              const need = [
                productCompound.synthesisLab?.needsHeat,
                productCompound.synthesisLab?.needsPressure,
                productCompound.synthesisLab?.needsCatalyst,
              ].filter(Boolean).length
              const on =
                (productCompound.synthesisLab?.needsHeat && labHeatOn ? 1 : 0) +
                (productCompound.synthesisLab?.needsPressure && labPressureOn ? 1 : 0) +
                (productCompound.synthesisLab?.needsCatalyst && labCatalystOn ? 1 : 0)
              const ready = need > 0 && on >= need
              return (
                <span
                  className={
                    ready
                      ? `${panelStyles.labCondProgress} ${panelStyles.labCondProgressReady}`
                      : panelStyles.labCondProgress
                  }
                  aria-hidden
                >
                  {on}/{need}
                </span>
              )
            })()}
          </div>
          <div className={panelStyles.labCondChips}>
            {productCompound.synthesisLab?.needsHeat ? (
              <button
                type="button"
                className={
                  labHeatOn
                    ? `${panelStyles.labCondChip} ${panelStyles.labCondChipHeat} ${panelStyles.labCondChipOn}`
                    : `${panelStyles.labCondChip} ${panelStyles.labCondChipHeat}`
                }
                aria-pressed={labHeatOn}
                onClick={() => onLabHeatChange?.(!labHeatOn)}
              >
                <span className={panelStyles.labCondIcon} aria-hidden>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                    <path
                      d="M12 3c1.2 2.2.4 3.8-.4 5.1-.7 1.1-1.3 2-.9 3.4.4 1.5 1.8 2.5 3.5 2.5 2.4 0 4.3-1.9 4.3-4.4 0-2.6-1.7-4.3-4-6.1C13.2 2.4 12.6 2.6 12 3Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9.2 18.2c.7 1.4 2 2.3 3.5 2.3s2.8-.9 3.5-2.3"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span className={panelStyles.labCondChipText}>
                  <span className={panelStyles.labCondChipLabel}>{t('reactor.labHeat')}</span>
                </span>
                <span className={panelStyles.labCondSwitch} aria-hidden data-on={labHeatOn ? '1' : '0'} />
              </button>
            ) : null}
            {productCompound.synthesisLab?.needsPressure ? (
              <button
                type="button"
                className={
                  labPressureOn
                    ? `${panelStyles.labCondChip} ${panelStyles.labCondChipPressure} ${panelStyles.labCondChipOn}`
                    : `${panelStyles.labCondChip} ${panelStyles.labCondChipPressure}`
                }
                aria-pressed={labPressureOn}
                onClick={() => onLabPressureChange?.(!labPressureOn)}
              >
                <span className={panelStyles.labCondIcon} aria-hidden>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                    <path
                      d="M6 14.5c0-3.6 2.5-6.2 6-8.5 3.5 2.3 6 4.9 6 8.5a6 6 0 1 1-12 0Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path d="M12 11v5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <span className={panelStyles.labCondChipText}>
                  <span className={panelStyles.labCondChipLabel}>{t('reactor.labPressure')}</span>
                </span>
                <span className={panelStyles.labCondSwitch} aria-hidden data-on={labPressureOn ? '1' : '0'} />
              </button>
            ) : null}
            {productCompound.synthesisLab?.needsCatalyst ? (
              <button
                type="button"
                className={
                  labCatalystOn
                    ? `${panelStyles.labCondChip} ${panelStyles.labCondChipCatalyst} ${panelStyles.labCondChipOn}`
                    : `${panelStyles.labCondChip} ${panelStyles.labCondChipCatalyst}`
                }
                aria-pressed={labCatalystOn}
                onClick={() => onLabCatalystChange?.(!labCatalystOn)}
              >
                <span className={panelStyles.labCondIcon} aria-hidden>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                    <circle cx="8.5" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="15.5" cy="8.5" r="2.2" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="15.5" cy="15.5" r="2.2" stroke="currentColor" strokeWidth="1.6" />
                    <path
                      d="M10.4 11.2 13.6 9.2M10.4 12.8l3.2 2"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span className={panelStyles.labCondChipText}>
                  <span className={panelStyles.labCondChipLabel}>{t('reactor.labCatalyst')}</span>
                  {productStrings?.synthesisConditions.catalyst ? (
                    <span className={panelStyles.labCondChipSub}>
                      {productStrings.synthesisConditions.catalyst}
                    </span>
                  ) : null}
                </span>
                <span className={panelStyles.labCondSwitch} aria-hidden data-on={labCatalystOn ? '1' : '0'} />
              </button>
            ) : null}
          </div>
          {equationBalanced && !canRun && !synthesisRunning ? (
            <p className={panelStyles.labCondHint} role="status">
              {t('reactor.labConditionsNeeded')}
            </p>
          ) : null}
          {labCatalystOn && productStrings?.synthesisConditions.catalyst ? (
            <p className={panelStyles.labCondCatalystLive} role="status">
              <span className={panelStyles.labCondCatalystPulse} aria-hidden />
              {t('reactor.labCatalystActive', {
                name: productStrings.synthesisConditions.catalyst,
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      {productStrings?.obtainingSteps && productStrings.obtainingSteps.length > 1 ? (
        <details className={panelStyles.obtainingDetails}>
          <summary>{t('reactor.obtainingStepsSummary')}</summary>
          <ol className={panelStyles.obtainingList}>
            {productStrings.obtainingSteps.map((s) => (
              <li key={s.step}>
                <code>{s.equation}</code>
                {s.note ? <span> — {s.note}</span> : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {open ? (
        <ReactorBalancePanel
          leftTerms={leftTerms}
          productCompound={productCompound}
          productCoeff={productCoeff}
          onApplyCoeffs={(left, k) => onApplyBalanceCoeffs?.(left, k)}
          onLoadLesson={(lesson) => onLoadBalanceLesson?.(lesson)}
        />
      ) : null}

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
    {open && collapsed ? (
      <button
        type="button"
        className={panelStyles.reactorReopenFab}
        onClick={() => setCollapsed(false)}
        aria-label={t('reactor.showPanel')}
        title={t('reactor.showPanel')}
      >
        <span className={panelStyles.reactorReopenFabIcon} aria-hidden>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <path
              d="M6 15l6-6 6 6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        {t('reactor.showPanel')}
      </button>
    ) : null}
    </>
  )
}
