import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { CATALOG_HERO_VIEW } from '../lab/labOrbitConstants'
import type { LearnVisualSpec } from '../../types/learn'
import { hasIsometricScene } from '../../learn/learnIsometricScenes'
import { LearnTopicScene } from './topicScenes/LearnTopicScene'
import {
  LearnBondVisual,
  LearnCatalogVisual,
  LearnDiatomicVisual,
  LearnElementVisual,
} from './LearnCatalogVisual'
import { ReactorTermsPreview } from '../lab/ReactorTermsPreview'
import { SceneLights, SpinGroup } from './topicScenes/primitives'

function LearnPremiumSceneInner({
  spec,
  autoRotate = true,
}: {
  spec: LearnVisualSpec
  autoRotate?: boolean
}) {
  switch (spec.kind) {
    case 'topicScene':
      return <LearnTopicScene sceneId={spec.sceneId} autoRotate={autoRotate} />
    case 'molecule':
      return <LearnCatalogVisual compoundId={spec.compoundId} autoRotate={autoRotate} />
    case 'atom':
    case 'element':
      return <LearnElementVisual z={spec.z} autoRotate={autoRotate} />
    case 'bond':
      return <LearnBondVisual compoundId={spec.compoundId} autoRotate={autoRotate} />
    case 'electrolysis':
      return <LearnCatalogVisual compoundId={spec.compoundId} autoRotate={autoRotate} />
    case 'reaction':
      return (
        <>
          <SceneLights accent="#3dffec" />
          <SpinGroup autoRotate={autoRotate} speed={0.1}>
            <ReactorTermsPreview
              terms={spec.leftTerms.map((t, i) => ({
                id: `rx-${i}`,
                z: t.z,
                coeff: t.coeff,
                ...(t.diatomic ? { diatomic: true as const } : {}),
              }))}
            />
          </SpinGroup>
        </>
      )
    default:
      return null
  }
}

export function LearnPremiumSceneContent({
  spec,
  autoRotate = true,
}: {
  spec: LearnVisualSpec
  autoRotate?: boolean
}) {
  if (spec.kind === 'diatomic') {
    return <LearnDiatomicVisual z={spec.z} autoRotate={autoRotate} />
  }
  return <LearnPremiumSceneInner spec={spec} autoRotate={autoRotate} />
}

export function LearnPremiumCanvas({
  spec,
  autoRotate = true,
}: {
  spec: LearnVisualSpec
  autoRotate?: boolean
}) {
  const isIso = spec.kind === 'topicScene' && hasIsometricScene(spec.sceneId)
  const bg = isIso ? '#d4dae8' : '#05070f'
  const isoCamera = { position: [5.2, 4.8, 5.2] as [number, number, number], fov: 38 }
  return (
    <Canvas
      camera={
        isIso
          ? isoCamera
          : { position: CATALOG_HERO_VIEW.cameraPosition, fov: CATALOG_HERO_VIEW.fov }
      }
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
      }}
      dpr={[1, 1.5]}
      frameloop="always"
    >
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, isIso ? 12 : 7, isIso ? 22 : 18]} />
      <Suspense fallback={null}>
        <LearnPremiumSceneContent spec={spec} autoRotate={autoRotate} />
      </Suspense>
      <OrbitControls
        enablePan={false}
        enableZoom
        target={isIso ? [0, 0.35, 0] : undefined}
        minDistance={isIso ? 4.5 : 2.8}
        maxDistance={isIso ? 9 : 5.5}
        minPolarAngle={isIso ? 0.35 : CATALOG_HERO_VIEW.minPolarAngle}
        maxPolarAngle={isIso ? 1.35 : CATALOG_HERO_VIEW.maxPolarAngle}
        enableDamping
        dampingFactor={0.06}
      />
    </Canvas>
  )
}
