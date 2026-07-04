import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { gsap } from 'gsap'
import type * as THREE from 'three'
import { LAUNCH_PRODUCT_ENTRANCE_DUR } from '../../lab/synthesisLaunchTiming'
import { scheduleIdleMatch } from '../../lab/labRenderGuards'
import { compileObjectTreeChunked } from '../../lab/gpuCompileChunked'
import {
  scheduleGpuCompileWatchdog,
  SYNTH_ANTI_STALL,
} from '../../lab/synthesisAntiStall'
import {
  isProductGpuCompiled,
  markProductGpuCompiled,
} from '../../lab/productGpuCompileCache'
import { enqueueGpuCompile } from '../../lab/gpuCompileBudget'
import type { CompoundDef } from '../../types/chemistry'
import { CatalogSubstanceDisplay } from './CatalogSubstanceDisplay'
import { CATALOG_HERO_DEFAULT_LAB_SCALE } from './catalogMoleculeHeroShared'

const MICRO_SCALE = 0.001
/** Кадров отрисовки на micro-scale до «готово» — даже на слабых GPU. */
const PREWARM_PAINT_FRAMES = SYNTH_ANTI_STALL.gpuCompileFallbackFrames
/** Кадров полного масштаба до сигнала paint — не раньше реального GPU-кадра. */
const VISIBLE_PAINT_FRAMES = 1

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
  /** Idle prewarm: compileAsync шейдеров (убирает cold-start hitch). */
  shaderCompileAsync = false,
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
  shaderCompileAsync?: boolean
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
  const visiblePaintFramesRef = useRef(0)
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
    visiblePaintFramesRef.current = 0
    visiblePaintSentRef.current = false
    compileGenRef.current += 1
  }, [compound.id, runId])

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
    const compilePriority: 0 | 1 = visible ? 1 : 0
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
            releaseBudget?.()
            releaseBudget = null
          },
          { skipCompileAsync: !shaderCompileAsync, meshesPerFrame: shaderCompileAsync ? 2 : 1 },
        )
      })
    }

    let cancelChunk: (() => void) | undefined
    let cancelBudget: (() => void) | undefined
    let releaseBudget: (() => void) | null = null

    const boot = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scheduleIdleMatch(() => {
          if (cancelled) return
          cancelBudget = enqueueGpuCompile(
            `prewarm:${compound.id}:${runId}`,
            (release) => {
              releaseBudget = release
              runCompile()
              return () => {
                cancelChunk?.()
                releaseBudget?.()
                releaseBudget = null
              }
            },
            compilePriority,
          )
        })
      })
    })

    return () => {
      cancelled = true
      clearGpuWatch()
      cancelAnimationFrame(boot)
      cancelBudget?.()
      cancelChunk?.()
    }
  }, [prewarm, visible, compound.id, gl, camera, scene, invalidate, notifyGpuCompiled, shaderCompileAsync])

  // Синтез: видимый продукт — приоритетный compile сразу (без idle-задержки).
  useEffect(() => {
    if (!visible || prewarm) return
    if (isProductGpuCompiled(compound.id)) {
      notifyGpuCompiled()
      return
    }

    let cancelled = false
    const gen = compileGenRef.current
    const clearGpuWatch = scheduleGpuCompileWatchdog(() => {
      if (!cancelled && gen === compileGenRef.current) notifyGpuCompiled()
    })

    let cancelChunk: (() => void) | undefined
    let cancelBudget: (() => void) | undefined
    let releaseBudget: (() => void) | null = null

    const runCompile = () => {
      if (cancelled || gen !== compileGenRef.current) return
      const root = groupRef.current
      if (!root) {
        requestAnimationFrame(runCompile)
        return
      }
      root.scale.set(1, 1, 1)
      invalidate()
      cancelChunk = compileObjectTreeChunked(
        gl,
        root,
        camera,
        scene,
        invalidate,
        () => {
          if (cancelled || gen !== compileGenRef.current) return
          notifyGpuCompiled()
          releaseBudget?.()
          releaseBudget = null
        },
        { skipCompileAsync: false, meshesPerFrame: 8 },
      )
    }

    cancelBudget = enqueueGpuCompile(
      `visible:${compound.id}:${runId}`,
      (release) => {
        releaseBudget = release
        runCompile()
        return () => {
          cancelChunk?.()
          releaseBudget?.()
          releaseBudget = null
        }
      },
      1,
    )

    return () => {
      cancelled = true
      clearGpuWatch()
      cancelBudget?.()
      cancelChunk?.()
    }
  }, [visible, prewarm, compound.id, runId, gl, camera, scene, invalidate, notifyGpuCompiled])

  // Переход prewarm → visible: масштаб и paint без повторного cold compile.
  useLayoutEffect(() => {
    if (!visible || prewarm) return
    const g = groupRef.current
    if (!g) return
    if (gpuCompiledRef.current || isProductGpuCompiled(compound.id)) {
      gpuCompiledRef.current = true
      g.scale.set(1, 1, 1)
      invalidate()
      if (
        (entrance === 'instant' || entrance === 'none') &&
        !visiblePaintSentRef.current
      ) {
        visiblePaintSentRef.current = true
        onProductVisiblePaint?.()
      }
    }
  }, [visible, prewarm, compound.id, invalidate, entrance, onProductVisiblePaint])

  // Считаем реально отрисованные кадры prewarm / visible, затем «готово».
  useFrame(() => {
    if (visible && !visiblePaintSentRef.current && gpuCompiledRef.current) {
      const g = groupRef.current
      if (g && g.scale.x >= 0.86) {
        visiblePaintFramesRef.current += 1
        if (visiblePaintFramesRef.current >= VISIBLE_PAINT_FRAMES) {
          visiblePaintSentRef.current = true
          onProductVisiblePaint?.()
        }
      }
    }
    if (!prewarm || visible || gpuCompiledRef.current) return
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
