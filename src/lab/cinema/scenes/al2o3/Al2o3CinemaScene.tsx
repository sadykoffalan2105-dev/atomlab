import { useCallback } from 'react'
import * as THREE from 'three'
import { commitPool, cpkHex, writeAtom, writeBond } from '../kit/cpkAtoms'
import { drawElectron } from '../kit/electronFx'
import { resetBondVisuals, writeBondVisual } from '../kit/bondVisual'
import { setCellEdgesAmount, writeCellEdges, type EdgePool } from '../kit/lattice'
import { materialFor } from '../kit/materials'
import { drawValenceCloud } from '../kit/valence'
import { buildSceneWorld, localizeSceneLabels, toSceneLocale, useSceneRuntime, type SceneWorld } from '../kit/sceneKit'
import { useLocale } from '../../../../i18n/useLocale'
import { SceneShell, type SceneFrameCtx } from '../kit/SceneShell'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import {
  AL2O3_ATOM_INDEX,
  AL2O3_ATOMS,
  AL2O3_DIM_DROP,
  AL2O3_EDGE_A,
  AL2O3_EDGE_C,
  AL2O3_METAL_OFFSET,
  AL2O3_RIG_SCALE,
  AL2O3_TIMING,
  CORUNDUM_FRAG,
  createAl2o3Frame,
  FILM_DIM,
  METAL_BONDS,
  METAL_FRAG,
  O2_MOLECULES,
  OCTA,
  sampleAl2o3Frame,
  validateAl2o3Storyboard,
  type Al2o3CueId,
  type Al2o3Frame,
  type Al2o3StepId,
} from './al2o3Storyboard'
import { validateAl2o3Energetics } from './al2o3Energetics'

/**
 * Урок «горение алюминия»: 4 Al (тв.) + 3 O₂ (г.) → 2 Al₂O₃ (тв., корунд), шесть шагов.
 * Построен по рецепту эталона NaCl на наборе kit.
 *
 * Здесь только РЕНДЕР кадра: часы по шагам, контракт лаборатории embryo → birth → complete,
 * камеру, прогрев и подписи делает SceneShell. Раскадровка — al2o3Storyboard.ts, энергия —
 * al2o3Energetics.ts, тексты — al2o3MechanismText.*.
 *
 * Слои кадра (все из kit, ни одного числа химии):
 *   атомы (материал по веществу: metal → gas → ion, плёнка и корунд — ion, O₂ — gas), двойные связи
 *   O=O (σ-трубка + π-лепестки), металлические нити ГЦК, рёбра ячеек (сначала металл, потом корунд),
 *   валентные точки, электроны со следом, размерные линии (толщина плёнки, a, c, две длины Al–O),
 *   пунктир координационных многогранников. Огня, дыма, ореолов и волн нет — свет только сценический.
 */

const BOND_RADIUS = 0.05

const ATOM_COLOR: readonly number[] = AL2O3_ATOMS.map((a) => cpkHex(a.el))
const O_COLOR = cpkHex('O')
const O2_PAIRS: readonly (readonly [number, number])[] = O2_MOLECULES.map((m) => [AL2O3_ATOM_INDEX.get(m.a)!, AL2O3_ATOM_INDEX.get(m.b)!] as const)
const METAL_BOND_INDEX: readonly (readonly [number, number])[] = METAL_BONDS.map(([a, b]) => [AL2O3_ATOM_INDEX.get(a)!, AL2O3_ATOM_INDEX.get(b)!] as const)
/** Слоты пула связей: 0…2 — три O=O, дальше металлические нити. */
const SLOT_METAL0 = O2_PAIRS.length
const BOND_SLOTS = SLOT_METAL0 + METAL_BOND_INDEX.length
const ZERO_OFFSET = [0, 0, 0] as const
const EDGE_CAPACITY = Math.max(CORUNDUM_FRAG.cellEdges.length, METAL_FRAG.cellEdges.length)
const EDGE_DIM_ON_FADE = 0.6
/** π-лепестки O=O — над и под осью молекулы (оси молекул горизонтальны). */
const PI_NORMAL = new THREE.Vector3(0, 1, 0)
/** Валентные точки — кольцом Льюиса в плоскости экрана (камера шагов 2–3 смотрит вдоль −z). */
const FACING = new THREE.Vector3(0, 0, 1)
/** Размерные линии и пунктир многогранников: цвета подписей-размеров (не химия). */
const DIM_COLOR = [0.78, 0.92, 1] as const
const OCTA_COLOR = [0.86, 0.82, 1] as const
const TETRA_COLOR = [1, 0.72, 0.74] as const
const DIM_DOTS = 11
const POLY_DOTS = 7
const DIM_SIZE = 0.034
const _da = new THREE.Vector3()
const _db = new THREE.Vector3()

/** Отрезки многогранников шага 5 (узлы корунда стоят на местах, поэтому координаты постоянны). */
const sitePos = (i: number) => CORUNDUM_FRAG.sites[i]!.posScene
const OCTA_EDGES: readonly (readonly [readonly number[], readonly number[]])[] = OCTA.shell.edges.map(([a, b]) => [sitePos(a), sitePos(b)] as const)
const TETRA_EDGES: readonly (readonly [readonly number[], readonly number[]])[] = OCTA.tetra.edges.map(([a, b]) => [sitePos(a), sitePos(b)] as const)
const AL_STAR = sitePos(OCTA.al)
const SHORT_O = sitePos(OCTA.short)
const LONG_O = sitePos(OCTA.long)

function createAl2o3World() {
  return buildSceneWorld({
    atoms: AL2O3_ATOMS.length,
    bonds: BOND_SLOTS,
    lobes: O2_PAIRS.length * 2 + 2,
    edges: EDGE_CAPACITY,
    glows: [] as const,
  })
}

/** Какой набор рёбер сейчас лежит в пуле: переписываем только при смене (без аллокаций в кадре). */
type EdgeSync = { set: 'metal' | 'corundum' | '' }

function syncEdges(pool: EdgePool | undefined, sync: EdgeSync, frame: Al2o3Frame): void {
  if (!pool) return
  if (sync.set !== frame.edgeSet) {
    if (frame.edgeSet === 'metal') writeCellEdges(pool, METAL_FRAG.cellEdges, AL2O3_METAL_OFFSET)
    else writeCellEdges(pool, CORUNDUM_FRAG.cellEdges, ZERO_OFFSET)
    sync.set = frame.edgeSet
  }
  setCellEdgesAmount(pool, frame.edges * (1 - frame.fade * EDGE_DIM_ON_FADE))
}

export function Al2o3CinemaScene(props: ScientificSynthesisFxProps) {
  // Мир и буфер кадра создаются один раз на прогон и дальше пишутся каждый кадр.
  const { world, frame, edgeSync } = useSceneRuntime(() => ({
    world: createAl2o3World(),
    frame: createAl2o3Frame(),
    edgeSync: { set: '' } as EdgeSync,
  }))

  // Язык 3D-подписей: «тв./г./пм/нм/кДж/моль/КЧ» по локали.
  const sceneLocale = toSceneLocale(useLocale().locale)

  const validate = useCallback(() => {
    validateAl2o3Storyboard()
    validateAl2o3Energetics()
  }, [])

  // onFrame НЕ мемоизируем: SceneShell зовёт его из useFrame (см. kit/README, «Три правила»).
  const onFrame = (ctx: SceneFrameCtx) => {
    sampleAl2o3Frame(ctx.t, frame)
    // Числа 3D по локали: «475,7 пм» на ru/uz — как в панели урока.
    localizeSceneLabels(frame.labels, sceneLocale, true)
    resetBondVisuals(world)
    writeAtoms(world, frame)
    writeBonds(world, frame)
    drawPoints(ctx, frame)
    syncEdges(world.edges, edgeSync, frame)
    copyCamera(ctx, frame)
  }

  return (
    <SceneShell<Al2o3StepId, Al2o3CueId>
      {...props}
      lesson="al2o3"
      timing={AL2O3_TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      validate={validate}
      rigScale={AL2O3_RIG_SCALE}
      glowPointsCapacity={560}
      debugName="al2o3"
    />
  )
}

function copyCamera(ctx: SceneFrameCtx, frame: Al2o3Frame): void {
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

function writeAtoms(world: SceneWorld, frame: Al2o3Frame): void {
  const dim = 1 - frame.fade * 0.6
  for (let i = 0; i < AL2O3_ATOMS.length; i++) {
    writeAtom(world.atoms, i, {
      pos: frame.pos[i]!,
      radius: frame.radius[i]!,
      colorHex: ATOM_COLOR[i]!,
      charge: frame.charge[i]!,
      emissive: frame.emissive[i]!,
      opacity: frame.opacity[i]! * dim,
      surface: materialFor(frame.material[i]!),
    })
  }
  commitPool(world.atoms, AL2O3_ATOMS.length)
}

function writeBonds(world: SceneWorld, frame: Al2o3Frame): void {
  // 0…2 — двойные связи O=O: σ-трубка + π-лепестки, затем ГОМОЛИТИЧЕСКИЙ разрыв (split = 0).
  for (let k = 0; k < O2_PAIRS.length; k++) {
    const [a, b] = O2_PAIRS[k]!
    const amt = frame.bond.opacity * frame.opacity[a]!
    writeBondVisual(world, k, frame.pos[a]!, frame.pos[b]!, 'double', 2, amt, PI_NORMAL, { colorA: O_COLOR, colorB: O_COLOR, radius: BOND_RADIUS })
    // Та же σ-трубка с натяжением и истончением перед разрывом (лепестки остаются в world.lobes).
    writeBond(world.bonds, k, {
      a: frame.pos[a]!,
      b: frame.pos[b]!,
      radius: BOND_RADIUS,
      colorA: O_COLOR,
      colorB: O_COLOR,
      opacity: amt,
      stress: frame.bond.stress,
      thinning: frame.bond.thinning,
      split: 0,
    })
  }
  // Металлическая связь: соседи ГЦК (КЧ 12), бледные нити.
  for (let k = 0; k < METAL_BOND_INDEX.length; k++) {
    const [a, b] = METAL_BOND_INDEX[k]!
    const amt = frame.metalBond * Math.min(frame.opacity[a]!, frame.opacity[b]!)
    writeBondVisual(world, SLOT_METAL0 + k, frame.pos[a]!, frame.pos[b]!, 'metallic', 1, amt)
  }
  commitPool(world.bonds, BOND_SLOTS)
}

function drawPoints(ctx: SceneFrameCtx, frame: Al2o3Frame): void {
  const gp = ctx.points
  if (!gp) return
  const elapsed = ctx.elapsed
  const live = 1 - frame.fade
  gp.begin()

  // Валентные электроны точками: Al — 3 (3s²3p¹), O — 6, после двух приходов — октет.
  for (let k = 0; k < frame.valence.length; k++) {
    const v = frame.valence[k]!
    drawValenceCloud(gp, v.center, v.radius, v.count, v.amount * live, elapsed, { highlight: v.highlight, facing: FACING })
  }
  // Толщина плёнки: вертикальная размерная линия у переднего правого ребра колонны.
  if (frame.dims.film > 0.01) {
    _da.set(FILM_DIM.x, FILM_DIM.y0, FILM_DIM.z)
    _db.set(FILM_DIM.x, FILM_DIM.y1, FILM_DIM.z)
    drawDimension(gp, _da, _db, 0.09, 'x', frame.dims.film, DIM_COLOR, DIM_DOTS * 2)
  }
  // Ребро a — под нижним передним ребром ячейки, ребро c — справа от переднего вертикального.
  if (frame.dims.edgeA > 0.01) {
    const [p, q] = AL2O3_EDGE_A
    _da.set(p[0], p[1] - AL2O3_DIM_DROP, p[2])
    _db.set(q[0], q[1] - AL2O3_DIM_DROP, q[2])
    drawDimension(gp, _da, _db, 0.09, 'y', frame.dims.edgeA * live, DIM_COLOR, DIM_DOTS)
  }
  if (frame.dims.edgeC > 0.01) {
    const [p, q] = AL2O3_EDGE_C
    _da.set(p[0] + AL2O3_DIM_DROP, p[1], p[2])
    _db.set(q[0] + AL2O3_DIM_DROP, q[1], q[2])
    drawDimension(gp, _da, _db, 0.09, 'x', frame.dims.edgeC * live, DIM_COLOR, DIM_DOTS * 2)
  }
  // Шаг 5: пунктир октаэдра AlO₆ и тетраэдра OAl₄, размерные линии двух длин Al–O.
  if (frame.dims.poly > 0.01) {
    const amt = frame.dims.poly * live
    for (let k = 0; k < OCTA_EDGES.length; k++) {
      const [p, q] = OCTA_EDGES[k]!
      _da.set(p[0]!, p[1]!, p[2]!)
      _db.set(q[0]!, q[1]!, q[2]!)
      drawDimension(gp, _da, _db, 0, 'y', amt, OCTA_COLOR, POLY_DOTS)
    }
    for (let k = 0; k < TETRA_EDGES.length; k++) {
      const [p, q] = TETRA_EDGES[k]!
      _da.set(p[0]!, p[1]!, p[2]!)
      _db.set(q[0]!, q[1]!, q[2]!)
      drawDimension(gp, _da, _db, 0, 'y', amt, TETRA_COLOR, POLY_DOTS)
    }
    _da.set(AL_STAR[0], AL_STAR[1], AL_STAR[2] + 0.04)
    _db.set(SHORT_O[0], SHORT_O[1], SHORT_O[2] + 0.04)
    drawDimension(gp, _da, _db, 0, 'y', amt, DIM_COLOR, DIM_DOTS)
    _db.set(LONG_O[0], LONG_O[1], LONG_O[2] + 0.04)
    drawDimension(gp, _da, _db, 0, 'y', amt, DIM_COLOR, DIM_DOTS)
  }
  for (let k = 0; k < frame.electrons.length; k++) drawElectron(gp, frame.electrons[k]!, elapsed)

  gp.end()
}

/** Пунктир от a до b (точки); tick > 0 — засечки на концах поперёк (по оси tickAxis). Без аллокаций. */
function drawDimension(
  gp: NonNullable<SceneFrameCtx['points']>,
  a: THREE.Vector3,
  b: THREE.Vector3,
  tick: number,
  tickAxis: 'x' | 'y',
  amount: number,
  color: readonly [number, number, number],
  dots: number,
): void {
  const [r, g, bl] = color
  for (let k = 0; k < dots; k++) {
    const u = k / (dots - 1)
    gp.push(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u, DIM_SIZE, r, g, bl, amount * 0.9, 0.35)
  }
  if (tick <= 0) return
  const tx = tickAxis === 'x' ? tick : 0
  const ty = tickAxis === 'y' ? tick : 0
  gp.push(a.x + tx, a.y + ty, a.z, DIM_SIZE, r, g, bl, amount * 0.9, 0.35)
  gp.push(a.x - tx, a.y - ty, a.z, DIM_SIZE, r, g, bl, amount * 0.9, 0.35)
  gp.push(b.x + tx, b.y + ty, b.z, DIM_SIZE, r, g, bl, amount * 0.9, 0.35)
  gp.push(b.x - tx, b.y - ty, b.z, DIM_SIZE, r, g, bl, amount * 0.9, 0.35)
}
