/**
 * Kit сцены SiO₂: примитивы каркаса и окружения (всё — функции времени t сценария, перемотка безопасна).
 *  • TetraFaces — полупрозрачные грани тетраэдров SiO₄ ОДНИМ мешем (BufferGeometry треугольников, альфа на вершину:
 *    волна подсветки расходится от центрального тетраэдра к соседним). Положения вершин — по живым позициям атомов.
 *  • HexPrism — контур кристалла кварца (шестигранная призма с пирамидальными головками) — LineSegments.
 *  • SandGrains — «песок»: мягкие точки-зёрна вокруг модели (Points).
 *  • DecorTetra — декоративные контуры тетраэдров вокруг модели: порядок (кварц) → беспорядок (стекло).
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { V3 } from '../../../hero/schoolHeroModel'
import { softTexture, useClockCtx, type TFn } from './core'

export type Tetra = { si: number; o: [number, number, number, number] }

/** Грани тетраэдров: alpha(j, t) — прозрачность j-го тетраэдра 0…1; posAt(i, t, out) — живое положение атома. */
export function TetraFaces({ tetras, posAt, alpha, color = '#67e8f9' }: { tetras: Tetra[]; posAt: (i: number, t: number, out: V3) => V3; alpha: (j: number, t: number) => number; color?: string }) {
  const ref = useRef<THREE.Mesh>(null)
  const clock = useClockCtx()
  const { geo, mat } = useMemo(() => {
    const n = tetras.length * 4 * 3
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(n), 1))
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(color) } },
      vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ if (vA < 0.003) discard; gl_FragColor = vec4(uColor, vA); }',
    })
    return { geo: g, mat: m }
  }, [tetras.length, color])
  const tmp = useMemo(() => [0, 0, 0] as V3, [])
  const P = useMemo(() => Array.from({ length: 4 }, () => [0, 0, 0] as V3), [])
  // 4 грани тетраэдра по индексам вершин O
  const FACES = useMemo(() => [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]] as const, [])
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const t = clock()
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const aa = geo.getAttribute('aA') as THREE.BufferAttribute
    let any = false
    let v = 0
    for (let j = 0; j < tetras.length; j++) {
      const a = Math.max(0, Math.min(1, alpha(j, t)))
      const tt = tetras[j]!
      if (a > 0.003) {
        any = true
        for (let k = 0; k < 4; k++) {
          posAt(tt.o[k]!, t, tmp)
          P[k]![0] = tmp[0]
          P[k]![1] = tmp[1]
          P[k]![2] = tmp[2]
        }
      }
      for (const f of FACES) {
        for (let k = 0; k < 3; k++) {
          const p = P[f[k]!]!
          if (a > 0.003) pos.setXYZ(v, p[0], p[1], p[2])
          aa.setX(v, a)
          v++
        }
      }
    }
    m.visible = any
    pos.needsUpdate = true
    aa.needsUpdate = true
  })
  return <mesh ref={ref} geometry={geo} material={mat} renderOrder={4} frustumCulled={false} />
}

/** Контур кристалла кварца: шестигранная призма радиуса r, высота ±h вдоль оси axis, пирамидальные головки tip. */
export function HexPrism({ r, h, tip, axis, k, color = '#bae6fd' }: { r: number; h: number; tip: number; axis: V3; k: TFn; color?: string }) {
  const clock = useClockCtx()
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }), [color])
  const geo = useMemo(() => {
    const ax = new THREE.Vector3(axis[0], axis[1], axis[2]).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), ax)
    const pts: THREE.Vector3[] = []
    const ring = (y: number) => Array.from({ length: 6 }, (_, i) => new THREE.Vector3(Math.cos((i * Math.PI) / 3) * r, y, Math.sin((i * Math.PI) / 3) * r).applyQuaternion(q))
    const top = ring(h)
    const bot = ring(-h)
    const apexT = new THREE.Vector3(0, h + tip, 0).applyQuaternion(q)
    const apexB = new THREE.Vector3(0, -h - tip, 0).applyQuaternion(q)
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6
      pts.push(top[i]!, top[j]!, bot[i]!, bot[j]!, top[i]!, bot[i]!, top[i]!, apexT, bot[i]!, apexB)
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [r, h, tip, axis])
  const obj = useMemo(() => new THREE.LineSegments(geo, mat), [geo, mat])
  useFrame(() => {
    const kk = Math.max(0, Math.min(1, k(clock())))
    obj.visible = kk > 0.005
    mat.opacity = 0.85 * kk
  })
  return <primitive object={obj} />
}

const hash = (i: number, s: number) => {
  const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Зёрна песка: n мягких точек в сферическом слое радиусов [r0, r1]; k(t) — яркость. */
export function SandGrains({ n, r0, r1, k, size = 0.3, color = '#fcd9a0' }: { n: number; r0: number; r1: number; k: TFn; size?: number; color?: string }) {
  const clock = useClockCtx()
  const { geo, mat } = useMemo(() => {
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const u = 2 * hash(i, 1) - 1
      const ph = hash(i, 2) * Math.PI * 2
      const rr = r0 + (r1 - r0) * Math.cbrt(hash(i, 3))
      const s = Math.sqrt(Math.max(0, 1 - u * u))
      arr[i * 3] = Math.cos(ph) * s * rr
      arr[i * 3 + 1] = u * rr * 0.75
      arr[i * 3 + 2] = Math.sin(ph) * s * rr
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    const m = new THREE.PointsMaterial({ map: softTexture(), color, size, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending })
    return { geo: g, mat: m }
  }, [n, r0, r1, size, color])
  const obj = useMemo(() => new THREE.Points(geo, mat), [geo, mat])
  useFrame(() => {
    const t = clock()
    const kk = Math.max(0, Math.min(1, k(t)))
    obj.visible = kk > 0.005
    mat.opacity = 0.9 * kk
    // зёрна чуть «оседают» со временем (функция t — без накопления)
    obj.rotation.y = 0.05 * t
  })
  return <primitive object={obj} />
}

/**
 * Декоративные контуры тетраэдров (6 рёбер каждый) вокруг модели: центры на двух кольцах радиуса R, одинаковая
 * ориентация (порядок — кварц); disorder(t) 0…1 — поворот и сдвиг каждого по псевдослучайному ключу (стекло).
 */
export function DecorTetra({ count, R, edge, k, disorder, color = '#a5f3fc' }: { count: number; R: number; edge: number; k: TFn; disorder: TFn; color?: string }) {
  const clock = useClockCtx()
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }), [color])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 12 * 3), 3))
    return g
  }, [count])
  const obj = useMemo(() => new THREE.LineSegments(geo, mat), [geo, mat])
  // вершины правильного тетраэдра (ребро edge) и 6 рёбер
  const V = useMemo(() => {
    const s = edge / Math.sqrt(8)
    return [new THREE.Vector3(s, s, s), new THREE.Vector3(s, -s, -s), new THREE.Vector3(-s, s, -s), new THREE.Vector3(-s, -s, s)]
  }, [edge])
  const E = useMemo(() => [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]] as const, [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const e = useMemo(() => new THREE.Euler(), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const t = clock()
    const kk = Math.max(0, Math.min(1, k(t)))
    obj.visible = kk > 0.005
    mat.opacity = 0.8 * kk
    if (!obj.visible) return
    const d = Math.max(0, Math.min(1, disorder(t)))
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    let v = 0
    const half = Math.ceil(count / 2)
    for (let i = 0; i < count; i++) {
      const ring = i < half ? 0 : 1
      const j = ring === 0 ? i : i - half
      const nRing = ring === 0 ? half : count - half
      const ang = (j / nRing) * Math.PI * 2 + ring * (Math.PI / nRing)
      const cy = ring === 0 ? 0.55 : -0.55
      // порядок: все одинаково ориентированы; беспорядок: поворот и сдвиг по ключу
      e.set(d * (hash(i, 4) - 0.5) * 2.6, d * (hash(i, 5) - 0.5) * 2.6, d * (hash(i, 6) - 0.5) * 2.6)
      q.setFromEuler(e)
      const cx = Math.cos(ang) * R + d * (hash(i, 7) - 0.5) * 0.9
      const cz = Math.sin(ang) * R + d * (hash(i, 8) - 0.5) * 0.9
      const cyy = cy + d * (hash(i, 9) - 0.5) * 0.9
      for (const [a, b] of E) {
        tmp.copy(V[a]!).applyQuaternion(q)
        pos.setXYZ(v++, cx + tmp.x, cyy + tmp.y, cz + tmp.z)
        tmp.copy(V[b]!).applyQuaternion(q)
        pos.setXYZ(v++, cx + tmp.x, cyy + tmp.y, cz + tmp.z)
      }
    }
    pos.needsUpdate = true
  })
  return <primitive object={obj} />
}
