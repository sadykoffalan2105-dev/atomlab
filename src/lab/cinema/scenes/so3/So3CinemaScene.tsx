import { useCallback } from 'react'
import { commitPool, cpkHex, writeAtom, writeBond } from '../kit/cpkAtoms'
import { resetBondVisuals } from '../kit/bondVisual'
import { materialFor } from '../kit/materials'
import { buildSceneWorld, localizeSceneLabels, toSceneLocale, useSceneRuntime, type SceneWorld } from '../kit/sceneKit'
import { useLocale } from '../../../../i18n/useLocale'
import { SceneShell, type SceneFrameCtx } from '../kit/SceneShell'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import {
  createSo3Frame,
  sampleSo3Frame,
  SO3_ATOM_INDEX,
  SO3_ATOMS,
  SO3_BONDS,
  SO3_RIG_SCALE,
  SO3_SURFACE,
  SO3_SURFACE_Y,
  SO3_TIMING,
  validateSo3Storyboard,
  type So3CueId,
  type So3Frame,
  type So3StepId,
} from './so3Storyboard'
import { validateSo3Energetics } from './so3Energetics'

/**
 * Урок «контактный способ»: 2 SO₂ (г.) + O₂ (г.) ⇌ 2 SO₃ (г.) на V₂O₅, шесть шагов.
 * Построен по рецепту эталона NaCl.
 *
 * Здесь только РЕНДЕР кадра: всё общее (часы по шагам, контракт лаборатории
 * embryo → birth → complete, камера, прогрев, подписи) делает SceneShell.
 * Раскадровка — so3Storyboard.ts, энергия — so3Energetics.ts, тексты — so3MechanismText.*.
 *
 * Слои кадра (все из kit, ни одного числа химии):
 *   атомы (материал: gas → covalent у молекул, polar у кислорода катализатора), связи S–O полосой
 *   с пунктиром делокализации, O=O двойной полосой (натяжение и гомолиз), кольцо тримера S₃O₉,
 *   поверхность катализатора — сетка точек (схема, подписана формулой места V₂O₅ / V₂O₄).
 *   Огня, дыма, ореолов и волн нет — свет только сценический.
 */

const BOND_RADIUS = 0.05
const ATOM_COLOR: readonly number[] = SO3_ATOMS.map((a) => cpkHex(a.el))
const BOND_IDX: readonly (readonly [number, number])[] = SO3_BONDS.map((b) => [SO3_ATOM_INDEX.get(b.a)!, SO3_ATOM_INDEX.get(b.b)!] as const)
const BOND_COLOR: readonly (readonly [number, number])[] = BOND_IDX.map(([a, b]) => [ATOM_COLOR[a]!, ATOM_COLOR[b]!] as const)

/** Сетка поверхности катализатора: цвет — CPK ванадия (о каком веществе поверхность), 0…1. */
const V_HEX = cpkHex('V')
const SURFACE_COLOR = [((V_HEX >> 16) & 0xff) / 255, ((V_HEX >> 8) & 0xff) / 255, (V_HEX & 0xff) / 255] as const
const SURFACE_DOT = 0.036
const SURFACE_NX = Math.floor(SO3_SURFACE.halfX / SO3_SURFACE.step)
const SURFACE_NZ = Math.floor(SO3_SURFACE.halfZ / SO3_SURFACE.step)
const SURFACE_POINTS = (2 * SURFACE_NX + 1) * (2 * SURFACE_NZ + 1)

function createSo3World() {
  return buildSceneWorld({
    atoms: SO3_ATOMS.length,
    bonds: SO3_BONDS.length,
    glows: [] as const,
  })
}

export function So3CinemaScene(props: ScientificSynthesisFxProps) {
  // Мир и буфер кадра создаются один раз на прогон и дальше пишутся каждый кадр.
  const { world, frame } = useSceneRuntime(() => ({
    world: createSo3World(),
    frame: createSo3Frame(),
  }))

  // Язык 3D-подписей: «г./тв./пм/кДж» вместо g/s/pm/kJ.
  const sceneLocale = toSceneLocale(useLocale().locale)

  const validate = useCallback(() => {
    validateSo3Storyboard()
    validateSo3Energetics()
  }, [])

  // onFrame НЕ мемоизируем: SceneShell зовёт его из useFrame (см. kit/README, «Три правила»).
  const onFrame = (ctx: SceneFrameCtx) => {
    sampleSo3Frame(ctx.t, frame)
    // Числа 3D по локали: «141,98 пм» на ru/uz — как в панели урока.
    localizeSceneLabels(frame.labels, sceneLocale, true)
    resetBondVisuals(world)
    writeAtoms(world, frame)
    writeBonds(world, frame)
    drawPoints(ctx, frame)
    copyCamera(ctx, frame)
  }

  return (
    <SceneShell<So3StepId, So3CueId>
      {...props}
      lesson="so3"
      timing={SO3_TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      validate={validate}
      rigScale={SO3_RIG_SCALE}
      glowPointsCapacity={SURFACE_POINTS + 16}
      debugName="so3"
    />
  )
}

function copyCamera(ctx: SceneFrameCtx, frame: So3Frame): void {
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

function writeAtoms(world: SceneWorld, frame: So3Frame): void {
  const dim = 1 - frame.fade * 0.6
  for (let i = 0; i < SO3_ATOMS.length; i++) {
    writeAtom(world.atoms, i, {
      pos: frame.pos[i]!,
      radius: frame.radius[i]!,
      colorHex: ATOM_COLOR[i]!,
      charge: 0,
      emissive: frame.emissive[i]!,
      opacity: frame.opacity[i]! * dim,
      surface: materialFor(frame.material[i]!),
    })
  }
  commitPool(world.atoms, SO3_ATOMS.length)
}

function writeBonds(world: SceneWorld, frame: So3Frame): void {
  const b = frame.bond
  for (let k = 0; k < SO3_BONDS.length; k++) {
    const [ia, ib] = BOND_IDX[k]!
    const [ca, cb] = BOND_COLOR[k]!
    // Полоса связи: кратность 1 + 1/n — σ и делокализованная π (пунктир); O=O — две полосы;
    // разрыв O=O — симметричный (гомолиз), split = 0.
    writeBond(world.bonds, k, {
      a: frame.pos[ia]!,
      b: frame.pos[ib]!,
      radius: BOND_RADIUS,
      colorA: ca,
      colorB: cb,
      order: b.order[k]!,
      opacity: b.opacity[k]! * (1 - frame.fade * 0.6),
      stress: b.stress[k]!,
      thinning: b.thinning[k]!,
      split: 0,
    })
  }
  commitPool(world.bonds, SO3_BONDS.length)
}

/** Сетка точек поверхности катализатора (схема V₂O₅). Без аллокаций. */
function drawPoints(ctx: SceneFrameCtx, frame: So3Frame): void {
  const gp = ctx.points
  if (!gp) return
  gp.begin()
  const amt = frame.fx.surface * (1 - frame.fade)
  if (amt > 0.01) {
    const [r, g, bl] = SURFACE_COLOR
    for (let ix = -SURFACE_NX; ix <= SURFACE_NX; ix++) {
      for (let iz = -SURFACE_NZ; iz <= SURFACE_NZ; iz++) {
        gp.push(ix * SO3_SURFACE.step, SO3_SURFACE_Y, iz * SO3_SURFACE.step, SURFACE_DOT, r, g, bl, amt * 0.7, 0.1)
      }
    }
  }
  gp.end()
}
