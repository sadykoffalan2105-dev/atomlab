/**
 * Склейка неподвижной геометрии по материалам: сотни мелких деталей комнаты и оборудования (плинтусы, ручки,
 * рамы, ножки) рисуются несколькими вызовами вместо сотен — главный резерв кадров на интегрированной видеокарте.
 *
 * Как работает: после монтирования дети остаются в сцене, но становятся невидимыми (visible = false), а рядом
 * появляется по одной склеенной сетке на каждый (материал, отбрасывает тень, принимает тень). Нажатия, двойной клик
 * и проверка «подпись закрыта мебелью» работают как раньше: three проверяет попадание и по невидимым сеткам.
 * Не склеиваются: прозрачные материалы (стекло — им нужна сортировка), InstancedMesh, массивы материалов и всё
 * внутри объекта с userData.noBatch (двигающиеся дверцы, ящики, капли и т. п.).
 * deps — когда пересобрать (сменились материалы, язык подписей, состав предметов).
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

interface Bucket {
  readonly material: THREE.Material
  readonly cast: boolean
  readonly receive: boolean
  readonly geos: THREE.BufferGeometry[]
}

function prepared(mesh: THREE.Mesh, m: THREE.Matrix4): THREE.BufferGeometry | null {
  const src = mesh.geometry
  const pos = src.getAttribute('position')
  const nor = src.getAttribute('normal')
  if (!pos || !nor || src.morphAttributes.position) return null
  const flat = src.index ? src.toNonIndexed() : src
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', flat.getAttribute('position').clone())
  out.setAttribute('normal', flat.getAttribute('normal').clone())
  const uv = flat.getAttribute('uv')
  out.setAttribute('uv', uv ? uv.clone() : new THREE.BufferAttribute(new Float32Array(flat.getAttribute('position').count * 2), 2))
  if (flat !== src) flat.dispose()
  out.applyMatrix4(m)
  return out
}

export function StaticBatch({ children, deps }: { children: ReactNode; deps: readonly unknown[] }) {
  const outer = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    const root = outer.current
    const src = inner.current
    if (!root || !src) return
    root.updateMatrixWorld(true)
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
    const buckets = new Map<string, Bucket>()
    const hidden: THREE.Mesh[] = []
    const m = new THREE.Matrix4()
    const visit = (o: THREE.Object3D) => {
      if (!o.visible || o.userData?.noBatch) return
      const mesh = o as THREE.Mesh
      if (mesh.isMesh && !(o as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(mesh.material)) {
        const mat = mesh.material as THREE.Material
        if (!mat.transparent && mat.visible) {
          const g = prepared(mesh, m.multiplyMatrices(inv, mesh.matrixWorld))
          if (g) {
            const key = `${mat.uuid}:${mesh.castShadow ? 1 : 0}:${mesh.receiveShadow ? 1 : 0}`
            let b = buckets.get(key)
            if (!b) {
              b = { material: mat, cast: mesh.castShadow, receive: mesh.receiveShadow, geos: [] }
              buckets.set(key, b)
            }
            b.geos.push(g)
            hidden.push(mesh)
          }
        }
      }
      for (const c of o.children) visit(c)
    }
    for (const c of src.children) visit(c)
    const merged: THREE.Mesh[] = []
    for (const b of buckets.values()) {
      const g = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false)
      if (b.geos.length > 1) for (const x of b.geos) x.dispose()
      if (!g) continue
      g.computeBoundingSphere()
      const mesh = new THREE.Mesh(g, b.material)
      mesh.castShadow = b.cast
      mesh.receiveShadow = b.receive
      mesh.matrixAutoUpdate = false
      // склеенная сетка только рисуется: попадания считаются по исходным (невидимым) деталям
      mesh.raycast = () => {}
      mesh.userData.staticBatch = true
      merged.push(mesh)
      root.add(mesh)
    }
    for (const h of hidden) h.visible = false
    return () => {
      for (const h of hidden) h.visible = true
      for (const mesh of merged) {
        root.remove(mesh)
        mesh.geometry.dispose()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- пересборка только по явным зависимостям
  }, deps)
  return (
    <group ref={outer}>
      <group ref={inner}>{children}</group>
    </group>
  )
}
