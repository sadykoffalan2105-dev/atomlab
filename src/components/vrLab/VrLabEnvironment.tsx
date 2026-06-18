import { Environment, MeshReflectorMaterial } from '@react-three/drei'
import { useBenchTopTexture, useLabWallTexture } from './vrLabTextures'
import { useVrLabPerf } from './vrLabPerformance'
import { VR_THEME } from './vrLabTheme'

function NeonStrip({
  position,
  rotation = [0, 0, 0] as [number, number, number],
  args = [3, 0.015, 0.02] as [number, number, number],
  color = VR_THEME.cyan,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  args?: [number, number, number]
  color?: string
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.2} roughness={0.15} />
    </mesh>
  )
}

export function VrLabEnvironment() {
  const benchTex = useBenchTopTexture()
  const wallTex = useLabWallTexture()
  const { useReflector, decorPointLights } = useVrLabPerf()

  return (
    <group>
      <color attach="background" args={[VR_THEME.bg]} />
      <fog attach="fog" args={[VR_THEME.fog, 5, 14]} />

      {useReflector ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.48, 0]} receiveShadow>
          <planeGeometry args={[14, 10]} />
          <MeshReflectorMaterial
            blur={[256, 80]}
            resolution={256}
            mixBlur={0.75}
            mixStrength={0.42}
            roughness={0.72}
            depthScale={0.55}
            color={VR_THEME.floor}
            metalness={0.38}
            mirror={0.32}
          />
        </mesh>
      ) : (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.48, 0]} receiveShadow>
          <planeGeometry args={[14, 10]} />
          <meshStandardMaterial color={VR_THEME.floor} roughness={0.85} metalness={0.15} />
        </mesh>
      )}

      <mesh position={[0, 1.15, -1.05]} receiveShadow>
        <planeGeometry args={[12, 3.5]} />
        <meshStandardMaterial map={wallTex} roughness={0.52} metalness={0.28} color={VR_THEME.wall} />
      </mesh>

      <mesh position={[-3.8, 1, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[8, 3.2]} />
        <meshStandardMaterial map={wallTex} color={VR_THEME.wallDark} roughness={0.58} metalness={0.22} />
      </mesh>
      <mesh position={[3.8, 1, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[8, 3.2]} />
        <meshStandardMaterial map={wallTex} color={VR_THEME.wallDark} roughness={0.58} metalness={0.22} />
      </mesh>

      <NeonStrip position={[0, 0.52, -0.88]} args={[4.8, 0.01, 0.012]} color={VR_THEME.magenta} />
      <NeonStrip position={[0, 1.38, -0.88]} args={[4.8, 0.008, 0.01]} color={VR_THEME.cyan} />
      <NeonStrip position={[-3.75, 0.68, 0]} rotation={[0, Math.PI / 2, 0]} args={[2.8, 0.008, 0.01]} color={VR_THEME.magenta} />
      <NeonStrip position={[3.75, 0.68, 0]} rotation={[0, -Math.PI / 2, 0]} args={[2.8, 0.008, 0.01]} color={VR_THEME.cyan} />

      <mesh position={[0, -0.01, 0.08]} receiveShadow castShadow>
        <boxGeometry args={[4.8, 0.09, 1.85]} />
        <meshStandardMaterial map={benchTex} roughness={0.22} metalness={0.58} color={VR_THEME.bench} />
      </mesh>
      <mesh position={[0, -0.055, 0.98]}>
        <boxGeometry args={[4.8, 0.032, 0.048]} />
        <meshStandardMaterial
          color={VR_THEME.benchEdge}
          emissive={VR_THEME.benchEdge}
          emissiveIntensity={2}
          roughness={0.12}
          metalness={0.45}
        />
      </mesh>
      <mesh position={[0, -0.28, 0.08]}>
        <boxGeometry args={[4.4, 0.38, 1.55]} />
        <meshStandardMaterial color={VR_THEME.benchBase} roughness={0.42} metalness={0.38} />
      </mesh>

      {decorPointLights ? (
        <>
          <pointLight position={[0, -0.12, 0.45]} intensity={0.45} color={VR_THEME.magenta} distance={2.5} />
          <pointLight position={[-1.2, 0.35, -0.2]} intensity={0.28} color={VR_THEME.cyan} distance={2.2} />
        </>
      ) : null}

      <Environment preset="night" environmentIntensity={0.5} />
    </group>
  )
}

export function VrLabLighting() {
  const { shadows, shadowMapSize } = useVrLabPerf()

  return (
    <>
      <ambientLight intensity={0.2} color="#6b5b95" />
      <directionalLight
        position={[1.1, 3.8, 2.2]}
        intensity={0.8}
        castShadow={shadows}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-far={12}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-2}
        shadow-bias={-0.0002}
        color="#c4b5fd"
      />
      <directionalLight position={[-2.2, 1.8, 0.8]} intensity={0.38} color={VR_THEME.cyan} />
      <hemisphereLight args={['#a855f7', '#0a0618', 0.32]} />
    </>
  )
}
