/**
 * Kimyo 9, с. 200, лабораторная работа 12, задание 2: объём 20 %-ного NaOH на 4 г 20 %-ного CuSO₄.
 * Шаги: 0 очки и перчатки · 1 сухой фильтр на весы (m фильтра) · 2 стаканчик 50 мл на весы · 3 тара ·
 * 4 4,00 г раствора CuSO₄ из склянки · 5 капля фенолфталеина · 6 пипетка: набрать NaOH выше нуля, спустить до «0» ·
 * 7 по каплям до слабо-розовой жидкости над голубым осадком (отсчёт V по пипетке) · 8 фильтрование и промывание ·
 * 9 сушка на воздухе (без нагрева) · 10 тара на пустых весах и фильтр с осадком на весы.
 * Числа на приборах — из попытки (useLabTaskValues): к концу шага прибор показывает то, что записано в журнал.
 */
import * as THREE from 'three'
import { Pose, Target, ease, hill, mix, mixV, seg, useRig, useSoundAt, type PFn, type PoseValue, type V3 } from '../../../rigCore'
import { PourStream } from '../../../parts/effects'
import { DropperBottle, FUNNEL, Falling, GripHand, Pipette, PpeTray } from '../../../parts/practicalware'
import { useGearStep } from '../../useGearStep'
import { bottlePose, pipettePose } from '../../worksKit'
import { useLabTaskValues } from '../../../../measure/labTaskSession'
import { DigitalScales, Readout, SCALES } from '../../../../measure/devices/Scales'
import { BEAKERS, MeasuringBeaker, beakerLevel } from '../../../../measure/devices/Glass'
import { GRAD_PIPETTE, GradPipette, gradPipetteLevel } from '../../../../measure/devices/GradPipette'
import { fmtNum } from '../../../../measure/instruments'
import { solutionDensity } from '../../../../measure/quantities'
import { FUN, FilterStation, SolutionBottle, panAt, pourPose, readoutAfter, track, type FilterPlan } from './g9Kit'
import { BandTag, PIPETTE_STAND, PipetteStand, colorTrack } from './kitG9b'

const ID = 'task-g9-naoh-cuso4' as const
const PPE: V3 = [0.52, 0, 0.21]
const SC: V3 = [-0.12, 0, 0.06]
const PAN = panAt(SC)
const BK = BEAKERS[50]
const B0: V3 = [-0.3, 0, -0.04]
const CB: V3 = [-0.42, 0, 0.12]
const IND: V3 = [-0.27, 0, 0.19]
const N0: V3 = [-0.44, 0, -0.1]
const PS: V3 = [-0.5, 0, -0.2]
const RHO_CU = solutionDensity('CuSO4', 0.2)
const RHO_NA = 1.22
/** Объём раствора NaOH в стаканчике-запаснике (мл). */
const NAOH_ML = 15
/** Кончик пипетки над дном стаканчика на весах во время приливания. */
const TIP_IN: V3 = [PAN[0], PAN[1] + 0.04, PAN[2]]
const TIP_REST: V3 = [PS[0], PIPETTE_STAND.baseTop, PS[2]]
const Z0 = GRAD_PIPETTE.zero
const LIP: V3 = [FUN[0] - 0.016, FUN[1] + FUNNEL.coneH + 0.05, FUN[2]]

const C = {
  cu: '#3a8bdb',
  clear: '#e8f0f6',
  pink: '#f1cfe0',
  solid: '#5aa5e4',
  naoh: '#d9e8f3',
} as const

/** Доля налитого CuSO₄: струя быстрая, у 4 г — по чуть-чуть. */
const cuFrac: PFn = (p) => {
  const f = seg(p, 4.46, 4.78)
  return 1 - (1 - f) ** 2.4
}
/** Капля индикатора упала (пипетка-капельница: капли на s + 0.3…0.56). */
const indDrop: PFn = (p) => ease(p, 5.36, 5.5)
/** Приливание щёлочи по каплям: быстро в начале, у конца — по одной капле. */
const tFrac: PFn = (p) => {
  const f = seg(p, 7.1, 7.84)
  return 1 - (1 - f) ** 1.6
}

const FILTER: FilterPlan = {
  sc: SC,
  weigh: 1,
  clear: 2,
  filter: 8,
  dry: 9,
  weigh2: 10,
  how: 'air',
  solid: C.solid,
  liquid: '#8fc1ea',
  filtrate: '#f5e2ec',
  filtrateMl: 9,
}

/** Пипетка (начало — кончик): штатив → стаканчик с NaOH (набрать, до «0») → над стаканчиком на весах → обратно. */
function pipettePos(p: number): V3 {
  const up = (v: V3, y: number): V3 => [v[0], y, v[2]]
  const nTop: V3 = [N0[0], 0.09, N0[2]]
  const nDip: V3 = [N0[0], 0.007, N0[2]]
  const nOut: V3 = [N0[0], 0.032, N0[2]]
  let q = mixV(TIP_REST, up(TIP_REST, 0.26), ease(p, 6, 6.08))
  q = mixV(q, nTop, ease(p, 6.07, 6.2))
  q = mixV(q, nDip, ease(p, 6.26, 6.34))
  q = mixV(q, nOut, ease(p, 6.52, 6.58))
  q = mixV(q, up(nOut, 0.16), ease(p, 6.72, 6.8))
  q = mixV(q, up(TIP_IN, 0.16), ease(p, 6.79, 6.9))
  q = mixV(q, TIP_IN, ease(p, 6.89, 6.97))
  q = mixV(q, up(TIP_IN, 0.33), ease(p, 8, 8.04))
  q = mixV(q, up(TIP_REST, 0.26), ease(p, 8.035, 8.14))
  q = mixV(q, TIP_REST, ease(p, 8.13, 8.22))
  return q
}

export function NaohCuso4Rig() {
  const v = useLabTaskValues(ID)
  const { lang } = useRig()
  useGearStep(ID, 0)
  useSoundAt(0.2, 'click', PPE, 0.5)
  useSoundAt(2.88, 'glass-place', PAN, 0.4)
  useSoundAt(3.3, 'click', [SC[0] + SCALES.tareBtn[0], 0.02, SC[2] + 0.1], 0.5)
  useSoundAt(4.46, 'pour', PAN, 0.4)
  useSoundAt(6.38, 'bubble', N0, 0.25)
  useSoundAt(7.12, 'splash', PAN, 0.12)
  useSoundAt(7.92, 'success', PAN, 0.35)
  useSoundAt(8.2, 'glass-place', TIP_REST, 0.25)
  useSoundAt(8.97, 'glass-place', B0, 0.3)
  useSoundAt(10.03, 'click', [SC[0] + SCALES.tareBtn[0], 0.02, SC[2] + 0.1], 0.5)
  useSoundAt(10.97, 'success', PAN, 0.35)

  const mF = v.mF ?? 0.94
  const mS = v.mS ?? 4
  const V = v.V ?? 1.66
  const m2 = v.m2 ?? 1.42
  const mB = v.mB ?? 31.46
  const cuMl = mS / RHO_CU

  const reading = (p: number) => {
    const filter1 = p >= 1.66 && p < 2.03 ? mF : 0
    const onPan = p >= 2.86 && p < 8.06
    const load = onPan ? mB + mS * cuFrac(p) + 0.04 * indDrop(p) + RHO_NA * V * tFrac(p) : 0
    const filter2 = p >= 10.53 ? m2 : 0
    const tare = p >= 3.45 && p < 10.04 ? mB : 0
    return filter1 + load + filter2 - tare
  }

  const beakerVol: PFn = (p) => (cuMl * cuFrac(p) + 0.04 * indDrop(p) + V * tFrac(p)) * (1 - 0.96 * ease(p, 8.44, 8.62))
  const settle: PFn = (p) => ease(p, 7.84, 7.99)
  const cloud: PFn = (p) => (0.92 * ease(p, 7.1, 7.5) * (1 - 0.55 * settle(p)) + 0.45 * hill(p, 8.3, 8.6, 0.3)) * (1 - ease(p, 8.56, 8.66))
  const bed: PFn = (p) => 0.0016 * ease(p, 7.6, 7.99) * (1 - ease(p, 8.46, 8.62))
  const beakerColor = colorTrack([
    [7.1, C.cu],
    [7.78, C.clear],
    [7.9, C.pink],
  ])
  const placed = track(B0, [[2.3, 2.9, PAN, 0.12]])
  const pour = pourPose(PAN, BK.h, BK.ri + 0.0035, -1, [[8, LIP, 1.95, B0]])
  const beakerPose = (p: number): PoseValue => (p < 8 ? { pos: placed(p) } : pour(p))

  const cuso4 = bottlePose(CB, [[4, PAN[0], PAN[2], PAN[1] + BK.h + 0.02]])
  const dropper = pipettePose(IND, [[5, PAN[0], PAN[2], PAN[1] + BK.h + 0.012]])

  const pipLevel: PFn = (p) => {
    if (p < 6.36) return 0
    if (p < 6.6) return (Z0 + 0.012) * ease(p, 6.38, 6.5)
    if (p < 7.1) return mix(Z0 + 0.012, Z0, ease(p, 6.6, 6.7))
    return mix(Z0, gradPipetteLevel(V), tFrac(p))
  }
  const squeeze: PFn = (p) => ease(p, 6.2, 6.27) * (1 - ease(p, 6.38, 6.5)) + 0.35 * hill(p, 7.08, 7.86, 0.08)
  const hold: PFn = (p) => ease(p, 6, 6.03) * (1 - ease(p, 8.2, 8.23))
  const surfY: PFn = (p) => PAN[1] + beakerLevel(BK, beakerVol(p))

  return (
    <group>
      <group position={PPE as unknown as THREE.Vector3Tuple}>
        <PpeTray worn={(p) => ease(p, 0, 0.95)} gloves />
        <Target name="ppe" size={[0.16, 0.05, 0.1]} center={[0, 0.02, 0]} hintY={0.08} />
      </group>

      {/* весы и кнопка тары */}
      <group position={SC as unknown as THREE.Vector3Tuple}>
        <DigitalScales reading={reading} readout={readoutAfter(1, 4, 10)} />
        <group position={SCALES.tareBtn as unknown as THREE.Vector3Tuple}>
          <Target name="tare" size={[0.03, 0.03, 0.03]} center={[0, 0, 0.004]} hintY={0.05} ring={false} />
        </group>
      </group>

      {/* стаканчик 50 мл: раствор CuSO₄ → голубой осадок → на фильтр */}
      <Pose pose={beakerPose}>
        <MeasuringBeaker size={BK} volume={beakerVol} color={beakerColor} cloud={cloud} bed={bed} solidColor={C.solid} />
        <Target name="beaker" size={[0.06, 0.07, 0.06]} center={[0, 0.03, 0]} hintY={0.1} />
      </Pose>
      <PourStream x={LIP[0]} z={LIP[2]} top={() => LIP[1] - 0.003} bottom={() => FUN[1] + 0.03} show={(p) => hill(p, 8.46, 8.66, 0.2)} color="#9ccaf0" />

      {/* склянка с 20 %-ным CuSO₄ */}
      <SolutionBottle pose={cuso4} formula="CuSO₄" name={{ ru: '20 % раствор', en: '20 % solution', uz: '20 % li eritma' }[lang]} level={(p) => mix(0.72, 0.66, ease(p, 4.46, 4.78))} target="bottle-cuso4" />
      <PourStream x={PAN[0] + 0.003} z={PAN[2]} top={() => PAN[1] + BK.h + 0.016} bottom={surfY} show={(p) => hill(p, 4.46, 4.78, 0.15) * (1 - 0.55 * seg(p, 4.6, 4.78))} color="#7ab8ec" />

      {/* фенолфталеин: склянка-капельница */}
      <group position={IND as unknown as THREE.Vector3Tuple}>
        <DropperBottle color="#f6f6f2" label={{ ru: 'ф/ф', en: 'phph', uz: 'f/f' }[lang]} />
        <Target name="indicator" size={[0.05, 0.11, 0.05]} center={[0, 0.05, 0]} hintY={0.14} />
      </group>
      <Pose pose={(p) => ({ pos: dropper(p).pos })}>
        <Pipette color="#f6f6f2" squeeze={(p) => dropper(p).squeeze} />
      </Pose>
      <Falling from={[PAN[0], PAN[1] + BK.h + 0.01, PAN[2]]} toY={surfY} a={5.32} b={5.5} n={1} color="#f6f6f2" size={0.002} />

      {/* стаканчик-запасник с 20 %-ным NaOH */}
      <group position={N0 as unknown as THREE.Vector3Tuple}>
        <MeasuringBeaker size={BK} volume={(p) => NAOH_ML - 2.3 * ease(p, 6.38, 6.5) + 0.1 * ease(p, 6.6, 6.7)} color={() => C.naoh} />
        <BandTag r={BK.ri + 0.0017} y={0.04} formula="NaOH 20%" name={{ ru: 'ρ = 1,22 г/мл', en: 'ρ = 1.22 g/ml', uz: 'ρ = 1,22 g/ml' }[lang]} h={0.02} stripe="#c0392b" />
      </group>
      <Falling from={[N0[0], 0.032, N0[2]]} toY={() => 0.003 + (NAOH_ML / 1e6) / (Math.PI * BK.ri * BK.ri)} a={6.62} b={6.7} n={1} color={C.naoh} size={0.0018} />

      {/* градуированная пипетка 2 мл: штатив → набор → приливание по каплям */}
      <group position={PS as unknown as THREE.Vector3Tuple}>
        <PipetteStand />
      </group>
      <Pose pose={(p) => ({ pos: pipettePos(p) })}>
        <GradPipette level={pipLevel} color={C.naoh} squeeze={squeeze} />
        {/* пипетку держат за грушу: пальцы сжимают её, шкала остаётся на виду */}
        <group position={[0, GRAD_PIPETTE.top + 0.002 + GRAD_PIPETTE.bulbLen / 2 + GRAD_PIPETTE.bulbR * 0.4, 0]}>
          <GripHand r={GRAD_PIPETTE.bulbR} hold={hold} />
        </group>
        <Target name="pipette" size={[0.03, 0.22, 0.03]} center={[0, 0.17, 0]} hintY={0.37} ring={false} />
      </Pose>
      <Falling from={TIP_IN} toY={surfY} a={7.1} b={7.84} n={14} color={C.naoh} size={0.0018} />
      <Readout
        position={[TIP_IN[0] + 0.05, TIP_IN[1] + Z0, TIP_IN[2]]}
        label={{ ru: 'пипетка', en: 'pipette', uz: 'pipetka' }}
        text={(p, lg) => (p >= 6.92 && p < 7.08 ? `0${lg === 'en' ? '.' : ','}00 ${{ ru: 'мл', en: 'ml', uz: 'ml' }[lg]}` : null)}
      />
      <Readout
        position={[TIP_IN[0] + 0.05, TIP_IN[1] + gradPipetteLevel(V), TIP_IN[2]]}
        label={{ ru: 'пипетка', en: 'pipette', uz: 'pipetka' }}
        text={(p, lg) => (p >= 7.86 && p < 8.02 ? `${fmtNum(V, 2, lg)} ${{ ru: 'мл', en: 'ml', uz: 'ml' }[lg]}` : null)}
      />

      {/* фильтр, воронка, промывалка, сушка на воздухе */}
      <FilterStation f={FILTER} />
    </group>
  )
}
