import {
  ATOM_MIN_VISUAL_ORBITS,
  buildDecorativeOrbitRadii,
  decorativeOrbitEuler,
  orbitAspect,
  shellMajorRadius,
  shellOrbitEuler,
} from './atomCosmicShared'

export type ElectronLane = {
  shellIndex: number
  count: number
  radius: number
  aspect: number
  euler: [number, number, number]
}

export type AtomOrbitSpec = {
  id: string
  radius: number
  aspect: number
  euler: [number, number, number]
  decorative: boolean
  shellIndex: number
  electronCount: number
}

/** Одна орбита на оболочку — электроны не дублируются по плоскостям. */
export function electronOrbitLanes(shells: readonly number[], shellMul = 1): ElectronLane[] {
  const lanes: ElectronLane[] = []

  shells.forEach((count, shellIndex) => {
    if (count <= 0) return
    lanes.push({
      shellIndex,
      count,
      radius: shellMajorRadius(shellIndex, shellMul),
      aspect: orbitAspect(shellIndex),
      euler: shellOrbitEuler(shellIndex),
    })
  })

  return lanes
}

/** Кольца орбит: по одному на оболочку; декоративные — только у лёгких элементов. */
export function buildVisualOrbitLayout(
  shells: readonly number[],
  shellMul = 1,
): { lanes: ElectronLane[]; rings: AtomOrbitSpec[] } {
  const lanes = electronOrbitLanes(shells, shellMul)

  const rings: AtomOrbitSpec[] = lanes.map((lane) => ({
    id: `shell-${lane.shellIndex}-${lane.radius.toFixed(3)}`,
    radius: lane.radius,
    aspect: lane.aspect,
    euler: lane.euler,
    decorative: false,
    shellIndex: lane.shellIndex,
    electronCount: lane.count,
  }))

  if (lanes.length >= ATOM_MIN_VISUAL_ORBITS) {
    return { lanes, rings }
  }

  const shellRadii = lanes.map((l) => l.radius)
  const extras = buildDecorativeOrbitRadii(shellRadii, ATOM_MIN_VISUAL_ORBITS)

  for (const spec of extras) {
    if (!spec.decorative) continue
    if (rings.some((r) => Math.abs(r.radius - spec.radius) < 0.03)) continue
    rings.push({
      id: `deco-${rings.length}-${spec.radius.toFixed(3)}`,
      radius: spec.radius,
      aspect: orbitAspect(rings.length),
      euler: decorativeOrbitEuler(rings.length),
      decorative: true,
      shellIndex: -1,
      electronCount: 0,
    })
  }

  rings.sort((a, b) => a.radius - b.radius)
  return { lanes, rings }
}

export function buildAtomOrbitLayout(
  shells: readonly number[],
  shellMul = 1,
): AtomOrbitSpec[] {
  return buildVisualOrbitLayout(shells, shellMul).rings
}

/** Размер белых точек в превью (×2 от эталона Lr). */
export const ELECTRON_PREVIEW_BASE_RADIUS = 0.042

export function electronVisualScale(electronCount: number, emphasis: boolean): number {
  if (emphasis) {
    let targetR = ELECTRON_PREVIEW_BASE_RADIUS
    if (electronCount > 36) targetR = 0.04
    if (electronCount > 54) targetR = 0.038
    if (electronCount > 80) targetR = 0.036
    return targetR / ELECTRON_PREVIEW_BASE_RADIUS
  }

  if (electronCount <= 8) return 0.92
  if (electronCount <= 18) return 0.8
  if (electronCount <= 36) return 0.66
  if (electronCount <= 60) return 0.52
  if (electronCount <= 90) return 0.42
  return 0.34
}
