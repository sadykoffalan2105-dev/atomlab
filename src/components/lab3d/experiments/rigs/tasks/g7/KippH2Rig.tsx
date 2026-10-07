/**
 * task-g7-kipp-h2 (Kimyo 7, с. 118): 0,39 г цинка + ≈ 10 мл 10 %-й HCl в пробирке с газоотводной трубкой
 * («аппарат Киппа в пробирке»), водород — над водой в перевёрнутый цилиндр 250 мл в высокой банке.
 * Шаги: 0 защита · 1 навеска цинка (весы, шпатель) · 2 цинк в пробирку · 3 кислота · 4 пробка с трубкой ·
 * 5 сбор газа (ускорено) · 6 трубку в сторону, цилиндр вниз до равенства уровней, V · 7 термометр в банку, t.
 * Все числа на приборах — из показаний попытки (useLabTaskValues).
 */
import * as THREE from 'three'
import { BOTTLE_H, LabStand, ReagentBottle, TestTube, TUBE_R } from '../../../parts/glassware'
import { PourStream } from '../../../parts/effects'
import { Falling, GlassPath, PpeTray } from '../../../parts/practicalware'
import { Pose, Target, ease, hill, mix, useRig, useSoundAt, type PFn, type V3 } from '../../../rigCore'
import { RubberHose, Spatula } from '../../worksKit'
import { useGearStep } from '../../useGearStep'
import { useLabTaskValues } from '../../../../measure/labTaskSession'
import { fmtNum } from '../../../../measure/instruments'
import { DigitalScales, Readout } from '../../../../measure/devices/Scales'
import { RisingBubbles, THERMO, Thermometer } from '../../../../measure/devices/Glass'
import { BOAT, PowderJar, WeighBoat } from '../../../../measure/devices/Bench'
import { P0_KPA, TUBE_GEOM, heightForVolume } from '../../../../measure/quantities'
import { KP, KP_PAN, KP_TUBE_TOP } from '../../../../../../data/labTasks/g7/kippH2'
import { GAS_JAR, MeltingGranules, TUBE_ELBOW, TUBE_STOPPER_IN, TallGasJar, TubeStopper, innerWaterY, mouthAtLevel, pourPath, via } from './kitG7b'

const ID = 'task-g7-kipp-h2' as const
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const TB = KP.tube
const TOP = KP_TUBE_TOP
const SEAT: V3 = [TB[0], TOP - TUBE_STOPPER_IN, TB[2]]
const BA = KP.bath
const PIECES = 5
const ACID_ML = 10
const C_ACID = '#eaf4ff'
const LOSS = 0.02
/** Газоотводная трубка в банке: ось вертикального колена (поворачивают вокруг неё, отводя конец в сторону). */
const PIVOT: V3 = [BA[0] - 0.042, 0, BA[2]]
/** Точки трубки относительно оси колена: от шланга через край банки → вниз → под устье цилиндра. */
const JT: readonly V3[] = [
  [-0.043, 0.215, 0],
  [-0.02, 0.222, 0],
  [-0.003, 0.21, 0],
  [0, 0.19, 0],
  [0, 0.135, 0],
  [0.006, 0.122, 0],
  [0.024, 0.12, 0],
  [0.03, 0.126, 0],
  [0.03, 0.131, 0],
]
const SWING = 1.2

/** Уровень жидкости в пробирке (м от низа пробирки) для объёма мл — из геометрии (полусфера + цилиндр). */
const tubeLevel = (ml: number) => (ml <= 0 ? 0 : TUBE_R - TUBE_GEOM.ri + heightForVolume(TUBE_GEOM, ml))
/** Сколько гранул уже в лодочке (шаг 1: два захода шпателем). */
const inBoat: PFn = (p) => 3 * ease(p, 1.48, 1.56) + 2 * ease(p, 1.84, 1.9)
const rotY = (v: V3, a: number): V3 => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)]

export function KippH2Rig() {
  const { lang } = useRig()
  const v = useLabTaskValues(ID)
  const mZn = v.mZn!
  const V = v.V!

  useGearStep(ID, 0)
  useSoundAt(0.2, 'click', KP.ppe, 0.5)
  useSoundAt(1.05, 'click', add(KP.scales, [0.058, 0.02, 0.1]), 0.5)
  useSoundAt(1.5, 'glass-clink', KP_PAN, 0.3)
  useSoundAt(2.5, 'glass-clink', [TB[0], TB[1] + 0.01, TB[2]], 0.4)
  useSoundAt(3.46, 'pour', [TB[0], TOP, TB[2]], 0.5)
  useSoundAt(3.6, 'fizz', [TB[0], TB[1] + 0.03, TB[2]], 0.75)
  useSoundAt(4.5, 'glass-place', SEAT, 0.5)
  useSoundAt(4.66, 'bubble', [BA[0], 0.14, BA[2]], 0.5)
  useSoundAt(5.3, 'bubble', [BA[0], 0.14, BA[2]], 0.35)
  useSoundAt(6.4, 'splash', [BA[0], 0.17, BA[2]], 0.25)
  useSoundAt(7.72, 'glass-place', add(BA, KP.thermoIn), 0.3)

  /* ── реакция: до пробки уходит ~LOSS водорода; газ в цилиндре — с 4,6 до 5,9 ── */
  const reacted: PFn = (p) => {
    if (p < 4.6) return LOSS * ease(p, 3.55, 4.56)
    const x = Math.min(1, (p - 4.6) / 1.3)
    return LOSS + (1 - LOSS) * ((1 - Math.exp(-3 * x)) / (1 - Math.exp(-3)))
  }
  const gasTrue: PFn = (p) => (p < 4.6 ? 0 : V * Math.min(1, (reacted(p) - LOSS) / (1 - LOSS)))
  // выравнивание уровней: цилиндр опускают, пока вода внутри не встанет вровень с водой банки
  const mouth: PFn = (p) => mix(GAS_JAR.mouth0, mouthAtLevel(V), ease(p, 6.35, 6.85))
  // пока вода в цилиндре выше, газ разрежен столбом воды (ρgh ≈ 9,8 кПа на метр) — шкала показывает чуть больше
  const gasMl: PFn = (p) => {
    const g = gasTrue(p)
    const h = Math.max(0, innerWaterY(mouth(p), g) - GAS_JAR.water)
    return (g * P0_KPA) / (P0_KPA - 9.81 * h)
  }
  const fizz: PFn = (p) => ease(p, 3.56, 3.66) * (1 - 0.8 * ease(p, 4.8, 5.85)) * (1 - ease(p, 5.86, 5.94))
  const jarBubbles: PFn = (p) => ease(p, 4.62, 4.7) * (1 - 0.6 * ease(p, 4.8, 5.8)) * (1 - ease(p, 5.8, 5.92))
  const swing: PFn = (p) => SWING * ease(p, 6.05, 6.3)

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
    const rest: V3 = [KP.spatula[0], 0, KP.spatula[2]]
    const overJar: V3 = [KP.jar[0], 0.15, KP.jar[2]]
    const inJar: V3 = [KP.jar[0], 0.048, KP.jar[2]]
    const overBoat: V3 = [KP_PAN[0] + 0.004, 0.072, KP_PAN[2]]
    const hi: V3 = [KP_PAN[0], 0.15, KP_PAN[2]]
    const pos = via(p, rest, [
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
    const over: V3 = [TB[0] + 0.036, TOP + 0.03, TB[2]]
    const pos = via(p, KP_PAN, [
      [2, 2.14, [KP_PAN[0], 0.25, KP_PAN[2]]],
      [2.12, 2.36, [over[0], 0.25, over[2]]],
      [2.34, 2.42, over],
      [2.66, 2.74, [over[0], 0.25, over[2]]],
      [2.72, 2.9, [KP_PAN[0], 0.25, KP_PAN[2]]],
      [2.88, 2.97, KP_PAN],
    ])
    const tilt = ease(p, 2.4, 2.48) * (1 - ease(p, 2.6, 2.68))
    return { pos, rot: [0, 0, 0.95 * tilt] as V3 }
  }

  const bottle = pourPath(KP.bottle, 3, [TB[0] + 0.004, TOP + 0.012, TB[2]], BOTTLE_H, 1.85, 0.029)
  const acidMl: PFn = (p) => ACID_ML * ease(p, 3.46, 3.74)

  const stopperPos = (p: number): V3 =>
    via(p, KP.stopper, [
      [4, 4.16, [KP.stopper[0], 0.26, KP.stopper[2]]],
      [4.14, 4.38, [TB[0], 0.24, TB[2]]],
      [4.38, 4.56, SEAT],
    ])
  const elbow = (p: number): V3 => add(stopperPos(p), TUBE_ELBOW)
  const jStart = (p: number): V3 => add(PIVOT, rotY(JT[0]!, swing(p)))
  const jDir = (p: number): V3 => rotY([-1, 0, 0], swing(p))

  const thermoRest: V3 = [KP.thermometer[0], 0, KP.thermometer[2]]
  const inJar = add(BA, KP.thermoIn)
  const thermoPose = (p: number) => {
    const pos = via(p, thermoRest, [
      [7, 7.16, [thermoRest[0] + 0.05, 0.12, thermoRest[2]]],
      [7.14, 7.34, [BA[0] + 0.1, 0.26, BA[2] + 0.1]],
      [7.32, 7.5, [inJar[0], 0.26, inJar[2]]],
      [7.5, 7.74, inJar],
    ])
    const lying = 1 - ease(p, 7.02, 7.18)
    const lean = KP.thermoLean * ease(p, 7.56, 7.74)
    // лёжа шарик касается стола: подъём оси на радиус шарика; в банке верх опирается на край (наружу: +X и +Z)
    return {
      pos: [pos[0], pos[1] + THERMO.bulbR * lying, pos[2]] as V3,
      rot: [lean * 0.707, 0, lying * -Math.PI / 2 - lean * 0.707] as V3,
    }
  }

  return (
    <group>
      <group position={KP.ppe as unknown as THREE.Vector3Tuple}>
        <PpeTray worn={(p) => ease(p, 0, 0.95)} />
        <Target name="ppe" size={[0.16, 0.05, 0.1]} center={[0, 0.02, 0]} hintY={0.08} />
      </group>

      {/* Весы, лодочка, банка с цинком, шпатель */}
      <group position={KP.scales as unknown as THREE.Vector3Tuple}>
        <DigitalScales reading={reading} readout={(p) => hill(p, 1.4, 3.35, 0.02)} />
      </group>
      <Pose pose={boatPose}>
        <WeighBoat fill={boatFill} kind="granules" color="#9aa3ab" maxPieces={PIECES} />
        <Target name="boat" size={[0.06, 0.03, 0.05]} center={[0, 0.008, 0]} hintY={0.06} ring={false} />
      </Pose>
      <group position={KP.jar as unknown as THREE.Vector3Tuple}>
        <PowderJar formula="Zn" name={{ ru: 'цинк гранулир.', en: 'zinc granules', uz: 'rux donador' }[lang]} color="#9aa3ab" granules open={(p) => ease(p, 1, 1.1) * (1 - ease(p, 1.9, 1.99))} />
      </group>
      <Pose pose={spoon}>
        <Spatula full={spoonFull} color="#9aa3ab" />
        <group position={[0.06, 0, 0]}>
          <Target name="spatula" size={[0.14, 0.03, 0.04]} center={[0, 0.005, 0]} hintY={0.05} />
        </group>
      </Pose>
      <Falling from={[KP_PAN[0] + 0.004, 0.068, KP_PAN[2]]} toY={() => KP_PAN[1] + 0.004} a={1.47} b={1.56} n={3} color="#9aa3ab" size={0.0024} />
      <Falling from={[KP_PAN[0] + 0.004, 0.068, KP_PAN[2]]} toY={() => KP_PAN[1] + 0.004} a={1.84} b={1.9} n={2} color="#9aa3ab" size={0.0024} />
      <Falling from={[TB[0] + 0.003, TOP + 0.02, TB[2]]} toY={() => TB[1] + 0.005} a={2.44} b={2.6} n={PIECES} color="#9aa3ab" size={0.0024} jitter={0.002} />

      {/* Пробирка в лапке штатива */}
      <group position={[0, 0, TB[2]]}>
        <LabStand rodX={TB[0] - 0.09} clampX={TB[0]} clampY={TB[1] + 0.115} rodH={0.34} />
      </group>
      <group position={TB as unknown as THREE.Vector3Tuple}>
        <TestTube level={(p) => tubeLevel(acidMl(p))} liquidColor={C_ACID} />
        <MeltingGranules n={PIECES} show={(p) => ease(p, 2.5, 2.62)} left={(p) => 1 - reacted(p)} color="#9aa3ab" spread={0.0035} />
        <RisingBubbles r={0.0052} fromY={() => 0.004} toY={(p) => tubeLevel(acidMl(p))} rate={fizz} n={30} />
        <Target name="tube" size={[0.05, 0.16, 0.05]} center={[0, 0.075, 0]} hintY={0.19} ring={false} />
      </group>

      {/* Склянка HCl */}
      <PourStream x={TB[0] + 0.004} z={TB[2]} top={() => TOP + 0.01} bottom={(p) => TB[1] + Math.max(0.012, tubeLevel(acidMl(p)))} show={(p) => hill(p, 3.46, 3.74, 0.15)} color={C_ACID} />
      <Pose pose={bottle}>
        <group position={[0, BOTTLE_H, 0]}>
          <ReagentBottle formula="HCl 10 %" name={{ ru: 'соляная кислота', en: 'hydrochloric acid', uz: 'xlorid kislota' }[lang]} level={(p) => mix(0.9, 0.84, ease(p, 3.46, 3.74))} />
        </group>
        <Target name="bottle-hcl" size={[0.07, 0.13, 0.07]} center={[0, 0.06, 0]} hintY={0.16} />
      </Pose>

      {/* Пробка с коленом, шланг, газоотводная трубка в банке */}
      <Pose pose={(p) => ({ pos: stopperPos(p) })}>
        <TubeStopper />
        <Target name="stopper" size={[0.05, 0.06, 0.05]} center={[0.012, 0.025, 0]} hintY={0.08} />
      </Pose>
      <RubberHose ends={(p) => [elbow(p), jStart(p)]} dirs={(p) => [[1, 0, 0], jDir(p)]} />
      <Pose pose={(p) => ({ pos: PIVOT, rot: [0, swing(p), 0] })}>
        <GlassPath points={JT} radius={0.0028} />
      </Pose>
      <group position={[BA[0] - 0.012, 0, BA[2]]}>
        <RisingBubbles r={0.0022} fromY={() => 0.131} toY={() => GAS_JAR.mouth0 + 0.004} rate={(p) => jarBubbles(p) * (1 - ease(p, 6.02, 6.08))} n={14} />
      </group>

      {/* Высокая банка с водой, цилиндр 250 мл в лапке */}
      <group position={BA as unknown as THREE.Vector3Tuple}>
        <TallGasJar gasMl={gasMl} mouth={mouth} bubble={jarBubbles} />
        <Target name="gas-cylinder" size={[0.06, 0.3, 0.06]} center={[0, 0.27, 0]} hintY={0.44} ring={false} />
      </group>
      <Readout
        position={[BA[0] - 0.08, 0.27, BA[2] + 0.05]}
        label={{ ru: 'газ', en: 'gas', uz: 'gaz' }}
        text={(p, l) => (p > 6.88 ? `V = ${fmtNum(V, 0, l)} ${l === 'ru' ? 'мл' : 'ml'}` : null)}
      />

      {/* Термометр: лежит на столе → в воду банки, опирается на край */}
      <Pose pose={thermoPose}>
        <Thermometer temp={() => v.t!} />
        <Target name="thermometer" size={[0.03, 0.2, 0.03]} center={[0, 0.1, 0]} hintY={0.24} ring={false} />
      </Pose>
      <Readout
        position={[inJar[0] + 0.06, 0.24, inJar[2] + 0.04]}
        label={{ ru: 'термометр', en: 'thermometer', uz: 'termometr' }}
        text={(p, l) => (p > 7.82 ? `t = ${fmtNum(v.t!, 1, l)} °C` : null)}
      />
    </group>
  )
}
