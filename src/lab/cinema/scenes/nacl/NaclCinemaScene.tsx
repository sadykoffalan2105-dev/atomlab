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
  createNaclFrame,
  METAL_ATOMS,
  METAL_BONDS,
  NACL_ATOMS,
  NACL_EDGES,
  NACL_GEOM,
  NACL_RIG_SCALE,
  NACL_TIMING,
  sampleNaclFrame,
  validateNaclStoryboard,
  type NaclAtomId,
  type NaclCueId,
  type NaclFrame,
  type NaclStepId,
} from './naclStoryboard'
import { validateNaclEnergetics } from './naclEnergetics'

/**
 * Урок «ионная связь»: 2 Na (тв.) + Cl₂ (г.) → 2 NaCl (тв.), шесть шагов.
 *
 * Здесь только РЕНДЕР кадра: всё общее (часы по шагам, контракт лаборатории
 * embryo → birth → complete, камера, пост-обработка, качество) делает SceneShell
 * из общего набора scenes/kit. Раскадровка — naclStoryboard.ts, энергия —
 * naclEnergetics.ts, тексты — naclMechanismText.*.
 */

const COLOR = {
  metalBond: 0x9d8fd0,
  edge: 0xcfe4ff,
  exoHalo: 0xffb264,
  contactWave: 0xbff6ff,
  exoWave: 0xffc27a,
  warmGas: 0xffa858,
  flash: 0xfff1d6,
  shellHalo: 0x6fb4ff,
  electronHalo: 0x9ee4ff,
}

const BOND_RADIUS = 0.05
const EDGE_RADIUS = 0.016
const METAL_BOND_RADIUS = 0.022
/** Свободные электроны металла («электронный газ») — схематично, точками. */
const METAL_GAS_DOTS = 22

const ATOM_COLOR = new Map<NaclAtomId, number>(NACL_ATOMS.map((a) => [a.id, cpkHex(a.el)]))

const _p = new THREE.Vector3()

function createNaclWorld() {
  return buildSceneWorld({
    atoms: NACL_ATOMS.length,
    bonds: 1 + METAL_BONDS.length + NACL_EDGES.length,
    glows: [
      { id: 'shell1', color: COLOR.shellHalo, radius: NACL_GEOM.shellNa * 1.15 },
      { id: 'shell2', color: COLOR.shellHalo, radius: NACL_GEOM.shellNa * 1.15 },
      { id: 'e1', color: COLOR.electronHalo, radius: 0.3 },
      { id: 'e2', color: COLOR.electronHalo, radius: 0.3 },
      { id: 'exo', color: COLOR.exoHalo, radius: 0.9 },
      { id: 'flash', color: COLOR.flash, kind: 'flash' },
    ] as const,
    waves: [
      { id: 'contact', color: COLOR.contactWave, radius: 0.7 },
      { id: 'exo', color: COLOR.exoWave, radius: 1.3 },
    ] as const,
    puffColor: COLOR.warmGas,
  })
}

export function NaclCinemaScene(props: ScientificSynthesisFxProps) {
  // Мир, буфер кадра и время последних событий создаются один раз на прогон
  // и дальше пишутся каждый кадр — поэтому useSceneRuntime, см. kit/sceneKit.ts.
  const { world, frame, cueTimes } = useSceneRuntime(() => ({
    world: createNaclWorld(),
    frame: createNaclFrame(),
    cueTimes: new Map<NaclCueId, number>(),
  }))

  // Язык 3D-подписей: «тв./г./пм/кДж·моль⁻¹» вместо английских s/g/pm/kJ·mol⁻¹.
  const sceneLocale = toSceneLocale(useLocale().locale)

  const validate = useCallback(() => {
    validateNaclStoryboard()
    validateNaclEnergetics()
  }, [])

  // onFrame/onCue НЕ мемоизируем: SceneShell зовёт их из useFrame, а не держит
  // в зависимостях эффекта — зато пулы можно свободно писать 60 раз в секунду
  // (useCallback с изменяемым значением в зависимостях ловит react-hooks/immutability).
  const onFrame = (ctx: SceneFrameCtx) => {
    sampleNaclFrame(ctx.t, frame)
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

  const onCue = (id: NaclCueId, ctx: SceneFrameCtx) => {
    cueTimes.set(id, ctx.t)
    switch (id) {
      case 'sublimate':
        fireAt(ctx, 'sparkA', frame.atoms.na1)
        break
      case 'bondBreak':
        fireAt(ctx, 'sparkB', _p.copy(frame.atoms.clA).lerp(frame.atoms.clB, 0.5))
        break
      case 'transfer':
        fireAt(ctx, 'sparkA', frame.atoms.clA)
        fireAt(ctx, 'sparkB', frame.atoms.clB)
        break
      case 'exo':
        fireAt(ctx, 'exo', frame.cubeCenter)
        fireAt(ctx, 'flame', frame.cubeCenter)
        break
      default:
        break
    }
  }

  return (
    <SceneShell<NaclStepId, NaclCueId>
      {...props}
      lesson="nacl"
      timing={NACL_TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      onCue={onCue}
      validate={validate}
      rigScale={NACL_RIG_SCALE}
      glowPointsCapacity={220}
      debugName="nacl"
      bursts={[
        { id: 'sparkA', preset: 'spark', sizeScale: 0.7 },
        { id: 'sparkB', preset: 'spark', sizeScale: 0.7 },
        { id: 'exo', preset: 'flash', sizeScale: 1.1 },
        { id: 'flame', preset: 'fire', sizeScale: 1.2 },
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

function writeAtoms(pool: Parameters<typeof writeAtom>[0], frame: NaclFrame): void {
  const dim = 1 - frame.env.fade * 0.6
  for (let i = 0; i < NACL_ATOMS.length; i++) {
    const def = NACL_ATOMS[i]!
    writeAtom(pool, i, {
      pos: frame.atoms[def.id],
      radius: frame.radius[def.id],
      colorHex: ATOM_COLOR.get(def.id)!,
      charge: frame.charge[def.id],
      emissive: frame.emissive[def.id],
      opacity: frame.opacity[def.id] * dim,
    })
  }
  commitPool(pool, NACL_ATOMS.length)
}

function writeBonds(pool: Parameters<typeof writeBond>[0], frame: NaclFrame): void {
  const cl = cpkHex('Cl')
  // 0 — связь Cl–Cl: натяжение и СИММЕТРИЧНЫЙ (гомолитический) разрыв, split = 0.
  writeBond(pool, 0, {
    a: frame.atoms.clA,
    b: frame.atoms.clB,
    radius: BOND_RADIUS,
    colorA: cl,
    colorB: cl,
    opacity: frame.bond.opacity,
    stress: frame.bond.stress,
    thinning: frame.bond.split,
    split: 0,
  })

  let n = 1
  // Металлическая связь: центр ОЦК-ячейки с восемью соседями (КЧ 8).
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
  // Рёбра фрагмента решётки: тонкие направляющие Na⁺–Cl⁻.
  for (const [a, b] of NACL_EDGES) {
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

function drawPoints(ctx: SceneFrameCtx, frame: NaclFrame): void {
  const gp = ctx.points
  if (!gp) return
  const elapsed = ctx.elapsed
  gp.begin()

  // Электронный газ металла: точки дрейфуют внутри фрагмента — схематично.
  const metalA = frame.opacity[METAL_ATOMS[0]!.id]
  if (metalA > 0.02) {
    const c = frame.metalCenter
    const h = NACL_GEOM.metalHalf
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

  // Схематичная валентная оболочка 3s¹ у каждого натрия.
  drawElectronShell(gp, frame.atoms.na1, NACL_GEOM.shellNa, frame.shell.na1, elapsed, { phase: 0.2 })
  drawElectronShell(gp, frame.atoms.na2, NACL_GEOM.shellNa, frame.shell.na2, elapsed, { phase: -0.2 })

  // Электроны с хвостом.
  drawElectron(gp, frame.electrons[0], elapsed)
  drawElectron(gp, frame.electrons[1], elapsed)

  // Линии электростатического поля Na⁺ → Cl⁻ (закон Кулона).
  drawFieldLine(gp, frame.atoms.na1, frame.atoms.clA, frame.field, elapsed)
  drawFieldLine(gp, frame.atoms.na2, frame.atoms.clB, frame.field, elapsed)

  gp.end()
}

function updateGlows(
  world: ReturnType<typeof buildSceneWorld>,
  frame: NaclFrame,
  t: number,
  cueTimes: Map<NaclCueId, number>,
): void {
  const { glows, waves, puff } = world
  glows.shell1!.center.copy(frame.atoms.na1)
  glows.shell1!.amount = frame.shell.na1 * 0.55
  glows.shell2!.center.copy(frame.atoms.na2)
  glows.shell2!.amount = frame.shell.na2 * 0.55
  glows.e1!.center.copy(frame.electrons[0].pos)
  glows.e1!.amount = frame.electrons[0].opacity * frame.electrons[0].glow * 0.8
  glows.e2!.center.copy(frame.electrons[1].pos)
  glows.e2!.amount = frame.electrons[1].opacity * frame.electrons[1].glow * 0.8
  glows.exo!.center.copy(frame.cubeCenter)
  glows.exo!.amount = frame.env.exo * 0.9

  const tTransfer = cueTimes.get('transfer')
  const tContact = cueTimes.get('contact')
  const tExo = cueTimes.get('exo')
  const pTransfer = tTransfer != null ? pulseAt(t, tTransfer, 0.45) : 0
  const pExo = tExo != null ? pulseAt(t, tExo, 0.7) : 0
  if (pExo > pTransfer) glows.flash!.center.copy(frame.cubeCenter)
  else glows.flash!.center.copy(frame.atoms.clA).lerp(frame.atoms.clB, 0.5)
  glows.flash!.amount = Math.max(pTransfer * 0.6, pExo * 0.9)

  waves.contact!.center.copy(frame.cubeCenter)
  waves.contact!.amount = tContact != null && t >= tContact ? Math.min(1, (t - tContact) / 0.8) : 0
  waves.exo!.center.copy(frame.cubeCenter)
  waves.exo!.amount = tExo != null && t >= tExo ? Math.min(1, (t - tExo) / 1.1) : 0

  puff.center.copy(frame.cubeCenter)
  puff.opacity = frame.env.exo * 0.55 * (1 - frame.env.fade)
  puff.rise = 0.12
  puff.turbulence = 0.18
}
