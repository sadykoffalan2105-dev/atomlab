/**
 * ATOMLAB Cinema kit — ПРОГРЕВ ШЕЙДЕРОВ ДО ПЕРВОГО ШАГА.
 *
 * Длинный кадр посреди урока почти всегда — синхронная компиляция программы
 * в кадре, где слой впервые стал видимым (первая связь, первый электрон,
 * первая вспышка). Поэтому:
 *   1. все слои SceneShell смонтированы с visible = true, а «пусто» выражено
 *      нулём отрисовки (instanceCount 0 / drawRange 0 / схлопнутый спрайт);
 *   2. после монтирования один раз зовётся gl.compileAsync(rig, camera, scene):
 *      three отдаёт программы драйверу и ждёт их готовности через
 *      KHR_parallel_shader_compile, не блокируя кадры;
 *   3. только после этого SceneShell запускает шаг 0 (whenReady).
 *
 * Почему не lab/gpuCompileChunked.compileObjectTreeChunked: он зовёт
 * gl.compile по мешам СИНХРОННО (по 3 за кадр) и обходит только isMesh —
 * точки-электроны (THREE.Points) пропустил бы. compileAsync обходит все
 * видимые объекты рига, включая Points и батчи three.quarks.
 *
 * Страховка: если compileAsync нет или он висит — через timeoutMs урок всё
 * равно стартует (лаборатория не должна зависнуть из-за прогрева).
 */
import { useEffect, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import { useSceneRuntime } from './sceneKit'

export type SceneWarmup = {
  /** true — программы рига готовы (или сработала страховка по времени) */
  done: boolean
  /** Вызвать cb, когда прогрев закончится (сразу, если уже). Возвращает отмену. */
  whenReady: (cb: () => void) => () => void
}

type WarmupRuntime = SceneWarmup & { waiters: Set<() => void>; started: boolean }

function createWarmupRuntime(): WarmupRuntime {
  const rt: WarmupRuntime = {
    done: false,
    started: false,
    waiters: new Set(),
    whenReady(cb) {
      if (rt.done) {
        cb()
        return () => {}
      }
      rt.waiters.add(cb)
      return () => {
        rt.waiters.delete(cb)
      }
    },
  }
  return rt
}

function finishWarmup(rt: WarmupRuntime): void {
  if (rt.done) return
  rt.done = true
  const list = [...rt.waiters]
  rt.waiters.clear()
  for (const cb of list) cb()
}

/** Страховка по умолчанию, мс: дольше урок не ждёт. */
export const SCENE_WARMUP_TIMEOUT_MS = 1500

/**
 * Прогреть программы всех объектов под rootRef (обычно группа рига сцены).
 * enabled = false — прогрев пропускается, whenReady срабатывает сразу.
 */
export function useSceneWarmup(
  rootRef: RefObject<THREE.Object3D | null>,
  opts?: { enabled?: boolean; timeoutMs?: number },
): SceneWarmup {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const rt = useSceneRuntime(createWarmupRuntime)
  const enabled = opts?.enabled ?? true
  const timeoutMs = opts?.timeoutMs ?? SCENE_WARMUP_TIMEOUT_MS

  useEffect(() => {
    if (rt.done) return
    if (!enabled) {
      finishWarmup(rt)
      return
    }
    let cancelled = false
    // Кадр ожидания: дети смонтированы, матрицы и материалы рига собраны.
    const raf = requestAnimationFrame(() => {
      if (cancelled || rt.done) return
      const root = rootRef.current
      const compileAsync = gl.compileAsync?.bind(gl)
      if (!root || !compileAsync) {
        finishWarmup(rt)
        return
      }
      rt.started = true
      compileAsync(root, camera, scene)
        .catch(() => undefined)
        .then(() => {
          if (!cancelled) finishWarmup(rt)
        })
    })
    const timer = window.setTimeout(() => {
      if (!cancelled) finishWarmup(rt)
    }, timeoutMs)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
  }, [rt, enabled, timeoutMs, gl, camera, scene, rootRef])

  return rt
}
