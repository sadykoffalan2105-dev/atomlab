import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  ATOM_INSTANCE_STRIDE,
  ATOM_NEIGHBOR_STRIDE,
  createAtomMaterial,
  createIcosphereInstancedGeometry,
  createImpostorQuadGeometry,
  packAtomInstances,
  syncAtomMaterialViewport,
  type AtomRenderMode,
} from '../core/atomImpostorShader'
import type { AtomPool } from '../core/pools'

/**
 * Все атомы пула — один draw call.
 *
 * Сцена пишет состояние в AtomPool (позиции, радиусы, цвет, заряд…), компонент
 * раз в кадр упаковывает первые pool.count слотов в один interleaved-буфер и
 * заливает на GPU только использованный диапазон. React в кадре не участвует.
 *
 *   mode="impostor" — cinematic: идеальные сферы любого масштаба, корректная
 *                     глубина (пересекаются со связями и друг с другом), AA силуэта;
 *   mode="mesh"     — lite: икосфера detail 2, без discard и gl_FragDepth.
 *
 * Режим и наличие contact — часть ключа шейдера: фиксируйте их на весь урок.
 * Непрозрачность < 1: impostor — screen-door (порядок не важен, сортировки нет,
 * виден мелкий узор), mesh — атом сжимается и темнеет до исчезновения.
 * Заливка пропускается, если pool.version и pool.count не изменились —
 * писатель пула обязан увеличивать version (и при смене contact.neighbors тоже).
 */

export type InstancedAtomsContact = {
  /** 4 × vec4 на атом (16 float): xyz — вектор к центру соседа, w — его радиус; нули — нет соседа */
  neighbors: Float32Array
}

export type InstancedAtomsProps = {
  pool: AtomPool
  mode: AtomRenderMode
  renderOrder?: number
  contact?: InstancedAtomsContact
}

type AtomBatch = {
  geometry: THREE.InstancedBufferGeometry
  data: Float32Array
  instances: THREE.InstancedInterleavedBuffer
  neighbors: THREE.InstancedInterleavedBuffer | null
  lastPool: AtomPool | null
  lastVersion: number
  lastCount: number
}

function createAtomBatch(capacity: number, mode: AtomRenderMode, neighbors: Float32Array | null): AtomBatch {
  const geometry = mode === 'impostor' ? createImpostorQuadGeometry() : createIcosphereInstancedGeometry()
  const cap = Math.max(1, capacity)
  const data = new Float32Array(cap * ATOM_INSTANCE_STRIDE)
  const instances = new THREE.InstancedInterleavedBuffer(data, ATOM_INSTANCE_STRIDE, 1)
  instances.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('aSphere', new THREE.InterleavedBufferAttribute(instances, 4, 0))
  geometry.setAttribute('aColor', new THREE.InterleavedBufferAttribute(instances, 4, 4))
  geometry.setAttribute('aEnergy', new THREE.InterleavedBufferAttribute(instances, 2, 8))
  let nb: THREE.InstancedInterleavedBuffer | null = null
  if (neighbors) {
    // Буфер соседей — прямо массив писателя, без копии.
    nb = new THREE.InstancedInterleavedBuffer(neighbors, ATOM_NEIGHBOR_STRIDE, 1)
    nb.setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('aNeighbor0', new THREE.InterleavedBufferAttribute(nb, 4, 0))
    geometry.setAttribute('aNeighbor1', new THREE.InterleavedBufferAttribute(nb, 4, 4))
    geometry.setAttribute('aNeighbor2', new THREE.InterleavedBufferAttribute(nb, 4, 8))
    geometry.setAttribute('aNeighbor3', new THREE.InterleavedBufferAttribute(nb, 4, 12))
  }
  geometry.instanceCount = 0
  return { geometry, data, instances, neighbors: nb, lastPool: null, lastVersion: -1, lastCount: -1 }
}

const drawingBufferSize = new THREE.Vector2()

/** Покадровая синхронизация пула с GPU. Без аллокаций. */
function syncAtomBatch(batch: AtomBatch, pool: AtomPool, material: THREE.ShaderMaterial, gl: THREE.WebGLRenderer): void {
  gl.getDrawingBufferSize(drawingBufferSize)
  syncAtomMaterialViewport(material, drawingBufferSize.y)

  const count = Math.max(0, Math.min(pool.count, pool.capacity))
  if (pool === batch.lastPool && pool.version === batch.lastVersion && count === batch.lastCount) return
  batch.lastPool = pool
  batch.lastVersion = pool.version
  batch.lastCount = count

  const n = packAtomInstances(pool, batch.data)
  if (n > 0) {
    batch.instances.clearUpdateRanges()
    batch.instances.addUpdateRange(0, n * ATOM_INSTANCE_STRIDE)
    batch.instances.needsUpdate = true
    const nb = batch.neighbors
    if (nb) {
      const m = Math.min(n, nb.count)
      if (m > 0) {
        nb.clearUpdateRanges()
        nb.addUpdateRange(0, m * ATOM_NEIGHBOR_STRIDE)
        nb.needsUpdate = true
      }
    }
  }
  // instanceCount = 0 → three пропускает draw call, но программа уже скомпилирована
  // (меш остаётся visible — compileAsync на старте урока его видит).
  batch.geometry.instanceCount = n
}

export function InstancedAtoms({ pool, mode, renderOrder = 0, contact }: InstancedAtomsProps) {
  const neighbors = contact?.neighbors ?? null
  const hasContact = neighbors !== null
  const batch = useMemo(() => createAtomBatch(pool.capacity, mode, neighbors), [pool.capacity, mode, neighbors])
  const material = useMemo(() => createAtomMaterial(mode, { contact: hasContact }), [mode, hasContact])

  useEffect(() => {
    return () => {
      batch.geometry.dispose()
    }
  }, [batch])

  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  useFrame((state) => {
    syncAtomBatch(batch, pool, material, state.gl)
  })

  return (
    <mesh
      geometry={batch.geometry}
      material={material}
      renderOrder={renderOrder}
      // Геометрия квада у начала координат ничего не говорит о положении атомов.
      frustumCulled={false}
      dispose={null}
    />
  )
}
