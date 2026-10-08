/**
 * U-образная хлоркальциевая трубка на подставке: два колена с гранулами безводного CaCl₂ (белые, пористые),
 * сверху — резиновые пробки, у верха каждого колена — боковой отвод (на него надевают шланг). Газ входит в левый
 * отвод, проходит через гранулы (вода поглощается: CaCl₂ + 6H₂O → CaCl₂·6H₂O — гранулы влажнеют, блестят)
 * и выходит из правого. Подставка: основание, стойка и пружинный зажим на изгибе — трубку взвешивают вместе с ней.
 * Начало — центр основания на столе; колена в плоскости XY (лицом к ученику).
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useRig, type PFn, type V3 } from '../../experiments/rigCore'
import { sharedGlass, sharedGlassEdge } from '../../experiments/parts/glassware'
import { useOwned } from './deviceTextures'

/** Размеры (м): half — половина расстояния между коленами, arm — высота колен над изгибом, y0 — низ изгиба. */
export const UTUBE = {
  half: 0.022,
  ro: 0.0072,
  ri: 0.0062,
  y0: 0.03,
  arm: 0.1,
  side: 0.024,
  baseW: 0.09,
  baseD: 0.06,
} as const

/** Концы боковых отводов (сюда надевают шланги): вход — слева, выход — справа. Ось отвода — ±X. */
export const UTUBE_IN: V3 = [-UTUBE.half - UTUBE.side, UTUBE.y0 + UTUBE.ro + UTUBE.arm - 0.022, 0]
export const UTUBE_OUT: V3 = [UTUBE.half + UTUBE.side, UTUBE.y0 + UTUBE.ro + UTUBE.arm - 0.022, 0]

function rand(i: number, k: number): number {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return x - Math.floor(x)
}
const tmp = new THREE.Object3D()

export function UTube({ wet }: { wet: PFn }) {
  const { quality, p } = useRig()
  const U = UTUBE
  const bendY = U.y0 + U.ro
  const topY = bendY + U.arm
  const glassGeo = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector3>()
    path.add(new THREE.LineCurve3(new THREE.Vector3(-U.half, topY, 0), new THREE.Vector3(-U.half, bendY + U.half, 0)))
    path.add(new THREE.CubicBezierCurve3(new THREE.Vector3(-U.half, bendY + U.half, 0), new THREE.Vector3(-U.half, bendY - U.half * 0.33, 0), new THREE.Vector3(U.half, bendY - U.half * 0.33, 0), new THREE.Vector3(U.half, bendY + U.half, 0)))
    path.add(new THREE.LineCurve3(new THREE.Vector3(U.half, bendY + U.half, 0), new THREE.Vector3(U.half, topY, 0)))
    return new THREE.TubeGeometry(path, quality === 'high' ? 72 : 36, U.ro, quality === 'high' ? 14 : 10, false)
  }, [quality, U.half, U.ro, bendY, topY])
  const sideGeo = useMemo(() => {
    const y = UTUBE_IN[1]
    const mk = (s: number) => new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(s * U.half, y, 0), new THREE.Vector3(s * (U.half + U.side), y, 0)), 4, 0.0028, 8, false)
    return [mk(-1), mk(1)]
  }, [U.half, U.side])
  const stand = useOwned(() => new THREE.MeshStandardMaterial({ color: '#4f5b68', roughness: 0.55, metalness: 0.2 }), [])
  const rubber = useOwned(() => new THREE.MeshStandardMaterial({ color: '#5f6670', roughness: 0.85 }), [])
  const salt = useOwned(() => new THREE.MeshStandardMaterial({ color: '#f4f3ee', roughness: 0.85 }), [])
  const dry = useMemo(() => new THREE.Color('#f4f3ee'), [])
  const wetC = useMemo(() => new THREE.Color('#d9dcd6'), [])
  // гранулы: заполняют оба колена и изгиб до 2 см ниже отводов (вата сверху не даёт им высыпаться)
  const n = quality === 'high' ? 150 : 70
  const grains = useMemo(() => {
    const out: { x: number; y: number; z: number; s: number; r: number; left: boolean }[] = []
    for (let i = 0; i < n; i++) {
      const u = rand(i, 1)
      const a = rand(i, 2) * Math.PI * 2
      const rr = Math.sqrt(rand(i, 3)) * (U.ri - 0.0018)
      let x: number
      let y: number
      if (u < 0.16) {
        // изгиб: по полуокружности
        const t = rand(i, 4) * Math.PI
        x = -Math.cos(t) * U.half * 0.92
        y = bendY + U.half * 0.35 - Math.sin(t) * U.half * 0.55
      } else {
        const left = u < 0.58
        x = (left ? -1 : 1) * U.half
        y = bendY + U.half * 0.4 + rand(i, 5) * (U.arm - U.half * 0.4 - 0.03)
      }
      out.push({ x: x + Math.cos(a) * rr, y, z: Math.sin(a) * rr, s: 0.0017 + rand(i, 6) * 0.0012, r: rand(i, 7) * 6, left: x < 0 })
    }
    return out
  }, [n, U.ri, U.half, U.arm, bendY])
  const im = useRef<THREE.InstancedMesh>(null)
  useFrame(() => {
    const m = im.current
    if (!m) return
    const k = wet(p.current ?? 0)
    salt.color.copy(dry).lerp(wetC, Math.min(1, k))
    salt.roughness = 0.85 - 0.5 * Math.min(1, k)
    if (m.userData.done) return
    grains.forEach((g, i) => {
      tmp.position.set(g.x, g.y, g.z)
      tmp.rotation.set(g.r, g.r * 1.3, g.r * 0.7)
      tmp.scale.setScalar(g.s)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    m.userData.done = true
  })
  return (
    <group>
      {/* подставка: основание, стойка, зажим на изгибе */}
      <mesh position={[0, 0.006, 0]} material={stand} castShadow receiveShadow>
        <boxGeometry args={[U.baseW, 0.012, U.baseD]} />
      </mesh>
      <mesh position={[0, (0.012 + U.y0 + 0.004) / 2, -0.012]} material={stand} castShadow>
        <boxGeometry args={[0.012, U.y0 - 0.008 + 0.012, 0.01]} />
      </mesh>
      <mesh position={[0, U.y0 + 0.006, -0.004]} rotation={[0, 0, Math.PI / 2]} material={stand}>
        <torusGeometry args={[U.ro + 0.0015, 0.0018, 6, 16, Math.PI]} />
      </mesh>
      <mesh geometry={glassGeo} material={sharedGlass(quality)} renderOrder={3} />
      <mesh geometry={glassGeo} material={sharedGlassEdge()} renderOrder={4} />
      {sideGeo.map((g, i) => (
        <group key={i}>
          <mesh geometry={g} material={sharedGlass(quality)} renderOrder={3} />
          <mesh geometry={g} material={sharedGlassEdge()} renderOrder={4} />
        </group>
      ))}
      {/* пробки на коленах */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * U.half, topY + 0.004, 0]} material={rubber} castShadow>
          <cylinderGeometry args={[U.ro + 0.0012, U.ri, 0.014, 16]} />
        </mesh>
      ))}
      {/* вата над гранулами */}
      {[-1, 1].map((s) => (
        <mesh key={`w${s}`} position={[s * U.half, topY - 0.024, 0]}>
          <cylinderGeometry args={[U.ri * 0.92, U.ri * 0.92, 0.006, 12]} />
          <meshStandardMaterial color="#fbfbf8" roughness={1} />
        </mesh>
      ))}
      <instancedMesh ref={im} args={[undefined, undefined, n]} material={salt} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 0]} />
      </instancedMesh>
    </group>
  )
}
