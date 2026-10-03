import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { FormationType } from '../../../chemistry/formationScripts'
import type { SchoolHeroModel, V3 } from '../hero/schoolHeroModel'
import { atomPosAt, atomRadiusAt, clamp01, easeInOut, screenToModel, type FormationStory } from './formationStory'
import type { FormationClock } from './formationTimeline'
import { distributeElectrons } from './board/lewis'

/**
 * «Электронные облака» (переключатель на доске, по умолчанию выкл) — поверх 3D «Как образуется».
 * Ковалентные (S, MP): у атомов — облака; у каждой связи — σ: облака сближаются по оси связи и перекрываются
 * (общая область ярче — аддитивное смешение), π (O=O, N≡N, C=O): боковые «гантели» сливаются над и под осью.
 * Неподелённые пары (§ 15): у атома — отдельные «лепестки» по числу пар (валентные e⁻ − e⁻ в связях)/2, направленные
 * по геометрии: у H₂O две пары — тетраэдрически (над плоскостью H–O–H и под ней), у NH₃ одна — в вершину пирамиды,
 * у Cl в Cl₂ / HCl три — «зонтиком» напротив связи, у S в SO₂ одна — по биссектрисе наружу. На телефоне (lowPower) —
 * один лепесток на пару, без π. Большая (кристаллическая) модель — облака только у центральной частицы / формульной
 * единицы (ближайшей к центру), а не выключаются целиком.
 * Ионные (IB, IC, IH) — на этапе перехода e⁻: облако аниона растёт, катиона сжимается.
 * Дёшево: один InstancedMesh эллипсоидов (≤ 200 инстансов), аддитивный материал; положения атомов — те же функции
 * сюжета (atomPosAt / atomRadiusAt) и те же часы; система координат — группа атомов FormationMoleculeView.
 */
const MAX = 200
const C_S = new THREE.Color('#67e8f9')
const C_P = new THREE.Color('#818cf8')
const C_SIGMA = new THREE.Color('#7dd3fc')
// Общая область σ — ярче соседних облаков, но без «засветки» (аддитивно ложится поверх двух σ-облаков).
const C_OVER = new THREE.Color('#e0f2fe').multiplyScalar(0.55)
const C_PI = new THREE.Color('#c084fc').multiplyScalar(0.8)
const C_CAT = new THREE.Color('#fdba74')
const C_AN = new THREE.Color('#93c5fd')
// Неподелённая пара — розовый лепесток (отличается от σ / π) и яркая сердцевина у ядра.
const C_LONE = new THREE.Color('#f472b6').multiplyScalar(2.4)
const C_LONE_CORE = new THREE.Color('#fbcfe8').multiplyScalar(1.3)
/** Сколько ионов / атомов берём у кристалла (центральная формульная единица). */
const UNIT_MAX = 12

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _d = new THREE.Vector3()
const _n = new THREE.Vector3()
const _Y = new THREE.Vector3(0, 1, 0)
const A: V3 = [0, 0, 0]
const B: V3 = [0, 0, 0]
const NB: V3 = [0, 0, 0]
const _sum = new THREE.Vector3()
const _a = new THREE.Vector3()
const _pp = new THREE.Vector3()
const _qq = new THREE.Vector3()
const UPOOL = Array.from({ length: 6 }, () => new THREE.Vector3())
const DIRS = Array.from({ length: 4 }, () => new THREE.Vector3())
const TETRA_HALF = (54.75 * Math.PI) / 180
const UMBRELLA = (70.5 * Math.PI) / 180

/**
 * Направления L неподелённых пар у атома с соседями nbrs (единичные векторы к ним) — по ОЭПВО (школьная геометрия):
 * 1 пара — против суммы связей (NH₃, SO₂, N₂); 2 пары: у атома с одним соседом — в плоскости под 120° (O=, sp²),
 * с двумя — тетраэдрически по обе стороны плоскости связей (H₂O); 3 пары — «зонтик» под 109,5° к связи (Cl₂, HCl).
 */
function loneDirs(units: readonly THREE.Vector3[], L: number, up: THREE.Vector3): THREE.Vector3[] {
  const n = units.length
  _sum.set(0, 0, 0)
  for (const u of units) _sum.add(u)
  _a.copy(_sum).multiplyScalar(-1)
  if (_a.lengthSq() < 1e-6) _a.copy(up)
  _a.normalize()
  // _pp — перпендикуляр к оси в плоскости «вверх экрана» (или плоскости связей), _qq — третья ось
  _pp.copy(up).addScaledVector(_a, -up.dot(_a))
  if (_pp.lengthSq() < 1e-6) _pp.set(1, 0, 0).addScaledVector(_a, -_a.x)
  _pp.normalize()
  const out = DIRS
  const k = Math.min(4, L)
  if (k === 1) out[0]!.copy(_a)
  else if (k === 2 && n >= 2) {
    // H₂O: нормаль к плоскости двух связей
    _qq.crossVectors(units[0]!, units[1]!)
    if (_qq.lengthSq() < 1e-6) _qq.copy(_pp)
    _qq.normalize()
    const half = n === 2 ? TETRA_HALF : (40 * Math.PI) / 180
    out[0]!.copy(_a).multiplyScalar(Math.cos(half)).addScaledVector(_qq, Math.sin(half))
    out[1]!.copy(_a).multiplyScalar(Math.cos(half)).addScaledVector(_qq, -Math.sin(half))
  } else if (k === 2) {
    out[0]!
      .copy(_a)
      .multiplyScalar(Math.cos(Math.PI / 3))
      .addScaledVector(_pp, Math.sin(Math.PI / 3))
    out[1]!
      .copy(_a)
      .multiplyScalar(Math.cos(Math.PI / 3))
      .addScaledVector(_pp, -Math.sin(Math.PI / 3))
  } else {
    _qq.crossVectors(_a, _pp).normalize()
    for (let j = 0; j < k; j++) {
      const f = (2 * Math.PI * j) / k
      out[j]!.copy(_a)
        .multiplyScalar(Math.cos(UMBRELLA))
        .addScaledVector(_pp, Math.sin(UMBRELLA) * Math.cos(f))
        .addScaledVector(_qq, Math.sin(UMBRELLA) * Math.sin(f))
    }
  }
  return out.slice(0, k)
}

/** Центральная частица большой модели: атом, ближайший к центру, и всё, что с ним связано (BFS по связям). */
function centralMolecule(model: SchoolHeroModel, limit: number): Set<number> {
  let c = 0
  let best = Infinity
  model.atoms.forEach((a, i) => {
    const d = a.pos[0] ** 2 + a.pos[1] ** 2 + a.pos[2] ** 2
    if (d < best) ((best = d), (c = i))
  })
  const adj = model.atoms.map(() => [] as number[])
  for (const b of model.bonds) (adj[b.a]!.push(b.b), adj[b.b]!.push(b.a))
  const seen = new Set([c])
  const q = [c]
  while (q.length && seen.size < limit) {
    const x = q.shift()!
    for (const y of adj[x]!) if (!seen.has(y) && seen.size < limit) (seen.add(y), q.push(y))
  }
  return seen
}

/** Центральная формульная единица ионного кристалла: ион у центра + ближайшие ионы, пока заряды не уравняются. */
function centralUnit(model: SchoolHeroModel, ions: { i: number; q: number }[]): Set<number> {
  if (!ions.length) return new Set()
  const d2 = (i: number, j: number) => {
    const a = model.atoms[i]!.pos
    const b = model.atoms[j]!.pos
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
  }
  const c = ions.reduce((m, x) => (model.atoms[x.i]!.pos.reduce((s, v) => s + v * v, 0) < model.atoms[m.i]!.pos.reduce((s, v) => s + v * v, 0) ? x : m), ions[0]!)
  const pick = new Set([c.i])
  let sum = c.q
  while (sum !== 0 && pick.size < UNIT_MAX) {
    const want = sum > 0 ? -1 : 1
    let bestI = -1
    let bestD = Infinity
    for (const x of ions)
      if (!pick.has(x.i) && Math.sign(x.q) === want) {
        const d = d2(c.i, x.i)
        if (d < bestD) ((bestD = d), (bestI = x.i))
      }
    if (bestI < 0) break
    pick.add(bestI)
    sum += ions.find((x) => x.i === bestI)!.q
  }
  return pick
}

type Plan = {
  covalent: boolean
  /** атомы с облаками (у большой модели — только центральная частица) */
  atoms: number[]
  /** неподелённые пары: атом, число пар, соседи */
  lone: { i: number; L: number; nbrs: number[] }[]
  /** инстансов на одну пару: 2 (лепесток + сердцевина), на телефоне — 1 */
  perLone: number
  /** π-гантели (не на телефоне и если хватает инстансов) */
  piOn: boolean
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
      // Неподелённые пары — по модели: (валентные e⁻ − e⁻ в связях) / 2 (как на доске, distributeElectrons).
      const ed = distributeElectrons(
        model.atoms.map((a) => a.el as string),
        model.bonds.map((b) => ({ a: b.a, b: b.b, order: Math.max(1, Math.min(3, b.order)) })),
        0,
      )
      const perLone = lowPower ? 1 : 2
      const build = (sel: Set<number> | null) => {
        const atoms = model.atoms.map((_, i) => i).filter((i) => !sel || sel.has(i))
        const bonds = model.bonds
          .map((b, k) => ({ b, k }))
          .filter(({ b }) => !sel || (sel.has(b.a) && sel.has(b.b)))
          .map(({ b, k }) => {
            const win = story.sticks
              .filter((s) => s.bond === k)
              .sort((x, y) => x.s - y.s)
              .map((s) => [s.t0, s.t1] as [number, number])
            return { a: b.a, b: b.b, order: Math.max(1, Math.min(3, b.order)), win }
          })
        const nb = model.atoms.map(() => [] as number[])
        for (const b of model.bonds) if (!nb[b.a]!.includes(b.b)) (nb[b.a]!.push(b.b), nb[b.b]!.push(b.a))
        const lone = atoms.filter((i) => (ed?.lone[i] ?? 0) > 0 && nb[i]!.length > 0).map((i) => ({ i, L: Math.min(4, ed!.lone[i]!), nbrs: nb[i]! }))
        const base = atoms.length + bonds.length * 3 + lone.reduce((s, x) => s + x.L * perLone, 0)
        return { atoms, bonds, lone, base, pi: bonds.reduce((s, b) => s + 4 * (b.order - 1), 0) }
      }
      let r = build(null)
      // Кристалл / большая модель: облака только у центральной молекулы (не выключать целиком).
      if (r.base > MAX) r = build(centralMolecule(model, 24))
      if (r.base > MAX) return null
      const count = !lowPower && r.base + r.pi <= MAX ? r.base + r.pi : r.base
      return { covalent: true, atoms: r.atoms, lone: r.lone, perLone, piOn: count > r.base, bonds: r.bonds, ions: [], count, window: [window[0], window[1] + 1.2] }
    }
    if (ionicT) {
      const window = stageSpan(story, ['transfer'])
      if (!window) return null
      const bonded = new Set<number>()
      for (const b of model.bonds) (bonded.add(b.a), bonded.add(b.b))
      let all = model.atoms.map((a, i) => ({ i, q: a.charge })).filter((x) => x.q !== 0 && !bonded.has(x.i))
      // Кристалл: только центральная формульная единица (NaCl — пара Na⁺ Cl⁻, Al₂O₃ — 2 Al³⁺ + 3 O²⁻).
      if (model.kind === 'crystal' || all.length > MAX) {
        const unit = centralUnit(model, all)
        all = all.filter((x) => unit.has(x.i))
      }
      const ions = all.map(({ i, q }) => ({ i, sign: (q > 0 ? 1 : -1) as 1 | -1 }))
      if (!ions.length) return null
      return { covalent: false, atoms: [], lone: [], perLone: 0, piOn: false, bonds: [], ions, count: ions.length, window: [window[0] - 0.4, window[1] + 1.5] }
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
    mat.opacity = (plan.covalent ? 0.16 : 0.24) * env
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
      for (const i of plan.atoms) {
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
        if (!plan.piOn) continue
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
                r * (0.75 + v * Math.max(0, (d * 0.5) / Math.max(1e-4, r) - 0.5) * 0.6),
                r * 0.42,
                C_PI,
              )
            }
        }
      }
      // Неподелённые пары: лепесток наружу от атома по геометрии (+ сердцевина у ядра, кроме телефона).
      for (const x of plan.lone) {
        atomPosAt(story, x.i, t, A)
        const r = atomRadiusAt(story, x.i, t, model.atoms[x.i]!.r)
        const units: THREE.Vector3[] = []
        for (let j = 0; j < x.nbrs.length && j < 6; j++) {
          atomPosAt(story, x.nbrs[j]!, t, NB)
          const u = UPOOL[j]!.set(NB[0] - A[0], NB[1] - A[1], NB[2] - A[2])
          if (u.lengthSq() > 1e-8) units.push(u.normalize())
        }
        if (!units.length) continue
        for (const dir of loneDirs(units, x.L, upModel)) {
          put(_p.set(A[0] + dir.x * r * 1.7, A[1] + dir.y * r * 1.7, A[2] + dir.z * r * 1.7), dir, r * 0.8, r * 0.4, C_LONE)
          if (plan.perLone > 1) put(_p.set(A[0] + dir.x * r * 1.25, A[1] + dir.y * r * 1.25, A[2] + dir.z * r * 1.25), dir, r * 0.36, r * 0.22, C_LONE_CORE)
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
