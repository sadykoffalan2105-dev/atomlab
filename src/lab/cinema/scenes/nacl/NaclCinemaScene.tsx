import { useCallback } from 'react'
import * as THREE from 'three'
import { commitPool, cpkHex, writeAtom, writeBond } from '../kit/cpkAtoms'
import { drawElectron } from '../kit/electronFx'
import { resetBondVisuals, writeBondVisual } from '../kit/bondVisual'
import { setCellEdgesAmount, writeCellEdges, type EdgePool } from '../kit/lattice'
import { materialFor } from '../kit/materials'
import { drawValenceCloud } from '../kit/valence'
import { buildSceneWorld, localizeSceneLabels, setGlow, toSceneLocale, useSceneRuntime, type SceneWorld } from '../kit/sceneKit'
import { useLocale } from '../../../../i18n/useLocale'
import { SceneShell, type SceneFrameCtx } from '../kit/SceneShell'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import {
  createNaclFrame,
  METAL_BONDS,
  METAL_FRAG,
  NACL_ATOM_INDEX,
  NACL_ATOMS,
  NACL_DIM_A_DROP,
  NACL_EDGE_A,
  NACL_METAL_OFFSET,
  NACL_RIG_SCALE,
  NACL_TIMING,
  SALT_FRAG,
  sampleNaclFrame,
  validateNaclStoryboard,
  type NaclCueId,
  type NaclFrame,
  type NaclStepId,
} from './naclStoryboard'
import { validateNaclEnergetics } from './naclEnergetics'

/**
 * Урок «ионная связь»: 2 Na (тв.) + Cl₂ (г.) → 2 NaCl (тв.), шесть шагов. ЭТАЛОН.
 *
 * Здесь только РЕНДЕР кадра: всё общее (часы по шагам, контракт лаборатории
 * embryo → birth → complete, камера, прогрев, подписи) делает SceneShell.
 * Раскадровка — naclStoryboard.ts, энергия — naclEnergetics.ts, тексты — naclMechanismText.*.
 *
 * Слои кадра (все из kit, ни одного числа химии):
 *   атомы (материал по веществу: metal → gas → ion), σ-связь Cl–Cl, металлические нити ОЦК,
 *   рёбра ячеек (сначала ячейка Na, потом 2×2×2 NaCl), валентные точки, электроны со следом,
 *   дуги поля ионных пар. Огня, дыма, ореолов и волн нет — свет только сценический.
 */

/** Ореол летящего электрона — единственное свечение сцены (цвет эффекта, не химия). */
const ELECTRON_HALO = 0x9ee4ff
const BOND_RADIUS = 0.05

const ATOM_COLOR: readonly number[] = NACL_ATOMS.map((a) => cpkHex(a.el))
const CL_COLOR = cpkHex('Cl')
const I_NA1 = NACL_ATOM_INDEX.get('na1')!
const I_NA2 = NACL_ATOM_INDEX.get('na2')!
const I_CLA = NACL_ATOM_INDEX.get('clA')!
const I_CLB = NACL_ATOM_INDEX.get('clB')!
const METAL_BOND_INDEX: readonly (readonly [number, number])[] = METAL_BONDS.map(([a, b]) => [NACL_ATOM_INDEX.get(a)!, NACL_ATOM_INDEX.get(b)!] as const)
/** Слоты пула связей: 0 — Cl–Cl, дальше металл, в конце две ионные пары (невидимые трубки). */
const SLOT_ION1 = 1 + METAL_BOND_INDEX.length
const SLOT_ION2 = SLOT_ION1 + 1
const BOND_SLOTS = SLOT_ION2 + 1
const ZERO_OFFSET = [0, 0, 0] as const
const EDGE_CAPACITY = Math.max(SALT_FRAG.cellEdges.length, METAL_FRAG.cellEdges.length)
const EDGE_DIM_ON_FADE = 0.6
/** Валентные точки — кольцом Льюиса в плоскости экрана (камера шагов 2–4 смотрит вдоль −z). */
const FACING = new THREE.Vector3(0, 0, 1)
/** Размерные линии: светлые точки (цвет подписи-размера), число точек на линии. */
const DIM_COLOR = [0.78, 0.92, 1] as const
const DIM_DOTS = 11
const DIM_SIZE = 0.034
const _da = new THREE.Vector3()
const _db = new THREE.Vector3()

function createNaclWorld() {
  return buildSceneWorld({
    atoms: NACL_ATOMS.length,
    bonds: BOND_SLOTS,
    edges: EDGE_CAPACITY,
    glows: [
      { id: 'e1', color: ELECTRON_HALO, radius: 0.3 },
      { id: 'e2', color: ELECTRON_HALO, radius: 0.3 },
    ] as const,
  })
}

/** Какой набор рёбер сейчас лежит в пуле: переписываем только при смене (без аллокаций в кадре). */
type EdgeSync = { set: 'metal' | 'salt' | '' }

function syncEdges(pool: EdgePool | undefined, sync: EdgeSync, frame: NaclFrame): void {
  if (!pool) return
  if (sync.set !== frame.edgeSet) {
    if (frame.edgeSet === 'metal') writeCellEdges(pool, METAL_FRAG.cellEdges, NACL_METAL_OFFSET)
    else writeCellEdges(pool, SALT_FRAG.cellEdges, ZERO_OFFSET)
    sync.set = frame.edgeSet
  }
  setCellEdgesAmount(pool, frame.edges * (1 - frame.fade * EDGE_DIM_ON_FADE))
}

export function NaclCinemaScene(props: ScientificSynthesisFxProps) {
  // Мир и буфер кадра создаются один раз на прогон и дальше пишутся каждый кадр.
  const { world, frame, edgeSync } = useSceneRuntime(() => ({
    world: createNaclWorld(),
    frame: createNaclFrame(),
    edgeSync: { set: '' } as EdgeSync,
  }))

  // Язык 3D-подписей: «тв./г./пм/кДж/моль/КЧ» вместо s/g/pm/kJ/mol/CN.
  const sceneLocale = toSceneLocale(useLocale().locale)

  const validate = useCallback(() => {
    validateNaclStoryboard()
    validateNaclEnergetics()
  }, [])

  // onFrame НЕ мемоизируем: SceneShell зовёт его из useFrame (см. kit/README, «Три правила»).
  const onFrame = (ctx: SceneFrameCtx) => {
    sampleNaclFrame(ctx.t, frame)
    // Числа 3D по локали: «236,1 пм» на ru/uz — как в панели урока.
    localizeSceneLabels(frame.labels, sceneLocale, true)
    resetBondVisuals(world)
    writeAtoms(world, frame)
    writeBonds(world, frame)
    drawPoints(ctx, world, frame)
    syncEdges(world.edges, edgeSync, frame)
    setGlow(world, 'e1', frame.electrons[0].pos, frame.fx.electron1 * frame.electrons[0].glow * 0.8)
    setGlow(world, 'e2', frame.electrons[1].pos, frame.fx.electron2 * frame.electrons[1].glow * 0.8)
    copyCamera(ctx, frame)
  }

  return (
    <SceneShell<NaclStepId, NaclCueId>
      {...props}
      lesson="nacl"
      timing={NACL_TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      validate={validate}
      rigScale={NACL_RIG_SCALE}
      glowPointsCapacity={200}
      debugName="nacl"
    />
  )
}

function copyCamera(ctx: SceneFrameCtx, frame: NaclFrame): void {
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

function writeAtoms(world: SceneWorld, frame: NaclFrame): void {
  const dim = 1 - frame.fade * 0.6
  for (let i = 0; i < NACL_ATOMS.length; i++) {
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
  commitPool(world.atoms, NACL_ATOMS.length)
}

function writeBonds(world: SceneWorld, frame: NaclFrame): void {
  // 0 — σ-связь Cl–Cl: натяжение и СИММЕТРИЧНЫЙ (гомолитический) разрыв, split = 0.
  writeBond(world.bonds, 0, {
    a: frame.pos[I_CLA]!,
    b: frame.pos[I_CLB]!,
    radius: BOND_RADIUS,
    colorA: CL_COLOR,
    colorB: CL_COLOR,
    opacity: frame.bond.opacity * frame.opacity[I_CLA]!,
    stress: frame.bond.stress,
    thinning: frame.bond.thinning,
    split: 0,
  })
  // Металлическая связь: центр ОЦК-ячейки с восемью вершинами (КЧ 8), бледные нити.
  for (let k = 0; k < METAL_BOND_INDEX.length; k++) {
    const [a, b] = METAL_BOND_INDEX[k]!
    const amt = frame.metalBond * Math.min(frame.opacity[a]!, frame.opacity[b]!)
    writeBondVisual(world, 1 + k, frame.pos[a]!, frame.pos[b]!, 'metallic', 1, amt)
  }
}

function drawPoints(ctx: SceneFrameCtx, world: SceneWorld, frame: NaclFrame): void {
  const gp = ctx.points
  const elapsed = ctx.elapsed
  if (gp) gp.begin()

  if (gp) {
    // Валентные электроны точками: Na — 1 (3s¹), Cl — 7, после прихода — октет.
    for (let k = 0; k < 4; k++) {
      const v = frame.valence[k]!
      drawValenceCloud(gp, v.center, v.radius, v.count, v.amount * (1 - frame.fade), elapsed, { highlight: v.highlight, facing: FACING })
    }
    // Размерная линия пары Na⁺–Cl⁻ в решётке (282 пм) — перед сферами, от ядра до ядра.
    if (frame.dims.pair > 0.01) {
      const lift = frame.radius[I_CLA]! + 0.03
      _da.copy(frame.pos[I_NA1]!)
      _db.copy(frame.pos[I_CLA]!)
      _da.z += lift
      _db.z += lift
      drawDimension(gp, _da, _db, 0, frame.dims.pair)
    }
    // Размерная линия a под нижним передним ребром ячейки, с засечками на концах.
    if (frame.dims.edgeA > 0.01) {
      const [p, q] = NACL_EDGE_A
      _da.set(p[0], p[1] - NACL_DIM_A_DROP, p[2])
      _db.set(q[0], q[1] - NACL_DIM_A_DROP, q[2])
      drawDimension(gp, _da, _db, 0.09, frame.dims.edgeA)
    }
    drawElectron(gp, frame.electrons[0], elapsed)
    drawElectron(gp, frame.electrons[1], elapsed)
  }

  // Ионная связь газовых пар: трубки нет, только дуги поля (закон Кулона).
  const field = frame.fx.field * (1 - frame.fade)
  writeBondVisual(world, SLOT_ION1, frame.pos[I_NA1]!, frame.pos[I_CLA]!, 'ionic', 1, field, undefined, { gp, elapsed })
  writeBondVisual(world, SLOT_ION2, frame.pos[I_NA2]!, frame.pos[I_CLB]!, 'ionic', 1, field, undefined, { gp, elapsed })
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
  for (const e of [a, b]) {
    gp.push(e.x, e.y + tick, e.z, DIM_SIZE, r, g, bl, amount * 0.9, 0.35)
    gp.push(e.x, e.y - tick, e.z, DIM_SIZE, r, g, bl, amount * 0.9, 0.35)
  }
}
