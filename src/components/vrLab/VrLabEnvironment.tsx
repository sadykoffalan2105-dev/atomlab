import { Environment, MeshReflectorMaterial } from '@react-three/drei'
import { useBenchTopTexture, useLabWallTexture } from './vrLabTextures'

export function VrLabEnvironment() {
  const benchTex = useBenchTopTexture()
  const wallTex = useLabWallTexture()

  return (
    <group>
      <color attach="background" args={['#1a1f28']} />
      <fog attach="fog" args={['#1a1f28', 6, 16]} />

      {/* Пол */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.48, 0]} receiveShadow>
        <planeGeometry args={[14, 10]} />
        <MeshReflectorMaterial
          blur={[320, 120]}
          resolution={512}
          mixBlur={0.65}
          mixStrength={0.35}
          roughness={0.85}
          depthScale={0.6}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#2a3038"
          metalness={0.15}
          mirror={0.25}
        />
      </mesh>

      {/* Задняя стена */}
      <mesh position={[0, 1.1, -2.2]} receiveShadow>
        <planeGeometry args={[12, 3.2]} />
        <meshStandardMaterial map={wallTex} roughness={0.92} metalness={0.02} />
      </mesh>

      {/* Боковые стены (мягкий свет) */}
      <mesh position={[-3.5, 1, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[8, 3]} />
        <meshStandardMaterial color="#d8dde3" roughness={0.95} />
      </mesh>
      <mesh position={[3.5, 1, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[8, 3]} />
        <meshStandardMaterial color="#d0d5dc" roughness={0.95} />
      </mesh>

      {/* Столешница */}
      <mesh position={[0, -0.01, 0]} receiveShadow castShadow>
        <boxGeometry args={[4.6, 0.09, 1.75]} />
        <meshStandardMaterial map={benchTex} roughness={0.38} metalness={0.08} />
      </mesh>

      {/* Кромка стола */}
      <mesh position={[0, -0.06, 0.86]}>
        <boxGeometry args={[4.6, 0.04, 0.06]} />
        <meshStandardMaterial color="#6a737d" roughness={0.5} metalness={0.2} />
      </mesh>

      {/* Тумба */}
      <mesh position={[0, -0.28, 0]}>
        <boxGeometry args={[4.2, 0.38, 1.45]} />
        <meshStandardMaterial color="#4a525c" roughness={0.72} />
      </mesh>

      {/* Лампы потолочные (как в школьной лаборатории) */}
      {[-1.2, 1.2].map((x) => (
        <group key={x} position={[x, 2.4, 0.3]}>
          <mesh>
            <boxGeometry args={[1.1, 0.06, 0.35]} />
            <meshStandardMaterial color="#f8fafc" emissive="#fffef5" emissiveIntensity={0.8} />
          </mesh>
          <pointLight intensity={1.4} distance={5} color="#fff8ee" castShadow shadow-mapSize={[512, 512]} />
        </group>
      ))}

      <Environment preset="studio" environmentIntensity={0.35} />
    </group>
  )
}

export function VrLabLighting() {
  return (
    <>
      <ambientLight intensity={0.28} color="#e8eef8" />
      <directionalLight
        position={[2, 4.5, 2.5]}
        intensity={1.35}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={12}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        color="#fff5eb"
      />
      <directionalLight position={[-2.5, 2, -1]} intensity={0.25} color="#b8d4ff" />
      <hemisphereLight args={['#f0f4ff', '#3a4048', 0.35]} />
    </>
  )
}
