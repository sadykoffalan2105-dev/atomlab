/**
 * Режим производительности при +/- коэффициентов.
 * Только планирование (debounce, throttle) — без деградации визуала атомов.
 * @see reactorVisualPreservation.ts
 */
export type ReactorEditPerfFlags = {
  burst: boolean
  layoutDebounceMs: number
  maxInvalidateHz: number
}

export function resolveReactorEditPerfFlags(opts: {
  coeffEditBurst: boolean
  forceLite: boolean
  lowPower: boolean
  layoutDebounceMs?: number
}): ReactorEditPerfFlags {
  const { coeffEditBurst, forceLite, lowPower, layoutDebounceMs } = opts
  const burst = coeffEditBurst || forceLite || lowPower
  return {
    burst,
    layoutDebounceMs:
      layoutDebounceMs ?? (lowPower ? 40 : coeffEditBurst ? 32 : 0),
    maxInvalidateHz: burst ? 36 : 60,
  }
}
