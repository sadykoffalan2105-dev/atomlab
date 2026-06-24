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
  /** Компактный реактор смешивания — tech-cylindrical vessel. */
  microReactor: [
    [0, 0],
    [0.028, 0],
    [0.038, 0.012],
    [0.095, 0.018],
    [0.102, 0.055],
    [0.098, 0.14],
    [0.085, 0.155],
    [0.055, 0.16],
  ],
  /** Коническая колба (воронка). */
  conical: (scale = 1) =>
    [
      [0, 0],
      [0.02 * scale, 0],
      [0.055 * scale, 0.12 * scale],
      [0.018 * scale, 0.28 * scale],
    ] as const,
  /** Мерный цилиндр. */
  graduatedCylinder: [
    [0, 0],
    [0.042, 0],
    [0.044, 0.38],
    [0.042, 0.395],
  ],
  /** Бюретка для титрования. */
  burette: [
    [0, 0],
    [0.012, 0],
    [0.014, 0.42],
    [0.018, 0.44],
    [0.016, 0.48],
  ],
  /** @deprecated Используйте microReactor */
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

/** Параметры сосуда для жидкости и налива. */
export type VesselProfile = {
  innerRadius: number
  maxHeight: number
  neckRatio: number
  pourAngle: number
}

export const VESSEL_PROFILES: Record<string, VesselProfile> = {
  testTube: { innerRadius: 0.038, maxHeight: 0.55, neckRatio: 0.55, pourAngle: 0.72 },
  erlenmeyer: { innerRadius: 0.09, maxHeight: 0.24, neckRatio: 0.35, pourAngle: 0.65 },
  microReactor: { innerRadius: 0.095, maxHeight: 0.16, neckRatio: 0.58, pourAngle: 0.68 },
  graduatedCylinder: { innerRadius: 0.042, maxHeight: 0.38, neckRatio: 0.95, pourAngle: 0.85 },
  burette: { innerRadius: 0.014, maxHeight: 0.48, neckRatio: 0.7, pourAngle: 0.9 },
}

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
