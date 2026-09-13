/** Грубая оценка GPU/CPU — влияет только на cap качества, не на UI. */
export type SynthesisDeviceTier = 'low' | 'normal'

/**
 * Класс GPU по строке рендерера.
 * software — программный растеризатор (SwiftShader / llvmpipe / Basic Render);
 * weak — старые iGPU и бюджетные мобильные; mid — современные iGPU и мобильные среднего класса;
 * strong — дискретные GPU и Apple Silicon на десктопе.
 */
export type GpuClass = 'software' | 'weak' | 'mid' | 'strong' | 'unknown'

export type DeviceFormFactor = 'phone' | 'tablet' | 'desktop'

/** Сырые сигналы устройства — отдельно от чтения браузера, чтобы классификацию можно было тестировать в Node. */
export type DeviceSignals = {
  userAgent: string
  /** UNMASKED_RENDERER_WEBGL (или RENDERER, если расширение недоступно). */
  renderer: string
  hardwareConcurrency?: number | null
  /** navigator.deviceMemory (только Chromium; Safari/Firefox — нет). */
  deviceMemory?: number | null
  maxTouchPoints?: number | null
  devicePixelRatio?: number | null
  /** navigator.userAgentData.mobile (Chromium). */
  uaMobile?: boolean | null
  /** navigator.connection.saveData */
  saveData?: boolean | null
}

export type DeviceClassification = {
  tier: SynthesisDeviceTier
  gpu: GpuClass
  formFactor: DeviceFormFactor
  /** Мобильный SoC (телефон/планшет, Android, Adreno/Mali/PowerVR) — дешёвый путь FX. */
  isMobileSoc: boolean
  /** Apple Silicon (M-серия / «Apple GPU») на десктопном Mac. */
  isAppleSiliconDesktop: boolean
  score: number
}

const TIER_LOW_SCORE = 40

/** Android-вендоры и Qualcomm в UA — почти всегда бюджетный/средний мобильный SoC. */
const ANDROID_SOC_UA = /snapdragon|qualcomm|\bsm[0-9]{4}\b|xiaomi|redmi|poco|realme|oppo|vivo|oneplus/

export function detectDeviceFormFactor(
  signals: Pick<DeviceSignals, 'userAgent' | 'maxTouchPoints' | 'uaMobile'>,
): DeviceFormFactor {
  const ua = signals.userAgent.toLowerCase()
  const touch = signals.maxTouchPoints ?? 0
  if (/iphone|ipod/.test(ua)) return 'phone'
  if (/ipad/.test(ua)) return 'tablet'
  // iPadOS 13+ отдаёт десктопный UA «Macintosh»; настоящий Mac не имеет мультитача.
  if (/macintosh/.test(ua) && touch > 1) return 'tablet'
  if (/android/.test(ua)) return /mobile/.test(ua) ? 'phone' : 'tablet'
  if (signals.uaMobile === true) return 'phone'
  if (/windows phone|blackberry|opera mini|iemobile|\bmobile\b/.test(ua)) return 'phone'
  return 'desktop'
}

/** Классификация GPU по строке рендерера (ANGLE / Metal / нативные драйверы). */
export function classifyGpuRenderer(
  renderer: string,
  formFactor: DeviceFormFactor = 'desktop',
): GpuClass {
  const r = renderer.toLowerCase()
  if (!r) return 'unknown'

  if (/swiftshader|llvmpipe|softpipe|microsoft basic render|software rasterizer|mesa offscreen/.test(r)) {
    return 'software'
  }

  // Apple: M-серия/«Apple GPU» на десктопе — сильный; на iPhone/iPad — мобильный средний.
  if (/apple m[0-9]|apple gpu|apple a[0-9]{2}/.test(r)) {
    return formFactor === 'desktop' ? 'strong' : 'mid'
  }

  // Intel: Arc (дискретный) — сильный; Iris Xe / Iris Plus / Arc iGPU — средний; HD/UHD — слабый.
  if (/intel|iris|uhd graphics|hd graphics/.test(r)) {
    if (/arc\(tm\) a[0-9]|arc a[0-9]{3}|arc b[0-9]{3}/.test(r)) return 'strong'
    if (/iris|arc/.test(r)) return 'mid'
    // Слабые — только старые HD Graphics и UHD 6xx (Gen9/9.5). UHD 7xx и «UHD Graphics (0x…)»
    // — это Xe-LP (как Iris Xe в одноканальной памяти), их оставляем средними.
    if (/uhd graphics 6[0-9]{2}\b|(^|[^u])hd graphics|gma|\bhd [0-9]{3,4}\b/.test(r)) return 'weak'
    return 'mid'
  }

  // NVIDIA: старые GT и MX — не сильные; GTX/RTX/Quadro — сильные.
  if (/nvidia|geforce|quadro|tesla/.test(r)) {
    if (/geforce gt [0-9]{3}\b|geforce [0-9]{3}m?\b|nvs /.test(r)) return 'weak'
    if (/\bmx ?[0-9]{3}\b/.test(r)) return 'mid'
    if (/gtx|rtx|quadro|titan/.test(r)) return 'strong'
    return 'mid'
  }

  // AMD: RX / Pro — сильные; встроенные Radeon (Vega, 680M, «Radeon Graphics») — средние.
  if (/amd|radeon|\bati technologies/.test(r)) {
    if (/radeon (hd|r[2-5])\b/.test(r)) return 'weak'
    if (/radeon rx|radeon pro|radeon vii|firepro/.test(r)) return 'strong'
    return 'mid'
  }

  // Qualcomm Adreno: X-серия (Windows on ARM) — средний; 6[0-1]x и старше — слабые; 7xx/8xx — средние.
  if (/adreno/.test(r)) {
    if (/adreno[^0-9x]*x[0-9]/.test(r)) return 'mid'
    const m = /adreno[^0-9]*([0-9]{3})/.exec(r)
    if (!m) return 'weak'
    const n = Number(m[1])
    if (n < 620) return 'weak'
    return 'mid'
  }

  // ARM Mali: Utgard/Midgard и бюджетные Bifrost (G31/G51/G52/G57) — слабые.
  if (/mali/.test(r)) {
    if (/mali-[0-9]{3}\b|mali-t[0-9]|mali-g(31|51|52|57)\b/.test(r)) return 'weak'
    return 'mid'
  }

  if (/powervr|img tech|vivante|videocore|tegra [2-4]/.test(r)) return 'weak'
  if (/tegra|samsung xclipse|xclipse|maleoon|immortalis/.test(r)) return 'mid'

  return 'unknown'
}

function isMobileGpuRenderer(renderer: string): boolean {
  const r = renderer.toLowerCase()
  if (/adreno[^0-9x]*x[0-9]/.test(r)) return false
  return /adreno|mali|powervr|immortalis|xclipse|maleoon|videocore|vivante/.test(r)
}

/** Чистая классификация: сигналы → tier + GPU + форм-фактор. */
export function classifyDevice(signals: DeviceSignals): DeviceClassification {
  const ua = signals.userAgent.toLowerCase()
  const formFactor = detectDeviceFormFactor(signals)
  const gpu = classifyGpuRenderer(signals.renderer, formFactor)
  const androidSoc = /android/.test(ua) || ANDROID_SOC_UA.test(ua)
  const isMobileSoc =
    formFactor !== 'desktop' || androidSoc || isMobileGpuRenderer(signals.renderer)
  const isAppleSiliconDesktop =
    formFactor === 'desktop' && /apple m[0-9]|apple gpu/.test(signals.renderer.toLowerCase())

  let score = 50

  if (gpu === 'strong') score += 18
  else if (gpu === 'unknown') score -= 4

  const cores = signals.hardwareConcurrency
  if (cores != null && cores > 0) {
    if (cores >= 8) score += 10
    else if (cores >= 6) score += 4
    else if (cores <= 2) score -= 24
    else if (cores <= 4) score -= 10
  }

  const mem = signals.deviceMemory
  if (mem != null && mem > 0) {
    if (mem >= 8) score += 8
    else if (mem >= 6) score += 3
    else if (mem <= 2) score -= 22
    else if (mem <= 4) score -= 8
  }

  if (formFactor === 'phone') score -= 18
  else if (formFactor === 'tablet') score -= 10
  if (ANDROID_SOC_UA.test(ua)) score -= 10

  const dpr = signals.devicePixelRatio ?? 1
  if (dpr >= 2.5 && gpu !== 'strong') score -= 6
  if (signals.saveData) score -= 10

  // Программный рендер и слабый GPU — всегда дешёвый путь, независимо от CPU/RAM.
  const forcedLow = gpu === 'software' || gpu === 'weak'
  const tier: SynthesisDeviceTier = forcedLow || score < TIER_LOW_SCORE ? 'low' : 'normal'

  return { tier, gpu, formFactor, isMobileSoc, isAppleSiliconDesktop, score }
}

let rendererCache: string | null = null

/**
 * Один probe-контекст на сессию; контекст сразу освобождается через WEBGL_lose_context,
 * чтобы не упираться в лимит живых WebGL-контекстов браузера.
 */
export function readWebGlRendererString(): string {
  if (rendererCache != null) return rendererCache
  if (typeof document === 'undefined') return ''
  let result = ''
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const gl =
      (canvas.getContext('webgl2', { powerPreference: 'high-performance' }) as
        | WebGL2RenderingContext
        | null) ??
      (canvas.getContext('webgl', { powerPreference: 'high-performance' }) as
        | WebGLRenderingContext
        | null)
    if (gl) {
      try {
        const ext = gl.getExtension('WEBGL_debug_renderer_info')
        result = String(
          (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) ?? '',
        )
      } finally {
        gl.getExtension('WEBGL_lose_context')?.loseContext()
      }
    }
  } catch {
    result = ''
  }
  rendererCache = result
  return result
}

export function readDeviceSignals(): DeviceSignals {
  if (typeof navigator === 'undefined') {
    return { userAgent: '', renderer: '' }
  }
  const nav = navigator as Navigator & {
    deviceMemory?: number
    userAgentData?: { mobile?: boolean }
    connection?: { saveData?: boolean }
  }
  return {
    userAgent: nav.userAgent ?? '',
    renderer: readWebGlRendererString(),
    hardwareConcurrency: nav.hardwareConcurrency ?? null,
    deviceMemory: nav.deviceMemory ?? null,
    maxTouchPoints: nav.maxTouchPoints ?? null,
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    uaMobile: nav.userAgentData?.mobile ?? null,
    saveData: nav.connection?.saveData ?? null,
  }
}

const TIER_OVERRIDE_KEY = 'atomlab-device-tier'

/** Ручной override для стендов/перф-скриптов: `?deviceTier=low|normal` или localStorage. */
function readTierOverride(): SynthesisDeviceTier | null {
  if (typeof window === 'undefined') return null
  try {
    const m = /[?&#]deviceTier=(low|normal)\b/.exec(window.location.href)
    if (m) return m[1] as SynthesisDeviceTier
    const v = window.localStorage?.getItem(TIER_OVERRIDE_KEY)
    if (v === 'low' || v === 'normal') return v
  } catch {
    /* приватный режим / sandbox */
  }
  return null
}

let cachedClassification: DeviceClassification | null = null
let cachedTier: SynthesisDeviceTier | null = null
let tierOverridden = false
let runtimeLowSec = 0

export function getSynthesisDeviceClassification(): DeviceClassification {
  if (cachedClassification) return cachedClassification
  const base = classifyDevice(readDeviceSignals())
  const override = readTierOverride()
  tierOverridden = override != null
  cachedClassification = override ? { ...base, tier: override } : base
  return cachedClassification
}

export function getSynthesisDeviceTier(): SynthesisDeviceTier {
  if (cachedTier) return cachedTier
  cachedTier = getSynthesisDeviceClassification().tier
  return cachedTier
}

/** Порог «устойчиво медленно» для понижения tier на сессию. */
const REFINE_LOW_FPS = 36
const REFINE_HOLD_SEC = 4

/**
 * Если статическая оценка ошиблась — понижаем tier на сессию по FPS.
 * Считает реальное время (`dtSec` — интервал между вызовами), а не число вызовов;
 * короткие просадки гасятся вдвое быстрее, чем копятся.
 * Новый tier подхватывается потребителями на границе запуска (lowPowerProfile в LabScene).
 */
export function refineSynthesisDeviceTierFromFps(fps: number, dtSec = 0.25): void {
  if (getSynthesisDeviceTier() === 'low' || tierOverridden) return
  if (!(fps > 0) || !(dtSec > 0)) return
  const dt = Math.min(dtSec, 1)
  if (fps < REFINE_LOW_FPS) runtimeLowSec += dt
  else runtimeLowSec = Math.max(0, runtimeLowSec - dt * 2)
  if (runtimeLowSec >= REFINE_HOLD_SEC) {
    cachedTier = 'low'
    runtimeLowSec = 0
  }
}

export function resetSynthesisDeviceTierCache(): void {
  cachedTier = null
  cachedClassification = null
  tierOverridden = false
  runtimeLowSec = 0
}
