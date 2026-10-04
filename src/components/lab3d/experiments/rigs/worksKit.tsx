/**
 * Общие детали трёх практических работ (вода с оксидами, получение CO₂, кислоты с металлами):
 * позы склянки и пипетки по шагам, стружки металлов, кусочки мрамора, горка порошка, шпатель, резиновый шланг.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ease, hill, mixV, useRig, type PoseValue, type V3 } from '../rigCore'
import { BOTTLE_H, TUBE_R } from '../parts/glassware'

/**
 * Белая муть в пробирке (начало — дно): известковая вода с CaCO₃, суспензия Ca(OH)₂. cloud(p) — 0 прозрачно … 1 молочно.
 */
export function MilkFill({ level, cloud, color = '#f6f6f3' }: { level: (p: number) => number; cloud: (p: number) => number; color?: string }) {
  const { p } = useRig()
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0, roughness: 1, depthWrite: false }), [color])
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const pv = p.current ?? 0
    const k = cloud(pv)
    const lv = level(pv)
    m.visible = k > 0.01 && lv > 0.006
    mat.opacity = 0.8 * k
    const h = Math.max(0.001, lv - 0.004)
    m.scale.set(1, h, 1)
    m.position.y = 0.004 + h / 2
  })
  return (
    <mesh ref={ref} material={mat} renderOrder={2}>
      <cylinderGeometry args={[TUBE_R * 0.78, TUBE_R * 0.78, 1, 18]} />
    </mesh>
  )
}

/**
 * Склянка (начало — горлышко) наливает в пробирки: uses — [шаг, x, z, y губы над пробиркой].
 * Шаг s: поднять → к пробирке (палец ведёт до s + 0.42) → наклон, струя s + 0.46…0.74 → обратно на место.
 */
export function bottlePose(rest: V3, uses: readonly (readonly [number, number, number, number])[]) {
  return (p: number): PoseValue => {
    let pos: V3 = [rest[0], BOTTLE_H, rest[2]]
    let rot = 0
    for (const [s, x, z, lipY] of uses) {
      const side = rest[0] > x ? 1 : -1
      const lifted: V3 = [rest[0], lipY + 0.08, rest[2]]
      const over: V3 = [x - side * 0.003, lipY + 0.006, z]
      const lip: V3 = [x - side * 0.003, lipY, z]
      let q = mixV(pos, lifted, ease(p, s, s + 0.2))
      q = mixV(q, over, ease(p, s + 0.16, s + 0.4))
      q = mixV(q, lip, ease(p, s + 0.38, s + 0.46))
      q = mixV(q, lifted, ease(p, s + 0.76, s + 0.88))
      q = mixV(q, [rest[0], BOTTLE_H, rest[2]], ease(p, s + 0.86, s + 0.98))
      pos = q
      const tilt = ease(p, s + 0.38, s + 0.5) * (1 - ease(p, s + 0.72, s + 0.8))
      if (tilt > 0) rot = side * 1.85 * tilt
    }
    return { pos, rot: [0, 0, rot] }
  }
}

/** Струя из склянки идёт на отрезке шага s + 0.46…0.74; уровень в пробирке растёт там же. */
export const pourShow = (s: number) => (p: number) => hill(p, s + 0.46, s + 0.74, 0.15)
export const pourLevel = (s: number, level: number) => (p: number) => level * ease(p, s + 0.46, s + 0.74)

/**
 * Пипетка-капельница (начало — кончик): из своей склянки → над пробиркой → капли (s + 0.3…0.56) → обратно.
 * uses — [шаг, x, z, высота кончика над пробиркой].
 */
export function pipettePose(rest: V3, uses: readonly (readonly [number, number, number, number])[]) {
  return (p: number) => {
    const home: V3 = [rest[0], 0.034, rest[2]]
    let pos: V3 = home
    let squeeze = 0
    for (const [s, x, z, dripY] of uses) {
      const lifted: V3 = [rest[0], 0.2, rest[2]]
      const above: V3 = [x, Math.max(0.2, dripY + 0.04), z]
      const drip: V3 = [x, dripY, z]
      let q = mixV(pos, lifted, ease(p, s, s + 0.12))
      q = mixV(q, above, ease(p, s + 0.1, s + 0.24))
      q = mixV(q, drip, ease(p, s + 0.22, s + 0.3))
      q = mixV(q, above, ease(p, s + 0.58, s + 0.66))
      q = mixV(q, lifted, ease(p, s + 0.64, s + 0.82))
      q = mixV(q, home, ease(p, s + 0.8, s + 0.98))
      pos = q
      squeeze = Math.max(squeeze, hill(p, s + 0.3, s + 0.56, 0.3))
    }
    return { pos, squeeze }
  }
}

function rnd(i: number, k: number) {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Металлические стружки (магний — серебристые, медь — красно-коричневые): завитки из тонких полосок. */
export function Shavings({ color, n = 7, r = 0.0062, metalness = 0.75, roughness = 0.35 }: { color: string; n?: number; r?: number; metalness?: number; roughness?: number }) {
  const geo = useMemo(() => {
    // завиток: полоска по дуге спирали
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 1.6
      pts.push(new THREE.Vector3(Math.cos(a) * 0.0026, i * 0.00035, Math.sin(a) * 0.0026))
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.00055, 4, false)
  }, [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, metalness, roughness }), [color, metalness, roughness])
  const items = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => ({
        pos: [(rnd(i, 1) - 0.5) * r * 1.6, 0.0012 + rnd(i, 2) * 0.0025, (rnd(i, 3) - 0.5) * r * 1.6] as const,
        rot: [rnd(i, 4) * 3, rnd(i, 5) * 6, rnd(i, 6) * 3] as const,
        s: 0.8 + rnd(i, 7) * 0.6,
      })),
    [n, r],
  )
  return (
    <group>
      {items.map((it, i) => (
        <mesh key={i} geometry={geo} material={mat} position={it.pos as unknown as THREE.Vector3Tuple} rotation={it.rot as unknown as THREE.Vector3Tuple} scale={it.s} castShadow />
      ))}
    </group>
  )
}

/** Кусочки мрамора (мела): белые угловатые камешки с лёгкими прожилками. */
export function MarblePieces({ n = 4, size = 0.0042 }: { n?: number; size?: number }) {
  const geos = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const g = new THREE.DodecahedronGeometry(size * (0.8 + rnd(i, 9) * 0.45), 0)
        const pos = g.attributes.position as THREE.BufferAttribute
        const v = new THREE.Vector3()
        for (let k = 0; k < pos.count; k++) {
          v.fromBufferAttribute(pos, k)
          v.multiplyScalar(0.85 + 0.3 * rnd(k + i * 31, 2))
          pos.setXYZ(k, v.x, v.y * 0.8, v.z)
        }
        g.computeVertexNormals()
        return g
      }),
    [n, size],
  )
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f1efea', roughness: 0.62, metalness: 0, flatShading: true }), [])
  return (
    <group>
      {geos.map((g, i) => (
        <mesh
          key={i}
          geometry={g}
          material={mat}
          position={[(rnd(i, 1) - 0.5) * 0.009, size * 0.7 + i * 0.0018, (rnd(i, 3) - 0.5) * 0.008]}
          rotation={[rnd(i, 4) * 3, rnd(i, 5) * 3, 0]}
          castShadow
        />
      ))}
    </group>
  )
}

/** Горка порошка (начало — основание). */
export function PowderHeap({ color = '#f6f5f1', r = 0.016, h = 0.008 }: { color?: string; r?: number; h?: number }) {
  return (
    <mesh position={[0, h / 2, 0]} castShadow>
      <coneGeometry args={[r, h, 20, 1]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  )
}

/** Шпатель (начало — ложечка; ручка вдоль +X), в ложечке — порошок, пока full(p) > 0. */
export function Spatula({ full, color = '#f6f5f1' }: { full: (p: number) => number; color?: string }) {
  const { p } = useRig()
  const powder = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const k = full(p.current ?? 0)
    if (powder.current) {
      powder.current.visible = k > 0.02
      powder.current.scale.set(1, Math.max(0.05, k), 1)
    }
  })
  return (
    <group>
      <mesh position={[0, 0.001, 0]} castShadow>
        <boxGeometry args={[0.016, 0.0012, 0.009]} />
        <meshStandardMaterial color="#c8ced6" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[0.075, 0.003, 0]} rotation={[0, 0, Math.PI / 2 - 0.03]} castShadow>
        <cylinderGeometry args={[0.0018, 0.0018, 0.13, 10]} />
        <meshStandardMaterial color="#c8ced6" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh ref={powder} position={[0, 0.0028, 0]}>
        <sphereGeometry args={[0.0048, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
    </group>
  )
}

/**
 * Резиновый шланг между двумя точками (провисает посередине). Геометрия пересчитывается только когда концы
 * сдвинулись — в покое это обычный меш без работы на кадр.
 */
export function RubberHose({ ends, sag = 0.05, radius = 0.0042, color = '#7c3a2c' }: { ends: (p: number) => readonly [V3, V3]; sag?: number; radius?: number; color?: string }) {
  const { p, quality } = useRig()
  const ref = useRef<THREE.Mesh>(null)
  const last = useRef<string>('')
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0 }), [color])
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const [a, b] = ends(p.current ?? 0)
    const key = [...a, ...b].map((v) => v.toFixed(4)).join()
    if (key === last.current) return
    last.current = key
    const A = new THREE.Vector3(a[0], a[1], a[2])
    const B = new THREE.Vector3(b[0], b[1], b[2])
    const len = A.distanceTo(B)
    const mid = A.clone().lerp(B, 0.5)
    mid.y = Math.max(radius + 0.001, mid.y - Math.min(sag, 0.02 + len * 0.25))
    // короткие прямые участки у концов — шланг надет на стеклянные трубки
    const a2 = A.clone().add(new THREE.Vector3(0.012, 0, 0))
    const b2 = B.clone().add(new THREE.Vector3(0, 0.012, 0))
    const curve = new THREE.CatmullRomCurve3([A, a2, mid, b2, B], false, 'centripetal')
    const g = new THREE.TubeGeometry(curve, quality === 'high' ? 40 : 20, radius, 8, false)
    m.geometry.dispose()
    m.geometry = g
  })
  return <mesh ref={ref} material={mat} castShadow />
}
