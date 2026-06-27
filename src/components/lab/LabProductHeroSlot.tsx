import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { gsap } from 'gsap'
import type * as THREE from 'three'
import { LAUNCH_PRODUCT_ENTRANCE_DUR } from '../../lab/synthesisLaunchTiming'
import {
  isProductGpuCompiled,
  markProductGpuCompiled,
} from '../../lab/productGpuCompileCache'
import type { CompoundDef } from '../../types/chemistry'
import { CatalogSubstanceDisplay } from './CatalogSubstanceDisplay'
import { CATALOG_HERO_DEFAULT_LAB_SCALE } from './catalogMoleculeHeroShared'

const MICRO_SCALE = 0.001

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
  onGpuCompiled,
}: {
  compound: CompoundDef
  visible: boolean
  prewarm?: boolean
  entrance?: 'smooth' | 'instant' | 'none'
  runId?: number
  birthEntrance?: boolean
  entranceDuration?: number
  /** Вызывается после compileAsync меша (или из кэша) — можно показывать продукт. */
  onGpuCompiled?: (compoundId: string) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const spinRef = useRef<THREE.Group>(null)
  const revealedForRunRef = useRef(-1)
  const wasPrewarmRef = useRef(false)
  const compileGenRef = useRef(0)
  const gpuCompiledRef = useRef(false)
  const { gl, camera, scene, invalidate } = useThree()

  const notifyGpuCompiled = useCallback(() => {
    if (gpuCompiledRef.current) return
    gpuCompiledRef.current = true
    markProductGpuCompiled(compound.id)
    onGpuCompiled?.(compound.id)
  }, [compound.id, onGpuCompiled])

  useEffect(() => {
    gpuCompiledRef.current = isProductGpuCompiled(compound.id)
    compileGenRef.current += 1
  }, [compound.id])

  // Cold-start: compileAsync в фоне на полном масштабе, пока меш ещё микроскопический.
  useEffect(() => {
    if (visible) return
    if (!prewarm) return
    if (isProductGpuCompiled(compound.id)) {
      notifyGpuCompiled()
      return
    }

    let cancelled = false
    const gen = compileGenRef.current

    const runCompile = () => {
      if (cancelled || gen !== compileGenRef.current) return
      const root = groupRef.current
      if (!root) {
        requestAnimationFrame(runCompile)
        return
      }

      const prevScale = root.scale.clone()
      root.scale.set(1, 1, 1)
      invalidate()

      requestAnimationFrame(() => {
        if (cancelled || gen !== compileGenRef.current) return
        const target = groupRef.current
        if (!target) return

        const compile =
          typeof gl.compileAsync === 'function'
            ? gl.compileAsync(target, camera, scene)
            : Promise.resolve().then(() => {
                gl.compile(scene, camera)
              })

        compile
          .then(() => {
            if (cancelled || gen !== compileGenRef.current) return
            if (prewarm && !visible) {
              target.scale.set(MICRO_SCALE, MICRO_SCALE, MICRO_SCALE)
            } else {
              target.scale.copy(prevScale)
            }
            invalidate()
            notifyGpuCompiled()
          })
          .catch(() => {
            if (cancelled || gen !== compileGenRef.current) return
            if (prewarm && !visible) {
              target.scale.set(MICRO_SCALE, MICRO_SCALE, MICRO_SCALE)
            }
            notifyGpuCompiled()
          })
      })
    }

    const boot = requestAnimationFrame(() => requestAnimationFrame(runCompile))
    return () => {
      cancelled = true
      cancelAnimationFrame(boot)
    }
  }, [prewarm, visible, compound.id, gl, camera, scene, invalidate, notifyGpuCompiled])

  // Пока меш невидим (scale≈0) — invalidate до завершения compile.
  useFrame(() => {
    if (prewarm && !visible && !gpuCompiledRef.current) invalidate()
  })

  useLayoutEffect(() => {
    const g = groupRef.current
    const spin = spinRef.current
    if (!g) return

    if (visible && (entrance === 'instant' || entrance === 'none')) {
      wasPrewarmRef.current = false
      gsap.killTweensOf(g.scale)
      if (spin) gsap.killTweensOf(spin.rotation)
      g.scale.set(1, 1, 1)
      if (spin) spin.rotation.set(0, 0, 0)
      revealedForRunRef.current = runId
      return
    }

    if (prewarm && !visible) {
      wasPrewarmRef.current = true
      gsap.killTweensOf(g.scale)
      if (spin) gsap.killTweensOf(spin.rotation)
      g.scale.set(MICRO_SCALE, MICRO_SCALE, MICRO_SCALE)
      if (spin) spin.rotation.set(0, 0, 0)
      return
    }

    if (!visible) {
      if (wasPrewarmRef.current) return
      return
    }

    gsap.killTweensOf(g.scale)
    if (spin) gsap.killTweensOf(spin.rotation)

    if (entrance === 'none' || entrance === 'instant') {
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
        g.scale.set(MICRO_SCALE, MICRO_SCALE, MICRO_SCALE)
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
          {/*
            Постоянный fxLevel='low': aura-кольца и сфера как в каталоге.
            Один и тот же уровень при prewarm и reveal — без новой
            компиляции шейдеров и без чёрного кадра.
          */}
          <CatalogSubstanceDisplay
            compound={compound}
            labScaleBoost={CATALOG_HERO_DEFAULT_LAB_SCALE}
            reducedEffects
            labSynthesisScene
            renderQuality="high"
            fxLevel="low"
            chaoticWobble={false}
          />
        </group>
      </group>
    </>
  )
}
