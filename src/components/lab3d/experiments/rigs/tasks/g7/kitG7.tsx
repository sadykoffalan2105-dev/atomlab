/**
 * Общие мелочи установок задач-опытов Kimyo 7: перенос предмета «поднять → перенести → опустить», шпатель с
 * гранулами или порошком, горка гранул в сосуде, бумажная этикетка-поясок на стакане, спиртовка со спичками.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Pose, ease, mix, mixV, useRig, type PFn, type V3 } from '../../../rigCore'
import { Match, Matchbox, SpiritLamp, useFlameCeiling } from '../../../parts/fire'
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

/** Сетка с керамическим центром (м): квадрат 10 × 10 см, керамический круг Ø 64 мм, толщина. */
export const GAUZE = { side: 0.1, ceramicR: 0.032, t: 0.0014 } as const

/** Плетёная проволока сетки (одна плитка — две проволоки в каждую сторону; RGBA: сквозь ячейки видно пламя). */
let wireTex: THREE.CanvasTexture | null = null
function wireTexture(): THREE.CanvasTexture {
  if (wireTex) return wireTex
  const S = 64
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')
  if (g) {
    g.clearRect(0, 0, S, S)
    const w = 7
    // переплетение: проволока «сверху» светлее посередине, «снизу» — темнее у перекрестья
    for (let k = 0; k < 2; k++) {
      const x = k * 32 + 16
      const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0)
      gr.addColorStop(0, '#6f767e')
      gr.addColorStop(0.5, '#e4e8ec')
      gr.addColorStop(1, '#6f767e')
      g.fillStyle = gr
      g.fillRect(x - w / 2, 0, w, S)
    }
    for (let k = 0; k < 2; k++) {
      const y = k * 32 + 16
      const gr = g.createLinearGradient(0, y - w / 2, 0, y + w / 2)
      gr.addColorStop(0, '#6f767e')
      gr.addColorStop(0.5, '#dfe3e8')
      gr.addColorStop(1, '#6f767e')
      g.fillStyle = gr
      // уток проходит то над, то под основой
      for (let j = 0; j < 2; j++) {
        const over = (j + k) % 2 === 0
        const x0 = j * 32
        if (over) g.fillRect(x0, y - w / 2, 32, w)
        else {
          g.fillRect(x0, y - w / 2, 16 - w / 2 - 1, w)
          g.fillRect(x0 + 16 + w / 2 + 1, y - w / 2, 16 - w / 2 - 1, w)
        }
      }
    }
  }
  wireTex = new THREE.CanvasTexture(c)
  wireTex.wrapS = THREE.RepeatWrapping
  wireTex.wrapT = THREE.RepeatWrapping
  wireTex.repeat.set(20, 20)
  wireTex.anisotropy = 4
  wireTex.colorSpace = THREE.SRGBColorSpace
  return wireTex
}

/** Радиальное пятно накала (центр — 1, к краю 0): общее для керамики и проволоки вокруг неё. */
let glowTex: THREE.CanvasTexture | null = null
function glowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex
  const S = 64
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')
  if (g) {
    g.fillStyle = '#000'
    g.fillRect(0, 0, S, S)
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    gr.addColorStop(0, '#ffffff')
    gr.addColorStop(0.35, '#d0d0d0')
    gr.addColorStop(0.7, '#3a3a3a')
    gr.addColorStop(1, '#000000')
    g.fillStyle = gr
    g.fillRect(0, 0, S, S)
  }
  glowTex = new THREE.CanvasTexture(c)
  return glowTex
}

/**
 * Металлическая сетка с керамическим центром (начало — центр нижней плоскости; кладут на кольцо штатива).
 * Проволочная (сквозь ячейки видно пламя), края загнуты рамкой; пламя спиртовки под ней растекается (useFlameCeiling).
 * glow(p) 0…1 — керамика в центре и проволока вокруг неё краснеют от пламени снизу.
 */
export function WireGauze({ glow }: { glow?: PFn }) {
  const { p } = useRig()
  const root = useRef<THREE.Group>(null)
  useFlameCeiling(root, GAUZE.side / 2)
  const wire = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#a9b0b8',
        map: wireTexture(),
        alphaTest: 0.32,
        side: THREE.DoubleSide,
        roughness: 0.45,
        metalness: 0.7,
        emissive: '#ff3a12',
        emissiveMap: glowTexture(),
        emissiveIntensity: 0,
      }),
    [],
  )
  const frame = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8d949c', roughness: 0.45, metalness: 0.75 }), [])
  const ceramic = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e7e1d6', roughness: 1, emissive: '#ff3c14', emissiveMap: glowTexture(), emissiveIntensity: 0 }), [])
  const baseColor = useMemo(() => new THREE.Color('#e7e1d6'), [])
  const hotColor = useMemo(() => new THREE.Color('#c9a58f'), [])
  useFrame(() => {
    const k = glow ? glow(p.current ?? 0) : 0
    ceramic.emissiveIntensity = 1.35 * k
    ceramic.color.copy(baseColor).lerp(hotColor, k * 0.55)
    wire.emissiveIntensity = 0.9 * k
  })
  const s = GAUZE.side
  const midY = GAUZE.t * 0.5
  const rim = 0.0022
  return (
    <group ref={root}>
      {/* плетёная проволока (плоскость с альфа-текстурой) */}
      <mesh position={[0, midY, 0]} rotation={[-Math.PI / 2, 0, 0]} material={wire} receiveShadow>
        <planeGeometry args={[s, s]} />
      </mesh>
      {/* загнутые края — рамка из проволоки */}
      {[-1, 1].map((d) => (
        <mesh key={`x${d}`} position={[(d * (s - rim)) / 2, midY, 0]} material={frame} castShadow>
          <boxGeometry args={[rim, GAUZE.t * 0.7, s]} />
        </mesh>
      ))}
      {[-1, 1].map((d) => (
        <mesh key={`z${d}`} position={[0, midY, (d * (s - rim)) / 2]} material={frame} castShadow>
          <boxGeometry args={[s - 2 * rim, GAUZE.t * 0.7, rim]} />
        </mesh>
      ))}
      {/* керамический круг, вдавленный в сетку (верх — на GAUZE.t + 0,0004: на нём стоит чашка) */}
      <mesh position={[0, (GAUZE.t + 0.0004) / 2, 0]} material={ceramic} castShadow receiveShadow>
        <cylinderGeometry args={[GAUZE.ceramicR, GAUZE.ceramicR * 0.985, GAUZE.t + 0.0004, 40]} />
      </mesh>
    </group>
  )
}
