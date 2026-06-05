import { useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * «Реактор дуги» в духе Iron Man / Intellara — кольца, шестиугольная сетка, импульс при столкновении.
 */
export function SynthesisArcReactor({
  active,
  accentHex,
  impactPulseRef,
  lite = false,
}: {
  active: boolean
  accentHex: string
  impactPulseRef: MutableRefObject<number>
  lite?: boolean
}) {
  const coreRef = useRef<THREE.Group>(null)
  const ringARef = useRef<THREE.Mesh>(null)
  const ringBRef = useRef<THREE.Mesh>(null)
  const ringCRef = useRef<THREE.Mesh>(null)
  const hexRef = useRef<THREE.Mesh>(null)
  const scanRef = useRef<THREE.Mesh>(null)

  const accent = useMemo(() => new THREE.Color(accentHex), [accentHex])
  const cyan = useMemo(() => new THREE.Color('#3dffec'), [])
  const gold = useMemo(() => new THREE.Color('#ffb347'), [])

  useFrame((state) => {
    if (!active) return
    const t = state.clock.elapsedTime
    const pulse = Math.max(0, impactPulseRef.current)
    if (coreRef.current) coreRef.current.rotation.y = t * 0.85
    if (ringARef.current) {
      ringARef.current.rotation.z = t * 1.4
      ringARef.current.scale.setScalar(1.05 + pulse * 0.35 + Math.sin(t * 3.2) * 0.02)
    }
    if (ringBRef.current) {
      ringBRef.current.rotation.z = -t * 1.1
      ringBRef.current.rotation.x = Math.PI * 0.5
    }
    if (ringCRef.current) {
      ringCRef.current.rotation.x = Math.PI * 0.42 + Math.sin(t * 0.9) * 0.08
      ringCRef.current.rotation.y = t * 0.65
    }
    if (hexRef.current) {
      hexRef.current.rotation.z = t * 0.22
      const s = 1.8 + pulse * 0.5
      hexRef.current.scale.set(s, s, 1)
    }
    if (scanRef.current) {
      scanRef.current.position.y = Math.sin(t * 2.8) * 0.55
      const mat = scanRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.22 + pulse * 0.45 + (Math.sin(t * 5) * 0.5 + 0.5) * 0.18
    }
  })

  if (!active) return null

  return (
    <group position={[0, 0.08, 0]}>
      <pointLight color={accent} intensity={lite ? 1.6 : 2.2} distance={14} decay={2} />
      {!lite ? (
        <pointLight color={cyan} intensity={1.1} distance={9} position={[0.4, 0.2, 0.3]} />
      ) : null}

      <group ref={coreRef}>
        <mesh ref={ringARef} rotation={[Math.PI * 0.5, 0, 0]}>
          <torusGeometry args={[1.05, 0.018, 6, lite ? 48 : 96]} />
          <meshBasicMaterial color={accent} transparent opacity={0.82} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh ref={ringBRef}>
          <torusGeometry args={[0.78, 0.012, 6, lite ? 40 : 80]} />
          <meshBasicMaterial color={cyan} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {!lite ? (
          <mesh ref={ringCRef}>
            <torusGeometry args={[1.28, 0.008, 6, 72]} />
            <meshBasicMaterial color={gold} transparent opacity={0.38} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        ) : (
          <mesh ref={ringCRef} visible={false}>
            <torusGeometry args={[1.28, 0.008, 6, 24]} />
            <meshBasicMaterial color={gold} transparent opacity={0} />
          </mesh>
        )}
      </group>

      <mesh ref={hexRef} rotation={[-Math.PI * 0.5, 0, 0]} position={[0, -0.02, 0]}>
        <ringGeometry args={[0.35, 1.65, 6]} />
        <meshBasicMaterial
          color="#1a2848"
          transparent
          opacity={0.35}
          wireframe
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={scanRef} rotation={[0, 0, 0]}>
        <planeGeometry args={[2.4, 0.04]} />
        <meshBasicMaterial color={cyan} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {Array.from({ length: lite ? 4 : 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 1.15, 0, Math.sin(a) * 1.15]} rotation={[0, -a, 0]}>
            <boxGeometry args={[0.02, 0.35, 0.02]} />
            <meshBasicMaterial color={accent} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        )
      })}
    </group>
  )
}
