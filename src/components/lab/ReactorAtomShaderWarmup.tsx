import { useMemo } from 'react'
import { AtomStructureModel } from './AtomStructureModel'

/** Частые элементы в школьных уравнениях — прогрев шейдеров Bohr-модели. */
const WARMUP_ELEMENT_Z = [1, 6, 8, 11, 19, 24, 26, 17] as const

/**
 * Скрытые atom-модели при открытом реакторе — compile материалов/орбит до первого синтеза.
 * frustumCulled + micro-scale — не влияют на кадр.
 */
export function ReactorAtomShaderWarmup({ active }: { active: boolean }) {
  const zs = useMemo(() => [...WARMUP_ELEMENT_Z], [])
  if (!active) return null

  return (
    <group position={[0, -120, 0]} scale={0.001} frustumCulled={false} visible={false}>
      {zs.map((z, i) => (
        <group key={z} position={[i * 0.4, 0, 0]}>
          <AtomStructureModel
            z={z}
            previewLite
            previewEmphasis
            animate={false}
            previewStatic
            hideOrbitRings={false}
            localLight={false}
          />
        </group>
      ))}
    </group>
  )
}
