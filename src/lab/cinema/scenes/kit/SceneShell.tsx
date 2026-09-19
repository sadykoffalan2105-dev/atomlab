import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { createCueRunner, type CueRunner } from '../../core/cues'
import { resolveCinemaQuality, type CinemaQuality } from '../../core/quality'
import { applyCameraToRig } from '../../core/safeArea'
import { createSteppedStoryClock } from '../../core/steppedStoryClock'
import type { StoryClock } from '../../core/storyClock'
import { CinemaDomLabels } from '../../react/CinemaDomLabels'
import { CinemaFlash, CinemaHalo, CinemaShockwave } from '../../react/CinemaFx'
import { CinemaGlowPoints, type GlowPointsHandle } from '../../react/CinemaGlowPoints'
import { CinemaPostFx } from '../../react/CinemaPostFx'
import { CinemaPuffVolume } from '../../react/CinemaPuffVolume'
import { CinemaCameraRig, CinemaEnvironment } from '../../react/CinemaStage'
import { setCinemaTimeFrozen, useCinemaTime } from '../../react/CinemaTime'
import { CinemaBurst, CinemaVfxStage, type VfxHandle, type VfxPreset } from '../../react/CinemaVfx'
import { InstancedAtoms } from '../../react/InstancedAtoms'
import { InstancedBonds } from '../../react/InstancedBonds'
import { isPerfProbeEnabled } from '../../../perf/labPerfProbe'
import { cinemaPlayhead, clo2StepStore, type CinemaLessonId, type Clo2StepStatus } from '../clo2/clo2StepStore'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import {
  createSceneCamera,
  useSceneRuntime,
  type SceneCamera,
  type SceneLabelState,
  type SceneTiming,
  type SceneWorld,
} from './sceneKit'

export type { SceneCamera } from './sceneKit'

/**
 * ATOMLAB Cinema kit — ОБОЛОЧКА СЦЕНЫ.
 *
 * Берёт на себя всё, что одинаково у каждого научного урока:
 *   • часы по шагам (пауза на границе шага, «повторить шаг», «доиграть»);
 *   • мост к панели урока (clo2StepStore: playStep / replayStep / finish);
 *   • одноразовые события и КОНТРАКТ ЛАБОРАТОРИИ: cue 'embryo' → onEmbryoReady,
 *     'birth' → onBirthReady, 'complete' → onComplete. Без них лаборатория
 *     зависнет, ожидая продукт, поэтому defineSceneTiming().validate() их требует;
 *   • качество (lowPower → lite), prefers-reduced-motion (тряска камеры гасится);
 *   • рендер общего слоя: фон, пост-обработка, риг камеры, объёмное свечение,
 *     инстансные атомы и связи, ореолы, волны, точки-электроны, DOM-подписи, VFX.
 *
 * Сцене остаётся ОДНА функция кадра: посчитать раскадровку и записать пулы.
 */

export type SceneFrameCtx = {
  /** время СЮЖЕТА, секунды */
  t: number
  /** визуальное время («жизнь» кадра): дыхание атомов, бег плазмы */
  elapsed: number
  reducedMotion: boolean
  quality: CinemaQuality
  /** пул светящихся точек: begin() → push() … → end(); null, пока не смонтирован */
  points: GlowPointsHandle | null
  /** бёрст частиц по id из `bursts` */
  vfx: (id: string) => VfxHandle | null
  /** камера кадра: сцена пишет сюда, оболочка применяет к ригу с учётом safe area */
  camera: SceneCamera
}

export type SceneBurstSpec = { id: string; preset: VfxPreset; sizeScale?: number }

/** Колбэки лаборатории, которые оболочка дёргает по cue (держим в рефе — зовём из useFrame). */
type LabCallbacks = Pick<
  ScientificSynthesisFxProps,
  'onNarrationCue' | 'onEmbryoReady' | 'onBirthReady' | 'onComplete'
>

type SceneFrameDeps<CueId extends string> = {
  world: SceneWorld
  ctx: SceneFrameCtx
  camera: SceneCamera
  clockRef: { current: StoryClock }
  cuesRef: { current: CueRunner<CueId> }
  cbRef: { current: LabCallbacks }
  time: { current: { visual: number; reducedMotion: boolean } }
  pointsRef: { current: GlowPointsHandle | null }
  runId: number
  onFrame: (ctx: SceneFrameCtx) => void
  onCue?: (id: CueId, ctx: SceneFrameCtx) => void
}

type SceneFrameView = { canvas: HTMLCanvasElement; camera: THREE.Camera; width: number; height: number }

/**
 * ОДИН кадр урока. Порядок важен:
 *   1. забрать время сюжета из часов по шагам и визуальное время из CinemaTime;
 *   2. опубликовать playhead для виджетов вне Canvas (панель энергии читает его в своём rAF);
 *   3. выстрелить накопившиеся cue — СНАЧАЛА контракт лаборатории (embryo → birth →
 *      complete), иначе лаборатория зависнет в ожидании продукта, потом реакция сцены;
 *   4. дать сцене посчитать раскадровку и записать пулы (единственная её работа);
 *   5. применить камеру к ригу с учётом свободной области и отдать пост-обработке.
 *
 * Аллокаций здесь нет: ctx, camera и мир созданы один раз в useMemo.
 */
function runSceneFrame<CueId extends string>(d: SceneFrameDeps<CueId>, view: SceneFrameView): void {
  const { world, ctx, camera, clockRef, cuesRef, cbRef, time, pointsRef, runId, onFrame, onCue } = d
  const clock = clockRef.current
  const ts = time.current

  ctx.t = clock.t
  ctx.elapsed = ts.visual
  ctx.reducedMotion = ts.reducedMotion
  ctx.points = pointsRef.current
  world.visualTime.current = ts.visual

  cinemaPlayhead.t = clock.t
  cinemaPlayhead.runId = runId

  cuesRef.current.update(clock.t, (id) => {
    const cb = cbRef.current
    if (id === 'embryo') cb.onEmbryoReady?.()
    else if (id === 'birth') cb.onBirthReady?.()
    else if (id === 'complete') cb.onComplete?.()
    else cb.onNarrationCue?.(id)
    onCue?.(id, ctx)
  })

  onFrame(ctx)

  // prefers-reduced-motion: тряску гасим почти полностью, но кадр остаётся живым.
  if (ctx.reducedMotion) camera.shake *= 0.12
  applyCameraToRig(world.rig, world.safe, camera, view)

  const post = world.post.current
  post.bloom = camera.bloom
  post.vignette = camera.vignette
}

export type SceneShellProps<StepId extends string, CueId extends string> = Pick<
  ScientificSynthesisFxProps,
  'runId' | 'lowPower' | 'onNarrationCue' | 'onEmbryoReady' | 'onBirthReady' | 'onComplete'
> & {
  /** id урока для панели механизма (см. scenes/lessons.ts) */
  lesson: CinemaLessonId
  timing: SceneTiming<StepId, CueId>
  world: SceneWorld
  /** подписи, привязанные к 3D (их позиции пишет сцена в onFrame) */
  labels: readonly SceneLabelState[]
  /** кадр сцены: посчитать раскадровку, записать пулы и камеру */
  onFrame: (ctx: SceneFrameCtx) => void
  /** реакция на одноразовое событие (искра, вспышка); embryo/birth/complete оболочка обрабатывает сама */
  onCue?: (id: CueId, ctx: SceneFrameCtx) => void
  /** проверка раскадровки — зовётся один раз в dev */
  validate?: () => void
  /** масштаб рига камеры (крупный план — больше 1) */
  rigScale?: number
  background?: string
  /** ёмкость пула светящихся точек */
  glowPointsCapacity?: number
  bursts?: readonly SceneBurstSpec[]
  /** радиус жгута связи и рёбер решётки — сцена может переопределить */
  bondLite?: boolean
  /** префикс окна отладки: window.__<debugName>Freeze(t) */
  debugName?: string
  /** дополнительные узлы R3F внутри рига камеры */
  children?: ReactNode
}

export function SceneShell<StepId extends string, CueId extends string>({
  lesson,
  timing,
  world,
  labels,
  onFrame,
  onCue,
  validate,
  runId = 0,
  lowPower = false,
  onNarrationCue,
  onEmbryoReady,
  onBirthReady,
  onComplete,
  rigScale = 1.15,
  background = '#070a1a',
  glowPointsCapacity = 160,
  bursts = [],
  debugName = 'scene',
  children,
}: SceneShellProps<StepId, CueId>) {
  const quality = useMemo(() => resolveCinemaQuality(lowPower), [lowPower])
  const lite = quality.tier === 'lite'

  useEffect(() => {
    if (import.meta.env.DEV) {
      timing.validate()
      validate?.()
    }
  }, [timing, validate])

  const cbRef = useRef({ onNarrationCue, onEmbryoReady, onBirthReady, onComplete })
  useEffect(() => {
    // Колбэки лаборатории зовутся из useFrame — держим свежие в рефе.
    cbRef.current = { onNarrationCue, onEmbryoReady, onBirthReady, onComplete }
  }, [onNarrationCue, onEmbryoReady, onBirthReady, onComplete])

  const clockRef = useRef<StoryClock>({ t: 0, progress: 0, rate: 1, finished: false })
  const cuesRef = useRef<CueRunner<CueId>>(createCueRunner(timing.cues))

  // ——— Часы по шагам + мост к панели урока ———
  useEffect(() => {
    const clock = createSteppedStoryClock(timing.segments)
    const cues = createCueRunner(timing.cues)
    clockRef.current = clock.state
    cuesRef.current = cues
    const steps = timing.steps
    const lastIndex = steps.length - 1
    let current = 0

    const report = (index: number, status: Clo2StepStatus) => {
      current = index
      clo2StepStore.report(runId, index, status)
    }

    /** Перемотка: события после точки перемотки должны выстрелить снова. */
    const seek = (t: number) => {
      clock.seekTo(t)
      cues.seek(t)
    }

    const playStep = (index: number) => {
      const i = Math.max(0, Math.min(lastIndex, index))
      const step = steps[i]!
      const t = clock.state.t
      if (t < step.from - 1e-3 || t >= step.to - 1e-3) seek(step.from)
      report(i, 'playing')
      clock.playTo(step.to, () => report(i, 'paused'))
    }

    const replayStep = () => {
      const step = steps[current]!
      seek(step.from)
      report(current, 'playing')
      clock.playTo(step.to, () => report(current, 'paused'))
    }

    const finish = () => {
      const lastTo = steps[lastIndex]!.to
      if (clock.state.t < lastTo - 1e-3) seek(lastTo)
      report(lastIndex, 'finishing')
      clock.playTo(timing.end, () => report(lastIndex, 'done'))
    }

    clo2StepStore.attach(runId, { playStep, replayStep, finish }, lesson, steps.length)
    playStep(0)

    if (isPerfProbeEnabled()) {
      // Отладка кадра: window.__naclFreeze(9.3) — встать на момент сюжета без анимации.
      const key = `__${debugName}Freeze`
      ;(window as unknown as Record<string, (t: number) => void>)[key] = (t: number) => {
        clock.pause()
        clockRef.current = { t, progress: t / timing.end, rate: 0, finished: false }
        setCinemaTimeFrozen(true, t)
      }
    }

    return () => {
      clock.kill()
      clo2StepStore.detach(runId)
      setCinemaTimeFrozen(false)
    }
  }, [runId, lesson, timing, debugName])

  const time = useCinemaTime()
  const pointsRef = useRef<GlowPointsHandle>(null)
  // По одному ref на бёрст, создаются один раз (useSceneRuntime = ленивый useState):
  // useRef здесь не годится — .current нельзя читать в рендере, а ref нужен в JSX.
  const burstRefs = useSceneRuntime(() => {
    const map: Record<string, RefObject<VfxHandle | null>> = {}
    for (const b of bursts) map[b.id] = { current: null }
    return map
  })

  const camera = useMemo(() => createSceneCamera(), [])
  const ctx = useMemo<SceneFrameCtx>(
    () => ({
      t: 0,
      elapsed: 0,
      reducedMotion: false,
      quality,
      points: null,
      vfx: (id: string) => burstRefs[id]?.current ?? null,
      camera,
    }),
    [quality, camera, burstRefs],
  )

  useFrame((state) => {
    runSceneFrame(
      { world, ctx, camera, clockRef, cuesRef, cbRef, time, pointsRef, runId, onFrame, onCue },
      { canvas: state.gl.domElement, camera: state.camera, width: state.size.width, height: state.size.height },
    )
  }, -1)

  return (
    <>
      <CinemaEnvironment dust={quality.dust} background={background} fogNear={8} fogFar={24} />
      {quality.post ? <CinemaPostFx director={world.post} lite={lite} toneMapping="neutral" /> : null}

      <CinemaCameraRig state={world.rig} baseScale={rigScale}>
        {/* Тёплое объёмное свечение выделяющейся энергии. */}
        <CinemaPuffVolume state={world.puff} count={quality.gasPuffs} size={1.6} seed={21} renderOrder={-5} />

        <InstancedBonds pool={world.bonds} time={world.visualTime} lite={lite} renderOrder={1} />
        <InstancedAtoms pool={world.atoms} mode={quality.impostorAtoms ? 'impostor' : 'mesh'} renderOrder={2} />

        {world.glowSpecs.map((g) =>
          g.kind === 'flash' ? (
            <CinemaFlash key={g.id} stateRef={world.glowRefs[g.id]!} color={g.color} />
          ) : (
            <CinemaHalo key={g.id} stateRef={world.glowRefs[g.id]!} color={g.color} radius={g.radius ?? 0.6} />
          ),
        )}
        {Object.entries(world.waves).map(([id, w]) => (
          <CinemaShockwave key={id} state={w} />
        ))}

        {/* Электроны, следы, оболочки и линии поля — один draw call. */}
        <CinemaGlowPoints ref={pointsRef} capacity={glowPointsCapacity} renderOrder={10} />

        <CinemaDomLabels labels={labels} />

        {quality.vfx && bursts.length > 0 ? (
          <CinemaVfxStage>
            {bursts.map((b) => (
              <CinemaBurst
                key={b.id}
                ref={burstRefs[b.id]!}
                preset={b.preset}
                scale={quality.vfxScale}
                sizeScale={b.sizeScale ?? 1}
              />
            ))}
          </CinemaVfxStage>
        ) : null}

        {children}
      </CinemaCameraRig>
    </>
  )
}
