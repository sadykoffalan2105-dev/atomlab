/**
 * Детали задач-опытов Kimyo 8 (агент «8b»: Al + H₂SO₄ и раствор HCl): маленькая стеклянная воронка (для заливки
 * бюретки и опрокинутая — для поглощения газа водой), синяя лакмусовая бумажка на белой плитке.
 */
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clamp01, smooth, useRig, type PFn } from '../../../rigCore'
import { sharedGlass, sharedGlassEdge } from '../../../parts/glassware'
import { hoodSash } from '../../../../scene/LabHood'

/**
 * Створка вытяжного шкафа на рабочей высоте: нижняя планка створки не должна закрывать шкалу бюретки или газометра
 * на уровне глаз. После опыта створка возвращается туда, где была.
 */
export function useHoodSashAt(lift: number) {
  useEffect(() => {
    const prev = hoodSash.target
    hoodSash.target = Math.max(prev, lift)
    return () => {
      hoodSash.target = prev
    }
  }, [lift])
}

/** Воронка: начало — конец трубки; конус от радиуса трубки до края rimR на высоте stem + coneH. */
export interface FunnelSize {
  readonly rimR: number
  readonly coneH: number
  readonly stem: number
  readonly stemR: number
}
export const FUNNEL_BURETTE: FunnelSize = { rimR: 0.02, coneH: 0.024, stem: 0.034, stemR: 0.0034 }
export const FUNNEL_ABSORB: FunnelSize = { rimR: 0.0135, coneH: 0.02, stem: 0.03, stemR: 0.0032 }

/** Высота над концом трубки, где радиус конуса снаружи равен r (воронка садится в горло радиуса r). */
export function funnelSeatY(f: FunnelSize, r: number): number {
  return f.stem + (f.coneH * Math.max(0, r - f.stemR)) / (f.rimR - f.stemR)
}

export function SmallFunnel({ size }: { size: FunnelSize }) {
  const { quality } = useRig()
  const geo = useMemo(() => {
    const { rimR, coneH, stem, stemR } = size
    const w = 0.0011
    const pts = [
      new THREE.Vector2(stemR - w, 0),
      new THREE.Vector2(stemR, 0),
      new THREE.Vector2(stemR, stem),
      new THREE.Vector2(rimR, stem + coneH),
      new THREE.Vector2(rimR + 0.0008, stem + coneH + 0.0012),
      new THREE.Vector2(rimR - w, stem + coneH),
      new THREE.Vector2(stemR - w, stem + w),
      new THREE.Vector2(stemR - w, 0.0005),
    ]
    return new THREE.LatheGeometry(pts, quality === 'high' ? 32 : 18)
  }, [size, quality])
  return (
    <group>
      <mesh geometry={geo} material={sharedGlass(quality)} renderOrder={3} />
      <mesh geometry={geo} material={sharedGlassEdge()} renderOrder={4} />
    </group>
  )
}

/** Белая фарфоровая плитка с полоской синей лакмусовой бумаги; red(p) 0…1 — пятно краснеет от капли кислоты. */
export function LitmusTile({ red }: { red: PFn }) {
  const { p } = useRig()
  const tile = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fbfbf8', roughness: 0.35 }), [])
  const paper = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3d63c9', roughness: 0.95 }), [])
  const spot = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3d63c9', roughness: 0.9, transparent: true, opacity: 0 }), [])
  const blue = useMemo(() => new THREE.Color('#3d63c9'), [])
  const pink = useMemo(() => new THREE.Color('#d8394f'), [])
  useFrame(() => {
    const k = smooth(clamp01(red(p.current ?? 0)))
    spot.opacity = k > 0.01 ? 0.25 + 0.75 * k : 0
    spot.color.copy(blue).lerp(pink, k)
  })
  return (
    <group>
      <mesh position={[0, 0.003, 0]} material={tile} castShadow receiveShadow>
        <boxGeometry args={[0.07, 0.006, 0.05]} />
      </mesh>
      <mesh position={[0, 0.0063, 0]} rotation={[-Math.PI / 2, 0, 0]} material={paper}>
        <planeGeometry args={[0.05, 0.012]} />
      </mesh>
      <mesh position={[0.004, 0.0066, 0]} rotation={[-Math.PI / 2, 0, 0]} material={spot}>
        <circleGeometry args={[0.0062, 20]} />
      </mesh>
    </group>
  )
}
