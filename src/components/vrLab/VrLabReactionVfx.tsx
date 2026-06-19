import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { VrLabMixResult } from '../../vrLab/types'
import { resolveReactionVfx } from '../../vrLab/reactions/effectPresets'
import { clamp01, lerp } from '../../vrLab/vrLabAnimation'
import { useVrLabPerf } from './vrLabPerformance'
import { VR_THEME } from './vrLabTheme'
import { GPUParticleField } from './gpu/GPUParticleField'

type Props = {
  active: boolean
  result: VrLabMixResult | null
  phase: 'idle' | 'pouring' | 'combining' | 'reacting'
  mixing: boolean
  progress?: number
  position?: [number, number, number]
  reactionPair?: { a: string; b: string } | null
}

/** Оркестратор VFX реакции: пузырьки, пар, вспышка, подсветка. */
export function VrLabReactionVfx({
  active,
  result,
  phase,
  mixing,
  progress = 1,
  position = [0, 0.22, 0],
  reactionPair = null,
}: Props) {
  const { particleCount, tier } = useVrLabPerf()
  const bubblesRef = useRef<THREE.InstancedMesh>(null)
  const flashRef = useRef<THREE.Mesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const vfx = useMemo(
    () => resolveReactionVfx(result, progress, phase, mixing, reactionPair),
    [mixing, phase, progress, reactionPair, result],
  )

  const spread = vfx?.preset.particleSpread ?? 0.22

  const bubbleData = useMemo(() => {
    return Array.from({ length: particleCount }, () => ({
      x: (Math.random() - 0.5) * spread,
      y: Math.random() * 0.1,
      z: (Math.random() - 0.5) * spread,
      speed: 0.014 + Math.random() * 0.032,
      phase: Math.random() * Math.PI * 2,
      scale: 0.008 + Math.random() * 0.016,
    }))
  }, [particleCount, spread])

  const bubbleColor = useMemo(() => {
    const hex = vfx?.preset.bubbleColor ?? VR_THEME.cyan
    return new THREE.Color(hex)
  }, [vfx?.preset.bubbleColor])

  useFrame((state, dt) => {
    if (!active || !vfx) return
    const intensity = vfx.bubbleIntensity

    if (bubblesRef.current && particleCount > 0) {
      bubbleData.forEach((b, i) => {
        b.y += b.speed * intensity * (1 + dt * 20)
        if (b.y > 0.48) b.y = 0
        const wobble = Math.sin(state.clock.elapsedTime * 6 + b.phase) * 0.016 * intensity
        dummy.position.set(b.x + wobble, b.y, b.z + wobble * 0.5)
        dummy.scale.setScalar(b.scale * (1 + intensity * 0.55))
        dummy.updateMatrix()
        bubblesRef.current!.setMatrixAt(i, dummy.matrix)
      })
      bubblesRef.current.instanceMatrix.needsUpdate = true
    }

    if (flashRef.current) {
      const s = vfx.flashStrength
      flashRef.current.visible = s > 0.02
      flashRef.current.scale.setScalar(1 + s * 2.2)
      const mat = flashRef.current.material as THREE.MeshStandardMaterial
      mat.opacity = s * 0.55
      mat.emissiveIntensity = s * 2.5
    }
  })

  if (!active || !vfx || particleCount === 0) return null

  const p = clamp01(progress)
  const lightColor = vfx.preset.emissiveColor

  return (
    <group position={position}>
      <GPUParticleField
        mode="steam"
        active
        intensity={vfx.steamIntensity}
        color={vfx.preset.steamColor}
        spread={vfx.preset.particleSpread}
        gasPlume={vfx.preset.gasPlume}
      />

      <instancedMesh ref={bubblesRef} args={[undefined, undefined, particleCount]} frustumCulled>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial
          color={bubbleColor}
          emissive={bubbleColor}
          emissiveIntensity={0.55 + vfx.heatGlow * 0.4}
          transparent
          opacity={lerp(0.35, 0.75, vfx.bubbleIntensity)}
          roughness={0.12}
        />
      </instancedMesh>

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

      {tier === 'high' && vfx.preset.gasPlume ? (
        <pointLight color={VR_THEME.cyan} intensity={vfx.intensity * 1.4} distance={1.5} />
      ) : null}
    </group>
  )
}

/** Уровень запотевания для реактора (0..1). */
export function resolveCondensationLevel(
  result: VrLabMixResult | null,
  progress: number,
  phase: Props['phase'],
  mixing: boolean,
  reactionPair?: { a: string; b: string } | null,
): number {
  return resolveReactionVfx(result, progress, phase, mixing, reactionPair)?.condensation ?? 0
}
