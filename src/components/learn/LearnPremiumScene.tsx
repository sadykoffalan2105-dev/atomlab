import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { CATALOG_HERO_VIEW } from '../lab/labOrbitConstants'
import type { LearnVisualSpec } from '../../types/learn'
import { LearnTopicScene } from './topicScenes/LearnTopicScene'

export function LearnPremiumSceneContent({
  spec,
  autoRotate = true,
}: {
  spec: LearnVisualSpec
  autoRotate?: boolean
}) {
  if (spec.kind === 'topicScene') {
    return <LearnTopicScene sceneId={spec.sceneId} autoRotate={autoRotate} />
  }
  return null
}

export function LearnPremiumCanvas({
  spec,
  autoRotate = true,
}: {
  spec: LearnVisualSpec
  autoRotate?: boolean
}) {
  return (
    <Canvas
      camera={{ position: CATALOG_HERO_VIEW.cameraPosition, fov: CATALOG_HERO_VIEW.fov }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#05070f']} />
      <fog attach="fog" args={['#05070f', 7, 18]} />
      <Suspense fallback={null}>
        <LearnPremiumSceneContent spec={spec} autoRotate={autoRotate} />
      </Suspense>
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={2.8}
        maxDistance={5.5}
        minPolarAngle={CATALOG_HERO_VIEW.minPolarAngle}
        maxPolarAngle={CATALOG_HERO_VIEW.maxPolarAngle}
        enableDamping
        dampingFactor={0.06}
      />
    </Canvas>
  )
}
