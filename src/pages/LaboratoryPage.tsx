import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isDiatomicNativeElement } from '../chemistry/diatomicElements'
import {
  expandLeftTermsToZSlots,
  compositionFromLeftTerms,
  findCatalogMatchesForLeftTerms,
  findMatchingProductCoeff,
  isReactorEquationBalanced,
  REACTOR_EQUATION_MAX_FLY_ATOMS,
  REACTOR_EQUATION_MAX_TERMS,
  validateReactorEquation,
  type ReactorEquationTerm,
} from '../chemistry/reactorEquationBalance'
import { generateFromLaboratoryRecipe, parseReactionLeftSideUnitCoeffs } from '../chemistry/reactionLeftSideParser'
import { ElementDetailContent } from '../components/lab/ElementDetailContent'
import { LabCanvas } from '../components/lab/LabScene'
import { ElementSidePanel } from '../components/lab/ElementSidePanel'
import {
  ReactorCompoundCatalogPanel,
  type ReactorCatalogIntent,
} from '../components/lab/ReactorCompoundCatalogPanel'
import { SynthesisReactorPanel } from '../components/lab/SynthesisReactorPanel'
import { compoundById } from '../data/compounds'
import { getElementByZ } from '../data/elements'
import type { CompoundDef, LabParticle, Vec3 } from '../types/chemistry'
import styles from './LaboratoryPage.module.css'

function newId(): string {
  return crypto.randomUUID()
}

function preserveReactorMessageOnEquationEdit(msg: string): boolean {
  const m = msg.toLowerCase()
  return m.includes('верно! связь') || m.startsWith('получено:')
}

export function LaboratoryPage() {
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
  const [lastRunZs, setLastRunZs] = useState<number[]>([])
  const lastRunZSlotsRef = useRef<number[]>([])
  const [lastRunProduct, setLastRunProduct] = useState<CompoundDef | null>(null)
  const lastRunProductRef = useRef<CompoundDef | null>(null)

  const [reactorMessage, setReactorMessage] = useState<string | null>(null)
  const [synthesisSettledProduct, setSynthesisSettledProduct] = useState<CompoundDef | null>(null)
  const [laboratorySynthesisView, setLaboratorySynthesisView] = useState<'reactor' | 'substance'>('reactor')

  const catalogList = useMemo(() => Object.values(compoundById), [])

  const productCompound = useMemo(
    () => (productCompoundId ? (compoundById[productCompoundId] ?? null) : null),
    [productCompoundId],
  )

  const catalogAutoMatches = useMemo(
    () => findCatalogMatchesForLeftTerms(leftTerms, catalogList),
    [leftTerms, catalogList],
  )

  const ambiguousProductMatches = catalogAutoMatches.length > 1 ? catalogAutoMatches : []

  useEffect(() => {
    const left = compositionFromLeftTerms(leftTerms)
    if (!left || Object.keys(left).length === 0) return

    const cur = productCompoundId ? compoundById[productCompoundId] : undefined
    if (cur) {
      const k = findMatchingProductCoeff(left, cur)
      if (k != null) {
        if (k !== productCoeff) queueMicrotask(() => setProductCoeff(k))
        return
      }
    }

    if (catalogAutoMatches.length === 1) {
      const only = catalogAutoMatches[0]!
      queueMicrotask(() => {
        setProductCompoundId(only.compound.id)
        setProductCoeff(only.k)
      })
    }
  }, [leftTerms, productCompoundId, productCoeff, catalogAutoMatches])

  const equationBalanced = useMemo(
    () => isReactorEquationBalanced(leftTerms, productCompound ?? undefined, productCoeff),
    [leftTerms, productCompound, productCoeff],
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
        setLeftTerms((prev) => {
          const di = isDiatomicNativeElement(z)
          const matchIndex = prev.findIndex((t) => t.z === z && Boolean(t.diatomic) === di)
          if (matchIndex >= 0) {
            const t = prev[matchIndex]!
            const nextCoeff = t.coeff + 1
            if (nextCoeff > 999) return prev
            const trial = prev.map((x, i) => (i === matchIndex ? { ...x, coeff: nextCoeff } : x))
            if (expandLeftTermsToZSlots(trial).length > REACTOR_EQUATION_MAX_FLY_ATOMS) return prev
            return trial
          }
          if (prev.length >= REACTOR_EQUATION_MAX_TERMS) return prev
          return [...prev, { id: newId(), z, coeff: 1, ...(di ? { diatomic: true as const } : {}) }]
        })
        return
      }
      if (getElementByZ(z)) setStructureZ(z)
    },
    [reactorOpen],
  )

  const onRemoveTerm = useCallback((id: string) => {
    setLeftTerms((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const onCoeffChange = useCallback((id: string, coeff: number) => {
    const c = Math.max(1, Math.min(999, Math.floor(Number.isFinite(coeff) ? coeff : 1)))
    setLeftTerms((prev) => prev.map((t) => (t.id === id ? { ...t, coeff: c } : t)))
  }, [])

  const openReactorCatalog = useCallback((intent: ReactorCatalogIntent) => {
    reactorCatalogPickModeRef.current = intent
    setReactorCatalogIntent(intent)
    setReactorCatalogOpen(true)
  }, [])

  const handleReactorCatalogPick = useCallback((id: string) => {
    setReactorCatalogOpen(false)
    const mode = reactorCatalogPickModeRef.current
    reactorCatalogPickModeRef.current = 'selectProduct'
    setReactorCatalogIntent('selectProduct')

    const c = compoundById[id]
    if (!c) return

    if (mode === 'selectProduct') {
      setProductCompoundId(id)
      return
    }

    setProductCompoundId(id)
    setProductCoeff(1)
    const g = generateFromLaboratoryRecipe(c)
    const trimmed = g.manualLeft.trim()
    if (!trimmed) {
      setLeftTerms([])
      setReactorMessage('В эталоне нет левой части — добавьте реагенты из таблицы (⊞).')
      return
    }
    const r = parseReactionLeftSideUnitCoeffs(trimmed, newId)
    if (!r.ok) {
      setLeftTerms([])
      setReactorMessage(r.message)
      return
    }
    setLeftTerms(r.terms)
    setReactorMessage(g.warn ?? null)
  }, [])

  const clearReactorSlots = useCallback(() => {
    resetEquation()
    setReactorMessage(null)
    setSynthesisSettledProduct(null)
    setLaboratorySynthesisView('reactor')
    reactorCatalogPickModeRef.current = 'selectProduct'
    setReactorCatalogIntent('selectProduct')
    setReactorCatalogOpen(false)
  }, [resetEquation])

  const toggleReactor = useCallback(() => {
    setReactorOpen((o) => {
      const next = !o
      if (!next) {
        resetEquation()
        setRunId(0)
        lastRunZSlotsRef.current = []
        setReactorMessage(null)
        setLastRunProduct(null)
        lastRunProductRef.current = null
        setSynthesisSettledProduct(null)
        setLaboratorySynthesisView('reactor')
        setReactorCatalogOpen(false)
        reactorCatalogPickModeRef.current = 'selectProduct'
        setReactorCatalogIntent('selectProduct')
      } else {
        setStructureZ(null)
        setReactorMessage(
          'Реагенты — таблица ⊞ справа. «Сгенерировать уравнение» — каталог: эталон без коэффициентов, затем уравняйте. Продукт — кнопка «Открыть каталог» в пузыре.',
        )
      }
      return next
    })
  }, [resetEquation])

  const onReactorAnimDone = useCallback((kind: 'success' | 'fail') => {
    if (kind === 'success') {
      const c = lastRunProductRef.current
      if (c) {
        setReactorMessage(
          `Получено: ${c.nameRu} ${c.formulaUnicode}. 3D показан в центре. Можно составить новое уравнение или закрыть реактор.`,
        )
        resetEquation()
        setSynthesisSettledProduct(c)
        setLaboratorySynthesisView('substance')
      }
    } else {
      setReactorMessage('Синтез не удался. Проверьте уравнение и продукт.')
    }
    lastRunZSlotsRef.current = []
    setLastRunZs([])
    setRunId(0)
  }, [resetEquation])

  const onSynthesisStageChange = useCallback((stage: 'reactor' | 'substance') => {
    setLaboratorySynthesisView(stage)
  }, [])

  const onRequestRun = useCallback(() => {
    const product = productCompoundId ? compoundById[productCompoundId] : undefined
    const result = validateReactorEquation(leftTerms, product, productCoeff)
    if (!result.ok) {
      setReactorMessage(result.message)
      return
    }

    setLaboratorySynthesisView('reactor')
    const zSlots = result.zSlots
    lastRunZSlotsRef.current = zSlots.slice()

    fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        sessionId: 'dbdb64',
        runId: 'reactor-equation',
        hypothesisId: 'H1',
        location: 'LaboratoryPage.tsx:onRequestRun',
        message: 'balanced equation run',
        data: {
          zSlotsLen: zSlots.length,
          compoundId: result.compound.id,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})

    setLastRunZs(zSlots)
    lastRunProductRef.current = result.compound
    setLastRunProduct(result.compound)
    setRunId((k) => k + 1)
    setReactorMessage(`Верно! Связь… ${result.compound.nameRu}`)
    requestAnimationFrame(() => {
      resetEquation()
    })
  }, [leftTerms, productCompoundId, productCoeff, resetEquation])

  const labSynthesis = useMemo(() => {
    if (!reactorOpen || runId <= 0) return null
    const zSlots: readonly number[] = lastRunZs
    if (zSlots.length < 2) return null
    return {
      runId,
      zSlots,
      product: lastRunProduct,
      onDone: onReactorAnimDone,
      onSynthesisStageChange,
    }
  }, [reactorOpen, runId, lastRunZs, lastRunProduct, onReactorAnimDone, onSynthesisStageChange])

  const reactorReagentZs = useMemo(() => {
    if (!reactorOpen || runId !== 0) return null
    const zs = expandLeftTermsToZSlots(leftTerms)
    return zs.length >= 2 ? zs : null
  }, [reactorOpen, runId, leftTerms])

  const canRunSynthesis = useMemo(() => {
    const product = productCompoundId ? compoundById[productCompoundId] : undefined
    return validateReactorEquation(leftTerms, product, productCoeff).ok
  }, [leftTerms, productCompoundId, productCoeff])

  const highlightEquationError = useMemo(() => {
    if (!reactorMessage) return false
    const m = reactorMessage.toLowerCase()
    return (
      m.includes('баланс') ||
      m.includes('коэффициент') ||
      m.includes('целым числом') ||
      m.includes('не совпадает')
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
  const showSettledSynthesisView = reactorOpen && !synthRunActive && synthesisSettledProduct != null
  const showSynthProductHud = (synthRunActive && lastRunProduct != null) || showSettledSynthesisView
  const productForHud = synthRunActive && lastRunProduct != null ? lastRunProduct : synthesisSettledProduct

  const reactorBrewVignette =
    reactorOpen &&
    !synthRunActive &&
    laboratorySynthesisView !== 'substance' &&
    reactorReagentZs != null &&
    reactorReagentZs.length >= 2

  return (
    <div className={styles.wrap} data-lab-synthesis-view={laboratorySynthesisView}>
      <div
        className={styles.canvasWrap}
        data-lab-synthesis-view={laboratorySynthesisView}
        data-reactor-brew={reactorBrewVignette ? 'true' : undefined}
        style={
          synthRunActive || showSettledSynthesisView
            ? { ['--synth-glow' as string]: productForHud?.accentColor ?? '#0a0c18' }
            : undefined
        }
      >
        <LabCanvas
          particles={particles}
          onParticleMove={onParticleMove}
          structureZ={reactorOpen ? null : structureZ}
          onInspectAtom={reactorOpen ? undefined : setStructureZ}
          synthesis={labSynthesis}
          synthesisRunActive={synthRunActive}
          reactorReagentZs={reactorReagentZs}
          reactorViewOpen={reactorOpen}
          synthesisSettledProduct={synthesisSettledProduct}
          laboratorySynthesisView={laboratorySynthesisView}
        />
        {synthRunActive || showSettledSynthesisView ? (
          <div className={styles.synthVignette} aria-hidden />
        ) : null}
        {showSynthProductHud && productForHud ? (
          <div className={styles.synthProductDock} role="status" aria-live="polite">
            <div className={styles.synthProductCard}>
              <span className={styles.synthFormula}>{productForHud.formulaUnicode}</span>
              <span className={styles.synthName}>{productForHud.nameRu}</span>
              <p className={styles.synthDesc}>{productForHud.descriptionRu}</p>
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
          onOpenCatalog={() => openReactorCatalog('selectProduct')}
          onProductCoeffChange={(c) => {
            setProductCoeff(Math.max(1, Math.min(99, Math.floor(c))))
          }}
          onClearSlots={clearReactorSlots}
          onRequestRun={onRequestRun}
          message={reactorMessage}
          canRun={canRunSynthesis}
          equationBalanced={equationBalanced}
          highlightEquationError={highlightEquationError}
          ambiguousProductMatches={ambiguousProductMatches}
          dimInCatalogHeroView={laboratorySynthesisView === 'substance'}
        />

        <ReactorCompoundCatalogPanel
          open={reactorCatalogOpen}
          intent={reactorCatalogIntent}
          onClose={() => {
            setReactorCatalogOpen(false)
            reactorCatalogPickModeRef.current = 'selectProduct'
            setReactorCatalogIntent('selectProduct')
          }}
          onPick={handleReactorCatalogPick}
        />

        <button
          type="button"
          className={`${styles.synthButton} ${reactorOpen ? styles.synthButtonActive : ''}`}
          onClick={toggleReactor}
          aria-pressed={reactorOpen}
          title={
            reactorOpen
              ? 'Закрыть панель реактора'
              : 'Открыть: реактор с реагентами из таблицы и проверкой баланса'
          }
        >
          Синтез
        </button>
        {!panelOpen ? (
          <button
            type="button"
            className={
              reactorOpen ? `${styles.panelFab} ${styles.panelFabReactorOpen}` : styles.panelFab
            }
            onClick={() => setPanelOpen(true)}
            aria-expanded={panelOpen}
            aria-label="Открыть периодическую таблицу Менделеева (кнопка справа от сцены)"
          >
            ⊞
          </button>
        ) : null}
        <ElementSidePanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          onPickElement={onPickInTable}
          onAltPickElement={addAtom}
          layoutVariant={reactorOpen ? 'labCompact' : 'modal'}
        />
      </div>
    </div>
  )
}
