import type { SynthesisDeviceTier } from './synthesisDeviceTier'
import { SYNTHESIS_PERF } from './synthesisPerfPreset'

/** Профиль для Snapdragon / слабых GPU — без лагов и без лишних эффектов. */
export type LowPowerDeviceProfile = {
  tier: SynthesisDeviceTier
  /** Snapdragon / Adreno / Mali mobile SoC */
  isMobileSoc: boolean
  forceLiteReactor: boolean
  maxAnimatedAtoms: number
  minElectronFrameSkip: number
  canvasDpr: number
  disableAtomDrift: boolean
  disableSlowSpin: boolean
  productPaintLatchFrames: number
  coeffEditLayoutDebounceMs: number
}

function readRenderer(): string {
  if (typeof document === 'undefined') return ''
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2', { powerPreference: 'high-performance' }) ??
      canvas.getContext('webgl', { powerPreference: 'high-performance' })
    if (!gl) return ''
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (!ext) return ''
    return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '')
  } catch {
    return ''
  }
}

function isSnapdragonUa(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return /snapdragon|qualcomm|sm[0-9]{4}|xiaomi|redmi|poco|realme|oppo|vivo|oneplus/.test(ua)
}

function isMobileSocGpu(renderer: string): boolean {
  const r = renderer.toLowerCase()
  return (
    /adreno|mali|powervr|apple gpu|apple m[0-9]/.test(r) ||
    /angle.*adreno|angle.*mali/.test(r)
  )
}

let cached: LowPowerDeviceProfile | null = null

export function getLowPowerDeviceProfile(deviceTier: SynthesisDeviceTier): LowPowerDeviceProfile {
  if (cached && cached.tier === deviceTier) return cached

  const renderer = readRenderer()
  const mobileSoc = isSnapdragonUa() || isMobileSocGpu(renderer)
  const low = deviceTier === 'low' || mobileSoc

  cached = {
    tier: deviceTier,
    isMobileSoc: mobileSoc,
    forceLiteReactor: low,
    maxAnimatedAtoms: low ? 12 : SYNTHESIS_PERF.maxAnimatedAtoms,
    minElectronFrameSkip: low ? 3 : 1,
    canvasDpr: low ? 1 : 1.5,
    disableAtomDrift: low,
    disableSlowSpin: low,
    productPaintLatchFrames: low ? 2 : 4,
    coeffEditLayoutDebounceMs: low ? 48 : 32,
  }
  return cached
}

export function resetLowPowerDeviceProfileCache(): void {
  cached = null
}
