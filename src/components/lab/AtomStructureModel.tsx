import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getElementByZ, estimateNeutrons } from '../../data/elements'
import { AtomElementNebula } from './atom/AtomElementNebula'
import { AtomOrbitRings } from './atom/AtomOrbitRings'
import {
  ATOM_ELECTRON_COLOR,
  ATOM_ELECTRON_HALO,
  ATOM_NEUTRON_COLOR,
  ATOM_PROTON_COLOR,
  orbitAspect,
  setElectronOnEllipse,
  shellMajorRadius,
  shellOrbitEuler,
} from './atom/atomCosmicShared'

const MAX_Z = 118
const MAX_NEUTRONS = 220

const SHARED_ELEC_HALO_GEO = new THREE.SphereGeometry(0.055, 10, 10)

function createNucleonMaterials(cosmic: boolean) {
  return {
    prot: new THREE.MeshStandardMaterial({
      color: ATOM_PROTON_COLOR,
      emissive: ATOM_PROTON_COLOR,
      emissiveIntensity: cosmic ? 0.62 : 0.4,
      metalness: 0.1,
      roughness: cosmic ? 0.48 : 0.6,
    }),
    neut: new THREE.MeshStandardMaterial({
      color: ATOM_NEUTRON_COLOR,
      emissive: ATOM_NEUTRON_COLOR,
      emissiveIntensity: cosmic ? 0.45 : 0.25,
      metalness: 0.1,
      roughness: cosmic ? 0.52 : 0.64,
    }),
  }
}

function nucleonSphereRadius(cosmic: boolean, total: number): number {
  if (!cosmic) return 0.022
  if (total <= 14) return 0.044
  if (total <= 36) return 0.038
  if (total <= 70) return 0.031
  return 0.026
}

const SHARED_ELEC_GEO_STD = new THREE.SphereGeometry(0.028, 12, 12)
const SHARED_ELEC_GEO_EMPH = new THREE.SphereGeometry(0.036, 14, 14)

const SHARED_ELEC_MAT = new THREE.MeshStandardMaterial({
  color: ATOM_ELECTRON_COLOR,
  emissive: ATOM_ELECTRON_COLOR,
  emissiveIntensity: 3.2,
  metalness: 0.1,
  roughness: 0.2,
})
const SHARED_ELEC_MAT_EMPH = new THREE.MeshStandardMaterial({
  color: ATOM_ELECTRON_COLOR,
  emissive: ATOM_ELECTRON_COLOR,
  emissiveIntensity: 4,
  metalness: 0.1,
  roughness: 0.16,
})
const SHARED_ELEC_HALO_MAT = new THREE.MeshBasicMaterial({
  color: ATOM_ELECTRON_HALO,
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
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

export function AtomStructureModel({
  z,
  animate = true,
  localLight = true,
  previewStatic = false,
  previewEmphasis = false,
  previewLite = false,
  hideOrbitRings = false,
  synthesisDetail = false,
  electronFrameSkip = 1,
  accentHex,
  cosmicStyle = true,
}: {
  z: number
  animate?: boolean
  localLight?: boolean
  previewStatic?: boolean
  previewEmphasis?: boolean
  previewLite?: boolean
  hideOrbitRings?: boolean
  synthesisDetail?: boolean
  electronFrameSkip?: number
  accentHex?: string
  cosmicStyle?: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const protRef = useRef<THREE.InstancedMesh>(null)
  const neutRef = useRef<THREE.InstancedMesh>(null)
  const elecRef = useRef<THREE.InstancedMesh>(null)
  const elecGlowRef = useRef<THREE.InstancedMesh>(null)
  const frameTick = useRef(0)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const zClamped = Math.max(1, Math.min(MAX_Z, Math.floor(z)))
  const lite = synthesisDetail ? zClamped > 54 : previewLite || zClamped > 18
  const showRings = synthesisDetail ? true : !hideOrbitRings
  const shellMul = synthesisDetail ? 1.08 : 1
  const showNebula = cosmicStyle && !hideOrbitRings

  const el = getElementByZ(zClamped)
  const mass = el?.atomicMass ?? zClamped * 2
  const nNeutrons = estimateNeutrons(mass, zClamped)
  const nebulaHex = accentHex ?? (el?.cpkHex ? `#${el.cpkHex}` : '#4488ff')
  const totalNucleons = zClamped + Math.max(0, nNeutrons)

  const nucleonR = useMemo(
    () => nucleonSphereRadius(cosmicStyle, totalNucleons),
    [cosmicStyle, totalNucleons],
  )
  const nucleonGeo = useMemo(
    () => new THREE.SphereGeometry(nucleonR, cosmicStyle ? 14 : 10, cosmicStyle ? 12 : 10),
    [nucleonR, cosmicStyle],
  )
  const nucleonMats = useMemo(() => createNucleonMaterials(cosmicStyle), [cosmicStyle])

  useEffect(() => () => nucleonGeo.dispose(), [nucleonGeo])

  const elecGeo = previewEmphasis || synthesisDetail ? SHARED_ELEC_GEO_EMPH : SHARED_ELEC_GEO_STD
  const elecMat = previewEmphasis || synthesisDetail ? SHARED_ELEC_MAT_EMPH : SHARED_ELEC_MAT
  const showElectronHalos = cosmicStyle && !lite

  const shells = useMemo(() => bohrShellElectronCounts(zClamped), [zClamped])
  const nElec = useMemo(() => totalElectrons(shells), [shells])

  const outerOrbitR = useMemo(() => {
    let max = 0.36
    shells.forEach((count, shellIdx) => {
      if (count > 0) max = Math.max(max, shellMajorRadius(shellIdx, shellMul))
    })
    return max
  }, [shells, shellMul])

  const nucleusRadius = useMemo(() => {
    const total = totalNucleons
    const cap = synthesisDetail ? 0.19 : cosmicStyle ? 0.17 : 0.11
    const base = cosmicStyle ? 0.034 : 0.022
    return Math.min(cap, base + Math.cbrt(Math.max(1, total)) * (cosmicStyle ? 0.018 : 0.01))
  }, [totalNucleons, synthesisDetail, cosmicStyle])

  const angles = useRef<number[]>([])

  useLayoutEffect(() => {
    angles.current = Array.from({ length: nElec }, (_, i) => (i / Math.max(1, nElec)) * Math.PI * 2)
  }, [nElec])

  const writeElectronMatrices = useCallback(
    (spin: number) => {
      const mesh = elecRef.current
      const glow = elecGlowRef.current
      if (!mesh || nElec === 0) return
      let idx = 0
      shells.forEach((count, shellIdx) => {
        if (count <= 0) return
        const majorR = shellMajorRadius(shellIdx, shellMul)
        const aspect = orbitAspect(shellIdx)
        const [eRx, eRy, eRz] = shellOrbitEuler(shellIdx)
        const speed = 0.65 + shellIdx * 0.12
        for (let i = 0; i < count; i++) {
          angles.current[idx] = (angles.current[idx] ?? 0) + spin * speed
          const phase = (i / count) * Math.PI * 2
          setElectronOnEllipse(
            dummy.position,
            majorR,
            angles.current[idx]! + phase,
            aspect,
            eRx,
            eRy,
            eRz,
          )
          dummy.quaternion.identity()
          dummy.scale.setScalar(1)
          dummy.updateMatrix()
          mesh.setMatrixAt(idx, dummy.matrix)
          if (glow) {
            dummy.scale.setScalar(1.65)
            dummy.updateMatrix()
            glow.setMatrixAt(idx, dummy.matrix)
            dummy.scale.setScalar(1)
          }
          idx++
        }
      })
      mesh.count = nElec
      mesh.instanceMatrix.needsUpdate = true
      if (glow) {
        glow.count = nElec
        glow.instanceMatrix.needsUpdate = true
      }
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
    if (spin && group.current) group.current.rotation.y += delta * 0.055
    writeElectronMatrices(animate ? delta * skip : 0)
  })

  return (
    <group ref={group}>
      {showNebula ? (
        <AtomElementNebula
          accentHex={nebulaHex}
          lite={lite}
          outerOrbitR={outerOrbitR}
        />
      ) : null}

      <group renderOrder={4}>
        <instancedMesh
          key={`prot-${nucleonR}`}
          ref={protRef}
          args={[nucleonGeo, nucleonMats.prot, MAX_Z]}
          frustumCulled={false}
          renderOrder={6}
        />
        <instancedMesh
          key={`neut-${nucleonR}`}
          ref={neutRef}
          args={[nucleonGeo, nucleonMats.neut, MAX_NEUTRONS]}
          frustumCulled={false}
          renderOrder={6}
        />
        {cosmicStyle ? (
          <pointLight position={[0, 0, 0]} intensity={1.1} distance={nucleusRadius * 8} color="#ff7a55" />
        ) : null}
      </group>

      {showRings ? (
        <AtomOrbitRings
          shells={shells}
          shellMul={shellMul}
          lite={lite}
          synthesisDetail={synthesisDetail}
          accentHex={nebulaHex}
        />
      ) : null}

      {showElectronHalos ? (
        <instancedMesh
          ref={elecGlowRef}
          args={[SHARED_ELEC_HALO_GEO, SHARED_ELEC_HALO_MAT, MAX_Z]}
          frustumCulled={false}
          renderOrder={3}
        />
      ) : null}

      <instancedMesh
        ref={elecRef}
        args={[elecGeo, elecMat, MAX_Z]}
        frustumCulled={false}
        renderOrder={5}
      />

      {localLight && (!lite || synthesisDetail) ? (
        <>
          <pointLight
            position={[0, 0, 0]}
            intensity={synthesisDetail ? 1.6 : 1.35}
            distance={outerOrbitR * 3.5}
            color={nebulaHex}
          />
          <pointLight position={[0.6, 0.4, 1]} intensity={0.55} distance={8} color={nebulaHex} />
        </>
      ) : null}
    </group>
  )
}
