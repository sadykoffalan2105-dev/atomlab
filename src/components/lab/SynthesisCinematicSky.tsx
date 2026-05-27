import { useMemo, useRef, type MutableRefObject } from 'react'
import { Stars, Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export type SynthesisCinematicPhase = 'converge' | 'merge' | 'fail'

const SKY = {
  converge: { c: '#010610', f: ['#010610', 10, 48] as [string, number, number] },
  merge: { c: '#020818', f: ['#020818', 8, 36] as [string, number, number] },
  fail: { c: '#140808', f: ['#120606', 5, 22] as [string, number, number] },
} as const

function NebulaPlane({
  position,
  scale,
  color,
  baseOpacity,
  spin,
  intensityRef,
}: {
  position: [number, number, number]
  scale: [number, number, number]
  color: string
  baseOpacity: number
  spin: number
  intensityRef: MutableRefObject<number>
}) {
  const ref = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((s) => {
    if (ref.current) ref.current.rotation.z = s.clock.elapsedTime * spin
    if (matRef.current) matRef.current.opacity = baseOpacity * (0.55 + intensityRef.current * 0.9)
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

/** Кинематографичное космос-небо — только во время синтеза (соединение атомов). */
export function SynthesisCinematicSky({
  phase,
  intensityRef,
  accentHex = '#3dffec',
}: {
  phase: SynthesisCinematicPhase
  intensityRef: MutableRefObject<number>
  accentHex?: string
}) {
  const bg = phase === 'fail' ? SKY.fail : phase === 'merge' ? SKY.merge : SKY.converge
  const padGlow = useMemo(() => new THREE.Color(accentHex), [accentHex])
  const padRef = useRef<THREE.Mesh>(null)
  const padInnerRef = useRef<THREE.Mesh>(null)
  const shockwaveRef = useRef<THREE.Mesh>(null)
  const ptRef = useRef<THREE.PointLight>(null)
  useFrame((s) => {
    const t = s.clock.elapsedTime
    const boost = intensityRef.current
    if (padRef.current) {
      const mat = padRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = (phase === 'merge' ? 0.55 : 0.28) + boost * 0.5 + Math.sin(t * 3.4) * 0.06 * boost
    }
    if (padInnerRef.current) {
      const mat = padInnerRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.15 + boost * 0.35
      padInnerRef.current.scale.setScalar(1 + boost * 0.25 + Math.sin(t * 5.5) * 0.04)
    }
    if (shockwaveRef.current && phase === 'merge') {
      const mat = shockwaveRef.current.material as THREE.MeshBasicMaterial
      const pulse = (Math.sin(t * 8) + 1) * 0.5
      mat.opacity = pulse * boost * 0.45
      shockwaveRef.current.scale.setScalar(2.8 + pulse * 2.2)
    }
    if (ptRef.current) ptRef.current.intensity = 0.6 + boost * 4.5
  })

  return (
    <>
      <color attach="background" args={[bg.c]} />
      <fog attach="fog" args={bg.f} />

      <Stars radius={140} depth={80} count={2800} factor={5} saturation={0.2} fade speed={1.8} />
      <Sparkles count={80} scale={14} size={2.4} speed={2.2} opacity={0.35} color={accentHex} position={[0, 0.5, 0]} />

      <NebulaPlane
        position={[0, 1.8, -10]}
        scale={[32, 32, 1]}
        color="#1e4a8a"
        baseOpacity={0.14}
        spin={0.018}
        intensityRef={intensityRef}
      />
      <NebulaPlane
        position={[3, 0.6, -7]}
        scale={[20, 24, 1]}
        color="#3d1f7a"
        baseOpacity={0.1}
        spin={-0.012}
        intensityRef={intensityRef}
      />
      <NebulaPlane
        position={[-4, 0.2, -6]}
        scale={[16, 18, 1]}
        color={padGlow.getStyle()}
        baseOpacity={0.12}
        spin={0.02}
        intensityRef={intensityRef}
      />

      <mesh ref={padRef} position={[0, -2.2, 1]} rotation={[-Math.PI * 0.44, 0, 0]}>
        <ringGeometry args={[2.4, 6.2, 72]} />
        <meshBasicMaterial
          color={padGlow}
          transparent
          opacity={0.35}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={padInnerRef} position={[0, -2.15, 1.05]} rotation={[-Math.PI * 0.44, 0, 0]}>
        <ringGeometry args={[0.5, 2.8, 48]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.2}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {phase === 'merge' ? (
        <mesh ref={shockwaveRef} position={[0, 0.05, 0.2]} rotation={[-Math.PI * 0.5, 0, 0]}>
          <ringGeometry args={[0.85, 1.05, 64]} />
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

      <pointLight ref={ptRef} position={[0, -1.2, 2.5]} intensity={1} color={accentHex} distance={18} decay={2} />
      <hemisphereLight color="#a8d4ff" groundColor="#050510" intensity={0.35} />
    </>
  )
}
