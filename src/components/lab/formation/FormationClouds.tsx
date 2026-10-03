import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { FormationType } from '../../../chemistry/formationScripts'
import type { SchoolHeroModel, V3 } from '../hero/schoolHeroModel'
import { atomPosAt, atomRadiusAt, clamp01, easeInOut, screenToModel, type FormationStory } from './formationStory'
import type { FormationClock } from './formationTimeline'

/**
 * «Электронные облака» (переключатель на доске, по умолчанию выкл) — поверх 3D «Как образуется».
 * Ковалентные (S, MP): у атомов — облака; у каждой связи — σ: облака сближаются по оси связи и перекрываются
 * (общая область ярче — аддитивное смешение), π (O=O, N≡N, C=O): боковые «гантели» сливаются над и под осью.
 * Ионные (IB, IC, IH) — на этапе перехода e⁻: облако аниона растёт, катиона сжимается.
 * Дёшево: один InstancedMesh эллипсоидов (≤ 200 инстансов), аддитивный материал; положения атомов — те же функции
 * сюжета (atomPosAt / atomRadiusAt) и те же часы; система координат — группа атомов FormationMoleculeView.
 */
const MAX = 200
const C_S = new THREE.Color('#67e8f9')
const C_P = new THREE.Color('#818cf8')
const C_SIGMA = new THREE.Color('#7dd3fc')
const C_OVER = new THREE.Color('#e0f2fe')
const C_PI = new THREE.Color('#c084fc')
const C_CAT = new THREE.Color('#fdba74')
const C_AN = new THREE.Color('#93c5fd')

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _d = new THREE.Vector3()
const _n = new THREE.Vector3()
const _Y = new THREE.Vector3(0, 1, 0)
const A: V3 = [0, 0, 0]
const B: V3 = [0, 0, 0]

type Plan = {
  covalent: boolean
  /** связи: модельные индексы, кратность, окна палочек (σ — первая, π — следующие) */
  bonds: { a: number; b: number; order: number; win: [number, number][] }[]
  ions: { i: number; sign: 1 | -1 }[]
  count: number
  window: [number, number]
}

function stageSpan(story: FormationStory, keys: readonly string[]): [number, number] | null {
  let a = Infinity
  let b = -Infinity
  for (const s of story.stages)
    if (keys.includes(s.key)) {
      a = Math.min(a, s.t0)
      b = Math.max(b, s.t0 + s.dur)
    }
  return a < b ? [a, b] : null
}

export function FormationClouds({
  model,
  story,
  clock,
  type,
  lowPower,
}: {
  model: SchoolHeroModel
  story: FormationStory
  clock: MutableRefObject<FormationClock>
  type: FormationType | null
  lowPower: boolean
}) {
  const scene = useThree((s) => s.scene)
  const host = useRef<THREE.Object3D | null>(null)

  const plan = useMemo<Plan | null>(() => {
    const covalent = type === 'S' || type === 'MP'
    const ionicT = type === 'IB' || type === 'IC' || type === 'IH'
    if (covalent) {
      const window = stageSpan(story, ['valence', 'pairs', 'bonds'])
      if (!window) return null
      const bonds = model.bonds.map((b, k) => {
        const win = story.sticks
          .filter((s) => s.bond === k)
          .sort((x, y) => x.s - y.s)
          .map((s) => [s.t0, s.t1] as [number, number])
        return { a: b.a, b: b.b, order: Math.max(1, Math.min(3, b.order)), win }
      })
      const piOn = !lowPower
      let count = model.atoms.length + bonds.length * 3 + (piOn ? bonds.reduce((s, b) => s + 4 * (b.order - 1), 0) : 0)
      if (count > MAX) count = model.atoms.length + bonds.length * 3
      if (count > MAX) return null
      return { covalent: true, bonds, ions: [], count, window: [window[0], window[1] + 1.2] }
    }
    if (ionicT && model.kind === 'molecule') {
      const window = stageSpan(story, ['transfer'])
      if (!window) return null
      const bonded = new Set<number>()
      for (const b of model.bonds) (bonded.add(b.a), bonded.add(b.b))
      const ions = model.atoms
        .map((a, i) => ({ i, sign: (a.charge > 0 ? 1 : -1) as 1 | -1, q: a.charge }))
        .filter((x) => x.q !== 0 && !bonded.has(x.i))
        .slice(0, MAX)
        .map(({ i, sign }) => ({ i, sign }))
      if (!ions.length) return null
      return { covalent: false, bonds: [], ions, count: ions.length, window: [window[0] - 0.4, window[1] + 1.5] }
    }
    return null
  }, [model, story, type, lowPower])

  const res = useMemo(() => {
    if (!plan) return null
    const geo = new THREE.SphereGeometry(1, lowPower ? 12 : 20, lowPower ? 8 : 14)
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    const mesh = new THREE.InstancedMesh(geo, mat, plan.count)
    mesh.name = 'formation-clouds'
    mesh.frustumCulled = false
    mesh.matrixAutoUpdate = false
    mesh.renderOrder = 5
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.setColorAt(0, C_S)
    return { geo, mat, mesh }
  }, [plan, lowPower])

  useEffect(
    () => () => {
      res?.geo.dispose()
      res?.mat.dispose()
      res?.mesh.dispose()
    },
    [res],
  )

  // Ось «вверх» экрана в координатах модели — π-гантели видны сбоку от связи.
  const upModel = useMemo(() => {
    const u = screenToModel(model, [0, 1, 0])
    return new THREE.Vector3(u[0], u[1], u[2]).normalize()
  }, [model])

  useFrame(() => {
    if (!plan || !res) return
    const { mesh, mat } = res
    // Система координат атомов: группа, в которой лежат шары FormationMoleculeView.
    if (!host.current || !host.current.parent) {
      host.current = null
      const view = scene.getObjectByName('formation-view')
      view?.traverse((o) => {
        if (!host.current && (o as THREE.InstancedMesh).isInstancedMesh && o !== mesh) host.current = o.parent
      })
    }
    const h = host.current
    if (!h) {
      mesh.visible = false
      return
    }
    h.updateWorldMatrix(true, false)
    mesh.matrix.copy(h.matrixWorld)
    mesh.matrixWorldNeedsUpdate = true
    const t = clock.current.t
    const [w0, w1] = plan.window
    const env = clamp01((t - w0) / 0.8) * (1 - clamp01((t - w1) / 0.8))
    mesh.visible = env > 0.01
    if (!mesh.visible) return
    mat.opacity = (plan.covalent ? 0.2 : 0.24) * env
    let k = 0
    const put = (c: THREE.Vector3, axis: THREE.Vector3 | null, half: number, wide: number, col: THREE.Color) => {
      if (k >= plan.count) return
      if (axis) _q.setFromUnitVectors(_Y, axis)
      else _q.identity()
      _m.compose(c, _q, _s.set(wide, half, wide))
      mesh.setMatrixAt(k, _m)
      mesh.setColorAt(k, col)
      k++
    }
    if (plan.covalent) {
      // Облака атомов: s (H) — сфера, у остальных — слабое общее облако.
      for (let i = 0; i < model.atoms.length; i++) {
        atomPosAt(story, i, t, A)
        const r = atomRadiusAt(story, i, t, model.atoms[i]!.r)
        const isH = model.atoms[i]!.el === 'H'
        put(_p.set(A[0], A[1], A[2]), null, r * (isH ? 1.45 : 1.3), r * (isH ? 1.45 : 1.3), isH ? C_S : C_P)
      }
      for (const b of plan.bonds) {
        atomPosAt(story, b.a, t, A)
        atomPosAt(story, b.b, t, B)
        const ra = atomRadiusAt(story, b.a, t, model.atoms[b.a]!.r)
        const rb = atomRadiusAt(story, b.b, t, model.atoms[b.b]!.r)
        _d.set(B[0] - A[0], B[1] - A[1], B[2] - A[2])
        const d = Math.max(1e-4, _d.length())
        _d.multiplyScalar(1 / d)
        const sw = b.win[0]
        const u = sw ? easeInOut((t - sw[0]) / Math.max(1e-3, sw[1] - sw[0])) : 0
        // σ: облака тянутся по оси связи навстречу друг другу и перекрываются.
        for (const [P, r, sgn] of [
          [A, ra, 1],
          [B, rb, -1],
        ] as const) {
          const half = r * 0.9 + (Math.max(r * 0.9, d * 0.5) - r * 0.9) * u
          put(_p.set(P[0] + _d.x * half * 0.95 * sgn, P[1] + _d.y * half * 0.95 * sgn, P[2] + _d.z * half * 0.95 * sgn), _d, half, r * (0.55 + 0.12 * u), C_SIGMA)
        }
        const rm = Math.min(ra, rb)
        put(_p.set((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2), _d, Math.max(1e-4, d * 0.32 * u), Math.max(1e-4, rm * 0.5 * u), C_OVER)
        if (plan.count <= model.atoms.length + plan.bonds.length * 3) continue
        // π: боковые гантели (перпендикуляр к оси) — при связывании сливаются над и под осью.
        _n.copy(upModel).addScaledVector(_d, -upModel.dot(_d))
        if (_n.lengthSq() < 1e-6) _n.set(1, 0, 0).addScaledVector(_d, -_d.x)
        _n.normalize()
        for (let j = 1; j < b.order; j++) {
          const pw = b.win[j]
          const v = pw ? easeInOut((t - pw[0]) / Math.max(1e-3, pw[1] - pw[0])) : 0
          const perp = j === 1 ? _n.clone() : _n.clone().cross(_d).normalize()
          const axis = new THREE.Vector3().copy(perp).lerp(_d, v).normalize()
          for (const [P, r, sgn] of [
            [A, ra, 1],
            [B, rb, -1],
          ] as const)
            for (const side of [1, -1]) {
              const off = r * (0.95 - 0.15 * v)
              const along = (d * 0.25 + r * 0.1) * v * sgn
              put(
                _p.set(P[0] + perp.x * off * side + _d.x * along, P[1] + perp.y * off * side + _d.y * along, P[2] + perp.z * off * side + _d.z * along),
                axis,
                r * (0.75 + v * Math.max(0, d * 0.5 / Math.max(1e-4, r) - 0.5) * 0.6),
                r * 0.42,
                C_PI,
              )
            }
        }
      }
    } else {
      // Ионные: переход e⁻ — облако катиона сжимается, аниона растёт.
      const iw = story.ionWin
      const u = Number.isFinite(iw[0]) ? easeInOut((t - iw[0]) / Math.max(1e-3, iw[1] - iw[0])) : 0
      for (const x of plan.ions) {
        atomPosAt(story, x.i, t, A)
        const r = atomRadiusAt(story, x.i, t, model.atoms[x.i]!.r)
        const f = x.sign > 0 ? 1.75 + (1.15 - 1.75) * u : 1.2 + (1.75 - 1.2) * u
        put(_p.set(A[0], A[1], A[2]), null, r * f, r * f, x.sign > 0 ? C_CAT : C_AN)
      }
    }
    for (let z = k; z < plan.count; z++) {
      _m.makeScale(0, 0, 0)
      mesh.setMatrixAt(z, _m)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return res ? <primitive object={res.mesh} /> : null
}
