import * as THREE from 'three'

/**
 * Общий кэш материалов атомов — как sharedGeometries.
 * Один MeshStandardMaterial на (цвет, эмиссия), а не на атом.
 * Безопасно шарить: свойства статичны, никто не мутирует их per-frame
 * (в отличие от плазменных связей с уникальными uniforms — те НЕ шарим).
 */
let atomMatCache: Map<string, THREE.MeshStandardMaterial> | null = null

export function sharedAtomMaterial(hex: string, emissiveIntensity: number): THREE.MeshStandardMaterial {
  if (!atomMatCache) atomMatCache = new Map()
  const key = `${hex}_${emissiveIntensity.toFixed(2)}`
  let m = atomMatCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: hex,
      emissive: hex,
      emissiveIntensity,
      roughness: 0.28,
      metalness: 0.12,
    })
    atomMatCache.set(key, m)
  }
  return m
}

/** Полная очистка кэша — вызывать при полном teardown 3D-лаборатории (не per-run). */
export function disposeSciMaterialCache(): void {
  atomMatCache?.forEach((m) => m.dispose())
  atomMatCache = null
}
