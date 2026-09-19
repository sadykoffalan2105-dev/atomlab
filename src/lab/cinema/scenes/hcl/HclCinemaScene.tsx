import { useCallback } from 'react'
import * as THREE from 'three'
import { pulseAt } from '../../core/cues'
import { commitPool, cpkHex, writeAtom, writeBond } from '../kit/cpkAtoms'
import { drawElectronShell, FX_COLOR } from '../kit/electronFx'
import { buildSceneWorld, localizeSceneLabels, setGlow, setPuff, setWave, toSceneLocale, useSceneRuntime } from '../kit/sceneKit'
import { useLocale } from '../../../../i18n/useLocale'
import { SceneShell, type SceneFrameCtx } from '../kit/SceneShell'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import {
  createHclFrame,
  HCL_ATOMS,
  HCL_BONDS,
  HCL_GEOM,
  HCL_RIG_SCALE,
  HCL_TIMING,
  sampleHclFrame,
  validateHclStoryboard,
  type HclAtomId,
  type HclCueId,
  type HclFrame,
  type HclStepId,
} from './hclStoryboard'
import { validateHclEnergetics } from './hclEnergetics'

/**
 * Урок «цепная радикальная реакция»: H₂ (г.) + Cl₂ (г.) → 2 HCl (г.), шесть шагов.
 *
 * Здесь только РЕНДЕР кадра: всё общее (часы по шагам, контракт лаборатории
 * embryo → birth → complete, камера, пост-обработка, качество) делает SceneShell
 * из общего набора scenes/kit. Раскадровка — hclStoryboard.ts, энергия —
 * hclEnergetics.ts, тексты — hclMechanismText.*.
 *
 * Что рисуется точками (один draw call, CinemaGlowPoints):
 *   • квант света со следом — прилетает и гасит себя в молекуле хлора;
 *   • неспаренный электрон радикала — одна точка у поверхности атома
 *     плюс пунктирная валентная оболочка (схематично, см. текст шага);
 *   • общая электронная пара новой связи — две точки между ядрами,
 *     сдвинутые к хлору (полярность связи).
 */

const COLOR = {
  /** фиолетово-синий квант: именно такой свет рвёт Cl₂ (λ ≤ 492 нм) */
  photon: [0.72, 0.62, 1.0] as const,
  photonHalo: 0xb49cff,
  radicalHalo: 0xd9ff8f,
  exoHalo: 0xffb264,
  exoWave: 0xffc27a,
  chainWave: 0xbff6ff,
  warmGas: 0xffa858,
  flash: 0xfff1d6,
}

const BOND_RADIUS = 0.055
const GAS_BOND_RADIUS = 0.042

const ATOM_COLOR = new Map<HclAtomId, number>(HCL_ATOMS.map((a) => [a.id, cpkHex(a.el)]))

const _p = new THREE.Vector3()
const _q = new THREE.Vector3()

function createHclWorld() {
  return buildSceneWorld({
    atoms: HCL_ATOMS.length,
    bonds: HCL_BONDS.length,
    glows: [
      { id: 'photon', color: COLOR.photonHalo, radius: 0.34 },
      { id: 'radA', color: COLOR.radicalHalo, radius: HCL_GEOM.shellCl * 1.1 },
      { id: 'radB', color: COLOR.radicalHalo, radius: HCL_GEOM.shellCl * 1.1 },
      { id: 'exo', color: COLOR.exoHalo, radius: 0.85 },
      { id: 'flash', color: COLOR.flash, kind: 'flash' },
    ] as const,
    waves: [
      { id: 'homolysis', color: COLOR.chainWave, radius: 0.6 },
      { id: 'exo', color: COLOR.exoWave, radius: 1.2 },
    ] as const,
    puffColor: COLOR.warmGas,
  })
}

export function HclCinemaScene(props: ScientificSynthesisFxProps) {
  // Мир, буфер кадра и время последних событий создаются один раз на прогон
  // и дальше пишутся каждый кадр — поэтому useSceneRuntime, см. kit/sceneKit.ts.
  const { world, frame, cueTimes } = useSceneRuntime(() => ({
    world: createHclWorld(),
    frame: createHclFrame(),
    cueTimes: new Map<HclCueId, number>(),
  }))

  // Язык 3D-подписей: «г./пм/нм/кДж» вместо английских g/pm/nm/kJ.
  const sceneLocale = toSceneLocale(useLocale().locale)

  const validate = useCallback(() => {
    validateHclStoryboard()
    validateHclEnergetics()
  }, [])

  // onFrame/onCue НЕ мемоизируем: SceneShell зовёт их из useFrame, а не держит
  // в зависимостях эффекта (см. правила в kit/README.md).
  const onFrame = (ctx: SceneFrameCtx) => {
    sampleHclFrame(ctx.t, frame)
    // Раскадровка чистая и пишет токены «{g}/{pm}/{nm}/{kJmol}» — переводим их
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

  const onCue = (id: HclCueId, ctx: SceneFrameCtx) => {
    cueTimes.set(id, ctx.t)
    switch (id) {
      case 'photon':
        fireAt(ctx, 'spark', frame.mid.cl2mol1)
        break
      case 'homolysis':
        fireAt(ctx, 'split', frame.mid.cl2mol1)
        break
      case 'abstract':
        fireAt(ctx, 'spark', frame.mid.hclMol1)
        break
      case 'propagate':
        fireAt(ctx, 'exo', frame.mid.hclMol2)
        fireAt(ctx, 'flame', frame.mid.hclMol2)
        break
      case 'terminate':
        fireAt(ctx, 'split', frame.mid.termMol)
        break
      default:
        break
    }
  }

  return (
    <SceneShell<HclStepId, HclCueId>
      {...props}
      lesson="hcl"
      timing={HCL_TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      onCue={onCue}
      validate={validate}
      rigScale={HCL_RIG_SCALE}
      glowPointsCapacity={220}
      debugName="hcl"
      bursts={[
        { id: 'spark', preset: 'spark', sizeScale: 0.7 },
        { id: 'split', preset: 'spark', sizeScale: 0.85 },
        { id: 'exo', preset: 'flash', sizeScale: 1.05 },
        { id: 'flame', preset: 'fire', sizeScale: 1.1 },
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

function writeAtoms(pool: Parameters<typeof writeAtom>[0], frame: HclFrame): void {
  // В темноте кадр приглушён: пока света нет, реакции нет.
  const dim = (1 - frame.env.fade * 0.6) * (1 - frame.env.dark * 0.25)
  for (let i = 0; i < HCL_ATOMS.length; i++) {
    const def = HCL_ATOMS[i]!
    writeAtom(pool, i, {
      pos: frame.atoms[def.id],
      radius: frame.radius[def.id],
      colorHex: ATOM_COLOR.get(def.id)!,
      charge: 0,
      emissive: frame.emissive[def.id],
      opacity: frame.opacity[def.id] * dim,
    })
  }
  commitPool(pool, HCL_ATOMS.length)
}

function writeBonds(pool: Parameters<typeof writeBond>[0], frame: HclFrame): void {
  const dim = 1 - frame.env.fade * 0.6
  for (let i = 0; i < HCL_BONDS.length; i++) {
    const def = HCL_BONDS[i]!
    const b = frame.bonds[def.id]
    const gas = def.id.startsWith('gb')
    writeBond(pool, i, {
      a: frame.atoms[def.a],
      b: frame.atoms[def.b],
      radius: gas ? GAS_BOND_RADIUS : BOND_RADIUS,
      colorA: ATOM_COLOR.get(def.a)!,
      colorB: ATOM_COLOR.get(def.b)!,
      order: 1,
      opacity: b.opacity * dim,
      form: b.form,
      stress: b.stress,
      thinning: b.thinning,
      // Гомолиз: общая пара делится ПОРОВНУ, поэтому split = 0 всегда.
      split: 0,
      polarity: b.polarity,
    })
  }
  commitPool(pool, HCL_BONDS.length)
}

/** Одна точка-электрон, бегущая по валентной оболочке радикала. */
function drawRadicalElectron(
  ctx: SceneFrameCtx,
  center: THREE.Vector3,
  shell: number,
  amount: number,
  phase: number,
): void {
  const gp = ctx.points
  if (!gp || amount <= 0.01) return
  const a = phase + ctx.elapsed * 1.5
  const x = center.x + Math.cos(a) * shell
  const y = center.y + Math.sin(a) * shell * 0.72
  const z = center.z + Math.sin(a * 0.7) * shell * 0.5
  const pulse = 0.72 + 0.28 * Math.sin(ctx.elapsed * 5.4 + phase)
  gp.push(x, y, z, 0.2 * pulse, FX_COLOR.electron[0], FX_COLOR.electron[1], FX_COLOR.electron[2], amount, 0.95)
}

/**
 * Общая электронная пара новой связи: две точки между ядрами, сдвинутые
 * к более электроотрицательному атому — так выглядит полярная ковалентная связь.
 */
function drawSharedPair(
  ctx: SceneFrameCtx,
  a: THREE.Vector3,
  b: THREE.Vector3,
  bias: number,
  amount: number,
): void {
  const gp = ctx.points
  if (!gp || amount <= 0.01) return
  // Точка смещения: 0.5 — ровно посередине (неполярная), > 0.5 — ближе к b.
  _p.copy(a).lerp(b, 0.5 + 0.5 * bias)
  _q.copy(b).sub(a).normalize()
  // Пара «раздвинута» поперёк оси связи, чтобы читались именно ДВА электрона.
  const nx = -_q.y
  const ny = _q.x
  const spread = 0.09 * (0.85 + 0.15 * Math.sin(ctx.elapsed * 3.1))
  const [r, g, bl] = FX_COLOR.electron
  gp.push(_p.x + nx * spread, _p.y + ny * spread, _p.z, 0.15, r, g, bl, amount, 0.8)
  gp.push(_p.x - nx * spread, _p.y - ny * spread, _p.z, 0.15, r, g, bl, amount, 0.8)
}

function drawPoints(ctx: SceneFrameCtx, frame: HclFrame): void {
  const gp = ctx.points
  if (!gp) return
  const elapsed = ctx.elapsed
  gp.begin()

  // ——— Квант света со следом: прилетает и гаснет внутри молекулы хлора ———
  const ph = frame.photon
  if (ph.amount > 0.01) {
    const [r, g, b] = COLOR.photon
    for (let k = 0; k < 14; k++) {
      const back = k * 0.055
      const x = ph.pos.x + (frame.mid.cl2mol1.x - ph.pos.x) * -back
      const y = ph.pos.y + (frame.mid.cl2mol1.y - ph.pos.y) * -back
      const z = ph.pos.z + (frame.mid.cl2mol1.z - ph.pos.z) * -back
      gp.push(x, y, z, 0.22 * (1 - k / 16), r, g, b, ph.amount * (1 - k / 15) * 0.8, 0.6)
    }
    gp.push(ph.pos.x, ph.pos.y, ph.pos.z, 0.34, r, g, b, ph.amount, 1)
  }

  // ——— Радикалы: схематичная валентная оболочка + один неспаренный электрон ———
  drawElectronShell(gp, frame.atoms.cl1, HCL_GEOM.shellCl, frame.radicals.cl1, elapsed, { phase: 0.3, dots: 22 })
  drawElectronShell(gp, frame.atoms.cl2, HCL_GEOM.shellCl, frame.radicals.cl2, elapsed, { phase: -0.4, dots: 22 })
  drawElectronShell(gp, frame.atoms.cl4, HCL_GEOM.shellCl, frame.radicals.cl4, elapsed, { phase: 1.1, dots: 22 })
  drawElectronShell(gp, frame.atoms.h2, HCL_GEOM.shellH, frame.radicals.h2, elapsed, { phase: 2.0, dots: 16 })

  drawRadicalElectron(ctx, frame.atoms.cl1, HCL_GEOM.shellCl, frame.radicals.cl1, 0.3)
  drawRadicalElectron(ctx, frame.atoms.cl2, HCL_GEOM.shellCl, frame.radicals.cl2, 2.4)
  drawRadicalElectron(ctx, frame.atoms.cl4, HCL_GEOM.shellCl, frame.radicals.cl4, 4.1)
  drawRadicalElectron(ctx, frame.atoms.h2, HCL_GEOM.shellH, frame.radicals.h2, 1.2)

  // ——— Общие пары новых связей: у H–Cl смещены к хлору, у Cl–Cl — ровно посередине ———
  drawSharedPair(ctx, frame.atoms.h1, frame.atoms.cl1, HCL_GEOM.polarity, frame.pairs.hcl1)
  drawSharedPair(ctx, frame.atoms.h2, frame.atoms.cl3, HCL_GEOM.polarity, frame.pairs.hcl2)
  drawSharedPair(ctx, frame.atoms.cl2, frame.atoms.cl4, 0, frame.pairs.term)

  gp.end()
}

function updateGlows(
  world: ReturnType<typeof buildSceneWorld>,
  frame: HclFrame,
  t: number,
  cueTimes: Map<HclCueId, number>,
): void {
  setGlow(world, 'photon', frame.photon.pos, frame.photon.amount * 0.85)
  setGlow(world, 'radA', frame.atoms.cl1, Math.max(frame.radicals.cl1, frame.radicals.cl4) * 0.5)
  setGlow(world, 'radB', frame.atoms.cl2, frame.radicals.cl2 * 0.5)
  setGlow(world, 'exo', frame.mid.hclMol2, frame.env.exo * 0.9)

  const tHomo = cueTimes.get('homolysis')
  const tAbstract = cueTimes.get('abstract')
  const tPropagate = cueTimes.get('propagate')
  const tTerminate = cueTimes.get('terminate')
  const pHomo = tHomo != null ? pulseAt(t, tHomo, 0.45) : 0
  const pAbstract = tAbstract != null ? pulseAt(t, tAbstract, 0.4) : 0
  const pPropagate = tPropagate != null ? pulseAt(t, tPropagate, 0.7) : 0

  if (pPropagate >= Math.max(pHomo, pAbstract)) setGlow(world, 'flash', frame.mid.hclMol2, pPropagate * 0.95)
  else if (pHomo >= pAbstract) setGlow(world, 'flash', frame.mid.cl2mol1, pHomo * 0.7)
  else setGlow(world, 'flash', frame.mid.hclMol1, pAbstract * 0.55)

  setWave(
    world,
    'homolysis',
    frame.mid.cl2mol1,
    tHomo != null && t >= tHomo ? Math.min(1, (t - tHomo) / 0.9) : 0,
  )
  setWave(
    world,
    'exo',
    frame.mid.hclMol2,
    tPropagate != null && t >= tPropagate ? Math.min(1, (t - tPropagate) / 1.1) : 0,
  )
  if (tTerminate != null && t >= tTerminate && t < tTerminate + 1.2) {
    setWave(world, 'homolysis', frame.mid.termMol, Math.min(1, (t - tTerminate) / 0.9))
  }

  setPuff(world, frame.mid.hclMol2, frame.env.exo * 0.5 * (1 - frame.env.fade), { rise: 0.14, turbulence: 0.2 })
}
