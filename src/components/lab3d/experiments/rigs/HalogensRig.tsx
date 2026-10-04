/**
 * Kimyo 8, Лабораторная работа 5 (с. 202): вытеснение галогенов из их растворов — в вытяжном шкафу.
 * Пробирки: 1 NaBr, 2 NaI, 3 NaI, 4 NaCl. Пипетки-капельницы: хлорная вода, бромная вода, крахмальный клейстер.
 * Шаги: 0 очки и перчатки · 1 Cl₂ → NaBr (жёлто-оранжевый Br₂) · 2 Cl₂ → NaI (жёлто-бурый I₂) ·
 * 3 Br₂ → NaI (бурый I₂) · 4 Br₂ → NaCl (без изменений) · 5 крахмал → I₂ (тёмно-синий) · 6 сравнить на белом фоне.
 */
import * as THREE from 'three'
import { Pose, Target, ease, hill, mix, mixV, useSoundAt, type PFn, type V3 } from '../rigCore'
import { TUBE_H, TubeRack, TubeTag } from '../parts/glassware'
import { ColorTube, DropperBottle, Falling, Pipette, PpeTray, WhiteCard, type ColorStage } from '../parts/practicalware'
import { useGearStep } from './useGearStep'

const Z = -0.08
const XS = [-0.15, -0.05, 0.05, 0.15] as const
const TUBE_Y = 0.012
const LEVEL0 = 0.036
const PPE: V3 = [0.32, 0, 0.14]
const BZ = 0.13
const CL_X = -0.3
const BR_X = -0.12
const ST_X = 0.06

/** Цвета растворов (как в пробирке на просвет). */
const C = {
  colorless: '#eef6ff',
  chlorineWater: '#e6f0b8',
  bromineWater: '#f2b552',
  br2: '#eea13c', // Br₂ в воде — жёлто-оранжевый
  i2: '#a9611c', // I₂ в растворе NaI — жёлто-бурый
  i2dark: '#8a4a14', // бурый
  nacl: '#f4dc8e', // бледно-жёлтый: только цвет бромной воды
  starchBlue: '#1b2a86', // крахмал + I₂ — тёмно-синий
  starch: '#f5f3ec',
} as const

const TUBES: readonly { x: number; tag: string; stages: readonly ColorStage[] }[] = [
  { x: XS[0], tag: 'NaBr', stages: [[1.42, 1.98, C.br2]] },
  { x: XS[1], tag: 'NaI', stages: [[2.42, 2.98, C.i2], [5.42, 5.95, C.starchBlue]] },
  { x: XS[2], tag: 'NaI', stages: [[3.42, 3.98, C.i2dark]] },
  { x: XS[3], tag: 'NaCl', stages: [[4.42, 4.95, C.nacl]] },
]

/** Пипетка: в своей склянке → над пробиркой (на шагах uses) → капли → обратно. Начало — кончик. */
function pipettePose(bx: number, uses: readonly (readonly [number, number])[]) {
  return (p: number) => {
    const rest: V3 = [bx, 0.034, BZ]
    let pos: V3 = rest
    let squeeze = 0
    for (const [s, tx] of uses) {
      const lifted: V3 = [bx, 0.2, BZ]
      const above: V3 = [tx, 0.2, Z]
      const drip: V3 = [tx, TUBE_Y + TUBE_H + 0.016, Z]
      let q = mixV(pos, lifted, ease(p, s, s + 0.12))
      q = mixV(q, above, ease(p, s + 0.1, s + 0.24))
      q = mixV(q, drip, ease(p, s + 0.22, s + 0.3))
      q = mixV(q, above, ease(p, s + 0.58, s + 0.66))
      q = mixV(q, lifted, ease(p, s + 0.64, s + 0.82))
      q = mixV(q, rest, ease(p, s + 0.8, s + 0.98))
      pos = q
      squeeze = Math.max(squeeze, hill(p, s + 0.3, s + 0.56, 0.3))
    }
    return { pos, squeeze }
  }
}

function DropperSet({ bx, label, color, amber, uses, target }: { bx: number; label: string; color: string; amber?: boolean; uses: readonly (readonly [number, number])[]; target: string }) {
  const pose = pipettePose(bx, uses)
  const squeeze: PFn = (p) => pose(p).squeeze
  return (
    <>
      <group position={[bx, 0, BZ]}>
        <DropperBottle color={color} label={label} amber={amber} />
        <Target name={target} size={[0.05, 0.12, 0.05]} center={[0, 0.06, 0]} hintY={0.15} />
      </group>
      <Pose pose={(p) => ({ pos: pose(p).pos })}>
        <Pipette color={color} squeeze={squeeze} />
      </Pose>
      {uses.map(([s, tx]) => {
        const tube = TUBES.find((t) => t.x === tx)
        const lvl = tube ? levelOf(tube.stages) : () => LEVEL0
        return <Falling key={s} from={[tx, TUBE_Y + TUBE_H + 0.014, Z]} toY={(p) => TUBE_Y + lvl(p)} a={s + 0.31} b={s + 0.55} n={4} color={color} size={0.0021} />
      })}
    </>
  )
}

function levelOf(stages: readonly ColorStage[]): PFn {
  return (p) => LEVEL0 + stages.reduce((acc, s) => acc + 0.011 * ease(p, s[0] - 0.1, s[0] + 0.15), 0)
}

export function HalogensRig() {
  useGearStep('halogens', 0)
  useSoundAt(0.2, 'click', PPE, 0.5)
  useSoundAt(1.32, 'splash', [XS[0], 0.17, Z], 0.25)
  useSoundAt(2.32, 'splash', [XS[1], 0.17, Z], 0.25)
  useSoundAt(3.32, 'splash', [XS[2], 0.17, Z], 0.25)
  useSoundAt(4.32, 'splash', [XS[3], 0.17, Z], 0.25)
  useSoundAt(5.32, 'splash', [XS[1], 0.17, Z], 0.25)
  useSoundAt(1.98, 'success', [XS[0], 0.12, Z], 0.25)
  useSoundAt(5.95, 'success', [XS[1], 0.12, Z], 0.35)
  useSoundAt(6.15, 'glass-clink', [0, 0.1, Z], 0.5)
  useSoundAt(6.9, 'success', [0, 0.2, Z], 0.6)

  return (
    <group>
      {/* Средства защиты */}
      <group position={PPE as unknown as THREE.Vector3Tuple}>
        <PpeTray worn={(p) => ease(p, 0, 0.95)} />
        <Target name="ppe" size={[0.16, 0.05, 0.1]} center={[0, 0.02, 0]} hintY={0.08} />
      </group>

      {/* Штатив с четырьмя пробирками; на шаге сравнения пробирки чуть поднимаются, за ними — белый лист */}
      <group position={[0, 0, Z]}>
        <TubeRack xs={XS} />
        <Target name="rack" size={[0.38, 0.12, 0.08]} center={[0, 0.07, 0]} hintY={0.21} />
      </group>
      {TUBES.map((tb, i) => (
        <Pose key={i} pose={() => ({ pos: [tb.x, TUBE_Y, Z] })}>
          <ColorTube base={C.colorless} stages={tb.stages} level={levelOf(tb.stages)} />
          <group position={[0, 0.1, 0]}>
            <TubeTag text={tb.tag} />
          </group>
        </Pose>
      ))}
      {/* белая карточка на ножках стоит за штативом — окраски видно на белом (не висит в воздухе) */}
      <group position={[0, 0, Z - 0.046]}>
        <WhiteCard w={0.4} />
      </group>

      {/* Пипетки-капельницы */}
      <DropperSet bx={CL_X} label="Cl₂ (aq)" color={C.chlorineWater} target="cl-water" uses={[[1, XS[0]], [2, XS[1]]]} />
      <DropperSet bx={BR_X} label="Br₂ (aq)" color={C.bromineWater} amber target="br-water" uses={[[3, XS[2]], [4, XS[3]]]} />
      <DropperSet bx={ST_X} label="(C₆H₁₀O₅)ₙ" color={C.starch} target="starch" uses={[[5, XS[1]]]} />
      {/* лёгкий пар брома над склянкой — по ТБ работаем под тягой */}
      <Pose pose={(p) => ({ pos: [BR_X, 0.07, BZ], scale: mix(0.6, 1, hill(p, 3, 5, 0.1)) })}>
        <mesh>
          <sphereGeometry args={[0.012, 12, 8]} />
          <meshBasicMaterial color={C.bromineWater} transparent opacity={0.06} depthWrite={false} />
        </mesh>
      </Pose>
    </group>
  )
}
