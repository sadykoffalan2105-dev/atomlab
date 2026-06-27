import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { SynthesisQualityLevel } from '../lab/synthesisQualityLadder'
import type { VrLabQualityTier } from '../components/vrLab/vrLabPerformance'
import { resetSynthesisDeviceTierCache } from '../lab/synthesisDeviceTier'
import {
  downgradeGraphicsPreset,
  presetToSynthesisCap,
  presetToVrTier,
  readStoredGraphicsPreset,
  resolveEffectiveGraphicsPreset,
  writeStoredGraphicsPreset,
  type GraphicsPreset,
} from './graphicsSettings'

export type GraphicsSettingsState = {
  /** Выбранный пользователем пресет (auto = авто). */
  preset: GraphicsPreset
  /** Фактический пресет после auto + runtime downgrade. */
  effectivePreset: Exclude<GraphicsPreset, 'auto'>
  synthesisCap: SynthesisQualityLevel
  vrTier: VrLabQualityTier
  setPreset: (preset: GraphicsPreset) => void
  /** Runtime FPS governor — понизить на один шаг. */
  runtimeDowngrade: () => void
  resetRuntimeDowngrade: () => void
}

const GraphicsSettingsContext = createContext<GraphicsSettingsState | null>(null)

export function GraphicsSettingsProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<GraphicsPreset>(() => readStoredGraphicsPreset())
  const [runtimeSteps, setRuntimeSteps] = useState(0)

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'atomlab.graphicsPreset' && e.newValue && e.newValue !== preset) {
        if (e.newValue === 'auto' || ['low', 'medium', 'high', 'ultra'].includes(e.newValue)) {
          setPresetState(e.newValue as GraphicsPreset)
          setRuntimeSteps(0)
        }
      }
    }
    const onCustom = (e: Event) => {
      const next = (e as CustomEvent<GraphicsPreset>).detail
      if (next) {
        setPresetState(next)
        setRuntimeSteps(0)
      }
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('atomlab:graphics-preset', onCustom)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('atomlab:graphics-preset', onCustom)
    }
  }, [preset])

  const setPreset = useCallback((next: GraphicsPreset) => {
    writeStoredGraphicsPreset(next)
    resetSynthesisDeviceTierCache()
    setPresetState(next)
    setRuntimeSteps(0)
  }, [])

  const baseEffective = useMemo(() => resolveEffectiveGraphicsPreset(preset), [preset])

  const effectivePreset = useMemo(() => {
    let p = baseEffective
    for (let i = 0; i < runtimeSteps; i += 1) {
      p = downgradeGraphicsPreset(p)
    }
    return p
  }, [baseEffective, runtimeSteps])

  const synthesisCap = useMemo(() => presetToSynthesisCap(effectivePreset), [effectivePreset])
  const vrTier = useMemo(() => presetToVrTier(effectivePreset), [effectivePreset])

  const runtimeDowngrade = useCallback(() => {
    setRuntimeSteps((s) => Math.min(s + 1, 3))
  }, [])

  const resetRuntimeDowngrade = useCallback(() => setRuntimeSteps(0), [])

  const value = useMemo<GraphicsSettingsState>(
    () => ({
      preset,
      effectivePreset,
      synthesisCap,
      vrTier,
      setPreset,
      runtimeDowngrade,
      resetRuntimeDowngrade,
    }),
    [
      preset,
      effectivePreset,
      synthesisCap,
      vrTier,
      setPreset,
      runtimeDowngrade,
      resetRuntimeDowngrade,
    ],
  )

  return (
    <GraphicsSettingsContext.Provider value={value}>
      {children}
    </GraphicsSettingsContext.Provider>
  )
}

export function useGraphicsSettings(): GraphicsSettingsState {
  const ctx = useContext(GraphicsSettingsContext)
  if (!ctx) {
    throw new Error('useGraphicsSettings requires GraphicsSettingsProvider')
  }
  return ctx
}

/** Безопасный доступ вне провайдера (SSR/tests). */
export function useGraphicsSettingsOptional(): GraphicsSettingsState | null {
  return useContext(GraphicsSettingsContext)
}
