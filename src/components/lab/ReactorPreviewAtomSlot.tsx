import { memo } from 'react'
import { AtomStructureModel } from './AtomStructureModel'

/**
 * Мемо-слот — не пересоздавать Bohr-модель при смене позиции/коэффициента.
 *
 * pointLights всегда false: в превью N атомов, и свет внутри каждого менял бы
 * число источников в сцене на каждый +/- → перекомпиляция всех освещённых
 * материалов (hitch). Свечение ядра — emissive + общий аддитивный спрайт.
 */
export const ReactorPreviewAtomSlot = memo(
  function ReactorPreviewAtomSlot({
    z,
    animate,
    previewStatic = false,
    useFullDetail,
    synthesisGlass,
    glassTransmission = false,
    previewLite,
    electronFrameSkip,
    hideOrbitRings,
    localLight,
  }: {
    z: number
    animate: boolean
    previewStatic?: boolean
    useFullDetail: boolean
    synthesisGlass: boolean
    /** Transmission-стекло только на сильном GPU / кинематографичном уровне качества. */
    glassTransmission?: boolean
    previewLite: boolean
    electronFrameSkip: number
    hideOrbitRings: boolean
    localLight: boolean
  }) {
    return (
      <AtomStructureModel
        z={z}
        animate={animate}
        previewStatic={previewStatic}
        previewEmphasis
        synthesisDetail={useFullDetail}
        synthesisGlass={synthesisGlass}
        glassTransmission={glassTransmission}
        previewLite={previewLite}
        electronFrameSkip={electronFrameSkip}
        hideOrbitRings={hideOrbitRings}
        localLight={localLight}
        pointLights={false}
      />
    )
  },
  (a, b) =>
    a.z === b.z &&
    a.animate === b.animate &&
    a.previewStatic === b.previewStatic &&
    a.useFullDetail === b.useFullDetail &&
    a.synthesisGlass === b.synthesisGlass &&
    a.glassTransmission === b.glassTransmission &&
    a.previewLite === b.previewLite &&
    a.electronFrameSkip === b.electronFrameSkip &&
    a.hideOrbitRings === b.hideOrbitRings &&
    a.localLight === b.localLight,
)
