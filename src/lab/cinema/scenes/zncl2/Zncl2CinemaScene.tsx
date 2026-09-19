import { useCallback } from 'react'
import * as THREE from 'three'
import { pulseAt } from '../../core/cues'
import { commitPool, cpkHex, writeAtom, writeBond } from '../kit/cpkAtoms'
import { drawElectron, drawFieldLine, FX_COLOR } from '../kit/electronFx'
import { buildSceneWorld, localizeSceneLabels, toSceneLocale, useSceneRuntime } from '../kit/sceneKit'
import { useLocale } from '../../../../i18n/useLocale'
import { SceneShell, type SceneFrameCtx } from '../kit/SceneShell'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import {
  ZNCL2_ATOMS,
  ZNCL2_AQUA_BONDS,
  ZNCL2_GEOM,
  ZNCL2_H2_BOND,
  ZNCL2_METAL_BONDS,
  ZNCL2_OH_BONDS,
  ZNCL2_RIG_SCALE,
  ZNCL2_TIMING,
  createZncl2Frame,
  sampleZncl2Frame,
  validateZncl2Storyboard,
  type Zncl2AtomId,
  type Zncl2CueId,
  type Zncl2Frame,
  type Zncl2StepId,
} from './zncl2Storyboard'
import { validateZncl2Energetics } from './zncl2Energetics'

/**
 * Урок «получение водорода»: Zn (тв.) + 2 HCl (р-р) → ZnCl₂ (р-р) + H₂ (г.)↑.
 *
 * Здесь только РЕНДЕР кадра: всё общее (часы по шагам, контракт лаборатории
 * embryo → birth → complete, камера, пост-обработка, качество) делает SceneShell
 * из общего набора scenes/kit. Раскадровка — zncl2Storyboard.ts, энергия —
 * zncl2Energetics.ts, тексты — zncl2MechanismText.*.
 */

const COLOR = {
  metalBond: 0x8f93c0,
  aquaBond: 0x9fd8ff,
  hhBond: 0xf4f8ff,
  bubble: 0xcfefff,
  warmHalo: 0xffb264,
  flash: 0xfff1d6,
  electronHalo: 0x9ee4ff,
  h2Wave: 0xbff6ff,
  leaveWave: 0xa9b6ff,
}

const METAL_BOND_RADIUS = 0.016
const OH_BOND_RADIUS = 0.019
const HH_BOND_RADIUS = 0.023
const AQUA_BOND_RADIUS = 0.012

/** Свободные электроны металла («электронный газ») — схематично, точками. */
const METAL_GAS_DOTS = 26
/** Пузырёк рисуется тремя большими кругами точек — этого хватает, чтобы читалась сфера. */
const BUBBLE_RINGS = 3
const BUBBLE_DOTS = 22

const ATOM_COLOR = new Map<Zncl2AtomId, number>(ZNCL2_ATOMS.map((a) => [a.id, cpkHex(a.el)]))
const BUBBLE_RGB: readonly [number, number, number] = [0.78, 0.94, 1.0]

function createZncl2World() {
  return buildSceneWorld({
    atoms: ZNCL2_ATOMS.length,
    bonds: ZNCL2_METAL_BONDS.length + ZNCL2_OH_BONDS.length + ZNCL2_AQUA_BONDS.length + 1,
    glows: [
      { id: 'e1', color: COLOR.electronHalo, radius: 0.26 },
      { id: 'e2', color: COLOR.electronHalo, radius: 0.26 },
      { id: 'bubble', color: COLOR.bubble, radius: 0.55 },
      { id: 'warm', color: COLOR.warmHalo, radius: 1.1 },
      { id: 'flash', color: COLOR.flash, kind: 'flash' },
    ] as const,
    waves: [
      { id: 'h2', color: COLOR.h2Wave, radius: 0.5 },
      { id: 'leave', color: COLOR.leaveWave, radius: 0.8 },
    ] as const,
    puffColor: COLOR.warmHalo,
  })
}

export function Zncl2CinemaScene(props: ScientificSynthesisFxProps) {
  // Мир, буфер кадра и время последних событий создаются один раз на прогон
  // и дальше пишутся каждый кадр — поэтому useSceneRuntime, см. kit/sceneKit.ts.
  const { world, frame, cueTimes } = useSceneRuntime(() => ({
    world: createZncl2World(),
    frame: createZncl2Frame(),
    cueTimes: new Map<Zncl2CueId, number>(),
  }))

  // Язык 3D-подписей: «тв./р-р/пм/кДж/моль» вместо английских s/aq/pm/kJ·mol⁻¹.
  const sceneLocale = toSceneLocale(useLocale().locale)

  const validate = useCallback(() => {
    validateZncl2Storyboard()
    validateZncl2Energetics()
  }, [])

  // onFrame/onCue НЕ мемоизируем: SceneShell зовёт их из useFrame, а не держит
  // в зависимостях эффекта (см. комментарий в kit/README.md).
  const onFrame = (ctx: SceneFrameCtx) => {
    sampleZncl2Frame(ctx.t, frame)
    // Раскадровка чистая и пишет токены «{s}/{aq}/{pm}/{kJmol}» — переводим их
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

  const onCue = (id: Zncl2CueId, ctx: SceneFrameCtx) => {
    cueTimes.set(id, ctx.t)
    switch (id) {
      case 'electrons':
        fireAt(ctx, 'sparkA', frame.atoms.hA1)
        fireAt(ctx, 'sparkB', frame.atoms.hB1)
        break
      case 'h2form':
        fireAt(ctx, 'sparkA', frame.bubble.center)
        break
      case 'bubble':
        fireAt(ctx, 'bubble', frame.bubble.center)
        break
      case 'znLeave':
        fireAt(ctx, 'sparkB', frame.atoms.Z0)
        break
      case 'exo':
        fireAt(ctx, 'warm', frame.complexCenter)
        break
      default:
        break
    }
  }

  return (
    <SceneShell<Zncl2StepId, Zncl2CueId>
      {...props}
      lesson="zncl2"
      timing={ZNCL2_TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      onCue={onCue}
      validate={validate}
      rigScale={ZNCL2_RIG_SCALE}
      glowPointsCapacity={260}
      debugName="zncl2"
      bursts={[
        { id: 'sparkA', preset: 'spark', sizeScale: 0.6 },
        { id: 'sparkB', preset: 'spark', sizeScale: 0.6 },
        { id: 'bubble', preset: 'ion', sizeScale: 0.9 },
        { id: 'warm', preset: 'fire', sizeScale: 1.1 },
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

function writeAtoms(pool: Parameters<typeof writeAtom>[0], frame: Zncl2Frame): void {
  const dim = 1 - frame.env.fade * 0.6
  for (let i = 0; i < ZNCL2_ATOMS.length; i++) {
    const def = ZNCL2_ATOMS[i]!
    writeAtom(pool, i, {
      pos: frame.atoms[def.id],
      radius: frame.radius[def.id],
      colorHex: ATOM_COLOR.get(def.id)!,
      charge: frame.charge[def.id],
      emissive: frame.emissive[def.id],
      opacity: frame.opacity[def.id] * dim,
    })
  }
  commitPool(pool, ZNCL2_ATOMS.length)
}

function writeBonds(pool: Parameters<typeof writeBond>[0], frame: Zncl2Frame): void {
  const o = cpkHex('O')
  const h = cpkHex('H')
  const zn = cpkHex('Zn')
  let n = 0

  // Металлическая связь: ГПУ-фрагмент, 6 соседей в слое и 6 между слоями.
  for (const [a, b] of ZNCL2_METAL_BONDS) {
    writeBond(pool, n++, {
      a: frame.atoms[a],
      b: frame.atoms[b],
      radius: METAL_BOND_RADIUS,
      colorA: COLOR.metalBond,
      colorB: COLOR.metalBond,
      opacity: frame.metalBond * Math.min(frame.opacity[a], frame.opacity[b]),
    })
  }

  // Связи O–H. Две из них рвутся ГЕТЕРОЛИТИЧЕСКИ: пара остаётся у кислорода,
  // уходит голый протон — поэтому split смещён к кислороду, а не поровну.
  for (const bond of ZNCL2_OH_BONDS) {
    const breaking = bond.breaking ? (bond.o === 'oA' ? frame.protonBond.a : frame.protonBond.b) : null
    writeBond(pool, n++, {
      a: frame.atoms[bond.o],
      b: frame.atoms[bond.h],
      radius: OH_BOND_RADIUS,
      colorA: o,
      colorB: h,
      opacity: (breaking ? breaking.opacity : frame.waterBond) * frame.opacity[bond.o],
      stress: breaking ? breaking.stress : 0,
      thinning: breaking ? breaking.stress : 0,
      split: breaking ? -1 : 0,
      polarity: -0.55,
    })
  }

  // Донорно-акцепторные связи Zn²⁺ ← OH₂: аквакомплекс, КЧ 6.
  for (const bond of ZNCL2_AQUA_BONDS) {
    writeBond(pool, n++, {
      a: frame.atoms[bond.zn],
      b: frame.atoms[bond.o],
      radius: AQUA_BOND_RADIUS,
      colorA: zn,
      colorB: COLOR.aquaBond,
      opacity: frame.aquaBond * frame.opacity[bond.o],
      polarity: 0.8,
    })
  }

  // Ковалентная неполярная связь H–H — 74,14 пм.
  writeBond(pool, n++, {
    a: frame.atoms[ZNCL2_H2_BOND.a],
    b: frame.atoms[ZNCL2_H2_BOND.b],
    radius: HH_BOND_RADIUS,
    colorA: COLOR.hhBond,
    colorB: COLOR.hhBond,
    opacity: frame.h2Bond.opacity,
    form: 1 - frame.h2Bond.form,
  })

  commitPool(pool, n)
}

function drawPoints(ctx: SceneFrameCtx, frame: Zncl2Frame): void {
  const gp = ctx.points
  if (!gp) return
  const elapsed = ctx.elapsed
  gp.begin()

  // Электронный газ металла: точки дрейфуют внутри пластинки — схематично.
  if (frame.gas > 0.02) {
    const c = frame.plateCenter
    const spread = ZNCL2_GEOM.metal.a * 1.5
    for (let k = 0; k < METAL_GAS_DOTS; k++) {
      const a = k * 2.399963 + elapsed * 0.7
      const r = spread * (0.25 + 0.7 * ((k * 7919) % 97) / 97)
      gp.push(
        c.x + Math.sin(a * 0.8) * ZNCL2_GEOM.metal.layer * 0.9,
        c.y + Math.sin(a) * r,
        c.z + Math.cos(a * 1.3) * r * 0.6,
        0.065,
        FX_COLOR.shell[0],
        FX_COLOR.shell[1],
        FX_COLOR.shell[2],
        frame.gas * 0.5,
        0.3,
      )
    }
  }

  // Электроны с хвостом: идут по металлу к протонам.
  drawElectron(gp, frame.electrons[0], elapsed, { size: 0.26 })
  drawElectron(gp, frame.electrons[1], elapsed, { size: 0.26 })

  // Пузырёк водорода: три больших круга точек вокруг молекулы H₂.
  if (frame.bubble.opacity > 0.02) {
    const c = frame.bubble.center
    const r = frame.bubble.radius
    for (let ring = 0; ring < BUBBLE_RINGS; ring++) {
      const tilt = (ring / BUBBLE_RINGS) * Math.PI
      const ct = Math.cos(tilt)
      const st = Math.sin(tilt)
      for (let k = 0; k < BUBBLE_DOTS; k++) {
        const a = (k / BUBBLE_DOTS) * Math.PI * 2 + elapsed * 0.35 * (ring % 2 ? 1 : -1)
        const x = Math.cos(a) * r
        const y = Math.sin(a) * r * ct
        const z = Math.sin(a) * r * st
        const flow = 0.55 + 0.45 * Math.sin(a * 2 + elapsed * 1.6)
        gp.push(c.x + x, c.y + y, c.z + z, 0.055, BUBBLE_RGB[0], BUBBLE_RGB[1], BUBBLE_RGB[2], frame.bubble.opacity * flow * 0.55, 0.28)
      }
    }
  }

  // Ион-дипольное притяжение Zn²⁺ ← OH₂ (именно оно держит аквакомплекс).
  if (frame.field > 0.02) {
    for (const bond of ZNCL2_AQUA_BONDS) {
      drawFieldLine(gp, frame.atoms[bond.zn], frame.atoms[bond.o], frame.field, elapsed, { dots: 8 })
    }
  }

  gp.end()
}

function updateGlows(
  world: ReturnType<typeof buildSceneWorld>,
  frame: Zncl2Frame,
  t: number,
  cueTimes: Map<Zncl2CueId, number>,
): void {
  const { glows, waves, puff } = world
  glows.e1!.center.copy(frame.electrons[0].pos)
  glows.e1!.amount = frame.electrons[0].opacity * frame.electrons[0].glow * 0.75
  glows.e2!.center.copy(frame.electrons[1].pos)
  glows.e2!.amount = frame.electrons[1].opacity * frame.electrons[1].glow * 0.75
  glows.bubble!.center.copy(frame.bubble.center)
  glows.bubble!.amount = frame.bubble.opacity * 0.4
  glows.warm!.center.copy(frame.complexCenter)
  glows.warm!.amount = frame.env.warm * 0.65

  const tElectrons = cueTimes.get('electrons')
  const tH2 = cueTimes.get('h2form')
  const tLeave = cueTimes.get('znLeave')
  const tExo = cueTimes.get('exo')
  const pElectrons = tElectrons != null ? pulseAt(t, tElectrons, 0.4) : 0
  const pExo = tExo != null ? pulseAt(t, tExo, 0.7) : 0
  if (pExo > pElectrons) glows.flash!.center.copy(frame.complexCenter)
  else glows.flash!.center.copy(frame.surfacePoint)
  glows.flash!.amount = Math.max(pElectrons * 0.5, pExo * 0.85)

  waves.h2!.center.copy(frame.bubble.center)
  waves.h2!.amount = tH2 != null && t >= tH2 ? Math.min(1, (t - tH2) / 0.9) : 0
  waves.leave!.center.copy(frame.atoms.Z0)
  waves.leave!.amount = tLeave != null && t >= tLeave ? Math.min(1, (t - tLeave) / 1.1) : 0

  puff.center.copy(frame.complexCenter)
  puff.opacity = frame.env.warm * 0.4 * (1 - frame.env.fade)
  puff.rise = 0.1
  puff.turbulence = 0.16
}
