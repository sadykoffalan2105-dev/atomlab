import { Environment, MeshReflectorMaterial } from '@react-three/drei'
import { useBenchTopTexture, useLabWallTexture } from './vrLabTextures'

export function VrLabEnvironment() {
  const benchTex = useBenchTopTexture()
  const wallTex = useLabWallTexture()

  return (
    <group>
      {/* Фон как у LabXchange — тёмно-синий лабораторный */}
      <color attach="background" args={['#243040']} />
      <fog attach="fog" args={['#243040', 8, 18]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.48, 0]} receiveShadow>
        <planeGeometry args={[14, 10]} />
        <MeshReflectorMaterial
          blur={[280, 100]}
          resolution={512}
          mixBlur={0.7}
          mixStrength={0.28}
          roughness={0.88}
          depthScale={0.5}
          color="#1e2838"
          metalness={0.12}
          mirror={0.2}
        />
      </mesh>

      <mesh position={[0, 1.15, -1.05]} receiveShadow>
        <planeGeometry args={[12, 3.5]} />
        <meshStandardMaterial map={wallTex} roughness={0.88} color="#dce2ea" />
      </mesh>

      <mesh position={[-3.8, 1, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[8, 3.2]} />
        <meshStandardMaterial color="#d0d8e0" roughness={0.92} />
      </mesh>
      <mesh position={[3.8, 1, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[8, 3.2]} />
        <meshStandardMaterial color="#c8d0d8" roughness={0.92} />
      </mesh>

      {/* Основной стол (передний ярус) */}
      <mesh position={[0, -0.01, 0.08]} receiveShadow castShadow>
        <boxGeometry args={[4.8, 0.09, 1.85]} />
        <meshStandardMaterial map={benchTex} roughness={0.32} metalness={0.12} color="#9aa4b0" />
      </mesh>
      <mesh position={[0, -0.06, 0.98]}>
        <boxGeometry args={[4.8, 0.04, 0.06]} />
        <meshStandardMaterial color="#5a6570" roughness={0.45} metalness={0.25} />
      </mesh>
      <mesh position={[0, -0.28, 0.08]}>
        <boxGeometry args={[4.4, 0.38, 1.55]} />
        <meshStandardMaterial color="#3a4550" roughness={0.68} />
      </mesh>

      <Environment preset="city" environmentIntensity={0.42} />
    </group>
  )
}

export function VrLabLighting() {
  return (
    <>
      <ambientLight intensity={0.42} color="#eef2f8" />
      <directionalLight
        position={[1.5, 4, 3]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={14}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-2}
        shadow-bias={-0.0002}
        color="#fff8f0"
      />
      <directionalLight position={[-2, 2.5, 1]} intensity={0.35} color="#c8d8f0" />
      <hemisphereLight args={['#f0f4ff', '#283040', 0.5]} />
    </>
  )
}
