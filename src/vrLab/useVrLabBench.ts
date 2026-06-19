import { useCallback, useEffect, useRef, useState } from 'react'
import { mixVrLabSubstances } from './mixEngine'
import { productVisualAfterMix, substanceVisual } from './substanceVisuals'
import type { VrLabBenchState, VrLabSelectionTarget, VrLabShelfFlask, VrLabTubeContent } from './types'
import { VR_COMBINE_MS, VR_POUR_MS, VR_REACT_MS, mixHexColors } from './vrLabAnimation'
import {
  BENCH_Y,
  BENCH_Z,
  SHELF_FLASK_COUNT,
  shelfFlaskId,
  shelfFlaskLabel,
  shelfSlotPosition,
  snapFlaskPlacement,
} from './vrLabShelfLayout'

function makeContent(compoundId: string, fillLevel = 0.68): VrLabTubeContent {
  const v = substanceVisual(compoundId)
  return {
    compoundId,
    fillLevel,
    liquidColor: v.liquidColor,
    emissive: v.emissive,
    glow: v.glow,
    opacity: v.opacity,
    viscosity: v.viscosity,
  }
}

function makeInitialShelfFlasks(): VrLabShelfFlask[] {
  return Array.from({ length: SHELF_FLASK_COUNT }, (_, i) => ({
    id: shelfFlaskId(i),
    label: shelfFlaskLabel(i),
    content: null,
    slotIndex: i,
    onShelf: true,
    position: shelfSlotPosition(i),
  }))
}

const INITIAL: VrLabBenchState = {
  shelfFlasks: makeInitialShelfFlasks(),
  beaker: null,
  vatReagentA: null,
  selectedTarget: { kind: 'shelf', id: 'shelf-1' },
  mixing: false,
  lastMix: null,
  animProgress: 0,
  animPhase: 'idle',
  pourShelfFlaskId: null,
  pourCompoundId: null,
  mixColor: null,
}

function emptyFlask(id: string, flasks: VrLabShelfFlask[]): VrLabShelfFlask[] {
  return flasks.map((f) => (f.id === id ? { ...f, content: null } : f))
}

export function useVrLabBench() {
  const [state, setState] = useState<VrLabBenchState>(INITIAL)
  const animRef = useRef<number | null>(null)

  const clearAnim = useCallback(() => {
    if (animRef.current != null) {
      cancelAnimationFrame(animRef.current)
      animRef.current = null
    }
  }, [])

  useEffect(() => clearAnim, [clearAnim])

  const runAnim = useCallback(
    (durationMs: number, phase: VrLabBenchState['animPhase'], onDone: () => void) => {
      clearAnim()
      const t0 = performance.now()
      let lastUiUpdate = 0
      const tick = () => {
        const p = Math.min(1, (performance.now() - t0) / durationMs)
        const now = performance.now()
        if (now - lastUiUpdate > 32 || p >= 1) {
          setState((s) => ({ ...s, animProgress: p, animPhase: phase }))
          lastUiUpdate = now
        }
        if (p < 1) {
          animRef.current = requestAnimationFrame(tick)
        } else {
          animRef.current = null
          onDone()
        }
      }
      animRef.current = requestAnimationFrame(tick)
    },
    [clearAnim],
  )

  const selectTarget = useCallback((target: VrLabSelectionTarget) => {
    setState((s) => ({ ...s, selectedTarget: target }))
  }, [])

  const selectShelfFlask = useCallback(
    (flaskId: string) => selectTarget({ kind: 'shelf', id: flaskId }),
    [selectTarget],
  )

  const selectVat = useCallback(() => selectTarget({ kind: 'vat' }), [selectTarget])

  const fillSelectedFlask = useCallback(
    (compoundId: string) => {
      clearAnim()
      setState((s) => {
        const target = s.selectedTarget
        if (target?.kind !== 'shelf') return s
        return {
          ...s,
          pourShelfFlaskId: target.id,
          pourCompoundId: compoundId,
          animPhase: 'pouring' as const,
          animProgress: 0,
          lastMix: null,
          shelfFlasks: s.shelfFlasks.map((f) =>
            f.id === target.id ? { ...f, content: makeContent(compoundId, 0.68) } : f,
          ),
        }
      })

      runAnim(VR_POUR_MS, 'pouring', () => {
        setState((s) => ({
          ...s,
          animPhase: 'idle',
          animProgress: 0,
          pourShelfFlaskId: null,
          pourCompoundId: null,
        }))
      })
    },
    [clearAnim, runAnim],
  )

  const startVatReaction = useCallback(
    (a: VrLabTubeContent, b: VrLabTubeContent, shelfId: string) => {
      const result = mixVrLabSubstances(a.compoundId, b.compoundId)
      const blend = mixHexColors(a.liquidColor, b.liquidColor, 0.5)

      if (result.kind === 'reaction' && result.productId) {
        const vis = productVisualAfterMix(result.productId, result.heat)
        setState((s) => ({
          ...s,
          mixing: true,
          lastMix: result,
          mixColor: blend,
          vatReagentA: null,
          shelfFlasks: emptyFlask(shelfId, s.shelfFlasks),
          beaker: {
            compoundId: result.productId!,
            fillLevel: 0.18,
            liquidColor: blend,
            emissive: vis.emissive,
            glow: vis.glow,
            opacity: vis.opacity,
            viscosity: vis.viscosity,
          },
          animPhase: 'combining',
          animProgress: 0,
        }))

        runAnim(VR_COMBINE_MS, 'combining', () => {
          setState((cur) => ({ ...cur, animPhase: 'reacting', animProgress: 0 }))
          runAnim(VR_REACT_MS, 'reacting', () => {
            setState((cur) => ({
              ...cur,
              mixing: false,
              animPhase: 'idle',
              animProgress: 0,
              mixColor: null,
              beaker: {
                compoundId: result.productId!,
                fillLevel: 0.72,
                liquidColor: vis.liquidColor,
                emissive: vis.emissive,
                glow: vis.glow,
                opacity: vis.opacity,
                viscosity: vis.viscosity,
              },
            }))
          })
        })
        return
      }

      setState((s) => ({
        ...s,
        mixing: result.kind !== 'empty' && result.kind !== 'noReaction',
        lastMix: result,
        vatReagentA: null,
        shelfFlasks: emptyFlask(shelfId, s.shelfFlasks),
        beaker:
          result.kind === 'sameSubstance'
            ? { ...a, fillLevel: Math.min(0.88, a.fillLevel + 0.12) }
            : {
                ...b,
                fillLevel: 0.55,
                liquidColor: blend,
                emissive: mixHexColors(a.emissive, b.emissive, 0.5),
              },
        animPhase: 'idle',
        animProgress: 0,
        pourShelfFlaskId: null,
      }))
    },
    [runAnim],
  )

  /** Перелить выбранную колбу в чан. Второй реагент запускает смешивание. */
  const pourSelectedToVat = useCallback(() => {
    clearAnim()
    let afterPour: (() => void) | null = null
    let shouldAnim = false

    setState((s) => {
      const shelfId = s.selectedTarget?.kind === 'shelf' ? s.selectedTarget.id : null
      if (!shelfId) return s
      const flask = s.shelfFlasks.find((f) => f.id === shelfId)
      if (!flask?.content) return s

      const content = { ...flask.content }
      const base = {
        pourShelfFlaskId: shelfId,
        animPhase: 'pouring' as const,
        animProgress: 0,
        shelfFlasks: emptyFlask(shelfId, s.shelfFlasks),
      }

      if (!s.vatReagentA) {
        shouldAnim = true
        afterPour = () => {
          setState((cur) => ({
            ...cur,
            animPhase: 'idle',
            animProgress: 0,
            pourShelfFlaskId: null,
          }))
        }
        return {
          ...s,
          ...base,
          vatReagentA: content,
          beaker: { ...content, fillLevel: 0.38 },
          lastMix: null,
        }
      }

      const reagentA = s.vatReagentA
      shouldAnim = true
      afterPour = () => startVatReaction(reagentA, content, shelfId)
      return { ...s, ...base }
    })

    if (!shouldAnim) return
    runAnim(VR_POUR_MS, 'pouring', () => {
      afterPour?.()
    })
  }, [clearAnim, runAnim, startVatReaction])

  const emptyShelfFlask = useCallback((flaskId: string) => {
    clearAnim()
    setState((s) => ({
      ...s,
      shelfFlasks: emptyFlask(flaskId, s.shelfFlasks),
      animPhase: 'idle',
      animProgress: 0,
    }))
  }, [clearAnim])

  const emptyVat = useCallback(() => {
    clearAnim()
    setState((s) => ({
      ...s,
      beaker: null,
      vatReagentA: null,
      mixing: false,
      mixColor: null,
      animPhase: 'idle',
      animProgress: 0,
    }))
  }, [clearAnim])

  const emptyAll = useCallback(() => {
    clearAnim()
    setState((s) => ({
      ...INITIAL,
      selectedTarget: s.selectedTarget,
    }))
  }, [clearAnim])

  const moveShelfFlask = useCallback((flaskId: string, pos: [number, number, number]) => {
    setState((s) => {
      const snapped = snapFlaskPlacement(pos)
      const flasks = s.shelfFlasks.map((f) => {
        if (f.id === flaskId) {
          return {
            ...f,
            position: snapped.position,
            slotIndex: snapped.slotIndex,
            onShelf: snapped.onShelf,
          }
        }
        if (snapped.slotIndex != null && f.slotIndex === snapped.slotIndex) {
          return {
            ...f,
            slotIndex: null,
            onShelf: false,
            position: [f.position[0], BENCH_Y, BENCH_Z] as [number, number, number],
          }
        }
        return f
      })
      return { ...s, shelfFlasks: flasks }
    })
  }, [])

  return {
    state,
    selectTarget,
    selectShelfFlask,
    selectVat,
    fillSelectedFlask,
    pourSelectedToVat,
    emptyShelfFlask,
    emptyVat,
    emptyAll,
    moveShelfFlask,
  }
}

export type VrLabBenchApi = ReturnType<typeof useVrLabBench>
