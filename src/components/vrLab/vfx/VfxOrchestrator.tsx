import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VrLabMixResult } from '../../../vrLab/types'
import { resolveReactionVfx } from '../../../vrLab/reactions/effectPresets'
import { gasColorFor, precipitateColorFor } from '../../../vrLab/substanceVisuals'
import { getVrLabPhysProps } from '../../../vrLab/chemistry/vrLabPhysProps'
import { clamp01, easeOutCubic, lerp } from '../../../vrLab/vrLabAnimation'
import { useVrLabPerf } from '../vrLabPerformance'
import { VR_THEME } from '../vrLabTheme'
import { GPUParticleField } from '../gpu/GPUParticleField'
import { InstancedBubbleField } from '../gpu/InstancedBubbleField'
import { ReactionGodRays } from './ReactionGodRays'

type Props = {
  active: boolean
  result: VrLabMixResult | null
  phase: 'idle' | 'pouring' | 'combining' | 'reacting'
  mixing: boolean
  progress?: number
  position?: [number, number, number]
  reactionPair?: { a: string; b: string } | null
}

const PRECIP_COUNT = 24

/** Единый оркестратор VFX: пар, газ, осадок, вспышка, пламя. */
export function VfxOrchestrator({
  active,
  result,
  phase,
  mixing,
  progress = 1,
  position = [0, 0.22, 0],
  reactionPair = null,
}: Props) {
  const { particleCount, tier } = useVrLabPerf()
  const flashRef = useRef<THREE.Mesh>(null)
  const precipRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const fillRef = useRef(0.5)

  const vfx = useMemo(
    () => resolveReactionVfx(result, progress, phase, mixing, reactionPair),
    [mixing, phase, progress, reactionPair, result],
  )

  const precipColor = useMemo(() => {
    const id = result?.precipitateId ?? result?.productId ?? ''
    return new THREE.Color(precipitateColorFor(id))
  }, [result?.precipitateId, result?.productId])

  const bubbleColor = useMemo(() => {
    const gasId = result?.gasIds?.[0]
    const hex = gasId ? gasColorFor(gasId) : vfx?.preset.gasColor ?? vfx?.preset.bubbleColor ?? VR_THEME.cyan
    return new THREE.Color(hex)
  }, [result?.gasIds, vfx?.preset.bubbleColor, vfx?.preset.gasColor])

  const flameColor = useMemo(() => {
    const pair = reactionPair
    if (!pair) return null
    const c = getVrLabPhysProps(pair.a).flameTestColor ?? getVrLabPhysProps(pair.b).flameTestColor
    return c ? new THREE.Color(c) : null
  }, [reactionPair])

  const precipData = useMemo(
    () =>
      Array.from({ length: PRECIP_COUNT }, () => ({
        x: (Math.random() - 0.5) * 0.14,
        z: (Math.random() - 0.5) * 0.14,
        scale: 0.004 + Math.random() * 0.012,
        phase: Math.random() * Math.PI * 2,
      })),
    [],
  )

  useFrame((state) => {
    if (!active || !vfx) return

    if (flashRef.current) {
      const s = vfx.flashStrength
      flashRef.current.visible = s > 0.02
      flashRef.current.scale.setScalar(1 + s * 2.2)
      const mat = flashRef.current.material as THREE.MeshStandardMaterial
      mat.opacity = s * 0.55
      mat.emissiveIntensity = s * 2.5
    }

    const showPrecip = result?.effect === 'precipitate' || (vfx.precipitateIntensity ?? 0) > 0.1
    if (precipRef.current && showPrecip) {
      const grow = easeOutCubic(clamp01(progress))
      precipData.forEach((p, i) => {
        const y = 0.02 + grow * 0.06 * (0.3 + Math.sin(p.phase) * 0.2)
        dummy.position.set(p.x, y, p.z)
        dummy.scale.setScalar(p.scale * (0.2 + grow * 0.9))
        dummy.rotation.y = state.clock.elapsedTime * 0.5 + p.phase
        dummy.updateMatrix()
        precipRef.current!.setMatrixAt(i, dummy.matrix)
      })
      precipRef.current.instanceMatrix.needsUpdate = true
    }
  })

  if (!active || !vfx) return null

  const p = clamp01(progress)
  const lightColor = vfx.preset.emissiveColor
  const useGpuBubbles = result?.effect === 'gasEvolution' || vfx.preset.gasPlume
  const showPrecip = result?.effect === 'precipitate' || (vfx.precipitateIntensity ?? 0) > 0.1

  return (
    <group position={position}>
      <GPUParticleField
        mode={result?.effect === 'combustion' ? 'steam' : 'steam'}
        active
        intensity={vfx.steamIntensity}
        color={vfx.preset.steamColor}
        spread={vfx.preset.particleSpread}
        gasPlume={vfx.preset.gasPlume}
      />

      {useGpuBubbles ? (
        <InstancedBubbleField
          count={Math.min(particleCount, 20)}
          radius={vfx.preset.particleSpread * 0.8}
          baseY={0.02}
          maxHeight={0.35}
          fillRef={fillRef}
          color={bubbleColor.getStyle()}
          active
        />
      ) : null}

      {showPrecip ? (
        <instancedMesh ref={precipRef} args={[undefined, undefined, PRECIP_COUNT]} frustumCulled>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={precipColor}
            emissive={precipColor}
            emissiveIntensity={0.15}
            roughness={0.35}
            metalness={0.08}
          />
        </instancedMesh>
      ) : null}

      {flameColor && tier === 'high' && result?.effect !== 'noReaction' ? (
        <mesh position={[0, 0.12, 0]}>
          <coneGeometry args={[0.04, 0.14, 8]} />
          <meshStandardMaterial
            color={flameColor}
            emissive={flameColor}
            emissiveIntensity={1.2}
            transparent
            opacity={0.65 * vfx.intensity}
            depthWrite={false}
          />
        </mesh>
      ) : null}

      <mesh ref={flashRef} visible={false}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial
          color={lightColor}
          emissive={lightColor}
          emissiveIntensity={1}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {tier !== 'low' && vfx.heatGlow > 0.2 ? (
        <pointLight color={lightColor} intensity={lerp(0, vfx.heatGlow * 2.8, p)} distance={2.2} />
      ) : null}

      {tier === 'high' && vfx.heatGlow > 0.35 ? (
        <ReactionGodRays active intensity={vfx.heatGlow * vfx.intensity} color={lightColor} />
      ) : null}
    </group>
  )
}

export function resolveCondensationLevel(
  result: VrLabMixResult | null,
  progress: number,
  phase: Props['phase'],
  mixing: boolean,
  reactionPair?: { a: string; b: string } | null,
): number {
  return resolveReactionVfx(result, progress, phase, mixing, reactionPair)?.condensation ?? 0
}
