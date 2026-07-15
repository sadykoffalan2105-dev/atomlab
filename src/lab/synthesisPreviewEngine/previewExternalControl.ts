/** Превью отдаёт refs GSAP только когда полёт активен; до этого — pin/guard. */
export function resolvePreviewExternalAtomControl(opts: {
  flightActive: boolean
  poseLocked: boolean
  previewOnlyMode: boolean
  synthHoldPreview: boolean
}): boolean {
  const { flightActive, poseLocked, previewOnlyMode, synthHoldPreview } = opts
  if (flightActive || poseLocked) return true
  if (previewOnlyMode) return false
  if (synthHoldPreview) return false
  return true
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

/** Реальный burst +/- коэффициентов — тяжёлый pin/guard только здесь. */
export function resolvePreviewHotCoeffEdit(opts: {
  coeffEditing: boolean
  coeffEditBurst: boolean
}): boolean {
  return opts.coeffEditing || opts.coeffEditBurst
}
