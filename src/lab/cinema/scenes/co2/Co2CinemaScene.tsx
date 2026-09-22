import { useCallback } from 'react'
import * as THREE from 'three'
import { commitPool, cpkHex, writeAtom, writeBond } from '../kit/cpkAtoms'
import { resetBondVisuals, writeBondVisual } from '../kit/bondVisual'
import { setCellEdgesAmount, writeCellEdges, type EdgePool } from '../kit/lattice'
import { materialFor } from '../kit/materials'
import { buildSceneWorld, localizeSceneLabels, toSceneLocale, useSceneRuntime, type SceneWorld } from '../kit/sceneKit'
import { useLocale } from '../../../../i18n/useLocale'
import { SceneShell, type SceneFrameCtx } from '../kit/SceneShell'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import {
  CO2_ATOM_INDEX,
  CO2_ATOMS,
  CO2_BONDS,
  CO2_GEOM,
  CO2_RIG_SCALE,
  CO2_TIMING,
  DRY_CELL_EDGES,
  GRAPHITE_CELL_EDGES,
  createCo2Frame,
  sampleCo2Frame,
  validateCo2Storyboard,
  type Co2CueId,
  type Co2Frame,
  type Co2StepId,
} from './co2Storyboard'
import { validateCo2Energetics } from './co2Energetics'

/**
 * Урок «горение угля»: C (графит) + O₂ (г.) → CO₂ (г.), шесть шагов, на рецепте эталона (scenes/nacl).
 *
 * Здесь только РЕНДЕР кадра: часы по шагам, контракт лаборатории embryo → birth → complete,
 * камера, прогрев и подписи — в SceneShell. Раскадровка — co2Storyboard.ts, энергия —
 * co2Energetics.ts, тексты — co2MechanismText.*.
 *
 * Слои кадра (все из kit, ни одного числа химии): атомы (материал по веществу: слой графита —
 * матовый, газ O₂ и ·OH — gas, молекулы CO/CO₂ — covalent), σ-трубки связей, π-лепестки
 * (kit/bondVisual), рёбра ячеек (графит → сухой лёд), векторы диполей связей точками.
 * Огня, свечения, дыма, вспышек и волн нет — свет только сценический.
 */

const BOND_RADIUS = 0.045
const GRAPHITE_BOND_RADIUS = 0.03
/**
 * Цвет трубок слоя графита: осветлённый CPK-углерод. По CPK углерод почти чёрный и на тёмном
 * поле сцены трубка пропадает (параметр рисунка, не химия).
 */
const GRAPHITE_BOND_COLOR = 0x7c7c88
/** Длина π-лепестка, мировые единицы: снаружи шаров (доля радиуса — CO2_BALL_SCALE). */
const LOBE_SIZE = 0.24

const ATOM_COLOR: readonly number[] = CO2_ATOMS.map((a) => cpkHex(a.el))
/** Слот пула связей, в который пишет π-лепестки writeBondVisual; его трубка всегда невидима. */
const SCRATCH = CO2_BONDS.length
const BOND_SLOTS = SCRATCH + 1
const BOND_COLOR_A: readonly number[] = CO2_BONDS.map((b) => (b.kind === 'graphite' || b.kind === 'graphiteBreak' ? GRAPHITE_BOND_COLOR : ATOM_COLOR[b.a]!))
const BOND_COLOR_B: readonly number[] = CO2_BONDS.map((b) => (b.kind === 'graphite' || b.kind === 'graphiteBreak' ? GRAPHITE_BOND_COLOR : ATOM_COLOR[b.b]!))
const BOND_R: readonly number[] = CO2_BONDS.map((b) => (b.kind === 'graphite' || b.kind === 'graphiteBreak' ? GRAPHITE_BOND_RADIUS : BOND_RADIUS))
/** Полярность трубки (смещение плотности к O) показывается только у двух связей C=O молекулы. */
const BOND_POLAR: readonly number[] = CO2_BONDS.map((b) => (b.kind === 'coA' || b.kind === 'coC' ? 0.8 : 0))
const ZERO_OFFSET = [0, 0, 0] as const
const EDGE_CAPACITY = Math.max(GRAPHITE_CELL_EDGES.length, DRY_CELL_EDGES.length)
const EDGE_DIM_ON_FADE = 0.6
const I_C0 = CO2_ATOM_INDEX.get('c0')!
const I_OA = CO2_ATOM_INDEX.get('oA')!
const I_OC = CO2_ATOM_INDEX.get('oC')!
/** Векторы диполей связей — точками над осью молекулы: от δ+ (C) к δ− (O), учебное обозначение μ. */
const DIPOLE_PLUS = [1.0, 0.74, 0.52] as const
const DIPOLE_MINUS = [0.56, 0.86, 1.0] as const
const DIPOLE_DOTS = 9
const DIPOLE_LIFT = CO2_GEOM.radius.O + 0.12
const _pa = new THREE.Vector3()
const _pb = new THREE.Vector3()

function createCo2World() {
  return buildSceneWorld({
    atoms: CO2_ATOMS.length,
    bonds: BOND_SLOTS,
    // π-пары: O₂, C(O) ×2, вторая π CO, π новой C=O — по 2 записи на пару
    lobes: 16,
    edges: EDGE_CAPACITY,
    glows: [] as const,
  })
}

/** Какой набор рёбер сейчас лежит в пуле: переписываем только при смене (без аллокаций в кадре). */
type EdgeSync = { set: 'graphite' | 'dry' | '' }

function syncEdges(pool: EdgePool | undefined, sync: EdgeSync, frame: Co2Frame): void {
  if (!pool) return
  if (sync.set !== frame.edgeSet) {
    writeCellEdges(pool, frame.edgeSet === 'graphite' ? GRAPHITE_CELL_EDGES : DRY_CELL_EDGES, ZERO_OFFSET)
    sync.set = frame.edgeSet
  }
  setCellEdgesAmount(pool, frame.edges * (1 - frame.fade * EDGE_DIM_ON_FADE))
}

export function Co2CinemaScene(props: ScientificSynthesisFxProps) {
  // Мир и буфер кадра создаются один раз на прогон и дальше пишутся каждый кадр.
  const { world, frame, edgeSync } = useSceneRuntime(() => ({
    world: createCo2World(),
    frame: createCo2Frame(),
    edgeSync: { set: '' } as EdgeSync,
  }))

  // Язык 3D-подписей: «тв./г./пм/кДж/моль/КЧ» вместо s/g/pm/kJ/mol/CN.
  const sceneLocale = toSceneLocale(useLocale().locale)

  const validate = useCallback(() => {
    validateCo2Storyboard()
    validateCo2Energetics()
  }, [])

  // onFrame НЕ мемоизируем: SceneShell зовёт его из useFrame (см. kit/README, «Три правила»).
  const onFrame = (ctx: SceneFrameCtx) => {
    sampleCo2Frame(ctx.t, frame)
    // Числа 3D по локали: «116,0 пм» на ru/uz — как в панели урока.
    localizeSceneLabels(frame.labels, sceneLocale, true)
    resetBondVisuals(world)
    writeAtoms(world, frame)
    writeBonds(world, frame)
    drawPoints(ctx, frame)
    syncEdges(world.edges, edgeSync, frame)
    copyCamera(ctx, frame)
  }

  return (
    <SceneShell<Co2StepId, Co2CueId>
      {...props}
      lesson="co2"
      timing={CO2_TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      validate={validate}
      rigScale={CO2_RIG_SCALE}
      glowPointsCapacity={48}
      debugName="co2"
    />
  )
}

function copyCamera(ctx: SceneFrameCtx, frame: Co2Frame): void {
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

function writeAtoms(world: SceneWorld, frame: Co2Frame): void {
  const dim = 1 - frame.fade * 0.6
  for (let i = 0; i < CO2_ATOMS.length; i++) {
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
  commitPool(world.atoms, CO2_ATOMS.length)
}

function writeBonds(world: SceneWorld, frame: Co2Frame): void {
  const dim = 1 - frame.fade * 0.6
  const b = frame.bond
  const polar = frame.fx.dipole
  for (let k = 0; k < CO2_BONDS.length; k++) {
    const def = CO2_BONDS[k]!
    writeBond(world.bonds, k, {
      a: frame.pos[def.a]!,
      b: frame.pos[def.b]!,
      radius: BOND_R[k]!,
      colorA: BOND_COLOR_A[k]!,
      colorB: BOND_COLOR_B[k]!,
      order: b.order[k]!,
      opacity: b.opacity[k]! * dim,
      form: b.form[k]!,
      stress: b.stress[k]!,
      thinning: b.thinning[k]!,
      // Разрывы в сцене симметричны: пара O=O уходит на две связи C–O, C–C и O–H рвутся поровну.
      split: 0,
      polarity: BOND_POLAR[k]! * polar,
    })
  }
  // π-связи: лепестки над и под осью (kit/bondVisual). Слот SCRATCH только переносит лепестки.
  for (let k = 0; k < frame.pi.length; k++) {
    const p = frame.pi[k]!
    if (p.amount <= 0.002) continue
    writeBondVisual(world, SCRATCH, frame.pos[p.a]!, frame.pos[p.b]!, 'double', 1, p.amount * dim, p.normal, { lobeSize: LOBE_SIZE })
  }
  writeBond(world.bonds, SCRATCH, { a: frame.pos[I_C0]!, b: frame.pos[I_OA]!, radius: 0, colorA: 0, colorB: 0, opacity: 0 })
  commitPool(world.bonds, BOND_SLOTS)
}

/** Векторы диполей двух связей C=O: точки от C к каждому O, над осью; сумма векторов — ноль. */
function drawPoints(ctx: SceneFrameCtx, frame: Co2Frame): void {
  const gp = ctx.points
  if (!gp) return
  gp.begin()
  const amount = frame.fx.dipole * (1 - frame.fade)
  if (amount > 0.01) {
    const c = frame.pos[I_C0]!
    for (let s = 0; s < 2; s++) {
      const o = frame.pos[s === 0 ? I_OA : I_OC]!
      _pa.copy(c)
      _pb.copy(o)
      _pa.y += DIPOLE_LIFT
      _pb.y += DIPOLE_LIFT
      for (let k = 1; k <= DIPOLE_DOTS; k++) {
        const u = k / (DIPOLE_DOTS + 1)
        const col = u < 0.5 ? DIPOLE_PLUS : DIPOLE_MINUS
        const flow = 0.5 + 0.5 * Math.sin(u * 14 - ctx.elapsed * 4)
        gp.push(
          _pa.x + (_pb.x - _pa.x) * u,
          _pa.y + (_pb.y - _pa.y) * u,
          _pa.z + (_pb.z - _pa.z) * u,
          0.05 + 0.02 * flow,
          col[0],
          col[1],
          col[2],
          amount * 0.85,
          0.35,
        )
      }
      // Наконечник у кислорода: две точки под углом к оси.
      const tx = _pa.x + (_pb.x - _pa.x) * 0.8
      const ty = _pa.y + (_pb.y - _pa.y) * 0.8
      const tz = _pa.z + (_pb.z - _pa.z) * 0.8
      gp.push(tx, ty + 0.06, tz, 0.06, DIPOLE_MINUS[0], DIPOLE_MINUS[1], DIPOLE_MINUS[2], amount * 0.9, 0.5)
      gp.push(tx, ty - 0.06, tz, 0.06, DIPOLE_MINUS[0], DIPOLE_MINUS[1], DIPOLE_MINUS[2], amount * 0.9, 0.5)
    }
  }
  gp.end()
}
