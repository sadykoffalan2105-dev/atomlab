/** Грубая оценка GPU/CPU — влияет только на cap качества, не на UI. */
export type SynthesisDeviceTier = 'low' | 'normal'

let cachedTier: SynthesisDeviceTier | null = null
let runtimeLowSamples = 0

type GpuClass = 'weak' | 'mid' | 'strong' | 'unknown'

function readWebGlRenderer(): string {
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

function classifyGpu(renderer: string): GpuClass {
  const r = renderer.toLowerCase()
  if (!r) return 'unknown'
  if (
    /swiftshader|llvmpipe|microsoft basic render|software rasterizer/.test(r) ||
    /intel.*(hd graphics|hd 4\d{3}|uhd graphics 6[0-2]\d)/.test(r) ||
    /mali-4|mali-t[0-6]|adreno \(tm\) [34]/.test(r) ||
    /angle.*intel.*hd/.test(r)
  ) {
    return 'weak'
  }
  if (
    /nvidia|geforce|rtx|gtx|quadro/.test(r) ||
    /radeon rx|amd radeon rx|vega/.test(r) ||
    /apple m[0-9]|apple gpu/.test(r) ||
    /iris xe|iris plus|arc a[0-9]/.test(r)
  ) {
    return 'strong'
  }
  if (/intel|iris|uhd|adreno|mali|angle/.test(r)) return 'mid'
  return 'unknown'
}

function scoreDevice(): number {
  let score = 52

  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 4 : 4
  if (cores >= 8) score += 14
  else if (cores >= 6) score += 6
  else if (cores <= 2) score -= 22
  else if (cores <= 4) score -= 10

  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (mem != null) {
    if (mem >= 8) score += 12
    else if (mem >= 6) score += 4
    else if (mem <= 2) score -= 20
    else if (mem <= 4) score -= 12
  }

  const renderer = readWebGlRenderer()
  const gpu = classifyGpu(renderer)
  if (gpu === 'weak') score -= 28
  else if (gpu === 'mid') score -= 6
  else if (gpu === 'strong') score += 14

  if (typeof navigator !== 'undefined') {
    const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
    if (mobile) score -= 16
  }

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  if (dpr >= 2.5 && gpu !== 'strong') score -= 8

  return score
}

export function getSynthesisDeviceTier(): SynthesisDeviceTier {
  if (cachedTier) return cachedTier
  cachedTier = scoreDevice() < 36 ? 'low' : 'normal'
  return cachedTier
}

/** Если статическая оценка ошиблась — понижаем tier на сессию по FPS. */
export function refineSynthesisDeviceTierFromFps(fps: number): void {
  if (cachedTier === 'low') return
  if (fps < 36) runtimeLowSamples += 1
  else runtimeLowSamples = Math.max(0, runtimeLowSamples - 2)
  if (runtimeLowSamples >= 10) {
    cachedTier = 'low'
    runtimeLowSamples = 0
  }
}

export function resetSynthesisDeviceTierCache(): void {
  cachedTier = null
  runtimeLowSamples = 0
}
