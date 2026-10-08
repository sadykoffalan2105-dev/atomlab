/**
 * Kimyo 9, с. 36, пример 1: 104 г 5 %-го BaCl₂ + 71 г 10 %-го Na₂SO₄ → сколько BaSO₄ выпало в осадок.
 * Шаги: 0 очки и перчатки · 1 сухой фильтр на весы (m₀) · 2 стакан на весы · 3 тара · 4 104,0 г BaCl₂ (m₁) · 5 тара ·
 * 6 71,0 г Na₂SO₄ — белый осадок сразу (m₂) · 7 осадок оседает, проба раствора над ним: + BaCl₂ — муть, + Na₂SO₄ — нет ·
 * 8 смесь на фильтр, промывание · 9 сушка 105 °C · 10 ноль, фильтр с осадком на весы (m₃).
 * Все числа на приборах — из попытки (useLabTaskValues): к концу шага весы показывают то, что записано в журнал.
 */
import {  } from 'react'
import * as THREE from 'three'
import { Pose, Target, ease, hill, mix, mixV, useRig, useSoundAt, type PFn, type PoseValue, type V3 } from '../../../rigCore'
import { PourStream } from '../../../parts/effects'
import { TestTube, TubeRack, TUBE_H } from '../../../parts/glassware'
import { DropperBottle, Falling, FUNNEL, Pipette, PpeTray } from '../../../parts/practicalware'
import { useGearStep } from '../../useGearStep'
import { bottlePose, pipettePose } from '../../worksKit'
import { useLabTaskValues } from '../../../../measure/labTaskSession'
import { DigitalScales, Readout, SCALES } from '../../../../measure/devices/Scales'
import { BEAKERS, MeasuringBeaker, beakerLevel } from '../../../../measure/devices/Glass'
import { TUBE_GEOM, heightForVolume, solutionDensity } from '../../../../measure/quantities'
import { FUN, FilterStation, SolutionBottle, panAt, track, type FilterPlan } from './g9Kit'
import { useOwned } from '../../../../measure/devices/deviceTextures'

const ID = 'task-g9-baso4-excess' as const
const PPE: V3 = [0.52, 0, 0.21]
const SC: V3 = [-0.22, 0, 0.06]
const PAN = panAt(SC)
const BK = BEAKERS[250]
const BK_RO = BK.ri + 0.0012
const B0: V3 = [-0.42, 0, -0.06]
/** Куда ставят пустой стакан после фильтрования (между весами и фильтром). */
const AFTER: V3 = [-0.06, 0, 0.06]
const BA: V3 = [-0.5, 0, 0.17]
const NA: V3 = [-0.02, 0, 0.17]
const LIP_Y = PAN[1] + BK.h + 0.03
/** Штатив с двумя пробирками для пробы и капельницы с BaCl₂ и Na₂SO₄. */
const RACK: V3 = [-0.47, 0, -0.19]
const TUBE_Y = 0.012
const T1: V3 = [RACK[0] - 0.04, TUBE_Y, RACK[2]]
const T2: V3 = [RACK[0] + 0.04, TUBE_Y, RACK[2]]
const DRIP_Y = TUBE_Y + TUBE_H + 0.01
const DB1: V3 = [-0.6, 0, -0.1]
const DB2: V3 = [-0.6, 0, -0.02]
/** Пипетка для пробы лежит на столе: кончик здесь, груша — левее (радиус груши 6,2 мм). */
const PIP: V3 = [-0.47, 0.0062, 0.05]
/** Масса пустого стакана на 250 мл (г) — до тары. */
const MB = 98.47
/** Слой только что осевшего BaSO₄ (м): 5,8 г мелких кристаллов рыхлым слоем ≈ 10 мл на дне Ø 67 мм. */
const BED = 0.003
/** Проба над осадком: по 2 мл в каждую пробирку. */
const SAMPLE_ML = 4
const SAMPLE_TUBE_H = heightForVolume(TUBE_GEOM, SAMPLE_ML / 2)
/** Носик стакана при сливе на фильтр — над передней половиной воронки. */
const LIP: V3 = [FUN[0], FUN[1] + FUNNEL.coneH + 0.012, FUN[2] + 0.012]
const NEAR: V3 = [LIP[0], 0.29, LIP[2] + 0.07]
const TILT = 1.75
const C_SOL = '#eef6ff'

/** Стакан: на весы (шаг 2), к воронке — наклон к доске вокруг оси X, слив (шаг 8), на стол рядом. */
const onBench = track(B0, [[2.3, 2.95, PAN, 0.12]])
function beakerPose(p: number): PoseValue {
  if (p < 8.3) return { pos: onBench(p) }
  const k = ease(p, 8.39, 8.47) * (1 - ease(p, 8.6, 8.66))
  const b = -TILT * k
  // носик (0, h, −r) после поворота на b вокруг X должен оставаться у LIP
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

/**
 * Пипетка для пробы: лёжа → вертикально над стаканом → кончик на 1,2 см под поверхность (далеко над осадком) →
 * набрать → по 2 мл в две пробирки → обратно. surfaceY — уровень раствора в стакане на весах.
 */
const samplePose = (surfaceY: number) => (p: number): PoseValue & { squeeze: number } => {
  const up = (x: V3, y = 0.21): V3 => [x[0], y, x[2]]
  const over: V3 = [PAN[0] + 0.012, 0.21, PAN[2]]
  const dip: V3 = [PAN[0] + 0.012, surfaceY - 0.012, PAN[2]]
  let q = mixV(PIP, up(PIP), ease(p, 7.28, 7.33))
  q = mixV(q, over, ease(p, 7.32, 7.37))
  q = mixV(q, dip, ease(p, 7.37, 7.4))
  q = mixV(q, over, ease(p, 7.44, 7.46))
  q = mixV(q, [T1[0], DRIP_Y, T1[2]], ease(p, 7.46, 7.51))
  q = mixV(q, [T2[0], DRIP_Y, T2[2]], ease(p, 7.54, 7.57))
  q = mixV(q, up(T2), ease(p, 7.6, 7.62))
  q = mixV(q, up(PIP), ease(p, 7.62, 7.67))
  q = mixV(q, PIP, ease(p, 7.67, 7.71))
  const upright = ease(p, 7.28, 7.33) * (1 - ease(p, 7.64, 7.7))
  const squeeze = hill(p, 7.39, 7.43, 0.35) + hill(p, 7.51, 7.54, 0.3) + hill(p, 7.57, 7.6, 0.3)
  return { pos: q, rot: [0, 0, (Math.PI / 2) * (1 - upright)], squeeze }
}

/** Капельница работает в окне [a, b] шага (pipettePose рассчитан на целый шаг — сжимаем время). */
function dropIn(rest: V3, tube: V3, a: number, b: number) {
  const f = pipettePose(rest, [[0, tube[0], tube[2], DRIP_Y]])
  return (p: number) => f((p - a) / (b - a))
}
const drop1 = dropIn(DB1, T1, 7.7, 7.8)
const drop2 = dropIn(DB2, T2, 7.82, 7.92)

export function Baso4ExcessRig() {
  const v = useLabTaskValues(ID)
  const { lang } = useRig()
  const darkCard = useOwned(() => new THREE.MeshStandardMaterial({ color: '#1e252c', roughness: 0.85 }), [])
  useGearStep(ID, 0)
  useSoundAt(0.2, 'click', PPE, 0.5)
  useSoundAt(2.92, 'glass-place', PAN, 0.4)
  useSoundAt(3.3, 'click', [SC[0] + SCALES.tareBtn[0], 0.02, SC[2] + 0.1], 0.5)
  useSoundAt(4.46, 'pour', PAN, 0.5)
  useSoundAt(5.3, 'click', [SC[0] + SCALES.tareBtn[0], 0.02, SC[2] + 0.1], 0.5)
  useSoundAt(6.46, 'pour', PAN, 0.5)
  useSoundAt(7.74, 'glass-clink', T1, 0.2)
  useSoundAt(7.86, 'glass-clink', T2, 0.2)
  useSoundAt(8.77, 'glass-place', AFTER, 0.35)
  useSoundAt(10.08, 'click', [SC[0] + SCALES.tareBtn[0], 0.02, SC[2] + 0.1], 0.5)
  useSoundAt(10.97, 'success', PAN, 0.4)

  const mF = v.mF ?? 0.85
  const m1 = v.m1 ?? 104
  const m2 = v.m2 ?? 71
  const mFP = v.mFP ?? 6.6
  const V1 = m1 / solutionDensity('BaCl2', 0.05)
  const V2 = m2 / solutionDensity('Na2SO4', 0.1)
  const sampleG = SAMPLE_ML * 1.07
  const e1: PFn = (p) => ease(p, 4.46, 4.74)
  const e2: PFn = (p) => ease(p, 6.46, 6.74)
  const sampled: PFn = (p) => ease(p, 7.39, 7.43)
  const out: PFn = (p) => ease(p, 8.44, 8.62)
  const vol: PFn = (p) => (V1 * e1(p) + V2 * e2(p) - SAMPLE_ML * sampled(p)) * (1 - out(p))
  const surface: PFn = (p) => PAN[1] + beakerLevel(BK, vol(p))
  const sample = samplePose(PAN[1] + beakerLevel(BK, V1 + V2))

  /* весы: фильтр (m₀) → стакан → тара → BaCl₂ (m₁) → тара → Na₂SO₄ (m₂) → проба −2 г → стакан снят → ноль → фильтр (m₃) */
  const reading = (p: number) => {
    let load = 0
    if (p >= 1.66 && p < 2.04) load += mF
    if (p >= 2.92 && p < 8.31) load += MB + m1 * e1(p) + m2 * e2(p) - sampleG * sampled(p)
    if (p >= 10.58) load += mFP
    let tare = 0
    if (p >= 3.3) tare = MB
    if (p >= 5.3) tare = MB + m1
    if (p >= 10.1) tare = 0
    return load - tare
  }
  const chip: PFn = (p) => ((p >= 1.72 && p < 2.0) || (p >= 4.72 && p < 5.25) || (p >= 6.72 && p < 7.28) || p >= 10.72 ? 1 : 0)

  const plan: FilterPlan = {
    sc: SC,
    weigh: 1,
    clear: 2,
    filter: 8,
    dry: 9,
    weigh2: 10,
    how: 'oven',
    solid: '#fbfbfa',
    liquid: '#eef1f4',
    filtrate: C_SOL,
    filtrateMl: V1 + V2 - SAMPLE_ML + 20,
    ovenT: 105,
    receiver: 250,
  }

  const baBottle = bottlePose(BA, [[4, PAN[0], PAN[2], LIP_Y]])
  const naBottle = bottlePose(NA, [[6, PAN[0], PAN[2], LIP_Y]])

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

      {/* стакан 250 мл: BaCl₂ → Na₂SO₄ → белая взвесь → осадок осел → на фильтр */}
      <Pose pose={beakerPose}>
        <MeasuringBeaker
          size={BK}
          volume={vol}
          color={() => C_SOL}
          cloud={(p) => Math.max(ease(p, 6.47, 6.58) * (1 - 0.94 * ease(p, 7.02, 7.26)), 0.9 * ease(p, 8.36, 8.42) * (1 - out(p)))}
          bed={(p) => BED * ease(p, 7.02, 7.26) * (1 - ease(p, 8.36, 8.42))}
        />
        <Target name="beaker" size={[0.08, 0.1, 0.08]} center={[0, 0.05, 0]} hintY={0.13} />
      </Pose>

      {/* склянки с растворами */}
      <SolutionBottle pose={baBottle} formula="BaCl₂ 5 %" name={{ ru: 'хлорид бария', en: 'barium chloride', uz: 'bariy xlorid' }[lang]} level={(p) => mix(0.92, 0.3, e1(p))} target="bottle-bacl2" />
      <SolutionBottle pose={naBottle} formula="Na₂SO₄ 10 %" name={{ ru: 'сульфат натрия', en: 'sodium sulfate', uz: 'natriy sulfat' }[lang]} level={(p) => mix(0.86, 0.36, e2(p))} target="bottle-na2so4" />
      <PourStream x={PAN[0] + 0.003} z={PAN[2]} top={() => LIP_Y - 0.004} bottom={surface} show={(p) => hill(p, 4.46, 4.74, 0.15)} />
      <PourStream x={PAN[0] - 0.003} z={PAN[2]} top={() => LIP_Y - 0.004} bottom={surface} show={(p) => hill(p, 6.46, 6.74, 0.15)} />
      <PourStream x={LIP[0]} z={LIP[2]} top={() => LIP[1] - 0.004} bottom={() => FUN[1] + 0.03} show={(p) => hill(p, 8.45, 8.62, 0.15)} color="#f1f3f5" />

      {/* проба на избыток: пипетка, две пробирки в штативе, капельницы */}
      <Pose pose={sample}>
        <Pipette color={C_SOL} squeeze={(p) => sample(p).squeeze} />
        <Target name="pipette" size={[0.035, 0.12, 0.04]} center={[0, 0.05, 0]} hintY={0.05} ring={false} />
      </Pose>
      <group position={[RACK[0], 0, RACK[2]]}>
        <TubeRack xs={[-0.04, 0.04]} />
        {/* тёмный экран, прислонённый к штативу: на чёрном фоне белая муть видна сразу */}
        <mesh position={[0, 0.0645, -0.0362]} rotation={[0.12, 0, 0]} material={darkCard} castShadow receiveShadow>
          <boxGeometry args={[0.17, 0.13, 0.003]} />
        </mesh>
      </group>
      <group position={T1 as unknown as THREE.Vector3Tuple}>
        <TestTube level={(p) => SAMPLE_TUBE_H * ease(p, 7.51, 7.54)} liquidColor={C_SOL} liquidOpacity={0.3} cloud={(p) => ease(p, 7.745, 7.78)} />
      </group>
      <group position={T2 as unknown as THREE.Vector3Tuple}>
        <TestTube level={(p) => SAMPLE_TUBE_H * ease(p, 7.57, 7.6)} liquidColor={C_SOL} liquidOpacity={0.3} />
      </group>
      <Falling from={[T1[0], DRIP_Y - 0.002, T1[2]]} toY={() => TUBE_Y + SAMPLE_TUBE_H} a={7.732} b={7.758} n={2} color={C_SOL} size={0.0019} jitter={0.0005} />
      <Falling from={[T2[0], DRIP_Y - 0.002, T2[2]]} toY={() => TUBE_Y + SAMPLE_TUBE_H} a={7.852} b={7.878} n={2} color={C_SOL} size={0.0019} jitter={0.0005} />
      <group position={DB1 as unknown as THREE.Vector3Tuple}>
        <DropperBottle color={C_SOL} label="BaCl₂" />
      </group>
      <group position={DB2 as unknown as THREE.Vector3Tuple}>
        <DropperBottle color={C_SOL} label="Na₂SO₄" />
      </group>
      <Pose pose={(p) => ({ pos: drop1(p).pos })}>
        <Pipette color={C_SOL} squeeze={(p) => drop1(p).squeeze} />
      </Pose>
      <Pose pose={(p) => ({ pos: drop2(p).pos })}>
        <Pipette color={C_SOL} squeeze={(p) => drop2(p).squeeze} />
      </Pose>
      <Readout
        position={[RACK[0], 0.2, RACK[2] + 0.03]}
        label={{ ru: 'проба', en: 'test', uz: 'sinov' }}
        text={(p, lg) =>
          p >= 7.8 && p < 8.3
            ? { ru: 'BaCl₂ — муть · Na₂SO₄ — нет', en: 'BaCl₂ — cloudy · Na₂SO₄ — clear', uz: 'BaCl₂ — loyqa · Na₂SO₄ — tiniq' }[lg]
            : null
        }
      />

      {/* воронка с плотным фильтром, промывалка, сушильный шкаф */}
      <FilterStation f={plan} />
    </group>
  )
}
