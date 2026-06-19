import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { clamp01 } from '../../../vrLab/vrLabAnimation'
import { useVrLabPerf } from '../vrLabPerformance'

function createFrostTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#080818'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 1 + Math.random() * 4
    ctx.fillStyle = `rgba(200,230,255,${0.08 + Math.random() * 0.18})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(2, 3)
  return tex
}

let frostCache: THREE.CanvasTexture | null = null

type Props = {
  level: number
  active?: boolean
}

/** Запотевание внутренней поверхности реактора. */
export function GlassCondensation({ level, active = true }: Props) {
  const { tier } = useVrLabPerf()
  const meshRef = useRef<THREE.Mesh>(null)
  const frost = useMemo(() => {
    if (!frostCache) frostCache = createFrostTexture()
    return frostCache
  }, [])

  useFrame((state) => {
    if (!meshRef.current || !active) return
    const mat = meshRef.current.material as THREE.MeshStandardMaterial
    const target = clamp01(level) * (tier === 'low' ? 0.35 : 1)
    mat.opacity = THREE.MathUtils.lerp(mat.opacity, target * 0.42, 0.06)
    mat.emissiveIntensity = 0.15 + Math.sin(state.clock.elapsedTime * 2.5) * 0.04 * target
  })

  if (!active || level < 0.03) return null

  return (
    <mesh ref={meshRef} position={[0, 0.2, 0]}>
      <cylinderGeometry args={[0.26, 0.28, 0.34, 24, 1, true]} />
      <meshStandardMaterial
        map={frost}
        color="#c8e8ff"
        emissive="#a8d4ff"
        emissiveIntensity={0.12}
        transparent
        opacity={0}
        side={THREE.BackSide}
        depthWrite={false}
        roughness={0.92}
        metalness={0.05}
      />
    </mesh>
  )
}
