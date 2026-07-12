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
  /** Оценка числа атомов — для coalesce тяжёлых layout при +/-. */
  atomEstimate?: number
}): ReactorEditPerfFlags {
  const { coeffEditBurst, forceLite, lowPower, layoutDebounceMs } = opts
  const editing = opts.coeffEditing ?? coeffEditBurst
  const burst = editing || coeffEditBurst || forceLite || lowPower
  const heavy = (opts.atomEstimate ?? 0) > 12
  // Небольшой coalesce при тяжёлых уравнениях: меньше sync-хитов без «пустого» кадра.
  const editDebounce = heavy ? (lowPower ? 28 : 16) : 0
  return {
    burst,
    layoutDebounceMs:
      editing
        ? editDebounce
        : layoutDebounceMs ?? (lowPower ? 40 : coeffEditBurst ? 32 : 200),
    maxInvalidateHz: 60,
  }
}
