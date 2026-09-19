import { useCallback } from 'react'
import * as THREE from 'three'
import { pulseAt } from '../../core/cues'
import { createLobePool, LobeKind, writeVec3, type LobePool } from '../../core/pools'
import { OrbitalLobes } from '../../react/OrbitalLobes'
import { commitPool, cpkHex, writeAtom, writeBond } from '../kit/cpkAtoms'
import { drawElectron, drawElectronShell, drawFieldLine, FX_COLOR } from '../kit/electronFx'
import { buildSceneWorld, localizeSceneLabels, toSceneLocale, useSceneRuntime } from '../kit/sceneKit'
import { SceneShell, type SceneFrameCtx } from '../kit/SceneShell'
import { useLocale } from '../../../../i18n/useLocale'
import type { GlowPointsHandle } from '../../react/CinemaGlowPoints'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import {
  createH2oFrame,
  H2O_ATOMS,
  H2O_GEOM,
  H2O_RIG_SCALE,
  H2O_TIMING,
  HBOND,
  LONE_PAIRS_A,
  LONE_PAIRS_B,
  OH_BONDS,
  REACTANT_BONDS,
  sampleH2oFrame,
  validateH2oStoryboard,
  type H2oAtomId,
  type H2oCueId,
  type H2oFrame,
  type H2oStepId,
} from './h2oStoryboard'
import { validateH2oEnergetics } from './h2oEnergetics'

/**
 * Урок «ковалентная полярная связь»: 2 H₂ (г.) + O₂ (г.) → 2 H₂O (г.), шесть шагов.
 *
 * Здесь только РЕНДЕР кадра: всё общее (часы по шагам, контракт лаборатории
 * embryo → birth → complete, камера, пост-обработка, качество) делает SceneShell
 * из общего набора scenes/kit. Раскадровка — h2oStoryboard.ts, энергия —
 * h2oEnergetics.ts, тексты — h2oMechanismText.*.
 *
 * Водородная связь НАРОЧНО нарисована пунктиром из точек, а не жгутом связи:
 * она межмолекулярная и в двадцать раз слабее ковалентной O–H.
 */

const COLOR = {
  exoHalo: 0xffb264,
  sparkWave: 0xbfe8ff,
  exoWave: 0xffc27a,
  warmGas: 0xffa858,
  flash: 0xfff1d6,
  shellHalo: 0x6fb4ff,
  electronHalo: 0x9ee4ff,
}

const OH_RADIUS = 0.028
const REACT_RADIUS = 0.03
/** Длина лепестка неподелённой пары, мировые единицы. */
const LOBE_SIZE = H2O_GEOM.radius.o * 1.55
const LOBE_COUNT = LONE_PAIRS_A.length + LONE_PAIRS_B.length

const ATOM_COLOR = new Map<H2oAtomId, number>(H2O_ATOMS.map((a) => [a.id, cpkHex(a.el)]))

const _p = new THREE.Vector3()
const _axis = new THREE.Vector3()

function createH2oWorld() {
  return buildSceneWorld({
    atoms: H2O_ATOMS.length,
    bonds: REACTANT_BONDS.length + OH_BONDS.length,
    glows: [
      { id: 'shellA', color: COLOR.shellHalo, radius: H2O_GEOM.shellO * 1.2 },
      { id: 'shellB', color: COLOR.shellHalo, radius: H2O_GEOM.shellO * 1.2 },
      { id: 'eA', color: COLOR.electronHalo, radius: 0.16 },
      { id: 'eB', color: COLOR.electronHalo, radius: 0.16 },
      { id: 'exo', color: COLOR.exoHalo, radius: 0.8 },
      { id: 'flash', color: COLOR.flash, kind: 'flash' },
    ] as const,
    waves: [
      { id: 'spark', color: COLOR.sparkWave, radius: 0.6 },
      { id: 'exo', color: COLOR.exoWave, radius: 1.1 },
    ] as const,
    puffColor: COLOR.warmGas,
  })
}

export function H2oCinemaScene(props: ScientificSynthesisFxProps) {
  // Мир, буфер кадра, пул лепестков и время последних событий создаются один раз
  // на прогон и дальше пишутся каждый кадр — поэтому useSceneRuntime.
  const { world, frame, lobes, cueTimes } = useSceneRuntime(() => ({
    world: createH2oWorld(),
    frame: createH2oFrame(),
    lobes: createLobePool(LOBE_COUNT),
    cueTimes: new Map<H2oCueId, number>(),
  }))

  // Язык 3D-подписей: «г./ж./пм/кДж·моль⁻¹» вместо английских g/l/pm/kJ·mol⁻¹.
  const sceneLocale = toSceneLocale(useLocale().locale)

  const validate = useCallback(() => {
    validateH2oStoryboard()
    validateH2oEnergetics()
  }, [])

  // onFrame/onCue НЕ мемоизируем: SceneShell зовёт их из useFrame.
  const onFrame = (ctx: SceneFrameCtx) => {
    sampleH2oFrame(ctx.t, frame)
    // Раскадровка чистая и пишет токены «{g}/{l}/{pm}/{kJ}/{kJmol}» — переводим их
    // НА МЕСТЕ, сразу после выборки кадра (массив подписей мутируется каждый кадр).
    localizeSceneLabels(frame.labels, sceneLocale)
    writeAtoms(world.atoms, frame)
    writeBonds(world.bonds, frame)
    writeLonePairs(lobes, frame)
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

  const onCue = (id: H2oCueId, ctx: SceneFrameCtx) => {
    cueTimes.set(id, ctx.t)
    switch (id) {
      case 'spark':
        fireAt(ctx, 'spark', frame.center)
        break
      case 'bondBreak':
        fireAt(ctx, 'sparkA', frame.midHHa)
        fireAt(ctx, 'sparkB', frame.midOO)
        break
      case 'pair':
        fireAt(ctx, 'sparkA', frame.atoms.o1)
        fireAt(ctx, 'sparkB', frame.atoms.o2)
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
    <SceneShell<H2oStepId, H2oCueId>
      {...props}
      lesson="h2o"
      timing={H2O_TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      onCue={onCue}
      validate={validate}
      rigScale={H2O_RIG_SCALE}
      glowPointsCapacity={200}
      debugName="h2o"
      bursts={[
        { id: 'spark', preset: 'spark', sizeScale: 0.5 },
        { id: 'sparkA', preset: 'spark', sizeScale: 0.45 },
        { id: 'sparkB', preset: 'spark', sizeScale: 0.45 },
        { id: 'exo', preset: 'flash', sizeScale: 0.8 },
        { id: 'flame', preset: 'fire', sizeScale: 0.9 },
      ]}
    >
      {/* Две неподелённые пары у каждого кислорода — полупрозрачные лепестки. */}
      <OrbitalLobes pool={lobes} time={world.visualTime} renderOrder={4} />
    </SceneShell>
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

function writeAtoms(pool: Parameters<typeof writeAtom>[0], frame: H2oFrame): void {
  const dim = 1 - frame.env.fade * 0.6
  for (let i = 0; i < H2O_ATOMS.length; i++) {
    const def = H2O_ATOMS[i]!
    writeAtom(pool, i, {
      pos: frame.atoms[def.id],
      radius: frame.radius[def.id],
      colorHex: ATOM_COLOR.get(def.id)!,
      charge: frame.charge[def.id],
      emissive: frame.emissive[def.id],
      opacity: frame.opacity[def.id] * dim,
    })
  }
  commitPool(pool, H2O_ATOMS.length)
}

function writeBonds(pool: Parameters<typeof writeBond>[0], frame: H2oFrame): void {
  const b = frame.bonds
  const dim = 1 - frame.env.fade
  let n = 0

  // Связи реагентов H–H и O=O: натяжение и СИММЕТРИЧНЫЙ (гомолитический) разрыв.
  for (const [a, c, order] of REACTANT_BONDS) {
    const col = ATOM_COLOR.get(a)!
    writeBond(pool, n++, {
      a: frame.atoms[a],
      b: frame.atoms[c],
      radius: REACT_RADIUS,
      colorA: col,
      colorB: ATOM_COLOR.get(c)!,
      order,
      opacity: b.reactantOpacity * dim,
      stress: b.stress,
      thinning: b.thinning,
      split: 0,
    })
  }

  // Ковалентные полярные связи O–H: a = водород, b = кислород, полярность > 0
  // означает смещение электронной плотности К b, то есть к кислороду.
  for (const [h, o] of OH_BONDS) {
    writeBond(pool, n++, {
      a: frame.atoms[h],
      b: frame.atoms[o],
      radius: OH_RADIUS,
      colorA: ATOM_COLOR.get(h)!,
      colorB: ATOM_COLOR.get(o)!,
      opacity: b.ohOpacity * dim,
      form: b.ohForm,
      polarity: b.ohPolarity,
    })
  }
  commitPool(pool, n)
}

/** Лепестки неподелённых пар: по две на каждый кислород, оси — из раскадровки. */
function writeLonePairs(pool: LobePool, frame: H2oFrame): void {
  const amount = frame.lobes * (1 - frame.env.fade)
  let n = 0
  for (const [id, dirs] of [
    ['o1', LONE_PAIRS_A],
    ['o2', LONE_PAIRS_B],
  ] as const) {
    const c = frame.atoms[id]
    for (const d of dirs) {
      writeVec3(pool.center, n, c.x, c.y, c.z)
      writeVec3(pool.axis, n, d[0], d[1], d[2])
      pool.size[n] = LOBE_SIZE
      pool.coef[n] = 1
      pool.kind[n] = LobeKind.lonePair
      // Заселённость 1 — это именно ПАРА электронов.
      pool.occupancy[n] = 1
      pool.opacity[n] = amount * 0.72
      n++
    }
  }
  commitPool(pool, amount > 0.01 ? n : 0)
}

/**
 * Облако ОБЩЕЙ электронной пары: точки вдоль связи H→O, смещённые к кислороду.
 * Именно это и означает «ковалентная полярная связь»: пара общая, но её центр
 * тяжести ближе к более электроотрицательному атому.
 */
function drawSharedPair(
  gp: GlowPointsHandle,
  h: THREE.Vector3,
  o: THREE.Vector3,
  amount: number,
  elapsed: number,
  pull: number,
): void {
  if (amount <= 0.01) return
  const dots = 9
  for (let k = 1; k < dots; k++) {
    const u = k / dots
    // Смещение к кислороду: чем больше pull, тем плотнее точки у b.
    const s = Math.pow(u, 1 - Math.min(0.6, pull))
    _p.copy(h).lerp(o, s)
    const near = 0.35 + 0.65 * s
    const flow = 0.6 + 0.4 * Math.sin(u * 9 - elapsed * 3.1)
    gp.push(
      _p.x,
      _p.y,
      _p.z,
      0.05 + 0.045 * near,
      FX_COLOR.shell[0],
      FX_COLOR.shell[1],
      FX_COLOR.shell[2],
      amount * near * flow * 0.62,
      0.35,
    )
  }
}

/** Неспаренный электрон радикала: одна пульсирующая точка у поверхности атома. */
function drawRadicalDot(
  gp: GlowPointsHandle,
  at: THREE.Vector3,
  radius: number,
  amount: number,
  elapsed: number,
  phase: number,
): void {
  if (amount <= 0.01) return
  const a = elapsed * 1.7 + phase
  _axis.set(Math.cos(a), Math.sin(a * 1.3), Math.sin(a * 0.8)).normalize()
  const pulse = 0.6 + 0.4 * Math.sin(elapsed * 6.1 + phase)
  gp.push(
    at.x + _axis.x * radius * 1.7,
    at.y + _axis.y * radius * 1.7,
    at.z + _axis.z * radius * 1.7,
    0.075 * pulse,
    FX_COLOR.electron[0],
    FX_COLOR.electron[1],
    FX_COLOR.electron[2],
    amount * pulse,
    0.8,
  )
}

function drawPoints(ctx: SceneFrameCtx, frame: H2oFrame): void {
  const gp = ctx.points
  if (!gp) return
  const elapsed = ctx.elapsed
  const dim = 1 - frame.env.fade
  gp.begin()

  // Валентная оболочка кислорода — схематичный знак «здесь внешние электроны».
  drawElectronShell(gp, frame.atoms.o1, H2O_GEOM.shellO, frame.shell * dim, elapsed, { phase: 0.2 })
  drawElectronShell(gp, frame.atoms.o2, H2O_GEOM.shellO, frame.shell * dim, elapsed, { phase: -0.4 })

  // Неспаренные электроны радикалов H· и O·.
  let phase = 0
  for (const a of H2O_ATOMS) {
    drawRadicalDot(gp, frame.atoms[a.id], frame.radius[a.id], frame.radicals * dim, elapsed, (phase += 1.1))
  }

  // Электроны, уходящие в общую пару.
  drawElectron(gp, frame.electrons[0], elapsed, { size: 0.16, trail: 12 })
  drawElectron(gp, frame.electrons[1], elapsed, { size: 0.16, trail: 12 })

  // Облако общих пар на всех четырёх связях O–H.
  for (const [h, o] of OH_BONDS) {
    drawSharedPair(gp, frame.atoms[h], frame.atoms[o], frame.cloud * dim, elapsed, frame.bonds.ohPolarity)
  }

  // Водородная связь: пунктир из точек от δ+ водорода к δ− кислороду соседа.
  drawFieldLine(gp, frame.atoms[HBOND[0]], frame.atoms[HBOND[1]], frame.bonds.hbond * dim, elapsed, { dots: 9 })

  gp.end()
}

function updateGlows(
  world: ReturnType<typeof buildSceneWorld>,
  frame: H2oFrame,
  t: number,
  cueTimes: Map<H2oCueId, number>,
): void {
  const { glows, waves, puff } = world
  glows.shellA!.center.copy(frame.atoms.o1)
  glows.shellA!.amount = frame.shell * 0.4
  glows.shellB!.center.copy(frame.atoms.o2)
  glows.shellB!.amount = frame.shell * 0.4
  glows.eA!.center.copy(frame.electrons[0].pos)
  glows.eA!.amount = frame.electrons[0].opacity * frame.electrons[0].glow * 0.7
  glows.eB!.center.copy(frame.electrons[1].pos)
  glows.eB!.amount = frame.electrons[1].opacity * frame.electrons[1].glow * 0.7
  glows.exo!.center.copy(frame.center)
  glows.exo!.amount = frame.env.exo * 0.9

  const tPair = cueTimes.get('pair')
  const tSpark = cueTimes.get('spark')
  const tExo = cueTimes.get('exo')
  const pPair = tPair != null ? pulseAt(t, tPair, 0.45) : 0
  const pExo = tExo != null ? pulseAt(t, tExo, 0.7) : 0
  if (pExo > pPair) glows.flash!.center.copy(frame.center)
  else glows.flash!.center.copy(frame.atoms.o1)
  glows.flash!.amount = Math.max(frame.env.spark * 0.8, pPair * 0.5, pExo * 0.9)

  waves.spark!.center.copy(frame.center)
  waves.spark!.amount = tSpark != null && t >= tSpark ? Math.min(1, (t - tSpark) / 0.9) : 0
  waves.exo!.center.copy(frame.center)
  waves.exo!.amount = tExo != null && t >= tExo ? Math.min(1, (t - tExo) / 1.1) : 0

  puff.center.copy(frame.center)
  puff.opacity = frame.env.exo * 0.55 * (1 - frame.env.fade)
  puff.rise = 0.14
  puff.turbulence = 0.2
}
