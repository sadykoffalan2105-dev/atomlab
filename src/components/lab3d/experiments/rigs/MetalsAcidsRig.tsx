/**
 * Kimyo 7, § 5.6 (с. 124): взаимодействие кислот с металлами.
 * Пробирки: 1 — Mg + разбавленная H₂SO₄ (бурно, H₂ — хлопок у горящей спички), 2 — Zn + HCl (пузырьки на поверхности
 * гранул, спокойнее), 3 — Cu + HCl (изменений нет).
 * Шаги: 0 защита · 1 Mg · 2 H₂SO₄ · 3 горящая спичка · 4 Zn · 5 HCl → 2 · 6 Cu · 7 HCl → 3 · 8 сравнить.
 */
import * as THREE from 'three'
import { Pose, Target, ease, hill, mix, mixV, useSoundAt, type PFn, type V3 } from '../rigCore'
import { Bubbles, PopFlash, PourStream } from '../parts/effects'
import { BOTTLE_H, ReagentBottle, TUBE_H, TestTube, TubeRack, TubeTag, WatchGlass, ZnGranule } from '../parts/glassware'
import { Match, Matchbox } from '../parts/fire'
import { PpeTray } from '../parts/practicalware'
import { useGearStep } from './useGearStep'
import { Shavings, bottlePose, pourLevel, pourShow } from './worksKit'

const Z = -0.06
const XS = [-0.08, 0, 0.08] as const
const TUBE_Y = 0.012
const TOP = TUBE_Y + TUBE_H
const LIP = TOP + 0.03
const LEVEL = 0.036
const PPE: V3 = [0.5, 0, 0.17]
const MG_DISH: V3 = [-0.42, 0, 0.16]
const ZN_DISH: V3 = [-0.27, 0, 0.19]
const CU_DISH: V3 = [0.22, 0, 0.18]
const H2SO4: V3 = [-0.45, 0, -0.1]
const HCL: V3 = [0.3, 0, -0.08]
const BOX: V3 = [0.08, 0, 0.2]

const lv1: PFn = pourLevel(2, LEVEL)
const lv2: PFn = pourLevel(5, LEVEL)
const lv3: PFn = pourLevel(7, LEVEL)
/** Интенсивность пузырьков: магний — бурно, цинк — «вскоре» и спокойнее, медь — нет. */
const rateMg: PFn = (p) => ease(p, 2.5, 2.62) * mix(1, 0.72, ease(p, 3, 9))
const rateZn: PFn = (p) => ease(p, 5.6, 6) * 0.38

/** Металл с часового стекла → над пробиркой → падает на дно. Начало — центр кучки. */
function metalPose(dish: V3, s: number, x: number, shrink?: (p: number) => number) {
  return (p: number) => {
    const rest: V3 = [dish[0], 0.004, dish[2]]
    const lifted: V3 = [dish[0], 0.22, dish[2]]
    const above: V3 = [x, LIP + 0.02, Z]
    let pos = mixV(rest, lifted, ease(p, s, s + 0.2))
    pos = mixV(pos, above, ease(p, s + 0.18, s + 0.5))
    const fall = Math.min(1, Math.max(0, (p - s - 0.52) / 0.2))
    pos = [pos[0], mix(pos[1], TUBE_Y + 0.002, fall * fall), pos[2]]
    return { pos, scale: shrink ? shrink(p) : 1 }
  }
}

/** Горящая спичка: с коробка (зажигается) → головкой к отверстию пробирки 1 → хлопок → гаснет, обратно. */
function matchPose(p: number, t: number) {
  const rest: V3 = [BOX[0] - 0.024, 0.02, BOX[2]]
  const lifted: V3 = [BOX[0] - 0.03, 0.22, BOX[2] - 0.04]
  const atMouth: V3 = [XS[0] - 0.052, TOP + 0.008, Z]
  let pos = mixV(rest, lifted, ease(p, 3, 3.2))
  pos = mixV(pos, atMouth, ease(p, 3.18, 3.48))
  pos = mixV(pos, lifted, ease(p, 3.7, 3.84))
  pos = mixV(pos, rest, ease(p, 3.82, 3.98))
  // хлопок: спичка вздрагивает в руке
  const shake = Math.sin(t * 90) * 0.003 * hill(p, 3.5, 3.62, 0.2)
  const tilt = ease(p, 3.18, 3.48) * (1 - ease(p, 3.7, 3.84))
  return { pos: [pos[0] + shake, pos[1], pos[2]] as V3, rot: [0, 0, -0.35 * tilt] as V3 }
}

export function MetalsAcidsRig() {
  useGearStep('metals-acids', 0)
  useSoundAt(0.2, 'click', PPE, 0.5)
  useSoundAt(1.72, 'glass-clink', [XS[0], TUBE_Y, Z], 0.3)
  useSoundAt(2.46, 'pour', [XS[0], LIP, Z], 0.5)
  useSoundAt(2.55, 'fizz', [XS[0], 0.06, Z], 0.7)
  useSoundAt(3.02, 'flame-on', [BOX[0], 0.03, BOX[2]], 0.4)
  useSoundAt(3.5, 'pop', [XS[0], TOP, Z], 0.9)
  useSoundAt(4.72, 'glass-clink', [XS[1], TUBE_Y, Z], 0.3)
  useSoundAt(5.46, 'pour', [XS[1], LIP, Z], 0.5)
  useSoundAt(5.65, 'bubble', [XS[1], 0.05, Z], 0.35)
  useSoundAt(6.72, 'glass-clink', [XS[2], TUBE_Y, Z], 0.3)
  useSoundAt(7.46, 'pour', [XS[2], LIP, Z], 0.5)
  useSoundAt(8.15, 'glass-clink', [0, 0.1, Z], 0.5)
  useSoundAt(8.9, 'success', [0, 0.2, Z], 0.6)

  const acid1 = bottlePose(H2SO4, [[2, XS[0], Z, LIP]])
  const acid2 = bottlePose(HCL, [
    [5, XS[1], Z, LIP],
    [7, XS[2], Z, LIP],
  ])
  const lift = (i: number) => (p: number) => TUBE_Y + 0.035 * ease(p, 8.05 + i * 0.05, 8.4 + i * 0.05)

  return (
    <group>
      <group position={PPE as unknown as THREE.Vector3Tuple}>
        <PpeTray worn={(p) => ease(p, 0, 0.95)} gloves={false} coat />
        <Target name="ppe" size={[0.16, 0.05, 0.1]} center={[0, 0.02, 0]} hintY={0.08} />
      </group>

      {/* Штатив с пробирками 1 Mg, 2 Zn, 3 Cu */}
      <group position={[0, 0, Z]}>
        <TubeRack xs={XS} />
        <Target name="rack" size={[0.3, 0.12, 0.08]} center={[0, 0.07, 0]} hintY={0.21} />
      </group>
      {[lv1, lv2, lv3].map((lv, i) => (
        <Pose key={i} pose={(p) => ({ pos: [XS[i]!, lift(i)(p), Z] })}>
          <TestTube level={lv} liquidColor="#eef7ff" />
          {i === 0 ? <Bubbles level={lv} rate={rateMg} fromY={0.004} spread={0.95} /> : null}
          {i === 1 ? <Bubbles level={lv} rate={rateZn} fromY={0.005} spread={0.6} /> : null}
          <group position={[0, 0.1, 0]}>
            <TubeTag text={['1 Mg', '2 Zn', '3 Cu'][i]!} />
          </group>
        </Pose>
      ))}
      <Pose pose={(p) => ({ pos: [0, 0.1, Z - 0.045], scale: ease(p, 8.05, 8.45) })}>
        <mesh>
          <planeGeometry args={[0.32, 0.14]} />
          <meshStandardMaterial color="#ffffff" roughness={0.9} />
        </mesh>
      </Pose>

      {/* Металлы на часовых стёклах */}
      {[MG_DISH, ZN_DISH, CU_DISH].map((d, i) => (
        <group key={i} position={d as unknown as THREE.Vector3Tuple}>
          <WatchGlass />
        </group>
      ))}
      {/* магний растворяется — стружки уменьшаются */}
      <Pose
        pose={(p) => {
          const m = metalPose(MG_DISH, 1, XS[0], (q) => mix(1, 0.55, ease(q, 2.5, 9)))(p)
          return { ...m, pos: [m.pos[0], m.pos[1] + lift(0)(p) - TUBE_Y, m.pos[2]] }
        }}
      >
        <Shavings color="#d9dee3" metalness={0.8} roughness={0.3} />
        <Target name="mg" size={[0.05, 0.04, 0.05]} center={[0, 0.006, 0]} hintY={0.06} />
      </Pose>
      <Pose
        pose={(p) => {
          const m = metalPose(ZN_DISH, 4, XS[1])(p)
          return { ...m, pos: [m.pos[0], m.pos[1] + lift(1)(p) - TUBE_Y, m.pos[2]] }
        }}
      >
        <group position={[-0.003, 0.003, 0]}>
          <ZnGranule size={0.0042} seed={1.3} />
        </group>
        <group position={[0.003, 0.003, 0.002]}>
          <ZnGranule size={0.0038} seed={2.1} />
        </group>
        <group position={[0, 0.007, -0.002]}>
          <ZnGranule size={0.0036} seed={3.7} />
        </group>
        <Target name="zn" size={[0.05, 0.04, 0.05]} center={[0, 0.006, 0]} hintY={0.06} />
      </Pose>
      <Pose
        pose={(p) => {
          const m = metalPose(CU_DISH, 6, XS[2])(p)
          return { ...m, pos: [m.pos[0], m.pos[1] + lift(2)(p) - TUBE_Y, m.pos[2]] }
        }}
      >
        <Shavings color="#b8673f" metalness={0.85} roughness={0.32} />
        <Target name="cu" size={[0.05, 0.04, 0.05]} center={[0, 0.006, 0]} hintY={0.06} />
      </Pose>

      {/* Склянки с кислотами */}
      <Pose pose={acid1}>
        <ReagentBottle formula="H₂SO₄" name="серная кислота (1 : 5)" level={(p) => mix(1, 0.82, ease(p, 2.46, 2.74))} />
        <group position={[0, -BOTTLE_H, 0]}>
          <Target name="bottle-h2so4" size={[0.07, 0.13, 0.07]} center={[0, 0.06, 0]} hintY={0.16} />
        </group>
      </Pose>
      <Pose pose={acid2}>
        <ReagentBottle formula="HCl" name="соляная кислота" level={(p) => mix(1, 0.82, ease(p, 5.46, 5.74)) - 0.16 * ease(p, 7.46, 7.74)} />
        <group position={[0, -BOTTLE_H, 0]}>
          <Target name="bottle-hcl" size={[0.07, 0.13, 0.07]} center={[0, 0.06, 0]} hintY={0.16} />
        </group>
      </Pose>
      <PourStream x={XS[0] + 0.003} z={Z} top={() => LIP - 0.004} bottom={(p) => TUBE_Y + Math.max(0.006, lv1(p))} show={pourShow(2)} />
      <PourStream x={XS[1] - 0.003} z={Z} top={() => LIP - 0.004} bottom={(p) => TUBE_Y + Math.max(0.006, lv2(p))} show={pourShow(5)} />
      <PourStream x={XS[2] - 0.003} z={Z} top={() => LIP - 0.004} bottom={(p) => TUBE_Y + Math.max(0.006, lv3(p))} show={pourShow(7)} />

      {/* Спички: зажжённая спичка к отверстию пробирки 1 — хлопок */}
      <group position={BOX as unknown as THREE.Vector3Tuple}>
        <Matchbox />
      </group>
      <Pose pose={matchPose}>
        <Match lit={(p) => ease(p, 3.02, 3.1) * (1 - ease(p, 3.6, 3.75))} />
        <Target name="match" size={[0.06, 0.03, 0.04]} center={[0.03, 0, 0]} hintY={0.05} ring={false} />
      </Pose>
      <group position={[XS[0], TOP + 0.006, Z]}>
        <PopFlash flash={(p) => hill(p, 3.5, 3.66, 0.3)} color="#ffd9a0" size={0.026} />
      </group>
    </group>
  )
}
