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
 */
import { ContactShadows } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useHand } from '../interaction/labHandStore'

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
  useFrame((s) => {
    if (!busy.current) s.gl.render(s.scene, s.camera)
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
  const active = (rest.opacity ?? 1) > 0 && !busy
  return <ContactShadows frames={active ? 45 : 0} {...rest} />
}

export function LabPerfProbe() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    if (typeof window === 'undefined' || !/[?&]debugPerf=1/.test(window.location.hash)) return
    const w = window as unknown as { __labPerf?: { info: () => Record<string, number> } }
    w.__labPerf = {
      info: () => ({
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: gl.info.programs?.length ?? 0,
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        dpr: gl.getPixelRatio(),
      }),
    }
    return () => {
      delete w.__labPerf
    }
  }, [gl])
  return null
}
