import { useCallback, useEffect, useRef, useState } from 'react'
import { mixVrLabSubstances } from './mixEngine'
import { productVisualAfterMix, substanceVisual } from './substanceVisuals'
import type { VrLabBenchState, VrLabTubeContent } from './types'
import { VR_COMBINE_MS, VR_POUR_MS, VR_REACT_MS, mixHexColors } from './vrLabAnimation'

const DEFAULT_TUBES = [
  { id: 'tube-1', label: '1' },
  { id: 'tube-2', label: '2' },
  { id: 'tube-3', label: '3' },
  { id: 'tube-4', label: '4' },
] as const

function makeContent(compoundId: string, fillLevel = 0.72): VrLabTubeContent {
  const v = substanceVisual(compoundId)
  return {
    compoundId,
    fillLevel,
    liquidColor: v.liquidColor,
  }
}

const INITIAL: VrLabBenchState = {
  tubes: DEFAULT_TUBES.map((t) => ({ ...t, content: null })),
  beaker: null,
  selectedTubeId: 'tube-1',
  mixing: false,
  lastMix: null,
  animProgress: 0,
  animPhase: 'idle',
  pourTubeId: null,
  pourCompoundId: null,
  mixColor: null,
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
        // ~30 fps для React — меньше лагов при анимации наливания/смешивания
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

  const selectTube = useCallback((tubeId: string) => {
    setState((s) => ({ ...s, selectedTubeId: tubeId }))
  }, [])

  const fillSelectedTube = useCallback(
    (compoundId: string) => {
      clearAnim()
      setState((s) => {
        const tubeId = s.selectedTubeId
        if (!tubeId) return s
        return {
          ...s,
          pourTubeId: tubeId,
          pourCompoundId: compoundId,
          animPhase: 'pouring' as const,
          animProgress: 0,
          lastMix: null,
          tubes: s.tubes.map((t) =>
            t.id === tubeId ? { ...t, content: makeContent(compoundId, 0.72) } : t,
          ),
        }
      })

      runAnim(VR_POUR_MS, 'pouring', () => {
        setState((s) => ({
          ...s,
          animPhase: 'idle',
          animProgress: 0,
          pourTubeId: null,
          pourCompoundId: null,
        }))
      })
    },
    [clearAnim, runAnim],
  )

  const emptyTube = useCallback((tubeId: string) => {
    clearAnim()
    setState((s) => ({
      ...s,
      tubes: s.tubes.map((t) => (t.id === tubeId ? { ...t, content: null } : t)),
      animPhase: 'idle',
      animProgress: 0,
    }))
  }, [clearAnim])

  const emptyAll = useCallback(() => {
    clearAnim()
    setState({ ...INITIAL, selectedTubeId: state.selectedTubeId })
  }, [clearAnim, state.selectedTubeId])

  const mixTubes = useCallback(
    (tubeIdA: string, tubeIdB: string) => {
      clearAnim()
      setState((s) => {
        const a = s.tubes.find((t) => t.id === tubeIdA)?.content
        const b = s.tubes.find((t) => t.id === tubeIdB)?.content
        const result = mixVrLabSubstances(a?.compoundId, b?.compoundId)

        if (result.kind === 'reaction' && result.productId && a && b) {
          const vis = productVisualAfterMix(result.productId, result.heat)
          const blend = mixHexColors(a.liquidColor, b.liquidColor, 0.5)

          requestAnimationFrame(() => {
            runAnim(VR_COMBINE_MS, 'combining', () => {
              setState((cur) => ({
                ...cur,
                tubes: cur.tubes.map((t) =>
                  t.id === tubeIdA || t.id === tubeIdB ? { ...t, content: null } : t,
                ),
                beaker: {
                  compoundId: result.productId!,
                  fillLevel: 0.15,
                  liquidColor: blend,
                },
                animPhase: 'reacting',
                animProgress: 0,
              }))

              runAnim(VR_REACT_MS, 'reacting', () => {
                setState((cur) => ({
                  ...cur,
                  mixing: false,
                  animPhase: 'idle',
                  animProgress: 0,
                  mixColor: null,
                  beaker: {
                    compoundId: result.productId!,
                    fillLevel: 0.78,
                    liquidColor: vis.liquidColor,
                  },
                }))
              })
            })
          })

          return {
            ...s,
            mixing: true,
            lastMix: result,
            animPhase: 'combining' as const,
            animProgress: 0,
            mixColor: blend,
          }
        }

        return {
          ...s,
          mixing: result.kind !== 'empty' && result.kind !== 'noReaction',
          lastMix: result,
          beaker:
            result.kind === 'sameSubstance' && a
              ? { ...a, fillLevel: Math.min(0.95, a.fillLevel + 0.08) }
              : s.beaker,
        }
      })
    },
    [clearAnim, runAnim],
  )

  const mixSelectedPair = useCallback(() => {
    mixTubes('tube-1', 'tube-2')
  }, [mixTubes])

  return {
    state,
    selectTube,
    fillSelectedTube,
    emptyTube,
    emptyAll,
    mixTubes,
    mixSelectedPair,
  }
}

export type VrLabBenchApi = ReturnType<typeof useVrLabBench>
