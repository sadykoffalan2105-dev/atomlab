import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CPK } from '../../core/atoms'
import { createAtomPool, createBondPool, writeHexLinear, writeVec3 } from '../../core/pools'
import { createCueRunner, pulseAt, type CueRunner } from '../../core/cues'
import { resolveCinemaQuality } from '../../core/quality'
import { createSteppedStoryClock } from '../../core/steppedStoryClock'
import type { StoryClock } from '../../core/storyClock'
import { applyCameraToRig, createSafeArea } from '../../core/safeArea'
import {
  createCameraRigState,
  createGlowState,
  createPostDirector,
  createPuffVolumeState,
  createWaveState,
  type GlowState,
} from '../../core/states'
import { CinemaDomLabels, type DomLabelSource } from '../../react/CinemaDomLabels'
import { CinemaFlash, CinemaHalo, CinemaShockwave } from '../../react/CinemaFx'
import { CinemaGlowPoints, type GlowPointsHandle } from '../../react/CinemaGlowPoints'
import { CinemaPostFx } from '../../react/CinemaPostFx'
import { CinemaPuffVolume } from '../../react/CinemaPuffVolume'
import { CinemaCameraRig, CinemaEnvironment } from '../../react/CinemaStage'
import { setCinemaTimeFrozen, useCinemaTime, type CinemaTimeState } from '../../react/CinemaTime'
import { InstancedAtoms } from '../../react/InstancedAtoms'
import { InstancedBonds } from '../../react/InstancedBonds'
import { CinemaBurst, CinemaVfxStage, type VfxHandle } from '../../react/CinemaVfx'
import { isPerfProbeEnabled } from '../../../perf/labPerfProbe'
import { cinemaPlayhead, clo2StepStore, type Clo2StepStatus } from '../clo2/clo2StepStore'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import {
  createNaclFrame,
  NACL_ATOMS,
  NACL_CUES,
  NACL_EDGES,
  NACL_END,
  NACL_GEOM,
  NACL_RIG_SCALE,
  NACL_SEGMENTS,
  NACL_STEPS,
  naclElectronPoint,
  sampleNaclFrame,
  validateNaclStoryboard,
  type NaclAtomId,
  type NaclCueId,
} from './naclStoryboard'

/**
 * Урок «ионная связь»: 2 Na + Cl₂ → 2 NaCl по шагам.
 *
 * Движок общий с ClO₂ (часы по шагам, пулы инстансов, эффекты, подписи);
 * здесь только раскадровка NaCl (naclStoryboard.ts) и тонкий рендер.
 * Панель урока и озвучка живут вне Canvas и общаются через clo2StepStore
 * с lesson = 'nacl'.
 */

const COLOR = {
  electron: [0.6, 0.92, 1.0] as const,
  orbital: [0.42, 0.7, 1.0] as const,
  attractPlus: [1.0, 0.72, 0.5] as const,
  attractMinus: [0.55, 0.85, 1.0] as const,
  exoHalo: 0xffb264,
  contactWave: 0xbff6ff,
  exoWave: 0xffc27a,
  warmGas: 0xffa858,
  flash: 0xfff1d6,
}

/** Электрон крупнее, чем в уроке ClO₂: в кадре всего четыре атома, а его путь — суть шага. */
const ELECTRON_SIZE = 0.32
const TRAIL_POINTS = 16
const ORBITAL_DOTS = 28
const ATTRACT_DOTS = 12
const BOND_RADIUS = 0.05
const EDGE_RADIUS = 0.016

const ATOM_ELEMENT: Record<NaclAtomId, 'Na' | 'Cl'> = {} as Record<NaclAtomId, 'Na' | 'Cl'>
const ATOM_INDEX: Record<NaclAtomId, number> = {} as Record<NaclAtomId, number>
NACL_ATOMS.forEach((a, i) => {
  ATOM_ELEMENT[a.id] = a.el
  ATOM_INDEX[a.id] = i
})

const _p = new THREE.Vector3()
const _q = new THREE.Vector3()

export function NaclCinemaScene({
  runId = 0,
  lowPower = false,
  onNarrationCue,
  onEmbryoReady,
  onBirthReady,
  onComplete,
}: ScientificSynthesisFxProps) {
  const quality = useMemo(() => resolveCinemaQuality(lowPower), [lowPower])
  const lite = quality.tier === 'lite'

  useEffect(() => {
    if (import.meta.env.DEV) validateNaclStoryboard()
  }, [])

  const cbRef = useRef({ onNarrationCue, onEmbryoReady, onBirthReady, onComplete })
  useEffect(() => {
    // Колбэки лаборатории зовутся из useFrame — держим свежие в рефе.
    cbRef.current = { onNarrationCue, onEmbryoReady, onBirthReady, onComplete }
  }, [onNarrationCue, onEmbryoReady, onBirthReady, onComplete])

  const clockRef = useRef<StoryClock>({ t: 0, progress: 0, rate: 1, finished: false })
  const cuesRef = useRef<CueRunner<NaclCueId>>(createCueRunner(NACL_CUES))
  const cueTimes = useRef<Partial<Record<NaclCueId, number>>>({})

  // ——— Часы по шагам + мост к панели урока ———
  useEffect(() => {
    const clock = createSteppedStoryClock(NACL_SEGMENTS)
    const cues = createCueRunner(NACL_CUES)
    clockRef.current = clock.state
    cuesRef.current = cues
    cueTimes.current = {}
    const lastIndex = NACL_STEPS.length - 1
    let current = 0

    const report = (index: number, status: Clo2StepStatus) => {
      current = index
      clo2StepStore.report(runId, index, status)
    }

    /** Перемотка: события после точки перемотки должны выстрелить снова. */
    const seek = (t: number) => {
      clock.seekTo(t)
      cues.seek(t)
      for (const c of NACL_CUES) if (c.at >= t) delete cueTimes.current[c.id]
    }

    const playStep = (index: number) => {
      const i = Math.max(0, Math.min(lastIndex, index))
      const step = NACL_STEPS[i]!
      const t = clock.state.t
      if (t < step.from - 1e-3 || t >= step.to - 1e-3) seek(step.from)
      report(i, 'playing')
      clock.playTo(step.to, () => report(i, 'paused'))
    }

    const replayStep = () => {
      const i = current
      seek(NACL_STEPS[i]!.from)
      report(i, 'playing')
      clock.playTo(NACL_STEPS[i]!.to, () => report(i, 'paused'))
    }

    const finish = () => {
      const lastTo = NACL_STEPS[lastIndex]!.to
      if (clock.state.t < lastTo - 1e-3) seek(lastTo)
      report(lastIndex, 'finishing')
      clock.playTo(NACL_END, () => report(lastIndex, 'done'))
    }

    clo2StepStore.attach(runId, { playStep, replayStep, finish }, 'nacl', NACL_STEPS.length)
    playStep(0)

    if (isPerfProbeEnabled()) {
      // Отладка кадра: window.__naclFreeze(9.3) — встать на момент сюжета без анимации.
      ;(window as unknown as { __naclFreeze?: (t: number) => void }).__naclFreeze = (t) => {
        clock.pause()
        clockRef.current = { t, progress: t / NACL_END, rate: 0, finished: false }
        setCinemaTimeFrozen(true, t)
      }
    }

    return () => {
      clock.kill()
      clo2StepStore.detach(runId)
      setCinemaTimeFrozen(false)
    }
  }, [runId])

  const world = useMemo(() => createNaclWorld(), [])
  const time = useCinemaTime()
  const points = useRef<GlowPointsHandle>(null)
  const vfxSparkA = useRef<VfxHandle>(null)
  const vfxSparkB = useRef<VfxHandle>(null)
  const vfxExo = useRef<VfxHandle>(null)

  useFrame((state) => {
    updateNaclWorld(
      world,
      { clockRef, cuesRef, cueTimes, cbRef, time, runId, points, vfxSparkA, vfxSparkB, vfxExo },
      { canvas: state.gl.domElement, camera: state.camera, width: state.size.width, height: state.size.height },
    )
  }, -1)

  const { rig, post, gas, waves, glowRefs, labelSources, atomPool, bondPool, visualTime } = world

  return (
    <>
      <CinemaEnvironment dust={quality.dust} background="#070a1a" fogNear={8} fogFar={24} />
      {quality.post ? <CinemaPostFx director={post} lite={lite} toneMapping="neutral" /> : null}

      <CinemaCameraRig state={rig} baseScale={NACL_RIG_SCALE}>
        {/* Тёплое свечение выделяющейся энергии — объёмный туман вокруг решётки. */}
        <CinemaPuffVolume state={gas.warm} count={quality.gasPuffs} size={1.6} seed={21} renderOrder={-5} />

        <InstancedBonds pool={bondPool} time={visualTime} lite={lite} renderOrder={1} />
        <InstancedAtoms pool={atomPool} mode={quality.impostorAtoms ? 'impostor' : 'mesh'} renderOrder={2} />

        {/* Подсветка 3s-орбитали натрия перед отдачей электрона; ореол тепла при сборке решётки. */}
        <CinemaHalo stateRef={glowRefs.orb1} color={0x6fb4ff} radius={NACL_GEOM.orbital3s * 1.15} />
        <CinemaHalo stateRef={glowRefs.orb2} color={0x6fb4ff} radius={NACL_GEOM.orbital3s * 1.15} />
        {/* Мягкое голубое сияние вокруг летящего электрона — его путь читается и на телефоне. */}
        <CinemaHalo stateRef={glowRefs.e1} color={0x9ee4ff} radius={0.3} />
        <CinemaHalo stateRef={glowRefs.e2} color={0x9ee4ff} radius={0.3} />
        <CinemaHalo stateRef={glowRefs.exo} color={COLOR.exoHalo} radius={0.9} />
        <CinemaFlash stateRef={glowRefs.flash} color={COLOR.flash} />
        <CinemaShockwave state={waves.contact} />
        <CinemaShockwave state={waves.exo} />

        {/* Электроны, их след, кольцо орбитали и линии притяжения — один draw call. */}
        <CinemaGlowPoints ref={points} capacity={160} renderOrder={10} />

        <CinemaDomLabels labels={labelSources} />

        {quality.vfx ? (
          <CinemaVfxStage>
            <CinemaBurst ref={vfxSparkA} preset="spark" scale={quality.vfxScale} sizeScale={0.7} />
            <CinemaBurst ref={vfxSparkB} preset="spark" scale={quality.vfxScale} sizeScale={0.7} />
            <CinemaBurst ref={vfxExo} preset="flash" scale={quality.vfxScale} sizeScale={1.1} />
          </CinemaVfxStage>
        ) : null}
      </CinemaCameraRig>
    </>
  )
}

type NaclWorld = ReturnType<typeof createNaclWorld>

function createNaclWorld() {
  const frame = createNaclFrame()
  const glows = {
    orb1: createGlowState(),
    orb2: createGlowState(),
    e1: createGlowState(),
    e2: createGlowState(),
    exo: createGlowState(),
    flash: createGlowState(),
  }
  const wrap = (g: GlowState) => ({ current: g })
  return {
    frame,
    rig: createCameraRigState(),
    post: { current: createPostDirector() },
    glows,
    glowRefs: {
      orb1: wrap(glows.orb1),
      orb2: wrap(glows.orb2),
      e1: wrap(glows.e1),
      e2: wrap(glows.e2),
      exo: wrap(glows.exo),
      flash: wrap(glows.flash),
    },
    waves: {
      contact: createWaveState(COLOR.contactWave, 0.7),
      exo: createWaveState(COLOR.exoWave, 1.3),
    },
    gas: { warm: createPuffVolumeState(COLOR.warmGas, 1.1) },
    labelSources: frame.labels as DomLabelSource[],
    atomPool: createAtomPool(NACL_ATOMS.length),
    bondPool: createBondPool(1 + NACL_EDGES.length),
    visualTime: { current: 0 },
    safe: createSafeArea(),
  }
}

type NaclHandles = {
  clockRef: RefObject<StoryClock>
  cuesRef: RefObject<CueRunner<NaclCueId>>
  cueTimes: RefObject<Partial<Record<NaclCueId, number>>>
  cbRef: RefObject<Pick<ScientificSynthesisFxProps, 'onNarrationCue' | 'onEmbryoReady' | 'onBirthReady' | 'onComplete'>>
  time: RefObject<CinemaTimeState>
  runId: number
  points: RefObject<GlowPointsHandle | null>
  vfxSparkA: RefObject<VfxHandle | null>
  vfxSparkB: RefObject<VfxHandle | null>
  vfxExo: RefObject<VfxHandle | null>
}

function updateNaclWorld(
  world: NaclWorld,
  h: NaclHandles,
  view: { canvas: HTMLCanvasElement; camera: THREE.Camera; width: number; height: number },
): void {
  const { frame, glows, waves, gas, rig, post } = world
  const { clockRef, cuesRef, cueTimes, cbRef } = h
  const t = clockRef.current.t
  const elapsed = h.time.current.visual
  world.visualTime.current = elapsed
  cinemaPlayhead.t = t
  cinemaPlayhead.runId = h.runId
  sampleNaclFrame(t, frame)

  // ——— События ———
  cuesRef.current.update(t, (id) => {
    cueTimes.current[id] = t
    const cb = cbRef.current
    cb.onNarrationCue?.(id)
    switch (id) {
      case 'transfer':
        h.vfxSparkA.current?.node()?.position.copy(frame.atoms.clA)
        h.vfxSparkA.current?.fire()
        h.vfxSparkB.current?.node()?.position.copy(frame.atoms.clB)
        h.vfxSparkB.current?.fire()
        break
      case 'exo':
        h.vfxExo.current?.node()?.position.copy(frame.cubeCenter)
        h.vfxExo.current?.fire()
        break
      case 'embryo':
        cb.onEmbryoReady?.()
        break
      case 'birth':
        cb.onBirthReady?.()
        break
      case 'complete':
        cb.onComplete()
        break
    }
  })

  writeAtomPool(world)
  writeBondPool(world)

  // ——— Электроны, след, орбиталь, притяжение ———
  const gp = h.points.current
  if (gp) {
    gp.begin()
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5.2)
    const [er, eg, eb] = COLOR.electron
    for (const el of frame.electrons) {
      if (el.opacity <= 0.01) continue
      // След за электроном в полёте: точки позади по той же дуге, гаснут к хвосту.
      if (el.progress > 0.001 && el.progress < 0.999) {
        for (let k = 1; k <= TRAIL_POINTS; k++) {
          const p = el.progress - k * 0.04
          if (p <= 0) break
          naclElectronPoint(el, p, _p)
          const a = el.opacity * (1 - k / (TRAIL_POINTS + 1)) * 0.8
          gp.push(_p.x, _p.y, _p.z, ELECTRON_SIZE * (0.8 - 0.035 * k), er, eg, eb, a, 0.55)
        }
      }
      const size = ELECTRON_SIZE * (1 + el.glow * (0.45 + 0.15 * pulse))
      gp.push(el.pos.x, el.pos.y, el.pos.z, size, er, eg, eb, el.opacity, 0.9)
    }

    // Кольцо 3s-орбитали: пунктир вокруг натрия, бегущая яркость по окружности.
    const [or, og, ob] = COLOR.orbital
    const ring = (center: THREE.Vector3, amount: number, phase: number) => {
      if (amount <= 0.01) return
      const rad = NACL_GEOM.orbital3s
      for (let k = 0; k < ORBITAL_DOTS; k++) {
        const a = (k / ORBITAL_DOTS) * Math.PI * 2 + phase
        const flow = 0.6 + 0.4 * Math.sin(a * 3 - elapsed * 2.4)
        gp.push(center.x + Math.cos(a) * rad, center.y + Math.sin(a) * rad, center.z + 0.01, 0.075, or, og, ob, amount * flow * 0.8, 0.3)
      }
    }
    ring(frame.atoms.na1, frame.orbital.na1, 0.2)
    ring(frame.atoms.na2, frame.orbital.na2, -0.2)

    // Линии притяжения: точки бегут от каждого иона навстречу партнёру.
    if (frame.attract > 0.01) {
      const pair = (na: THREE.Vector3, cl: THREE.Vector3) => {
        for (let k = 1; k < ATTRACT_DOTS; k++) {
          const u = k / ATTRACT_DOTS
          _p.copy(na).lerp(cl, u)
          const toward = u < 0.5 ? COLOR.attractPlus : COLOR.attractMinus
          const flow = 0.5 + 0.5 * Math.sin((u < 0.5 ? u : 1 - u) * 26 - elapsed * 6)
          gp.push(_p.x, _p.y, _p.z, 0.06 + 0.05 * flow, toward[0], toward[1], toward[2], frame.attract * flow * 0.7, 0.35)
        }
      }
      pair(frame.atoms.na1, frame.atoms.clA)
      pair(frame.atoms.na2, frame.atoms.clB)
    }
    gp.end()
  }

  // ——— Ореолы, вспышки, волны ———
  glows.orb1.center.copy(frame.atoms.na1)
  glows.orb1.amount = frame.orbital.na1 * 0.55
  glows.orb2.center.copy(frame.atoms.na2)
  glows.orb2.amount = frame.orbital.na2 * 0.55
  glows.e1.center.copy(frame.electrons[0].pos)
  glows.e1.amount = frame.electrons[0].opacity * frame.electrons[0].glow * 0.8
  glows.e2.center.copy(frame.electrons[1].pos)
  glows.e2.amount = frame.electrons[1].opacity * frame.electrons[1].glow * 0.8
  glows.exo.center.copy(frame.cubeCenter)
  glows.exo.amount = frame.env.exo * 0.9

  const tTransfer = cueTimes.current.transfer
  const tExo = cueTimes.current.exo
  const tContact = cueTimes.current.contact
  const pTransfer = tTransfer != null ? pulseAt(t, tTransfer, 0.45) : 0
  const pExo = tExo != null ? pulseAt(t, tExo, 0.7) : 0
  if (pExo > pTransfer) glows.flash.center.copy(frame.cubeCenter)
  else glows.flash.center.copy(frame.atoms.clA).lerp(frame.atoms.clB, 0.5)
  glows.flash.amount = Math.max(pTransfer * 0.6, pExo * 0.9)

  waves.contact.center.copy(frame.cubeCenter)
  waves.contact.amount = tContact != null && t >= tContact ? Math.min(1, (t - tContact) / 0.8) : 0
  waves.exo.center.copy(frame.cubeCenter)
  waves.exo.amount = tExo != null && t >= tExo ? Math.min(1, (t - tExo) / 1.1) : 0

  gas.warm.center.copy(frame.cubeCenter)
  gas.warm.opacity = frame.env.exo * 0.55 * (1 - frame.env.fade)
  gas.warm.rise = 0.12
  gas.warm.turbulence = 0.18

  // ——— Камера, пост ———
  applyCameraToRig(rig, world.safe, frame.camera, view)
  post.current.bloom = frame.camera.bloom
  post.current.vignette = Math.max(frame.camera.vignette, frame.env.fade)
  void _q
}

function writeAtomPool(world: NaclWorld): void {
  const { frame, atomPool: pool } = world
  for (let i = 0; i < NACL_ATOMS.length; i++) {
    const def = NACL_ATOMS[i]!
    const p = frame.atoms[def.id]
    writeVec3(pool.position, i, p.x, p.y, p.z)
    pool.radius[i] = frame.radius[def.id]
    pool.charge[i] = frame.charge[def.id]
    pool.emissive[i] = frame.emissive[def.id]
    pool.opacity[i] = frame.opacity[def.id] * (1 - frame.env.fade * 0.6)
    writeHexLinear(pool.color, i, CPK[def.el])
  }
  pool.count = NACL_ATOMS.length
  pool.version++
}

function writeBondPool(world: NaclWorld): void {
  const { frame, bondPool: pool } = world
  // 0 — связь Cl–Cl: напряжение, перешеек и симметричный (гомолитический) разрыв.
  const a = frame.atoms.clA
  const b = frame.atoms.clB
  writeVec3(pool.a, 0, a.x, a.y, a.z)
  writeVec3(pool.b, 0, b.x, b.y, b.z)
  pool.radius[0] = BOND_RADIUS
  writeHexLinear(pool.colorA, 0, CPK.Cl)
  writeHexLinear(pool.colorB, 0, CPK.Cl)
  pool.order[0] = 1
  pool.split[0] = 0
  pool.polarity[0] = 0
  pool.opacity[0] = frame.bond.opacity
  pool.form[0] = 1
  pool.stress[0] = frame.bond.stress
  pool.thinning[0] = frame.bond.split
  writeVec3(pool.piNormal, 0, 0, 0, 0)

  // 1… — рёбра кубического фрагмента: тонкие полупрозрачные направляющие Na⁺–Cl⁻.
  for (let k = 0; k < NACL_EDGES.length; k++) {
    const i = 1 + k
    const [ia, ib] = NACL_EDGES[k]!
    const pa = frame.atoms[ia]
    const pb = frame.atoms[ib]
    writeVec3(pool.a, i, pa.x, pa.y, pa.z)
    writeVec3(pool.b, i, pb.x, pb.y, pb.z)
    pool.radius[i] = EDGE_RADIUS
    writeHexLinear(pool.colorA, i, 0xcfe4ff)
    writeHexLinear(pool.colorB, i, 0xcfe4ff)
    pool.order[i] = 1
    pool.split[i] = 0
    pool.polarity[i] = 0
    pool.opacity[i] = frame.edges * Math.min(frame.opacity[ia], frame.opacity[ib])
    pool.form[i] = 1
    pool.stress[i] = 0
    pool.thinning[i] = 0
    writeVec3(pool.piNormal, i, 0, 0, 0)
  }
  pool.count = 1 + NACL_EDGES.length
  pool.version++
}
