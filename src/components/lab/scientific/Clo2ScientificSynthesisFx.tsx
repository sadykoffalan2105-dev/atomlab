import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles, Text } from '@react-three/drei'
import * as THREE from 'three'
import {
  CLO2_SCENARIO,
  clo2StageAt,
  clo2TimeScale,
} from '../../../lab/scientificSynthesis/clo2ScenarioTiming'
import {
  resolveSciFxQuality,
  SciAmberHalo,
  SciElectronImpulse,
  SciEnergyBond,
  SciFormationBurst,
  SciProAtom,
  SciReactionZone,
  SciShockwave,
  SciStageCaption,
  SciStoichBadge,
} from '../../../lab/scientificSynthesis/effects'
import type { ScientificSynthesisFxProps } from '../../../lab/scientificSynthesis/types'

const CPK = {
  O: 0xff0d0d,
  Cl: 0x1ff01f,
  Na: 0xab5cf2,
} as const

const STAGE_CAPTION: Record<number, string> = {
  1: 'Исходное состояние · 2 NaClO₂ + Cl₂',
  2: 'Сближение · энергия активации',
  3: 'Перестройка связей · образование',
  4: 'Разлёт продуктов · ClO₂ и NaCl',
  5: 'ClO₂ · угол O–Cl–O ≈ 117.4°',
}

function smoothstep(a: number, b: number, x: number) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a || 1), 0, 1)
  return t * t * (3 - 2 * t)
}

function bentClo2Local(angleDeg = CLO2_SCENARIO.clo2AngleDeg, bond = CLO2_SCENARIO.clo2BondLen) {
  const half = (angleDeg / 2) * (Math.PI / 180)
  return {
    cl: new THREE.Vector3(0, 0, 0),
    o0: new THREE.Vector3(bond * Math.sin(half), 0, bond * Math.cos(half)),
    o1: new THREE.Vector3(-bond * Math.sin(half), 0, bond * Math.cos(half)),
  }
}

type ChloriteSlot = {
  cl: THREE.Vector3
  o0: THREE.Vector3
  o1: THREE.Vector3
  na: THREE.Vector3
  origin: THREE.Vector3
  local: ReturnType<typeof bentClo2Local>
}

/**
 * Научный микромир ClO₂ на библиотеке effects/ (образование + производительность).
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

  const tRef = useRef(0)
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
  const heroGlowRef = useRef(0.5)
  const zoneIntensityRef = useRef(0.35)
  const flashAmtRef = useRef(0)
  const formationTrigRef = useRef(0)
  const cl2BondVisible = useRef(true)
  const reagentBondsVisible = useRef(true)
  const productBondsVisible = useRef(false)
  const naclBondsVisible = useRef(false)
  const heroBondsVisible = useRef(false)

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
  const impulse = useRef<THREE.Group>(null)
  const flash = useRef<THREE.Mesh>(null)
  const clo2Acl = useRef<THREE.Group>(null)
  const clo2Ao0 = useRef<THREE.Group>(null)
  const clo2Ao1 = useRef<THREE.Group>(null)
  const clo2Bcl = useRef<THREE.Group>(null)
  const clo2Bo0 = useRef<THREE.Group>(null)
  const clo2Bo1 = useRef<THREE.Group>(null)
  const naclAna = useRef<THREE.Group>(null)
  const naclAcl = useRef<THREE.Group>(null)
  const naclBna = useRef<THREE.Group>(null)
  const naclBcl = useRef<THREE.Group>(null)
  const heroCl = useRef<THREE.Group>(null)
  const heroO0 = useRef<THREE.Group>(null)
  const heroO1 = useRef<THREE.Group>(null)
  const amberA = useRef<THREE.Mesh>(null)
  const amberB = useRef<THREE.Mesh>(null)
  const amberHero = useRef<THREE.Mesh>(null)
  const heroGroup = useRef<THREE.Group>(null)
  const exoLight = useRef<THREE.PointLight>(null)
  const keyLight = useRef<THREE.PointLight>(null)
  const rootGroup = useRef<THREE.Group>(null)

  const world = useMemo(() => {
    const L = bentClo2Local()
    return {
      n1: {
        cl: new THREE.Vector3(),
        o0: new THREE.Vector3(),
        o1: new THREE.Vector3(),
        na: new THREE.Vector3(),
        origin: new THREE.Vector3(-1.85, 0.15, 0),
        local: L,
      } satisfies ChloriteSlot,
      n2: {
        cl: new THREE.Vector3(),
        o0: new THREE.Vector3(),
        o1: new THREE.Vector3(),
        na: new THREE.Vector3(),
        origin: new THREE.Vector3(1.85, 0.15, 0),
        local: bentClo2Local(),
      } satisfies ChloriteSlot,
      clA: new THREE.Vector3(0, -1.55, 0.25),
      clB: new THREE.Vector3(0, -1.55 - CLO2_SCENARIO.cl2BondLen, 0.25),
      clo2A: {
        cl: new THREE.Vector3(),
        o0: new THREE.Vector3(),
        o1: new THREE.Vector3(),
        origin: new THREE.Vector3(),
      },
      clo2B: {
        cl: new THREE.Vector3(),
        o0: new THREE.Vector3(),
        o1: new THREE.Vector3(),
        origin: new THREE.Vector3(),
      },
      naclA: { na: new THREE.Vector3(), cl: new THREE.Vector3() },
      naclB: { na: new THREE.Vector3(), cl: new THREE.Vector3() },
      impulse: new THREE.Vector3(),
      hero: {
        cl: new THREE.Vector3(0, 0.05, 0),
        o0: new THREE.Vector3(),
        o1: new THREE.Vector3(),
      },
    }
  }, [runId])

  const naOff = useMemo(() => new THREE.Vector3(0.55, 0.42, 0.18), [])
  const tmp = useMemo(
    () => ({
      cl2Home: new THREE.Vector3(0, -1.55, 0.25),
      cl2Target: new THREE.Vector3(0, 0.05, 0),
      cl2Pos: new THREE.Vector3(),
      naclTargetA: new THREE.Vector3(-0.7, -0.55, -0.6),
      naclTargetB: new THREE.Vector3(0.7, -0.55, -0.6),
    }),
    [],
  )

  useEffect(() => {
    tRef.current = 0
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

  useFrame((_, dt) => {
    // На lite не тратим dt на сверхточный slow-mo
    const scale = lite ? Math.min(1, clo2TimeScale(tRef.current) + 0.15) : clo2TimeScale(tRef.current)
    tRef.current += dt * scale
    const t = tRef.current
    const stage = clo2StageAt(t)
    if (stage !== uiStage) setUiStage(stage)

    const w = world
    const placeChlorite = (slot: ChloriteSlot, origin: THREE.Vector3, rotY: number, vibrate: number) => {
      const c = Math.cos(rotY)
      const s = Math.sin(rotY)
      const lx = slot.local
      const jitter = vibrate * Math.sin(t * 9 + rotY)
      const ox = origin.x
      const oy = origin.y + jitter * 0.02
      const oz = origin.z
      const map = (p: THREE.Vector3, out: THREE.Vector3) => {
        out.set(ox + p.x * c + p.z * s, oy + p.y, oz - p.x * s + p.z * c)
      }
      map(lx.cl, slot.cl)
      map(lx.o0, slot.o0)
      map(lx.o1, slot.o1)
      slot.na.set(ox + naOff.x * c, oy + naOff.y, oz + naOff.z)
    }

    let bondLen = CLO2_SCENARIO.cl2BondLen
    cl2StretchRef.current = 1
    cl2GlowRef.current = 0
    cl2ThinRef.current = 0
    cl2BondVisible.current = true
    reagentBondsVisible.current = true
    productBondsVisible.current = false
    naclBondsVisible.current = false
    heroBondsVisible.current = false
    let flashAmt = 0
    let exo = 0
    let amber = 0
    let showProducts = false
    let showHero = false
    let counters = true
    let zone = 0.35
    let formTrig = 0

    if (stage === 1) {
      placeChlorite(w.n1, w.n1.origin, 0.15, 1)
      placeChlorite(w.n2, w.n2.origin, -0.15, 1)
      tmp.cl2Pos.copy(tmp.cl2Home)
      bondLen = CLO2_SCENARIO.cl2BondLen + 0.012 * Math.sin(t * 14)
      cl2GlowRef.current = 0.16 + 0.1 * Math.sin(t * 6)
      zone = 0.4
    } else if (stage === 2) {
      const u = smoothstep(CLO2_SCENARIO.stage1End, CLO2_SCENARIO.stage2End, t)
      placeChlorite(w.n1, w.n1.origin, 0.1, 0.6)
      placeChlorite(w.n2, w.n2.origin, -0.1, 0.6)
      tmp.cl2Pos.lerpVectors(tmp.cl2Home, tmp.cl2Target, u)
      cl2StretchRef.current = 1 + u * 0.55
      cl2GlowRef.current = 0.25 + u * 0.75
      cl2ThinRef.current = u * 0.7
      bondLen = CLO2_SCENARIO.cl2BondLen * cl2StretchRef.current
      zone = 0.45 + u * 0.45
    } else if (stage === 3) {
      const u = smoothstep(CLO2_SCENARIO.stage2End, CLO2_SCENARIO.stage3End, t)
      placeChlorite(w.n1, w.n1.origin, 0.05, 0.2)
      placeChlorite(w.n2, w.n2.origin, -0.05, 0.2)
      tmp.cl2Pos.copy(tmp.cl2Target)
      const broken = u > 0.18
      cl2GlowRef.current = u < 0.35 ? 1 : THREE.MathUtils.lerp(1, 0.15, (u - 0.35) / 0.65)
      cl2ThinRef.current = 0.55 + u * 0.4
      bondLen = CLO2_SCENARIO.cl2BondLen * (broken ? 1.55 + u * 0.9 : 1.55)
      cl2BondVisible.current = u < 0.55
      zone = 0.95

      const impulsePhase = smoothstep(0.22, 0.55, u)
      const toNa = impulsePhase < 0.5 ? w.n1.na : w.n2.na
      const fromCl = impulsePhase < 0.5 ? w.clA : w.clB
      const localU = impulsePhase < 0.5 ? impulsePhase * 2 : (impulsePhase - 0.5) * 2
      w.impulse.lerpVectors(fromCl, toNa, localU)

      if (u > 0.42) {
        showProducts = true
        productBondsVisible.current = true
        naclBondsVisible.current = true
        reagentBondsVisible.current = u < 0.75
        const p = smoothstep(0.42, 1, u)
        flashAmt = p < 0.35 ? smoothstep(0, 0.35, p) : Math.max(0, 1 - smoothstep(0.35, 0.75, p))
        formTrig = flashAmt
        exo = 0.45 + 0.55 * Math.sin(p * Math.PI)
        amber = p
        const L = bentClo2Local()
        w.clo2A.origin.set(-1.15 + p * 0.25, 0.4 + p * 0.35, 0.1)
        w.clo2B.origin.set(1.15 - p * 0.25, 0.4 + p * 0.35, 0.1)
        w.clo2A.cl.copy(w.clo2A.origin).add(L.cl)
        w.clo2A.o0.copy(w.clo2A.origin).add(L.o0)
        w.clo2A.o1.copy(w.clo2A.origin).add(L.o1)
        w.clo2B.cl.copy(w.clo2B.origin).add(L.cl)
        w.clo2B.o0.copy(w.clo2B.origin).add(L.o0)
        w.clo2B.o1.copy(w.clo2B.origin).add(L.o1)
        w.naclA.na.lerpVectors(w.n1.na, tmp.naclTargetA, p)
        w.naclA.cl.set(tmp.naclTargetA.x + 0.35, tmp.naclTargetA.y, tmp.naclTargetA.z)
        w.naclA.cl.lerpVectors(w.clA, w.naclA.cl, p)
        w.naclB.na.lerpVectors(w.n2.na, tmp.naclTargetB, p)
        w.naclB.cl.set(tmp.naclTargetB.x - 0.35, tmp.naclTargetB.y, tmp.naclTargetB.z)
        w.naclB.cl.lerpVectors(w.clB, w.naclB.cl, p)
      }
    } else if (stage === 4) {
      showProducts = true
      counters = false
      productBondsVisible.current = true
      naclBondsVisible.current = true
      reagentBondsVisible.current = false
      cl2BondVisible.current = false
      const u = smoothstep(CLO2_SCENARIO.stage3End, CLO2_SCENARIO.stage4End, t)
      amber = 1
      exo = 0.5 * (1 - u * 0.4)
      zone = 0.5 * (1 - u * 0.45)
      const L = bentClo2Local()
      const spin = t * 1.2
      w.clo2A.origin.set(-1.55 - u * 1.0, 0.95 + u * 1.15, 0.15 + Math.sin(spin) * 0.12)
      w.clo2B.origin.set(1.55 + u * 1.0, 0.95 + u * 1.15, 0.15 + Math.cos(spin) * 0.12)
      const applySpin = (
        origin: THREE.Vector3,
        out: { cl: THREE.Vector3; o0: THREE.Vector3; o1: THREE.Vector3 },
        ang: number,
      ) => {
        const c = Math.cos(ang)
        const s = Math.sin(ang)
        out.cl.copy(origin)
        out.o0.set(
          origin.x + L.o0.x * c - L.o0.z * s,
          origin.y + L.o0.y,
          origin.z + L.o0.x * s + L.o0.z * c,
        )
        out.o1.set(
          origin.x + L.o1.x * c - L.o1.z * s,
          origin.y + L.o1.y,
          origin.z + L.o1.x * s + L.o1.z * c,
        )
      }
      applySpin(w.clo2A.origin, w.clo2A, spin)
      applySpin(w.clo2B.origin, w.clo2B, -spin * 0.9)
      w.naclA.na.set(-0.9, -0.75 - u * 0.35, -0.9 - u * 1.5)
      w.naclA.cl.set(-0.55, -0.75 - u * 0.35, -0.9 - u * 1.5)
      w.naclB.na.set(0.9, -0.75 - u * 0.35, -0.9 - u * 1.5)
      w.naclB.cl.set(0.55, -0.75 - u * 0.35, -0.9 - u * 1.5)
      placeChlorite(w.n1, new THREE.Vector3(-1.85 - u * 2.5, 0.15 - u, 0), 0.2, 0)
      placeChlorite(w.n2, new THREE.Vector3(1.85 + u * 2.5, 0.15 - u, 0), -0.2, 0)
      tmp.cl2Pos.set(0, -2.2 - u * 2, 0)
      bondLen = 2.8
    } else {
      showHero = true
      showProducts = false
      counters = false
      heroBondsVisible.current = true
      productBondsVisible.current = false
      naclBondsVisible.current = false
      reagentBondsVisible.current = false
      cl2BondVisible.current = false
      amber = 1
      exo = 0.25
      zone = 0.48
      formTrig = 0.15
      const L = bentClo2Local()
      const breathe = 1 + 0.025 * Math.sin(t * 2.1)
      w.hero.cl.set(0, 0.1, 0)
      w.hero.o0.copy(L.o0).multiplyScalar(1.08 * breathe).add(w.hero.cl)
      w.hero.o1.copy(L.o1).multiplyScalar(1.08 * breathe).add(w.hero.cl)
      placeChlorite(w.n1, new THREE.Vector3(-6, -3, 0), 0, 0)
      placeChlorite(w.n2, new THREE.Vector3(6, -3, 0), 0, 0)
      tmp.cl2Pos.set(0, -6, 0)
      bondLen = 3
      w.naclA.na.set(-3, -2, -5)
      w.naclA.cl.set(-2.6, -2, -5)
      w.naclB.na.set(3, -2, -5)
      w.naclB.cl.set(2.6, -2, -5)
    }

    const half = bondLen * 0.5
    w.clA.set(tmp.cl2Pos.x, tmp.cl2Pos.y + half, tmp.cl2Pos.z)
    w.clB.set(tmp.cl2Pos.x, tmp.cl2Pos.y - half, tmp.cl2Pos.z)

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

    const put = (r: RefObject<THREE.Group | null>, v: THREE.Vector3, vis: boolean) => {
      if (!r.current) return
      r.current.position.copy(v)
      r.current.visible = vis
    }

    const reagentsVis = stage <= 3 && !(stage === 3 && showProducts && t > CLO2_SCENARIO.stage2End + 1.35)
    put(n1cl, w.n1.cl, reagentsVis)
    put(n1o0, w.n1.o0, reagentsVis)
    put(n1o1, w.n1.o1, reagentsVis)
    put(n1na, w.n1.na, reagentsVis && !(stage === 3 && showProducts))
    put(n2cl, w.n2.cl, reagentsVis)
    put(n2o0, w.n2.o0, reagentsVis)
    put(n2o1, w.n2.o1, reagentsVis)
    put(n2na, w.n2.na, reagentsVis && !(stage === 3 && showProducts))
    put(clA, w.clA, reagentsVis && !(stage === 3 && showProducts))
    put(clB, w.clB, reagentsVis && !(stage === 3 && showProducts))

    if (impulse.current) {
      impulse.current.position.copy(w.impulse)
      impulse.current.visible = stage === 3 && t < CLO2_SCENARIO.stage2End + 1.15
    }
    if (flash.current) {
      const mat = flash.current.material as THREE.MeshBasicMaterial
      mat.opacity = flashAmt * 0.55
      flash.current.scale.setScalar(0.85 + flashAmt * 2.8)
      flash.current.visible = flashAmt > 0.02
    }
    if (exoLight.current) exoLight.current.intensity = 0.2 + exo * (lite ? 0.9 : 1.5)
    if (keyLight.current) keyLight.current.intensity = 0.5 + zone * 0.4

    if (rootGroup.current && !lite) {
      const breath = 1 + 0.01 * Math.sin(t * 1.05)
      rootGroup.current.scale.setScalar(1.1 * breath)
      rootGroup.current.rotation.y = Math.sin(t * 0.12) * 0.03
    }

    put(clo2Acl, w.clo2A.cl, showProducts)
    put(clo2Ao0, w.clo2A.o0, showProducts)
    put(clo2Ao1, w.clo2A.o1, showProducts)
    put(clo2Bcl, w.clo2B.cl, showProducts)
    put(clo2Bo0, w.clo2B.o0, showProducts)
    put(clo2Bo1, w.clo2B.o1, showProducts)
    put(naclAna, w.naclA.na, showProducts)
    put(naclAcl, w.naclA.cl, showProducts)
    put(naclBna, w.naclB.na, showProducts)
    put(naclBcl, w.naclB.cl, showProducts)

    if (amberA.current) {
      amberA.current.position.copy(w.clo2A.origin)
      amberA.current.visible = showProducts && amber > 0.1
      ;(amberA.current.material as THREE.MeshBasicMaterial).opacity = 0.1 + amber * 0.26
    }
    if (amberB.current) {
      amberB.current.position.copy(w.clo2B.origin)
      amberB.current.visible = showProducts && amber > 0.1
      ;(amberB.current.material as THREE.MeshBasicMaterial).opacity = 0.1 + amber * 0.26
    }

    put(heroCl, w.hero.cl, showHero)
    put(heroO0, w.hero.o0, showHero)
    put(heroO1, w.hero.o1, showHero)
    if (heroGroup.current) heroGroup.current.visible = showHero
    if (amberHero.current) {
      amberHero.current.visible = showHero
      amberHero.current.position.copy(w.hero.cl)
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

  return (
    <group ref={rootGroup} scale={1.1}>
      <ambientLight intensity={lite ? 0.28 : 0.2} />
      <pointLight ref={keyLight} position={[0, 1.5, 2.2]} intensity={0.6} color="#c8dcff" distance={14} />
      <pointLight ref={exoLight} position={[0, -0.2, 1.3]} intensity={0.25} color="#ff6a28" distance={10} />
      {!lite ? <pointLight position={[-2, 0.7, -1]} intensity={0.28} color="#66ffaa" distance={9} /> : null}

      {quality.sparkles > 0 ? (
        <Sparkles count={quality.sparkles} scale={6} size={2} speed={0.4} opacity={0.4} color="#9ad8ff" />
      ) : null}
      {quality.sparklesSecondary > 0 ? (
        <Sparkles count={quality.sparklesSecondary} scale={4} size={1.4} speed={0.55} opacity={0.3} color="#ffb070" />
      ) : null}

      <SciReactionZone intensityRef={zoneIntensityRef} lite={lite} />
      <SciShockwave amountRef={flashAmtRef} />
      <SciFormationBurst
        triggerRef={formationTrigRef}
        count={quality.burstCount}
        color="#ffb060"
        color2="#7ef0ff"
        radius={1.9}
      />
      <SciStageCaption text={caption} />

      <group ref={n1cl}>
        <SciProAtom symbol="Cl" color={CPK.Cl} radius={0.3} quality={quality} />
      </group>
      <group ref={n1o0}>
        <SciProAtom symbol="O" color={CPK.O} radius={0.24} quality={quality} />
      </group>
      <group ref={n1o1}>
        <SciProAtom symbol="O" color={CPK.O} radius={0.24} quality={quality} />
      </group>
      <group ref={n1na}>
        <SciProAtom symbol="Na⁺" color={CPK.Na} radius={0.26} emissiveBoost={0.6} quality={quality} />
      </group>
      <group ref={n2cl}>
        <SciProAtom symbol="Cl" color={CPK.Cl} radius={0.3} quality={quality} />
      </group>
      <group ref={n2o0}>
        <SciProAtom symbol="O" color={CPK.O} radius={0.24} quality={quality} />
      </group>
      <group ref={n2o1}>
        <SciProAtom symbol="O" color={CPK.O} radius={0.24} quality={quality} />
      </group>
      <group ref={n2na}>
        <SciProAtom symbol="Na⁺" color={CPK.Na} radius={0.26} emissiveBoost={0.6} quality={quality} />
      </group>

      <SciEnergyBond from={world.n1.cl} to={world.n1.o0} color={0xff8866} visibleRef={reagentBondsVisible} lite={lite} />
      <SciEnergyBond from={world.n1.cl} to={world.n1.o1} color={0xff8866} visibleRef={reagentBondsVisible} lite={lite} />
      <SciEnergyBond from={world.n2.cl} to={world.n2.o0} color={0xff8866} visibleRef={reagentBondsVisible} lite={lite} />
      <SciEnergyBond from={world.n2.cl} to={world.n2.o1} color={0xff8866} visibleRef={reagentBondsVisible} lite={lite} />

      <group ref={clA}>
        <SciProAtom symbol="Cl" color={CPK.Cl} radius={0.32} emissiveBoost={0.5} quality={quality} />
      </group>
      <group ref={clB}>
        <SciProAtom symbol="Cl" color={CPK.Cl} radius={0.32} emissiveBoost={0.5} quality={quality} />
      </group>
      <SciEnergyBond
        from={world.clA}
        to={world.clB}
        stretchRef={cl2StretchRef}
        glowRef={cl2GlowRef}
        thinningRef={cl2ThinRef}
        color={0x66ff88}
        visibleRef={cl2BondVisible}
        lite={lite}
      />

      <SciStoichBadge value={2} position={[-1.85, 1.12, 0]} visible={showCounters} label="NaClO₂" />
      <SciStoichBadge value={1} position={[0, -2.2, 0.25]} visible={showCounters} label="Cl₂" />

      <group ref={impulse} visible={false}>
        <SciElectronImpulse />
      </group>

      <mesh ref={flash} visible={false}>
        <sphereGeometry args={[1, lite ? 16 : 24, lite ? 12 : 20]} />
        <meshBasicMaterial
          color="#ff9a4a"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <group ref={clo2Acl} visible={false}>
        <SciProAtom symbol="Cl" color={CPK.Cl} radius={0.3} quality={quality} />
      </group>
      <group ref={clo2Ao0} visible={false}>
        <SciProAtom symbol="O" color={CPK.O} radius={0.24} quality={quality} />
      </group>
      <group ref={clo2Ao1} visible={false}>
        <SciProAtom symbol="O" color={CPK.O} radius={0.24} quality={quality} />
      </group>
      <group ref={clo2Bcl} visible={false}>
        <SciProAtom symbol="Cl" color={CPK.Cl} radius={0.3} quality={quality} />
      </group>
      <group ref={clo2Bo0} visible={false}>
        <SciProAtom symbol="O" color={CPK.O} radius={0.24} quality={quality} />
      </group>
      <group ref={clo2Bo1} visible={false}>
        <SciProAtom symbol="O" color={CPK.O} radius={0.24} quality={quality} />
      </group>
      <SciEnergyBond from={world.clo2A.cl} to={world.clo2A.o0} color={0xffaa66} visibleRef={productBondsVisible} lite={lite} />
      <SciEnergyBond from={world.clo2A.cl} to={world.clo2A.o1} color={0xffaa66} visibleRef={productBondsVisible} lite={lite} />
      <SciEnergyBond from={world.clo2B.cl} to={world.clo2B.o0} color={0xffaa66} visibleRef={productBondsVisible} lite={lite} />
      <SciEnergyBond from={world.clo2B.cl} to={world.clo2B.o1} color={0xffaa66} visibleRef={productBondsVisible} lite={lite} />

      <SciAmberHalo meshRef={amberA} />
      <SciAmberHalo meshRef={amberB} />

      <group ref={naclAna} visible={false}>
        <SciProAtom symbol="Na⁺" color={CPK.Na} radius={0.26} quality={quality} />
      </group>
      <group ref={naclAcl} visible={false}>
        <SciProAtom symbol="Cl⁻" color={CPK.Cl} radius={0.28} quality={quality} />
      </group>
      <group ref={naclBna} visible={false}>
        <SciProAtom symbol="Na⁺" color={CPK.Na} radius={0.26} quality={quality} />
      </group>
      <group ref={naclBcl} visible={false}>
        <SciProAtom symbol="Cl⁻" color={CPK.Cl} radius={0.28} quality={quality} />
      </group>
      <SciEnergyBond from={world.naclA.na} to={world.naclA.cl} color={0xc8a0ff} visibleRef={naclBondsVisible} lite={lite} />
      <SciEnergyBond from={world.naclB.na} to={world.naclB.cl} color={0xc8a0ff} visibleRef={naclBondsVisible} lite={lite} />

      <group ref={heroGroup} visible={false}>
        <group ref={heroCl}>
          <SciProAtom symbol="Cl" color={CPK.Cl} radius={0.36} emissiveBoost={0.65} quality={quality} />
        </group>
        <group ref={heroO0}>
          <SciProAtom symbol="O" color={CPK.O} radius={0.28} emissiveBoost={0.55} quality={quality} />
        </group>
        <group ref={heroO1}>
          <SciProAtom symbol="O" color={CPK.O} radius={0.28} emissiveBoost={0.55} quality={quality} />
        </group>
        <SciEnergyBond
          from={world.hero.cl}
          to={world.hero.o0}
          color={0xffaa66}
          glowRef={heroGlowRef}
          visibleRef={heroBondsVisible}
          lite={lite}
        />
        <SciEnergyBond
          from={world.hero.cl}
          to={world.hero.o1}
          color={0xffaa66}
          glowRef={heroGlowRef}
          visibleRef={heroBondsVisible}
          lite={lite}
        />
        <SciAmberHalo meshRef={amberHero} radius={1.15} />
        {showFinaleCaption ? (
          <>
            <Text
              position={[0, -1.25, 0]}
              fontSize={0.22}
              color="#ffe8c0"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.01}
              outlineColor="#1a0c04"
            >
              ClO₂ · угол ≈ 117.4° · сильный окислитель
            </Text>
            <Text
              position={[0, -1.55, 0]}
              fontSize={0.14}
              color="#c8d8e8"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.006}
              outlineColor="#041018"
            >
              2NaClO₂ + Cl₂ → 2NaCl + 2ClO₂
            </Text>
          </>
        ) : null}
      </group>
    </group>
  )
}
