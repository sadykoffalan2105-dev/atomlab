import { useCallback } from 'react'
import { commitPool, cpkHex, writeAtom } from '../kit/cpkAtoms'
import { resetBondVisuals, writeBondVisual } from '../kit/bondVisual'
import { materialFor } from '../kit/materials'
import { buildSceneWorld, localizeSceneLabels, toSceneLocale, useSceneRuntime, type SceneWorld } from '../kit/sceneKit'
import { useLocale } from '../../../../i18n/useLocale'
import { SceneShell, type SceneFrameCtx } from '../kit/SceneShell'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import {
  createMn2o7Frame,
  MN2O7_ATOMS,
  MN2O7_BOND_ATOMS,
  MN2O7_BONDS,
  MN2O7_PI_BONDS,
  MN2O7_RIG_SCALE,
  MN2O7_TIMING,
  sampleMn2o7Frame,
  validateMn2o7Storyboard,
  type Mn2o7CueId,
  type Mn2o7Frame,
  type Mn2o7StepId,
} from './mn2o7Storyboard'
import { validateMn2o7Energetics } from './mn2o7Energetics'
import { Mn2o7LiquidDrop } from './Mn2o7LiquidDrop'
import { createLiquidDropState, writeLiquidDrop, type LiquidDropState } from './mn2o7LiquidDropState'

/**
 * Урок «высший оксид марганца»: 2 KMnO₄ + H₂SO₄ → Mn₂O₇ + K₂SO₄ + H₂O, шесть шагов (по эталону NaCl).
 *
 * Здесь только РЕНДЕР кадра: часы по шагам, контракт лаборатории embryo → birth → complete,
 * камеру, прогрев и подписи делает SceneShell. Раскадровка — mn2o7Storyboard.ts,
 * энергия — mn2o7Energetics.ts, тексты — mn2o7MechanismText.*.
 *
 * Слои кадра (все из kit, ни одного числа химии): атомы (K⁺ — ion, остальные — covalent),
 * σ-связи Mn–O / S–O / O–H, π-лепестки по доле порядка связи (MnO₄⁻ ¾, сульфат ½, Mn=O 1),
 * водородные связи пунктиром перед переходом протона, дуги поля K⁺ ··· анион, капля жидкого Mn₂O₇
 * с дихроизмом. Огня, дыма, ореолов и волн нет — свет только сценический.
 */

const BOND_RADIUS = 0.045
const ATOM_COLOR: readonly number[] = MN2O7_ATOMS.map((a) => cpkHex(a.el))
const ATOM_SURFACE = MN2O7_ATOMS.map((a) => materialFor(a.el === 'K' ? 'ion' : 'covalent'))
/** Слоты пула связей: сначала все связи раскадровки, затем «только лепестки» для π-долей. */
const PI_SLOT_BASE = MN2O7_BONDS.length
const BOND_SLOTS = PI_SLOT_BASE + MN2O7_PI_BONDS.length
/** Ёмкость π-лепестков: по две записи (по одной на атом) на каждую связь с π-долей. */
const LOBE_CAPACITY = 2 * MN2O7_PI_BONDS.length + 4

function createMn2o7World() {
  return buildSceneWorld({
    atoms: MN2O7_ATOMS.length,
    bonds: BOND_SLOTS,
    lobes: LOBE_CAPACITY,
    glows: [],
  })
}

export function Mn2o7CinemaScene(props: ScientificSynthesisFxProps) {
  // Мир, буфер кадра и состояние капли создаются один раз на прогон и дальше пишутся каждый кадр.
  const { world, frame, drop } = useSceneRuntime(() => ({
    world: createMn2o7World(),
    frame: createMn2o7Frame(),
    drop: createLiquidDropState() as LiquidDropState,
  }))

  const sceneLocale = toSceneLocale(useLocale().locale)

  const validate = useCallback(() => {
    validateMn2o7Storyboard()
    validateMn2o7Energetics()
  }, [])

  // onFrame НЕ мемоизируем: SceneShell зовёт его из useFrame (см. kit/README, «Три правила»).
  const onFrame = (ctx: SceneFrameCtx) => {
    sampleMn2o7Frame(ctx.t, frame)
    // Числа 3D по локали: «158,5 пм» на ru/uz — как в панели урока.
    localizeSceneLabels(frame.labels, sceneLocale, true)
    resetBondVisuals(world)
    writeAtoms(world, frame)
    writeBonds(ctx, world, frame)
    writeLiquidDrop(drop, frame.drop.pos, frame.drop.radius, frame.drop.opacity * (1 - frame.fade * 0.6))
    copyCamera(ctx, frame)
  }

  return (
    <SceneShell<Mn2o7StepId, Mn2o7CueId>
      {...props}
      lesson="mn2o7"
      timing={MN2O7_TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      validate={validate}
      rigScale={MN2O7_RIG_SCALE}
      glowPointsCapacity={120}
      debugName="mn2o7"
    >
      <Mn2o7LiquidDrop state={drop} />
    </SceneShell>
  )
}

function copyCamera(ctx: SceneFrameCtx, frame: Mn2o7Frame): void {
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

function writeAtoms(world: SceneWorld, frame: Mn2o7Frame): void {
  const dim = 1 - frame.fade * 0.6
  for (let i = 0; i < MN2O7_ATOMS.length; i++) {
    writeAtom(world.atoms, i, {
      pos: frame.pos[i]!,
      radius: frame.radius[i]!,
      colorHex: ATOM_COLOR[i]!,
      charge: frame.charge[i]!,
      emissive: frame.emissive[i]!,
      opacity: frame.opacity[i]! * dim,
      surface: ATOM_SURFACE[i]!,
    })
  }
  commitPool(world.atoms, MN2O7_ATOMS.length)
}

function writeBonds(ctx: SceneFrameCtx, world: SceneWorld, frame: Mn2o7Frame): void {
  const gp = ctx.points
  const elapsed = ctx.elapsed
  const dim = 1 - frame.fade
  if (gp) gp.begin()
  for (let b = 0; b < MN2O7_BONDS.length; b++) {
    const def = MN2O7_BONDS[b]!
    const [ia, ib] = MN2O7_BOND_ATOMS[b]!
    const amt = frame.bondAmount[b]! * dim
    if (def.kind === 'ionic') {
      // Ионная связь K⁺ ··· анион: трубки нет, только дуги поля (закон Кулона).
      writeBondVisual(world, b, frame.pos[ia]!, frame.pos[ib]!, 'ionic', 1, amt, undefined, { gp, elapsed })
    } else if (def.kind === 'hbond') {
      writeBondVisual(world, b, frame.pos[ia]!, frame.pos[ib]!, 'hbond', 1, amt)
    } else {
      writeBondVisual(world, b, frame.pos[ia]!, frame.pos[ib]!, 'sigma', 1, amt, undefined, {
        colorA: ATOM_COLOR[ia],
        colorB: ATOM_COLOR[ib],
        radius: BOND_RADIUS,
      })
    }
  }
  // π-доля порядка связи: только лепестки (трубка нулевого радиуса), амплитуда = доля × видимость.
  for (let k = 0; k < MN2O7_PI_BONDS.length; k++) {
    const b = MN2O7_PI_BONDS[k]!
    const [ia, ib] = MN2O7_BOND_ATOMS[b]!
    const amt = frame.bondAmount[b]! * frame.bondPi[b]! * dim
    writeBondVisual(world, PI_SLOT_BASE + k, frame.pos[ia]!, frame.pos[ib]!, 'double', 2, amt, undefined, { radius: 0 })
  }
  commitPool(world.bonds, BOND_SLOTS)
  if (gp) gp.end()
}
