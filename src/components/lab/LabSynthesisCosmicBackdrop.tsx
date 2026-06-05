import { useMemo, useRef, type MutableRefObject } from 'react'
import { Stars, Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/** Единый фон реактора — без скачка при смене фаз. */
export const LAB_COSMIC_BG = '#0a0c18'
const FOG: [string, number, number] = [LAB_COSMIC_BG, 8, 28]

function NebulaPlane({
  position,
  scale,
  color,
  baseOpacity,
  spin,
  boostRef,
}: {
  position: [number, number, number]
  scale: [number, number, number]
  color: string
  baseOpacity: number
  spin: number
  boostRef: MutableRefObject<number>
}) {
  const ref = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((s) => {
    if (ref.current) ref.current.rotation.z = s.clock.elapsedTime * spin
    if (matRef.current) {
      matRef.current.opacity = baseOpacity * (0.55 + boostRef.current * 0.9)
    }
  })
  return (
    <mesh ref={ref} position={position} scale={scale} rotation={[Math.PI * 0.5, 0, 0]}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <meshBasicMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={baseOpacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/**
 * Стабильный космос на весь run синтеза — не размонтируется между фазами (нет мигания фона).
 */
export function LabSynthesisCosmicBackdrop({
  phase,
  accentHex = '#3dffec',
  lite = true,
}: {
  phase: string
  accentHex?: string
  lite?: boolean
}) {
  const boostRef = useRef(0.42)
  const padGlow = useMemo(() => new THREE.Color(accentHex), [accentHex])
  const padRef = useRef<THREE.Mesh>(null)
  const padInnerRef = useRef<THREE.Mesh>(null)
  const shockwaveRef = useRef<THREE.Mesh>(null)
  const ptRef = useRef<THREE.PointLight>(null)

  const inMerge = phase === 'mergeFlash'
  const inProduct = phase === 'product' || phase === 'settled'
  const starCount = lite ? 720 : 1800
  const sparkleCount = lite ? 28 : 64

  useFrame((s) => {
    const t = s.clock.elapsedTime
    let target = 0.38
    if (inMerge) target = 0.72
    else if (phase === 'converge' || phase === 'ignite' || phase === 'flying') target = 0.52
    else if (inProduct) target = 0.28
    boostRef.current += (target - boostRef.current) * 0.12

    const boost = boostRef.current
    if (padRef.current) {
      const mat = padRef.current.material as THREE.MeshBasicMaterial
      mat.opacity =
        (inMerge ? 0.5 : 0.26) + boost * 0.45 + Math.sin(t * 3.4) * 0.05 * boost
    }
    if (padInnerRef.current) {
      const mat = padInnerRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.14 + boost * 0.32
      padInnerRef.current.scale.setScalar(1 + boost * 0.22 + Math.sin(t * 5.5) * 0.03)
    }
    if (shockwaveRef.current && inMerge) {
      const mat = shockwaveRef.current.material as THREE.MeshBasicMaterial
      const pulse = (Math.sin(t * 8) + 1) * 0.5
      mat.opacity = pulse * boost * 0.4
      shockwaveRef.current.scale.setScalar(2.6 + pulse * 2)
    }
    if (ptRef.current) ptRef.current.intensity = 0.5 + boost * 3.8
  })

  return (
    <>
      <color attach="background" args={[LAB_COSMIC_BG]} />
      <fog attach="fog" args={FOG} />

      <Stars
        radius={120}
        depth={70}
        count={starCount}
        factor={lite ? 3.2 : 4.5}
        saturation={0.18}
        fade
        speed={lite ? 0.55 : 1.2}
      />
      <Sparkles
        count={sparkleCount}
        scale={lite ? 10 : 14}
        size={lite ? 1.8 : 2.4}
        speed={lite ? 1.4 : 2.2}
        opacity={0.28}
        color={accentHex}
        position={[0, 0.5, 0]}
      />

      <NebulaPlane
        position={[0, 1.6, -9]}
        scale={[28, 28, 1]}
        color="#1e4a8a"
        baseOpacity={0.12}
        spin={0.014}
        boostRef={boostRef}
      />
      {!lite ? (
        <NebulaPlane
          position={[3, 0.5, -6]}
          scale={[18, 20, 1]}
          color="#3d1f7a"
          baseOpacity={0.09}
          spin={-0.01}
          boostRef={boostRef}
        />
      ) : null}
      <NebulaPlane
        position={[-3.5, 0.2, -5.5]}
        scale={[14, 16, 1]}
        color={padGlow.getStyle()}
        baseOpacity={0.1}
        spin={0.016}
        boostRef={boostRef}
      />

      <mesh ref={padRef} position={[0, -2.2, 1]} rotation={[-Math.PI * 0.44, 0, 0]}>
        <ringGeometry args={[2.4, 5.8, lite ? 48 : 72]} />
        <meshBasicMaterial
          color={padGlow}
          transparent
          opacity={0.32}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={padInnerRef} position={[0, -2.15, 1.05]} rotation={[-Math.PI * 0.44, 0, 0]}>
        <ringGeometry args={[0.5, 2.6, 40]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {inMerge ? (
        <mesh ref={shockwaveRef} position={[0, 0.05, 0.2]} rotation={[-Math.PI * 0.5, 0, 0]}>
          <ringGeometry args={[0.85, 1.05, 48]} />
          <meshBasicMaterial
            color={padGlow}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}

      <pointLight ref={ptRef} position={[0, -1.2, 2.5]} intensity={1} color={accentHex} distance={16} decay={2} />
      <hemisphereLight color="#a8d4ff" groundColor="#050510" intensity={0.32} />
    </>
  )
}
