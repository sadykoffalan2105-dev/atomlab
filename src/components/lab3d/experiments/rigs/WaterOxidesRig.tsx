/**
 * Kimyo 7, § 6.5 (с. 140): взаимодействие воды с оксидами.
 * Пробирки: 1 — CaO + вода (разогрев, пар, белая мутная Ca(OH)₂, фенолфталеин малиновый),
 * 2 — газированная минеральная вода (CO₂ + H₂O → H₂CO₃, лакмус красный), 3 — дистиллированная вода (лакмус фиолетовый).
 * Шаги: 0 защита · 1 CaO шпателем · 2 вода к CaO · 3 минеральная вода · 4 дист. вода · 5 фенолфталеин → 1 ·
 * 6 лакмус → 2 · 7 лакмус → 3 · 8 сравнить на белом фоне.
 */
import * as THREE from 'three'
import { Pose, Target, ease, hill, mix, mixV, useRig, useSoundAt, type PFn, type V3 } from '../rigCore'
import { Bubbles, PourStream } from '../parts/effects'
import { BOTTLE_H, ReagentBottle, TUBE_H, TubeRack, TubeTag, WatchGlass } from '../parts/glassware'
import { ColorTube, DropperBottle, Falling, Pipette, PpeTray, Puffs, type ColorStage } from '../parts/practicalware'
import { useGearStep } from './useGearStep'
import { MilkFill, PowderHeap, Spatula, bottlePose, pipettePose, pourLevel, pourShow } from './worksKit'

const Z = -0.06
const XS = [-0.08, 0, 0.08] as const
const TUBE_Y = 0.012
const TOP = TUBE_Y + TUBE_H
const LIP = TOP + 0.03
const LEVEL0 = 0.044
const PPE: V3 = [0.5, 0, 0.17]
const DISH: V3 = [-0.3, 0, 0.15]
const WB: V3 = [-0.46, 0, -0.06]
const SB: V3 = [-0.46, 0, 0.12]
const PH: V3 = [0.24, 0, 0.13]
const LT: V3 = [0.34, 0, 0.13]

/** Цвета по таблице учебника (с. 140): фенолфталеин в основании — малиновый, лакмус в кислоте — красный, в воде — фиолетовый. */
const C = {
  water: '#eef6ff',
  milk: '#ebe9e3', // Ca(OH)₂ — белая взвесь
  crimson: '#c8186e',
  litRed: '#d2303f',
  litViolet: '#7b4fb2',
  phenol: '#f4f6f8',
  litmus: '#6c56b8',
  soda: '#e9f7f0',
} as const

const lvl1: PFn = (p) => pourLevel(2, LEVEL0)(p) + 0.005 * ease(p, 5.3, 5.55)
const lvl2: PFn = (p) => pourLevel(3, LEVEL0)(p) + 0.004 * ease(p, 6.3, 6.55)
const lvl3: PFn = (p) => pourLevel(4, LEVEL0)(p) + 0.004 * ease(p, 7.3, 7.55)

const TUBES: readonly { x: number; tag: string; level: PFn; stages: readonly ColorStage[] }[] = [
  { x: XS[0], tag: '1 CaO', level: lvl1, stages: [[2.5, 2.95, C.milk], [5.4, 5.95, C.crimson]] },
  { x: XS[1], tag: '2 CO₂', level: lvl2, stages: [[6.4, 6.95, C.litRed]] },
  { x: XS[2], tag: '3 H₂O', level: lvl3, stages: [[7.4, 7.95, C.litViolet]] },
]

/** Шпатель: с часового стекла → над пробиркой 1 → поворот, порошок сыплется → обратно. Начало — ложечка. */
function spatulaPose(p: number) {
  const rest: V3 = [DISH[0] - 0.004, 0.009, DISH[2]]
  const lifted: V3 = [DISH[0], 0.22, DISH[2]]
  const over: V3 = [XS[0] + 0.004, TOP + 0.012, Z]
  let pos = mixV(rest, lifted, ease(p, 1, 1.2))
  pos = mixV(pos, over, ease(p, 1.18, 1.45))
  pos = mixV(pos, lifted, ease(p, 1.72, 1.86))
  pos = mixV(pos, rest, ease(p, 1.84, 1.98))
  const roll = ease(p, 1.45, 1.55) * (1 - ease(p, 1.66, 1.74))
  return { pos, rot: [1.9 * roll, 0, 0.12 * ease(p, 1.18, 1.45) * (1 - ease(p, 1.72, 1.86))] as V3 }
}

function DropperSet({ at, label, color, uses, target }: { at: V3; label: Readonly<Record<'ru' | 'en' | 'uz', string>>; color: string; uses: readonly (readonly [number, number])[]; target: string }) {
  const { lang } = useRig()
  const full = uses.map(([s, x]) => [s, x, Z, TOP + 0.016] as const)
  const pose = pipettePose(at, full)
  return (
    <>
      <group position={at as unknown as THREE.Vector3Tuple}>
        <DropperBottle color={color} label={label[lang]} />
        <Target name={target} size={[0.05, 0.12, 0.05]} center={[0, 0.06, 0]} hintY={0.15} />
      </group>
      <Pose pose={(p) => ({ pos: pose(p).pos })}>
        <Pipette color={color} squeeze={(p) => pose(p).squeeze} />
      </Pose>
      {uses.map(([s, x]) => {
        const tube = TUBES.find((tb) => tb.x === x)
        const lv = tube ? tube.level : () => LEVEL0
        return <Falling key={s} from={[x, TOP + 0.014, Z]} toY={(p) => TUBE_Y + lv(p)} a={s + 0.31} b={s + 0.55} n={3} color={color} size={0.0021} />
      })}
    </>
  )
}

export function WaterOxidesRig() {
  useGearStep('water-oxides', 0)
  useSoundAt(0.2, 'click', PPE, 0.5)
  useSoundAt(1.5, 'glass-clink', [XS[0], TOP, Z], 0.25)
  useSoundAt(2.46, 'pour', [XS[0], LIP, Z], 0.5)
  useSoundAt(2.62, 'sizzle', [XS[0], TOP, Z], 0.55)
  useSoundAt(3.46, 'pour', [XS[1], LIP, Z], 0.5)
  useSoundAt(3.6, 'bubble', [XS[1], 0.05, Z], 0.4)
  useSoundAt(4.46, 'pour', [XS[2], LIP, Z], 0.5)
  useSoundAt(5.34, 'splash', [XS[0], TOP, Z], 0.25)
  useSoundAt(5.95, 'success', [XS[0], 0.1, Z], 0.35)
  useSoundAt(6.34, 'splash', [XS[1], TOP, Z], 0.25)
  useSoundAt(7.34, 'splash', [XS[2], TOP, Z], 0.25)
  useSoundAt(8.15, 'glass-clink', [0, 0.1, Z], 0.5)
  useSoundAt(8.9, 'success', [0, 0.2, Z], 0.6)

  const water = bottlePose(WB, [
    [2, XS[0], Z, LIP],
    [4, XS[2], Z, LIP],
  ])
  const soda = bottlePose(SB, [[3, XS[1], Z, LIP]])

  return (
    <group>
      {/* Средства защиты */}
      <group position={PPE as unknown as THREE.Vector3Tuple}>
        <PpeTray worn={(p) => ease(p, 0, 0.95)} coat />
        <Target name="ppe" size={[0.16, 0.05, 0.1]} center={[0, 0.02, 0]} hintY={0.08} />
      </group>

      {/* Штатив с тремя пробирками; на сравнении пробирки поднимаются, за ними — белый лист */}
      <group position={[0, 0, Z]}>
        <TubeRack xs={XS} holeTop={0.04} />
        <Target name="rack" size={[0.3, 0.12, 0.08]} center={[0, 0.07, 0]} hintY={0.21} />
      </group>
      {TUBES.map((tb, i) => (
        <Pose key={i} pose={(p) => ({ pos: [tb.x, TUBE_Y + 0.035 * ease(p, 8.05 + i * 0.05, 8.4 + i * 0.05), Z] })}>
          <ColorTube base={i === 1 ? C.soda : C.water} stages={tb.stages} level={tb.level} />
          <group position={[0, 0.1, 0]}>
            <TubeTag text={tb.tag} />
          </group>
          {/* суспензия Ca(OH)₂ — белая муть; с фенолфталеином остаётся лёгкая взвесь */}
          {i === 0 ? <MilkFill level={tb.level} cloud={(p) => ease(p, 2.55, 3) * (1 - 0.75 * ease(p, 5.4, 5.95))} /> : null}
          {/* CaO на дне: появляется после шпателя, расходится в воде белой взвесью */}
          {i === 0 ? (
            <Pose pose={(p) => ({ pos: [0, 0.001, 0], scale: ease(p, 1.5, 1.7) * (1 - ease(p, 2.55, 3)) })}>
              <PowderHeap r={0.0072} h={0.006} />
            </Pose>
          ) : null}
          {/* бурление воды при разогреве (1) и пузырьки CO₂ из минеральной воды (2) */}
          {i === 0 ? <Bubbles level={tb.level} rate={(p) => hill(p, 2.55, 3.6, 0.2) * 0.8} fromY={0.006} /> : null}
          {i === 1 ? <Bubbles level={tb.level} rate={(p) => ease(p, 3.5, 3.7) * mix(0.45, 0.18, ease(p, 4, 9))} fromY={0.012} spread={0.9} /> : null}
        </Pose>
      ))}
      <Pose pose={(p) => ({ pos: [0, 0.1, Z - 0.045], scale: ease(p, 8.05, 8.45) })}>
        <mesh>
          <planeGeometry args={[0.32, 0.14]} />
          <meshStandardMaterial color="#ffffff" roughness={0.9} />
        </mesh>
      </Pose>
      {/* пар над пробиркой 1 — реакция идёт с выделением тепла */}
      <Puffs origin={[XS[0], TOP + 0.004, Z]} rate={(p) => hill(p, 2.58, 3.9, 0.25)} count={26} rise={0.11} spread={0.018} size={0.011} opacity={0.32} life={1.4} />

      {/* Часовое стекло с CaO и шпатель */}
      <group position={DISH as unknown as THREE.Vector3Tuple}>
        <WatchGlass />
        <group position={[0.012, 0.004, 0.004]}>
          <PowderHeap r={0.014} h={0.007} />
        </group>
      </group>
      <Pose pose={spatulaPose}>
        <Spatula full={(p) => 1 - ease(p, 1.48, 1.68)} />
        <Target name="spatula" size={[0.06, 0.04, 0.05]} center={[0.03, 0.006, 0]} hintY={0.06} ring={false} />
      </Pose>
      <Falling from={[XS[0], TOP + 0.006, Z]} toY={() => TUBE_Y + 0.004} a={1.48} b={1.68} n={10} color="#f6f5f1" size={0.0016} box />

      {/* Склянка с дистиллированной водой (шаги 2 и 4) и бутылка минеральной воды (шаг 3) */}
      <Pose pose={water}>
        <ReagentBottle formula="H₂O" name="дистиллированная вода" level={(p) => mix(1, 0.8, ease(p, 2.46, 2.74)) - 0.18 * ease(p, 4.46, 4.74)} />
        <group position={[0, -BOTTLE_H, 0]}>
          <Target name="bottle-water" size={[0.07, 0.13, 0.07]} center={[0, 0.06, 0]} hintY={0.16} />
        </group>
      </Pose>
      <Pose pose={soda}>
        <ReagentBottle formula="H₂O + CO₂" name="минеральная вода" color={C.soda} level={(p) => mix(1, 0.8, ease(p, 3.46, 3.74))} />
        <group position={[0, -BOTTLE_H, 0]}>
          <Target name="bottle-soda" size={[0.07, 0.13, 0.07]} center={[0, 0.06, 0]} hintY={0.16} />
        </group>
      </Pose>
      {TUBES.map((tb, i) => (
        <PourStream key={i} x={tb.x + 0.003} z={Z} top={() => LIP - 0.004} bottom={(p) => TUBE_Y + Math.max(0.006, tb.level(p))} show={pourShow(2 + i)} color={i === 1 ? C.soda : '#dff1ff'} />
      ))}

      {/* Пипетки-капельницы с индикаторами */}
      <DropperSet at={PH} label={{ ru: 'фенолфт.', en: 'phenolphth.', uz: 'fenolft.' }} color={C.phenol} target="phenolphthalein" uses={[[5, XS[0]]]} />
      <DropperSet at={LT} label={{ ru: 'лакмус', en: 'litmus', uz: 'lakmus' }} color={C.litmus} target="litmus" uses={[[6, XS[1]], [7, XS[2]]]} />
    </group>
  )
}
