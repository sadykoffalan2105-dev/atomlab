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
  coeffEditing?: boolean
  forceLite: boolean
  lowPower: boolean
  layoutDebounceMs?: number
}): ReactorEditPerfFlags {
  const { coeffEditBurst, forceLite, lowPower, layoutDebounceMs } = opts
  const editing = opts.coeffEditing ?? coeffEditBurst
  const burst = editing || coeffEditBurst || forceLite || lowPower
  return {
    burst,
    layoutDebounceMs:
      editing ? 0 : layoutDebounceMs ?? (lowPower ? 40 : coeffEditBurst ? 32 : 200),
    maxInvalidateHz: 60,
  }
}
