import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import type { BondPool } from '../core/pools'
import { createBondBandResources, disposeBondBandResources, updateBondBands, type BondBandResources } from '../core/bondBandShader'

/**
 * Все связи сцены одним draw call — замена россыпи CinemaBond.
 *
 * Сцена пишет состояние в BondPool (и увеличивает version), компонент раз в
 * кадр заливает в GPU только занятый диапазон [0, count) и только при смене
 * версии; время пунктира и мерцания берётся из `time.current` (время сюжета,
 * а не clock.elapsedTime — на паузе и при заморозке кадр неподвижен).
 * Язык полос, прозрачность и раскладка буфера описаны в core/bondBandShader.ts.
 */

export type InstancedBondsProps = {
  pool: BondPool
  /** время сцены в секундах (обычно время сюжета) */
  time: { current: number }
  renderOrder?: number
  /** облегчённо: 6 сегментов, плоские импосторы полос, без блика и мерцания */
  lite?: boolean
}

/**
 * Меш всегда visible: пустой пул = instanceCount 0 (three пропускает draw call),
 * а программа компилируется на прогреве урока (compileAsync видит только
 * видимые объекты), а не в кадре появления первой связи.
 */
function syncInstancedBonds(
  res: BondBandResources,
  pool: BondPool,
  timeSec: number,
  camera: THREE.Camera,
  heightPx: number,
): void {
  updateBondBands(res, pool, timeSec, camera, heightPx)
}

export function InstancedBonds({ pool, time, renderOrder = 1, lite = false }: InstancedBondsProps) {
  const mesh = useRef<THREE.Mesh>(null)
  const res = useMemo(() => createBondBandResources(pool.capacity, lite), [pool.capacity, lite])

  useEffect(() => {
    return () => {
      disposeBondBandResources(res)
    }
  }, [res])

  useFrame((state) => {
    syncInstancedBonds(res, pool, time.current, state.camera, state.size.height * state.viewport.dpr)
  })

  return (
    <mesh
      ref={mesh}
      geometry={res.geometry}
      material={res.material}
      renderOrder={renderOrder}
      frustumCulled={false}
      dispose={null}
    />
  )
}
