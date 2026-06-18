import { useCallback, useState } from 'react'
import { mixVrLabSubstances } from './mixEngine'
import { productVisualAfterMix, substanceVisual } from './substanceVisuals'
import type { VrLabBenchState, VrLabMixResult, VrLabTubeContent } from './types'

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

export function useVrLabBench() {
  const [state, setState] = useState<VrLabBenchState>(() => ({
    tubes: DEFAULT_TUBES.map((t) => ({ ...t, content: null })),
    beaker: null,
    selectedTubeId: 'tube-1',
    mixing: false,
    lastMix: null,
  }))

  const selectTube = useCallback((tubeId: string) => {
    setState((s) => ({ ...s, selectedTubeId: tubeId }))
  }, [])

  const fillSelectedTube = useCallback((compoundId: string) => {
    setState((s) => {
      if (!s.selectedTubeId) return s
      return {
        ...s,
        tubes: s.tubes.map((t) =>
          t.id === s.selectedTubeId ? { ...t, content: makeContent(compoundId) } : t,
        ),
        lastMix: null,
      }
    })
  }, [])

  const emptyTube = useCallback((tubeId: string) => {
    setState((s) => ({
      ...s,
      tubes: s.tubes.map((t) => (t.id === tubeId ? { ...t, content: null } : t)),
    }))
  }, [])

  const emptyAll = useCallback(() => {
    setState((s) => ({
      ...s,
      tubes: s.tubes.map((t) => ({ ...t, content: null })),
      beaker: null,
      lastMix: null,
      mixing: false,
    }))
  }, [])

  const mixTubes = useCallback((tubeIdA: string, tubeIdB: string) => {
    setState((s) => {
      const a = s.tubes.find((t) => t.id === tubeIdA)?.content
      const b = s.tubes.find((t) => t.id === tubeIdB)?.content
      const result: VrLabMixResult = mixVrLabSubstances(a?.compoundId, b?.compoundId)

      if (result.kind === 'reaction' && result.productId) {
        const vis = productVisualAfterMix(result.productId, result.heat)
        return {
          ...s,
          mixing: true,
          lastMix: result,
          beaker: {
            compoundId: result.productId,
            fillLevel: 0.78,
            liquidColor: vis.liquidColor,
          },
          tubes: s.tubes.map((t) =>
            t.id === tubeIdA || t.id === tubeIdB ? { ...t, content: null } : t,
          ),
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

    window.setTimeout(() => {
      setState((s) => ({ ...s, mixing: false }))
    }, 2200)
  }, [])

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
