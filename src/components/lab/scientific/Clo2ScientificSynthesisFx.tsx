import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Sparkles, Text } from '@react-three/drei'
import * as THREE from 'three'
import {
  CLO2_SCENARIO,
  clo2StageAt,
} from '../../../lab/scientificSynthesis/clo2ScenarioTiming'
import {
  resolveSciFxQuality,
  SciAmberHalo,
  SciCinematicPostFx,
  SciElectronImpulse,
  SciEnergyBond,
  SciFormationBurst,
  SciMicrocosmEnv,
  SciPlasmaBond,
  SciProAtom,
  SciReactionZone,
  SciShockwave,
  SciStageCaption,
  SciStoichBadge,
  SCI_CPK,
  useClo2CinematicDirector,
  type SciPostDirector,
} from '../../../lab/scientificSynthesis/effects'
import type { ScientificSynthesisFxProps } from '../../../lab/scientificSynthesis/types'

const STAGE_CAPTION: Record<number, string> = {
  1: 'Фаза 1 · 2 NaClO₂ — хлорит натрия (тв.) + Cl₂ — хлор (газ)',
  2: 'Фаза 2 · Сближение · связь Cl–Cl натягивается и светится',
  3: 'Фаза 3 · Cl–Cl рвётся · e⁻ летит Cl → Na⁺ · ClO₂⁻ окисляется до ClO₂',
  4: 'Фаза 4 · ClO₂ (диоксид хлора, газ) вверх · NaCl (хлорид натрия, осадок) вглубь',
  5: 'ClO₂ · угол O–Cl–O ≈ 117.4° · сильный окислитель',
}

function smoothstep(a: number, b: number, x: number) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a || 1), 0, 1)
  return t * t * (3 - 2 * t)
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/** VSEPR bent geometry O–Cl–O в локальных координатах (Cl в начале координат). */
function bentLocal(angleDeg: number, bond = CLO2_SCENARIO.clo2BondLen) {
  const half = (angleDeg / 2) * (Math.PI / 180)
  return {
    cl: new THREE.Vector3(0, 0, 0),
    o0: new THREE.Vector3(bond * Math.sin(half), 0, bond * Math.cos(half)),
    o1: new THREE.Vector3(-bond * Math.sin(half), 0, bond * Math.cos(half)),
  }
}

/** Пишет мировые cl/o0/o1 из origin + угла + поворота вокруг Y — единая функция размещения. */
function placeUnit(
  origin: THREE.Vector3,
  angleDeg: number,
  rotY: number,
  out: { cl: THREE.Vector3; o0: THREE.Vector3; o1: THREE.Vector3 },
) {
  const L = bentLocal(angleDeg)
  const c = Math.cos(rotY)
  const s = Math.sin(rotY)
  const map = (p: THREE.Vector3, t: THREE.Vector3) =>
    t.set(origin.x + p.x * c + p.z * s, origin.y + p.y, origin.z - p.x * s + p.z * c)
  map(L.cl, out.cl)
  map(L.o0, out.o0)
  map(L.o1, out.o1)
}

// ——— Неизменные якорные точки сцены (см. clo2ScenarioTiming для фаз/углов) ———
const REST_A = new THREE.Vector3(-1.35, 0.12, 0)
const REST_B = new THREE.Vector3(1.35, 0.12, 0)
const ROT_Y_A = 0.15
const ROT_Y_B = -0.15
/** Na⁺ «привязан» к своей хлоритной группе — фиксированное смещение (без вращения по z, как у реального иона рядом). */
const P_NA_REST_A = new THREE.Vector3(REST_A.x + 0.55 * Math.cos(ROT_Y_A), REST_A.y + 0.42, REST_A.z + 0.18)
const P_NA_REST_B = new THREE.Vector3(REST_B.x + 0.55 * Math.cos(ROT_Y_B), REST_B.y + 0.42, REST_B.z + 0.18)
/** Точка, где ClO₂ «рождается» и откуда начинается разлёт (= стартовая точка фазы 4, без скачка). */
const FORM_A = new THREE.Vector3(-1.05, 0.65, 0.1)
const FORM_B = new THREE.Vector3(1.05, 0.65, 0.1)
/** Точка встречи свободного Cl⁻ и Na⁺ → кристаллизация NaCl (= стартовая точка фазы 4 для пары). */
const NA_MEET_A = new THREE.Vector3(-0.9, -0.75, -0.9)
const CL_MEET_A = new THREE.Vector3(-0.55, -0.75, -0.9)
const NA_MEET_B = new THREE.Vector3(0.9, -0.75, -0.9)
const CL_MEET_B = new THREE.Vector3(0.55, -0.75, -0.9)
const CL2_HOME = new THREE.Vector3(0, -1.15, 0.2)
const CL2_TARGET = new THREE.Vector3(0, 0.04, 0)
/** Позиция половинок Cl₂ ровно в момент начала переноса электрона (u3 = transferStart) — без скачка. */
const BREAK_HALF = (CLO2_SCENARIO.cl2BondLen * (1.55 + CLO2_SCENARIO.transferStart * 0.9)) / 2
const CL_BREAK_A = new THREE.Vector3(CL2_TARGET.x, CL2_TARGET.y + BREAK_HALF, CL2_TARGET.z)
const CL_BREAK_B = new THREE.Vector3(CL2_TARGET.x, CL2_TARGET.y - BREAK_HALF, CL2_TARGET.z)
/** Финальная точка «геро-кадра»: настоящая молекула ClO₂ (не дубликат!) выезжает в центр кадра. */
const STAGE4_END_A = new THREE.Vector3(FORM_A.x - 0.55, FORM_A.y + 0.7, FORM_A.z)
const FINALE_CENTER = new THREE.Vector3(0, 0.15, 0)

type ChloriteSlot = { cl: THREE.Vector3; o0: THREE.Vector3; o1: THREE.Vector3 }

/**
 * Научно-точный микромир: 2NaClO₂ + Cl₂ → 2NaCl + 2ClO₂.
 * Единая, непрерывная модель атомов — ни одна связь O–Cl не «рвётся и восстанавливается»:
 * реально рвётся только Cl–Cl, атомы хлорита плавно доокисляются и разлетаются как ClO₂,
 * освобождённый Cl мгновенно образует ионную пару с Na⁺ → NaCl (осадок, уходит вглубь).
 * Никаких дублей-клонов при смене фаз — только непрерывное движение одних и тех же атомов.
 */
export function Clo2ScientificSynthesisFx({
  runId = 0,
  lowPower = false,
  onEmbryoReady,
  onBirthReady,
  onComplete,
}: ScientificSynthesisFxProps) {
  const quality = useMemo(() => resolveSciFxQuality(lowPower), [lowPower])
  const lite = quality.quality === 'lite'

  const postDirector = useRef<SciPostDirector>({ bloom: 0.4, dof: 0.2, chroma: 0.1 })
  const director = useClo2CinematicDirector(runId, lite, postDirector)

  const embryoFired = useRef(false)
  const birthFired = useRef(false)
  const doneFired = useRef(false)
  const onCompleteRef = useRef(onComplete)
  const onEmbryoReadyRef = useRef(onEmbryoReady)
  const onBirthReadyRef = useRef(onBirthReady)
  onCompleteRef.current = onComplete
  onEmbryoReadyRef.current = onEmbryoReady
  onBirthReadyRef.current = onBirthReady

  const [uiStage, setUiStage] = useState(1)
  const [showCounters, setShowCounters] = useState(true)
  const [showFinaleCaption, setShowFinaleCaption] = useState(false)
  const showCountersRef = useRef(true)
  const showFinaleCaptionRef = useRef(false)

  const cl2StretchRef = useRef(1)
  const cl2GlowRef = useRef(0)
  const cl2ThinRef = useRef(0)
  const zoneIntensityRef = useRef(0.35)
  const flashAmtRef = useRef(0)
  const formationTrigRef = useRef(0)
  const cl2BondVisible = useRef(true)
  const nacBondsVisible = useRef(false)
  const unitBBondsVisible = useRef(true)
  const impulseAVisible = useRef(false)
  const impulseBVisible = useRef(false)

  // Персистентные атомы — ОДИН набор рефов на всю сцену, без дублей-клонов при смене фаз.
  const n1cl = useRef<THREE.Group>(null)
  const n1o0 = useRef<THREE.Group>(null)
  const n1o1 = useRef<THREE.Group>(null)
  const n1na = useRef<THREE.Group>(null)
  const n2cl = useRef<THREE.Group>(null)
  const n2o0 = useRef<THREE.Group>(null)
  const n2o1 = useRef<THREE.Group>(null)
  const n2na = useRef<THREE.Group>(null)
  const clA = useRef<THREE.Group>(null)
  const clB = useRef<THREE.Group>(null)
  const impulseA = useRef<THREE.Group>(null)
  const impulseB = useRef<THREE.Group>(null)
  const flash = useRef<THREE.Mesh>(null)
  const amberA = useRef<THREE.Mesh>(null)
  const amberB = useRef<THREE.Mesh>(null)
  const oxTagCl = useRef<THREE.Group>(null)
  const oxTagFreeCl = useRef<THREE.Group>(null)
  const exoLight = useRef<THREE.PointLight>(null)
  const keyLight = useRef<THREE.PointLight>(null)
  const rootGroup = useRef<THREE.Group>(null)
  const rimCyan = useRef<THREE.PointLight>(null)
  const rimMagenta = useRef<THREE.PointLight>(null)

  const world = useMemo(() => {
    return {
      unitA: { cl: new THREE.Vector3(), o0: new THREE.Vector3(), o1: new THREE.Vector3() } satisfies ChloriteSlot,
      unitB: { cl: new THREE.Vector3(), o0: new THREE.Vector3(), o1: new THREE.Vector3() } satisfies ChloriteSlot,
      originA: new THREE.Vector3().copy(REST_A),
      originB: new THREE.Vector3().copy(REST_B),
      naA: new THREE.Vector3().copy(P_NA_REST_A),
      naB: new THREE.Vector3().copy(P_NA_REST_B),
      clA: new THREE.Vector3(),
      clB: new THREE.Vector3(),
      impulseA: new THREE.Vector3(),
      impulseB: new THREE.Vector3(),
      cl2Pos: new THREE.Vector3().copy(CL2_HOME),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId])

  useEffect(() => {
    embryoFired.current = false
    birthFired.current = false
    doneFired.current = false
    formationTrigRef.current = 0
    setUiStage(1)
    setShowCounters(true)
    setShowFinaleCaption(false)
    showCountersRef.current = true
    showFinaleCaptionRef.current = false
  }, [runId])

  useFrame(() => {
    const t = director.current.t
    const stage = clo2StageAt(t)
    if (stage !== uiStage) setUiStage(stage)

    const w = world
    let angleDeg = CLO2_SCENARIO.chloriteAngleDeg
    let bondLen = CLO2_SCENARIO.cl2BondLen
    cl2StretchRef.current = 1
    cl2GlowRef.current = 0
    cl2ThinRef.current = 0
    cl2BondVisible.current = true
    nacBondsVisible.current = false
    impulseAVisible.current = false
    impulseBVisible.current = false
    let flashAmt = 0
    let exo = 0
    let amber = 0
    let showProducts = false
    let showHero = false
    let counters = true
    let zone = 0.35
    let formTrig = 0
    let oxTags = false

    // Мягкое броуновское микро-колебание до начала переноса электрона.
    const vibrateAmt = stage === 1 ? 1 : stage === 2 ? 0.6 : 0
    const jx = vibrateAmt * 0.015 * Math.cos(t * 7)
    const jy = vibrateAmt * 0.02 * Math.sin(t * 9)
    const rotYA = ROT_Y_A + Math.max(0, t - CLO2_SCENARIO.stage2End) * 0.35
    const rotYB = ROT_Y_B - Math.max(0, t - CLO2_SCENARIO.stage2End) * 0.32

    if (stage === 1) {
      w.originA.set(REST_A.x + jx, REST_A.y + jy, REST_A.z)
      w.originB.set(REST_B.x - jx, REST_B.y + jy, REST_B.z)
      w.naA.copy(P_NA_REST_A)
      w.naB.copy(P_NA_REST_B)
      w.cl2Pos.copy(CL2_HOME)
      bondLen = CLO2_SCENARIO.cl2BondLen + 0.012 * Math.sin(t * 14)
      cl2GlowRef.current = 0.16 + 0.1 * Math.sin(t * 6)
      zone = 0.4
    } else if (stage === 2) {
      const u2 = smoothstep(CLO2_SCENARIO.stage1End, CLO2_SCENARIO.stage2End, t)
      w.originA.set(REST_A.x + jx, REST_A.y + jy, REST_A.z)
      w.originB.set(REST_B.x - jx, REST_B.y + jy, REST_B.z)
      w.naA.copy(P_NA_REST_A)
      w.naB.copy(P_NA_REST_B)
      w.cl2Pos.lerpVectors(CL2_HOME, CL2_TARGET, u2)
      cl2StretchRef.current = 1 + u2 * 0.55
      cl2GlowRef.current = 0.25 + u2 * 0.85
      cl2ThinRef.current = u2 * 0.7
      bondLen = CLO2_SCENARIO.cl2BondLen * cl2StretchRef.current
      zone = 0.45 + u2 * 0.5
    } else if (stage === 3) {
      const u3 = smoothstep(CLO2_SCENARIO.stage2End, CLO2_SCENARIO.stage3End, t)
      w.cl2Pos.copy(CL2_TARGET)
      const broken = u3 > 0.18
      cl2GlowRef.current = u3 < 0.35 ? 1 : lerp(1, 0.15, (u3 - 0.35) / 0.65)
      cl2ThinRef.current = 0.55 + u3 * 0.4
      bondLen = CLO2_SCENARIO.cl2BondLen * (broken ? 1.55 + u3 * 0.9 : 1.55)
      cl2BondVisible.current = u3 < 0.55
      zone = 0.95

      const p = smoothstep(CLO2_SCENARIO.transferStart, 1, u3)
      if (p <= 0) {
        w.originA.copy(REST_A)
        w.originB.copy(REST_B)
        w.naA.copy(P_NA_REST_A)
        w.naB.copy(P_NA_REST_B)
        w.clA.set(w.cl2Pos.x, w.cl2Pos.y + bondLen * 0.5, w.cl2Pos.z)
        w.clB.set(w.cl2Pos.x, w.cl2Pos.y - bondLen * 0.5, w.cl2Pos.z)
      } else {
        angleDeg = lerp(CLO2_SCENARIO.chloriteAngleDeg, CLO2_SCENARIO.clo2AngleDeg, p)
        w.originA.lerpVectors(REST_A, FORM_A, p)
        w.originB.lerpVectors(REST_B, FORM_B, p)
        w.naA.lerpVectors(P_NA_REST_A, NA_MEET_A, p)
        w.naB.lerpVectors(P_NA_REST_B, NA_MEET_B, p)
        w.clA.lerpVectors(CL_BREAK_A, CL_MEET_A, p)
        w.clB.lerpVectors(CL_BREAK_B, CL_MEET_B, p)
        nacBondsVisible.current = true
        showProducts = true
        flashAmt = p < 0.35 ? smoothstep(0, 0.35, p) : Math.max(0, 1 - smoothstep(0.35, 0.85, p))
        formTrig = flashAmt
        exo = 0.45 + 0.55 * Math.sin(p * Math.PI)
        amber = p
        oxTags = p > 0.04 && p < 0.62
        impulseAVisible.current = p < 0.5
        impulseBVisible.current = p < 0.5
        const localU = Math.min(1, p / 0.5)
        w.impulseA.lerpVectors(CL_BREAK_A, w.naA, localU)
        w.impulseB.lerpVectors(CL_BREAK_B, w.naB, localU)
      }
    } else if (stage === 4) {
      const u4 = smoothstep(CLO2_SCENARIO.stage3End, CLO2_SCENARIO.stage4End, t)
      showProducts = true
      counters = false
      nacBondsVisible.current = true
      cl2BondVisible.current = false
      angleDeg = CLO2_SCENARIO.clo2AngleDeg
      amber = 1
      exo = 0.5 * (1 - u4 * 0.4)
      zone = 0.5 * (1 - u4 * 0.45)
      w.originA.set(FORM_A.x - u4 * 0.55, FORM_A.y + u4 * 0.7, FORM_A.z + u4 * 0.08 * Math.sin(t * 1.1))
      w.originB.set(FORM_B.x + u4 * 0.55, FORM_B.y + u4 * 0.7, FORM_B.z + u4 * 0.08 * Math.cos(t * 1.05))
      w.naA.set(NA_MEET_A.x, NA_MEET_A.y - u4 * 0.35, NA_MEET_A.z - u4 * 1.5)
      w.clA.set(CL_MEET_A.x, CL_MEET_A.y - u4 * 0.35, CL_MEET_A.z - u4 * 1.5)
      w.naB.set(NA_MEET_B.x, NA_MEET_B.y - u4 * 0.35, NA_MEET_B.z - u4 * 1.5)
      w.clB.set(CL_MEET_B.x, CL_MEET_B.y - u4 * 0.35, CL_MEET_B.z - u4 * 1.5)
    } else {
      showHero = true
      showProducts = false
      counters = false
      cl2BondVisible.current = false
      amber = 1
      exo = 0.25
      zone = 0.48
      angleDeg = CLO2_SCENARIO.clo2AngleDeg
      const u5 = smoothstep(CLO2_SCENARIO.stage4End, CLO2_SCENARIO.stage4End + 1.2, t)
      w.originA.lerpVectors(STAGE4_END_A, FINALE_CENTER, u5)
      // Второй продукт и пары NaCl уходят за пределы сцены — герой-план только на ClO₂.
      w.originB.set(6, 3, -4)
      w.naA.set(-6, -3, -6)
      w.clA.set(-6.5, -3, -6)
      w.naB.set(6, -3, -6)
      w.clB.set(6.5, -3, -6)
    }

    placeUnit(w.originA, angleDeg, rotYA, w.unitA)
    placeUnit(w.originB, angleDeg, rotYB, w.unitB)

    zoneIntensityRef.current = zone
    flashAmtRef.current = flashAmt
    formationTrigRef.current = formTrig

    if (counters !== showCountersRef.current) {
      showCountersRef.current = counters
      setShowCounters(counters)
    }
    if (showHero !== showFinaleCaptionRef.current) {
      showFinaleCaptionRef.current = showHero
      setShowFinaleCaption(showHero)
    }

    const put = (r: RefObject<THREE.Group | null>, v: THREE.Vector3) => {
      if (!r.current) return
      r.current.position.copy(v)
    }
    put(n1cl, w.unitA.cl)
    put(n1o0, w.unitA.o0)
    put(n1o1, w.unitA.o1)
    put(n1na, w.naA)
    put(n2cl, w.unitB.cl)
    put(n2o0, w.unitB.o0)
    put(n2o1, w.unitB.o1)
    put(n2na, w.naB)
    put(clA, w.clA)
    put(clB, w.clB)

    const unitBVisible = stage <= 4
    unitBBondsVisible.current = unitBVisible
    if (n2cl.current) n2cl.current.visible = unitBVisible
    if (n2o0.current) n2o0.current.visible = unitBVisible
    if (n2o1.current) n2o1.current.visible = unitBVisible
    if (n2na.current) n2na.current.visible = unitBVisible
    if (clA.current) clA.current.visible = stage <= 4
    if (clB.current) clB.current.visible = unitBVisible
    if (n1na.current) n1na.current.visible = stage <= 4
    if (amberB.current) amberB.current.visible = unitBVisible && showProducts && amber > 0.1

    if (impulseA.current) {
      impulseA.current.position.copy(w.impulseA)
      impulseA.current.visible = impulseAVisible.current
    }
    if (impulseB.current) {
      impulseB.current.position.copy(w.impulseB)
      impulseB.current.visible = impulseBVisible.current
    }
    if (oxTagCl.current) oxTagCl.current.visible = oxTags
    if (oxTagFreeCl.current) oxTagFreeCl.current.visible = oxTags
    if (flash.current) {
      const mat = flash.current.material as THREE.MeshBasicMaterial
      mat.opacity = flashAmt * 0.6
      flash.current.scale.setScalar(0.85 + flashAmt * 2.8)
      flash.current.visible = flashAmt > 0.02
    }
    if (exoLight.current) exoLight.current.intensity = 0.2 + exo * (lite ? 0.9 : 1.6)
    if (keyLight.current) keyLight.current.intensity = 0.55 + zone * 0.45
    if (rimCyan.current) rimCyan.current.intensity = 0.35 + director.current.camPull * 0.35
    if (rimMagenta.current) rimMagenta.current.intensity = 0.28 + zone * 0.25

    if (rootGroup.current) {
      const entry = 0.42 + director.current.entry * 0.16
      const pull = 1 - director.current.camPull * 0.08
      const breath = lite ? 1 : 1 + 0.008 * Math.sin(t * 1.05)
      rootGroup.current.scale.setScalar(0.58 * entry * pull * breath)
      if (!lite) rootGroup.current.rotation.y = Math.sin(t * 0.12) * 0.025
    }

    if (amberA.current) {
      amberA.current.position.copy(w.originA)
      amberA.current.visible = (showProducts || showHero) && amber > 0.1
      ;(amberA.current.material as THREE.MeshBasicMaterial).opacity = 0.1 + amber * 0.28
    }
    if (amberB.current && unitBVisible) {
      amberB.current.position.copy(w.originB)
      ;(amberB.current.material as THREE.MeshBasicMaterial).opacity = 0.1 + amber * 0.28
    }

    if (!embryoFired.current && t >= CLO2_SCENARIO.stage3End - 0.12) {
      embryoFired.current = true
      onEmbryoReadyRef.current?.()
    }
    if (!birthFired.current && t >= CLO2_SCENARIO.stage4End + 0.12) {
      birthFired.current = true
      onBirthReadyRef.current?.()
    }
    if (!doneFired.current && t >= CLO2_SCENARIO.finaleEnd) {
      doneFired.current = true
      onCompleteRef.current()
    }
  })

  const caption = STAGE_CAPTION[uiStage] ?? STAGE_CAPTION[1]!
  const Bond = quality.plasmaBonds ? SciPlasmaBond : SciEnergyBond

  return (
    <>
      <SciMicrocosmEnv lite={lite} />
      <SciCinematicPostFx lite={lite} directorRef={postDirector} />

      <group ref={rootGroup} scale={0.58}>
        <ambientLight intensity={lite ? 0.28 : 0.18} />
        <pointLight ref={keyLight} position={[0, 1.4, 2.0]} intensity={0.7} color="#c8dcff" distance={12} />
        <pointLight ref={exoLight} position={[0, -0.15, 1.0]} intensity={0.2} color="#ff6a28" distance={7} />
        {!lite ? (
          <pointLight ref={rimCyan} position={[-2.2, 0.7, -1]} intensity={0.28} color="#00e5ff" distance={8} />
        ) : null}
        {!lite ? (
          <pointLight ref={rimMagenta} position={[2.0, -0.3, 1.2]} intensity={0.22} color="#ff2bd6" distance={7} />
        ) : null}

        {quality.sparkles > 0 ? (
          <Sparkles count={quality.sparkles} scale={3.2} size={1.4} speed={0.3} opacity={0.28} color="#9ad8ff" />
        ) : null}

        <SciReactionZone intensityRef={zoneIntensityRef} lite={lite} />
        <SciShockwave amountRef={flashAmtRef} />
        <SciFormationBurst
          triggerRef={formationTrigRef}
          count={quality.burstCount}
          color="#ffb060"
          color2="#7ef0ff"
          radius={1.7}
        />
        <SciStageCaption text={caption} />

        {/* Юнит A: хлорит NaClO₂ → ClO₂ (Cl/O/O — одни и те же атомы всю сцену) */}
        <group ref={n1cl}>
          <SciProAtom symbol="Cl" color={SCI_CPK.Cl} radius={0.3} quality={quality} />
          <group ref={oxTagCl} visible={false}>
            <Billboard position={[0, 0.42, 0]} follow>
              <Text
                fontSize={0.1}
                color="#ffe08a"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.006}
                outlineColor="#1a0c04"
                material-side={THREE.FrontSide}
                depthOffset={-1}
              >
                Cl: +3 → +4
              </Text>
            </Billboard>
          </group>
        </group>
        <group ref={n1o0}>
          <SciProAtom symbol="O" color={SCI_CPK.O} radius={0.24} quality={quality} />
        </group>
        <group ref={n1o1}>
          <SciProAtom symbol="O" color={SCI_CPK.O} radius={0.24} quality={quality} />
        </group>
        <group ref={n1na}>
          <SciProAtom symbol="Na⁺" color={SCI_CPK.Na} radius={0.26} emissiveBoost={0.65} quality={quality} />
        </group>

        {/* Юнит B: симметричный второй NaClO₂ → ClO₂ */}
        <group ref={n2cl}>
          <SciProAtom symbol="Cl" color={SCI_CPK.Cl} radius={0.3} quality={quality} />
        </group>
        <group ref={n2o0}>
          <SciProAtom symbol="O" color={SCI_CPK.O} radius={0.24} quality={quality} />
        </group>
        <group ref={n2o1}>
          <SciProAtom symbol="O" color={SCI_CPK.O} radius={0.24} quality={quality} />
        </group>
        <group ref={n2na}>
          <SciProAtom symbol="Na⁺" color={SCI_CPK.Na} radius={0.26} emissiveBoost={0.65} quality={quality} />
        </group>

        {/* O–Cl бонды НИКОГДА не рвутся — химически реален только разрыв Cl–Cl */}
        <Bond from={world.unitA.cl} to={world.unitA.o0} color={0xff5577} lite={lite} />
        <Bond from={world.unitA.cl} to={world.unitA.o1} color={0xff5577} lite={lite} />
        <Bond from={world.unitB.cl} to={world.unitB.o0} color={0xff5577} visibleRef={unitBBondsVisible} lite={lite} />
        <Bond from={world.unitB.cl} to={world.unitB.o1} color={0xff5577} visibleRef={unitBBondsVisible} lite={lite} />

        {/* Свободные атомы Cl₂ → после разрыва каждый образует ионную пару NaCl со «своим» Na⁺ */}
        <group ref={clA}>
          <SciProAtom symbol="Cl" color={SCI_CPK.Cl} radius={0.32} emissiveBoost={0.55} quality={quality} />
          <group ref={oxTagFreeCl} visible={false}>
            <Billboard position={[0, -0.42, 0]} follow>
              <Text
                fontSize={0.1}
                color="#9ef7ff"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.006}
                outlineColor="#021018"
                material-side={THREE.FrontSide}
                depthOffset={-1}
              >
                Cl: 0 → −1
              </Text>
            </Billboard>
          </group>
        </group>
        <group ref={clB}>
          <SciProAtom symbol="Cl" color={SCI_CPK.Cl} radius={0.32} emissiveBoost={0.55} quality={quality} />
        </group>
        <Bond
          from={world.clA}
          to={world.clB}
          stretchRef={cl2StretchRef}
          glowRef={cl2GlowRef}
          thinningRef={cl2ThinRef}
          color={SCI_CPK.Cl}
          visibleRef={cl2BondVisible}
          lite={lite}
        />
        {/* Ионные связи Na⁺–Cl⁻ — появляются в момент кристаллизации NaCl */}
        <Bond from={world.naA} to={world.clA} color={0xb48cff} visibleRef={nacBondsVisible} lite={lite} />
        <Bond from={world.naB} to={world.clB} color={0xb48cff} visibleRef={nacBondsVisible} lite={lite} />

        <SciStoichBadge value={2} position={[0, 1.05, 0.15]} visible={showCounters} label="NaClO₂" />
        <SciStoichBadge value={1} position={[0, -1.55, 0.2]} visible={showCounters} label="Cl₂" />

        <group ref={impulseA} visible={false}>
          <SciElectronImpulse />
        </group>
        <group ref={impulseB} visible={false}>
          <SciElectronImpulse />
        </group>

        <mesh ref={flash} visible={false}>
          <sphereGeometry args={[1, lite ? 16 : 24, lite ? 12 : 20]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        <SciAmberHalo meshRef={amberA} />
        <SciAmberHalo meshRef={amberB} />

        {showFinaleCaption ? (
          <group position={[0, -1.0, 0]}>
            <Text
              fontSize={0.18}
              color="#ffe8c0"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.01}
              outlineColor="#1a0c04"
              material-side={THREE.FrontSide}
            >
              ClO₂ · угол ≈ 117.4° · сильный окислитель
            </Text>
            <Text
              position={[0, -0.25, 0]}
              fontSize={0.12}
              color="#c8d8e8"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.006}
              outlineColor="#041018"
              material-side={THREE.FrontSide}
            >
              2NaClO₂ + Cl₂ → 2NaCl + 2ClO₂
            </Text>
          </group>
        ) : null}
      </group>
    </>
  )
}
