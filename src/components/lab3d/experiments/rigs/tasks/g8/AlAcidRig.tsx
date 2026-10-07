/**
 * task-g8-al-acid (Kimyo 8, с. 140, задача 4), вытяжной шкаф: 0,54 г алюминиевой стружки + 20 %-я H₂SO₄ из бюретки.
 * Шаги: 0 защита · 1 навеска (весы, шпатель) · 2 стружка в колбу · 3 заполнить бюретку через воронку, воронку снять ·
 * 4 стакан для слива под носик, кран — до «0», стакан убрать · 5 колба на плитку под бюретку · 6 ~5 мл без нагрева
 * (единичные пузырьки — плёнка Al₂O₃) · 7 плитка 60 °C (бурно H₂) · 8 кислота порциями до растворения, отсчёт ·
 * 9 плитку выключить. Все числа на приборах — из показаний попытки (useLabTaskValues).
 */
import * as THREE from 'three'
import { BOTTLE_H, ReagentBottle } from '../../../parts/glassware'
import { Falling, PpeTray, Puffs } from '../../../parts/practicalware'
import { Pose, Target, ease, hill, mix, useRig, useSoundAt, type PFn, type V3 } from '../../../rigCore'
import { Spatula } from '../../worksKit'
import { PourStream } from '../../../parts/effects'
import { useGearStep } from '../../useGearStep'
import { useLabTaskValues } from '../../../../measure/labTaskSession'
import { fmtNum } from '../../../../measure/instruments'
import { DigitalScales, Readout, SCALES_PAN_CENTER } from '../../../../measure/devices/Scales'
import { BEAKERS, MeasuringBeaker, RisingBubbles, beakerLevel } from '../../../../measure/devices/Glass'
import { BOAT, PowderJar, WeighBoat } from '../../../../measure/devices/Bench'
import { BURETTE, Burette, BuretteStand } from '../../../../measure/devices/Burette'
import { HOTPLATE_SEAT, HotPlate } from '../../../../measure/devices/HotPlate'
import { AL } from '../../../../../../data/labTasks/g8/alAcid'
import { ConicalFlask, FLASK, MetalPieces, flaskLevel, moveVia, pourPose } from './g8Kit'
import { FUNNEL_BURETTE, SmallFunnel, funnelSeatY, useHoodSashAt } from './kitG8b'

const ID = 'task-g8-al-acid' as const
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const PAN: V3 = add(AL.scales, SCALES_PAN_CENTER)
const SEAT: V3 = add(AL.plate, HOTPLATE_SEAT)
const TIP: V3 = [SEAT[0], AL.tipY, SEAT[2]]
const BUR_TOP = AL.tipY + BURETTE.top
/** Воронка в горле бюретки: конец трубки внутри, конус опирается на край. */
const FUNNEL_IN: V3 = [TIP[0], BUR_TOP - funnelSeatY(FUNNEL_BURETTE, BURETTE.ro + 0.0006), TIP[2]]
/** Воронка на столе — вверх дном, стоит на краю. */
const FUNNEL_H = FUNNEL_BURETTE.stem + FUNNEL_BURETTE.coneH + 0.0012
const PIECES = 8
const C_AL = '#b4bcc5'
const C_ACID = '#bcd5f2'
const C_SOL = '#d2e4f8'
const WASTE_ML = 0.8

/** Стружка в лодочке: два захода шпателем (5 + 3). */
const inBoat: PFn = (p) => 5 * ease(p, 1.48, 1.56) + 3 * ease(p, 1.84, 1.9)

/** Кран бюретки: открыт на отрезках [a, b]. */
const COCK: readonly (readonly [number, number])[] = [
  [4.36, 4.6],
  [6.06, 6.7],
  [8.04, 8.25],
  [8.29, 8.5],
  [8.54, 8.72],
]
const cockOpen: PFn = (p) => COCK.reduce((s, [a, b]) => Math.max(s, ease(p, a, a + 0.035) * (1 - ease(p, b - 0.01, b + 0.025))), 0)

export function AlAcidRig() {
  const { lang } = useRig()
  const v = useLabTaskValues(ID)
  const mAl = v.mAl!
  const V1 = v.V1!
  const V = v.V!
  const f1 = (0.97 * V1) / V

  useGearStep(ID, 0)
  // планка створки — выше шкалы бюретки (0 мл — 0,5 м над столом): мениск виден на уровне глаз
  useHoodSashAt(0.24)
  useSoundAt(0.2, 'click', AL.ppe, 0.5)
  useSoundAt(1.05, 'click', add(AL.scales, [0.058, 0.02, 0.1]), 0.5)
  useSoundAt(1.5, 'glass-clink', PAN, 0.3)
  useSoundAt(2.46, 'glass-clink', [AL.flask0[0], 0.01, AL.flask0[2]], 0.3)
  useSoundAt(3.46, 'pour', [TIP[0], BUR_TOP, TIP[2]], 0.45)
  useSoundAt(4.3, 'glass-place', SEAT, 0.4)
  useSoundAt(4.4, 'pour', TIP, 0.25)
  useSoundAt(5.9, 'glass-place', SEAT, 0.45)
  useSoundAt(6.1, 'pour', TIP, 0.3)
  useSoundAt(7.06, 'click', add(AL.plate, [0.05, 0.026, 0.1]), 0.6)
  useSoundAt(7.4, 'fizz', [SEAT[0], SEAT[1] + 0.03, SEAT[2]], 0.7)
  useSoundAt(8.06, 'fizz', [SEAT[0], SEAT[1] + 0.03, SEAT[2]], 0.6)
  useSoundAt(9.05, 'click', add(AL.plate, [0.05, 0.026, 0.1]), 0.6)

  /* ── бюретка: отсчёт по мениску (null — пустая) ── */
  const reading = (p: number): number | null => {
    if (p < 3.46) return null
    if (p < 4.4) return mix(25.6, -0.8, ease(p, 3.46, 3.74))
    if (p < 6.12) return mix(-0.8, 0, ease(p, 4.4, 4.58))
    if (p < 8.05) return mix(0, V1, ease(p, 6.12, 6.68))
    const d = V - V1
    return V1 + d * (0.45 * ease(p, 8.05, 8.24) + 0.35 * ease(p, 8.3, 8.49) + 0.2 * ease(p, 8.55, 8.71))
  }
  const delivered: PFn = (p) => (p < 6 ? 0 : Math.max(0, reading(p) ?? 0))
  const wasteMl: PFn = (p) => WASTE_ML * ease(p, 4.4, 4.58)

  /* ── реакция: без нагрева почти ничего, при нагреве — пока есть кислота ── */
  const reacted: PFn = (p) => {
    if (p < 7.3) return 0.012 * ease(p, 6.2, 6.95)
    if (p < 8) return mix(0.012, f1, ease(p, 7.3, 7.95))
    return mix(f1, 1, ease(p, 8.05, 8.86))
  }
  const fizz: PFn = (p) =>
    0.08 * hill(p, 6.15, 6.98, 0.1) +
    ease(p, 7.35, 7.55) * (1 - 0.7 * ease(p, 7.6, 7.98)) * (1 - ease(p, 7.98, 8.02)) +
    (0.4 + 0.6 * hill(p, 8.05, 8.75, 0.08)) * ease(p, 8.0, 8.06) * (1 - ease(p, 8.8, 8.92))
  const plateOn: PFn = (p) => ease(p, 7.02, 7.1) * (1 - ease(p, 9.02, 9.1))
  const plateT: PFn = (p) => (p < 9.05 ? mix(22, 60, ease(p, 7.1, 7.7)) : mix(60, 47, ease(p, 9.05, 9.95)))

  /* ── весы ── */
  const scalesReading = (p: number) => {
    if (p < 1.06) return BOAT.mass
    if (p < 2.04) return (mAl * Math.round(inBoat(p))) / PIECES
    if (p < 2.95) return -BOAT.mass
    return 0
  }
  const boatFill: PFn = (p) => (inBoat(p) / PIECES) * (1 - ease(p, 2.44, 2.56))

  /* ── позы ── */
  const spoon = (p: number) => {
    const rest: V3 = [AL.spatula[0], 0, AL.spatula[2]]
    const overJar: V3 = [AL.jar[0], 0.15, AL.jar[2]]
    const inJar: V3 = [AL.jar[0], 0.048, AL.jar[2]]
    const overBoat: V3 = [PAN[0] + 0.004, 0.072, PAN[2]]
    const hi: V3 = [PAN[0], 0.15, PAN[2]]
    const pos = moveVia(p, rest, [
      [1.08, 1.14, [rest[0], 0.12, rest[2]]],
      [1.12, 1.2, overJar],
      [1.2, 1.26, inJar],
      [1.26, 1.32, overJar],
      [1.32, 1.4, hi],
      [1.4, 1.46, overBoat],
      [1.56, 1.6, hi],
      [1.6, 1.66, overJar],
      [1.66, 1.71, inJar],
      [1.71, 1.75, overJar],
      [1.75, 1.8, hi],
      [1.8, 1.84, overBoat],
      [1.9, 1.94, [rest[0], 0.12, rest[2]]],
      [1.94, 1.99, rest],
    ])
    const up = ease(p, 1.1, 1.18) * (1 - ease(p, 1.92, 1.98))
    const tip = hill(p, 1.46, 1.56, 0.3) + hill(p, 1.84, 1.9, 0.3)
    return { pos, rot: [-1.1 * tip, 0, 0.9 * up - 0.5 * tip] as V3 }
  }
  const spoonFull: PFn = (p) => ease(p, 1.22, 1.24) * (1 - ease(p, 1.47, 1.54)) + ease(p, 1.67, 1.69) * (1 - ease(p, 1.85, 1.89))

  const boatPose = (p: number) => {
    const over: V3 = [AL.flask0[0] + 0.036, FLASK.h + 0.03, AL.flask0[2]]
    const pos = moveVia(p, PAN, [
      [2, 2.14, [PAN[0], 0.2, PAN[2]]],
      [2.12, 2.36, [over[0], 0.2, over[2]]],
      [2.34, 2.42, over],
      [2.66, 2.74, [over[0], 0.2, over[2]]],
      [2.72, 2.9, [PAN[0], 0.2, PAN[2]]],
      [2.88, 2.97, PAN],
    ])
    const tilt = ease(p, 2.4, 2.48) * (1 - ease(p, 2.6, 2.68))
    return { pos, rot: [0, 0, 0.95 * tilt] as V3 }
  }

  // склянка наливает в воронку на бюретке (s = 3), затем воронку вынимают и ставят на стол вверх дном
  const bottle = pourPose(AL.bottle, 3, [FUNNEL_IN[0] + 0.012, FUNNEL_IN[1] + FUNNEL_H + 0.008, FUNNEL_IN[2]], BOTTLE_H, 1.75, 0.029)
  const funnelPose = (p: number) => {
    const restUp: V3 = [AL.funnelRest[0], FUNNEL_H, AL.funnelRest[2]]
    const pos = moveVia(p, FUNNEL_IN, [
      [3.86, 3.9, [FUNNEL_IN[0], FUNNEL_IN[1] + 0.05, FUNNEL_IN[2]]],
      [3.9, 3.96, [restUp[0], FUNNEL_IN[1] + 0.05, restUp[2]]],
      [3.96, 3.995, restUp],
    ])
    const flip = ease(p, 3.9, 3.96)
    return { pos, rot: [Math.PI * flip, 0, 0] as V3 }
  }

  const wastePose = (p: number) => {
    const hi = SEAT[1] + 0.03
    const pos = moveVia(p, AL.waste, [
      [4, 4.08, [AL.waste[0], hi, AL.waste[2]]],
      [4.08, 4.24, [SEAT[0], hi, SEAT[2]]],
      [4.24, 4.32, SEAT],
      [4.66, 4.74, [SEAT[0], hi, SEAT[2]]],
      [4.74, 4.9, [AL.waste[0], hi, AL.waste[2]]],
      [4.9, 4.98, AL.waste],
    ])
    return { pos }
  }

  // колба: со стола → над краем плитки → на уровень конфорки → скользит под носик (горло проходит ниже носика)
  const flaskPose = (p: number) => {
    const lift = SEAT[1] + 0.016
    const pos = moveVia(p, AL.flask0, [
      [5, 5.14, [AL.flask0[0], lift, AL.flask0[2]]],
      [5.14, 5.46, [SEAT[0] - 0.09, lift, SEAT[2]]],
      [5.46, 5.56, [SEAT[0] - 0.09, SEAT[1] + 0.002, SEAT[2]]],
      [5.56, 5.84, [SEAT[0], SEAT[1] + 0.002, SEAT[2]]],
      [5.84, 5.9, SEAT],
    ])
    return { pos }
  }

  const flaskLiquidY = (p: number) => SEAT[1] + flaskLevel(delivered(p))
  const streamTo: PFn = (p) => {
    if (p < 5) return SEAT[1] + beakerLevel(BEAKERS[50], Math.max(0.2, wasteMl(p))) - AL.tipY
    return flaskLiquidY(p) - AL.tipY
  }

  return (
    <group>
      <group position={AL.ppe as unknown as THREE.Vector3Tuple}>
        <PpeTray worn={(p) => ease(p, 0, 0.95)} coat />
        <Target name="ppe" size={[0.16, 0.05, 0.1]} center={[0, 0.02, 0]} hintY={0.08} />
      </group>

      {/* Весы, лодочка, банка с алюминием, шпатель */}
      <group position={AL.scales as unknown as THREE.Vector3Tuple}>
        <DigitalScales reading={scalesReading} readout={(p) => hill(p, 1.4, 3.35, 0.02)} />
      </group>
      <Pose pose={boatPose}>
        <WeighBoat fill={boatFill} kind="ribbon" color={C_AL} maxPieces={PIECES} />
        <Target name="boat" size={[0.06, 0.03, 0.05]} center={[0, 0.008, 0]} hintY={0.06} ring={false} />
      </Pose>
      <group position={AL.jar as unknown as THREE.Vector3Tuple}>
        <PowderJar formula="Al" name={{ ru: 'алюминий, стружка', en: 'aluminium turnings', uz: 'alyuminiy qirindisi' }[lang]} color={C_AL} granules open={(p) => ease(p, 1, 1.1) * (1 - ease(p, 1.9, 1.99))} />
      </group>
      <Pose pose={spoon}>
        <Spatula full={spoonFull} color={C_AL} />
        <group position={[0.06, 0, 0]}>
          <Target name="spatula" size={[0.14, 0.03, 0.04]} center={[0, 0.005, 0]} hintY={0.05} />
        </group>
      </Pose>
      <Falling from={[PAN[0] + 0.004, 0.068, PAN[2]]} toY={() => PAN[1] + 0.004} a={1.47} b={1.56} n={5} color={C_AL} size={0.0024} box />
      <Falling from={[PAN[0] + 0.004, 0.068, PAN[2]]} toY={() => PAN[1] + 0.004} a={1.84} b={1.9} n={3} color={C_AL} size={0.0024} box />
      <Falling from={[AL.flask0[0] + 0.006, FLASK.h + 0.02, AL.flask0[2]]} toY={() => 0.006} a={2.44} b={2.6} n={PIECES} color={C_AL} size={0.0026} box />

      {/* Коническая колба: стол → плитка */}
      <Pose pose={flaskPose}>
        <ConicalFlask volume={delivered} color={() => C_SOL} />
        <MetalPieces n={PIECES} show={(p) => ease(p, 2.5, 2.62)} left={(p) => 1 - reacted(p)} color={C_AL} spread={0.017} kind="chip" size={0.0046} />
        <RisingBubbles r={0.017} fromY={() => 0.006} toY={(p) => flaskLevel(delivered(p))} rate={fizz} n={48} />
        <Target name="flask" size={[0.07, 0.11, 0.07]} center={[0, 0.055, 0]} hintY={0.15} />
      </Pose>
      {/* лёгкий пар и водород над горячей колбой — уходят в тягу */}
      <Puffs origin={[SEAT[0], SEAT[1] + FLASK.h + 0.01, SEAT[2]]} count={14} opacity={0.22} rate={(p) => 0.5 * ease(p, 7.5, 7.7) * (1 - ease(p, 9.2, 9.9))} />

      {/* Электроплитка */}
      <group position={AL.plate as unknown as THREE.Vector3Tuple}>
        <HotPlate on={plateOn} temp={plateT} />
        <group position={[0.05, 0, 0.1]}>
          <Target name="knob" size={[0.05, 0.05, 0.04]} center={[0, 0.026, 0]} hintY={0.08} />
        </group>
      </group>
      <Readout
        position={[AL.plate[0] - 0.05, 0.085, AL.plate[2] + 0.1]}
        label={{ ru: 'плитка', en: 'hot plate', uz: 'plitka' }}
        text={(p, l) => (p > 7.4 && p < 8 ? `${fmtNum(plateT(p), 0, l)} °C` : null)}
      />

      {/* Бюретка на штативе; струйка из носика */}
      <BuretteStand rod={AL.rod} at={[TIP[0], TIP[2]]} clampY={AL.tipY + BURETTE.y0 + 0.021} rodH={0.6} />
      <group position={TIP as unknown as THREE.Vector3Tuple}>
        <Burette reading={reading} open={cockOpen} flow={(p) => (p > 3.9 ? cockOpen(p) : 0)} streamTo={streamTo} color={C_ACID} />
        <group position={[0, BURETTE.cockY, 0.012]}>
          <Target name="stopcock" size={[0.05, 0.04, 0.04]} center={[0, 0, 0]} hintY={0.05} ring={false} />
        </group>
      </group>
      <Readout
        position={[TIP[0] + 0.045, AL.zeroY - 0.05, TIP[2]]}
        label={{ ru: 'бюретка', en: 'burette', uz: 'byuretka' }}
        text={(p, l) => {
          const unit = l === 'ru' ? 'мл' : 'ml'
          if (p > 4.6 && p < 5.2) return `${fmtNum(0, 2, l)} ${unit}`
          if (p > 6.72 && p < 7.3) return `${fmtNum(V1, 2, l)} ${unit}`
          if (p > 8.74) return `${fmtNum(V, 2, l)} ${unit}`
          return null
        }}
      />

      {/* Воронка для заливки бюретки */}
      <Pose pose={funnelPose}>
        <SmallFunnel size={FUNNEL_BURETTE} />
      </Pose>

      {/* Склянка 20 %-й серной кислоты */}
      <Pose pose={bottle}>
        <group position={[0, BOTTLE_H, 0]}>
          <ReagentBottle formula="H₂SO₄ 20 %" name={{ ru: 'ρ = 1,14 г/мл', en: 'ρ = 1.14 g/ml', uz: 'ρ = 1,14 g/ml' }[lang]} level={(p) => mix(0.88, 0.6, ease(p, 3.46, 3.74))} />
        </group>
        <Target name="bottle" size={[0.07, 0.13, 0.07]} center={[0, 0.06, 0]} hintY={0.16} />
      </Pose>
      <PourStream x={FUNNEL_IN[0] + 0.006} z={FUNNEL_IN[2]} top={() => FUNNEL_IN[1] + FUNNEL_H + 0.006} bottom={() => FUNNEL_IN[1] + FUNNEL_BURETTE.stem + 0.004} show={(p) => hill(p, 3.46, 3.74, 0.15)} color={C_ACID} />

      {/* Стакан для слива */}
      <Pose pose={wastePose}>
        <MeasuringBeaker size={BEAKERS[50]} volume={wasteMl} color={() => C_ACID} />
        <Target name="waste" size={[0.05, 0.06, 0.05]} center={[0, 0.03, 0]} hintY={0.08} />
      </Pose>
    </group>
  )
}
