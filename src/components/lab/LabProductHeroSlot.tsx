import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import * as THREE from 'three'
import { LAUNCH_PRODUCT_ENTRANCE_DUR } from '../../lab/synthesisLaunchTiming'
import type { CompoundDef } from '../../types/chemistry'
import { CatalogSubstanceDisplay } from './CatalogSubstanceDisplay'
import { CATALOG_HERO_DEFAULT_LAB_SCALE } from './catalogMoleculeHeroShared'

/**
 * Единый слот 3D-продукта: без своего background (фон в LabReactorEnvironment).
 */
export function LabProductHeroSlot({
  compound,
  visible,
  prewarm = false,
  entrance = 'smooth',
  runId = 0,
}: {
  compound: CompoundDef
  visible: boolean
  /** Скрытый compile в сцене до фазы product */
  prewarm?: boolean
  entrance?: 'smooth' | 'instant' | 'none'
  runId?: number
}) {
  const groupRef = useRef<THREE.Group>(null)
  const revealedForRunRef = useRef(-1)
  const wasPrewarmRef = useRef(false)

  useLayoutEffect(() => {
    const g = groupRef.current
    if (!g) return

    if (prewarm && !visible) {
      wasPrewarmRef.current = true
      gsap.killTweensOf(g.scale)
      g.scale.set(0.001, 0.001, 0.001)
      return
    }

    if (!visible) return

    gsap.killTweensOf(g.scale)

    if (entrance === 'instant' || entrance === 'none') {
      g.scale.set(1, 1, 1)
      revealedForRunRef.current = runId
      wasPrewarmRef.current = false
      return
    }

    if (revealedForRunRef.current === runId && !wasPrewarmRef.current) {
      g.scale.set(1, 1, 1)
      return
    }

    revealedForRunRef.current = runId
    const fromPrewarm = wasPrewarmRef.current
    wasPrewarmRef.current = false

    if (fromPrewarm) {
      const t = gsap.to(g.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: LAUNCH_PRODUCT_ENTRANCE_DUR,
        ease: 'power3.out',
      })
      return () => {
        t.kill()
      }
    }

    g.scale.set(0.92, 0.92, 0.92)
    const t = gsap.to(g.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: LAUNCH_PRODUCT_ENTRANCE_DUR,
      ease: 'power2.out',
    })
    return () => {
      t.kill()
    }
  }, [visible, prewarm, entrance, compound.id, runId])

  const showLights = visible
  const ambientIntensity = visible ? 0.36 : 0.22
  const dirIntensity = visible ? 0.72 : 0.42

  return (
    <>
      {showLights ? (
        <>
          <ambientLight intensity={ambientIntensity} />
          <directionalLight
            position={[3.2, 5.5, 2.5]}
            intensity={dirIntensity}
            color="#b8c8ff"
          />
        </>
      ) : null}
      <group ref={groupRef} position={[0, 0, 0]} visible={visible || prewarm} frustumCulled={!prewarm || visible}>
        <CatalogSubstanceDisplay
          compound={compound}
          labScaleBoost={CATALOG_HERO_DEFAULT_LAB_SCALE}
          reducedEffects
          labSynthesisScene
          renderQuality="synthesis"
          fxLevel={visible || prewarm ? 'low' : 'off'}
        />
      </group>
    </>
  )
}
