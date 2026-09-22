import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  startTransition,
  lazy,
  Suspense,
} from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LabDomainTabs } from '../components/lab/LabDomainTabs'
import { ProductHeroCard } from '../components/lab/hero/ProductHeroCard'
import { isDiatomicNativeElement } from '../chemistry/diatomicElements'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import { REACTOR_COEFF_MAX, REACTOR_EQUATION_MAX_TERMS } from '../chemistry/reactorLimits'
import type { ReactorVisualTier } from '../chemistry/reactorVisualTier'
import { warmupLabSynthesisInfra, warmupLabSynthesisReactorOpen, warmupReactorPreviewTerms } from '../lab/labSynthesisWarmup'
import { useReactorCoeffEditBurst } from '../lab/reactorPreviewEditThrottle'
import { isReactorCoeffEditing } from '../lab/reactorCoeffEditMode'
import { estimatePreviewAtomCountFromTerms } from '../lab/atomlabPerfGuard'
import { useReactorPreviewTermsStable } from '../lab/useReactorPreviewTermsStable'
import { useReactorCanvasTermsHold } from '../lab/useReactorCanvasTermsHold'
import { isReactorBalancedFast } from '../wasm/reactorBalanceWasm'
import { prefetchAtomlabWasm } from '../wasm/atomlabWasmShared'
import {
  getSynthesisWatchdogMs,
  prepareGuaranteedSynthesisRun,
  resolveCatalogProduct,
} from '../lab/synthesisGuarantee'
import { resolveReactorGpuIdleDelayMs } from '../lab/synthesisStabilityEngine'
import { useThrottledPhaseCallback } from '../lab/atomGuard/phaseThrottle'
import { useCanvasSizeGuard } from '../lab/atomGuard/canvasGuard'
import { createSynthesisRunGuard } from '../lab/atomGuard/synthesisRunGuard'
import { useCatalogAutoMatches } from '../lab/useCatalogMatchWorker'
import {
  generateFromLaboratoryRecipe,
  parseReactionLeftSide,
  stripLeftSideCoefficients,
} from '../chemistry/reactionLeftSideParser'
import {
  lessonToLeftTerms,
  type BalanceLesson,
} from '../chemistry/balanceLessonBank'
import { parseLeftSideMessageKey, reactorValidationMessageKey } from '../i18n/chemistryMessageKeys'
import { fromElementsPolicy } from '../chemistry/substanceSynthesisRoute'
import {
  formatScientificRecipeEquation,
  getScientificReactorRecipe,
  hasScientificReactorRecipe,
  isScientificEquationBalanced,
  seedScientificReactorEquation,
  type ReactorCoProductTerm,
  type ScientificReactorRecipe,
} from '../chemistry/scientificReactorRecipes'
import {
  parseReactorLinkParams,
  resolveReactorEquation,
  type ReactorLinkParams,
  type ReactorLinkResult,
} from '../lab/reactorDeepLink'
import { effectiveLabNeeds } from '../lab/reactionLabNeeds'
import { getLabTeacherNarrator, hasLabTeacherScript, readLabTeacherVoiceEnabled } from '../lab/teacher'
import type { Clo2TeacherLine } from '../lab/teacher/clo2TeacherScript'
import { unlockAudioPlayback } from '../learn/learnSpeechPlayback'
import { stopAllAppSpeech } from '../learn/learnSpeechExclusive'
import type { Clo2CueId } from '../lab/cinema/scenes/clo2/storyboard'
import { clo2StepStore } from '../lab/cinema/scenes/clo2/clo2StepStore'
import { CLO2_STEP_IDS } from '../lab/cinema/scenes/clo2/clo2Steps'
import { Clo2MechanismPanel } from '../components/lab/scientific/Clo2MechanismPanel'
import type { ScientificStageInput } from '../components/lab/LabScene'
import { SCIENTIFIC_LESSON_RECHECK_MS } from '../lab/scientificSynthesis/clo2ScenarioTiming'
import { getCompoundLocaleStrings } from '../i18n/compoundLocale'
import { useT } from '../i18n/useT'
import { ElementDetailContent } from '../components/lab/ElementDetailContent'
import { ElementSidePanel } from '../components/lab/ElementSidePanel'
import {
  ReactorCompoundCatalogPanel,
  type ReactorCatalogIntent,
} from '../components/lab/ReactorCompoundCatalogPanel'
import { SynthesisReactorPanel } from '../components/lab/SynthesisReactorPanel'
import { compoundById } from '../data/compounds'
import {
  getSectionAllowedProductIds,
  parseLearnEquationScope,
  type LearnEquationScope,
} from '../data/learnSectionEquations'
import { getElementByZ } from '../data/elements'
import type { CompoundDef, LabParticle, Vec3 } from '../types/chemistry'
import styles from './LaboratoryPage.module.css'
import sidePanelStyles from '../components/lab/ElementSidePanel.module.css'
import mechPanelStyles from '../components/lab/scientific/Clo2MechanismPanel.module.css'

const LabCanvas = lazy(() =>
  import('../components/lab/LabScene').then((m) => ({ default: m.LabCanvas })),
)

function LabCanvasFallback() {
  return <div className={styles.canvasFallback} aria-hidden />
}

function newId(): string {
  return crypto.randomUUID()
}

function preserveReactorMessageOnEquationEdit(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    m.includes('верно! связь') ||
    m.includes('correct! bonding') ||
    m.startsWith('получено:') ||
    m.startsWith('obtained:')
  )
}

/**
 * --lab-reactor-clearance — в ОДНОМ правиле таблицы стилей только для тех, кто его читает
 * (⊞ над доком, компактная таблица, лист урока), а не инлайном на .wrap.
 * Инлайн-свойство на .wrap наследуется всем ~3400 узлам лаборатории: каждая смена высоты
 * реактора стоила полного пересчёта стилей 130–360 мс (замер прод-сборки, 1280×800) — это и был
 * худший кадр после «Завершить». Правило по классам пересчитывает только свои узлы (~4 мс).
 */
let clearanceRule: CSSStyleRule | null = null
function writeReactorClearance(px: number | null): void {
  if (typeof document === 'undefined') return
  if (!clearanceRule) {
    if (px == null) return
    const first = (cls: string | undefined) => (cls ? `.${cls.split(' ')[0]}` : null)
    const sel = [first(styles.panelFabReactorOpen), first(sidePanelStyles.panelOpenCompact), first(mechPanelStyles.panel)]
      .filter(Boolean)
      .join(', ')
    const el = document.createElement('style')
    el.setAttribute('data-lab-reactor-clearance', '')
    el.textContent = `${sel} {}`
    document.head.appendChild(el)
    clearanceRule = (el.sheet?.cssRules[0] as CSSStyleRule | undefined) ?? null
    if (!clearanceRule) return
  }
  if (px == null) clearanceRule.style.removeProperty('--lab-reactor-clearance')
  else clearanceRule.style.setProperty('--lab-reactor-clearance', `${px}px`)
}

/** Урок по шагам идёт (не закончен). */
function readLessonActive(): boolean {
  const s = clo2StepStore.getSnapshot()
  return s.runId > 0 && s.status !== 'done'
}

export function LaboratoryPage() {
  const { locale, t } = useT()
  const [panelOpen, setPanelOpen] = useState(false)
  const [structureZ, setStructureZ] = useState<number | null>(null)
  const [particles, setParticles] = useState<LabParticle[]>([])

  const [reactorOpen, setReactorOpen] = useState(false)
  const [leftTerms, setLeftTerms] = useState<ReactorEquationTerm[]>([])
  const [coProducts, setCoProducts] = useState<ReactorCoProductTerm[]>([])
  const [productCompoundId, setProductCompoundId] = useState<string | null>(null)
  const [productCoeff, setProductCoeff] = useState(1)
  /** Рецепт из ссылки (reaction= / eq=); иначе статическая таблица по productCompoundId. */
  const [equationRecipe, setEquationRecipe] = useState<ScientificReactorRecipe | null>(null)
  /** «← назад к учебнику» из src= ссылки. */
  const [deepLinkBackHref, setDeepLinkBackHref] = useState<string | null>(null)
  /** id реакции банка из ссылки — условия реактора берутся по реакции, а не по продукту. */
  const [linkedBankId, setLinkedBankId] = useState<string | null>(null)
  const [labHeatOn, setLabHeatOn] = useState(false)
  const [labPressureOn, setLabPressureOn] = useState(false)
  const [labCatalystOn, setLabCatalystOn] = useState(false)
  const [reactorCatalogOpen, setReactorCatalogOpen] = useState(false)
  const [reactorCatalogIntent, setReactorCatalogIntent] = useState<ReactorCatalogIntent>('selectProduct')
  const reactorCatalogPickModeRef = useRef<ReactorCatalogIntent>('selectProduct')

  const [runId, setRunId] = useState(0)
  const [synthesisFlightSlots, setSynthesisFlightSlots] = useState<number[] | null>(null)
  const [synthesisFlyTerms, setSynthesisFlyTerms] = useState<ReactorEquationTerm[] | null>(null)
  const lastRunZSlotsRef = useRef<number[]>([])
  const lastRunFlyTermsRef = useRef<ReactorEquationTerm[]>([])
  const [lastRunProduct, setLastRunProduct] = useState<CompoundDef | null>(null)
  const lastRunProductRef = useRef<CompoundDef | null>(null)
  const lastRunProductIdRef = useRef<string | null>(null)
  const synthesisWatchdogMsRef = useRef(4500)
  const synthesisSettledProductRef = useRef<CompoundDef | null>(null)
  const [synthIgnite, setSynthIgnite] = useState(false)
  const [synthPhaseUi, setSynthPhaseUi] = useState('')
  const synthesisPhaseRef = useRef('')
  const synthesisCompletingRef = useRef(false)
  const [prewarmCompound, setPrewarmCompound] = useState<CompoundDef | null>(null)
  const lastRunVisualTierRef = useRef<ReactorVisualTier>('full')
  const synthesisRunGuardRef = useRef(createSynthesisRunGuard())
  const forceLiteFxRef = useRef(false)
  const forceEditHoldRef = useRef<() => void>(() => {})
  const canvasWrapRef = useRef<HTMLDivElement | null>(null)
  const labWrapRef = useRef<HTMLDivElement | null>(null)
  const [labCanvasKey] = useState(0)
  const [reactorSessionKey, setReactorSessionKey] = useState(0)
  useCanvasSizeGuard(canvasWrapRef)

  /** Высота реактора → clamp высоты компактной таблицы над синтезом. */
  useLayoutEffect(() => {
    const wrap = labWrapRef.current
    if (!wrap) return
    if (!reactorOpen) {
      writeReactorClearance(null)
      return
    }

    let lastClearance = Number.NaN
    let resizeTimer = 0
    const syncReactorClearance = () => {
      const reactor = wrap.querySelector<HTMLElement>('[data-lab-reactor]')
      const h = reactor?.getBoundingClientRect().height ?? 0
      if (h < 80) return
      const clearance = Math.round(h + 10)
      if (clearance === lastClearance) return
      lastClearance = clearance
      writeReactorClearance(clearance)
      // Debounce: balance-панель часто меняет высоту — без thrash WebGL.
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        window.dispatchEvent(new Event('resize'))
      }, 80)
    }

    syncReactorClearance()
    const ro = new ResizeObserver(syncReactorClearance)
    ro.observe(wrap)
    // Высота самого дока меняется без ресайза обёртки (разделы, условия, статус).
    const reactorEl = wrap.querySelector<HTMLElement>('[data-lab-reactor]')
    if (reactorEl) ro.observe(reactorEl)
    window.addEventListener('resize', syncReactorClearance)
    return () => {
      ro.disconnect()
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', syncReactorClearance)
      writeReactorClearance(null)
    }
  }, [reactorOpen])

  const [reactorMessage, setReactorMessage] = useState<string | null>(null)
  const [pendingGenEq, setPendingGenEq] = useState(false)
  const [learnEquationScope, setLearnEquationScope] = useState<LearnEquationScope | null>(null)
  const [synthesisSettledProduct, setSynthesisSettledProduct] = useState<CompoundDef | null>(null)
  const [laboratorySynthesisView, setLaboratorySynthesisView] = useState<'reactor' | 'substance'>('reactor')
  const [reactorGpuIdleReady, setReactorGpuIdleReady] = useState(false)
  const productLockedRef = useRef(false)
  const periodicUiHidden = reactorCatalogOpen && reactorCatalogIntent === 'generateEquation'

  const catalogList = useMemo(() => Object.values(compoundById), [])

  useEffect(() => {
    warmupLabSynthesisInfra(catalogList)
    prefetchAtomlabWasm()
    void import('../components/lab/LabScene')
  }, [catalogList])

  useEffect(() => {
    if (!reactorOpen) {
      setReactorGpuIdleReady(false)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      if (!cancelled) setReactorGpuIdleReady(true)
    }, resolveReactorGpuIdleDelayMs())
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      setReactorGpuIdleReady(false)
    }
  }, [reactorOpen])

  const learnAllowedProductIds = useMemo(() => {
    if (!learnEquationScope) return undefined
    return getSectionAllowedProductIds(
      learnEquationScope.gradeId,
      learnEquationScope.chapterId,
      learnEquationScope.sectionId,
    )
  }, [learnEquationScope])

  const productCompound = useMemo(
    () => (productCompoundId ? (compoundById[productCompoundId] ?? null) : null),
    [productCompoundId],
  )

  const deferredLeftTerms = useDeferredValue(leftTerms)
  const catalogAutoMatches = useCatalogAutoMatches(deferredLeftTerms, catalogList)
  const ambiguousProductMatches = catalogAutoMatches.length > 1 ? catalogAutoMatches : []

  useLayoutEffect(() => {
    synthesisSettledProductRef.current = synthesisSettledProduct
  }, [synthesisSettledProduct])

  /** Подставляет реагенты из эталона с коэффициентом 1 — балансировку делает ученик. */
  const applyGenerateEquationReagents = useCallback(
    (c: CompoundDef) => {
      const sci = seedScientificReactorEquation(c.id, newId, { withTargetCoeffs: true })
      if (sci) {
        setLeftTerms(sci.leftTerms)
        setCoProducts(sci.coProducts)
        setProductCoeff(sci.productCoeff)
        setSynthesisSettledProduct(null)
        synthesisSettledProductRef.current = null
        settledSnapshotRef.current = null
        const recipe = getScientificReactorRecipe(c.id)
        setReactorMessage(
          recipe
            ? t('lab.deepLink.scientificRoute', {
                title: recipe.titleRu,
                equation: formatScientificRecipeEquation(recipe, compoundById),
              })
            : null,
        )
        warmupLabSynthesisReactorOpen(catalogList, c)
        return
      }
      setCoProducts([])
      setProductCoeff(1)
      if (fromElementsPolicy(c.id) === 'forbidden') {
        setLeftTerms([])
        setReactorMessage(t('errors.reactor.SCHOOL_ROUTE_ONLY', { formula: c.formulaUnicode }))
        return
      }
      const g = generateFromLaboratoryRecipe(c)
      const trimmed = stripLeftSideCoefficients(g.manualLeft.trim())
      if (!trimmed) {
        setLeftTerms([])
        setReactorMessage(t('lab.catalogNoLeft'))
        return
      }
      const r = parseReactionLeftSide(trimmed, newId)
      if (!r.ok) {
        setLeftTerms([])
        setReactorMessage(t(parseLeftSideMessageKey(r.code), r.params))
        return
      }
      setLeftTerms(r.terms)
      warmupReactorPreviewTerms(r.terms)
      warmupLabSynthesisReactorOpen(catalogList, c, r.terms)
      setSynthesisSettledProduct(null)
      synthesisSettledProductRef.current = null
      settledSnapshotRef.current = null
      setReactorMessage(
        g.warn === 'noEquals'
          ? t('lab.recipeWarn.noEquals')
          : g.warn === 'rhsMismatch'
            ? t('lab.recipeWarn.rhsMismatch')
            : null,
      )
    },
    [t, catalogList],
  )

  const applyScientificProductEquation = useCallback(
    (c: CompoundDef) => {
      const sci = seedScientificReactorEquation(c.id, newId, { withTargetCoeffs: true })
      if (!sci) {
        setCoProducts([])
        return false
      }
      setLeftTerms(sci.leftTerms)
      setCoProducts(sci.coProducts)
      setProductCoeff(sci.productCoeff)
      setSynthesisSettledProduct(null)
      synthesisSettledProductRef.current = null
      settledSnapshotRef.current = null
      const recipe = getScientificReactorRecipe(c.id)
      setReactorMessage(
        recipe
          ? t('lab.deepLink.scientificRoute', {
              title: recipe.titleRu,
              equation: formatScientificRecipeEquation(recipe, compoundById),
            })
          : null,
      )
      warmupLabSynthesisReactorOpen(catalogList, c)
      return true
    },
    [catalogList, t],
  )

  /** Дешёвая сигнатура уравнения (без JSON.stringify на каждый keystroke). */
  const equationSignature = useMemo(() => {
    const terms = leftTerms
      .map(
        (term) =>
          `${term.id}:${term.z}:${term.coeff}:${term.diatomic ? 1 : 0}:${term.compoundId ?? ''}`,
      )
      .join('|')
    const right = coProducts
      .map((c) => `${c.id}:${c.compoundId ?? `z${c.z}${c.diatomic ? 'd' : ''}`}:${c.coeff}`)
      .join('|')
    return `${terms}#${right}#${productCompoundId ?? ''}#${productCoeff}`
  }, [leftTerms, coProducts, productCompoundId, productCoeff])
  const settledSnapshotRef = useRef<string | null>(null)

  /** Sync clear settled при смене уравнения — сразу pin Bohr, без кадра «пусто». */
  useLayoutEffect(() => {
    if (synthesisSettledProduct == null) return
    if (settledSnapshotRef.current == null) {
      settledSnapshotRef.current = equationSignature
      return
    }
    if (settledSnapshotRef.current !== equationSignature) {
      settledSnapshotRef.current = null
      // Pin ДО clear settled — иначе ≥1 кадр без product и без editing → пустой центр.
      forceEditHoldRef.current()
      setSynthesisSettledProduct(null)
      synthesisSettledProductRef.current = null
      setLaboratorySynthesisView('reactor')
      setSynthPhaseUi('')
    }
  }, [equationSignature, synthesisSettledProduct])

  /** Рецепт реактора: из ссылки (reaction= / eq=) или статический (ClO₂). */
  const activeRecipe = useMemo(
    () =>
      equationRecipe && equationRecipe.productId === productCompoundId
        ? equationRecipe
        : getScientificReactorRecipe(productCompoundId),
    [equationRecipe, productCompoundId],
  )

  const equationBalanced = useMemo(() => {
    if (activeRecipe) {
      return isScientificEquationBalanced(
        deferredLeftTerms,
        coProducts,
        productCompound ?? undefined,
        productCoeff,
        compoundById,
        activeRecipe,
      )
    }
    return isReactorBalancedFast(deferredLeftTerms, productCompound ?? undefined, productCoeff)
  }, [activeRecipe, deferredLeftTerms, coProducts, productCompound, productCoeff])

  const resetEquation = useCallback(() => {
    setLeftTerms([])
    setCoProducts([])
    setProductCompoundId(null)
    setProductCoeff(1)
  }, [])

  const addAtom = useCallback((z: number) => {
    const el = getElementByZ(z)
    if (!el) return
    const id = newId()
    const jitter = () => (Math.random() - 0.5) * 0.35
    setParticles((prev) => [
      ...prev,
      {
        id,
        type: 'atom',
        z: el.z,
        symbol: el.symbol,
        color: '#' + el.cpkHex,
        position: [2.0 + jitter(), 0.45 + Math.random() * 0.25, jitter()] as Vec3,
      },
    ])
  }, [])

  const onParticleMove = useCallback((id: string, pos: Vec3) => {
    setParticles((prev) => prev.map((p) => (p.id === id ? { ...p, position: pos } : p)))
  }, [])

  const onPickInTable = useCallback(
    (z: number) => {
      if (reactorOpen) {
        if (!getElementByZ(z)) return
        setSynthesisSettledProduct(null)
        synthesisSettledProductRef.current = null
        settledSnapshotRef.current = null
        setSynthPhaseUi('')
        forceEditHoldRef.current()
        setLeftTerms((prev) => {
          const di = isDiatomicNativeElement(z)
          const matchIndex = prev.findIndex((term) => term.z === z && Boolean(term.diatomic) === di)
          if (matchIndex >= 0) {
            const term = prev[matchIndex]!
            const nextCoeff = term.coeff + 1
            if (nextCoeff > REACTOR_COEFF_MAX) return prev
            return prev.map((x, i) => (i === matchIndex ? { ...x, coeff: nextCoeff } : x))
          }
          if (prev.length >= REACTOR_EQUATION_MAX_TERMS) return prev
          return [...prev, { id: newId(), z, coeff: 1, ...(di ? { diatomic: true as const } : {}) }]
        })
        // В режиме синтеза оставляем таблицу открытой для быстрого набора.
        return
      }
      if (!getElementByZ(z)) return
      // Тап по атому → модель на сцене, таблица сворачивается.
      setPanelOpen(false)
      startTransition(() => setStructureZ(z))
    },
    [reactorOpen],
  )

  const onAltPickInTable = useCallback(
    (z: number) => {
      addAtom(z)
      if (!reactorOpen) setPanelOpen(false)
    },
    [addAtom, reactorOpen],
  )

  const onRemoveTerm = useCallback((id: string) => {
    setSynthesisSettledProduct(null)
    synthesisSettledProductRef.current = null
    settledSnapshotRef.current = null
    setSynthPhaseUi('')
    forceEditHoldRef.current()
    setLeftTerms((prev) => prev.filter((term) => term.id !== id || term.locked))
  }, [])

  const onCoeffChange = useCallback((id: string, coeff: number) => {
    const c = Math.max(1, Math.min(REACTOR_COEFF_MAX, Math.floor(Number.isFinite(coeff) ? coeff : 1)))
    // Pin Bohr до commit: без forceEditHold первый кадр +/- мигал (visualHold только в layout).
    setSynthesisSettledProduct(null)
    synthesisSettledProductRef.current = null
    settledSnapshotRef.current = null
    setSynthPhaseUi('')
    forceEditHoldRef.current()
    setLeftTerms((prev) => prev.map((term) => (term.id === id ? { ...term, coeff: c } : term)))
  }, [])

  const onCoProductCoeffChange = useCallback((id: string, coeff: number) => {
    const c = Math.max(1, Math.min(REACTOR_COEFF_MAX, Math.floor(Number.isFinite(coeff) ? coeff : 1)))
    setSynthesisSettledProduct(null)
    synthesisSettledProductRef.current = null
    settledSnapshotRef.current = null
    setSynthPhaseUi('')
    forceEditHoldRef.current()
    setCoProducts((prev) => prev.map((term) => (term.id === id ? { ...term, coeff: c } : term)))
  }, [])

  const onApplyBalanceCoeffs = useCallback((left: Record<string, number>, nextProductCoeff: number) => {
    setSynthesisSettledProduct(null)
    synthesisSettledProductRef.current = null
    settledSnapshotRef.current = null
    setSynthPhaseUi('')
    forceEditHoldRef.current()
    setLeftTerms((prev) =>
      prev.map((term) => {
        const n = left[term.id]
        if (n == null) return term
        return {
          ...term,
          coeff: Math.max(1, Math.min(REACTOR_COEFF_MAX, Math.floor(n))),
        }
      }),
    )
    setProductCoeff(Math.max(1, Math.min(REACTOR_COEFF_MAX, Math.floor(nextProductCoeff))))
  }, [])

  const onLoadBalanceLesson = useCallback((lesson: BalanceLesson) => {
    setSynthesisSettledProduct(null)
    synthesisSettledProductRef.current = null
    settledSnapshotRef.current = null
    setSynthPhaseUi('')
    forceEditHoldRef.current()
    setReactorMessage(null)
    setEquationRecipe(null)
    setReactorOpen(true)
    if (lesson.kind === 'practice_only') {
      setReactorMessage(
        locale === 'en'
          ? `Practice: ${lesson.displayEquationRu ?? lesson.titleEn} — Zn⁰ → Zn²⁺ + 2e⁻; Cu²⁺ + 2e⁻ → Cu⁰. Coefficients are already 1.`
          : `Урок: ${lesson.displayEquationRu ?? lesson.titleRu}. Электронный баланс: Zn⁰ − 2e⁻; Cu²⁺ + 2e⁻. Коэффициенты уже 1.`,
      )
      setLeftTerms([{ id: 'practice-zn', z: 30, coeff: 1 }])
      setProductCompoundId('salt_zn_so4')
      setProductCoeff(1)
      return
    }
    setLeftTerms(lessonToLeftTerms(lesson))
    if (lesson.productId) setProductCompoundId(lesson.productId)
    setProductCoeff(1)
  }, [locale])

  const openReactorCatalog = useCallback((intent: ReactorCatalogIntent) => {
    reactorCatalogPickModeRef.current = intent
    setReactorCatalogIntent(intent)
    setReactorCatalogOpen(true)
  }, [])

  useEffect(() => {
    if (!pendingGenEq || !reactorOpen) return
    openReactorCatalog('generateEquation')
    setPendingGenEq(false)
  }, [pendingGenEq, reactorOpen, openReactorCatalog])

  const handleReactorCatalogPick = useCallback(
    (id: string) => {
      setReactorCatalogOpen(false)
      const mode = reactorCatalogPickModeRef.current
      reactorCatalogPickModeRef.current = 'selectProduct'
      setReactorCatalogIntent('selectProduct')

      const c = compoundById[id]
      if (!c) return

      productLockedRef.current = true
      setEquationRecipe(null)
      setProductCompoundId(id)
      setProductCoeff(1)

      warmupLabSynthesisReactorOpen(catalogList, c)

      if (applyScientificProductEquation(c)) {
        return
      }

      if (mode === 'generateEquation') {
        applyGenerateEquationReagents(c)
      } else {
        setCoProducts([])
      }
    },
    [applyGenerateEquationReagents, applyScientificProductEquation, catalogList],
  )

  const clearReactorSlots = useCallback(() => {
    // Сброс посреди урока: сцена и панель исчезнут, а голос учителя иначе договорит без кнопки «тише».
    getLabTeacherNarrator().stop()
    resetEquation()
    setEquationRecipe(null)
    setReactorMessage(null)
    setSynthesisSettledProduct(null)
    settledSnapshotRef.current = null
    synthesisSettledProductRef.current = null
    setSynthesisFlightSlots(null)
    setSynthesisFlyTerms(null)
    setRunId(0)
    lastRunZSlotsRef.current = []
    lastRunProductIdRef.current = null
    lastRunProductRef.current = null
    setLaboratorySynthesisView('reactor')
    productLockedRef.current = false
    setLearnEquationScope(null)
    reactorCatalogPickModeRef.current = 'selectProduct'
    setReactorCatalogIntent('selectProduct')
    setReactorCatalogOpen(false)
  }, [resetEquation])

  const toggleReactor = useCallback(() => {
    setReactorOpen((o) => {
      const next = !o
      if (!next) {
        resetEquation()
        setEquationRecipe(null)
        setDeepLinkBackHref(null)
        setReactorSessionKey((k) => k + 1)
        setRunId(0)
        lastRunZSlotsRef.current = []
        setSynthesisFlightSlots(null)
        setSynthesisFlyTerms(null)
        setReactorMessage(null)
        setLastRunProduct(null)
        lastRunProductRef.current = null
        lastRunProductIdRef.current = null
        setSynthesisSettledProduct(null)
        synthesisSettledProductRef.current = null
        settledSnapshotRef.current = null
        setLaboratorySynthesisView('reactor')
        setReactorCatalogOpen(false)
        productLockedRef.current = false
        reactorCatalogPickModeRef.current = 'selectProduct'
        setReactorCatalogIntent('selectProduct')
      } else {
        setStructureZ(null)
        setReactorMessage(t('lab.reactorOpenHint'))
        warmupLabSynthesisReactorOpen(catalogList, productCompound)
      }
      return next
    })
  }, [resetEquation, t, catalogList, productCompound])

  /**
   * Ссылки в лабораторию: «#/?reactor=1&reaction=<id>», «&eq=<уравнение>», «&product=<id>», «&genEq=1».
   * Читаем при каждой навигации (вторая ссылка без перезагрузки тоже применяется).
   * Старые ссылки «#/#/?…» роутер кладёт в location.hash — запрос берём из window.location.hash.
   */
  const location = useLocation()
  const appliedLinkKeyRef = useRef<string | null>(null)

  /** Сброс реактора и уравнение из ссылки; сообщение — в том же коммите, чтобы его не стёр наблюдатель правок. */
  const applyReactorLink = useCallback(
    (res: ReactorLinkResult, link: ReactorLinkParams) => {
      clearReactorSlots()
      setReactorOpen(true)
      setStructureZ(null)
      setPanelOpen(false)
      setDeepLinkBackHref(link.backHref)
      setLinkedBankId(res.ok ? res.bankId : null)
      if (!res.ok) {
        const reason = t(`lab.deepLink.unsupported.${res.code}`, {
          formulas: res.details.formulas?.join(', ') ?? '',
          details: res.details.imbalance?.join('; ') ?? res.details.reason ?? '',
        })
        setReactorMessage(res.equationUnicode ? `${res.equationUnicode} — ${reason}` : reason)
        return
      }
      setEquationRecipe(res.recipe ?? null)
      setLeftTerms(res.leftTerms)
      setCoProducts(res.coProducts)
      setProductCompoundId(res.productCompoundId)
      setProductCoeff(res.productCoeff)
      const loaded = link.balanceSelf
        ? t('lab.deepLink.loadedBalance', { title: res.titleRu })
        : t('lab.deepLink.loaded', { title: res.titleRu, equation: res.equationUnicode })
      const conditions = res.conditions ? ` ${t('lab.deepLink.conditions', { conditions: res.conditions })}` : ''
      setReactorMessage(`${loaded}${conditions}`)
      const compound = compoundById[res.productCompoundId]
      if (compound) {
        if (!res.recipe) warmupReactorPreviewTerms(res.leftTerms)
        warmupLabSynthesisReactorOpen(catalogList, compound, res.recipe ? undefined : res.leftTerms)
      }
    },
    [clearReactorSlots, t, catalogList],
  )

  useEffect(() => {
    let query = location.search
    if (!query || query === '?') {
      const hash = window.location.hash
      const qIdx = hash.indexOf('?')
      query = qIdx >= 0 ? hash.slice(qIdx) : ''
    }
    // Ключ навигации: смена языка (новый t) не применяет ссылку повторно.
    const linkKey = `${location.key}|${query}`
    if (appliedLinkKeyRef.current === linkKey) return
    appliedLinkKeyRef.current = linkKey
    if (!query || query === '?') return
    const params = new URLSearchParams(query.slice(1))
    const reactorLink = parseReactorLinkParams(params)
    if (reactorLink) {
      applyReactorLink(
        resolveReactorEquation(reactorLink.spec, { newId, balanceSelf: reactorLink.balanceSelf }),
        reactorLink,
      )
      return
    }
    const product = params.get('product')
    const opensReactor = params.get('reactor') === '1'
    const genEq = params.get('genEq') === '1'
    if (!opensReactor && !genEq && !product) return
    // Новая ссылка заменяет прежнее уравнение (в т. ч. рецепт из reaction= / eq=).
    clearReactorSlots()
    setDeepLinkBackHref(null)
    if (opensReactor) {
      setReactorOpen(true)
      setStructureZ(null)
      setPanelOpen(false)
    }
    if (genEq) {
      setPendingGenEq(true)
    }
    const scope = parseLearnEquationScope(params)
    if (scope) {
      setLearnEquationScope(scope)
    }
    if (product && compoundById[product]) {
      let productId = product
      if (scope) {
        const allowed = getSectionAllowedProductIds(scope.gradeId, scope.chapterId, scope.sectionId)
        if (allowed.length > 0 && !allowed.includes(product)) {
          productId = allowed[0]!
        }
      }
      productLockedRef.current = true
      setProductCompoundId(productId)
      const c = compoundById[productId]
      if (c && hasScientificReactorRecipe(productId)) {
        // отложенный сид после mount — через microtask, чтобы state product уже стоял
        queueMicrotask(() => {
          const sci = seedScientificReactorEquation(productId, newId, { withTargetCoeffs: true })
          if (!sci) return
          setLeftTerms(sci.leftTerms)
          setCoProducts(sci.coProducts)
          setProductCoeff(sci.productCoeff)
        })
      } else if (c && !genEq) {
        // Рецепта нет и реакции в банке нет (иначе ссылку увёл бы parseReactorLinkParams):
        // сеем левую часть из лабораторного маршрута каталога. Если маршрут школьный
        // (не из элементов) или его нет — applyGenerateEquationReagents скажет об этом
        // текстом, а не оставит серую кнопку молча.
        queueMicrotask(() => applyGenerateEquationReagents(c))
      }
    }
  }, [
    location.key,
    location.search,
    location.hash,
    applyReactorLink,
    applyGenerateEquationReagents,
    clearReactorSlots,
  ])

  const completeSynthesisSuccess = useCallback(
    (compound: CompoundDef, runIdForGuard: number) => {
      const guard = synthesisRunGuardRef.current
      guard.tryCompleteSuccess(runIdForGuard, () => {
        synthesisCompletingRef.current = true
        const name = getCompoundLocaleStrings(compound, locale, t).name
        synthesisSettledProductRef.current = compound
        settledSnapshotRef.current = equationSignature
        lastRunZSlotsRef.current = []
        // Переход «сцена → герой» — переходом React: рендер страницы режется на куски по ~5 мс,
        // а не одним кадром 100+ мс после «Завершить». Сцена к этому моменту уже погасла (хвост),
        // поэтому отложенный на несколько кадров коммит не даёт пустого кадра.
        startTransition(() => {
          setReactorMessage(t('reactor.successProduct', { name, formula: compound.formulaUnicode }))
          setSynthesisSettledProduct(compound)
          setRunId(0)
          setLaboratorySynthesisView('substance')
          setSynthesisFlightSlots(null)
          setSynthesisFlyTerms(null)
          setSynthPhaseUi('settled')
        })
      })
    },
    [t, locale, equationSignature],
  )


  const onReactorAnimDone = useCallback(
    (kind: 'success' | 'fail') => {
      const activeRun = runId
      const guard = synthesisRunGuardRef.current
      guard.tryOnDone(activeRun, () => {
        if (kind === 'success') {
          const c =
            lastRunProductRef.current ??
            resolveCatalogProduct(compoundById, lastRunProductIdRef.current)
          if (c) {
            completeSynthesisSuccess(c, activeRun)
            return
          }
        } else {
          setReactorMessage(t('lab.synthesisFail'))
        }
        lastRunZSlotsRef.current = []
        setSynthesisFlightSlots(null)
        setSynthesisFlyTerms(null)
        setRunId(0)
        synthesisCompletingRef.current = false
        guard.reset()
      })
    },
    [completeSynthesisSuccess, t, runId],
  )

  const onSynthesisStageChange = useCallback((stage: 'reactor' | 'substance') => {
    setLaboratorySynthesisView(stage)
  }, [])

  const onSynthesisPhaseChangeRaw = useCallback((_phase: string, _progress: number) => {
    synthesisPhaseRef.current = _phase
    if (_phase === 'ignite') setSynthIgnite(true)
    if (_phase === 'converge' || _phase === 'mergeFlash') setSynthIgnite(false)
    if (
      _phase === 'mergeFlash' ||
      _phase === 'product' ||
      _phase === 'ignite' ||
      _phase === 'converge'
    ) {
      setSynthPhaseUi(_phase)
    }
  }, [])
  const onSynthesisPhaseChange = useThrottledPhaseCallback(onSynthesisPhaseChangeRaw, 80)

  const [coeffUiFocused, setCoeffUiFocused] = useState(false)

  const reactorPreviewTerms = useMemo(() => {
    if (!reactorOpen) return null
    return leftTerms.length >= 1 ? leftTerms : null
  }, [reactorOpen, leftTerms])

  const { coeffEditBurst, coeffEditPulse, editIdle, visualHold, resetEditBurst, forceEditHold } =
    useReactorCoeffEditBurst(reactorPreviewTerms)
  forceEditHoldRef.current = forceEditHold

  const reactorCoeffEditing =
    isReactorCoeffEditing(coeffEditBurst, editIdle, visualHold) ||
    coeffEditPulse ||
    coeffUiFocused

  /** Canvas: тот же commit, что и UI — без 32ms lag (два layout → мигание). */
  const canvasLeftTerms = useMemo(
    () => (activeRecipe ? [] : leftTerms),
    [leftTerms, activeRecipe],
  )
  const heldCanvasTerms = useReactorCanvasTermsHold(reactorOpen, canvasLeftTerms, false, 0)
  const reactorPreviewTermsCanvas = useReactorPreviewTermsStable(
    reactorOpen,
    heldCanvasTerms,
    heldCanvasTerms,
    coeffEditBurst,
  )

  useEffect(() => {
    if (coeffEditBurst) forceLiteFxRef.current = true
  }, [coeffEditBurst])

  const onRequestRun = useCallback(() => {
    const prepared = prepareGuaranteedSynthesisRun({
      leftTerms,
      productId: productCompoundId,
      productCoeff,
      compoundById,
      coProducts,
      recipe: activeRecipe,
    })
    if (!prepared.ok) {
      setReactorMessage(t(reactorValidationMessageKey(prepared.code), prepared.params))
      return
    }

    const { payload } = prepared
    resetEditBurst()
    setLaboratorySynthesisView('reactor')
    synthesisCompletingRef.current = false
    const previewAtoms = estimatePreviewAtomCountFromTerms(leftTerms)
    if (previewAtoms <= 8) {
      forceLiteFxRef.current = false
    }
    synthesisRunGuardRef.current.reset()
    setSynthesisSettledProduct(null)
    synthesisSettledProductRef.current = null
    settledSnapshotRef.current = null
    synthesisPhaseRef.current = 'ignite'
    setSynthPhaseUi('ignite')
    setSynthIgnite(false)
    const zCopy = payload.zSlots.slice()
    const flyCopy = [...payload.flyTerms]
    lastRunZSlotsRef.current = zCopy
    lastRunFlyTermsRef.current = flyCopy
    lastRunProductIdRef.current = payload.productId
    lastRunProductRef.current = payload.compound
    lastRunVisualTierRef.current = payload.visualTier
    synthesisWatchdogMsRef.current = getSynthesisWatchdogMs(
      payload.flyTerms,
      payload.zSlots,
      payload.productId,
    )
    const nextRunId = runId + 1
    synthesisRunGuardRef.current.beginRun(nextRunId)
    const name = getCompoundLocaleStrings(payload.compound, locale, t).name
    setReactorMessage(t('reactor.successRunning', { name }))

    setLastRunProduct(payload.compound)
    setPrewarmCompound(payload.compound)
    warmupLabSynthesisReactorOpen(catalogList, payload.compound, leftTerms)
    setSynthesisFlightSlots(zCopy)
    setSynthesisFlyTerms(flyCopy)

    if (hasLabTeacherScript(payload.productId) && readLabTeacherVoiceEnabled()) {
      const narrator = getLabTeacherNarrator()
      narrator.setLocale(locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru')
      stopAllAppSpeech()
      narrator.prime()
      void unlockAudioPlayback()
      // Урок ClO₂ по шагам: реплики запускает панель шагов (speakStep), интро не нужно —
      // первый шаг стартует сразу и перебил бы его.
      narrator.beginRun()
    } else {
      getLabTeacherNarrator().stop()
    }

    setRunId(nextRunId)
  }, [leftTerms, coProducts, productCompoundId, productCoeff, activeRecipe, t, locale, runId, resetEditBurst, catalogList])

  const onLabNarrationCue = useCallback((id: string) => {
    if (!readLabTeacherVoiceEnabled()) return
    if (!hasLabTeacherScript(lastRunProductIdRef.current ?? productCompoundId)) return
    const narrator = getLabTeacherNarrator()
    narrator.speakCue(id as Clo2CueId)
  }, [productCompoundId])

  const labSynthesis = useMemo(() => {
    if (!reactorOpen || runId <= 0) return null
    const zSlots = synthesisFlightSlots ?? lastRunZSlotsRef.current
    const flyTerms = synthesisFlyTerms ?? lastRunFlyTermsRef.current
    if (!zSlots || zSlots.length < 2 || !flyTerms || flyTerms.length < 1) return null
    const product =
      lastRunProductRef.current ??
      resolveCatalogProduct(compoundById, lastRunProductIdRef.current) ??
      lastRunProduct
    if (!product) return null
    return {
      runId,
      zSlots,
      flyTerms,
      product,
      visualTier: lastRunVisualTierRef.current,
      onDone: onReactorAnimDone,
      onSynthesisStageChange,
      onPhaseChange: onSynthesisPhaseChange,
    }
  }, [
    reactorOpen,
    runId,
    synthesisFlightSlots,
    synthesisFlyTerms,
    lastRunProduct,
    onReactorAnimDone,
    onSynthesisStageChange,
    onSynthesisPhaseChange,
  ])

  useEffect(() => {
    if (!reactorOpen || runId <= 0) return
    const productId = lastRunProductIdRef.current
    const activeRun = runId
    let timer = 0
    const guard = () => {
      if (synthesisSettledProductRef.current != null) return
      if (synthesisCompletingRef.current) return
      // Урок ClO₂ по шагам ждёт ученика: пока сцена на связи, гарантия не вмешивается.
      const lesson = clo2StepStore.getSnapshot()
      if (lesson.runId === activeRun && lesson.status !== 'done') {
        timer = window.setTimeout(guard, SCIENTIFIC_LESSON_RECHECK_MS)
        return
      }
      const compound =
        lastRunProductRef.current ?? resolveCatalogProduct(compoundById, productId)
      if (compound) {
        completeSynthesisSuccess(compound, activeRun)
      }
    }
    timer = window.setTimeout(guard, synthesisWatchdogMsRef.current)
    return () => window.clearTimeout(timer)
  }, [reactorOpen, runId, completeSynthesisSuccess])

  /** Научный маршрут: до запуска поле реактора показывает реагенты и продукты молекулами. */
  const scientificStage = useMemo<ScientificStageInput | null>(() => {
    if (!reactorOpen || !productCompoundId || !activeRecipe) return null
    const product = compoundById[productCompoundId]
    if (!product) return null
    return {
      leftTerms: deferredLeftTerms,
      coProducts,
      productId: product.id,
      productCoeff,
      balanced: isScientificEquationBalanced(
        deferredLeftTerms,
        coProducts,
        product,
        productCoeff,
        compoundById,
        activeRecipe,
      ),
      labels: { balanced: t('lab.stage.balanced'), unbalanced: t('lab.stage.unbalanced') },
    }
  }, [reactorOpen, productCompoundId, activeRecipe, deferredLeftTerms, coProducts, productCoeff, t])

  const canRunSynthesis = useMemo(() => {
    const product = productCompoundId ? compoundById[productCompoundId] : undefined
    if (!product) return false
    if (activeRecipe) {
      if (
        !isScientificEquationBalanced(
          deferredLeftTerms,
          coProducts,
          product,
          productCoeff,
          compoundById,
          activeRecipe,
        )
      ) {
        return false
      }
    } else if (!isReactorBalancedFast(deferredLeftTerms, product, productCoeff)) {
      return false
    }
    const lab = effectiveLabNeeds(product.synthesisLab, product.id, linkedBankId)
    if (lab?.needsHeat && !labHeatOn) return false
    if (lab?.needsPressure && !labPressureOn) return false
    if (lab?.needsCatalyst && !labCatalystOn) return false
    return true
  }, [
    activeRecipe,
    deferredLeftTerms,
    coProducts,
    productCompoundId,
    productCoeff,
    labHeatOn,
    labPressureOn,
    labCatalystOn,
    linkedBankId,
  ])

  useEffect(() => {
    setLabHeatOn(false)
    setLabPressureOn(false)
    setLabCatalystOn(false)
  }, [productCompoundId])

  useEffect(() => {
    // Не ставим prewarm при «уравнено» — только hover/focus кнопки Run.
    if (!reactorOpen) setPrewarmCompound(null)
  }, [reactorOpen])

  const highlightEquationError = useMemo(() => {
    if (!reactorMessage) return false
    const m = reactorMessage.toLowerCase()
    return (
      m.includes('баланс') ||
      m.includes('mass balance') ||
      m.includes('коэффициент') ||
      m.includes('coefficient') ||
      m.includes('целым числом') ||
      m.includes('integer') ||
      m.includes('не совпадает') ||
      m.includes('do not match')
    )
  }, [reactorMessage])

  /**
   * Правка уравнения стирает старое сообщение. Но если сообщение пришло в том же
   * коммите, что и правка (выбор вещества в каталоге → SCHOOL_ROUTE_ONLY / нет левой
   * части, загрузка урока), это объяснение к новому уравнению — его не трогаем.
   */
  const equationEditSnapshotRef = useRef({ leftTerms, productCompoundId, productCoeff, reactorMessage })
  useEffect(() => {
    const prevSnap = equationEditSnapshotRef.current
    equationEditSnapshotRef.current = { leftTerms, productCompoundId, productCoeff, reactorMessage }
    const leftTermsChanged =
      prevSnap.leftTerms !== leftTerms && (prevSnap.leftTerms.length > 0 || leftTerms.length > 0)
    const equationChanged =
      leftTermsChanged ||
      prevSnap.productCompoundId !== productCompoundId ||
      prevSnap.productCoeff !== productCoeff
    if (!equationChanged) return
    if (reactorMessage && reactorMessage !== prevSnap.reactorMessage) return
    queueMicrotask(() => {
      setReactorMessage((prev) => {
        if (!prev) return prev
        if (preserveReactorMessageOnEquationEdit(prev)) return prev
        return null
      })
    })
  }, [leftTerms, productCompoundId, productCoeff, reactorMessage])

  const synthRunActive = reactorOpen && runId > 0
  const labTeacherActive =
    reactorOpen && hasLabTeacherScript(lastRunProductIdRef.current ?? productCompoundId)
  const [teacherVoiceOn, setTeacherVoiceOn] = useState(() => readLabTeacherVoiceEnabled())
  const [teacherSpeaking, setTeacherSpeaking] = useState(false)
  const [teacherLine, setTeacherLine] = useState<Clo2TeacherLine | null>(null)

  useEffect(() => {
    if (!reactorOpen) {
      getLabTeacherNarrator().stop()
      setTeacherSpeaking(false)
      setTeacherLine(null)
    }
  }, [reactorOpen])

  /** Прогрев TTS только если объяснение уже включено. */
  useEffect(() => {
    if (!hasLabTeacherScript(productCompoundId)) return
    if (!readLabTeacherVoiceEnabled()) return
    const narrator = getLabTeacherNarrator()
    narrator.setLocale(locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru')
    narrator.prime()
    narrator.warmPrefetch()
  }, [productCompoundId, locale, teacherVoiceOn])

  useEffect(() => {
    if (!labTeacherActive) {
      setTeacherSpeaking(false)
      setTeacherLine(null)
      return
    }
    const narrator = getLabTeacherNarrator()
    setTeacherVoiceOn(narrator.isVoiceEnabled())
    const offSpeak = narrator.subscribeSpeaking(setTeacherSpeaking)
    const offLine = narrator.subscribe(setTeacherLine)
    return () => {
      offSpeak()
      offLine()
    }
  }, [labTeacherActive])

  const onTeacherVoiceToggle = useCallback(() => {
    const narrator = getLabTeacherNarrator()
    narrator.prime()
    const next = narrator.toggleVoice()
    setTeacherVoiceOn(next)
    if (next) {
      narrator.setLocale(locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru')
      void unlockAudioPlayback()
      narrator.warmPrefetch()
      const lesson = clo2StepStore.getSnapshot()
      // Сценарий озвучки есть только у урока ClO₂; NaCl идёт без преподавателя.
      if (runId > 0 && lesson.runId === runId && lesson.lesson === 'clo2') {
        narrator.speakStep(CLO2_STEP_IDS[lesson.step] ?? 'reagents')
      }
    } else {
      setTeacherLine(null)
    }
  }, [locale, runId])

  const onTeacherReplay = useCallback(() => {
    if (!readLabTeacherVoiceEnabled()) return
    const narrator = getLabTeacherNarrator()
    narrator.prime()
    narrator.replay()
  }, [])

  useEffect(() => {
    if (!synthRunActive) {
      if (!synthesisSettledProductRef.current) setSynthPhaseUi('')
      setSynthIgnite(false)
    }
  }, [runId, synthRunActive])

  useEffect(() => {
    if (synthRunActive) return
    if (synthesisSettledProduct == null) setLaboratorySynthesisView('reactor')
  }, [synthRunActive, synthesisSettledProduct])

  const showSettledSynthesisView = reactorOpen && !synthRunActive && synthesisSettledProduct != null
  /** 3D/HUD продукта только во время синтеза или после успеха — не при подборе коэффициентов */
  // Пока идёт урок по шагам, о продукте рассказывает панель урока — карточка сверху мешает кадру.
  // Подписка сведена к булеву: страница перерисовывается только при старте/конце урока, а не на
  // каждый «Далее» (полный рендер лаборатории на клике давал худший кадр 40–80 мс).
  const clo2LessonActive = useSyncExternalStore(clo2StepStore.subscribe, readLessonActive, readLessonActive)
  const showSynthProductHud =
    ((synthRunActive && lastRunProduct != null) || showSettledSynthesisView) && !clo2LessonActive
  const productForHud =
    synthRunActive && lastRunProduct != null
      ? lastRunProduct
      : synthesisSettledProduct

  const productHudStrings = useMemo(
    () => (productForHud ? getCompoundLocaleStrings(productForHud, locale, t) : null),
    [productForHud, locale, t],
  )

  /** До запуска синтеза — только превью реагентов. */
  const transformPreviewCompound = null

  /** Prewarm продукта: hover Run + авто после баланса (idle), чтобы K₂Cr₂O₇ не hitch'ил на Run. */
  const gpuPrewarmCompound = useMemo(() => {
    if (!reactorOpen || !productCompound) return null
    if (synthRunActive) return lastRunProduct ?? prewarmCompound ?? productCompound
    return prewarmCompound
  }, [
    reactorOpen,
    productCompound,
    synthRunActive,
    lastRunProduct,
    prewarmCompound,
  ])

  const gpuQueuePriorityCompound = useMemo(() => {
    if (!reactorOpen || synthRunActive || !reactorGpuIdleReady) return null
    return prewarmCompound
  }, [reactorOpen, synthRunActive, reactorGpuIdleReady, prewarmCompound])

  const onSynthesisPrewarmIntent = useCallback(() => {
    if (!productCompound || !canRunSynthesis) return
    setPrewarmCompound(productCompound)
  }, [productCompound, canRunSynthesis])

  /** После «уравнение верно» — тихий GPU-prewarm в idle (не на каждом +/-). */
  useEffect(() => {
    if (!reactorOpen || !canRunSynthesis || !productCompound || synthRunActive) return
    if (prewarmCompound?.id === productCompound.id) return
    let cancelled = false
    let idleId = 0
    const timer = window.setTimeout(() => {
      const start = () => {
        if (cancelled) return
        setPrewarmCompound(productCompound)
      }
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(start, { timeout: 900 }) as unknown as number
      } else {
        start()
      }
    }, 420)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (idleId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      }
    }
  }, [
    reactorOpen,
    canRunSynthesis,
    productCompound,
    synthRunActive,
    prewarmCompound?.id,
  ])

  return (
    <div
      ref={labWrapRef}
      className={styles.wrap}
      data-lab-synthesis-view={laboratorySynthesisView}
    >
      <div className={styles.rightHud}>
        <LabDomainTabs active="inorganic" />
        <button
          type="button"
          className={`${styles.synthButton} ${reactorOpen ? styles.synthButtonActive : ''}`}
          onClick={toggleReactor}
          aria-pressed={reactorOpen}
          title={reactorOpen ? t('lab.synthButtonClose') : t('lab.synthButtonOpen')}
        >
          {t('lab.synthButton')}
        </button>
      </div>
      {deepLinkBackHref ? (
        <Link className={styles.backToBook} to={deepLinkBackHref} data-lab-back-to-book="">
          {t('lab.deepLink.backToBook')}
        </Link>
      ) : null}
      <div
        ref={canvasWrapRef}
        className={styles.canvasWrap}
        data-lab-synthesis-view={laboratorySynthesisView}
        data-reactor-open={reactorOpen ? 'true' : undefined}
        data-synth-ignite={synthIgnite ? 'true' : undefined}
        data-synth-phase={synthRunActive || showSettledSynthesisView ? synthPhaseUi || undefined : undefined}
        style={
          synthRunActive || showSettledSynthesisView
            ? { ['--synth-glow' as string]: productForHud?.accentColor ?? '#0a0c18' }
            : undefined
        }
      >
        <div className={styles.cosmicUnderlay} aria-hidden>
          <div className={styles.cosmicStarsFar} />
          <div className={styles.cosmicStarsNear} />
        </div>
        <div className={styles.labCanvasHost}>
          <Suspense fallback={<LabCanvasFallback />}>
            <LabCanvas
              sessionKey={`${labCanvasKey}-${reactorSessionKey}`}
              particles={particles}
              onParticleMove={onParticleMove}
              structureZ={reactorOpen ? null : structureZ}
              onInspectAtom={reactorOpen ? undefined : setStructureZ}
              synthesis={labSynthesis}
              synthesisRunActive={synthRunActive}
              reactorPreviewTerms={reactorPreviewTermsCanvas}
              reactorCoeffEditBurst={coeffEditBurst}
              reactorCoeffEditing={reactorCoeffEditing}
              transformPreviewCompound={transformPreviewCompound}
              reactorViewOpen={reactorOpen}
              synthesisSettledProduct={synthesisSettledProduct}
              laboratorySynthesisView={laboratorySynthesisView}
              synthesisPhase={synthPhaseUi}
              forceLiteFxRef={forceLiteFxRef}
              prewarmProductCompound={gpuPrewarmCompound}
              gpuQueuePriorityCompound={gpuQueuePriorityCompound}
              reactorGpuIdleReady={reactorGpuIdleReady}
              teacherMode={Boolean(labTeacherActive && teacherVoiceOn && (synthRunActive || runId > 0))}
              onNarrationCue={labTeacherActive && teacherVoiceOn ? onLabNarrationCue : undefined}
              scientificStage={scientificStage}
            />
          </Suspense>
        </div>
        <Clo2MechanismPanel active={reactorOpen} />
        {showSettledSynthesisView ? (
          <div className={styles.synthVignette} aria-hidden />
        ) : null}
        {showSynthProductHud && productForHud ? (
          <div className={styles.synthProductDock} role="status" aria-live="polite">
            {/* Карточка героя: состояние при 25 °C, ΔH°f, строение и «почему так» (hero/ProductHeroCard). */}
            <ProductHeroCard
              compound={productForHud}
              name={productHudStrings?.name ?? productForHud.nameRu}
              description={productHudStrings?.description ?? productForHud.descriptionRu}
            />
          </div>
        ) : null}
        {structureZ != null && getElementByZ(structureZ) && !panelOpen && !reactorOpen ? (
          <div
            className={styles.elementInfoDock}
            role="complementary"
            aria-labelledby="lab-element-detail-title"
          >
            <div className={styles.elementInfoCard}>
              <ElementDetailContent z={structureZ} titleId="lab-element-detail-title" variant="lab" />
            </div>
          </div>
        ) : null}
      </div>

      {/* Вне canvasWrap: contain:layout + fixed-реактор → 0×0 WebGL / белый canvas. */}
      <SynthesisReactorPanel
        open={reactorOpen}
        onOpenGenerateEquationCatalog={() => openReactorCatalog('generateEquation')}
        leftTerms={leftTerms}
        coProducts={coProducts}
        productCompound={productCompound}
        productCoeff={productCoeff}
        onRemoveTerm={onRemoveTerm}
        onCoeffChange={onCoeffChange}
        onCoProductCoeffChange={onCoProductCoeffChange}
        onCoeffUiFocusChange={setCoeffUiFocused}
        onApplyBalanceCoeffs={onApplyBalanceCoeffs}
        onLoadBalanceLesson={onLoadBalanceLesson}
        onOpenCatalog={() => openReactorCatalog('selectProduct')}
        onProductCoeffChange={(c) => {
          // Как +/- реагентов: сразу pin Bohr + сброс settled — иначе пустой центр на 1 кадр.
          setSynthesisSettledProduct(null)
          synthesisSettledProductRef.current = null
          settledSnapshotRef.current = null
          setSynthPhaseUi('')
          forceEditHoldRef.current()
          setProductCoeff(Math.max(1, Math.min(REACTOR_COEFF_MAX, Math.floor(c))))
        }}
        onClearSlots={clearReactorSlots}
        onRequestRun={onRequestRun}
        message={reactorMessage}
        canRun={canRunSynthesis}
        synthesisRunning={synthRunActive}
        equationBalanced={equationBalanced}
        highlightEquationError={highlightEquationError}
        ambiguousProductMatches={ambiguousProductMatches}
        dimInCatalogHeroView={laboratorySynthesisView === 'substance'}
        onSynthesisPrewarmIntent={onSynthesisPrewarmIntent}
        labHeatOn={labHeatOn}
        labPressureOn={labPressureOn}
        labCatalystOn={labCatalystOn}
        onLabHeatChange={setLabHeatOn}
        onLabPressureChange={setLabPressureOn}
        onLabCatalystChange={setLabCatalystOn}
        scientificMode={activeRecipe != null}
        teacherAvailable={hasLabTeacherScript(productCompoundId)}
        teacherVoiceOn={teacherVoiceOn}
        teacherSpeaking={teacherSpeaking}
        teacherLineTitle={teacherVoiceOn ? teacherLine?.title : undefined}
        teacherLineText={teacherVoiceOn ? teacherLine?.speak : undefined}
        onTeacherVoiceToggle={onTeacherVoiceToggle}
        onTeacherReplay={onTeacherReplay}
      />

      <ReactorCompoundCatalogPanel
        open={reactorCatalogOpen}
        intent={reactorCatalogIntent}
        allowedProductIds={
          reactorCatalogIntent === 'generateEquation' ? learnAllowedProductIds : undefined
        }
        onClose={() => {
          setReactorCatalogOpen(false)
          reactorCatalogPickModeRef.current = 'selectProduct'
          setReactorCatalogIntent('selectProduct')
        }}
        onPick={handleReactorCatalogPick}
      />

      {!panelOpen && !periodicUiHidden ? (
        <button
          type="button"
          className={
            reactorOpen ? `${styles.panelFab} ${styles.panelFabReactorOpen}` : styles.panelFab
          }
          onClick={() => setPanelOpen(true)}
          aria-expanded={panelOpen}
          aria-label={t('lab.panelFabAria')}
        >
          ⊞
        </button>
      ) : null}

      {/* Вне canvasWrap: иначе contain:layout ломает fixed и отступы слева/справа */}
      {!periodicUiHidden ? (
        <ElementSidePanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          onPickElement={onPickInTable}
          onAltPickElement={onAltPickInTable}
          layoutVariant={reactorOpen ? 'labCompact' : 'modal'}
        />
      ) : null}
    </div>
  )
}
