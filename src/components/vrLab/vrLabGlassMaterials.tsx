import * as THREE from 'three'
import { getSharedGlassMaterial } from './vrLabTextureCache'

type GlassProps = {
  color?: string
  roughness?: number
}

/** Лёгкий стеклянный материал без MeshTransmissionMaterial (не блокирует GPU). */
export function VrLabGlassMaterial({ color = '#eef4ff' }: GlassProps) {
  const mat = getSharedGlassMaterial()
  if (mat.color.getHexString() !== new THREE.Color(color).getHexString()) {
    mat.color.set(color)
  }
  return <primitive attach="material" object={mat} />
}
