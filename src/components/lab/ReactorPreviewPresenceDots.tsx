import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ReactorPreviewAtom } from './reactorPreviewLayout'

const geo = new THREE.SphereGeometry(0.22, 12, 10)
const mat = new THREE.MeshStandardMaterial({
  color: '#7afcff',
  emissive: '#3dffec',
  emissiveIntensity: 0.55,
  roughness: 0.35,
  metalness: 0.2,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
})

/**
 * Ultra presence: простые сферы всегда на позициях атомов.
 * Даже если Bohr hitch/remount — точки остаются на экране (K₂Cr₂O₇ rapid +/-).
 */
export function ReactorPreviewPresenceDots({
  atoms,
  visible,
  maxCount = 48,
}: {
  atoms: readonly (ReactorPreviewAtom | null | undefined)[]
  visible: boolean
  maxCount?: number
}) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, mat, maxCount)
    m.frustumCulled = false
    m.count = 0
    m.visible = false
    return m
  }, [maxCount])

  const dummy = useRef(new THREE.Object3D()).current
  const atomsRef = useRef(atoms)
  atomsRef.current = atoms

  useLayoutEffect(() => {
    if (!visible) {
      mesh.count = 0
      mesh.visible = false
      return
    }
    let count = 0
    const list = atomsRef.current
    const n = Math.min(list.length, maxCount)
    for (let i = 0; i < n; i++) {
      const a = list[i]
      if (!a) continue
      dummy.position.set(a.pos[0], a.pos[1], a.pos[2])
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      mesh.setMatrixAt(count, dummy.matrix)
      count += 1
    }
    mesh.count = count
    mesh.visible = count > 0
    if (count > 0) mesh.instanceMatrix.needsUpdate = true
  }, [visible, atoms, maxCount, mesh, dummy])

  return <primitive object={mesh} />
}
