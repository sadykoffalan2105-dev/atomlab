import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { createFrameStats, type LabPerfApi, type LabPerfSnapshot } from '../../lab/perf/labPerfProbe'

type RendererInfoTotals = { calls: number; triangles: number; points: number }

/**
 * Монтируется внутри Canvas, когда включён замер (isPerfProbeEnabled).
 * Кадр считается от useFrame до useFrame; renderer.info копится весь кадр
 * (все проходы композера) и сбрасывается в начале следующего.
 */
export function LabPerfProbe() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const stats = useMemo(() => createFrameStats(), [])
  const totals = useMemo<RendererInfoTotals>(() => ({ calls: 0, triangles: 0, points: 0 }), [])

  useEffect(() => {
    const info = gl.info
    const prevAutoReset = info.autoReset
    info.autoReset = false
    const api: LabPerfApi = {
      snapshot: (): LabPerfSnapshot => ({
        ...stats.summary(),
        calls: totals.calls,
        triangles: totals.triangles,
        points: totals.points,
        programs: info.programs?.length ?? 0,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        dpr,
        width: size.width,
        height: size.height,
      }),
      reset: () => stats.reset(),
      // Только для стендов: разбор, какой слой сколько стоит (скрыть/показать группы объектов).
      scene,
    }
    ;(window as unknown as { __atomlabPerf?: LabPerfApi }).__atomlabPerf = api
    return () => {
      info.autoReset = prevAutoReset
      delete (window as unknown as { __atomlabPerf?: LabPerfApi }).__atomlabPerf
    }
  }, [gl, scene, stats, totals, dpr, size.width, size.height])

  // Самый ранний подписчик кадра: снимаем итог прошлого кадра и обнуляем счётчики.
  useFrame(() => {
    recordFrame(gl, stats, totals)
  }, -1000)

  return null
}

function recordFrame(
  gl: { info: { render: { calls: number; triangles: number; points: number }; reset: () => void } },
  stats: ReturnType<typeof createFrameStats>,
  totals: RendererInfoTotals,
): void {
  stats.tick(performance.now())
  totals.calls = gl.info.render.calls
  totals.triangles = gl.info.render.triangles
  totals.points = gl.info.render.points
  gl.info.reset()
}
