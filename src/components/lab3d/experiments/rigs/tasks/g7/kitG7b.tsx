/**
 * Детали установок задач-опытов Kimyo 7 (агент «7b»: водород «как в аппарате Киппа», гашение извести):
 * путь предмета по точкам и наливание, резиновая пробка для пробирки с газоотводной трубкой, тающие гранулы,
 * высокая банка с водой и перевёрнутым цилиндром 250 мл (уровни можно выровнять — банка глубже ванны),
 * штатив с лапкой для термометра, керамическая плитка, горка извести в чашке, часовое стекло с раствором.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LAB_COLORS, labLiquidMaterial } from '../../../../labContract'
import { ease, mix, mixV, useRig, type PFn, type V3 } from '../../../rigCore'
import { sharedGlass, sharedGlassEdge } from '../../../parts/glassware'
import { GlassPath } from '../../../parts/practicalware'
import { RisingBubbles, THERMO, Thermometer, cylinderSpec } from '../../../../measure/devices/Glass'
import { SCALE_TEX_PAD, faceted, scaleTexture, useOwned } from '../../../../measure/devices/deviceTextures'
import { cylinderGeom } from '../../../../measure/quantities'

function rand(i: number, k: number): number {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Путь по точкам: legs — [начало, конец отрезка прогресса, куда]. */
export function via(p: number, start: V3, legs: readonly (readonly [number, number, V3])[]): V3 {
  let pos: V3 = start
  for (const [a, b, to] of legs) pos = mixV(pos, to, ease(p, a, b))
  return pos
}

/**
 * Сосуд, из которого наливают (начало — центр дна): со стола → поднять → встать сбоку от приёмника → наклон до
 * tiltMax, горлышко (на высоте height над дном) приходит в точку lip → обратно на место. Струя — s + 0.46…0.74.
 */
export function pourPath(rest: V3, s: number, lip: V3, height: number, tiltMax = 1.75, r = 0.03) {
  const side = rest[0] > lip[0] ? 1 : -1
  const over: V3 = [lip[0] + side * (r + 0.012), lip[1] + 0.012, lip[2]]
  const tilted: V3 = [lip[0] + side * Math.sin(tiltMax) * height, lip[1] - Math.cos(tiltMax) * height, lip[2]]
  const lifted: V3 = [rest[0], Math.max(rest[1] + 0.09, over[1] + 0.02), rest[2]]
  return (p: number) => {
    const k = ease(p, s + 0.34, s + 0.48) * (1 - ease(p, s + 0.74, s + 0.84))
    let pos = via(p, rest, [
      [s, s + 0.14, lifted],
      [s + 0.12, s + 0.34, over],
    ])
    if (k > 0) pos = mixV(over, tilted, k)
    pos = via(p, pos, [
      [s + 0.84, s + 0.92, lifted],
      [s + 0.9, s + 0.98, rest],
    ])
    return { pos, rot: [0, 0, side * k * tiltMax] as V3 }
  }
}

/* ── Пробка для пробирки с газоотводной трубкой ── */

/** Конец колена газоотводной трубки (сюда надет шланг), в координатах пробки. */
export const TUBE_ELBOW: V3 = [0.03, 0.045, 0]
/** На сколько пробка входит в пробирку. */
export const TUBE_STOPPER_IN = 0.011

/** Резиновая пробка Ø 16/21 мм (начало — низ пробки) со стеклянной трубкой, колено — вправо (+X). */
export function TubeStopper() {
  const rubber = useOwned(() => new THREE.MeshStandardMaterial({ color: '#5f6670', roughness: 0.85 }), [])
  return (
    <group>
      <mesh position={[0, 0.009, 0]} material={rubber} castShadow>
        <cylinderGeometry args={[0.0104, 0.0079, 0.018, 20]} />
      </mesh>
      <GlassPath points={[[0, 0.002, 0], [0, 0.033, 0], [0.008, 0.044, 0], TUBE_ELBOW]} radius={0.0025} />
    </group>
  )
}

/* ── Гранулы металла, которые растворяются (начало — дно сосуда) ── */

export function MeltingGranules({ n, show, left, color, spread, size = 0.0024, y0 = 0.0024 }: { n: number; show: PFn; left: PFn; color: string; spread: number; size?: number; y0?: number }) {
  const { p } = useRig()
  const ref = useRef<THREE.InstancedMesh>(null)
  // грани: у додекаэдра (detail 0) нормали уже свои у каждой грани — flatShading не нужен (лишняя программа шейдера)
  const mat = useOwned(() => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.75 }), [color])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const seeds = useMemo(() => Array.from({ length: n }, (_, i) => ({ a: rand(i, 3) * Math.PI * 2, r: Math.sqrt(rand(i, 4)) * spread, s: 0.8 + rand(i, 5) * 0.45, rot: rand(i, 6) * 6, h: rand(i, 7) })), [n, spread])
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const pv = p.current ?? 0
    const shown = Math.round(Math.max(0, Math.min(1, show(pv))) * n)
    const k = Math.cbrt(Math.max(0, Math.min(1, left(pv))))
    m.visible = shown > 0 && k > 0.03
    if (!m.visible) return
    for (let i = 0; i < n; i++) {
      const sd = seeds[i]!
      const s = i < shown ? size * sd.s * k : 1e-6
      tmp.position.set(Math.cos(sd.a) * sd.r, y0 + s * 0.8 + sd.h * size * 0.8, Math.sin(sd.a) * sd.r)
      tmp.rotation.set(sd.rot, sd.rot * 1.3, sd.rot * 0.7)
      tmp.scale.setScalar(s)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} material={mat} castShadow frustumCulled={false}>
      <dodecahedronGeometry args={[1, 0]} />
    </instancedMesh>
  )
}

/* ── Высокая банка с водой и перевёрнутым цилиндром 250 мл ── */

/** Банка (начало — центр дна снаружи): радиус, высота, толщина дна, уровень воды, устье цилиндра в начале опыта. */
export const GAS_JAR = { r: 0.056, h: 0.19, floor: 0.004, wall: 0.0022, water: 0.17, mouth0: 0.145 } as const
const G250 = cylinderGeom(250)
/** Перевёрнутый цилиндр 250 мл: внутренний радиус, длина, «0» шкалы у запаянного верха (innerTop от устья). */
export const GJ_CYL = { ri: G250.ri, ro: G250.ri + 0.0013, len: G250.scaleH + 0.045, innerTop: G250.scaleH + 0.041, scaleH: G250.scaleH } as const
/** Стержень штатива цилиндра (x от центра банки). */
export const GJ_ROD_X = GAS_JAR.r + 0.032
/** Лапка — на этой высоте над устьем цилиндра. */
export const GJ_CLAMP = GJ_CYL.len * 0.72

/** Уровень воды в цилиндре над дном банки, когда устье на высоте mouth, а газа gasMl. */
export function innerWaterY(mouth: number, gasMl: number): number {
  return mouth + GJ_CYL.innerTop - (Math.max(0, gasMl) / 250) * GJ_CYL.scaleH
}
/** Высота устья, при которой вода в цилиндре стоит вровень с водой в банке. */
export function mouthAtLevel(gasMl: number): number {
  return GAS_JAR.water - (GJ_CYL.innerTop - (gasMl / 250) * GJ_CYL.scaleH)
}

/** Шкала на передней дуге цилиндра (как у мерной посуды в measure/devices/Glass.tsx). */
function CylScale({ r, y0, scaleH }: { r: number; y0: number; scaleH: number }) {
  const tex = useMemo(() => scaleTexture(cylinderSpec(250, true)), [])
  const h = scaleH / (1 - 2 * SCALE_TEX_PAD)
  return (
    <mesh position={[0, y0 + scaleH / 2, 0]} renderOrder={5}>
      <cylinderGeometry args={[r, r, h, 24, 1, true, -0.8, 1.6]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} side={THREE.FrontSide} toneMapped={false} />
    </mesh>
  )
}

/**
 * Высокая стеклянная банка с водой; в ней перевёрнутый цилиндр 250 мл в лапке штатива (стержень справа, +X).
 * gasMl(p) — газ в цилиндре (мл), mouth(p) — высота устья над дном банки (лапку сдвигают по стержню вместе с
 * цилиндром), bubble(p) — пузырьки, поднимающиеся в цилиндре.
 */
export function TallGasJar({ gasMl, mouth, bubble }: { gasMl: PFn; mouth: PFn; bubble: PFn }) {
  const { quality, p } = useRig()
  const { r, h, floor, wall, water } = GAS_JAR
  const { ri, ro, len, innerTop, scaleH } = GJ_CYL
  const seg = quality === 'high' ? 48 : 24
  const jarGeo = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.0001, 0),
      new THREE.Vector2(r - 0.004, 0),
      new THREE.Vector2(r, 0.004),
      new THREE.Vector2(r, h - 0.002),
      new THREE.Vector2(r + 0.0022, h),
      new THREE.Vector2(r - wall, h),
      new THREE.Vector2(r - wall, floor),
      new THREE.Vector2(0.0001, floor),
    ]
    return new THREE.LatheGeometry(pts, seg)
  }, [r, h, floor, wall, seg])
  const cylGeo = useMemo(() => {
    const pts = [
      new THREE.Vector2(ri, 0),
      new THREE.Vector2(ro, 0),
      new THREE.Vector2(ro, len),
      new THREE.Vector2(0.0001, len),
      new THREE.Vector2(0.0001, innerTop),
      new THREE.Vector2(ri, innerTop),
      new THREE.Vector2(ri, 0),
    ]
    return new THREE.LatheGeometry(pts, quality === 'high' ? 36 : 20)
  }, [quality, ri, ro, len, innerTop])
  const jarWater = useOwned(() => labLiquidMaterial('#b9d8f2', 0.55), [])
  const tubeWater = useOwned(() => labLiquidMaterial('#cfe7fb', 0.5), [])
  const paint = useOwned(() => new THREE.MeshStandardMaterial({ color: '#4f5b68', roughness: 0.55, metalness: 0.2 }), [])
  const steel = useOwned(() => new THREE.MeshStandardMaterial({ color: LAB_COLORS.metal, roughness: 0.28, metalness: 0.85 }), [])
  const cyl = useRef<THREE.Group>(null)
  const col = useRef<THREE.Mesh>(null)
  const surf = useRef<THREE.Mesh>(null)
  const topLocal = (pv: number) => Math.max(0, innerTop - (Math.max(0, gasMl(pv)) / 250) * scaleH)
  useFrame(() => {
    const pv = p.current ?? 0
    if (cyl.current) cyl.current.position.y = mouth(pv)
    const top = topLocal(pv)
    if (col.current) {
      col.current.visible = top > 0.002
      col.current.scale.set(1, Math.max(1e-4, top), 1)
      col.current.position.y = top / 2
    }
    if (surf.current) {
      surf.current.visible = top > 0.002 && top < innerTop - 0.0005
      surf.current.position.y = top
    }
  })
  const armLen = GJ_ROD_X - ro - 0.0045
  return (
    <group>
      <mesh geometry={jarGeo} material={sharedGlass(quality)} renderOrder={3} />
      <mesh geometry={jarGeo} material={sharedGlassEdge()} renderOrder={4} />
      <mesh position={[0, floor + (water - floor) / 2, 0]} material={jarWater} renderOrder={1}>
        <cylinderGeometry args={[r - wall - 0.0004, r - wall - 0.0004, water - floor, 40]} />
      </mesh>
      {/* штатив: плита в стороне от банки, стержень */}
      <mesh position={[GJ_ROD_X + 0.045, 0.007, 0]} material={paint} castShadow receiveShadow>
        <boxGeometry args={[0.12, 0.014, 0.1]} />
      </mesh>
      <mesh position={[GJ_ROD_X, 0.014 + 0.21, 0]} material={steel} castShadow>
        <cylinderGeometry args={[0.0055, 0.0055, 0.42, 14]} />
      </mesh>
      <group ref={cyl} position={[0, GAS_JAR.mouth0, 0]}>
        <mesh geometry={cylGeo} material={sharedGlass(quality)} renderOrder={3} />
        <mesh geometry={cylGeo} material={sharedGlassEdge()} renderOrder={4} />
        <CylScale r={ro + 0.0004} y0={innerTop - scaleH} scaleH={scaleH} />
        <mesh ref={col} material={tubeWater} renderOrder={2}>
          <cylinderGeometry args={[ri - 0.0003, ri - 0.0003, 1, 28]} />
        </mesh>
        <mesh ref={surf} rotation={[Math.PI / 2, 0, 0]} material={tubeWater} renderOrder={2}>
          <torusGeometry args={[ri - 0.0012, 0.0011, 6, 28]} />
        </mesh>
        {/* лапка: хомут вокруг цилиндра, стержень лапки, муфта на штативе — ездят по стержню вместе с цилиндром */}
        <mesh position={[0, GJ_CLAMP, 0]} rotation={[Math.PI / 2, 0, 0]} material={paint}>
          <torusGeometry args={[ro + 0.002, 0.0028, 8, 28]} />
        </mesh>
        <mesh position={[ro + 0.0045 + armLen / 2, GJ_CLAMP, 0]} rotation={[0, 0, Math.PI / 2]} material={steel}>
          <cylinderGeometry args={[0.0028, 0.0028, armLen, 8]} />
        </mesh>
        <mesh position={[GJ_ROD_X, GJ_CLAMP, 0]} material={paint} castShadow>
          <boxGeometry args={[0.022, 0.026, 0.022]} />
        </mesh>
        <mesh position={[GJ_ROD_X, GJ_CLAMP, 0.016]} rotation={[Math.PI / 2, 0, 0]} material={steel}>
          <cylinderGeometry args={[0.0025, 0.0025, 0.016, 8]} />
        </mesh>
        <RisingBubbles r={ri * 0.55} fromY={() => 0.004} toY={(pv) => Math.max(0.006, topLocal(pv))} rate={bubble} n={36} />
      </group>
    </group>
  )
}

/* ── Штатив с лапкой для термометра ── */

/**
 * Термометр в лапке штатива (начало — ось термометра на столе): стержень на rodDx (слева), лапку двигают по
 * стержню — низ шарика на высоте bulbY(p). temp(p) — температура у шарика.
 */
export function ThermoStand({ rodDx, bulbY, temp, clampAt = 0.2 }: { rodDx: number; bulbY: PFn; temp: PFn; clampAt?: number }) {
  const { p } = useRig()
  const paint = useOwned(() => new THREE.MeshStandardMaterial({ color: '#4f5b68', roughness: 0.55, metalness: 0.2 }), [])
  const steel = useOwned(() => new THREE.MeshStandardMaterial({ color: LAB_COLORS.metal, roughness: 0.28, metalness: 0.85 }), [])
  const cork = useOwned(() => new THREE.MeshStandardMaterial({ color: '#c49a6c', roughness: 0.9 }), [])
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    if (g.current) g.current.position.y = bulbY(p.current ?? 0)
  })
  const armLen = -rodDx - 0.012
  return (
    <group>
      <mesh position={[rodDx - 0.025, 0.007, 0]} material={paint} castShadow receiveShadow>
        <boxGeometry args={[0.1, 0.014, 0.11]} />
      </mesh>
      <mesh position={[rodDx, 0.014 + 0.19, 0]} material={steel} castShadow>
        <cylinderGeometry args={[0.0055, 0.0055, 0.38, 14]} />
      </mesh>
      <group ref={g}>
        <Thermometer temp={temp} />
        <mesh position={[rodDx, clampAt, 0]} material={paint} castShadow>
          <boxGeometry args={[0.022, 0.026, 0.022]} />
        </mesh>
        <mesh position={[rodDx + armLen / 2, clampAt, 0]} rotation={[0, 0, Math.PI / 2]} material={steel}>
          <cylinderGeometry args={[0.0032, 0.0032, armLen, 10]} />
        </mesh>
        {/* губки лапки обхватывают трубку термометра */}
        {[-1, 1].map((s) => (
          <group key={s} position={[0, clampAt, s * (THERMO.r + 0.0032)]}>
            <mesh material={paint}>
              <boxGeometry args={[0.018, 0.014, 0.0034]} />
            </mesh>
            <mesh position={[0, 0, -s * 0.0021]} material={cork}>
              <boxGeometry args={[0.013, 0.012, 0.0012]} />
            </mesh>
          </group>
        ))}
        <mesh position={[-0.012, clampAt, 0]} material={paint}>
          <boxGeometry args={[0.006, 0.014, 2 * (THERMO.r + 0.005)]} />
        </mesh>
      </group>
    </group>
  )
}

/* ── Керамическая плитка (подставка под горячее) ── */

export const TILE = { w: 0.15, h: 0.008 } as const
export function HeatTile() {
  const mat = useOwned(() => new THREE.MeshStandardMaterial({ color: '#e7e1d6', roughness: 0.7 }), [])
  return (
    <mesh position={[0, TILE.h / 2, 0]} material={mat} castShadow receiveShadow>
      <boxGeometry args={[TILE.w, TILE.h, TILE.w]} />
    </mesh>
  )
}

/* ── Горка извести в фарфоровой чашке ── */

/**
 * Горка порошка в чашке (начало — дно чашки): amount(p) 0…1 — сколько насыпано; swell(p) 0…1 — порошок
 * рассыпается и разбухает (CaO → рыхлая Ca(OH)₂, объём ×2,5); wet(p) 0…1 — мокрая кашица (темнее, блестит).
 */
export function LimeHeap({ amount, swell, wet }: { amount: PFn; swell: PFn; wet: PFn }) {
  const { p } = useRig()
  // комковатая горка: низкополигональная полусфера с плоской заливкой граней
  const mat = useOwned(() => new THREE.MeshStandardMaterial({ color: '#d8d3c1', roughness: 1 }), [])
  // грани заданы нормалями геометрии (а не flatShading материала — тот собирал бы отдельную программу шейдера)
  const geo = useOwned(() => faceted(new THREE.SphereGeometry(1, 11, 5, 0, Math.PI * 2, 0, Math.PI / 2)), [])
  const dry = useMemo(() => new THREE.Color('#d8d3c1'), [])
  const slaked = useMemo(() => new THREE.Color('#f8f7f2'), [])
  const paste = useMemo(() => new THREE.Color('#c6cbc6'), [])
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const pv = p.current ?? 0
    const a = Math.max(0, Math.min(1, amount(pv)))
    const s = swell(pv)
    const w = wet(pv)
    const m = ref.current
    if (!m) return
    m.visible = a > 0.01
    const k = Math.cbrt(a) * (1 + 0.36 * s)
    m.scale.set(0.02 * k, 0.0085 * k * (1 - 0.3 * w), 0.02 * k)
    mat.color.copy(dry).lerp(slaked, s).lerp(paste, w * 0.8)
    mat.roughness = mix(1, 0.35, w)
  })
  return (
    <mesh ref={ref} position={[0, 0.0022, 0]} geometry={geo} material={mat} castShadow />
  )
}

/* ── Часовое стекло с каплей раствора ── */

/** Часовое стекло (начало — низ) с лужицей воды, цвет которой color(p) меняется (фенолфталеин → малиновый). */
export function WatchDish({ color, show }: { color: (p: number) => string; show: PFn }) {
  const { quality, p } = useRig()
  const geo = useMemo(() => {
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * 0.62
      pts.push(new THREE.Vector2(Math.max(0.0001, 0.07 * Math.sin(a)), 0.07 * (1 - Math.cos(a))))
    }
    return new THREE.LatheGeometry(pts, quality === 'high' ? 32 : 18)
  }, [quality])
  const liq = useOwned(() => labLiquidMaterial('#eef6ff', 0.7), [])
  const tint = useMemo(() => new THREE.Color(), [])
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const pv = p.current ?? 0
    tint.set(color(pv))
    liq.color.copy(tint)
    if (ref.current) ref.current.visible = show(pv) > 0.01
  })
  return (
    <group>
      <mesh geometry={geo} material={sharedGlass(quality)} renderOrder={3} />
      <mesh geometry={geo} material={sharedGlassEdge()} renderOrder={4} />
      <mesh ref={ref} position={[0, 0.0028, 0]} rotation={[-Math.PI / 2, 0, 0]} material={liq} renderOrder={2}>
        <circleGeometry args={[0.018, 28]} />
      </mesh>
    </group>
  )
}
