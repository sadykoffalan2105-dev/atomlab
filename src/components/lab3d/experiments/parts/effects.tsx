/**
 * Эффекты опытов: пузырьки газа, белая взвесь и осадок, капли воды на холодном стекле,
 * струя при переливании, вспышка «хлопка», пробка с газоотводной трубкой, звук хлопка (WebAudio, без файлов).
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { isVrLabSoundMuted } from '../../../../vrLab/vrLabSound'
import { useRig, type PFn } from '../rigCore'
import { TUBE_R } from './glassware'

/** Детерминированный «случай» (одинаковая картинка при каждом открытии). */
function rand(i: number, k: number): number {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return x - Math.floor(x)
}

const tmp = new THREE.Object3D()

/**
 * Пузырьки газа в пробирке (начало — дно пробирки): поднимаются от источника (fromY) к поверхности (level),
 * rate(p) — интенсивность 0…1.
 */
export function Bubbles({ level, rate, fromY = 0.008, spread = 0.75 }: { level: PFn; rate: PFn; fromY?: number; spread?: number }) {
  const { quality, p, time } = useRig()
  const n = quality === 'high' ? 70 : 26
  const ref = useRef<THREE.InstancedMesh>(null)
  const seeds = useMemo(() => Array.from({ length: n }, (_, i) => ({ a: rand(i, 1) * Math.PI * 2, r: rand(i, 2), s: 0.6 + rand(i, 3) * 0.8, ph: rand(i, 4), size: 0.5 + rand(i, 5) })), [n])
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const pv = p.current ?? 0
    const t = time.current ?? 0
    const lv = level(pv)
    const k = rate(pv)
    const span = Math.max(0.001, lv - fromY)
    for (let i = 0; i < n; i++) {
      const sd = seeds[i]!
      const on = sd.ph < k
      const f = (t * 0.55 * sd.s + sd.ph) % 1
      const y = fromY + f * span
      const rr = TUBE_R * 0.7 * spread * Math.sqrt(sd.r) * (1 - 0.3 * f)
      const wob = Math.sin(t * 9 + i) * 0.0006
      tmp.position.set(Math.cos(sd.a) * rr + wob, y, Math.sin(sd.a) * rr)
      const sc = on && lv > fromY + 0.004 ? (0.0006 + 0.0009 * sd.size) * (0.6 + 0.6 * f) : 0
      tmp.scale.setScalar(Math.max(sc, 1e-6))
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} renderOrder={2} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshPhysicalMaterial color="#ffffff" transparent opacity={0.75} roughness={0.05} clearcoat={1} depthWrite={false} />
    </instancedMesh>
  )
}

/**
 * Белая взвесь и осадок BaSO₄ в пробирке (начало — дно): appear(p) — сколько частиц уже образовалось,
 * settle(p) — 0 взвесь по всему объёму … 1 всё на дне; level — высота раствора; layer — толщина слоя осадка.
 */
export function Precipitate({ level, appear, settle, layer = 0.008 }: { level: PFn; appear: PFn; settle: PFn; layer?: number }) {
  const { quality, p, time } = useRig()
  const n = quality === 'high' ? 320 : 110
  const ref = useRef<THREE.InstancedMesh>(null)
  const bed = useRef<THREE.Mesh>(null)
  const seeds = useMemo(
    () => Array.from({ length: n }, (_, i) => ({ a: rand(i, 7) * Math.PI * 2, r: Math.sqrt(rand(i, 8)), y: rand(i, 9), d: rand(i, 10) * 0.45, ph: rand(i, 11), s: 0.6 + rand(i, 12) })),
    [n],
  )
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const pv = p.current ?? 0
    const t = time.current ?? 0
    const lv = level(pv)
    const ap = appear(pv)
    const st = settle(pv)
    for (let i = 0; i < n; i++) {
      const sd = seeds[i]!
      const local = Math.min(1, Math.max(0, (st - sd.d) / (1 - sd.d)))
      const k = local * local * (3 - 2 * local)
      const y0 = 0.006 + sd.y * Math.max(0.002, lv - 0.01)
      const y1 = 0.0025 + sd.y * layer * 0.8
      const rr = TUBE_R * 0.78 * sd.r
      const drift = (1 - k) * 0.0012
      tmp.position.set(
        Math.cos(sd.a + t * 0.2 * (1 - k)) * rr + Math.sin(t * 1.3 + i) * drift,
        y0 + (y1 - y0) * k + Math.sin(t * 0.9 + i * 0.7) * drift,
        Math.sin(sd.a + t * 0.2 * (1 - k)) * rr,
      )
      const sc = sd.ph < ap ? 0.0007 * sd.s : 0
      tmp.scale.setScalar(Math.max(sc, 1e-6))
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    }
    m.instanceMatrix.needsUpdate = true
    const b = bed.current
    if (b) {
      const h = layer * st * ap
      b.visible = h > 0.0004
      b.scale.set(1, Math.max(h, 1e-4), 1)
      b.position.y = 0.001 + h / 2
    }
  })
  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, n]} renderOrder={2} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={1} emissive="#e8ebef" emissiveIntensity={0.25} />
      </instancedMesh>
      <mesh ref={bed} renderOrder={2}>
        <cylinderGeometry args={[TUBE_R * 0.84, TUBE_R * 0.7, 1, 20]} />
        <meshStandardMaterial color="#fbfcfd" roughness={1} emissive="#eef1f4" emissiveIntensity={0.25} />
      </mesh>
    </>
  )
}

/**
 * Капли воды на холодном стекле: points — места капель (локальные координаты), show(p) — 0…1 проявление.
 * Внутренняя «испарина» — тонкая матовая плёнка, если указан film.
 */
export function Droplets({ points, show }: { points: readonly (readonly [number, number, number])[]; show: PFn }) {
  const { p } = useRig()
  const ref = useRef<THREE.InstancedMesh>(null)
  const n = points.length
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const k = show(p.current ?? 0)
    for (let i = 0; i < n; i++) {
      const pt = points[i]!
      const on = Math.min(1, Math.max(0, k * 1.6 - rand(i, 21) * 0.6))
      tmp.position.set(pt[0], pt[1], pt[2])
      tmp.scale.setScalar(Math.max(1e-6, on * (0.0007 + rand(i, 22) * 0.0011)))
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} renderOrder={4} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshPhysicalMaterial color="#e6f3ff" transparent opacity={0.85} roughness={0.02} clearcoat={1} depthWrite={false} />
    </instancedMesh>
  )
}

/** Точки капель на внутренней стороне стакана (радиус r, высота от h0 до h1). */
export function beakerDropPoints(r: number, h0: number, h1: number, count: number): [number, number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const a = rand(i, 31) * Math.PI * 2
    const y = h0 + rand(i, 32) * (h1 - h0)
    return [Math.cos(a) * r, y, Math.sin(a) * r] as [number, number, number]
  })
}

/** Точки капель на нижней стороне пластинки (w × d). */
export function plateDropPoints(w: number, d: number, y: number, count: number): [number, number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const rx = (rand(i, 41) - 0.5) * w * 0.6
    const rz = (rand(i, 42) - 0.5) * d * 0.6
    return [rx, y, rz] as [number, number, number]
  })
}

/**
 * Струя жидкости: вертикальная лента от горлышка (top) вниз до уровня (bottomY). show(p) — 0…1.
 * Ширина пульсирует — струя «живая».
 */
export function PourStream({ x, z, top, bottom, show, color = '#dff1ff' }: { x: number; z: number; top: PFn; bottom: PFn; show: PFn; color?: string }) {
  const { p, time } = useRig()
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const pv = p.current ?? 0
    const k = show(pv)
    const t0 = top(pv)
    const b0 = bottom(pv)
    const len = Math.max(0.001, t0 - b0)
    m.visible = k > 0.02
    const w = k * (0.9 + 0.12 * Math.sin((time.current ?? 0) * 30))
    m.scale.set(w, len, w)
    m.position.set(x, b0 + len / 2, z)
  })
  return (
    <mesh ref={ref} renderOrder={3}>
      <cylinderGeometry args={[0.0011, 0.0016, 1, 10, 1, true]} />
      <meshPhysicalMaterial color={color} transparent opacity={0.7} roughness={0.05} clearcoat={1} depthWrite={false} />
    </mesh>
  )
}

/** Короткая вспышка («хлопок» водорода): flash(p) — 0…1. */
export function PopFlash({ flash, color = '#ffe2a6', size = 0.03 }: { flash: PFn; color?: string; size?: number }) {
  const { p } = useRig()
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const k = flash(p.current ?? 0)
    m.visible = k > 0.01
    m.scale.setScalar(size * (0.4 + k))
    ;(m.material as THREE.MeshBasicMaterial).opacity = k * 0.8
  })
  return (
    <mesh ref={ref} renderOrder={9}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

/**
 * Резиновая пробка с изогнутой газоотводной трубкой. Начало — низ пробки (входит в горлышко пробирки).
 * Трубка: вверх 4 см → вбок outX → вверх upEnd (конец трубки — здесь собирают и поджигают водород).
 */
export const OUTLET = { up: 0.045, outX: 0.13, upEnd: 0.045 } as const
export function StopperWithTube() {
  const { quality } = useRig()
  const geo = useMemo(() => {
    const r = 0.012
    const path = new THREE.CurvePath<THREE.Vector3>()
    const a = new THREE.Vector3(0, 0.005, 0)
    const b = new THREE.Vector3(0, OUTLET.up, 0)
    const c = new THREE.Vector3(OUTLET.outX, OUTLET.up, 0)
    const d = new THREE.Vector3(OUTLET.outX, OUTLET.up + OUTLET.upEnd, 0)
    path.add(new THREE.LineCurve3(a, new THREE.Vector3(0, OUTLET.up - r, 0)))
    path.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, OUTLET.up - r, 0), b, new THREE.Vector3(r, OUTLET.up, 0)))
    path.add(new THREE.LineCurve3(new THREE.Vector3(r, OUTLET.up, 0), new THREE.Vector3(OUTLET.outX - r, OUTLET.up, 0)))
    path.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(OUTLET.outX - r, OUTLET.up, 0), c, new THREE.Vector3(OUTLET.outX, OUTLET.up + r, 0)))
    path.add(new THREE.LineCurve3(new THREE.Vector3(OUTLET.outX, OUTLET.up + r, 0), d))
    return new THREE.TubeGeometry(path, quality === 'high' ? 80 : 40, 0.0028, 10, false)
  }, [quality])
  return (
    <group>
      <mesh position={[0, 0.009, 0]} castShadow>
        <cylinderGeometry args={[TUBE_R * 1.18, TUBE_R * 0.92, 0.018, 20]} />
        <meshStandardMaterial color="#5f6670" roughness={0.85} />
      </mesh>
      <mesh geometry={geo} renderOrder={3}>
        <meshPhysicalMaterial color="#f3f9ff" transparent opacity={quality === 'high' ? 0.45 : 0.4} roughness={0.05} clearcoat={1} depthWrite={false} />
      </mesh>
    </group>
  )
}

let audio: AudioContext | null = null
/** Звук хлопка: короткий шумовой импульс через фильтр (глухой — низкий и тихий). */
export function playPop(kind: 'dull' | 'sharp' = 'dull') {
  if (typeof window === 'undefined' || isVrLabSoundMuted()) return
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    audio ??= new Ctor()
    const ctx = audio
    if (ctx.state === 'suspended') void ctx.resume()
    const len = Math.floor(ctx.sampleRate * 0.25)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * (kind === 'dull' ? 0.035 : 0.02)))
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = kind === 'dull' ? 520 : 2400
    const g = ctx.createGain()
    g.gain.value = kind === 'dull' ? 0.5 : 0.9
    src.connect(f).connect(g).connect(ctx.destination)
    src.start()
  } catch {
    /* звук не обязателен */
  }
}
