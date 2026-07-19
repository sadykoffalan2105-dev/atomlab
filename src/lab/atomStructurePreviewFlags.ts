/**
 * Флаги визуала Bohr-модели.
 * В реакторе previewEmphasis → cosmic full (nebula + орбиты).
 * previewLite режет визуал только когда явно включён (очень плотный idle).
 */
export function resolveAtomStructurePreviewFlags(opts: {
  previewEmphasis: boolean
  cosmicStyle: boolean
  synthesisDetail: boolean
  previewLite: boolean
  hideOrbitRings: boolean
  electronFrameSkip: number
  z: number
}): {
  fullPreview: boolean
  lite: boolean
  showRings: boolean
  showNebula: boolean
  effectiveFrameSkip: number
} {
  const {
    previewEmphasis,
    cosmicStyle,
    synthesisDetail,
    previewLite,
    hideOrbitRings,
    electronFrameSkip,
    z,
  } = opts
  // Cosmic reactor look: emphasis + не synthesisDetail → fullPreview (nebula).
  const fullPreview = previewEmphasis && cosmicStyle && !synthesisDetail && !previewLite
  const lite = fullPreview
    ? false
    : synthesisDetail
      ? z > 54
      : previewLite || z > 18
  const showRings = synthesisDetail ? true : !hideOrbitRings
  const showNebula = cosmicStyle && !hideOrbitRings && (fullPreview || (!previewLite && !lite))
  const effectiveFrameSkip = fullPreview
    ? Math.max(1, Math.floor(electronFrameSkip || 1))
    : Math.max(1, Math.floor(electronFrameSkip || (lite || previewLite ? 3 : 1)))
  return { fullPreview, lite, showRings, showNebula, effectiveFrameSkip }
}
