/**
 * Kimyo 7, § 1.6 (с. 24–25): практическое занятие «Очистка загрязнённой поваренной соли».
 * Шаги: 0 соль в воду · 1 перемешать палочкой · 2 сложить фильтр · 3 фильтр в воронку · 4 фильтрование по палочке ·
 * 5 фильтрат в фарфоровую чашку · 6 зажечь спиртовку · 7 выпаривание с перемешиванием (кристаллы по краям) ·
 * 8 потушить колпачком.
 */
import * as THREE from 'three'
import { Pose, Target, ease, hill, mix, mixV, useRig, useSoundAt, type PFn, type V3 } from '../rigCore'
import { PourStream } from '../parts/effects'
import { BEAKER_R, Beaker, WatchGlass } from '../parts/glassware'
import { Match, Matchbox, SpiritLamp } from '../parts/fire'
import { FILTER_CONE, FUNNEL, Falling, FilterPaper, Funnel, GlassRod, LiquidColumn, PorcelainDish, Puffs, RingStand } from '../parts/practicalware'

const BM: V3 = [-0.36, 0, 0.06] // стакан со смесью
const WG: V3 = [-0.52, 0, 0.17] // часовое стекло с загрязнённой солью
const ROD_REST: V3 = [-0.3, 0.003, 0.19]
const FUN: V3 = [-0.02, 0.17, -0.12] // вершина конуса воронки
const FB: V3 = [-0.012, 0, -0.12] // стакан для фильтрата
const PAPER: V3 = [-0.18, 0, 0.19]
const DISH: V3 = [0.34, 0.124, -0.06]
const LAMP: V3 = [0.34, 0, -0.06]
const LAMP_FLAME_Y = 0.081
const MATCHBOX: V3 = [0.5, 0, 0.16]
const DROD_REST: V3 = [0.16, 0.003, 0.12]
const WATER = 0.028

const mixLevel: PFn = (p) => WATER * (1 - 0.9 * ease(p, 4.42, 4.85))
const mixCloud: PFn = (p) => 0.62 * ease(p, 0.45, 0.85) * (1 - 0.15 * ease(p, 1.3, 1.9))
const filtrateLevel: PFn = (p) => 0.024 * ease(p, 4.5, 5) * (1 - 0.9 * ease(p, 5.45, 5.8))
const dishLevel: PFn = (p) => 0.016 * ease(p, 5.45, 5.8) * (1 - 0.92 * ease(p, 7.1, 7.92))
const lampFlame: PFn = (p) => ease(p, 6.5, 6.7) * (1 - ease(p, 8.62, 8.72))
const boil: PFn = (p) => ease(p, 6.9, 7.1) * (1 - ease(p, 7.85, 8))
const steam: PFn = (p) => ease(p, 6.75, 7.05) * (1 - ease(p, 8.55, 8.95))

/** Стакан со смесью: стоит → (шаг 4) над воронкой, наклон к палочке → обратно. */
function mixBeakerPose(p: number) {
  const rest: V3 = BM
  const lifted: V3 = [BM[0], 0.2, BM[2]]
  const pour: V3 = [FUN[0] + 0.008 - 0.0763, 0.266, FUN[2]]
  let pos = mixV(rest, lifted, ease(p, 4, 4.15))
  pos = mixV(pos, pour, ease(p, 4.12, 4.38))
  pos = mixV(pos, lifted, ease(p, 4.86, 4.96))
  pos = mixV(pos, rest, ease(p, 4.94, 5))
  const tilt = ease(p, 4.3, 4.45) * (1 - ease(p, 4.82, 4.92))
  return { pos, rot: [0, 0, -1.3 * tilt] as V3 }
}

/** Стакан с фильтратом → к фарфоровой чашке, наклон → обратно. */
function filtrateBeakerPose(p: number) {
  const rest: V3 = FB
  const lifted: V3 = [FB[0], 0.2, FB[2]]
  const pour: V3 = [DISH[0] - 0.02 - 0.0763, DISH[1] + 0.075, DISH[2]]
  let pos = mixV(rest, lifted, ease(p, 5, 5.15))
  pos = mixV(pos, pour, ease(p, 5.12, 5.35))
  pos = mixV(pos, lifted, ease(p, 5.82, 5.93))
  pos = mixV(pos, rest, ease(p, 5.92, 6))
  const tilt = ease(p, 5.32, 5.45) * (1 - ease(p, 5.78, 5.88))
  return { pos, rot: [0, 0, -1.3 * tilt] as V3 }
}

/** Палочка: на столе → мешает в стакане (шаг 1) → прижата к фильтру (шаг 4) → на столе. */
function rodPose(p: number) {
  const restRot: V3 = [0, 0, -Math.PI / 2]
  const lifted: V3 = [ROD_REST[0], 0.24, ROD_REST[2]]
  const inBeaker: V3 = [BM[0] + 0.003, 0.006, BM[2]]
  const atFilter: V3 = [FUN[0] + 0.008, FUN[1] + 0.02, FUN[2]]
  let pos = mixV(ROD_REST, lifted, ease(p, 1, 1.15))
  pos = mixV(pos, [BM[0], 0.22, BM[2]], ease(p, 1.12, 1.28))
  pos = mixV(pos, inBeaker, ease(p, 1.26, 1.36))
  // круговое перемешивание
  const stir = ease(p, 1.34, 1.4) * (1 - ease(p, 1.84, 1.9))
  const ang = (p - 1.3) * Math.PI * 2 * 5
  // радиус круга — чтобы наклонённая палочка не заходила в стенку стакана
  pos = [pos[0] + Math.cos(ang) * 0.008 * stir, pos[1], pos[2] + Math.sin(ang) * 0.008 * stir]
  pos = mixV(pos, lifted, ease(p, 1.88, 1.96))
  pos = mixV(pos, ROD_REST, ease(p, 1.95, 2))
  // шаг 4 — палочка у фильтра
  pos = mixV(pos, [atFilter[0], 0.3, atFilter[2]], ease(p, 4, 4.16))
  pos = mixV(pos, atFilter, ease(p, 4.14, 4.28))
  pos = mixV(pos, [atFilter[0], 0.3, atFilter[2]], ease(p, 4.86, 4.94))
  pos = mixV(pos, ROD_REST, ease(p, 4.93, 5))
  const upright = (ease(p, 1, 1.2) * (1 - ease(p, 1.9, 2))) + ease(p, 4, 4.14) * (1 - ease(p, 4.9, 5))
  const lean = 0.12 * stir // наклон палочки — верх не упирается в стенку стакана
  return { pos, rot: [0, 0, mix(restRot[2], -lean, upright)] as V3 }
}

/** Палочка у чашки: на столе → мешает раствор в чашке (шаг 7) → на столе. */
function dishRodPose(p: number) {
  const lifted: V3 = [DROD_REST[0], 0.3, DROD_REST[2]]
  const inDish: V3 = [DISH[0], DISH[1] + 0.004, DISH[2]]
  let pos = mixV(DROD_REST, lifted, ease(p, 7, 7.12))
  pos = mixV(pos, [DISH[0], 0.3, DISH[2]], ease(p, 7.1, 7.22))
  pos = mixV(pos, inDish, ease(p, 7.2, 7.3))
  const stir = ease(p, 7.28, 7.34) * (1 - ease(p, 7.84, 7.9))
  const ang = (p - 7.2) * Math.PI * 2 * 6
  pos = [pos[0] + Math.cos(ang) * 0.018 * stir, pos[1], pos[2] + Math.sin(ang) * 0.018 * stir]
  pos = mixV(pos, lifted, ease(p, 7.88, 7.95))
  pos = mixV(pos, DROD_REST, ease(p, 7.94, 8))
  const upright = ease(p, 7, 7.2) * (1 - ease(p, 7.9, 8))
  return { pos, rot: [0, 0, mix(-Math.PI / 2, -0.35 * stir, upright)] as V3 }
}

export function SaltPurifyRig() {
  const { quality } = useRig()
  useSoundAt(0.42, 'pour', [BM[0], 0.1, BM[2]])
  useSoundAt(0.96, 'glass-place', WG)
  useSoundAt(1.36, 'glass-clink', [BM[0], 0.04, BM[2]], 0.6)
  useSoundAt(1.6, 'glass-clink', [BM[0], 0.04, BM[2]], 0.5)
  useSoundAt(3.9, 'click', [FUN[0], 0.2, FUN[2]], 0.5)
  useSoundAt(4.42, 'pour', [FUN[0], 0.22, FUN[2]])
  useSoundAt(4.55, 'splash', [FB[0], 0.06, FB[2]], 0.4)
  useSoundAt(4.98, 'glass-place', BM)
  useSoundAt(5.45, 'pour', [DISH[0], 0.16, DISH[2]])
  useSoundAt(5.98, 'glass-place', FB)
  useSoundAt(6.45, 'flame-on', [LAMP[0], 0.09, LAMP[2]])
  useSoundAt(6.7, 'flame-loop', [LAMP[0], 0.09, LAMP[2]], 0.5)
  useSoundAt(7.05, 'bubble', [DISH[0], 0.14, DISH[2]], 0.6)
  useSoundAt(7.5, 'sizzle', [DISH[0], 0.14, DISH[2]], 0.6)
  useSoundAt(8.6, 'click', [LAMP[0], 0.08, LAMP[2]])
  useSoundAt(8.97, 'success', [DISH[0], 0.2, DISH[2]], 0.6)
  const grains = quality === 'high' ? 26 : 14

  return (
    <group>
      {/* Стакан с 20 мл дистиллированной воды; после соли — мутный раствор, песок на дне */}
      <Pose pose={mixBeakerPose}>
        <Beaker>
          <LiquidColumn r={BEAKER_R * 0.9} level={mixLevel} color="#e6f3ff" cloud={mixCloud} />
          {/* нерастворившиеся кристаллы соли на дне (исчезают при перемешивании) */}
          <Pose pose={(p) => ({ pos: [0.004, 0.003, 0], scale: ease(p, 0.55, 0.85) * (1 - ease(p, 1.35, 1.88)) })}>
            <mesh scale={[0.012, 0.004, 0.012]}>
              <sphereGeometry args={[1, 12, 8]} />
              <meshStandardMaterial color="#ffffff" roughness={0.5} />
            </mesh>
          </Pose>
          {/* песок: оседает на дно, при фильтровании уходит со струёй */}
          <Pose pose={(p) => ({ pos: [-0.005, 0.0025, 0.003], scale: ease(p, 0.6, 0.95) * (1 - ease(p, 4.45, 4.8)) })}>
            <mesh scale={[0.014, 0.0025, 0.012]}>
              <sphereGeometry args={[1, 12, 8]} />
              <meshStandardMaterial color="#a88a5c" roughness={1} />
            </mesh>
          </Pose>
        </Beaker>
        <Target name="beaker-mix" size={[0.065, 0.085, 0.065]} center={[0, 0.04, 0]} hintY={0.11} />
      </Pose>

      {/* Часовое стекло с загрязнённой солью → над стаканом, наклон */}
      <Pose
        pose={(p) => {
          const lifted: V3 = [WG[0], 0.2, WG[2]]
          const over: V3 = [BM[0] - 0.035, 0.13, BM[2]]
          let pos = mixV(WG, lifted, ease(p, 0, 0.18))
          pos = mixV(pos, over, ease(p, 0.16, 0.36))
          pos = mixV(pos, lifted, ease(p, 0.78, 0.9))
          pos = mixV(pos, WG, ease(p, 0.88, 1))
          const tilt = ease(p, 0.34, 0.45) * (1 - ease(p, 0.72, 0.82))
          return { pos, rot: [0, 0, -0.9 * tilt] }
        }}
      >
        <WatchGlass />
        <Pose pose={(p) => ({ pos: [0, 0.006, 0], scale: 1 - ease(p, 0.4, 0.72) })}>
          <mesh scale={[0.024, 0.008, 0.024]}>
            <sphereGeometry args={[1, 14, 8]} />
            <meshStandardMaterial color="#efece4" roughness={0.9} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[Math.cos(i * 2.4) * 0.012, 0.006, Math.sin(i * 2.4) * 0.012]}>
              <boxGeometry args={[0.003, 0.002, 0.003]} />
              <meshStandardMaterial color="#8a6b45" roughness={1} />
            </mesh>
          ))}
        </Pose>
        <Target name="salt-dish" size={[0.09, 0.04, 0.09]} center={[0, 0.012, 0]} hintY={0.07} />
      </Pose>
      <Falling from={[BM[0] + 0.002, 0.11, BM[2]]} toY={(p) => 0.004 + mixLevel(p)} a={0.4} b={0.74} n={grains} color="#f3f1ea" size={0.0018} box jitter={0.012} />

      {/* Стеклянная палочка */}
      <Pose pose={rodPose}>
        <GlassRod length={0.2} />
      </Pose>
      <group position={[ROD_REST[0] + 0.1, 0, ROD_REST[2]]}>
        <Target name="stir-rod" size={[0.21, 0.03, 0.04]} center={[0, 0.006, 0]} hintY={0.05} />
      </group>
      <PourStream
        x={FUN[0] + 0.009}
        z={FUN[2]}
        top={() => 0.258}
        bottom={() => FUN[1] + 0.03}
        show={(p) => hill(p, 4.42, 4.84, 0.15)}
        color="#d9d0b8"
      />

      {/* Штатив с кольцом, воронка, стакан для фильтрата */}
      <group position={[0, 0, FUN[2]]}>
        <RingStand rodX={-0.14} ringX={FUN[0]} ringY={0.214} ringR={0.028} />
      </group>
      <group position={FUN as unknown as THREE.Vector3Tuple}>
        <Funnel />
      </group>
      <Falling from={[FUN[0], FUN[1] - FUNNEL.stem, FUN[2]]} toY={(p) => 0.003 + filtrateLevel(p)} a={4.5} b={4.98} n={12} color="#eaf6ff" size={0.0018} />
      <Pose pose={filtrateBeakerPose}>
        <Beaker>
          <LiquidColumn r={BEAKER_R * 0.9} level={filtrateLevel} color="#e8f4ff" />
        </Beaker>
        <Target name="beaker-filtrate" size={[0.065, 0.085, 0.065]} center={[0, 0.04, 0]} hintY={0.11} />
      </Pose>

      {/* Фильтровальная бумага: лист → вчетверо → конус → в воронку */}
      <Pose
        pose={(p) => {
          const lifted: V3 = [PAPER[0], 0.3, PAPER[2]]
          const above: V3 = [FUN[0], 0.3, FUN[2]]
          const inFunnel: V3 = [FUN[0], FUN[1] + 0.011, FUN[2]]
          let pos = mixV(PAPER, lifted, ease(p, 3, 3.3))
          pos = mixV(pos, above, ease(p, 3.25, 3.6))
          pos = mixV(pos, inFunnel, ease(p, 3.6, 3.9))
          return { pos }
        }}
      >
        <FilterPaper
          fold={(p) => ease(p, 2, 2.95)}
          wet={(p) => ease(p, 4.4, 4.62)}
          fill={(p) => 0.75 * ease(p, 4.42, 4.55) * (1 - ease(p, 4.84, 5))}
          dirt={(p) => ease(p, 4.45, 4.9)}
        />
        <Target name="filter" size={[0.08, 0.05, 0.08]} center={[0, FILTER_CONE.h / 2, 0]} hintY={0.075} />
      </Pose>

      {/* Второй штатив: кольцо с фарфоровой чашкой, под ней — спиртовка */}
      <group position={[0, 0, DISH[2]]}>
        <RingStand rodX={0.5} ringX={DISH[0]} ringY={DISH[1] + 0.006} ringR={0.0235} />
      </group>
      <group position={DISH as unknown as THREE.Vector3Tuple}>
        <PorcelainDish level={dishLevel} crystals={(p) => ease(p, 7.3, 7.96)} boil={boil} />
      </group>
      <Puffs origin={[DISH[0], DISH[1] + 0.02, DISH[2]]} rate={steam} count={28} rise={0.14} spread={0.025} drift={[0.01, 0, 0.02]} size={0.012} opacity={0.32} life={1.8} />

      <group position={LAMP as unknown as THREE.Vector3Tuple}>
        <SpiritLamp flame={lampFlame} capOff={(p) => ease(p, 6, 6.35) * (1 - ease(p, 8.25, 8.7))} />
        <Target name="spirit-lamp" size={[0.08, 0.1, 0.08]} center={[0, 0.045, 0]} hintY={0.12} />
        <group position={[0.075, 0, 0.012]}>
          <Target name="lamp-cap" size={[0.05, 0.05, 0.05]} center={[0, 0.02, 0]} hintY={0.07} />
        </group>
      </group>
      <group position={MATCHBOX as unknown as THREE.Vector3Tuple}>
        <Matchbox />
      </group>
      <Pose
        pose={(p) => {
          const rest: V3 = [MATCHBOX[0] - 0.025, 0.018, MATCHBOX[2]]
          const raised: V3 = [MATCHBOX[0] - 0.05, 0.09, MATCHBOX[2] - 0.05]
          const atWick: V3 = [LAMP[0] - 0.048, LAMP_FLAME_Y + 0.004, LAMP[2]]
          const dropped: V3 = [MATCHBOX[0] - 0.02, 0.002, MATCHBOX[2] + 0.035]
          let pos = mixV(rest, raised, ease(p, 6.3, 6.42))
          pos = mixV(pos, atWick, ease(p, 6.42, 6.6))
          pos = mixV(pos, dropped, ease(p, 6.8, 7))
          return { pos, rot: [0, mix(Math.PI, Math.PI + 0.4, ease(p, 6.8, 7)), 0] }
        }}
      >
        <Match lit={(p) => ease(p, 6.38, 6.46) * (1 - ease(p, 6.82, 6.95))} />
      </Pose>

      {/* Палочка для перемешивания в чашке */}
      <Pose pose={dishRodPose}>
        <GlassRod length={0.18} />
      </Pose>
      <group position={[DROD_REST[0] + 0.09, 0, DROD_REST[2]]}>
        <Target name="dish-rod" size={[0.19, 0.03, 0.04]} center={[0, 0.006, 0]} hintY={0.05} />
      </group>
    </group>
  )
}
