import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getElementByZ } from '../../data/elements'
import type { ReactorPreviewAtom } from './reactorPreviewLayout'
import { PREVIEW_ATOM_SCALE } from './reactorPreviewLayout'

const NUCLEUS_GEO = new THREE.SphereGeometry(0.055, 10, 10)
const ELECTRON_GEO = new THREE.SphereGeometry(0.022, 6, 6)
const ORBIT_R = 0.11
const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3(PREVIEW_ATOM_SCALE, PREVIEW_ATOM_SCALE, PREVIEW_ATOM_SCALE)
const _color = new THREE.Color()

type ZBatch = {
  z: number
  indices: number[]
  mesh: THREE.InstancedMesh
  elecMesh: THREE.InstancedMesh
  color: THREE.Color
}

function makeNucleusMaterial(color: THREE.Color): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.55,
    metalness: 0.12,
    roughness: 0.48,
  })
}

function makeElectronMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })
}

/**
 * Instanced atom renderer — constant scale, coeff → instance count.
 * Proxy groups (atomGroupRefs) drive GSAP flight; visuals sync in useFrame.
 */
export function ReactorInstancedAtoms({
  atoms,
  visible = true,
  scale = PREVIEW_ATOM_SCALE,
  electronAnimate = true,
  electronFrameSkip = 1,
  flightActive = false,
  poseLocked = false,
  atomGroupRefs,
  atomScaleGroupRefs,
}: {
  atoms: readonly ReactorPreviewAtom[]
  visible?: boolean
  scale?: number
  electronAnimate?: boolean
  electronFrameSkip?: number
  flightActive?: boolean
  poseLocked?: boolean
  atomGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  atomScaleGroupRefs: MutableRefObject<(THREE.Group | null)[]>
}) {
  const rootRef = useRef<THREE.Group>(null)
  const batchesRef = useRef<ZBatch[]>([])
  const frameTick = useRef(0)
  const n = atoms.length
  _s.set(scale, scale, scale)

  const zGroups = useMemo(() => {
    const map = new Map<number, number[]>()
    atoms.forEach((a, i) => {
      const list = map.get(a.z) ?? []
      list.push(i)
      map.set(a.z, list)
    })
    return map
  }, [atoms])

  useLayoutEffect(() => {
    batchesRef.current = []
  }, [zGroups])

  useLayoutEffect(() => {
    while (atomGroupRefs.current.length < n) atomGroupRefs.current.push(null)
    while (atomScaleGroupRefs.current.length < n) atomScaleGroupRefs.current.push(null)
    atomGroupRefs.current.length = n
    atomScaleGroupRefs.current.length = n
  }, [n, atomGroupRefs, atomScaleGroupRefs])

  useLayoutEffect(() => {
    if (flightActive || poseLocked) return
    for (let i = 0; i < n; i++) {
      const g = atomGroupRefs.current[i]
      const sc = atomScaleGroupRefs.current[i]
      const [x, y, z] = atoms[i]!.pos
      if (g) g.position.set(x, y, z)
      if (sc) sc.scale.set(scale, scale, scale)
    }
  }, [atoms, n, scale, flightActive, poseLocked, atomGroupRefs, atomScaleGroupRefs])

  useFrame((state) => {
    if (!visible || n === 0) return
    frameTick.current += 1
    const t = state.clock.elapsedTime
    const skip = Math.max(1, electronFrameSkip)
    const animateElec = electronAnimate && frameTick.current % skip === 0

    for (const batch of batchesRef.current) {
      const { mesh, elecMesh, indices } = batch
      indices.forEach((atomIdx, instIdx) => {
        const g = atomGroupRefs.current[atomIdx]
        const sc = atomScaleGroupRefs.current[atomIdx]
        if (!g) return
        _p.copy(g.position)
        if (sc) _s.set(sc.scale.x, sc.scale.y, sc.scale.z)
        else _s.set(scale, scale, scale)
        _q.identity()
        _m.compose(_p, _q, _s)
        mesh.setMatrixAt(instIdx, _m)

        if (animateElec) {
          const ph = atomIdx * 1.7 + batch.z * 0.31
          const ex = _p.x + Math.cos(t * 1.8 + ph) * ORBIT_R * _s.x
          const ey = _p.y + Math.sin(t * 2.1 + ph * 0.8) * ORBIT_R * 0.35 * _s.y
          const ez = _p.z + Math.sin(t * 1.6 + ph) * ORBIT_R * _s.z
          _p.set(ex, ey, ez)
          _s.set(0.35 * scale, 0.35 * scale, 0.35 * scale)
          _m.compose(_p, _q, _s)
          elecMesh.setMatrixAt(instIdx, _m)
        }
      })
      mesh.instanceMatrix.needsUpdate = true
      if (animateElec) elecMesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group ref={rootRef} visible={visible} frustumCulled={false}>
      {[...zGroups.entries()].map(([z, indices]) => (
        <InstancedZBatch
          key={z}
          z={z}
          indices={indices}
          batchesRef={batchesRef}
        />
      ))}
      {atoms.map((atom, i) => {
        const [ax, ay, az] = atom.pos
        return (
          <group
            key={`proxy-${atom.z}-${atom.termIndex}-${atom.atomInTerm}-${i}`}
            ref={(el) => {
              atomGroupRefs.current[i] = el
              if (el && !flightActive && !poseLocked) el.position.set(ax, ay, az)
            }}
          >
            <group
              ref={(el) => {
                atomScaleGroupRefs.current[i] = el
                if (el && !flightActive && !poseLocked) el.scale.set(scale, scale, scale)
              }}
            />
          </group>
        )
      })}
    </group>
  )
}

function InstancedZBatch({
  z,
  indices,
  batchesRef,
}: {
  z: number
  indices: number[]
  batchesRef: MutableRefObject<ZBatch[]>
}) {
  const el = getElementByZ(z)
  const hex = el?.cpkHex ?? '8899aa'
  const color = useMemo(() => {
    _color.set(`#${hex}`)
    return _color.clone()
  }, [hex])

  const protMat = useMemo(() => makeNucleusMaterial(color), [color])
  const elecMat = useMemo(() => makeElectronMaterial(), [])

  useEffect(() => {
    return () => {
      protMat.dispose()
      elecMat.dispose()
    }
  }, [protMat, elecMat])

  return (
    <>
      <instancedMesh
        ref={(mesh) => {
          if (!mesh) return
          const existing = batchesRef.current.find((b) => b.z === z)
          if (existing) {
            existing.mesh = mesh
            existing.indices = indices
          } else {
            batchesRef.current.push({
              z,
              indices,
              mesh,
              elecMesh: null!,
              color,
            })
          }
        }}
        args={[NUCLEUS_GEO, protMat, indices.length]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={(mesh) => {
          if (!mesh) return
          const batch = batchesRef.current.find((b) => b.z === z)
          if (batch) batch.elecMesh = mesh
        }}
        args={[ELECTRON_GEO, elecMat, indices.length]}
        frustumCulled={false}
      />
    </>
  )
}
