/**
 * task-g8-cuso4-hydrate (Kimyo 8, с. 154, задача 4): 2,50 г CuSO₄·5H₂O в фарфоровой чашке на кольце над спиртовкой.
 * Шаги: 0 очки · 1 чашка на весы, T · 2 2,50 г синих кристаллов шпателем (m₀) · 3 чашка на кольцо штатива ·
 * 4 колпачок снять, зажечь спичкой · 5 нагрев с помешиванием: синий → голубовато-белый, пар, потрескивание ·
 * 6 погасить колпачком, остывание · 7 1-е взвешивание (m₁) · 8 повторный нагрев и остывание · 9 2-е взвешивание (m₂) ·
 * 10 чашка на стол, капли воды — порошок снова синеет и теплеет.
 * Все числа на весах — из показаний попытки (useLabTaskValues): к концу шага прибор показывает то, что в журнале.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Pose, Target, ease, hill, mix, mixV, useRig, useSoundAt, type PFn, type V3 } from '../../../rigCore'
import { Match, Matchbox, SpiritLamp } from '../../../parts/fire'
import { DropperBottle, Falling, GlassRod, Pipette, PorcelainDish, PpeTray, Puffs, RingStand } from '../../../parts/practicalware'
import { Spatula, pipettePose } from '../../worksKit'
import { useGearStep } from '../../useGearStep'
import { useLabTaskValues } from '../../../../measure/labTaskSession'
import { DigitalScales, SCALES, SCALES_PAN_CENTER } from '../../../../measure/devices/Scales'
import { PowderJar } from '../../../../measure/devices/Bench'
import { CU } from '../../../../../../data/labTasks/g8/layoutG8'
import { track } from './g8Kit'
import { WireGauze as KitWireGauze } from '../g7/kitG7'

const ID = 'task-g8-cuso4-hydrate' as const
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const PAN: V3 = add(CU.scales, SCALES_PAN_CENTER)
/** Чашка стоит ножкой: у PorcelainDish низ ножки на 2 мм ниже начала. */
const DISH_REST: V3 = [CU.dish[0], 0.002, CU.dish[2]]
const DISH_PAN: V3 = [PAN[0], PAN[1] + 0.002, PAN[2]]
const RING = CU.ringDish
const LAMP = CU.lamp
const MB = CU.matchbox
/** Масса пустой фарфоровой чашки (г) — до тары. */
const MD = 52.73
const BLUE = '#2b77cf'
/** Безводный CuSO₄ — серовато-белый с лёгким голубовато-зелёным оттенком (на белом фарфоре виден). */
const WHITE = '#d6e0de'

/* ── чашка: стол → весы → кольцо → весы → кольцо → весы → стол ── */
const dishPos = track(DISH_REST, [
  [1, 1.4, DISH_PAN, 0.12],
  [3, 3.62, RING, 0.25],
  [7, 7.55, DISH_PAN, 0.25],
  [8, 8.42, RING, 0.25],
  [9, 9.55, DISH_PAN, 0.25],
  [10, 10.2, DISH_REST, 0.1],
])

/* ── кристаллы шпателем: три захода, последний — немного ── */
const CUM = [0.42, 0.8, 1]
const T0 = 2.1
const TRIP = 0.25
const tipAt = (i: number) => T0 + i * TRIP + TRIP * 0.62
const fill: PFn = (p) => {
  let f = 0
  for (let i = 0; i < CUM.length; i++) f = mix(f, CUM[i]!, ease(p, tipAt(i), tipAt(i) + 0.03))
  return f
}
const SPAT_REST: V3 = [CU.spatula[0], 0.003, CU.spatula[2]]
function spatulaPose(p: number) {
  const inJar: V3 = [CU.jar[0] - 0.006, 0.045, CU.jar[2]]
  const over: V3 = [PAN[0] - 0.008, PAN[1] + 0.065, PAN[2]]
  if (p <= 2 || p >= 3) return { pos: SPAT_REST, rot: [0, 0, 0] as V3, full: 0 }
  if (p < T0) {
    const k = ease(p, 2, T0)
    return { pos: mixV(mixV(SPAT_REST, [SPAT_REST[0], 0.12, SPAT_REST[2]], ease(p, 2, 2.04)), inJar, ease(p, 2.03, T0)), rot: [0, 0, 1.1 * k] as V3, full: 0 }
  }
  const end = T0 + CUM.length * TRIP
  if (p >= end) {
    const k = ease(p, end, 2.98)
    return { pos: mixV(mixV(over, [over[0], 0.2, over[2]], ease(p, end, end + 0.03)), SPAT_REST, ease(p, end + 0.02, 2.98)), rot: [0, 0, mix(0.35, 0, k)] as V3, full: 0 }
  }
  const i = Math.floor((p - T0) / TRIP)
  const f = (p - T0) / TRIP - i
  const go = ease(f, 0.2, 0.55) * (1 - ease(f, 0.78, 1))
  const pos = mixV(inJar, over, go)
  const hump = 0.05 * Math.sin(Math.PI * Math.min(1, Math.max(0, f < 0.6 ? (f - 0.2) / 0.35 : (f - 0.78) / 0.22)))
  const roll = -1.3 * hill(f, 0.56, 0.76, 0.3)
  return { pos: [pos[0], pos[1] + hump, pos[2]] as V3, rot: [roll, 0, mix(1.1, 0.35, go)] as V3, full: f > 0.18 && f < 0.62 ? 1 : 0 }
}

/* ── нагрев: побеление, пар; спиртовка; спички ── */
const white: PFn = (p) => 0.88 * ease(p, 5.15, 5.85) + 0.12 * ease(p, 8.6, 8.84)
const steam: PFn = (p) => ease(p, 5.1, 5.25) * (1 - ease(p, 5.75, 5.95)) + 0.35 * hill(p, 8.58, 8.84, 0.25)
const capOff: PFn = (p) => ease(p, 4, 4.3) * (1 - ease(p, 6, 6.3)) + ease(p, 8.42, 8.5) * (1 - ease(p, 8.82, 8.9))
const flame: PFn = (p) => ease(p, 4.45, 4.6) * (1 - ease(p, 6.14, 6.24)) + ease(p, 8.52, 8.58) * (1 - ease(p, 8.84, 8.9))
/** Капли воды на порошок: синее пятно растёт. */
const spot: PFn = (p) => ease(p, 10.36, 10.62)

function matchPose(rest: V3, a: number) {
  const raised: V3 = [MB[0] - 0.05, 0.09, MB[2] - 0.05]
  // спичка головкой к −X: головка у фитиля
  const atWick: V3 = [LAMP[0] + 0.049, 0.077, LAMP[2]]
  const dropped: V3 = [rest[0] + 0.005, 0.0012, rest[2] + 0.04]
  return (p: number) => {
    let pos = mixV(rest, raised, ease(p, a, a + 0.08))
    pos = mixV(pos, atWick, ease(p, a + 0.08, a + 0.22))
    pos = mixV(pos, [MB[0] - 0.04, 0.08, MB[2]], ease(p, a + 0.32, a + 0.42))
    pos = mixV(pos, dropped, ease(p, a + 0.42, a + 0.52))
    return { pos, rot: [0, mix(Math.PI, Math.PI + 0.4, ease(p, a + 0.42, a + 0.52)), 0] as V3 }
  }
}

function rodPose(p: number) {
  const rest: V3 = [CU.rod[0], 0.003, CU.rod[2]]
  const lifted: V3 = [rest[0], 0.3, rest[2]]
  const inDish: V3 = [RING[0], RING[1] + 0.006, RING[2]]
  let pos = mixV(rest, lifted, ease(p, 5, 5.1))
  pos = mixV(pos, [RING[0], 0.3, RING[2]], ease(p, 5.08, 5.2))
  pos = mixV(pos, inDish, ease(p, 5.18, 5.28))
  const stir = ease(p, 5.26, 5.32) * (1 - ease(p, 5.84, 5.88))
  const ang = (p - 5.2) * Math.PI * 2 * 6
  pos = [pos[0] + Math.cos(ang) * 0.011 * stir, pos[1], pos[2] + Math.sin(ang) * 0.011 * stir]
  pos = mixV(pos, [RING[0], 0.3, RING[2]], ease(p, 5.86, 5.92))
  pos = mixV(pos, lifted, ease(p, 5.91, 5.95))
  pos = mixV(pos, rest, ease(p, 5.94, 5.99))
  const upright = ease(p, 5, 5.18) * (1 - ease(p, 5.92, 5.99))
  return { pos, rot: [0, 0, mix(-Math.PI / 2, -0.3 * stir, upright)] as V3 }
}

const tmp = new THREE.Object3D()
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Медный купорос в чашке (начало — центр дна чашки): горка (fill), крупные синие кристаллы, которые при нагреве
 * белеют пятнами и рассыпаются в порошок (white), синее мокрое пятно от капель воды (spot).
 */
function VitriolHeap() {
  const { quality, p } = useRig()
  const n = quality === 'high' ? 34 : 16
  const base = useMemo(() => new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.9 }), [])
  const glassy = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25, metalness: 0.05 }), [])
  const wet = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2f80d8', roughness: 0.35 }), [])
  const blue = useMemo(() => new THREE.Color(BLUE), [])
  const whiteC = useMemo(() => new THREE.Color(WHITE), [])
  const c = useMemo(() => new THREE.Color(), [])
  const seeds = useMemo(
    () => Array.from({ length: n }, (_, i) => ({ r: Math.sqrt(rnd(i, 1)) * 0.015, a: rnd(i, 2) * Math.PI * 2, s: 0.75 + rnd(i, 3) * 0.6, rot: rnd(i, 4) * 6, order: rnd(i, 5), th: rnd(i, 6) })),
    [n],
  )
  const heap = useRef<THREE.Mesh>(null)
  const cr = useRef<THREE.InstancedMesh>(null)
  const sp = useRef<THREE.Mesh>(null)
  const last = useRef(-1)
  // цвет у каждого кристалла задан до первого кадра — шейдер с цветами экземпляров собирается вместе с остальными
  useLayoutEffect(() => {
    const im = cr.current
    if (!im) return
    for (let i = 0; i < n; i++) im.setColorAt(i, blue)
    if (im.instanceColor) im.instanceColor.needsUpdate = true
  }, [n, blue])
  useFrame(() => {
    const pv = p.current ?? 0
    const f = fill(pv)
    const w = white(pv)
    const h = 0.0075 * f * (1 - 0.2 * w)
    const m = heap.current
    if (m) {
      m.visible = f > 0.01
      m.scale.set(0.024 * Math.sqrt(f) + 1e-4, h + 1e-4, 0.024 * Math.sqrt(f) + 1e-4)
      base.color.copy(blue).lerp(whiteC, w)
    }
    const im = cr.current
    if (im) {
      im.visible = f > 0.01
      const key = Math.round(f * 100) * 1000 + Math.round(w * 200)
      if (im.visible && key !== last.current) {
        last.current = key
        for (let i = 0; i < n; i++) {
          const sd = seeds[i]!
          const on = sd.order < f
          const k = Math.min(1, Math.max(0, (w - sd.th * 0.55) / 0.45))
          const rr = sd.r * Math.sqrt(Math.max(0.01, f))
          const top = 0.0018 + h * Math.sqrt(Math.max(0, 1 - (rr / 0.024) ** 2))
          tmp.position.set(Math.cos(sd.a) * rr, top, Math.sin(sd.a) * rr)
          tmp.rotation.set(sd.rot, sd.rot * 1.3, sd.rot * 0.7)
          const s = on ? 0.0026 * sd.s * (1 - 0.45 * k) : 1e-6
          tmp.scale.set(s, s * 0.8, s * 1.1)
          tmp.updateMatrix()
          im.setMatrixAt(i, tmp.matrix)
          im.setColorAt(i, c.copy(blue).lerp(whiteC, k))
        }
        im.instanceMatrix.needsUpdate = true
        if (im.instanceColor) im.instanceColor.needsUpdate = true
      }
    }
    if (sp.current) {
      const s = spot(pv)
      sp.current.visible = s > 0.02
      sp.current.scale.set(0.009 * s + 1e-4, 0.0016 * s + 1e-4, 0.008 * s + 1e-4)
      sp.current.position.y = 0.0018 + h - 0.0006
    }
  })
  return (
    <group>
      <mesh ref={heap} position={[0, 0.0018, 0]} material={base}>
        <sphereGeometry args={[1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <instancedMesh ref={cr} args={[undefined, undefined, n]} material={glassy} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <mesh ref={sp} material={wet}>
        <sphereGeometry args={[1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  )
}

export function Cuso4HydrateRig() {
  const { lang } = useRig()
  const v = useLabTaskValues(ID)
  const m0 = v.m0!
  const m1 = v.m1!
  const m2 = v.m2!

  useGearStep(ID, 0)
  useSoundAt(0.2, 'click', CU.ppe, 0.5)
  useSoundAt(1.4, 'glass-place', PAN, 0.4)
  useSoundAt(1.7, 'click', add(CU.scales, SCALES.tareBtn), 0.5)
  useSoundAt(tipAt(0), 'glass-clink', PAN, 0.2)
  useSoundAt(tipAt(1), 'glass-clink', PAN, 0.2)
  useSoundAt(3.6, 'glass-place', RING, 0.4)
  useSoundAt(4.1, 'click', LAMP, 0.4)
  useSoundAt(4.45, 'flame-on', [LAMP[0], 0.08, LAMP[2]], 0.6)
  useSoundAt(5.22, 'sizzle', RING, 0.45)
  useSoundAt(5.5, 'sizzle', RING, 0.35)
  useSoundAt(6.18, 'click', LAMP, 0.45)
  useSoundAt(7.53, 'glass-place', PAN, 0.4)
  useSoundAt(8.4, 'glass-place', RING, 0.4)
  useSoundAt(8.52, 'flame-on', [LAMP[0], 0.08, LAMP[2]], 0.5)
  useSoundAt(8.86, 'click', LAMP, 0.4)
  useSoundAt(9.53, 'glass-place', PAN, 0.4)
  useSoundAt(10.2, 'glass-place', DISH_REST, 0.3)
  useSoundAt(10.4, 'sizzle', DISH_REST, 0.2)
  useSoundAt(10.95, 'success', DISH_REST, 0.4)

  /* ── весы: чашка, T → кристаллы → чашку сняли (−MD) → m₁ → снова −MD → m₂ ── */
  const reading = (p: number) => {
    if (p < 1.4) return 0
    if (p < 1.72) return MD
    if (p < 3.04) return m0 * fill(p)
    if (p < 7.53) return -MD
    if (p < 8.04) return m1
    if (p < 9.53) return -MD
    if (p < 10.03) return m2
    return -MD
  }
  const readout: PFn = (p) => ((p >= 2.7 && p <= 3.02) || (p >= 7.58 && p <= 8.03) || (p >= 9.58 && p <= 10.02) ? 1 : 0)
  const pip = pipettePose(CU.water, [[10, CU.dish[0] + 0.004, CU.dish[2], 0.05]])

  return (
    <group>
      <group position={CU.ppe as unknown as THREE.Vector3Tuple}>
        <PpeTray worn={(p) => ease(p, 0, 0.95)} gloves={false} />
        <Target name="ppe" size={[0.16, 0.05, 0.1]} center={[0, 0.02, 0]} hintY={0.08} />
      </group>

      {/* весы */}
      <group position={CU.scales as unknown as THREE.Vector3Tuple}>
        <DigitalScales reading={reading} readout={readout} />
      </group>

      {/* фарфоровая чашка с медным купоросом */}
      <Pose pose={(p) => ({ pos: dishPos(p) })}>
        <PorcelainDish level={() => 0} crystals={() => 0} boil={() => 0} />
        <VitriolHeap />
        <Target name="dish" size={[0.1, 0.04, 0.1]} center={[0, 0.014, 0]} hintY={0.07} />
      </Pose>
      <Puffs origin={[RING[0], RING[1] + 0.016, RING[2]]} rate={steam} count={24} rise={0.12} spread={0.02} drift={[0.01, 0, 0.015]} size={0.011} opacity={0.3} life={1.6} />

      {/* банка с медным купоросом и шпатель */}
      <group position={CU.jar as unknown as THREE.Vector3Tuple}>
        <PowderJar formula="CuSO₄·5H₂O" name={{ ru: 'медный купорос', en: 'blue vitriol', uz: 'mis kuporosi' }[lang]} color={BLUE} fill={0.6} open={(p) => ease(p, 2, 2.08) * (1 - ease(p, 2.9, 2.98))} />
      </group>
      <Pose
        pose={(p) => {
          const s = spatulaPose(p)
          return { pos: s.pos, rot: s.rot }
        }}
      >
        <Spatula full={(p) => spatulaPose(p).full} color={BLUE} />
        <Target name="spatula" size={[0.15, 0.03, 0.04]} center={[0.06, 0.004, 0]} hintY={0.05} ring={false} />
      </Pose>
      {CUM.map((_, i) => (
        <Falling key={i} from={[PAN[0] - 0.008, PAN[1] + 0.06, PAN[2]]} toY={() => PAN[1] + 0.006} a={tipAt(i) - 0.02} b={tipAt(i) + 0.06} n={5} color={BLUE} size={0.0024} box jitter={0.007} />
      ))}

      {/* штатив (стойка позади) с кольцом и сеткой над спиртовкой: чашка стоит ножкой на сетке; спички */}
      <group position={[RING[0], 0, RING[2]]} rotation={[0, Math.PI / 2, 0]}>
        <RingStand rodX={CU.standRod} ringX={0} ringY={RING[1] - 0.0061} ringR={0.04} />
      </group>
      <WireGauze at={[RING[0], RING[1] - 0.00275, RING[2]]} />
      <group position={LAMP as unknown as THREE.Vector3Tuple}>
        <SpiritLamp flame={flame} capOff={capOff} />
        <Target name="spirit-lamp" size={[0.08, 0.1, 0.08]} center={[0, 0.045, 0]} hintY={0.12} />
        <group position={[0.075, 0, 0.012]}>
          <Target name="lamp-cap" size={[0.05, 0.05, 0.05]} center={[0, 0.02, 0]} hintY={0.07} />
        </group>
      </group>
      <group position={MB as unknown as THREE.Vector3Tuple}>
        <Matchbox />
      </group>
      <Pose pose={matchPose([MB[0] - 0.025, 0.018, MB[2] - 0.006], 4.3)}>
        <Match lit={(p) => ease(p, 4.36, 4.42) * (1 - ease(p, 4.7, 4.8))} />
      </Pose>
      <Pose pose={matchPose([MB[0] - 0.022, 0.018, MB[2] + 0.006], 8.42)}>
        <Match lit={(p) => ease(p, 8.46, 8.5) * (1 - ease(p, 8.8, 8.9))} />
      </Pose>

      {/* стеклянная палочка */}
      <Pose pose={rodPose}>
        <GlassRod length={0.2} />
      </Pose>
      <group position={[CU.rod[0] + 0.1, 0, CU.rod[2]]}>
        <Target name="rod" size={[0.21, 0.03, 0.04]} center={[0, 0.006, 0]} hintY={0.05} />
      </group>

      {/* склянка-капельница с водой и пипетка */}
      <group position={CU.water as unknown as THREE.Vector3Tuple}>
        <DropperBottle color="#d6ebfb" label="H₂O" />
      </group>
      <Pose pose={(p) => ({ pos: pip(p).pos })}>
        <Pipette color="#d6ebfb" squeeze={(p) => pip(p).squeeze} />
        <Target name="dropper" size={[0.04, 0.11, 0.04]} center={[0, 0.06, 0]} hintY={0.14} ring={false} />
      </Pose>
      <Falling from={[CU.dish[0] + 0.004, 0.048, CU.dish[2]]} toY={() => 0.012} a={10.32} b={10.56} n={4} color="#cfe6fb" size={0.0018} />
    </group>
  )
}

/** Металлическая сетка с керамическим кругом в центре (лежит на кольце штатива; at — центр сетки): общая проволочная из kitG7. */
function WireGauze({ at }: { at: V3 }) {
  // верх керамики — там же, где был (at.y + 0,0012): чашка стоит на нём
  return (
    <group position={[at[0], at[1] - 0.0006, at[2]]}>
      <KitWireGauze glow={flame} />
    </group>
  )
}
