import type { SynthesisDeviceTier } from './synthesisDeviceTier'
import { SYNTHESIS_PERF } from './synthesisPerfPreset'
import { resolveDeviceSynthesisCap } from '../perf/graphicsSettings'

/** 0=MINIMAL … 4=ULTRA */
export type SynthesisQualityLevel = 0 | 1 | 2 | 3 | 4

export const SYNTHESIS_QUALITY_MINIMAL = 0 as const
export const SYNTHESIS_QUALITY_LITE = 1 as const
export const SYNTHESIS_QUALITY_BALANCED = 2 as const
export const SYNTHESIS_QUALITY_HIGH = 3 as const
export const SYNTHESIS_QUALITY_ULTRA = 4 as const

export type SynthesisQualityFeatures = {
  bloomConverge: boolean
  bloomMerge: boolean
  depthOfField: boolean
  glassAtoms: boolean
  neonBonds: boolean
  arcReactor: boolean
  birthEntrance: boolean
  electronDrift: boolean
}

export type SynthesisQualityGovernor = {
  readonly qualityLevel: SynthesisQualityLevel
  /** Совместимость: level ≤ 1 */
  readonly forceLite: boolean
  /** Масштаб DPR относительно базового (minResolutionScale…1); 1 — без адаптации. */
  readonly resolutionScale: number
  /** p90 времени кадра (мс) в последнем окне оценки; 0 — данных ещё нет. */
  readonly p90FrameMs: number
  /** Оценка периода обновления дисплея (мс), не больше бюджета целевого FPS. */
  readonly refreshMs: number
  setCap: (cap: SynthesisQualityLevel) => void
  /** Сброс уровня и окна; масштаб DPR сохраняется, если не передан `resetResolution`. */
  reset: (initial?: SynthesisQualityLevel, opts?: { resetResolution?: boolean }) => void
  /**
   * Реальный кадр: `deltaSec` — время кадра в секундах. Оценка раз в 250 мс по p90 окна ~1 с.
   * Возвращает true только если изменился уровень или масштаб DPR (не чаще раза на оценку).
   */
  sample: (deltaSec: number) => boolean
  /** @deprecated совместимость: fps одного кадра → sample(1 / fps). */
  tick: (fps: number) => void
  /** Внешний сигнал (main-thread stall): уровень не выше `level`; true — если понизили. */
  forceDown: (level: SynthesisQualityLevel) => boolean
  /** Можно ли сейчас менять DPR (например, нельзя во время +/- коэффициентов). */
  setAdaptResolution: (enabled: boolean) => void
  /** Вернуть масштаб DPR к 1 (закрытие реактора); true — если он был меньше 1. */
  resetResolution: () => boolean
}

export type SynthesisQualityGovernorOptions = {
  floor?: SynthesisQualityLevel
  cap?: SynthesisQualityLevel
  initial?: SynthesisQualityLevel
  /** Целевой FPS (по умолчанию 60): бюджет кадра = max(1000 / targetFps, период дисплея). */
  targetFps?: number
  /** Адаптировать DPR прежде, чем резать фичи (по умолчанию true). */
  adaptResolution?: boolean
  /** Нижняя граница масштаба DPR (по умолчанию 0.75 от базового). */
  minResolutionScale?: number
}

/** Качество превью при редактировании коэффициентов (без активного синтеза). */
export function computeReactorEditQualityCap(
  atomCount: number,
  coeffEditBurst = false,
): SynthesisQualityLevel {
  if (coeffEditBurst) {
    if (atomCount > 6) return SYNTHESIS_QUALITY_LITE
    return SYNTHESIS_QUALITY_BALANCED
  }
  if (atomCount > SYNTHESIS_PERF.liteFxAtomThreshold) return SYNTHESIS_QUALITY_LITE
  if (atomCount > SYNTHESIS_PERF.denseAtomThreshold) return SYNTHESIS_QUALITY_BALANCED
  return SYNTHESIS_QUALITY_HIGH
}

/** Статический потолок качества с учётом устройства и плотности атомов. */
export function computeStaticQualityCap(opts: {
  deviceTier: SynthesisDeviceTier
  atomCount: number
  visualTier: 'full' | 'lite' | 'cluster'
}): SynthesisQualityLevel {
  const { atomCount, visualTier, deviceTier } = opts
  let cap: SynthesisQualityLevel = resolveDeviceSynthesisCap(deviceTier)

  if (visualTier === 'cluster') {
    cap = Math.min(cap, SYNTHESIS_QUALITY_LITE) as SynthesisQualityLevel
  }
  if (atomCount > SYNTHESIS_PERF.liteFxAtomThreshold) {
    cap = Math.min(cap, SYNTHESIS_QUALITY_LITE) as SynthesisQualityLevel
  } else if (atomCount > SYNTHESIS_PERF.denseAtomThreshold) {
    cap = Math.min(cap, SYNTHESIS_QUALITY_BALANCED) as SynthesisQualityLevel
  }
  return cap
}

export function featuresForQuality(
  level: SynthesisQualityLevel,
  phase: string,
): SynthesisQualityFeatures {
  const merge = phase === 'mergeFlash' || phase === 'product'
  const converge =
    phase === 'converge' || phase === 'ignite' || phase === 'flying' || merge

  switch (level) {
    case SYNTHESIS_QUALITY_MINIMAL:
      return {
        bloomConverge: false,
        bloomMerge: false,
        depthOfField: false,
        glassAtoms: false,
        neonBonds: false,
        arcReactor: false,
        birthEntrance: false,
        electronDrift: false,
      }
    case SYNTHESIS_QUALITY_LITE:
      return {
        bloomConverge: false,
        bloomMerge: merge,
        depthOfField: false,
        glassAtoms: false,
        neonBonds: false,
        arcReactor: merge,
        birthEntrance: false,
        electronDrift: false,
      }
    case SYNTHESIS_QUALITY_BALANCED:
      return {
        bloomConverge: false,
        bloomMerge: merge,
        depthOfField: false,
        glassAtoms: merge,
        neonBonds: merge,
        arcReactor: converge,
        birthEntrance: merge,
        electronDrift: false,
      }
    case SYNTHESIS_QUALITY_HIGH:
      return {
        bloomConverge: false,
        bloomMerge: merge,
        depthOfField: false,
        glassAtoms: merge,
        neonBonds: merge,
        arcReactor: converge,
        birthEntrance: true,
        electronDrift: false,
      }
    default:
      return {
        bloomConverge: false,
        bloomMerge: merge,
        depthOfField: false,
        glassAtoms: merge,
        neonBonds: merge,
        arcReactor: converge,
        birthEntrance: true,
        electronDrift: false,
      }
  }
}

export function qualityLevelToForceLite(level: SynthesisQualityLevel): boolean {
  return level <= SYNTHESIS_QUALITY_LITE
}

/** Период оценки губернатора (с реального времени, не кадров). */
export const GOVERNOR_EVAL_INTERVAL_SEC = 0.25
/** Окно, по которому считается p90 (с). */
export const GOVERNOR_WINDOW_SEC = 1
/** Кадр длиннее — пауза вкладки (rAF стоял): в статистику не идёт. Одиночный hitch короче — идёт, но p90 его не видит. */
export const GOVERNOR_MAX_FRAME_SEC = 1
/** Понижение: p90 > бюджет × ratio устойчиво `hold` секунд. */
export const GOVERNOR_SLOW_RATIO = 1.3
export const GOVERNOR_VERY_SLOW_RATIO = 1.9
export const GOVERNOR_DOWNGRADE_HOLD_SEC = 1
export const GOVERNOR_DOWNGRADE_HOLD_VERY_SLOW_SEC = 0.5
/** Повышение: кадры в пределах периода дисплея устойчиво 3 с (× 2^неудач, до 24 с). */
export const GOVERNOR_UPGRADE_HOLD_SEC = 3
export const GOVERNOR_RESOLUTION_STEP = 0.125
export const GOVERNOR_MIN_RESOLUTION_SCALE = 0.75

const GOVERNOR_RING = 256
const GOVERNOR_MIN_SAMPLES = 4
const GOVERNOR_WINDOW_MIN_FRAMES = 30
/** После смены уровня/масштаба ждём свежее окно. */
const GOVERNOR_SETTLE_SEC = 1
const GOVERNOR_UPGRADE_BACKOFF_MAX = 3
/** Понижение в пределах этого времени после повышения — повышение «не удалось». */
const GOVERNOR_FAILED_UPGRADE_SEC = 8
/** Столько стабильной работы без смен — одна неудача прощается. */
const GOVERNOR_FORGIVE_SEC = 20
/** Типовые периоды дисплеев (мс): 240…60 Гц. */
const DISPLAY_INTERVALS_MS = [1000 / 240, 1000 / 165, 1000 / 144, 1000 / 120, 1000 / 90, 1000 / 75, 1000 / 60]
/**
 * Периоды «урезанного» rAF: энергосбережение Chrome, Low Power Mode в iOS, удалённый рабочий стол.
 * Такой кадр медленный не из-за сцены — снижать качество бесполезно, картинка только хуже.
 */
const CAPPED_INTERVALS_MS = [1000 / 50, 1000 / 48, 1000 / 30]
/** Кадры «ровные»: p90 не больше p10 × этот множитель (вертикальная синхронизация, не нагрузка). */
const CAPPED_STEADY_RATIO = 1.12

function snapCappedIntervalMs(ms: number): number {
  for (let i = 0; i < CAPPED_INTERVALS_MS.length; i++) {
    if (Math.abs(Math.log(ms / CAPPED_INTERVALS_MS[i])) <= Math.log(1.06)) return CAPPED_INTERVALS_MS[i]
  }
  return 0
}

/** k-я порядковая статистика на [0, n) — in-place quickselect, без аллокаций. */
function selectKth(a: Float64Array, n: number, k: number): number {
  let lo = 0
  let hi = n - 1
  while (lo < hi) {
    const pivot = a[(lo + hi) >> 1]
    let i = lo
    let j = hi
    while (i <= j) {
      while (a[i] < pivot) i++
      while (a[j] > pivot) j--
      if (i <= j) {
        const t = a[i]
        a[i] = a[j]
        a[j] = t
        i++
        j--
      }
    }
    if (k <= j) hi = j
    else if (k >= i) lo = i
    else return a[k]
  }
  return a[k]
}

function snapDisplayIntervalMs(ms: number): number {
  let best = ms
  let bestErr = Infinity
  for (let i = 0; i < DISPLAY_INTERVALS_MS.length; i++) {
    const err = Math.abs(Math.log(ms / DISPLAY_INTERVALS_MS[i]))
    if (err < bestErr) {
      bestErr = err
      best = DISPLAY_INTERVALS_MS[i]
    }
  }
  // Дальше ±10% от стандартного периода — оставляем как измерено.
  return bestErr <= Math.log(1.1) ? best : ms
}

/**
 * Адаптивный губернатор по реальному времени кадра.
 * - Кадры копятся в кольцевом буфере; раз в 250 мс считается p90 за последнюю ~1 с.
 * - Понижение — только при устойчивой медлительности (p90 > бюджет × 1.3 в течение 1 с,
 *   или × 1.9 в течение 0.5 с). Одиночный hitch не влияет на p90.
 * - Сначала адаптируется DPR (1 → 0.875 → 0.75), затем уровень фич (не ниже floor).
 * - Повышение — когда p90 укладывается в период дисплея (60 Гц vsync: ≤ 18.3 мс) 3 с;
 *   повторные неудачные повышения удваивают выдержку (до 24 с) — без качелей.
 * `sample` вызывается каждый кадр и не аллоцирует; true — только при реальной смене.
 */
export function createSynthesisQualityGovernor(
  opts?: SynthesisQualityGovernorOptions,
): SynthesisQualityGovernor {
  const floor = opts?.floor ?? SYNTHESIS_QUALITY_BALANCED
  let cap: SynthesisQualityLevel = opts?.cap ?? SYNTHESIS_QUALITY_HIGH
  let level: SynthesisQualityLevel = Math.min(
    opts?.initial ?? cap,
    cap,
  ) as SynthesisQualityLevel
  const targetFps = Math.max(1, opts?.targetFps ?? 60)
  const budgetMs = 1000 / targetFps
  const minScale = Math.min(1, Math.max(0.25, opts?.minResolutionScale ?? GOVERNOR_MIN_RESOLUTION_SCALE))
  let adaptResolution = opts?.adaptResolution ?? true

  const ring = new Float64Array(GOVERNOR_RING)
  const scratch = new Float64Array(GOVERNOR_RING)
  let head = 0
  let count = 0
  let windowAgeSec = 0
  let evalAccSec = 0
  let clockSec = 0
  let slowHoldSec = 0
  let goodHoldSec = 0
  let failStreak = 0
  let lastUpgradeAt = -Infinity
  let lastChangeAt = 0
  let lastForgiveAt = 0
  let p90 = 0
  let refreshMs = budgetMs
  let scale = 1
  /** Обнаруженный предел rAF (мс), 0 — не обнаружен. Медленнее этого кадр быть «обязан». */
  let cappedMs = 0
  /** Проверка после понижения: если кадр не ускорился и он «ровный» на 30/48/50 Гц — это предел rAF. */
  let pendingCheck: { p90: number; scale: number; level: SynthesisQualityLevel } | null = null

  const clampLevel = (v: number): SynthesisQualityLevel =>
    Math.max(floor, Math.min(cap, Math.round(v))) as SynthesisQualityLevel

  const clearWindow = () => {
    head = 0
    count = 0
    windowAgeSec = 0
    evalAccSec = 0
    slowHoldSec = 0
    goodHoldSec = 0
  }

  const markChanged = () => {
    clearWindow()
    lastChangeAt = clockSec
    lastForgiveAt = clockSec
  }

  const noteDowngrade = () => {
    if (clockSec - lastUpgradeAt < GOVERNOR_FAILED_UPGRADE_SEC) {
      failStreak = Math.min(GOVERNOR_UPGRADE_BACKOFF_MAX, failStreak + 1)
    }
    lastUpgradeAt = -Infinity
  }

  const downgrade = (verySlow: boolean): boolean => {
    const before = { p90, scale, level }
    let changed = false
    if (adaptResolution && scale > minScale + 1e-6) {
      scale = verySlow
        ? minScale
        : Math.max(minScale, Math.round((scale - GOVERNOR_RESOLUTION_STEP) * 1000) / 1000)
      changed = true
    } else {
      const next = clampLevel(level - 1)
      if (next < level) {
        level = next
        changed = true
      }
    }
    if (!changed) {
      // Уже на полу — копить выдержку бессмысленно.
      slowHoldSec = 0
      return false
    }
    noteDowngrade()
    markChanged()
    pendingCheck = before
    return true
  }

  const upgrade = (): boolean => {
    if (adaptResolution && scale < 1 - 1e-6) {
      scale = Math.min(1, Math.round((scale + GOVERNOR_RESOLUTION_STEP) * 1000) / 1000)
    } else if (level < cap && clampLevel(level + 1) > level) {
      level = clampLevel(level + 1)
    } else {
      goodHoldSec = 0
      return false
    }
    markChanged()
    lastUpgradeAt = clockSec
    return true
  }

  const updateRefresh = (p10: number) => {
    if (p10 < refreshMs * 0.92) {
      refreshMs = Math.max(DISPLAY_INTERVALS_MS[0], Math.min(budgetMs, snapDisplayIntervalMs(p10)))
    } else if (p10 > refreshMs * 1.08) {
      // Дисплей мог смениться (или vsync не виден под нагрузкой) — дрейф вверх медленно.
      refreshMs = Math.min(budgetMs, refreshMs * 1.02)
    }
  }

  const evaluate = (dtSec: number): boolean => {
    let n = 0
    let windowMs = 0
    let idx = head
    const windowLimitMs = GOVERNOR_WINDOW_SEC * 1000
    // Окно — ≥1 с и ≥30 кадров: один длинный hitch не занимает всё окно и не становится p90.
    while (n < count && (windowMs < windowLimitMs || n < GOVERNOR_WINDOW_MIN_FRAMES)) {
      idx = (idx - 1 + GOVERNOR_RING) % GOVERNOR_RING
      const v = ring[idx]
      scratch[n++] = v
      windowMs += v
    }
    if (n < GOVERNOR_MIN_SAMPLES || windowAgeSec < GOVERNOR_SETTLE_SEC - 1e-6) return false

    p90 = selectKth(scratch, n, Math.max(0, Math.ceil(n * 0.9) - 1))
    const p10 = selectKth(scratch, n, Math.max(0, Math.ceil(n * 0.1) - 1))
    updateRefresh(p10)

    if (pendingCheck) {
      const check = pendingCheck
      pendingCheck = null
      const snapped = snapCappedIntervalMs(p10)
      const noGain = p90 >= check.p90 * 0.95
      const steadyFrames = p90 <= p10 * CAPPED_STEADY_RATIO
      if (noGain && steadyFrames && snapped > 0) {
        // Понижение ничего не дало, а кадры идут ровно на 30/48/50 Гц — это предел rAF, откатываем шаг.
        cappedMs = snapped
        scale = check.scale
        level = check.level
        failStreak = 0
        markChanged()
        return true
      }
    }

    const budget = Math.max(budgetMs, refreshMs, cappedMs)
    const slowMs = budget * GOVERNOR_SLOW_RATIO
    const verySlowMs = budget * GOVERNOR_VERY_SLOW_RATIO
    const upgradeMs = Math.min(budget * 1.1, Math.max(refreshMs * 1.15, budget * 0.75))

    if (p90 > slowMs) {
      goodHoldSec = 0
      slowHoldSec += dtSec
      const verySlow = p90 > verySlowMs
      const need = verySlow ? GOVERNOR_DOWNGRADE_HOLD_VERY_SLOW_SEC : GOVERNOR_DOWNGRADE_HOLD_SEC
      if (slowHoldSec >= need - 1e-9) return downgrade(verySlow)
      return false
    }
    slowHoldSec = Math.max(0, slowHoldSec - dtSec)

    if (
      failStreak > 0 &&
      clockSec - lastChangeAt >= GOVERNOR_FORGIVE_SEC &&
      clockSec - lastForgiveAt >= GOVERNOR_FORGIVE_SEC
    ) {
      failStreak -= 1
      lastForgiveAt = clockSec
    }

    const canUpgrade = (adaptResolution && scale < 1 - 1e-6) || level < cap
    if (canUpgrade && p90 <= upgradeMs) {
      goodHoldSec += dtSec
      const need = GOVERNOR_UPGRADE_HOLD_SEC * 2 ** failStreak
      if (goodHoldSec >= need - 1e-9) return upgrade()
    } else {
      goodHoldSec = 0
    }
    return false
  }

  const sample = (deltaSec: number): boolean => {
    if (!(deltaSec > 0) || deltaSec > GOVERNOR_MAX_FRAME_SEC) return false
    ring[head] = deltaSec * 1000
    head = (head + 1) % GOVERNOR_RING
    if (count < GOVERNOR_RING) count++
    windowAgeSec += deltaSec
    clockSec += deltaSec
    evalAccSec += deltaSec
    if (evalAccSec < GOVERNOR_EVAL_INTERVAL_SEC) return false
    const dt = evalAccSec
    evalAccSec = 0
    return evaluate(dt)
  }

  return {
    get qualityLevel() {
      return level
    },
    get forceLite() {
      return qualityLevelToForceLite(level)
    },
    get resolutionScale() {
      return scale
    },
    get p90FrameMs() {
      return p90
    },
    get refreshMs() {
      return refreshMs
    },
    setCap(nextCap: SynthesisQualityLevel) {
      cap = nextCap
      level = Math.min(level, cap) as SynthesisQualityLevel
    },
    reset(initial?: SynthesisQualityLevel, resetOpts?: { resetResolution?: boolean }) {
      const start = initial ?? cap
      level = Math.min(start, cap) as SynthesisQualityLevel
      clearWindow()
      failStreak = 0
      lastUpgradeAt = -Infinity
      lastChangeAt = clockSec
      lastForgiveAt = clockSec
      pendingCheck = null
      cappedMs = 0
      if (resetOpts?.resetResolution) scale = 1
    },
    sample,
    tick(fps: number) {
      if (fps > 0) sample(1 / fps)
    },
    forceDown(maxLevel: SynthesisQualityLevel) {
      const next = clampLevel(Math.min(level, maxLevel))
      if (next >= level) return false
      level = next
      noteDowngrade()
      markChanged()
      return true
    },
    setAdaptResolution(enabled: boolean) {
      adaptResolution = enabled
    },
    resetResolution() {
      if (scale >= 1) return false
      scale = 1
      markChanged()
      return true
    },
  }
}

/** createFpsGovernor — тонкая обёртка для обратной совместимости. */
export function createFpsGovernor(opts?: {
  enterFps?: number
  exitFps?: number
  holdSec?: number
}): { forceLite: boolean; tick: (fps: number) => void; reset: () => void } {
  const gov = createSynthesisQualityGovernor({ adaptResolution: false })
  const enterFps = opts?.enterFps ?? SYNTHESIS_PERF.fpsLiteEnter
  void enterFps
  return {
    get forceLite() {
      return gov.forceLite
    },
    tick(fps: number) {
      gov.tick(fps)
    },
    reset() {
      gov.reset(SYNTHESIS_QUALITY_HIGH)
    },
  }
}
