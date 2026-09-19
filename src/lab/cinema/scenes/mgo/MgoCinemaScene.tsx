import { useCallback } from 'react'
import * as THREE from 'three'
import { pulseAt } from '../../core/cues'
import { commitPool, cpkHex, writeAtom, writeBond } from '../kit/cpkAtoms'
import { drawElectron, drawElectronShell, drawFieldLine, FX_COLOR } from '../kit/electronFx'
import { buildSceneWorld, localizeSceneLabels, toSceneLocale, useSceneRuntime } from '../kit/sceneKit'
import { useLocale } from '../../../../i18n/useLocale'
import { SceneShell, type SceneFrameCtx } from '../kit/SceneShell'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import {
  createMgoFrame,
  METAL_ATOMS,
  METAL_BONDS,
  MGO_ATOMS,
  MGO_EDGES,
  MGO_GEOM,
  MGO_RIG_SCALE,
  MGO_TIMING,
  sampleMgoFrame,
  validateMgoStoryboard,
  type MgoAtomId,
  type MgoCueId,
  type MgoFrame,
  type MgoStepId,
} from './mgoStoryboard'
import { validateMgoEnergetics } from './mgoEnergetics'

/**
 * Урок «горение магния»: 2 Mg (тв.) + O₂ (г.) → 2 MgO (тв.), шесть шагов.
 *
 * Здесь только РЕНДЕР кадра: всё общее (часы по шагам, контракт лаборатории
 * embryo → birth → complete, камера, пост-обработка, качество) делает SceneShell
 * из общего набора scenes/kit. Раскадровка — mgoStoryboard.ts, энергия —
 * mgoEnergetics.ts, тексты — mgoMechanismText.*.
 *
 * Визуальная особенность урока — ослепительно-белое пламя: магний горит при
 * ≈ 3100 K, поэтому свет почти белый (у натрия в хлоре он жёлтый, линия D).
 * В тексте шага стоит предупреждение: смотреть на пламя напрямую нельзя.
 */

const COLOR = {
  metalBond: 0x9fe870,
  edge: 0xffdfe6,
  flameHalo: 0xfff4de,
  exoHalo: 0xffd9a0,
  contactWave: 0xbff6ff,
  exoWave: 0xfff0c8,
  whiteSmoke: 0xfff2e2,
  flash: 0xffffff,
  shellHalo: 0x8de06f,
  electronHalo: 0x9ee4ff,
}

const BOND_RADIUS = 0.05
const EDGE_RADIUS = 0.016
const METAL_BOND_RADIUS = 0.022
/** Свободные электроны металла («электронный газ») — схематично, точками. */
const METAL_GAS_DOTS = 24
/** Заряд иона для окраски кромки нормируем: пул ждёт −1…+1, а здесь ±2. */
const CHARGE_NORM = 0.5

const ATOM_COLOR = new Map<MgoAtomId, number>(MGO_ATOMS.map((a) => [a.id, cpkHex(a.el)]))

function createMgoWorld() {
  return buildSceneWorld({
    atoms: MGO_ATOMS.length,
    bonds: 1 + METAL_BONDS.length + MGO_EDGES.length,
    glows: [
      { id: 'shell1', color: COLOR.shellHalo, radius: MGO_GEOM.shellMg * 1.15 },
      { id: 'shell2', color: COLOR.shellHalo, radius: MGO_GEOM.shellMg * 1.15 },
      { id: 'e1', color: COLOR.electronHalo, radius: 0.28 },
      { id: 'e2', color: COLOR.electronHalo, radius: 0.28 },
      { id: 'flame', color: COLOR.flameHalo, radius: 1.25 },
      { id: 'exo', color: COLOR.exoHalo, radius: 0.9 },
      { id: 'flash', color: COLOR.flash, kind: 'flash' },
    ] as const,
    waves: [
      { id: 'contact', color: COLOR.contactWave, radius: 0.55 },
      { id: 'exo', color: COLOR.exoWave, radius: 1.1 },
    ] as const,
    puffColor: COLOR.whiteSmoke,
    puffSpread: 1.25,
  })
}

export function MgoCinemaScene(props: ScientificSynthesisFxProps) {
  // Мир, буфер кадра и время последних событий создаются один раз на прогон
  // и дальше пишутся каждый кадр — поэтому useSceneRuntime, см. kit/sceneKit.ts.
  const { world, frame, cueTimes } = useSceneRuntime(() => ({
    world: createMgoWorld(),
    frame: createMgoFrame(),
    cueTimes: new Map<MgoCueId, number>(),
  }))

  // Язык 3D-подписей: «тв./г./пм/кДж/моль» вместо английских s/g/pm/kJ/mol.
  const sceneLocale = toSceneLocale(useLocale().locale)

  const validate = useCallback(() => {
    validateMgoStoryboard()
    validateMgoEnergetics()
  }, [])

  // onFrame/onCue НЕ мемоизируем: SceneShell зовёт их из useFrame, а не держит
  // в зависимостях эффекта (см. правила react-hooks/immutability в kit/README).
  const onFrame = (ctx: SceneFrameCtx) => {
    sampleMgoFrame(ctx.t, frame)
    // Раскадровка чистая и пишет токены «{s}/{g}/{pm}/{kJmol}» — переводим их
    // НА МЕСТЕ, сразу после выборки кадра (массив подписей мутируется каждый кадр).
    localizeSceneLabels(frame.labels, sceneLocale)
    writeAtoms(world.atoms, frame)
    writeBonds(world.bonds, frame)
    drawPoints(ctx, frame)
    updateGlows(world, frame, ctx.t, cueTimes)

    const cam = ctx.camera
    cam.zoom = frame.camera.zoom
    cam.offset.copy(frame.camera.offset)
    cam.yaw = frame.camera.yaw
    cam.roll = frame.camera.roll
    cam.shake = frame.camera.shake
    cam.bloom = frame.camera.bloom
    cam.vignette = Math.max(frame.camera.vignette, frame.env.fade)
  }

  const onCue = (id: MgoCueId, ctx: SceneFrameCtx) => {
    cueTimes.set(id, ctx.t)
    switch (id) {
      case 'sublimate':
        fireAt(ctx, 'sparkA', frame.atoms.mg1)
        break
      case 'ignite':
        fireAt(ctx, 'ignite', frame.flameCenter)
        fireAt(ctx, 'flame', frame.flameCenter)
        break
      case 'bondBreak':
        fireAt(ctx, 'sparkB', frame.o2Center)
        break
      case 'transfer':
        fireAt(ctx, 'sparkA', frame.atoms.oA)
        fireAt(ctx, 'sparkB', frame.atoms.oB)
        break
      case 'exo':
        fireAt(ctx, 'ignite', frame.cubeCenter)
        fireAt(ctx, 'flame', frame.cubeCenter)
        break
      default:
        break
    }
  }

  return (
    <SceneShell<MgoStepId, MgoCueId>
      {...props}
      lesson="mgo"
      timing={MGO_TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      onCue={onCue}
      validate={validate}
      rigScale={MGO_RIG_SCALE}
      glowPointsCapacity={240}
      debugName="mgo"
      bursts={[
        { id: 'sparkA', preset: 'spark', sizeScale: 0.7 },
        { id: 'sparkB', preset: 'spark', sizeScale: 0.7 },
        { id: 'ignite', preset: 'flash', sizeScale: 1.35 },
        { id: 'flame', preset: 'fire', sizeScale: 1.25 },
      ]}
    />
  )
}

function fireAt(ctx: SceneFrameCtx, id: string, at: THREE.Vector3): void {
  const h = ctx.vfx(id)
  h?.node()?.position.copy(at)
  h?.fire()
}

// ─────────────────────────────────────────────────────────────────────────────
// Запись кадра в пулы
// ─────────────────────────────────────────────────────────────────────────────

function writeAtoms(pool: Parameters<typeof writeAtom>[0], frame: MgoFrame): void {
  const dim = 1 - frame.env.fade * 0.6
  for (let i = 0; i < MGO_ATOMS.length; i++) {
    const def = MGO_ATOMS[i]!
    writeAtom(pool, i, {
      pos: frame.atoms[def.id],
      radius: frame.radius[def.id],
      colorHex: ATOM_COLOR.get(def.id)!,
      // пул ждёт −1…+1, а степени окисления здесь ±2 — нормируем окраску кромки
      charge: frame.charge[def.id] * CHARGE_NORM,
      emissive: frame.emissive[def.id],
      opacity: frame.opacity[def.id] * dim,
    })
  }
  commitPool(pool, MGO_ATOMS.length)
}

function writeBonds(pool: Parameters<typeof writeBond>[0], frame: MgoFrame): void {
  const o = cpkHex('O')
  // 0 — ДВОЙНАЯ связь O=O: натяжение и СИММЕТРИЧНЫЙ (гомолитический) разрыв, split = 0.
  writeBond(pool, 0, {
    a: frame.atoms.oA,
    b: frame.atoms.oB,
    radius: BOND_RADIUS,
    colorA: o,
    colorB: o,
    order: 2,
    opacity: frame.bond.opacity,
    stress: frame.bond.stress,
    thinning: frame.bond.split,
    split: 0,
  })

  let n = 1
  // Металлическая связь: центр ГПУ-многогранника с двенадцатью соседями (КЧ 12).
  for (const [a, b] of METAL_BONDS) {
    const oa = frame.opacity[a]
    const ob = frame.opacity[b]
    writeBond(pool, n++, {
      a: frame.atoms[a],
      b: frame.atoms[b],
      radius: METAL_BOND_RADIUS,
      colorA: COLOR.metalBond,
      colorB: COLOR.metalBond,
      opacity: frame.metalBond * Math.min(oa, ob),
    })
  }
  // Рёбра фрагмента решётки: тонкие направляющие Mg²⁺–O²⁻.
  for (const [a, b] of MGO_EDGES) {
    writeBond(pool, n++, {
      a: frame.atoms[a],
      b: frame.atoms[b],
      radius: EDGE_RADIUS,
      colorA: COLOR.edge,
      colorB: COLOR.edge,
      opacity: frame.edges * Math.min(frame.opacity[a], frame.opacity[b]),
    })
  }
  commitPool(pool, n)
}

function drawPoints(ctx: SceneFrameCtx, frame: MgoFrame): void {
  const gp = ctx.points
  if (!gp) return
  const elapsed = ctx.elapsed
  gp.begin()

  // Электронный газ металла: точки дрейфуют внутри фрагмента — схематично.
  const metalA = frame.opacity[METAL_ATOMS[0]!.id]
  if (metalA > 0.02) {
    const c = frame.metalCenter
    const h = MGO_GEOM.radius.mg * 2.2
    for (let k = 0; k < METAL_GAS_DOTS; k++) {
      const a = k * 2.399963 + elapsed * 0.5
      const r = h * (0.35 + 0.6 * ((k * 7919) % 97) / 97)
      gp.push(
        c.x + Math.cos(a) * r,
        c.y + Math.sin(a * 1.3) * r * 0.8,
        c.z + Math.sin(a * 0.7) * r,
        0.07,
        FX_COLOR.shell[0],
        FX_COLOR.shell[1],
        FX_COLOR.shell[2],
        metalA * 0.45,
        0.3,
      )
    }
  }

  // Схематичная валентная оболочка 3s² у каждого магния (ДВА электрона — две дуги).
  drawElectronShell(gp, frame.atoms.mg1, MGO_GEOM.shellMg, frame.shell.mg1, elapsed, { phase: 0.2 })
  drawElectronShell(gp, frame.atoms.mg1, MGO_GEOM.shellMg * 0.78, frame.shell.mg1 * 0.75, elapsed, { phase: 1.6, dots: 20 })
  drawElectronShell(gp, frame.atoms.mg2, MGO_GEOM.shellMg, frame.shell.mg2, elapsed, { phase: -0.2 })
  drawElectronShell(gp, frame.atoms.mg2, MGO_GEOM.shellMg * 0.78, frame.shell.mg2 * 0.75, elapsed, { phase: -1.6, dots: 20 })

  // Четыре электрона с хвостами: по два с каждого атома магния.
  for (const el of frame.electrons) drawElectron(gp, el, elapsed)

  // Линии электростатического поля Mg²⁺ → O²⁻ (закон Кулона при зарядах ±2).
  drawFieldLine(gp, frame.atoms.mg1, frame.atoms.oA, frame.field, elapsed, { dots: 14 })
  drawFieldLine(gp, frame.atoms.mg2, frame.atoms.oB, frame.field, elapsed, { dots: 14 })

  gp.end()
}

function updateGlows(
  world: ReturnType<typeof buildSceneWorld>,
  frame: MgoFrame,
  t: number,
  cueTimes: Map<MgoCueId, number>,
): void {
  const { glows, waves, puff } = world
  glows.shell1!.center.copy(frame.atoms.mg1)
  glows.shell1!.amount = frame.shell.mg1 * 0.55
  glows.shell2!.center.copy(frame.atoms.mg2)
  glows.shell2!.amount = frame.shell.mg2 * 0.55
  glows.e1!.center.copy(frame.electrons[0].pos)
  glows.e1!.amount = frame.electrons[0].opacity * frame.electrons[0].glow * 0.7
  glows.e2!.center.copy(frame.electrons[2].pos)
  glows.e2!.amount = frame.electrons[2].opacity * frame.electrons[2].glow * 0.7

  // Белое пламя горящего магния: сперва у ленты, потом в центре кристалла.
  glows.flame!.center.copy(frame.flameCenter)
  glows.flame!.amount = frame.env.flame
  glows.exo!.center.copy(frame.cubeCenter)
  glows.exo!.amount = frame.env.exo * 0.9

  const tIgnite = cueTimes.get('ignite')
  const tTransfer = cueTimes.get('transfer')
  const tContact = cueTimes.get('contact')
  const tExo = cueTimes.get('exo')
  const pIgnite = tIgnite != null ? pulseAt(t, tIgnite, 0.8) : 0
  const pTransfer = tTransfer != null ? pulseAt(t, tTransfer, 0.45) : 0
  const pExo = tExo != null ? pulseAt(t, tExo, 0.7) : 0
  if (pIgnite >= pExo && pIgnite >= pTransfer) glows.flash!.center.copy(frame.flameCenter)
  else if (pExo > pTransfer) glows.flash!.center.copy(frame.cubeCenter)
  else glows.flash!.center.copy(frame.o2Center)
  glows.flash!.amount = Math.max(pIgnite, pTransfer * 0.6, pExo * 0.9)

  waves.contact!.center.copy(frame.cubeCenter)
  waves.contact!.amount = tContact != null && t >= tContact ? Math.min(1, (t - tContact) / 0.8) : 0
  waves.exo!.center.copy(frame.cubeCenter)
  waves.exo!.amount = tExo != null && t >= tExo ? Math.min(1, (t - tExo) / 1.1) : 0

  // Белый дым MgO над пламенем — тот самый белый порошок оксида магния.
  puff.center.copy(frame.flameCenter)
  puff.opacity = Math.max(frame.env.flame * 0.3, frame.env.exo * 0.5) * (1 - frame.env.fade)
  puff.rise = 0.16
  puff.turbulence = 0.2
}
