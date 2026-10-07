/**
 * Kimyo 7, с. 148, задача 2 — разложение Cu(OH)₂ → CuO + H₂O (на столе в 10 раз меньше: 4,90 г).
 * Шаги: 0 очки · 1 чашка на весы · 2 тара · 3 Cu(OH)₂ шпателем до 4,90 г · 4 чашка на сетку кольца штатива ·
 * 5 спиртовка (голубой → чёрный с краёв, пар) · 6 холодное часовое стекло над чашкой (капли воды) · 7 помешать
 * палочкой (чернеет весь) · 8 погасить колпачком, остывание · 9 щипцами на весы: m(CuO).
 * Весы показывают числа попытки: чашка (m₀), после тары — порции порошка до m(Cu(OH)₂), без чашки — −m₀, в конце — m(CuO).
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Pose, Target, ease, hill, mix, useRig, useSoundAt, type PFn, type V3 } from '../../../rigCore'
import { WatchGlass } from '../../../parts/glassware'
import { DISH_H, Falling, GlassRod, PorcelainDish, PpeTray, Puffs, RingStand } from '../../../parts/practicalware'
import { Droplets } from '../../../parts/effects'
import { useGearStep } from '../../useGearStep'
import { DigitalScales, SCALES } from '../../../../measure/devices/Scales'
import { PowderJar } from '../../../../measure/devices/Bench'
import { CrucibleTongs } from '../../../../measure/devices/Crucible'
import { quantize } from '../../../../measure/quantities'
import { useLabTaskValues } from '../../../../measure/labTaskSession'
import { LampKit, Scoop, WireGauze, carry, hash01, track, type Key } from './kitG7'

const ID = 'task-g7-cuoh2-heat'
/** Сферическая чаша PorcelainDish: радиус сферы и высота от дна. */
const DISH_SPHERE = 0.05
const dishInnerR = (y: number) => Math.sqrt(Math.max(0, DISH_SPHERE * DISH_SPHERE - (DISH_SPHERE - y) * (DISH_SPHERE - y)))
/** Наружный радиус края чаши (там её берут щипцами). */
const RIM_R = dishInnerR(DISH_H) + 0.001
/** Дно чаши (начало PorcelainDish) лежит на 2 мм выше опоры: внешний низ геометрии — y = −0,002. */
const FOOT = 0.002

const PPE: V3 = [0.5, 0, 0.17]
const SC: V3 = [-0.3, 0, -0.04]
const PAN: V3 = [-0.3, SCALES.panY, -0.052]
const ON_PAN: V3 = [PAN[0], PAN[1] + FOOT, PAN[2]]
const DISH_REST: V3 = [-0.1, FOOT, 0.13]
const JAR_P: V3 = [-0.5, 0, -0.06]
const SPAT: V3 = [-0.52, 0, 0.1]
const LAMP: V3 = [0.15, 0, -0.06]
/** Кольцо штатива над спиртовкой: пламя (фитиль 8,1 см, язык ~5 см) касается сетки верхней частью. */
const RING_Y = 0.122
const RING_R = 0.04
const GAUZE_Y = RING_Y + 0.0026
const DISH_HEAT: V3 = [LAMP[0], GAUZE_Y + 0.0018 + FOOT, LAMP[2]]
const MATCHBOX: V3 = [0.33, 0, 0.06]
const TONGS_REST: V3 = [0.06, 0, 0.23]
const ROD_REST: V3 = [-0.02, 0.0028, 0.14]
const WG_REST: V3 = [0.34, -0.0018, 0.18]
const WG_HOLD: V3 = [DISH_HEAT[0], 0.19, DISH_HEAT[2]]

const BLUE = '#58aee0'
const BLACK = '#1d1c1b'

/* ── Время (прогресс p) ── */
const DISH_ON = 1.75
const TARED = 2.35
const SCOOP_AT = [0, 1, 2, 3].map((k) => 3.08 + 0.13 * k)
const SCOOP_LAND = SCOOP_AT.map((a) => a + 0.095)
const TAP_LAND = [0, 1, 2, 3, 4].map((j) => 3.705 + 0.034 * j)
const OFF_PAN = 4.2
const ON_GAUZE = 4.8
const BACK_ON = 9.75

const isOnPan = (p: number) => (p >= DISH_ON && p < OFF_PAN) || p >= BACK_ON
const lampFlame = (p: number) => ease(p, 5.45, 5.6) * (1 - ease(p, 8.38, 8.45))
const capOff = (p: number) => ease(p, 5.0, 5.3) * (1 - ease(p, 8.05, 8.45))
/** Почернение: на шаге 5 — с краёв (середина ещё голубая), на 6 — чуть дальше, после помешивания — весь. */
const darkness = (p: number) => 0.6 * ease(p, 5.62, 5.98) + 0.12 * ease(p, 6.0, 6.95) + 0.28 * ease(p, 7.32, 7.8)
const steam = (p: number) => ease(p, 5.66, 5.85) * (1 - ease(p, 7.55, 7.85)) * (1 - 0.5 * ease(p, 7.3, 7.55))

/** Порции порошка (г): 4 шпателя и 5 лёгких постукиваний у 4,90 г; сумма — ровно m(Cu(OH)₂) попытки. */
function portions(mcu: number): { at: number; m: number }[] {
  const key = Math.round(mcu * 100)
  const taps = [0.13, 0.09, 0.06, 0.04, 0.03].map((x, j) => quantize(x + 0.02 * (hash01(key, j) - 0.5), 0.01))
  const big = mcu - taps.reduce((s, x) => s + x, 0)
  const s = [0.31, 0.27, 0.24].map((f) => quantize(big * f, 0.01))
  s.push(quantize(big - s.reduce((a, x) => a + x, 0), 0.01))
  return [...SCOOP_LAND.map((at, k) => ({ at, m: s[k]! })), ...TAP_LAND.map((at, j) => ({ at, m: taps[j]! }))]
}

/* ── Чаша: где она в момент p ── */
function dishPos(p: number): [number, number, number] {
  if (p < 3) return carry(p, 1.15, DISH_ON, DISH_REST, ON_PAN, 0.13)
  if (p < 7) return carry(p, OFF_PAN, ON_GAUZE, ON_PAN, DISH_HEAT, 0.24)
  return carry(p, 9.2, BACK_ON, DISH_HEAT, ON_PAN, 0.24)
}

/* ── Шпатель: со стола → 4 порции из банки в чашку → постукивания над чашкой → на стол ── */
const REST_ROT: V3 = [0, 0, 0]
const DIG: V3 = [0, 0, 0.9]
const CARRY: V3 = [0, 0, 0.42]
const DUMP: V3 = [1.25, 0, 0.42]
const TAP: V3 = [0.5, 0, 0.42]
const ABOVE_JAR: V3 = [JAR_P[0] - 0.004, 0.13, JAR_P[2]]
const IN_JAR: V3 = [JAR_P[0] - 0.004, 0.05, JAR_P[2]]
const HIGH_DISH: V3 = [PAN[0] + 0.004, 0.13, PAN[2]]
const AT_DISH: V3 = [PAN[0] + 0.004, ON_PAN[1] + 0.024, PAN[2]]
const SPAT_KEYS: readonly Key[] = (() => {
  const k: Key[] = [
    [3.02, SPAT, REST_ROT],
    [3.05, [SPAT[0], 0.13, SPAT[2]], DIG],
    [3.08, ABOVE_JAR, DIG],
  ]
  for (const a of SCOOP_AT) {
    k.push([a + 0.025, IN_JAR, DIG], [a + 0.045, ABOVE_JAR, DIG], [a + 0.072, HIGH_DISH, CARRY], [a + 0.085, AT_DISH, CARRY], [a + 0.1, AT_DISH, DUMP], [a + 0.13, ABOVE_JAR, DIG])
  }
  k.push([3.625, IN_JAR, DIG], [3.645, ABOVE_JAR, DIG], [3.675, HIGH_DISH, CARRY], [3.695, AT_DISH, CARRY])
  TAP_LAND.forEach((t) => k.push([t - 0.008, AT_DISH, TAP], [t + 0.012, AT_DISH, CARRY]))
  k.push([3.88, HIGH_DISH, CARRY], [3.92, [SPAT[0], 0.1, SPAT[2]], REST_ROT], [3.96, SPAT, REST_ROT])
  return k
})()
function spatFull(p: number): number {
  for (const a of SCOOP_AT) if (p >= a + 0.03 && p < a + 0.095) return 1
  if (p >= 3.63 && p < TAP_LAND[4]!) {
    const done = TAP_LAND.filter((t) => p >= t).length
    return 0.55 - 0.1 * done
  }
  return 0
}

/* ── Стеклянная палочка: со стола → в чашку, 4 круга по порошку → на стол ── */
const ROD_LIE: V3 = [0, 0, -Math.PI / 2]
const ROD_TILT: V3 = [0, 0, -0.3]
const ROD_ABOVE: V3 = [DISH_HEAT[0], 0.2, DISH_HEAT[2]]
const ROD_DIP: V3 = [DISH_HEAT[0], DISH_HEAT[1] + 0.006, DISH_HEAT[2]]
const STIR_A = 7.32
const STIR_B = 7.8
function rodPose(p: number): { pos: [number, number, number]; rot: [number, number, number] } {
  if (p >= STIR_A && p <= STIR_B) {
    const th = ((p - STIR_A) / (STIR_B - STIR_A)) * Math.PI * 2 * 4
    const r = 0.012 * Math.min(1, (p - STIR_A) / 0.04, (STIR_B - p) / 0.04)
    return { pos: [ROD_DIP[0] + Math.cos(th) * r, ROD_DIP[1], ROD_DIP[2] + Math.sin(th) * r], rot: [...ROD_TILT] }
  }
  return track(p, [
    [7.0, ROD_REST, ROD_LIE],
    [7.1, [ROD_REST[0], 0.07, ROD_REST[2]], [0, 0, -0.7]],
    [7.22, ROD_ABOVE, ROD_TILT],
    [STIR_A, ROD_DIP, ROD_TILT],
    [7.86, ROD_ABOVE, ROD_TILT],
    [7.94, [ROD_REST[0], 0.07, ROD_REST[2]], [0, 0, -0.7]],
    [7.99, ROD_REST, ROD_LIE],
  ])
}

/* ── Часовое стекло: со стола → над чашкой (капли) → на стол ── */
function watchPos(p: number): [number, number, number] {
  if (p < 6.5) return carry(p, 6.05, 6.3, WG_REST, WG_HOLD, 0.21)
  return carry(p, 6.72, 6.97, WG_HOLD, WG_REST, 0.21)
}
const glassHeld = (p: number) => ease(p, 6.22, 6.3) * (1 - ease(p, 6.72, 6.8))
/** Капли — на нижней (выпуклой) стороне стекла: y = 0,002 + r²/0,11 (профиль WatchGlass), чуть ниже поверхности. */
const DROPS: [number, number, number][] = Array.from({ length: 26 }, (_, i) => {
  const r = 0.008 + Math.sqrt(hash01(31, i)) * 0.018
  const a = hash01(37, i) * Math.PI * 2
  return [Math.cos(a) * r, 0.002 + (r * r) / 0.11 - 0.0009, Math.sin(a) * r]
})

/* ── Щипцы: берут остывшую чашку за передний край и несут на весы ── */
const T0 = 9.0
const T1 = 9.2
const T2 = BACK_ON
const T3 = 9.95
function tongsPose(p: number): { pos: [number, number, number]; rot?: [number, number, number] } {
  if (p < T0 || p > T3) return { pos: [...TONGS_REST] }
  const grip = (q: number): [number, number, number] => {
    const d = dishPos(q)
    return [d[0], d[1] + DISH_H + 0.0012 - 0.0016, d[2] + RIM_R]
  }
  if (p < T1) return { pos: carry(p, T0, T1, TONGS_REST, grip(T1), 0.26), rot: [0, (-Math.PI / 2) * ease(p, T0, T1 - 0.04), 0] }
  if (p < T2) return { pos: grip(p), rot: [0, -Math.PI / 2, 0] }
  return { pos: carry(p, T2, T3, grip(T2), TONGS_REST, 0.26), rot: [0, (-Math.PI / 2) * (1 - ease(p, T2 + 0.04, T3)), 0] }
}
const tongsOpen = (p: number) => Math.max(hill(p, T1 - 0.08, T1 + 0.01, 0.4), hill(p, T2 - 0.01, T2 + 0.08, 0.4))

/**
 * Слой порошка в чаше (начало — начало чаши): верх — пологая шапка, край упирается в сферическую стенку.
 * amount(p) 0…1 — сколько насыпано (растёт к середине), dark(p) 0…1 — почернение от краёв к середине
 * (у каждого участка свой порог — пятнами, как в жизни). CuO плотнее: к концу слой немного оседает.
 */
function DishPowder({ amount, dark }: { amount: PFn; dark: PFn }) {
  const { p, quality } = useRig()
  const seg = quality === 'high' ? 40 : 24
  const { geo, thr } = useMemo(() => {
    const top = 0.0088
    const edgeY = 0.0074
    const rEdge = dishInnerR(edgeY) - 0.0005
    const rings = 9
    const pts: THREE.Vector2[] = []
    for (let i = rings; i >= 0; i--) {
      const r = Math.max(0.0001, (rEdge * i) / rings)
      pts.push(new THREE.Vector2(r, edgeY + (top - edgeY) * (1 - (r / rEdge) ** 2)))
    }
    const g = new THREE.LatheGeometry(pts, seg)
    const pos = g.getAttribute('position')
    const n = pos.count
    const tt = new Float32Array(n)
    for (let k = 0; k < n; k++) {
      const ring = k % pts.length
      const ang = Math.floor(k / pts.length) % seg
      const r = Math.hypot(pos.getX(k), pos.getZ(k))
      // крупинки: неровная поверхность (кроме края у стенки); шов развёртки — без щели
      if (ring > 0) pos.setY(k, pos.getY(k) + (hash01(ring * 97 + ang, 3) - 0.5) * 0.0009)
      // порог почернения: от края к середине, неровный фронт — плавные пятна по углу и радиусу, без «лучей»
      const th = (ang / seg) * Math.PI * 2
      const uu = r / rEdge
      tt[k] = 1 - uu + 0.11 * Math.sin(3 * th + 1.7 + uu * 2.5) + 0.07 * Math.sin(5 * th + 0.4 - uu * 4) + (hash01(ring * 53 + ang, 5) - 0.5) * 0.05
    }
    g.computeVertexNormals()
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3))
    return { geo: g, thr: tt }
  }, [seg])
  useEffect(() => () => geo.dispose(), [geo])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }), [])
  const blue = useMemo(() => new THREE.Color(BLUE), [])
  const black = useMemo(() => new THREE.Color(BLACK), [])
  const ref = useRef<THREE.Mesh>(null)
  const last = useRef(-1)
  const c = useMemo(() => new THREE.Color(), [])
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const pv = p.current ?? 0
    const a = amount(pv)
    m.visible = a > 0.01
    if (!m.visible) return
    const d = dark(pv)
    const s = Math.cbrt(a)
    m.scale.set(s * mix(1, 0.94, d), s * mix(1, 0.86, d), s * mix(1, 0.94, d))
    if (Math.abs(d - last.current) < 0.002) return
    last.current = d
    const col = geo.getAttribute('color') as THREE.BufferAttribute
    for (let k = 0; k < col.count; k++) {
      const x = Math.min(1, Math.max(0, (d * 1.35 - thr[k]!) / 0.3))
      c.copy(blue).lerp(black, x * x * (3 - 2 * x))
      col.setXYZ(k, c.r, c.g, c.b)
    }
    col.needsUpdate = true
  })
  return <mesh ref={ref} geometry={geo} material={mat} receiveShadow />
}

export function CuOH2HeatRig() {
  const { lang } = useRig()
  const v = useLabTaskValues(ID)
  const dish = v.dish!
  const mcu = v.mcu!
  const mcuo = v.mcuo!
  useGearStep(ID, 0)
  const parts = useMemo(() => portions(mcu), [mcu])
  const powderAt = useMemo(() => (p: number) => parts.reduce((s, x) => (p >= x.at ? s + x.m : s), 0), [parts])
  const reading = useMemo(
    () => (p: number) => {
      const content = p < 3 ? 0 : p < 9 ? powderAt(p) : mcuo
      const gross = isOnPan(p) ? dish + content : 0
      return Math.round((gross - (p >= TARED ? dish : 0)) * 100) / 100
    },
    [dish, mcuo, powderAt],
  )
  const amount = (p: number) => (p < 3 ? 0 : p < 4 ? powderAt(p) / mcu : 1)
  const dishTop: V3 = [DISH_HEAT[0], DISH_HEAT[1] + 0.03, DISH_HEAT[2]]
  const lampTop: V3 = [LAMP[0], 0.09, LAMP[2]]
  const jarName = { ru: 'гидроксид меди(II)', en: 'copper(II) hydroxide', uz: 'mis(II) gidroksidi' }[lang]

  useSoundAt(0.2, 'click', PPE, 0.5)
  useSoundAt(DISH_ON, 'glass-place', PAN, 0.35)
  useSoundAt(2.2, 'click', [SC[0] + SCALES.tareBtn[0], 0.02, SC[2] + SCALES.tareBtn[2]], 0.5)
  useSoundAt(3.04, 'glass-clink', JAR_P, 0.3)
  useSoundAt(TAP_LAND[0]!, 'click', PAN, 0.15)
  useSoundAt(ON_GAUZE, 'glass-place', DISH_HEAT, 0.35)
  useSoundAt(5.3, 'flame-on', lampTop, 0.6)
  useSoundAt(5.6, 'flame-loop', lampTop, 0.4)
  useSoundAt(5.9, 'sizzle', dishTop, 0.35)
  useSoundAt(6.97, 'glass-place', WG_REST, 0.3)
  useSoundAt(STIR_A, 'glass-clink', dishTop, 0.25)
  useSoundAt(7.6, 'sizzle', dishTop, 0.25)
  useSoundAt(8.42, 'click', [LAMP[0], 0.08, LAMP[2]], 0.5)
  useSoundAt(BACK_ON, 'glass-place', PAN, 0.35)
  useSoundAt(9.92, 'success', PAN, 0.4)

  return (
    <group>
      <group position={PPE as unknown as THREE.Vector3Tuple}>
        <PpeTray worn={(p) => ease(p, 0, 0.95)} gloves={false} />
        <Target name="ppe" size={[0.16, 0.05, 0.1]} center={[0, 0.02, 0]} hintY={0.08} />
      </group>

      {/* Весы: включены с начала урока; кнопка «T» */}
      <group position={SC as unknown as THREE.Vector3Tuple}>
        <DigitalScales reading={reading} readout={(p) => ((p >= 1.6 && p < 4.4) || p >= 9.6 ? 1 : 0)} />
        <Target name="scales-tare" size={[0.03, 0.03, 0.03]} center={[SCALES.tareBtn[0], 0.02, SCALES.d / 2 + 0.004]} hintY={0.07} ring={false} />
      </group>

      {/* Фарфоровая чашка с порошком: стол → весы → сетка → весы */}
      <Pose pose={(p) => ({ pos: dishPos(p) })}>
        <PorcelainDish level={() => 0} crystals={() => 0} boil={() => 0} />
        <DishPowder amount={amount} dark={darkness} />
        <Target name="dish" size={[0.1, 0.04, 0.1]} center={[0, 0.014, 0]} hintY={0.07} ring={false} />
      </Pose>
      {/* порошок сыплется со шпателя в чашку (на весах) */}
      {SCOOP_AT.map((a) => (
        <Falling key={a} from={[AT_DISH[0] - 0.002, AT_DISH[1] - 0.004, AT_DISH[2]]} toY={() => ON_PAN[1] + 0.006} a={a + 0.088} b={a + 0.11} n={6} color={BLUE} size={0.0016} box />
      ))}
      <Falling from={[AT_DISH[0] - 0.002, AT_DISH[1] - 0.004, AT_DISH[2]]} toY={() => ON_PAN[1] + 0.008} a={TAP_LAND[0]! - 0.008} b={TAP_LAND[4]! + 0.006} n={7} color={BLUE} size={0.0012} box />

      {/* Банка с Cu(OH)₂ и шпатель */}
      <group position={JAR_P as unknown as THREE.Vector3Tuple}>
        <PowderJar formula="Cu(OH)₂" name={jarName} color={BLUE} fill={0.62} open={(p) => ease(p, 3.0, 3.07) * (1 - ease(p, 3.93, 4.0))} />
        <Target name="cuoh2-jar" size={[0.07, 0.1, 0.07]} center={[0, 0.036, 0]} hintY={0.12} />
      </group>
      <Pose pose={(p) => track(p, SPAT_KEYS)}>
        <Scoop full={spatFull} kind="powder" color={BLUE} />
      </Pose>

      {/* Штатив с кольцом (стержень сзади), сетка с керамическим центром, спиртовка со спичками */}
      <group position={[LAMP[0], 0, LAMP[2]]} rotation={[0, -Math.PI / 2, 0]}>
        <RingStand rodX={-0.17} ringX={0} ringY={RING_Y} ringR={RING_R} />
      </group>
      <group position={[LAMP[0], GAUZE_Y, LAMP[2]]}>
        <WireGauze glow={lampFlame} />
      </group>
      <group position={LAMP as unknown as THREE.Vector3Tuple}>
        <Target name="spirit-lamp" size={[0.08, 0.1, 0.08]} center={[0, 0.045, 0]} hintY={0.105} ring={false} />
        <group position={[0.075, 0, 0.012]}>
          <Target name="lamp-cap" size={[0.05, 0.05, 0.05]} center={[0, 0.02, 0]} hintY={0.07} />
        </group>
      </group>
      <LampKit lamp={LAMP} matchbox={MATCHBOX} flame={lampFlame} capOff={capOff} lightAt={5.22} />

      {/* Пар над чашкой: уходит вода */}
      {/* под часовым стеклом пар не поднимается выше — растекается под ним и оседает каплями */}
      <Puffs origin={[DISH_HEAT[0], DISH_HEAT[1] + 0.012, DISH_HEAT[2]]} rate={(p) => steam(p) * glassHeld(p)} color="#ffffff" count={18} rise={0.042} spread={0.03} size={0.008} opacity={0.24} life={1.4} />
      <Puffs origin={[DISH_HEAT[0], DISH_HEAT[1] + 0.012, DISH_HEAT[2]]} rate={(p) => steam(p) * (1 - glassHeld(p))} color="#ffffff" count={30} rise={0.15} spread={0.024} drift={[0.012, 0, 0.016]} size={0.009} opacity={0.26} life={1.8} />

      {/* Холодное часовое стекло: капли воды снизу */}
      <Pose pose={(p) => ({ pos: watchPos(p) })}>
        <WatchGlass />
        <Droplets points={DROPS} show={(p) => ease(p, 6.32, 6.62)} />
        <Target name="watch-glass" size={[0.08, 0.03, 0.08]} center={[0, 0.008, 0]} hintY={0.05} ring={false} />
      </Pose>

      {/* Стеклянная палочка */}
      <Pose pose={rodPose}>
        <GlassRod length={0.2} />
      </Pose>
      <group position={[ROD_REST[0] + 0.1, 0, ROD_REST[2]]}>
        <Target name="stir-rod" size={[0.2, 0.03, 0.04]} center={[0, 0.01, 0]} hintY={0.05} ring={false} />
      </group>

      {/* Тигельные щипцы */}
      <Pose pose={tongsPose}>
        <CrucibleTongs open={tongsOpen} />
      </Pose>
    </group>
  )
}

