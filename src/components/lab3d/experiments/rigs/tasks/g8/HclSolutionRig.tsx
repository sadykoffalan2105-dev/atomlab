/**
 * task-g8-hcl-solution (Kimyo 8, с. 102, задание 2), вытяжной шкаф, демонстрация учителя: 560 мл HCl (н.у.) в 10,0 мл воды.
 * Шаги: 0 защита · 1 стаканчик на весы, T · 2 10,0 мл воды из цилиндра (весы ≈ 9,98 г) · 3 лапку с опрокинутой воронкой
 * вниз до воды, T · 4 кран газометра: масло поднимается до ≈ 600 мл, весы растут · 5 кран закрыть, V и t ·
 * 6 весы — m(HCl) · 7 капля на синий лакмус — красный. Все числа — из показаний попытки (useLabTaskValues).
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { LAB_COLORS } from '../../../../labContract'
import { GlassRod, PpeTray, Puffs } from '../../../parts/practicalware'
import { PourStream } from '../../../parts/effects'
import { Pose, Target, ease, hill, mix, useSoundAt, type PFn, type V3 } from '../../../rigCore'
import { RubberHose } from '../../worksKit'
import { useGearStep } from '../../useGearStep'
import { useLabTaskValues } from '../../../../measure/labTaskSession'
import { fmtNum } from '../../../../measure/instruments'
import { DigitalScales, Readout } from '../../../../measure/devices/Scales'
import { BEAKERS, MeasuringBeaker, MeasuringCylinder, THERMO, Thermometer, beakerLevel, cylinderTop } from '../../../../measure/devices/Glass'
import { GASOMETER, Gasometer, gasometerLevelY } from '../../../../measure/devices/Gasometer'
import { HC } from '../../../../../../data/labTasks/g8/hclSolution'
import { moveVia, pourPose } from './g8Kit'
import { FUNNEL_ABSORB, LitmusTile, SmallFunnel, useHoodSashAt } from './kitG8b'

const ID = 'task-g8-hcl-solution' as const
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const PAN = HC.pan
const BEAKER_MASS = 28.36
const WATER = '#d6e8fb'
const F = FUNNEL_ABSORB
/** Высота воронки (край → конец трубки сверху). */
const F_H = F.stem + F.coneH
const RIM_UP = HC.rimUp
const DROP = RIM_UP - HC.rimDown
const ARM_Z = PAN[2]
/** Подъём лапки: вверху до шага 3, внизу (край у воды) — шаги 3–6, после газа учитель поднимает воронку. */
const lowered: PFn = (p) => ease(p, 3.08, 3.7) * (1 - ease(p, 7.02, 7.2))
const GAS_A = 4.12
const GAS_B = 4.95

export function HclSolutionRig() {
  const v = useLabTaskValues(ID)
  const { vW, mW, V, t, dm } = { vW: v.vW!, mW: v.mW!, V: v.V!, t: v.t!, dm: v.dm! }

  useGearStep(ID, 0)
  useHoodSashAt(0.24)
  useSoundAt(0.2, 'click', HC.ppe, 0.5)
  useSoundAt(1.6, 'glass-place', PAN, 0.4)
  useSoundAt(1.76, 'click', add(HC.scales, [0.058, 0.02, 0.1]), 0.5)
  useSoundAt(2.46, 'pour', PAN, 0.4)
  useSoundAt(3.82, 'click', add(HC.scales, [0.058, 0.02, 0.1]), 0.5)
  useSoundAt(4.06, 'click', add(HC.gaso, GASOMETER.tap), 0.5)
  useSoundAt(4.2, 'bubble', PAN, 0.25)
  useSoundAt(5.08, 'click', add(HC.gaso, GASOMETER.tap), 0.5)
  useSoundAt(6.1, 'click', add(HC.scales, [0, 0.02, 0.1]), 0.4)
  useSoundAt(7.46, 'glass-clink', PAN, 0.3)

  /* ── газ: масло в газометре поднимается (учитель замедляет поток к концу), вода поглощает с небольшой задержкой ── */
  const passed: PFn = (p) => V * (1 - Math.pow(1 - Math.max(0, Math.min(1, (p - GAS_A) / (GAS_B - GAS_A))), 1.6))
  const tap: PFn = (p) => ease(p, 4.04, 4.1) * (1 - ease(p, 5.04, 5.12))
  const absorbedShare: PFn = (p) => (passed(p) / V) * mix(0.96, 1, ease(p, 4.9, 6.6))

  /* ── весы ── */
  const reading = (p: number): number | null => {
    if (p < 1.5) return 0
    if (p < 1.74) return BEAKER_MASS * ease(p, 1.5, 1.6)
    if (p < 3.0) return mW * ease(p, 2.46, 2.74)
    if (p < 3.8) return mW + 0.02 * ease(p, 3.6, 3.7)
    if (p < GAS_A) return 0
    return dm * absorbedShare(p)
  }

  /* ── позы ── */
  const beakerPose = (p: number) => {
    const hi = 0.09
    const pos = moveVia(p, HC.beaker0, [
      [1, 1.12, [HC.beaker0[0], hi, HC.beaker0[2]]],
      [1.12, 1.42, [PAN[0], hi, PAN[2] + 0.06]],
      [1.42, 1.5, [PAN[0], PAN[1] + 0.004, PAN[2] + 0.06]],
      [1.5, 1.6, PAN],
    ])
    return { pos }
  }
  const lip: V3 = [PAN[0] - 0.017, PAN[1] + BEAKERS[50].h + 0.008, PAN[2]]
  const cyl = pourPose(HC.cylinder, 2, lip, cylinderTop(10), 1.9, 0.009)
  const cylVol: PFn = (p) => vW * (1 - ease(p, 2.46, 2.74))
  const beakerVol: PFn = (p) => vW * ease(p, 2.46, 2.74) + 0.55 * absorbedShare(p)

  const stemTop = (p: number): V3 => [PAN[0], RIM_UP - DROP * lowered(p) + F_H, PAN[2]]
  const clampPose = (p: number) => ({ pos: [0, -DROP * lowered(p), 0] as V3 })

  const rodPose = (p: number) => {
    const rest: V3 = [HC.glassRod[0], 0.0028, HC.glassRod[2]]
    const over: V3 = [PAN[0], 0.2, PAN[2] + 0.012]
    const dip: V3 = [PAN[0], PAN[1] + 0.006, PAN[2] + 0.012]
    const tileAt: V3 = [HC.tile[0] + 0.004, 0.0075, HC.tile[2]]
    const pos = moveVia(p, rest, [
      [7.18, 7.26, [rest[0], 0.08, rest[2]]],
      [7.26, 7.36, over],
      [7.36, 7.44, dip],
      [7.5, 7.58, over],
      [7.58, 7.7, [tileAt[0], 0.2, tileAt[2]]],
      [7.7, 7.76, tileAt],
      [7.82, 7.88, [tileAt[0], 0.08, tileAt[2]]],
      [7.88, 7.97, rest],
    ])
    const up = ease(p, 7.18, 7.26) * (1 - ease(p, 7.88, 7.96))
    // лёжа палочка — вдоль X на столе; в руке — вертикально, низом вниз
    return { pos, rot: [0, 0, (1 - up) * (-Math.PI / 2)] as V3 }
  }

  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: LAB_COLORS.metal, roughness: 0.28, metalness: 0.85 }), [])
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4f5b68', roughness: 0.55, metalness: 0.2 }), [])
  const rubber = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a3f46', roughness: 0.9 }), [])
  // лапка держит трубку воронки выше края стаканчика (и когда воронка опущена к воде)
  const clampY0 = RIM_UP + F.coneH + F.stem * 0.75
  const armLen = ARM_Z - HC.rod[1]
  const TH: V3 = [HC.thermo[0], HC.thermo[1], HC.thermo[2]]

  return (
    <group>
      <group position={HC.ppe as unknown as THREE.Vector3Tuple}>
        <PpeTray worn={(p) => ease(p, 0, 0.95)} coat />
        <Target name="ppe" size={[0.16, 0.05, 0.1]} center={[0, 0.02, 0]} hintY={0.08} />
      </group>

      {/* Весы */}
      <group position={HC.scales as unknown as THREE.Vector3Tuple}>
        <DigitalScales reading={reading} readout={(p) => (p > 1.4 && p < 7.2 ? 1 : 0)} />
        <Target name="scales" size={[0.17, 0.05, 0.08]} center={[0, 0.02, 0.07]} hintY={0.09} ring={false} />
      </group>

      {/* Стаканчик 50 мл: стол → чаша весов */}
      <Pose pose={beakerPose}>
        <MeasuringBeaker size={BEAKERS[50]} volume={beakerVol} color={() => WATER} />
        <Target name="beaker" size={[0.05, 0.06, 0.05]} center={[0, 0.03, 0]} hintY={0.09} />
      </Pose>
      <Puffs origin={[PAN[0], PAN[1] + BEAKERS[50].h + 0.004, PAN[2]]} count={12} opacity={0.18} size={0.008} rate={(p) => 0.45 * hill(p, 4.25, 5.6, 0.15)} />

      {/* Мерный цилиндр 10 мл с водой */}
      <Pose pose={cyl}>
        <MeasuringCylinder capacity={10} volume={cylVol} color={WATER} />
        <Target name="cylinder" size={[0.04, 0.12, 0.04]} center={[0, 0.06, 0]} hintY={0.14} />
      </Pose>
      <PourStream x={lip[0] + 0.003} z={lip[2]} top={() => lip[1]} bottom={(p) => PAN[1] + beakerLevel(BEAKERS[50], beakerVol(p))} show={(p) => hill(p, 2.46, 2.74, 0.15)} color={WATER} />
      <Readout
        position={[HC.cylinder[0] + 0.045, 0.1, HC.cylinder[2]]}
        label={{ ru: 'цилиндр', en: 'cylinder', uz: 'silindr' }}
        text={(p, l) => (p > 1.8 && p < 2.42 ? `${fmtNum(vW, 1, l)} ${l === 'ru' ? 'мл' : 'ml'}` : null)}
      />

      {/* Штатив: плита и стержень за весами; лапка с опрокинутой воронкой ездит по стержню */}
      <mesh position={[HC.rod[0], 0.007, HC.rod[1] - 0.05]} material={paint} castShadow receiveShadow>
        <boxGeometry args={[0.13, 0.014, 0.16]} />
      </mesh>
      <mesh position={[HC.rod[0], 0.014 + 0.2, HC.rod[1]]} material={steel} castShadow>
        <cylinderGeometry args={[0.0055, 0.0055, 0.4, 14]} />
      </mesh>
      <Pose pose={clampPose}>
        <mesh position={[HC.rod[0], clampY0, HC.rod[1]]} material={paint} castShadow>
          <boxGeometry args={[0.022, 0.026, 0.022]} />
        </mesh>
        <mesh position={[HC.rod[0], clampY0, HC.rod[1] + (armLen - 0.012) / 2]} rotation={[Math.PI / 2, 0, 0]} material={steel} castShadow>
          <cylinderGeometry args={[0.0032, 0.0032, armLen - 0.012, 10]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[PAN[0] + s * (F.stemR + 0.0035), clampY0, ARM_Z]}>
            <mesh material={paint}>
              <boxGeometry args={[0.004, 0.014, 0.022]} />
            </mesh>
            <mesh position={[-s * 0.0025, 0, 0]} material={rubber}>
              <boxGeometry args={[0.0012, 0.012, 0.012]} />
            </mesh>
          </group>
        ))}
        <mesh position={[PAN[0], clampY0, ARM_Z - 0.011]} material={paint}>
          <boxGeometry args={[2 * (F.stemR + 0.0045), 0.014, 0.004]} />
        </mesh>
        {/* воронка вверх дном: край снизу, трубка вверх */}
        <group position={[PAN[0], RIM_UP + F_H, PAN[2]]} rotation={[Math.PI, 0, 0]}>
          <SmallFunnel size={F} />
        </group>
        <group position={[PAN[0], clampY0 + 0.02, PAN[2] - 0.03]}>
          <Target name="clamp" size={[0.06, 0.06, 0.08]} center={[0, 0, 0]} hintY={0.06} ring={false} />
        </group>
      </Pose>
      <RubberHose
        ends={(p) => [stemTop(p), add(HC.gaso, GASOMETER.outlet)]}
        dirs={() => [
          [0, 1, 0],
          [-1, 0, 0],
        ]}
        sag={0.04}
      />

      {/* Газометр с напорной склянкой */}
      <group position={HC.gaso as unknown as THREE.Vector3Tuple}>
        <Gasometer passed={passed} tap={tap} />
        <group position={GASOMETER.tap as unknown as THREE.Vector3Tuple}>
          <Target name="gas-tap" size={[0.05, 0.04, 0.05]} center={[0, 0, 0.01]} hintY={0.05} ring={false} />
        </group>
      </group>
      <Readout
        position={[HC.gaso[0] - 0.075, gasometerLevelY(V) + 0.03, HC.gaso[2] + 0.05]}
        label={{ ru: 'газометр', en: 'gas holder', uz: 'gazometr' }}
        text={(p, l) => (p > 5.3 ? `${fmtNum(V, 0, l)} ${l === 'ru' ? 'мл' : 'ml'}` : null)}
      />

      {/* Термометр на стойке у газометра: температура газа */}
      <mesh position={[TH[0], 0.006, TH[2] - 0.012]} material={paint} castShadow receiveShadow>
        <cylinderGeometry args={[0.028, 0.03, 0.012, 24]} />
      </mesh>
      <mesh position={[TH[0], 0.012 + 0.14, TH[2] - 0.012]} material={steel} castShadow>
        <cylinderGeometry args={[0.003, 0.003, 0.28, 10]} />
      </mesh>
      {[0.12, 0.22].map((y) => (
        <mesh key={y} position={[TH[0], y, TH[2] - 0.006]} material={rubber}>
          <boxGeometry args={[0.012, 0.008, 0.012]} />
        </mesh>
      ))}
      <group position={TH as unknown as THREE.Vector3Tuple}>
        <Thermometer temp={() => t} />
      </group>
      <Readout
        position={[TH[0] - 0.045, TH[1] + 0.06 + ((t + 10) / 120) * THERMO.span, TH[2]]}
        label={{ ru: 'термометр', en: 'thermometer', uz: 'termometr' }}
        text={(p, l) => (p > 5.3 ? `${fmtNum(t, 1, l)} °C` : null)}
      />

      {/* Стеклянная палочка и лакмус на фарфоровой плитке */}
      <Pose pose={rodPose}>
        <GlassRod length={0.18} wetColor={WATER} />
        <Target name="glass-rod" size={[0.03, 0.16, 0.03]} center={[0, 0.08, 0]} hintY={0.05} />
      </Pose>
      <group position={HC.tile as unknown as THREE.Vector3Tuple}>
        <LitmusTile red={(p) => ease(p, 7.74, 7.86)} />
      </group>
    </group>
  )
}
