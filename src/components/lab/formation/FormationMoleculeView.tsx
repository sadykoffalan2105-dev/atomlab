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
import { atomPosAt, clamp01, easeInOut, screenToModel, stageIndexAt, type FormationStory } from './formationStory'
import type { FormationClock } from './formationTimeline'

/**
 * «Как образуется» в 3D карточки каталога — от и до (сценарий formationStory): исходные вещества (молекулы H₂, O₂ с
 * палочками, металл — кластер атомов) → разрыв связей → сближение → валентные электроны (жёлтые точки) → переход e⁻
 * (ионная) или общие пары (бирюзовые, ковалентная) → палочки по одной → сборка → фрагмент решётки → модель карточки.
 * Итоговые положения и радиусы — модели buildSchoolHeroModel (тот же школьный вид), меняется только путь частиц.
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
const _ax = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _c = new THREE.Color()

const E_LONE = new THREE.Color('#facc15')
const E_PAIR = new THREE.Color('#22d3ee')
const E_MOVE = new THREE.Color('#fb923c')

type Badge = { text: string; atoms: number[]; from: number; to: number; kind: 'group' | 'water' | 'valence' }
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
  story,
  clock,
  fitRadius,
  lowPower = false,
}: {
  model: SchoolHeroModel
  plan: FormationPlan
  story: FormationStory
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
  const finalT0 = story.stages[story.stages.length - 1]!.t0
  const latStage = story.stages.find((s) => s.key === 'lattice')

  const anim = useMemo(() => {
    const live = model.atoms.map((a) => [...a.pos] as V3)
    const nbrs: number[][] = model.atoms.map(() => [])
    for (const b of model.bonds) {
      nbrs[b.a]!.push(b.b)
      nbrs[b.b]!.push(b.a)
    }
    const sides = new Map<number, THREE.Vector3>()
    for (const s of story.sticks) if (s.n > 1 && !sides.has(s.bond)) sides.set(s.bond, sideFor(model, s.a, s.b, nbrs))
    const neutral: SchoolHeroAtom[] = model.atoms.map((a, i) => ({ ...a, label: a.el, pos: live[i]! }))
    const unitOf = new Map<number, number>()
    plan.units.forEach((u, i) => u.atoms.forEach((a) => unitOf.set(a, i)))
    const ionic: SchoolHeroAtom[] = model.atoms.map((a, i) => {
      const u = plan.units[unitOf.get(i) ?? -1]
      const s = u ? plan.species[u.species] : undefined
      const label = s && u!.atoms.length === 1 && s.charge !== 0 ? s.formula : a.el
      return { ...a, label, pos: live[i]! }
    })
    const badges: Badge[] = []
    const stage = (k: string) => story.stages.find((s) => s.key === k)
    if (plan.mode === 'ionic' && !crystal) {
      for (const u of plan.units) {
        const s = plan.species[u.species]
        if (!s || u.atoms.length < 2) continue
        if (s.kind === 'molecule') badges.push({ text: s.formula, atoms: u.atoms, from: stage('inner')?.t0 ?? story.ionLabelsFrom, to: stage('assemble')!.t0 + 1, kind: 'water' })
        else badges.push({ text: s.formula, atoms: u.atoms, from: story.ionLabelsFrom, to: Infinity, kind: 'group' })
      }
    } else if (plan.mode === 'molecular' && model.atoms.length <= 24) {
      const sums = model.atoms.map(() => 0)
      for (const b of model.bonds) {
        sums[b.a]! += b.order
        sums[b.b]! += b.order
      }
      const from = stage('pairs')!.t0
      const to = stage('assemble')!.t0 + 0.5
      model.atoms.forEach((a, i) => {
        const s = plan.species.find((x) => x.formula === a.el)
        const vals = s?.valences ?? []
        const v = vals.length === 1 ? vals[0]! : vals.includes(sums[i]!) ? sums[i]! : vals[0]
        if (v) badges.push({ text: ROMAN[v] ?? String(v), atoms: [i], from, to, kind: 'valence' })
      })
    }
    // Направление «вверх» экрана в координатах модели — дуга перелёта электронов.
    const up = new THREE.Vector3(...screenToModel(model, [0, 1, 0]))
    let maxD = 0
    for (const a of model.atoms) maxD = Math.max(maxD, Math.hypot(...a.pos))
    return { live, sides, neutral, ionic, badges, up, maxD: Math.max(0.25, maxD) }
  }, [model, plan, story, crystal])

  // Меши.
  const res = useMemo(() => {
    const n = model.atoms.length
    const atomMat = createSchoolMatteMaterial()
    const atoms = new THREE.InstancedMesh(schoolSphereGeometry(lowPower), atomMat, Math.max(1, n))
    atoms.frustumCulled = false
    model.atoms.forEach((a, i) => atoms.setColorAt(i, schoolAtomColor(a.el, _c)))
    const stickMat = createSchoolMatteMaterial(SCHOOL_STICK_HEX.dark)
    const sticks = new THREE.InstancedMesh(schoolStickGeometry(), stickMat, Math.max(1, story.sticks.length + story.reagentSticks.length))
    sticks.frustumCulled = false
    sticks.count = 0
    const ghostMat = createSchoolMatteMaterial()
    ghostMat.transparent = true
    ghostMat.opacity = 0.9
    const ghosts = new THREE.InstancedMesh(schoolSphereGeometry(true), ghostMat, Math.max(1, story.ghosts.length))
    ghosts.frustumCulled = false
    ghosts.count = story.ghosts.length
    story.ghosts.forEach((g, i) => ghosts.setColorAt(i, schoolAtomColor(g.el as never, _c)))
    const eMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
    const electrons = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), eMat, Math.max(1, story.electrons.length))
    electrons.frustumCulled = false
    story.electrons.forEach((_, i) => electrons.setColorAt(i, E_LONE))
    const copies = story.latticeCopies.length
    const latMat = createSchoolMatteMaterial()
    latMat.transparent = true
    latMat.opacity = 0
    latMat.depthWrite = false
    const lattice = new THREE.InstancedMesh(schoolSphereGeometry(true), latMat, Math.max(1, copies * n))
    lattice.frustumCulled = false
    lattice.count = copies * n
    for (let c = 0; c < copies; c++) {
      const off = story.latticeCopies[c]!
      model.atoms.forEach((a, i) => {
        _m.compose(_p.set(a.pos[0] + off[0], a.pos[1] + off[1], a.pos[2] + off[2]), _q.identity(), _s.setScalar(a.r))
        lattice.setMatrixAt(c * n + i, _m)
        lattice.setColorAt(c * n + i, schoolAtomColor(a.el, _c))
      })
    }
    let edges: THREE.LineSegments | null = null
    if (model.cellEdges.length > 0) {
      const pos = new Float32Array(model.cellEdges.length * 6)
      model.cellEdges.forEach(([p, q], i) => pos.set([p[0], p[1], p[2], q[0], q[1], q[2]], i * 6))
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      edges = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: SCHOOL_EDGE_HEX.dark, transparent: true, opacity: 0, depthWrite: false, fog: false }))
      edges.frustumCulled = false
    }
    return { atoms, atomMat, sticks, stickMat, ghosts, ghostMat, electrons, eMat, lattice, latMat, edges }
  }, [model, story, lowPower])

  useEffect(
    () => () => {
      for (const m of [res.atomMat, res.stickMat, res.ghostMat, res.eMat, res.latMat]) m.dispose()
      for (const x of [res.atoms, res.sticks, res.ghosts, res.lattice]) x.dispose()
      res.electrons.geometry.dispose()
      res.electrons.dispose()
      if (res.edges) {
        res.edges.geometry.dispose()
        ;(res.edges.material as THREE.Material).dispose()
      }
    },
    [res],
  )

  // Слой значков (SO₄²⁻, валентности): DOM поверх холста.
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
        'position:absolute; left:0; top:0; white-space:nowrap; display:none; will-change:transform,opacity;' +
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

  const lastStage = useRef(-1)

  useFrame((_, dt) => {
    const c = clock.current
    const t = c.t
    lastStage.current = stageIndexAt(story, t)
    const wantIons = t >= story.ionLabelsFrom
    if (wantIons !== ionLabels) setIonLabels(wantIons)
    if (c.playing && t >= finalT0) swayT.current += Math.min(0.1, Math.max(0, dt))
    if (t < finalT0) swayT.current = 0
    const { live } = anim
    // Атомы.
    for (let i = 0; i < live.length; i++) {
      const L = atomPosAt(story, i, t, live[i]!)
      _m.compose(_p.set(L[0], L[1], L[2]), _q.identity(), _s.setScalar(model.atoms[i]!.r))
      res.atoms.setMatrixAt(i, _m)
    }
    res.atoms.instanceMatrix.needsUpdate = true
    // Призраки — второй атом исходной молекулы: уходит и тает при разрыве связи.
    const sb = story.stages.find((s) => s.key === 'break')
    const gu = sb ? easeInOut((t - sb.t0 - 0.6) / (sb.dur - 0.6)) : 1
    story.ghosts.forEach((g, i) => {
      const k = 1 - gu
      _p.set(g.p0[0] + (g.p1[0] - g.p0[0]) * gu, g.p0[1] + (g.p1[1] - g.p0[1]) * gu, g.p0[2] + (g.p1[2] - g.p0[2]) * gu)
      _m.compose(_p, _q.identity(), _s.setScalar(g.r * Math.max(0.001, k)))
      res.ghosts.setMatrixAt(i, _m)
    })
    res.ghosts.instanceMatrix.needsUpdate = true
    // Палочки.
    const r = SCHOOL_DRAW.stickR * K
    const stepD = SCHOOL_DRAW.stickSpacing * K
    let k = 0
    const drawStick = (A: THREE.Vector3, B: THREE.Vector3, sOff: THREE.Vector3 | null, slot: number, nn: number, g: number) => {
      _ax.copy(B).sub(A)
      const L = _ax.length()
      if (L < 1e-9) return
      _ax.divideScalar(L)
      _q.setFromUnitVectors(_up, _ax)
      _p.copy(A).add(B).multiplyScalar(0.5)
      if (sOff) _p.addScaledVector(sOff, (slot - (nn - 1) / 2) * stepD)
      _m.compose(_p, _q, _s.set(r * Math.min(1, 0.4 + g), L * g, r * Math.min(1, 0.4 + g)))
      res.sticks.setMatrixAt(k++, _m)
    }
    // Исходные молекулы: палочки до разрыва (H–H, O=O, N≡N).
    const breakG = sb ? 1 - easeInOut((t - sb.t0) / Math.max(0.1, sb.dur * 0.55)) : 0
    if (breakG > 0.001) {
      const rs = new THREE.Vector3()
      for (const s of story.reagentSticks) {
        _a.set(...live[s.a]!)
        if (s.b >= 0) _b.set(...live[s.b]!)
        else {
          const g = story.ghosts[-1 - s.b]!
          _b.set(g.p0[0] + (g.p1[0] - g.p0[0]) * gu, g.p0[1] + (g.p1[1] - g.p0[1]) * gu, g.p0[2] + (g.p1[2] - g.p0[2]) * gu)
        }
        rs.copy(_b).sub(_a).cross(anim.up).normalize()
        drawStick(_a.clone(), _b.clone(), s.n > 1 ? rs : null, s.s, s.n, breakG)
      }
    }
    for (const s of story.sticks) {
      const g = easeInOut((t - s.t0) / Math.max(1e-6, s.t1 - s.t0))
      if (g <= 0.001) continue
      _a.set(...live[s.a]!)
      _b.set(...live[s.b]!)
      drawStick(_a.clone(), _b.clone(), anim.sides.get(s.bond) ?? null, s.s, s.n, g)
    }
    res.sticks.count = k
    res.sticks.instanceMatrix.needsUpdate = true
    // Электроны.
    const eR = story.eR
    story.electrons.forEach((e, i) => {
      const appear = clamp01((t - e.tIn) / 0.4)
      const vanish = 1 - clamp01((t - e.tOut) / 0.5)
      let sc = eR * appear * vanish
      const H = live[e.home]!
      let x = H[0] + e.homeOff[0]
      let y = H[1] + e.homeOff[1]
      let z = H[2] + e.homeOff[2]
      let col = e.kind === 'pair' && e.move && t >= e.move.t1 ? E_PAIR : E_LONE
      if (e.move && t >= e.move.t0) {
        const u = easeInOut((t - e.move.t0) / Math.max(1e-6, e.move.t1 - e.move.t0))
        let tx: number, ty: number, tz: number
        if (e.move.toAtom != null) {
          const T = live[e.move.toAtom]!
          const o = e.move.toOff!
          tx = T[0] + o[0]
          ty = T[1] + o[1]
          tz = T[2] + o[2]
        } else {
          const bd = e.move.bond!
          const A = live[bd.a]!
          const B = live[bd.b]!
          _ax.set(B[0] - A[0], B[1] - A[1], B[2] - A[2])
          const L = _ax.length() || 1
          _ax.divideScalar(L)
          tx = (A[0] + B[0]) / 2 + _ax.x * bd.sign * 1.5 * eR
          ty = (A[1] + B[1]) / 2 + _ax.y * bd.sign * 1.5 * eR
          tz = (A[2] + B[2]) / 2 + _ax.z * bd.sign * 1.5 * eR
          const sd = anim.sides.get(bd.k)
          if (sd && bd.n > 1) {
            const off = (bd.slot - (bd.n - 1) / 2) * stepD
            tx += sd.x * off
            ty += sd.y * off
            tz += sd.z * off
          }
        }
        const lift = Math.sin(Math.PI * u) * (e.kind === 'transfer' ? 0.18 : 0.06) * anim.maxD
        x = x + (tx - x) * u + anim.up.x * lift
        y = y + (ty - y) * u + anim.up.y * lift
        z = z + (tz - z) * u + anim.up.z * lift
        if (u > 0 && u < 1) {
          col = E_MOVE
          sc *= 1.35
        } else if (e.kind === 'pair') col = E_PAIR
      }
      _m.compose(_p.set(x, y, z), _q.identity(), _s.setScalar(Math.max(1e-5, sc)))
      res.electrons.setMatrixAt(i, _m)
      res.electrons.setColorAt(i, col)
    })
    res.electrons.instanceMatrix.needsUpdate = true
    if (res.electrons.instanceColor) res.electrons.instanceColor.needsUpdate = true
    // Фрагмент решётки и рёбра ячеек.
    let latO = 0
    if (latStage && story.latticeCopies.length) latO = clamp01((t - latStage.t0 - 0.3) / 1.4) * (1 - clamp01((t - finalT0) / 1.4))
    res.latMat.opacity = 0.42 * latO
    res.lattice.visible = latO > 0.01
    if (res.edges) (res.edges.material as THREE.LineBasicMaterial).opacity = 0.55 * clamp01((t - finalT0) / 1.2)
    // Кадр: описанная сфера текущих положений (+ призраки и копии решётки, пока видны).
    let R = model.radius
    for (let i = 0; i < live.length; i++) {
      const L = live[i]!
      R = Math.max(R, Math.hypot(L[0], L[1], L[2]) + model.atoms[i]!.r)
    }
    if (gu < 1) for (const g of story.ghosts) R = Math.max(R, Math.hypot(...g.p0) + g.r)
    if (latO > 0) for (const off of story.latticeCopies) R = Math.max(R, model.radius + (Math.hypot(...off) * latO))
    const o = outer.current
    if (o) {
      const target = fitRadius / Math.max(1e-6, R)
      // Плавный «зум» (без рывков при смене этапа).
      const cur = o.scale.x || target
      o.scale.setScalar(cur + (target - cur) * Math.min(1, 6 * Math.max(0.016, dt)))
    }
    const a = turnA.current
    const bb = turnB.current
    const stt = swayT.current
    if (a && bb) {
      if (model.motion === 'orbit') {
        a.rotation.set(model.pitch, 0, 0)
        bb.rotation.set(0, model.yaw + stt * HERO_ORBIT_RAD_PER_SEC, 0)
      } else {
        a.rotation.set(0, model.yaw + SWAY_AMP * Math.sin((2 * Math.PI * stt) / SWAY_PERIOD), 0)
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
        const show = t >= bd.from && t < bd.to
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
        const x = Math.round((_p.x * 0.5 + 0.5) * size.width * 2) / 2
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
          <primitive object={res.ghosts} />
          <primitive object={res.electrons} />
          <primitive object={res.lattice} />
          {res.edges ? <primitive object={res.edges} /> : null}
          <SchoolBallLabels atoms={ionLabels ? anim.ionic : anim.neutral} crystal={crystal} opacity={labelOpacity} />
        </group>
      </group>
    </group>
  )
}
