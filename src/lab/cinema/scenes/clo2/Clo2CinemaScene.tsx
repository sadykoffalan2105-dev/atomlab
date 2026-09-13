import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CPK } from '../../core/atoms'
import { createCueRunner, pulseAt, type CueRunner } from '../../core/cues'
import { resolveCinemaQuality } from '../../core/quality'
import { fresnelShellMaterial } from '../../core/materials'
import { cinemaSphere } from '../../core/geometries'
import { createSteppedStoryClock } from '../../core/steppedStoryClock'
import type { StoryClock } from '../../core/storyClock'
import {
  createCameraRigState,
  createGlowState,
  createPostDirector,
  createPuffVolumeState,
  createWaveState,
  type GlowState,
} from '../../core/states'
import { CinemaAtom } from '../../react/CinemaAtom'
import { CinemaBond } from '../../react/CinemaBond'
import { CinemaDomLabels, type DomLabelSource } from '../../react/CinemaDomLabels'
import { CinemaFlash, CinemaHalo, CinemaShockwave } from '../../react/CinemaFx'
import { CinemaGlowPoints, type GlowPointsHandle } from '../../react/CinemaGlowPoints'
import { CinemaPostFx } from '../../react/CinemaPostFx'
import { CinemaPuffVolume } from '../../react/CinemaPuffVolume'
import { CinemaCameraRig, CinemaEnvironment } from '../../react/CinemaStage'
import { CinemaBurst, CinemaVfxStage, type VfxHandle } from '../../react/CinemaVfx'
import { clo2StepStore, type Clo2StepStatus } from './clo2StepStore'
import {
  CLO2_ARROWS,
  CLO2_ATOMS,
  CLO2_CUES,
  CLO2_END,
  CLO2_GEOM,
  CLO2_RIG_SCALE,
  CLO2_SEGMENTS,
  CLO2_STEPS,
  createClo2Frame,
  sampleClo2Frame,
  validateClo2Storyboard,
  type Clo2AtomId,
  type Clo2BondId,
  type Clo2CueId,
  type Clo2ElectronId,
} from './storyboard'

/**
 * Механизм 2 NaClO₂ + Cl₂ → 2 ClO₂ + 2 NaCl в растворе — «под микроскопом», по шагам.
 *
 * Вся химия и хронометраж — в storyboard.ts (чистая функция времени). Этот
 * компонент только: 1) крутит story time отрезками шагов и отдаёт управление
 * панели урока через clo2StepStore; 2) каждый кадр сэмплирует мир и
 * раскладывает его по мешам, точкам и подписям.
 *
 * События лаборатории (embryo / birth / complete) лежат после последнего шага,
 * поэтому продукт «рождается» только когда ученик дошёл до конца или нажал
 * «Завершить».
 */

const COLOR = {
  bondClO: 0xff4a6a,
  bondNewA: 0x7fe8ff,
  bondNewB: 0xc49bff,
  radical: 0xffb347,
  hydration: 0x5fb0ff,
  bubble: 0xb6ff5c,
  cl2Gas: 0x9bd93a,
  water: 0x123d78,
  clo2Tint: 0xe8c64a,
  clo2Gas: 0xffc24a,
} as const

/** Цвет электрона = цвет «своей» пары: так видно, откуда пара пришла и куда ушла. */
const ELECTRON_RGB: Record<Clo2ElectronId, readonly [number, number, number]> = {
  e1: [0.55, 0.95, 1],
  e2: [0.55, 0.95, 1],
  e3: [0.8, 1, 0.45],
  e4: [0.8, 1, 0.45],
  e5: [0.84, 0.66, 1],
  e6: [0.84, 0.66, 1],
  tokA: [1, 0.85, 0.45],
  tokB: [1, 0.85, 0.45],
}

const ARROW_RGB: Record<string, readonly [number, number, number]> = {
  lp_to_OCl: ELECTRON_RGB.e1,
  ClCl_to_Cl: ELECTRON_RGB.e3,
  lpB_to_OCl: ELECTRON_RGB.e5,
  OCl_to_Cl: ELECTRON_RGB.e1,
  // Одиночные электроны гомолиза — янтарные, как облако неспаренного электрона ClO₂ и легенда панели.
  bridge_to_ClA: [1, 0.7, 0.28],
  bridge_to_OB: [1, 0.7, 0.28],
}

const BOND_STYLE: Record<Clo2BondId, { color: number; radius: number }> = {
  clA_oA1: { color: COLOR.bondClO, radius: 0.04 },
  clA_oA2: { color: COLOR.bondClO, radius: 0.04 },
  clB_oB1: { color: COLOR.bondClO, radius: 0.04 },
  clB_oB2: { color: COLOR.bondClO, radius: 0.04 },
  clX_clY: { color: CPK.Cl, radius: 0.046 },
  oA1_clX: { color: COLOR.bondNewA, radius: 0.042 },
  oB1_clA: { color: COLOR.bondNewB, radius: 0.036 },
}

const ELECTRON_SIZE = 0.2
const TOKEN_SIZE = 0.26
const ARROW_DOT_SPACING = 0.02
const ARROW_DOT_SIZE = 0.1
const ARROW_BARB_LENGTH = 0.13
const ARROW_BARB_DOTS = 6
/** Как часто перемеряем свободную от панелей область кадра (кадров). */
const SAFE_RECT_EVERY = 24
const BARB_ANGLE = (32 * Math.PI) / 180

export type Clo2CinemaSceneProps = {
  runId?: number
  lowPower?: boolean
  /** Прежний флаг «удлинённого» режима; урок по шагам сам ждёт ученика. */
  teacherMode?: boolean
  onNarrationCue?: (id: Clo2CueId) => void
  onEmbryoReady?: () => void
  onBirthReady?: () => void
  onComplete: () => void
}

const _p = new THREE.Vector3()
const _tan = new THREE.Vector3()
const _perp = new THREE.Vector3()
const _barb = new THREE.Vector3()
const _z = new THREE.Vector3(0, 0, 1)

export function Clo2CinemaScene({
  runId = 0,
  lowPower = false,
  onNarrationCue,
  onEmbryoReady,
  onBirthReady,
  onComplete,
}: Clo2CinemaSceneProps) {
  const quality = useMemo(() => resolveCinemaQuality(lowPower), [lowPower])
  const lite = quality.tier === 'lite'

  useEffect(() => {
    if (import.meta.env.DEV) validateClo2Storyboard()
  }, [])

  const cbRef = useRef({ onNarrationCue, onEmbryoReady, onBirthReady, onComplete })
  useEffect(() => {
    // Колбэки лаборатории зовутся из useFrame — держим свежие в рефе.
    cbRef.current = { onNarrationCue, onEmbryoReady, onBirthReady, onComplete }
  }, [onNarrationCue, onEmbryoReady, onBirthReady, onComplete])

  const clockRef = useRef<StoryClock>({ t: 0, progress: 0, rate: 1, finished: false })
  const cuesRef = useRef<CueRunner<Clo2CueId>>(createCueRunner(CLO2_CUES))
  const cueTimes = useRef<Partial<Record<Clo2CueId, number>>>({})

  // ——— Часы по шагам + мост к панели урока ———
  useEffect(() => {
    const clock = createSteppedStoryClock(CLO2_SEGMENTS)
    const cues = createCueRunner(CLO2_CUES)
    clockRef.current = clock.state
    cuesRef.current = cues
    cueTimes.current = {}
    const lastIndex = CLO2_STEPS.length - 1
    let current = 0

    const report = (index: number, status: Clo2StepStatus) => {
      current = index
      clo2StepStore.report(runId, index, status)
    }

    /** Перемотка назад/вперёд: события после точки перемотки должны выстрелить снова. */
    const seek = (t: number) => {
      clock.seekTo(t)
      cues.seek(t)
      for (const c of CLO2_CUES) if (c.at >= t) delete cueTimes.current[c.id]
    }

    const playStep = (index: number) => {
      const i = Math.max(0, Math.min(lastIndex, index))
      const step = CLO2_STEPS[i]!
      const t = clock.state.t
      if (t < step.from - 1e-3 || t >= step.to - 1e-3) seek(step.from)
      report(i, 'playing')
      clock.playTo(step.to, () => report(i, 'paused'))
    }

    const replayStep = () => {
      const i = current
      seek(CLO2_STEPS[i]!.from)
      report(i, 'playing')
      clock.playTo(CLO2_STEPS[i]!.to, () => report(i, 'paused'))
    }

    const finish = () => {
      const lastTo = CLO2_STEPS[lastIndex]!.to
      if (clock.state.t < lastTo - 1e-3) seek(lastTo)
      report(lastIndex, 'finishing')
      clock.playTo(CLO2_END, () => report(lastIndex, 'done'))
    }

    clo2StepStore.attach(runId, { playStep, replayStep, finish })
    playStep(0)

    if (import.meta.env.DEV) {
      // Отладка кадра: window.__clo2Freeze(10.2) — встать на момент сюжета без анимации.
      ;(window as unknown as { __clo2Freeze?: (t: number) => void }).__clo2Freeze = (t) => {
        clock.pause()
        clockRef.current = { t, progress: t / CLO2_END, rate: 0, finished: false }
      }
    }

    return () => {
      clock.kill()
      clo2StepStore.detach(runId)
    }
  }, [runId])

  // ——— Мир: один набор объектов на прогон; кадр пишет в него updateClo2World ———
  const world = useMemo(() => createClo2World(), [])
  const bubbleGeo = useMemo(() => cinemaSphere(0.62, lite ? 20 : 32, lite ? 14 : 24), [lite])
  useEffect(() => () => world.bubbleMat.dispose(), [world])

  const atomRefs = useRef<Partial<Record<Clo2AtomId, THREE.Group | null>>>({})
  const electrons = useRef<GlowPointsHandle>(null)
  const arrows = useRef<GlowPointsHandle>(null)
  const bubble = useRef<THREE.Mesh>(null)
  const keyLight = useRef<THREE.PointLight>(null)
  const exoLight = useRef<THREE.PointLight>(null)
  const vfxSparkA = useRef<VfxHandle>(null)
  const vfxSparkB = useRef<VfxHandle>(null)
  const vfxRadA = useRef<VfxHandle>(null)
  const vfxRadB = useRef<VfxHandle>(null)

  useFrame((state) => {
    updateClo2World(
      world,
      {
        clockRef,
        cuesRef,
        cueTimes,
        cbRef,
        atomRefs,
        electrons,
        arrows,
        bubble,
        keyLight,
        exoLight,
        vfxSparkA,
        vfxSparkB,
        vfxRadA,
        vfxRadB,
      },
      state.clock.elapsedTime,
      lite,
      { canvas: state.gl.domElement, camera: state.camera, width: state.size.width, height: state.size.height },
    )
    // Отрицательный приоритет: мир обновляется раньше useFrame дочерних связей, ореолов и подписей,
    // иначе они отстают от атомов на кадр (рендер остаётся автоматическим).
  }, -1)

  const { frame, rig, post, gas, waves, glowRefs, labelSources, bubbleMat } = world

  const R = CLO2_GEOM.radius

  const atom = (id: Clo2AtomId, color: number, radius: number, emissive: number, chargeSign?: 1 | -1) => (
    <group
      key={id}
      ref={(g) => {
        atomRefs.current[id] = g
      }}
    >
      <CinemaAtom color={color} radius={radius} quality={quality} emissive={emissive} chargeSign={chargeSign} />
    </group>
  )

  return (
    <>
      <CinemaEnvironment dust={quality.dust} background="#020a18" fogNear={8} fogFar={24} />
      {quality.post ? <CinemaPostFx director={post} lite={lite} /> : null}

      <CinemaCameraRig state={rig} baseScale={CLO2_RIG_SCALE}>
        <ambientLight intensity={lite ? 0.34 : 0.24} />
        <pointLight ref={keyLight} position={[0.4, 1.8, 2.6]} intensity={0.75} color="#d6e8ff" distance={14} />
        <pointLight ref={exoLight} position={[-0.3, 0.2, 1.1]} intensity={0.1} color="#ff9a4a" distance={8} />
        {!lite ? <pointLight position={[-2.8, 1, -1.4]} intensity={0.3} color="#3fd8ff" distance={9} /> : null}

        {/* Вода: мягкая глубина кадра. Сами молекулы воды не рисуем — это оговорено в легенде. */}
        <CinemaPuffVolume state={gas.water} count={quality.fogPuffs} size={3.8} seed={11} renderOrder={-6} />
        <CinemaPuffVolume state={gas.tint} count={quality.fogPuffs} size={3.2} seed={12} renderOrder={-5} />

        {atom('clA', CPK.Cl, R.cl, 0.3)}
        {atom('oA1', CPK.O, R.o, 0.45)}
        {atom('oA2', CPK.O, R.o, 0.45)}
        {atom('clB', CPK.Cl, R.cl, 0.3)}
        {atom('oB1', CPK.O, R.o, 0.45)}
        {atom('oB2', CPK.O, R.o, 0.45)}
        {atom('clX', CPK.Cl, R.cl, 0.36)}
        {atom('clY', CPK.Cl, R.cl, 0.36)}
        {atom('na1', CPK.Na, R.na, 0.8, 1)}
        {atom('na2', CPK.Na, R.na, 0.8, 1)}

        {(Object.keys(BOND_STYLE) as Clo2BondId[]).map((id) => (
          <CinemaBond
            key={id}
            state={frame.bonds[id]}
            color={BOND_STYLE[id].color}
            radius={BOND_STYLE[id].radius}
            plasma={quality.plasmaBonds}
          />
        ))}

        {/* Пузырёк газа Cl₂ растворяется в воде в начале урока */}
        <mesh ref={bubble} geometry={bubbleGeo} material={bubbleMat} visible={false} renderOrder={4} dispose={null} />
        <CinemaPuffVolume state={gas.cl2} count={Math.round(quality.gasPuffs * 0.5)} size={0.7} seed={13} />
        <CinemaPuffVolume state={gas.product} count={quality.gasPuffs} size={1.1} seed={14} />

        {/* Неспаренный электрон ClO₂ размазан по всей цепочке O–Cl–O (π*) — показываем облаком */}
        <CinemaHalo stateRef={glowRefs.cloudA} color={COLOR.radical} radius={0.55} />
        <CinemaHalo stateRef={glowRefs.cloudB} color={COLOR.radical} radius={0.55} />
        {/* Гидратная оболочка ионов — схематично */}
        <CinemaHalo stateRef={glowRefs.hydNa1} color={COLOR.hydration} radius={0.26} />
        <CinemaHalo stateRef={glowRefs.hydNa2} color={COLOR.hydration} radius={0.26} />
        <CinemaHalo stateRef={glowRefs.hydClX} color={COLOR.hydration} radius={0.34} />
        <CinemaHalo stateRef={glowRefs.hydClY} color={COLOR.hydration} radius={0.34} />
        <CinemaFlash stateRef={glowRefs.flash} />
        <CinemaShockwave state={waves.clTransfer} />
        <CinemaShockwave state={waves.split} />

        <CinemaGlowPoints ref={arrows} capacity={480} depthTest={false} renderOrder={9} />
        <CinemaGlowPoints ref={electrons} capacity={16} renderOrder={10} />

        <CinemaDomLabels labels={labelSources} />

        {quality.vfx ? (
          <CinemaVfxStage>
            <CinemaBurst ref={vfxSparkA} preset="spark" scale={quality.vfxScale} sizeScale={0.7} />
            <CinemaBurst ref={vfxSparkB} preset="spark" scale={quality.vfxScale} sizeScale={0.7} />
            <CinemaBurst ref={vfxRadA} preset="flash" scale={quality.vfxScale} sizeScale={0.75} />
            <CinemaBurst ref={vfxRadB} preset="flash" scale={quality.vfxScale} sizeScale={0.75} />
          </CinemaVfxStage>
        ) : null}
      </CinemaCameraRig>
    </>
  )
}

type Clo2World = ReturnType<typeof createClo2World>

function createClo2World() {
  const frame = createClo2Frame()
  const glows = {
    cloudA: createGlowState(),
    cloudB: createGlowState(),
    hydNa1: createGlowState(),
    hydNa2: createGlowState(),
    hydClX: createGlowState(),
    hydClY: createGlowState(),
    flash: createGlowState(),
  }
  const wrap = (g: GlowState) => ({ current: g })
  /** Подписи «e⁻» над жетонами баланса — отдельно от подписей раскадровки. */
  const tokenLabels: DomLabelSource[] = [
    { id: 'tokA', kind: 'token', pos: new THREE.Vector3(), opacity: 0, text: 'e⁻' },
    { id: 'tokB', kind: 'token', pos: new THREE.Vector3(), opacity: 0, text: 'e⁻' },
  ]
  return {
    frame,
    rig: createCameraRigState(),
    post: { current: createPostDirector() },
    glows,
    glowRefs: {
      cloudA: wrap(glows.cloudA),
      cloudB: wrap(glows.cloudB),
      hydNa1: wrap(glows.hydNa1),
      hydNa2: wrap(glows.hydNa2),
      hydClX: wrap(glows.hydClX),
      hydClY: wrap(glows.hydClY),
      flash: wrap(glows.flash),
    },
    waves: {
      clTransfer: createWaveState(0xbff6ff, 0.75),
      split: createWaveState(0xffd08a, 0.95),
    },
    gas: {
      water: createPuffVolumeState(COLOR.water, 3.4),
      cl2: createPuffVolumeState(COLOR.cl2Gas, 0.38),
      tint: createPuffVolumeState(COLOR.clo2Tint, 2.6),
      product: createPuffVolumeState(COLOR.clo2Gas, 0.9),
    },
    bubbleMat: fresnelShellMaterial(COLOR.bubble, 2.2, 0.9).clone(),
    tokenLabels,
    labelSources: [...frame.labels, ...tokenLabels] as DomLabelSource[],
    /** Центр и масштаб свободной области кадра (без панели урока и реактора). */
    safe: { cx: 0, cy: 0, fit: 1, counter: 0, ready: false, ox: 0, oy: 0 },
  }
}

const _o = new THREE.Vector3()
const _ox = new THREE.Vector3()

/**
 * Панель урока слева и реактор снизу закрывают часть холста. Центр действия
 * переносим в середину свободной области, а при тесной области чуть отъезжаем.
 */
function measureSafeArea(world: Clo2World, canvas: HTMLCanvasElement): void {
  const r = canvas.getBoundingClientRect()
  if (r.width < 10 || r.height < 10) return
  let left = r.left
  let right = r.right
  let top = r.top + Math.min(90, r.height * 0.1)
  let bottom = r.bottom
  const reactor = document.querySelector<HTMLElement>('[data-lab-reactor]')
  if (reactor) {
    const rr = reactor.getBoundingClientRect()
    if (rr.height > 0 && rr.top > r.top + r.height * 0.35 && rr.top < bottom) bottom = rr.top
  }
  const panel = document.querySelector<HTMLElement>('[data-lab-lesson-panel]')
  if (panel) {
    const pr = panel.getBoundingClientRect()
    if (pr.width > 0 && pr.height > 0) {
      const docksBottom = pr.width > r.width * 0.8 || pr.top > r.top + r.height * 0.5
      if (docksBottom) bottom = Math.min(bottom, pr.top)
      else if (pr.left < r.left + r.width * 0.5) left = Math.max(left, pr.right)
      else right = Math.min(right, pr.left)
    }
  }
  if (bottom - top < r.height * 0.3) top = r.top
  const safe = world.safe
  safe.cx = (left + right) / 2 - r.left
  safe.cy = (top + bottom) / 2 - r.top
  const ratio = Math.min((right - left) / r.width, (bottom - top) / r.height)
  safe.fit = Math.max(0.88, Math.min(1, 0.55 + 0.45 * ratio))
  safe.ready = true
}

type Clo2Handles = {
  clockRef: RefObject<StoryClock>
  cuesRef: RefObject<CueRunner<Clo2CueId>>
  cueTimes: RefObject<Partial<Record<Clo2CueId, number>>>
  cbRef: RefObject<Pick<Clo2CinemaSceneProps, 'onNarrationCue' | 'onEmbryoReady' | 'onBirthReady' | 'onComplete'>>
  atomRefs: RefObject<Partial<Record<Clo2AtomId, THREE.Group | null>>>
  electrons: RefObject<GlowPointsHandle | null>
  arrows: RefObject<GlowPointsHandle | null>
  bubble: RefObject<THREE.Mesh | null>
  keyLight: RefObject<THREE.PointLight | null>
  exoLight: RefObject<THREE.PointLight | null>
  vfxSparkA: RefObject<VfxHandle | null>
  vfxSparkB: RefObject<VfxHandle | null>
  vfxRadA: RefObject<VfxHandle | null>
  vfxRadB: RefObject<VfxHandle | null>
}

/** Один кадр: сэмплируем раскадровку и раскладываем мир по объектам сцены. */
function updateClo2World(
  world: Clo2World,
  h: Clo2Handles,
  elapsed: number,
  lite: boolean,
  view: { canvas: HTMLCanvasElement; camera: THREE.Camera; width: number; height: number },
): void {
  const { frame, glows, waves, gas, rig, post, bubbleMat, tokenLabels } = world
  const { clockRef, cuesRef, cueTimes, cbRef, atomRefs, electrons, arrows, bubble, keyLight, exoLight } = h
  const { vfxSparkA, vfxSparkB, vfxRadA, vfxRadB } = h
  const t = clockRef.current.t
  sampleClo2Frame(t, frame)

  // ——— События ———
  cuesRef.current.update(t, (id) => {
    cueTimes.current[id] = t
    const cb = cbRef.current
    cb.onNarrationCue?.(id)
    switch (id) {
      case 'clTransfer':
        vfxSparkA.current?.node()?.position.copy(frame.atoms.clX)
        vfxSparkA.current?.fire()
        break
      case 'split':
        vfxSparkB.current?.node()?.position.copy(frame.atoms.oA1)
        vfxSparkB.current?.fire()
        break
      case 'radicals':
        vfxRadA.current?.node()?.position.copy(frame.clouds.A.center)
        vfxRadB.current?.node()?.position.copy(frame.clouds.B.center)
        vfxRadA.current?.fire()
        vfxRadB.current?.fire()
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

  // ——— Атомы ———
  const anionScaleX = 1 + frame.anion.clX * (CLO2_GEOM.radius.clAnion / CLO2_GEOM.radius.cl - 1)
  const anionScaleY = 1 + frame.anion.clY * (CLO2_GEOM.radius.clAnion / CLO2_GEOM.radius.cl - 1)
  for (const a of CLO2_ATOMS) {
    const g = atomRefs.current[a.id]
    if (!g) continue
    g.position.copy(frame.atoms[a.id])
    if (a.id === 'clX') g.scale.setScalar(anionScaleX)
    else if (a.id === 'clY') g.scale.setScalar(anionScaleY)
  }

  // ——— Электроны ———
  const e = electrons.current
  if (e) {
    e.begin()
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5.2)
    for (const el of frame.electrons) {
      if (el.opacity <= 0.01) continue
      const [r, g, b] = ELECTRON_RGB[el.id]
      const size = (el.token ? TOKEN_SIZE : ELECTRON_SIZE) * (1 + el.glow * (0.4 + 0.15 * pulse))
      e.push(el.pos.x, el.pos.y, el.pos.z, size, r, g, b, el.opacity, el.token ? 0.3 : 0.85)
    }
    e.end()
  }
  for (let i = 0; i < tokenLabels.length; i++) {
    const tok = frame.electrons[6 + i]!
    const lbl = tokenLabels[i]!
    lbl.opacity = tok.opacity
    lbl.pos.copy(tok.pos)
    lbl.pos.y += 0.14
  }

  // ——— Изогнутые стрелки механизма ———
  const ar = arrows.current
  if (ar) {
    ar.begin()
    const flowT = elapsed * 3.2
    for (let i = 0; i < CLO2_ARROWS.length; i++) {
      const def = CLO2_ARROWS[i]!
      const s = frame.arrows[i]!
      if (s.opacity <= 0.01 || s.draw <= 0.001) continue
      const [r, g, b] = ARROW_RGB[def.id] ?? [1, 1, 1]
      const approxLen = s.p0.distanceTo(s.ctrl) + s.ctrl.distanceTo(s.p1)
      const n = Math.max(4, Math.ceil(approxLen / ARROW_DOT_SPACING))
      const drawn = Math.floor(n * s.draw)
      for (let k = 0; k <= drawn; k++) {
        const u = k / n
        bezier(s.p0, s.ctrl, s.p1, u, _p)
        // Бегущая яркость: направление движения пары читается без подписи.
        const flow = 0.72 + 0.28 * Math.sin(u * 14 - flowT)
        ar.push(_p.x, _p.y, _p.z, ARROW_DOT_SIZE, r, g, b, s.opacity * flow * 0.8, 0.35)
      }
      if (s.draw > 0.92) {
        // Наконечник: полная стрелка — пара электронов, «рыболовный крючок» — один электрон.
        const u = drawn / n
        bezier(s.p0, s.ctrl, s.p1, u, _p)
        bezierTangent(s.p0, s.ctrl, s.p1, u, _tan)
        _perp.copy(_tan).cross(_z)
        if (_perp.lengthSq() < 1e-8) _perp.set(0, 1, 0)
        _perp.normalize()
        const headAlpha = s.opacity * Math.min(1, (s.draw - 0.92) / 0.08)
        const sides = def.kind === 'pair' ? [1, -1] : [Math.sign(def.bend) || 1]
        for (const side of sides) {
          _barb
            .copy(_tan)
            .multiplyScalar(-Math.cos(BARB_ANGLE))
            .addScaledVector(_perp, side * Math.sin(BARB_ANGLE))
          for (let k = 1; k <= ARROW_BARB_DOTS; k++) {
            const d = (k / ARROW_BARB_DOTS) * ARROW_BARB_LENGTH
            ar.push(_p.x + _barb.x * d, _p.y + _barb.y * d, _p.z + _barb.z * d, ARROW_DOT_SIZE, r, g, b, headAlpha * 0.9, 0.35)
          }
        }
      }
    }
    ar.end()
  }

  // ——— Радикалы, гидратация, вспышки ———
  glows.cloudA.center.copy(frame.clouds.A.center)
  glows.cloudA.amount = frame.clouds.A.amount * 1.6
  glows.cloudB.center.copy(frame.clouds.B.center)
  glows.cloudB.amount = frame.clouds.B.amount * 1.6
  glows.hydNa1.center.copy(frame.atoms.na1)
  glows.hydNa1.amount = frame.hydration.na1
  glows.hydNa2.center.copy(frame.atoms.na2)
  glows.hydNa2.amount = frame.hydration.na2
  glows.hydClX.center.copy(frame.atoms.clX)
  glows.hydClX.amount = frame.hydration.clX
  glows.hydClY.center.copy(frame.atoms.clY)
  glows.hydClY.amount = frame.hydration.clY

  const tTransfer = cueTimes.current.clTransfer
  const tSplit = cueTimes.current.split
  const pTransfer = tTransfer != null ? pulseAt(t, tTransfer, 0.5) : 0
  const pSplit = tSplit != null ? pulseAt(t, tSplit, 0.6) : 0
  if (pSplit > pTransfer) glows.flash.center.copy(frame.atoms.oA1).lerp(frame.atoms.clX, 0.5)
  else glows.flash.center.copy(frame.atoms.clX).lerp(frame.atoms.clY, 0.5)
  glows.flash.amount = Math.max(pTransfer, pSplit) * 0.8
  waves.clTransfer.center.copy(frame.atoms.clX)
  waves.clTransfer.amount = tTransfer != null && t >= tTransfer ? Math.min(1, (t - tTransfer) / 0.8) : 0
  waves.split.center.copy(frame.atoms.clA)
  waves.split.amount = tSplit != null && t >= tSplit ? Math.min(1, (t - tSplit) / 0.9) : 0

  // ——— Среда: вода, пузырёк Cl₂, жёлтый ClO₂ ———
  const env = frame.env
  gas.water.center.set(0, -0.2, -1.8)
  gas.water.opacity = env.medium
  gas.water.rise = 0.02
  gas.water.turbulence = 0.18
  gas.cl2.center.copy(env.bubble.center)
  gas.cl2.opacity = env.cl2Gas
  gas.cl2.spread = 0.38 * env.bubble.scale
  gas.cl2.rise = 0.02
  gas.cl2.turbulence = 0.12
  gas.tint.center.set(-0.2, 0, -0.9)
  gas.tint.opacity = env.clo2Tint
  gas.tint.rise = 0.04
  gas.tint.turbulence = 0.16
  gas.product.center.copy(frame.clouds.A.center).lerp(frame.clouds.B.center, 0.5)
  gas.product.center.y += 0.9
  gas.product.opacity = env.productGas
  gas.product.rise = 0.3
  gas.product.turbulence = 0.2

  if (bubble.current) {
    const visible = env.bubble.opacity > 0.01
    bubble.current.visible = visible
    if (visible) {
      bubble.current.position.copy(env.bubble.center)
      bubble.current.scale.setScalar(env.bubble.scale)
      bubbleMat.uniforms.uIntensity!.value = env.bubble.opacity * 0.9
    }
  }

  // ——— Свет, камера, пост ———
  if (keyLight.current) keyLight.current.intensity = 0.75 * (1 - env.fade * 0.8)
  if (exoLight.current) exoLight.current.intensity = 0.1 + env.exo * (lite ? 1.1 : 1.9)

  const cam = frame.camera
  const safe = world.safe
  if (safe.counter++ % SAFE_RECT_EVERY === 0) measureSafeArea(world, view.canvas)
  const fit = safe.ready ? safe.fit : 1
  rig.zoom = cam.zoom * fit
  rig.offset.copy(cam.offset).multiplyScalar(fit)
  if (safe.ready) {
    // Сдвиг в плоскости z = 0: сколько пикселей в мировой единице и где сейчас центр.
    _o.set(0, 0, 0).project(view.camera)
    _ox.set(1, 0, 0).project(view.camera)
    const pxPerUnit = Math.abs(_ox.x - _o.x) * 0.5 * view.width
    if (pxPerUnit > 1e-3) {
      const ox = (safe.cx - (_o.x * 0.5 + 0.5) * view.width) / pxPerUnit
      const oy = -(safe.cy - (-_o.y * 0.5 + 0.5) * view.height) / pxPerUnit
      safe.ox += (ox - safe.ox) * 0.08
      safe.oy += (oy - safe.oy) * 0.08
      rig.offset.x += safe.ox
      rig.offset.y += safe.oy
    }
  }
  rig.yaw = cam.yaw
  rig.roll = cam.roll
  rig.shake = cam.shake
  post.current.bloom = cam.bloom
  post.current.vignette = Math.max(cam.vignette, env.fade)
}

function bezier(p0: THREE.Vector3, c: THREE.Vector3, p1: THREE.Vector3, u: number, out: THREE.Vector3): THREE.Vector3 {
  const a = (1 - u) * (1 - u)
  const b = 2 * (1 - u) * u
  const d = u * u
  return out.set(a * p0.x + b * c.x + d * p1.x, a * p0.y + b * c.y + d * p1.y, a * p0.z + b * c.z + d * p1.z)
}

function bezierTangent(p0: THREE.Vector3, c: THREE.Vector3, p1: THREE.Vector3, u: number, out: THREE.Vector3): THREE.Vector3 {
  out.set(
    2 * (1 - u) * (c.x - p0.x) + 2 * u * (p1.x - c.x),
    2 * (1 - u) * (c.y - p0.y) + 2 * u * (p1.y - c.y),
    2 * (1 - u) * (c.z - p0.z) + 2 * u * (p1.z - c.z),
  )
  if (out.lengthSq() < 1e-10) out.set(1, 0, 0)
  return out.normalize()
}
