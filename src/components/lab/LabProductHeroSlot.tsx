import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { gsap } from 'gsap'
import type * as THREE from 'three'
import { LAUNCH_PRODUCT_ENTRANCE_DUR } from '../../lab/synthesisLaunchTiming'
import { compileObjectTreeChunked } from '../../lab/gpuCompileChunked'
import {
  scheduleGpuCompileWatchdog,
} from '../../lab/synthesisAntiStall'
import {
  isProductGpuCompiled,
  markProductGpuCompiled,
} from '../../lab/productGpuCompileCache'
import { enqueueGpuCompile } from '../../lab/gpuCompileBudget'
import type { CompoundDef } from '../../types/chemistry'
import { CatalogSubstanceDisplay } from './CatalogSubstanceDisplay'
import { CATALOG_HERO_DEFAULT_LAB_SCALE } from './catalogMoleculeHeroShared'
import { getLowPowerDeviceProfile } from '../../lab/lowPowerDeviceProfile'
import { getSynthesisDeviceTier } from '../../lab/synthesisDeviceTier'
import { resolveVisiblePaintFrames } from '../../lab/synthesisStabilityEngine'

const MICRO_SCALE = 0.001
/** Видимый «зародыш» молекулы внутри glow до GSAP-рождения. */
const EMBRYO_SCALE = 0.2

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
  /** Внешний ref на корень — LabScene forceProductFullScale. */
  rootGroupRef,
  /** Рождение из круга: молекула поверх glow (иначе спрятана под вспышкой). */
  emergeFromGlow = false,
  /** Маленькая видимая молекула уже внутри круга (до birthEntrance). */
  embryoInGlow = false,
}: {
  compound: CompoundDef
  visible: boolean
  prewarm?: boolean
  entrance?: 'smooth' | 'instant' | 'none'
  runId?: number
  birthEntrance?: boolean
  entranceDuration?: number
  shaderCompileAsync?: boolean
  onGpuCompiled?: (compoundId: string) => void
  onProductVisiblePaint?: () => void
  rootGroupRef?: MutableRefObject<THREE.Group | null>
  emergeFromGlow?: boolean
  embryoInGlow?: boolean
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
  const lastCompoundIdRef = useRef(compound.id)
  const lastPositiveRunIdRef = useRef(0)
  const { gl, camera, scene, invalidate } = useThree()
  const lowPower = useMemo(
    () => getLowPowerDeviceProfile(getSynthesisDeviceTier()).forceLiteReactor,
    [],
  )

  /** Локальный ready (можно reveal) — без записи в session cache. */
  const notifyGpuCompiledLocal = useCallback(() => {
    if (gpuCompiledRef.current) return
    gpuCompiledRef.current = true
    onGpuCompiled?.(compound.id)
  }, [compound.id, onGpuCompiled])

  /** Полный compile / visible paint — пишем session cache. */
  const notifyGpuCompiledPersisted = useCallback(() => {
    gpuCompiledRef.current = true
    markProductGpuCompiled(compound.id)
    onGpuCompiled?.(compound.id)
  }, [compound.id, onGpuCompiled])

  useEffect(() => {
    const compoundChanged = lastCompoundIdRef.current !== compound.id
    lastCompoundIdRef.current = compound.id
    const prevPositiveRun = lastPositiveRunIdRef.current
    if (runId > 0) lastPositiveRunIdRef.current = runId

    // Settle: runId → 0. НЕ сбрасываем paint/compile — иначе пустой центр после «3D показан».
    if (!compoundChanged && runId <= 0 && visiblePaintSentRef.current) {
      return
    }
    // Тот же positive run повторно — no-op.
    if (
      !compoundChanged &&
      runId > 0 &&
      runId === prevPositiveRun &&
      visiblePaintSentRef.current
    ) {
      return
    }

    gpuCompiledRef.current = isProductGpuCompiled(compound.id)
    prewarmPaintFramesRef.current = 0
    visiblePaintFramesRef.current = 0
    visiblePaintSentRef.current = false
    compileGenRef.current += 1
  }, [compound.id, runId])

  // Sync external root ref every commit.
  useLayoutEffect(() => {
    if (!rootGroupRef) return
    rootGroupRef.current = groupRef.current
    return () => {
      if (rootGroupRef.current === groupRef.current) rootGroupRef.current = null
    }
  })

  // Cold-start: compileAsync на micro-scale в idle — не блокируем кадр атомов.
  useEffect(() => {
    if (visible) return
    if (!prewarm) return
    if (isProductGpuCompiled(compound.id)) {
      notifyGpuCompiledLocal()
      return
    }

    let cancelled = false
    const gen = compileGenRef.current
    const compilePriority: 0 | 1 = visible ? 1 : 0
    // Watchdog idle: не пишем session cache — только local, чтобы не открыть слот раньше compile.
    const clearGpuWatch = scheduleGpuCompileWatchdog(() => {
      if (!cancelled && gen === compileGenRef.current) notifyGpuCompiledLocal()
    }, 2_800)

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
            // Реальный chunked compile закончен — можно кэшировать (иначе K₂Cr₂O₇ каждый Run cold).
            notifyGpuCompiledPersisted()
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

    return () => {
      cancelled = true
      clearGpuWatch()
      cancelAnimationFrame(boot)
      cancelBudget?.()
      cancelChunk?.()
    }
  }, [
    prewarm,
    visible,
    compound.id,
    runId,
    gl,
    camera,
    scene,
    invalidate,
    notifyGpuCompiledLocal,
    notifyGpuCompiledPersisted,
    shaderCompileAsync,
  ])

  // Синтез: видимый продукт — приоритетный compile, БЕЗ snap scale=1 (убивает birth + hitch).
  useEffect(() => {
    if (!visible || prewarm) return
    if (isProductGpuCompiled(compound.id)) {
      notifyGpuCompiledLocal()
      return
    }

    let cancelled = false
    const gen = compileGenRef.current
    // Не форсим «ready» watchdog'ом во время visible — иначе первый кадр = sync shader hitch 3–5с.
    const clearGpuWatch = scheduleGpuCompileWatchdog(() => {
      if (cancelled || gen !== compileGenRef.current) return
      // Только local hint для UI; session cache — после реального chunked onDone.
      if (!gpuCompiledRef.current) notifyGpuCompiledLocal()
    }, 2_400)

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
      // Сохраняем текущий scale (embryo/birth) — не дёргаем в 1.
      invalidate()
      const softChunk = birthEntrance || embryoInGlow || entrance === 'smooth'
      cancelChunk = compileObjectTreeChunked(
        gl,
        root,
        camera,
        scene,
        invalidate,
        () => {
          if (cancelled || gen !== compileGenRef.current) return
          notifyGpuCompiledPersisted()
          releaseBudget?.()
          releaseBudget = null
        },
        {
          skipCompileAsync: true,
          // Меньше мешей/кадр = нет 4–5с freeze на K₂Cr₂O₇ и др. тяжёлых молекулах.
          meshesPerFrame: softChunk ? 2 : 4,
        },
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
  }, [
    visible,
    prewarm,
    compound.id,
    runId,
    gl,
    camera,
    scene,
    invalidate,
    notifyGpuCompiledLocal,
    notifyGpuCompiledPersisted,
    birthEntrance,
    embryoInGlow,
    entrance,
  ])

  // Переход prewarm → visible: full-scale только без birth/smooth (иначе убиваем «рождение»).
  useLayoutEffect(() => {
    if (!visible || prewarm) return
    if (birthEntrance || entrance === 'smooth') {
      if (gpuCompiledRef.current || isProductGpuCompiled(compound.id)) {
        gpuCompiledRef.current = true
      }
      invalidate()
      return
    }
    const g = groupRef.current
    if (!g) return
    g.scale.set(1, 1, 1)
    wasPrewarmRef.current = false
    if (gpuCompiledRef.current || isProductGpuCompiled(compound.id)) {
      gpuCompiledRef.current = true
    }
    invalidate()
    // Не вызываем onProductVisiblePaint из layout — иначе Bohr гасится до первого кадра молекулы.
  }, [visible, prewarm, compound.id, invalidate, birthEntrance, entrance])

  // Считаем реально отрисованные кадры visible → paint. Micro-prewarm НЕ пишет GPU-cache.
  useFrame((state) => {
    if (visible && !prewarm && !visiblePaintSentRef.current) {
      const g = groupRef.current
      if (g) {
        // Birth/smooth: ждём scale ≥ 0.86 от GSAP — не snap к 1 (убивает «рождение из круга»).
        if (g.scale.x < 0.86) {
          if (birthEntrance || entrance === 'smooth') return
          g.scale.set(1, 1, 1)
        }
        const ctx = state.gl.getContext() as WebGLRenderingContext | null
        const bufOk =
          !!ctx &&
          ctx.drawingBufferWidth > 0 &&
          ctx.drawingBufferHeight > 0 &&
          !ctx.isContextLost()
        if (!bufOk) {
          visiblePaintFramesRef.current = 0
          return
        }
        visiblePaintFramesRef.current += 1
        const gpuOk = gpuCompiledRef.current || isProductGpuCompiled(compound.id)
        const paintNeed = resolveVisiblePaintFrames(gpuOk, lowPower)
        if (visiblePaintFramesRef.current >= paintNeed) {
          visiblePaintSentRef.current = true
          gpuCompiledRef.current = true
          markProductGpuCompiled(compound.id)
          onGpuCompiled?.(compound.id)
          onProductVisiblePaint?.()
        }
      }
    } else if (prewarm && !visible && !gpuCompiledRef.current) {
      // Micro-prewarm: только держим кадр. НЕ markProductGpuCompiled по frame-count.
      invalidate()
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

    /** Уже внутри круга: видимый зародыш, без GSAP-pop. */
    if (embryoInGlow && visible && !birthEntrance) {
      wasPrewarmRef.current = true
      gsap.killTweensOf(g.scale)
      if (spin) gsap.killTweensOf(spin.rotation)
      const cur = g.scale.x
      if (cur < EMBRYO_SCALE * 0.85 || cur > EMBRYO_SCALE * 1.25) {
        g.scale.set(EMBRYO_SCALE, EMBRYO_SCALE, EMBRYO_SCALE)
      }
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
      // Продолжаем из зародыша внутри круга — не сбрасываем в 0.001 (иначе «круг → пусто → молекула»).
      const startScale =
        g.scale.x >= EMBRYO_SCALE * 0.45
          ? g.scale.x
          : fromPrewarm || birthEntrance
            ? EMBRYO_SCALE * 0.85
            : MICRO_SCALE
      g.scale.set(startScale, startScale, startScale)
      if (spin && spin.rotation.y === 0) spin.rotation.set(0, 0, 0)
      const tl = gsap.timeline({
        onUpdate: () => invalidate(),
      })
      const mid = Math.max(0.38, Math.min(0.55, startScale + 0.22))
      tl.to(
        g.scale,
        { x: mid, y: mid, z: mid, duration: dur * 0.2, ease: 'power2.out' },
        0,
      )
      tl.to(
        g.scale,
        { x: 1.1, y: 1.1, z: 1.1, duration: dur * 0.5, ease: 'power3.out' },
      )
      tl.to(g.scale, { x: 1, y: 1, z: 1, duration: dur * 0.3, ease: 'power2.inOut' })
      if (spin && birthEntrance) {
        tl.to(
          spin.rotation,
          { y: Math.PI * 0.55, duration: dur, ease: 'power2.out' },
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
      // Paint только из useFrame после живого drawing buffer.
    })
    return () => {
      t.kill()
    }
  }, [
    visible,
    prewarm,
    entrance,
    compound.id,
    runId,
    birthEntrance,
    entranceDuration,
    embryoInGlow,
    onProductVisiblePaint,
    invalidate,
  ])

  /** Локальный свет отключён: LabReactorLights уже освещает сцену — иначе вспышка на старте синтеза. */
  const showLocalLights = false

  return (
    <>
      {showLocalLights ? (
        <>
          <ambientLight intensity={0.34} />
          <directionalLight
            position={[3.2, 5.5, 2.5]}
            intensity={0.68}
            color="#b8c8ff"
          />
        </>
      ) : null}
      <group
        ref={groupRef}
        position={[0, 0, 0]}
        visible
        frustumCulled={false}
        // Поверх glow/ring (35–42), чтобы молекула «выходила» из круга, а не пряталась под ним.
        renderOrder={emergeFromGlow ? 55 : 8}
      >
        <group ref={spinRef}>
          <CatalogSubstanceDisplay
            compound={compound}
            labScaleBoost={CATALOG_HERO_DEFAULT_LAB_SCALE}
            reducedEffects
            labSynthesisScene
            renderQuality="synthesis"
            fxLevel="low"
            chaoticWobble={false}
            // Атмосфера: при birth; зародыш без шара — круг даёт свечение.
            showAtmosphere={visible && !prewarm && !embryoInGlow}
          />
        </group>
      </group>
    </>
  )
}
