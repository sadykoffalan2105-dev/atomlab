import * as THREE from 'three'

/**
 * Общие геометрии для научного микромира — один раз на сессию,
 * чтобы не аллоцировать SphereGeometry на каждый атом каждый запуск.
 */
let sphereCache: Map<string, THREE.SphereGeometry> | null = null
let cylCache: THREE.CylinderGeometry | null = null
let ringCache: Map<string, THREE.RingGeometry> | null = null
let circleCache: Map<string, THREE.CircleGeometry> | null = null

function sphereKey(r: number, w: number, h: number) {
  return `${r.toFixed(3)}_${w}_${h}`
}

export function sharedSphere(radius: number, w: number, h: number): THREE.SphereGeometry {
  if (!sphereCache) sphereCache = new Map()
  const k = sphereKey(radius, w, h)
  let g = sphereCache.get(k)
  if (!g) {
    g = new THREE.SphereGeometry(radius, w, h)
    sphereCache.set(k, g)
  }
  return g
}

export function sharedUnitCylinder(): THREE.CylinderGeometry {
  if (!cylCache) cylCache = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true)
  return cylCache
}

export function sharedRing(inner: number, outer: number, seg = 48): THREE.RingGeometry {
  if (!ringCache) ringCache = new Map()
  const k = `${inner}_${outer}_${seg}`
  let g = ringCache.get(k)
  if (!g) {
    g = new THREE.RingGeometry(inner, outer, seg)
    ringCache.set(k, g)
  }
  return g
}

export function sharedCircle(radius: number, seg = 40): THREE.CircleGeometry {
  if (!circleCache) circleCache = new Map()
  const k = `${radius}_${seg}`
  let g = circleCache.get(k)
  if (!g) {
    g = new THREE.CircleGeometry(radius, seg)
    circleCache.set(k, g)
  }
  return g
}
