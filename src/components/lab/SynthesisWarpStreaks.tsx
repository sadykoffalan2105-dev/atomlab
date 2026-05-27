import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { MutableRefObject } from 'react'

const STREAK_COUNT = 120

/**
 * «Гиперпространственные» полосы к центру — только во время сближения атомов.
 */
export function SynthesisWarpStreaks({
  active,
  intensityRef,
  accentHex = '#3dffec',
}: {
  active: boolean
  intensityRef: MutableRefObject<number>
  accentHex?: string
}) {
  const pointsRef = useRef<THREE.Points>(null)
  const data = useMemo(() => {
    const positions = new Float32Array(STREAK_COUNT * 3)
    const speeds = new Float32Array(STREAK_COUNT)
    const angles = new Float32Array(STREAK_COUNT)
    for (let i = 0; i < STREAK_COUNT; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 4 + Math.random() * 10
      positions[i * 3] = Math.cos(a) * r
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6
      positions[i * 3 + 2] = Math.sin(a) * r
      speeds[i] = 0.35 + Math.random() * 0.85
      angles[i] = a
    }
    return { positions, speeds, angles }
  }, [])

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    return g
  }, [data.positions])

  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: accentHex,
        size: 0.08,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    [accentHex],
  )

  useFrame((_, delta) => {
    if (!active || !pointsRef.current) return
    const pos = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute
    const boost = intensityRef.current
    mat.opacity = 0.25 + boost * 0.55
    const d = delta * (1.2 + boost * 2.5)
    for (let i = 0; i < STREAK_COUNT; i++) {
      let x = pos.getX(i)
      let y = pos.getY(i)
      let z = pos.getZ(i)
      const dist = Math.sqrt(x * x + z * z) + 0.001
      const pull = data.speeds[i]! * d * (1.8 + boost)
      x -= (x / dist) * pull
      z -= (z / dist) * pull
      y *= 0.992
      if (dist < 0.35) {
        const a = data.angles[i]!
        const r = 5 + Math.random() * 8
        x = Math.cos(a) * r
        z = Math.sin(a) * r
        y = (Math.random() - 0.5) * 5
      }
      pos.setXYZ(i, x, y, z)
    }
    pos.needsUpdate = true
  })

  if (!active) return null

  return <points ref={pointsRef} geometry={geom} material={mat} frustumCulled={false} />
}
