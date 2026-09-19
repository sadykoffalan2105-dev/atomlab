import { useCallback } from 'react'
import * as THREE from 'three'
import { pulseAt } from '../../core/cues'
import { commitPool, cpkHex, writeAtom, writeBond } from '../kit/cpkAtoms'
import { drawElectronShell, FX_COLOR } from '../kit/electronFx'
import { buildSceneWorld, localizeSceneLabels, toSceneLocale, useSceneRuntime } from '../kit/sceneKit'
import { useLocale } from '../../../../i18n/useLocale'
import { SceneShell, type SceneFrameCtx } from '../kit/SceneShell'
import type { GlowPointsHandle } from '../../react/CinemaGlowPoints'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import {
  createNh3Frame,
  FE_ATOMS,
  FE_BONDS,
  NH3_ATOMS,
  NH3_GEOM,
  NH3_RIG_SCALE,
  NH3_TIMING,
  SURFACE_NORMAL,
  sampleNh3Frame,
  validateNh3Storyboard,
  type Nh3AtomId,
  type Nh3CueId,
  type Nh3Frame,
  type Nh3StepId,
} from './nh3Storyboard'
import { validateNh3Energetics } from './nh3Energetics'

/**
 * Урок «синтез аммиака»: N₂ (г) + 3 H₂ (г) ⇌ 2 NH₃ (г), шесть шагов.
 *
 * Здесь только РЕНДЕР кадра: всё общее (часы по шагам, контракт лаборатории
 * embryo → birth → complete, камера, пост-обработка, качество) делает SceneShell
 * из общего набора scenes/kit. Раскадровка — nh3Storyboard.ts, энергия —
 * nh3Energetics.ts, тексты — nh3MechanismText.*.
 */

const COLOR = {
  feBond: 0xb07a52,
  adsBond: 0x7fd6ff,
  exoHalo: 0xffb264,
  exoWave: 0xffc27a,
  splitWave: 0xbfd8ff,
  warmGas: 0xffa858,
  flash: 0xfff1d6,
  piHalo: 0x6f8dff,
  lonePairHalo: 0x8fd0ff,
}

/** Голубое π-облако тройной связи. */
const PI_COLOR = [0.52, 0.62, 1.0] as const
/** Неподелённая пара азота — холодный «электронный» цвет. */
const LP_COLOR = FX_COLOR.electron
/** Кривая активации без катализатора — предупреждающе-тёплая. */
const EA_PLAIN_COLOR = [1.0, 0.62, 0.42] as const
/** Кривая активации на железе — спокойная зелёно-голубая. */
const EA_FE_COLOR = [0.5, 1.0, 0.76] as const
/** Прямая реакция — тёплая стрелка, обратная — холодная. */
const FWD_COLOR = [1.0, 0.82, 0.5] as const
const REV_COLOR = [0.62, 0.84, 1.0] as const

const NH_BOND_RADIUS = 0.028
const NN_BOND_RADIUS = 0.034
const FE_BOND_RADIUS = 0.016
const ADS_BOND_RADIUS = 0.012
/** Свободные электроны металла («электронный газ») — схематично, точками. */
const FE_GAS_DOTS = 18

/** Пары «водород → его азот» — по ним рисуются шесть связей N–H. */
const NH_PAIRS: readonly (readonly ['n1' | 'n2', 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'])[] = [
  ['n1', 'h1'],
  ['n1', 'h2'],
  ['n1', 'h5'],
  ['n2', 'h3'],
  ['n2', 'h4'],
  ['n2', 'h6'],
]

/** Три молекулы H₂ — три связи в пуле. */
const HH_PAIRS: readonly (readonly ['h1' | 'h3' | 'h5', 'h2' | 'h4' | 'h6'])[] = [
  ['h1', 'h2'],
  ['h3', 'h4'],
  ['h5', 'h6'],
]

const ATOM_COLOR = new Map<Nh3AtomId, number>(NH3_ATOMS.map((a) => [a.id, cpkHex(a.el)]))

/** Атом железа под каждым азотом — «якорь» донорно-акцепторной связи Fe←NH₃. */
const ANCHOR_FE: Record<'n1' | 'n2', Nh3AtomId> = {
  n1: nearestFe(-0.42),
  n2: nearestFe(0.42),
}

function nearestFe(u: number): Nh3AtomId {
  let best = FE_ATOMS[0]!
  for (const f of FE_ATOMS) {
    if (f.layer !== 0) continue
    if (Math.abs(f.u - u) + Math.abs(f.v - 0.25) < Math.abs(best.u - u) + Math.abs(best.v - 0.25)) best = f
  }
  return best.id
}

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _c = new THREE.Vector3()
const _n = new THREE.Vector3(SURFACE_NORMAL[0], SURFACE_NORMAL[1], SURFACE_NORMAL[2])

function createNh3World() {
  return buildSceneWorld({
    atoms: NH3_ATOMS.length,
    bonds: 1 + HH_PAIRS.length + NH_PAIRS.length + 2 + FE_BONDS.length,
    glows: [
      { id: 'pi', color: COLOR.piHalo, radius: 0.34 },
      { id: 'lpA', color: COLOR.lonePairHalo, radius: 0.22 },
      { id: 'lpB', color: COLOR.lonePairHalo, radius: 0.22 },
      { id: 'exo', color: COLOR.exoHalo, radius: 0.8 },
      { id: 'flash', color: COLOR.flash, kind: 'flash' },
    ] as const,
    waves: [
      { id: 'split', color: COLOR.splitWave, radius: 0.55 },
      { id: 'exo', color: COLOR.exoWave, radius: 1.2 },
    ] as const,
    puffColor: COLOR.warmGas,
  })
}

export function Nh3CinemaScene(props: ScientificSynthesisFxProps) {
  // Мир, буфер кадра и время последних событий создаются один раз на прогон
  // и дальше пишутся каждый кадр — поэтому useSceneRuntime, см. kit/sceneKit.ts.
  const { world, frame, cueTimes } = useSceneRuntime(() => ({
    world: createNh3World(),
    frame: createNh3Frame(),
    cueTimes: new Map<Nh3CueId, number>(),
  }))

  // Язык 3D-подписей: «г./пм/кДж·моль⁻¹» вместо английских g/pm/kJ·mol⁻¹.
  const sceneLocale = toSceneLocale(useLocale().locale)

  const validate = useCallback(() => {
    validateNh3Storyboard()
    validateNh3Energetics()
  }, [])

  // onFrame/onCue НЕ мемоизируем: SceneShell зовёт их из useFrame (см. kit/README).
  const onFrame = (ctx: SceneFrameCtx) => {
    sampleNh3Frame(ctx.t, frame)
    // Раскадровка чистая и пишет токены «{g}/{pm}/{kJmol}» — переводим их
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

  const onCue = (id: Nh3CueId, ctx: SceneFrameCtx) => {
    cueTimes.set(id, ctx.t)
    switch (id) {
      case 'adsorb':
        fireAt(ctx, 'sparkA', frame.nnMid)
        break
      case 'split':
        fireAt(ctx, 'sparkA', frame.nnMid)
        fireAt(ctx, 'sparkB', frame.nnMid)
        break
      case 'nh':
      case 'nh2':
      case 'nh3':
        fireAt(ctx, 'sparkA', frame.atoms.n1)
        fireAt(ctx, 'sparkB', frame.atoms.n2)
        break
      case 'exo':
        fireAt(ctx, 'exo', frame.center)
        fireAt(ctx, 'heat', frame.center)
        break
      default:
        break
    }
  }

  return (
    <SceneShell<Nh3StepId, Nh3CueId>
      {...props}
      lesson="nh3"
      timing={NH3_TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      onCue={onCue}
      validate={validate}
      rigScale={NH3_RIG_SCALE}
      glowPointsCapacity={240}
      debugName="nh3"
      bursts={[
        { id: 'sparkA', preset: 'spark', sizeScale: 0.55 },
        { id: 'sparkB', preset: 'spark', sizeScale: 0.55 },
        { id: 'exo', preset: 'flash', sizeScale: 1.0 },
        { id: 'heat', preset: 'fire', sizeScale: 1.0 },
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

function writeAtoms(pool: Parameters<typeof writeAtom>[0], frame: Nh3Frame): void {
  const dim = 1 - frame.env.fade * 0.6
  for (let i = 0; i < NH3_ATOMS.length; i++) {
    const def = NH3_ATOMS[i]!
    writeAtom(pool, i, {
      pos: frame.atoms[def.id],
      radius: frame.radius[def.id],
      colorHex: ATOM_COLOR.get(def.id)!,
      // Связь N–H полярная: на азоте δ−, на водороде δ+ (ЭО 3,04 против 2,20).
      charge: def.el === 'N' ? -0.35 * frame.nh.h1 : def.el === 'H' ? 0.35 * frame.nh.h1 : 0,
      emissive: frame.emissive[def.id],
      opacity: frame.opacity[def.id] * dim,
    })
  }
  commitPool(pool, NH3_ATOMS.length)
}

function writeBonds(pool: Parameters<typeof writeBond>[0], frame: Nh3Frame): void {
  const cN = cpkHex('N')
  const cH = cpkHex('H')
  const { atoms } = frame

  // 0 — тройная связь N≡N: кратность падает 3 → 0, разрыв ГОМОЛИТИЧЕСКИЙ (split = 0).
  writeBond(pool, 0, {
    a: atoms.n1,
    b: atoms.n2,
    radius: NN_BOND_RADIUS,
    colorA: cN,
    colorB: cN,
    order: frame.nn.order,
    opacity: frame.nn.opacity,
    stress: frame.nn.stress,
    thinning: frame.nn.thinning,
    split: 0,
  })

  let n = 1
  // Три связи H–H: тоже гомолиз, но заметно раньше — E = 436 против 945 кДж/моль.
  for (const [a, b] of HH_PAIRS) {
    writeBond(pool, n++, {
      a: atoms[a],
      b: atoms[b],
      radius: NH_BOND_RADIUS,
      colorA: cH,
      colorB: cH,
      opacity: frame.hh.opacity,
      stress: frame.hh.stress,
      thinning: frame.hh.thinning,
      split: 0,
    })
  }

  // Шесть связей N–H: общая пара смещена к азоту (polarity < 0 — плотность к A).
  for (const [nId, hId] of NH_PAIRS) {
    const form = frame.nh[hId]
    writeBond(pool, n++, {
      a: atoms[nId],
      b: atoms[hId],
      radius: NH_BOND_RADIUS,
      colorA: cN,
      colorB: cH,
      opacity: form,
      form,
      polarity: -0.5 * form,
    })
  }

  // Донорно-акцепторная связь Fe←NH₃ (через неподелённую пару азота): пунктир.
  for (const nId of ['n1', 'n2'] as const) {
    writeBond(pool, n++, {
      a: atoms[ANCHOR_FE[nId]],
      b: atoms[nId],
      radius: ADS_BOND_RADIUS,
      colorA: COLOR.feBond,
      colorB: COLOR.adsBond,
      order: 0.5,
      opacity: frame.adsBond,
    })
  }

  // Решётка катализатора: КЧ 8, в кадре показаны связи со вторым слоем.
  for (const [a, b] of FE_BONDS) {
    writeBond(pool, n++, {
      a: atoms[a],
      b: atoms[b],
      radius: FE_BOND_RADIUS,
      colorA: COLOR.feBond,
      colorB: COLOR.feBond,
      opacity: frame.feBond * frame.opacity[a],
    })
  }
  commitPool(pool, n)
}

// ─────────────────────────────────────────────────────────────────────────────
// Светящиеся точки: π-облака, неподелённые пары, кривые Eₐ, стрелки равновесия
// ─────────────────────────────────────────────────────────────────────────────

/**
 * π-облака тройной связи — ДВЕ «банановые» дуги точек по разные стороны оси N–N,
 * в двух взаимно перпендикулярных плоскостях. Это ЗНАК двух π-связей поверх
 * σ-связи, а не форма орбиталей (так и сказано в тексте урока).
 */
function drawPiCloud(gp: GlowPointsHandle, a: THREE.Vector3, b: THREE.Vector3, amount: number, elapsed: number): void {
  if (amount <= 0.01) return
  _a.copy(b).sub(a)
  const len = _a.length()
  if (len < 1e-5) return
  _a.divideScalar(len)
  _b.set(0, 0, 1).cross(_a)
  if (_b.lengthSq() < 1e-6) _b.set(0, 1, 0)
  _b.normalize()
  _c.copy(_a).cross(_b).normalize()
  const bulge = len * 0.42
  const dots = 7
  for (let plane = 0; plane < 2; plane++) {
    const dir = plane === 0 ? _b : _c
    for (let side = -1; side <= 1; side += 2) {
      for (let k = 0; k <= dots; k++) {
        const u = k / dots
        const s = Math.sin(Math.PI * u)
        const flow = 0.55 + 0.45 * Math.sin(u * 6.2 - elapsed * 2.2 + plane)
        const x = a.x + _a.x * len * u + dir.x * bulge * s * side
        const y = a.y + _a.y * len * u + dir.y * bulge * s * side
        const z = a.z + _a.z * len * u + dir.z * bulge * s * side
        gp.push(x, y, z, 0.055 + 0.02 * s, PI_COLOR[0], PI_COLOR[1], PI_COLOR[2], amount * flow * 0.75, 0.35)
      }
    }
  }
}

/** Неподелённая пара азота: два электрона в мягком облачке над вершиной пирамиды. */
function drawLonePair(
  gp: GlowPointsHandle,
  n: THREE.Vector3,
  dir: THREE.Vector3,
  amount: number,
  elapsed: number,
): void {
  if (amount <= 0.01) return
  _a.copy(n).addScaledVector(dir, NH3_GEOM.radius.n * 1.5)
  _b.set(-dir.y, dir.x, 0)
  if (_b.lengthSq() < 1e-6) _b.set(1, 0, 0)
  _b.normalize().multiplyScalar(0.055)
  const pulse = 0.72 + 0.28 * Math.sin(elapsed * 3.4)
  for (const side of [-1, 1]) {
    gp.push(
      _a.x + _b.x * side,
      _a.y + _b.y * side,
      _a.z + _b.z * side,
      0.085,
      LP_COLOR[0],
      LP_COLOR[1],
      LP_COLOR[2],
      amount * pulse,
      0.9,
    )
  }
  for (let k = 0; k < 10; k++) {
    const ang = (k / 10) * Math.PI * 2 + elapsed * 0.6
    gp.push(
      _a.x + Math.cos(ang) * 0.105,
      _a.y + Math.sin(ang) * 0.075,
      _a.z,
      0.04,
      LP_COLOR[0],
      LP_COLOR[1],
      LP_COLOR[2],
      amount * 0.3,
      0.25,
    )
  }
}

/**
 * Две кривые энергии активации: высокий барьер без катализатора (его высота —
 * энергия разрыва N≡N) и низкий барьер на железе. Уровни слева и справа у
 * кривых ОДИНАКОВЫЕ: катализатор не меняет ΔH реакции, только высоту барьера.
 */
function drawEaCurves(gp: GlowPointsHandle, amount: number, elapsed: number): void {
  if (amount <= 0.01) return
  const y0 = 0.34
  const y1 = 0.2
  const dots = 30
  for (let curve = 0; curve < 2; curve++) {
    const peak = curve === 0 ? 0.62 : 0.17
    const col = curve === 0 ? EA_PLAIN_COLOR : EA_FE_COLOR
    for (let k = 0; k <= dots; k++) {
      const s = k / dots
      const x = -1.3 + 2.6 * s
      const u = (s - 0.5) / 0.19
      const y = y0 + (y1 - y0) * s + peak * Math.exp(-(u * u))
      const flow = 0.55 + 0.45 * Math.sin(s * 9 - elapsed * 2.6 + curve * 1.6)
      gp.push(x, y, 0.02, 0.05, col[0], col[1], col[2], amount * (0.5 + 0.5 * flow), 0.3)
    }
  }
}

/** Стрелка из точек: дуга от a к b с наконечником; поток точек показывает направление. */
function drawFlowArrow(
  gp: GlowPointsHandle,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  bow: number,
  amount: number,
  elapsed: number,
  color: readonly [number, number, number],
  speed: number,
): void {
  if (amount <= 0.01) return
  const dots = 18
  for (let k = 0; k <= dots; k++) {
    const s = k / dots
    const x = ax + (bx - ax) * s
    const y = ay + (by - ay) * s + bow * Math.sin(Math.PI * s)
    const flow = 0.4 + 0.6 * Math.max(0, Math.sin(s * 7 - elapsed * speed))
    gp.push(x, y, 0.03, 0.045 + 0.02 * flow, color[0], color[1], color[2], amount * (0.35 + 0.65 * flow), 0.4)
  }
  // Наконечник: две короткие чёрточки у конца дуги.
  const dx = bx - ax
  const dy = by - ay
  const l = Math.hypot(dx, dy) || 1
  for (const side of [-1, 1]) {
    for (let k = 1; k <= 3; k++) {
      const back = 0.05 * k
      gp.push(
        bx - (dx / l) * back + (-dy / l) * back * side,
        by - (dy / l) * back + (dx / l) * back * side,
        0.03,
        0.05,
        color[0],
        color[1],
        color[2],
        amount * 0.85,
        0.5,
      )
    }
  }
}

function drawPoints(ctx: SceneFrameCtx, frame: Nh3Frame): void {
  const gp = ctx.points
  if (!gp) return
  const elapsed = ctx.elapsed
  const { atoms } = frame
  gp.begin()

  // Электронный газ металла: точки дрейфуют в слое железа — схематично.
  const feA = frame.opacity[FE_ATOMS[0]!.id]
  if (feA > 0.02) {
    for (let k = 0; k < FE_GAS_DOTS; k++) {
      const a = k * 2.399963 + elapsed * 0.45
      const u = Math.cos(a) * 1.15
      const v = 0.45 + Math.sin(a * 1.7) * 0.6
      gp.push(
        u,
        -0.62 + v * 0.4226 + 0.12 * Math.sin(a * 2.3) + _n.y * 0.05,
        v * -0.9063 + _n.z * 0.05,
        0.055,
        FX_COLOR.shell[0],
        FX_COLOR.shell[1],
        FX_COLOR.shell[2],
        feA * 0.4,
        0.25,
      )
    }
  }

  // Тройная связь: σ + 2π. Гаснет ровно тогда, когда связь слабеет на катализаторе.
  drawPiCloud(gp, atoms.n1, atoms.n2, frame.piCloud, elapsed)

  // Схематичная валентная оболочка вокруг азота, пока он «голый» на поверхности.
  const bare = Math.max(0, frame.nn.opacity < 0.5 ? 1 - frame.nh.h1 : 0)
  drawElectronShell(gp, atoms.n1, NH3_GEOM.radius.n * 1.9, bare * 0.5, elapsed, { dots: 16, phase: 0.3 })
  drawElectronShell(gp, atoms.n2, NH3_GEOM.radius.n * 1.9, bare * 0.5, elapsed, { dots: 16, phase: -0.3 })

  // Неподелённая пара у каждой готовой молекулы.
  drawLonePair(gp, atoms.n1, frame.lonePairDir, frame.lonePair, elapsed)
  drawLonePair(gp, atoms.n2, frame.lonePairDir, frame.lonePair, elapsed)

  // Шаг 2: два пути реакции — без катализатора и на железе.
  drawEaCurves(gp, frame.eaCurves, elapsed)

  // Шаг 5: реакция обратимая — прямая и обратная стрелки идут одновременно.
  drawFlowArrow(gp, -0.78, 0.92, 0.78, 0.92, 0.1, frame.eqArrows, elapsed, FWD_COLOR, 3.4)
  drawFlowArrow(gp, 0.78, 0.74, -0.78, 0.74, -0.1, frame.eqArrows * 0.7, elapsed, REV_COLOR, 2.2)

  gp.end()
}

function updateGlows(
  world: ReturnType<typeof buildSceneWorld>,
  frame: Nh3Frame,
  t: number,
  cueTimes: Map<Nh3CueId, number>,
): void {
  const { glows, waves, puff } = world
  glows.pi!.center.copy(frame.nnMid)
  glows.pi!.amount = frame.piCloud * 0.4

  _a.copy(frame.atoms.n1).addScaledVector(frame.lonePairDir, NH3_GEOM.radius.n * 1.5)
  glows.lpA!.center.copy(_a)
  glows.lpA!.amount = frame.lonePair * 0.4
  _a.copy(frame.atoms.n2).addScaledVector(frame.lonePairDir, NH3_GEOM.radius.n * 1.5)
  glows.lpB!.center.copy(_a)
  glows.lpB!.amount = frame.lonePair * 0.4

  glows.exo!.center.copy(frame.center)
  glows.exo!.amount = frame.env.exo * 0.85

  const tSplit = cueTimes.get('split')
  const tExo = cueTimes.get('exo')
  const pSplit = tSplit != null ? pulseAt(t, tSplit, 0.5) : 0
  const pExo = tExo != null ? pulseAt(t, tExo, 0.7) : 0
  if (pExo > pSplit) glows.flash!.center.copy(frame.center)
  else glows.flash!.center.copy(frame.nnMid)
  glows.flash!.amount = Math.max(pSplit * 0.7, pExo * 0.9)

  waves.split!.center.copy(frame.nnMid)
  waves.split!.amount = tSplit != null && t >= tSplit ? Math.min(1, (t - tSplit) / 0.9) : 0
  waves.exo!.center.copy(frame.center)
  waves.exo!.amount = tExo != null && t >= tExo ? Math.min(1, (t - tExo) / 1.1) : 0

  puff.center.copy(frame.center)
  puff.opacity = frame.env.exo * 0.5 * (1 - frame.env.fade)
  puff.rise = 0.14
  puff.turbulence = 0.2
}
