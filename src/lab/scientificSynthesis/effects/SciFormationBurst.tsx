import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Вспышка образования продукта: один BufferGeometry + Points (не куча mesh).
 * triggerRef: 0..1 импульс; при росте — перезапуск burst.
 */
export function SciFormationBurst({
  triggerRef,
  count = 96,
  color = '#ffb060',
  color2 = '#7ef0ff',
  radius = 1.8,
  active = true,
}: {
  triggerRef: MutableRefObject<number>
  count?: number
  color?: string
  color2?: string
  radius?: number
  active?: boolean
}) {
  const pointsRef = useRef<THREE.Points>(null)
  const matRef = useRef<THREE.PointsMaterial>(null)
  const lifeRef = useRef(0)
  const prevTrig = useRef(0)

  const { positions, velocities, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const c1 = new THREE.Color(color)
    const c2 = new THREE.Color(color2)
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      positions[i3] = 0
      positions[i3 + 1] = 0
      positions[i3 + 2] = 0
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const speed = 1.2 + Math.random() * 2.8
      velocities[i3] = Math.sin(phi) * Math.cos(theta) * speed
      velocities[i3 + 1] = Math.sin(phi) * Math.sin(theta) * speed
      velocities[i3 + 2] = Math.cos(phi) * speed
      const mix = Math.random()
      colors[i3] = c1.r * (1 - mix) + c2.r * mix
      colors[i3 + 1] = c1.g * (1 - mix) + c2.g * mix
      colors[i3 + 2] = c1.b * (1 - mix) + c2.b * mix
    }
    return { positions, velocities, colors }
  }, [count, color, color2])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [positions, colors])

  useEffect(() => {
    return () => {
      geo.dispose()
    }
  }, [geo])

  useFrame((_, dt) => {
    if (!active || !pointsRef.current) return
    const trig = triggerRef.current
    if (trig > 0.35 && prevTrig.current <= 0.35) {
      lifeRef.current = 1
      const pos = geo.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        pos.array[i3] = (Math.random() - 0.5) * 0.15
        pos.array[i3 + 1] = (Math.random() - 0.5) * 0.15
        pos.array[i3 + 2] = (Math.random() - 0.5) * 0.15
      }
      pos.needsUpdate = true
    }
    prevTrig.current = trig

    if (lifeRef.current <= 0) {
      pointsRef.current.visible = false
      return
    }
    pointsRef.current.visible = true
    lifeRef.current = Math.max(0, lifeRef.current - dt * 1.15)
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const damp = 1 - dt * 0.85
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      velocities[i3]! *= damp
      velocities[i3 + 1]! *= damp
      velocities[i3 + 2]! *= damp
      arr[i3]! += velocities[i3]! * dt * radius
      arr[i3 + 1]! += velocities[i3 + 1]! * dt * radius
      arr[i3 + 2]! += velocities[i3 + 2]! * dt * radius
    }
    pos.needsUpdate = true
    if (matRef.current) {
      matRef.current.opacity = lifeRef.current * 0.9
      matRef.current.size = 0.08 + lifeRef.current * 0.1
    }
  })

  return (
    <points ref={pointsRef} geometry={geo} visible={false} frustumCulled={false}>
      <pointsMaterial
        ref={matRef}
        size={0.12}
        vertexColors
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  )
}
