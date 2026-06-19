import { useMemo } from 'react'
import * as THREE from 'three'
import { useVrLabPerf } from './vrLabPerformance'

export type GlassProfile = readonly (readonly [number, number])[]

/** Профили lathe-стекла — школьная лаборатория + sci-fi акценты. */
export const GLASS_PROFILES = {
  /** Классическая пробирка с округлым дном и узким горлом. */
  testTube: [
    [0, 0],
    [0.03, 0],
    [0.038, 0.025],
    [0.04, 0.48],
    [0.024, 0.545],
    [0.02, 0.595],
  ],
  /** Эrlenmeyer — широкий конус, цилиндрическое горло. */
  erlenmeyer: (scale = 1) =>
    [
      [0, 0],
      [0.065 * scale, 0],
      [0.092 * scale, 0.06 * scale],
      [0.034 * scale, 0.21 * scale],
      [0.026 * scale, 0.255 * scale],
    ] as const,
  /** Круглодонная колба. */
  roundFlask: [
    [0, 0],
    [0.095, 0],
    [0.105, 0.045],
    [0.03, 0.125],
    [0.024, 0.165],
  ],
  /** Реактор смешивания — широкий цилиндр с закруглённым дном. */
  mixingReactor: [
    [0, 0],
    [0.045, 0],
    [0.055, 0.018],
    [0.33, 0.022],
    [0.345, 0.07],
    [0.34, 0.36],
    [0.31, 0.395],
    [0.26, 0.4],
  ],
  /** Реагентная бутыль. */
  reagentBottle: (r: number, h: number) =>
    [
      [0, 0],
      [r * 0.72, 0],
      [r, h * 0.08],
      [r * 0.95, h],
      [r * 0.82, h + 0.012],
      [r * 0.55, h + 0.028],
    ] as const,
} as const

export function latheFromProfile(points: GlassProfile | readonly (readonly [number, number])[], segments: number) {
  const pts = points.map(([r, y]) => new THREE.Vector2(r, y))
  return new THREE.LatheGeometry(pts, segments)
}

export function useGlassGeometry(profile: GlassProfile | readonly (readonly [number, number])[]) {
  const { latheSegments } = useVrLabPerf()
  return useMemo(() => latheFromProfile(profile, latheSegments), [profile, latheSegments])
}

/** Тонкие метки объёма на пробирке (3 линии). */
export function GraduationMarks({
  heights = [0.18, 0.32, 0.46],
  radius = 0.041,
}: {
  heights?: number[]
  radius?: number
}) {
  return (
    <group>
      {heights.map((y) => (
        <mesh key={y} position={[radius, y, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.004, 0.028, 0.002]} />
          <meshStandardMaterial color="#c8d8f0" transparent opacity={0.55} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

/** Шестиугольное кольцо (рамка HUD / основание реактора). */
export function makeHexRingGeometry(outerR: number, innerR: number, depth = 0.022) {
  const shape = new THREE.Shape()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6
    const x = Math.cos(a) * outerR
    const y = Math.sin(a) * outerR
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const hole = new THREE.Path()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6
    const x = Math.cos(a) * innerR
    const y = Math.sin(a) * innerR
    if (i === 0) hole.moveTo(x, y)
    else hole.lineTo(x, y)
  }
  hole.closePath()
  shape.holes.push(hole)
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
}
