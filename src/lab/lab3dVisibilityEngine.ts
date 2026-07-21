/**
 * Lab3DVisibilityEngine — жёсткий контракт: центр экрана НИКОГДА не пустой.
 *
 * Два сценария со скринов:
 * 1) Редактирование 4Cr+4K+7O₂ — Bohr должен быть виден.
 * 2) После синтеза «3D показан» — молекула на полном масштабе, не micro-scale.
 *
 * Правила:
 * - GPU-cache / prewarm / watchdog ≠ «продукт на экране».
 * - Bohr гасится ТОЛЬКО после full-scale paint (scale ≥ min).
 * - micro-prewarm НЕ считается покрытием центра.
 * - Instant-синтез ждёт productPainted, не isProductGpuCompiled.
 */
import { SYNTH_STABILITY } from './synthesisStabilityEngine'

export const LAB3D_VIS = {
  productFullScaleMin: SYNTH_STABILITY.productPaintScaleMin,
  /** Soft timeout → onStuck nudge (~1.5с @60fps). */
  instantHardMaxFrames: 90,
  /** Абсолютный потолок RAF без paint (~4с) — только мёртвый GL. */
  instantAbsoluteMaxFrames: 240,
  /** Кадров подряд без покрытия → rescue. */
  emptyCenterRescueFrames: 2,
} as const

/** Счётчик пустых кадров для порога emptyCenterRescueFrames. */
export function createEmptyCenterFrameCounter() {
  let empty = 0
  return {
    reset() {
      empty = 0
    },
    tick(covered: boolean): boolean {
      if (covered) {
        empty = 0
        return false
      }
      empty += 1
      return empty >= LAB3D_VIS.emptyCenterRescueFrames
    },
  }
}

/** Продукт реально виден пользователю (не micro-prewarm). */
export function isProductFullScaleVisible(opts: {
  slotVisible: boolean
  prewarm: boolean
  scaleX?: number
}): boolean {
  if (!opts.slotVisible || opts.prewarm) return false
  if (opts.scaleX != null && opts.scaleX < LAB3D_VIS.productFullScaleMin) return false
  return true
}

/**
 * Instant ready: ТОЛЬКО реальный paint.
 * GPU-cache сам по себе = false (иначе пустой центр + toast «3D показан»).
 */
export function isInstantProductScreenReady(productPainted: boolean): boolean {
  return productPainted
}

/** Можно ли скрыть Bohr — только когда молекула реально на экране. */
export function canHideBohrForProduct(opts: {
  productPainted: boolean
  slotVisible: boolean
  prewarm: boolean
  coeffEditing: boolean
  preSynthesis: boolean
  scaleX?: number
}): boolean {
  if (opts.coeffEditing || opts.preSynthesis) return false
  if (!opts.productPainted) return false
  return isProductFullScaleVisible({
    slotVisible: opts.slotVisible,
    prewarm: opts.prewarm,
    scaleX: opts.scaleX,
  })
}

/** Покрытие центра: prewarm НЕ считается. */
export function isCenterCovered(opts: {
  bohrVisible: boolean
  bohrMounted: boolean
  productSlotVisible: boolean
  productPrewarm: boolean
}): boolean {
  if (opts.bohrVisible && opts.bohrMounted) return true
  if (opts.productSlotVisible && !opts.productPrewarm) return true
  return false
}

export type Lab3dFrameRescue = {
  forceBohrRootVisible: boolean
  forceProductFullScale: boolean
  keepBohrUntilPaint: boolean
  /** Сбросить ложный productPainted (paint без full-scale). */
  invalidatePaint: boolean
}

/** Покадровый rescue против пустого starfield. */
export function resolveLab3dFrameRescue(opts: {
  reactorOpen: boolean
  hasPreviewTerms: boolean
  coeffEditing: boolean
  preSynthesis: boolean
  synthLive: boolean
  showSettledHero: boolean
  productPainted: boolean
  productSlotVisible: boolean
  productPrewarm: boolean
  productScaleX?: number
}): Lab3dFrameRescue {
  if (!opts.reactorOpen) {
    return {
      forceBohrRootVisible: false,
      forceProductFullScale: false,
      keepBohrUntilPaint: false,
      invalidatePaint: false,
    }
  }

  const productOk = isProductFullScaleVisible({
    slotVisible: opts.productSlotVisible,
    prewarm: opts.productPrewarm,
    scaleX: opts.productScaleX,
  })

  const falsePaint =
    opts.productPainted &&
    !productOk &&
    (opts.preSynthesis || opts.coeffEditing || opts.synthLive || opts.showSettledHero)

  const needBohr =
    opts.hasPreviewTerms &&
    (opts.coeffEditing ||
      opts.preSynthesis ||
      (opts.synthLive && !productOk) ||
      (opts.showSettledHero && !productOk))

  return {
    forceBohrRootVisible: needBohr,
    forceProductFullScale:
      (opts.showSettledHero || opts.synthLive) &&
      opts.productSlotVisible &&
      !opts.productPrewarm &&
      (opts.productScaleX == null ||
        opts.productScaleX < LAB3D_VIS.productFullScaleMin),
    keepBohrUntilPaint: needBohr,
    invalidatePaint: Boolean(falsePaint),
  }
}

/** Watchdog / micro-paint НЕ должны писать session GPU-cache. */
export function shouldPersistGpuCompileCache(opts: {
  fromFullScaleCompile: boolean
  fromVisiblePaint: boolean
}): boolean {
  return opts.fromFullScaleCompile || opts.fromVisiblePaint
}
