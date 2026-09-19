import { useCallback } from 'react'
import * as THREE from 'three'
import { pulseAt } from '../../core/cues'
import { bondPolarity } from '../../core/chem/bondOrder'
import { commitPool, cpkHex, writeAtom, writeBond } from '../kit/cpkAtoms'
import { drawElectron, drawElectronShell, sampleElectronJump } from '../kit/electronFx'
import { buildSceneWorld, localizeSceneLabels, setGlow, setPuff, setWave, toSceneLocale, useSceneRuntime } from '../kit/sceneKit'
import { useLocale } from '../../../../i18n/useLocale'
import { SceneShell, type SceneFrameCtx } from '../kit/SceneShell'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import {
  createSo2Frame,
  RING_BONDS,
  sampleSo2Frame,
  SO2_ATOMS,
  SO2_GEOM,
  SO2_RIG_SCALE,
  SO2_TIMING,
  so2ElectronSpec,
  validateSo2Storyboard,
  WATER_BONDS,
  type So2AtomId,
  type So2CueId,
  type So2Frame,
  type So2StepId,
} from './so2Storyboard'
import { validateSo2Energetics } from './so2Energetics'

/**
 * Урок «ковалентная полярная связь»: S (тв., ромб.) + O₂ (г.) → SO₂ (г.), шесть шагов.
 *
 * Здесь только РЕНДЕР кадра: часы по шагам, контракт лаборатории
 * embryo → birth → complete, камера, пост-обработка и качество делает SceneShell
 * из общего набора scenes/kit. Раскадровка — so2Storyboard.ts, энергия —
 * so2Energetics.ts, тексты — so2MechanismText.*.
 */

const COLOR = {
  /** горящая сера даёт СИНЕЕ пламя — это её визитная карточка */
  flame: 0x7fa6ff,
  flameHalo: 0x6d8dff,
  breakWave: 0xffd4a0,
  exoWave: 0x9fc4ff,
  exoHalo: 0xbcd4ff,
  flash: 0xeaf2ff,
  shellHalo: 0x6fb4ff,
  electronHalo: 0x9ee4ff,
  water: 0x58c8ff,
  catalyst: 0xffb25a,
  pi: [0.62, 0.78, 1] as const,
  lone: [0.75, 0.9, 1] as const,
  ghost: 0x9aa6c8,
}

const BOND_RADIUS = 0.055
const RING_BOND_RADIUS = 0.05
const WATER_BOND_RADIUS = 0.036
const GHOST_BOND_RADIUS = 0.042

/** Полярность связи S–O: плотность смещена к кислороду (χ 3,44 против 2,58). */
const SO_POLARITY = bondPolarity('S', 'O')

const ATOM_COLOR = new Map<So2AtomId, number>(SO2_ATOMS.map((a) => [a.id, cpkHex(a.el)]))

const _p = new THREE.Vector3()
const _q = new THREE.Vector3()

function createSo2World() {
  return buildSceneWorld({
    atoms: SO2_ATOMS.length,
    bonds: RING_BONDS.length + 1 + 3 + WATER_BONDS.length + 2,
    glows: [
      { id: 'shellS', color: COLOR.shellHalo, radius: SO2_GEOM.shellS * 1.2 },
      { id: 'e1', color: COLOR.electronHalo, radius: 0.28 },
      { id: 'e2', color: COLOR.electronHalo, radius: 0.28 },
      { id: 'flame', color: COLOR.flameHalo, radius: 1.05 },
      { id: 'exo', color: COLOR.exoHalo, radius: 0.85 },
      { id: 'solv', color: COLOR.water, radius: 0.8 },
      { id: 'cat', color: COLOR.catalyst, radius: 0.75 },
      { id: 'flash', color: COLOR.flash, kind: 'flash' },
    ] as const,
    waves: [
      { id: 'break', color: COLOR.breakWave, radius: 0.55 },
      { id: 'exo', color: COLOR.exoWave, radius: 1.2 },
    ] as const,
    puffColor: COLOR.flame,
    puffSpread: 1,
  })
}

export function So2CinemaScene(props: ScientificSynthesisFxProps) {
  // Мир, буфер кадра и время последних событий создаются один раз на прогон
  // и дальше пишутся каждый кадр — поэтому useSceneRuntime, см. kit/sceneKit.ts.
  const { world, frame, cueTimes } = useSceneRuntime(() => ({
    world: createSo2World(),
    frame: createSo2Frame(),
    cueTimes: new Map<So2CueId, number>(),
  }))

  // Язык 3D-подписей: «тв./г./пм/кДж·моль⁻¹» вместо английских s/g/pm/kJ·mol⁻¹.
  const sceneLocale = toSceneLocale(useLocale().locale)

  const validate = useCallback(() => {
    validateSo2Storyboard()
    validateSo2Energetics()
  }, [])

  // onFrame/onCue НЕ мемоизируем: SceneShell зовёт их из useFrame (см. kit/README).
  const onFrame = (ctx: SceneFrameCtx) => {
    sampleSo2Frame(ctx.t, frame)
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
    cam.vignette = Math.max(frame.camera.vignette, frame.fade)
  }

  const onCue = (id: So2CueId, ctx: SceneFrameCtx) => {
    cueTimes.set(id, ctx.t)
    switch (id) {
      case 'flame':
        fireAt(ctx, 'flame', frame.crownCenter)
        break
      case 'ringOpen':
        fireAt(ctx, 'sparkA', _p.copy(frame.atoms.s0).lerp(frame.atoms.s1, 0.5))
        break
      case 'sFree':
        fireAt(ctx, 'sparkA', _p.copy(frame.atoms.s0).lerp(frame.atoms.s7, 0.5))
        break
      case 'o2Break':
        fireAt(ctx, 'sparkB', frame.o2Mid)
        break
      case 'bond1':
        fireAt(ctx, 'sparkB', frame.atoms.oa)
        break
      case 'bond2':
        fireAt(ctx, 'sparkB', frame.atoms.ob)
        break
      case 'exo':
        fireAt(ctx, 'exo', frame.center)
        fireAt(ctx, 'flame', frame.center)
        break
      default:
        break
    }
  }

  return (
    <SceneShell<So2StepId, So2CueId>
      {...props}
      lesson="so2"
      timing={SO2_TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      onCue={onCue}
      validate={validate}
      rigScale={SO2_RIG_SCALE}
      glowPointsCapacity={260}
      debugName="so2"
      bursts={[
        { id: 'sparkA', preset: 'spark', sizeScale: 0.7 },
        { id: 'sparkB', preset: 'spark', sizeScale: 0.8 },
        { id: 'exo', preset: 'flash', sizeScale: 1.1 },
        { id: 'flame', preset: 'fire', sizeScale: 1.15 },
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

function writeAtoms(pool: Parameters<typeof writeAtom>[0], frame: So2Frame): void {
  const dim = 1 - frame.fade * 0.6
  for (let i = 0; i < SO2_ATOMS.length; i++) {
    const def = SO2_ATOMS[i]!
    writeAtom(pool, i, {
      pos: frame.atoms[def.id],
      radius: frame.radius[def.id],
      colorHex: ATOM_COLOR.get(def.id)!,
      emissive: frame.emissive[def.id],
      opacity: frame.opacity[def.id] * dim,
    })
  }
  commitPool(pool, SO2_ATOMS.length)
}

function writeBonds(pool: Parameters<typeof writeBond>[0], frame: So2Frame): void {
  const s = cpkHex('S')
  const o = cpkHex('O')
  const h = cpkHex('H')
  const c = cpkHex('C')
  let n = 0

  // Кольцо S₈: восемь одинарных связей S–S; две из них рвутся гомолитически.
  for (let k = 0; k < RING_BONDS.length; k++) {
    const [a, b] = RING_BONDS[k]!
    writeBond(pool, n++, {
      a: frame.atoms[a],
      b: frame.atoms[b],
      radius: RING_BOND_RADIUS,
      colorA: s,
      colorB: s,
      order: 1,
      opacity: frame.ring.opacity[k]!,
      stress: frame.ring.stress[k]!,
      thinning: frame.ring.thinning[k]!,
      split: 0,
    })
  }

  // Двойная связь O=O: натяжение и СИММЕТРИЧНЫЙ (гомолитический) разрыв.
  writeBond(pool, n++, {
    a: frame.atoms.oa,
    b: frame.atoms.ob,
    radius: BOND_RADIUS,
    colorA: o,
    colorB: o,
    order: 2,
    opacity: frame.oo.opacity,
    stress: frame.oo.stress,
    thinning: frame.oo.thinning,
    split: 0,
  })

  // Связи S–O: порядок 2 (школьная O=S=O) → 1,5 после делокализации π-плотности.
  writeBond(pool, n++, {
    a: frame.atoms.s0,
    b: frame.atoms.oa,
    radius: BOND_RADIUS,
    colorA: s,
    colorB: o,
    order: frame.so.order,
    opacity: frame.so.a,
    form: frame.so.formA,
    polarity: SO_POLARITY,
  })
  writeBond(pool, n++, {
    a: frame.atoms.s0,
    b: frame.atoms.ob,
    radius: BOND_RADIUS,
    colorA: s,
    colorB: o,
    order: frame.so.order,
    opacity: frame.so.b,
    form: frame.so.formB,
    polarity: SO_POLARITY,
  })
  // Третья связь — только на кадре «2 SO₂ + O₂ ⇌ 2 SO₃».
  writeBond(pool, n++, {
    a: frame.atoms.s0,
    b: frame.atoms.oc,
    radius: BOND_RADIUS,
    colorA: s,
    colorB: o,
    order: frame.so.order,
    opacity: frame.so.c,
    form: frame.so.c,
    polarity: SO_POLARITY,
  })

  // Молекулы воды на кадре растворения.
  for (const [a, b] of WATER_BONDS) {
    writeBond(pool, n++, {
      a: frame.atoms[a],
      b: frame.atoms[b],
      radius: WATER_BOND_RADIUS,
      colorA: o,
      colorB: h,
      order: 1,
      opacity: frame.waterBond,
      polarity: bondPolarity('H', 'O'),
    })
  }

  // Призрак CO₂ для сравнения формы (линейная, 180°).
  writeBond(pool, n++, {
    a: frame.atoms.cc,
    b: frame.atoms.cq,
    radius: GHOST_BOND_RADIUS,
    colorA: c,
    colorB: COLOR.ghost,
    order: 2,
    opacity: frame.co2Bond,
  })
  writeBond(pool, n++, {
    a: frame.atoms.cc,
    b: frame.atoms.cr,
    radius: GHOST_BOND_RADIUS,
    colorA: c,
    colorB: COLOR.ghost,
    order: 2,
    opacity: frame.co2Bond,
  })

  commitPool(pool, n)
}

// ─────────────────────────────────────────────────────────────────────────────
// Светящиеся точки: электроны, неподелённая пара, π-облако, пламя, вода
// ─────────────────────────────────────────────────────────────────────────────

function drawPoints(ctx: SceneFrameCtx, frame: So2Frame): void {
  const gp = ctx.points
  if (!gp) return
  const elapsed = ctx.elapsed
  const dim = 1 - frame.fade
  gp.begin()

  // Синее пламя горящей серы — поднимающиеся точки над короной.
  drawFlame(gp, frame.crownCenter, frame.flame * dim, elapsed)

  // Схематичная валентная оболочка серы (3s² 3p⁴): «здесь внешние электроны».
  drawElectronShell(gp, frame.atoms.s0, SO2_GEOM.shellS, frame.shellS * dim, elapsed, { dots: 30 })

  // Пара электронов, которая становится общей: один идёт от серы, второй от кислорода.
  const spec = so2ElectronSpec(ctx.t)
  const donor = frame.atoms[spec.donor]
  const acceptor = frame.atoms[spec.acceptor]
  sampleElectronJump(frame.electrons[0]!, ctx.t, {
    donor,
    acceptor,
    shellRadius: SO2_GEOM.shellS,
    acceptorRadius: frame.radius[spec.acceptor],
    leave: spec.leave,
    arrive: spec.arrive,
    arcSign: 1,
    arcHeight: 0.22,
  })
  sampleElectronJump(frame.electrons[1]!, ctx.t, {
    donor: acceptor,
    acceptor: donor,
    shellRadius: frame.radius[spec.acceptor] * 1.6,
    acceptorRadius: frame.radius[spec.donor],
    leave: spec.leave,
    arrive: spec.arrive,
    arcSign: -1,
    arcHeight: 0.22,
  })
  drawElectron(gp, frame.electrons[0]!, elapsed)
  drawElectron(gp, frame.electrons[1]!, elapsed)

  // Неподелённая пара на сере — две точки там, где нет связи (и куда потом встанет O).
  drawLonePair(gp, frame.atoms.s0, frame.lonePair * dim, elapsed)

  // Делокализованное π-облако над и под плоскостью молекулы.
  drawPiCloud(gp, frame.atoms.s0, frame.atoms.oa, frame.atoms.ob, frame.pi * dim, elapsed)

  // Вода вокруг молекулы на кадре растворения.
  drawSolvation(gp, frame.center, frame.solvation * dim, elapsed)

  gp.end()
}

type Pusher = NonNullable<SceneFrameCtx['points']>

function drawFlame(gp: Pusher, center: THREE.Vector3, amount: number, elapsed: number): void {
  if (amount <= 0.01) return
  const dots = 34
  for (let k = 0; k < dots; k++) {
    const seed = (k * 7919) % 101
    const u = ((seed / 101 + elapsed * 0.42) % 1)
    const a = k * 2.399963 + elapsed * 0.7
    const spread = 0.55 * (1 - u * 0.55)
    const x = center.x + Math.cos(a) * spread
    const y = center.y - 0.35 + u * 1.5
    const z = center.z + Math.sin(a) * spread * 0.7
    const fade = Math.sin(Math.PI * u)
    gp.push(x, y, z, 0.1 + 0.07 * fade, 0.5, 0.66, 1, amount * fade * 0.7, 0.35)
  }
}

function drawLonePair(gp: Pusher, s: THREE.Vector3, amount: number, elapsed: number): void {
  if (amount <= 0.01) return
  const d = SO2_GEOM.lonePairDistance
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * 3.1)
  const [r, g, b] = COLOR.lone
  for (const dz of [-0.06, 0.06]) {
    gp.push(s.x + dz * 1.6, s.y - d, s.z + dz, 0.13 + 0.03 * pulse, r, g, b, amount, 0.9)
  }
  // мягкое облако вокруг пары
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + elapsed * 0.6
    gp.push(
      s.x + Math.cos(a) * 0.13,
      s.y - d + Math.sin(a) * 0.09,
      s.z + Math.sin(a * 1.7) * 0.06,
      0.07,
      r,
      g,
      b,
      amount * 0.45 * (0.6 + 0.4 * Math.sin(a * 3 - elapsed * 2)),
      0.3,
    )
  }
}

function drawPiCloud(
  gp: Pusher,
  s: THREE.Vector3,
  oa: THREE.Vector3,
  ob: THREE.Vector3,
  amount: number,
  elapsed: number,
): void {
  if (amount <= 0.01) return
  const [r, g, b] = COLOR.pi
  const dots = 15
  for (const side of [-1, 1]) {
    for (let k = 0; k < dots; k++) {
      const u = k / (dots - 1)
      if (u < 0.5) _p.copy(oa).lerp(s, u * 2)
      else _p.copy(s).lerp(ob, (u - 0.5) * 2)
      // небольшой «подъём» наружу от серы, чтобы облако обнимало обе связи
      _q.copy(_p).sub(s)
      if (_q.lengthSq() > 1e-6) _p.addScaledVector(_q.normalize(), 0.05)
      const taper = Math.sin(Math.PI * Math.min(1, Math.max(0, u * 1.1 - 0.05)))
      const flow = 0.55 + 0.45 * Math.sin(u * 9 - elapsed * 2.6 + side)
      gp.push(
        _p.x,
        _p.y,
        _p.z + side * (0.1 + 0.08 * taper),
        0.085 + 0.03 * taper,
        r,
        g,
        b,
        amount * taper * flow * 0.72,
        0.3,
      )
    }
  }
}

function drawSolvation(gp: Pusher, center: THREE.Vector3, amount: number, elapsed: number): void {
  if (amount <= 0.01) return
  const dots = 26
  for (let k = 0; k < dots; k++) {
    const a = (k / dots) * Math.PI * 2 + elapsed * 0.35
    const rr = 0.72 + 0.1 * Math.sin(a * 3 + elapsed)
    gp.push(
      center.x + Math.cos(a) * rr,
      center.y + Math.sin(a) * rr * 0.72,
      center.z + Math.sin(a * 2.1) * 0.2,
      0.075,
      0.38,
      0.78,
      1,
      amount * 0.55 * (0.5 + 0.5 * Math.sin(a * 4 - elapsed * 2.2)),
      0.3,
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ореолы, волны и тёплый газ
// ─────────────────────────────────────────────────────────────────────────────

function updateGlows(
  world: ReturnType<typeof buildSceneWorld>,
  frame: So2Frame,
  t: number,
  cueTimes: Map<So2CueId, number>,
): void {
  setGlow(world, 'shellS', frame.atoms.s0, frame.shellS * 0.5)
  setGlow(world, 'e1', frame.electrons[0]!.pos, frame.electrons[0]!.opacity * frame.electrons[0]!.glow * 0.7)
  setGlow(world, 'e2', frame.electrons[1]!.pos, frame.electrons[1]!.opacity * frame.electrons[1]!.glow * 0.7)
  setGlow(world, 'flame', frame.crownCenter, frame.flame * 0.8)
  setGlow(world, 'exo', frame.center, frame.exo * 0.85)
  setGlow(world, 'solv', frame.center, frame.solvation * 0.5)
  setGlow(world, 'cat', frame.center, frame.catalyst * 0.45)

  const tBreak = cueTimes.get('o2Break')
  const tExo = cueTimes.get('exo')
  const pBreak = tBreak != null ? pulseAt(t, tBreak, 0.5) : 0
  const pExo = tExo != null ? pulseAt(t, tExo, 0.75) : 0
  if (pExo > pBreak) setGlow(world, 'flash', frame.center, pExo * 0.9)
  else setGlow(world, 'flash', frame.o2Mid, pBreak * 0.6)

  setWave(world, 'break', frame.o2Mid, tBreak != null && t >= tBreak ? Math.min(1, (t - tBreak) / 0.75) : 0)
  setWave(world, 'exo', frame.center, tExo != null && t >= tExo ? Math.min(1, (t - tExo) / 1.1) : 0)

  // Тёплый газ: над горящей короной на первом шаге, над молекулой — на итоговом.
  const puffAtCrown = frame.flame > frame.exo
  setPuff(world, puffAtCrown ? frame.crownCenter : frame.center, Math.max(frame.flame * 0.5, frame.exo * 0.45) * (1 - frame.fade), {
    rise: 0.16,
    turbulence: 0.2,
  })
}
