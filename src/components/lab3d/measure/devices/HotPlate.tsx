/**
 * Лабораторная электроплитка с керамической конфоркой, ручкой регулятора и дисплеем температуры конфорки.
 * Без открытого огня — поэтому ею греют там, где выделяется водород. Начало — центр основания на столе;
 * ручка и дисплей — к ученику (+Z). Верх конфорки — HOTPLATE.topY (сюда ставят колбу).
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { useRig, type PFn, type V3 } from '../../experiments/rigCore'
import { createSmallDisplay } from './deviceTextures'

export const HOTPLATE = {
  w: 0.17,
  d: 0.19,
  bodyH: 0.05,
  plateR: 0.068,
  topY: 0.054,
  /** Ручка регулятора (центр, координаты плитки). */
  knob: [0.05, 0.026, 0.095] as V3,
  display: [-0.035, 0.026, 0.095] as V3,
} as const

/**
 * on(p) 0…1 — включена (ручка повёрнута, горит лампа), temp(p) — температура конфорки (°C) на дисплее;
 * конфорка слегка краснеет только выше ~150 °C (при 60 °C — без свечения, как в жизни).
 */
export function HotPlate({ on, temp }: { on: PFn; temp: PFn }) {
  const { p } = useRig()
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: '#eef0f2', roughness: 0.45 }), [])
  const panel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b333b', roughness: 0.5 }), [])
  const ceramic = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1c1f23', roughness: 0.25, metalness: 0.1, emissive: '#ff3a12', emissiveIntensity: 0 }), [])
  const knobMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1e2329', roughness: 0.6 }), [])
  const lamp = useMemo(() => new THREE.MeshBasicMaterial({ color: '#4a1a12', toneMapped: false }), [])
  const disp = useMemo(() => createSmallDisplay(256, 96, '#0f1418', '#ff7a45'), [])
  const knob = useRef<THREE.Group>(null)
  useFrame(() => {
    const pv = p.current ?? 0
    const k = Math.max(0, Math.min(1, on(pv)))
    const t = temp(pv)
    if (knob.current) knob.current.rotation.z = -2.2 * k
    lamp.color.set(k > 0.5 ? '#ff4a2a' : '#4a1a12')
    ceramic.emissiveIntensity = Math.max(0, Math.min(0.6, (t - 150) / 300))
    // выключенная, но ещё горячая конфорка показывает свою температуру (предупреждение «горячо»)
    disp.draw(k > 0.05 || t > 35 ? [`${Math.round(t)} °C`] : ['— —'])
  })
  const { w, d, bodyH } = HOTPLATE
  return (
    <group>
      <RoundedBox args={[w, bodyH, d]} radius={0.008} smoothness={3} position-y={bodyH / 2} material={body} castShadow receiveShadow />
      {/* конфорка */}
      <mesh position={[0, bodyH + 0.002, -0.012]} material={ceramic} receiveShadow>
        <cylinderGeometry args={[HOTPLATE.plateR, HOTPLATE.plateR, 0.004, 40]} />
      </mesh>
      {/* передняя панель: дисплей, лампа, ручка */}
      <mesh position={[0, 0.026, d / 2 + 0.0006]} material={panel}>
        <planeGeometry args={[w - 0.02, 0.034]} />
      </mesh>
      <mesh position={[HOTPLATE.display[0], HOTPLATE.display[1], d / 2 + 0.0014]}>
        <planeGeometry args={[0.056, 0.021]} />
        <meshBasicMaterial map={disp.texture} toneMapped={false} />
      </mesh>
      <mesh position={[0.012, 0.026, d / 2 + 0.0014]} material={lamp}>
        <circleGeometry args={[0.0032, 14]} />
      </mesh>
      <group ref={knob} position={[HOTPLATE.knob[0], HOTPLATE.knob[1], d / 2 + 0.006]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={knobMat} castShadow>
          <cylinderGeometry args={[0.012, 0.013, 0.012, 20]} />
        </mesh>
        <mesh position={[0, 0.006, 0.0065]} material={lamp}>
          <boxGeometry args={[0.0024, 0.009, 0.001]} />
        </mesh>
      </group>
    </group>
  )
}

/** Центр конфорки (координаты плитки) — сюда ставят сосуд. */
export const HOTPLATE_SEAT: V3 = [0, HOTPLATE.topY, -0.012]
