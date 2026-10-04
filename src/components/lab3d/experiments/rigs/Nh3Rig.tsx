/**
 * Kimyo 8, Практическая работа 3 (§ 39, с. 169): получение аммиака и опыты с ним — в вытяжном шкафу
 * (локальные координаты внутри HOOD_WORK_SIZE 0,95 × 0,5 м).
 * Шаги: 0 надеть очки, перчатки, халат · 1 растереть NH₄Cl с Ca(OH)₂ в ступке · 2 смесь в пробирку (1/3) ·
 * 3 пробка с газоотводной трубкой, пробирка в лапке отверстием немного вниз · 4 сухая пробирка вверх дном ·
 * 5 нагревание: 2NH₄Cl + Ca(OH)₂ → CaCl₂ + 2NH₃↑ + 2H₂O · 6 запах — помахиванием · 7 красный лакмус синеет ·
 * 8 палочка с HCl — белый дым NH₄Cl.
 */
import * as THREE from 'three'
import { Pose, Target, ease, hill, mix, mixV, useRig, useSoundAt, type PFn, type V3 } from '../rigCore'
import { GasFill, PourStream } from '../parts/effects'
import { BOTTLE_H, LabStand, ReagentBottle, TUBE_H, TestTube, TubeRack, TubeTag } from '../parts/glassware'
import { Match, Matchbox, SpiritLamp } from '../parts/fire'
import { GlassPath, GlassRod, LitmusStrip, Mortar, Pestle, PpeTray, Puffs, WaftHand } from '../parts/practicalware'
import { useGearStep } from './useGearStep'

const Z = -0.06
const PPE: V3 = [0.34, 0, 0.16]
const MO: V3 = [0.06, 0, 0.15]
const RACK: V3 = [0.2, 0, -0.14]
const R_X = 0.16
const C_X = 0.24
const ROD_X = -0.4
const TILT = 0.1
const DIR: V3 = [Math.cos(TILT), -Math.sin(TILT), 0]
const B: V3 = [-0.37, 0.145, Z] // дно пробирки со смесью в лапке
const M: V3 = [B[0] + TUBE_H * DIR[0], B[1] + TUBE_H * DIR[1], Z] // отверстие
const OUT_TOP = 0.375
const COLLECT_C: V3 = [-0.17, 0.31, Z] // центр перевёрнутой пробирки
const COLLECT_MOUTH_Y = COLLECT_C[1] - TUBE_H / 2
const LAMP: V3 = [-0.3, 0, Z]
const LAMP_FLAME_Y = 0.081
const MATCHBOX: V3 = [-0.12, 0, 0.17]
const LITMUS: V3 = [0.18, 0.004, 0.17]
const HCL: V3 = [0.36, 0, Z]
const FILL = 0.05

const OUTLET_PATH: readonly V3[] = [
  [M[0] + 0.004, M[1] - 0.0004, Z],
  [-0.195, 0.1275, Z],
  [-0.178, 0.137, Z],
  [-0.171, 0.16, Z],
  [-0.17, 0.22, Z],
  [-0.17, OUT_TOP, Z],
]

const lampFlame: PFn = (p) => ease(p, 5.5, 5.7)
const nh3: PFn = (p) => ease(p, 5.6, 5.97)

/** Пробирка со смесью: в штативе → в лапку штатива, наклон отверстием немного вниз. */
function reactorPose(p: number) {
  const rest: V3 = [R_X, 0.012, RACK[2]]
  const lifted: V3 = [R_X, 0.22, RACK[2]]
  const over: V3 = [B[0] + 0.02, 0.3, Z]
  let pos = mixV(rest, lifted, ease(p, 3, 3.2))
  pos = mixV(pos, over, ease(p, 3.18, 3.5))
  pos = mixV(pos, B, ease(p, 3.5, 3.72))
  const k = ease(p, 3.3, 3.62)
  return { pos, rot: [0, 0, -(Math.PI / 2 + TILT) * k] as V3 }
}

/** Пробка с газоотводной трубкой (группа в координатах установки; в начале — на столе у штатива). */
function outletPose(p: number) {
  const k = ease(p, 3.68, 3.96)
  const lifted = ease(p, 3.6, 3.75)
  const restPos: V3 = [-0.02, 0.012 + 0.04 * lifted, 0.07]
  return { pos: mixV(restPos, M, k), rot: [mix(-Math.PI / 2, 0, k), 0, 0] as V3 }
}

/** Сухая пробирка-приёмник (центр): штатив → переворот → вверх дном на газоотводную трубку. */
function collectPose(p: number) {
  const rest: V3 = [C_X, 0.012 + TUBE_H / 2, RACK[2]]
  const lifted: V3 = [C_X, 0.3, RACK[2]]
  const above: V3 = [COLLECT_C[0], COLLECT_C[1] + 0.14, Z]
  let pos = mixV(rest, lifted, ease(p, 4, 4.2))
  pos = mixV(pos, above, ease(p, 4.2, 4.58))
  pos = mixV(pos, COLLECT_C, ease(p, 4.58, 4.92))
  return { pos, rot: [0, 0, Math.PI * ease(p, 4.15, 4.45)] as V3 }
}

export function Nh3Rig() {
  const { quality } = useRig()
  useGearStep('nh3', 0)
  useSoundAt(0.2, 'click', PPE, 0.5)
  useSoundAt(1.2, 'drawer', MO, 0.35)
  useSoundAt(2.4, 'pour', [R_X, 0.18, RACK[2]], 0.5)
  useSoundAt(2.96, 'glass-place', MO)
  useSoundAt(3.72, 'glass-clink', B)
  useSoundAt(3.96, 'click', M)
  useSoundAt(4.92, 'glass-clink', COLLECT_C)
  useSoundAt(5.45, 'flame-on', [LAMP[0], 0.09, Z])
  useSoundAt(5.7, 'flame-loop', [LAMP[0], 0.09, Z], 0.5)
  useSoundAt(5.65, 'hood-fan', COLLECT_C, 0.4)
  useSoundAt(6.3, 'click', [-0.1, 0.24, 0.02], 0.2)
  useSoundAt(7.55, 'fizz', [COLLECT_C[0], COLLECT_MOUTH_Y, Z], 0.3)
  useSoundAt(8.35, 'fizz', [COLLECT_C[0], COLLECT_MOUTH_Y, Z], 0.6)
  useSoundAt(8.95, 'success', [COLLECT_C[0], 0.3, Z], 0.6)

  return (
    <group>
      {/* Средства защиты на подносе */}
      <group position={PPE as unknown as THREE.Vector3Tuple}>
        <PpeTray worn={(p) => ease(p, 0, 0.95)} coat />
        <Target name="ppe" size={[0.16, 0.05, 0.1]} center={[0, 0.02, 0]} hintY={0.08} />
      </group>

      {/* Штатив: нижняя лапка — пробирка со смесью, верхняя — пробирка-приёмник */}
      <group position={[0, 0, Z]}>
        <LabStand rodX={ROD_X} clampX={-0.3} clampY={0.145} />
        <LabStand rodX={ROD_X} clampX={COLLECT_C[0]} clampY={0.34} />
      </group>

      {/* Ступка: NH₄Cl и Ca(OH)₂ → растёрты → пересыпаны в пробирку */}
      <Pose
        pose={(p) => {
          const lifted: V3 = [MO[0], 0.2, MO[2]]
          const pour: V3 = [R_X - 0.0543, 0.214, RACK[2]]
          let pos = mixV(MO, lifted, ease(p, 2, 2.16))
          pos = mixV(pos, pour, ease(p, 2.14, 2.38))
          pos = mixV(pos, lifted, ease(p, 2.8, 2.9))
          pos = mixV(pos, MO, ease(p, 2.88, 3))
          const tilt = ease(p, 2.34, 2.45) * (1 - ease(p, 2.76, 2.86))
          return { pos, rot: [0, 0, -1.2 * tilt] }
        }}
      >
        <Mortar powder={(p) => 1 - ease(p, 2.42, 2.76)} mix={(p) => ease(p, 1.1, 1.9)} />
        <Target name="mortar" size={[0.09, 0.05, 0.09]} center={[0, 0.022, 0]} hintY={0.08} />
      </Pose>
      <PourStream x={R_X} z={RACK[2]} top={() => 0.19} bottom={(p) => 0.012 + FILL * ease(p, 2.42, 2.76)} show={(p) => hill(p, 2.42, 2.76, 0.15)} color="#f6f6f2" />
      {/* Пестик: растирание круговыми движениями, потом — на стол */}
      <Pose
        pose={(p) => {
          const lean: V3 = [MO[0] + 0.012, 0.012, MO[2]]
          const grind = ease(p, 1.05, 1.12) * (1 - ease(p, 1.84, 1.9))
          const ang = (p - 1) * Math.PI * 2 * 6
          let pos: V3 = [lean[0] + Math.cos(ang) * 0.012 * grind - 0.012 * grind, lean[1] - 0.004 * grind, lean[2] + Math.sin(ang) * 0.012 * grind]
          const table: V3 = [MO[0] + 0.08, 0.011, MO[2] + 0.03]
          pos = mixV(pos, [MO[0], 0.12, MO[2]], ease(p, 1.88, 1.95))
          pos = mixV(pos, table, ease(p, 1.94, 2))
          const lie = ease(p, 1.94, 2)
          return { pos, rot: [0, 0, mix(-0.45 + 0.25 * grind * Math.cos(ang), -Math.PI / 2, lie)] }
        }}
      >
        <Pestle />
      </Pose>
      <group position={[MO[0] + 0.03, 0, MO[2]]}>
        <Target name="pestle" size={[0.07, 0.1, 0.06]} center={[0, 0.06, 0]} hintY={0.13} ring={false} />
      </group>

      {/* Штатив для пробирок */}
      <group position={RACK as unknown as THREE.Vector3Tuple}>
        <TubeRack xs={[R_X - RACK[0], C_X - RACK[0]]} />
      </group>

      {/* Пробирка со смесью */}
      <Pose pose={reactorPose}>
        <TestTube level={(p) => FILL * ease(p, 2.42, 2.76)} liquidColor="#f3f3ef" liquidOpacity={0.97} />
        <group position={[0, 0.1, 0]}>
          <TubeTag text="1/3" />
        </group>
        <Target name="reactor-tube" size={[0.04, 0.16, 0.04]} center={[0, 0.075, 0]} ring={false} hintY={0.18} />
      </Pose>
      {/* капли воды у отверстия (оно наклонено вниз — вода не стекает на горячее дно) */}
      <Pose pose={(p) => ({ pos: [M[0] - 0.012, M[1] - 0.006, Z], scale: ease(p, 5.75, 5.98) })}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[-i * 0.006, (i % 2) * 0.002, (i % 3) * 0.003 - 0.003]}>
            <sphereGeometry args={[0.0013 + (i % 2) * 0.0005, 8, 6]} />
            <meshStandardMaterial color="#e9f5ff" transparent opacity={0.85} roughness={0.02} />
          </mesh>
        ))}
      </Pose>

      {/* Пробка с изогнутой газоотводной трубкой */}
      <Pose pose={outletPose}>
        <group position={[-M[0], -M[1], -Z]}>
          <mesh position={[M[0] - 0.006 * DIR[0], M[1] - 0.006 * DIR[1], Z]} rotation={[0, 0, -(Math.PI / 2 + TILT)]} castShadow>
            <cylinderGeometry args={[0.0115, 0.0095, 0.022, 18]} />
            <meshStandardMaterial color="#3d3f44" roughness={0.85} />
          </mesh>
          <GlassPath points={OUTLET_PATH} radius={0.0028} />
        </group>
      </Pose>

      {/* Сухая пробирка вверх дном: аммиак заполняет её сверху вниз */}
      <Pose pose={collectPose}>
        <group position={[0, -TUBE_H / 2, 0]}>
          <TestTube />
          <GasFill fill={nh3} length={TUBE_H - 0.012} />
          <Target name="collect-tube" size={[0.04, 0.16, 0.04]} center={[0, 0.075, 0]} ring={false} hintY={0.19} />
        </group>
      </Pose>
      {/* газ у отверстия: запах (помахивание), реакция с HCl */}
      <Puffs origin={[COLLECT_C[0], COLLECT_MOUTH_Y - 0.004, Z]} rate={(p) => hill(p, 6.12, 6.98, 0.2)} color="#dbe6f4" count={26} rise={0.03} spread={0.012} drift={[0.05, 0.02, 0.2]} size={0.008} opacity={0.18} life={1.4} />

      {/* Ладонь — помахивание от отверстия к себе */}
      <Pose
        pose={(p, t) => {
          const show = hill(p, 6.05, 6.98, 0.12)
          const wave = Math.sin(t * 9) * 0.025 * show
          return { pos: [-0.1 + wave * 0.4, 0.25 + wave * 0.5, 0.04 + wave], rot: [-0.5 + wave * 6, 0.3, 0], scale: show }
        }}
      >
        <WaftHand />
      </Pose>
      <group position={[-0.1, 0, 0.02]}>
        <Target name="waft" size={[0.08, 0.06, 0.08]} center={[0, 0.24, 0]} ring={false} hintY={0.29} />
      </group>

      {/* Спиртовка под пробиркой со смесью и спички */}
      <group position={LAMP as unknown as THREE.Vector3Tuple}>
        <SpiritLamp flame={lampFlame} capOff={(p) => ease(p, 5, 5.35)} />
        <Target name="spirit-lamp" size={[0.08, 0.1, 0.08]} center={[0, 0.045, 0]} hintY={0.12} />
      </group>
      <group position={MATCHBOX as unknown as THREE.Vector3Tuple}>
        <Matchbox />
      </group>
      <Pose
        pose={(p) => {
          const rest: V3 = [MATCHBOX[0] - 0.025, 0.018, MATCHBOX[2]]
          const raised: V3 = [MATCHBOX[0] - 0.05, 0.09, MATCHBOX[2] - 0.06]
          const atWick: V3 = [LAMP[0] - 0.048, LAMP_FLAME_Y + 0.004, LAMP[2] + 0.004]
          const dropped: V3 = [MATCHBOX[0] - 0.02, 0.002, MATCHBOX[2] + 0.03]
          let pos = mixV(rest, raised, ease(p, 5.28, 5.38))
          pos = mixV(pos, atWick, ease(p, 5.38, 5.52))
          pos = mixV(pos, dropped, ease(p, 5.7, 5.9))
          return { pos, rot: [0, mix(Math.PI, Math.PI + 0.4, ease(p, 5.7, 5.9)), 0] }
        }}
      >
        <Match lit={(p) => ease(p, 5.34, 5.4) * (1 - ease(p, 5.72, 5.85))} />
      </Pose>

      {/* Влажная красная лакмусовая бумажка в пинцете */}
      <Pose
        pose={(p) => {
          const lifted: V3 = [LITMUS[0], 0.12, LITMUS[2]]
          const atMouth: V3 = [COLLECT_C[0] + 0.002, COLLECT_MOUTH_Y - 0.008, Z + 0.004]
          const used: V3 = [0.08, 0.004, 0.2]
          let pos = mixV(LITMUS, lifted, ease(p, 7, 7.15))
          pos = mixV(pos, [atMouth[0], 0.1, atMouth[2]], ease(p, 7.12, 7.36))
          pos = mixV(pos, atMouth, ease(p, 7.34, 7.5))
          pos = mixV(pos, [atMouth[0], 0.08, atMouth[2] + 0.06], ease(p, 8, 8.12))
          pos = mixV(pos, used, ease(p, 8.1, 8.24))
          const up = ease(p, 7.05, 7.3) * (1 - ease(p, 8.08, 8.22))
          return { pos, rot: [mix(Math.PI / 2, Math.PI, up), 0, 0] }
        }}
      >
        <LitmusStrip blue={(p) => ease(p, 7.52, 7.95)} />
        <Target name="litmus" size={[0.03, 0.03, 0.13]} center={[0, 0, 0.065]} hintY={0.05} />
      </Pose>

      {/* Концентрированная HCl со стеклянной палочкой */}
      <group position={[HCL[0], BOTTLE_H, HCL[2]]}>
        <ReagentBottle formula="HCl" name="конц." level={() => 0.7} />
      </group>
      <Pose
        pose={(p) => {
          const rest: V3 = [HCL[0], 0.05, HCL[2]]
          const lifted: V3 = [HCL[0], 0.3, HCL[2]]
          const near: V3 = [COLLECT_C[0] + 0.012, COLLECT_MOUTH_Y - 0.012, Z + 0.006]
          let pos = mixV(rest, lifted, ease(p, 8, 8.14))
          pos = mixV(pos, [near[0] + 0.06, 0.3, near[2]], ease(p, 8.12, 8.3))
          pos = mixV(pos, near, ease(p, 8.28, 8.4))
          return { pos, rot: [0, 0, -0.75 * ease(p, 8.12, 8.3)] }
        }}
      >
        <GlassRod length={0.2} wetColor="#eef6ff" />
      </Pose>
      <group position={[HCL[0], 0, HCL[2]]}>
        <Target name="hcl-rod" size={[0.06, 0.28, 0.06]} center={[0, 0.16, 0]} hintY={0.3} />
      </group>
      {/* «Дым без огня» — мельчайшие кристаллы NH₄Cl */}
      <Puffs
        origin={[COLLECT_C[0] + 0.006, COLLECT_MOUTH_Y - 0.01, Z]}
        rate={(p) => ease(p, 8.36, 8.55)}
        color="#ffffff"
        count={quality === 'high' ? 110 : 60}
        rise={0.11}
        spread={0.05}
        drift={[0.04, 0.03, 0.05]}
        size={0.011}
        opacity={0.6}
        life={2.4}
      />
      <Puffs
        origin={[COLLECT_C[0] + 0.012, COLLECT_MOUTH_Y - 0.016, Z + 0.004]}
        rate={(p) => ease(p, 8.38, 8.6)}
        color="#f4f6f8"
        count={40}
        rise={-0.05}
        spread={0.03}
        drift={[0.03, -0.02, 0.04]}
        size={0.009}
        opacity={0.45}
        life={2}
      />
    </group>
  )
}
