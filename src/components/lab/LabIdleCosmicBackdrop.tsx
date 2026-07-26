import { memo, useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'

/** Глубокий фиолетовый космос idle-лаборатории. */
export const LAB_IDLE_COSMIC_BG = '#050218'

type NebulaSpec = {
  position: [number, number, number]
  scale: number
  color: [number, number, number]
  speed: number
  phase: number
  drift: number
}

function makeNebulaTexture(rgb: [number, number, number], size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  const [r, g, b] = rgb
  ctx.clearRect(0, 0, size, size)

  // Несколько перекрывающихся ядер — «клочья» туманности
  const lobes = [
    [0.42, 0.38, 0.42],
    [0.58, 0.48, 0.28],
    [0.48, 0.58, 0.22],
    [0.35, 0.5, 0.18],
  ] as const
  for (const [lx, ly, strength] of lobes) {
    const cx = size * lx
    const cy = size * ly
    const rad = size * (0.28 + strength * 0.25)
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
    grd.addColorStop(0, `rgba(${r},${g},${b},${0.85 * strength})`)
    grd.addColorStop(0.35, `rgba(${r},${g},${b},${0.45 * strength})`)
    grd.addColorStop(
      0.65,
      `rgba(${Math.round(r * 0.65)},${Math.round(g * 0.45)},${Math.round(b * 0.95)},${0.18 * strength})`,
    )
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, size, size)
  }

  // Яркое ядро
  const core = ctx.createRadialGradient(size * 0.48, size * 0.42, 0, size * 0.5, size * 0.48, size * 0.2)
  core.addColorStop(0, `rgba(255,230,255,0.55)`)
  core.addColorStop(0.4, `rgba(${r},${g},${b},0.35)`)
  core.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = core
  ctx.fillRect(0, 0, size, size)

  // Звёздная пыль внутри облака
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const a = 0.08 + Math.random() * 0.35
    const rad = 0.5 + Math.random() * 1.8
    ctx.fillStyle = `rgba(255,245,255,${a})`
    ctx.beginPath()
    ctx.arc(x, y, rad, 0, Math.PI * 2)
    ctx.fill()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function NebulaCloud({ position, scale, color, speed, phase, drift }: NebulaSpec) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  const map = useMemo(() => makeNebulaTexture(color), [color])

  useFrame((state) => {
    const mesh = meshRef.current
    const mat = matRef.current
    if (!mesh || !mat) return
    const t = state.clock.elapsedTime
    mesh.rotation.z = phase + t * speed
    const breathe = 1 + Math.sin(t * speed * 1.1 + phase) * 0.09
    mesh.scale.set(scale * breathe * 1.15, scale * breathe, 1)
    mat.opacity = 0.88 + Math.sin(t * 0.35 + phase) * 0.12
    mesh.position.x = position[0] + Math.sin(t * speed * 0.55 + phase) * drift
    mesh.position.y = position[1] + Math.cos(t * speed * 0.42 + phase * 1.3) * drift * 0.7
    mesh.position.z = position[2] + Math.sin(t * speed * 0.2 + phase) * 0.4
  })

  useEffect(() => () => map.dispose(), [map])

  return (
    <mesh ref={meshRef} position={position} renderOrder={-30}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={matRef}
        map={map}
        transparent
        depthWrite={false}
        depthTest={false}
        fog={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        opacity={0.92}
      />
    </mesh>
  )
}

/** Мелкая космическая пыль — точки с мерцанием. */
function CosmicDustField({ count = 400, radius = 18 }: { count?: number; radius?: number }) {
  const pointsRef = useRef<THREE.Points>(null)
  const { positions, phases } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const ph = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const u = Math.random()
      const v = Math.random()
      const theta = u * Math.PI * 2
      const phi = Math.acos(2 * v - 1)
      const r = radius * (0.35 + Math.random() * 0.65)
      pos[i3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7
      pos[i3 + 2] = -6 - Math.random() * 16
      ph[i] = Math.random() * Math.PI * 2
    }
    return { positions: pos, phases: ph }
  }, [count, radius])

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [positions])

  useFrame((state) => {
    const pts = pointsRef.current
    if (!pts) return
    const t = state.clock.elapsedTime
    pts.rotation.y = t * 0.012
    pts.rotation.x = Math.sin(t * 0.08) * 0.04
    const mat = pts.material as THREE.PointsMaterial
    mat.opacity = 0.55 + Math.sin(t * 1.4 + phases[0]!) * 0.25
  })

  useEffect(
    () => () => {
      geom.dispose()
    },
    [geom],
  )

  return (
    <points ref={pointsRef} geometry={geom} renderOrder={-25}>
      <pointsMaterial
        color="#e8d8ff"
        size={0.045}
        sizeAttenuation
        transparent
        depthWrite={false}
        depthTest={false}
        fog={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        opacity={0.7}
      />
    </points>
  )
}

/** Мягкие орбитальные кольца за атомом — ощущение «в орбите». */
function OrbitHaloRings({ lite }: { lite?: boolean }) {
  const g1 = useRef<THREE.Mesh>(null)
  const g2 = useRef<THREE.Mesh>(null)
  const g3 = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (g1.current) {
      g1.current.rotation.z = t * 0.04
      g1.current.rotation.x = 0.55 + Math.sin(t * 0.15) * 0.05
    }
    if (g2.current) {
      g2.current.rotation.z = -t * 0.055
      g2.current.rotation.y = 0.4 + Math.cos(t * 0.12) * 0.08
    }
    if (g3.current) {
      g3.current.rotation.z = t * 0.03
      g3.current.rotation.x = -0.35 + Math.sin(t * 0.1) * 0.06
    }
  })

  const ring = (
    ref: RefObject<THREE.Mesh | null>,
    args: [number, number, number],
    opacity: number,
  ) => (
    <mesh ref={ref} position={[0, 0, -3.2]} renderOrder={-15}>
      <ringGeometry args={args} />
      <meshBasicMaterial
        color="#a878ff"
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        depthTest={false}
        fog={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  )

  return (
    <>
      {ring(g1, [4.2, 4.35, lite ? 48 : 96], 0.14)}
      {ring(g2, [5.6, 5.78, lite ? 48 : 96], 0.1)}
      {!lite ? ring(g3, [7.1, 7.28, 64], 0.07) : null}
    </>
  )
}

const NEBULAE: NebulaSpec[] = [
  { position: [-5.2, 3.6, -9], scale: 11, color: [200, 140, 255], speed: 0.045, phase: 0.2, drift: 0.85 },
  { position: [-1.8, 4.8, -10], scale: 9.5, color: [255, 160, 255], speed: 0.038, phase: 1.1, drift: 0.7 },
  { position: [4.8, 2.8, -11], scale: 12, color: [150, 100, 255], speed: 0.032, phase: 2.0, drift: 0.9 },
  { position: [5.5, -1.2, -10], scale: 10, color: [120, 80, 220], speed: 0.04, phase: 2.8, drift: 0.75 },
  { position: [-3.5, -2.8, -9.5], scale: 10.5, color: [100, 60, 200], speed: 0.036, phase: 3.6, drift: 0.8 },
  { position: [0.5, 0.8, -12], scale: 14, color: [90, 50, 180], speed: 0.025, phase: 4.4, drift: 0.55 },
  { position: [-6, 0.5, -11], scale: 8, color: [180, 90, 255], speed: 0.048, phase: 5.1, drift: 1.0 },
  { position: [2.2, -4.2, -10], scale: 9, color: [70, 40, 160], speed: 0.03, phase: 0.9, drift: 0.65 },
]

/**
 * Живой космический фон: яркая туманность, пыль, орбитальные кольца, плотные звёзды.
 */
export const LabIdleCosmicBackdrop = memo(function LabIdleCosmicBackdrop({
  lite = false,
}: {
  lite?: boolean
}) {
  const clouds = lite ? NEBULAE.slice(0, 5) : NEBULAE
  return (
    <>
      <color attach="background" args={[LAB_IDLE_COSMIC_BG]} />
      {/* Туман дальше — не съедает nebula на z≈−10 */}
      <fog attach="fog" args={[LAB_IDLE_COSMIC_BG, 22, 48]} />

      {clouds.map((spec, i) => (
        <NebulaCloud key={i} {...spec} />
      ))}

      <CosmicDustField count={lite ? 220 : 480} radius={lite ? 14 : 20} />
      <OrbitHaloRings lite={lite} />

      <Stars
        radius={140}
        depth={80}
        count={lite ? 700 : 1400}
        factor={lite ? 3.4 : 4.2}
        saturation={0.55}
        fade={false}
        speed={lite ? 0.28 : 0.42}
      />
      {/* Второй слой ближе — «крупные» звёзды */}
      {!lite ? (
        <Stars radius={60} depth={30} count={180} factor={5.5} saturation={0.4} fade={false} speed={0.15} />
      ) : null}
    </>
  )
})
