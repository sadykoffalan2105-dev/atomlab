/**
 * Kimyo 9, с. 68, задача 2: 10 %-ный раствор Na₂CO₃ из 54 г кристаллической соды.
 * Шаги: 0 очки · 1 стакан на весы · 2 тара · 3 54,00 г соды шпателем · 4 146 мл воды в цилиндр · 5 вода в стакан ·
 * 6 стакан под термометр (t₁) · 7 перемешивание — кристаллы растворяются, раствор остывает (t₂) · 8 стакан на весы (m р-ра).
 * Все числа на приборах — из попытки (useLabTaskValues): к концу шага прибор показывает то, что записано в журнал.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Pose, Target, ease, hill, mix, mixV, useRig, useSoundAt, type PFn, type V3 } from '../../../rigCore'
import { PourStream } from '../../../parts/effects'
import { GlassRod, Falling, PpeTray } from '../../../parts/practicalware'
import { useGearStep } from '../../useGearStep'
import { Spatula, bottlePose } from '../../worksKit'
import { useLabTaskValues } from '../../../../measure/labTaskSession'
import { DigitalScales, Readout, SCALES } from '../../../../measure/devices/Scales'
import { BEAKERS, CYL_BOTTOM, MeasuringBeaker, MeasuringCylinder, Thermometer, cylinderTop } from '../../../../measure/devices/Glass'
import { PowderJar } from '../../../../measure/devices/Bench'
import { cylinderGeom, quantize } from '../../../../measure/quantities'
import { fmtNum } from '../../../../measure/instruments'
import { SolutionBottle, panAt, pourPose, readoutAfter, track } from './g9Kit'

const ID = 'task-g9-soda-solution' as const
const PPE: V3 = [0.52, 0, 0.21]
const SC: V3 = [-0.12, 0, 0.05]
const PAN = panAt(SC)
const B0: V3 = [-0.36, 0, -0.02]
const BK = BEAKERS[250]
const TX = B0[0] - 0.012
const ROD_X = -0.5
const JAR: V3 = [-0.3, 0, 0.19]
const SPAT_REST: V3 = [JAR[0] - 0.06, 0.003, JAR[2] + 0.05]
const STIR_REST: V3 = [-0.25, 0.003, -0.17]
const CY: V3 = [0.14, 0, -0.06]
const WB: V3 = [0.32, 0, 0.1]
const CYL = cylinderGeom(250)
const CYL_TOP = cylinderTop(250)
/** Масса пустого стакана на 250 мл (г) — до тары. */
const MB = 101.86
const ROOM = 22
/** Доля соды в стакане после каждого из 5 переносов шпателем (последние — по чуть-чуть). */
const CUM = [0.26, 0.52, 0.74, 0.92, 1]
const TRIP = 0.168
const T0 = 3.04
/** Объём 54 г кристаллов (ρ ≈ 1,46 г/см³) — они вытесняют воду, пока не растворились. */
const CRYSTAL_ML = 37

const tipAt = (i: number) => T0 + i * TRIP + TRIP * 0.62
const sodaFrac: PFn = (p) => {
  let f = 0
  for (let i = 0; i < CUM.length; i++) f = mix(f, CUM[i]!, ease(p, tipAt(i), tipAt(i) + 0.03))
  return f
}
/** Растворилось: немного — пока вода стоит, всё — при перемешивании. */
const dissolved: PFn = (p) => 0.15 * ease(p, 5.6, 6.9) + 0.85 * ease(p, 7.05, 7.6)
const thermoDown: PFn = (p) => ease(p, 6.42, 6.56) * (1 - ease(p, 8, 8.12))

function spatulaPose(p: number) {
  const inJar: V3 = [JAR[0] - 0.006, 0.045, JAR[2]]
  const over: V3 = [PAN[0] - 0.008, PAN[1] + 0.13, PAN[2]]
  if (p <= 3 || p >= 4) return { pos: SPAT_REST, rot: [0, 0, 0] as V3, full: 0 }
  if (p < T0) {
    const k = ease(p, 3, T0)
    return { pos: mixV(mixV(SPAT_REST, [SPAT_REST[0], 0.12, SPAT_REST[2]], ease(p, 3, 3.02)), inJar, ease(p, 3.015, T0)), rot: [0, 0, 1.1 * k] as V3, full: 0 }
  }
  const end = T0 + CUM.length * TRIP
  if (p >= end) {
    const k = ease(p, end, 3.98)
    return { pos: mixV(mixV(over, [over[0], 0.2, over[2]], ease(p, end, end + 0.03)), SPAT_REST, ease(p, end + 0.02, 3.98)), rot: [0, 0, mix(0.35, 0, k)] as V3, full: 0 }
  }
  const i = Math.floor((p - T0) / TRIP)
  const f = (p - T0) / TRIP - i
  // 0–0.2 зачерпнуть в банке, 0.2–0.55 к стакану (горкой над краем), 0.55–0.75 высыпать, 0.75–1 обратно
  const go = ease(f, 0.2, 0.55) * (1 - ease(f, 0.78, 1))
  const pos = mixV(inJar, over, go)
  const hump = 0.06 * Math.sin(Math.PI * Math.min(1, Math.max(0, f < 0.6 ? (f - 0.2) / 0.35 : (f - 0.78) / 0.22)))
  const roll = -1.3 * hill(f, 0.56, 0.76, 0.3)
  return { pos: [pos[0], pos[1] + hump, pos[2]] as V3, rot: [roll, 0, mix(1.1, 0.35, go)] as V3, full: f > 0.18 && f < 0.62 ? 1 : 0 }
}

function stirPose(p: number) {
  const lifted: V3 = [STIR_REST[0], 0.3, STIR_REST[2]]
  const inBeaker: V3 = [B0[0] + 0.012, 0.006, B0[2]]
  let pos = mixV(STIR_REST, lifted, ease(p, 7, 7.1))
  pos = mixV(pos, [inBeaker[0], 0.3, inBeaker[2]], ease(p, 7.08, 7.2))
  pos = mixV(pos, inBeaker, ease(p, 7.18, 7.28))
  const stir = ease(p, 7.26, 7.32) * (1 - ease(p, 7.82, 7.88))
  const a = (p - 7.2) * Math.PI * 2 * 7
  pos = [pos[0] + Math.cos(a) * 0.006 * stir, pos[1], pos[2] + Math.sin(a) * 0.006 * stir]
  pos = mixV(pos, [inBeaker[0], 0.3, inBeaker[2]], ease(p, 7.86, 7.93))
  pos = mixV(pos, lifted, ease(p, 7.92, 7.97))
  pos = mixV(pos, STIR_REST, ease(p, 7.96, 8))
  const upright = ease(p, 7, 7.18) * (1 - ease(p, 7.92, 8))
  return { pos, rot: [0, 0, mix(-Math.PI / 2, -0.1 * stir, upright)] as V3 }
}

const tmp = new THREE.Object3D()
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Бесцветные кристаллы соды горкой на дне стакана: появляются с каждой порцией, тают при растворении. */
function CrystalHeap() {
  const { quality, p } = useRig()
  const n = quality === 'high' ? 46 : 20
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#dde8ec', roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.88 }), [])
  const seeds = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const r = Math.sqrt(rnd(i, 1)) * 0.024
        const a = rnd(i, 2) * Math.PI * 2
        return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0.0045 + (1 - r / 0.024) * 0.007 * rnd(i, 3), s: 0.0028 + rnd(i, 4) * 0.0022, rot: rnd(i, 5) * 6, order: rnd(i, 6) }
      }),
    [n],
  )
  const ref = useRef<THREE.InstancedMesh>(null)
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const pv = p.current ?? 0
    const f = sodaFrac(pv)
    const left = 1 - dissolved(pv)
    m.visible = f > 0.01 && left > 0.02
    if (!m.visible) return
    seeds.forEach((sd, i) => {
      tmp.position.set(sd.x, sd.y * Math.sqrt(f), sd.z)
      tmp.rotation.set(sd.rot, sd.rot * 1.4, sd.rot * 0.6)
      tmp.scale.set(sd.s * left, sd.s * 0.8 * left, sd.s * 1.2 * left)
      if (sd.order > f) tmp.scale.setScalar(1e-5)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} material={mat} renderOrder={1} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  )
}

/** Штатив с термометром: лапка с муфтой ездит по стержню (термометр поднимают и опускают в стакан). */
function ThermoStand({ temp }: { temp: PFn }) {
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4f5b68', roughness: 0.55, metalness: 0.2 }), [])
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b9c2cc', roughness: 0.28, metalness: 0.85 }), [])
  const armLen = TX - ROD_X
  return (
    <group>
      <mesh position={[ROD_X + 0.03, 0.007, B0[2]]} material={paint} castShadow receiveShadow>
        <boxGeometry args={[0.14, 0.014, 0.1]} />
      </mesh>
      <mesh position={[ROD_X, 0.014 + 0.25, B0[2]]} material={steel} castShadow>
        <cylinderGeometry args={[0.0055, 0.0055, 0.5, 14]} />
      </mesh>
      <Pose pose={(p) => ({ pos: [0, mix(0.21, 0.012, thermoDown(p)), 0] })}>
        {/* муфта на стержне, лапка и кольцо-зажим вокруг термометра */}
        <mesh position={[ROD_X, 0.215, B0[2]]} material={paint} castShadow>
          <boxGeometry args={[0.022, 0.026, 0.022]} />
        </mesh>
        <mesh position={[ROD_X + (armLen - 0.006) / 2, 0.215, B0[2]]} rotation={[0, 0, Math.PI / 2]} material={steel}>
          <cylinderGeometry args={[0.0028, 0.0028, armLen - 0.006, 8]} />
        </mesh>
        <mesh position={[TX, 0.215, B0[2]]} rotation={[Math.PI / 2, 0, 0]} material={paint}>
          <torusGeometry args={[0.0058, 0.0022, 6, 18]} />
        </mesh>
        <group position={[TX, 0, B0[2]]}>
          <Thermometer temp={temp} />
        </group>
      </Pose>
    </group>
  )
}

export function SodaSolutionRig() {
  const v = useLabTaskValues(ID)
  const { lang } = useRig()
  useGearStep(ID, 0)
  useSoundAt(0.2, 'click', PPE, 0.5)
  useSoundAt(1.64, 'glass-place', PAN, 0.4)
  useSoundAt(2.3, 'click', [SC[0] + SCALES.tareBtn[0], 0.02, SC[2] + 0.1], 0.5)
  useSoundAt(4.46, 'pour', [CY[0], CYL_TOP, CY[2]], 0.5)
  useSoundAt(5.48, 'pour', PAN, 0.5)
  useSoundAt(6.4, 'glass-place', B0, 0.4)
  useSoundAt(7.3, 'glass-clink', [B0[0], 0.04, B0[2]], 0.35)
  useSoundAt(8.7, 'glass-place', PAN, 0.4)
  useSoundAt(8.97, 'success', PAN, 0.4)

  const mSoda = v.mSoda ?? 54
  const mSol = v.mSol ?? 200
  const V = v.V ?? 146
  const t1 = v.t1 ?? 20
  const t2 = v.t2 ?? 11
  const waterIn: PFn = (p) => ((mSol - mSoda) / 0.998) * ease(p, 5.48, 5.78)
  const cylVol: PFn = (p) => V * ease(p, 4.46, 4.76) * (1 - ease(p, 5.48, 5.78))

  const reading = (p: number) => {
    const onPan = (p >= 1.66 && p < 6.08) || p >= 8.72
    const tare = p >= 2.45 ? MB : 0
    const load = onPan ? MB + mSoda * sodaFrac(p) + (mSol - mSoda) * ease(p, 5.48, 5.78) : 0
    return load - tare
  }
  const temp: PFn = (p) => {
    if (p < 6.42) return ROOM
    if (p < 7.05) return mix(ROOM, t1, ease(p, 6.42, 6.56))
    if (p < 8.0) return mix(t1, t2, ease(p, 7.05, 7.55))
    return mix(t2, ROOM, 0.25 * ease(p, 8.1, 9.5))
  }
  const beakerPos = track(B0, [
    [1, 1.62, PAN, 0.1],
    [6.02, 6.4, B0, 0.1],
    [8.12, 8.7, PAN, 0.1],
  ])
  const water = bottlePose(WB, [[4, CY[0], CY[2], CYL_TOP + 0.02]])
  const cylPose = pourPose(CY, CYL_TOP, CYL.ri + 0.0035, 1, [[5, [PAN[0] + 0.024, PAN[1] + BK.h + 0.028, PAN[2]], 1.95]])
  const lvlTop: PFn = (p) => PAN[1] + 0.003 + ((waterIn(p) + CRYSTAL_ML * sodaFrac(p)) / 1e6 / (Math.PI * BK.ri * BK.ri))

  return (
    <group>
      <group position={PPE as unknown as THREE.Vector3Tuple}>
        <PpeTray worn={(p) => ease(p, 0, 0.95)} gloves={false} />
        <Target name="ppe" size={[0.16, 0.05, 0.1]} center={[0, 0.02, 0]} hintY={0.08} />
      </group>

      {/* весы и кнопка тары */}
      <group position={SC as unknown as THREE.Vector3Tuple}>
        <DigitalScales reading={reading} readout={readoutAfter(3, 8)} />
        <group position={SCALES.tareBtn as unknown as THREE.Vector3Tuple}>
          <Target name="tare" size={[0.03, 0.03, 0.03]} center={[0, 0, 0.004]} hintY={0.05} ring={false} />
        </group>
      </group>

      {/* стакан 250 мл: кристаллы → вода → раствор */}
      <Pose pose={(p) => ({ pos: beakerPos(p) })}>
        <MeasuringBeaker
          size={BK}
          volume={(p) => waterIn(p) + CRYSTAL_ML * sodaFrac(p) * (waterIn(p) > 1 ? 1 : 0)}
          color={() => '#eaf5ff'}
          cloud={(p) => 0.16 * hill(p, 5.5, 7.7, 0.2)}
          solidColor="#f2f5f3"
        />
        <CrystalHeap />
        <Target name="beaker" size={[0.08, 0.1, 0.08]} center={[0, 0.05, 0]} hintY={0.13} />
      </Pose>
      <Falling from={[PAN[0] - 0.008, PAN[1] + 0.12, PAN[2]]} toY={(p) => PAN[1] + 0.004 + 0.0128 * sodaFrac(p)} a={T0 + 0.1} b={T0 + CUM.length * TRIP} n={18} color="#eef2f0" size={0.0026} box jitter={0.008} />

      {/* банка с кристаллической содой и шпатель */}
      <group position={JAR as unknown as THREE.Vector3Tuple}>
        <PowderJar formula="Na₂CO₃·10H₂O" name={{ ru: 'сода кристаллическая', en: 'washing soda', uz: 'kristall soda' }[lang]} color="#eef3f1" fill={0.62} open={(p) => ease(p, 2.9, 3.0) * (1 - ease(p, 3.95, 4))} />
      </group>
      <Pose
        pose={(p) => {
          const s = spatulaPose(p)
          return { pos: s.pos, rot: s.rot }
        }}
      >
        <Spatula full={(p) => spatulaPose(p).full} color="#eef3f1" />
        <Target name="spatula" size={[0.15, 0.03, 0.04]} center={[0.06, 0.004, 0]} hintY={0.05} ring={false} />
      </Pose>

      {/* мерный цилиндр 250 мл и склянка с водой */}
      <Pose pose={cylPose}>
        <MeasuringCylinder capacity={250} volume={cylVol} />
        <Target name="cylinder" size={[0.06, 0.26, 0.06]} center={[0, 0.13, 0]} hintY={0.29} />
      </Pose>
      <SolutionBottle pose={water} formula="H₂O" name={{ ru: 'дист. вода', en: 'dist. water', uz: 'distillangan suv' }[lang]} level={(p) => mix(0.95, 0.12, ease(p, 4.46, 4.74))} target="bottle-water" />
      <PourStream x={CY[0] - 0.003} z={CY[2]} top={() => CYL_TOP + 0.016} bottom={(p) => CYL_BOTTOM + (cylVol(p) / 250) * CYL.scaleH} show={(p) => hill(p, 4.46, 4.74, 0.15)} />
      <PourStream x={PAN[0] + 0.021} z={PAN[2]} top={() => PAN[1] + BK.h + 0.026} bottom={lvlTop} show={(p) => hill(p, 5.48, 5.76, 0.15)} />
      <Readout
        position={[CY[0] + 0.05, 0.17, CY[2]]}
        label={{ ru: 'цилиндр', en: 'cylinder', uz: 'silindr' }}
        text={(p, lg) => (p >= 4.74 && p < 5.3 ? `${fmtNum(V, 0, lg)} ${{ ru: 'мл', en: 'ml', uz: 'ml' }[lg]}` : null)}
      />

      {/* термометр в лапке штатива и стеклянная палочка */}
      <ThermoStand temp={temp} />
      <Readout
        position={[TX + 0.035, 0.13, B0[2] + 0.02]}
        label={{ ru: 'термометр', en: 'thermometer', uz: 'termometr' }}
        text={(p, lg) => (p >= 6.7 && p < 8.05 ? `${fmtNum(quantize(temp(p), 0.5), 1, lg)} °C` : null)}
      />
      <Pose pose={stirPose}>
        <GlassRod length={0.2} />
      </Pose>
      <group position={[STIR_REST[0] + 0.1, 0, STIR_REST[2]]}>
        <Target name="stir-rod" size={[0.21, 0.03, 0.04]} center={[0, 0.006, 0]} hintY={0.05} />
      </group>
    </group>
  )
}
