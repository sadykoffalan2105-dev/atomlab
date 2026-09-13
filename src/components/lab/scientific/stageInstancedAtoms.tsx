import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ScientificStageLayout } from './scientificReactorStageLayout'

export type StageMoleculeLayout = Pick<ScientificStageLayout, 'roles' | 'units' | 'atoms' | 'bonds' | 'bondRadius'>

const APPEAR_SEC = 0.25
const BOND_COLOR = '#bcd6ff'
/** емкость инстансов растёт ступенями — смена коэффициента не пересоздаёт меши */
const CAPACITY_STEP = 16

const bucket = (n: number) => Math.max(CAPACITY_STEP, Math.ceil(n / CAPACITY_STEP) * CAPACITY_STEP)

/**
 * Френелевская кромка как у CinemaAtom, но инстансная: один draw call на все
 * атомы. Светящееся ядро внутри непрозрачной сферы не видно, кромка — видна.
 */
function makeGlowMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uPower: { value: 2.6 }, uIntensity: { value: 0.8 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec3 vColor;
      void main() {
        vec4 p = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
          n = mat3(instanceMatrix) * n;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vColor = instanceColor;
        #else
          vColor = vec3(1.0);
        #endif
        vec4 viewPos = modelViewMatrix * p;
        vNormalV = normalize(normalMatrix * n);
        vViewDir = normalize(-viewPos.xyz);
        gl_Position = projectionMatrix * viewPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uPower;
      uniform float uIntensity;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec3 vColor;
      void main() {
        float f = pow(1.0 - clamp(dot(normalize(vNormalV), normalize(vViewDir)), 0.0, 1.0), uPower);
        gl_FragColor = vec4(vColor, f * uIntensity);
        #include <colorspace_fragment>
      }
    `,
  })
}

type StageMeshes = {
  sphereGeo: THREE.SphereGeometry
  bondGeo: THREE.CylinderGeometry
  roleMeshes: Map<string, THREE.InstancedMesh>
  bondMesh: THREE.InstancedMesh
  glowMesh: THREE.InstancedMesh | null
  disposables: { dispose: () => void }[]
}

type MeshSpec = {
  roles: { id: string; color: number; cap: number }[]
  bondCap: number
  glowCap: number
  lowPower: boolean
}

function createMeshes({ roles, bondCap, glowCap, lowPower }: MeshSpec): StageMeshes {
  const sphereGeo = lowPower ? new THREE.SphereGeometry(1, 14, 10) : new THREE.SphereGeometry(1, 24, 18)
  // Открытый цилиндр: торцы всё равно внутри атомов.
  const bondGeo = new THREE.CylinderGeometry(1, 1, 1, lowPower ? 8 : 12, 1, true)
  const disposables: { dispose: () => void }[] = [sphereGeo, bondGeo]

  const roleMeshes = new Map<string, THREE.InstancedMesh>()
  for (const role of roles) {
    const mat = new THREE.MeshStandardMaterial({
      color: role.color,
      emissive: role.color,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.05,
    })
    const mesh = new THREE.InstancedMesh(sphereGeo, mat, role.cap)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.frustumCulled = false
    mesh.count = 0
    roleMeshes.set(role.id, mesh)
    disposables.push(mat, mesh)
  }

  const bondMat = new THREE.MeshStandardMaterial({
    color: BOND_COLOR,
    emissive: BOND_COLOR,
    emissiveIntensity: 0.25,
    roughness: 0.35,
    metalness: 0.1,
  })
  const bondMesh = new THREE.InstancedMesh(bondGeo, bondMat, bondCap)
  bondMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  bondMesh.frustumCulled = false
  bondMesh.count = 0
  disposables.push(bondMat, bondMesh)

  let glowMesh: THREE.InstancedMesh | null = null
  if (!lowPower) {
    const glowMat = makeGlowMaterial()
    glowMesh = new THREE.InstancedMesh(sphereGeo, glowMat, glowCap)
    glowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    // instanceColor до первого рендера — иначе шейдер соберётся без USE_INSTANCING_COLOR.
    glowMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(glowCap * 3), 3)
    glowMesh.frustumCulled = false
    glowMesh.count = 0
    glowMesh.renderOrder = 2
    disposables.push(glowMat, glowMesh)
  }

  return { sphereGeo, bondGeo, roleMeshes, bondMesh, glowMesh, disposables }
}

type UnitAnim = { born: number; x: number; y: number; z: number }

type StageRuntime = {
  layout: StageMoleculeLayout
  meshes: StageMeshes
  instanceIndex: Int32Array
  roleCounts: ReadonlyMap<string, number>
  worldPos: Float32Array
  unitGrow: Float32Array
  synced: boolean
}

const _unitMatrix = new THREE.Matrix4()
const _quat = new THREE.Quaternion()
const _euler = new THREE.Euler()
const _pos = new THREE.Vector3()
const _scale = new THREE.Vector3()
const _v = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _m = new THREE.Matrix4()
const _color = new THREE.Color()
const Y_AXIS = new THREE.Vector3(0, 1, 0)

const easeOutCubic = (x: number) => 1 - (1 - x) ** 3

/**
 * Все атомы и связи сцены реактора — InstancedMesh по роли атома (Cl, O, Na⁺,
 * Cl⁻…), один на связи и один на свечение: draw calls не растут с коэффициентами.
 * Каждая формульная единица медленно покачивается вокруг своего центра; новые
 * копии вырастают за ~250 мс, сдвинутые раскладкой — доезжают, а не прыгают.
 */
export function StageInstancedMolecules({
  layout,
  lowPower,
}: {
  layout: StageMoleculeLayout
  lowPower: boolean
}) {
  const { roles, atoms, bonds } = layout

  const roleCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of atoms) m.set(a.role, (m.get(a.role) ?? 0) + 1)
    return m
  }, [atoms])

  // Меши пересоздаются только при смене набора ролей / ступени ёмкости / качества.
  const meshSpec = useMemo(
    () =>
      JSON.stringify({
        roles: roles.map((r) => ({ id: r.id, color: r.color, cap: bucket(roleCounts.get(r.id) ?? 0) })),
        bondCap: bucket(bonds.length),
        glowCap: bucket(atoms.length),
        lowPower,
      } satisfies MeshSpec),
    [roles, roleCounts, bonds.length, atoms.length, lowPower],
  )
  const meshes = useMemo(() => createMeshes(JSON.parse(meshSpec) as MeshSpec), [meshSpec])

  useEffect(() => () => meshes.disposables.forEach((d) => d.dispose()), [meshes])

  /** индекс инстанса атома внутри меша его роли */
  const instanceIndex = useMemo(() => {
    const next = new Map<string, number>()
    const out = new Int32Array(atoms.length)
    atoms.forEach((a, i) => {
      const k = next.get(a.role) ?? 0
      out[i] = k
      next.set(a.role, k + 1)
    })
    return out
  }, [atoms])

  // Всё, что мутирует кадр, живёт в ref: layout-эффект до ближайшего кадра.
  const runtimeRef = useRef<StageRuntime | null>(null)
  useLayoutEffect(() => {
    runtimeRef.current = {
      layout,
      meshes,
      instanceIndex,
      roleCounts,
      worldPos: new Float32Array(layout.atoms.length * 3),
      unitGrow: new Float32Array(layout.units.length),
      synced: false,
    }
  }, [layout, meshes, instanceIndex, roleCounts])

  const anims = useRef(new Map<string, UnitAnim>())
  const frame = useRef({ n: 0, acc: 0 })

  useFrame((state, delta) => {
    const rt = runtimeRef.current
    if (!rt) return
    const f = frame.current
    f.n += 1
    f.acc += Math.min(delta, 0.1)
    if (lowPower && f.n % 2 === 1) return
    const dt = f.acc
    f.acc = 0
    const t = state.clock.elapsedTime
    const { roleMeshes, bondMesh, glowMesh } = rt.meshes
    const { units, atoms, bonds, roles } = rt.layout
    const { worldPos, unitGrow, instanceIndex } = rt

    if (!rt.synced) {
      const alive = new Set<string>()
      for (const u of units) {
        alive.add(u.key)
        if (!anims.current.has(u.key)) {
          anims.current.set(u.key, { born: t, x: u.center[0], y: u.center[1], z: u.center[2] })
        }
      }
      for (const k of [...anims.current.keys()]) if (!alive.has(k)) anims.current.delete(k)
      roleMeshes.forEach((mesh, id) => {
        mesh.count = rt.roleCounts.get(id) ?? 0
      })
      bondMesh.count = bonds.length
      if (glowMesh) {
        glowMesh.count = atoms.length
        const glowById = new Map(roles.map((r) => [r.id, r.glowColor]))
        atoms.forEach((a, i) => {
          glowMesh.setColorAt(i, _color.setHex(glowById.get(a.role) ?? 0xffffff))
        })
        if (glowMesh.instanceColor) glowMesh.instanceColor.needsUpdate = true
      }
      rt.synced = true
    }

    const follow = 1 - Math.exp(-dt * 12)
    units.forEach((u, ui) => {
      const anim = anims.current.get(u.key)
      if (!anim) {
        unitGrow[ui] = 0
        return
      }
      anim.x += (u.center[0] - anim.x) * follow
      anim.y += (u.center[1] - anim.y) * follow
      anim.z += (u.center[2] - anim.z) * follow
      const grow = easeOutCubic(Math.min(1, Math.max(0, (t - anim.born) / APPEAR_SEC)))
      unitGrow[ui] = grow
      const ph = u.phase
      // Амплитуды малы: изгиб молекулы должен оставаться читаемым.
      _euler.set(
        0.1 * Math.sin(t * 0.5 + ph),
        0.24 * Math.sin(t * 0.42 + ph * 1.7),
        0.06 * Math.sin(t * 0.7 + ph * 1.3),
      )
      _quat.setFromEuler(_euler)
      _pos.set(anim.x, anim.y + 0.035 * Math.sin(t * 1.1 + ph), anim.z)
      _unitMatrix.compose(_pos, _quat, _scale.setScalar(grow))

      for (let i = u.atomStart; i < u.atomStart + u.atomCount; i++) {
        const a = atoms[i]!
        _v.set(a.local[0], a.local[1], a.local[2]).applyMatrix4(_unitMatrix)
        worldPos[i * 3] = _v.x
        worldPos[i * 3 + 1] = _v.y
        worldPos[i * 3 + 2] = _v.z
        const r = a.radius * grow
        _m.makeScale(r, r, r).setPosition(_v)
        roleMeshes.get(a.role)?.setMatrixAt(instanceIndex[i]!, _m)
        if (glowMesh) {
          const g = r * 1.08
          _m.makeScale(g, g, g).setPosition(_v)
          glowMesh.setMatrixAt(i, _m)
        }
      }
    })

    const bondR = rt.layout.bondRadius
    bonds.forEach((b, bi) => {
      const ax = worldPos[b.a * 3]!
      const ay = worldPos[b.a * 3 + 1]!
      const az = worldPos[b.a * 3 + 2]!
      _dir.set(worldPos[b.b * 3]! - ax, worldPos[b.b * 3 + 1]! - ay, worldPos[b.b * 3 + 2]! - az)
      const len = _dir.length()
      if (len < 1e-6) {
        _m.makeScale(0, 0, 0)
      } else {
        const grow = unitGrow[b.unit] ?? 1
        _quat.setFromUnitVectors(Y_AXIS, _dir.multiplyScalar(1 / len))
        _pos.set(ax, ay, az).addScaledVector(_dir, len / 2)
        _m.compose(_pos, _quat, _scale.set(bondR * grow, len, bondR * grow))
      }
      bondMesh.setMatrixAt(bi, _m)
    })

    for (const mesh of roleMeshes.values()) mesh.instanceMatrix.needsUpdate = true
    bondMesh.instanceMatrix.needsUpdate = true
    if (glowMesh) glowMesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {[...meshes.roleMeshes.entries()].map(([id, mesh]) => (
        <primitive key={id} object={mesh} />
      ))}
      <primitive object={meshes.bondMesh} />
      {meshes.glowMesh ? <primitive object={meshes.glowMesh} /> : null}
    </group>
  )
}
