import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import type { CompoundDef } from '../../types/chemistry'
import { ReactorTermsPreview } from './ReactorTermsPreview'
import { CatalogSubstanceDisplay } from './CatalogSubstanceDisplay'
import { CATALOG_HERO_DEFAULT_LAB_SCALE } from './catalogMoleculeHeroShared'

/** Плавное затухание превью реактора при старте синтеза. */
export function SynthesisCrossfadeLayer({
  opacity,
  terms,
  compound,
}: {
  opacity: number
  terms: readonly ReactorEquationTerm[] | null
  compound: CompoundDef | null
}) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(() => {
    if (!groupRef.current) return
    const vis = opacity > 0.02
    groupRef.current.visible = vis
    if (!vis) return
    groupRef.current.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) {
        if (!m || !('opacity' in m)) continue
        const mat = m as THREE.Material & { opacity: number; transparent: boolean }
        mat.transparent = true
        mat.opacity = opacity
        mat.depthWrite = opacity > 0.85
      }
    })
  })

  if (opacity <= 0.02) return null

  return (
    <group ref={groupRef}>
      {terms && terms.length >= 1 ? <ReactorTermsPreview terms={terms} /> : null}
      {compound && (!terms || terms.length === 0) ? (
        <group scale={0.85}>
          <CatalogSubstanceDisplay
            compound={compound}
            labScaleBoost={CATALOG_HERO_DEFAULT_LAB_SCALE * 0.9}
            reducedEffects
            labSynthesisScene
            fxLevel="low"
            renderQuality="synthesis"
          />
        </group>
      ) : null}
    </group>
  )
}
