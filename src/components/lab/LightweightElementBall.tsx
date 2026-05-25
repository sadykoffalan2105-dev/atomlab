import { useMemo } from 'react'
import * as THREE from 'three'
import { getElementByZ } from '../../data/elements'

/** Лёгкий шар элемента (CPK) — для превью реактора и полёта синтеза, без электронных оболочек. */
export function LightweightElementBall({
  z,
  radius = 0.48,
  segments = 12,
}: {
  z: number
  radius?: number
  segments?: number
}) {
  const { color, emissive } = useMemo(() => {
    const el = getElementByZ(z)
    const hex = el ? `#${el.cpkHex}` : '#8899aa'
    const col = new THREE.Color(hex)
    const em = col.clone().multiplyScalar(0.32)
    return { color: col, emissive: em }
  }, [z])

  return (
    <mesh>
      <sphereGeometry args={[radius, segments, Math.max(8, segments - 2)]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={0.28}
        metalness={0.2}
        roughness={0.4}
      />
    </mesh>
  )
}
