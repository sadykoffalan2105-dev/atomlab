import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { getIsometricSceneDef } from '../learn/learnIsometricScenes'
import { IsometricEduScene } from '../components/learn/topicScenes/isometric/IsometricEduScene'

/** Скрытая страница для headless-скриншотов всех § (scripts/capture-learn-refs.ts). */
export function LearnRefCapturePage() {
  const { sceneId = '' } = useParams()
  const def = getIsometricSceneDef(sceneId)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(false)
    const t = window.setTimeout(() => setReady(true), 2800)
    return () => window.clearTimeout(t)
  }, [sceneId])

  if (!def) {
    return (
      <div data-learn-ref-frame data-ref-ready="true" data-ref-error="no-def">
        missing:{sceneId}
      </div>
    )
  }

  return (
    <div
      data-learn-ref-frame
      data-ref-ready={ready ? 'true' : 'false'}
      data-scene-id={sceneId}
      style={{
        width: 1280,
        height: 720,
        background: '#d4dae8',
        margin: 0,
        overflow: 'hidden',
      }}
    >
      <Canvas
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        dpr={[1, 2]}
        camera={{ position: [5.2, 4.8, 5.2], fov: 38, near: 0.1, far: 100 }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#d4dae8']} />
        <IsometricEduScene def={def} sceneId={sceneId} autoRotate={false} forceProcedural />
        <OrbitControls enableZoom={false} enablePan={false} target={[0, 0.35, 0]} />
      </Canvas>
    </div>
  )
}
