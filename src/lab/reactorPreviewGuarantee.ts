/** Макс. моделей в превью реактора (expandLeftTermsToPreviewSlots). */
export const PREVIEW_MAX_ATOM_MODELS = 48

/**
 * Контракт: электроны крутятся при любом допустимом числе атомов в превью.
 * previewStatic=true для превью — регрессия.
 */
export const PREVIEW_ELECTRON_ANIMATION_CONTRACT =
  'reactor preview must keep electron orbits animated for all atom counts <= PREVIEW_MAX_ATOM_MODELS'

export function assertPreviewElectronAnimation(enabled: boolean, atomCount: number): void {
  if (!import.meta.env.DEV) return
  if (atomCount <= 0 || atomCount > PREVIEW_MAX_ATOM_MODELS) return
  if (!enabled) {
    console.warn(`[ATOMLAB] ${PREVIEW_ELECTRON_ANIMATION_CONTRACT} (atoms=${atomCount})`)
  }
}
