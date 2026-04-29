import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getElementByZ, estimateNeutrons } from '../../data/elements'

const PROTON_COLOR = new THREE.Color('#ff5a6a')
const NEUTRON_COLOR = new THREE.Color('#6bcfff')
const ELECTRON_COLOR = new THREE.Color('#3dffec')

const MAX_Z = 118
const MAX_NEUTRONS = 220

const _v = new THREE.Vector3()
const _euler = new THREE.Euler()

function shellCap(n: number): number {
  return 2 * n * n
}

function bohrShellElectronCounts(z: number): number[] {
  const out: number[] = []
  let rem = Math.max(0, Math.min(MAX_Z, Math.floor(z)))
  for (let n = 1; n <= 7 && rem > 0; n++) {
    const c = shellCap(n)
    const t = Math.min(rem, c)
    out.push(t)
    rem -= t
  }
  return out
}

function totalElectrons(shells: readonly number[]): number {
  return shells.reduce((a, b) => a + b, 0)
}

function nucleonOnSphere(i: number, total: number, radius: number, phase: number, target: THREE.Vector3): void {
  if (total <= 0) {
    target.set(0, 0, 0)
    return
  }
  const g = Math.PI * (3 - Math.sqrt(5))
  const y = total === 1 ? 0 : 1 - (i / (total - 1)) * 2
  const rr = Math.sqrt(Math.max(0, 1 - y * y))
  const t = g * i + phase
  target.set(Math.cos(t) * rr * radius, y * radius, Math.sin(t) * rr * radius)
}

function setElectronOnTorusMajorCircle(
  target: THREE.Vector3,
  majorR: number,
  angle: number,
  torusEulerX: number,
  torusEulerY: number,
  torusEulerZ: number,
): void {
  _euler.set(torusEulerX, torusEulerY, torusEulerZ)
  _v.set(majorR * Math.cos(angle), majorR * Math.sin(angle), 0)
  _v.applyEuler(_euler)
  target.copy(_v)
}

function shellHue(shellIndex: number): THREE.Color {
  const c = new THREE.Color()
  c.setHSL((0.52 + shellIndex * 0.09) % 1, 0.65, 0.55)
  return c
}

export function AtomStructureModel({ z, animate = true }: { z: number; animate?: boolean }) {
  const group = useRef<THREE.Group>(null)
  const protRef = useRef<THREE.InstancedMesh>(null)
  const neutRef = useRef<THREE.InstancedMesh>(null)
  const elecRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const protGeo = useMemo(() => new THREE.SphereGeometry(0.024, 8, 8), [])
  const elecGeo = useMemo(() => new THREE.SphereGeometry(0.036, 8, 8), [])
  const protMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PROTON_COLOR,
        emissive: PROTON_COLOR,
        emissiveIntensity: 0.5,
        metalness: 0.12,
        roughness: 0.42,
      }),
    [],
  )
  const neutMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: NEUTRON_COLOR,
        emissive: NEUTRON_COLOR,
        emissiveIntensity: 0.45,
        metalness: 0.12,
        roughness: 0.42,
      }),
    [],
  )
  const elecMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: ELECTRON_COLOR,
        emissive: ELECTRON_COLOR,
        emissiveIntensity: 1.65,
        metalness: 0.2,
        roughness: 0.35,
      }),
    [],
  )

  const zClamped = Math.max(1, Math.min(MAX_Z, Math.floor(z)))
  const el = getElementByZ(zClamped)
  const mass = el?.atomicMass ?? zClamped * 2
  const nNeutrons = estimateNeutrons(mass, zClamped)

  const shells = useMemo(() => bohrShellElectronCounts(zClamped), [zClamped])
  const nElec = useMemo(() => totalElectrons(shells), [shells])

  /** Один компактный шар: все нуклоны делят общую плотную упаковку (как единое ядро). */
  const nucleusRadius = useMemo(() => {
    const n = Math.max(1, nNeutrons)
    const total = zClamped + n
    return Math.min(0.12, 0.024 + Math.cbrt(total) * 0.012)
  }, [zClamped, nNeutrons])

  const angles = useRef<number[]>([])
  useEffect(() => {
    angles.current = Array.from({ length: nElec }, (_, i) => (i / Math.max(1, nElec)) * Math.PI * 2)
  }, [nElec])

  const totalNucleons = zClamped + Math.max(0, nNeutrons)

  useLayoutEffect(() => {
    const mesh = protRef.current
    if (!mesh) return
    mesh.count = zClamped
    const total = Math.max(1, totalNucleons)
    const phase = 0.12
    for (let i = 0; i < zClamped; i++) {
      nucleonOnSphere(i, total, nucleusRadius, phase, dummy.position)
      dummy.scale.setScalar(1)
      dummy.quaternion.identity()
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [zClamped, nucleusRadius, dummy, totalNucleons])

  useLayoutEffect(() => {
    const mesh = neutRef.current
    if (!mesh) return
    mesh.count = Math.max(0, nNeutrons)
    const total = Math.max(1, totalNucleons)
    const phase = 0.12
    for (let i = 0; i < nNeutrons; i++) {
      nucleonOnSphere(zClamped + i, total, nucleusRadius, phase, dummy.position)
      dummy.scale.setScalar(1)
      dummy.quaternion.identity()
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [nNeutrons, nucleusRadius, zClamped, dummy, totalNucleons])

  useFrame((_, delta) => {
    if (!animate) return
    if (group.current) group.current.rotation.y += delta * 0.09
    const mesh = elecRef.current
    if (!mesh || nElec === 0) return
    let idx = 0
    shells.forEach((count, shellIdx) => {
      if (count <= 0) return
      const majorR = 0.38 + shellIdx * 0.21
      const eRx = (shellIdx * Math.PI) / 6
      const eRy = (shellIdx * Math.PI) / 5
      const eRz = (shellIdx * Math.PI) / 7
      const speed = 0.65 + shellIdx * 0.12
      for (let i = 0; i < count; i++) {
        angles.current[idx] += delta * speed
        const phase = (i / count) * Math.PI * 2
        setElectronOnTorusMajorCircle(dummy.position, majorR, angles.current[idx] + phase, eRx, eRy, eRz)
        dummy.quaternion.identity()
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        mesh.setMatrixAt(idx, dummy.matrix)
        idx++
      }
    })
    mesh.count = nElec
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group ref={group}>
      <instancedMesh ref={protRef} args={[protGeo, protMat, MAX_Z]} frustumCulled={false} />
      <instancedMesh ref={neutRef} args={[protGeo, neutMat, MAX_NEUTRONS]} frustumCulled={false} />
      {shells.map((count, shellIdx) => {
        if (count <= 0) return null
        const majorR = 0.38 + shellIdx * 0.21
        const col = shellHue(shellIdx)
        const eRx = (shellIdx * Math.PI) / 6
        const eRy = (shellIdx * Math.PI) / 5
        const eRz = (shellIdx * Math.PI) / 7
        return (
          <mesh key={`torus-${shellIdx}`} rotation={[eRx, eRy, eRz]}>
            <torusGeometry args={[majorR, 0.005, 6, 48]} />
            <meshBasicMaterial color={col} transparent opacity={0.22} />
          </mesh>
        )
      })}
      <instancedMesh ref={elecRef} args={[elecGeo, elecMat, MAX_Z]} frustumCulled={false} />
      <pointLight position={[0, 0, 0]} intensity={1.05} distance={4.2} color="#7afcff" />
    </group>
  )
}
