/**
 * Мерная посуда с настоящими шкалами (цифры читаются на крупном плане), стакан с содержимым (раствор, муть,
 * осадок), сбор газа над водой в перевёрнутый цилиндр и спиртовой термометр.
 * Объёмы — в мл: высота уровня считается из геометрии сосуда (measure/quantities.ts), а не подбирается на глаз.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { labLiquidMaterial } from '../../labContract'
import { useRig, type PFn, type V3 } from '../../experiments/rigCore'
import { sharedGlass, sharedGlassEdge } from '../../experiments/parts/glassware'
import { cylinderGeom } from '../quantities'
import { SCALE_TEX_PAD, scaleTexture, type ScaleSpec } from './deviceTextures'

function rand(i: number, k: number): number {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return x - Math.floor(x)
}
const tmp = new THREE.Object3D()

/* ── Жидкость, поверхность которой остаётся горизонтальной при наклоне сосуда ── */

const _wq = new THREE.Quaternion()
const _up = new THREE.Vector3()

/** Направление «вверх» мира в координатах объекта (единичный вектор). */
export function localUp(obj: THREE.Object3D, out: THREE.Vector3 = _up): THREE.Vector3 {
  obj.getWorldQuaternion(_wq)
  return out.set(0, 1, 0).applyQuaternion(_wq.invert())
}

/** Отсчёты по хорде для подбора уровня при наклоне (объём — интеграл по ширине хорды). */
const TILT_SAMPLES = 32

/**
 * Столбик жидкости в цилиндрическом сосуде (ось — Y объекта): стенка, дно и поверхность. Поверхность — плоскость,
 * горизонтальная в мире; её высота на оси подбирается так, что объём жидкости при наклоне тот же, что у прямого
 * столбика высотой level − floor: у почти пустого сосуда при сильном наклоне остаётся лужица у нижней стенки (а не
 * полсосуда). Выше края rim жидкость не поднимается — что не помещается, «вылилось» через носик; дно не протекает.
 */
export class TiltLiquid {
  readonly geometry = new THREE.BufferGeometry()
  private readonly n: number
  private readonly sx: Float32Array
  private readonly cz: Float32Array
  private readonly pos: THREE.BufferAttribute
  private readonly nor: THREE.BufferAttribute
  /** cos угла наклона оси сосуда к вертикали после последнего update (1 — стоит прямо). */
  tiltCos = 1
  /** Плоскость поверхности после update: y = axisLevel − slope·(x·dirX + z·dirZ). */
  private axisLevel = 0
  private slope = 0
  private dirX = 0
  private dirZ = 0
  constructor(segs: number) {
    const n = segs
    this.n = n
    this.sx = new Float32Array(n + 1)
    this.cz = new Float32Array(n + 1)
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2
      this.sx[i] = Math.sin(a)
      this.cz[i] = Math.cos(a)
    }
    const count = 4 * n + 6
    this.pos = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
    this.nor = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
    this.pos.setUsage(THREE.DynamicDrawUsage)
    this.nor.setUsage(THREE.DynamicDrawUsage)
    const idx: number[] = []
    const T0 = 2 * (n + 1)
    const B0 = T0 + n + 2
    for (let i = 0; i < n; i++) {
      // стенка: 2i — низ, 2i + 1 — верх (обход как у CylinderGeometry — лицом наружу)
      idx.push(2 * i + 1, 2 * i, 2 * i + 3, 2 * i, 2 * i + 2, 2 * i + 3)
      idx.push(T0 + 1 + i, T0 + 2 + i, T0)
      idx.push(B0 + 2 + i, B0 + 1 + i, B0)
    }
    for (let i = 0; i <= n; i++) {
      this.nor.setXYZ(2 * i, this.sx[i]!, 0, this.cz[i]!)
      this.nor.setXYZ(2 * i + 1, this.sx[i]!, 0, this.cz[i]!)
      this.nor.setXYZ(B0 + 1 + i, 0, -1, 0)
    }
    this.nor.setXYZ(B0, 0, -1, 0)
    this.geometry.setAttribute('position', this.pos)
    this.geometry.setAttribute('normal', this.nor)
    this.geometry.setIndex(idx)
  }
  /** Объём (в долях πr²·высота) под плоскостью с высотой c на оси: среднее по хорде, вес — ширина хорды. */
  private static volumeAt(c: number, s: number, floor: number, rim: number): number {
    let v = 0
    let w = 0
    for (let k = 0; k < TILT_SAMPLES; k++) {
      const t = -1 + (2 * k + 1) / TILT_SAMPLES
      const cw = Math.sqrt(1 - t * t)
      v += cw * (Math.min(rim, Math.max(floor, c - s * t)) - floor)
      w += cw
    }
    return v / w
  }
  /** Пересчитать по текущему наклону объекта obj (меш жидкости или его родитель с той же осью). */
  update(obj: THREE.Object3D, r: number, floor: number, rim: number, level: number) {
    const up = localUp(obj)
    this.tiltCos = up.y
    // за горизонталью (сосуд опрокинут) — как почти горизонтальный: жидкость тонким клином вдоль нижней стенки
    const uy = Math.max(0.1, up.y)
    const uh = Math.hypot(up.x, up.z)
    const dx = uh > 1e-6 ? up.x / uh : 1
    const dz = uh > 1e-6 ? up.z / uh : 0
    // перепад высоты поверхности от оси до стенки
    const s = (uh / uy) * r
    const h = Math.min(rim, Math.max(floor, level)) - floor
    // уровень на оси: не выше, чем позволяет носик (нижняя точка края), объём — как у прямого столбика
    const cMax = rim - s
    let c = floor + h
    if (s > 1e-6) {
      const target = h
      let lo = floor - s
      let hi = Math.max(lo, cMax)
      if (TiltLiquid.volumeAt(hi, s, floor, rim) <= target) c = hi
      else {
        for (let it = 0; it < 22; it++) {
          const mid = (lo + hi) / 2
          if (TiltLiquid.volumeAt(mid, s, floor, rim) < target) lo = mid
          else hi = mid
        }
        c = (lo + hi) / 2
      }
    } else c = Math.min(c, rim)
    this.axisLevel = c
    this.slope = s / r
    this.dirX = dx
    this.dirZ = dz
    // точка внутри зеркала: на оси, а если плоскость у «верхней» стенки уходит под дно — посередине мокрой части
    const tF = s > 1e-6 ? (c - floor) / s : 1
    const t0 = tF >= 1 ? 0 : ((Math.max(-1, tF) - 1) / 2) * r
    const px = dx * t0
    const pz = dz * t0
    const py = Math.max(floor, c - (s / r) * t0)
    const nl = Math.hypot(up.x, uy, up.z)
    const nx = up.x / nl
    const ny = uy / nl
    const nz = up.z / nl
    const n = this.n
    const T0 = 2 * (n + 1)
    const B0 = T0 + n + 2
    for (let i = 0; i <= n; i++) {
      const x = r * this.sx[i]!
      const z = r * this.cz[i]!
      const ys = c - (s / r) * (x * dx + z * dz)
      const y = Math.min(rim, Math.max(floor, ys))
      this.pos.setXYZ(2 * i, x, floor, z)
      this.pos.setXYZ(2 * i + 1, x, y, z)
      // зеркало и дно — по мокрой части: где плоскость ушла под дно, край зеркала — линия касания дна
      let qx = x
      let qz = z
      let qy = y
      if (ys < floor && py > floor) {
        const l = (py - floor) / (py - ys)
        qx = px + (x - px) * l
        qz = pz + (z - pz) * l
        qy = floor
      }
      this.pos.setXYZ(T0 + 1 + i, qx, qy, qz)
      this.nor.setXYZ(T0 + 1 + i, nx, ny, nz)
      this.pos.setXYZ(B0 + 1 + i, qx, floor, qz)
    }
    this.pos.setXYZ(T0, px, py, pz)
    this.nor.setXYZ(T0, nx, ny, nz)
    this.pos.setXYZ(B0, px, floor, pz)
    this.pos.needsUpdate = true
    this.nor.needsUpdate = true
    this.geometry.computeBoundingSphere()
  }
  /** Высота поверхности над точкой (x, z) сосуда при последнем update (для частиц мути). */
  surfaceAt(x: number, z: number): number {
    return this.axisLevel - this.slope * (x * this.dirX + z * this.dirZ)
  }
  dispose() {
    this.geometry.dispose()
  }
}

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
  const tilt = useMemo(() => new TiltLiquid(28), [])
  useEffect(() => () => tilt.dispose(), [tilt])
  useFrame(() => {
    const v = Math.max(0, volume(p.current ?? 0))
    const h = (v / capacity) * g.scaleH
    const m = col.current
    if (m) {
      m.visible = h > 0.0005
      // поверхность горизонтальна и при наклоне (переливание): у носика жидкость не выше края
      if (m.visible) tilt.update(m, g.ri - 0.0003, CYL_BOTTOM, top - 0.0008, CYL_BOTTOM + h)
    }
    if (men.current) {
      men.current.visible = h > 0.002 && tilt.tiltCos > 0.9995
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
      <mesh ref={col} geometry={tilt.geometry} material={liq} renderOrder={2} frustumCulled={false} />
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
  const tilt = useMemo(() => new TiltLiquid(32), [])
  useEffect(() => () => tilt.dispose(), [tilt])
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
      // при наклоне (переливание через носик) поверхность остаётся горизонтальной, у носика — вровень с краем
      if (m.visible) tilt.update(m, size.ri - 0.0004, BEAKER_FLOOR, size.h - 0.0006, lv)
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
          const px = Math.cos(sd.a + t * 0.15) * rr
          const pz = Math.sin(sd.a + t * 0.15) * rr
          // муть — только под поверхностью (при наклоне она ниже на «верхней» стороне, а там, где дно обсохло, её нет)
          const top = Math.min(size.h - 0.002, tilt.surfaceAt(px, pz))
          const y = BEAKER_FLOOR + 0.002 + sd.y * Math.max(0.002, lv - BEAKER_FLOOR - 0.004)
          tmp.position.set(px, Math.min(y + Math.sin(t * 0.8 + i) * 0.0008, top - 0.0015), pz)
          tmp.scale.setScalar(on && top > BEAKER_FLOOR + 0.003 ? 0.0008 * sd.s : 1e-6)
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
      <mesh ref={col} geometry={tilt.geometry} material={liq} renderOrder={2} frustumCulled={false} />
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
  // вода в цилиндре чуть насыщеннее воды в ванне — граница газ/вода (мениск) читается на крупном плане
  const tubeWater = useMemo(() => labLiquidMaterial('#9fcbf0', 0.66), [])
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
          <torusGeometry args={[g.ri - 0.0014, 0.0016, 6, 28]} />
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

/** Трубка-оболочка Ø 8,4 мм (термометр со вложенной шкалой): внутри — молочная пластинка шириной ~7 мм. */
export const THERMO = { len: 0.26, r: 0.0042, bulbR: 0.0045, yMin: 0.035, span: 0.2 } as const

/** Высота столбика (от низа шарика) для температуры t °C. */
export function thermoY(tC: number): number {
  return THERMO.yMin + ((Math.max(-10, Math.min(110, tC)) + 10) / 120) * THERMO.span
}

/* Шкала термометра: пропорции текстуры = пропорциям пластинки (цифры не сплющены). */
const TH_TEX_W = 128
const TH_TEX_H = 3840
const TH_PLATE_H = THERMO.span / (1 - 2 * SCALE_TEX_PAD)
const TH_PLATE_W = (TH_PLATE_H * TH_TEX_W) / TH_TEX_H
/** Капилляр — левее середины пластинки (справа от него риски и цифры), доля ширины. */
const TH_CAP_U = 0.2
const TH_CAP_X = (TH_CAP_U - 0.5) * TH_PLATE_W
const TH_PLATE_Z = -0.0013
/** Резервуар со спиртом: радиус и полувысота (вытянут вверх, уже трубки). */
const BULB_R = THERMO.bulbR * 0.78
const BULB_RY = BULB_R * 1.45

let thScaleTex: THREE.CanvasTexture | null = null
/**
 * Молочная пластинка как у лабораторного термометра: риски через 1 °C, удлинённые через 5 °C, длинные с цифрами
 * через 10 °C, «°C» вверху, пустой капилляр — тонкая серая нить.
 */
function thermoPlateTexture(): THREE.CanvasTexture {
  if (thScaleTex) return thScaleTex
  const W = TH_TEX_W
  const H = TH_TEX_H
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (g) {
    g.fillStyle = '#f8f7f1'
    g.fillRect(0, 0, W, H)
    const pad = SCALE_TEX_PAD * H
    const usable = H - 2 * pad
    const cx = TH_CAP_U * W
    // пустой капилляр (виден в стекле как тонкая нить)
    const cg = g.createLinearGradient(cx - 4, 0, cx + 4, 0)
    cg.addColorStop(0, 'rgba(120,130,140,0)')
    cg.addColorStop(0.5, 'rgba(120,130,140,0.55)')
    cg.addColorStop(1, 'rgba(120,130,140,0)')
    g.fillStyle = cg
    g.fillRect(cx - 4, pad - 30, 8, usable + 60)
    g.strokeStyle = '#14181e'
    g.fillStyle = '#14181e'
    for (let t = -10; t <= 110; t++) {
      const y = H - pad - ((t + 10) / 120) * usable
      const major = t % 10 === 0
      const mid = t % 5 === 0
      g.lineWidth = major ? 4 : mid ? 3 : 2.2
      g.beginPath()
      g.moveTo(cx - (major ? 16 : mid ? 12 : 8), y)
      g.lineTo(cx + (major ? 30 : mid ? 22 : 14), y)
      g.stroke()
      if (major) {
        g.save()
        g.translate(cx + 34, y)
        g.scale(0.8, 1)
        g.font = '700 46px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
        g.textAlign = 'left'
        g.textBaseline = 'middle'
        g.fillText(String(t).replace('-', '−'), 0, 2)
        g.restore()
      }
    }
    g.font = '700 44px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('°C', W * 0.62, pad * 0.5)
  }
  thScaleTex = new THREE.CanvasTexture(c)
  thScaleTex.colorSpace = THREE.SRGBColorSpace
  thScaleTex.anisotropy = 8
  thScaleTex.minFilter = THREE.LinearMipmapLinearFilter
  return thScaleTex
}

/**
 * Спиртовой термометр (начало — низ шарика, ось вверх): красный столбик в капилляре перед молочной пластинкой со
 * шкалой −10…110 °C. temp(p) — истинная температура; столбик догоняет её с инерцией (~1,5 с), как настоящий.
 */
export function Thermometer({ temp }: { temp: PFn }) {
  const { quality, p } = useRig()
  // спирт и шкала рисуются после стекла (прозрачный проход, renderOrder между стеклом и контуром): иначе их видно лишь
  // через буфер преломления стекла — размыто, и риски с цифрами не читаются
  const red = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d81f2c', roughness: 0.3, emissive: '#7a0710', emissiveIntensity: 0.45, transparent: true }), [])
  const tex = useMemo(thermoPlateTexture, [])
  const col = useRef<THREE.Mesh>(null)
  const shown = useRef<number | null>(null)
  const segs = quality === 'high' ? 20 : 14
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
        <cylinderGeometry args={[THERMO.r, THERMO.r, THERMO.len, segs]} />
      </mesh>
      <mesh position={[0, THERMO.len / 2, 0]} material={sharedGlassEdge()} renderOrder={4}>
        <cylinderGeometry args={[THERMO.r, THERMO.r, THERMO.len, segs]} />
      </mesh>
      {/* резервуар: вытянутая капля со спиртом (низ — в начале координат); из неё выходит капилляр */}
      <mesh position={[0, BULB_RY, 0]} scale={[1, BULB_RY / BULB_R, 1]} material={red} renderOrder={3.6}>
        <sphereGeometry args={[BULB_R, 16, 12]} />
      </mesh>
      <mesh ref={col} position={[TH_CAP_X, 0, 0]} material={red} renderOrder={3.6}>
        <cylinderGeometry args={[0.00085, 0.00085, 1, 8]} />
      </mesh>
      {/* шкала на молочной пластинке за капилляром */}
      <mesh position={[0, THERMO.yMin + THERMO.span / 2, TH_PLATE_Z]} renderOrder={3.5}>
        <planeGeometry args={[TH_PLATE_W, TH_PLATE_H]} />
        <meshBasicMaterial map={tex} toneMapped={false} transparent />
      </mesh>
    </group>
  )
}

/** Точка у вершины столбика (для плашки показания). */
export const thermoReadoutAt = (tC: number): V3 => [0.012, thermoY(tC), 0]
