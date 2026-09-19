import { useCallback } from 'react'
import * as THREE from 'three'
import { pulseAt } from '../../core/cues'
import { commitPool, cpkHex, writeAtom, writeBond } from '../kit/cpkAtoms'
import { drawElectron, drawElectronShell, drawFieldLine } from '../kit/electronFx'
import { buildSceneWorld, localizeSceneLabels, setGlow, setPuff, setWave, toSceneLocale, useSceneRuntime } from '../kit/sceneKit'
import { useLocale } from '../../../../i18n/useLocale'
import { SceneShell, type SceneFrameCtx } from '../kit/SceneShell'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import {
  CAO_ATOMS,
  CAO_BONDS,
  CAO_GEOM,
  CAO_RIG_SCALE,
  CAO_TIMING,
  createCaoFrame,
  sampleCaoFrame,
  validateCaoStoryboard,
  type CaoCueId,
  type CaoFrame,
  type CaoStepId,
} from './caoStoryboard'
import { validateCaoEnergetics } from './caoEnergetics'

/**
 * Урок «обжиг известняка»: CaCO₃ (тв.) → CaO (тв.) + CO₂ (г.), шесть шагов.
 *
 * Здесь только РЕНДЕР кадра: всё общее (часы по шагам, контракт лаборатории
 * embryo → birth → complete, камера, пост-обработка, качество) делает SceneShell
 * из общего набора scenes/kit. Раскадровка — caoStoryboard.ts, энергия —
 * caoEnergetics.ts, тексты — caoMechanismText.*.
 */

const COLOR = {
  edge: 0xffe0b8,
  kiln: 0xff8c2e,
  splitWave: 0xffd79a,
  slakeWave: 0xffc27a,
  cloud: 0xf2f6ff,
  warmGas: 0xffb066,
  flash: 0xfff1d6,
  shellHalo: 0x6fb4ff,
  electronHalo: 0x9ee4ff,
}

const BOND_RADIUS = 0.05
const OH_RADIUS = 0.034
const EDGE_RADIUS = 0.016

const ATOM_COLOR = CAO_ATOMS.map((a) => cpkHex(a.el))
const BOND_COLOR = CAO_BONDS.map((b) => {
  const ia = CAO_ATOMS.findIndex((a) => a.id === b.a)
  const ib = CAO_ATOMS.findIndex((a) => a.id === b.b)
  return [ATOM_COLOR[ia]!, ATOM_COLOR[ib]!] as const
})

const _p = new THREE.Vector3()

function createCaoWorld() {
  return buildSceneWorld({
    atoms: CAO_ATOMS.length,
    bonds: CAO_BONDS.length,
    glows: [
      { id: 'kiln', color: COLOR.kiln, radius: 2.2 },
      { id: 'shell', color: COLOR.shellHalo, radius: CAO_GEOM.radius.oIon * 2.1 },
      { id: 'e1', color: COLOR.electronHalo, radius: 0.22 },
      { id: 'e2', color: COLOR.electronHalo, radius: 0.22 },
      { id: 'cloud', color: COLOR.cloud, radius: 0.9 },
      { id: 'flash', color: COLOR.flash, kind: 'flash' },
    ] as const,
    waves: [
      { id: 'split', color: COLOR.splitWave, radius: 0.75 },
      { id: 'slake', color: COLOR.slakeWave, radius: 0.8 },
    ] as const,
    puffColor: COLOR.warmGas,
    puffSpread: 1.35,
  })
}

export function CaoCinemaScene(props: ScientificSynthesisFxProps) {
  // Мир, буфер кадра и время последних событий создаются один раз на прогон
  // и дальше пишутся каждый кадр — поэтому useSceneRuntime, см. kit/sceneKit.ts.
  const { world, frame, cueTimes } = useSceneRuntime(() => ({
    world: createCaoWorld(),
    frame: createCaoFrame(),
    cueTimes: new Map<CaoCueId, number>(),
  }))

  // Язык 3D-подписей: «тв./г./пм/кДж·моль⁻¹» вместо английских s/g/pm/kJ·mol⁻¹.
  const sceneLocale = toSceneLocale(useLocale().locale)

  const validate = useCallback(() => {
    validateCaoStoryboard()
    validateCaoEnergetics()
  }, [])

  // onFrame/onCue НЕ мемоизируем: SceneShell зовёт их из useFrame (см. kit/README).
  const onFrame = (ctx: SceneFrameCtx) => {
    sampleCaoFrame(ctx.t, frame)
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

  const onCue = (id: CaoCueId, ctx: SceneFrameCtx) => {
    cueTimes.set(id, ctx.t)
    switch (id) {
      case 'heat':
        fireAt(ctx, 'heat', frame.crystalCenter)
        break
      case 'split':
        fireAt(ctx, 'spark', frame.atoms.o0s!)
        break
      case 'escape':
        fireAt(ctx, 'gas', frame.atoms.c0!)
        break
      case 'slake':
        fireAt(ctx, 'slakeFx', frame.demoCenter)
        break
      case 'limewater':
        fireAt(ctx, 'cloud', frame.demoCenter)
        break
      default:
        break
    }
  }

  return (
    <SceneShell<CaoStepId, CaoCueId>
      {...props}
      lesson="cao"
      timing={CAO_TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      onCue={onCue}
      validate={validate}
      rigScale={CAO_RIG_SCALE}
      glowPointsCapacity={200}
      background="#0b0710"
      debugName="cao"
      bursts={[
        { id: 'heat', preset: 'fire', sizeScale: 1.4 },
        { id: 'spark', preset: 'spark', sizeScale: 0.7 },
        { id: 'gas', preset: 'dust', sizeScale: 1.1 },
        { id: 'slakeFx', preset: 'flash', sizeScale: 0.9 },
        { id: 'cloud', preset: 'dust', sizeScale: 1.2 },
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

function writeAtoms(pool: Parameters<typeof writeAtom>[0], frame: CaoFrame): void {
  const dim = 1 - frame.env.fade * 0.6
  for (let i = 0; i < CAO_ATOMS.length; i++) {
    const def = CAO_ATOMS[i]!
    writeAtom(pool, i, {
      pos: frame.atoms[def.id]!,
      radius: frame.radius[def.id]!,
      colorHex: ATOM_COLOR[i]!,
      charge: frame.charge[def.id]!,
      emissive: frame.emissive[def.id]!,
      opacity: frame.opacity[def.id]! * dim,
    })
  }
  commitPool(pool, CAO_ATOMS.length)
}

function writeBonds(pool: Parameters<typeof writeBond>[0], frame: CaoFrame): void {
  const dim = 1 - frame.env.fade * 0.6
  for (let i = 0; i < CAO_BONDS.length; i++) {
    const b = CAO_BONDS[i]!
    const [ca, cb] = BOND_COLOR[i]!
    const stress = frame.bondStress[i]!
    writeBond(pool, i, {
      a: frame.atoms[b.a]!,
      b: frame.atoms[b.b]!,
      radius: b.kind === 'edge' ? EDGE_RADIUS : b.kind === 'oh' ? OH_RADIUS : BOND_RADIUS,
      colorA: b.kind === 'edge' ? COLOR.edge : ca,
      colorB: b.kind === 'edge' ? COLOR.edge : cb,
      opacity: frame.bondOpacity[i]! * dim,
      stress,
      thinning: stress * 0.8,
      // Разрыв C–O ГЕТЕРОЛИТИЧЕСКИЙ: пара целиком уходит к кислороду (split → −1).
      split: b.kind === 'stay' ? -stress : 0,
      polarity: b.kind === 'stay' || b.kind === 'co2' || b.kind === 'carb' ? -0.35 : 0,
    })
  }
  commitPool(pool, CAO_BONDS.length)
}

function drawPoints(ctx: SceneFrameCtx, frame: CaoFrame): void {
  const gp = ctx.points
  if (!gp) return
  const elapsed = ctx.elapsed
  gp.begin()

  // Схематичная оболочка вокруг кислорода, забравшего электронную пару.
  drawElectronShell(gp, frame.atoms.o0s!, frame.radius.o0s! * 1.5, frame.shell, elapsed, { phase: 0.3 })

  // Электронная пара связи C–O: два электрона со следом.
  drawElectron(gp, frame.electrons[0], elapsed, { size: 0.22, trail: 10 })
  drawElectron(gp, frame.electrons[1], elapsed, { size: 0.22, trail: 10 })

  // Линии поля Ca²⁺ → O²⁻ в собранной решётке: заряды ±2, притяжение вчетверо
  // сильнее, чем в поваренной соли.
  if (frame.field > 0.02) {
    drawFieldLine(gp, frame.atoms.ca0!, frame.atoms.o0s!, frame.field, elapsed, { dots: 10 })
    drawFieldLine(gp, frame.atoms.ca1!, frame.atoms.o1s!, frame.field, elapsed, { dots: 10 })
  }

  // Помутнение известковой воды: облачко белых точек вокруг выпавшего CaCO₃.
  const cloud = frame.env.cloud
  if (cloud > 0.02) {
    const c = frame.demoCenter
    for (let k = 0; k < 26; k++) {
      const a = k * 2.399963 + elapsed * 0.35
      const r = 0.35 + 0.5 * (((k * 7919) % 71) / 71)
      gp.push(
        c.x + Math.cos(a) * r,
        c.y + Math.sin(a * 1.27) * r * 0.75,
        c.z + Math.sin(a * 0.63) * r,
        0.09,
        0.95,
        0.97,
        1.0,
        cloud * 0.4,
        0.25,
      )
    }
  }

  gp.end()
}

function updateGlows(
  world: ReturnType<typeof buildSceneWorld>,
  frame: CaoFrame,
  t: number,
  cueTimes: Map<CaoCueId, number>,
): void {
  setGlow(world, 'kiln', frame.crystalCenter, frame.env.kiln * 0.85)
  setGlow(world, 'shell', frame.atoms.o0s!, frame.shell * 0.5)
  setGlow(world, 'e1', frame.electrons[0].pos, frame.electrons[0].opacity * frame.electrons[0].glow * 0.7)
  setGlow(world, 'e2', frame.electrons[1].pos, frame.electrons[1].opacity * frame.electrons[1].glow * 0.7)
  setGlow(world, 'cloud', frame.demoCenter, frame.env.cloud * 0.6)

  const tSplit = cueTimes.get('split')
  const tSlake = cueTimes.get('slake')
  const tLime = cueTimes.get('limewater')
  const pSplit = tSplit != null ? pulseAt(t, tSplit, 0.5) : 0
  const pSlake = tSlake != null ? pulseAt(t, tSlake, 0.6) : 0
  if (pSlake > pSplit) _p.copy(frame.demoCenter)
  else _p.copy(frame.atoms.o0s!)
  setGlow(world, 'flash', _p, Math.max(pSplit * 0.55, pSlake * 0.75))

  setWave(world, 'split', frame.crystalCenter, tSplit != null && t >= tSplit ? Math.min(1, (t - tSplit) / 1.0) : 0)
  setWave(world, 'slake', frame.demoCenter, tSlake != null && t >= tSlake ? Math.min(1, (t - tSlake) / 0.9) : 0)

  // Тёплый объём: над кристаллом идёт углекислый газ, пока печь работает.
  _p.copy(frame.crystalCenter)
  _p.y += 0.55
  const gas = frame.env.kiln * 0.5 + (tLime != null && t >= tLime ? frame.env.cloud * 0.25 : 0)
  setPuff(world, _p, gas * (1 - frame.env.fade), { spread: 1.35, rise: 0.3, turbulence: 0.24 })
}
