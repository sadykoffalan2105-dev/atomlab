/**
 * task-g8-agcl (Kimyo 8, с. 128, задание 10): 50,0 г 1,9 %-го MgCl₂ + 40 мл 10 %-го AgNO₃ → AgCl↓, фильтр до и после.
 * Шаги: 0 защита · 1 сухой фильтр на весы (m ф) · 2 фильтр на стол, стакан на весы, T · 3 раствор MgCl₂ до 50,00 г ·
 * 4 AgNO₃ из тёмной склянки в цилиндр (40 мл) · 5 стакан с весов на стол · 6 AgNO₃ в стакан — белый осадок ·
 * 7 осадок осел, капля AgNO₃ в прозрачный слой — мути нет · 8 фильтр в воронку, слив по палочке, промывание ·
 * 9 фильтр в сушильный шкаф, 105 °C · 10 обнулить весы, фильтр с осадком на весы (m ф+AgCl).
 * Все числа на приборах — из показаний попытки (useLabTaskValues): к концу шага прибор показывает то, что в журнале.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BOTTLE_H, ReagentBottle, WatchGlass } from '../../../parts/glassware'
import { PourStream } from '../../../parts/effects'
import { DropperBottle, FUNNEL, Falling, FilterPaper, Funnel, GlassRod, Pipette, PpeTray, RingStand } from '../../../parts/practicalware'
import { Pose, Target, ease, hill, mix, mixV, useRig, useSoundAt, type PFn, type V3 } from '../../../rigCore'
import { pipettePose } from '../../worksKit'
import { useGearStep } from '../../useGearStep'
import { useLabTaskValues } from '../../../../measure/labTaskSession'
import { fmtNum } from '../../../../measure/instruments'
import { solutionDensity } from '../../../../measure/quantities'
import { DigitalScales, Readout, SCALES, SCALES_PAN_CENTER } from '../../../../measure/devices/Scales'
import { BEAKERS, CYL_BOTTOM, MeasuringBeaker, MeasuringCylinder, beakerLevel, cylinderTop } from '../../../../measure/devices/Glass'
import { DryingOven, OVEN, OVEN_SHELF } from '../../../../measure/devices/Bench'
import { jarLabelTexture } from '../../../../measure/devices/deviceTextures'
import { cylinderGeom } from '../../../../measure/quantities'
import { AG } from '../../../../../../data/labTasks/g8/layoutG8'
import { AMBER, AmberBottle, AmberStopper, pourPose, spoutPour, track } from './g8Kit'

const ID = 'task-g8-agcl' as const
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const PAN: V3 = add(AG.scales, SCALES_PAN_CENTER)
const BK = BEAKERS[250]
const BKR = BK.ri + 0.0012
const B0 = AG.beaker
const CY = AG.cylinder
const CYL_TOP = cylinderTop(50)
const CYL_H = cylinderGeom(50).scaleH
const FUN = AG.funnel
const RCV = AG.receiver
const OV = AG.oven
/** Масса пустого стакана 250 мл (г) — до тары. */
const MB = 104.37
/** Бесцветные растворы — с лёгким голубым оттенком стекла, чтобы уровень был виден. */
const C_SOL = '#c4def3'
const C_AG = '#cde0f1'
/** Белый творожистый AgCl (чуть сереет на свету) — на белой бумаге и столе виден по лёгкому кремовому тону. */
const C_AGCL = '#d8d5cc'

/* ── места фильтра ── */
const IN_FUNNEL: V3 = [FUN[0], FUN[1] + 0.011, FUN[2]]
/** Развёрнутый фильтр лежит на краях часового стекла в шкафу (лист — на 1,2 мм выше начала FilterPaper). */
const DRY_AT: V3 = [OV[0] + OVEN_SHELF[0], OV[1] + OVEN_SHELF[1] + 0.0126, OV[2] + OVEN_SHELF[2] + 0.02]
const OVEN_FRONT: V3 = [DRY_AT[0], DRY_AT[1] + 0.004, OV[2] + OVEN.d / 2 + 0.07]

const filterPos = track(AG.paper, [
  [1, 1.55, PAN, 0.12],
  [2, 2.18, AG.paper, 0.1],
  [8, 8.2, [FUN[0], 0.33, FUN[2]], 0.33],
  [8.2, 8.28, IN_FUNNEL],
  [9.04, 9.26, OVEN_FRONT, 0.3],
  [9.26, 9.36, DRY_AT],
  [10.1, 10.2, OVEN_FRONT],
  [10.2, 10.58, PAN, 0.3],
])
/** Фильтр: лист → конус (шаг 8) → вынули из воронки и развернули над столом (шаг 9) — осадок горкой в середине. */
const filterFold: PFn = (p) => ease(p, 8.03, 8.19) * (1 - ease(p, 9.1, 9.24))
const heapShown: PFn = (p) => (p > 9.1 ? 1 - filterFold(p) : 0)

/* ── стакан: место → весы → место → (шаг 8) переливание в воронку по палочке ── */
const beakerTrack = track(B0, [
  [2.14, 2.5, PAN, 0.12],
  [5, 5.6, B0, 0.12],
])
/** Носик стакана — у палочки над фильтром. */
const FILTER_LIP: V3 = [FUN[0] - 0.022, FUN[1] + 0.085, FUN[2]]
const beakerPour = spoutPour(B0, 8.1, 0.62, FILTER_LIP, BK.h, BKR, 1.42, -1)
const pourA = 8.1 + 0.62 * 0.46
const pourB = 8.1 + 0.62 * 0.74

/* ── палочка: лежит вдоль +X → вертикально над воронкой, нижний конец у стенки фильтра ── */
const ROD_LEN = 0.2
const ROD_REST: V3 = [AG.rod[0], 0.003, AG.rod[2]]
/** Нижний конец палочки касается фильтра (у стенки, где бумага в три слоя), верх наклонён к стакану. */
const ROD_IN: V3 = [FUN[0] - 0.011, FUN[1] + 0.03, FUN[2]]
function rodPose(p: number) {
  const pos = track(ROD_REST, [
    [8.04, 8.3, ROD_IN, 0.33],
    [8.66, 8.92, ROD_REST, 0.33],
  ])(p)
  const up = ease(p, 8.06, 8.16) * (1 - ease(p, 8.82, 8.9))
  return { pos, rot: [0, 0, mix(-Math.PI / 2, 0.14, up)] as V3 }
}

/* ── промывалка (начало — горлышко): к воронке, наклон вокруг горлышка, обратно ── */
const WASH_LIP: V3 = [FUN[0] + 0.012, FUN[1] + FUNNEL.coneH + 0.02, FUN[2]]
function washPose(p: number) {
  const rest: V3 = [AG.wash[0], BOTTLE_H, AG.wash[2]]
  const up: V3 = [rest[0], WASH_LIP[1] + 0.08, rest[2]]
  let pos = mixV(rest, up, ease(p, 8.62, 8.68))
  pos = mixV(pos, [WASH_LIP[0], WASH_LIP[1] + 0.08, WASH_LIP[2]], ease(p, 8.66, 8.73))
  pos = mixV(pos, WASH_LIP, ease(p, 8.72, 8.76))
  pos = mixV(pos, up, ease(p, 8.9, 8.94))
  pos = mixV(pos, rest, ease(p, 8.93, 8.99))
  const tilt = ease(p, 8.75, 8.79) * (1 - ease(p, 8.87, 8.9))
  return { pos, rot: [0, 0, 1.85 * tilt] as V3 }
}

export function AgClRig() {
  const { lang } = useRig()
  const v = useLabTaskValues(ID)
  const mF = v.mF!
  const mSol = v.mSol!
  const vAg = v.vAg!
  const mFP = v.mFP!
  const vSol = mSol / solutionDensity('MgCl2', 0.019)

  useGearStep(ID, 0)
  useSoundAt(0.2, 'click', AG.ppe, 0.5)
  useSoundAt(2.47, 'glass-place', PAN, 0.4)
  useSoundAt(2.75, 'click', add(AG.scales, SCALES.tareBtn), 0.5)
  useSoundAt(3.46, 'pour', [PAN[0], 0.15, PAN[2]], 0.5)
  useSoundAt(4.06, 'glass-clink', AG.agBottle, 0.3)
  useSoundAt(4.46, 'pour', [CY[0], CYL_TOP, CY[2]], 0.45)
  useSoundAt(4.95, 'glass-clink', AG.agBottle, 0.3)
  useSoundAt(5.58, 'glass-place', B0, 0.4)
  useSoundAt(6.46, 'pour', [B0[0], 0.1, B0[2]], 0.5)
  useSoundAt(7.34, 'glass-clink', [B0[0], 0.1, B0[2]], 0.15)
  useSoundAt(pourA, 'pour', [FUN[0], FUN[1] + 0.06, FUN[2]], 0.45)
  useSoundAt(8.78, 'pour', [FUN[0], FUN[1] + 0.06, FUN[2]], 0.3)
  useSoundAt(9.03, 'door-open', [OV[0], 0.1, OV[2] + OVEN.d / 2], 0.5)
  useSoundAt(9.4, 'door-close', [OV[0], 0.1, OV[2] + OVEN.d / 2], 0.5)
  useSoundAt(9.46, 'click', [OV[0] - 0.04, 0.02, OV[2] + OVEN.d / 2], 0.4)
  useSoundAt(9.88, 'door-open', [OV[0], 0.1, OV[2] + OVEN.d / 2], 0.4)
  useSoundAt(10.06, 'click', add(AG.scales, SCALES.tareBtn), 0.5)
  useSoundAt(10.4, 'door-close', [OV[0], 0.1, OV[2] + OVEN.d / 2], 0.35)
  useSoundAt(10.96, 'success', PAN, 0.4)

  /* ── количества по прогрессу ── */
  const solIn: PFn = (p) => ease(p, 3.46, 3.74)
  const agIn: PFn = (p) => ease(p, 6.46, 6.74)
  const poured: PFn = (p) => ease(p, pourA, pourB)
  const beakerVol: PFn = (p) => (vSol * solIn(p) + vAg * agIn(p)) * (1 - poured(p))
  // муть: AgCl выпадает сразу, за шаг 7 оседает; осадок уходит со струёй на фильтр
  const cloud: PFn = (p) => 0.92 * ease(p, 6.48, 6.6) * (1 - 0.9 * ease(p, 7.0, 7.26)) * (1 - poured(p))
  const bed: PFn = (p) => 0.004 * ease(p, 6.9, 7.3) * (1 - ease(p, pourA, pourB - 0.04))
  const cylVol: PFn = (p) => vAg * ease(p, 4.46, 4.74) * (1 - agIn(p))
  const filtrate: PFn = (p) => (vSol + vAg) * 0.97 * ease(p, pourA + 0.02, 8.68) + 15 * ease(p, 8.8, 8.97)

  /* ── весы: фильтр (m ф) → стакан, T → раствор → стакан сняли (−MB) → T → фильтр с осадком ── */
  const reading = (p: number) => {
    if (p < 1.53) return 0
    if (p < 2.02) return mF
    if (p < 2.47) return 0
    if (p < 2.75) return MB
    if (p < 5.06) return mSol * solIn(p)
    if (p < 10.06) return -MB
    if (p < 10.56) return 0
    return mFP
  }
  const readout: PFn = (p) => ((p >= 1.58 && p <= 2.02) || (p >= 3.76 && p <= 4.35) || p >= 10.6 ? 1 : 0)

  /* ── склянки и цилиндр ── */
  const mgPose = pourPose(AG.mgBottle, 3, [PAN[0] - 0.004, PAN[1] + BK.h + 0.012, PAN[2]], BOTTLE_H, 1.85, 0.028)
  const agPose = pourPose(AG.agBottle, 4, [CY[0] - 0.004, CYL_TOP + 0.012, CY[2]], AMBER.h, 1.85, AMBER.r)
  const cylPose = pourPose(CY, 6, [B0[0] + 0.008, BK.h + 0.012, B0[2]], CYL_TOP, 1.9, cylinderGeom(50).ri + 0.0013)
  const agClosed: PFn = (p) => (p > 4.08 && p < 4.94 ? 0 : 1)
  const agLabel = useMemo(() => jarLabelTexture('AgNO₃ 10 %', { ru: 'нитрат серебра', en: 'silver nitrate', uz: 'kumush nitrat' }[lang], '', '#7a4a1c'), [lang])

  /* ── пипетка с AgNO₃: проба на полноту осаждения ── */
  const pip = pipettePose(AG.dropper, [[7, B0[0] + 0.01, B0[2], BK.h + 0.012]])
  const beakerLevelY: PFn = (p) => beakerLevel(BK, beakerVol(p))

  /* ── шкаф ── */
  const door: PFn = (p) => Math.max(hill(p, 9.0, 9.42, 0.35), ease(p, 9.86, 9.97) * (1 - ease(p, 10.24, 10.42)))
  const ovenOn: PFn = (p) => ease(p, 9.44, 9.48) * (1 - ease(p, 9.84, 9.88))

  return (
    <group>
      <group position={AG.ppe as unknown as THREE.Vector3Tuple}>
        <PpeTray worn={(p) => ease(p, 0, 0.95)} />
        <Target name="ppe" size={[0.16, 0.05, 0.1]} center={[0, 0.02, 0]} hintY={0.08} />
      </group>

      {/* весы */}
      <group position={AG.scales as unknown as THREE.Vector3Tuple}>
        <DigitalScales reading={reading} readout={readout} />
      </group>

      {/* фильтр: лист на столе → на весы → обратно → конус в воронке → лёжа на часовом стекле в шкафу → на весы */}
      <Pose pose={(p) => ({ pos: filterPos(p) })}>
        <FilterPaper
          fold={filterFold}
          wet={(p) => ease(p, pourA - 0.02, pourA + 0.06) * (1 - ease(p, 9.48, 9.84))}
          fill={(p) => 0.72 * ease(p, pourA, pourA + 0.06) * (1 - ease(p, pourB, 8.7)) + 0.4 * hill(p, 8.78, 8.95, 0.2)}
          dirt={(p) => ease(p, pourA + 0.02, pourB)}
          liquidColor={C_SOL}
          dirtColor={C_AGCL}
        />
        <AgClHeap shown={heapShown} />
        <Target name="filter" size={[0.08, 0.05, 0.08]} center={[0, 0.012, 0]} hintY={0.075} />
      </Pose>

      {/* стакан 250 мл: раствор MgCl₂ → + AgNO₃: белый творожистый AgCl → осел → на фильтр */}
      <Pose pose={(p) => (p >= 8.1 && p < 8.72 ? beakerPour(p) : { pos: beakerTrack(p), rot: [0, 0, 0] as V3 })}>
        <MeasuringBeaker size={BK} volume={beakerVol} color={() => C_SOL} cloud={cloud} bed={bed} solidColor={C_AGCL} />
        <Target name="beaker" size={[0.08, 0.1, 0.08]} center={[0, 0.05, 0]} hintY={0.13} />
      </Pose>
      <PourStream x={PAN[0] - 0.004} z={PAN[2]} top={() => PAN[1] + BK.h + 0.008} bottom={(p) => PAN[1] + beakerLevel(BK, beakerVol(p))} show={(p) => hill(p, 3.46, 3.74, 0.15)} color={C_SOL} />

      {/* склянка MgCl₂ 1,9 % */}
      <Pose pose={mgPose}>
        <group position={[0, BOTTLE_H, 0]}>
          <ReagentBottle formula="MgCl₂ 1,9 %" name={{ ru: 'хлорид магния', en: 'magnesium chloride', uz: 'magniy xlorid' }[lang]} level={(p) => mix(0.92, 0.48, solIn(p))} />
        </group>
        <Target name="bottle-mgcl2" size={[0.07, 0.13, 0.07]} center={[0, 0.06, 0]} hintY={0.16} />
      </Pose>

      {/* тёмная склянка AgNO₃ 10 % и её пробка на столе */}
      <Pose pose={agPose}>
        <AmberBottle label={agLabel} level={(p) => mix(0.85, 0.5, ease(p, 4.46, 4.74))} closed={agClosed} />
        <Target name="bottle-agno3" size={[0.065, 0.12, 0.065]} center={[0, 0.055, 0]} hintY={0.15} />
      </Pose>
      <group position={[AG.agBottle[0] - 0.05, 0, AG.agBottle[2] + 0.04]}>
        <AmberStopper shown={(p) => 1 - agClosed(p)} />
      </group>
      <PourStream x={CY[0] - 0.004} z={CY[2]} top={() => CYL_TOP + 0.008} bottom={(p) => CYL_BOTTOM + (cylVol(p) / 50) * CYL_H} show={(p) => hill(p, 4.46, 4.74, 0.15)} color={C_AG} />

      {/* мерный цилиндр 50 мл */}
      <Pose pose={cylPose}>
        <MeasuringCylinder capacity={50} volume={cylVol} color={C_AG} />
        <Target name="cylinder" size={[0.05, 0.19, 0.05]} center={[0, 0.095, 0]} hintY={0.22} />
      </Pose>
      <Readout
        position={[CY[0] + 0.05, 0.14, CY[2]]}
        label={{ ru: 'цилиндр', en: 'cylinder', uz: 'silindr' }}
        text={(p, l) => (p > 4.78 && p < 5.4 ? `${fmtNum(vAg, 1, l)} ${l === 'ru' ? 'мл' : 'ml'}` : null)}
      />
      <PourStream x={B0[0] + 0.008} z={B0[2]} top={() => BK.h + 0.008} bottom={(p) => beakerLevelY(p)} show={(p) => hill(p, 6.46, 6.74, 0.15)} color={C_AG} />

      {/* склянка-капельница AgNO₃ и пипетка: капли падают в прозрачный слой — мути нет */}
      <group position={AG.dropper as unknown as THREE.Vector3Tuple}>
        <DropperBottle color={C_AG} label="AgNO₃" amber />
      </group>
      <Pose pose={(p) => ({ pos: pip(p).pos })}>
        <Pipette color={C_AG} squeeze={(p) => pip(p).squeeze} />
        <Target name="dropper" size={[0.04, 0.11, 0.04]} center={[0, 0.06, 0]} hintY={0.14} ring={false} />
      </Pose>
      <Falling from={[B0[0] + 0.01, BK.h + 0.01, B0[2]]} toY={beakerLevelY} a={7.32} b={7.56} n={4} color={C_AG} size={0.0018} />

      {/* стеклянная палочка */}
      <Pose pose={rodPose}>
        <GlassRod length={ROD_LEN} />
      </Pose>
      <PourStream x={FILTER_LIP[0] + 0.006} z={FILTER_LIP[2]} top={() => FILTER_LIP[1] - 0.002} bottom={() => FUN[1] + 0.03} show={(p) => hill(p, pourA, pourB, 0.15)} color="#f1f2f0" />

      {/* штатив с кольцом (стойка за воронкой), воронка, стакан для фильтрата */}
      <group position={[FUN[0], 0, FUN[2]]} rotation={[0, Math.PI / 2, 0]}>
        <RingStand rodX={AG.standBack} ringX={0} ringY={FUN[1] + 0.044} ringR={0.028} rodH={0.36} />
      </group>
      <group position={FUN as unknown as THREE.Vector3Tuple}>
        <Funnel />
      </group>
      <Falling from={[FUN[0], FUN[1] - FUNNEL.stem, FUN[2]]} toY={(p) => beakerLevel(BK, filtrate(p))} a={pourA + 0.02} b={8.97} n={16} color={C_SOL} size={0.0017} />
      <group position={RCV as unknown as THREE.Vector3Tuple}>
        <MeasuringBeaker size={BK} volume={filtrate} color={() => C_SOL} />
      </group>

      {/* промывалка с дистиллированной водой */}
      <Pose pose={washPose}>
        <ReagentBottle formula="H₂O" name={{ ru: 'дист. вода', en: 'dist. water', uz: 'distillangan suv' }[lang]} level={(p) => mix(0.9, 0.72, ease(p, 8.78, 8.88))} />
      </Pose>
      <PourStream x={WASH_LIP[0]} z={WASH_LIP[2]} top={() => WASH_LIP[1] - 0.004} bottom={() => FUN[1] + 0.025} show={(p) => hill(p, 8.78, 8.88, 0.2)} />

      {/* сушильный шкаф с часовым стеклом на полке */}
      <group position={OV as unknown as THREE.Vector3Tuple}>
        <DryingOven
          door={door}
          on={ovenOn}
          lines={(p) => {
            const min = Math.round(60 * ease(p, 9.48, 9.84))
            return ['105 °C', `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`]
          }}
        />
        <group position={[OVEN_SHELF[0], OVEN_SHELF[1], OVEN_SHELF[2] + 0.02]}>
          <WatchGlass />
        </group>
      </group>
    </group>
  )
}

/** Горка высушенного AgCl в середине развёрнутого фильтра (начало — лист фильтра). */
function AgClHeap({ shown }: { shown: PFn }) {
  const { p } = useRig()
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: C_AGCL, roughness: 1 }), [])
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const k = shown(p.current ?? 0)
    m.visible = k > 0.05
    m.scale.set(0.017 * k + 1e-4, 0.0055 * k + 1e-4, 0.015 * k + 1e-4)
  })
  return (
    <mesh ref={ref} position={[0, 0.0024, 0]} material={mat} castShadow>
      <sphereGeometry args={[1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
    </mesh>
  )
}
