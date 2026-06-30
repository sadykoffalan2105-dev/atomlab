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
}): ReactorEditPerfFlags {
  const { coeffEditBurst, forceLite, lowPower } = opts
  const burst = coeffEditBurst || forceLite || lowPower
  return {
    burst,
    layoutDebounceMs: lowPower ? 56 : coeffEditBurst ? 48 : 0,
    maxInvalidateHz: burst ? 30 : 60,
  }
}
