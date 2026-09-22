import { useCallback } from 'react'
import * as THREE from 'three'
import { createLobePool, LobeKind, writeVec3, type LobePool } from '../../core/pools'
import { OrbitalLobes } from '../../react/OrbitalLobes'
import { commitPool, cpkHex, writeAtom, writeBond } from '../kit/cpkAtoms'
import { FX_COLOR } from '../kit/electronFx'
import { resetBondVisuals, writeBondVisual } from '../kit/bondVisual'
import { setCellEdgesAmount, writeCellEdges } from '../kit/lattice'
import { materialFor } from '../kit/materials'
import { buildSceneWorld, localizeSceneLabels, setGlow, toSceneLocale, useSceneRuntime, type SceneWorld } from '../kit/sceneKit'
import { SceneShell, type SceneFrameCtx } from '../kit/SceneShell'
import { useLocale } from '../../../../i18n/useLocale'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import {
  createH2oFrame,
  H2_MOLECULES,
  H2O_ATOM_INDEX,
  H2O_ATOMS,
  H2O_GEOM,
  H2O_RIG_SCALE,
  H2O_TIMING,
  ICE_FRAG,
  ICE_HBONDS,
  ICE_MOL_ATOMS,
  ICE_MOLECULES,
  O2_MOLECULES,
  sampleH2oFrame,
  STORY_OH,
  validateH2oStoryboard,
  type H2oCueId,
  type H2oFrame,
  type H2oStepId,
} from './h2oStoryboard'
import { validateH2oEnergetics } from './h2oEnergetics'

/**
 * Урок «вода»: 2 H₂ (г.) + O₂ (г.) → 2 H₂O — разветвлённая цепная реакция, полярная молекула, лёд Ih.
 *
 * Здесь только РЕНДЕР кадра: всё общее (часы по шагам, контракт лаборатории
 * embryo → birth → complete, камера, прогрев, подписи) делает SceneShell.
 * Раскадровка — h2oStoryboard.ts (лёд — h2oIce.ts), энергия — h2oEnergetics.ts, тексты — h2oMechanismText.*.
 *
 * Слои кадра (все из kit, ни одного числа химии):
 *   атомы (материал: реагенты и радикалы — gas, вода и лёд — covalent), σ-связи H–H (гомолиз),
 *   O=O — σ + π-лепестки, O–H — σ с полярностью, водородные связи льда — пунктир 'hbond',
 *   рёбра ячеек льда, точки неспаренных электронов радикалов, полупрозрачные холодные лепестки
 *   неподелённых пар и искра поджига (вне молекул, подписана). Огня, дыма и тумана нет.
 */

/** Искра поджига — электрический бело-голубой (цвет эффекта, не химия). */
const SPARK_COLOR = 0xcfe6ff
const SPARK_RADIUS = 0.16
const BOND_RADIUS = 0.028
/** Неподелённые пары — холодные полупрозрачные лепестки (обе фазы в холодной гамме). */
const LONE_PAIR_PALETTE = { positive: 0x9fd2ff, negative: 0x6f9fd8 } as const
const LONE_PAIR_OPACITY = 0.38
const LOBE_SIZE = H2O_GEOM.radius.o * 2.2
/** Точки неспаренных электронов: размер и зазор над поверхностью атома (параметры рисунка). */
const DOT_SIZE = 0.045
const DOT_GAP = 0.04
const EDGE_DIM_ON_FADE = 0.6

const ATOM_COLOR: readonly number[] = H2O_ATOMS.map((a) => cpkHex(a.el))
const H_COLOR = cpkHex('H')
const O_COLOR = cpkHex('O')
const IDX = (id: string) => H2O_ATOM_INDEX.get(id)!
const H2_IDX = H2_MOLECULES.map((m) => [IDX(m.a), IDX(m.b)] as const)
const O2_IDX = O2_MOLECULES.map((m) => [IDX(m.a), IDX(m.b)] as const)
const OH_IDX = STORY_OH.map((m) => [IDX(m.h), IDX(m.o)] as const)
const STORY_N = H2O_ATOMS.filter((a) => a.kind === 'story').length

/** Слоты пула связей: H₂ ×4, O₂ ×2, O–H сюжета ×4, O–H льда ×2 на молекулу, водородные связи. */
const SLOT_O2 = H2_IDX.length
const SLOT_OH = SLOT_O2 + O2_IDX.length
const SLOT_ICE_OH = SLOT_OH + OH_IDX.length
const SLOT_HB = SLOT_ICE_OH + ICE_MOLECULES.length * 2
const BOND_SLOTS = SLOT_HB + ICE_HBONDS.length
/** Плоскость σ-каркаса O₂ — плоскость экрана: π-лепестки над и под осью видны сбоку. */
const O2_PI_NORMAL = new THREE.Vector3(0, 0, 1)
const ZERO_OFFSET = [0, 0, 0] as const

function createH2oWorld() {
  return buildSceneWorld({
    atoms: H2O_ATOMS.length,
    bonds: BOND_SLOTS,
    lobes: 8,
    edges: ICE_FRAG.cellEdges.length,
    glows: [{ id: 'spark', color: SPARK_COLOR, radius: SPARK_RADIUS }] as const,
  })
}

export function H2oCinemaScene(props: ScientificSynthesisFxProps) {
  // Мир, буфер кадра и пул неподелённых пар создаются один раз на прогон и дальше пишутся каждый кадр.
  const { world, frame, lonePairs, edgeSync } = useSceneRuntime(() => ({
    world: createH2oWorld(),
    frame: createH2oFrame(),
    lonePairs: createLobePool(2),
    edgeSync: { written: false },
  }))

  // Язык 3D-подписей: «г./ж./тв./пм/кДж/моль/КЧ» вместо g/l/s/pm/kJ/mol/CN.
  const sceneLocale = toSceneLocale(useLocale().locale)

  const validate = useCallback(() => {
    validateH2oStoryboard()
    validateH2oEnergetics()
  }, [])

  // onFrame НЕ мемоизируем: SceneShell зовёт его из useFrame (см. kit/README, «Три правила»).
  const onFrame = (ctx: SceneFrameCtx) => {
    sampleH2oFrame(ctx.t, frame)
    // Числа 3D по локали: «74,14 пм» на ru/uz — как в панели урока.
    localizeSceneLabels(frame.labels, sceneLocale, true)
    resetBondVisuals(world)
    writeAtoms(world, frame)
    writeBonds(world, frame)
    writeLonePairs(lonePairs, frame)
    drawDots(ctx, frame)
    syncEdges(world, edgeSync, frame)
    setGlow(world, 'spark', frame.spark.pos, frame.spark.amount * (1 - frame.fade))
    copyCamera(ctx, frame)
  }

  return (
    <SceneShell<H2oStepId, H2oCueId>
      {...props}
      lesson="h2o"
      timing={H2O_TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      validate={validate}
      rigScale={H2O_RIG_SCALE}
      glowPointsCapacity={64}
      debugName="h2o"
    >
      {/* Неподелённые пары кислорода — полупрозрачные холодные лепестки (свой пул и палитра). */}
      <OrbitalLobes pool={lonePairs} time={world.visualTime} palette={LONE_PAIR_PALETTE} renderOrder={5} />
    </SceneShell>
  )
}

/** Рёбра ячеек льда пишутся в пул один раз; дальше — только прозрачность слоя (без аллокаций). */
function syncEdges(world: SceneWorld, sync: { written: boolean }, frame: H2oFrame): void {
  const pool = world.edges
  if (!pool) return
  if (!sync.written) {
    writeCellEdges(pool, ICE_FRAG.cellEdges, ZERO_OFFSET)
    sync.written = true
  }
  setCellEdgesAmount(pool, frame.edges * (1 - frame.fade * EDGE_DIM_ON_FADE))
}

function copyCamera(ctx: SceneFrameCtx, frame: H2oFrame): void {
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

function writeAtoms(world: SceneWorld, frame: H2oFrame): void {
  const dim = 1 - frame.fade * 0.6
  for (let i = 0; i < H2O_ATOMS.length; i++) {
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
  commitPool(world.atoms, H2O_ATOMS.length)
}

function writeBonds(world: SceneWorld, frame: H2oFrame): void {
  const dim = 1 - frame.fade
  const p = frame.pos
  // H–H: σ-связь, натяжение и СИММЕТРИЧНЫЙ (гомолитический) разрыв, split = 0.
  for (let k = 0; k < H2_IDX.length; k++) {
    const [a, b] = H2_IDX[k]!
    const s = frame.h2[k]!
    writeBond(world.bonds, k, {
      a: p[a]!,
      b: p[b]!,
      radius: BOND_RADIUS,
      colorA: H_COLOR,
      colorB: H_COLOR,
      opacity: s.amount * dim,
      stress: s.stress,
      thinning: s.thinning,
      split: 0,
    })
  }
  // O=O: σ-трубка + π-лепестки над и под осью (kit/bondVisual 'double').
  for (let k = 0; k < O2_IDX.length; k++) {
    const [a, b] = O2_IDX[k]!
    writeBondVisual(world, SLOT_O2 + k, p[a]!, p[b]!, 'double', 2, frame.o2[k]!.amount * dim, O2_PI_NORMAL, {
      colorA: O_COLOR,
      colorB: O_COLOR,
      radius: BOND_RADIUS,
      lobeSize: H2O_GEOM.oo * 0.5,
    })
  }
  // O–H сюжета: σ-связь, полярность смещает плотность к кислороду (b = O).
  for (let k = 0; k < OH_IDX.length; k++) {
    const [h, o] = OH_IDX[k]!
    const s = frame.oh[k]!
    writeBond(world.bonds, SLOT_OH + k, {
      a: p[h]!,
      b: p[o]!,
      radius: BOND_RADIUS,
      colorA: H_COLOR,
      colorB: O_COLOR,
      opacity: s.amount * dim,
      form: s.form,
      polarity: s.polarity,
    })
  }
  // O–H молекул льда (сюжетные A и B рисуются своими слотами выше — у них слот пуст).
  for (let mi = 0; mi < ICE_MOL_ATOMS.length; mi++) {
    const [o, h0, h1] = ICE_MOL_ATOMS[mi]!
    const own = o >= STORY_N
    for (let k = 0; k < 2; k++) {
      writeBond(world.bonds, SLOT_ICE_OH + mi * 2 + k, {
        a: p[k === 0 ? h0 : h1]!,
        b: p[o]!,
        radius: BOND_RADIUS,
        colorA: H_COLOR,
        colorB: O_COLOR,
        opacity: own ? frame.iceOH[mi * 2 + k]! * dim : 0,
      })
    }
  }
  // Водородные связи льда: пунктир от H донора к O акцептора.
  for (let k = 0; k < ICE_HBONDS.length; k++) {
    const hb = ICE_HBONDS[k]!
    const donor = ICE_MOL_ATOMS[hb.donor]!
    const h = donor[1 + hb.hIndex]!
    const acc = ICE_MOL_ATOMS[hb.acceptor]![0]
    writeBondVisual(world, SLOT_HB + k, p[h]!, p[acc]!, 'hbond', 1, frame.hbond[k]! * dim, undefined, { radius: BOND_RADIUS })
  }
  commitPool(world.bonds, BOND_SLOTS)
}

/** Две неподелённые пары молекулы A (заселённость 1 — именно пара электронов). */
function writeLonePairs(pool: LobePool, frame: H2oFrame): void {
  const amount = frame.lobes.amount * (1 - frame.fade)
  const c = frame.lobes.center
  for (let n = 0; n < 2; n++) {
    const ax = frame.lobes.axis[n]!
    writeVec3(pool.center, n, c.x, c.y, c.z)
    writeVec3(pool.axis, n, ax.x, ax.y, ax.z)
    pool.size[n] = LOBE_SIZE
    pool.coef[n] = 1
    pool.kind[n] = LobeKind.lonePair
    pool.occupancy[n] = 1
    pool.opacity[n] = amount * LONE_PAIR_OPACITY
  }
  commitPool(pool, amount > 0.01 ? 2 : 0)
}

/** Точки неспаренных электронов: H· и ·OH — одна, O(³P) — две, O₂ — по одной у атома (триплет). */
function drawDots(ctx: SceneFrameCtx, frame: H2oFrame): void {
  const gp = ctx.points
  if (!gp) return
  gp.begin()
  const [r, g, b] = FX_COLOR.electron
  const dim = 1 - frame.fade
  for (let i = 0; i < STORY_N; i++) {
    const n = frame.unpaired[i]!
    const a = frame.opacity[i]! * dim
    if (n <= 0 || a <= 0.01) continue
    const c = frame.pos[i]!
    const rr = frame.radius[i]! + DOT_GAP
    for (let k = 0; k < n && k < 2; k++) {
      const d = frame.dotDir[i * 2 + k]!
      gp.push(c.x + d.x * rr, c.y + d.y * rr, c.z + d.z * rr, DOT_SIZE, r, g, b, a * 0.95, 0.6)
    }
  }
  gp.end()
}
