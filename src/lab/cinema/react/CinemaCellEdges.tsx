import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { EdgePool } from '../scenes/kit/lattice'

/**
 * Рёбра элементарных ячеек кристалла — отдельный слой тонких линий, один draw call.
 *
 * Это НЕ связи: цвет нейтральный (без CPK), линия тонкая и полупрозрачная, чтобы каркас ячейки
 * читался на тёмной сцене (решение 7: сцена тёмная в обеих темах приложения) и не спорил с ионами.
 * depthWrite выключен — рёбра не вырезают атомы; depthTest включён — атомы перекрывают рёбра.
 *
 * Прогрев: слой всегда visible=true; пустой пул = drawRange 0 (ноль отрисовки, программа уже
 * скомпилирована прогревом сцены). Буфер перечитывается только при смене pool.version / count,
 * прозрачность — uniform материала, в кадре без аллокаций.
 */

/** Светлый нейтральный холодно-серый: читается на тёмном фоне сцены и не совпадает ни с одним цветом CPK. */
export const CELL_EDGE_COLOR = 0xa9b8cc

/** Предел непрозрачности слоя: рёбра ячейки обязаны читаться (приёмка NaCl: при 0,55 их было почти не видно). */
export const CELL_EDGE_MAX_OPACITY = 0.82

type EdgeGpu = {
  geo: THREE.BufferGeometry
  attr: THREE.BufferAttribute
  mat: THREE.LineBasicMaterial
  lastVersion: number
  lastCount: number
}

function createEdgeGpu(capacity: number, color: number): EdgeGpu {
  const geo = new THREE.BufferGeometry()
  const attr = new THREE.BufferAttribute(new Float32Array(Math.max(1, capacity) * 6), 3).setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('position', attr)
  geo.setDrawRange(0, 0)
  // Рамка заранее неизвестна: без bounding sphere three отсечёт слой по пустой геометрии.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4)
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })
  return { geo, attr, mat, lastVersion: -1, lastCount: -1 }
}

/** Кадр слоя: перечитать отрезки при смене версии, выставить drawRange и прозрачность. Без аллокаций. */
function syncEdgeGpu(gpu: EdgeGpu, pool: EdgePool): void {
  if (pool.version !== gpu.lastVersion || pool.count !== gpu.lastCount) {
    gpu.lastVersion = pool.version
    gpu.lastCount = pool.count
    ;(gpu.attr.array as Float32Array).set(pool.seg.subarray(0, pool.count * 6))
    gpu.attr.clearUpdateRanges()
    gpu.attr.addUpdateRange(0, pool.count * 6)
    gpu.attr.needsUpdate = true
  }
  const on = pool.count > 0 && pool.amount > 0.002
  gpu.geo.setDrawRange(0, on ? pool.count * 2 : 0)
  gpu.mat.opacity = on ? pool.amount * CELL_EDGE_MAX_OPACITY : 0
}

function disposeEdgeGpu(gpu: EdgeGpu): void {
  gpu.geo.dispose()
  gpu.mat.dispose()
}

export function CinemaCellEdges({
  pool,
  color = CELL_EDGE_COLOR,
  renderOrder = 0,
}: {
  pool: EdgePool
  color?: number
  renderOrder?: number
}) {
  const gpu = useMemo(() => createEdgeGpu(pool.capacity, color), [pool.capacity, color])
  useEffect(() => () => disposeEdgeGpu(gpu), [gpu])
  useFrame(() => syncEdgeGpu(gpu, pool))
  return <lineSegments geometry={gpu.geo} material={gpu.mat} renderOrder={renderOrder} frustumCulled={false} />
}
