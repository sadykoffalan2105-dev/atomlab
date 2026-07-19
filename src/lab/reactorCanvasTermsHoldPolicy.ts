/**
 * Pure helpers for canvas terms hold (no React) — regression for O₂→K vanish.
 */
export function shouldFreezeCanvasTerms(opts: {
  freezeCanvas: boolean
  structuralChange: boolean
}): boolean {
  if (opts.structuralChange) return false
  return opts.freezeCanvas
}

export function isStructuralTermsChange(
  prevIds: string,
  nextIds: string,
  prevLen: number,
  nextLen: number,
): boolean {
  return prevIds !== nextIds || prevLen !== nextLen
}

/** Shell clear только при закрытии реактора — не при кратком пустом canvas snapshot. */
export function shouldClearPreviewTermsShell(opts: {
  reactorViewOpen: boolean
}): boolean {
  return !opts.reactorViewOpen
}
