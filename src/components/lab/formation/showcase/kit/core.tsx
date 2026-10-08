/**
 * Kit showcase — общие визуальные примитивы (дёшево: один материал на примитив, аддитивное свечение, без постпроцессинга
 * и без новых точечных источников света). Все положения и яркости — функции времени t сценария (перемотка безопасна).
 *
 *  • useT(clock) — чтение времени в useFrame; win/ease/pulse — математика окон;
 *  • Glow — мягкое свечение (sprite); Lobe — лепесток электронного облака (s — сфера, p — две «капли» по оси);
 *  • Electron — светящийся электрон с хвостом (drei Trail), положение — функция t;
 *  • Tag — HTML-подпись в 3D (стеклянный чип), AngleArc — дуга угла с градусами, MeasureLine — выноска длины связи,
 *    DipoleArrow — стрелка диполя с «плюсом» у хвоста; Burst — вспышка + расходящееся кольцо (энергия связи);
 *  • Backdrop — фон showcase: глубокий градиент, виньетка, редкая «пыль» (drei Sparkles).
 */
import { useMemo, useRef, type CSSProperties, type MutableRefObject, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Sparkles, Trail } from '@react-three/drei'
import * as THREE from 'three'
import type { V3 } from '../../../hero/schoolHeroModel'
import { clamp01, easeInOut } from '../../formationStory'
import type { FormationClock } from '../../formationTimeline'

/* ── время и окна ── */

export type TFn = (t: number) => number
export type PFn = (t: number) => V3

/** Текущее время сценария (clock.t) — читать в useFrame. */
export const useT = (clock: MutableRefObject<FormationClock>) => () => clock.current.t
/** 0…1 с плавными краями внутри окна [a, b]; fade — длина переходов (с). */
export function win(t: number, a: number, b: number, fade = 0.5): number {
  return easeInOut((t - a) / fade) * (1 - easeInOut((t - (b - fade)) / fade))
}
/** 0…1 линейно от a к b, сглажено. */
export const seg = (t: number, a: number, b: number) => easeInOut((t - a) / Math.max(1e-6, b - a))
export const pulse = (t: number, hz = 1) => 0.5 + 0.5 * Math.sin(t * hz * Math.PI * 2)
export const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
export const add3 = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
export const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2])
export const norm3 = (a: V3): V3 => {
  const l = len3(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
export const mid3 = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]

/* ── текстуры ── */

let soft: THREE.CanvasTexture | null = null
/** Радиальный мягкий градиент (общий для всех свечений). */
export function softTexture(): THREE.CanvasTexture {
  if (soft) return soft
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  r.addColorStop(0.7, 'rgba(255,255,255,0.12)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 128, 128)
  soft = new THREE.CanvasTexture(c)
  soft.colorSpace = THREE.SRGBColorSpace
  return soft
}

/* ── свечение ── */

/** Мягкое свечение в точке: pos(t), радиус r(t) (в единицах модели), яркость k(t) 0…1. */
export function Glow({ pos, r, k, color = '#9fd3ff' }: { pos: PFn; r: TFn | number; k: TFn; color?: string; }) {
  const ref = useRef<THREE.Sprite>(null)
  const mat = useMemo(() => new THREE.SpriteMaterial({ map: softTexture(), color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), [color])
  const clock = useClockCtx()
  useFrame(() => {
    const s = ref.current
    if (!s) return
    const t = clock()
    const kk = clamp01(k(t))
    s.visible = kk > 0.005
    if (!s.visible) return
    const p = pos(t)
    s.position.set(p[0], p[1], p[2])
    const rr = typeof r === 'number' ? r : r(t)
    s.scale.setScalar(Math.max(1e-4, rr * 2))
    mat.opacity = kk
  })
  return <sprite ref={ref} material={mat} renderOrder={6} />
}

/**
 * Лепесток электронного облака. kind 's' — сфера радиуса r; 'p' — две «капли» вдоль axis (гантель) длиной 2r;
 * 'lone' — одна капля от центра по axis (неподелённая пара). k(t) — яркость 0…1 (0 — скрыт).
 */
export function Lobe({ kind, center, axis = () => [0, 1, 0], r, k, color = '#7dd3fc' }: { kind: 's' | 'p' | 'lone'; center: PFn; axis?: PFn; r: TFn | number; k: TFn; color?: string }) {
  const g = useRef<THREE.Group>(null)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), [color])
  const geo = useMemo(() => new THREE.SphereGeometry(1, 20, 14), [])
  const clock = useClockCtx()
  const q = useMemo(() => new THREE.Quaternion(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const ax = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const gr = g.current
    if (!gr) return
    const t = clock()
    const kk = clamp01(k(t))
    gr.visible = kk > 0.005
    if (!gr.visible) return
    const c = center(t)
    gr.position.set(c[0], c[1], c[2])
    const a = axis(t)
    ax.set(a[0], a[1], a[2]).normalize()
    q.setFromUnitVectors(up, ax)
    gr.quaternion.copy(q)
    const rr = typeof r === 'number' ? r : r(t)
    gr.scale.setScalar(Math.max(1e-4, rr))
    mat.opacity = 0.22 * kk
  })
  // капли: сфера, вытянутая по оси и сдвинутая от центра
  const lobes = kind === 's' ? [[0, 0, 0, 1, 1, 1]] : kind === 'p' ? [[0, 0.95, 0, 0.55, 1.05, 0.55], [0, -0.95, 0, 0.55, 1.05, 0.55]] : [[0, 1.0, 0, 0.5, 1.1, 0.5]]
  return (
    <group ref={g}>
      {lobes.map((l, i) => (
        <mesh key={i} geometry={geo} material={mat} position={[l[0]!, l[1]!, l[2]!]} scale={[l[3]!, l[4]!, l[5]!]} renderOrder={5} />
      ))}
      {/* ядро лепестка ярче */}
      {lobes.map((l, i) => (
        <mesh key={`c${i}`} geometry={geo} material={mat} position={[l[0]!, l[1]!, l[2]!]} scale={[l[3]! * 0.55, l[4]! * 0.55, l[5]! * 0.55]} renderOrder={5} />
      ))}
    </group>
  )
}

/* ── электрон с хвостом ── */

/** Светящийся электрон: pos(t), размер r, яркость k(t); хвост (Trail) виден только в движении. */
export function Electron({ pos, r, k, color = '#fde68a', trail = true }: { pos: PFn; r: number; k: TFn; color?: string; trail?: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, toneMapped: false }), [color])
  const clock = useClockCtx()
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const t = clock()
    const kk = clamp01(k(t))
    const p = pos(t)
    m.position.set(p[0], p[1], p[2])
    m.scale.setScalar(Math.max(1e-4, r * (0.6 + 0.4 * kk)))
    mat.opacity = kk
    m.visible = kk > 0.01
  })
  const body = (
    <mesh ref={ref} material={mat} renderOrder={7}>
      <sphereGeometry args={[1, 12, 10]} />
    </mesh>
  )
  if (!trail) return (
    <>
      {body}
      <Glow pos={pos} r={r * 3} k={(t) => 0.6 * clamp01(k(t))} color={color} />
    </>
  )
  return (
    <>
      <Trail width={r * 6} length={4} color={new THREE.Color(color)} attenuation={(w) => w * w} decay={1.2}>
        {body}
      </Trail>
      <Glow pos={pos} r={r * 3} k={(t) => 0.6 * clamp01(k(t))} color={color} />
    </>
  )
}

/* ── подписи ── */

const tagStyle: CSSProperties = {
  padding: '5px 10px',
  borderRadius: 10,
  background: 'rgba(10, 16, 28, 0.72)',
  border: '1px solid rgba(125, 211, 252, 0.35)',
  color: '#e6f3ff',
  font: '600 13px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  userSelect: 'none',
  boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
  backdropFilter: 'blur(6px)',
  transition: 'opacity 0.25s linear',
}
const TONE: Record<string, CSSProperties> = {
  info: {},
  plus: { borderColor: 'rgba(251, 191, 36, 0.6)', color: '#fde68a' },
  minus: { borderColor: 'rgba(96, 165, 250, 0.6)', color: '#bfdbfe' },
  heat: { borderColor: 'rgba(251, 113, 133, 0.6)', color: '#fecdd3' },
  key: { borderColor: 'rgba(167, 139, 250, 0.7)', color: '#ede9fe', font: '700 14px/1.25 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
}

/** Подпись в 3D: pos(t), текст, яркость k(t). tone — цвет рамки. Скрыта при k ≤ 0,02. */
export function Tag({ pos, text, k, tone = 'info', offset = [0, 0, 0] }: { pos: PFn; text: ReactNode; k: TFn; tone?: keyof typeof TONE; offset?: V3 }) {
  const g = useRef<THREE.Group>(null)
  const el = useRef<HTMLDivElement>(null)
  const last = useRef(-1)
  const clock = useClockCtx()
  useFrame(() => {
    const t = clock()
    const kk = clamp01(k(t))
    const p = pos(t)
    g.current?.position.set(p[0] + offset[0], p[1] + offset[1], p[2] + offset[2])
    if (el.current && Math.abs(kk - last.current) > 0.01) {
      last.current = kk
      el.current.style.opacity = String(kk)
      el.current.style.display = kk > 0.02 ? 'block' : 'none'
    }
  })
  return (
    <group ref={g}>
      <Html center zIndexRange={[30, 10]} style={{ pointerEvents: 'none' }}>
        <div ref={el} style={{ ...tagStyle, ...TONE[tone], opacity: 0, display: 'none' }} data-showcase-tag="">
          {text}
        </div>
      </Html>
    </group>
  )
}

/** Дуга угла при вершине v между лучами к a и b, радиус r; подпись градусов в середине дуги. */
export function AngleArc({ v, a, b, r, k, label, color = '#a5f3fc' }: { v: PFn; a: PFn; b: PFn; r: number; k: TFn; label: (t: number) => string; color?: string }) {
  const line = useRef<THREE.Group>(null)
  const pts = useMemo(() => Array.from({ length: 25 }, () => new THREE.Vector3()), [])
  const geo = useMemo(() => new THREE.BufferGeometry().setFromPoints(pts), [pts])
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 }), [color])
  const clock = useClockCtx()
  const midRef = useRef<V3>([0, 0, 0])
  const va = useMemo(() => new THREE.Vector3(), [])
  const vb = useMemo(() => new THREE.Vector3(), [])
  const vv = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const t = clock()
    const kk = clamp01(k(t))
    mat.opacity = 0.9 * kk
    if (kk <= 0.005) return
    const V = v(t)
    vv.set(V[0], V[1], V[2])
    const A = a(t)
    const B = b(t)
    va.set(A[0] - V[0], A[1] - V[1], A[2] - V[2]).normalize()
    vb.set(B[0] - V[0], B[1] - V[1], B[2] - V[2]).normalize()
    const ang = Math.acos(Math.max(-1, Math.min(1, va.dot(vb))))
    const n = va.clone().cross(vb)
    if (n.lengthSq() < 1e-8) n.set(0, 0, 1)
    n.normalize()
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < pts.length; i++) {
      const u = i / (pts.length - 1)
      const p = va.clone().applyAxisAngle(n, ang * u).multiplyScalar(r).add(vv)
      pos.setXYZ(i, p.x, p.y, p.z)
      if (i === 12) midRef.current = [p.x + (p.x - vv.x) * 0.45, p.y + (p.y - vv.y) * 0.45, p.z + (p.z - vv.z) * 0.45]
    }
    pos.needsUpdate = true
  })
  return (
    <group ref={line}>
      <primitive object={new THREE.Line(geo, mat)} />
      <Tag pos={() => midRef.current} text={label(clock())} k={k} />
    </group>
  )
}

/** Выноска длины связи: тонкая линия параллельно связи со смещением и подпись. */
export function MeasureLine({ a, b, k, text, offset = 0.22, color = '#cbd5e1' }: { a: PFn; b: PFn; k: TFn; text: string; offset?: number; color?: string }) {
  const clock = useClockCtx()
  const ptsRef = useRef<[V3, V3]>([
    [0, 0, 0],
    [0, 0, 0],
  ])
  const [pa, setPa] = [ptsRef.current[0], ptsRef.current[1]]
  const geo = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), [])
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 }), [color])
  const mid = useRef<V3>([0, 0, 0])
  useFrame(() => {
    const t = clock()
    const kk = clamp01(k(t))
    mat.opacity = 0.8 * kk
    if (kk <= 0.005) return
    const A = a(t)
    const B = b(t)
    const d = norm3(sub3(B, A))
    // перпендикуляр в плоскости экрана (z вперёд)
    let n: V3 = [-d[1], d[0], 0]
    if (len3(n) < 1e-6) n = [0, 1, 0]
    n = norm3(n)
    const A2 = add3(A, n, offset)
    const B2 = add3(B, n, offset)
    pa[0] = A2[0]
    pa[1] = A2[1]
    pa[2] = A2[2]
    setPa[0] = B2[0]
    setPa[1] = B2[1]
    setPa[2] = B2[2]
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    pos.setXYZ(0, A2[0], A2[1], A2[2])
    pos.setXYZ(1, B2[0], B2[1], B2[2])
    pos.needsUpdate = true
    mid.current = add3(mid3(A2, B2), n, 0.08)
  })
  return (
    <group>
      <primitive object={new THREE.Line(geo, mat)} />
      <Tag pos={() => mid.current} text={text} k={k} />
    </group>
  )
}

/** Стрелка диполя: от «+» (хвост с крестиком) к «−» (остриё). k(t) — яркость. */
export function DipoleArrow({ from, to, k, color = '#f0abfc', width = 0.035 }: { from: PFn; to: PFn; k: TFn; color?: string; width?: number }) {
  const g = useRef<THREE.Group>(null)
  const shaft = useRef<THREE.Mesh>(null)
  const head = useRef<THREE.Mesh>(null)
  const cross = useRef<THREE.Group>(null)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, toneMapped: false }), [color])
  const clock = useClockCtx()
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const t = clock()
    const kk = clamp01(k(t))
    mat.opacity = kk
    if (!g.current) return
    g.current.visible = kk > 0.005
    if (!g.current.visible) return
    const A = from(t)
    const B = to(t)
    dir.set(B[0] - A[0], B[1] - A[1], B[2] - A[2])
    const L = dir.length() || 1e-6
    dir.divideScalar(L)
    g.current.position.set(A[0], A[1], A[2])
    g.current.quaternion.setFromUnitVectors(up, dir)
    const hl = Math.min(0.35 * L, width * 5)
    if (shaft.current) {
      shaft.current.scale.set(1, Math.max(1e-4, L - hl), 1)
      shaft.current.position.y = (L - hl) / 2
    }
    if (head.current) {
      head.current.scale.set(1, hl, 1)
      head.current.position.y = L - hl / 2
    }
    if (cross.current) cross.current.position.y = width * 2.2
  })
  return (
    <group ref={g}>
      <mesh ref={shaft} material={mat} renderOrder={6}>
        <cylinderGeometry args={[width * 0.45, width * 0.45, 1, 10]} />
      </mesh>
      <mesh ref={head} material={mat} renderOrder={6}>
        <coneGeometry args={[width * 1.3, 1, 14]} />
      </mesh>
      {/* «плюс» у хвоста: перекладина */}
      <group ref={cross}>
        <mesh material={mat} rotation={[0, 0, Math.PI / 2]} renderOrder={6}>
          <cylinderGeometry args={[width * 0.45, width * 0.45, width * 4, 8]} />
        </mesh>
      </group>
    </group>
  )
}

/** Вспышка и расходящееся кольцо в точке pos в момент t0 (длительность dur): энергия образования связи. */
export function Burst({ pos, t0, dur = 1.2, color = '#fff1c4', r = 0.6 }: { pos: PFn; t0: number; dur?: number; color?: string; r?: number }) {
  const ring = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }), [color])
  const clock = useClockCtx()
  useFrame(({ camera }) => {
    const t = clock()
    const u = (t - t0) / dur
    const on = u > 0 && u < 1
    const m = ring.current
    if (!m) return
    m.visible = on
    if (!on) return
    const p = pos(t)
    m.position.set(p[0], p[1], p[2])
    m.quaternion.copy(camera.quaternion)
    m.scale.setScalar(Math.max(1e-4, r * (0.15 + 0.85 * easeInOut(u))))
    mat.opacity = 0.8 * (1 - u) * (1 - u)
  })
  return (
    <>
      <mesh ref={ring} material={mat} renderOrder={7}>
        <ringGeometry args={[0.82, 1, 48]} />
      </mesh>
      <Glow pos={pos} r={r * 0.8} k={(t) => { const u = (t - t0) / dur; return u > 0 && u < 1 ? (1 - u) * (1 - u) : 0 }} color={color} />
    </>
  )
}

/* ── фон ── */

/** Фон showcase: глубокий градиент + редкая медленная «пыль». Рисуется в корне сцены (не внутри группы атомов). */
export function Backdrop({ lowPower, tint = '#0b1733' }: { lowPower: boolean; tint?: string }) {
  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uTop: { value: new THREE.Color(tint) }, uBottom: { value: new THREE.Color('#02050c') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:
        'uniform vec3 uTop; uniform vec3 uBottom; varying vec3 vP; void main(){ float h = smoothstep(-0.6, 0.9, vP.y); float v = 1.0 - 0.35 * smoothstep(0.2, 1.0, length(vP.xy)); gl_FragColor = vec4(mix(uBottom, uTop, h) * v, 1.0); }',
    })
    return m
  }, [tint])
  return (
    <group>
      <mesh material={mat} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[40, 24, 16]} />
      </mesh>
      <Sparkles count={lowPower ? 24 : 70} scale={[8, 6, 4]} size={1.4} speed={0.15} opacity={0.35} color="#9fd3ff" />
    </group>
  )
}

/* ── контекст часов для примитивов ── */

import { createContext, useContext } from 'react'
const ClockCtx = createContext<() => number>(() => 0)
export const ShowcaseClock = ClockCtx.Provider
/** Функция времени сценария (внутри сцены — через ShowcaseClock). */
export function useClockCtx(): () => number {
  return useContext(ClockCtx)
}
