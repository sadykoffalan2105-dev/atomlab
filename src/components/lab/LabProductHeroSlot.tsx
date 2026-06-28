import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { gsap } from 'gsap'
import type * as THREE from 'three'
import { LAUNCH_PRODUCT_ENTRANCE_DUR } from '../../lab/synthesisLaunchTiming'
import { scheduleIdleMatch } from '../../lab/labRenderGuards'
import { compileObjectTreeChunked } from '../../lab/gpuCompileChunked'
import { getSynthesisDeviceTier } from '../../lab/synthesisDeviceTier'
import {
  scheduleGpuCompileWatchdog,
  SYNTH_ANTI_STALL,
} from '../../lab/synthesisAntiStall'
import {
  isProductGpuCompiled,
  markProductGpuCompiled,
} from '../../lab/productGpuCompileCache'
import type { CompoundDef } from '../../types/chemistry'
import { CatalogSubstanceDisplay } from './CatalogSubstanceDisplay'
import { CATALOG_HERO_DEFAULT_LAB_SCALE } from './catalogMoleculeHeroShared'

const MICRO_SCALE = 0.001
/** Кадров отрисовки на micro-scale до «готово» — даже на слабых GPU. */
const PREWARM_PAINT_FRAMES = SYNTH_ANTI_STALL.gpuCompileFallbackFrames

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
  onProductVisiblePaint,
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
  /** Меш на полном масштабе отрисован ≥1 кадр — можно скрыть превью атомов. */
  onProductVisiblePaint?: () => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const spinRef = useRef<THREE.Group>(null)
  const revealedForRunRef = useRef(-1)
  const wasPrewarmRef = useRef(false)
  const compileGenRef = useRef(0)
  const gpuCompiledRef = useRef(false)
  const prewarmPaintFramesRef = useRef(0)
  const visiblePaintSentRef = useRef(false)
  const { gl, camera, scene, invalidate } = useThree()

  const notifyGpuCompiled = useCallback(() => {
    if (gpuCompiledRef.current) return
    gpuCompiledRef.current = true
    markProductGpuCompiled(compound.id)
    onGpuCompiled?.(compound.id)
  }, [compound.id, onGpuCompiled])

  useEffect(() => {
    gpuCompiledRef.current = isProductGpuCompiled(compound.id)
    prewarmPaintFramesRef.current = 0
    visiblePaintSentRef.current = false
    compileGenRef.current += 1
  }, [compound.id])

  // Cold-start: compileAsync на micro-scale в idle — не блокируем кадр атомов.
  useEffect(() => {
    if (visible) return
    if (!prewarm) return
    if (isProductGpuCompiled(compound.id)) {
      notifyGpuCompiled()
      return
    }

    let cancelled = false
    const gen = compileGenRef.current
    const clearGpuWatch = scheduleGpuCompileWatchdog(() => {
      if (!cancelled && gen === compileGenRef.current) notifyGpuCompiled()
    })

    const runCompile = () => {
      if (cancelled || gen !== compileGenRef.current) return
      const root = groupRef.current
      if (!root) {
        requestAnimationFrame(runCompile)
        return
      }

      // Не масштабируем до 1 — иначе flash и hitch на слабых GPU.
      root.scale.set(MICRO_SCALE, MICRO_SCALE, MICRO_SCALE)
      invalidate()

      requestAnimationFrame(() => {
        if (cancelled || gen !== compileGenRef.current) return
        const target = groupRef.current
        if (!target) return

        cancelChunk = compileObjectTreeChunked(
          gl,
          target,
          camera,
          scene,
          invalidate,
          () => {
            if (cancelled || gen !== compileGenRef.current) return
            prewarmPaintFramesRef.current = 0
            invalidate()
            notifyGpuCompiled()
          },
          { skipCompileAsync: getSynthesisDeviceTier() === 'low' },
        )
      })
    }

    let cancelChunk: (() => void) | undefined

    const boot = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scheduleIdleMatch(() => {
          if (!cancelled) runCompile()
        })
      })
    })

    return () => {
      cancelled = true
      clearGpuWatch()
      cancelAnimationFrame(boot)
      cancelChunk?.()
    }
  }, [prewarm, visible, compound.id, gl, camera, scene, invalidate, notifyGpuCompiled])

  // Считаем реально отрисованные кадры prewarm, затем «готово».
  useFrame(() => {
    if (!prewarm || visible || gpuCompiledRef.current) {
      if (visible && !visiblePaintSentRef.current) {
        const g = groupRef.current
        if (g && g.scale.x >= 0.86) {
          visiblePaintSentRef.current = true
          onProductVisiblePaint?.()
        }
      }
      return
    }
    invalidate()
    if (isProductGpuCompiled(compound.id)) return
    prewarmPaintFramesRef.current += 1
    if (prewarmPaintFramesRef.current >= PREWARM_PAINT_FRAMES) {
      notifyGpuCompiled()
    }
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
      visiblePaintSentRef.current = true
      onProductVisiblePaint?.()
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
      visiblePaintSentRef.current = true
      onProductVisiblePaint?.()
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
      const tl = gsap.timeline({
        onComplete: () => {
          if (visiblePaintSentRef.current) return
          visiblePaintSentRef.current = true
          onProductVisiblePaint?.()
        },
      })
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
      onComplete: () => {
        if (visiblePaintSentRef.current) return
        visiblePaintSentRef.current = true
        onProductVisiblePaint?.()
      },
    })
    return () => {
      t.kill()
    }
  }, [visible, prewarm, entrance, compound.id, runId, birthEntrance, entranceDuration, onProductVisiblePaint])

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
            renderQuality="high"
            fxLevel="low"
            chaoticWobble={false}
          />
        </group>
      </group>
    </>
  )
}
