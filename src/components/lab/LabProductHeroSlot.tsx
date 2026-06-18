import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import type * as THREE from 'three'
import { LAUNCH_PRODUCT_ENTRANCE_DUR } from '../../lab/synthesisLaunchTiming'
import type { CompoundDef } from '../../types/chemistry'
import { CatalogSubstanceDisplay } from './CatalogSubstanceDisplay'
import { CATALOG_HERO_DEFAULT_LAB_SCALE } from './catalogMoleculeHeroShared'

/**
 * Единый слот 3D-продукта: без своего background (фон в LabReactorEnvironment).
 * Не переключает visible=false при prewarm — только scale, без мигания.
 */
export function LabProductHeroSlot({
  compound,
  visible,
  prewarm = false,
  entrance = 'smooth',
  runId = 0,
  birthEntrance = false,
  entranceDuration = LAUNCH_PRODUCT_ENTRANCE_DUR,
}: {
  compound: CompoundDef
  visible: boolean
  prewarm?: boolean
  entrance?: 'smooth' | 'instant' | 'none'
  runId?: number
  birthEntrance?: boolean
  entranceDuration?: number
}) {
  const groupRef = useRef<THREE.Group>(null)
  const spinRef = useRef<THREE.Group>(null)
  const revealedForRunRef = useRef(-1)
  const wasPrewarmRef = useRef(false)

  useLayoutEffect(() => {
    const g = groupRef.current
    const spin = spinRef.current
    if (!g) return

    if (prewarm && !visible) {
      wasPrewarmRef.current = true
      gsap.killTweensOf(g.scale)
      if (spin) gsap.killTweensOf(spin.rotation)
      g.scale.set(0.001, 0.001, 0.001)
      if (spin) spin.rotation.set(0, 0, 0)
      return
    }

    if (!visible) {
      if (wasPrewarmRef.current) return
      return
    }

    gsap.killTweensOf(g.scale)
    if (spin) gsap.killTweensOf(spin.rotation)

    if (entrance === 'none') {
      g.scale.set(1, 1, 1)
      if (spin) spin.rotation.set(0, 0, 0)
      revealedForRunRef.current = runId
      wasPrewarmRef.current = false
      return
    }

    if (revealedForRunRef.current === runId && !wasPrewarmRef.current && g.scale.x > 0.9) {
      return
    }

    revealedForRunRef.current = runId
    const fromPrewarm = wasPrewarmRef.current
    wasPrewarmRef.current = false
    const dur = entranceDuration

    if (birthEntrance || fromPrewarm) {
      if (g.scale.x < 0.01) {
        g.scale.set(0.001, 0.001, 0.001)
      }
      if (spin) spin.rotation.set(0, 0, 0)
      const tl = gsap.timeline()
      tl.to(
        g.scale,
        { x: 1.1, y: 1.1, z: 1.1, duration: dur * 0.68, ease: 'power2.out' },
        0,
      )
      tl.to(g.scale, { x: 1, y: 1, z: 1, duration: dur * 0.32, ease: 'power2.inOut' })
      if (spin && birthEntrance) {
        tl.to(
          spin.rotation,
          { y: Math.PI * 0.18, duration: dur * 0.9, ease: 'power3.out' },
          0,
        )
      }
      return () => {
        tl.kill()
      }
    }

    if (g.scale.x < 0.5) {
      g.scale.set(0.92, 0.92, 0.92)
    }
    const t = gsap.to(g.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: dur,
      ease: 'power2.out',
    })
    return () => {
      t.kill()
    }
  }, [visible, prewarm, entrance, compound.id, runId, birthEntrance, entranceDuration])

  const sceneActive = visible || prewarm

  return (
    <>
      {sceneActive ? (
        <>
          <ambientLight intensity={0.34} />
          <directionalLight
            position={[3.2, 5.5, 2.5]}
            intensity={0.68}
            color="#b8c8ff"
          />
        </>
      ) : null}
      <group ref={groupRef} position={[0, 0, 0]} visible frustumCulled={false} renderOrder={8}>
        <group ref={spinRef}>
          <CatalogSubstanceDisplay
            compound={compound}
            labScaleBoost={CATALOG_HERO_DEFAULT_LAB_SCALE}
            reducedEffects
            labSynthesisScene
            renderQuality="synthesis"
            fxLevel={sceneActive ? 'low' : 'off'}
            chaoticWobble={visible && birthEntrance}
          />
        </group>
      </group>
    </>
  )
}
