import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles, Text } from '@react-three/drei'
import * as THREE from 'three'
import {
  CH4_SCENARIO,
  ch4StageAt,
  TETRAHEDRAL_DIRS,
} from '../../../lab/scientificSynthesis/methaneScenarioTiming'
import {
  resolveSciFxQuality,
  SciCinematicPostFx,
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
  useCh4CinematicDirector,
  type SciPostDirector,
} from '../../../lab/scientificSynthesis/effects'
import type { ScientificSynthesisFxProps } from '../../../lab/scientificSynthesis/types'

const STAGE_CAPTION: Record<number, string> = {
  1: 'Фаза 1 · Вход · CH₄ + 2 O₂',
  2: 'Фаза 2 · Сближение · натяжение связей',
  3: 'Фаза 3 · Воспламенение · разрыв и горение',
  4: 'Фаза 4 · Разлёт продуктов · CO₂ и H₂O',
  5: 'CO₂ линейная (180°) · H₂O угловая ≈104.5°',
}

function smoothstep(a: number, b: number, x: number) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a || 1), 0, 1)
  return t * t * (3 - 2 * t)
}

/** VSEPR: CH₄ — правильный тетраэдр, угол H–C–H точно 109.5°. */
function tetrahedralCh4Local(bond = CH4_SCENARIO.chBondLen) {
  return TETRAHEDRAL_DIRS.map((d) => {
    const v = new THREE.Vector3(d[0], d[1], d[2]).normalize().multiplyScalar(bond)
    return v
  })
}

/** VSEPR: H₂O — угловая, H–O–H = 104.5°. */
function bentH2oLocal(angleDeg = CH4_SCENARIO.h2oAngleDeg, bond = CH4_SCENARIO.ohBondLen) {
  const half = (angleDeg / 2) * (Math.PI / 180)
  return {
    o: new THREE.Vector3(0, 0, 0),
    h0: new THREE.Vector3(bond * Math.sin(half), 0, bond * Math.cos(half)),
    h1: new THREE.Vector3(-bond * Math.sin(half), 0, bond * Math.cos(half)),
  }
}

/**
 * AAA cinematic microworld: CH₄ + 2O₂ → CO₂ + 2H₂O (горение метана).
 * Тетраэдрический CH₄ (109.5°), линейные O₂/CO₂ (180°), угловая H₂O (104.5°).
 * Экзотермическая вспышка: GPU-частицы огня + тепловая ударная волна.
 */
export function Ch4CombustionSciFx({
  runId = 0,
  lowPower = false,
  onEmbryoReady,
  onBirthReady,
  onComplete,
}: ScientificSynthesisFxProps) {
  const quality = useMemo(() => resolveSciFxQuality(lowPower), [lowPower])
  const lite = quality.quality === 'lite'

  const postDirector = useRef<SciPostDirector>({ bloom: 0.3, dof: 0.15, chroma: 0.08 })
  const director = useCh4CinematicDirector(runId, lite, postDirector)

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

  const fireTrigRef = useRef(0)
  const zoneIntensityRef = useRef(0.3)
  const flashAmtRef = useRef(0)
  const chBondVisible = useRef(true)
  const ooBondVisible = useRef(true)
  const coBondVisible = useRef(false)
  const ohBondVisible = useRef(false)

  const rootGroup = useRef<THREE.Group>(null)
  const keyLight = useRef<THREE.PointLight>(null)
  const heatLight = useRef<THREE.PointLight>(null)
  const flash = useRef<THREE.Mesh>(null)

  const cCenter = useRef<THREE.Group>(null)
  const hRefs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const o2aA = useRef<THREE.Group>(null)
  const o2aB = useRef<THREE.Group>(null)
  const o2bA = useRef<THREE.Group>(null)
  const o2bB = useRef<THREE.Group>(null)

  const co2C = useRef<THREE.Group>(null)
  const co2O0 = useRef<THREE.Group>(null)
  const co2O1 = useRef<THREE.Group>(null)
  const h2oAo = useRef<THREE.Group>(null)
  const h2oAh0 = useRef<THREE.Group>(null)
  const h2oAh1 = useRef<THREE.Group>(null)
  const h2oBo = useRef<THREE.Group>(null)
  const h2oBh0 = useRef<THREE.Group>(null)
  const h2oBh1 = useRef<THREE.Group>(null)

  const world = useMemo(() => {
    const chLocal = tetrahedralCh4Local()
    return {
      c: new THREE.Vector3(-1.4, 0.1, 0),
      h: chLocal.map(() => new THREE.Vector3()),
      hLocal: chLocal,
      o2a: { a: new THREE.Vector3(), b: new THREE.Vector3(), origin: new THREE.Vector3(1.2, 0.9, 0.1) },
      o2b: { a: new THREE.Vector3(), b: new THREE.Vector3(), origin: new THREE.Vector3(1.2, -0.7, -0.1) },
      co2: {
        c: new THREE.Vector3(),
        o0: new THREE.Vector3(),
        o1: new THREE.Vector3(),
        origin: new THREE.Vector3(),
      },
      h2oA: { o: new THREE.Vector3(), h0: new THREE.Vector3(), h1: new THREE.Vector3(), origin: new THREE.Vector3() },
      h2oB: { o: new THREE.Vector3(), h0: new THREE.Vector3(), h1: new THREE.Vector3(), origin: new THREE.Vector3() },
    }
  }, [runId])

  useEffect(() => {
    embryoFired.current = false
    birthFired.current = false
    doneFired.current = false
    fireTrigRef.current = 0
    setUiStage(1)
    setShowCounters(true)
    setShowFinaleCaption(false)
    showCountersRef.current = true
    showFinaleCaptionRef.current = false
  }, [runId])

  useFrame(() => {
    const t = director.current.t
    const stage = ch4StageAt(t)
    if (stage !== uiStage) setUiStage(stage)

    const w = world
    let counters = true
    let showHero = false
    let showProducts = false
    let flashAmt = 0
    let heatGlow = director.current.heat
    let fireTrig = 0
    let zone = 0.3

    const jitter = (amp: number) => (Math.sin(t * 8.5) + Math.sin(t * 5.3 + 1.7)) * 0.5 * amp

    if (stage === 1) {
      w.c.set(-1.4 + jitter(0.02), 0.1 + jitter(0.02), jitter(0.02))
      w.o2a.origin.set(1.2 + jitter(0.02), 0.9 + jitter(0.02), 0.1)
      w.o2b.origin.set(1.2 + jitter(0.02), -0.7 + jitter(0.02), -0.1)
      zone = 0.28
    } else if (stage === 2) {
      const u = smoothstep(CH4_SCENARIO.stage1End, CH4_SCENARIO.stage2End, t)
      w.c.set(-1.4 + u * 1.0, 0.1, 0)
      w.o2a.origin.set(1.2 - u * 0.85, 0.9 - u * 0.75, 0.1)
      w.o2b.origin.set(1.2 - u * 0.85, -0.7 + u * 0.55, -0.1)
      zone = 0.35 + u * 0.4
    } else if (stage === 3) {
      const u = smoothstep(CH4_SCENARIO.stage2End, CH4_SCENARIO.stage3End, t)
      w.c.set(-0.4 + u * 0.4, 0.1, 0)
      w.o2a.origin.set(0.35 - u * 0.2, 0.15 - u * 0.05, 0.1)
      w.o2b.origin.set(0.35 - u * 0.2, 0.05 + u * 0.05, -0.1)
      const ignite = u > 0.4
      chBondVisible.current = u < 0.5
      ooBondVisible.current = u < 0.55
      zone = 0.9
      if (ignite) {
        showProducts = true
        coBondVisible.current = true
        ohBondVisible.current = true
        const p = smoothstep(0.4, 1, u)
        flashAmt = p < 0.4 ? smoothstep(0, 0.4, p) : Math.max(0, 1 - smoothstep(0.4, 0.85, p))
        fireTrig = flashAmt
        heatGlow = Math.max(heatGlow, p)

        w.co2.origin.set(0.1 + p * 0.15, 0.35 + p * 0.15, 0.05)
        w.co2.c.copy(w.co2.origin)
        w.co2.o0.copy(w.co2.origin).add(new THREE.Vector3(CH4_SCENARIO.coBondLen, 0, 0))
        w.co2.o1.copy(w.co2.origin).add(new THREE.Vector3(-CH4_SCENARIO.coBondLen, 0, 0))

        const hb = bentH2oLocal()
        w.h2oA.origin.set(-0.55 - p * 0.2, -0.55 - p * 0.15, 0.35)
        w.h2oA.o.copy(w.h2oA.origin).add(hb.o)
        w.h2oA.h0.copy(w.h2oA.origin).add(hb.h0)
        w.h2oA.h1.copy(w.h2oA.origin).add(hb.h1)
        w.h2oB.origin.set(-0.55 - p * 0.2, -0.55 - p * 0.15, -0.35)
        w.h2oB.o.copy(w.h2oB.origin).add(hb.o)
        w.h2oB.h0.copy(w.h2oB.origin).add(hb.h0)
        w.h2oB.h1.copy(w.h2oB.origin).add(hb.h1)
      }
    } else if (stage === 4) {
      showProducts = true
      counters = false
      chBondVisible.current = false
      ooBondVisible.current = false
      coBondVisible.current = true
      ohBondVisible.current = true
      const u = smoothstep(CH4_SCENARIO.stage3End, CH4_SCENARIO.stage4End, t)
      heatGlow = Math.max(heatGlow, 1 - u * 0.3)
      zone = 0.55 * (1 - u * 0.5)
      const spin = t * 1.1
      w.co2.origin.set(0.25 + u * 0.7, 0.5 + u * 0.9, 0.05 + Math.sin(spin) * 0.1)
      w.co2.c.copy(w.co2.origin)
      w.co2.o0.copy(w.co2.origin).add(new THREE.Vector3(Math.cos(spin) * CH4_SCENARIO.coBondLen, 0, Math.sin(spin) * CH4_SCENARIO.coBondLen))
      w.co2.o1.copy(w.co2.origin).add(new THREE.Vector3(-Math.cos(spin) * CH4_SCENARIO.coBondLen, 0, -Math.sin(spin) * CH4_SCENARIO.coBondLen))

      const hb = bentH2oLocal()
      w.h2oA.origin.set(-0.75 - u * 1.1, -0.7 - u * 1.0, 0.35 + u * 0.4)
      w.h2oA.o.copy(w.h2oA.origin).add(hb.o)
      w.h2oA.h0.copy(w.h2oA.origin).add(hb.h0)
      w.h2oA.h1.copy(w.h2oA.origin).add(hb.h1)
      w.h2oB.origin.set(-0.75 - u * 1.1, -0.7 - u * 1.0, -0.35 - u * 0.4)
      w.h2oB.o.copy(w.h2oB.origin).add(hb.o)
      w.h2oB.h0.copy(w.h2oB.origin).add(hb.h0)
      w.h2oB.h1.copy(w.h2oB.origin).add(hb.h1)
    } else {
      showHero = true
      showProducts = false
      counters = false
      heatGlow = 0.35
      zone = 0.4
      const hb = bentH2oLocal()
      w.co2.origin.set(-6, -3, 0)
      w.co2.c.copy(w.co2.origin)
      w.co2.o0.copy(w.co2.origin)
      w.co2.o1.copy(w.co2.origin)
      w.h2oA.origin.set(-6, -3, 0.4)
      w.h2oA.o.copy(w.h2oA.origin).add(hb.o)
      w.h2oA.h0.copy(w.h2oA.origin).add(hb.h0)
      w.h2oA.h1.copy(w.h2oA.origin).add(hb.h1)
      w.h2oB.origin.set(-6, -3, -0.4)
      w.h2oB.o.copy(w.h2oB.origin).add(hb.o)
      w.h2oB.h0.copy(w.h2oB.origin).add(hb.h0)
      w.h2oB.h1.copy(w.h2oB.origin).add(hb.h1)
    }

    zoneIntensityRef.current = zone
    flashAmtRef.current = flashAmt
    fireTrigRef.current = fireTrig

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

    const reagentsVis = stage <= 3 && !(stage === 3 && showProducts && t > CH4_SCENARIO.stage2End + 1.2)
    put(cCenter, w.c, reagentsVis)
    for (let i = 0; i < 4; i++) {
      const local = w.hLocal[i]!
      w.h[i]!.copy(w.c).add(local)
      put(hRefs[i]!, w.h[i]!, reagentsVis)
    }
    w.o2a.a.copy(w.o2a.origin).add(new THREE.Vector3(0, CH4_SCENARIO.ooBondLen * 0.5, 0))
    w.o2a.b.copy(w.o2a.origin).add(new THREE.Vector3(0, -CH4_SCENARIO.ooBondLen * 0.5, 0))
    w.o2b.a.copy(w.o2b.origin).add(new THREE.Vector3(0, CH4_SCENARIO.ooBondLen * 0.5, 0))
    w.o2b.b.copy(w.o2b.origin).add(new THREE.Vector3(0, -CH4_SCENARIO.ooBondLen * 0.5, 0))
    put(o2aA, w.o2a.a, reagentsVis)
    put(o2aB, w.o2a.b, reagentsVis)
    put(o2bA, w.o2b.a, reagentsVis)
    put(o2bB, w.o2b.b, reagentsVis)

    put(co2C, w.co2.c, showProducts)
    put(co2O0, w.co2.o0, showProducts)
    put(co2O1, w.co2.o1, showProducts)
    put(h2oAo, w.h2oA.o, showProducts)
    put(h2oAh0, w.h2oA.h0, showProducts)
    put(h2oAh1, w.h2oA.h1, showProducts)
    put(h2oBo, w.h2oB.o, showProducts)
    put(h2oBh0, w.h2oB.h0, showProducts)
    put(h2oBh1, w.h2oB.h1, showProducts)

    if (flash.current) {
      const mat = flash.current.material as THREE.MeshBasicMaterial
      mat.opacity = flashAmt * 0.65
      flash.current.scale.setScalar(0.85 + flashAmt * 3.2)
      flash.current.visible = flashAmt > 0.02
    }
    if (heatLight.current) heatLight.current.intensity = 0.15 + heatGlow * (lite ? 1.1 : 1.9)
    if (keyLight.current) keyLight.current.intensity = 0.55 + zone * 0.4

    if (rootGroup.current) {
      const entry = 0.42 + director.current.entry * 0.16
      const breath = lite ? 1 : 1 + 0.008 * Math.sin(t * 1.1)
      rootGroup.current.scale.setScalar(0.58 * entry * breath)
    }

    if (!embryoFired.current && t >= CH4_SCENARIO.stage3End - 0.15) {
      embryoFired.current = true
      onEmbryoReadyRef.current?.()
    }
    if (!birthFired.current && t >= CH4_SCENARIO.stage4End + 0.1) {
      birthFired.current = true
      onBirthReadyRef.current?.()
    }
    if (!doneFired.current && t >= CH4_SCENARIO.finaleEnd) {
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
        <ambientLight intensity={lite ? 0.26 : 0.16} />
        <pointLight ref={keyLight} position={[0, 1.3, 1.9]} intensity={0.65} color="#c8dcff" distance={12} />
        <pointLight ref={heatLight} position={[0.2, 0.1, 0.6]} intensity={0.2} color="#ff5a1e" distance={9} />

        {quality.sparkles > 0 ? (
          <Sparkles count={quality.sparkles} scale={3.2} size={1.4} speed={0.3} opacity={0.28} color="#ffb070" />
        ) : null}

        <SciReactionZone intensityRef={zoneIntensityRef} lite={lite} />
        <SciShockwave amountRef={flashAmtRef} />
        <SciFormationBurst
          triggerRef={fireTrigRef}
          count={quality.burstCount}
          color="#ff5a1e"
          color2="#ffd27a"
          radius={2.0}
        />
        <SciStageCaption text={caption} />

        <group ref={cCenter}>
          <SciProAtom symbol="C" color={SCI_CPK.C} radius={0.26} emissiveBoost={0.3} quality={quality} />
        </group>
        {hRefs.map((r, i) => (
          <group ref={r} key={i}>
            <SciProAtom symbol="H" color={SCI_CPK.H} radius={0.16} emissiveBoost={0.5} quality={quality} />
          </group>
        ))}
        {hRefs.map((_, i) => (
          <Bond
            key={`ch-${i}`}
            from={world.c}
            to={world.h[i]!}
            color={0xffe8c0}
            visibleRef={chBondVisible}
            lite={lite}
          />
        ))}

        <group ref={o2aA}>
          <SciProAtom symbol="O" color={SCI_CPK.O} radius={0.24} quality={quality} />
        </group>
        <group ref={o2aB}>
          <SciProAtom symbol="O" color={SCI_CPK.O} radius={0.24} quality={quality} />
        </group>
        <group ref={o2bA}>
          <SciProAtom symbol="O" color={SCI_CPK.O} radius={0.24} quality={quality} />
        </group>
        <group ref={o2bB}>
          <SciProAtom symbol="O" color={SCI_CPK.O} radius={0.24} quality={quality} />
        </group>
        <Bond from={world.o2a.a} to={world.o2a.b} color={0xff4466} visibleRef={ooBondVisible} lite={lite} />
        <Bond from={world.o2b.a} to={world.o2b.b} color={0xff4466} visibleRef={ooBondVisible} lite={lite} />

        <SciStoichBadge value={1} position={[-1.4, 0.85, 0]} visible={showCounters} label="CH₄" />
        <SciStoichBadge value={2} position={[1.2, 1.35, 0.1]} visible={showCounters} label="O₂" />

        <mesh ref={flash} visible={false}>
          <sphereGeometry args={[1, lite ? 16 : 24, lite ? 12 : 20]} />
          <meshBasicMaterial
            color="#fff2c0"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        <group ref={co2C} visible={false}>
          <SciProAtom symbol="C" color={SCI_CPK.C} radius={0.24} emissiveBoost={0.4} quality={quality} />
        </group>
        <group ref={co2O0} visible={false}>
          <SciProAtom symbol="O" color={SCI_CPK.O} radius={0.24} quality={quality} />
        </group>
        <group ref={co2O1} visible={false}>
          <SciProAtom symbol="O" color={SCI_CPK.O} radius={0.24} quality={quality} />
        </group>
        <Bond from={world.co2.c} to={world.co2.o0} color={0xffaa44} visibleRef={coBondVisible} lite={lite} />
        <Bond from={world.co2.c} to={world.co2.o1} color={0xffaa44} visibleRef={coBondVisible} lite={lite} />

        <group ref={h2oAo} visible={false}>
          <SciProAtom symbol="O" color={SCI_CPK.O} radius={0.22} quality={quality} />
        </group>
        <group ref={h2oAh0} visible={false}>
          <SciProAtom symbol="H" color={SCI_CPK.H} radius={0.15} emissiveBoost={0.5} quality={quality} />
        </group>
        <group ref={h2oAh1} visible={false}>
          <SciProAtom symbol="H" color={SCI_CPK.H} radius={0.15} emissiveBoost={0.5} quality={quality} />
        </group>
        <group ref={h2oBo} visible={false}>
          <SciProAtom symbol="O" color={SCI_CPK.O} radius={0.22} quality={quality} />
        </group>
        <group ref={h2oBh0} visible={false}>
          <SciProAtom symbol="H" color={SCI_CPK.H} radius={0.15} emissiveBoost={0.5} quality={quality} />
        </group>
        <group ref={h2oBh1} visible={false}>
          <SciProAtom symbol="H" color={SCI_CPK.H} radius={0.15} emissiveBoost={0.5} quality={quality} />
        </group>
        <Bond from={world.h2oA.o} to={world.h2oA.h0} color={0x8fd0ff} visibleRef={ohBondVisible} lite={lite} />
        <Bond from={world.h2oA.o} to={world.h2oA.h1} color={0x8fd0ff} visibleRef={ohBondVisible} lite={lite} />
        <Bond from={world.h2oB.o} to={world.h2oB.h0} color={0x8fd0ff} visibleRef={ohBondVisible} lite={lite} />
        <Bond from={world.h2oB.o} to={world.h2oB.h1} color={0x8fd0ff} visibleRef={ohBondVisible} lite={lite} />

        {showFinaleCaption ? (
          <Text
            position={[-6, -3.6, 0]}
            fontSize={0.18}
            color="#ffe8c0"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.01}
            outlineColor="#1a0c04"
            material-side={THREE.FrontSide}
          >
            CH₄ + 2O₂ → CO₂ + 2H₂O · экзотермична
          </Text>
        ) : null}
      </group>
    </>
  )
}
