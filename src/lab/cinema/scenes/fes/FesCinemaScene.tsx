import { useCallback, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { pulseAt } from '../../core/cues'
import { commitPool, cpkHex, writeAtom, writeBond } from '../kit/cpkAtoms'
import { drawElectron, drawElectronShell, drawFieldLine, FX_COLOR } from '../kit/electronFx'
import { buildSceneWorld, localizeSceneLabels, toSceneLocale, useSceneRuntime } from '../kit/sceneKit'
import { useLocale } from '../../../../i18n/useLocale'
import { SceneShell, type SceneFrameCtx } from '../kit/SceneShell'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import {
  createFesFrame,
  FES_ATOMS,
  FES_EDGES,
  FES_GEOM,
  FES_RIG_SCALE,
  FES_TIMING,
  IRON_ATOMS,
  IRON_BONDS,
  RING_BONDS,
  sampleFesFrame,
  validateFesStoryboard,
  type FesAtomId,
  type FesCueId,
  type FesFrame,
  type FesStepId,
} from './fesStoryboard'
import { validateFesEnergetics } from './fesEnergetics'

/**
 * Урок «смесь или соединение»: Fe (тв.) + S (тв.) → FeS (тв.), шесть шагов.
 *
 * Здесь только РЕНДЕР кадра: всё общее (часы по шагам, контракт лаборатории
 * embryo → birth → complete, камера, пост-обработка, качество, reduced-motion)
 * делает SceneShell из общего набора scenes/kit. Раскадровка — fesStoryboard.ts,
 * энергия — fesEnergetics.ts, тексты — fesMechanismText.*.
 *
 * Единственная «своя» геометрия сцены — магнит: школьный брусок из двух
 * половинок. Он нужен дважды: на шаге 1 вытягивает железо ИЗ СМЕСИ, на шаге 5
 * висит над сульфидом и не может сдвинуть его с места.
 */

const COLOR = {
  ironBond: 0xb5a08c,
  ringBond: 0xe8d24a,
  edge: 0xffe0b8,
  heatHalo: 0xff7a2f,
  burnHalo: 0xffc061,
  exoHalo: 0xffb264,
  contactWave: 0xbff6ff,
  exoWave: 0xffc27a,
  warmGas: 0xff9838,
  flash: 0xfff1d6,
  shellHalo: 0x6fb4ff,
  electronHalo: 0x9ee4ff,
  magnetNorth: 0xd8443a,
  magnetSouth: 0x3d6fd8,
}

const BOND_RADIUS = 0.05
const EDGE_RADIUS = 0.018
const IRON_BOND_RADIUS = 0.022
/** Свободные электроны металла («электронный газ») — схематично, точками. */
const METAL_GAS_DOTS = 20
/** Точки магнитного притяжения между полюсом и опилками — тоже схематично. */
const MAGNET_DOTS = 14

const ATOM_COLOR = new Map<FesAtomId, number>(FES_ATOMS.map((a) => [a.id, cpkHex(a.el)]))

const _p = new THREE.Vector3()

function createFesWorld() {
  return buildSceneWorld({
    atoms: FES_ATOMS.length,
    bonds: IRON_BONDS.length + RING_BONDS.length + FES_EDGES.length,
    glows: [
      { id: 'shell', color: COLOR.shellHalo, radius: FES_GEOM.shellFe * 1.2 },
      { id: 'e1', color: COLOR.electronHalo, radius: 0.3 },
      { id: 'e2', color: COLOR.electronHalo, radius: 0.3 },
      { id: 'heat', color: COLOR.heatHalo, radius: 1.1 },
      { id: 'burn', color: COLOR.burnHalo, radius: 0.95 },
      { id: 'exo', color: COLOR.exoHalo, radius: 0.9 },
      { id: 'flash', color: COLOR.flash, kind: 'flash' },
    ] as const,
    waves: [
      { id: 'ignite', color: COLOR.contactWave, radius: 0.9 },
      { id: 'exo', color: COLOR.exoWave, radius: 1.3 },
    ] as const,
    puffColor: COLOR.warmGas,
  })
}

export function FesCinemaScene(props: ScientificSynthesisFxProps) {
  // Мир, буфер кадра и время последних событий создаются один раз на прогон
  // и дальше пишутся каждый кадр — поэтому useSceneRuntime, см. kit/sceneKit.ts.
  const { world, frame, cueTimes } = useSceneRuntime(() => ({
    world: createFesWorld(),
    frame: createFesFrame(),
    cueTimes: new Map<FesCueId, number>(),
  }))

  // Язык 3D-подписей: «тв./пм/кДж·моль⁻¹» вместо английских s/pm/kJ·mol⁻¹.
  const sceneLocale = toSceneLocale(useLocale().locale)

  const validate = useCallback(() => {
    validateFesStoryboard()
    validateFesEnergetics()
  }, [])

  // onFrame/onCue НЕ мемоизируем: SceneShell зовёт их из useFrame, а не держит
  // в зависимостях эффекта (useCallback с изменяемым значением в зависимостях
  // ловит react-hooks/immutability).
  const onFrame = (ctx: SceneFrameCtx) => {
    sampleFesFrame(ctx.t, frame)
    // Раскадровка чистая и пишет токены «{s}/{pm}/{kJmol}» — переводим их
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

  const onCue = (id: FesCueId, ctx: SceneFrameCtx) => {
    cueTimes.set(id, ctx.t)
    switch (id) {
      case 'separate':
        fireAt(ctx, 'sparkA', frame.ironCenter)
        break
      case 'ignite':
        fireAt(ctx, 'exo', frame.hotSpot)
        fireAt(ctx, 'flame', frame.hotSpot)
        break
      case 'transfer':
        fireAt(ctx, 'sparkB', frame.atoms.s1)
        break
      case 'lattice':
        fireAt(ctx, 'sparkA', frame.crystalCenter)
        break
      case 'exo':
        fireAt(ctx, 'exo', frame.crystalCenter)
        fireAt(ctx, 'flame', frame.crystalCenter)
        break
      default:
        break
    }
  }

  return (
    <SceneShell<FesStepId, FesCueId>
      {...props}
      lesson="fes"
      timing={FES_TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      onCue={onCue}
      validate={validate}
      rigScale={FES_RIG_SCALE}
      glowPointsCapacity={220}
      debugName="fes"
      bursts={[
        { id: 'sparkA', preset: 'spark', sizeScale: 0.7 },
        { id: 'sparkB', preset: 'spark', sizeScale: 0.7 },
        { id: 'exo', preset: 'flash', sizeScale: 1.1 },
        { id: 'flame', preset: 'fire', sizeScale: 1.3 },
      ]}
    >
      <FesMagnet frame={frame} />
    </SceneShell>
  )
}

function fireAt(ctx: SceneFrameCtx, id: string, at: THREE.Vector3): void {
  const h = ctx.vfx(id)
  h?.node()?.position.copy(at)
  h?.fire()
}

// ─────────────────────────────────────────────────────────────────────────────
// Магнит
// ─────────────────────────────────────────────────────────────────────────────

const MAGNET_HALF = 0.34
const MAGNET_H = 0.17
const MAGNET_D = 0.16

/**
 * Школьный магнит: брусок из красной и синей половинок. Положение и видимость
 * берутся из кадра раскадровки, поэтому магнит живёт в тех же часах, что и вся
 * сцена (пауза по шагам работает и на нём). На шаге 5 он мелко подрагивает —
 * это «пытается притянуть и не может», а кристалл при этом неподвижен.
 *
 * useFrame здесь идёт по умолчанию (приоритет 0), то есть ПОСЛЕ кадра сцены
 * (SceneShell считает раскадровку с приоритетом −1) — данные уже свежие.
 */
function FesMagnet({ frame }: { frame: FesFrame }) {
  const group = useRef<THREE.Group>(null)
  const north = useRef<THREE.MeshBasicMaterial>(null)
  const south = useRef<THREE.MeshBasicMaterial>(null)

  useFrame((state) => {
    const g = group.current
    if (!g) return
    const m = frame.magnet
    const on = m.opacity > 0.01 && frame.env.fade < 0.9
    g.visible = on
    if (!on) return
    const wobble = m.fail * 0.035 * Math.sin(state.clock.elapsedTime * 22)
    g.position.set(m.pos.x + wobble, m.pos.y, m.pos.z)
    g.rotation.z = m.fail * 0.06 * Math.sin(state.clock.elapsedTime * 17)
    const o = m.opacity * (1 - frame.env.fade)
    if (north.current) north.current.opacity = o
    if (south.current) south.current.opacity = o
  })

  return (
    <group ref={group} visible={false}>
      <mesh position={[-MAGNET_HALF / 2, 0, 0]}>
        <boxGeometry args={[MAGNET_HALF, MAGNET_H, MAGNET_D]} />
        <meshBasicMaterial ref={north} color={COLOR.magnetNorth} transparent opacity={0} toneMapped={false} />
      </mesh>
      <mesh position={[MAGNET_HALF / 2, 0, 0]}>
        <boxGeometry args={[MAGNET_HALF, MAGNET_H, MAGNET_D]} />
        <meshBasicMaterial ref={south} color={COLOR.magnetSouth} transparent opacity={0} toneMapped={false} />
      </mesh>
    </group>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Запись кадра в пулы
// ─────────────────────────────────────────────────────────────────────────────

function writeAtoms(pool: Parameters<typeof writeAtom>[0], frame: FesFrame): void {
  const dim = 1 - frame.env.fade * 0.6
  for (let i = 0; i < FES_ATOMS.length; i++) {
    const def = FES_ATOMS[i]!
    // Заряд в пуле — только окраска кромки, поэтому зажимаем ±2 → ±1.
    const q = Math.max(-1, Math.min(1, frame.charge[def.id]))
    writeAtom(pool, i, {
      pos: frame.atoms[def.id],
      radius: frame.radius[def.id],
      colorHex: ATOM_COLOR.get(def.id)!,
      charge: q,
      emissive: frame.emissive[def.id],
      opacity: frame.opacity[def.id] * dim,
    })
  }
  commitPool(pool, FES_ATOMS.length)
}

function writeBonds(pool: Parameters<typeof writeBond>[0], frame: FesFrame): void {
  let n = 0
  // Металлическая связь железа: центр ОЦК-ячейки с восемью соседями (КЧ 8).
  for (const [a, b] of IRON_BONDS) {
    writeBond(pool, n++, {
      a: frame.atoms[a],
      b: frame.atoms[b],
      radius: IRON_BOND_RADIUS,
      colorA: COLOR.ironBond,
      colorB: COLOR.ironBond,
      opacity: frame.ironBond * Math.min(frame.opacity[a], frame.opacity[b]),
    })
  }
  // Ковалентные связи короны S₈ — замкнутый цикл из восьми S–S.
  const s8 = cpkHex('S')
  for (const [a, b] of RING_BONDS) {
    writeBond(pool, n++, {
      a: frame.atoms[a],
      b: frame.atoms[b],
      radius: BOND_RADIUS,
      colorA: s8,
      colorB: s8,
      opacity: frame.ringBond * Math.min(frame.opacity[a], frame.opacity[b]),
    })
  }
  // Рёбра фрагмента решётки: октаэдры Fe²⁺ внутри каркаса из S²⁻.
  for (const [a, b] of FES_EDGES) {
    const lit = frame.coord > 0 && (a === 'fe1' || b === 'fe1') ? 1 + frame.coord : 1
    writeBond(pool, n++, {
      a: frame.atoms[a],
      b: frame.atoms[b],
      radius: EDGE_RADIUS,
      colorA: COLOR.edge,
      colorB: COLOR.edge,
      opacity: Math.min(1, frame.edges * lit) * Math.min(frame.opacity[a], frame.opacity[b]),
    })
  }
  commitPool(pool, n)
}

function drawPoints(ctx: SceneFrameCtx, frame: FesFrame): void {
  const gp = ctx.points
  if (!gp) return
  const elapsed = ctx.elapsed
  gp.begin()

  // Электронный газ железа: точки дрейфуют внутри фрагмента — схематично.
  const metalA = frame.opacity[IRON_ATOMS[0]!.id]
  if (metalA > 0.02) {
    const c = frame.ironCenter
    const h = FES_GEOM.metalHalf
    for (let k = 0; k < METAL_GAS_DOTS; k++) {
      const a = k * 2.399963 + elapsed * 0.5
      const r = h * (0.35 + 0.6 * (((k * 7919) % 97) / 97))
      gp.push(
        c.x + Math.cos(a) * r,
        c.y + Math.sin(a * 1.3) * r * 0.8,
        c.z + Math.sin(a * 0.7) * r,
        0.07,
        FX_COLOR.shell[0],
        FX_COLOR.shell[1],
        FX_COLOR.shell[2],
        metalA * 0.4,
        0.3,
      )
    }
  }

  // Притяжение опилок к магниту: точки бегут от полюса к железу.
  if (frame.magnet.opacity > 0.02 && frame.magnet.pos.y < 2) {
    const pull = frame.magnet.opacity * (1 - frame.magnet.fail * 0.75)
    for (let k = 1; k < MAGNET_DOTS; k++) {
      const u = k / MAGNET_DOTS
      _p.copy(frame.magnet.pos).lerp(frame.ironCenter, u)
      if (frame.magnet.fail > 0.02) _p.copy(frame.magnet.pos).lerp(frame.crystalCenter, u)
      const flow = 0.5 + 0.5 * Math.sin(u * 18 - elapsed * 5)
      gp.push(_p.x, _p.y, _p.z, 0.05 + 0.04 * flow, 1, 0.55, 0.45, pull * flow * 0.5, 0.3)
    }
  }

  // Схематичная валентная оболочка 4s² железа.
  drawElectronShell(gp, frame.atoms.fe1, FES_GEOM.shellFe, frame.shell, elapsed, { phase: 0.2 })

  // Два электрона со следом: Fe⁰ − 2e⁻ → Fe²⁺.
  drawElectron(gp, frame.electrons[0], elapsed)
  drawElectron(gp, frame.electrons[1], elapsed)

  // Линии электростатического поля Fe²⁺ → S²⁻ (закон Кулона).
  drawFieldLine(gp, frame.atoms.fe1, frame.atoms.s1, frame.field, elapsed)

  gp.end()
}

function updateGlows(
  world: ReturnType<typeof buildSceneWorld>,
  frame: FesFrame,
  t: number,
  cueTimes: Map<FesCueId, number>,
): void {
  const { glows, waves, puff } = world
  glows.shell!.center.copy(frame.atoms.fe1)
  glows.shell!.amount = frame.shell * 0.55
  glows.e1!.center.copy(frame.electrons[0].pos)
  glows.e1!.amount = frame.electrons[0].opacity * frame.electrons[0].glow * 0.8
  glows.e2!.center.copy(frame.electrons[1].pos)
  glows.e2!.amount = frame.electrons[1].opacity * frame.electrons[1].glow * 0.8

  // Горелка греет снизу, собственное горение светит из центра реакции.
  glows.heat!.center.set(frame.hotSpot.x, frame.hotSpot.y - 0.75, frame.hotSpot.z)
  glows.heat!.amount = frame.env.burner * 0.8
  glows.burn!.center.copy(frame.hotSpot)
  glows.burn!.amount = frame.env.burn * 0.7
  glows.exo!.center.copy(frame.crystalCenter)
  glows.exo!.amount = frame.env.exo * 0.9

  const tIgnite = cueTimes.get('ignite')
  const tExo = cueTimes.get('exo')
  const pIgnite = tIgnite != null ? pulseAt(t, tIgnite, 0.6) : 0
  const pExo = tExo != null ? pulseAt(t, tExo, 0.7) : 0
  if (pExo > pIgnite) glows.flash!.center.copy(frame.crystalCenter)
  else glows.flash!.center.copy(frame.hotSpot)
  glows.flash!.amount = Math.max(pIgnite * 0.85, pExo * 0.9)

  waves.ignite!.center.copy(frame.hotSpot)
  waves.ignite!.amount = tIgnite != null && t >= tIgnite ? Math.min(1, (t - tIgnite) / 0.9) : 0
  waves.exo!.center.copy(frame.crystalCenter)
  waves.exo!.amount = tExo != null && t >= tExo ? Math.min(1, (t - tExo) / 1.1) : 0

  puff.center.copy(frame.hotSpot)
  puff.opacity = Math.max(frame.env.burner * 0.5, frame.env.burn * 0.45, frame.env.exo * 0.55) * (1 - frame.env.fade)
  puff.rise = 0.16
  puff.turbulence = 0.22
}
