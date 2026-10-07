/**
 * Общие мелочи установок задач-опытов Kimyo 7: перенос предмета «поднять → перенести → опустить», шпатель с
 * гранулами или порошком, горка гранул в сосуде, бумажная этикетка-поясок на стакане, спиртовка со спичками.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Pose, ease, mix, mixV, useRig, type PFn, type V3 } from '../../../rigCore'
import { Match, Matchbox, SpiritLamp } from '../../../parts/fire'
import { Spatula } from '../../worksKit'
import { jarLabelTexture } from '../../../../measure/devices/deviceTextures'

function rnd(i: number, k: number) {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return x - Math.floor(x)
}
const tmp = new THREE.Object3D()

/** Путь переноса на отрезке [a, b]: подъём до hy (первые 25 %), перенос (до 75 %), опускание. */
export function carry(p: number, a: number, b: number, from: V3, to: V3, hy: number): [number, number, number] {
  const k1 = a + (b - a) * 0.25
  const k2 = a + (b - a) * 0.75
  let pos = mixV(from, [from[0], hy, from[2]], ease(p, a, k1))
  pos = mixV(pos, [to[0], hy, to[2]], ease(p, k1 - (b - a) * 0.02, k2))
  return mixV(pos, to, ease(p, k2 - (b - a) * 0.02, b))
}

/** Ключевой кадр предмета: [прогресс, позиция, поворот (x, y, z)]. */
export type Key = readonly [number, V3, V3]
/** Поза по ключевым кадрам: между соседними — плавно (ease), до первого и после последнего — как в них. */
export function track(p: number, keys: readonly Key[]): { pos: [number, number, number]; rot: [number, number, number] } {
  let a = keys[0]!
  if (p <= a[0]) return { pos: [...a[1]], rot: [...a[2]] }
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i]!
    if (p <= b[0]) {
      const k = ease(p, a[0], b[0])
      return { pos: mixV(a[1], b[1], k), rot: mixV(a[2], b[2], k) }
    }
    a = b
  }
  return { pos: [...a[1]], rot: [...a[2]] }
}

/** Детерминированное «случайное» число 0…1 от ключа (показания одной попытки — одни и те же при перерисовке). */
export function hash01(key: number, i: number): number {
  return rnd(key * 0.013 + i * 1.7, i + 3)
}

/** Шпатель (начало — ложечка, ручка вдоль +X) с гранулами или порошком в ложечке, пока full(p) > 0. */
export function Scoop({ full, kind, color }: { full: PFn; kind: 'granules' | 'powder'; color: string }) {
  const { p } = useRig()
  const g = useRef<THREE.Group>(null)
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: kind === 'powder' ? 1 : 0.38, metalness: kind === 'powder' ? 0 : 0.8, flatShading: kind === 'granules' }), [color, kind])
  useFrame(() => {
    if (g.current) g.current.visible = kind === 'granules' && full(p.current ?? 0) > 0.02
  })
  return (
    <group>
      <Spatula full={kind === 'powder' ? full : () => 0} color={color} />
      <group ref={g}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[(i - 1) * 0.0042, 0.0034, (rnd(i, 2) - 0.5) * 0.003]} rotation={[i, i * 2, 0]} scale={[1, 0.75, 1]} material={mat}>
            <dodecahedronGeometry args={[0.0026 + rnd(i, 1) * 0.0009, 0]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** Гранулы (или кусочки) на дне сосуда радиуса r: появляются по мере show(p) 0…1. Instanced. */
export function GranuleBed({ r, show, n = 30, color, size = 0.0032, y0 = 0.003 }: { r: number; show: PFn; n?: number; color: string; size?: number; y0?: number }) {
  const { p, quality } = useRig()
  const count = quality === 'high' ? n : Math.ceil(n * 0.6)
  const ref = useRef<THREE.InstancedMesh>(null)
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.8, flatShading: true }), [color])
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = rnd(i, 1) * Math.PI * 2
        const rr = Math.sqrt(rnd(i, 2)) * r * 0.82
        return { x: Math.cos(a) * rr, z: Math.sin(a) * rr, y: y0 + size * 0.7 + (i / count) * size * 1.2 * (1 - rr / r), s: 0.75 + rnd(i, 3) * 0.55, ro: rnd(i, 4) * 6 }
      }),
    [count, r, size, y0],
  )
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const k = show(p.current ?? 0)
    m.visible = k > 0.01
    if (!m.visible) return
    const shown = Math.round(k * count)
    for (let i = 0; i < count; i++) {
      const sd = seeds[i]!
      tmp.position.set(sd.x, sd.y, sd.z)
      tmp.rotation.set(sd.ro, sd.ro * 1.3, sd.ro * 0.5)
      tmp.scale.set(size * sd.s, size * sd.s * 0.72, size * sd.s)
      if (i >= shown) tmp.scale.setScalar(1e-6)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} material={mat} castShadow frustumCulled={false}>
      <dodecahedronGeometry args={[1, 0]} />
    </instancedMesh>
  )
}

/** Бумажная этикетка-поясок на передней стороне сосуда радиуса r (начало — дно), центр на высоте y. */
export function BandLabel({ r, y, formula, name, sub = '', h = 0.026, stripe = '#2f7cf6' }: { r: number; y: number; formula: string; name: string; sub?: string; h?: number; stripe?: string }) {
  const tex = useMemo(() => jarLabelTexture(formula, name, sub, stripe), [formula, name, sub, stripe])
  return (
    <mesh position={[0, y, 0]} renderOrder={5}>
      <cylinderGeometry args={[r, r, h, 20, 1, true, -0.8, 1.6]} />
      <meshStandardMaterial map={tex} roughness={0.75} />
    </mesh>
  )
}

/**
 * Спиртовка в точке lamp, коробок (справа от неё) и спичка: колпачок снимают (capOff 0…1), спичку подносят к фитилю на отрезке
 * [lightAt, lightAt + 0.3] прогресса, затем роняют рядом с коробком. Пламя flame(p).
 */
export function LampKit({ lamp, matchbox, flame, capOff, lightAt }: { lamp: V3; matchbox: V3; flame: PFn; capOff: PFn; lightAt: number }) {
  const l = lightAt
  return (
    <>
      <group position={lamp as unknown as THREE.Vector3Tuple}>
        <SpiritLamp flame={flame} capOff={capOff} />
      </group>
      <group position={matchbox as unknown as THREE.Vector3Tuple}>
        <Matchbox />
      </group>
      <Pose
        pose={(p) => {
          const rest: V3 = [matchbox[0] - 0.025, 0.018, matchbox[2]]
          const raised: V3 = [matchbox[0] - 0.04, 0.09, matchbox[2] - 0.03]
          // спичка повёрнута головкой к −X (rot π): головка — у фитиля, коробок справа от спиртовки
          const atWick: V3 = [lamp[0] + 0.054, 0.086, lamp[2] + 0.002]
          const dropped: V3 = [matchbox[0] - 0.02, 0.002, matchbox[2] + 0.035]
          let pos = mixV(rest, raised, ease(p, l, l + 0.08))
          pos = mixV(pos, atWick, ease(p, l + 0.08, l + 0.2))
          pos = mixV(pos, dropped, ease(p, l + 0.3, l + 0.42))
          return { pos, rot: [0, mix(Math.PI, Math.PI + 0.4, ease(p, l + 0.3, l + 0.42)), 0] }
        }}
      >
        <Match lit={(p) => ease(p, l + 0.05, l + 0.1) * (1 - ease(p, l + 0.3, l + 0.38))} />
      </Pose>
    </>
  )
}
