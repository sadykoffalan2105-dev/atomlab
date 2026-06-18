import { createContext, useContext, useMemo, type ReactNode } from 'react'

export type VrLabQualityTier = 'high' | 'medium' | 'low'

export interface VrLabPerfSettings {
  tier: VrLabQualityTier
  dpr: [number, number]
  shadows: boolean
  useTransmission: boolean
  useReflector: boolean
  bloomIntensity: number
  bloomLevels: number
  particleCount: number
  steamCount: number
  shadowMapSize: number
  latheSegments: number
  decorPointLights: boolean
  postProcessing: boolean
}

const PRESETS: Record<VrLabQualityTier, Omit<VrLabPerfSettings, 'tier'>> = {
  high: {
    dpr: [1, 2],
    shadows: true,
    useTransmission: true,
    useReflector: true,
    bloomIntensity: 0.95,
    bloomLevels: 5,
    particleCount: 36,
    steamCount: 48,
    shadowMapSize: 2048,
    latheSegments: 24,
    decorPointLights: true,
    postProcessing: true,
  },
  medium: {
    dpr: [1, 1.5],
    shadows: true,
    useTransmission: false,
    useReflector: true,
    bloomIntensity: 0.7,
    bloomLevels: 4,
    particleCount: 20,
    steamCount: 24,
    shadowMapSize: 1024,
    latheSegments: 16,
    decorPointLights: false,
    postProcessing: true,
  },
  low: {
    dpr: [1, 1],
    shadows: false,
    useTransmission: false,
    useReflector: false,
    bloomIntensity: 0.45,
    bloomLevels: 3,
    particleCount: 10,
    steamCount: 0,
    shadowMapSize: 512,
    latheSegments: 12,
    decorPointLights: false,
    postProcessing: true,
  },
}

/** Авто-определение качества: защита от лагов на слабых устройствах. */
export function detectVrLabQuality(): VrLabQualityTier {
  if (typeof window === 'undefined') return 'medium'
  try {
    const cores = navigator.hardwareConcurrency ?? 4
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    if (isMobile || cores <= 2 || mem <= 2) return 'low'
    if (cores >= 8 && mem >= 8 && !isMobile) return 'high'
    return 'medium'
  } catch {
    return 'medium'
  }
}

export function buildVrLabPerfSettings(tier: VrLabQualityTier = detectVrLabQuality()): VrLabPerfSettings {
  return { tier, ...PRESETS[tier] }
}

const VrLabPerfContext = createContext<VrLabPerfSettings>(buildVrLabPerfSettings())

export function useVrLabPerf(): VrLabPerfSettings {
  return useContext(VrLabPerfContext)
}

export function VrLabPerfProvider({ children, tier }: { children: ReactNode; tier?: VrLabQualityTier }) {
  const settings = useMemo(() => buildVrLabPerfSettings(tier ?? detectVrLabQuality()), [tier])
  return <VrLabPerfContext.Provider value={settings}>{children}</VrLabPerfContext.Provider>
}
