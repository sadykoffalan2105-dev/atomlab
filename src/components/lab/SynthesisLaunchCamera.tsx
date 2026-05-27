import { useEffect, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const BASE_POS = new THREE.Vector3(0, 1.25, 6.2)
const BASE_TARGET = new THREE.Vector3(0, 0.18, 0)

/**
 * Плавная камера «запуска»: отъезд при старте, лёгкий наклон, рывок к центру при ударе.
 */
export function SynthesisLaunchCamera({
  active,
  progressRef,
  impactPulseRef,
}: {
  active: boolean
  /** 0…1 ход синтеза (converge) */
  progressRef: MutableRefObject<number>
  /** 0…1 вспышка при слиянии */
  impactPulseRef: MutableRefObject<number>
}) {
  const { camera } = useThree()
  const smoothProgress = useRef(0)
  const smoothImpact = useRef(0)

  useEffect(() => {
    if (!active) {
      smoothProgress.current = 0
      smoothImpact.current = 0
      camera.position.copy(BASE_POS)
      camera.lookAt(BASE_TARGET)
    }
  }, [active, camera])

  useFrame((state, delta) => {
    if (!active) return
    const d = Math.min(0.05, delta)
    const t = state.clock.elapsedTime
    smoothProgress.current +=
      (progressRef.current - smoothProgress.current) * (1 - Math.exp(-8 * d))
    smoothImpact.current +=
      (impactPulseRef.current - smoothImpact.current) * (1 - Math.exp(-14 * d))

    const p = smoothProgress.current
    const pullBack = Math.sin(p * Math.PI * 0.85) * 1.35
    const dip = Math.sin(p * Math.PI) * 0.22
    const impactKick = smoothImpact.current * 0.65
    const shake = smoothImpact.current * Math.sin(t * 42) * 0.04

    const cam = camera as THREE.PerspectiveCamera
    cam.position.set(
      BASE_POS.x + Math.sin(p * 4.1) * 0.06 + shake,
      BASE_POS.y - dip + impactKick * 0.15,
      BASE_POS.z + pullBack - impactKick * 1.1,
    )
    const lookY = BASE_TARGET.y + dip * 0.4
    cam.lookAt(0, lookY, 0)
  })

  return null
}
