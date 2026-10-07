/**
 * Настольные принадлежности задач-опытов: банка с твёрдым реактивом (этикетка, крышка), лодочка для взвешивания
 * с навеской (порошок, гранулы, стружка), сушильный шкаф с дисплеем температуры и таймером.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { useRig, type PFn, type V3 } from '../../experiments/rigCore'
import { sharedGlass, sharedGlassEdge } from '../../experiments/parts/glassware'
import { createSmallDisplay, jarLabelTexture } from './deviceTextures'

function rand(i: number, k: number): number {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return x - Math.floor(x)
}
const tmp = new THREE.Object3D()

/* ── Банка с твёрдым реактивом ── */

export const JAR = { r: 0.028, h: 0.072, capH: 0.016 } as const

/**
 * Широкогорлая банка (начало — дно): содержимое цвета color (fill — доля высоты), этикетка с формулой; крышка
 * open(p): 0 — закрыта, 1 — снята и лежит рядом вверх дном. amber — тёмное стекло (AgNO₃ и др. светочувствительные).
 */
export function PowderJar({ formula, name, sub = '', color, fill = 0.7, open, amber = false, granules = false }: { formula: string; name: string; sub?: string; color: string; fill?: number; open: PFn; amber?: boolean; granules?: boolean }) {
  const { quality, p } = useRig()
  const glass = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.0001, 0),
      new THREE.Vector2(JAR.r - 0.003, 0),
      new THREE.Vector2(JAR.r, 0.004),
      new THREE.Vector2(JAR.r, JAR.h - 0.012),
      new THREE.Vector2(JAR.r * 0.86, JAR.h - 0.004),
      new THREE.Vector2(JAR.r * 0.86, JAR.h),
    ]
    return new THREE.LatheGeometry(pts, quality === 'high' ? 32 : 18)
  }, [quality])
  const amberMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b3a12', roughness: 0.15, transparent: true, opacity: 0.82 }), [])
  const label = useMemo(() => jarLabelTexture(formula, name, sub, amber ? '#7a4a1c' : '#2f7cf6'), [formula, name, sub, amber])
  const content = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: granules ? 0.4 : 1, metalness: granules ? 0.6 : 0 }), [color, granules])
  const capMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f4f5f6', roughness: 0.5 }), [])
  const cap = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = cap.current
    if (!g) return
    const k = open(p.current ?? 0)
    const up = Math.min(1, k / 0.35)
    const side = Math.min(1, Math.max(0, (k - 0.3) / 0.45))
    const down = Math.min(1, Math.max(0, (k - 0.7) / 0.3))
    g.position.set(0.07 * side, JAR.h + 0.03 * up * (1 - down) + (JAR.capH - JAR.h) * down, 0.01 * side)
    g.rotation.set(Math.PI * Math.min(1, side * 1.2), 0, 0)
  })
  const ch = (JAR.h - 0.012) * fill
  return (
    <group>
      <mesh geometry={glass} material={amber ? amberMat : sharedGlass(quality)} renderOrder={3} />
      {amber ? null : <mesh geometry={glass} material={sharedGlassEdge()} renderOrder={4} />}
      <mesh position={[0, 0.003 + ch / 2, 0]} material={content} renderOrder={1}>
        <cylinderGeometry args={[JAR.r - 0.0022, JAR.r - 0.0022, ch, 24]} />
      </mesh>
      {/* этикетка на передней дуге */}
      <mesh position={[0, JAR.h * 0.46, 0]} renderOrder={5}>
        <cylinderGeometry args={[JAR.r + 0.0006, JAR.r + 0.0006, 0.04, 20, 1, true, -0.85, 1.7]} />
        <meshStandardMaterial map={label} roughness={0.7} />
      </mesh>
      <group ref={cap}>
        <mesh position={[0, -JAR.capH / 2 + 0.008, 0]} material={capMat} castShadow>
          <cylinderGeometry args={[JAR.r * 0.98, JAR.r * 0.98, JAR.capH, 24]} />
        </mesh>
      </group>
    </group>
  )
}

/* ── Лодочка для взвешивания ── */

export const BOAT = { w: 0.056, d: 0.044, h: 0.011, mass: 1.84 } as const

/**
 * Антистатическая лодочка (начало — центр дна): навеска fill(p) 0…1 — порошок горкой, гранулы или стружка по
 * одной (как набирают шпателем). tilt(p) — наклон при пересыпании (рад, вокруг X).
 */
export function WeighBoat({ fill, kind, color, maxPieces = 34 }: { fill: PFn; kind: 'powder' | 'granules' | 'ribbon'; color: string; maxPieces?: number }) {
  const { quality, p } = useRig()
  const plastic = useMemo(() => new THREE.MeshStandardMaterial({ color: '#eef2f6', roughness: 0.55, transparent: true, opacity: 0.92 }), [])
  const solid = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: kind === 'powder' ? 1 : 0.35, metalness: kind === 'powder' ? 0 : 0.7 }), [color, kind])
  const heap = useRef<THREE.Mesh>(null)
  const pieces = useRef<THREE.InstancedMesh>(null)
  const n = quality === 'high' ? maxPieces : Math.ceil(maxPieces * 0.6)
  const seeds = useMemo(() => Array.from({ length: n }, (_, i) => ({ x: (rand(i, 1) - 0.5) * BOAT.w * 0.62, z: (rand(i, 2) - 0.5) * BOAT.d * 0.6, y: rand(i, 3), s: 0.75 + rand(i, 4) * 0.5, r: rand(i, 5) * 6 })), [n])
  useFrame(() => {
    const f = Math.max(0, Math.min(1, fill(p.current ?? 0)))
    if (heap.current) {
      heap.current.visible = kind === 'powder' && f > 0.01
      const s = Math.sqrt(f)
      heap.current.scale.set(s, Math.max(0.05, f), s)
    }
    const im = pieces.current
    if (im) {
      im.visible = kind !== 'powder' && f > 0.01
      if (!im.visible) return
      const shown = Math.round(f * n)
      for (let i = 0; i < n; i++) {
        const sd = seeds[i]!
        tmp.position.set(sd.x, 0.004 + sd.y * 0.004 * (i / n), sd.z)
        tmp.rotation.set(sd.r, sd.r * 1.7, sd.r * 0.4)
        if (kind === 'ribbon') tmp.scale.set(0.009 * sd.s, 0.0006, 0.0022)
        else tmp.scale.setScalar(i < shown ? 0.0032 * sd.s : 1e-6)
        if (kind === 'ribbon' && i >= shown) tmp.scale.setScalar(1e-6)
        tmp.updateMatrix()
        im.setMatrixAt(i, tmp.matrix)
      }
      im.instanceMatrix.needsUpdate = true
    }
  })
  const wall = 0.0012
  return (
    <group>
      <mesh position={[0, 0.0008, 0]} material={plastic} castShadow receiveShadow>
        <boxGeometry args={[BOAT.w * 0.8, 0.0016, BOAT.d * 0.8]} />
      </mesh>
      {/* скошенные стенки */}
      {[
        [0, BOAT.d * 0.45, 0.5, 0],
        [0, -BOAT.d * 0.45, -0.5, 0],
      ].map(([x, z, a], i) => (
        <mesh key={`z${i}`} position={[x!, BOAT.h / 2, z!]} rotation={[a!, 0, 0]} material={plastic}>
          <boxGeometry args={[BOAT.w, BOAT.h * 1.1, wall]} />
        </mesh>
      ))}
      {[
        [BOAT.w * 0.45, 0, -0.5],
        [-BOAT.w * 0.45, 0, 0.5],
      ].map(([x, z, a], i) => (
        <mesh key={`x${i}`} position={[x!, BOAT.h / 2, z!]} rotation={[0, 0, a!]} material={plastic}>
          <boxGeometry args={[wall, BOAT.h * 1.1, BOAT.d]} />
        </mesh>
      ))}
      <mesh ref={heap} position={[0, 0.0016, 0]} material={solid}>
        <coneGeometry args={[0.018, 0.009, 20, 1]} />
      </mesh>
      <instancedMesh ref={pieces} args={[undefined, undefined, n]} material={solid} castShadow frustumCulled={false}>
        {kind === 'granules' ? <dodecahedronGeometry args={[1, 0]} /> : <boxGeometry args={[1, 1, 1]} />}
      </instancedMesh>
    </group>
  )
}

/* ── Сушильный шкаф ── */

export const OVEN = { w: 0.25, h: 0.23, d: 0.22, shelfY: 0.07 } as const

/**
 * Сушильный шкаф (начало — центр основания; дверца к ученику, петли слева). door(p) 0…1 — открыта, on(p) — нагрев,
 * lines(p) — строки дисплея («105 °C», «00:24»). Полка — y = OVEN.shelfY.
 */
export function DryingOven({ door, on, lines }: { door: PFn; on: PFn; lines: (p: number) => readonly string[] }) {
  const { p } = useRig()
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8ebee', roughness: 0.42, metalness: 0.1 }), [])
  const inner = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8d969f', roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide }), [])
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b333b', roughness: 0.5 }), [])
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff8a3c', transparent: true, opacity: 0, depthWrite: false }), [])
  const glassMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c7d6e2', roughness: 0.08, transparent: true, opacity: 0.32, depthWrite: false }), [])
  const disp = useMemo(() => createSmallDisplay(256, 96), [])
  const hinge = useRef<THREE.Group>(null)
  useFrame(() => {
    const pv = p.current ?? 0
    if (hinge.current) hinge.current.rotation.y = -1.75 * door(pv)
    const k = on(pv)
    glow.opacity = 0.18 * k
    disp.draw(k > 0.05 ? lines(pv) : ['', ''])
  })
  const { w, h, d } = OVEN
  const wall = 0.012
  return (
    <group>
      {/* корпус: задняя, боковые, верх, низ (спереди — проём под дверцу) */}
      <mesh position={[0, h / 2, -d / 2 + wall / 2]} material={body} castShadow receiveShadow>
        <boxGeometry args={[w, h, wall]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (w - wall)) / 2, h / 2, 0]} material={body} castShadow receiveShadow>
          <boxGeometry args={[wall, h, d]} />
        </mesh>
      ))}
      <mesh position={[0, h - wall / 2, 0]} material={body} castShadow>
        <boxGeometry args={[w, wall, d]} />
      </mesh>
      <mesh position={[0, 0.02, 0]} material={body} receiveShadow>
        <boxGeometry args={[w, 0.04, d]} />
      </mesh>
      {/* камера и полка-решётка */}
      <mesh position={[0, (h + 0.04) / 2 - 0.01, -d / 2 + wall + 0.001]} material={inner}>
        <planeGeometry args={[w - 2 * wall, h - 0.06]} />
      </mesh>
      <mesh position={[0, OVEN.shelfY - 0.002, 0]} material={inner}>
        <boxGeometry args={[w - 2 * wall - 0.004, 0.003, d - 0.03]} />
      </mesh>
      <mesh position={[0, h / 2, 0]} material={glow}>
        <boxGeometry args={[w - 2 * wall - 0.01, h - 0.07, d - 0.03]} />
      </mesh>
      {/* панель с дисплеем под камерой */}
      <mesh position={[0, 0.02, d / 2 + 0.0008]} material={dark}>
        <planeGeometry args={[w - 0.02, 0.032]} />
      </mesh>
      <mesh position={[-0.04, 0.02, d / 2 + 0.0015]}>
        <planeGeometry args={[0.07, 0.026]} />
        <meshBasicMaterial map={disp.texture} toneMapped={false} />
      </mesh>
      {/* дверца на петлях слева, со стеклом */}
      <group ref={hinge} position={[-w / 2, 0.04, d / 2]}>
        <group position={[w / 2, (h - 0.04) / 2, 0.006]}>
          <RoundedBox args={[w, h - 0.04, 0.012]} radius={0.004} smoothness={2} material={body} castShadow />
          <mesh position={[0, 0.005, 0.0065]} material={glassMat}>
            <planeGeometry args={[w * 0.62, (h - 0.04) * 0.55]} />
          </mesh>
          <mesh position={[w / 2 - 0.022, 0, 0.014]} material={dark} castShadow>
            <boxGeometry args={[0.01, 0.07, 0.012]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

/** Где ставить предмет на полку шкафа (координаты шкафа). */
export const OVEN_SHELF: V3 = [0, OVEN.shelfY, 0]
