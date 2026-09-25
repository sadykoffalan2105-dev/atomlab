import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ScientificStageLayout } from './scientificReactorStageLayout'
import { makeStageAtomMaterial, makeStageBondMaterial, makeStageSymbolMaterial } from './stageAtomMaterials'
import {
  atomSymbolText,
  ensureStageSymbolCells,
  stageAtomColor,
  stageSymbolAtlasTexture,
  symbolInkIsDark,
  type AtomSymbolText,
} from './stageAtomSymbols'

export type StageMoleculeLayout = Pick<ScientificStageLayout, 'roles' | 'units' | 'atoms' | 'bonds' | 'bondRadius'>

const APPEAR_SEC = 0.25
/** Нейтральный светло-серо-голубой: связь не спорит с цветами атомов. */
const BOND_COLOR = '#a9b6c9'
/** Связи тоньше, чем в раскладке: «палочки» читаются, но не перетягивают внимание. */
const BOND_THIN = 0.8
/** емкость инстансов растёт ступенями — смена коэффициента не пересоздаёт меши */
const CAPACITY_STEP = 16

const bucket = (n: number) => Math.max(CAPACITY_STEP, Math.ceil(n / CAPACITY_STEP) * CAPACITY_STEP)

type StageMeshes = {
  atomMesh: THREE.InstancedMesh
  rimAttr: THREE.InstancedBufferAttribute
  bondMesh: THREE.InstancedMesh
  symbolMesh: THREE.InstancedMesh | null
  cellAttr: THREE.InstancedBufferAttribute | null
  inkAttr: THREE.InstancedBufferAttribute | null
  symbolMat: THREE.ShaderMaterial | null
  disposables: { dispose: () => void }[]
}

function createMeshes(atomCap: number, bondCap: number, lowPower: boolean): StageMeshes {
  const sphereGeo = lowPower ? new THREE.SphereGeometry(1, 18, 12) : new THREE.SphereGeometry(1, 36, 24)
  // Открытый цилиндр: торцы всё равно внутри атомов.
  const bondGeo = new THREE.CylinderGeometry(1, 1, 1, lowPower ? 8 : 14, 1, true)
  const disposables: { dispose: () => void }[] = [sphereGeo, bondGeo]

  const atomMat = makeStageAtomMaterial()
  const rimAttr = new THREE.InstancedBufferAttribute(new Float32Array(atomCap * 3), 3)
  sphereGeo.setAttribute('aRim', rimAttr)
  const atomMesh = new THREE.InstancedMesh(sphereGeo, atomMat, atomCap)
  atomMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  // instanceColor до первого рендера — иначе шейдер соберётся без USE_INSTANCING_COLOR.
  atomMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(atomCap * 3), 3)
  atomMesh.frustumCulled = false
  atomMesh.count = 0
  atomMesh.name = 'stage-atoms'
  disposables.push(atomMat, atomMesh)

  const bondMat = makeStageBondMaterial(BOND_COLOR)
  const bondMesh = new THREE.InstancedMesh(bondGeo, bondMat, bondCap)
  bondMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  bondMesh.frustumCulled = false
  bondMesh.count = 0
  bondMesh.name = 'stage-bonds'
  disposables.push(bondMat, bondMesh)

  let symbolMesh: THREE.InstancedMesh | null = null
  let cellAttr: THREE.InstancedBufferAttribute | null = null
  let inkAttr: THREE.InstancedBufferAttribute | null = null
  let symbolMat: THREE.ShaderMaterial | null = null
  const atlas = stageSymbolAtlasTexture()
  if (atlas) {
    const quad = new THREE.PlaneGeometry(1, 1)
    cellAttr = new THREE.InstancedBufferAttribute(new Float32Array(atomCap).fill(-1), 1)
    inkAttr = new THREE.InstancedBufferAttribute(new Float32Array(atomCap), 1)
    quad.setAttribute('aCell', cellAttr)
    quad.setAttribute('aInk', inkAttr)
    symbolMat = makeStageSymbolMaterial(atlas)
    symbolMesh = new THREE.InstancedMesh(quad, symbolMat, atomCap)
    // Матрица подписи = матрица шара (центр + радиус): общий буфер, одна загрузка на кадр.
    symbolMesh.instanceMatrix = atomMesh.instanceMatrix
    symbolMesh.frustumCulled = false
    symbolMesh.count = 0
    symbolMesh.renderOrder = 3
    symbolMesh.name = 'stage-atom-symbols'
    // атлас общий на приложение — его не освобождаем
    disposables.push(quad, symbolMat, symbolMesh)
  }

  return { atomMesh, rimAttr, bondMesh, symbolMesh, cellAttr, inkAttr, symbolMat, disposables }
}

type UnitAnim = { born: number; x: number; y: number; z: number }

type StageRuntime = {
  layout: StageMoleculeLayout
  meshes: StageMeshes
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
const _rim = new THREE.Color()
const _white = new THREE.Color(0xffffff)
const Y_AXIS = new THREE.Vector3(0, 1, 0)

const easeOutCubic = (x: number) => 1 - (1 - x) ** 3

/** Цвета, ободки и клетки символов — один раз на раскладку (не в кадре). */
function syncInstanceAttributes(rt: StageRuntime): void {
  const { atoms, roles } = rt.layout
  const { atomMesh, rimAttr, cellAttr, inkAttr } = rt.meshes
  const roleById = new Map(roles.map((r) => [r.id, r]))
  const texts: AtomSymbolText[] = []
  const inks: number[] = []
  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i]!
    const role = roleById.get(a.role)
    const hex = stageAtomColor(a.symbol, role?.color ?? 0x99aabb)
    const charge = role?.charge ?? 0
    atomMesh.setColorAt(i, _color.setHex(hex))
    // Ободок: у ионов — тёплый/холодный оттенок кромки (как у CinemaAtom), у нейтральных — светлее тела.
    if (charge !== 0 && role) _rim.setHex(role.glowColor).lerp(_white, 0.25)
    else _rim.setHex(hex).lerp(_white, 0.6)
    rimAttr.setXYZ(i, _rim.r, _rim.g, _rim.b)
    texts.push(atomSymbolText(a.symbol, charge))
    inks.push(symbolInkIsDark(hex) ? 1 : 0)
  }
  if (atomMesh.instanceColor) atomMesh.instanceColor.needsUpdate = true
  rimAttr.needsUpdate = true
  if (cellAttr && inkAttr) {
    const cells = new Int32Array(texts.length)
    ensureStageSymbolCells(texts, cells)
    for (let i = 0; i < texts.length; i++) {
      cellAttr.setX(i, cells[i]!)
      inkAttr.setX(i, inks[i]!)
    }
    cellAttr.needsUpdate = true
    inkAttr.needsUpdate = true
  }
}

/**
 * Все атомы сцены реактора — ОДИН InstancedMesh (цвет на экземпляр), связи — второй,
 * символы элементов внутри шаров — третий (квадраты с атласом, матрица общая с шарами):
 * три draw call при любых коэффициентах. Каждая формульная единица медленно
 * покачивается вокруг своего центра; новые копии вырастают за ~250 мс, сдвинутые
 * раскладкой — доезжают, а не прыгают. В кадре — ни одной аллокации.
 */
export function StageInstancedMolecules({
  layout,
  lowPower,
}: {
  layout: StageMoleculeLayout
  lowPower: boolean
}) {
  const { atoms, bonds } = layout
  const atomCap = bucket(atoms.length)
  const bondCap = bucket(bonds.length)

  // Меши пересоздаются только при смене ступени ёмкости / качества.
  const meshes = useMemo(() => createMeshes(atomCap, bondCap, lowPower), [atomCap, bondCap, lowPower])

  useEffect(() => () => meshes.disposables.forEach((d) => d.dispose()), [meshes])

  // Всё, что мутирует кадр, живёт в ref: layout-эффект до ближайшего кадра.
  const runtimeRef = useRef<StageRuntime | null>(null)
  useLayoutEffect(() => {
    runtimeRef.current = {
      layout,
      meshes,
      worldPos: new Float32Array(layout.atoms.length * 3),
      unitGrow: new Float32Array(layout.units.length),
      synced: false,
    }
  }, [layout, meshes])

  const anims = useRef(new Map<string, UnitAnim>())
  const frame = useRef({ n: 0, acc: 0, viewH: 0 })

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
    const { atomMesh, bondMesh, symbolMesh, symbolMat } = rt.meshes
    const { units, atoms, bonds } = rt.layout
    const { worldPos, unitGrow } = rt

    if (symbolMat && f.viewH !== state.size.height) {
      f.viewH = state.size.height
      symbolMat.uniforms.uViewportH!.value = state.size.height
    }

    if (!rt.synced) {
      const alive = new Set<string>()
      for (const u of units) {
        alive.add(u.key)
        if (!anims.current.has(u.key)) {
          anims.current.set(u.key, { born: t, x: u.center[0], y: u.center[1], z: u.center[2] })
        }
      }
      for (const k of [...anims.current.keys()]) if (!alive.has(k)) anims.current.delete(k)
      atomMesh.count = atoms.length
      bondMesh.count = bonds.length
      if (symbolMesh) symbolMesh.count = atoms.length
      syncInstanceAttributes(rt)
      rt.synced = true
    }

    const follow = 1 - Math.exp(-dt * 12)
    for (let ui = 0; ui < units.length; ui++) {
      const u = units[ui]!
      const anim = anims.current.get(u.key)
      if (!anim) {
        unitGrow[ui] = 0
        continue
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
        atomMesh.setMatrixAt(i, _m)
      }
    }

    const bondR = rt.layout.bondRadius * BOND_THIN
    for (let bi = 0; bi < bonds.length; bi++) {
      const b = bonds[bi]!
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
    }

    // Буфер матриц шаров общий с символами — одной отметки хватает обоим мешам.
    atomMesh.instanceMatrix.needsUpdate = true
    bondMesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <primitive object={meshes.atomMesh} />
      <primitive object={meshes.bondMesh} />
      {meshes.symbolMesh ? <primitive object={meshes.symbolMesh} /> : null}
    </group>
  )
}
