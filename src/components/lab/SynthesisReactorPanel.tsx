import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
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
import { getSchoolReaction } from '../../chemistry/schoolReactionBank'
import { useLocation } from 'react-router-dom'
import { clo2StepStore } from '../../lab/cinema/scenes/clo2/clo2StepStore'
import { ReactorBalancePanel } from './ReactorBalancePanel'
import { effectiveLabNeeds } from '../../lab/reactionLabNeeds'
import { ReactorAtomLedger, ReactorLedgerComment, useAtomLedger } from './ReactorAtomLedger'
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
  if (t.diatomic) return `${e.symbol}₂`
  return e.symbol
}

function coProductSymbolDisplay(cp: ReactorCoProductTerm): string {
  if (cp.compoundId != null) return compoundById[cp.compoundId]?.formulaUnicode ?? cp.compoundId
  const e = getElementByZ(cp.z)
  if (!e) return '—'
  return cp.diatomic ? `${e.symbol}₂` : e.symbol
}

function coProductGlowHex(cp: ReactorCoProductTerm): string {
  return cp.compoundId != null ? '#ab5cf2' : reagentGlowHex(cp.z)
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

/* ——— Иконки (SVG вместо юникод-глифов; stroke = currentColor) ——— */

function Svg({ size = 18, className, children }: { size?: number; className?: string; children: ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  )
}

function IconCheck({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <Svg className={className} size={size}>
      <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth={2.4} />
    </Svg>
  )
}

function IconFlask({ size = 18 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M9.5 3h5M10 3v5.2L4.9 17.4A2.4 2.4 0 0 0 7 21h10a2.4 2.4 0 0 0 2.1-3.6L14 8.2V3" />
      <path d="M7.3 14.5h9.4" />
    </Svg>
  )
}

function IconSparkles({ size = 18 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M11 3.5l1.6 4.4L17 9.5l-4.4 1.6L11 15.5l-1.6-4.4L5 9.5l4.4-1.6L11 3.5Z" />
      <path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
    </Svg>
  )
}

function IconReset({ size = 17 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4.5V9h4.5" />
    </Svg>
  )
}

function IconChevron({ dir = 'down', size = 16 }: { dir?: 'down' | 'up'; size?: number }) {
  return (
    <Svg size={size}>
      <path d={dir === 'down' ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'} strokeWidth={2.2} />
    </Svg>
  )
}

function IconX({ size = 14 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M7 7l10 10M17 7L7 17" strokeWidth={2.2} />
    </Svg>
  )
}

function IconCatalog({ size = 17 }: { size?: number }) {
  return (
    <Svg size={size}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M12 3.5v17M15 8h2.5M15 12h2.5M15 16h2.5" />
    </Svg>
  )
}

function IconBulb({ size = 16 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z" />
    </Svg>
  )
}

function IconSteps({ size = 16 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <path d="M4 5l1.5-1v5M3.8 15.2a1.4 1.4 0 1 1 2.2 1.6L4 19h2.4" strokeWidth={1.6} />
    </Svg>
  )
}

function IconScale({ size = 16 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M12 4v16M8 20h8M5 7h14" />
      <path d="M5 7l-2.5 6a2.5 2.5 0 0 0 5 0L5 7ZM19 7l-2.5 6a2.5 2.5 0 0 0 5 0L19 7Z" />
    </Svg>
  )
}

function IconPlay({ size = 18 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" strokeWidth={1.4} />
    </Svg>
  )
}

function IconSpinner({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <Svg className={className} size={size}>
      <path d="M12 3a9 9 0 1 1-9 9" strokeWidth={2.4} />
    </Svg>
  )
}

function IconVoice({ size = 16 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </Svg>
  )
}

function IconReplay({ size = 16 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 4.5V9h-4.5" />
    </Svg>
  )
}

type MessageTone = 'info' | 'success' | 'warning' | 'error'

function IconTone({ tone }: { tone: MessageTone }) {
  if (tone === 'success') {
    return (
      <Svg size={18}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.3l2.7 2.7L16.2 9.5" strokeWidth={2.2} />
      </Svg>
    )
  }
  if (tone === 'warning') {
    return (
      <Svg size={18}>
        <path d="M10.3 4.2 2.8 17.4A2 2 0 0 0 4.5 20.4h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9.5v4.2M12 16.8h.01" strokeWidth={2.2} />
      </Svg>
    )
  }
  if (tone === 'error') {
    return (
      <Svg size={18}>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9l6 6M15 9l-6 6" strokeWidth={2.2} />
      </Svg>
    )
  }
  return (
    <Svg size={18}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.6h.01" strokeWidth={2.2} />
    </Svg>
  )
}

/**
 * Тон статус-сообщения реактора — только для оформления (цвет/иконка).
 * Сообщения приходят строкой из LaboratoryPage, поэтому тон выводим по смыслу текста.
 */
function reactorMessageTone(message: string, highlightError: boolean): MessageTone {
  if (highlightError) return 'error'
  const m = message.toLowerCase()
  if (/^(получено|obtained|olingan)|^(верно!|correct!|to'g'ri!)/.test(m)) return 'success'
  // «Так в реакторе не получают — откройте каталог»: подсказка маршрута, а не ошибка ввода.
  if (/не собирают|cannot be built|yig'ilmaydi/.test(m)) return 'warning'
  if (
    /не удал|failed|could not|amalga oshmadi|bo'lmadi|неизвестн|unknown|noma'lum|слишком|too many|juda ko'p|ошибк|error|xato|нельзя|cannot|не совпал|did not match|mos kelmad/.test(
      m,
    )
  ) {
    return 'error'
  }
  if (
    /выберите|добавьте|введите|включите|проверь|должн|select |add |enter |turn on|check |must|tanlang|qo'shing|kiriting|yoqing|tekshiring|kerak/.test(
      m,
    )
  ) {
    return 'warning'
  }
  return 'info'
}

/** Подписи раскрывающихся разделов (TODO: перенести в i18n-словари). */
/** «шаг/всего» урока на паузе или '' — примитив для useSyncExternalStore (без лишних рендеров). */
function readLessonPauseKey(): string {
  const s = clo2StepStore.getSnapshot()
  return s.runId > 0 && s.status === 'paused' && s.stepCount > 0 ? `${s.step + 1}/${s.stepCount}` : ''
}

/**
 * Содержимое кнопки запуска. Урок по шагам стоит на паузе — «Пауза, шаг N из M» без спиннера.
 * Подписка на шаги урока — ТОЛЬКО здесь: на «Далее» перерисовывается одна кнопка, а не весь
 * реактор (его рендер на клике давал худший кадр 50–80 мс).
 */
function RunButtonContent({ synthesisRunning, locale, runningText, runText }: { synthesisRunning: boolean; locale: string; runningText: string; runText: string }) {
  const lessonPauseKey = useSyncExternalStore(clo2StepStore.subscribe, readLessonPauseKey, readLessonPauseKey)
  const pausedText =
    synthesisRunning && lessonPauseKey
      ? (LESSON_PAUSE_LABEL[locale] ?? LESSON_PAUSE_LABEL.ru!)
          .replace('{n}', lessonPauseKey.split('/')[0]!)
          .replace('{m}', lessonPauseKey.split('/')[1]!)
      : null
  return (
    <>
      <span className={panelStyles.reactorBtnPrimaryIcon} aria-hidden>
        {synthesisRunning ? pausedText ? <IconPlay /> : <IconSpinner className={panelStyles.spin} /> : <IconPlay />}
      </span>
      <span>{synthesisRunning ? (pausedText ?? runningText) : runText}</span>
    </>
  )
}

/** Статус кнопки запуска, пока урок стоит на паузе между шагами. */
const LESSON_PAUSE_LABEL: Record<string, string> = {
  ru: 'Пауза, шаг {n} из {m}',
  en: 'Paused, step {n} of {m}',
  uz: 'Pauza, {n}-qadam / {m}',
}

const SECTION_LABELS: Record<string, { hints: string; steps: string; hide: string }> = {
  ru: { hints: 'Подсказки', steps: 'Этапы получения', hide: 'Скрыть' },
  en: { hints: 'Tips', steps: 'Production steps', hide: 'Hide' },
  uz: { hints: 'Maslahatlar', steps: 'Olish bosqichlari', hide: 'Yashirish' },
}

type ReactorSection = 'hints' | 'steps' | 'balance'

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

/**
 * Коэффициент со ступенькой: − [поле] +. Кнопки — зона нажатия 44 × 44 px
 * (видимый круг меньше), поле по-прежнему принимает ввод с клавиатуры.
 */
function CoeffStepper(props: {
  value: number
  min: number
  max: number
  onChange: (n: number) => void
  onFocusChange?: (focused: boolean) => void
  ariaLabel: string
  symbol: string
  highlightError: boolean
  dimWhenOne?: boolean
  decLabel: string
  incLabel: string
}) {
  const { value, min, max, onChange, symbol, decLabel, incLabel } = props
  return (
    <span className={panelStyles.coeffStepper}>
      <button
        type="button"
        className={panelStyles.coeffStepBtn}
        onClick={() => {
          const n = clampCoeff(value - 1, min, max)
          if (n !== value) onChange(n)
        }}
        disabled={value <= min}
        aria-label={`${decLabel}: ${symbol}`}
        title={`${decLabel}: ${symbol}`}
        data-coeff-step="dec"
      >
        <span className={panelStyles.coeffStepGlyph} aria-hidden>
          −
        </span>
      </button>
      <CoeffKeyboardInput
        value={value}
        min={min}
        max={max}
        highlightError={props.highlightError}
        dimWhenOne={props.dimWhenOne}
        ariaLabel={props.ariaLabel}
        onChange={onChange}
        onFocusChange={props.onFocusChange}
      />
      <button
        type="button"
        className={panelStyles.coeffStepBtn}
        onClick={() => {
          const n = clampCoeff(value + 1, min, max)
          if (n !== value) onChange(n)
        }}
        disabled={value >= max}
        aria-label={`${incLabel}: ${symbol}`}
        title={`${incLabel}: ${symbol}`}
        data-coeff-step="inc"
      >
        <span className={panelStyles.coeffStepGlyph} aria-hidden>
          +
        </span>
      </button>
    </span>
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
  teacherVoiceOn = false,
  teacherSpeaking = false,
  teacherLineTitle,
  teacherLineText,
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
  /** Объяснение синтеза (озвучка) — только по кнопке у реактора. */
  teacherAvailable?: boolean
  teacherVoiceOn?: boolean
  teacherSpeaking?: boolean
  teacherLineTitle?: string
  teacherLineText?: string
  onTeacherVoiceToggle?: () => void
  onTeacherReplay?: () => void
}) {
  const { locale, t } = useT()
  const location = useLocation()
  const coeffErr = highlightEquationError
  const coeffFocusGenRef = useRef(0)
  const coeffFocusReleaseTimerRef = useRef<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  /** Раскрытый раздел под уравнением (аккордеон: одновременно один). */
  const [openSection, setOpenSection] = useState<ReactorSection | null>(null)
  const sectionsId = useId()
  const labels = SECTION_LABELS[locale] ?? SECTION_LABELS.ru!

  const toggleSection = useCallback((id: ReactorSection) => {
    setOpenSection((cur) => (cur === id ? null : id))
  }, [])

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
  /** Счётчик атомов «слева | справа» и комментарий к последнему ±. */
  const atomLedger = useAtomLedger({ leftTerms, coProducts, productCompound, productCoeff }, synthesisRunning)
  const hasDiatomic = leftTerms.some((t) => t.diatomic)

  const hasObtainingSteps = Boolean(productStrings?.obtainingSteps && productStrings.obtainingSteps.length > 1)
  const activeSection: ReactorSection | null =
    openSection === 'steps' && !hasObtainingSteps ? null : openSection

  const linkedReactionId = useMemo(() => {
    const query = location.search || (window.location.hash.includes('?') ? window.location.hash.slice(window.location.hash.indexOf('?')) : '')
    return new URLSearchParams(query.startsWith('?') ? query.slice(1) : query).get('reaction')
  }, [location.search])
  const labNeeds = effectiveLabNeeds(productCompound?.synthesisLab, productCompound?.id, linkedReactionId)
  const hasLabConditions = Boolean(
    productCompound && (labNeeds?.needsHeat || labNeeds?.needsPressure || labNeeds?.needsCatalyst),
  )
  const labNeedCount = [labNeeds?.needsHeat, labNeeds?.needsPressure, labNeeds?.needsCatalyst].filter(Boolean).length
  const labOnCount =
    (labNeeds?.needsHeat && labHeatOn ? 1 : 0) +
    (labNeeds?.needsPressure && labPressureOn ? 1 : 0) +
    (labNeeds?.needsCatalyst && labCatalystOn ? 1 : 0)
  const labReady = labNeedCount > 0 && labOnCount >= labNeedCount
  const showLabConditionsHint = hasLabConditions && equationBalanced && !canRun && !synthesisRunning

  const messageTone = message ? reactorMessageTone(message, highlightEquationError) : 'info'
  // Эталон — по id реакции из ссылки (решение 9: id, а не продукт): у naoh-hcl продукт тоже NaCl,
  // и «первая реакция с этим продуктом» подставила бы 2Na + Cl₂. Рецепт соединения — только без ссылки.
  const linkedReaction = useMemo(
    () => (linkedReactionId ? (getSchoolReaction(linkedReactionId) ?? null) : null),
    [linkedReactionId],
  )
  const recipeText = productCompound
    ? linkedReaction
      ? linkedReaction.productId === productCompound.id
        ? (locale === 'ru' ? linkedReaction.equationRu : linkedReaction.equationEn || linkedReaction.equationRu)
        : null
      : (productStrings?.laboratoryRecipe ?? productCompound.laboratoryRecipeRu)
    : null

  const sectionToggle = (id: ReactorSection, icon: ReactNode, label: string, title?: string) => (
    <button
      type="button"
      className={panelStyles.sectionToggle}
      data-active={activeSection === id ? 'true' : undefined}
      aria-expanded={activeSection === id}
      aria-controls={sectionsId}
      title={title ?? label}
      onClick={() => toggleSection(id)}
    >
      <span className={panelStyles.sectionToggleIcon}>{icon}</span>
      <span className={panelStyles.sectionToggleLabel}>{label}</span>
      <span className={panelStyles.sectionToggleChevron}>
        <IconChevron dir={activeSection === id ? 'up' : 'down'} size={14} />
      </span>
    </button>
  )

  return (
    <>
    <div
      className={dimInCatalogHeroView ? `${panelStyles.reactor} ${panelStyles.reactorDimHero}` : panelStyles.reactor}
      data-open={open}
      data-collapsed={open && collapsed ? 'true' : undefined}
      data-lab-reactor=""
      data-dim-hero={dimInCatalogHeroView && open}
      data-compact={open && (dimInCatalogHeroView || synthesisRunning) ? 'true' : undefined}
      data-section-open={open && activeSection != null ? 'true' : undefined}
      role="region"
      aria-label={t('reactor.ariaRegion')}
      /* Закрытый (уехал за экран) и свёрнутый док не должен ловить Tab и читаться экранным диктором. */
      aria-hidden={!open || collapsed ? true : undefined}
      inert={!open || collapsed ? true : undefined}
    >
      <div className={panelStyles.reactorHead}>
        <span className={panelStyles.reactorTitle}>
          <span className={panelStyles.reactorTitleIcon} aria-hidden>
            <IconFlask size={16} />
          </span>
          <span className={panelStyles.reactorTitleText}>{t('reactor.title')}</span>
        </span>

        <div className={panelStyles.sectionToggles} role="group">
          {sectionToggle('hints', <IconBulb />, labels.hints)}
          {hasObtainingSteps
            ? sectionToggle('steps', <IconSteps />, labels.steps, t('reactor.obtainingStepsSummary'))
            : null}
          {sectionToggle('balance', <IconScale />, t('reactor.balance.showMethods'))}
        </div>

        <div className={panelStyles.reactorActions}>
          {teacherAvailable ? (
            <div className={panelStyles.teacherControls} role="group" aria-label={t('lab.teacher.aria')}>
              <button
                type="button"
                className={`${panelStyles.reactorBtnSecondary} ${teacherVoiceOn ? panelStyles.teacherVoiceOn : panelStyles.teacherVoiceOff}`}
                onClick={() => onTeacherVoiceToggle?.()}
                aria-pressed={teacherVoiceOn}
                title={teacherVoiceOn ? t('lab.teacher.explainMute') : t('lab.teacher.explainEnable')}
              >
                <IconVoice />
                <span className={panelStyles.btnLabel}>
                  {teacherVoiceOn ? t('lab.teacher.explainOn') : t('lab.teacher.explain')}
                </span>
                {teacherSpeaking ? <span className={panelStyles.teacherLive} aria-hidden /> : null}
              </button>
              {teacherVoiceOn ? (
                <button
                  type="button"
                  className={`${panelStyles.reactorBtnSecondary} ${panelStyles.reactorBtnIcon}`}
                  onClick={() => onTeacherReplay?.()}
                  title={t('lab.teacher.replay')}
                  aria-label={t('lab.teacher.replay')}
                >
                  <IconReplay />
                </button>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            className={`${panelStyles.reactorBtnSecondary} ${panelStyles.reactorBtnAccent}`}
            onClick={onOpenGenerateEquationCatalog}
            title={t('reactor.generateEquationTitle')}
            aria-label={t('reactor.generateEquation')}
          >
            <IconSparkles size={17} />
            <span>{t('reactor.generateEquationShort')}</span>
          </button>
          <button
            type="button"
            className={panelStyles.reactorBtnSecondary}
            onClick={onClearSlots}
            title={t('reactor.reset')}
            aria-label={t('reactor.reset')}
          >
            <IconReset />
            <span className={panelStyles.btnLabel}>{t('reactor.reset')}</span>
          </button>
          <button
            type="button"
            className={`${panelStyles.reactorBtnSecondary} ${panelStyles.reactorBtnIcon}`}
            onClick={() => setCollapsed(true)}
            aria-label={t('reactor.hidePanel')}
            title={t('reactor.hidePanel')}
          >
            <IconChevron dir="down" size={18} />
          </button>
        </div>
      </div>

      <div className={panelStyles.reactorBody}>
        <div className={panelStyles.equationWrap}>
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
                          dimWhenOne
                          ariaLabel={t('reactor.coeffFor', { symbol: termSymbolDisplay(term) })}
                          symbol={termSymbolDisplay(term)}
                          decLabel={t('reactor.coeffDecrease')}
                          incLabel={t('reactor.coeffIncrease')}
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
                            title={t('reactor.remove', { symbol: termSymbolDisplay(term) })}
                          >
                            <IconX size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={panelStyles.equalsColumn}>
                {leftTerms.length > 0 ? <ReactorAtomLedger ledger={atomLedger.ledger} /> : null}
                <span className={panelStyles.equalsSign} aria-hidden="true">
                  {scientificMode ? '→' : '='}
                </span>
              </div>

              <div className={`${panelStyles.productBlock} ${panelStyles.productBlockEquation}`}>
                <div className={panelStyles.productEquationMeta}>
                  <span className={panelStyles.productLabelCompact}>
                    {scientificMode ? t('reactor.products') : t('reactor.productGoal')}
                  </span>
                  {/* Место под плашку зарезервировано всегда (visibility, а не удаление):
                      иначе карточка уравнения прыгает по ширине при каждом ±. */}
                  <span
                    className={panelStyles.balanceBadge}
                    role={equationBalanced ? 'status' : undefined}
                    aria-label={equationBalanced ? t('reactor.balanced') : undefined}
                    aria-hidden={equationBalanced ? undefined : true}
                    style={equationBalanced ? undefined : { visibility: 'hidden' }}
                  >
                    <IconCheck className={panelStyles.balanceCheck} size={12} />
                    <span className={panelStyles.balanceBadgeText}>{t('reactor.balanced')}</span>
                  </span>
                </div>
                <div className={`${panelStyles.equationTerms} ${panelStyles.productTerms}`}>
                  {coProducts.map((cp, idx) => (
                    <div key={cp.id} className={panelStyles.termCluster}>
                      {idx > 0 ? (
                        <span className={panelStyles.equationPlus} aria-hidden>
                          +
                        </span>
                      ) : null}
                      <div
                        className={`${panelStyles.reagentBubble} ${coeffErr ? panelStyles.reagentBubbleError : ''}`}
                        style={{ ['--reagent-glow' as string]: coProductGlowHex(cp) }}
                      >
                        <CoeffStepper
                          value={cp.coeff}
                          min={1}
                          max={COEFF_MAX}
                          highlightError={coeffErr}
                          dimWhenOne
                          ariaLabel={t('reactor.coeffFor', { symbol: coProductSymbolDisplay(cp) })}
                          symbol={coProductSymbolDisplay(cp)}
                          decLabel={t('reactor.coeffDecrease')}
                          incLabel={t('reactor.coeffIncrease')}
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
                    <CoeffStepper
                      value={productCoeff}
                      min={1}
                      max={COEFF_MAX}
                      highlightError={coeffErr}
                      dimWhenOne
                      ariaLabel={t('reactor.productCoeffAria')}
                      symbol={productCompound?.formulaUnicode ?? t('reactor.productCoeffAria')}
                      decLabel={t('reactor.coeffDecrease')}
                      incLabel={t('reactor.coeffIncrease')}
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
                        <IconCatalog />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {leftTerms.length > 0 ? (
              // Комментарий к последнему ± относится к балансировке: во время синтеза он устарел.
              <ReactorLedgerComment text={synthesisRunning ? '' : atomLedger.comment} balanced={atomLedger.ledger.balanced} />
            ) : null}
            {ambiguousProductMatches.length > 1 ? (
              <p className={panelStyles.ambiguousHint} role="status">
                {t('reactor.ambiguous')}
              </p>
            ) : null}
            {recipeText ? (
              <p className={`${panelStyles.productHint} ${panelStyles.productHintEquation}`} title={recipeText}>
                {t('reactor.recipeLabel', { recipe: recipeText })}
              </p>
            ) : null}
          </div>
        </div>

        {visualTier !== 'full' && leftTerms.length > 0 ? (
          <p className={panelStyles.visualTierBadge} role="status">
            {t(`reactor.visualTier.${visualTier}`)}
          </p>
        ) : null}

        <div
          id={sectionsId}
          className={panelStyles.reactorSections}
          data-section={activeSection ?? undefined}
          hidden={activeSection == null}
        >
          {activeSection === 'hints' ? (
            <div className={panelStyles.sectionPanel}>
              <div className={panelStyles.sectionPanelHead}>
                <span className={panelStyles.sectionPanelTitle}>{labels.hints}</span>
                <button
                  type="button"
                  className={panelStyles.sectionClose}
                  onClick={() => setOpenSection(null)}
                  aria-label={labels.hide}
                  title={labels.hide}
                >
                  <IconX size={14} />
                </button>
              </div>
              <ul className={panelStyles.hintList}>
                <li className={panelStyles.hintBox} role="note">
                  {t('reactor.hintBalance')}
                </li>
                {hasDiatomic ? (
                  <li className={panelStyles.diatomicHint} role="note">
                    {t('reactor.diatomicPreviewHint')}
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          {activeSection === 'steps' && productStrings?.obtainingSteps ? (
            <div className={`${panelStyles.sectionPanel} ${panelStyles.obtainingDetails}`}>
              <div className={panelStyles.sectionPanelHead}>
                <span className={panelStyles.sectionPanelTitle}>{t('reactor.obtainingStepsSummary')}</span>
                <button
                  type="button"
                  className={panelStyles.sectionClose}
                  onClick={() => setOpenSection(null)}
                  aria-label={labels.hide}
                  title={labels.hide}
                >
                  <IconX size={14} />
                </button>
              </div>
              <ol className={panelStyles.obtainingList}>
                {productStrings.obtainingSteps.map((s) => (
                  <li key={s.step}>
                    <code>{s.equation}</code>
                    {s.note ? <span> — {s.note}</span> : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {open ? (
            <ReactorBalancePanel
              leftTerms={leftTerms}
              productCompound={productCompound}
              productCoeff={productCoeff}
              expanded={activeSection === 'balance'}
              onExpandedChange={(v) => setOpenSection(v ? 'balance' : null)}
              onApplyCoeffs={(left, k) => onApplyBalanceCoeffs?.(left, k)}
              onLoadLesson={(lesson) => onLoadBalanceLesson?.(lesson)}
            />
          ) : null}
        </div>
      </div>

      <div className={panelStyles.reactorFooter}>
        {teacherAvailable && teacherVoiceOn && (teacherLineTitle || teacherLineText) ? (
          <div
            className={panelStyles.teacherCaption}
            role="status"
            aria-live="polite"
            data-speaking={teacherSpeaking ? '1' : undefined}
          >
            {teacherLineTitle ? <p className={panelStyles.teacherCaptionTitle}>{teacherLineTitle}</p> : null}
            {teacherLineText ? <p className={panelStyles.teacherCaptionText}>{teacherLineText}</p> : null}
          </div>
        ) : null}

        <div className={panelStyles.footerRow}>
          {hasLabConditions && productCompound ? (
            <div className={panelStyles.labConditions} role="group" aria-label={t('reactor.labConditionsAria')}>
              <div className={panelStyles.labCondHead}>
                <span className={panelStyles.labCondTitle}>{t('reactor.labConditionsTitle')}</span>
                <span
                  className={
                    labReady
                      ? `${panelStyles.labCondProgress} ${panelStyles.labCondProgressReady}`
                      : panelStyles.labCondProgress
                  }
                  aria-hidden
                >
                  {labOnCount}/{labNeedCount}
                </span>
              </div>
              <div className={panelStyles.labCondChips}>
                {labNeeds?.needsHeat ? (
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
                          strokeWidth="1.8"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M9.2 18.2c.7 1.4 2 2.3 3.5 2.3s2.8-.9 3.5-2.3"
                          stroke="currentColor"
                          strokeWidth="1.8"
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
                {labNeeds?.needsPressure ? (
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
                        <circle cx="12" cy="13" r="7.5" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M12 13l3.2-3.2M12 3.5v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </span>
                    <span className={panelStyles.labCondChipText}>
                      <span className={panelStyles.labCondChipLabel}>{t('reactor.labPressure')}</span>
                    </span>
                    <span className={panelStyles.labCondSwitch} aria-hidden data-on={labPressureOn ? '1' : '0'} />
                  </button>
                ) : null}
                {labNeeds?.needsCatalyst ? (
                  <button
                    type="button"
                    className={
                      labCatalystOn
                        ? `${panelStyles.labCondChip} ${panelStyles.labCondChipCatalyst} ${panelStyles.labCondChipOn}`
                        : `${panelStyles.labCondChip} ${panelStyles.labCondChipCatalyst}`
                    }
                    aria-pressed={labCatalystOn}
                    onClick={() => onLabCatalystChange?.(!labCatalystOn)}
                    title={productStrings?.synthesisConditions.catalyst || undefined}
                  >
                    <span className={panelStyles.labCondIcon} aria-hidden>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                        <circle cx="8.5" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.8" />
                        <circle cx="15.5" cy="8.5" r="2.2" stroke="currentColor" strokeWidth="1.8" />
                        <circle cx="15.5" cy="15.5" r="2.2" stroke="currentColor" strokeWidth="1.8" />
                        <path
                          d="M10.4 11.2 13.6 9.2M10.4 12.8l3.2 2"
                          stroke="currentColor"
                          strokeWidth="1.8"
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
                    {labCatalystOn ? <span className={panelStyles.labCondCatalystPulse} aria-hidden /> : null}
                    <span className={panelStyles.labCondSwitch} aria-hidden data-on={labCatalystOn ? '1' : '0'} />
                  </button>
                ) : null}
              </div>
              {labCatalystOn && productStrings?.synthesisConditions.catalyst ? (
                <p className={panelStyles.srOnly} role="status">
                  {t('reactor.labCatalystActive', {
                    name: productStrings.synthesisConditions.catalyst,
                  })}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className={panelStyles.reactorAlerts}>
            {message ? (
              <p className={panelStyles.reactorMsg} data-tone={messageTone} role="status">
                <span className={panelStyles.reactorMsgIcon} aria-hidden>
                  <IconTone tone={messageTone} />
                </span>
                <span className={panelStyles.reactorMsgText}>{message}</span>
              </p>
            ) : null}
            {showLabConditionsHint ? (
              <p className={`${panelStyles.reactorMsg} ${panelStyles.labCondHint}`} data-tone="warning" role="status">
                <span className={panelStyles.reactorMsgIcon} aria-hidden>
                  <IconTone tone="warning" />
                </span>
                <span className={panelStyles.reactorMsgText}>{t('reactor.labConditionsNeeded')}</span>
              </p>
            ) : null}
          </div>

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
          >
            <RunButtonContent synthesisRunning={synthesisRunning} locale={locale} runningText={t('reactor.runRunning')} runText={t('reactor.run')} />
          </button>
        </div>
      </div>
    </div>
    {open && collapsed ? (
      <div className={panelStyles.reactorFabCluster}>
        {teacherAvailable ? (
          <button
            type="button"
            className={`${panelStyles.reactorExplainFab} ${teacherVoiceOn ? panelStyles.reactorExplainFabOn : ''}`}
            onClick={() => onTeacherVoiceToggle?.()}
            aria-pressed={teacherVoiceOn}
            aria-label={teacherVoiceOn ? t('lab.teacher.explainMute') : t('lab.teacher.explainEnable')}
            title={teacherVoiceOn ? t('lab.teacher.explainMute') : t('lab.teacher.explainEnable')}
          >
            <IconVoice />
            {teacherVoiceOn ? t('lab.teacher.explainOn') : t('lab.teacher.explain')}
          </button>
        ) : null}
        <button
          type="button"
          className={panelStyles.reactorReopenFab}
          onClick={() => setCollapsed(false)}
          aria-label={t('reactor.showPanel')}
          title={t('reactor.showPanel')}
        >
          <span className={panelStyles.reactorReopenFabIcon} aria-hidden>
            <IconChevron dir="up" size={18} />
          </span>
          {t('reactor.showPanel')}
        </button>
      </div>
    ) : null}
    </>
  )
}
