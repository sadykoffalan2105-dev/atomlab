/**
 * task-g8-zn-hcl-gas (Kimyo 8, с. 14): 1,30 г цинка + 25 мл 10 %-й HCl в колбе, водород — над водой в цилиндр 500 мл.
 * Шаги: 0 защита · 1 навеска цинка (весы, шпатель) · 2 цинк в колбу · 3 кислота в цилиндр · 4 кислота в колбу ·
 * 5 пробка с трубкой · 6 сбор газа (ускорено) · 7 трубку в сторону, уровни выровнять, V · 8 термометр в ванну, t.
 * Все числа на приборах — из показаний попытки (useLabTaskValues).
 */
import * as THREE from 'three'
import { BOTTLE_H, LabStand, ReagentBottle } from '../../../parts/glassware'
import { PourStream } from '../../../parts/effects'
import { Falling, GlassPath, PpeTray } from '../../../parts/practicalware'
import { Pose, Target, ease, hill, mix, useRig, useSoundAt, type PFn, type V3 } from '../../../rigCore'
import { RubberHose, Spatula } from '../../worksKit'
import { useGearStep } from '../../useGearStep'
import { useLabTaskValues } from '../../../../measure/labTaskSession'
import { fmtNum } from '../../../../measure/instruments'
import { DigitalScales, Readout, SCALES_PAN_CENTER } from '../../../../measure/devices/Scales'
import { GAS_MOUTH_Y, GasCollector, MeasuringCylinder, RisingBubbles, THERMO, TROUGH, Thermometer, cylinderTop } from '../../../../measure/devices/Glass'
import { BOAT, PowderJar, WeighBoat } from '../../../../measure/devices/Bench'
import { cylinderGeom } from '../../../../measure/quantities'
import { ZH } from '../../../../../../data/labTasks/g8/layoutG8'
import { ConicalFlask, ELBOW, FLASK, FlaskStopper, MetalPieces, flaskLevel, moveVia, pourPose } from './g8Kit'

const ID = 'task-g8-zn-hcl-gas' as const
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const PAN: V3 = add(ZH.scales, SCALES_PAN_CENTER)
const FL = ZH.flask
const NECK_TOP = FL[1] + FLASK.h
const SEAT: V3 = [FL[0], NECK_TOP - 0.014, FL[2]]
const CYL_TOP = cylinderTop(50)
const TR = ZH.trough
/** Газоотводная трубка в ванне (начало — центр дна ванны): через край → вниз → под устье цилиндра. */
const JT: readonly V3[] = [
  [-0.128, 0.095, 0],
  [-0.104, 0.1, 0],
  [-0.09, 0.088, 0],
  [-0.088, 0.03, 0],
  [-0.08, 0.009, 0],
  [-0.06, 0.009, 0],
  [-0.012, 0.009, 0],
  [0, 0.013, 0],
]
const JT_START = add(TR, JT[0]!)
const PIECES = 7
const C_ACID = '#eaf4ff'

/** Сколько гранул уже в лодочке (шаг 1: два захода шпателем). */
const inBoat: PFn = (p) => 5 * ease(p, 1.48, 1.56) + 2 * ease(p, 1.84, 1.9)

export function ZnHclGasRig() {
  const { lang } = useRig()
  const v = useLabTaskValues(ID)
  const mZn = v.mZn!
  const vAcid = v.vAcid!
  const V = v.V!
  const loss = 0.02

  useGearStep(ID, 0)
  useSoundAt(0.2, 'click', ZH.ppe, 0.5)
  useSoundAt(1.05, 'click', add(ZH.scales, [0.058, 0.02, 0.1]), 0.5)
  useSoundAt(1.5, 'glass-clink', PAN, 0.3)
  useSoundAt(2.5, 'glass-clink', [FL[0], FL[1] + 0.01, FL[2]], 0.4)
  useSoundAt(3.46, 'pour', [ZH.cylinder[0], CYL_TOP, ZH.cylinder[2]], 0.5)
  useSoundAt(4.46, 'pour', [FL[0], NECK_TOP, FL[2]], 0.5)
  useSoundAt(4.6, 'fizz', [FL[0], FL[1] + 0.02, FL[2]], 0.75)
  useSoundAt(5.5, 'glass-place', SEAT, 0.5)
  useSoundAt(5.66, 'bubble', [TR[0], 0.03, TR[2]], 0.5)
  useSoundAt(7.4, 'splash', [TR[0], 0.06, TR[2]], 0.25)
  useSoundAt(8.75, 'glass-place', add(TR, ZH.thermoIn), 0.3)

  /* ── реакция: до пробки уходит ~loss водорода; газ в цилиндре — с 5,6 до 6,92 ── */
  const reacted: PFn = (p) => {
    if (p < 5.6) return loss * ease(p, 4.55, 5.6)
    const x = Math.min(1, (p - 5.6) / 1.32)
    return loss + (1 - loss) * ((1 - Math.exp(-3 * x)) / (1 - Math.exp(-3)))
  }
  const gasMl: PFn = (p) => (p < 5.6 ? 0 : V * Math.min(1, (reacted(p) - loss) / (1 - loss)))
  const fizz: PFn = (p) => ease(p, 4.55, 4.66) * (1 - 0.8 * ease(p, 5.8, 6.9)) * (1 - ease(p, 6.86, 6.94))
  // выравнивание уровней: цилиндр опускают, пока вода внутри не сравняется с водой в ванне
  const g500 = cylinderGeom(500)
  const innerTop = g500.scaleH + 0.045 - 0.004
  const waterIn = innerTop - (V / 500) * g500.scaleH
  const drop = Math.max(-0.011, Math.min(0, TROUGH.water - GAS_MOUTH_Y - waterIn))
  const lift: PFn = (p) => drop * ease(p, 7.35, 7.8)
  const tubeAway: PFn = (p) => 0.045 * ease(p, 7.05, 7.32)

  /* ── весы: тара с лодочкой, гранулы, лодочка в руке (минус), пустая лодочка обратно — 0,00 ── */
  const reading = (p: number) => {
    if (p < 1.06) return BOAT.mass
    if (p < 2.04) return (mZn * Math.round(inBoat(p))) / PIECES
    if (p < 2.95) return -BOAT.mass
    return 0
  }
  const boatFill: PFn = (p) => (inBoat(p) / PIECES) * (1 - ease(p, 2.44, 2.56))

  /* ── позы ── */
  const spoon = (p: number) => {
    const rest: V3 = [ZH.spatula[0], 0, ZH.spatula[2]]
    const overJar: V3 = [ZH.jar[0], 0.15, ZH.jar[2]]
    const inJar: V3 = [ZH.jar[0], 0.048, ZH.jar[2]]
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
    const over: V3 = [FL[0] + 0.036, NECK_TOP + 0.03, FL[2]]
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

  const bottle = pourPose(ZH.bottle, 3, [ZH.cylinder[0] + 0.004, CYL_TOP + 0.012, ZH.cylinder[2]], BOTTLE_H, 1.85, 0.029)
  const cyl = pourPose(ZH.cylinder, 4, [FL[0] + 0.004, NECK_TOP + 0.012, FL[2]], CYL_TOP, 1.9, 0.028)
  const cylVol: PFn = (p) => vAcid * ease(p, 3.46, 3.74) * (1 - ease(p, 4.46, 4.74))
  const flaskVol: PFn = (p) => vAcid * ease(p, 4.46, 4.74)

  const stopperPos = (p: number): V3 =>
    moveVia(p, ZH.stopper, [
      [5, 5.16, [ZH.stopper[0], 0.26, ZH.stopper[2]]],
      [5.14, 5.38, [FL[0], 0.2, FL[2]]],
      [5.38, 5.56, SEAT],
    ])

  const jtube = (p: number): V3 => [TR[0], TR[1], TR[2] + tubeAway(p)]

  const thermoPose = (p: number) => {
    const rest: V3 = [ZH.thermometer[0], 0, ZH.thermometer[2]]
    const inBath = add(TR, ZH.thermoIn)
    const pos = moveVia(p, rest, [
      [8, 8.18, [rest[0] + 0.05, 0.12, rest[2]]],
      [8.16, 8.52, [inBath[0], 0.13, inBath[2]]],
      [8.52, 8.78, inBath],
    ])
    const lying = 1 - ease(p, 8.02, 8.2)
    const lean = ZH.thermoLean * ease(p, 8.56, 8.78)
    // лёжа шарик касается стола: подъём оси на радиус шарика
    return { pos: [pos[0], pos[1] + THERMO.bulbR * lying, pos[2]] as V3, rot: [0, 0, lying * -Math.PI / 2 + lean] as V3 }
  }

  const stoppedElbow = (p: number): V3 => add(stopperPos(p), ELBOW)

  return (
    <group>
      <group position={ZH.ppe as unknown as THREE.Vector3Tuple}>
        <PpeTray worn={(p) => ease(p, 0, 0.95)} />
        <Target name="ppe" size={[0.16, 0.05, 0.1]} center={[0, 0.02, 0]} hintY={0.08} />
      </group>

      {/* Весы, лодочка, банка с цинком, шпатель */}
      <group position={ZH.scales as unknown as THREE.Vector3Tuple}>
        <DigitalScales reading={reading} readout={(p) => hill(p, 1.4, 3.35, 0.02)} />
      </group>
      <Pose pose={boatPose}>
        <WeighBoat fill={boatFill} kind="granules" color="#9aa3ab" maxPieces={PIECES} />
        <Target name="boat" size={[0.06, 0.03, 0.05]} center={[0, 0.008, 0]} hintY={0.06} ring={false} />
      </Pose>
      <group position={ZH.jar as unknown as THREE.Vector3Tuple}>
        <PowderJar formula="Zn" name={{ ru: 'цинк гранулир.', en: 'zinc granules', uz: 'rux donador' }[lang]} color="#9aa3ab" granules open={(p) => ease(p, 1, 1.1) * (1 - ease(p, 1.9, 1.99))} />
      </group>
      <Pose pose={spoon}>
        <Spatula full={spoonFull} color="#9aa3ab" />
        <group position={[0.06, 0, 0]}>
          <Target name="spatula" size={[0.14, 0.03, 0.04]} center={[0, 0.005, 0]} hintY={0.05} />
        </group>
      </Pose>
      <Falling from={[PAN[0] + 0.004, 0.068, PAN[2]]} toY={() => PAN[1] + 0.004} a={1.47} b={1.56} n={5} color="#9aa3ab" size={0.0026} />
      <Falling from={[PAN[0] + 0.004, 0.068, PAN[2]]} toY={() => PAN[1] + 0.004} a={1.84} b={1.9} n={2} color="#9aa3ab" size={0.0026} />
      <Falling from={[FL[0] + 0.006, NECK_TOP + 0.02, FL[2]]} toY={() => FL[1] + 0.006} a={2.44} b={2.6} n={PIECES} color="#9aa3ab" size={0.0028} />

      {/* Колба на плите штатива, лапка на горле */}
      <group position={[0, 0, FL[2]]}>
        <LabStand rodX={FL[0] - 0.09} clampX={FL[0]} clampY={FL[1] + 0.092} rodH={0.36} />
      </group>
      <group position={FL as unknown as THREE.Vector3Tuple}>
        <ConicalFlask volume={flaskVol} color={() => '#edf5ff'} />
        <MetalPieces n={PIECES} show={(p) => ease(p, 2.5, 2.62)} left={(p) => 1 - reacted(p)} color="#9aa3ab" spread={0.016} />
        <RisingBubbles r={0.016} fromY={() => 0.006} toY={(p) => flaskLevel(flaskVol(p))} rate={fizz} n={44} />
        <Target name="flask" size={[0.07, 0.11, 0.07]} center={[0, 0.055, 0]} hintY={0.15} />
      </group>

      {/* Мерный цилиндр 50 мл и склянка HCl */}
      <Pose pose={cyl}>
        <MeasuringCylinder capacity={50} volume={cylVol} color={C_ACID} />
        <Target name="cylinder" size={[0.05, 0.19, 0.05]} center={[0, 0.095, 0]} hintY={0.22} />
      </Pose>
      <PourStream x={FL[0] + 0.004} z={FL[2]} top={() => NECK_TOP + 0.01} bottom={(p) => FL[1] + flaskLevel(flaskVol(p))} show={(p) => hill(p, 4.46, 4.74, 0.15)} color={C_ACID} />
      <Pose pose={bottle}>
        <group position={[0, BOTTLE_H, 0]}>
          <ReagentBottle formula="HCl 10 %" name={{ ru: 'соляная кислота', en: 'hydrochloric acid', uz: 'xlorid kislota' }[lang]} level={(p) => mix(0.9, 0.62, ease(p, 3.46, 3.74))} />
        </group>
        <Target name="bottle-hcl" size={[0.07, 0.13, 0.07]} center={[0, 0.06, 0]} hintY={0.16} />
      </Pose>
      <PourStream x={ZH.cylinder[0] + 0.004} z={ZH.cylinder[2]} top={() => CYL_TOP + 0.01} bottom={(p) => 0.011 + (cylVol(p) / 50) * cylinderGeom(50).scaleH} show={(p) => hill(p, 3.46, 3.74, 0.15)} color={C_ACID} />
      <Readout
        position={[ZH.cylinder[0] + 0.05, 0.13, ZH.cylinder[2]]}
        label={{ ru: 'цилиндр', en: 'cylinder', uz: 'silindr' }}
        text={(p, l) => (p > 3.8 && p < 4.3 ? `${fmtNum(vAcid, 1, l)} ${l === 'ru' ? 'мл' : 'ml'}` : null)}
      />

      {/* Пробка с коленом, шланг, газоотводная трубка в ванне */}
      <Pose pose={(p) => ({ pos: stopperPos(p) })}>
        <FlaskStopper />
        <Target name="stopper" size={[0.05, 0.06, 0.05]} center={[0.012, 0.025, 0]} hintY={0.08} />
      </Pose>
      <RubberHose
        ends={(p) => [stoppedElbow(p), [JT_START[0], JT_START[1], JT_START[2] + tubeAway(p)]]}
        dirs={() => [
          [1, 0, 0],
          [-1, 0, 0],
        ]}
      />
      <Pose pose={(p) => ({ pos: jtube(p) })}>
        <GlassPath points={JT} radius={0.0028} />
      </Pose>

      {/* Ванна с цилиндром 500 мл в лапке */}
      <group position={TR as unknown as THREE.Vector3Tuple}>
        <GasCollector capacity={500} gasMl={gasMl} lift={lift} bubble={(p) => ease(p, 5.62, 5.7) * (1 - ease(p, 6.8, 6.92))} />
        <Target name="gas-cylinder" size={[0.06, 0.28, 0.06]} center={[0, 0.17, 0]} hintY={0.34} ring={false} />
      </group>
      <Readout
        position={[TR[0] + 0.07, 0.2, TR[2] + 0.03]}
        label={{ ru: 'газ', en: 'gas', uz: 'gaz' }}
        text={(p, l) => (p > 7.82 ? `V = ${fmtNum(V, 1, l)} ${l === 'ru' ? 'мл' : 'ml'}` : null)}
      />

      {/* Термометр: лежит на столе → в воду ванны, опирается на край */}
      <Pose pose={thermoPose}>
        <Thermometer temp={() => v.t!} />
        <Target name="thermometer" size={[0.03, 0.2, 0.03]} center={[0, 0.1, 0]} hintY={0.24} ring={false} />
      </Pose>
      <Readout
        position={[TR[0] + ZH.thermoIn[0] - 0.05, 0.25, TR[2] + ZH.thermoIn[2]]}
        label={{ ru: 'термометр', en: 'thermometer', uz: 'termometr' }}
        text={(p, l) => (p > 8.84 ? `t = ${fmtNum(v.t!, 1, l)} °C` : null)}
      />
    </group>
  )
}
