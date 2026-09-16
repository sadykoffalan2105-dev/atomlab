import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { useCinemaActive } from '../../lab/cinemaActive'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getElementByZ, estimateNeutrons } from '../../data/elements'
import { bohrShellCountsFromConfig } from '../../data/elementConfigDisplay'
import { resolveAtomStructurePreviewFlags } from '../../lab/atomStructurePreviewFlags'
import { AtomElementNebula } from './atom/AtomElementNebula'
import { AtomOrbitRings } from './atom/AtomOrbitRings'
import { electronOrbitLanes, electronVisualScale } from './atom/atomOrbitLayout'
import {
  ATOM_ELECTRON_COLOR,
  setElectronOnEllipse,
  shellMajorRadius,
} from './atom/atomCosmicShared'
import {
  NUCLEUS_GLOW_WARM_HEX,
  getNucleonGeometry,
  getNucleonMaterials,
  getNucleusGlowMaterial,
} from './preview/previewSharedResources'

const MAX_Z = 118
const MAX_NEUTRONS = 220

/** Размер спрайта-ореола ядра относительно радиуса кластера нуклонов. */
const NUCLEUS_GLOW_SCALE = 4
/** Ореол, заменяющий пару localLight (центр + заполняющий) — крупнее и с оттенком элемента. */
const LOCAL_GLOW_SCALE_MUL = 1.35

function nucleonSphereRadius(cosmic: boolean, total: number): number {
  if (!cosmic) return 0.022
  if (total <= 14) return 0.044
  if (total <= 36) return 0.038
  if (total <= 70) return 0.031
  return 0.026
}

const SHARED_ELEC_GEO_STD = new THREE.SphereGeometry(0.028, 8, 8)
/** Базовый радиус белой точки в превью. */
const SHARED_ELEC_GEO_EMPH = new THREE.SphereGeometry(0.042, 10, 10)

/** Белые точки без ореола — MeshBasic не раздувается bloom-ом. */
const SHARED_ELEC_MAT = new THREE.MeshBasicMaterial({
  color: ATOM_ELECTRON_COLOR,
  toneMapped: false,
})
const SHARED_ELEC_MAT_EMPH = new THREE.MeshBasicMaterial({
  color: ATOM_ELECTRON_COLOR,
  toneMapped: false,
})

function shellCap(n: number): number {
  return 2 * n * n
}

function resolveShellCounts(z: number, electronConfiguration?: string): number[] {
  const bohr = bohrShellElectronCounts(z)
  if (!electronConfiguration || electronConfiguration === '—') return bohr
  const fromConfig = bohrShellCountsFromConfig(electronConfiguration)
  const configTotal = fromConfig.reduce((a, b) => a + b, 0)
  return configTotal === z && fromConfig.length > 0 ? fromConfig : bohr
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

function AtomStructureModelInner({
  z,
  animate = true,
  localLight = true,
  previewStatic = false,
  previewEmphasis = false,
  previewLite = false,
  hideOrbitRings = false,
  synthesisDetail = false,
  synthesisGlass = false,
  electronFrameSkip = 1,
  accentHex,
  cosmicStyle = true,
  pointLights = !previewLite,
  glassTransmission = false,
}: {
  z: number
  animate?: boolean
  localLight?: boolean
  previewStatic?: boolean
  previewEmphasis?: boolean
  previewLite?: boolean
  hideOrbitRings?: boolean
  synthesisDetail?: boolean
  /** Матовое стекло вокруг атома — кинематографичный синтез. */
  synthesisGlass?: boolean
  electronFrameSkip?: number
  accentHex?: string
  cosmicStyle?: boolean
  /**
   * Настоящие pointLight внутри модели (ядро + localLight). Только для витрины
   * одного атома. В многоатомных сценах (превью реактора, previewLite) — false:
   * число источников света в сцене должно быть постоянным, иначе +/- коэффициента
   * меняет ключ программы каждого освещённого материала и всё перекомпилируется.
   * Свечение тогда даёт emissive нуклонов + общий аддитивный спрайт.
   */
  pointLights?: boolean
  /**
   * Стекло synthesisGlass через transmission (MeshPhysical, лишний проход рендера
   * сцены в текстуру). Только сильный GPU / кинематографичный путь; иначе дешёвое
   * полупрозрачное MeshStandard-стекло.
   */
  glassTransmission?: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const protRef = useRef<THREE.InstancedMesh>(null)
  const neutRef = useRef<THREE.InstancedMesh>(null)
  const elecRef = useRef<THREE.InstancedMesh>(null)
  const frameTick = useRef(0)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const zClamped = Math.max(1, Math.min(MAX_Z, Math.floor(z)))
  const {
    fullPreview,
    lite,
    showRings,
    showNebula,
    effectiveFrameSkip,
  } = resolveAtomStructurePreviewFlags({
    previewEmphasis,
    cosmicStyle,
    synthesisDetail,
    previewLite,
    hideOrbitRings,
    electronFrameSkip,
    z: zClamped,
  })
  const shellMul = synthesisDetail ? 1.08 : fullPreview ? 1.05 : 1

  const el = getElementByZ(zClamped)
  const mass = el?.atomicMass ?? zClamped * 2
  const nNeutronsRaw = estimateNeutrons(mass, zClamped)
  const nNeutrons = nNeutronsRaw
  const nebulaHex = accentHex ?? (el?.cpkHex ? `#${el.cpkHex}` : '#4488ff')
  const totalNucleons = zClamped + Math.max(0, nNeutrons)

  const nucleonR = useMemo(
    () => nucleonSphereRadius(cosmicStyle, totalNucleons),
    [cosmicStyle, totalNucleons],
  )
  const nucleonSeg = cosmicStyle ? 14 : 10
  // Общие геометрия/материалы (preview/previewSharedResources): не пересоздаются на mount слота.
  const nucleonGeo = getNucleonGeometry(nucleonR, nucleonSeg)
  const nucleonMats = getNucleonMaterials(cosmicStyle, !pointLights)

  const elecGeo = previewEmphasis || synthesisDetail ? SHARED_ELEC_GEO_EMPH : SHARED_ELEC_GEO_STD
  const elecMat = previewEmphasis || synthesisDetail ? SHARED_ELEC_MAT_EMPH : SHARED_ELEC_MAT

  const shells = useMemo(
    () => resolveShellCounts(zClamped, el?.electronConfiguration),
    [zClamped, el?.electronConfiguration],
  )
  const nElec = useMemo(() => totalElectrons(shells), [shells])
  /** Кэш lanes: не пересобирать орбиты каждый кадр при быстром +/-. */
  const orbitLanes = useMemo(() => electronOrbitLanes(shells, shellMul), [shells, shellMul])
  const electronScale = useMemo(
    () => electronVisualScale(nElec, previewEmphasis || synthesisDetail),
    [nElec, previewEmphasis, synthesisDetail],
  )

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

  const localLightWanted =
    localLight && (fullPreview || !lite || synthesisDetail || synthesisGlass)

  /**
   * Без pointLights: основной вклад света ядра переносим в emissive нуклонов
   * (getNucleonMaterials glow), а мягкий ореол — аддитивный спрайт с общим материалом.
   * Спрайт = +1 draw call на атом, поэтому в lite (плотное превью, previewLite) его нет.
   * Тёплый (#ff7a55) вместо света ядра; при запрошенном localLight — смесь с цветом
   * элемента и крупнее (заменяет пару точечных источников вокруг атома).
   */
  const glowSprite = useMemo(() => {
    if (pointLights) return null
    if (!localLightWanted && !(cosmicStyle && !lite)) return null
    const clusterR = nucleusRadius + nucleonR
    if (localLightWanted) {
      const tint = new THREE.Color(NUCLEUS_GLOW_WARM_HEX).lerp(new THREE.Color(nebulaHex), 0.5)
      return {
        material: getNucleusGlowMaterial(`#${tint.getHexString()}`, 0.42),
        size: clusterR * NUCLEUS_GLOW_SCALE * LOCAL_GLOW_SCALE_MUL,
      }
    }
    return {
      material: getNucleusGlowMaterial(NUCLEUS_GLOW_WARM_HEX, 0.32),
      size: clusterR * NUCLEUS_GLOW_SCALE,
    }
  }, [pointLights, cosmicStyle, lite, localLightWanted, nucleusRadius, nucleonR, nebulaHex])

  const angles = useRef<number[]>([])

  useLayoutEffect(() => {
    angles.current = Array.from({ length: nElec }, (_, i) => (i / Math.max(1, nElec)) * Math.PI * 2)
  }, [nElec])

  const writeElectronMatrices = useCallback(
    (spin: number) => {
      const mesh = elecRef.current
      if (!mesh || nElec === 0) return
      let idx = 0
      for (const { count, radius, aspect, euler, shellIndex } of orbitLanes) {
        if (count <= 0) continue
        const [eRx, eRy, eRz] = euler
        const speed = 0.58 + shellIndex * 0.11
        for (let i = 0; i < count; i++) {
          const angleIdx = idx
          angles.current[angleIdx] = (angles.current[angleIdx] ?? 0) + spin * speed
          const phase = (i / count) * Math.PI * 2
          setElectronOnEllipse(
            dummy.position,
            radius,
            angles.current[angleIdx]! + phase,
            aspect,
            eRx,
            eRy,
            eRz,
          )
          dummy.quaternion.identity()
          dummy.scale.setScalar(electronScale)
          dummy.updateMatrix()
          mesh.setMatrixAt(angleIdx, dummy.matrix)
          idx++
        }
      }
      mesh.count = nElec
      mesh.instanceMatrix.needsUpdate = true
    },
    [dummy, nElec, orbitLanes, electronScale],
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
  }, [zClamped, nucleusRadius, dummy, totalNucleons, nucleonGeo, nucleonMats])

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
  }, [nNeutrons, nucleusRadius, zClamped, dummy, totalNucleons, nucleonGeo, nucleonMats])

  useLayoutEffect(() => {
    // Всегда сидируем электроны сразу после mount/z-change — иначе 1–3 пустых кадра.
    // elecGeo/elecMat: смена args пересоздаёт instancedMesh — матрицы надо записать заново.
    writeElectronMatrices(0)
  }, [writeElectronMatrices, nElec, zClamped, previewStatic, elecGeo, elecMat])

  useFrame((_, delta) => {
    if (previewStatic) return
    // Скрытые pool-слоты не крутят электроны — главный источник hitch при пуле > n.
    const root = group.current
    if (root && !root.visible) return
    let parent: THREE.Object3D | null = root?.parent ?? null
    while (parent) {
      if (!parent.visible) return
      parent = parent.parent
    }
    frameTick.current += 1
    const skip = Math.max(1, effectiveFrameSkip)
    if (frameTick.current % skip !== 0) return

    const spin = animate && (fullPreview || !lite)
    if (spin && group.current) group.current.rotation.y += delta * 0.055
    writeElectronMatrices(animate ? delta * skip : 0)
  })

  return (
    <group ref={group}>
      {showNebula ? (
        <AtomElementNebula
          accentHex={nebulaHex}
          lite={lite || (fullPreview && zClamped > 54)}
          outerOrbitR={outerOrbitR}
        />
      ) : null}

      <group renderOrder={4}>
        <instancedMesh
          key="prot-core"
          ref={protRef}
          args={[nucleonGeo, nucleonMats.prot, MAX_Z]}
          frustumCulled={false}
          renderOrder={6}
        />
        <instancedMesh
          key="neut-core"
          ref={neutRef}
          args={[nucleonGeo, nucleonMats.neut, MAX_NEUTRONS]}
          frustumCulled={false}
          renderOrder={6}
        />
        {cosmicStyle && pointLights ? (
          <pointLight position={[0, 0, 0]} intensity={1.1} distance={nucleusRadius * 8} color={NUCLEUS_GLOW_WARM_HEX} />
        ) : null}
        {glowSprite ? (
          <sprite
            material={glowSprite.material}
            scale={glowSprite.size}
            renderOrder={3}
            frustumCulled={false}
          />
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

      <instancedMesh
        ref={elecRef}
        args={[elecGeo, elecMat, MAX_Z]}
        frustumCulled={false}
        renderOrder={5}
      />

      {synthesisGlass ? (
        <mesh renderOrder={3} frustumCulled={false}>
          <sphereGeometry args={[outerOrbitR * 1.02, 18, 16]} />
          {glassTransmission ? (
            <meshPhysicalMaterial
              color={nebulaHex}
              emissive={nebulaHex}
              emissiveIntensity={0.22}
              metalness={0.28}
              roughness={0.14}
              transmission={0.52}
              thickness={0.38}
              clearcoat={0.92}
              clearcoatRoughness={0.1}
              transparent
              opacity={0.78}
              depthWrite={false}
              ior={1.35}
            />
          ) : (
            // Дешёвое стекло: без transmission-прохода, блик от roughness/metalness + лёгкий emissive.
            <meshStandardMaterial
              color={nebulaHex}
              emissive={nebulaHex}
              emissiveIntensity={0.18}
              metalness={0.35}
              roughness={0.12}
              transparent
              opacity={0.26}
              depthWrite={false}
            />
          )}
        </mesh>
      ) : null}

      {pointLights && localLightWanted ? (
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

/** Во время урока-кино (ClO₂, NaCl…) Bohr-модели не рисуются — у сцены свои атомы. */
export function AtomStructureModel(props: Parameters<typeof AtomStructureModelInner>[0]) {
  const cinema = useCinemaActive()
  if (cinema) return null
  return <AtomStructureModelInner {...props} />
}
