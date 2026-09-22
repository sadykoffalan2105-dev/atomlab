import { useCallback } from 'react'
import * as THREE from 'three'
import { commitPool, cpkHex, writeAtom, writeBond } from '../kit/cpkAtoms'
import { drawElectron } from '../kit/electronFx'
import { bondVisualLobeCount, resetBondVisuals, writeBondVisual } from '../kit/bondVisual'
import { setCellEdgesAmount, writeCellEdges, type EdgePool } from '../kit/lattice'
import { materialFor } from '../kit/materials'
import { drawValenceCloud } from '../kit/valence'
import { buildSceneWorld, localizeSceneLabels, setGlow, toSceneLocale, useSceneRuntime, type SceneWorld } from '../kit/sceneKit'
import { useLocale } from '../../../../i18n/useLocale'
import { SceneShell, type SceneFrameCtx } from '../kit/SceneShell'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import {
  createMgoFrame,
  METAL_BONDS,
  METAL_FRAG,
  MGO_ATOM_INDEX,
  MGO_ATOMS,
  MGO_DIM_A_DROP,
  MGO_EDGE_A,
  MGO_METAL_OFFSET,
  MGO_RIG_SCALE,
  MGO_TIMING,
  SALT_FRAG,
  sampleMgoFrame,
  validateMgoStoryboard,
  type MgoCueId,
  type MgoFrame,
  type MgoStepId,
} from './mgoStoryboard'
import { validateMgoEnergetics } from './mgoEnergetics'

/**
 * Урок «горение магния»: 2 Mg (тв.) + O₂ (г.) → 2 MgO (тв.), семь шагов, по рецепту эталона nacl.
 *
 * Здесь только РЕНДЕР кадра: всё общее (часы по шагам, контракт лаборатории
 * embryo → birth → complete, камера, прогрев, подписи) делает SceneShell.
 * Раскадровка — mgoStoryboard.ts, энергия — mgoEnergetics.ts, тексты — mgoMechanismText.*.
 *
 * Слои кадра (все из kit, ни одного числа химии):
 *   атомы (материал по веществу: metal → gas → ion), O=O (σ-трубка + π-лепестки), металлические
 *   нити ГПУ, рёбра ячеек (сначала металл, потом 2×2×2 MgO), валентные точки, электроны со следом,
 *   дуги поля ионных пар. Пламени, дыма, ореолов и волн нет — свет только сценический.
 */

/** Ореол летящего электрона — единственное свечение сцены (цвет эффекта, не химия). */
const ELECTRON_HALO = 0x9ee4ff
const BOND_RADIUS = 0.05

const ATOM_COLOR: readonly number[] = MGO_ATOMS.map((a) => cpkHex(a.el))
const O_COLOR = cpkHex('O')
const I_MG1 = MGO_ATOM_INDEX.get('mg1')!
const I_MG2 = MGO_ATOM_INDEX.get('mg2')!
const I_OA = MGO_ATOM_INDEX.get('oA')!
const I_OB = MGO_ATOM_INDEX.get('oB')!
const METAL_BOND_INDEX: readonly (readonly [number, number])[] = METAL_BONDS.map(([a, b]) => [MGO_ATOM_INDEX.get(a)!, MGO_ATOM_INDEX.get(b)!] as const)
/** Слоты пула связей: 0 — O=O, дальше металл, в конце две ионные пары (невидимые трубки). */
const SLOT_ION1 = 1 + METAL_BOND_INDEX.length
const SLOT_ION2 = SLOT_ION1 + 1
const BOND_SLOTS = SLOT_ION2 + 1
const ZERO_OFFSET = [0, 0, 0] as const
const EDGE_CAPACITY = Math.max(SALT_FRAG.cellEdges.length, METAL_FRAG.cellEdges.length)
const EDGE_DIM_ON_FADE = 0.6
/** Валентные точки — кольцом Льюиса в плоскости экрана (камера шагов 2–5 смотрит вдоль −z). */
const FACING = new THREE.Vector3(0, 0, 1)
/** Нормаль π-связи O=O: ⟂ экрану не годится (лепестки спрятались бы), берём ось x — лепестки слева и справа. */
const PI_NORMAL = new THREE.Vector3(1, 0, 0)
const DIM_COLOR = [0.78, 0.92, 1] as const
const DIM_DOTS = 11
const DIM_SIZE = 0.034
const _da = new THREE.Vector3()
const _db = new THREE.Vector3()

function createMgoWorld() {
  return buildSceneWorld({
    atoms: MGO_ATOMS.length,
    bonds: BOND_SLOTS,
    lobes: bondVisualLobeCount('double'),
    edges: EDGE_CAPACITY,
    glows: [
      { id: 'e1', color: ELECTRON_HALO, radius: 0.3 },
      { id: 'e2', color: ELECTRON_HALO, radius: 0.3 },
      { id: 'e3', color: ELECTRON_HALO, radius: 0.3 },
      { id: 'e4', color: ELECTRON_HALO, radius: 0.3 },
    ] as const,
  })
}
const GLOW_IDS = ['e1', 'e2', 'e3', 'e4'] as const

/** Какой набор рёбер сейчас лежит в пуле: переписываем только при смене (без аллокаций в кадре). */
type EdgeSync = { set: 'metal' | 'salt' | '' }

function syncEdges(pool: EdgePool | undefined, sync: EdgeSync, frame: MgoFrame): void {
  if (!pool) return
  if (sync.set !== frame.edgeSet) {
    if (frame.edgeSet === 'metal') writeCellEdges(pool, METAL_FRAG.cellEdges, MGO_METAL_OFFSET)
    else writeCellEdges(pool, SALT_FRAG.cellEdges, ZERO_OFFSET)
    sync.set = frame.edgeSet
  }
  setCellEdgesAmount(pool, frame.edges * (1 - frame.fade * EDGE_DIM_ON_FADE))
}

export function MgoCinemaScene(props: ScientificSynthesisFxProps) {
  // Мир и буфер кадра создаются один раз на прогон и дальше пишутся каждый кадр.
  const { world, frame, edgeSync } = useSceneRuntime(() => ({
    world: createMgoWorld(),
    frame: createMgoFrame(),
    edgeSync: { set: '' } as EdgeSync,
  }))

  // Язык 3D-подписей: «тв./г./пм/кДж/моль/КЧ» вместо s/g/pm/kJ/mol/CN.
  const sceneLocale = toSceneLocale(useLocale().locale)

  const validate = useCallback(() => {
    validateMgoStoryboard()
    validateMgoEnergetics()
  }, [])

  // onFrame НЕ мемоизируем: SceneShell зовёт его из useFrame (см. kit/README, «Три правила»).
  const onFrame = (ctx: SceneFrameCtx) => {
    sampleMgoFrame(ctx.t, frame)
    // Числа 3D по локали: «174,9 пм» на ru/uz — как в панели урока.
    localizeSceneLabels(frame.labels, sceneLocale, true)
    resetBondVisuals(world)
    writeAtoms(world, frame)
    writeBonds(world, frame)
    drawPoints(ctx, world, frame)
    syncEdges(world.edges, edgeSync, frame)
    for (let e = 0; e < 4; e++) {
      const el = frame.electrons[e]!
      setGlow(world, GLOW_IDS[e]!, el.pos, frame.fx.electrons[e]! * el.glow * 0.8)
    }
    copyCamera(ctx, frame)
  }

  return (
    <SceneShell<MgoStepId, MgoCueId>
      {...props}
      lesson="mgo"
      timing={MGO_TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      validate={validate}
      rigScale={MGO_RIG_SCALE}
      glowPointsCapacity={220}
      debugName="mgo"
    />
  )
}

function copyCamera(ctx: SceneFrameCtx, frame: MgoFrame): void {
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

function writeAtoms(world: SceneWorld, frame: MgoFrame): void {
  const dim = 1 - frame.fade * 0.6
  for (let i = 0; i < MGO_ATOMS.length; i++) {
    writeAtom(world.atoms, i, {
      pos: frame.pos[i]!,
      radius: frame.radius[i]!,
      colorHex: ATOM_COLOR[i]!,
      // Кромка окрашивается по знаку; заряд ±2 зажат в диапазон шейдера.
      charge: Math.max(-1, Math.min(1, frame.charge[i]!)),
      emissive: frame.emissive[i]!,
      opacity: frame.opacity[i]! * dim,
      surface: materialFor(frame.material[i]!),
    })
  }
  commitPool(world.atoms, MGO_ATOMS.length)
}

function writeBonds(world: SceneWorld, frame: MgoFrame): void {
  // 0 — O=O: σ-трубка и π-лепестки над/под осью; π гаснет первой, σ рвётся гомолитически (split = 0).
  const amt = frame.bond.opacity * frame.opacity[I_OA]!
  writeBondVisual(world, 0, frame.pos[I_OA]!, frame.pos[I_OB]!, 'double', 2, frame.bond.pi * amt, PI_NORMAL, {
    radius: BOND_RADIUS,
    colorA: O_COLOR,
    colorB: O_COLOR,
  })
  writeBond(world.bonds, 0, {
    a: frame.pos[I_OA]!,
    b: frame.pos[I_OB]!,
    radius: BOND_RADIUS,
    colorA: O_COLOR,
    colorB: O_COLOR,
    opacity: amt,
    stress: frame.bond.stress,
    thinning: frame.bond.thinning,
    split: 0,
  })
  // Металлическая связь: бледные нити между соседями первой сферы (общие электроны кристалла).
  for (let k = 0; k < METAL_BOND_INDEX.length; k++) {
    const [a, b] = METAL_BOND_INDEX[k]!
    const m = frame.metalBond * Math.min(frame.opacity[a]!, frame.opacity[b]!)
    writeBondVisual(world, 1 + k, frame.pos[a]!, frame.pos[b]!, 'metallic', 1, m)
  }
}

function drawPoints(ctx: SceneFrameCtx, world: SceneWorld, frame: MgoFrame): void {
  const gp = ctx.points
  const elapsed = ctx.elapsed
  if (gp) gp.begin()

  if (gp) {
    // Валентные электроны точками: Mg — 2 (3s²) → 1 → 0, O — 6 → 7 → 8.
    for (let k = 0; k < 4; k++) {
      const v = frame.valence[k]!
      drawValenceCloud(gp, v.center, v.radius, v.count, v.amount * (1 - frame.fade), elapsed, { highlight: v.highlight, skip: v.skip, facing: FACING })
    }
    // Размерная линия пары Mg²⁺–O²⁻ в решётке — перед сферами, от ядра до ядра.
    if (frame.dims.pair > 0.01) {
      const lift = frame.radius[I_OA]! + 0.03
      _da.copy(frame.pos[I_MG1]!)
      _db.copy(frame.pos[I_OA]!)
      _da.z += lift
      _db.z += lift
      drawDimension(gp, _da, _db, 0, frame.dims.pair)
    }
    // Размерная линия a под нижним передним ребром ячейки, с засечками на концах.
    if (frame.dims.edgeA > 0.01) {
      const [p, q] = MGO_EDGE_A
      _da.set(p[0], p[1] - MGO_DIM_A_DROP, p[2])
      _db.set(q[0], q[1] - MGO_DIM_A_DROP, q[2])
      drawDimension(gp, _da, _db, 0.09, frame.dims.edgeA)
    }
    for (let e = 0; e < 4; e++) drawElectron(gp, frame.electrons[e]!, elapsed)
  }

  // Ионная связь газовых пар: трубки нет, только дуги поля (закон Кулона).
  const field = frame.fx.field * (1 - frame.fade)
  writeBondVisual(world, SLOT_ION1, frame.pos[I_MG1]!, frame.pos[I_OA]!, 'ionic', 1, field, undefined, { gp, elapsed })
  writeBondVisual(world, SLOT_ION2, frame.pos[I_MG2]!, frame.pos[I_OB]!, 'ionic', 1, field, undefined, { gp, elapsed })
  commitPool(world.bonds, BOND_SLOTS)

  if (gp) gp.end()
}

/** Пунктир размера от a до b (точки), tick > 0 — вертикальные засечки на концах. Без аллокаций. */
function drawDimension(gp: NonNullable<SceneFrameCtx['points']>, a: THREE.Vector3, b: THREE.Vector3, tick: number, amount: number): void {
  const [r, g, bl] = DIM_COLOR
  for (let k = 0; k < DIM_DOTS; k++) {
    const u = k / (DIM_DOTS - 1)
    gp.push(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u, DIM_SIZE, r, g, bl, amount * 0.9, 0.35)
  }
  if (tick <= 0) return
  for (let s = 0; s < 2; s++) {
    const e = s === 0 ? a : b
    gp.push(e.x, e.y + tick, e.z, DIM_SIZE, r, g, bl, amount * 0.9, 0.35)
    gp.push(e.x, e.y - tick, e.z, DIM_SIZE, r, g, bl, amount * 0.9, 0.35)
  }
}
