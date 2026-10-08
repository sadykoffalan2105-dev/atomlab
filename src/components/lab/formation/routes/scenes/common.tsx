/** Общее для сцен путей получения: доступ к частицам модели, подписи по языку, пузырёк газа, рёбра решётки. */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useClockCtx } from '../../showcase/kit/core'
import { byId, clamp01, type Fn, type PFn, type RouteModel, type Tri, type V3 } from '../geom'

export type RouteSceneProps = { model: RouteModel; L: 0 | 1 | 2; tags: Record<string, Tri>; lowPower: boolean }

/** Положение частицы id (+ смещение). */
export const posOf = (m: RouteModel, id: string, off: V3 = [0, 0, 0]): PFn => {
  const p = byId(m, id).pos
  return (t) => {
    const v = p(t)
    return [v[0] + off[0], v[1] + off[1], v[2] + off[2]]
  }
}
export const midOf = (m: RouteModel, a: string, b: string, off: V3 = [0, 0, 0], k = 0.5): PFn => {
  const pa = byId(m, a).pos
  const pb = byId(m, b).pos
  return (t) => {
    const x = pa(t)
    const y = pb(t)
    return [x[0] + (y[0] - x[0]) * k + off[0], x[1] + (y[1] - x[1]) * k + off[1], x[2] + (y[2] - x[2]) * k + off[2]]
  }
}
export const fixed = (p: V3): PFn => () => p

/** Пузырёк газа вокруг точки: прозрачная сфера с бликом. */
export function Bubble({ pos, r, k }: { pos: PFn; r: number; k: Fn }) {
  const g = useRef<THREE.Group>(null)
  const clock = useClockCtx()
  const fill = useMemo(() => new THREE.MeshBasicMaterial({ color: '#7dd3fc', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), [])
  const rim = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uK: { value: 0 }, uC: { value: new THREE.Color('#bae6fd') } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform float uK; uniform vec3 uC; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); gl_FragColor = vec4(uC * f * uK, f * uK); }',
      }),
    [],
  )
  useFrame(() => {
    const gr = g.current
    if (!gr) return
    const t = clock()
    const kk = clamp01(k(t))
    gr.visible = kk > 0.01
    if (!gr.visible) return
    const p = pos(t)
    gr.position.set(p[0], p[1], p[2])
    gr.scale.setScalar(r * (0.6 + 0.4 * kk) * (1 + 0.03 * Math.sin(5 * t)))
    fill.opacity = 0.05 * kk
    rim.uniforms.uK!.value = 0.9 * kk
  })
  return (
    <group ref={g}>
      <mesh material={fill} renderOrder={4}>
        <sphereGeometry args={[1, 32, 20]} />
      </mesh>
      <mesh material={rim} renderOrder={4}>
        <sphereGeometry args={[1, 32, 20]} />
      </mesh>
    </group>
  )
}

/** Мелкие пузырьки газа, поднимающиеся от поверхности: прозрачные колечки (френель), детерминированно по t. */
export function RisingBubbles({ n, from, height, spread, k, r = 0.035 }: { n: number; from: V3; height: number; spread: number; k: Fn; r?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const clock = useClockCtx()
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uK: { value: 0 }, uC: { value: new THREE.Color('#bae6fd') } },
        vertexShader:
          'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * instanceMatrix * vec4(position,1.0); vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform float uK; uniform vec3 uC; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.0); gl_FragColor = vec4(uC * f * uK, f * uK); }',
      }),
    [],
  )
  const geo = useMemo(() => new THREE.SphereGeometry(1, 16, 10), [])
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  useFrame(() => {
    const im = ref.current
    if (!im) return
    const t = clock()
    const kk = clamp01(k(t))
    im.visible = kk > 0.01
    if (!im.visible) return
    mat.uniforms.uK!.value = 0.8 * kk
    for (let i = 0; i < n; i++) {
      const ph = (t * 0.35 + i / n) % 1
      const x = from[0] + spread * Math.sin(i * 2.39996)
      const z = from[2] + spread * 0.6 * Math.cos(i * 2.39996)
      const s = r * (0.6 + 0.5 * (((i * 7) % 5) / 5)) * (0.5 + ph)
      m4.makeScale(s, s, s).setPosition(x + 0.03 * Math.sin(6 * ph + i), from[1] + ph * height, z)
      im.setMatrixAt(i, m4)
    }
    im.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geo, mat, n]} frustumCulled={false} renderOrder={4} />
}

/** Тонкие рёбра между парами частиц (решётка): яркость k(t). */
export function Edges({ model, pairs, k, color = '#9fb4d0' }: { model: RouteModel; pairs: [string, string][]; k: Fn; color?: string }) {
  const clock = useClockCtx()
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pairs.length * 6), 3))
    return g
  }, [pairs])
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }), [color])
  const line = useMemo(() => new THREE.LineSegments(geo, mat), [geo, mat])
  const fns = useMemo(() => pairs.map(([a, b]) => [byId(model, a).pos, byId(model, b).pos] as const), [model, pairs])
  useFrame(() => {
    const t = clock()
    const kk = clamp01(k(t))
    mat.opacity = 0.6 * kk
    line.visible = kk > 0.01
    if (!line.visible) return
    const arr = geo.getAttribute('position') as THREE.BufferAttribute
    fns.forEach(([pa, pb], i) => {
      const a = pa(t)
      const b = pb(t)
      arr.setXYZ(2 * i, a[0], a[1], a[2])
      arr.setXYZ(2 * i + 1, b[0], b[1], b[2])
    })
    arr.needsUpdate = true
  })
  return <primitive object={line} />
}
