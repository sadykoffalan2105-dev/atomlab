/**
 * Прокаливание: фарфоровый тигель с крышкой (№ 3, ~25 мл: верх Ø37 мм, низ Ø22 мм, высота 30 мм), фарфоровый
 * треугольник (проволока в фарфоровых трубочках), треножник и тигельные щипцы. Реальные размеры, метры.
 *  • Тигель и крышка — токарные детали из глазурованного фарфора; heat(p) 0…1 — тёплое свечение раскалённого дна.
 *  • Треножник — одна общая геометрия (кольцо и три ножки): он и есть опора тигля с треугольником.
 *  • Щипцы (начало — середина губок, ручки вдоль +X): open(p) 0…1 — губки разведены.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useRig, type PFn } from '../../experiments/rigCore'

export const CRUCIBLE = { rBot: 0.011, rTop: 0.0185, h: 0.03, wall: 0.0017, lidR: 0.0205, lidH: 0.0078 } as const

/** Наружный радиус тигля на высоте y от дна. */
export function crucibleR(y: number): number {
  const k = Math.min(1, Math.max(0, y / CRUCIBLE.h))
  return CRUCIBLE.rBot + (CRUCIBLE.rTop - CRUCIBLE.rBot) * k
}

function porcelain() {
  return new THREE.MeshStandardMaterial({ color: '#f7f6f1', roughness: 0.22, metalness: 0, side: THREE.DoubleSide, emissive: '#ff5a1f', emissiveIntensity: 0 })
}

/** Тигель (начало — центр дна). */
export function Crucible({ heat }: { heat?: PFn }) {
  const { quality, p } = useRig()
  const mat = useMemo(porcelain, [])
  const geo = useMemo(() => {
    const { rBot, rTop, h, wall } = CRUCIBLE
    const pts = [
      new THREE.Vector2(0.0001, 0),
      new THREE.Vector2(rBot - 0.0012, 0),
      new THREE.Vector2(rBot, 0.0012),
      new THREE.Vector2(rTop, h - 0.0008),
      new THREE.Vector2(rTop - 0.0003, h),
      new THREE.Vector2(rTop - wall, h),
      new THREE.Vector2(rBot - wall * 0.8, wall + 0.0006),
      new THREE.Vector2(rBot - wall * 2, wall),
      new THREE.Vector2(0.0001, wall),
    ]
    return new THREE.LatheGeometry(pts, quality === 'high' ? 36 : 20)
  }, [quality])
  useFrame(() => {
    mat.emissiveIntensity = heat ? 0.35 * heat(p.current ?? 0) : 0
  })
  return <mesh geometry={geo} material={mat} castShadow receiveShadow />
}

/** Крышка тигля (начало — плоскость, которой она лежит на крае тигля; бортик уходит внутрь). */
export function CrucibleLid() {
  const { quality } = useRig()
  const mat = useMemo(porcelain, [])
  const geo = useMemo(() => {
    const { rTop, wall, lidR } = CRUCIBLE
    const pts = [
      new THREE.Vector2(0.0001, -0.002),
      new THREE.Vector2(rTop - wall - 0.0007, -0.0026),
      new THREE.Vector2(rTop - wall - 0.0005, 0),
      new THREE.Vector2(lidR, 0),
      new THREE.Vector2(lidR, 0.0011),
      new THREE.Vector2(0.009, 0.0034),
      new THREE.Vector2(0.0042, 0.0036),
      new THREE.Vector2(0.0036, 0.0074),
      new THREE.Vector2(0.0001, CRUCIBLE.lidH),
    ]
    return new THREE.LatheGeometry(pts, quality === 'high' ? 32 : 18)
  }, [quality])
  return <mesh geometry={geo} material={mat} castShadow />
}

/**
 * Фарфоровый треугольник (начало — центр, плоскость трубочек): три фарфоровые трубочки на проволоке, концы проволоки
 * скручены и лежат на кольце треножника радиуса ringR. Тигель опускается в него до высоты, где его радиус = вписанному.
 */
export const TRIANGLE = { inR: 0.0152, tubeR: 0.0031 } as const
/** На сколько ниже плоскости треугольника оказывается дно тигля. */
export const CRUCIBLE_SINK = (() => {
  const need = TRIANGLE.inR + TRIANGLE.tubeR * 0.55
  return ((need - CRUCIBLE.rBot) / (CRUCIBLE.rTop - CRUCIBLE.rBot)) * CRUCIBLE.h
})()

export function ClayTriangle({ ringR }: { ringR: number }) {
  const clay = useMemo(() => new THREE.MeshStandardMaterial({ color: '#efe3d6', roughness: 0.75 }), [])
  const wire = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7d848c', roughness: 0.45, metalness: 0.8 }), [])
  const sides = useMemo(() => {
    const R = TRIANGLE.inR * 2
    const v = [0, 1, 2].map((i) => {
      const a = Math.PI / 2 + (i * 2 * Math.PI) / 3
      return new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R)
    })
    return [0, 1, 2].map((i) => {
      const a = v[i]!
      const b = v[(i + 1) % 3]!
      const mid = a.clone().add(b).multiplyScalar(0.5)
      const len = a.distanceTo(b)
      const yaw = Math.atan2(-(b.z - a.z), b.x - a.x)
      // скрученный конец проволоки: от вершины наружу до кольца
      const out = a.clone().normalize()
      const end = out.clone().multiplyScalar(ringR + 0.006)
      const endMid = a.clone().add(end).multiplyScalar(0.5)
      const endLen = a.distanceTo(end)
      const endYaw = Math.atan2(-out.z, out.x)
      return { mid, len, yaw, endMid, endLen, endYaw }
    })
  }, [ringR])
  return (
    <group>
      {sides.map((s, i) => (
        <group key={i}>
          <group position={s.mid} rotation={[0, s.yaw, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]} material={clay} castShadow>
              <cylinderGeometry args={[TRIANGLE.tubeR, TRIANGLE.tubeR, s.len * 0.8, 12]} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]} material={wire}>
              <cylinderGeometry args={[0.0008, 0.0008, s.len * 1.02, 6]} />
            </mesh>
          </group>
          <group position={s.endMid} rotation={[0, s.endYaw, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]} material={wire} castShadow>
              <cylinderGeometry args={[0.0012, 0.0012, s.endLen, 6]} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  )
}

/** Треножник (начало — центр на столе): кольцо радиуса ringR на высоте h и три ножки, разведённые к столу. */
export function Tripod({ h, ringR = 0.045 }: { h: number; ringR?: number }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3b4148', roughness: 0.55, metalness: 0.55 }), [])
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    const ring = new THREE.TorusGeometry(ringR, 0.0035, 8, 40)
    ring.rotateX(Math.PI / 2)
    ring.translate(0, h - 0.0035, 0)
    parts.push(ring)
    for (const a of [Math.PI, Math.PI / 3, -Math.PI / 3]) {
      const top = new THREE.Vector3(Math.cos(a) * ringR, h - 0.004, Math.sin(a) * ringR)
      const foot = new THREE.Vector3(Math.cos(a) * (ringR + 0.022), 0.003, Math.sin(a) * (ringR + 0.022))
      const len = top.distanceTo(foot)
      const leg = new THREE.CylinderGeometry(0.0034, 0.0034, len, 8)
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(foot).normalize())
      leg.applyQuaternion(q)
      const mid = top.clone().add(foot).multiplyScalar(0.5)
      leg.translate(mid.x, mid.y, mid.z)
      parts.push(leg)
      const shoe = new THREE.CylinderGeometry(0.0045, 0.005, 0.003, 10)
      shoe.translate(foot.x, 0.0015, foot.z)
      parts.push(shoe)
    }
    const merged = mergeGeometries(parts.map((g) => g.toNonIndexed()))
    parts.forEach((g) => g.dispose())
    return merged ?? new THREE.BufferGeometry()
  }, [h, ringR])
  return <mesh geometry={geo} material={mat} castShadow receiveShadow />
}

/**
 * Тигельные щипцы (начало — середина губок, ручки вдоль +X, лежат плашмя в плоскости XZ). open(p) 0…1 — губки
 * разведены (берут тигель или крышку).
 */
export function CrucibleTongs({ open }: { open: PFn }) {
  const { p } = useRig()
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c3c9d0', roughness: 0.3, metalness: 0.9 }), [])
  const arms = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const PIVOT = 0.055
  useFrame(() => {
    const k = open(p.current ?? 0)
    arms.forEach((r, i) => {
      if (r.current) r.current.rotation.y = (i === 0 ? 1 : -1) * (0.05 + 0.14 * k)
    })
  })
  return (
    <group>
      {[0, 1].map((i) => {
        const s = i === 0 ? 1 : -1
        return (
          <group key={i} ref={arms[i]} position={[PIVOT, 0.0016, 0]}>
            {/* ручка: от шарнира к +X, чуть разведена */}
            <mesh position={[0.075, 0, -s * 0.006]} rotation={[0, s * 0.08, 0]} material={steel} castShadow>
              <boxGeometry args={[0.15, 0.0032, 0.0042]} />
            </mesh>
            {/* губка: от шарнира к −X и дуга, охватывающая тигель */}
            <mesh position={[-PIVOT / 2, 0, s * 0.002]} material={steel} castShadow>
              <boxGeometry args={[PIVOT, 0.0032, 0.004]} />
            </mesh>
            <mesh position={[-PIVOT + 0.004, 0, s * 0.011]} rotation={[Math.PI / 2, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2]} material={steel}>
              <torusGeometry args={[0.009, 0.0016, 6, 14, Math.PI]} />
            </mesh>
          </group>
        )
      })}
      <mesh position={[PIVOT, 0.0016, 0]} material={steel}>
        <cylinderGeometry args={[0.003, 0.003, 0.009, 10]} />
      </mesh>
    </group>
  )
}
