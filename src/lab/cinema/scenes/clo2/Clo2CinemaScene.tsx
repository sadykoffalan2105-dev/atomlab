import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CPK } from '../../core/atoms'
import { createCueRunner, pulseAt, type CueRunner } from '../../core/cues'
import { jitter, sampleScalar, sampleVec3 } from '../../core/tracks'
import { resolveCinemaQuality } from '../../core/quality'
import {
  createBondState,
  createCameraRigState,
  createGlowState,
  createHudState,
  createPostDirector,
  createPuffVolumeState,
  createWaveState,
} from '../../core/states'
import { createBentFrame, writeBent } from '../../core/vsepr'
import { CinemaAtom } from '../../react/CinemaAtom'
import { CinemaBond } from '../../react/CinemaBond'
import { CinemaFlash, CinemaHalo, CinemaReactionZone, CinemaShockwave } from '../../react/CinemaFx'
import { CinemaCaption, CinemaCounter, CinemaOxidationTag } from '../../react/CinemaHud'
import { CinemaPostFx } from '../../react/CinemaPostFx'
import { CinemaPuffVolume } from '../../react/CinemaPuffVolume'
import { CinemaCameraRig, CinemaEnvironment } from '../../react/CinemaStage'
import { CinemaBurst, CinemaVfxStage, type VfxHandle } from '../../react/CinemaVfx'
import { useStoryClock } from '../../react/useStoryClock'
import {
  CLO2_CAPTIONS,
  CLO2_CUES,
  CLO2_GEOM,
  CLO2_NARRATION_CUES,
  CLO2_PHASE,
  CLO2_SEGMENTS,
  CLO2_SEGMENTS_TEACHER,
  CLO2_TRACKS,
  CLO2_TRANSFER_WINDOW,
  clo2StageAt,
  validateClo2Storyboard,
  type Clo2CueId,
} from './storyboard'

/**
 * 2 NaClO₂ + Cl₂ → 2 NaCl + 2 ClO₂ — кинематографическая сцена на ATOMLAB Cinema.
 *
 * Компонент почти не содержит логики: он сэмплирует дорожки раскадровки и
 * раскладывает результат по объектам. Вся «драматургия» лежит в storyboard.ts,
 * поэтому сцену можно править как сценарий, не трогая рендер.
 *
 * Непрерывность: атомы существуют от первого до последнего кадра, каждый едет
 * по своей дорожке. Ни один атом не подменяется «клоном» на смене фазы —
 * именно из-за этого прошлая версия дёргалась.
 */

const GAS_CL2_COLOR = 0x9bd93a
const GAS_CLO2_COLOR = 0xff7a3c
const FOG_COLOR = 0x2b3f78
const AMBER = 0xff8a3c
const BOND_CLO_COLOR = 0xff4a6a
const BOND_IONIC_COLOR = 0xb98cff

export type Clo2CinemaSceneProps = {
  runId?: number
  lowPower?: boolean
  /** Удлинённый wall-time под озвучку преподавателя. */
  teacherMode?: boolean
  onNarrationCue?: (id: Clo2CueId) => void
  onEmbryoReady?: () => void
  onBirthReady?: () => void
  onComplete: () => void
}

export function Clo2CinemaScene({
  runId = 0,
  lowPower = false,
  teacherMode = false,
  onNarrationCue,
  onEmbryoReady,
  onBirthReady,
  onComplete,
}: Clo2CinemaSceneProps) {
  const quality = useMemo(() => resolveCinemaQuality(lowPower), [lowPower])
  const lite = quality.tier === 'lite'
  /** Длинный wall-time + lead-cues, если есть озвучка (не только teacherMode prop). */
  const narrated = Boolean(teacherMode || onNarrationCue)
  const segments = narrated ? CLO2_SEGMENTS_TEACHER : CLO2_SEGMENTS

  useEffect(() => {
    // Раскадровка — данные, их корректность проверяем один раз при монтировании.
    if (import.meta.env.DEV) validateClo2Storyboard()
  }, [])

  const { clock, cues } = useStoryClock<Clo2CueId>(runId, segments, CLO2_CUES)
  const narrationCuesRef = useRef<CueRunner<Clo2CueId>>(createCueRunner(CLO2_NARRATION_CUES))

  useEffect(() => {
    narrationCuesRef.current = createCueRunner(CLO2_NARRATION_CUES)
  }, [runId])

  const [stage, setStage] = useState<1 | 2 | 3 | 4 | 5>(1)
  const stageRef = useRef(1)

  const onCompleteRef = useRef(onComplete)
  const onEmbryoRef = useRef(onEmbryoReady)
  const onBirthRef = useRef(onBirthReady)
  const onNarrationCueRef = useRef(onNarrationCue)
  useEffect(() => {
    // Колбэки лаборатории вызываются из useFrame, поэтому держим их в рефах —
    // иначе замыкание застрянет на первом рендере прогона.
    onCompleteRef.current = onComplete
    onEmbryoRef.current = onEmbryoReady
    onBirthRef.current = onBirthReady
    onNarrationCueRef.current = onNarrationCue
  }, [onComplete, onEmbryoReady, onBirthReady, onNarrationCue])

  // ——— Персистентная модель мира: один набор объектов на весь прогон ———
  const world = useMemo(
    () => ({
      unitA: createBentFrame(),
      unitB: createBentFrame(),
      originA: new THREE.Vector3(),
      originB: new THREE.Vector3(),
      naA: new THREE.Vector3(),
      naB: new THREE.Vector3(),
      clA: new THREE.Vector3(),
      clB: new THREE.Vector3(),
      cl2Mid: new THREE.Vector3(),
      pairMid: new THREE.Vector3(),
      impulseA: new THREE.Vector3(),
      impulseB: new THREE.Vector3(),
    }),
    [],
  )

  const bonds = useMemo(
    () => ({
      a0: createBondState(),
      a1: createBondState(),
      b0: createBondState(),
      b1: createBondState(),
      cl2: createBondState(),
      naClA: createBondState(),
      naClB: createBondState(),
    }),
    [],
  )

  const gas = useMemo(
    () => ({
      cl2: createPuffVolumeState(GAS_CL2_COLOR, 0.62),
      clo2A: createPuffVolumeState(GAS_CLO2_COLOR, 0.45),
      clo2B: createPuffVolumeState(GAS_CLO2_COLOR, 0.45),
      fog: createPuffVolumeState(FOG_COLOR, 3.1),
    }),
    [],
  )

  const waves = useMemo(
    () => ({
      breakWave: createWaveState(0xffffff, 2.1),
      pairA: createWaveState(0xc9a6ff, 1.2),
      pairB: createWaveState(0xc9a6ff, 1.2),
      radicalA: createWaveState(0xffb066, 1.5),
      radicalB: createWaveState(0xffb066, 1.5),
    }),
    [],
  )

  const haloA = useRef(createGlowState())
  const haloB = useRef(createGlowState())
  const flashState = useRef(createGlowState())

  const hud = useMemo(
    () => ({
      reactantChlorite: createHudState(),
      reactantCl2: createHudState(),
      productClo2: createHudState(),
      productNaCl: createHudState(),
      oxChlorite: createHudState(),
      oxChlorine: createHudState(),
      oxSodium: createHudState(),
    }),
    [],
  )

  const rig = useMemo(() => createCameraRigState(), [])
  const post = useRef(createPostDirector())
  const zone = useRef(0.32)

  // Атомы: группы, которые сцена двигает напрямую.
  const aCl = useRef<THREE.Group>(null)
  const aO0 = useRef<THREE.Group>(null)
  const aO1 = useRef<THREE.Group>(null)
  const aNa = useRef<THREE.Group>(null)
  const bCl = useRef<THREE.Group>(null)
  const bO0 = useRef<THREE.Group>(null)
  const bO1 = useRef<THREE.Group>(null)
  const bNa = useRef<THREE.Group>(null)
  const freeClA = useRef<THREE.Group>(null)
  const freeClB = useRef<THREE.Group>(null)
  const impulseAMesh = useRef<THREE.Mesh>(null)
  const impulseBMesh = useRef<THREE.Mesh>(null)

  const keyLight = useRef<THREE.PointLight>(null)
  const exoLight = useRef<THREE.PointLight>(null)
  const rimCool = useRef<THREE.PointLight>(null)
  const rimWarm = useRef<THREE.PointLight>(null)

  const vfxSpark = useRef<VfxHandle>(null)
  const vfxIonA = useRef<VfxHandle>(null)
  const vfxIonB = useRef<VfxHandle>(null)
  const vfxFlashA = useRef<VfxHandle>(null)
  const vfxFlashB = useRef<VfxHandle>(null)
  const vfxDust = useRef<VfxHandle>(null)

  const cueTimes = useRef<Record<string, number>>({})

  useEffect(() => {
    // Новый прогон: забываем времена событий прошлой реакции.
    // Подпись фазы поправит первый же кадр useFrame, setState здесь не нужен.
    cueTimes.current = {}
    stageRef.current = 1
  }, [runId])

  useFrame(() => {
    const t = clock.current.t
    const w = world

    const nextStage = clo2StageAt(t)
    if (nextStage !== stageRef.current) {
      stageRef.current = nextStage
      setStage(nextStage)
    }

    // ——— События раскадровки ———
    // Озвучка всегда с lead-cues, если колбэк передан (не ждём teacherMode).
    if (onNarrationCueRef.current) {
      narrationCuesRef.current.update(t, (id) => {
        onNarrationCueRef.current?.(id)
      })
    }

    cues.current.update(t, (id) => {
      cueTimes.current[id] = t
      switch (id) {
        case 'tension':
          vfxSpark.current?.fire()
          break
        case 'transfer':
          vfxIonA.current?.fire()
          vfxIonB.current?.fire()
          break
        case 'break':
          vfxSpark.current?.fire()
          break
        case 'pairA':
          vfxFlashA.current?.fire()
          break
        case 'pairB':
          vfxFlashB.current?.fire()
          break
        case 'radicalA':
          vfxFlashA.current?.fire()
          break
        case 'radicalB':
          vfxFlashB.current?.fire()
          break
        case 'precipitate':
          vfxDust.current?.fire()
          break
        case 'embryo':
          onEmbryoRef.current?.()
          break
        case 'birth':
          onBirthRef.current?.()
          break
        case 'complete':
          onCompleteRef.current()
          break
      }
    })

    // ——— Сэмплирование раскадровки ———
    const tr = CLO2_TRACKS
    const jit = sampleScalar(tr.jitter, t)
    const angle = sampleScalar(tr.bondAngle, t)
    const clOLen = sampleScalar(tr.clOBond, t)
    const anion = sampleScalar(tr.clAnionGrowth, t)

    sampleVec3(tr.unitAOrigin, t, w.originA)
    sampleVec3(tr.unitBOrigin, t, w.originB)
    sampleVec3(tr.naA, t, w.naA)
    sampleVec3(tr.naB, t, w.naB)
    sampleVec3(tr.clA, t, w.clA)
    sampleVec3(tr.clB, t, w.clB)

    // Броуновское микро-колебание: одинаковая непрерывная функция времени,
    // поэтому она не создаёт разрывов на границах фаз.
    if (jit > 0.001) {
      const k = jit * 0.022
      w.originA.x += k * jitter(t, 1)
      w.originA.y += k * jitter(t, 2)
      w.originB.x += k * jitter(t, 3)
      w.originB.y += k * jitter(t, 4)
      w.naA.y += k * 0.8 * jitter(t, 5)
      w.naB.y += k * 0.8 * jitter(t, 6)
      w.clA.y += k * 0.7 * jitter(t, 7)
      w.clB.y += k * 0.7 * jitter(t, 8)
    }

    writeBent(
      w.unitA,
      w.originA,
      angle,
      clOLen,
      sampleScalar(tr.unitAYaw, t),
      sampleScalar(tr.unitAPitch, t),
    )
    writeBent(
      w.unitB,
      w.originB,
      angle,
      clOLen,
      sampleScalar(tr.unitBYaw, t),
      sampleScalar(tr.unitBPitch, t),
    )

    // ——— Атомы ———
    aCl.current?.position.copy(w.unitA.center)
    aO0.current?.position.copy(w.unitA.l0)
    aO1.current?.position.copy(w.unitA.l1)
    aNa.current?.position.copy(w.naA)
    bCl.current?.position.copy(w.unitB.center)
    bO0.current?.position.copy(w.unitB.l0)
    bO1.current?.position.copy(w.unitB.l1)
    bNa.current?.position.copy(w.naB)

    // Свободный хлор растёт, принимая электрон: атом Cl → ион Cl⁻.
    const anionScale = 1 + anion * (CLO2_GEOM.radius.clAnion / CLO2_GEOM.radius.cl - 1)
    if (freeClA.current) {
      freeClA.current.position.copy(w.clA)
      freeClA.current.scale.setScalar(anionScale)
    }
    if (freeClB.current) {
      freeClB.current.position.copy(w.clB)
      freeClB.current.scale.setScalar(anionScale)
    }

    // ——— Связи ———
    const clOStress = sampleScalar(tr.clOStress, t)
    const setBond = (
      b: typeof bonds.a0,
      from: THREE.Vector3,
      to: THREE.Vector3,
      opacity: number,
      stress: number,
      form = 1,
      thinning = 0,
    ) => {
      b.from.copy(from)
      b.to.copy(to)
      b.opacity = opacity
      b.stress = stress
      b.form = form
      b.thinning = thinning
    }

    // Связи Cl–O не рвутся ни на одном кадре: в этой реакции рвётся только Cl–Cl.
    setBond(bonds.a0, w.unitA.center, w.unitA.l0, 1, clOStress)
    setBond(bonds.a1, w.unitA.center, w.unitA.l1, 1, clOStress)
    const unitBVisible = t < CLO2_PHASE.releaseEnd + 1.2 ? 1 : Math.max(0, 1 - (t - (CLO2_PHASE.releaseEnd + 1.2)))
    setBond(bonds.b0, w.unitB.center, w.unitB.l0, unitBVisible, clOStress)
    setBond(bonds.b1, w.unitB.center, w.unitB.l1, unitBVisible, clOStress)

    setBond(
      bonds.cl2,
      w.clA,
      w.clB,
      sampleScalar(tr.cl2Opacity, t),
      sampleScalar(tr.cl2Stress, t),
      1,
      sampleScalar(tr.cl2Thinning, t),
    )

    const naClOpacity = sampleScalar(tr.naClOpacity, t)
    const naClForm = sampleScalar(tr.naClForm, t)
    setBond(bonds.naClA, w.naA, w.clA, naClOpacity, 0, naClForm)
    setBond(bonds.naClB, w.naB, w.clB, naClOpacity * unitBVisible, 0, naClForm)

    // ——— Газ и туман ———
    w.cl2Mid.copy(w.clA).add(w.clB).multiplyScalar(0.5)
    gas.cl2.center.copy(w.cl2Mid)
    gas.cl2.opacity = sampleScalar(tr.gasCl2Opacity, t)
    gas.cl2.spread = sampleScalar(tr.gasCl2Spread, t)
    gas.cl2.rise = 0.1 + t * 0.02
    gas.cl2.turbulence = 0.1

    const clo2Opacity = sampleScalar(tr.gasClo2Opacity, t)
    const clo2Spread = sampleScalar(tr.gasClo2Spread, t)
    const clo2Rise = sampleScalar(tr.gasClo2Rise, t)
    gas.clo2A.center.copy(w.originA)
    gas.clo2A.opacity = clo2Opacity
    gas.clo2A.spread = clo2Spread
    gas.clo2A.rise = clo2Rise
    gas.clo2A.turbulence = 0.16
    gas.clo2B.center.copy(w.originB)
    gas.clo2B.opacity = clo2Opacity * unitBVisible
    gas.clo2B.spread = clo2Spread
    gas.clo2B.rise = clo2Rise
    gas.clo2B.turbulence = 0.16

    gas.fog.center.set(0, -1.55, -1.3)
    gas.fog.opacity = sampleScalar(tr.fogOpacity, t)
    gas.fog.rise = -0.05
    gas.fog.turbulence = 0.22

    // ——— Свет, ореолы, волны ———
    const amber = sampleScalar(tr.amber, t)
    haloA.current.center.copy(w.originA)
    haloA.current.amount = amber
    haloB.current.center.copy(w.originB)
    haloB.current.amount = amber * unitBVisible

    const breakAt = cueTimes.current.break
    const breakPulse = breakAt != null ? pulseAt(t, breakAt, 0.55) : 0
    flashState.current.center.copy(w.cl2Mid)
    flashState.current.amount = breakPulse

    waves.breakWave.center.copy(w.cl2Mid)
    waves.breakWave.amount = breakAt != null ? Math.min(1, (t - breakAt) / 0.85) : 0

    const setWave = (wave: typeof waves.pairA, at: number | undefined, center: THREE.Vector3, span: number) => {
      wave.center.copy(center)
      wave.amount = at != null ? Math.min(1, (t - at) / span) : 0
    }
    setWave(waves.pairA, cueTimes.current.pairA, w.clA, 0.7)
    setWave(waves.pairB, cueTimes.current.pairB, w.clB, 0.7)
    setWave(waves.radicalA, cueTimes.current.radicalA, w.originA, 0.9)
    setWave(waves.radicalB, cueTimes.current.radicalB, w.originB, 0.9)

    zone.current = sampleScalar(tr.zone, t)
    const exo = sampleScalar(tr.exoLight, t)
    if (keyLight.current) keyLight.current.intensity = 0.5 + zone.current * 0.5
    if (exoLight.current) exoLight.current.intensity = 0.1 + exo * (lite ? 1.1 : 2.0)
    if (rimCool.current) rimCool.current.intensity = 0.25 + zone.current * 0.3
    if (rimWarm.current) rimWarm.current.intensity = 0.16 + amber * 0.5

    // ——— Импульс электрона: хлорит-ион отдаёт e⁻ молекуле Cl₂ ———
    const [tr0, tr1] = CLO2_TRANSFER_WINDOW
    const transferU = t <= tr0 ? -1 : t >= tr1 ? 2 : (t - tr0) / (tr1 - tr0)
    const impulseVisible = transferU >= 0 && transferU <= 1
    if (impulseVisible) {
      w.impulseA.lerpVectors(w.unitA.center, w.clA, transferU)
      w.impulseB.lerpVectors(w.unitB.center, w.clB, transferU)
      // Импульс летит по дуге — заряд не движется по линейке.
      const bulge = Math.sin(Math.PI * transferU) * 0.22
      w.impulseA.y += bulge
      w.impulseB.y += bulge
    }
    if (impulseAMesh.current) {
      impulseAMesh.current.visible = impulseVisible
      if (impulseVisible) impulseAMesh.current.position.copy(w.impulseA)
    }
    if (impulseBMesh.current) {
      impulseBMesh.current.visible = impulseVisible
      if (impulseVisible) impulseBMesh.current.position.copy(w.impulseB)
    }
    const ionNodeA = vfxIonA.current?.node()
    if (ionNodeA && impulseVisible) ionNodeA.position.copy(w.impulseA)
    const ionNodeB = vfxIonB.current?.node()
    if (ionNodeB && impulseVisible) ionNodeB.position.copy(w.impulseB)

    // Одноразовые вспышки VFX ставим точно в место события.
    const sparkNode = vfxSpark.current?.node()
    if (sparkNode) sparkNode.position.copy(w.cl2Mid)
    const flashNodeA = vfxFlashA.current?.node()
    if (flashNodeA) flashNodeA.position.copy(t < CLO2_PHASE.transferEnd - 0.4 ? w.clA : w.originA)
    const flashNodeB = vfxFlashB.current?.node()
    if (flashNodeB) flashNodeB.position.copy(t < CLO2_PHASE.transferEnd - 0.4 ? w.clB : w.originB)

    // ——— HUD ———
    // Каждая подпись живёт в своей полосе кадра: коэффициенты реагентов сверху,
    // продукты — по центру и внизу, метки ОВР — вплотную к своим атомам.
    // Иначе текст ложится на молекулы, и разобрать реакцию невозможно.
    const reactantOpacity = sampleScalar(tr.reactantCounters, t)
    hud.reactantChlorite.opacity = reactantOpacity
    hud.reactantChlorite.center.set(0, 1.5, 0)
    hud.reactantCl2.opacity = reactantOpacity
    hud.reactantCl2.center.copy(w.cl2Mid)
    hud.reactantCl2.center.x += 0.9
    hud.reactantCl2.center.y += 0.18

    const productOpacity = sampleScalar(tr.productCounters, t)
    w.pairMid.copy(w.naA).add(w.naB).multiplyScalar(0.5)
    hud.productClo2.opacity = productOpacity
    // Между двумя разлетающимися молекулами ClO₂ всегда есть свободное место.
    hud.productClo2.center.copy(w.originA).add(w.originB).multiplyScalar(0.5)
    hud.productNaCl.opacity = productOpacity
    hud.productNaCl.center.copy(w.pairMid)
    hud.productNaCl.center.y -= 0.62

    const oxOpacity = sampleScalar(tr.oxidationTags, t)
    hud.oxChlorite.opacity = oxOpacity
    hud.oxChlorite.center.copy(w.unitA.center)
    hud.oxChlorine.opacity = oxOpacity
    hud.oxChlorine.center.copy(w.clA)
    hud.oxSodium.opacity = oxOpacity * 0.7
    hud.oxSodium.center.copy(w.naA)

    // ——— Виртуальная камера и пост ———
    rig.zoom = sampleScalar(tr.camZoom, t)
    sampleVec3(tr.camOffset, t, rig.offset)
    rig.roll = sampleScalar(tr.camRoll, t)
    rig.yaw = sampleScalar(tr.camYaw, t)
    rig.shake = sampleScalar(tr.camShake, t)
    post.current.bloom = sampleScalar(tr.postBloom, t)
    post.current.vignette = sampleScalar(tr.postVignette, t)
  })

  const caption = CLO2_CAPTIONS[stage]
  const R = CLO2_GEOM.radius
  const vfxScale = quality.vfxScale
  const bondRadius = 0.042

  return (
    <>
      <CinemaEnvironment dust={quality.dust} />
      {quality.post ? <CinemaPostFx director={post} lite={lite} /> : null}

      <CinemaCameraRig state={rig} baseScale={0.78}>
        <ambientLight intensity={lite ? 0.3 : 0.2} />
        <pointLight ref={keyLight} position={[0.4, 1.8, 2.4]} intensity={0.6} color="#cfe4ff" distance={14} />
        <pointLight ref={exoLight} position={[0, 0.1, 0.9]} intensity={0.1} color="#ff7a2a" distance={8} />
        {!lite ? (
          <pointLight ref={rimCool} position={[-2.6, 0.9, -1.4]} intensity={0.25} color="#25e0ff" distance={9} />
        ) : null}
        {!lite ? (
          <pointLight ref={rimWarm} position={[2.4, -0.4, 1.4]} intensity={0.16} color="#ff5ac8" distance={8} />
        ) : null}

        <CinemaReactionZone intensityRef={zone} lite={lite} />

        {/* Туман сцены: в него оседает NaCl, он же даёт глубину кадра */}
        <CinemaPuffVolume state={gas.fog} count={quality.fogPuffs} size={3.6} seed={7} renderOrder={-6} />

        {/* Хлорит A: Cl и два O — те же самые объекты до конца сцены */}
        <group ref={aCl}>
          <CinemaAtom color={CPK.Cl} radius={R.cl} quality={quality} emissive={0.5} />
        </group>
        <group ref={aO0}>
          <CinemaAtom color={CPK.O} radius={R.o} quality={quality} emissive={0.6} />
        </group>
        <group ref={aO1}>
          <CinemaAtom color={CPK.O} radius={R.o} quality={quality} emissive={0.6} />
        </group>
        <group ref={aNa}>
          <CinemaAtom color={CPK.Na} radius={R.na} quality={quality} emissive={0.8} chargeSign={1} />
        </group>

        {/* Хлорит B — симметричная вторая молекула (коэффициент 2) */}
        <group ref={bCl}>
          <CinemaAtom color={CPK.Cl} radius={R.cl} quality={quality} emissive={0.5} />
        </group>
        <group ref={bO0}>
          <CinemaAtom color={CPK.O} radius={R.o} quality={quality} emissive={0.6} />
        </group>
        <group ref={bO1}>
          <CinemaAtom color={CPK.O} radius={R.o} quality={quality} emissive={0.6} />
        </group>
        <group ref={bNa}>
          <CinemaAtom color={CPK.Na} radius={R.na} quality={quality} emissive={0.8} chargeSign={1} />
        </group>

        {/* Молекула Cl₂ → после переноса электрона это два иона Cl⁻ */}
        <group ref={freeClA}>
          <CinemaAtom color={CPK.Cl} radius={R.cl} quality={quality} emissive={0.62} chargeSign={-1} />
        </group>
        <group ref={freeClB}>
          <CinemaAtom color={CPK.Cl} radius={R.cl} quality={quality} emissive={0.62} chargeSign={-1} />
        </group>

        <CinemaBond state={bonds.a0} color={BOND_CLO_COLOR} radius={bondRadius} plasma={quality.plasmaBonds} />
        <CinemaBond state={bonds.a1} color={BOND_CLO_COLOR} radius={bondRadius} plasma={quality.plasmaBonds} />
        <CinemaBond state={bonds.b0} color={BOND_CLO_COLOR} radius={bondRadius} plasma={quality.plasmaBonds} />
        <CinemaBond state={bonds.b1} color={BOND_CLO_COLOR} radius={bondRadius} plasma={quality.plasmaBonds} />
        <CinemaBond state={bonds.cl2} color={CPK.Cl} radius={0.05} plasma={quality.plasmaBonds} />
        <CinemaBond state={bonds.naClA} color={BOND_IONIC_COLOR} radius={0.036} plasma={quality.plasmaBonds} />
        <CinemaBond state={bonds.naClB} color={BOND_IONIC_COLOR} radius={0.036} plasma={quality.plasmaBonds} />

        {/* Газовые облака: зелёный Cl₂ уходит в реакцию, янтарный ClO₂ рождается */}
        <CinemaPuffVolume state={gas.cl2} count={quality.gasPuffs} size={1.35} seed={1} />
        <CinemaPuffVolume state={gas.clo2A} count={quality.gasPuffs} size={1.2} seed={2} />
        <CinemaPuffVolume state={gas.clo2B} count={quality.gasPuffs} size={1.2} seed={3} />

        <CinemaShockwave state={waves.breakWave} />
        <CinemaShockwave state={waves.pairA} />
        <CinemaShockwave state={waves.pairB} />
        <CinemaShockwave state={waves.radicalA} />
        <CinemaShockwave state={waves.radicalB} />
        <CinemaHalo stateRef={haloA} color={AMBER} radius={0.78} />
        <CinemaHalo stateRef={haloB} color={AMBER} radius={0.78} />
        <CinemaFlash stateRef={flashState} />

        {/* Электронный импульс — видимый носитель заряда ClO₂⁻ → Cl₂ */}
        <mesh ref={impulseAMesh} visible={false} renderOrder={6}>
          <sphereGeometry args={[0.06, 12, 10]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.95} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh ref={impulseBMesh} visible={false} renderOrder={6}>
          <sphereGeometry args={[0.06, 12, 10]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.95} blending={THREE.AdditiveBlending} />
        </mesh>

        <CinemaCounter state={hud.reactantChlorite} value={2} label="NaClO₂" />
        <CinemaCounter state={hud.reactantCl2} value={1} label="Cl₂" color="#b6ff5c" />
        <CinemaCounter state={hud.productClo2} value={2} label="ClO₂" color="#ffb26b" />
        <CinemaCounter state={hud.productNaCl} value={2} label="NaCl · осадок" color="#d3b6ff" />

        {/* Короткий текст: подробное объяснение ОВР идёт в подписи фазы */}
        <CinemaOxidationTag state={hud.oxChlorite} text="Cl  +3 → +4" offset={[-0.42, 0.5, 0]} />
        <CinemaOxidationTag state={hud.oxChlorine} text="Cl  0 → −1" color="#9ef7ff" offset={[0, -0.52, 0]} />
        <CinemaOxidationTag state={hud.oxSodium} text="Na⁺ наблюдатель" color="#d9c2ff" offset={[-0.5, 0.36, 0]} />

        {/* Подпись живёт выше всей сцены: под ней проходит подъём газа ClO₂ */}
        <CinemaCaption text={caption.text} sub={caption.sub} position={[0, 2.5, 0]} />

        {quality.vfx ? (
          <CinemaVfxStage>
            <CinemaBurst ref={vfxSpark} preset="spark" scale={vfxScale} sizeScale={0.9} />
            <CinemaBurst ref={vfxIonA} preset="ion" scale={vfxScale} sizeScale={0.8} />
            <CinemaBurst ref={vfxIonB} preset="ion" scale={vfxScale} sizeScale={0.8} />
            <CinemaBurst ref={vfxFlashA} preset="flash" scale={vfxScale} sizeScale={0.9} />
            <CinemaBurst ref={vfxFlashB} preset="flash" scale={vfxScale} sizeScale={0.9} />
            <CinemaBurst ref={vfxDust} preset="dust" scale={vfxScale} sizeScale={1.1} position={[0, -1.9, -1.2]} />
          </CinemaVfxStage>
        ) : null}
      </CinemaCameraRig>
    </>
  )
}
