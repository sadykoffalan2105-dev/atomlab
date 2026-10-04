/**
 * Kimyo 9, Практическая работа 1 (с. 191): получение оксида углерода(IV) и знакомство с его свойствами.
 * Пробирка-реактор в лапке штатива: мрамор + соляная кислота, пробка с газоотводной трубкой, резиновый шланг
 * и стеклянный наконечник, который ученик опускает в пробирки-приёмники:
 *  известковая вода (мутнеет — CaCO₃↓, при избытке CO₂ снова прозрачная — Ca(HCO₃)₂),
 *  дистиллированная вода (+ синий лакмус — краснеет), NaOH с фенолфталеином (малиновая окраска исчезает).
 * Шаги: 0 защита · 1 мрамор · 2 HCl · 3 пробка · 4 трубку в известковую воду · 5 избыток CO₂ · 6 в воду ·
 * 7 лакмус · 8 в NaOH с фенолфталеином.
 */
import * as THREE from 'three'
import { Pose, Target, ease, hill, mix, mixV, useRig, useSoundAt, type PFn, type V3 } from '../rigCore'
import { Bubbles, PourStream } from '../parts/effects'
import { BOTTLE_H, LabStand, ReagentBottle, TUBE_H, TestTube, TubeRack, TubeTag, WatchGlass } from '../parts/glassware'
import { ColorTube, DropperBottle, Falling, GlassPath, Pipette, PpeTray } from '../parts/practicalware'
import { useGearStep } from './useGearStep'
import { MarblePieces, RubberHose, bottlePose, pipettePose, pourLevel, pourShow } from './worksKit'

const Z = -0.06
const REACT_X = -0.3
const RY = 0.1
const R_TOP = RY + TUBE_H
const SEAT_Y = R_TOP - 0.012
const LIME_X = -0.1
const WATER_X = 0.02
const NAOH_X = 0.14
const TUBE_Y = 0.012
const TOP = TUBE_Y + TUBE_H
const PPE: V3 = [0.5, 0, 0.17]
const DISH: V3 = [-0.48, 0, 0.15]
const HCL: V3 = [-0.16, 0, 0.16]
const STOPPER_REST: V3 = [-0.02, 0, 0.17]
const LT: V3 = [0.3, 0, 0.12]
/** Стеклянное колено на пробке: конец (здесь надет шланг) в координатах пробки. */
const ELBOW: V3 = [0.035, 0.045, 0]
const TIP_LEN = 0.1
const LEVEL = 0.03

const C = {
  lime: '#f3f7f9',
  water: '#eef6ff',
  litRed: '#d8566e', // синий лакмус в растворе угольной кислоты — красный
  crimson: '#c8186e', // NaOH + фенолфталеин
  clear: '#f1eef4',
  litBlue: '#3c4fb5',
} as const

const acidLevel: PFn = pourLevel(2, 0.034)
const marbleRate: PFn = (p) => ease(p, 2.5, 2.64) * mix(1, 0.6, ease(p, 4, 9))
/** Муть в известковой воде: появляется, когда пошёл CO₂, исчезает при избытке. */
const cloud: PFn = (p) => ease(p, 4.62, 4.98) * (1 - ease(p, 5.2, 5.92))

/** Пробка с коленом (начало — низ пробки): со стола → вверх → над пробиркой → в горлышко. */
function stopperPos(p: number): V3 {
  const rest: V3 = [STOPPER_REST[0], 0, STOPPER_REST[2]]
  const lifted: V3 = [STOPPER_REST[0], 0.36, STOPPER_REST[2]]
  const above: V3 = [REACT_X, 0.33, Z]
  const seat: V3 = [REACT_X, SEAT_Y, Z]
  let pos = mixV(rest, lifted, ease(p, 3, 3.2))
  pos = mixV(pos, above, ease(p, 3.18, 3.42))
  pos = mixV(pos, seat, ease(p, 3.42, 3.6))
  return pos
}

/** Конец стеклянного наконечника (низ) и наклон: лежит на столе → над известковой водой → по пробиркам. */
function tipPose(p: number): { end: V3; lie: number } {
  const rest: V3 = [0.15, 0.004, 0.19]
  const park = (x: number): V3 => [x, 0.2, Z]
  const dip = (x: number): V3 => [x, TUBE_Y + 0.012, Z]
  let end = mixV(rest, park(LIME_X), ease(p, 3.2, 3.6))
  end = mixV(end, dip(LIME_X), ease(p, 4, 4.6))
  end = mixV(end, park(LIME_X), ease(p, 6, 6.2))
  end = mixV(end, park(WATER_X), ease(p, 6.18, 6.4))
  end = mixV(end, dip(WATER_X), ease(p, 6.4, 6.6))
  // перед лакмусом трубку вынимают и отводят в сторону
  end = mixV(end, park(WATER_X), ease(p, 7, 7.14))
  end = mixV(end, [WATER_X + 0.06, 0.21, Z + 0.03], ease(p, 7.12, 7.26))
  end = mixV(end, park(NAOH_X), ease(p, 8, 8.2))
  end = mixV(end, dip(NAOH_X), ease(p, 8.2, 8.6))
  return { end, lie: 1 - ease(p, 3.2, 3.6) }
}

function tipTop(p: number): V3 {
  const { end, lie } = tipPose(p)
  // лежит: верх смотрит в −X; стоит: верх над концом
  const a = (Math.PI / 2) * lie
  return [end[0] - Math.sin(a) * TIP_LEN, end[1] + Math.cos(a) * TIP_LEN, end[2]]
}

export function Co2Rig() {
  const { lang } = useRig()
  useGearStep('co2', 0)
  useSoundAt(0.2, 'click', PPE, 0.5)
  useSoundAt(1.72, 'glass-clink', [REACT_X, RY, Z], 0.3)
  useSoundAt(2.46, 'pour', [REACT_X, R_TOP, Z], 0.5)
  useSoundAt(2.52, 'fizz', [REACT_X, RY + 0.03, Z], 0.75)
  useSoundAt(3.6, 'glass-place', [REACT_X, R_TOP, Z], 0.5)
  useSoundAt(4.62, 'bubble', [LIME_X, 0.04, Z], 0.45)
  useSoundAt(4.98, 'success', [LIME_X, 0.1, Z], 0.3)
  useSoundAt(5.92, 'success', [LIME_X, 0.1, Z], 0.3)
  useSoundAt(6.62, 'bubble', [WATER_X, 0.04, Z], 0.45)
  useSoundAt(7.34, 'splash', [WATER_X, TOP, Z], 0.25)
  useSoundAt(7.95, 'success', [WATER_X, 0.1, Z], 0.3)
  useSoundAt(8.62, 'bubble', [NAOH_X, 0.04, Z], 0.45)
  useSoundAt(8.98, 'success', [NAOH_X, 0.1, Z], 0.5)

  const acid = bottlePose(HCL, [[2, REACT_X, Z, R_TOP + 0.03]])
  const dropper = pipettePose(LT, [[7, WATER_X, Z, TOP + 0.016]])
  const waterLevel: PFn = (p) => LEVEL + 0.004 * ease(p, 7.32, 7.5)

  return (
    <group>
      <group position={PPE as unknown as THREE.Vector3Tuple}>
        <PpeTray worn={(p) => ease(p, 0, 0.95)} gloves={false} coat />
        <Target name="ppe" size={[0.16, 0.05, 0.1]} center={[0, 0.02, 0]} hintY={0.08} />
      </group>

      {/* Штатив с лапкой и пробирка-реактор */}
      <group position={[0, 0, Z]}>
        <LabStand rodX={REACT_X - 0.11} clampX={REACT_X} clampY={RY + 0.105} />
      </group>
      <group position={[REACT_X, RY, Z]}>
        <TestTube level={acidLevel} liquidColor="#eef7ff" />
        <Bubbles level={acidLevel} rate={marbleRate} fromY={0.006} spread={0.95} />
      </group>
      <group position={[REACT_X, RY + 0.11, Z + 0.0001]}>
        <TubeTag text="CaCO₃ + HCl" />
      </group>

      {/* Мрамор: с часового стекла → в пробирку-реактор (кусочки ложатся на дно) */}
      <group position={DISH as unknown as THREE.Vector3Tuple}>
        <WatchGlass />
      </group>
      <Pose
        pose={(p) => {
          const rest: V3 = [DISH[0], 0.004, DISH[2]]
          const lifted: V3 = [DISH[0], 0.32, DISH[2]]
          const above: V3 = [REACT_X, R_TOP + 0.03, Z]
          let pos = mixV(rest, lifted, ease(p, 1, 1.2))
          pos = mixV(pos, above, ease(p, 1.18, 1.5))
          const fall = Math.min(1, Math.max(0, (p - 1.52) / 0.2))
          pos = [pos[0], mix(pos[1], RY + 0.001, fall * fall), pos[2]]
          // в кислоте мрамор понемногу растворяется
          return { pos, scale: mix(1, 0.8, ease(p, 2.5, 9)) * (fall > 0 ? 0.85 : 1) }
        }}
      >
        <MarblePieces />
        <Target name="marble" size={[0.05, 0.04, 0.05]} center={[0, 0.006, 0]} hintY={0.06} />
      </Pose>

      {/* Склянка с соляной кислотой */}
      <Pose pose={acid}>
        <ReagentBottle formula="HCl" name="соляная кислота" level={(p) => mix(1, 0.82, ease(p, 2.46, 2.74))} />
        <group position={[0, -BOTTLE_H, 0]}>
          <Target name="bottle-hcl" size={[0.07, 0.13, 0.07]} center={[0, 0.06, 0]} hintY={0.16} />
        </group>
      </Pose>
      <PourStream x={REACT_X - 0.003} z={Z} top={() => R_TOP + 0.026} bottom={(p) => RY + Math.max(0.006, acidLevel(p))} show={pourShow(2)} />

      {/* Пробка с коленом, шланг и стеклянный наконечник */}
      <Pose pose={(p) => ({ pos: stopperPos(p) })}>
        <mesh position={[0, 0.009, 0]} castShadow>
          <cylinderGeometry args={[0.0108, 0.0085, 0.018, 20]} />
          <meshStandardMaterial color="#5f6670" roughness={0.85} />
        </mesh>
        <GlassPath points={[[0, 0.004, 0], [0, 0.034, 0], [0.008, 0.044, 0], ELBOW]} radius={0.0028} />
        <Target name="stopper" size={[0.05, 0.06, 0.05]} center={[0.012, 0.025, 0]} hintY={0.08} />
      </Pose>
      <RubberHose
        ends={(p) => {
          const s = stopperPos(p)
          return [[s[0] + ELBOW[0], s[1] + ELBOW[1], s[2] + ELBOW[2]], tipTop(p)]
        }}
      />
      <Pose
        pose={(p) => {
          const { end, lie } = tipPose(p)
          return { pos: end, rot: [0, 0, (Math.PI / 2) * lie] }
        }}
      >
        <GlassPath points={[[0, 0, 0], [0, TIP_LEN / 2, 0], [0, TIP_LEN, 0]]} radius={0.0026} />
        <Target name="outlet" size={[0.03, 0.1, 0.03]} center={[0, 0.07, 0]} hintY={0.13} ring={false} />
      </Pose>

      {/* Пробирки-приёмники: известковая вода, дистиллированная вода, NaOH с фенолфталеином */}
      <group position={[0, 0, Z]}>
        <TubeRack xs={[LIME_X, WATER_X, NAOH_X]} />
      </group>
      <group position={[LIME_X, TUBE_Y, Z]}>
        <TestTube level={() => LEVEL} liquidColor={C.lime} cloud={cloud} />
        <Bubbles level={() => LEVEL} rate={(p) => ease(p, 4.62, 4.75) * (1 - ease(p, 5.94, 6.02))} fromY={0.012} spread={0.4} />
        <group position={[0, 0.1, 0]}>
          <TubeTag text="Ca(OH)₂" />
        </group>
      </group>
      <Target name="tube-lime" size={[0.05, 0.16, 0.05]} center={[LIME_X, 0.085, Z]} hintY={0.21} />
      <group position={[WATER_X, TUBE_Y, Z]}>
        <ColorTube base={C.water} stages={[[7.42, 7.95, C.litRed]]} level={waterLevel} />
        <Bubbles level={waterLevel} rate={(p) => ease(p, 6.62, 6.75) * (1 - ease(p, 6.96, 7.04))} fromY={0.012} spread={0.4} />
        <group position={[0, 0.1, 0]}>
          <TubeTag text="H₂O" />
        </group>
      </group>
      <group position={[NAOH_X, TUBE_Y, Z]}>
        <ColorTube base={C.crimson} stages={[[8.62, 8.99, C.clear]]} level={() => LEVEL} />
        <Bubbles level={() => LEVEL} rate={(p) => ease(p, 8.62, 8.75)} fromY={0.012} spread={0.4} />
        <group position={[0, 0.1, 0]}>
          <TubeTag text="NaOH" />
        </group>
      </group>

      {/* Синий лакмус */}
      <group position={LT as unknown as THREE.Vector3Tuple}>
        <DropperBottle color={C.litBlue} label={{ ru: 'лакмус', en: 'litmus', uz: 'lakmus' }[lang]} />
        <Target name="litmus" size={[0.05, 0.12, 0.05]} center={[0, 0.06, 0]} hintY={0.15} />
      </group>
      <Pose pose={(p) => ({ pos: dropper(p).pos })}>
        <Pipette color={C.litBlue} squeeze={(p) => dropper(p).squeeze} />
      </Pose>
      <Falling from={[WATER_X, TOP + 0.014, Z]} toY={(p) => TUBE_Y + waterLevel(p)} a={7.31} b={7.55} n={3} color={C.litBlue} size={0.0021} />
      {/* лёгкое «дыхание» пузырьков у наконечника, пока он в жидкости, — видно, что газ идёт */}
      <Pose pose={(p) => ({ pos: tipPose(p).end, scale: hill(p, 4.6, 6, 0.05) + hill(p, 6.6, 7, 0.1) + hill(p, 8.6, 9, 0.1) > 0 ? 1 : 0 })}>
        <mesh>
          <sphereGeometry args={[0.0022, 8, 6]} />
          <meshPhysicalMaterial color="#ffffff" transparent opacity={0.6} roughness={0.05} depthWrite={false} />
        </mesh>
      </Pose>
    </group>
  )
}
