/**
 * Kit CO₂ — электрон с хвостом «как функция времени»: голова (шар + свечение) и шлейф из нескольких свечений в точках
 * pos(t − τ) — виден только в движении, перемотка назад/вперёд без накопленного состояния (в отличие от drei Trail,
 * который копит мировые позиции и внутри масштабируемой группы атомов даёт неверный след).
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clamp01 } from '../../formationStory'
import { Glow, useClockCtx, type PFn, type TFn } from './core'

const TAU = 0.07

export function CO2Electron({ pos, r, k, color = '#fde68a', tail = 5 }: { pos: PFn; r: number; k: TFn; color?: string; tail?: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, toneMapped: false }), [color])
  const clock = useClockCtx()
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const t = clock()
    const kk = clamp01(k(t))
    const p = pos(t)
    m.position.set(p[0], p[1], p[2])
    m.scale.setScalar(Math.max(1e-4, r * (0.6 + 0.4 * kk)))
    mat.opacity = kk
    m.visible = kk > 0.01
  })
  // яркость хвоста: только когда электрон движется (смещение за τ заметно)
  const moving = (t: number) => {
    const a = pos(t)
    const b = pos(t - TAU)
    return clamp01((Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) - 0.004) / 0.012)
  }
  const segs = useMemo(() => Array.from({ length: tail }, (_, i) => i + 1), [tail])
  return (
    <>
      <mesh ref={ref} material={mat} renderOrder={7}>
        <sphereGeometry args={[1, 12, 10]} />
      </mesh>
      <Glow pos={pos} r={r * 3} k={(t) => 0.6 * clamp01(k(t))} color={color} />
      {segs.map((i) => (
        <Glow key={i} pos={(t) => pos(t - TAU * i)} r={r * (2.6 - (1.8 * i) / tail)} k={(t) => clamp01(k(t)) * moving(t) * 0.7 * (1 - (i - 0.5) / tail)} color={color} />
      ))}
    </>
  )
}
