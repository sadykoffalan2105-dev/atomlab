import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'

const DUMMY = new THREE.Object3D()

type Props = {
  count?: number
  radius: number
  baseY: number
  maxHeight: number
  fill?: number
  fillRef?: RefObject<number>
  color: string
  active: boolean
}

/** Пузырьки жидкости — один InstancedMesh вместо N отдельных mesh. */
export function InstancedBubbleField({
  count = 10,
  radius,
  baseY,
  maxHeight,
  fill = 0,
  fillRef: externalFillRef,
  color,
  active,
}: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const localFill = useRef(fill)
  localFill.current = externalFillRef?.current ?? fill

  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        phase: (i / count) * Math.PI * 2,
        rx: (Math.random() - 0.5) * radius * 1.4,
        rz: (Math.random() - 0.5) * radius * 1.4,
        size: 0.004 + Math.random() * 0.007,
        speed: 0.25 + Math.random() * 0.45,
      })),
    [count, radius],
  )

  const bubbleColor = useMemo(() => new THREE.Color(color), [color])

  useFrame((state) => {
    const mesh = meshRef.current
    const f = externalFillRef?.current ?? localFill.current
    if (!mesh || f < 0.08) {
      if (mesh) mesh.count = 0
      return
    }

    const h = f * maxHeight
    const t = state.clock.elapsedTime
    mesh.count = count

    for (let i = 0; i < count; i++) {
      const s = seeds[i]!
      const yNorm = (t * s.speed + s.phase) % 1
      const scale = active ? s.size * (1 + Math.sin(t * 8 + s.phase) * 0.2) : s.size
      DUMMY.position.set(
        s.rx * (1 - yNorm * 0.3),
        baseY + yNorm * h * 0.85 + 0.02,
        s.rz * (1 - yNorm * 0.3),
      )
      DUMMY.scale.setScalar(scale / 0.006)
      DUMMY.updateMatrix()
      mesh.setMatrixAt(i, DUMMY.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  if ((externalFillRef?.current ?? fill) < 0.08) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[0.006, 6, 6]} />
      <meshStandardMaterial
        color={bubbleColor}
        emissive={bubbleColor}
        emissiveIntensity={active ? 1.4 : 0.9}
        transparent
        opacity={0.75}
        depthWrite={false}
      />
    </instancedMesh>
  )
}
