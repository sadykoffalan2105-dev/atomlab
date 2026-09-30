import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { FormationPlan } from '../../../chemistry/formationPlan'
import { pmToScene } from '../../../lab/cinema/scenes/kit/cpkAtoms'
import { SCHOOL_DRAW } from '../../../lab/cinema/scenes/school/schoolModel'
import { HERO_ORBIT_RAD_PER_SEC } from '../hero/heroFrame'
import { SchoolBallLabels } from '../hero/SchoolBallLabels'
import type { SchoolHeroAtom, SchoolHeroModel, V3 } from '../hero/schoolHeroModel'
import {
  createSchoolMatteMaterial,
  SCHOOL_EDGE_HEX,
  SCHOOL_STICK_HEX,
  schoolAtomColor,
  schoolSphereGeometry,
  schoolStickGeometry,
} from '../hero/schoolHeroStyle'
import { clamp01, easeAttract, easeInOut, formationTimeline, stepAt, type FormationClock } from './formationTimeline'

/**
 * «Как образуется» в 3D карточки каталога: тот же школьный вид (матовые шары, символы в шарах, серые палочки),
 * что и SchoolMoleculeView, но частицы модели разнесены и собираются по плану formationPlan:
 *  1 Состав — частицы по отдельности (ионы-«корни» уже собраны внутри);
 *  2 Заряды / валентности — подписи ионов (Na⁺), значки многоатомных ионов (SO₄²⁻) или валентностей (VI);
 *  3 Сборка — молекула: атомы подходят, связи вырастают по одной; ионное: ионы притягиваются без палочек;
 *  4 Готово — модель как в обычном 3D, мягкое покачивание (кристалл — облёт) и рёбра ячеек.
 * Координаты и радиусы — модели buildSchoolHeroModel (ничего не придумывается), меняется только путь частиц.
 */

const K = pmToScene(1)
const SWAY_AMP = 0.3
const SWAY_PERIOD = 14

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

type BondAnim = { a: number; b: number; n: number; side: THREE.Vector3 | null; t0: number; t1: number }
type AtomAnim = { t0: number; t1: number }
/** group — многоатомный ион (весь показ); water — кристаллизационная вода (шаги 1–2); valence — валентность (шаг 2 и начало сборки). */
type Badge = { text: string; atoms: number[]; fromStep: number; kind: 'group' | 'water' | 'valence' }

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

/** Смещение кратных палочек (в плоскости σ-соседей, иначе ⟂ оси и Z) — по итоговой геометрии. */
function sideFor(model: SchoolHeroModel, a: number, b: number, nbrs: number[][]): THREE.Vector3 {
  const A = new THREE.Vector3(...model.atoms[a]!.pos)
  const B = new THREE.Vector3(...model.atoms[b]!.pos)
  const axis = B.clone().sub(A).normalize()
  for (const [end, other] of [[a, b], [b, a]] as const) {
    for (const nb of nbrs[end]!) {
      if (nb === other) continue
      const v = new THREE.Vector3(...model.atoms[nb]!.pos).sub(new THREE.Vector3(...model.atoms[end]!.pos))
      v.addScaledVector(axis, -v.dot(axis))
      if (v.lengthSq() > 1e-8) return v.normalize()
    }
  }
  const s = new THREE.Vector3(0, 0, 1).cross(axis)
  if (s.lengthSq() < 1e-8) s.set(0, 1, 0).cross(axis)
  return s.normalize()
}

export function FormationMoleculeView({
  model,
  plan,
  clock,
  fitRadius,
  lowPower = false,
}: {
  model: SchoolHeroModel
  plan: FormationPlan
  clock: MutableRefObject<FormationClock>
  fitRadius: number
  lowPower?: boolean
}) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const outer = useRef<THREE.Group>(null)
  const turnA = useRef<THREE.Group>(null)
  const turnB = useRef<THREE.Group>(null)
  const labelOpacity = useRef(1)
  const swayT = useRef(0)
  const [ionLabels, setIonLabels] = useState(false)
  const crystal = model.kind === 'crystal'
  const tl = useMemo(() => formationTimeline(plan), [plan])

  const anim = useMemo(() => {
    const n = model.atoms.length
    const final = model.atoms.map((a) => [...a.pos] as V3)
    const live = model.atoms.map((a) => [...a.pos] as V3)
    const start = model.atoms.map((a) => [...a.pos] as V3)
    const atomT: AtomAnim[] = model.atoms.map(() => ({ t0: 0, t1: 0.5 }))
    const nbrs: number[][] = model.atoms.map(() => [])
    for (const b of model.bonds) {
      nbrs[b.a]!.push(b.b)
      nbrs[b.b]!.push(b.a)
    }
    let maxD = 0
    for (const p of final) maxD = Math.max(maxD, Math.hypot(p[0], p[1], p[2]))
    const bonds: BondAnim[] = []
    if (plan.mode === 'molecular') {
      // Разлёт: атомы от центра наружу (центральный атом остаётся на месте); решётка — ровно, без шума.
      const E = crystal ? 1.5 : 1.9
      final.forEach((p, i) => {
        const d = Math.hypot(p[0], p[1], p[2])
        const k = d < 0.2 * maxD ? 1 : E
        start[i] = [p[0] * k, p[1] * k, p[2] * k]
      })
      // Связи по одной (порядок плана), атом приходит к своей первой связи.
      const nb = Math.max(1, plan.bondOrder.length)
      const dt = 1 / nb
      const placed = new Set<number>()
      plan.bondOrder.forEach((k, slot) => {
        const b = model.bonds[k]!
        const t0 = slot * dt
        for (const x of [b.a, b.b]) {
          if (placed.has(x)) continue
          placed.add(x)
          atomT[x] = { t0, t1: t0 + 0.7 * dt }
        }
        bonds.push({ a: b.a, b: b.b, n: Math.max(1, Math.min(3, Math.round(b.order))), side: null, t0: t0 + 0.45 * dt, t1: t0 + dt })
      })
      for (let i = 0; i < n; i++) if (!placed.has(i)) atomT[i] = { t0: 0, t1: 0.5 }
    } else {
      // Ионное: частица (ион / «корень» / H₂O) уходит от центра целиком, без поворота.
      const E = crystal ? 1.55 : 2.0
      const order = plan.unitOrder
      const m = Math.max(1, order.length)
      order.forEach((ui, j) => {
        const u = plan.units[ui]!
        const c: V3 = [0, 0, 0]
        for (const a of u.atoms) for (let q = 0; q < 3; q++) c[q] += final[a]![q]! / u.atoms.length
        const d = Math.hypot(c[0], c[1], c[2])
        const k = d < 0.15 * maxD ? 0 : E - 1
        for (const a of u.atoms) start[a] = [final[a]![0] + c[0] * k, final[a]![1] + c[1] * k, final[a]![2] + c[2] * k]
        // Решётка сжимается слоями (ближние к центру — раньше), отдельные ионы приходят по очереди.
        const dur = crystal ? 0.45 : m === 1 ? 1 : 0.55
        const t0 = m === 1 ? 0 : crystal ? 0.55 * (d / Math.max(1e-6, maxD)) : ((1 - dur) * j) / (m - 1)
        for (const a of u.atoms) atomT[a] = { t0, t1: t0 + dur }
      })
      // Ковалентные связи внутри «корней» — с самого начала (корень уже собран).
      const inner = new Set(plan.bondOrder)
      model.bonds.forEach((b, k) => {
        if (inner.has(k)) bonds.push({ a: b.a, b: b.b, n: Math.max(1, Math.min(3, Math.round(b.order))), side: null, t0: -1, t1: -1 })
      })
    }
    for (const b of bonds) if (b.n > 1) b.side = sideFor(model, b.a, b.b, nbrs)
    const rEnd = model.radius
    // Подписи: шаг 1 — символы элементов, со 2-го — ионы (Na⁺) у одноатомных ионов. Позиции общие (live).
    const neutral: SchoolHeroAtom[] = model.atoms.map((a, i) => ({ ...a, label: a.el, pos: live[i]! }))
    const unitOf = new Map<number, number>()
    plan.units.forEach((u, i) => u.atoms.forEach((a) => unitOf.set(a, i)))
    const ionic: SchoolHeroAtom[] = model.atoms.map((a, i) => {
      const u = plan.units[unitOf.get(i) ?? -1]
      const s = u ? plan.species[u.species] : undefined
      const label = s && u!.atoms.length === 1 && s.charge !== 0 ? s.formula : a.el
      return { ...a, label, pos: live[i]! }
    })
    // Значки: многоатомные ионы и H₂O (ионное) или валентности атомов (молекула до 24 атомов).
    const badges: Badge[] = []
    if (plan.mode === 'ionic' && !crystal) {
      for (const u of plan.units) {
        const s = plan.species[u.species]
        if (s && u.atoms.length > 1) badges.push({ text: s.formula, atoms: u.atoms, fromStep: 0, kind: s.kind === 'molecule' ? 'water' : 'group' })
      }
    } else if (plan.mode === 'molecular' && n <= 24) {
      const sums = model.atoms.map(() => 0)
      for (const b of model.bonds) {
        sums[b.a]! += b.order
        sums[b.b]! += b.order
      }
      model.atoms.forEach((a, i) => {
        const s = plan.species.find((x) => x.formula === a.el)
        const vals = s?.valences ?? []
        const v = vals.length === 1 ? vals[0]! : vals.includes(sums[i]!) ? sums[i]! : vals[0]
        if (v) badges.push({ text: ROMAN[v] ?? String(v), atoms: [i], fromStep: 1, kind: 'valence' })
      })
    }
    return { final, live, start, atomT, bonds, rEnd, neutral, ionic, badges }
  }, [model, plan, crystal])

  // Меши: шары, палочки, рёбра ячеек.
  const res = useMemo(() => {
    const atomMat = createSchoolMatteMaterial()
    const atoms = new THREE.InstancedMesh(schoolSphereGeometry(lowPower), atomMat, Math.max(1, model.atoms.length))
    atoms.frustumCulled = false
    const col = new THREE.Color()
    model.atoms.forEach((a, i) => atoms.setColorAt(i, schoolAtomColor(a.el, col)))
    const stickMat = createSchoolMatteMaterial(SCHOOL_STICK_HEX.dark)
    const nSticks = anim.bonds.reduce((s, b) => s + b.n, 0)
    const sticks = new THREE.InstancedMesh(schoolStickGeometry(), stickMat, Math.max(1, nSticks))
    sticks.frustumCulled = false
    sticks.count = 0
    let edges: THREE.LineSegments | null = null
    if (model.cellEdges.length > 0) {
      const pos = new Float32Array(model.cellEdges.length * 6)
      model.cellEdges.forEach(([p, q], i) => pos.set([p[0], p[1], p[2], q[0], q[1], q[2]], i * 6))
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      edges = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: SCHOOL_EDGE_HEX.dark, transparent: true, opacity: 0, depthWrite: false, fog: false }))
      edges.frustumCulled = false
    }
    return { atoms, atomMat, sticks, stickMat, edges }
  }, [model, anim, lowPower])

  useEffect(
    () => () => {
      res.atomMat.dispose()
      res.stickMat.dispose()
      res.atoms.dispose()
      res.sticks.dispose()
      if (res.edges) {
        res.edges.geometry.dispose()
        ;(res.edges.material as THREE.Material).dispose()
      }
    },
    [res],
  )

  // Слой значков (SO₄²⁻, валентности): DOM поверх холста, как символы в шарах.
  const badgeEls = useRef<{ el: HTMLDivElement; shown: boolean; x: number; y: number }[]>([])
  useEffect(() => {
    const host = gl.domElement.parentElement
    if (!host || anim.badges.length === 0) return
    const layer = document.createElement('div')
    layer.setAttribute('aria-hidden', 'true')
    layer.dataset.formationBadges = ''
    layer.style.cssText = 'position:absolute; inset:0; pointer-events:none; overflow:hidden; z-index:3; contain:strict;'
    badgeEls.current = anim.badges.map((b) => {
      const el = document.createElement('div')
      el.textContent = b.text
      el.dataset.formationBadge = b.kind
      el.style.cssText =
        'position:absolute; left:0; top:0; white-space:nowrap; display:none; will-change:transform,opacity; transition:opacity .35s ease;' +
        'font-family:"Inter", system-ui, sans-serif; font-weight:700; line-height:1; border-radius:999px;' +
        (b.kind === 'group'
          ? 'font-size:15px; padding:5px 10px; color:#fde68a; background:rgba(12,16,32,0.78); border:1px solid rgba(251,191,36,0.55);'
          : b.kind === 'water'
            ? 'font-size:12px; padding:3px 8px; color:#e2e8f0; background:rgba(12,16,32,0.72); border:1px solid rgba(148,163,184,0.5);'
            : 'font-size:12px; padding:3px 7px; color:#bae6fd; background:rgba(12,16,32,0.8); border:1px solid rgba(125,211,252,0.55);')
      layer.appendChild(el)
      return { el, shown: false, x: NaN, y: NaN }
    })
    host.appendChild(layer)
    return () => {
      badgeEls.current = []
      layer.remove()
    }
  }, [gl, anim])

  const lastStep = useRef(-1)

  useFrame((_, dt) => {
    const c = clock.current
    const t = c.t
    const step = stepAt(tl, t)
    if (step !== lastStep.current) {
      lastStep.current = step
      const wantIons = step >= 1
      if (wantIons !== ionLabels) setIonLabels(wantIons)
    }
    if (c.playing) swayT.current += Math.min(0.1, Math.max(0, dt))
    const f = clamp01((t - tl.starts[2]) / tl.assembly)
    // Положения частиц.
    const { final, live, start, atomT } = anim
    for (let i = 0; i < live.length; i++) {
      const w = atomT[i]!
      const u = plan.mode === 'ionic' ? easeAttract((f - w.t0) / Math.max(1e-6, w.t1 - w.t0)) : easeInOut((f - w.t0) / Math.max(1e-6, w.t1 - w.t0))
      const s = start[i]!
      const e = final[i]!
      const L = live[i]!
      L[0] = s[0] + (e[0] - s[0]) * u
      L[1] = s[1] + (e[1] - s[1]) * u
      L[2] = s[2] + (e[2] - s[2]) * u
      _m.compose(_p.set(L[0], L[1], L[2]), _q.identity(), _s.setScalar(model.atoms[i]!.r))
      res.atoms.setMatrixAt(i, _m)
    }
    res.atoms.instanceMatrix.needsUpdate = true
    // Палочки: растут от середины связи.
    const r = SCHOOL_DRAW.stickR * K
    const stepD = SCHOOL_DRAW.stickSpacing * K
    let k = 0
    for (const b of anim.bonds) {
      const g = b.t0 < 0 ? 1 : easeInOut((f - b.t0) / Math.max(1e-6, b.t1 - b.t0))
      if (g <= 0.001) continue
      _a.set(...live[b.a]!)
      _b.set(...live[b.b]!)
      const axis = _b.clone().sub(_a)
      const len = axis.length()
      if (len < 1e-9) continue
      axis.divideScalar(len)
      _q.setFromUnitVectors(_up, axis)
      for (let s = 0; s < b.n; s++) {
        _p.copy(_a).add(_b).multiplyScalar(0.5)
        if (b.side) _p.addScaledVector(b.side, (s - (b.n - 1) / 2) * stepD)
        _m.compose(_p, _q, _s.set(r * Math.min(1, 0.4 + g), len * g, r * Math.min(1, 0.4 + g)))
        res.sticks.setMatrixAt(k++, _m)
      }
    }
    res.sticks.count = k
    res.sticks.instanceMatrix.needsUpdate = true
    if (res.edges) (res.edges.material as THREE.LineBasicMaterial).opacity = 0.55 * clamp01((t - tl.starts[3]) / 1.2)
    // Кадр: описанная сфера текущих положений (все частицы всегда в окне), не меньше итоговой.
    let R = anim.rEnd
    for (let i = 0; i < live.length; i++) {
      const L = live[i]!
      const d = Math.hypot(L[0], L[1], L[2]) + model.atoms[i]!.r
      if (d > R) R = d
    }
    const o = outer.current
    if (o) o.scale.setScalar(fitRadius / Math.max(1e-6, R))
    const a = turnA.current
    const bb = turnB.current
    const st = swayT.current
    if (a && bb) {
      if (model.motion === 'orbit') {
        a.rotation.set(model.pitch, 0, 0)
        bb.rotation.set(0, model.yaw + st * HERO_ORBIT_RAD_PER_SEC, 0)
      } else {
        a.rotation.set(0, model.yaw + SWAY_AMP * Math.sin((2 * Math.PI * st) / SWAY_PERIOD), 0)
        bb.rotation.set(model.pitch, 0, 0)
      }
    }
    // Значки.
    const list = badgeEls.current
    if (list.length && bb) {
      bb.updateWorldMatrix(true, false)
      const cam = camera as THREE.PerspectiveCamera
      const pxK = size.height / 2 / Math.tan(((cam.fov || 46) * Math.PI) / 360)
      _s.setFromMatrixScale(bb.matrixWorld)
      const sc = _s.x
      anim.badges.forEach((bd, i) => {
        const node = list[i]
        if (!node) return
        // Вода и валентности уходят, когда частицы сближаются, — подписи не лезут друг на друга.
        const show =
          step >= bd.fromStep && (bd.kind === 'group' || (bd.kind === 'water' ? step <= 1 || (step === 2 && f < 0.25) : step === 1 || (step === 2 && f < 0.35)))
        if (!show) {
          if (node.shown) {
            node.el.style.display = 'none'
            node.shown = false
          }
          return
        }
        _p.set(0, 0, 0)
        let top = 0
        for (const ai of bd.atoms) {
          const L = live[ai]!
          _p.x += L[0] / bd.atoms.length
          _p.y += L[1] / bd.atoms.length
          _p.z += L[2] / bd.atoms.length
        }
        for (const ai of bd.atoms) {
          const L = live[ai]!
          top = Math.max(top, Math.hypot(L[0] - _p.x, L[1] - _p.y, L[2] - _p.z) + model.atoms[ai]!.r)
        }
        _p.applyMatrix4(bb.matrixWorld)
        const dist = cam.position.distanceTo(_p)
        const pxR = dist > 1e-6 ? ((top * sc) / dist) * pxK : 0
        _p.project(cam)
        const x = Math.round(((_p.x * 0.5 + 0.5) * size.width) * 2) / 2
        const y = Math.round(((-_p.y * 0.5 + 0.5) * size.height - pxR - (bd.kind === 'valence' ? 4 : 10)) * 2) / 2
        if (!node.shown) {
          node.el.style.display = 'block'
          node.shown = true
        }
        if (x !== node.x || y !== node.y) {
          node.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`
          node.x = x
          node.y = y
        }
      })
    }
  })

  return (
    <group ref={outer} name="formation-view">
      <group ref={turnA}>
        <group ref={turnB}>
          <primitive object={res.atoms} />
          <primitive object={res.sticks} />
          {res.edges ? <primitive object={res.edges} /> : null}
          <SchoolBallLabels atoms={ionLabels ? anim.ionic : anim.neutral} crystal={crystal} opacity={labelOpacity} />
        </group>
      </group>
    </group>
  )
}
