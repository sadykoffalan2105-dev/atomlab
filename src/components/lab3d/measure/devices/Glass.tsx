/**
 * Мерная посуда с настоящими шкалами (цифры читаются на крупном плане), стакан с содержимым (раствор, муть,
 * осадок), сбор газа над водой в перевёрнутый цилиндр и спиртовой термометр.
 * Объёмы — в мл: высота уровня считается из геометрии сосуда (measure/quantities.ts), а не подбирается на глаз.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { labLiquidMaterial } from '../../labContract'
import { useRig, type PFn, type V3 } from '../../experiments/rigCore'
import { sharedGlass, sharedGlassEdge } from '../../experiments/parts/glassware'
import { cylinderGeom } from '../quantities'
import { SCALE_TEX_PAD, scaleTexture, thermometerScaleTexture, type ScaleSpec } from './deviceTextures'

function rand(i: number, k: number): number {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return x - Math.floor(x)
}
const tmp = new THREE.Object3D()

/** Полоса шкалы на передней дуге сосуда (радиус r, высота шкалы scaleH от y0). */
function ScaleBand({ spec, r, y0, scaleH, arc = 1.6 }: { spec: ScaleSpec; r: number; y0: number; scaleH: number; arc?: number }) {
  const tex = useMemo(() => scaleTexture(spec), [spec])
  const h = scaleH / (1 - 2 * SCALE_TEX_PAD)
  // дуга смотрит на ученика (+Z): у CylinderGeometry θ = 0 — это ось +Z (x = r·sin θ, z = r·cos θ),
  // u текстуры растёт слева направо, если смотреть с +Z
  return (
    <mesh position={[0, y0 + scaleH / 2, 0]} renderOrder={5}>
      <cylinderGeometry args={[r, r, h, 24, 1, true, -arc / 2, arc]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} side={THREE.FrontSide} toneMapped={false} />
    </mesh>
  )
}

/* ── Мерный цилиндр ── */

export const CYL_FOOT_H = 0.007
export const CYL_BOTTOM = 0.011

/** Высота верхнего края цилиндра (м) от основания. */
export function cylinderTop(capacity: number): number {
  const g = cylinderGeom(capacity)
  return CYL_BOTTOM + g.scaleH + 0.03
}

export function cylinderSpec(capacity: number, inverted = false): ScaleSpec {
  const div = capacity <= 10 ? 0.2 : capacity <= 100 ? 1 : capacity <= 250 ? 2 : 5
  const major = capacity <= 10 ? 1 : capacity <= 100 ? 10 : capacity <= 250 ? 10 : 50
  const label = capacity <= 10 ? 1 : capacity <= 50 ? 10 : capacity <= 100 ? 10 : capacity <= 250 ? 20 : 50
  return { capacity, division: div, majorEvery: major, labelEvery: label, inverted, caption: `${capacity} ml 20 °C` }
}

/**
 * Мерный цилиндр (начало — центр основания). volume(p) — мл жидкости; мениск вогнутый: отсчёт по нижнему краю,
 * поверхность — плоский диск на уровне отсчёта, у стенок — подъём ~1 мм.
 */
export function MeasuringCylinder({ capacity, volume, color = '#dcefff', opacity = 0.55 }: { capacity: number; volume: PFn; color?: string; opacity?: number }) {
  const { quality, p } = useRig()
  const g = cylinderGeom(capacity)
  const ro = g.ri + 0.0013
  const top = cylinderTop(capacity)
  const glass = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.0001, CYL_FOOT_H),
      new THREE.Vector2(ro, CYL_FOOT_H),
      new THREE.Vector2(ro, top - 0.003),
      new THREE.Vector2(ro + 0.0022, top),
      new THREE.Vector2(g.ri, top),
      new THREE.Vector2(g.ri, CYL_BOTTOM),
      new THREE.Vector2(0.0001, CYL_BOTTOM),
    ]
    return new THREE.LatheGeometry(pts, quality === 'high' ? 36 : 20)
  }, [quality, ro, top, g.ri])
  const foot = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2f6fd1', roughness: 0.5 }), [])
  const spec = useMemo(() => cylinderSpec(capacity), [capacity])
  const liq = useMemo(() => labLiquidMaterial(color, opacity), [color, opacity])
  const col = useRef<THREE.Mesh>(null)
  const men = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const v = Math.max(0, volume(p.current ?? 0))
    const h = (v / capacity) * g.scaleH
    const m = col.current
    if (m) {
      m.visible = h > 0.0005
      m.scale.set(1, Math.max(1e-4, h), 1)
      m.position.y = CYL_BOTTOM + h / 2
    }
    if (men.current) {
      men.current.visible = h > 0.002
      men.current.position.y = CYL_BOTTOM + h + 0.0006
    }
  })
  return (
    <group>
      {/* пластиковая шестигранная подставка */}
      <mesh position={[0, CYL_FOOT_H / 2, 0]} material={foot} castShadow receiveShadow>
        <cylinderGeometry args={[ro * 2.3, ro * 2.4, CYL_FOOT_H, 6]} />
      </mesh>
      <mesh geometry={glass} material={sharedGlass(quality)} renderOrder={3} />
      <mesh geometry={glass} material={sharedGlassEdge()} renderOrder={4} />
      <ScaleBand spec={spec} r={ro + 0.0004} y0={CYL_BOTTOM} scaleH={g.scaleH} />
      <mesh ref={col} material={liq} renderOrder={2}>
        <cylinderGeometry args={[g.ri - 0.0003, g.ri - 0.0003, 1, 28]} />
      </mesh>
      {/* мениск: кольцо у стенки чуть выше плоской поверхности */}
      <mesh ref={men} rotation={[Math.PI / 2, 0, 0]} material={liq} renderOrder={2}>
        <torusGeometry args={[g.ri - 0.0012, 0.0011, 6, 28]} />
      </mesh>
    </group>
  )
}

/* ── Стакан с делениями и содержимым ── */

export interface BeakerSize {
  readonly capacity: number
  readonly ri: number
  readonly h: number
}
export const BEAKERS: Readonly<Record<50 | 100 | 250, BeakerSize>> = {
  50: { capacity: 50, ri: 0.0205, h: 0.058 },
  100: { capacity: 100, ri: 0.0255, h: 0.072 },
  250: { capacity: 250, ri: 0.0335, h: 0.095 },
}
const BEAKER_FLOOR = 0.003

/** Высота уровня (м) в стакане для объёма мл. */
export function beakerLevel(size: BeakerSize, ml: number): number {
  return BEAKER_FLOOR + ml / 1e6 / (Math.PI * size.ri * size.ri)
}

/**
 * Химический стакан (начало — дно): раствор volume(p) мл цвета color(p), муть cloud(p) 0…1 (частицы осадка во всём
 * объёме), осадок на дне bed(p) — толщина слоя (м), цвет осадка solidColor.
 */
export function MeasuringBeaker({
  size,
  volume,
  color,
  cloud,
  bed,
  solidColor = '#ffffff',
}: {
  size: BeakerSize
  volume: PFn
  color: (p: number) => string
  cloud?: PFn
  bed?: PFn
  solidColor?: string
}) {
  const { quality, p, time } = useRig()
  const ro = size.ri + 0.0012
  const geo = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.0001, 0),
      new THREE.Vector2(ro - 0.003, 0),
      new THREE.Vector2(ro, 0.003),
      new THREE.Vector2(ro, size.h - 0.002),
      new THREE.Vector2(ro + 0.0025, size.h),
      new THREE.Vector2(size.ri, size.h),
      new THREE.Vector2(size.ri, BEAKER_FLOOR),
      new THREE.Vector2(0.0001, BEAKER_FLOOR),
    ]
    return new THREE.LatheGeometry(pts, quality === 'high' ? 40 : 22)
  }, [quality, ro, size])
  const spec = useMemo<ScaleSpec>(() => {
    const step = size.capacity >= 250 ? 50 : size.capacity >= 100 ? 20 : 10
    return { capacity: size.capacity, division: step, majorEvery: step, labelEvery: step, caption: `${size.capacity} ml`, color: '#f4f8ff' }
  }, [size])
  const scaleH = (size.capacity / 1e6 / (Math.PI * size.ri * size.ri))
  const liq = useMemo(() => labLiquidMaterial('#dcefff', 0.6), [])
  const solid = useMemo(() => new THREE.MeshStandardMaterial({ color: solidColor, roughness: 1, emissive: solidColor, emissiveIntensity: 0.12 }), [solidColor])
  const col = useRef<THREE.Mesh>(null)
  const bedM = useRef<THREE.Mesh>(null)
  const parts = useRef<THREE.InstancedMesh>(null)
  const n = quality === 'high' ? 220 : 80
  const seeds = useMemo(() => Array.from({ length: n }, (_, i) => ({ a: rand(i, 1) * Math.PI * 2, r: Math.sqrt(rand(i, 2)), y: rand(i, 3), s: 0.6 + rand(i, 4) })), [n])
  const milk = useMemo(() => new THREE.Color(solidColor), [solidColor])
  const base = useMemo(() => new THREE.Color(), [])
  useFrame(() => {
    const pv = p.current ?? 0
    const t = time.current ?? 0
    const v = Math.max(0, volume(pv))
    const lv = beakerLevel(size, v)
    const c = cloud ? cloud(pv) : 0
    base.set(color(pv))
    liq.color.copy(base).lerp(milk, c * 0.85)
    liq.opacity = 0.55 + 0.38 * c
    const m = col.current
    if (m) {
      m.visible = v > 0.3
      const hh = Math.max(1e-4, lv - BEAKER_FLOOR)
      m.scale.set(1, hh, 1)
      m.position.y = BEAKER_FLOOR + hh / 2
    }
    const b = bed ? bed(pv) : 0
    if (bedM.current) {
      bedM.current.visible = b > 0.0003
      bedM.current.scale.set(1, Math.max(1e-4, b), 1)
      bedM.current.position.y = BEAKER_FLOOR + b / 2
    }
    const im = parts.current
    if (im) {
      im.visible = c > 0.02 && v > 1
      if (im.visible) {
        for (let i = 0; i < n; i++) {
          const sd = seeds[i]!
          const on = sd.y < c
          const rr = size.ri * 0.9 * sd.r
          const y = BEAKER_FLOOR + 0.002 + sd.y * Math.max(0.002, lv - BEAKER_FLOOR - 0.004)
          tmp.position.set(Math.cos(sd.a + t * 0.15) * rr, y + Math.sin(t * 0.8 + i) * 0.0008, Math.sin(sd.a + t * 0.15) * rr)
          tmp.scale.setScalar(on ? 0.0008 * sd.s : 1e-6)
          tmp.updateMatrix()
          im.setMatrixAt(i, tmp.matrix)
        }
        im.instanceMatrix.needsUpdate = true
      }
    }
  })
  return (
    <group>
      <mesh geometry={geo} material={sharedGlass(quality)} renderOrder={3} />
      <mesh geometry={geo} material={sharedGlassEdge()} renderOrder={4} />
      <ScaleBand spec={spec} r={ro + 0.0004} y0={BEAKER_FLOOR} scaleH={scaleH} arc={1.1} />
      <mesh ref={col} material={liq} renderOrder={2}>
        <cylinderGeometry args={[size.ri - 0.0004, size.ri - 0.0004, 1, 32]} />
      </mesh>
      <mesh ref={bedM} material={solid} renderOrder={2}>
        <cylinderGeometry args={[size.ri - 0.0006, size.ri - 0.0006, 1, 32]} />
      </mesh>
      <instancedMesh ref={parts} args={[undefined, undefined, n]} material={solid} renderOrder={2} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
      </instancedMesh>
    </group>
  )
}

/* ── Пузырьки в сосуде произвольного радиуса ── */

export function RisingBubbles({ r, fromY, toY, rate, x = 0, z = 0, n = 40 }: { r: number; fromY: PFn; toY: PFn; rate: PFn; x?: number; z?: number; n?: number }) {
  const { quality, p, time } = useRig()
  const count = quality === 'high' ? n : Math.max(10, Math.round(n * 0.4))
  const ref = useRef<THREE.InstancedMesh>(null)
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({ a: rand(i, 6) * Math.PI * 2, r: Math.sqrt(rand(i, 7)), s: 0.6 + rand(i, 8) * 0.7, ph: rand(i, 9), size: 0.4 + Math.pow(rand(i, 10), 2) * 1.4 })), [count])
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const pv = p.current ?? 0
    const t = time.current ?? 0
    const k = rate(pv)
    const y0 = fromY(pv)
    const y1 = toY(pv)
    m.visible = k > 0.01 && y1 > y0 + 0.003
    if (!m.visible) return
    for (let i = 0; i < count; i++) {
      const sd = seeds[i]!
      const f = (t * 0.55 * sd.s + sd.ph) % 1
      const y = y0 + (0.3 * f * f + 0.7 * f) * (y1 - y0)
      const rr = r * sd.r * (1 - 0.25 * f)
      tmp.position.set(x + Math.cos(sd.a) * rr + Math.sin(t * 8 + i) * 0.0005, Math.min(y, y1 - 0.0008), z + Math.sin(sd.a) * rr)
      tmp.scale.setScalar(sd.ph < k ? (0.0009 + 0.0011 * sd.size) * (0.6 + 0.5 * f) : 1e-6)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} renderOrder={2} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshPhysicalMaterial color="#ffffff" transparent opacity={0.75} roughness={0.05} clearcoat={1} depthWrite={false} />
    </instancedMesh>
  )
}

/* ── Сбор газа над водой ── */

export const TROUGH = { r: 0.105, h: 0.075, water: 0.058 } as const
/** Устье перевёрнутого цилиндра — на столько выше дна ванны (под водой). */
export const GAS_MOUTH_Y = 0.016

/**
 * Пневматическая ванна (кристаллизатор с водой) и перевёрнутый мерный цилиндр в лапке штатива.
 * Начало — центр дна ванны. gasMl(p) — объём газа в цилиндре (мл), lift(p) — подъём цилиндра (м, при выравнивании
 * уровней), bubble(p) — интенсивность пузырьков у устья. Шкала: «0» у дна цилиндра (вверху), цифры растут вниз.
 */
export function GasCollector({ capacity, gasMl, lift, bubble, filled }: { capacity: 250 | 500; gasMl: PFn; lift?: PFn; bubble: PFn; filled?: PFn }) {
  const { quality, p } = useRig()
  const g = cylinderGeom(capacity)
  const ro = g.ri + 0.0013
  const len = g.scaleH + 0.045
  const innerTop = len - 0.004
  const troughGeo = useMemo(() => {
    const r = TROUGH.r
    const pts = [
      new THREE.Vector2(0.0001, 0),
      new THREE.Vector2(r - 0.004, 0),
      new THREE.Vector2(r, 0.004),
      new THREE.Vector2(r, TROUGH.h - 0.002),
      new THREE.Vector2(r + 0.003, TROUGH.h),
      new THREE.Vector2(r - 0.002, TROUGH.h),
      new THREE.Vector2(r - 0.002, 0.004),
      new THREE.Vector2(0.0001, 0.004),
    ]
    return new THREE.LatheGeometry(pts, quality === 'high' ? 48 : 24)
  }, [quality])
  const cylGeo = useMemo(() => {
    // открытый снизу, запаянный сверху (бывшее дно)
    const pts = [
      new THREE.Vector2(g.ri, 0),
      new THREE.Vector2(ro, 0),
      new THREE.Vector2(ro, len),
      new THREE.Vector2(0.0001, len),
      new THREE.Vector2(0.0001, innerTop),
      new THREE.Vector2(g.ri, innerTop),
      new THREE.Vector2(g.ri, 0),
    ]
    return new THREE.LatheGeometry(pts, quality === 'high' ? 36 : 20)
  }, [quality, g.ri, ro, len, innerTop])
  const spec = useMemo(() => cylinderSpec(capacity, true), [capacity])
  const water = useMemo(() => labLiquidMaterial('#cfe7fb', 0.5), [])
  const tubeWater = useMemo(() => labLiquidMaterial('#cfe7fb', 0.5), [])
  const clampMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4f5b68', roughness: 0.55, metalness: 0.2 }), [])
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b9c2cc', roughness: 0.28, metalness: 0.85 }), [])
  const cyl = useRef<THREE.Group>(null)
  const col = useRef<THREE.Mesh>(null)
  const surf = useRef<THREE.Mesh>(null)
  // вода в цилиндре: от устья до уровня (сверху — газ)
  const waterTopLocal = (pv: number) => {
    const fill = filled ? filled(pv) : 1
    const gasH = (Math.max(0, gasMl(pv)) / capacity) * g.scaleH
    return fill < 0.5 ? 0 : Math.max(0, innerTop - gasH)
  }
  useFrame(() => {
    const pv = p.current ?? 0
    const dy = lift ? lift(pv) : 0
    if (cyl.current) cyl.current.position.y = GAS_MOUTH_Y + dy
    const top = waterTopLocal(pv)
    const m = col.current
    if (m) {
      m.visible = top > 0.002
      m.scale.set(1, Math.max(1e-4, top), 1)
      m.position.y = top / 2
    }
    if (surf.current) {
      surf.current.visible = top > 0.002 && top < innerTop - 0.0005
      surf.current.position.y = top
    }
  })
  const rodX = TROUGH.r + 0.035
  const clampY = GAS_MOUTH_Y + len * 0.72
  return (
    <group>
      <mesh geometry={troughGeo} material={sharedGlass(quality)} renderOrder={3} />
      <mesh geometry={troughGeo} material={sharedGlassEdge()} renderOrder={4} />
      {/* вода в ванне */}
      <mesh position={[0, 0.004 + (TROUGH.water - 0.004) / 2, 0]} material={water} renderOrder={1}>
        <cylinderGeometry args={[TROUGH.r - 0.0025, TROUGH.r - 0.0025, TROUGH.water - 0.004, 40]} />
      </mesh>
      {/* штатив с лапкой держит цилиндр */}
      <mesh position={[rodX + 0.03, 0.007, 0]} material={clampMat} castShadow receiveShadow>
        <boxGeometry args={[0.12, 0.014, 0.1]} />
      </mesh>
      <mesh position={[rodX, 0.014 + 0.2, 0]} material={steel} castShadow>
        <cylinderGeometry args={[0.0055, 0.0055, 0.4, 14]} />
      </mesh>
      {/* стержень лапки доходит до кольца-хомута (r = ro + 0,002 … + 0,0048), а не до стекла */}
      <mesh position={[rodX - (rodX - ro - 0.0045) / 2, clampY, 0]} rotation={[0, 0, Math.PI / 2]} material={steel}>
        <cylinderGeometry args={[0.0028, 0.0028, rodX - ro - 0.0045, 8]} />
      </mesh>
      <group ref={cyl} position={[0, GAS_MOUTH_Y, 0]}>
        <mesh geometry={cylGeo} material={sharedGlass(quality)} renderOrder={3} />
        <mesh geometry={cylGeo} material={sharedGlassEdge()} renderOrder={4} />
        <ScaleBand spec={spec} r={ro + 0.0004} y0={innerTop - g.scaleH} scaleH={g.scaleH} />
        <mesh ref={col} material={tubeWater} renderOrder={2}>
          <cylinderGeometry args={[g.ri - 0.0003, g.ri - 0.0003, 1, 28]} />
        </mesh>
        {/* мениск газ/вода */}
        <mesh ref={surf} rotation={[Math.PI / 2, 0, 0]} material={tubeWater} renderOrder={2}>
          <torusGeometry args={[g.ri - 0.0012, 0.0011, 6, 28]} />
        </mesh>
        {/* лапка: кольцо-хомут вокруг цилиндра (в группе — двигается вместе с ним при выравнивании) */}
        <mesh position={[0, clampY - GAS_MOUTH_Y, 0]} rotation={[Math.PI / 2, 0, 0]} material={clampMat}>
          <torusGeometry args={[ro + 0.002, 0.0028, 8, 28]} />
        </mesh>
        <RisingBubbles r={g.ri * 0.55} fromY={() => 0.004} toY={(pv) => Math.max(0.006, waterTopLocal(pv))} rate={bubble} n={36} />
      </group>
    </group>
  )
}

/* ── Термометр ── */

export const THERMO = { len: 0.26, r: 0.0036, bulbR: 0.0045, yMin: 0.035, span: 0.2 } as const

/** Высота столбика (от низа шарика) для температуры t °C. */
export function thermoY(tC: number): number {
  return THERMO.yMin + ((Math.max(-10, Math.min(110, tC)) + 10) / 120) * THERMO.span
}

/**
 * Спиртовой термометр (начало — низ шарика, ось вверх): красный столбик в капилляре, шкала −10…110 °C на белой
 * пластинке. temp(p) — истинная температура; столбик догоняет её с инерцией (~1,5 с), как настоящий.
 */
export function Thermometer({ temp }: { temp: PFn }) {
  const { quality, p } = useRig()
  const red = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d0262f', roughness: 0.35, emissive: '#5a0a0e', emissiveIntensity: 0.2 }), [])
  const tex = useMemo(thermometerScaleTexture, [])
  const col = useRef<THREE.Mesh>(null)
  const shown = useRef<number | null>(null)
  const scaleH = THERMO.span / (1 - 2 * SCALE_TEX_PAD)
  useFrame((_, dt) => {
    const target = temp(p.current ?? 0)
    if (shown.current == null) shown.current = target
    shown.current += (target - shown.current) * (1 - Math.exp(-Math.min(0.05, dt) * 1.6))
    const top = thermoY(shown.current)
    const m = col.current
    if (m) {
      const h = Math.max(0.001, top - THERMO.bulbR)
      m.scale.set(1, h, 1)
      m.position.y = THERMO.bulbR + h / 2
    }
  })
  return (
    <group>
      <mesh position={[0, THERMO.len / 2, 0]} material={sharedGlass(quality)} renderOrder={3}>
        <cylinderGeometry args={[THERMO.r, THERMO.r, THERMO.len, 14]} />
      </mesh>
      <mesh position={[0, THERMO.len / 2, 0]} material={sharedGlassEdge()} renderOrder={4}>
        <cylinderGeometry args={[THERMO.r, THERMO.r, THERMO.len, 14]} />
      </mesh>
      <mesh position={[0, THERMO.bulbR, 0]} material={red}>
        <sphereGeometry args={[THERMO.bulbR, 14, 10]} />
      </mesh>
      <mesh ref={col} material={red}>
        <cylinderGeometry args={[0.0009, 0.0009, 1, 8]} />
      </mesh>
      {/* шкала на молочной пластинке за капилляром */}
      <mesh position={[0, THERMO.yMin + THERMO.span / 2, -0.0012]} renderOrder={2}>
        <planeGeometry args={[0.0058, scaleH]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Точка у вершины столбика (для плашки показания). */
export const thermoReadoutAt = (tC: number): V3 => [0.012, thermoY(tC), 0]
