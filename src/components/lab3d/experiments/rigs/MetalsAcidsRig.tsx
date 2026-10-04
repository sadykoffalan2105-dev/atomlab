/**
 * Kimyo 7, § 5.6 (с. 124): взаимодействие кислот с металлами.
 * Пробирки: 1 — Mg + разбавленная H₂SO₄ (бурно, H₂ — хлопок у горящей спички), 2 — Zn + HCl (пузырьки на поверхности
 * гранул, спокойнее), 3 — Cu + HCl (изменений нет). Затем пробирки 2 и 3 нагревают в пламени спиртовки (держатель):
 * цинк реагирует быстрее, у меди — без изменений.
 * Шаги: 0 защита · 1 Mg · 2 H₂SO₄ · 3 горящая спичка · 4 Zn · 5 HCl → 2 · 6 Cu · 7 HCl → 3 · 8 зажечь спиртовку ·
 * 9 нагреть пробирки 2 и 3 в держателе · 10 сравнить (спиртовку гасят колпачком).
 */
import * as THREE from 'three'
import { LAB_COLORS } from '../../labContract'
import { Pose, Target, ease, hill, mix, mixV, useSoundAt, type PFn, type V3 } from '../rigCore'
import { Bubbles, PopFlash, PourStream } from '../parts/effects'
import { BOTTLE_H, ReagentBottle, TUBE_H, TUBE_R, TestTube, TubeRack, TubeTag, WatchGlass, ZnGranule } from '../parts/glassware'
import { Match, Matchbox, SpiritLamp } from '../parts/fire'
import { PpeTray, WhiteCard } from '../parts/practicalware'
import { useGearStep } from './useGearStep'
import { Shavings, bottlePose, pourLevel, pourShow } from './worksKit'

const Z = -0.06
const XS = [-0.08, 0, 0.08] as const
const TUBE_Y = 0.012
const TOP = TUBE_Y + TUBE_H
const LIP = TOP + 0.03
const LEVEL = 0.044
const PPE: V3 = [0.5, 0, 0.17]
const MG_DISH: V3 = [-0.42, 0, 0.16]
const ZN_DISH: V3 = [-0.27, 0, 0.19]
const CU_DISH: V3 = [0.22, 0, 0.18]
const H2SO4: V3 = [-0.45, 0, -0.1]
const HCL: V3 = [0.3, 0, -0.08]
const BOX: V3 = [0.08, 0, 0.2]
/** Спиртовка — перед штативом слева; держатель пробирок лежит на столе справа от штатива (ручкой к ученику, мимо спичек и часового стекла). */
const LAMP: V3 = [-0.15, 0, 0.09]
const LAMP_FLAME_Y = 0.081
const HOLDER_REST: V3 = [0.19, 0, -0.02]
/** Кольцо держателя — на 2,2 см ниже отверстия пробирки. */
const CLAMP = TUBE_H - 0.022
/** Нагрев: дно пробирки в верхней (самой горячей) части пламени; переносят выше пламени и штатива. */
const HEAT_Y = LAMP_FLAME_Y + 0.032
const CARRY_Y = 0.19
/** Окна нагрева пробирок 2 (Zn) и 3 (Cu) внутри шага 9: [взять, поднять, над пламенем, опустить, греть, поднять, назад, в штатив, отпустить]. */
const HEAT2 = [9.04, 9.1, 9.16, 9.22, 9.25, 9.44, 9.47, 9.53, 9.57] as const
const HEAT3 = [9.62, 9.66, 9.71, 9.76, 9.79, 9.9, 9.92, 9.96, 9.985] as const

const lv1: PFn = pourLevel(2, LEVEL)
const lv2: PFn = pourLevel(5, LEVEL)
const lv3: PFn = pourLevel(7, LEVEL)
/** Интенсивность пузырьков: магний — бурно, цинк — «вскоре» и спокойнее, медь — нет. */
const rateMg: PFn = (p) => ease(p, 2.5, 2.62) * mix(1, 0.72, ease(p, 3, 9))
/** Нагревание ускоряет реакцию цинка: пузырьков заметно больше, пока раствор горячий. */
const rateZn: PFn = (p) => ease(p, 5.6, 6) * 0.38 + 0.55 * ease(p, HEAT2[4], HEAT2[4] + 0.06)
const lampFlame: PFn = (p) => ease(p, 8.62, 8.74) * (1 - ease(p, 10.3, 10.34))
const lampCap: PFn = (p) => ease(p, 8.04, 8.36) * (1 - ease(p, 10.1, 10.45))

/** Положение пробирки i: в штативе, а на шаге 9 пробирки 2 и 3 по очереди — в держателе над пламенем. */
function tubePos(i: number, p: number): V3 {
  const rack: V3 = [XS[i]!, TUBE_Y, Z]
  const w = i === 1 ? HEAT2 : i === 2 ? HEAT3 : null
  if (!w) return rack
  const up: V3 = [rack[0], CARRY_Y, rack[2]]
  const over: V3 = [LAMP[0], CARRY_Y, LAMP[2]]
  const heat: V3 = [LAMP[0], HEAT_Y, LAMP[2]]
  let pos = mixV(rack, up, ease(p, w[1], w[2]))
  pos = mixV(pos, over, ease(p, w[2], w[3]))
  pos = mixV(pos, heat, ease(p, w[3], w[4]))
  pos = mixV(pos, over, ease(p, w[5], w[6]))
  pos = mixV(pos, up, ease(p, w[6], w[7]))
  pos = mixV(pos, rack, ease(p, w[7], w[8]))
  // греют равномерно: пробирку слегка покачивают в пламени
  const sway = 0.004 * Math.sin(p * 260) * hill(p, w[4], w[5], 0.02)
  return [pos[0] + sway, pos[1], pos[2]]
}

/** Держатель: лежит на столе → кольцом надевается на пробирку сверху → носит её → снимается вверх → на стол. */
function holderPose(p: number) {
  const rest: V3 = [HOLDER_REST[0], 0, HOLDER_REST[2]]
  const restUp: V3 = [HOLDER_REST[0], CARRY_Y + CLAMP + 0.04, HOLDER_REST[2]]
  const atTube = (i: number): V3 => {
    const tp = tubePos(i, p)
    return [tp[0], tp[1] + CLAMP, tp[2]]
  }
  const aboveTube = (i: number): V3 => [XS[i]!, TUBE_Y + TUBE_H + 0.04, Z]
  if (p < HEAT2[0] || p >= 10) return { pos: rest }
  if (p < HEAT2[1]) {
    const k = (p - HEAT2[0]) / (HEAT2[1] - HEAT2[0])
    let pos = mixV(rest, restUp, ease(k, 0, 0.35))
    pos = mixV(pos, aboveTube(1), ease(k, 0.3, 0.75))
    return { pos: mixV(pos, atTube(1), ease(k, 0.72, 1)) }
  }
  if (p < HEAT2[8]) return { pos: atTube(1) }
  if (p < HEAT3[1]) {
    const k = (p - HEAT2[8]) / (HEAT3[1] - HEAT2[8])
    let pos = mixV(atTube(1), aboveTube(1), ease(k, 0, 0.3))
    pos = mixV(pos, aboveTube(2), ease(k, 0.3, 0.7))
    return { pos: mixV(pos, atTube(2), ease(k, 0.7, 1)) }
  }
  if (p < HEAT3[8]) return { pos: atTube(2) }
  const k = (p - HEAT3[8]) / (10 - HEAT3[8])
  let pos = mixV(atTube(2), aboveTube(2), ease(k, 0, 0.3))
  pos = mixV(pos, restUp, ease(k, 0.3, 0.6))
  return { pos: mixV(pos, rest, ease(k, 0.6, 1)) }
}

const holderWood = new THREE.MeshStandardMaterial({ color: LAB_COLORS.wood, roughness: 0.6 })
const holderWire = new THREE.MeshStandardMaterial({ color: LAB_COLORS.metal, metalness: 0.9, roughness: 0.3 })

/** Деревянный держатель для пробирок: проволочное кольцо-зажим и ручка к ученику. Начало — центр кольца (низ на столе). */
function TubeHolder() {
  const ringR = TUBE_R + 0.0016
  return (
    <group>
      <mesh position={[0, 0.0012, 0]} rotation={[Math.PI / 2, 0, 0]} material={holderWire} castShadow>
        <torusGeometry args={[ringR, 0.0012, 8, 28]} />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * 0.004, 0.0012, ringR + 0.012]} rotation={[Math.PI / 2, 0, 0]} material={holderWire}>
          <cylinderGeometry args={[0.0011, 0.0011, 0.024, 6]} />
        </mesh>
      ))}
      <mesh position={[0, 0.0055, ringR + 0.024 + 0.055]} material={holderWood} castShadow receiveShadow>
        <boxGeometry args={[0.014, 0.011, 0.11]} />
      </mesh>
    </group>
  )
}

/** Спичка второй раз: с коробка → к фитилю спиртовки (шаг 8) → гаснет, обратно. */
function lampMatch(p: number): V3 | null {
  if (p < 8.3 || p > 8.98) return null
  const rest: V3 = [BOX[0] - 0.024, 0.02, BOX[2]]
  const lifted: V3 = [BOX[0] - 0.05, 0.16, BOX[2] - 0.02]
  const atWick: V3 = [LAMP[0] + 0.05, LAMP_FLAME_Y + 0.006, LAMP[2]]
  let pos = mixV(rest, lifted, ease(p, 8.3, 8.42))
  pos = mixV(pos, atWick, ease(p, 8.42, 8.6))
  pos = mixV(pos, lifted, ease(p, 8.72, 8.84))
  return mixV(pos, rest, ease(p, 8.84, 8.98))
}

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
  const second = lampMatch(p)
  if (second) return { pos: second, rot: [0, Math.PI, -0.3 * ease(p, 8.42, 8.6) * (1 - ease(p, 8.72, 8.84))] as V3 }
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
  useSoundAt(8.36, 'flame-on', [BOX[0], 0.03, BOX[2]], 0.4)
  useSoundAt(8.64, 'flame-on', [LAMP[0], 0.09, LAMP[2]], 0.5)
  useSoundAt(HEAT2[4] + 0.02, 'fizz', [LAMP[0], HEAT_Y + 0.03, LAMP[2]], 0.45)
  useSoundAt(HEAT2[8], 'glass-clink', [XS[1], TUBE_Y, Z], 0.3)
  useSoundAt(HEAT3[8], 'glass-clink', [XS[2], TUBE_Y, Z], 0.3)
  useSoundAt(10.15, 'glass-clink', [0, 0.1, Z], 0.5)
  useSoundAt(10.9, 'success', [0, 0.2, Z], 0.6)

  const acid1 = bottlePose(H2SO4, [[2, XS[0], Z, LIP]])
  const acid2 = bottlePose(HCL, [
    [5, XS[1], Z, LIP],
    [7, XS[2], Z, LIP],
  ])
  /** Металл на дне едет вместе со своей пробиркой (смещение от гнезда в штативе). */
  const withTube = (i: number, m: { pos: V3; scale?: number }, p: number) => {
    const tp = tubePos(i, p)
    return { ...m, pos: [m.pos[0] + tp[0] - XS[i]!, m.pos[1] + tp[1] - TUBE_Y, m.pos[2] + tp[2] - Z] as V3 }
  }

  return (
    <group>
      <group position={PPE as unknown as THREE.Vector3Tuple}>
        <PpeTray worn={(p) => ease(p, 0, 0.95)} gloves={false} coat />
        <Target name="ppe" size={[0.16, 0.05, 0.1]} center={[0, 0.02, 0]} hintY={0.08} />
      </group>

      {/* Штатив с пробирками 1 Mg, 2 Zn, 3 Cu */}
      <group position={[0, 0, Z]}>
        <TubeRack xs={XS} holeTop={0.04} />
        <Target name="rack" size={[0.3, 0.12, 0.08]} center={[0, 0.07, 0]} hintY={0.21} />
      </group>
      {[lv1, lv2, lv3].map((lv, i) => (
        <Pose key={i} pose={(p) => ({ pos: tubePos(i, p) })}>
          <TestTube level={lv} liquidColor="#eef7ff" />
          {i === 0 ? <Bubbles level={lv} rate={rateMg} fromY={0.004} spread={0.95} /> : null}
          {i === 1 ? <Bubbles level={lv} rate={rateZn} fromY={0.005} spread={0.6} /> : null}
          <group position={[0, 0.1, 0]}>
            <TubeTag text={['1 Mg', '2 Zn', '3 Cu'][i]!} />
          </group>
        </Pose>
      ))}
      {/* белая карточка на ножках стоит за штативом — окраски видно на белом (не висит в воздухе) */}
      <group position={[0, 0, Z - 0.046]}>
        <WhiteCard w={0.32} />
      </group>

      {/* Металлы на часовых стёклах */}
      {[MG_DISH, ZN_DISH, CU_DISH].map((d, i) => (
        <group key={i} position={d as unknown as THREE.Vector3Tuple}>
          <WatchGlass />
        </group>
      ))}
      {/* магний растворяется — стружки уменьшаются */}
      <Pose
        pose={(p) => {
          return withTube(0, metalPose(MG_DISH, 1, XS[0], (q) => mix(1, 0.55, ease(q, 2.5, 9)))(p), p)
        }}
      >
        <Shavings color="#d9dee3" metalness={0.8} roughness={0.3} />
        <Target name="mg" size={[0.05, 0.04, 0.05]} center={[0, 0.006, 0]} hintY={0.06} />
      </Pose>
      <Pose
        pose={(p) => {
          return withTube(1, metalPose(ZN_DISH, 4, XS[1])(p), p)
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
          return withTube(2, metalPose(CU_DISH, 6, XS[2])(p), p)
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
        <Match lit={(p) => ease(p, 3.02, 3.1) * (1 - ease(p, 3.6, 3.75)) + ease(p, 8.36, 8.42) * (1 - ease(p, 8.72, 8.8))} />
        <Target name="match" size={[0.06, 0.03, 0.04]} center={[0.03, 0, 0]} hintY={0.05} ring={false} />
      </Pose>
      <group position={[XS[0], TOP + 0.006, Z]}>
        <PopFlash flash={(p) => hill(p, 3.5, 3.66, 0.3)} color="#ffd9a0" size={0.026} />
      </group>

      {/* Спиртовка: колпачок снимают, спичкой зажигают фитиль; после нагрева гасят колпачком */}
      <group position={LAMP as unknown as THREE.Vector3Tuple}>
        <SpiritLamp flame={lampFlame} capOff={lampCap} />
        <Target name="spirit-lamp" size={[0.08, 0.1, 0.08]} center={[0, 0.045, 0]} hintY={0.14} />
      </group>
      {/* Держатель: пробирки 2 (Zn) и 3 (Cu) по очереди — в пламя и обратно в штатив */}
      <Pose pose={holderPose}>
        <TubeHolder />
        <group position={[0, 0, TUBE_R + 0.08]}>
          <Target name="holder" size={[0.05, 0.03, 0.11]} center={[0, 0.006, 0]} hintY={0.06} />
        </group>
      </Pose>
    </group>
  )
}
