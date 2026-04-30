import { useCallback, useMemo, useRef, useState } from 'react'
import { findCompoundMatchByReactorSlots } from '../chemistry/composition'
import {
  appendReactorZ,
  decrementReactorSlot,
  emptyReactorSlots,
  getFilledReactorZ,
  type ReactorSlot,
} from '../chemistry/reactorSlots'
import { ElementDetailContent } from '../components/lab/ElementDetailContent'
import { LabCanvas } from '../components/lab/LabScene'
import { ElementSidePanel } from '../components/lab/ElementSidePanel'
import { SynthesisReactorPanel } from '../components/lab/SynthesisReactorPanel'
import { compoundsSortedForMatch } from '../data/compounds'
import { getElementByZ } from '../data/elements'
import type { CompoundDef, LabParticle, Vec3 } from '../types/chemistry'
import styles from './LaboratoryPage.module.css'

function newId(): string {
  return crypto.randomUUID()
}

export function LaboratoryPage() {
  const [panelOpen, setPanelOpen] = useState(false)
  const [structureZ, setStructureZ] = useState<number | null>(null)
  const [particles, setParticles] = useState<LabParticle[]>([])

  const [reactorOpen, setReactorOpen] = useState(false)
  const [reactorSlots, setReactorSlots] = useState<ReactorSlot[]>(() => emptyReactorSlots())

  const [runId, setRunId] = useState(0)
  const [lastRunZs, setLastRunZs] = useState<number[]>([])
  /** Снимок z для текущего запуска, синхронно в onRequest (обход редкого пустого lastRunZs + runId>0). */
  const lastRunZSlotsRef = useRef<number[]>([])
  const [lastRunProduct, setLastRunProduct] = useState<CompoundDef | null>(null)
  const lastRunProductRef = useRef<CompoundDef | null>(null)

  const [reactorMessage, setReactorMessage] = useState<string | null>(null)
  /** Молекула-герой в центре после успешного синтеза (как в каталоге), пока не сброс/новый набор */
  const [synthesisSettledProduct, setSynthesisSettledProduct] = useState<CompoundDef | null>(null)
  /**
   * Режим сцены: выбор реагентов / анимация сближения (`reactor`) или
   * крупный кадр с 3D-молекулой как в карточке каталога (`substance`).
   */
  const [laboratorySynthesisView, setLaboratorySynthesisView] = useState<'reactor' | 'substance'>('reactor')

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
        setReactorSlots((prev) => appendReactorZ(prev, z))
        return
      }
      if (getElementByZ(z)) setStructureZ(z)
    },
    [reactorOpen],
  )

  const onReactorSlotTap = useCallback((index: number) => {
    setReactorSlots((prev) => decrementReactorSlot(prev, index))
  }, [])

  const clearReactorSlots = useCallback(() => {
    setReactorSlots(emptyReactorSlots())
    setReactorMessage(null)
    setSynthesisSettledProduct(null)
    setLaboratorySynthesisView('reactor')
  }, [])

  const toggleReactor = useCallback(() => {
    setReactorOpen((o) => {
      const next = !o
      if (!next) {
        setReactorSlots(emptyReactorSlots())
        setRunId(0)
        lastRunZSlotsRef.current = []
        setReactorMessage(null)
        setLastRunProduct(null)
        lastRunProductRef.current = null
        setSynthesisSettledProduct(null)
        setLaboratorySynthesisView('reactor')
      } else {
        setStructureZ(null)
        setReactorMessage('Наберите 2–4 атома в ряд (таблица), затем «Запустить синтез»')
      }
      return next
    })
  }, [])

  const onReactorAnimDone = useCallback((kind: 'success' | 'fail') => {
    if (kind === 'success') {
      const c = lastRunProductRef.current
      if (c) {
        /* Не добавляем `molecule` в `particles`: иначе на столе дублируется простой MoleculeMesh
           (CPK) рядом с героем в стиле каталога (SynthesisSettledProductHero). */
        setReactorMessage(
          `Получено: ${c.nameRu} ${c.formulaUnicode}. 3D показан в центре. Можно выбрать новый набор или закрыть реактор`,
        )
        setReactorSlots(emptyReactorSlots())
        setSynthesisSettledProduct(c)
        setLaboratorySynthesisView('substance')
      }
    } else {
      setReactorMessage(
        'Состав не сочетается с каталогом. Выберите другие элементы. Показан визуал разлёта тестовой пары: реального вещества в базе нет',
      )
    }
    lastRunZSlotsRef.current = []
    setLastRunZs([])
    setRunId(0)
  }, [])

  const onSynthesisStageChange = useCallback((stage: 'reactor' | 'substance') => {
    setLaboratorySynthesisView(stage)
  }, [])

  const onRequestRun = useCallback(() => {
    const filled = getFilledReactorZ(reactorSlots)
    if (filled.length < 2) return
    setLaboratorySynthesisView('reactor')
    const match = findCompoundMatchByReactorSlots(reactorSlots, compoundsSortedForMatch())
    const c = match.compound
    const filledSnapshot = filled.slice()
    lastRunZSlotsRef.current = filledSnapshot
    // #region agent log
    fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        sessionId: 'dbdb64',
        runId: 'composition-match',
        hypothesisId: 'H1',
        location: 'LaboratoryPage.tsx:onRequestRun',
        message: 'synthesis slots + catalog',
        data: {
          filled,
          zSlotsForScene: filledSnapshot.length,
          compoundId: c?.id ?? null,
          matchKind: match.kind,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    setLastRunZs(filledSnapshot)
    setReactorSlots(emptyReactorSlots())
    const prod = c ?? null
    lastRunProductRef.current = prod
    setLastRunProduct(prod)
    setRunId((k) => k + 1)
    if (c) {
      setReactorMessage(
        match.kind === 'auto'
          ? `Подобрано по каталогу: ${c.nameRu} ${c.formulaUnicode}. Связь…`
          : `Связь… ${c.nameRu}`,
      )
    } else {
      setReactorMessage('Такого соединения нет в каталоге')
    }
  }, [reactorSlots])

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
    const z = getFilledReactorZ(reactorSlots)
    return z.length >= 2 ? z : null
  }, [reactorOpen, runId, reactorSlots])

  const synthRunActive = reactorOpen && runId > 0
  const showSettledSynthesisView = reactorOpen && !synthRunActive && synthesisSettledProduct != null
  const showSynthProductHud = (synthRunActive && lastRunProduct != null) || showSettledSynthesisView
  const productForHud = synthRunActive && lastRunProduct != null ? lastRunProduct : synthesisSettledProduct

  return (
    <div className={styles.wrap} data-lab-synthesis-view={laboratorySynthesisView}>
      <div
        className={styles.canvasWrap}
        data-lab-synthesis-view={laboratorySynthesisView}
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
          slots={reactorSlots}
          onSlotTap={onReactorSlotTap}
          onClearSlots={clearReactorSlots}
          onRequestRun={onRequestRun}
          message={reactorMessage}
          dimInCatalogHeroView={laboratorySynthesisView === 'substance'}
        />

        <button
          type="button"
          className={`${styles.synthButton} ${reactorOpen ? styles.synthButtonActive : ''}`}
          onClick={toggleReactor}
          aria-pressed={reactorOpen}
          title={reactorOpen ? 'Закрыть панель реактора' : 'Открыть: набор атомов 2–4 в ряд, затем вещество из каталога'}
        >
          Синтез
        </button>
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
