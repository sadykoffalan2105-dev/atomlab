import { useCallback } from 'react'
import * as THREE from 'three'
import type { BondPool } from '../../core/pools'
import { commitPool, cpkHex, writeAtom } from '../kit/cpkAtoms'
import { drawElectron, FX_COLOR } from '../kit/electronFx'
import { resetBondVisuals, writeBondVisual } from '../kit/bondVisual'
import { setCellEdgesAmount, writeCellEdges, type EdgePool } from '../kit/lattice'
import { materialFor } from '../kit/materials'
import { drawValenceCloud } from '../kit/valence'
import { buildSceneWorld, localizeSceneLabels, setGlow, toSceneLocale, useSceneRuntime, type SceneWorld } from '../kit/sceneKit'
import { useLocale } from '../../../../i18n/useLocale'
import { SceneShell, type SceneFrameCtx } from '../kit/SceneShell'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import {
  createPboFrame,
  LITH_FRAG,
  MASS_FRAG,
  METAL_BONDS,
  METAL_FRAG,
  PBO_ATOM_INDEX,
  PBO_ATOMS,
  PBO_DIM_A_DROP,
  PBO_EDGE_A,
  PBO_GAP,
  PBO_LONE_DIR,
  PBO_METAL_OFFSET,
  PBO_PHASE_TINT,
  PBO_PYRAMID,
  PBO_TINT_BOX,
  PBO_TIMING,
  samplePboFrame,
  validatePboStoryboard,
  type PboCueId,
  type PboFrame,
  type PboStepId,
  type PboValence,
} from './pboStoryboard'
import { validatePboEnergetics } from './pboEnergetics'

/**
 * Урок «оксид свинца(II)»: 2 Pb (тв.) + O₂ (г.) → 2 PbO (тв.), шесть шагов (рецепт эталона nacl).
 *
 * Здесь только РЕНДЕР кадра: часы по шагам, контракт лаборатории embryo → birth → complete,
 * камеру, прогрев и подписи делает SceneShell. Раскадровка — pboStoryboard.ts, энергия —
 * pboEnergetics.ts, тексты — pboMechanismText.*.
 *
 * Слои кадра (все из kit, ни одного числа химии):
 *   атомы (материал: metal → gas → ion), двойная связь O=O (σ + π-лепестки), металлические нити ГЦК,
 *   рёбра ячеек (свинец → массикот → глёт), валентные точки (у Pb пара 6s² отдельно от 6p),
 *   электроны со следом, пары 6s² глёта, пунктир пирамиды PbO₄ и щели Pb···Pb.
 *   Огня, дыма, ореолов и волн нет — свет только сценический.
 */

/** Ореол летящего электрона — единственное свечение сцены (цвет эффекта, не химия). */
const ELECTRON_HALO = 0x9ee4ff
const O_COLOR = cpkHex('O')

const ATOM_COLOR: readonly number[] = PBO_ATOMS.map((a) => cpkHex(a.el))
const I_PB1 = PBO_ATOM_INDEX.get('pb1')!
const I_OA = PBO_ATOM_INDEX.get('oA')!
const I_OB = PBO_ATOM_INDEX.get('oB')!
const METAL_BOND_INDEX: readonly (readonly [number, number])[] = METAL_BONDS.map(([a, b]) => [PBO_ATOM_INDEX.get(a)!, PBO_ATOM_INDEX.get(b)!] as const)
/** Слоты пула связей: 0 — O=O, дальше металлические нити. */
const BOND_SLOTS = 1 + METAL_BOND_INDEX.length
const ZERO_OFFSET = [0, 0, 0] as const
const EDGE_CAPACITY = Math.max(METAL_FRAG.cellEdges.length, MASS_FRAG.cellEdges.length, LITH_FRAG.cellEdges.length)
const EDGE_DIM_ON_FADE = 0.6
/** Нормаль π-связи O=O: лепестки в плоскости экрана (камера шага 1 смотрит вдоль −z). */
const PI_NORMAL = new THREE.Vector3(1, 0, 0)
/** Валентные точки — кольцом Льюиса в плоскости экрана (камера шагов 2–3 смотрит вдоль −z). */
const FACING = new THREE.Vector3(0, 0, 1)
/** Размерные и пунктирные линии: светлые точки (цвет подписи-размера). */
const DIM_COLOR = [0.78, 0.92, 1] as const
const DIM_SIZE = 0.034
const DOT_SIZE = 0.085
/** Раскладка точек Pb в плоскости экрана: пара ns² слева (от O), np — справа под ±60° (параметры рисунка). */
const S_ANGLE = Math.PI
const P_ANGLE = Math.PI / 3
const PAIR_SPLIT = 0.24
/** Пары 6s² глёта: отступ пары от поверхности иона и разнос двух точек, мировые единицы. */
const LONE_GAP = 0.07
const LONE_SPLIT = 0.05
const LONE_ATOMS: readonly number[] = PBO_ATOMS.map((_, i) => i).filter((i) => PBO_LONE_DIR[i] !== 0)
const PYR_BASE: readonly number[] = PBO_PYRAMID.base.map((id) => PBO_ATOM_INDEX.get(id)!)
const PYR_EDGES: readonly (readonly [number, number])[] = PBO_PYRAMID.baseEdges.map(([a, b]) => [PBO_ATOM_INDEX.get(a)!, PBO_ATOM_INDEX.get(b)!] as const)
const I_GAP_A = PBO_ATOM_INDEX.get(PBO_GAP.a)!
const I_GAP_B = PBO_ATOM_INDEX.get(PBO_GAP.b)!
const _da = new THREE.Vector3()
const _db = new THREE.Vector3()

/**
 * Рамка цвета вещества (PBO_PHASE_TINT): 12 рёбер габарита фрагмента, вынесенных наружу на долю
 * размера, мягкими точками. Шары остаются CPK — рамка говорит «глёт красный, массикот жёлтый».
 */
const TINT_MARGIN = 0.06
const TINT_DOTS = 7
const TINT_SIZE = 0.05
function tintRgb(hex: number): readonly [number, number, number] {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255] as const
}
const TINT_RGB = { massicot: tintRgb(PBO_PHASE_TINT.massicot), litharge: tintRgb(PBO_PHASE_TINT.litharge) } as const
/** Рёбра габарита: пары вершин куба по битам (x, y, z), отличающихся одним битом. */
const BOX_EDGES: readonly (readonly [number, number])[] = (() => {
  const out: [number, number][] = []
  for (let a = 0; a < 8; a++) for (let bit = 1; bit < 8; bit <<= 1) if (!(a & bit)) out.push([a, a | bit])
  return out
})()
function tintCorners(phase: keyof typeof PBO_TINT_BOX): THREE.Vector3[] {
  const { min, max } = PBO_TINT_BOX[phase]
  const pad = [0, 1, 2].map((k) => (max[k]! - min[k]!) * TINT_MARGIN)
  return Array.from({ length: 8 }, (_, c) =>
    new THREE.Vector3(
      c & 1 ? max[0] + pad[0]! : min[0] - pad[0]!,
      c & 2 ? max[1] + pad[1]! : min[1] - pad[1]!,
      c & 4 ? max[2] + pad[2]! : min[2] - pad[2]!,
    ),
  )
}
const TINT_CORNERS = { massicot: tintCorners('massicot'), litharge: tintCorners('litharge') } as const

function createPboWorld() {
  return buildSceneWorld({
    atoms: PBO_ATOMS.length,
    bonds: BOND_SLOTS,
    lobes: 4,
    edges: EDGE_CAPACITY,
    glows: [
      { id: 'e1', color: ELECTRON_HALO, radius: 0.3 },
      { id: 'e2', color: ELECTRON_HALO, radius: 0.3 },
      { id: 'e3', color: ELECTRON_HALO, radius: 0.3 },
      { id: 'e4', color: ELECTRON_HALO, radius: 0.3 },
    ] as const,
  })
}

/** Какой набор рёбер сейчас лежит в пуле: переписываем только при смене (без аллокаций в кадре). */
type EdgeSync = { set: PboFrame['edgeSet'] | '' }

function syncEdges(pool: EdgePool | undefined, sync: EdgeSync, frame: PboFrame): void {
  if (!pool) return
  if (sync.set !== frame.edgeSet) {
    if (frame.edgeSet === 'metal') writeCellEdges(pool, METAL_FRAG.cellEdges, PBO_METAL_OFFSET)
    else if (frame.edgeSet === 'massicot') writeCellEdges(pool, MASS_FRAG.cellEdges, ZERO_OFFSET)
    else writeCellEdges(pool, LITH_FRAG.cellEdges, ZERO_OFFSET)
    sync.set = frame.edgeSet
  }
  setCellEdgesAmount(pool, frame.edges * (1 - frame.fade * EDGE_DIM_ON_FADE))
}

export function PboCinemaScene(props: ScientificSynthesisFxProps) {
  // Мир и буфер кадра создаются один раз на прогон и дальше пишутся каждый кадр.
  const { world, frame, edgeSync } = useSceneRuntime(() => ({
    world: createPboWorld(),
    frame: createPboFrame(),
    edgeSync: { set: '' } as EdgeSync,
  }))

  const sceneLocale = toSceneLocale(useLocale().locale)

  const validate = useCallback(() => {
    validatePboStoryboard()
    validatePboEnergetics()
  }, [])

  // onFrame НЕ мемоизируем: SceneShell зовёт его из useFrame (см. kit/README, «Три правила»).
  const onFrame = (ctx: SceneFrameCtx) => {
    samplePboFrame(ctx.t, frame)
    // Числа 3D по локали: «232,1 пм» на ru/uz — как в панели урока.
    localizeSceneLabels(frame.labels, sceneLocale, true)
    resetBondVisuals(world)
    writeAtoms(world, frame)
    writeBonds(world, frame)
    drawPoints(ctx, frame)
    syncEdges(world.edges, edgeSync, frame)
    for (let e = 0; e < 4; e++) {
      const el = frame.electrons[e]!
      setGlow(world, GLOW_IDS[e]!, el.pos, el.opacity * el.glow * 0.8)
    }
    copyCamera(ctx, frame)
  }

  return (
    <SceneShell<PboStepId, PboCueId>
      {...props}
      lesson="pbo"
      timing={PBO_TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      validate={validate}
      rigScale={1.15}
      glowPointsCapacity={360}
      debugName="pbo"
    />
  )
}

const GLOW_IDS = ['e1', 'e2', 'e3', 'e4'] as const

function copyCamera(ctx: SceneFrameCtx, frame: PboFrame): void {
  const cam = ctx.camera
  const src = frame.camera
  cam.zoom = src.zoom
  cam.offset.copy(src.offset)
  cam.yaw = src.yaw
  cam.pitch = src.pitch
  cam.roll = src.roll
  cam.shake = src.shake
  cam.bloom = src.bloom
  cam.vignette = src.vignette
}

// ─────────────────────────────────────────────────────────────────────────────
// Запись кадра в пулы
// ─────────────────────────────────────────────────────────────────────────────

function writeAtoms(world: SceneWorld, frame: PboFrame): void {
  const dim = 1 - frame.fade * 0.6
  for (let i = 0; i < PBO_ATOMS.length; i++) {
    writeAtom(world.atoms, i, {
      pos: frame.pos[i]!,
      radius: frame.radius[i]!,
      colorHex: ATOM_COLOR[i]!,
      charge: frame.charge[i]! * 0.5,
      emissive: frame.emissive[i]!,
      opacity: frame.opacity[i]! * dim,
      surface: materialFor(frame.material[i]!),
    })
  }
  commitPool(world.atoms, PBO_ATOMS.length)
}

/** Натяжение и истончение перед ГОМОЛИТИЧЕСКИМ разрывом (split = 0) поверх вида связи. */
function applyBondStress(pool: BondPool, i: number, stress: number, thinning: number): void {
  pool.stress[i] = stress
  pool.thinning[i] = thinning
  pool.split[i] = 0
}

function writeBonds(world: SceneWorld, frame: PboFrame): void {
  // 0 — двойная связь O=O: σ-трубка + π-лепестки, затем симметричный разрыв.
  const amt = frame.bond.opacity * frame.opacity[I_OA]!
  writeBondVisual(world, 0, frame.pos[I_OA]!, frame.pos[I_OB]!, 'double', 2, amt, PI_NORMAL, { colorA: O_COLOR, colorB: O_COLOR })
  applyBondStress(world.bonds, 0, frame.bond.stress, frame.bond.thinning)
  // Металлическая связь: соседи ГЦК на a/√2 (КЧ 12), бледные нити.
  for (let k = 0; k < METAL_BOND_INDEX.length; k++) {
    const [a, b] = METAL_BOND_INDEX[k]!
    const m = frame.metalBond * Math.min(frame.opacity[a]!, frame.opacity[b]!)
    writeBondVisual(world, 1 + k, frame.pos[a]!, frame.pos[b]!, 'metallic', 1, m)
  }
  commitPool(world.bonds, BOND_SLOTS)
}

type Gp = NonNullable<SceneFrameCtx['points']>

function drawPoints(ctx: SceneFrameCtx, frame: PboFrame): void {
  const gp = ctx.points
  if (!gp) return
  const elapsed = ctx.elapsed
  const live = 1 - frame.fade
  gp.begin()

  // Валентные электроны: у Pb пара 6s² и 6p-электроны отдельно, у O — кольцо Льюиса.
  drawPbValence(gp, frame.valence[0], live, elapsed)
  drawPbValence(gp, frame.valence[1], live, elapsed)
  for (let k = 2; k < 4; k++) {
    const v = frame.valence[k]!
    drawValenceCloud(gp, v.center, v.radius, v.count, v.amount * live, elapsed, { highlight: v.highlight, facing: FACING })
  }

  // Глёт: пары 6s² смотрят в щель между слоями.
  const lp = frame.fx.lonePairs * live
  if (lp > 0.01) {
    const [r, g, b] = FX_COLOR.shell
    for (let n = 0; n < LONE_ATOMS.length; n++) {
      const i = LONE_ATOMS[n]!
      const a = lp * frame.opacity[i]!
      if (a <= 0.01) continue
      const p = frame.pos[i]!
      const y = p.y + PBO_LONE_DIR[i]! * (frame.radius[i]! + LONE_GAP)
      gp.push(p.x - LONE_SPLIT, y, p.z, DOT_SIZE * 0.8, r, g, b, a * 0.85, 0.45)
      gp.push(p.x + LONE_SPLIT, y, p.z, DOT_SIZE * 0.8, r, g, b, a * 0.85, 0.45)
    }
  }

  // Пирамида PbO₄ атома pb1: рёбра от вершины к четырём O и стороны квадрата основания.
  const pyr = frame.fx.pyramid * live
  if (pyr > 0.01) {
    for (let n = 0; n < PYR_BASE.length; n++) drawDotted(gp, frame.pos[I_PB1]!, frame.pos[PYR_BASE[n]!]!, 9, pyr)
    for (let n = 0; n < PYR_EDGES.length; n++) {
      const [a, b] = PYR_EDGES[n]!
      drawDotted(gp, frame.pos[a]!, frame.pos[b]!, 9, pyr * 0.7)
    }
  }

  // Щель Pb···Pb между слоями — пунктир перед сферами.
  const gap = frame.fx.gap * live
  if (gap > 0.01) {
    _da.copy(frame.pos[I_GAP_A]!)
    _db.copy(frame.pos[I_GAP_B]!)
    _da.z += 0.12
    _db.z += 0.12
    drawDotted(gp, _da, _db, 11, gap)
  }

  // Размерная линия a под нижним передним ребром ячейки глёта, с засечками на концах.
  if (frame.dims.edgeA > 0.01) {
    const [p, q] = PBO_EDGE_A
    _da.set(p[0], p[1] - PBO_DIM_A_DROP, p[2])
    _db.set(q[0], q[1] - PBO_DIM_A_DROP, q[2])
    drawDotted(gp, _da, _db, 11, frame.dims.edgeA)
    drawTick(gp, _da, frame.dims.edgeA)
    drawTick(gp, _db, frame.dims.edgeA)
  }

  // Цвет вещества: рамка вокруг фрагмента модификации (в финале остаётся, притушенная как рёбра).
  const tint = frame.tint
  if (tint.phase !== 'none' && tint.amount > 0.01) {
    const [r, g, b] = TINT_RGB[tint.phase]
    const corners = TINT_CORNERS[tint.phase]
    const a = tint.amount * (1 - frame.fade * EDGE_DIM_ON_FADE) * 0.55
    for (let n = 0; n < BOX_EDGES.length; n++) {
      const [p, q] = BOX_EDGES[n]!
      const cp = corners[p]!
      const cq = corners[q]!
      for (let k = 0; k < TINT_DOTS; k++) {
        const u = k / (TINT_DOTS - 1)
        gp.push(cp.x + (cq.x - cp.x) * u, cp.y + (cq.y - cp.y) * u, cp.z + (cq.z - cp.z) * u, TINT_SIZE, r, g, b, a, 0.5)
      }
    }
  }

  for (let e = 0; e < 4; e++) drawElectron(gp, frame.electrons[e]!, elapsed)
  gp.end()
}

/**
 * Валентные точки Pb в плоскости экрана: первые sPair точек — пара ns² (слева, от кислорода),
 * остальные — np-электроны поодиночке справа (их и отдаёт атом). Число точек — из кадра (ядро).
 */
function drawPbValence(gp: Gp, v: PboValence, live: number, elapsed: number): void {
  const amount = v.amount * live
  if (amount <= 0.01 || v.count <= 0) return
  const [r, g, b] = FX_COLOR.shell
  const rad = v.radius
  const lift = rad * 0.15
  for (let k = 0; k < v.count; k++) {
    let ang: number
    if (k < v.sPair) ang = S_ANGLE + (k === 0 ? -PAIR_SPLIT : PAIR_SPLIT)
    else ang = (k - v.sPair) % 2 === 0 ? P_ANGLE : -P_ANGLE
    const flick = 0.88 + 0.12 * Math.sin(elapsed * 3.1 + k * 1.7)
    gp.push(v.center.x + Math.cos(ang) * rad, v.center.y + Math.sin(ang) * rad, v.center.z + lift, DOT_SIZE, r, g, b, amount * flick * 0.85, 0.45)
  }
}

/** Пунктир от a до b (точки). Без аллокаций. */
function drawDotted(gp: Gp, a: THREE.Vector3, b: THREE.Vector3, dots: number, amount: number): void {
  const [r, g, bl] = DIM_COLOR
  for (let k = 0; k < dots; k++) {
    const u = k / (dots - 1)
    gp.push(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u, DIM_SIZE, r, g, bl, amount * 0.9, 0.35)
  }
}

/** Вертикальная засечка размерной линии. */
function drawTick(gp: Gp, e: THREE.Vector3, amount: number): void {
  const [r, g, bl] = DIM_COLOR
  gp.push(e.x, e.y + 0.09, e.z, DIM_SIZE, r, g, bl, amount * 0.9, 0.35)
  gp.push(e.x, e.y - 0.09, e.z, DIM_SIZE, r, g, bl, amount * 0.9, 0.35)
}
