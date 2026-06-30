/**
 * Контракт визуала превью реактора: слои производительности не должны
 * отключать орбиты, анимацию электронов и per-atom освещение при редактировании.
 */
export const REACTOR_VISUAL_INVARIANTS = {
  /** Орбитальные линии всегда видны в превью реагентов. */
  hideOrbitRings: false as const,
  /** Электроны не замирают при серии +/- коэффициентов. */
  freezeElectronsOnCoeffBurst: false as const,
} as const

export type ReactorVisualPreservationCheck = {
  hideOrbitRings: boolean
  previewStaticFromBurst: boolean
}

/** Dev-only: предупреждение при нарушении контракта (не блокирует рендер). */
export function warnIfReactorVisualDegraded(check: ReactorVisualPreservationCheck): void {
  if (import.meta.env.PROD) return
  if (check.hideOrbitRings !== REACTOR_VISUAL_INVARIANTS.hideOrbitRings) {
    console.warn('[reactor] orbit rings must stay visible during coeff edit')
  }
  if (check.previewStaticFromBurst && !REACTOR_VISUAL_INVARIANTS.freezeElectronsOnCoeffBurst) {
    console.warn('[reactor] electron animation must not freeze during coeff burst')
  }
}
