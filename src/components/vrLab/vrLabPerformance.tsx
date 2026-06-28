import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { FIXED_VR_TIER, presetToVrTier } from '../../perf/graphicsSettings'

export type VrLabQualityTier = 'high' | 'medium' | 'low'

export interface VrLabPerfSettings {
  tier: VrLabQualityTier
  dpr: [number, number]
  shadows: boolean
  bloomIntensity: number
  bloomLevels: number
  particleCount: number
  steamCount: number
  shadowMapSize: number
  latheSegments: number
  postProcessing: boolean
  cinematicGlass: boolean
  ssao: boolean
  chromaticAberration: boolean
  toneMapping: boolean
  liquidShader: 'full' | 'simple' | 'cylinder'
  physics: boolean
}

const PRESETS: Record<VrLabQualityTier, Omit<VrLabPerfSettings, 'tier'>> = {
  high: {
    dpr: [1, 1.5],
    shadows: true,
    bloomIntensity: 0.88,
    bloomLevels: 5,
    particleCount: 24,
    steamCount: 32,
    shadowMapSize: 1024,
    latheSegments: 20,
    postProcessing: true,
    cinematicGlass: true,
    ssao: true,
    chromaticAberration: true,
    toneMapping: true,
    liquidShader: 'full',
    physics: true,
  },
  medium: {
    dpr: [1, 1.25],
    shadows: false,
    bloomIntensity: 0.62,
    bloomLevels: 3,
    particleCount: 16,
    steamCount: 16,
    shadowMapSize: 512,
    latheSegments: 16,
    postProcessing: true,
    cinematicGlass: false,
    ssao: true,
    chromaticAberration: false,
    toneMapping: true,
    liquidShader: 'simple',
    physics: false,
  },
  low: {
    dpr: [1, 1],
    shadows: false,
    bloomIntensity: 0.35,
    bloomLevels: 2,
    particleCount: 8,
    steamCount: 0,
    shadowMapSize: 512,
    latheSegments: 12,
    postProcessing: false,
    cinematicGlass: false,
    ssao: false,
    chromaticAberration: false,
    toneMapping: false,
    liquidShader: 'cylinder',
    physics: false,
  },
}

function webglSupported(): boolean {
  if (typeof document === 'undefined') return true
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/** Качество VR: high на мощных устройствах, medium на слабых. */
export function detectVrLabQuality(): VrLabQualityTier {
  return presetToVrTier()
}

export function buildVrLabPerfSettings(tier: VrLabQualityTier = detectVrLabQuality()): VrLabPerfSettings {
  return { tier, ...PRESETS[tier] }
}

const VrLabPerfContext = createContext<VrLabPerfSettings>(buildVrLabPerfSettings())

export function useVrLabPerf(): VrLabPerfSettings {
  return useContext(VrLabPerfContext)
}

export function VrLabPerfProvider({
  children,
  tier,
}: {
  children: ReactNode
  tier?: VrLabQualityTier
}) {
  const settings = useMemo(
    () => buildVrLabPerfSettings(tier ?? FIXED_VR_TIER),
    [tier],
  )
  return <VrLabPerfContext.Provider value={settings}>{children}</VrLabPerfContext.Provider>
}

export { webglSupported }
