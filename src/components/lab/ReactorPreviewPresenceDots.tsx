import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ReactorPreviewAtom } from './reactorPreviewLayout'

/** Цвет сферы по Z (читаемо на тёмном фоне реактора). */
function colorForZ(z: number, out: THREE.Color): void {
  if (z <= 1) out.set('#e8f4ff')
  else if (z <= 2) out.set('#ffb347')
  else if (z <= 8) out.set('#5b9dff')
  else if (z <= 10) out.set('#ff6b6b')
  else if (z <= 17) out.set('#7dffa3')
  else if (z <= 20) out.set('#c9a0ff')
  else if (z <= 26) out.set('#ffd166')
  else out.set('#7afcff')
}

function emergencyPos(i: number, n: number): [number, number, number] {
  const angle = (i / Math.max(n, 1)) * Math.PI * 2
  const r = 1.15 + (i % 3) * 0.38
  return [Math.cos(angle) * r, Math.sin(angle) * r * 0.58, ((i % 5) - 2) * 0.12]
}

/**
 * Главный слой присутствия атомов при +/-.
 * Обновляется КАЖДЫЙ кадр (layout-массив мутируется in-place — useEffect не срабатывает).
 * Bohr может hitch — эти сферы остаются на экране всегда.
 * Пустой кадр не стирает прошлые матрицы (holdLast).
 */
export function ReactorPreviewPresenceDots({
  atoms,
  shellAtoms,
  slotCount,
  visible,
  maxCount = 48,
  /** Крупнее при dense edit — невозможно «не увидеть». */
  radius = 0.38,
}: {
  atoms: readonly (ReactorPreviewAtom | null | undefined)[]
  shellAtoms?: readonly ReactorPreviewAtom[]
  slotCount: number
  visible: boolean
  maxCount?: number
  radius?: number
}) {
  const geo = useMemo(() => new THREE.SphereGeometry(radius, 16, 14), [radius])
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#3dffec',
        emissiveIntensity: 0.72,
        roughness: 0.28,
        metalness: 0.15,
        transparent: false,
        depthWrite: true,
      }),
    [],
  )
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, mat, maxCount)
    m.frustumCulled = false
    m.count = 0
    m.visible = false
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxCount * 3), 3)
    return m
  }, [geo, mat, maxCount])

  const dummy = useRef(new THREE.Object3D()).current
  const color = useRef(new THREE.Color()).current
  const atomsRef = useRef(atoms)
  const shellRef = useRef(shellAtoms)
  const slotCountRef = useRef(slotCount)
  const visibleRef = useRef(visible)
  const lastCountRef = useRef(0)
  atomsRef.current = atoms
  shellRef.current = shellAtoms
  slotCountRef.current = slotCount
  visibleRef.current = visible

  useFrame(() => {
    if (!visibleRef.current) {
      // Не гасим мгновенно — один кадр hold, иначе мигание при React toggle.
      return
    }
    const list = atomsRef.current
    const shell = shellRef.current ?? []
    const want = Math.max(
      0,
      Math.min(maxCount, Math.max(slotCountRef.current, list.length, shell.length)),
    )
    let count = 0
    for (let i = 0; i < want; i++) {
      const a = list[i] ?? shell[i]
      if (!a) continue
      dummy.position.set(a.pos[0], a.pos[1], a.pos[2])
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      mesh.setMatrixAt(count, dummy.matrix)
      colorForZ(a.z, color)
      mesh.setColorAt(count, color)
      count += 1
    }
    if (count === 0 && shell.length > 0) {
      const n = Math.min(shell.length, maxCount)
      for (let i = 0; i < n; i++) {
        const a = shell[i]!
        dummy.position.set(a.pos[0], a.pos[1], a.pos[2])
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        mesh.setMatrixAt(count, dummy.matrix)
        colorForZ(a.z, color)
        mesh.setColorAt(count, color)
        count += 1
      }
    }
    // Emergency: ожидаем слоты, но layout/shell пусты — кольцо, чтобы экран не был чёрным.
    if (count === 0 && want > 0) {
      for (let i = 0; i < want; i++) {
        const [x, y, z] = emergencyPos(i, want)
        dummy.position.set(x, y, z)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        mesh.setMatrixAt(count, dummy.matrix)
        colorForZ(8, color)
        mesh.setColorAt(count, color)
        count += 1
      }
    }
    // Hold last: пустой кадр не обнуляет прошлый count (hitch layout).
    if (count === 0 && lastCountRef.current > 0) {
      mesh.visible = true
      return
    }
    mesh.count = count
    mesh.visible = count > 0
    if (count > 0) {
      lastCountRef.current = count
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  })

  return <primitive object={mesh} />
}
