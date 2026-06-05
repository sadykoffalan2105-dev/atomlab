import { Suspense, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { SYNTHESIS_PERF } from '../../../../../lab/synthesisPerfPreset'
import { CyberExploreModels } from './CyberExploreModels'
import canvasStyles from './CyberExploreCanvas.module.css'

function Scene({
  taskId,
  hotspotId,
  animate,
  resetToken,
}: {
  taskId: string
  hotspotId: string
  animate: boolean
  resetToken: number
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null)

  useEffect(() => {
    controlsRef.current?.reset()
  }, [resetToken, taskId, hotspotId])

  return (
    <>
      <color attach="background" args={['#030810']} />
      <fog attach="fog" args={['#030810', 4, 12]} />
      <ambientLight intensity={0.45} />
      <pointLight position={[3, 4, 4]} intensity={0.95} color="#3dffec" />
      <pointLight position={[-3, 2, -2]} intensity={0.45} color="#ff6b9d" />
      <CyberExploreModels taskId={taskId} hotspotId={hotspotId} animate={animate} />
      <OrbitControls
        ref={controlsRef}
        enablePan
        enableZoom
        minDistance={1.1}
        maxDistance={6}
        maxPolarAngle={Math.PI * 0.85}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  )
}

export function CyberExploreCanvas({
  taskId,
  hotspotId,
  animate,
  resetToken,
}: {
  taskId: string
  hotspotId: string
  animate: boolean
  resetToken: number
}) {
  return (
    <div className={canvasStyles.wrap}>
      <Canvas
        className={canvasStyles.canvas}
        camera={{ position: [0, 0.4, 2.8], fov: 42 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        dpr={SYNTHESIS_PERF.cyberCanvasDpr}
        frameloop="always"
        performance={{ min: 0.55, max: 1, debounce: 200 }}
      >
        <Suspense fallback={null}>
          <Scene
            taskId={taskId}
            hotspotId={hotspotId}
            animate={animate}
            resetToken={resetToken}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
