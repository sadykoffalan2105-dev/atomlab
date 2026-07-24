import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  lazy,
  Suspense,
} from 'react'
import { LabDomainTabs } from '../components/lab/LabDomainTabs'
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
  getScientificReactorRecipe,
  hasScientificReactorRecipe,
  isScientificEquationBalanced,
  seedScientificReactorEquation,
  type ReactorCoProductTerm,
} from '../chemistry/scientificReactorRecipes'
import { getCompoundLocaleStrings } from '../i18n/compoundLocale'
import { useT } from '../i18n/useT'
import { ElementDetailContent } from '../components/lab/ElementDetailContent'
import { ElementSidePanel } from '../components/lab/ElementSidePanel'
import {
  ReactorCompoundCatalogPanel,
  type ReactorCatalogIntent,
} from '../components/lab/ReactorCompoundCatalogPanel'
import { SynthesisReactorPanel } from '../components/lab/SynthesisReactorPanel'
import { LaunchMissionHud } from '../components/lab/LaunchMissionHud'
import { compoundById } from '../data/compounds'
import {
  getSectionAllowedProductIds,
  parseLearnEquationScope,
  type LearnEquationScope,
} from '../data/learnSectionEquations'
import { getElementByZ } from '../data/elements'
import type { CompoundDef, LabParticle, Vec3 } from '../types/chemistry'
import styles from './LaboratoryPage.module.css'

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
  const launchProgressRef = useRef(0)
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
  const rightHudRef = useRef<HTMLDivElement | null>(null)
  const [labCanvasKey] = useState(0)
  const [reactorSessionKey, setReactorSessionKey] = useState(0)
  useCanvasSizeGuard(canvasWrapRef)

  /** Правый HUD: Неорганика | Органика рядом с Синтез; слева таблица почти до края. */
  useLayoutEffect(() => {
    const wrap = labWrapRef.current
    const rightHud = rightHudRef.current
    if (!wrap) return

    let lastLeft = Number.NaN
    let lastRight = Number.NaN
    const syncHudRails = () => {
      const vw = window.innerWidth
      const hudLeft = rightHud?.getBoundingClientRect().left ?? vw - 220
      const gap = 10
      const leftPad = 10
      const rightRail = Math.max(leftPad, Math.round(vw - hudLeft + gap))
      if (leftPad === lastLeft && rightRail === lastRight) return
      lastLeft = leftPad
      lastRight = rightRail
      wrap.style.setProperty('--lab-pt-inset-left', `${leftPad}px`)
      wrap.style.setProperty('--lab-pt-inset-right', `${rightRail}px`)
      // legacy fallback for older CSS
      wrap.style.setProperty('--lab-pt-inset', `${rightRail}px`)
    }

    syncHudRails()
    const ro = new ResizeObserver(syncHudRails)
    ro.observe(wrap)
    if (rightHud) ro.observe(rightHud)
    window.addEventListener('resize', syncHudRails)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', syncHudRails)
    }
  }, [])

  /** Высота реактора → нижний зазор таблицы, чтобы сетка не уезжала за верх экрана. */
  useLayoutEffect(() => {
    const wrap = labWrapRef.current
    if (!wrap) return
    if (!reactorOpen) {
      wrap.style.removeProperty('--lab-reactor-clearance')
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
      wrap.style.setProperty('--lab-reactor-clearance', `${clearance}px`)
      // Debounce: balance-панель часто меняет высоту — без thrash WebGL.
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        window.dispatchEvent(new Event('resize'))
      }, 80)
    }

    syncReactorClearance()
    const ro = new ResizeObserver(syncReactorClearance)
    const reactor = wrap.querySelector<HTMLElement>('[data-lab-reactor]')
    if (reactor) ro.observe(reactor)
    window.addEventListener('resize', syncReactorClearance)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', syncReactorClearance)
      window.clearTimeout(resizeTimer)
      wrap.style.removeProperty('--lab-reactor-clearance')
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

  useEffect(() => {
    const hash = window.location.hash
    const qIdx = hash.indexOf('?')
    if (qIdx < 0) return
    const params = new URLSearchParams(hash.slice(qIdx + 1))
    if (params.get('reactor') === '1') {
      setReactorOpen(true)
      setStructureZ(null)
      setPanelOpen(false)
    }
    if (params.get('genEq') === '1') {
      setPendingGenEq(true)
    }
    const scope = parseLearnEquationScope(params)
    if (scope) {
      setLearnEquationScope(scope)
    }
    const product = params.get('product')
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
      }
    }
  }, [])

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
            ? `Научный маршрут: ${recipe.titleRu}. Уравнение 2NaClO₂ + Cl₂ → 2NaCl + 2ClO₂ — проверьте коэффициенты и запустите синтез`
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
          ? `Научный маршрут: ${recipe.titleRu}. 2NaClO₂ + Cl₂ → 2NaCl + 2ClO₂ — можно запускать синтез`
          : null,
      )
      warmupLabSynthesisReactorOpen(catalogList, c)
      return true
    },
    [catalogList],
  )

  /** Дешёвая сигнатура уравнения (без JSON.stringify на каждый keystroke). */
  const equationSignature = useMemo(() => {
    const terms = leftTerms
      .map(
        (term) =>
          `${term.id}:${term.z}:${term.coeff}:${term.diatomic ? 1 : 0}:${term.compoundId ?? ''}`,
      )
      .join('|')
    const right = coProducts.map((c) => `${c.id}:${c.compoundId}:${c.coeff}`).join('|')
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

  const equationBalanced = useMemo(() => {
    if (hasScientificReactorRecipe(productCompound?.id)) {
      return isScientificEquationBalanced(
        deferredLeftTerms,
        coProducts,
        productCompound ?? undefined,
        productCoeff,
        compoundById,
      )
    }
    return isReactorBalancedFast(deferredLeftTerms, productCompound ?? undefined, productCoeff)
  }, [deferredLeftTerms, coProducts, productCompound, productCoeff])

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
    resetEquation()
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

  const completeSynthesisSuccess = useCallback(
    (compound: CompoundDef, runIdForGuard: number) => {
      const guard = synthesisRunGuardRef.current
      guard.tryCompleteSuccess(runIdForGuard, () => {
        synthesisCompletingRef.current = true
        const name = getCompoundLocaleStrings(compound, locale, t).name
        setReactorMessage(t('reactor.successProduct', { name, formula: compound.formulaUnicode }))
        setSynthesisSettledProduct(compound)
        synthesisSettledProductRef.current = compound
        settledSnapshotRef.current = equationSignature
        setRunId(0)
        setLaboratorySynthesisView('substance')
        lastRunZSlotsRef.current = []
        setSynthesisFlightSlots(null)
        setSynthesisFlyTerms(null)
        setSynthPhaseUi('settled')
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

  const onSynthesisPhaseChangeRaw = useCallback((_phase: string, progress: number) => {
    launchProgressRef.current = progress
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
    () => (hasScientificReactorRecipe(productCompoundId) ? [] : leftTerms),
    [leftTerms, productCompoundId],
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
    launchProgressRef.current = 0
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
    setRunId(nextRunId)
  }, [leftTerms, coProducts, productCompoundId, productCoeff, t, locale, runId, resetEditBurst, catalogList])

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
    const timer = window.setTimeout(() => {
      if (synthesisSettledProductRef.current != null) return
      if (synthesisCompletingRef.current) return
      const compound =
        lastRunProductRef.current ?? resolveCatalogProduct(compoundById, productId)
      if (compound) {
        completeSynthesisSuccess(compound, activeRun)
      }
    }, synthesisWatchdogMsRef.current)
    return () => window.clearTimeout(timer)
  }, [reactorOpen, runId, completeSynthesisSuccess])

  const canRunSynthesis = useMemo(() => {
    const product = productCompoundId ? compoundById[productCompoundId] : undefined
    if (!product) return false
    if (hasScientificReactorRecipe(product.id)) {
      if (
        !isScientificEquationBalanced(
          deferredLeftTerms,
          coProducts,
          product,
          productCoeff,
          compoundById,
        )
      ) {
        return false
      }
    } else if (!isReactorBalancedFast(deferredLeftTerms, product, productCoeff)) {
      return false
    }
    const lab = product.synthesisLab
    if (lab?.needsHeat && !labHeatOn) return false
    if (lab?.needsPressure && !labPressureOn) return false
    if (lab?.needsCatalyst && !labCatalystOn) return false
    return true
  }, [
    deferredLeftTerms,
    coProducts,
    productCompoundId,
    productCoeff,
    labHeatOn,
    labPressureOn,
    labCatalystOn,
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

  useEffect(() => {
    queueMicrotask(() => {
      setReactorMessage((prev) => {
        if (!prev) return prev
        if (preserveReactorMessageOnEquationEdit(prev)) return prev
        return null
      })
    })
  }, [leftTerms, productCompoundId, productCoeff])

  const synthRunActive = reactorOpen && runId > 0

  useEffect(() => {
    if (!synthRunActive) {
      launchProgressRef.current = 0
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
  const showSynthProductHud =
    (synthRunActive && lastRunProduct != null) || showSettledSynthesisView
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
      <div ref={rightHudRef} className={styles.rightHud}>
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
          />
        </Suspense>
        {showSettledSynthesisView ? (
          <div className={styles.synthVignette} aria-hidden />
        ) : null}
        <LaunchMissionHud
          active={synthRunActive}
          accentColor={productForHud?.accentColor ?? '#3dffec'}
          progressRef={launchProgressRef}
        />
        {showSynthProductHud && productForHud ? (
          <div className={styles.synthProductDock} role="status" aria-live="polite">
            <div className={styles.synthProductCard}>
              <span className={styles.synthFormula}>{productForHud.formulaUnicode}</span>
              <span className={styles.synthName}>{productHudStrings?.name ?? productForHud.nameRu}</span>
              <p className={styles.synthDesc}>{productHudStrings?.description ?? productForHud.descriptionRu}</p>
            </div>
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
        scientificMode={hasScientificReactorRecipe(productCompoundId)}
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
