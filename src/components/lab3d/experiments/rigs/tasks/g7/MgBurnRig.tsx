/**
 * Kimyo 7, с. 96, задание 2 — горение 1,2 г магния: масса и количество MgO.
 * Шаги: 0 очки · 1 тигель щипцами на весы · 2 тара · 3 лента Mg в тигель · 4 тигель на треугольник · 5 спиртовка
 * (нагрев, вспышка) · 6 приоткрыть крышку щипцами (белое пламя, дым MgO) · 7 погасить колпачком, остывание · 8 на весы.
 * Весы показывают числа попытки: тигель (m₀), после тары — m(Mg), без тигля — −m₀, в конце — m(MgO).
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Pose, Target, ease, hill, mix, useRig, useSoundAt, type V3 } from '../../../rigCore'
import { WatchGlass } from '../../../parts/glassware'
import { PpeTray, Puffs } from '../../../parts/practicalware'
import { Flame, FlameLight } from '../../../parts/fire'
import { PowderHeap } from '../../worksKit'
import { useGearStep } from '../../useGearStep'
import { DigitalScales, SCALES } from '../../../../measure/devices/Scales'
import { CRUCIBLE, CRUCIBLE_SINK, ClayTriangle, Crucible, CrucibleLid, CrucibleTongs, TRIANGLE, Tripod } from '../../../../measure/devices/Crucible'
import { useLabTaskValues } from '../../../../measure/labTaskSession'
import { LampKit, carry } from './kitG7'

const PPE: V3 = [0.5, 0, 0.17]
const SC: V3 = [-0.3, 0, -0.04]
const PAN: V3 = [-0.3, SCALES.panY, -0.052]
const CR_REST: V3 = [-0.12, 0, 0.12]
const RIB: V3 = [-0.47, 0, 0.12]
const LAMP: V3 = [0.12, 0, -0.06]
const TRIPOD_H = 0.148
const TRI_Y = TRIPOD_H + TRIANGLE.tubeR
const CR_HEAT: V3 = [LAMP[0], TRI_Y - CRUCIBLE_SINK, LAMP[2]]
const MATCHBOX: V3 = [0.3, 0, 0.06]
const TONGS_REST: V3 = [0.2, 0, 0.2]
const LID_SIDE: V3 = [PAN[0] + 0.043, PAN[1] + 0.0027, PAN[2] + 0.004]
const RING_R = 0.045

const ON_PAN = (p: number) => (p >= 1.75 && p < 4.2) || p >= 8.75
const TARED = 2.35
const COIL_IN = 3.6

function cruciblePos(p: number): [number, number, number] {
  if (p < 3) return carry(p, 1.2, 1.75, CR_REST, PAN, 0.12)
  if (p < 6) return carry(p, 4.2, 4.75, PAN, CR_HEAT, 0.22)
  return carry(p, 8.2, 8.75, CR_HEAT, PAN, 0.22)
}

/** Приоткрывание крышки щипцами: два раза на шаге 6. */
const lidLift = (p: number) => hill(p, 6.18, 6.4, 0.3) + hill(p, 6.48, 6.7, 0.3)
/** Магний горит: вспыхнул под крышкой на шаге 5, догорел к концу шага 6. */
const burn = (p: number) => ease(p, 5.85, 5.95) * (1 - ease(p, 6.72, 6.9))
const lampFlame = (p: number) => ease(p, 5.45, 5.6) * (1 - ease(p, 7.45, 7.55))
const capOff = (p: number) => ease(p, 5.0, 5.3) * (1 - ease(p, 7.05, 7.45))
const ash = (p: number) => ease(p, 5.95, 6.8)

function lidPose(p: number) {
  const c = cruciblePos(p)
  const top: V3 = [c[0], c[1] + CRUCIBLE.h, c[2]]
  if (p >= 3 && p < 4) {
    const away = carry(p, 3.0, 3.16, [PAN[0], PAN[1] + CRUCIBLE.h, PAN[2]], LID_SIDE, PAN[1] + 0.07)
    const back = carry(p, 3.68, 3.9, LID_SIDE, [PAN[0], PAN[1] + CRUCIBLE.h, PAN[2]], PAN[1] + 0.07)
    return { pos: p < 3.4 ? away : back }
  }
  const k = lidLift(p)
  return { pos: [top[0], top[1] + 0.006 * k, top[2]] as V3, rot: [0, 0, 0.3 * k] as V3 }
}

/** Щипцы: со стола → берут тигель (или крышку) → несут вместе → отпускают → на стол. */
const WINDOWS: readonly (readonly [number, number, number, number])[] = [
  [1.0, 1.2, 1.75, 1.95],
  [4.0, 4.2, 4.75, 4.95],
  [8.0, 8.2, 8.75, 8.95],
]
function tongsPose(p: number) {
  for (const [a0, a, b, b1] of WINDOWS) {
    if (p < a0 || p > b1) continue
    const grip = (q: number): V3 => {
      const c = cruciblePos(q)
      return [c[0], c[1] + 0.0285, c[2]]
    }
    if (p < a) return { pos: carry(p, a0, a, TONGS_REST, grip(a), 0.24) }
    if (p < b) return { pos: grip(p) }
    return { pos: carry(p, b, b1, grip(b), TONGS_REST, 0.24) }
  }
  if (p >= 6 && p <= 6.98) {
    const knob = (q: number): V3 => {
      const l = lidPose(q).pos
      return [l[0], l[1] + 0.0058, l[2]]
    }
    if (p < 6.15) return { pos: carry(p, 6.0, 6.15, TONGS_REST, knob(6.15), 0.26) }
    if (p < 6.82) return { pos: knob(p), rot: [0, 0, 0.3 * lidLift(p)] as V3 }
    return { pos: carry(p, 6.82, 6.98, knob(6.82), TONGS_REST, 0.26) }
  }
  return { pos: TONGS_REST }
}
const tongsOpen = (p: number) => {
  let k = 0
  for (const [, a, b] of WINDOWS) k = Math.max(k, hill(p, a - 0.08, a + 0.01, 0.4), hill(p, b - 0.01, b + 0.08, 0.4))
  return Math.max(k, hill(p, 6.07, 6.16, 0.4), hill(p, 6.81, 6.9, 0.4))
}

/** Спираль магниевой ленты (начало — низ): серебристая → белая рыхлая MgO. */
function MgCoil() {
  const { p } = useRig()
  const geo = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2 * 3.4
      const r = 0.0066 - 0.0012 * Math.sin(i * 0.4)
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0.0012 + (i / 64) * 0.007, Math.sin(a) * r))
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, 0.0009, 5, false)
    g.scale(1, 1, 1)
    return g
  }, [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#cfd5da', roughness: 0.3, metalness: 0.85 }), [])
  const silver = useMemo(() => new THREE.Color('#cfd5da'), [])
  const white = useMemo(() => new THREE.Color('#f3f2ec'), [])
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const k = ash(p.current ?? 0)
    mat.color.copy(silver).lerp(white, k)
    mat.metalness = 0.85 * (1 - k)
    mat.roughness = mix(0.3, 0.95, k)
    if (ref.current) ref.current.scale.set(1, 1 - 0.35 * k, 1)
  })
  return <mesh ref={ref} geometry={geo} material={mat} castShadow />
}

export function MgBurnRig() {
  const v = useLabTaskValues('task-g7-mg-burn')
  const { crucible, mg, mgo } = v as Record<string, number>
  useGearStep('task-g7-mg-burn', 0)
  const reading = useMemo(
    () => (p: number) => {
      const content = p >= COIL_IN ? (p >= 8 ? mgo! : mg!) : 0
      const gross = ON_PAN(p) ? crucible! + content : 0
      return Math.round((gross - (p >= TARED ? crucible! : 0)) * 100) / 100
    },
    [crucible, mg, mgo],
  )
  const flash = (p: number) => burn(p) * (0.22 + 0.78 * lidLift(p))
  const rimTop: V3 = [CR_HEAT[0], CR_HEAT[1] + CRUCIBLE.h, CR_HEAT[2]]

  useSoundAt(0.2, 'click', PPE, 0.5)
  useSoundAt(1.75, 'glass-place', PAN, 0.35)
  useSoundAt(2.2, 'click', [SC[0] + SCALES.tareBtn[0], 0.02, SC[2] + SCALES.tareBtn[2]], 0.5)
  useSoundAt(COIL_IN, 'click', PAN, 0.25)
  useSoundAt(4.75, 'glass-place', CR_HEAT, 0.35)
  useSoundAt(5.3, 'flame-on', [LAMP[0], 0.09, LAMP[2]], 0.6)
  useSoundAt(5.6, 'flame-loop', [LAMP[0], 0.09, LAMP[2]], 0.4)
  useSoundAt(5.88, 'sizzle', rimTop, 0.8)
  useSoundAt(6.2, 'fizz', rimTop, 0.6)
  useSoundAt(6.5, 'sizzle', rimTop, 0.6)
  useSoundAt(7.42, 'click', [LAMP[0], 0.08, LAMP[2]], 0.5)
  useSoundAt(8.75, 'glass-place', PAN, 0.35)
  useSoundAt(8.92, 'success', PAN, 0.4)

  return (
    <group>
      <group position={PPE as unknown as THREE.Vector3Tuple}>
        <PpeTray worn={(p) => ease(p, 0, 0.95)} gloves={false} />
        <Target name="ppe" size={[0.16, 0.05, 0.1]} center={[0, 0.02, 0]} hintY={0.08} />
      </group>

      {/* Весы: включены с начала урока */}
      <group position={SC as unknown as THREE.Vector3Tuple}>
        <DigitalScales reading={reading} readout={(p) => (p >= 1.6 && p < 4.4) || p >= 8.6 ? 1 : 0} />
        <Target name="scales-tare" size={[0.03, 0.03, 0.03]} center={[SCALES.tareBtn[0], 0.02, SCALES.d / 2 + 0.004]} hintY={0.07} ring={false} />
      </group>

      {/* Тигель, крышка, лента */}
      <Pose pose={(p) => ({ pos: cruciblePos(p) })}>
        <Crucible heat={(p) => ease(p, 5.6, 6.1) * (1 - ease(p, 7.5, 7.95)) + 0.6 * burn(p)} />
        <group position={[0, 0.0024, 0]}>
          <Pose pose={(p) => ({ pos: [0, 0, 0], scale: ease(p, 6.3, 6.85) })}>
            <PowderHeap color="#f4f3ee" r={0.0082} h={0.0042} />
          </Pose>
        </group>
        <Target name="crucible" size={[0.05, 0.05, 0.05]} center={[0, 0.018, 0]} hintY={0.075} ring={false} />
      </Pose>
      <Pose pose={lidPose}>
        <CrucibleLid />
        <Target name="crucible-lid" size={[0.05, 0.03, 0.05]} center={[0, 0.006, 0]} hintY={0.05} ring={false} />
      </Pose>
      <Pose
        pose={(p) => {
          if (p < COIL_IN) return { pos: carry(p, 3.15, COIL_IN, [RIB[0], 0.003, RIB[2]], [PAN[0], PAN[1] + 0.0022, PAN[2]], PAN[1] + 0.09) }
          const c = cruciblePos(p)
          return { pos: [c[0], c[1] + 0.0022, c[2]] }
        }}
      >
        <MgCoil />
        <Target name="mg-ribbon" size={[0.04, 0.03, 0.04]} center={[0, 0.005, 0]} hintY={0.05} ring={false} />
      </Pose>
      <group position={RIB as unknown as THREE.Vector3Tuple}>
        <WatchGlass />
      </group>

      {/* Треножник, фарфоровый треугольник, спиртовка со спичками */}
      <group position={LAMP as unknown as THREE.Vector3Tuple}>
        <Tripod h={TRIPOD_H} ringR={RING_R} />
        <group position={[0, TRI_Y, 0]}>
          <ClayTriangle ringR={RING_R} />
        </group>
        <Target name="spirit-lamp" size={[0.08, 0.1, 0.08]} center={[0, 0.045, 0]} hintY={0.115} ring={false} />
        <group position={[0.075, 0, 0.012]}>
          <Target name="lamp-cap" size={[0.05, 0.05, 0.05]} center={[0, 0.02, 0]} hintY={0.07} />
        </group>
      </group>
      <LampKit lamp={LAMP} matchbox={MATCHBOX} flame={lampFlame} capOff={capOff} lightAt={5.22} />

      {/* Горящий магний: белое пламя в щели под крышкой, свет вспышки (слот пула), белый дым MgO */}
      <group position={rimTop as unknown as THREE.Vector3Tuple}>
        <Flame height={0.05} width={0.036} core="#ffffff" edge="#e8eeff" intensity={flash} alpha={0.95} seed={7.7} />
        <group position={[0, 0.02, 0]}>
          <FlameLight intensity={(p) => burn(p) * (0.35 + lidLift(p))} color="#f4f6ff" power={1.1} />
        </group>
      </group>
      <Puffs origin={[rimTop[0], rimTop[1] + 0.01, rimTop[2]]} rate={(p) => burn(p) * (0.2 + 0.8 * lidLift(p)) + 0.25 * hill(p, 6.7, 7.3, 0.3)} color="#f2f2ee" count={36} rise={0.2} spread={0.03} drift={[-0.02, 0, 0.01]} size={0.014} opacity={0.45} life={2} />

      {/* Тигельные щипцы */}
      <Pose pose={tongsPose}>
        <CrucibleTongs open={tongsOpen} />
      </Pose>
    </group>
  )
}
