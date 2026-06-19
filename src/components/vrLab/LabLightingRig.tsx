import { Environment, Lightformer } from '@react-three/drei'
import { useVrLabPerf } from './vrLabPerformance'
import { VR_THEME } from './vrLabTheme'

/** HDRI + area lights — даёт реалистичные отражения на стекле и столе. */
export function LabLightingRig() {
  const { tier, shadows, shadowMapSize } = useVrLabPerf()

  return (
    <>
      {tier !== 'low' ? (
        <Environment preset="warehouse" background={false} blur={0.55} environmentIntensity={0.85}>
          <Lightformer
            intensity={5}
            color={VR_THEME.magenta}
            position={[-2.2, 1.4, -0.8]}
            scale={[5, 0.12, 1.2]}
          />
          <Lightformer
            intensity={4}
            color={VR_THEME.cyan}
            position={[2.0, 1.2, -0.6]}
            scale={[4, 0.1, 1]}
          />
          <Lightformer
            intensity={10}
            color="#fff8f0"
            position={[0, 3.2, 0.2]}
            scale={[3.5, 3.5, 0.08]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <Lightformer
            intensity={2.5}
            color="#c4b8ff"
            position={[0, 0.5, 2.5]}
            scale={[6, 4, 0.05]}
          />
        </Environment>
      ) : null}

      <ambientLight intensity={tier === 'high' ? 0.42 : 0.55} color="#e8e4f8" />

      <directionalLight
        position={[1.2, 4.2, 2.5]}
        intensity={tier === 'high' ? 1.35 : 1.05}
        castShadow={shadows}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-far={12}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-2}
        shadow-bias={-0.0002}
        color="#fff5f0"
      />

      <directionalLight position={[-2, 2.5, 1.2]} intensity={0.55} color="#c4e8ff" />

      <spotLight
        position={[-1.4, 2.4, 0.6]}
        angle={0.42}
        penumbra={0.85}
        intensity={tier === 'high' ? 28 : 14}
        color={VR_THEME.cyan}
        castShadow={shadows && tier === 'high'}
        distance={8}
        decay={2}
      />

      <pointLight position={[0.4, 0.65, 0.35]} intensity={0.45} color="#00e5ff" distance={2.8} />
      <pointLight position={[-0.8, 0.4, 0.15]} intensity={0.25} color={VR_THEME.magenta} distance={2} />

      <hemisphereLight args={['#f0ecff', '#3a3458', tier === 'high' ? 0.55 : 0.45]} />
    </>
  )
}
