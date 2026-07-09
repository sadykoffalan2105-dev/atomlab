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

/** Редактирование / удержание shell: burst, visualHold или синтез до отрисовки продукта. */
export function resolvePreviewEditingActive(opts: {
  coeffEditing: boolean
  previewOnlyMode: boolean
  synthHoldPreview: boolean
}): boolean {
  return opts.coeffEditing || opts.previewOnlyMode || opts.synthHoldPreview
}
