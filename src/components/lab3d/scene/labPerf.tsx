/**
 * Производительность 3D-лаборатории.
 *
 *  • RenderGate — главная причина «зависаний»: при смене опыта появляются новые материалы и свет пламени
 *    (другое число источников света → перекомпиляция ВСЕХ шейдеров сцены). На Windows (ANGLE/D3D11) компиляция
 *    одной программы — сотни мс, вместе — секунды «замёрзшей» страницы. Здесь шейдеры сначала собираются
 *    асинхронно (renderer.compileAsync + KHR_parallel_shader_compile), а кадр не рисуется, пока они не готовы:
 *    на экране остаётся прошлый кадр, интерфейс отвечает. Первая сборка — под заставкой «Загрузка…».
 *  • ContactShadowBake — мягкие контактные тени «запекаются» на несколько кадров после изменений,
 *    а не перерисовывают всю сцену каждый кадр.
 *  • LabPerfProbe — для замеров (…#/vr-lab?debugPerf=1): window.__labPerf.info().
 *  • setLabFrameRenderer — постобработка (EffectComposer) регистрирует свой «нарисовать кадр»; RenderGate остаётся
 *    единственным, кто рисует, и вызывает его вместо gl.render. Две просадки кадров подряд (PerformanceMonitor)
 *    выключают постобработку до конца сессии (useLabFxAllowed).
 */
import { ContactShadows } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useHand } from '../interaction/labHandStore'
import { labXr, useXrPresenting } from '../xr/labXrStore'

/** Кто рисует кадр вместо gl.render (постобработка); null — обычный gl.render(scene, camera). */
type LabFrameRenderer = (dt: number) => void
let frameRenderer: LabFrameRenderer | null = null
export function setLabFrameRenderer(fn: LabFrameRenderer | null): void {
  frameRenderer = fn
}
export const hasLabFrameRenderer = (): boolean => frameRenderer !== null

/** Разрешена ли постобработка: после двух просадок кадров подряд — нет (до конца сессии). */
let fxAllowed = true
let declines = 0
const fxListeners = new Set<() => void>()
export function noteLabPerfDecline(): void {
  // пока собираются шейдеры (заставка, смена опыта) кадры и так редкие — это не просадка
  if (gateBusy) return
  declines += 1
  if (declines >= 2 && fxAllowed) {
    fxAllowed = false
    for (const l of fxListeners) l()
  }
}
export function noteLabPerfIncline(): void {
  declines = 0
}
const subFx = (cb: () => void) => {
  fxListeners.add(cb)
  return () => fxListeners.delete(cb)
}
export const useLabFxAllowed = (): boolean => useSyncExternalStore(subFx, () => fxAllowed, () => fxAllowed)

/** Идёт ли сборка шейдеров (пока да — никакие проходы рендера, включая контактные тени, не запускаются). */
let gateBusy = true
const gateListeners = new Set<() => void>()
function setGateBusy(v: boolean) {
  if (gateBusy === v) return
  gateBusy = v
  for (const l of gateListeners) l()
}
const subGate = (cb: () => void) => {
  gateListeners.add(cb)
  return () => gateListeners.delete(cb)
}
const useGateBusy = () => useSyncExternalStore(subGate, () => gateBusy, () => gateBusy)

/** Предельное время ожидания сборки шейдеров (если драйвер не сообщает о готовности). */
const COMPILE_TIMEOUT_MS = 6000

export function RenderGate({ compileKey, onFirstReady }: { compileKey: string; onFirstReady?: () => void }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const busy = useRef(true)
  const first = useRef(true)
  const readyCb = useRef(onFirstReady)
  readyCb.current = onFirstReady
  useEffect(() => {
    let alive = true
    busy.current = true
    setGateBusy(true)
    let timer = 0
    const done = () => {
      if (!alive || !busy.current) return
      window.clearTimeout(timer)
      busy.current = false
      setGateBusy(false)
      if (first.current) {
        first.current = false
        readyCb.current?.()
      }
    }
    // Дать смонтироваться частям установки (у них свои Suspense), затем собрать шейдеры всей сцены
    const raf = requestAnimationFrame(() => {
      timer = window.setTimeout(done, COMPILE_TIMEOUT_MS)
      try {
        gl.compileAsync(scene, camera).then(done, done)
      } catch {
        done()
      }
    })
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
  }, [compileKey, gl, scene, camera])
  // Приоритет 1: рисуем сами (R3F больше не рисует автоматически) — пропускаем кадры, пока идёт сборка
  useFrame((s, dt) => {
    if (!busy.current) {
      if (frameRenderer) frameRenderer(dt)
      else s.gl.render(s.scene, s.camera)
    }
    else {
      // Кадр не рисуем, но матрицы обновляем — нажатия (raycast) попадают в предметы и во время сборки
      s.scene.updateMatrixWorld()
      s.camera.updateMatrixWorld()
    }
  }, 1)
  return null
}

/** Контактные тени под рабочим местом: перерисовываются 1,5 с после смены опыта/шага/предметов, затем «запечены». */
export function ContactShadowBake({
  bakeKey,
  ...rest
}: { bakeKey: string } & Omit<React.ComponentProps<typeof ContactShadows>, 'frames'>) {
  const zones = useHand().zones
  const [, setNonce] = useState(0)
  useEffect(() => {
    // Повтор через 1,2 с — когда установка уже собралась (части грузятся своими Suspense)
    const t = window.setTimeout(() => setNonce((n) => n + 1), 1200)
    return () => window.clearTimeout(t)
  }, [bakeKey, zones])
  // Каждая перерисовка ContactShadows сбрасывает его счётчик кадров — тени перерисовываются ещё 45 кадров.
  // Не пересоздаём компонент ключом: drei не освобождает буферы при размонтировании (утечка видеопамяти).
  // Пока собираются шейдеры — не рисуем (иначе отдельный проход теней синхронно соберёт программы и «заморозит» кадр)
  const busy = useGateBusy()
  // В VR контактные тени не перерисовываются (каждый проход — ещё один рендер сцены на оба глаза)
  const xr = useXrPresenting()
  const active = (rest.opacity ?? 1) > 0 && !busy && !xr
  return <ContactShadows frames={active ? 45 : 0} {...rest} />
}

const debugPerfOn = () => typeof window !== 'undefined' && /[?&]debugPerf=1/.test(window.location.hash)

export function LabPerfProbe() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  // Замер: счётчики рендера складываются за весь кадр (сцена + постобработка + тени), сбрасываются в начале кадра
  const debug = useRef(debugPerfOn())
  useFrame(() => {
    if (debug.current) gl.info.reset()
  }, -100)
  useEffect(() => {
    if (!debug.current) return
    const prevAutoReset = gl.info.autoReset
    gl.info.autoReset = false
    return () => {
      gl.info.autoReset = prevAutoReset
    }
  }, [gl])
  useEffect(() => {
    if (!debugPerfOn()) return
    const w = window as unknown as {
      __labPerf?: {
        info: () => Record<string, number>
        gl: unknown
        scene: unknown
        programs: () => { name: string; key: string; used: number }[]
        xr: (presenting: boolean) => void
      }
    }
    w.__labPerf = {
      // Для отладки из консоли/скриптов: какие материалы держат какую программу (gl.properties.get(m).programs)
      gl,
      scene,
      // Список собранных программ: тип материала + ключ кеша (по нему видно, какой флаг порождает отдельную программу)
      programs: () =>
        (gl.info.programs ?? []).map((pr) => {
          const x = pr as unknown as { name: string; cacheKey: string; usedTimes: number }
          return { name: x.name, key: x.cacheKey, used: x.usedTimes }
        }),
      info: () => ({
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: gl.info.programs?.length ?? 0,
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        dpr: gl.getPixelRatio(),
        fx: frameRenderer ? 1 : 0,
      }),
      // Проверка без шлема: «как в VR» — постобработка и контактные тени выключаются
      xr: (presenting: boolean) => labXr.set({ presenting }),
    }
    return () => {
      delete w.__labPerf
    }
  }, [gl, scene])
  return null
}
