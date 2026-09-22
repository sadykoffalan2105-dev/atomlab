import { useCallback } from 'react'
import * as THREE from 'three'
import { commitPool, cpkHex, writeAtom } from '../kit/cpkAtoms'
import { resetBondVisuals, writeBondVisual } from '../kit/bondVisual'
import { setCellEdgesAmount, writeCellEdges, type EdgePool } from '../kit/lattice'
import { materialFor } from '../kit/materials'
import { drawValenceCloud } from '../kit/valence'
import { buildSceneWorld, localizeSceneLabels, toSceneLocale, useSceneRuntime, type SceneWorld } from '../kit/sceneKit'
import { useLocale } from '../../../../i18n/useLocale'
import { SceneShell, type SceneFrameCtx } from '../kit/SceneShell'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import {
  createSio2Frame,
  HELIX_ATOMS,
  QUARTZ_FRAG,
  SI_CELL_EDGES,
  SIO2_ATOM_INDEX,
  SIO2_ATOMS,
  SIO2_BONDS,
  SIO2_RIG_SCALE,
  SIO2_TIMING,
  sampleSio2Frame,
  validateSio2Storyboard,
  type Sio2CueId,
  type Sio2Frame,
  type Sio2StepId,
} from './sio2Storyboard'
import { validateSio2Energetics } from './sio2Energetics'

/**
 * Урок «атомный кристалл и полярная связь»: Si (тв.) + O₂ (г.) → SiO₂ (тв.), шесть шагов.
 *
 * Здесь только РЕНДЕР кадра: часы по шагам, контракт лаборатории embryo → birth → complete,
 * камера, прогрев и подписи — в SceneShell. Раскадровка — sio2Storyboard.ts, энергия —
 * sio2Energetics.ts, тексты — sio2MechanismText.*.
 *
 * Слои кадра (все из kit, ни одного числа химии): атомы (материал по веществу: covalent/gas →
 * polar, кромка по знаку δ), σ-связи Si–Si и Si–O (полярность к O), O=O и C=O — σ + π-лепестки,
 * рёбра ячеек (сначала ячейка Si, потом 2×2×2 α-кварца), валентные точки O, пунктир рёбер
 * тетраэдра SiO₄ и спирали. Огня, дыма, ореолов и волн нет — свет только сценический.
 */

const BOND_RADIUS = 0.05
/** Полярность связи Si–O для полосы плотности (к O; параметр рисунка, знак — по электроотрицательности). */
const SIO_POLARITY = 0.3
/** Окраска кромки по знаку δ (доля, не заряд). */
const DELTA_TINT = 0.35

const ATOM_COLOR: readonly number[] = SIO2_ATOMS.map((a) => cpkHex(a.el))
const SI_COLOR = cpkHex('Si')
const O_COLOR = cpkHex('O')
const C_COLOR = cpkHex('C')
const I_O = [0, 1, 2, 3].map((j) => SIO2_ATOM_INDEX.get(`o${j}`)!)
const ZERO_OFFSET = [0, 0, 0] as const
const EDGE_CAPACITY = Math.max(QUARTZ_FRAG.cellEdges.length, SI_CELL_EDGES.length)
const EDGE_DIM_ON_FADE = 0.6
const LOBES = SIO2_BONDS.filter((b) => b.kind === 'double').length * 2
/** Валентные точки — кольцом Льюиса в плоскости экрана (камера шагов 2–3 смотрит вдоль −z). */
const FACING = new THREE.Vector3(0, 0, 1)
/** Пунктир направляющих: цвет подписи-размера, число точек на отрезке. */
const GUIDE_COLOR = [0.78, 0.92, 1] as const
const GUIDE_DOTS = 9
const GUIDE_SIZE = 0.034
/** Шесть рёбер тетраэдра O···O (пары сюжетных O). */
const TETRA_EDGES: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3],
].map(([a, b]) => [I_O[a]!, I_O[b]!] as const)

function createSio2World() {
  return buildSceneWorld({
    atoms: SIO2_ATOMS.length,
    bonds: SIO2_BONDS.length,
    lobes: Math.max(LOBES, 8),
    edges: EDGE_CAPACITY,
    glows: [] as const,
  })
}

/** Какой набор рёбер сейчас лежит в пуле: переписываем только при смене (без аллокаций в кадре). */
type EdgeSync = { set: 'si' | 'quartz' | '' }

function syncEdges(pool: EdgePool | undefined, sync: EdgeSync, frame: Sio2Frame): void {
  if (!pool) return
  if (sync.set !== frame.edgeSet) {
    if (frame.edgeSet === 'si') writeCellEdges(pool, SI_CELL_EDGES, ZERO_OFFSET)
    else writeCellEdges(pool, QUARTZ_FRAG.cellEdges, ZERO_OFFSET)
    sync.set = frame.edgeSet
  }
  setCellEdgesAmount(pool, frame.edges * (1 - frame.fade * EDGE_DIM_ON_FADE))
}

export function Sio2CinemaScene(props: ScientificSynthesisFxProps) {
  // Мир и буфер кадра создаются один раз на прогон и дальше пишутся каждый кадр.
  const { world, frame, edgeSync } = useSceneRuntime(() => ({
    world: createSio2World(),
    frame: createSio2Frame(),
    edgeSync: { set: '' } as EdgeSync,
  }))

  // Язык 3D-подписей: «тв./г./пм/кДж/моль/КЧ» вместо s/g/pm/kJ/mol/CN.
  const sceneLocale = toSceneLocale(useLocale().locale)

  const validate = useCallback(() => {
    validateSio2Storyboard()
    validateSio2Energetics()
  }, [])

  // onFrame НЕ мемоизируем: SceneShell зовёт его из useFrame (см. kit/README, «Три правила»).
  const onFrame = (ctx: SceneFrameCtx) => {
    sampleSio2Frame(ctx.t, frame)
    // Числа 3D по локали: «160,5 пм» на ru/uz — как в панели урока.
    localizeSceneLabels(frame.labels, sceneLocale, true)
    resetBondVisuals(world)
    writeAtoms(world, frame)
    writeBonds(world, frame)
    drawPoints(ctx, frame)
    syncEdges(world.edges, edgeSync, frame)
    copyCamera(ctx, frame)
  }

  return (
    <SceneShell<Sio2StepId, Sio2CueId>
      {...props}
      lesson="sio2"
      timing={SIO2_TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      validate={validate}
      rigScale={SIO2_RIG_SCALE}
      glowPointsCapacity={240}
      debugName="sio2"
    />
  )
}

function copyCamera(ctx: SceneFrameCtx, frame: Sio2Frame): void {
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

function writeAtoms(world: SceneWorld, frame: Sio2Frame): void {
  const dim = 1 - frame.fade * 0.6
  for (let i = 0; i < SIO2_ATOMS.length; i++) {
    writeAtom(world.atoms, i, {
      pos: frame.pos[i]!,
      radius: frame.radius[i]!,
      colorHex: ATOM_COLOR[i]!,
      charge: frame.delta[i]! * DELTA_TINT,
      emissive: frame.emissive[i]!,
      opacity: frame.opacity[i]! * dim,
      surface: materialFor(frame.material[i]!),
    })
  }
  commitPool(world.atoms, SIO2_ATOMS.length)
}

const OPTS_SISI = { colorA: SI_COLOR, colorB: SI_COLOR, radius: BOND_RADIUS }
const OPTS_OO = { colorA: O_COLOR, colorB: O_COLOR, radius: BOND_RADIUS }
const OPTS_CO = { colorA: C_COLOR, colorB: O_COLOR, radius: BOND_RADIUS }
const OPTS_SIO = { colorA: SI_COLOR, colorB: O_COLOR, radius: BOND_RADIUS, polarity: SIO_POLARITY }

function writeBonds(world: SceneWorld, frame: Sio2Frame): void {
  const dim = 1 - frame.fade * 0.6
  for (let s = 0; s < SIO2_BONDS.length; s++) {
    const b = SIO2_BONDS[s]!
    const amt = frame.bond[s]! * dim
    const pa = frame.pos[b.a]!
    const pb = frame.pos[b.b]!
    switch (b.group) {
      case 'siSi':
        writeBondVisual(world, s, pa, pb, 'sigma', 1, amt, undefined, OPTS_SISI)
        break
      case 'oo':
        writeBondVisual(world, s, pa, pb, 'double', 2, amt, undefined, OPTS_OO)
        break
      case 'co2':
        writeBondVisual(world, s, pa, pb, 'double', 2, amt, undefined, OPTS_CO)
        break
      default:
        writeBondVisual(world, s, pa, pb, 'sigma', 1, amt, undefined, OPTS_SIO)
    }
  }
  commitPool(world.bonds, SIO2_BONDS.length)
}

function drawPoints(ctx: SceneFrameCtx, frame: Sio2Frame): void {
  const gp = ctx.points
  if (!gp) return
  const elapsed = ctx.elapsed
  const live = 1 - frame.fade
  gp.begin()
  // Валентные электроны O точками: 6 у атома O(³P), 4 (две неподелённые пары) у мостикового O.
  for (let j = 0; j < 4; j++) {
    const v = frame.valence[j]!
    drawValenceCloud(gp, v.center, v.radius, v.count, v.amount * live, elapsed, { facing: FACING })
  }
  // Рёбра тетраэдра SiO₄ (O···O) — пунктир, подписан 'SiO₄'.
  if (frame.guides.tetra > 0.01) {
    for (let e = 0; e < TETRA_EDGES.length; e++) {
      const [a, b] = TETRA_EDGES[e]!
      drawDotted(gp, frame.pos[a]!, frame.pos[b]!, frame.guides.tetra * live)
    }
  }
  // Спиральная цепочка тетраэдров вокруг винтовой оси 3₂ — пунктир через атомы Si.
  if (frame.guides.helix > 0.01) {
    for (let k = 1; k < HELIX_ATOMS.length; k++) {
      drawDotted(gp, frame.pos[HELIX_ATOMS[k - 1]!]!, frame.pos[HELIX_ATOMS[k]!]!, frame.guides.helix * live * 0.85)
    }
  }
  gp.end()
}

/** Пунктир от a до b (точки, без концов — там атомы). Без аллокаций. */
function drawDotted(gp: NonNullable<SceneFrameCtx['points']>, a: THREE.Vector3, b: THREE.Vector3, amount: number): void {
  const [r, g, bl] = GUIDE_COLOR
  for (let k = 1; k < GUIDE_DOTS; k++) {
    const u = k / GUIDE_DOTS
    gp.push(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u, GUIDE_SIZE, r, g, bl, amount * 0.9, 0.35)
  }
}
