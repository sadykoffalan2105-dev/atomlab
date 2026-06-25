import { memo } from 'react'
import { AtomStructureModel } from './AtomStructureModel'

/** Мемо-слот — не пересоздавать Bohr-модель при смене позиции/коэффициента. */
export const ReactorPreviewAtomSlot = memo(
  function ReactorPreviewAtomSlot({
    z,
    animate,
    useFullDetail,
    synthesisGlass,
    previewLite,
    electronFrameSkip,
    hideOrbitRings,
    localLight,
  }: {
    z: number
    animate: boolean
    useFullDetail: boolean
    synthesisGlass: boolean
    previewLite: boolean
    electronFrameSkip: number
    hideOrbitRings: boolean
    localLight: boolean
  }) {
    return (
      <AtomStructureModel
        z={z}
        animate={animate}
        previewStatic={false}
        previewEmphasis
        synthesisDetail={useFullDetail}
        synthesisGlass={synthesisGlass}
        previewLite={previewLite}
        electronFrameSkip={electronFrameSkip}
        hideOrbitRings={hideOrbitRings}
        localLight={localLight}
      />
    )
  },
  (a, b) =>
    a.z === b.z &&
    a.animate === b.animate &&
    a.useFullDetail === b.useFullDetail &&
    a.synthesisGlass === b.synthesisGlass &&
    a.previewLite === b.previewLite &&
    a.electronFrameSkip === b.electronFrameSkip &&
    a.hideOrbitRings === b.hideOrbitRings &&
    a.localLight === b.localLight,
)
