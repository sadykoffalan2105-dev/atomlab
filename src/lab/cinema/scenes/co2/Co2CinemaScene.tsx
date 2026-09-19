import { useCallback } from 'react'
import * as THREE from 'three'
import { pulseAt } from '../../core/cues'
import type { GlowPointsHandle } from '../../react/CinemaGlowPoints'
import { commitPool, cpkHex, writeAtom, writeBond } from '../kit/cpkAtoms'
import { FX_COLOR } from '../kit/electronFx'
import { buildSceneWorld, localizeSceneLabels, setGlow, setPuff, setWave, toSceneLocale, useSceneRuntime } from '../kit/sceneKit'
import { useLocale } from '../../../../i18n/useLocale'
import { SceneShell, type SceneFrameCtx } from '../kit/SceneShell'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import {
  BACKGROUND_O2,
  BREAKING_BONDS,
  CO2_ATOMS,
  CO2_GEOM,
  CO2_RIG_SCALE,
  CO2_TIMING,
  GRAPHITE_BONDS,
  createCo2Frame,
  sampleCo2Frame,
  validateCo2Storyboard,
  type Co2AtomId,
  type Co2CueId,
  type Co2Frame,
  type Co2StepId,
} from './co2Storyboard'
import { validateCo2Energetics } from './co2Energetics'

/**
 * Урок «горение угля»: C (графит) + O₂ (г.) → CO₂ (г.), шесть шагов.
 *
 * Здесь только РЕНДЕР кадра: всё общее (часы по шагам, контракт лаборатории
 * embryo → birth → complete, камера, пост-обработка, качество) делает SceneShell
 * из общего набора scenes/kit. Раскадровка — co2Storyboard.ts, энергия —
 * co2Energetics.ts, тексты — co2MechanismText.*.
 *
 * Что рисуется точками пула CinemaGlowPoints (один draw call):
 *   • sp-гибридные лепестки на углероде — две противоположные «капли» по оси молекулы;
 *   • два π-облака в ПЕРПЕНДИКУЛЯРНЫХ плоскостях, растянутые над всей O=C=O;
 *   • стрелки дипольных моментов связей δ+ → δ− и знак их взаимного гашения;
 *   • раскалённый газ над углём.
 * Всё это СХЕМАТИЧНО — знак области повышенной электронной плотности,
 * а не изоповерхность волновой функции; так и сказано в тексте урока.
 */

const COLOR = {
  /** осветлённый углеродный серый: по CPK углерод почти чёрный и на ночном фоне пропадает */
  graphiteBond: 0x6d6d7a,
  heatHalo: 0xff9a4d,
  exoHalo: 0xffb264,
  breakWave: 0xbff6ff,
  exoWave: 0xffc27a,
  warmGas: 0xffa858,
  flash: 0xfff1d6,
  bondHalo: 0x9ee4ff,
  coWarn: 0xff7a5c,
}

/** Цвета эффектов в формате пула точек (линейные 0…1). */
const FX = {
  sp: [0.62, 0.86, 1.0] as const,
  pi: [0.72, 0.58, 1.0] as const,
  dipolePlus: [1.0, 0.74, 0.52] as const,
  dipoleMinus: [0.56, 0.86, 1.0] as const,
  heat: [1.0, 0.64, 0.34] as const,
}

const BOND_RADIUS = 0.045
const GRAPHITE_BOND_RADIUS = 0.022
/**
 * Кратность связи C–C в графите 4/3: в слое делокализована одна π-система
 * на три связи. Шейдер полос рисует это как сплошную полосу + редкий пунктир.
 */
const GRAPHITE_BOND_ORDER = 4 / 3

const ATOM_COLOR = new Map<Co2AtomId, number>(CO2_ATOMS.map((a) => [a.id, cpkHex(a.el)]))
const O_COLOR = cpkHex('O')
const C_COLOR = cpkHex('C')
const H_COLOR = cpkHex('H')

/** Сколько слотов пула занимают именованные атомы; дальше идут фоновые O₂. */
const BG_ATOM_BASE = CO2_ATOMS.length
const BG_ATOM_COUNT = BACKGROUND_O2.length * 2

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _p1 = new THREE.Vector3()
const _p2 = new THREE.Vector3()
const _pt = new THREE.Vector3()

function createCo2World() {
  return buildSceneWorld({
    atoms: BG_ATOM_BASE + BG_ATOM_COUNT,
    bonds: GRAPHITE_BONDS.length + BREAKING_BONDS.length + 1 + 2 + 1 + 2 + BACKGROUND_O2.length,
    glows: [
      { id: 'heat', color: COLOR.heatHalo, radius: 1.5 },
      { id: 'bondA', color: COLOR.bondHalo, radius: 0.34 },
      { id: 'bondB', color: COLOR.bondHalo, radius: 0.34 },
      { id: 'exo', color: COLOR.exoHalo, radius: 1.0 },
      { id: 'coWarn', color: COLOR.coWarn, radius: 0.5 },
      { id: 'flash', color: COLOR.flash, kind: 'flash' },
    ] as const,
    waves: [
      { id: 'break', color: COLOR.breakWave, radius: 0.6 },
      { id: 'exo', color: COLOR.exoWave, radius: 1.4 },
    ] as const,
    puffColor: COLOR.warmGas,
  })
}

export function Co2CinemaScene(props: ScientificSynthesisFxProps) {
  // Мир, буфер кадра и время последних событий создаются один раз на прогон
  // и дальше пишутся каждый кадр — поэтому useSceneRuntime, см. kit/sceneKit.ts.
  const { world, frame, cueTimes } = useSceneRuntime(() => ({
    world: createCo2World(),
    frame: createCo2Frame(),
    cueTimes: new Map<Co2CueId, number>(),
  }))

  // Язык 3D-подписей: «тв./г./пм/кДж·моль⁻¹» вместо английских s/g/pm/kJ·mol⁻¹.
  const sceneLocale = toSceneLocale(useLocale().locale)

  const validate = useCallback(() => {
    validateCo2Storyboard()
    validateCo2Energetics()
  }, [])

  // onFrame/onCue НЕ мемоизируем: SceneShell зовёт их из useFrame, а не держит
  // в зависимостях эффекта (см. три правила в kit/README.md).
  const onFrame = (ctx: SceneFrameCtx) => {
    sampleCo2Frame(ctx.t, frame)
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

  const onCue = (id: Co2CueId, ctx: SceneFrameCtx) => {
    cueTimes.set(id, ctx.t)
    switch (id) {
      case 'ignite':
        fireAt(ctx, 'ember', frame.graphiteCenter)
        break
      case 'detach':
        fireAt(ctx, 'sparkA', frame.atoms.c0)
        break
      case 'o2Break':
        fireAt(ctx, 'sparkB', _a.copy(frame.atoms.oA).lerp(frame.atoms.oB, 0.5))
        break
      case 'bond1':
        fireAt(ctx, 'sparkA', frame.atoms.oA)
        break
      case 'bond2':
        fireAt(ctx, 'sparkB', frame.atoms.oB)
        break
      case 'exo':
        fireAt(ctx, 'exo', frame.graphiteCenter)
        fireAt(ctx, 'flame', frame.graphiteCenter)
        break
      default:
        break
    }
  }

  return (
    <SceneShell<Co2StepId, Co2CueId>
      {...props}
      lesson="co2"
      timing={CO2_TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      onCue={onCue}
      validate={validate}
      rigScale={CO2_RIG_SCALE}
      glowPointsCapacity={260}
      debugName="co2"
      bursts={[
        { id: 'sparkA', preset: 'spark', sizeScale: 0.7 },
        { id: 'sparkB', preset: 'spark', sizeScale: 0.7 },
        { id: 'ember', preset: 'fire', sizeScale: 0.9 },
        { id: 'exo', preset: 'flash', sizeScale: 1.2 },
        { id: 'flame', preset: 'fire', sizeScale: 1.35 },
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

function writeAtoms(pool: Parameters<typeof writeAtom>[0], frame: Co2Frame): void {
  const dim = 1 - frame.env.fade * 0.6
  for (let i = 0; i < CO2_ATOMS.length; i++) {
    const def = CO2_ATOMS[i]!
    writeAtom(pool, i, {
      pos: frame.atoms[def.id],
      radius: frame.radius[def.id],
      colorHex: ATOM_COLOR.get(def.id)!,
      charge: frame.charge[def.id],
      emissive: frame.emissive[def.id],
      opacity: frame.opacity[def.id] * dim,
    })
  }
  // Фоновые молекулы кислорода — газ вокруг раскалённого угля.
  for (let k = 0; k < BG_ATOM_COUNT; k++) {
    writeAtom(pool, BG_ATOM_BASE + k, {
      pos: frame.bg.pos[k]!,
      radius: CO2_GEOM.radius.o,
      colorHex: O_COLOR,
      emissive: 0.1,
      opacity: frame.bg.opacity * dim,
    })
  }
  commitPool(pool, BG_ATOM_BASE + BG_ATOM_COUNT)
}

function writeBonds(pool: Parameters<typeof writeBond>[0], frame: Co2Frame): void {
  let n = 0
  const dim = 1 - frame.env.fade * 0.6

  // Слои графита: кратность 4/3 — одна делокализованная π-система на три связи.
  for (const [a, b] of GRAPHITE_BONDS) {
    writeBond(pool, n++, {
      a: frame.atoms[a],
      b: frame.atoms[b],
      radius: GRAPHITE_BOND_RADIUS,
      colorA: COLOR.graphiteBond,
      colorB: COLOR.graphiteBond,
      order: GRAPHITE_BOND_ORDER,
      opacity: frame.graphite.bondOpacity * dim,
    })
  }
  // Две связи, которыми реагирующий атом держался за слой: натяжение → разрыв.
  for (const [a, b] of BREAKING_BONDS) {
    writeBond(pool, n++, {
      a: frame.atoms[a],
      b: frame.atoms[b],
      radius: GRAPHITE_BOND_RADIUS,
      colorA: COLOR.graphiteBond,
      colorB: COLOR.graphiteBond,
      order: GRAPHITE_BOND_ORDER,
      opacity: frame.edgeBond.opacity * dim,
      stress: frame.edgeBond.stress,
      thinning: frame.edgeBond.thinning,
      split: 0,
    })
  }
  // Связь O=O: двойная, рвётся ГОМОЛИТИЧЕСКИ (split = 0 — пара делится поровну).
  writeBond(pool, n++, {
    a: frame.atoms.oA,
    b: frame.atoms.oB,
    radius: BOND_RADIUS,
    colorA: O_COLOR,
    colorB: O_COLOR,
    order: 2,
    opacity: frame.o2Bond.opacity * dim,
    stress: frame.o2Bond.stress,
    thinning: frame.o2Bond.thinning,
    split: 0,
  })
  // Две связи C=O: двойные, ПОЛЯРНЫЕ — электронная плотность смещена к кислороду.
  writeBond(pool, n++, {
    a: frame.atoms.c0,
    b: frame.atoms.oA,
    radius: BOND_RADIUS,
    colorA: C_COLOR,
    colorB: O_COLOR,
    order: 2,
    opacity: frame.coBond.opacityA * dim,
    form: frame.coBond.formA,
    polarity: frame.dipole * 0.8,
  })
  writeBond(pool, n++, {
    a: frame.atoms.c0,
    b: frame.atoms.oB,
    radius: BOND_RADIUS,
    colorA: C_COLOR,
    colorB: O_COLOR,
    order: 2,
    opacity: frame.coBond.opacityB * dim,
    form: frame.coBond.formB,
    polarity: frame.dipole * 0.8,
  })
  // Угарный газ: ТРОЙНАЯ связь C≡O — короче и прочнее, чем C=O в CO₂.
  writeBond(pool, n++, {
    a: frame.atoms.coC,
    b: frame.atoms.coO,
    radius: BOND_RADIUS,
    colorA: C_COLOR,
    colorB: O_COLOR,
    order: 3,
    opacity: frame.coWarn * dim,
  })
  // Камео воды: две связи O–H, угол 104,45°.
  for (const h of ['wH1', 'wH2'] as const) {
    writeBond(pool, n++, {
      a: frame.atoms.wO,
      b: frame.atoms[h],
      radius: 0.03,
      colorA: O_COLOR,
      colorB: H_COLOR,
      opacity: frame.water * dim,
      polarity: 0.6,
    })
  }
  // Фоновые молекулы O₂.
  for (let k = 0; k < BACKGROUND_O2.length; k++) {
    writeBond(pool, n++, {
      a: frame.bg.pos[k * 2]!,
      b: frame.bg.pos[k * 2 + 1]!,
      radius: 0.032,
      colorA: O_COLOR,
      colorB: O_COLOR,
      order: 2,
      opacity: frame.bg.opacity * 0.75 * dim,
    })
  }
  commitPool(pool, n)
}

// ─────────────────────────────────────────────────────────────────────────────
// Орбитали, диполи и горячий газ — точками одного пула
// ─────────────────────────────────────────────────────────────────────────────

/**
 * sp-гибридный лепесток: «капля» точек вдоль оси. Профиль ширины sin(π·s^0.7)
 * — узкая у ядра, пузатая в середине, острая на конце. Это СХЕМА, а не
 * изоповерхность волновой функции.
 */
function drawSpLobe(
  gp: GlowPointsHandle,
  center: THREE.Vector3,
  dir: THREE.Vector3,
  length: number,
  amount: number,
  elapsed: number,
  seed: number,
): void {
  if (amount <= 0.01) return
  const dots = 22
  _p1.set(-dir.y, dir.x, 0)
  if (_p1.lengthSq() < 1e-6) _p1.set(0, 1, 0)
  _p1.normalize()
  _p2.copy(dir).cross(_p1).normalize()
  for (let k = 0; k < dots; k++) {
    const s = (k + 0.5) / dots
    const along = s * length
    const width = length * 0.36 * Math.sin(Math.PI * Math.pow(s, 0.7))
    const a = k * 2.399963 + elapsed * 0.9 + seed
    const r = width * (0.35 + 0.65 * ((k * 7919) % 53) / 53)
    _pt.copy(center)
      .addScaledVector(dir, along)
      .addScaledVector(_p1, Math.cos(a) * r)
      .addScaledVector(_p2, Math.sin(a) * r)
    gp.push(_pt.x, _pt.y, _pt.z, 0.075, FX.sp[0], FX.sp[1], FX.sp[2], amount * 0.7, 0.3)
  }
}

/**
 * π-облако: сплюснутая «лепёшка» точек НАД (или под) осью молекулы, растянутая
 * на всю O=C=O. В CO₂ таких систем две, в перпендикулярных плоскостях —
 * поэтому функция зовётся с разными нормалями.
 */
function drawPiCloud(
  gp: GlowPointsHandle,
  center: THREE.Vector3,
  axis: THREE.Vector3,
  normal: THREE.Vector3,
  halfLength: number,
  offset: number,
  amount: number,
  elapsed: number,
): void {
  if (amount <= 0.01) return
  const dots = 26
  _p2.copy(axis).cross(normal).normalize()
  for (let k = 0; k < dots; k++) {
    const s = (k + 0.5) / dots
    const along = (s * 2 - 1) * halfLength
    // Плотность π-облака максимальна над ядрами связей и проваливается на краях.
    const thick = Math.cos((along / halfLength) * (Math.PI / 2))
    const wob = 0.035 * Math.sin(elapsed * 1.8 + k * 0.7)
    const side = ((k * 2654435761) % 1000) / 1000 - 0.5
    _pt.copy(center)
      .addScaledVector(axis, along)
      .addScaledVector(normal, offset * (0.7 + 0.35 * thick) + wob)
      .addScaledVector(_p2, side * 0.12)
    gp.push(_pt.x, _pt.y, _pt.z, 0.085, FX.pi[0], FX.pi[1], FX.pi[2], amount * (0.35 + 0.5 * thick), 0.35)
  }
}

/** Стрелка дипольного момента связи: от δ+ к δ−, с наконечником у кислорода. */
function drawDipoleArrow(
  gp: GlowPointsHandle,
  from: THREE.Vector3,
  to: THREE.Vector3,
  amount: number,
  elapsed: number,
): void {
  if (amount <= 0.01) return
  _dir.copy(to).sub(from)
  const len = _dir.length() || 1
  _dir.divideScalar(len)
  _p1.set(-_dir.y, _dir.x, 0)
  if (_p1.lengthSq() < 1e-6) _p1.set(0, 1, 0)
  _p1.normalize()
  const dots = 11
  for (let k = 1; k <= dots; k++) {
    const u = k / (dots + 1)
    const flow = 0.5 + 0.5 * Math.sin(u * 14 - elapsed * 5)
    const c = u < 0.5 ? FX.dipolePlus : FX.dipoleMinus
    _pt.copy(from).addScaledVector(_dir, u * len * 0.92)
    gp.push(_pt.x, _pt.y, _pt.z, 0.055 + 0.03 * flow, c[0], c[1], c[2], amount * 0.8, 0.4)
  }
  // Наконечник: две точки под углом к оси у самого кислорода.
  for (const side of [1, -1]) {
    _pt.copy(from)
      .addScaledVector(_dir, len * 0.78)
      .addScaledVector(_p1, side * 0.07)
    const c = FX.dipoleMinus
    gp.push(_pt.x, _pt.y, _pt.z, 0.07, c[0], c[1], c[2], amount * 0.9, 0.6)
  }
}

function drawPoints(ctx: SceneFrameCtx, frame: Co2Frame): void {
  const gp = ctx.points
  if (!gp) return
  const elapsed = ctx.elapsed
  gp.begin()

  // ——— Раскалённый газ над углём ———
  const heat = frame.graphite.heat * frame.graphite.opacity
  if (heat > 0.02) {
    const c = frame.graphiteCenter
    for (let k = 0; k < 26; k++) {
      const a = k * 2.399963 + elapsed * 0.45
      const rise = ((k * 131 + elapsed * 40) % 100) / 100
      const r = 0.75 * (0.4 + 0.6 * ((k * 7919) % 71) / 71)
      gp.push(
        c.x + Math.cos(a) * r,
        c.y + 0.4 + rise * 1.25,
        c.z + Math.sin(a) * r * 0.8,
        0.085 * (1 - rise * 0.5),
        FX.heat[0],
        FX.heat[1],
        FX.heat[2],
        heat * 0.5 * (1 - rise),
        0.25,
      )
    }
  }

  // ——— sp-гибридные орбитали углерода: две «капли» по оси молекулы ———
  if (frame.sp > 0.01) {
    const c = frame.atoms.c0
    _a.copy(frame.atoms.oA).sub(c).normalize()
    drawSpLobe(gp, c, _a, CO2_GEOM.coScene * 0.78, frame.sp, elapsed, 0)
    _b.copy(frame.atoms.oB).sub(c).normalize()
    drawSpLobe(gp, c, _b, CO2_GEOM.coScene * 0.78, frame.sp, elapsed, 1.7)
  }

  // ——— Две π-системы в перпендикулярных плоскостях ———
  if (frame.pi > 0.01) {
    const c = frame.atoms.c0
    _a.copy(frame.atoms.oA).sub(c).normalize()
    const half = CO2_GEOM.coScene * 0.95
    _b.set(0, 1, 0)
    drawPiCloud(gp, c, _a, _b, half, 0.26, frame.pi, elapsed)
    drawPiCloud(gp, c, _a, _b, half, -0.26, frame.pi, elapsed)
    _b.set(0, 0, 1)
    drawPiCloud(gp, c, _a, _b, half, 0.26, frame.pi * 0.75, elapsed)
    drawPiCloud(gp, c, _a, _b, half, -0.26, frame.pi * 0.75, elapsed)
  }

  // ——— Диполи связей: обе стрелки от δ+ (C) к δ− (O), суммарный вектор ноль ———
  if (frame.dipole > 0.01) {
    drawDipoleArrow(gp, frame.atoms.c0, frame.atoms.oA, frame.dipole, elapsed)
    drawDipoleArrow(gp, frame.atoms.c0, frame.atoms.oB, frame.dipole, elapsed)
    // Пульсирующее кольцо на углероде — знак того, что векторная сумма = 0.
    const c = frame.atoms.c0
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 3.4)
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2
      const r = 0.2 + 0.03 * pulse
      gp.push(
        c.x + Math.cos(a) * r,
        c.y + Math.sin(a) * r,
        c.z,
        0.05,
        FX_COLOR.shell[0],
        FX_COLOR.shell[1],
        FX_COLOR.shell[2],
        frame.dipole * 0.55 * (0.5 + 0.5 * pulse),
        0.3,
      )
    }
  }

  gp.end()
}

function updateGlows(
  world: ReturnType<typeof buildSceneWorld>,
  frame: Co2Frame,
  t: number,
  cueTimes: Map<Co2CueId, number>,
): void {
  setGlow(world, 'heat', frame.graphiteCenter, frame.graphite.heat * frame.graphite.opacity * 0.6)
  setGlow(world, 'bondA', frame.atoms.oA, frame.coBond.formA * (1 - frame.coBond.formA) * 2.4)
  setGlow(world, 'bondB', frame.atoms.oB, frame.coBond.formB * (1 - frame.coBond.formB) * 2.4)
  setGlow(world, 'exo', frame.graphiteCenter, frame.env.exo * 0.95)
  setGlow(world, 'coWarn', frame.coCenter, frame.coWarn * 0.35)

  const tBreak = cueTimes.get('o2Break')
  const tBond2 = cueTimes.get('bond2')
  const tExo = cueTimes.get('exo')
  const pBreak = tBreak != null ? pulseAt(t, tBreak, 0.45) : 0
  const pExo = tExo != null ? pulseAt(t, tExo, 0.7) : 0
  if (pExo > pBreak) setGlow(world, 'flash', frame.graphiteCenter, pExo * 0.9)
  else setGlow(world, 'flash', _a.copy(frame.atoms.oA).lerp(frame.atoms.oB, 0.5), pBreak * 0.6)

  setWave(world, 'break', _a.copy(frame.atoms.oA).lerp(frame.atoms.oB, 0.5), tBreak != null && t >= tBreak ? Math.min(1, (t - tBreak) / 0.8) : 0)
  setWave(world, 'exo', frame.graphiteCenter, tExo != null && t >= tExo ? Math.min(1, (t - tExo) / 1.1) : 0)

  // Вторая связь замкнулась — короткая волна на самой молекуле.
  if (tBond2 != null && t >= tBond2 && t < tBond2 + 0.9) {
    setWave(world, 'break', frame.molCenter, Math.min(1, (t - tBond2) / 0.9))
  }

  setPuff(world, frame.graphiteCenter, (frame.env.exo * 0.5 + frame.graphite.heat * 0.18) * (1 - frame.env.fade), {
    rise: 0.14,
    turbulence: 0.2,
  })
}
