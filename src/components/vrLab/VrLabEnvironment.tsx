import * as THREE from 'three'
import { useMemo } from 'react'
import { useBenchCarbonNormal, useBenchCarbonWeave, useBenchTopTexture, useLabWallTexture } from './vrLabTextures'
import { VrLabCeilingLights, VrLabPulsingNeon } from './VrLabAmbientLife'
import { useVrLabPerf } from './vrLabPerformance'
import { VR_THEME } from './vrLabTheme'

export function VrLabEnvironment() {
  const benchTex = useBenchTopTexture()
  const carbonWeave = useBenchCarbonWeave()
  const carbonNormal = useBenchCarbonNormal()
  const wallTex = useLabWallTexture()
  const { tier } = useVrLabPerf()
  const carbonNormalScale = useMemo(() => new THREE.Vector2(0.35, 0.35), [])

  return (
    <group>
      <color attach="background" args={[VR_THEME.bg]} />
      <fog attach="fog" args={[VR_THEME.fog, 6, 18]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.48, 0]} receiveShadow>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color={VR_THEME.floor} roughness={0.82} metalness={0.12} />
      </mesh>

      <mesh position={[0, 1.15, -1.05]} receiveShadow>
        <planeGeometry args={[12, 3.5]} />
        <meshStandardMaterial map={wallTex} roughness={0.48} metalness={0.12} color={VR_THEME.wall} />
      </mesh>

      <mesh position={[-3.8, 1, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[8, 3.2]} />
        <meshStandardMaterial map={wallTex} color={VR_THEME.wallDark} roughness={0.52} metalness={0.1} />
      </mesh>
      <mesh position={[3.8, 1, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[8, 3.2]} />
        <meshStandardMaterial map={wallTex} color={VR_THEME.wallDark} roughness={0.52} metalness={0.1} />
      </mesh>

      {tier !== 'low' ? (
        <>
          <VrLabPulsingNeon position={[0, 0.55, -0.88]} args={[4.8, 0.008, 0.008]} color={VR_THEME.magenta} />
          <VrLabPulsingNeon position={[0, 1.32, -0.88]} args={[4.8, 0.008, 0.008]} color={VR_THEME.cyan} />
        </>
      ) : null}

      <VrLabCeilingLights />

      {/* Чистая рабочая поверхность */}
      <mesh position={[0, -0.028, 0.06]} receiveShadow castShadow>
        <boxGeometry args={[3.5, 0.06, 1.28]} />
        <meshStandardMaterial color={VR_THEME.benchBase} roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.002, 0.06]} receiveShadow>
        <boxGeometry args={[3.35, 0.012, 1.12]} />
        <meshPhysicalMaterial
          map={tier === 'high' ? carbonWeave : benchTex}
          normalMap={tier !== 'low' ? carbonNormal : undefined}
          normalScale={tier !== 'low' ? carbonNormalScale : undefined}
          color={VR_THEME.bench}
          roughness={tier === 'high' ? 0.08 : 0.14}
          metalness={tier === 'high' ? 0.72 : 0.58}
          clearcoat={1}
          clearcoatRoughness={0.06}
          envMapIntensity={tier === 'high' ? 1.6 : 0.9}
        />
      </mesh>
      <mesh position={[0, 0.009, 0.06]}>
        <boxGeometry args={[3.15, 0.002, 0.92]} />
        <meshPhysicalMaterial
          color="#12101a"
          roughness={0.04}
          metalness={0.82}
          transparent
          opacity={tier === 'high' ? 0.22 : 0.35}
          envMapIntensity={1.2}
        />
      </mesh>
      <mesh position={[0, 0.011, 0.62]}>
        <boxGeometry args={[3.35, 0.003, 0.004]} />
        <meshStandardMaterial
          color={VR_THEME.cyan}
          emissive={VR_THEME.cyan}
          emissiveIntensity={0.45}
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  )
}

export function VrLabLighting() {
  const { shadows, shadowMapSize } = useVrLabPerf()

  return (
    <>
      <ambientLight intensity={0.58} color="#e8e4f8" />
      <directionalLight
        position={[1.2, 4.2, 2.5]}
        intensity={1.1}
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
      <directionalLight position={[-2, 2.5, 1.2]} intensity={0.48} color="#c4e8ff" />
      <pointLight position={[0.4, 0.6, 0.35]} intensity={0.35} color="#00e5ff" distance={2.5} />
      <hemisphereLight args={['#f0ecff', '#4a4468', 0.5]} />
    </>
  )
}
