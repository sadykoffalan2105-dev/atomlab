/**
 * Kimyo 9, с. 174, пример 7: состав смеси Na₂CO₃ + NaHCO₃ по прокаливанию (опыт 1:10, 6 г смеси).
 * Шаги: 0 очки · 1 пробирка в подставку на весах А · 2 тара · 3 6,00 г смеси шпателем · 4 U-трубка с CaCl₂ на весы Б (m₁) ·
 * 5 пробирка в лапку отверстием чуть вниз + пробка с газоотводной трубкой · 6 U-трубка к газоотводной трубке, выходная
 * трубка — в известковую воду · 7 спиртовка: капли воды, CaCl₂ влажнеет, известковая вода мутнеет · 8 по ТБ: трубку из
 * известковой воды, потом колпачок на спиртовку · 9 U-трубка на весы Б (m₂) · 10 пробка вон, остывшая пробирка в
 * подставку на весах А (остаток; тара сохранилась — убыль = 6,00 − остаток).
 * Числа на приборах — из попытки (useLabTaskValues): к концу шага прибор показывает то, что записано в журнал.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Pose, Target, ease, hill, mix, mixV, useRig, useSoundAt, type PFn, type PoseValue, type V3 } from '../../../rigCore'
import { TUBE_H, TUBE_R, TestTube, TubeRack } from '../../../parts/glassware'
import { Falling, GlassPath, PpeTray } from '../../../parts/practicalware'
import { useGearStep } from '../../useGearStep'
import { Spatula } from '../../worksKit'
import { useLabTaskValues } from '../../../../measure/labTaskSession'
import { DigitalScales, SCALES } from '../../../../measure/devices/Scales'
import { BEAKERS, MeasuringBeaker, RisingBubbles, beakerLevel } from '../../../../measure/devices/Glass'
import { PowderJar } from '../../../../measure/devices/Bench'
import { UTUBE_IN, UTUBE_OUT, UTube } from '../../../../measure/devices/UTube'
import { panAt, readoutAfter, track } from './g9Kit'
import { BandTag, LampSet, StandRod, TUBE_BLOCK, TubeBlock, TubeClampH, WallDroplets } from './kitG9b'

const ID = 'task-g9-nahco3-mix' as const
const Z = -0.06
const PPE: V3 = [0.52, 0, 0.21]
const SA: V3 = [-0.42, 0, 0.14]
const SB: V3 = [0.3, 0, 0.12]
const PA = panAt(SA)
const PB = panAt(SB)
const TRK: V3 = [-0.56, 0, -0.02]
const JAR: V3 = [-0.27, 0, 0.22]
/** U-трубка в собранном приборе; конец её входного отвода (сюда приходит газоотводная трубка). */
const UA: V3 = [0.02, 0, Z]
const UIN: V3 = [UA[0] + UTUBE_IN[0], UTUBE_IN[1], Z]
const GJ: V3 = [UA[0] + UTUBE_OUT[0], UTUBE_OUT[1], Z]
/** Наклон пробирки: отверстие на 8° ниже дна; поворот вокруг Z от вертикали. */
const TILT = (8 * Math.PI) / 180
const TH = -(Math.PI / 2 + TILT)
const DIR: V3 = [Math.cos(TILT), -Math.sin(TILT), 0]
/**
 * Газоотводная трубка в осях стола, начало — центр отверстия пробирки: 3 см по оси пробирки (через пробку), затем
 * горизонтально 7,5 см до отвода U-трубки. Отверстие пробирки M и дно TB — из этого условия.
 */
const P1: V3 = [0.02 * DIR[0], 0.02 * DIR[1], 0]
const G1_LEN = 0.075
const G1: readonly V3[] = [[-0.01 * DIR[0], -0.01 * DIR[1], 0], P1, [P1[0] + 0.012, P1[1], 0], [P1[0] + G1_LEN, P1[1], 0]]
const M: V3 = [UIN[0] - P1[0] - G1_LEN, UIN[1] - P1[1], Z]
const TB: V3 = [M[0] - TUBE_H * DIR[0], M[1] - TUBE_H * DIR[1], Z]
const at = (k: number): V3 => [TB[0] + DIR[0] * k, TB[1] + DIR[1] * k, Z]
/** Лапка — у отверстия (на 11,5 см от дна); спиртовка — под порошком. */
const CL = at(0.115)
const ROD_BACK = 0.1
const LAMP: V3 = [at(0.036)[0], 0, Z]
const MATCHBOX: V3 = [LAMP[0] + 0.075, 0, 0.05]
/** Пробирка в подставке на весах А и в штативе. */
const HOLD: V3 = [PA[0], PA[1] + TUBE_BLOCK.seat, PA[2]]
const IN_RACK: V3 = [TRK[0], 0.012, TRK[2]]
/** Пробка с газоотводной трубкой лежит на столе (начало — центр её узкого торца). */
const ST_REST: V3 = [-0.06, 0.0118, 0.06]
/** Г-образная выходная трубка: от отвода U-трубки вправо и вниз, в стаканчик с известковой водой. */
const G2: readonly V3[] = [
  [0, 0, 0],
  [0.068, 0, 0],
  [0.077, -0.007, 0],
  [0.08, -0.02, 0],
  [0.08, -0.1, 0],
]
const LB: V3 = [GJ[0] + 0.08, 0, Z]
const G2_REST: V3 = [0.02, 0.003, 0.12]
const LIME_ML = 30
const LIME_Y = beakerLevel(BEAKERS[50], LIME_ML)

const C = { powder: '#dcd7ca', lime: '#eef4f7', milk: '#f6f6f2', rubber: '#5f6670' } as const

/** Сколько смеси в пробирке (доля): 4 переноса шпателем, последние — меньше. */
const CUM = [0.32, 0.62, 0.86, 1]
const TRIP = 0.2
const T0 = 3.06
const tipAt = (i: number) => T0 + i * TRIP + TRIP * 0.62
const mixFrac: PFn = (p) => {
  let f = 0
  for (let i = 0; i < CUM.length; i++) f = mix(f, CUM[i]!, ease(p, tipAt(i), tipAt(i) + 0.03))
  return f
}
const flame: PFn = (p) => ease(p, 7.22, 7.28) * (1 - ease(p, 8.5, 8.56))
const capOff: PFn = (p) => ease(p, 7.02, 7.14) * (1 - ease(p, 8.45, 8.62))
const gasRate: PFn = (p) => hill(p, 7.36, 7.96, 0.12)

/** Пробирка: штатив → подставка на весах → лапка (наклон) → подставка. Начало — дно. */
function tubePose(p: number): PoseValue {
  const up = (v: V3, y: number): V3 => [v[0], y, v[2]]
  const w1: V3 = [TB[0], TB[1] + 0.01, Z + 0.075]
  let pos: V3 = track(IN_RACK, [[1, 1.7, HOLD, 0.12]])(p)
  let rot = 0
  if (p > 5) {
    pos = mixV(HOLD, up(HOLD, 0.17), ease(p, 5, 5.14))
    pos = mixV(pos, w1, ease(p, 5.12, 5.58))
    pos = mixV(pos, TB, ease(p, 5.58, 5.7))
    rot = TH * ease(p, 5.16, 5.52)
  }
  if (p > 10.18) {
    pos = mixV(TB, w1, ease(p, 10.18, 10.28))
    pos = mixV(pos, up(HOLD, 0.17), ease(p, 10.26, 10.78))
    pos = mixV(pos, HOLD, ease(p, 10.78, 10.92))
    rot = TH * (1 - ease(p, 10.3, 10.66))
  }
  return { pos, rot: [0, 0, rot] }
}

/** Пробка с газоотводной трубкой (оси стола, начало — у отверстия): со стола → в отверстие → обратно на стол. */
function stopperPose(p: number): PoseValue {
  const out: V3 = [M[0] + DIR[0] * 0.035, M[1] + DIR[1] * 0.035, Z]
  const lifted: V3 = [ST_REST[0], 0.15, ST_REST[2]]
  let pos: V3 = ST_REST
  if (p > 5.7) {
    pos = mixV(ST_REST, lifted, ease(p, 5.7, 5.78))
    pos = mixV(pos, out, ease(p, 5.77, 5.91))
    pos = mixV(pos, M, ease(p, 5.91, 5.98))
  }
  if (p > 10) {
    pos = mixV(M, out, ease(p, 10, 10.05))
    pos = mixV(pos, lifted, ease(p, 10.05, 10.12))
    pos = mixV(pos, ST_REST, ease(p, 10.12, 10.18))
  }
  return { pos }
}

/** Г-образная трубка: лежит на столе → в известковую воду и на отвод U-трубки → вынута и снова на столе. */
function g2Pose(p: number): PoseValue {
  const lying = -Math.PI / 2
  const high: V3 = [G2_REST[0], 0.25, G2_REST[2]]
  const above: V3 = [GJ[0], GJ[1] + 0.12, Z]
  let pos: V3 = G2_REST
  let rx = lying
  if (p > 6.6) {
    pos = mixV(G2_REST, high, ease(p, 6.6, 6.72))
    pos = mixV(pos, above, ease(p, 6.7, 6.85))
    pos = mixV(pos, GJ, ease(p, 6.85, 6.96))
    rx = lying * (1 - ease(p, 6.62, 6.76))
  }
  if (p > 8) {
    pos = mixV(GJ, above, ease(p, 8, 8.12))
    pos = mixV(pos, high, ease(p, 8.12, 8.26))
    pos = mixV(pos, G2_REST, ease(p, 8.26, 8.4))
    rx = lying * ease(p, 8.16, 8.3)
  }
  return { pos, rot: [rx, 0, 0] }
}

function spatulaPose(p: number) {
  const rest: V3 = [JAR[0] - 0.07, 0.003, JAR[2] + 0.04]
  const inJar: V3 = [JAR[0] - 0.006, 0.045, JAR[2]]
  const over: V3 = [HOLD[0] + 0.004, HOLD[1] + TUBE_H + 0.03, HOLD[2]]
  if (p <= 3 || p >= 4) return { pos: rest, rot: [0, 0, 0] as V3, full: 0 }
  if (p < T0) return { pos: mixV(mixV(rest, [rest[0], 0.12, rest[2]], ease(p, 3, 3.02)), inJar, ease(p, 3.015, T0)), rot: [0, 0, 1.1 * ease(p, 3, T0)] as V3, full: 0 }
  const end = T0 + CUM.length * TRIP
  if (p >= end) {
    const k = ease(p, end, 3.98)
    return { pos: mixV(mixV(over, [over[0], 0.32, over[2]], ease(p, end, end + 0.03)), rest, ease(p, end + 0.02, 3.98)), rot: [0, 0, mix(0.35, 0, k)] as V3, full: 0 }
  }
  const i = Math.floor((p - T0) / TRIP)
  const f = (p - T0) / TRIP - i
  const go = ease(f, 0.2, 0.55) * (1 - ease(f, 0.78, 1))
  const pos = mixV(inJar, over, go)
  const hump = 0.08 * Math.sin(Math.PI * Math.min(1, Math.max(0, f < 0.6 ? (f - 0.2) / 0.35 : (f - 0.78) / 0.22)))
  const roll = -1.3 * hill(f, 0.56, 0.76, 0.3)
  return { pos: [pos[0], pos[1] + hump, pos[2]] as V3, rot: [roll, 0, mix(1.1, 0.35, go)] as V3, full: f > 0.18 && f < 0.62 ? 1 : 0 }
}

/** Смесь в пробирке: стоя — столбик у дна, лёжа (в лапке) — полоса вдоль нижней стенки (локальная +X). */
function Powder({ fill, shrink }: { fill: PFn; shrink: PFn }) {
  const { p } = useRig()
  const ri = TUBE_R * 0.86
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: C.powder, roughness: 1, flatShading: true }), [])
  const matD = useMemo(() => new THREE.MeshStandardMaterial({ color: C.powder, roughness: 1, side: THREE.DoubleSide }), [])
  const col = useRef<THREE.Mesh>(null)
  const slab = useRef<THREE.Group>(null)
  useFrame(() => {
    const pv = p.current ?? 0
    const f = fill(pv)
    const lying = Math.abs(tubePose(pv).rot![2]) > 0.8
    const c = col.current
    if (c) {
      c.visible = !lying && f > 0.01
      const h = Math.max(1e-4, 0.032 * f)
      c.scale.set(1, h, 1)
      c.position.y = TUBE_R * 0.5 + h / 2
    }
    const s = slab.current
    if (s) {
      s.visible = lying && f > 0.01
      const k = shrink(pv)
      s.scale.set(0.85 * k, 1, k)
    }
  })
  return (
    <group>
      <mesh ref={col} material={mat} renderOrder={1}>
        <cylinderGeometry args={[ri * 0.97, ri * 0.7, 1, 20]} />
      </mesh>
      <group ref={slab} position={[0, 0.0085 + 0.028, 0]}>
        <mesh material={matD} renderOrder={1}>
          <cylinderGeometry args={[ri * 0.95, ri * 0.95, 0.056, 20, 1, false, 0, Math.PI]} />
        </mesh>
        {/* верх насыпанного порошка — плоскость по оси пробирки (смотрит вверх, к −X пробирки) */}
        <mesh rotation={[0, -Math.PI / 2, 0]} material={mat} renderOrder={1}>
          <planeGeometry args={[2 * ri * 0.93, 0.056]} />
        </mesh>
      </group>
    </group>
  )
}

export function Nahco3MixRig() {
  const v = useLabTaskValues(ID)
  const { lang } = useRig()
  useGearStep(ID, 0)
  useSoundAt(0.2, 'click', PPE, 0.5)
  useSoundAt(1.68, 'glass-clink', HOLD, 0.35)
  useSoundAt(2.3, 'click', [SA[0] + SCALES.tareBtn[0], 0.02, SA[2] + 0.1], 0.5)
  useSoundAt(4.68, 'glass-place', PB, 0.35)
  useSoundAt(5.97, 'glass-place', M, 0.3)
  useSoundAt(6.55, 'glass-clink', UIN, 0.3)
  useSoundAt(7.22, 'flame-on', LAMP, 0.5)
  useSoundAt(7.4, 'bubble', LB, 0.35)
  useSoundAt(8.06, 'splash', LB, 0.2)
  useSoundAt(8.6, 'click', LAMP, 0.4)
  useSoundAt(9.78, 'glass-place', PB, 0.35)
  useSoundAt(10.92, 'glass-clink', HOLD, 0.35)
  useSoundAt(10.97, 'success', HOLD, 0.35)

  const mMix = v.mMix ?? 6.02
  const mRes = v.mRes ?? 5.09
  const m1 = v.m1 ?? 61.48
  const m2 = v.m2 ?? 61.73
  const mGlass = v.mGlass ?? 9.12
  const mBlock = v.mBlock ?? 15.4

  const readingA = (p: number) => {
    const tubeOn = (p >= 1.68 && p < 5.05) || p >= 10.9
    const content = p >= 10.9 ? mRes : mMix * mixFrac(p)
    const tare = p >= 2.45 ? mBlock + mGlass : 0
    return mBlock + (tubeOn ? mGlass + content : 0) - tare
  }
  const readingB = (p: number) => (p >= 4.68 && p < 6.02 ? m1 : p >= 9.78 ? m2 : 0)

  const uPose = track(UA, [
    [4, 4.7, PB, 0.24],
    [6, 6.42, [UA[0] + 0.035, 0, Z], 0.24],
    [6.42, 6.55, UA],
    [9.02, 9.12, [UA[0] + 0.035, 0, Z]],
    [9.12, 9.8, PB, 0.24],
  ])
  const sp = (p: number) => spatulaPose(p)
  const tubeTop: PFn = (p) => HOLD[1] + TUBE_R * 0.5 + 0.032 * mixFrac(p)

  return (
    <group>
      <group position={PPE as unknown as THREE.Vector3Tuple}>
        <PpeTray worn={(p) => ease(p, 0, 0.95)} gloves={false} />
        <Target name="ppe" size={[0.16, 0.05, 0.1]} center={[0, 0.02, 0]} hintY={0.08} />
      </group>

      {/* весы А: подставка для пробирки, кнопка тары */}
      <group position={SA as unknown as THREE.Vector3Tuple}>
        <DigitalScales reading={readingA} readout={readoutAfter(3, 10)} />
        <group position={SCALES.tareBtn as unknown as THREE.Vector3Tuple}>
          <Target name="tare" size={[0.03, 0.03, 0.03]} center={[0, 0, 0.004]} hintY={0.05} ring={false} />
        </group>
      </group>
      <group position={[PA[0], PA[1], PA[2]]}>
        <TubeBlock />
      </group>
      {/* весы Б — для U-трубки */}
      <group position={SB as unknown as THREE.Vector3Tuple}>
        <DigitalScales reading={readingB} readout={readoutAfter(4, 9)} />
      </group>

      {/* штатив для пробирок, пробирка со смесью */}
      <group position={[TRK[0], 0, TRK[2]]}>
        <TubeRack xs={[0]} holeTop={0.06} />
      </group>
      <Pose pose={tubePose}>
        <TestTube />
        <Powder fill={mixFrac} shrink={(p) => mix(1, 0.9, ease(p, 7.4, 7.95))} />
        <WallDroplets r={TUBE_R * 0.86 - 0.0007} y0={0.088} y1={0.136} show={(p) => ease(p, 7.3, 7.78) * (1 - 0.6 * ease(p, 8.7, 10))} side={0} n={26} />
        <Target name="tube" size={[0.04, 0.16, 0.04]} center={[0, 0.075, 0]} hintY={0.18} ring={false} />
      </Pose>

      {/* банка со смесью и шпатель */}
      <group position={JAR as unknown as THREE.Vector3Tuple}>
        <PowderJar formula="Na₂CO₃ + NaHCO₃" name={{ ru: 'смесь солей', en: 'salt mixture', uz: 'tuzlar aralashmasi' }[lang]} color={C.powder} fill={0.6} open={(p) => ease(p, 2.9, 3) * (1 - ease(p, 3.95, 4))} />
      </group>
      <Pose pose={(p) => ({ pos: sp(p).pos, rot: sp(p).rot })}>
        <Spatula full={(p) => sp(p).full} color={C.powder} />
        <Target name="spatula" size={[0.15, 0.03, 0.04]} center={[0.06, 0.004, 0]} hintY={0.05} ring={false} />
      </Pose>
      <Falling from={[HOLD[0], HOLD[1] + TUBE_H + 0.02, HOLD[2]]} toY={tubeTop} a={T0 + 0.1} b={T0 + CUM.length * TRIP} n={16} color={C.powder} size={0.0022} jitter={0.003} />

      {/* штатив с лапкой у отверстия пробирки */}
      <group position={[CL[0], 0, Z - ROD_BACK]}>
        <StandRod h={CL[1] + 0.06} />
      </group>
      <group position={CL as unknown as THREE.Vector3Tuple}>
        <TubeClampH rodBack={ROD_BACK} tilt={-TILT} />
      </group>

      {/* пробка с газоотводной трубкой (резиновая муфта на конце — на отвод U-трубки) */}
      <Pose pose={stopperPose}>
        <mesh position={[-0.003 * DIR[0], -0.003 * DIR[1], 0]} rotation={[0, 0, TH]} castShadow>
          <cylinderGeometry args={[0.0108, 0.0085, 0.018, 20]} />
          <meshStandardMaterial color={C.rubber} roughness={0.85} />
        </mesh>
        <GlassPath points={G1} radius={0.0028} />
        <mesh position={[P1[0] + G1_LEN + 0.003, P1[1], 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0046, 0.0046, 0.018, 12, 1, true]} />
          <meshStandardMaterial color={C.rubber} roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
      </Pose>

      {/* U-трубка с CaCl₂ */}
      <Pose pose={(p) => ({ pos: uPose(p) })}>
        <UTube wet={(p) => ease(p, 7.4, 7.95)} />
        <Target name="utube" size={[0.1, 0.14, 0.07]} center={[0, 0.07, 0]} hintY={0.17} />
      </Pose>

      {/* Г-образная трубка в известковую воду (муфта на конце — на выходной отвод U-трубки) */}
      <Pose pose={g2Pose}>
        <GlassPath points={G2} radius={0.0028} />
        <mesh position={[-0.003, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0046, 0.0046, 0.018, 12, 1, true]} />
          <meshStandardMaterial color={C.rubber} roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
        <Target name="outlet" size={[0.03, 0.1, 0.03]} center={[0.08, -0.05, 0]} hintY={0.08} ring={false} />
      </Pose>
      <group position={LB as unknown as THREE.Vector3Tuple}>
        <MeasuringBeaker size={BEAKERS[50]} volume={() => LIME_ML} color={() => C.lime} cloud={(p) => 0.85 * ease(p, 7.45, 7.92)} solidColor={C.milk} />
        <BandTag r={BEAKERS[50].ri + 0.0017} y={0.044} formula="Ca(OH)₂" name={{ ru: 'известк. вода', en: 'limewater', uz: 'ohakli suv' }[lang]} h={0.018} stripe="#7a8c9e" />
      </group>
      <RisingBubbles r={0.004} x={LB[0]} z={Z} fromY={() => 0.016} toY={() => LIME_Y} rate={gasRate} n={30} />

      {/* спиртовка под порошком, спички */}
      <LampSet lamp={LAMP} matchbox={MATCHBOX} flame={flame} capOff={capOff} lightAt={7.06} />
      <group position={LAMP as unknown as THREE.Vector3Tuple}>
        <Target name="lamp" size={[0.08, 0.1, 0.08]} center={[0, 0.045, 0]} hintY={0.15} />
      </group>
    </group>
  )
}
