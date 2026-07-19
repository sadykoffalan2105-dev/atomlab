/**
 * Флаги визуала Bohr-модели. previewLite сильнее previewEmphasis —
 * иначе реактор игнорировал sessionLite и рисовал full+nebula на каждом +/-.
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
  const fullPreview = previewEmphasis && cosmicStyle && !synthesisDetail && !previewLite
  const lite = fullPreview ? false : synthesisDetail ? z > 54 : previewLite || z > 18
  const showRings = synthesisDetail ? true : !hideOrbitRings
  const showNebula = cosmicStyle && !hideOrbitRings && !previewLite && !lite
  const effectiveFrameSkip = fullPreview
    ? 1
    : Math.max(1, Math.floor(electronFrameSkip || (lite || previewLite ? 3 : 1)))
  return { fullPreview, lite, showRings, showNebula, effectiveFrameSkip }
}
