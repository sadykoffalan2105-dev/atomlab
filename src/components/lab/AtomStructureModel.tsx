import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
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

/** Shared GPU resources — не создавать 15× на каждый экземпляр. */
const SHARED_PROT_GEO = new THREE.SphereGeometry(0.024, 8, 8)
const SHARED_ELEC_GEO_STD = new THREE.SphereGeometry(0.036, 8, 8)
const SHARED_ELEC_GEO_EMPH = new THREE.SphereGeometry(0.042, 8, 8)
const SHARED_PROT_MAT = new THREE.MeshStandardMaterial({
  color: PROTON_COLOR,
  emissive: PROTON_COLOR,
  emissiveIntensity: 0.5,
  metalness: 0.12,
  roughness: 0.42,
})
const SHARED_NEUT_MAT = new THREE.MeshStandardMaterial({
  color: NEUTRON_COLOR,
  emissive: NEUTRON_COLOR,
  emissiveIntensity: 0.45,
  metalness: 0.12,
  roughness: 0.42,
})
const SHARED_ELEC_MAT = new THREE.MeshStandardMaterial({
  color: ELECTRON_COLOR,
  emissive: ELECTRON_COLOR,
  emissiveIntensity: 1.65,
  metalness: 0.2,
  roughness: 0.35,
})
const SHARED_ELEC_MAT_EMPH = new THREE.MeshStandardMaterial({
  color: ELECTRON_COLOR,
  emissive: ELECTRON_COLOR,
  emissiveIntensity: 2,
  metalness: 0.2,
  roughness: 0.35,
})

function shellCap(n: number): number {
  return 2 * n * n
}

function bohrShellElectronCounts(z: number): number[] {
  const out: number[] = []
  let rem = Math.max(0, Math.min(MAX_Z, Math.floor(z)))
  for (let shellN = 1; shellN <= 7 && rem > 0; shellN++) {
    const c = shellCap(shellN)
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

export function AtomStructureModel({
  z,
  animate = true,
  localLight = true,
  previewStatic = false,
  previewEmphasis = false,
  previewLite = false,
  hideOrbitRings = false,
  /** Реактор/синтез: крупное ядро, орбиты и электроны как в режиме просмотра атома. */
  synthesisDetail = false,
  /** Пропуск кадров анимации электронов (1 = каждый кадр, 2 = через один). */
  electronFrameSkip = 1,
}: {
  z: number
  animate?: boolean
  localLight?: boolean
  previewStatic?: boolean
  previewEmphasis?: boolean
  /** Плотное превью: электроны крутятся, без локального вращения группы (экономия GPU). */
  previewLite?: boolean
  /** Реактор: только ядро и электроны, без цветных орбитальных колец. */
  hideOrbitRings?: boolean
  synthesisDetail?: boolean
  electronFrameSkip?: number
}) {
  const group = useRef<THREE.Group>(null)
  const protRef = useRef<THREE.InstancedMesh>(null)
  const neutRef = useRef<THREE.InstancedMesh>(null)
  const elecRef = useRef<THREE.InstancedMesh>(null)
  const frameTick = useRef(0)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const zClamped = Math.max(1, Math.min(MAX_Z, Math.floor(z)))
  const lite = synthesisDetail ? zClamped > 54 : previewLite || zClamped > 18
  const showRings = synthesisDetail ? true : !hideOrbitRings
  const shellMul = synthesisDetail ? 1.08 : 1
  const protGeo = SHARED_PROT_GEO
  const elecGeo = previewEmphasis || synthesisDetail ? SHARED_ELEC_GEO_EMPH : SHARED_ELEC_GEO_STD
  const protMat = SHARED_PROT_MAT
  const neutMat = SHARED_NEUT_MAT
  const elecMat = previewEmphasis || synthesisDetail ? SHARED_ELEC_MAT_EMPH : SHARED_ELEC_MAT

  const el = getElementByZ(zClamped)
  const mass = el?.atomicMass ?? zClamped * 2
  const nNeutrons = estimateNeutrons(mass, zClamped)

  const shells = useMemo(() => bohrShellElectronCounts(zClamped), [zClamped])
  const nElec = useMemo(() => totalElectrons(shells), [shells])

  const nucleusRadius = useMemo(() => {
    const n = Math.max(1, nNeutrons)
    const total = zClamped + n
    const cap = synthesisDetail ? 0.145 : 0.12
    const grow = synthesisDetail ? 1.14 : 1
    return Math.min(cap, (0.024 + Math.cbrt(total) * 0.012) * grow)
  }, [zClamped, nNeutrons, synthesisDetail])

  const angles = useRef<number[]>([])
  const orbitOpacity = synthesisDetail ? 0.42 : previewEmphasis ? 0.38 : 0.26
  const torusSegments = lite
    ? 12
    : synthesisDetail
      ? 32
      : previewLite
        ? 24
        : 40

  useLayoutEffect(() => {
    angles.current = Array.from({ length: nElec }, (_, i) => (i / Math.max(1, nElec)) * Math.PI * 2)
  }, [nElec])

  const totalNucleons = zClamped + Math.max(0, nNeutrons)

  const writeElectronMatrices = useCallback(
    (spin: number) => {
      const mesh = elecRef.current
      if (!mesh || nElec === 0) return
      let idx = 0
      shells.forEach((count, shellIdx) => {
        if (count <= 0) return
        const majorR = (0.38 + shellIdx * 0.21) * shellMul
        const eRx = (shellIdx * Math.PI) / 6
        const eRy = (shellIdx * Math.PI) / 5
        const eRz = (shellIdx * Math.PI) / 7
        const speed = 0.65 + shellIdx * 0.12
        for (let i = 0; i < count; i++) {
          angles.current[idx] = (angles.current[idx] ?? 0) + spin * speed
          const phase = (i / count) * Math.PI * 2
          setElectronOnTorusMajorCircle(
            dummy.position,
            majorR,
            angles.current[idx]! + phase,
            eRx,
            eRy,
            eRz,
          )
          dummy.quaternion.identity()
          dummy.scale.setScalar(1)
          dummy.updateMatrix()
          mesh.setMatrixAt(idx, dummy.matrix)
          idx++
        }
      })
      mesh.count = nElec
      mesh.instanceMatrix.needsUpdate = true
    },
    [dummy, nElec, shells, shellMul],
  )

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

  useLayoutEffect(() => {
    if (!previewStatic) return
    writeElectronMatrices(0)
  }, [previewStatic, writeElectronMatrices, nElec])

  useFrame((_, delta) => {
    if (previewStatic) return
    frameTick.current += 1
    const skip = Math.max(1, Math.floor(electronFrameSkip))
    if (frameTick.current % skip !== 0) return

    const spin = animate && !lite
    if (spin && group.current) group.current.rotation.y += delta * 0.09
    writeElectronMatrices(animate ? delta * skip : 0)
  })

  return (
    <group ref={group}>
      <instancedMesh ref={protRef} args={[protGeo, protMat, MAX_Z]} frustumCulled={false} />
      <instancedMesh ref={neutRef} args={[protGeo, neutMat, MAX_NEUTRONS]} frustumCulled={false} />
      {!showRings
        ? null
        : shells.map((count, shellIdx) => {
            if (count <= 0) return null
            const majorR = (0.38 + shellIdx * 0.21) * shellMul
            const col = shellHue(shellIdx)
            const eRx = (shellIdx * Math.PI) / 6
            const eRy = (shellIdx * Math.PI) / 5
            const eRz = (shellIdx * Math.PI) / 7
            return (
              <mesh key={`torus-${shellIdx}`} rotation={[eRx, eRy, eRz]}>
                <torusGeometry args={[majorR, 0.005, 6, torusSegments]} />
                <meshBasicMaterial
                  color={col}
                  transparent
                  opacity={orbitOpacity}
                  depthWrite={false}
                />
              </mesh>
            )
          })}
      <instancedMesh ref={elecRef} args={[elecGeo, elecMat, MAX_Z]} frustumCulled={false} />
      {localLight && (!lite || synthesisDetail) ? (
        <pointLight position={[0, 0, 0]} intensity={synthesisDetail ? 1.35 : 1.05} distance={4.8} color="#7afcff" />
      ) : null}
    </group>
  )
}
