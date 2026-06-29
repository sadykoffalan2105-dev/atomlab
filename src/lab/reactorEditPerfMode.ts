/** Режим производительности при быстром +/- коэффициентов. */
export type ReactorEditPerfFlags = {
  burst: boolean
  forceLite: boolean
  previewLite: boolean
  hideOrbitRings: boolean
  previewStatic: boolean
  sharedLighting: boolean
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
    forceLite: burst,
    previewLite: burst,
    hideOrbitRings: burst,
    previewStatic: coeffEditBurst,
    sharedLighting: true,
    layoutDebounceMs: lowPower ? 56 : coeffEditBurst ? 48 : 0,
    maxInvalidateHz: burst ? 30 : 60,
  }
}
