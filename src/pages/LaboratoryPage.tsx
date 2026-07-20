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
import { termsSignature } from '../lab/previewLayoutPolicy'
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
  const [productCompoundId, setProductCompoundId] = useState<string | null>(null)
  const [productCoeff, setProductCoeff] = useState(1)
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

  /** Правый HUD: Неорганика | Органика рядом с Синтез; отступ таблицы = ширина этого блока. */
  useLayoutEffect(() => {
    const wrap = labWrapRef.current
    const rightHud = rightHudRef.current
    if (!wrap) return

    let lastInset = Number.NaN
    const syncHudRails = () => {
      const vw = window.innerWidth
      const hudLeft = rightHud?.getBoundingClientRect().left ?? vw - 220
      const gap = 12
      const leftPad = 12
      const rightRail = Math.max(leftPad, Math.round(vw - hudLeft + gap))
      const inset = Math.max(leftPad, rightRail)
      if (inset === lastInset) return
      lastInset = inset
      wrap.style.setProperty('--lab-pt-inset', `${inset}px`)
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
    const syncReactorClearance = () => {
      const reactor = wrap.querySelector<HTMLElement>('[data-lab-reactor]')
      const h = reactor?.getBoundingClientRect().height ?? 0
      if (h < 80) return
      const clearance = Math.round(h + 10)
      if (clearance === lastClearance) return
      lastClearance = clearance
      wrap.style.setProperty('--lab-reactor-clearance', `${clearance}px`)
    }

    syncReactorClearance()
    const ro = new ResizeObserver(syncReactorClearance)
    const reactor = wrap.querySelector<HTMLElement>('[data-lab-reactor]')
    if (reactor) ro.observe(reactor)
    window.addEventListener('resize', syncReactorClearance)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', syncReactorClearance)
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
    // Даём Canvas/Bohr один кадр + паузу прогрева до GPU-очереди (дихромат).
    const timer = window.setTimeout(() => {
      if (!cancelled) setReactorGpuIdleReady(true)
    }, 900)
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
      setProductCoeff(1)
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

  const equationSignature = useMemo(
    () =>
      JSON.stringify({
        terms: leftTerms.map((t) => [t.id, t.z, t.coeff, t.diatomic ?? false]),
        product: productCompoundId,
        coeff: productCoeff,
      }),
    [leftTerms, productCompoundId, productCoeff],
  )
  const settledSnapshotRef = useRef<string | null>(null)

  /** Sync clear settled при смене уравнения — без кадра «пусто» между product off и preview. */
  useLayoutEffect(() => {
    if (synthesisSettledProduct == null) return
    if (settledSnapshotRef.current == null) {
      settledSnapshotRef.current = equationSignature
      return
    }
    if (settledSnapshotRef.current !== equationSignature) {
      settledSnapshotRef.current = null
      setSynthesisSettledProduct(null)
      synthesisSettledProductRef.current = null
      setLaboratorySynthesisView('reactor')
    }
  }, [equationSignature, synthesisSettledProduct])

  const equationBalanced = useMemo(
    () => isReactorBalancedFast(deferredLeftTerms, productCompound ?? undefined, productCoeff),
    [deferredLeftTerms, productCompound, productCoeff],
  )

  const resetEquation = useCallback(() => {
    setLeftTerms([])
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
    setLeftTerms((prev) => prev.filter((term) => term.id !== id))
  }, [])

  const onCoeffChange = useCallback((id: string, coeff: number) => {
    const c = Math.max(1, Math.min(REACTOR_COEFF_MAX, Math.floor(Number.isFinite(coeff) ? coeff : 1)))
    // Синхронно в UI; Canvas обновляется через useReactorCanvasTermsHold (freeze + idle).
    setSynthesisSettledProduct(null)
    synthesisSettledProductRef.current = null
    settledSnapshotRef.current = null
    setSynthPhaseUi('')
    setLeftTerms((prev) => prev.map((term) => (term.id === id ? { ...term, coeff: c } : term)))
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

      if (mode === 'generateEquation') {
        applyGenerateEquationReagents(c)
      }
    },
    [applyGenerateEquationReagents, catalogList],
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
        setLaboratorySynthesisView('reactor')
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

  const leftTermsSig = useMemo(() => termsSignature(leftTerms), [leftTerms])
  const prevLeftTermsSigRef = useRef<string | null>(null)
  const coeffEditSync =
    prevLeftTermsSigRef.current !== null &&
    prevLeftTermsSigRef.current !== leftTermsSig &&
    leftTerms.length > 0
  prevLeftTermsSigRef.current = leftTermsSig

  const reactorCoeffEditing =
    isReactorCoeffEditing(coeffEditBurst, editIdle, visualHold) ||
    coeffEditSync ||
    coeffEditPulse ||
    coeffUiFocused

  /** Canvas: сразу после commit коэффициента (~32ms), без долгого freeze. */
  const heldCanvasTerms = useReactorCanvasTermsHold(reactorOpen, leftTerms, false, 32)
  const reactorPreviewTermsCanvas = useReactorPreviewTermsStable(
    reactorOpen,
    heldCanvasTerms,
    heldCanvasTerms,
    coeffEditBurst,
  )

  useEffect(() => {
    if (coeffEditBurst) forceLiteFxRef.current = true
  }, [coeffEditBurst])

  useEffect(() => {
    // Никогда не прогревать layout/worker на каждом +/- — это главный hitch на main thread.
    if (!reactorOpen || !productCompound) return
    if (coeffEditBurst || reactorCoeffEditing || !editIdle) return
    if (leftTerms.length < 1) return
    warmupReactorPreviewTerms(leftTerms)
    warmupLabSynthesisReactorOpen(catalogList, productCompound, leftTerms)
  }, [
    reactorOpen,
    productCompound,
    coeffEditBurst,
    reactorCoeffEditing,
    editIdle,
    leftTerms,
    catalogList,
  ])

  const onRequestRun = useCallback(() => {
    const prepared = prepareGuaranteedSynthesisRun({
      leftTerms,
      productId: productCompoundId,
      productCoeff,
      compoundById,
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
    synthesisWatchdogMsRef.current = getSynthesisWatchdogMs(payload.flyTerms, payload.zSlots)
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
  }, [leftTerms, productCompoundId, productCoeff, t, locale, runId, resetEditBurst])

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
    return isReactorBalancedFast(deferredLeftTerms, product, productCoeff)
  }, [deferredLeftTerms, productCompoundId, productCoeff])

  useEffect(() => {
    if (!reactorOpen || !productCompound || !canRunSynthesis) return
    if (coeffEditBurst) return
    setPrewarmCompound(productCompound)
  }, [reactorOpen, productCompound, canRunSynthesis, coeffEditBurst])

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

  /** GPU-prewarm продукта как только уравнение сбалансировано (до Check). */
  const gpuPrewarmCompound = useMemo(() => {
    if (!reactorOpen || !productCompound) return null
    if (synthRunActive) return lastRunProduct ?? prewarmCompound ?? productCompound
    if (canRunSynthesis && reactorGpuIdleReady) return productCompound
    return prewarmCompound
  }, [
    reactorOpen,
    productCompound,
    synthRunActive,
    lastRunProduct,
    prewarmCompound,
    canRunSynthesis,
    reactorGpuIdleReady,
  ])

  const gpuQueuePriorityCompound = useMemo(() => {
    if (!reactorOpen || synthRunActive || !reactorGpuIdleReady) return null
    if (canRunSynthesis && productCompound) return productCompound
    return productCompound
  }, [reactorOpen, synthRunActive, productCompound, canRunSynthesis, reactorGpuIdleReady])

  const onSynthesisPrewarmIntent = useCallback(() => {
    if (!productCompound || !canRunSynthesis) return
    setPrewarmCompound(productCompound)
  }, [productCompound, canRunSynthesis])

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

        <SynthesisReactorPanel
          open={reactorOpen}
          onOpenGenerateEquationCatalog={() => openReactorCatalog('generateEquation')}
          leftTerms={leftTerms}
          productCompound={productCompound}
          productCoeff={productCoeff}
          onRemoveTerm={onRemoveTerm}
          onCoeffChange={onCoeffChange}
          onCoeffUiFocusChange={setCoeffUiFocused}
          onApplyBalanceCoeffs={onApplyBalanceCoeffs}
          onLoadBalanceLesson={onLoadBalanceLesson}
          onOpenCatalog={() => openReactorCatalog('selectProduct')}
          onProductCoeffChange={(c) => {
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
      </div>
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
