/**
 * Детали установок задач-опытов Kimyo 8: перенос предмета по точкам (поднять → перенести → опустить), коническая
 * колба 100 мл с уровнем в мл (из геометрии), гранулы металла на дне, резиновая пробка с коленом газоотводной трубки,
 * склянка тёмного стекла.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { labLiquidMaterial } from '../../../../labContract'
import { ease, mixV, useRig, type PFn, type V3 } from '../../../rigCore'
import { sharedGlass, sharedGlassEdge } from '../../../parts/glassware'
import { GlassPath } from '../../../parts/practicalware'

/** Путь по точкам: legs — [начало, конец отрезка прогресса, куда]. */
export function moveVia(p: number, start: V3, legs: readonly (readonly [number, number, V3])[]): V3 {
  let pos: V3 = start
  for (const [a, b, to] of legs) pos = mixV(pos, to, ease(p, a, b))
  return pos
}

function rand(i: number, k: number): number {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/* ── Коническая колба (Эрленмейера) 100 мл ── */

export const FLASK = { R: 0.032, rn: 0.0115, wall: 0.0012, body: 0.078, h: 0.105, floor: 0.003 } as const

/** Внутренний радиус колбы на высоте y (м) от низа. */
export function flaskInnerR(y: number): number {
  const r0 = FLASK.R - FLASK.wall
  if (y >= FLASK.body) return FLASK.rn
  const k = Math.max(0, (y - FLASK.floor) / (FLASK.body - FLASK.floor))
  return r0 - (r0 - FLASK.rn) * k
}

/** Объём (мл) до уровня y. */
export function flaskVolume(y: number): number {
  let v = 0
  const n = 60
  const top = Math.max(FLASK.floor, y)
  const dy = (top - FLASK.floor) / n
  for (let i = 0; i < n; i++) {
    const r = flaskInnerR(FLASK.floor + (i + 0.5) * dy)
    v += Math.PI * r * r * dy
  }
  return v * 1e6
}

/** Уровень (м от низа колбы) для объёма ml. */
export function flaskLevel(ml: number): number {
  if (ml <= 0) return FLASK.floor
  let lo: number = FLASK.floor
  let hi: number = FLASK.h
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2
    if (flaskVolume(mid) < ml) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * Колба (начало — центр дна). Корпус и горло — две токарные детали (аудит видит горло отдельно от широкого корпуса).
 * volume(p) — мл раствора, color(p) — цвет, cloud(p) — муть 0…1 (белая взвесь).
 */
export function ConicalFlask({ volume, color, cloud, cloudColor = '#f4f4f0' }: { volume: PFn; color: (p: number) => string; cloud?: PFn; cloudColor?: string }) {
  const { quality, p } = useRig()
  const seg = quality === 'high' ? 36 : 20
  const body = useMemo(() => {
    const { R, rn, wall, body: hb, floor } = FLASK
    const pts = [
      new THREE.Vector2(0.0001, 0),
      new THREE.Vector2(R - 0.004, 0),
      new THREE.Vector2(R, 0.004),
      new THREE.Vector2(rn + wall, hb),
      new THREE.Vector2(rn, hb),
      new THREE.Vector2(R - wall, floor + 0.002),
      new THREE.Vector2(0.0001, floor),
    ]
    return new THREE.LatheGeometry(pts, seg)
  }, [seg])
  const neck = useMemo(() => {
    const { rn, wall, body: hb, h } = FLASK
    const pts = [new THREE.Vector2(rn + wall, hb), new THREE.Vector2(rn + wall, h - 0.002), new THREE.Vector2(rn + wall + 0.0018, h), new THREE.Vector2(rn, h), new THREE.Vector2(rn, hb)]
    return new THREE.LatheGeometry(pts, seg)
  }, [seg])
  const liq = useMemo(() => labLiquidMaterial('#e6f2ff', 0.6), [])
  const tint = useMemo(() => new THREE.Color(), [])
  const milk = useMemo(() => new THREE.Color(cloudColor), [cloudColor])
  const mesh = useRef<THREE.Mesh>(null)
  const key = useRef(-1)
  useFrame(() => {
    const pv = p.current ?? 0
    const m = mesh.current
    if (!m) return
    const v = Math.max(0, volume(pv))
    m.visible = v > 0.2
    const c = cloud ? cloud(pv) : 0
    tint.set(color(pv))
    liq.color.copy(tint).lerp(milk, c * 0.85)
    liq.opacity = 0.55 + 0.4 * c
    if (!m.visible) return
    const lv = flaskLevel(v)
    const k = Math.round(lv / 0.0003)
    if (k === key.current) return
    key.current = k
    const h = Math.max(0.0005, lv - FLASK.floor)
    const g = new THREE.CylinderGeometry(flaskInnerR(lv) - 0.0003, flaskInnerR(FLASK.floor) - 0.0003, h, 28)
    g.translate(0, FLASK.floor + h / 2, 0)
    m.geometry.dispose()
    m.geometry = g
  })
  return (
    <group>
      <mesh geometry={body} material={sharedGlass(quality)} renderOrder={3} />
      <mesh geometry={body} material={sharedGlassEdge()} renderOrder={4} />
      <mesh geometry={neck} material={sharedGlass(quality)} renderOrder={3} />
      <mesh geometry={neck} material={sharedGlassEdge()} renderOrder={4} />
      <mesh ref={mesh} material={liq} renderOrder={2} />
    </group>
  )
}

/**
 * Кусочки металла на дне сосуда (начало — дно): show(p) — сколько из n уже лежит (0…1), left(p) — доля
 * нерастворившегося металла (кусочки уменьшаются). spread — радиус россыпи.
 */
export function MetalPieces({ n, show, left, color, spread, size = 0.0034, kind = 'granule', y0 = 0.003 }: { n: number; show: PFn; left: PFn; color: string; spread: number; size?: number; kind?: 'granule' | 'chip'; y0?: number }) {
  const { p } = useRig()
  const ref = useRef<THREE.InstancedMesh>(null)
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.75 }), [color])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const seeds = useMemo(() => Array.from({ length: n }, (_, i) => ({ a: rand(i, 3) * Math.PI * 2, r: Math.sqrt(rand(i, 4)) * spread, s: 0.75 + rand(i, 5) * 0.5, rot: rand(i, 6) * 6 })), [n, spread])
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const pv = p.current ?? 0
    const shown = Math.round(Math.max(0, Math.min(1, show(pv))) * n)
    const k = Math.cbrt(Math.max(0, Math.min(1, left(pv))))
    m.visible = shown > 0 && k > 0.02
    if (!m.visible) return
    for (let i = 0; i < n; i++) {
      const sd = seeds[i]!
      const s = i < shown ? size * sd.s * k : 1e-6
      tmp.position.set(Math.cos(sd.a) * sd.r, y0 + s * (kind === 'chip' ? 0.3 : 0.75), Math.sin(sd.a) * sd.r)
      tmp.rotation.set(sd.rot, sd.rot * 1.3, sd.rot * 0.7)
      if (kind === 'chip') tmp.scale.set(s * 2.2, s * 0.35, s * 1.2)
      else tmp.scale.setScalar(s)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} material={mat} castShadow frustumCulled={false}>
      {kind === 'chip' ? <boxGeometry args={[1, 1, 1]} /> : <dodecahedronGeometry args={[1, 0]} />}
    </instancedMesh>
  )
}

/** Колено газоотводной трубки на пробке (конец — сюда надевают шланг), в координатах пробки. */
export const ELBOW: V3 = [0.032, 0.05, 0]

/** Резиновая пробка для горла колбы (начало — низ пробки) с коленом газоотводной трубки (вправо, +X). */
export function FlaskStopper({ tube = true }: { tube?: boolean }) {
  const rubber = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5f6670', roughness: 0.85 }), [])
  return (
    <group>
      <mesh position={[0, 0.0105, 0]} material={rubber} castShadow>
        <cylinderGeometry args={[0.0135, 0.0102, 0.021, 22]} />
      </mesh>
      {tube ? <GlassPath points={[[0, 0.004, 0], [0, 0.036, 0], [0.008, 0.048, 0], ELBOW]} radius={0.0027} /> : null}
    </group>
  )
}

/** Склянка тёмного стекла с притёртой пробкой (начало — дно): AgNO₃ и другие светочувствительные растворы. */
export const AMBER = { r: 0.027, h: 0.105, neck: 0.011 } as const
export function AmberBottle({ label, level }: { label: THREE.Texture; level: PFn }) {
  const { quality, p } = useRig()
  const geo = useMemo(() => {
    const { r, h, neck } = AMBER
    const pts = [
      new THREE.Vector2(0.0001, 0),
      new THREE.Vector2(r - 0.003, 0),
      new THREE.Vector2(r, 0.004),
      new THREE.Vector2(r, h * 0.7),
      new THREE.Vector2(r * 0.8, h * 0.82),
      new THREE.Vector2(neck, h * 0.88),
      new THREE.Vector2(neck, h - 0.003),
      new THREE.Vector2(neck + 0.0015, h),
      new THREE.Vector2(neck - 0.0015, h),
    ]
    return new THREE.LatheGeometry(pts, quality === 'high' ? 32 : 18)
  }, [quality])
  const amber = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5a2c0c', roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.86 }), [])
  const liq = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2a1406', roughness: 0.2, transparent: true, opacity: 0.6 }), [])
  const liqRef = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const m = liqRef.current
    if (!m) return
    const k = Math.max(0.001, level(p.current ?? 0))
    const hh = AMBER.h * 0.66 * k
    m.scale.set(1, hh, 1)
    m.position.y = 0.004 + hh / 2
  })
  return (
    <group>
      <mesh geometry={geo} material={amber} castShadow />
      <mesh ref={liqRef} material={liq}>
        <cylinderGeometry args={[AMBER.r - 0.003, AMBER.r - 0.003, 1, 20]} />
      </mesh>
      <mesh position={[0, AMBER.h * 0.42, 0]} renderOrder={5}>
        <cylinderGeometry args={[AMBER.r + 0.0006, AMBER.r + 0.0006, 0.036, 20, 1, true, -0.85, 1.7]} />
        <meshStandardMaterial map={label} roughness={0.7} />
      </mesh>
      {/* притёртая пробка */}
      <mesh position={[0, AMBER.h + 0.006, 0]} material={amber}>
        <cylinderGeometry args={[AMBER.neck + 0.002, AMBER.neck - 0.001, 0.014, 16]} />
      </mesh>
    </group>
  )
}

/**
 * Поза сосуда, который наливает (начало — центр дна): со стола → поднять → встать рядом и выше приёмника (over) →
 * наклон до tiltMax, при этом горлышко (на высоте height над дном) приходит в точку lip над приёмником → обратно.
 * Струя идёт на отрезке s + 0.46…0.74 (pourShow), r — радиус сосуда (чтобы стоять сбоку от приёмника).
 */
export function pourPose(rest: V3, s: number, lip: V3, height: number, tiltMax = 1.75, r = 0.03) {
  const side = rest[0] > lip[0] ? 1 : -1
  const over: V3 = [lip[0] + side * (r + 0.012), lip[1] + 0.012, lip[2]]
  const tilted: V3 = [lip[0] + side * Math.sin(tiltMax) * height, lip[1] - Math.cos(tiltMax) * height, lip[2]]
  const lifted: V3 = [rest[0], Math.max(rest[1] + 0.09, over[1] + 0.02), rest[2]]
  return (p: number) => {
    const k = ease(p, s + 0.34, s + 0.48) * (1 - ease(p, s + 0.74, s + 0.84))
    let pos = moveVia(p, rest, [
      [s, s + 0.14, lifted],
      [s + 0.12, s + 0.34, over],
    ])
    if (k > 0) pos = mixV(over, tilted, k)
    pos = moveVia(p, pos, [
      [s + 0.84, s + 0.92, lifted],
      [s + 0.9, s + 0.98, rest],
    ])
    return { pos, rot: [0, 0, side * k * tiltMax] as V3 }
  }
}
