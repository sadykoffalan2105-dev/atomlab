/**
 * Kimyo 9, с. 174, пример 8: медь из 40 г 20 %-го раствора CuSO₄ и железа.
 * Шаги: 0 очки и перчатки · 1 сухой фильтр на весы (m₀) · 2 стакан 100 мл на весы · 3 тара · 4 40,0 г CuSO₄ (m₁) ·
 * 5 ~3 г железного порошка шпателем (m₂) · 6 перемешивание (ускорено): медь, голубой → бледно-зелёный, масса та же ·
 * 7 5 мл 10 %-й HCl — пузырьки H₂, лишнее железо растворяется · 8 медь на фильтр, промывание · 9 сушка 80 °C ·
 * 10 ноль, фильтр с медью на весы (m₃). Все числа на весах — из попытки (useLabTaskValues).
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Pose, Target, ease, hill, mix, mixV, useRig, useSoundAt, type PFn, type PoseValue, type V3 } from '../../../rigCore'
import { PourStream } from '../../../parts/effects'
import { Falling, FUNNEL, GlassRod, PpeTray } from '../../../parts/practicalware'
import { useGearStep } from '../../useGearStep'
import { Spatula, bottlePose } from '../../worksKit'
import { useLabTaskValues } from '../../../../measure/labTaskSession'
import { DigitalScales, SCALES } from '../../../../measure/devices/Scales'
import { BEAKERS, MeasuringBeaker, RisingBubbles, beakerLevel } from '../../../../measure/devices/Glass'
import { PowderJar } from '../../../../measure/devices/Bench'
import { solutionDensity } from '../../../../measure/quantities'
import { FUN, FilterStation, SolutionBottle, panAt, track, type FilterPlan } from './g9Kit'

const ID = 'task-g9-cu-from-cuso4' as const
const PPE: V3 = [0.52, 0, 0.21]
const SC: V3 = [-0.22, 0, 0.06]
const PAN = panAt(SC)
const BK = BEAKERS[100]
const BK_RO = BK.ri + 0.0012
const B0: V3 = [-0.42, 0, -0.06]
const AFTER: V3 = [-0.06, 0, 0.06]
const CU_B: V3 = [-0.5, 0, 0.17]
const HCL_B: V3 = [-0.02, 0, 0.17]
const LIP_Y = PAN[1] + BK.h + 0.03
const JAR: V3 = [-0.45, 0, 0.07]
const SPAT_REST: V3 = [-0.62, 0.003, 0.0]
const STIR_REST: V3 = [-0.33, 0.003, -0.21]
/** Масса пустого стакана на 100 мл (г) — до тары. */
const MB = 52.38
const V_HCL = 5
/** Слои на дне (м): железный порошок ~1 мл и рыхлая медная «губка» ~1,6 мл на дне Ø 51 мм (чуть заметнее). */
const FE_T = 0.0012
const CU_T = 0.002
const FLOOR = 0.003
/** Доля железа в стакане после каждого из 3 заходов шпателем. */
const CUM = [0.45, 0.85, 1]
const TRIP = 0.2
const T0 = 5.04
const LIP: V3 = [FUN[0], FUN[1] + FUNNEL.coneH + 0.012, FUN[2] + 0.012]
const NEAR: V3 = [LIP[0], 0.29, LIP[2] + 0.07]
const TILT = 1.75
const BLUE = '#3f93dc'
const GREEN = '#d3e6c4'
const C_FE = '#55595e'
const C_CU = '#a5532c'

const tipAt = (i: number) => T0 + i * TRIP + TRIP * 0.62
const feFrac: PFn = (p) => {
  let f = 0
  for (let i = 0; i < CUM.length; i++) f = mix(f, CUM[i]!, ease(p, tipAt(i), tipAt(i) + 0.03))
  return f
}
/** Сколько CuSO₄ прореагировало: чуть-чуть, пока железо сыплют, остальное — при перемешивании (замедляясь). */
const reacted: PFn = (p) => {
  const a = 0.06 * ease(p, 5.2, 5.98)
  if (p < 6.25) return a
  const x = Math.min(1, (p - 6.25) / 0.65)
  return a + (1 - a) * ((1 - Math.exp(-3.2 * x)) / (1 - Math.exp(-3.2)))
}
const out: PFn = (p) => ease(p, 8.44, 8.62)
/** Железо: по мере реакции расходуется; остаток (~7 %) растворяет соляная кислота. */
const feLayer: PFn = (p) => FE_T * feFrac(p) * (1 - 0.93 * reacted(p)) * (1 - ease(p, 7.55, 7.9))
const cuLayer: PFn = (p) => CU_T * reacted(p) * (1 - out(p))

function spatulaPose(p: number) {
  const inJar: V3 = [JAR[0] - 0.006, 0.045, JAR[2]]
  const over: V3 = [PAN[0] - 0.008, PAN[1] + BK.h + 0.035, PAN[2]]
  if (p <= 5 || p >= 6) return { pos: SPAT_REST, rot: [0, 0, 0] as V3, full: 0 }
  if (p < T0) {
    const k = ease(p, 5, T0)
    return { pos: mixV(mixV(SPAT_REST, [SPAT_REST[0], 0.12, SPAT_REST[2]], ease(p, 5, 5.02)), inJar, ease(p, 5.015, T0)), rot: [0, 0, 1.1 * k] as V3, full: 0 }
  }
  const end = T0 + CUM.length * TRIP
  if (p >= end) {
    const k = ease(p, end, 5.98)
    return { pos: mixV(mixV(over, [over[0], 0.2, over[2]], ease(p, end, end + 0.03)), SPAT_REST, ease(p, end + 0.02, 5.98)), rot: [0, 0, mix(0.35, 0, k)] as V3, full: 0 }
  }
  const i = Math.floor((p - T0) / TRIP)
  const f = (p - T0) / TRIP - i
  // 0–0.2 зачерпнуть, 0.2–0.55 к стакану (дугой над краем), 0.55–0.75 высыпать, 0.75–1 обратно
  const go = ease(f, 0.2, 0.55) * (1 - ease(f, 0.78, 1))
  const pos = mixV(inJar, over, go)
  const hump = 0.06 * Math.sin(Math.PI * Math.min(1, Math.max(0, f < 0.6 ? (f - 0.2) / 0.35 : (f - 0.78) / 0.22)))
  const roll = -1.3 * hill(f, 0.56, 0.76, 0.3)
  return { pos: [pos[0], pos[1] + hump, pos[2]] as V3, rot: [roll, 0, mix(1.1, 0.35, go)] as V3, full: f > 0.18 && f < 0.62 ? 1 : 0 }
}

/** Палочка: со стола → вертикально в стакан на весах → круги (ускорено) → обратно на стол. */
function stirPose(p: number) {
  const lifted: V3 = [STIR_REST[0], 0.3, STIR_REST[2]]
  const inBeaker: V3 = [PAN[0] + 0.008, PAN[1] + 0.006, PAN[2]]
  let pos = mixV(STIR_REST, lifted, ease(p, 6, 6.1))
  pos = mixV(pos, [inBeaker[0], 0.3, inBeaker[2]], ease(p, 6.08, 6.2))
  pos = mixV(pos, inBeaker, ease(p, 6.18, 6.28))
  const stir = ease(p, 6.26, 6.32) * (1 - ease(p, 6.88, 6.92))
  const a = (p - 6.2) * Math.PI * 2 * 8
  pos = [pos[0] + Math.cos(a) * 0.006 * stir, pos[1], pos[2] + Math.sin(a) * 0.006 * stir]
  pos = mixV(pos, [inBeaker[0], 0.3, inBeaker[2]], ease(p, 6.9, 6.94))
  pos = mixV(pos, lifted, ease(p, 6.93, 6.97))
  pos = mixV(pos, STIR_REST, ease(p, 6.96, 7))
  const upright = ease(p, 6, 6.18) * (1 - ease(p, 6.93, 7))
  return { pos, rot: [0, 0, mix(-Math.PI / 2, -0.1 * stir, upright)] as V3 }
}

/** Стакан: на весы (шаг 2), к воронке — наклон к доске вокруг оси X, слив (шаг 8), на стол рядом. */
const onBench = track(B0, [[2.3, 2.95, PAN, 0.12]])
function beakerPose(p: number): PoseValue {
  if (p < 8.3) return { pos: onBench(p) }
  const k = ease(p, 8.39, 8.47) * (1 - ease(p, 8.6, 8.66))
  const b = -TILT * k
  const ny = BK.h * Math.cos(b) + BK_RO * Math.sin(b)
  const nz = BK.h * Math.sin(b) - BK_RO * Math.cos(b)
  const base: V3 = [LIP[0], LIP[1] - ny, LIP[2] - nz]
  let q = mixV(PAN, [PAN[0], NEAR[1], PAN[2]], ease(p, 8.3, 8.34))
  q = mixV(q, NEAR, ease(p, 8.33, 8.39))
  q = mixV(q, base, k)
  q = mixV(q, [AFTER[0], NEAR[1], AFTER[2]], ease(p, 8.66, 8.72))
  q = mixV(q, AFTER, ease(p, 8.71, 8.78))
  return { pos: q, rot: [b, 0, 0] }
}

/** Слои на дне стакана: серое железо снизу, красно-бурая медь поверх (в группе стакана). */
function BottomLayers() {
  const { p } = useRig()
  const fe = useMemo(() => new THREE.MeshStandardMaterial({ color: C_FE, roughness: 0.75, metalness: 0.35 }), [])
  const cu = useMemo(() => new THREE.MeshStandardMaterial({ color: C_CU, roughness: 0.9, metalness: 0.1 }), [])
  const feM = useRef<THREE.Mesh>(null)
  const cuM = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const pv = p.current ?? 0
    const tf = feLayer(pv)
    const tc = cuLayer(pv)
    if (feM.current) {
      feM.current.visible = tf > 0.0001
      feM.current.scale.set(1, Math.max(1e-4, tf), 1)
      feM.current.position.y = FLOOR + tf / 2
    }
    if (cuM.current) {
      cuM.current.visible = tc > 0.0001
      cuM.current.scale.set(1, Math.max(1e-4, tc), 1)
      cuM.current.position.y = FLOOR + tf + tc / 2
    }
  })
  return (
    <group>
      <mesh ref={feM} material={fe} renderOrder={1}>
        <cylinderGeometry args={[BK.ri - 0.0007, BK.ri - 0.0007, 1, 28]} />
      </mesh>
      <mesh ref={cuM} material={cu} renderOrder={1}>
        <cylinderGeometry args={[BK.ri - 0.0007, BK.ri - 0.0007, 1, 28]} />
      </mesh>
    </group>
  )
}

export function CuFromCuso4Rig() {
  const v = useLabTaskValues(ID)
  const { lang } = useRig()
  useGearStep(ID, 0)
  const tareAt: V3 = [SC[0] + SCALES.tareBtn[0], 0.02, SC[2] + 0.1]
  useSoundAt(0.2, 'click', PPE, 0.5)
  useSoundAt(2.92, 'glass-place', PAN, 0.4)
  useSoundAt(3.3, 'click', tareAt, 0.5)
  useSoundAt(4.46, 'pour', PAN, 0.5)
  useSoundAt(6.3, 'glass-clink', PAN, 0.35)
  useSoundAt(7.48, 'pour', PAN, 0.4)
  useSoundAt(7.56, 'fizz', PAN, 0.45)
  useSoundAt(8.77, 'glass-place', AFTER, 0.35)
  useSoundAt(10.08, 'click', tareAt, 0.5)
  useSoundAt(10.97, 'success', PAN, 0.4)

  const mF = v.mF ?? 0.85
  const m1 = v.m1 ?? 40
  const m2 = v.m2 ?? 43
  const mFP = v.mFP ?? 4.05
  const mFe = m2 - m1
  const V1 = m1 / solutionDensity('CuSO4', 0.2)
  const e1: PFn = (p) => ease(p, 4.46, 4.74)
  const eAcid: PFn = (p) => ease(p, 7.46, 7.74)
  const vol: PFn = (p) => (V1 * e1(p) + V_HCL * eAcid(p)) * (1 - out(p))
  const surface: PFn = (p) => PAN[1] + beakerLevel(BK, vol(p))

  // голубой → бледно-зелёный по мере реакции
  const cA = useMemo(() => new THREE.Color(BLUE), [])
  const cB = useMemo(() => new THREE.Color(GREEN), [])
  const cT = useMemo(() => new THREE.Color(), [])
  const liquid = (p: number) => `#${cT.copy(cA).lerp(cB, reacted(p)).getHexString()}`

  /* весы: фильтр (m₀) → стакан → тара → CuSO₄ (m₁) → железо (m₂) → кислота → стакан снят → ноль → фильтр (m₃) */
  const reading = (p: number) => {
    let load = 0
    if (p >= 1.66 && p < 2.04) load += mF
    if (p >= 2.92 && p < 8.31) load += MB + m1 * e1(p) + mFe * feFrac(p) + V_HCL * solutionDensity('HCl', 0.1) * eAcid(p)
    if (p >= 10.58) load += mFP
    let tare = 0
    if (p >= 3.3) tare = MB
    if (p >= 10.1) tare = 0
    return load - tare
  }
  const chip: PFn = (p) => ((p >= 1.72 && p < 2.0) || (p >= 4.72 && p < 5.0) || (p >= 5.72 && p < 6.0) || (p >= 6.86 && p < 7.3) || p >= 10.72 ? 1 : 0)

  const plan: FilterPlan = {
    sc: SC,
    weigh: 1,
    clear: 2,
    filter: 8,
    dry: 9,
    weigh2: 10,
    how: 'oven',
    solid: C_CU,
    liquid: GREEN,
    filtrate: '#dcecd2',
    filtrateMl: V1 + V_HCL + 20,
    ovenT: 80,
    receiver: 250,
  }

  const cuBottle = bottlePose(CU_B, [[4, PAN[0], PAN[2], LIP_Y]])
  const hclBottle = bottlePose(HCL_B, [[7, PAN[0], PAN[2], LIP_Y]])

  return (
    <group>
      <group position={PPE as unknown as THREE.Vector3Tuple}>
        <PpeTray worn={(p) => ease(p, 0, 0.95)} />
        <Target name="ppe" size={[0.16, 0.05, 0.1]} center={[0, 0.02, 0]} hintY={0.08} />
      </group>

      {/* весы и кнопка тары */}
      <group position={SC as unknown as THREE.Vector3Tuple}>
        <DigitalScales reading={reading} readout={chip} />
        <group position={SCALES.tareBtn as unknown as THREE.Vector3Tuple}>
          <Target name="tare" size={[0.03, 0.03, 0.03]} center={[0, 0, 0.004]} hintY={0.05} ring={false} />
        </group>
      </group>

      {/* стакан 100 мл: CuSO₄ → железо → медь, раствор бледнеет → кислота → на фильтр */}
      <Pose pose={beakerPose}>
        <MeasuringBeaker size={BK} volume={vol} color={liquid} cloud={(p) => 0.45 * hill(p, 6.28, 6.92, 0.2) + 0.5 * ease(p, 8.36, 8.42) * (1 - out(p))} solidColor={C_CU} />
        <BottomLayers />
        <RisingBubbles r={BK.ri * 0.8} fromY={() => FLOOR + 0.002} toY={(p) => beakerLevel(BK, vol(p))} rate={(p) => 0.9 * hill(p, 7.5, 7.98, 0.25)} n={36} />
        <Target name="beaker" size={[0.07, 0.08, 0.07]} center={[0, 0.04, 0]} hintY={0.1} />
      </Pose>
      <Falling from={[PAN[0] - 0.008, PAN[1] + BK.h + 0.03, PAN[2]]} toY={(p) => PAN[1] + FLOOR + feLayer(p)} a={T0 + 0.1} b={T0 + CUM.length * TRIP} n={14} color={C_FE} size={0.0016} box jitter={0.007} />

      {/* склянки: CuSO₄ и соляная кислота */}
      <SolutionBottle pose={cuBottle} formula="CuSO₄ 20 %" name={{ ru: 'сульфат меди(II)', en: 'copper(II) sulfate', uz: 'mis(II) sulfat' }[lang]} level={(p) => mix(0.9, 0.5, e1(p))} target="bottle-cuso4" color={BLUE} />
      <SolutionBottle pose={hclBottle} formula="HCl 10 %" name={{ ru: 'соляная кислота', en: 'hydrochloric acid', uz: 'xlorid kislota' }[lang]} level={(p) => mix(0.8, 0.72, eAcid(p))} target="bottle-hcl" />
      <PourStream x={PAN[0] + 0.003} z={PAN[2]} top={() => LIP_Y - 0.004} bottom={surface} show={(p) => hill(p, 4.46, 4.74, 0.15)} color={BLUE} />
      <PourStream x={PAN[0] - 0.003} z={PAN[2]} top={() => LIP_Y - 0.004} bottom={surface} show={(p) => hill(p, 7.46, 7.74, 0.15)} />
      <PourStream x={LIP[0]} z={LIP[2]} top={() => LIP[1] - 0.004} bottom={() => FUN[1] + 0.03} show={(p) => hill(p, 8.45, 8.62, 0.15)} color={GREEN} />

      {/* банка с железным порошком и шпатель */}
      <group position={JAR as unknown as THREE.Vector3Tuple}>
        <PowderJar formula="Fe" name={{ ru: 'железо, порошок', en: 'iron powder', uz: 'temir kukuni' }[lang]} color={C_FE} fill={0.55} open={(p) => ease(p, 4.9, 5.0) * (1 - ease(p, 5.95, 6))} />
      </group>
      <Pose
        pose={(p) => {
          const s = spatulaPose(p)
          return { pos: s.pos, rot: s.rot }
        }}
      >
        <Spatula full={(p) => spatulaPose(p).full} color={C_FE} />
        <Target name="spatula" size={[0.15, 0.03, 0.04]} center={[0.06, 0.004, 0]} hintY={0.05} ring={false} />
      </Pose>

      {/* стеклянная палочка */}
      <Pose pose={stirPose}>
        <GlassRod length={0.2} />
      </Pose>
      <group position={[STIR_REST[0] + 0.1, 0, STIR_REST[2]]}>
        <Target name="stir-rod" size={[0.21, 0.03, 0.04]} center={[0, 0.006, 0]} hintY={0.05} />
      </group>

      {/* воронка с фильтром, промывалка, сушильный шкаф */}
      <FilterStation f={plan} />
    </group>
  )
}
