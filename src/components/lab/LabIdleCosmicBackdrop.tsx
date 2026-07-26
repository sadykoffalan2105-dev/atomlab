import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'

/** Глубокий космический фон idle-лаборатории (фиолетовая туманность). */
export const LAB_IDLE_COSMIC_BG = '#060414'

type NebulaSpec = {
  position: [number, number, number]
  scale: number
  color: [number, number, number]
  speed: number
  phase: number
}

function makeNebulaTexture(rgb: [number, number, number], size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    const tex = new THREE.CanvasTexture(canvas)
    return tex
  }
  const [r, g, b] = rgb
  const cx = size * 0.48
  const cy = size * 0.42
  const grd = ctx.createRadialGradient(cx, cy, 0, size * 0.5, size * 0.5, size * 0.48)
  grd.addColorStop(0, `rgba(${r},${g},${b},0.62)`)
  grd.addColorStop(0.35, `rgba(${r},${g},${b},0.28)`)
  grd.addColorStop(0.7, `rgba(${Math.round(r * 0.55)},${Math.round(g * 0.4)},${Math.round(b * 0.85)},0.1)`)
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, size, size)

  // Лёгкая «пыль» внутри облака
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const a = 0.04 + Math.random() * 0.08
    ctx.fillStyle = `rgba(255,240,255,${a})`
    ctx.beginPath()
    ctx.arc(x, y, 0.6 + Math.random() * 1.4, 0, Math.PI * 2)
    ctx.fill()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function NebulaCloud({ position, scale, color, speed, phase }: NebulaSpec) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  const map = useMemo(() => makeNebulaTexture(color), [color])

  useFrame((state) => {
    const mesh = meshRef.current
    const mat = matRef.current
    if (!mesh || !mat) return
    const t = state.clock.elapsedTime
    mesh.rotation.z = phase + t * speed
    const breathe = 1 + Math.sin(t * speed * 0.85 + phase) * 0.045
    mesh.scale.setScalar(scale * breathe)
    mat.opacity = 0.72 + Math.sin(t * 0.22 + phase) * 0.08
    // Медленный орбитальный дрейф
    mesh.position.x = position[0] + Math.sin(t * speed * 0.35 + phase) * 0.35
    mesh.position.y = position[1] + Math.cos(t * speed * 0.28 + phase * 1.3) * 0.25
  })

  useEffect(() => () => map.dispose(), [map])

  return (
    <mesh ref={meshRef} position={position} renderOrder={-20}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={matRef}
        map={map}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        opacity={0.75}
      />
    </mesh>
  )
}

const NEBULAE: NebulaSpec[] = [
  // Верх-лево — яркое лавандовое облако как на референсе
  { position: [-6.5, 4.2, -14], scale: 14, color: [170, 110, 255], speed: 0.035, phase: 0.2 },
  { position: [-2.5, 5.5, -16], scale: 11, color: [210, 130, 255], speed: 0.028, phase: 1.4 },
  // Центр / правее — глубокий индиго
  { position: [5.5, 1.5, -18], scale: 16, color: [90, 60, 180], speed: 0.022, phase: 2.1 },
  { position: [1.2, -3.5, -15], scale: 12, color: [120, 70, 200], speed: 0.03, phase: 3.3 },
  // Низ — почти чёрная пустота с лёгким фиолетом
  { position: [-4, -5, -17], scale: 13, color: [55, 35, 110], speed: 0.018, phase: 4.2 },
]

/**
 * Живой космический фон свободной лаборатории:
 * фиолетовая туманность + плотное звёздное небо с медленным «орбитальным» движением.
 */
export const LabIdleCosmicBackdrop = memo(function LabIdleCosmicBackdrop({
  lite = false,
}: {
  lite?: boolean
}) {
  const clouds = lite ? NEBULAE.slice(0, 3) : NEBULAE
  return (
    <>
      <color attach="background" args={[LAB_IDLE_COSMIC_BG]} />
      <fog attach="fog" args={[LAB_IDLE_COSMIC_BG, 9, 34]} />
      {clouds.map((spec, i) => (
        <NebulaCloud key={i} {...spec} />
      ))}
      <Stars
        radius={120}
        depth={64}
        count={lite ? 320 : 680}
        factor={lite ? 2.5 : 3.1}
        saturation={0.32}
        fade
        speed={lite ? 0.14 : 0.2}
      />
    </>
  )
})
