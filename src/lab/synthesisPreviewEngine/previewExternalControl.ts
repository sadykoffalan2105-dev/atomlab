/** Превью отдаёт refs GSAP только когда полёт активен; до этого — pin/guard. */
export function resolvePreviewExternalAtomControl(opts: {
  flightActive: boolean
  poseLocked: boolean
  previewOnlyMode: boolean
  synthHoldPreview: boolean
}): boolean {
  const { flightActive } = opts
  // Только реальный полёт GSAP. poseLocked — только камера, не отбирает pin у атомов
  // (иначе кадр runId>0 без synthesis → слоты invisible → белая вспышка).
  void opts.poseLocked
  return flightActive
}

/**
 * Удержание shell/пула: превью открыто или синтез до отрисовки продукта.
 * Это НЕ означает «горячий» pinEachFrame — см. resolvePreviewHotCoeffEdit.
 */
export function resolvePreviewEditingActive(opts: {
  coeffEditing: boolean
  previewOnlyMode: boolean
  synthHoldPreview: boolean
}): boolean {
  return opts.coeffEditing || opts.previewOnlyMode || opts.synthHoldPreview
}

/** Hot pin при любом активном +/- (burst). Shell-hold шире — см. resolvePreviewEditingActive. */
export function resolvePreviewHotCoeffEdit(opts: {
  coeffEditing: boolean
  coeffEditBurst: boolean
}): boolean {
  return opts.coeffEditBurst || opts.coeffEditing
}
