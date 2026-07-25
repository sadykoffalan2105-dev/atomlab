import * as THREE from 'three'

/**
 * ATOMLAB Cinema — кэш геометрий.
 * Одна сфера на (радиус, детализация) вместо новой на каждый атом и прогон.
 */

const sphereCache = new Map<string, THREE.SphereGeometry>()
const ringCache = new Map<string, THREE.RingGeometry>()
const circleCache = new Map<string, THREE.CircleGeometry>()
let cylinder: THREE.CylinderGeometry | null = null
let quad: THREE.PlaneGeometry | null = null

export function cinemaSphere(radius: number, widthSeg: number, heightSeg: number): THREE.SphereGeometry {
  const key = `${radius.toFixed(3)}_${widthSeg}_${heightSeg}`
  let g = sphereCache.get(key)
  if (!g) {
    g = new THREE.SphereGeometry(radius, widthSeg, heightSeg)
    sphereCache.set(key, g)
  }
  return g
}

/** Цилиндр высотой 1 по +Y, радиусом 1 — связи масштабируются под него. */
export function cinemaUnitCylinder(): THREE.CylinderGeometry {
  if (!cylinder) cylinder = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true)
  return cylinder
}

export function cinemaRing(inner: number, outer: number, seg = 48): THREE.RingGeometry {
  const key = `${inner}_${outer}_${seg}`
  let g = ringCache.get(key)
  if (!g) {
    g = new THREE.RingGeometry(inner, outer, seg)
    ringCache.set(key, g)
  }
  return g
}

export function cinemaCircle(radius: number, seg = 40): THREE.CircleGeometry {
  const key = `${radius}_${seg}`
  let g = circleCache.get(key)
  if (!g) {
    g = new THREE.CircleGeometry(radius, seg)
    circleCache.set(key, g)
  }
  return g
}

export function cinemaQuad(): THREE.PlaneGeometry {
  if (!quad) quad = new THREE.PlaneGeometry(1, 1)
  return quad
}

export function disposeCinemaGeometries(): void {
  sphereCache.forEach((g) => g.dispose())
  ringCache.forEach((g) => g.dispose())
  circleCache.forEach((g) => g.dispose())
  sphereCache.clear()
  ringCache.clear()
  circleCache.clear()
  cylinder?.dispose()
  cylinder = null
  quad?.dispose()
  quad = null
}
