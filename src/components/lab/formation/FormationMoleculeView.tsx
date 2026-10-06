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
import { atomPosAt, atomRadiusAt, clamp01, easeInOut, routeKeyAt, screenToModel, stageIndexAt, type FormationStory } from './formationStory'
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
const _rp: V3 = [0, 0, 0]
const _cT = new THREE.Vector3()

const E_LONE = new THREE.Color('#facc15')
const E_PAIR = new THREE.Color('#22d3ee')
const E_MOVE = new THREE.Color('#fb923c')
const LAT_BG = new THREE.Color('#0b1020')

/** src: 'route' — индексы атомов сцены пути (routeStage.atoms), иначе — атомы модели. */
type Badge = { text: string; atoms: number[]; from: number; to: number; kind: 'group' | 'water' | 'valence' | 'caption' | 'route'; src?: 'route' }

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

/** Смена заряда иона в момент t (данные сценария, если есть): подпись меняется со вспышкой. */
type ChargeStep = { atom: number; t: number; from: number | string; to: number | string }
const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
/** Подпись шара: число — степень окисления (Mn⁺³, O⁰), строка — как есть. */
function chargeLabel(el: string, q: number | string): string {
  if (typeof q === 'string') return q
  if (q === 0) return `${el}⁰`
  return `${el}${q > 0 ? '⁺' : '⁻'}${String(Math.abs(q)).split('').map((d) => SUP[d] ?? d).join('')}`
}
function chargeStepsOf(story: FormationStory): ChargeStep[] {
  // Шаги с src 'route' — индексы routeStage.atoms (подписи сцены пути), к атомам модели не относятся.
  const cs = (story as FormationStory & { chargeSteps?: (ChargeStep & { src?: string })[] }).chargeSteps
  return Array.isArray(cs) ? cs.filter((x) => x && x.src !== 'route' && Number.isFinite(x.atom) && Number.isFinite(x.t)) : []
}
/** Подпись иона: заряд после символа (Mn³⁺, O²⁻, Na⁺); 0 — O⁰. */
function ionLabel(el: string, q: number): string {
  if (q === 0) return `${el}⁰`
  const n = Math.abs(q)
  return `${el}${n === 1 ? '' : String(n).split('').map((d) => SUP[d] ?? d).join('')}${q > 0 ? '⁺' : '⁻'}`
}
/** Подпись частицы сцены пути: 'ion' — заряд иона (Mn⁴⁺), 'ox' — степень окисления в многоатомном ионе (Mn⁺⁷). */
function routeQLabel(el: string, q: number, kind: 'ion' | 'ox' | undefined): string {
  return kind === 'ox' ? chargeLabel(el, q) : ionLabel(el, q)
}

/** Частицы тепла (этап 'heat'): не больше 120, на слабых устройствах — 48. */
const HEAT_N = 120
const HEAT_N_LOW = 48
const HEAT_AMP = 8 // pm: 0,08 Å — амплитуда тепловых колебаний к концу нагревания
const hash = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return x - Math.floor(x)
}

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
    // Многоатомные ионы и молекулы воды гидрата (SO₄²⁻, H₂O) — строками HUD (FormationHud), не плашками над атомами.
    if (plan.mode === 'molecular' && model.atoms.length <= 24) {
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
    // Путь получения и подпись решётки — в HUD-карточке у 3D-окна (FormationHud), не плашками поверх атомов.
    // Сценарий задал свой HUD — формулы только там.
    if (story.hud && story.hud.length > 0) badges.length = 0
    // Направление «вверх» экрана в координатах модели — дуга перелёта электронов.
    const up = new THREE.Vector3(...screenToModel(model, [0, 1, 0]))
    // К зрителю — для палочек исходных молекул (O=O: две палочки рядом в плоскости экрана).
    const toward = new THREE.Vector3(...screenToModel(model, [0, 0, 1]))
    let maxD = 0
    for (const a of model.atoms) maxD = Math.max(maxD, Math.hypot(...a.pos))
    return { live, sides, neutral, ionic, badges, up, toward, maxD: Math.max(0.25, maxD) }
  }, [model, plan, story, crystal])

  // Меши.
  const res = useMemo(() => {
    const n = model.atoms.length
    const atomMat = createSchoolMatteMaterial()
    const atoms = new THREE.InstancedMesh(schoolSphereGeometry(lowPower), atomMat, Math.max(1, n))
    atoms.frustumCulled = false
    model.atoms.forEach((a, i) => atoms.setColorAt(i, schoolAtomColor(a.el, _c)))
    const stickMat = createSchoolMatteMaterial(SCHOOL_STICK_HEX.dark)
    const route = story.routeStage
    const sticks = new THREE.InstancedMesh(schoolStickGeometry(), stickMat, Math.max(1, story.sticks.length + story.reagentSticks.length + (route?.sticks.length ?? 0)))
    sticks.frustumCulled = false
    sticks.count = 0
    const ghostMat = createSchoolMatteMaterial()
    ghostMat.transparent = true
    ghostMat.opacity = 0.6
    const ghosts = new THREE.InstancedMesh(schoolSphereGeometry(true), ghostMat, Math.max(1, story.ghosts.length))
    ghosts.frustumCulled = false
    ghosts.count = story.ghosts.length
    story.ghosts.forEach((g, i) => ghosts.setColorAt(i, schoolAtomColor(g.el as never, _c)))
    const eMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
    const nRE = route?.electrons.length ?? 0
    const electrons = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), eMat, Math.max(1, story.electrons.length + nRE))
    electrons.frustumCulled = false
    for (let i = 0; i < story.electrons.length + nRE; i++) electrons.setColorAt(i, E_LONE)
    // Фрагмент решётки: ионы / молекулы / звенья цепи (полупрозрачно, растут слоями по k).
    const nL = story.latticeAtoms.length
    // Чёткие непрозрачные ионы (без «каши» полупрозрачных сфер): цвет приглушён к фону — фокус на центральной единице.
    const latMat = createSchoolMatteMaterial()
    const lattice = new THREE.InstancedMesh(schoolSphereGeometry(lowPower), latMat, Math.max(1, nL))
    lattice.frustumCulled = false
    lattice.count = nL
    story.latticeAtoms.forEach((a, i) => {
      _m.compose(_p.set(...a.pos), _q.identity(), _s.setScalar(1e-5))
      lattice.setMatrixAt(i, _m)
      lattice.setColorAt(i, schoolAtomColor(a.el as never, _c).lerp(LAT_BG, 0.42))
    })
    // Сцена пути получения (H⁺ + OH⁻ → H₂O …): свои шары.
    const nR = route?.atoms.length ?? 0
    const routeMat = createSchoolMatteMaterial()
    const routeAtoms = new THREE.InstancedMesh(schoolSphereGeometry(lowPower), routeMat, Math.max(1, nR))
    routeAtoms.frustumCulled = false
    routeAtoms.count = nR
    route?.atoms.forEach((a, i) => routeAtoms.setColorAt(i, schoolAtomColor(a.el as never, _c)))
    let edges: THREE.LineSegments | null = null
    if (model.cellEdges.length > 0) {
      const pos = new Float32Array(model.cellEdges.length * 6)
      model.cellEdges.forEach(([p, q], i) => pos.set([p[0], p[1], p[2], q[0], q[1], q[2]], i * 6))
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      edges = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: SCHOOL_EDGE_HEX.dark, transparent: true, opacity: 0, depthWrite: false, fog: false }))
      edges.frustumCulled = false
    }
    // Частицы тепла (этап 'heat'): точки, поднимаются вверх экрана; без новых источников света.
    const hasHeat = story.stages.some((s) => s.key === 'heat')
    const nH = hasHeat ? (lowPower ? HEAT_N_LOW : HEAT_N) : 0
    const heatGeo = new THREE.BufferGeometry()
    heatGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, nH) * 3), 3))
    const heatCol = new Float32Array(Math.max(1, nH) * 3)
    for (let i = 0; i < nH; i++) {
      _c.set(hash(i, 3) < 0.5 ? '#fb923c' : '#fde047')
      heatCol.set([_c.r, _c.g, _c.b], i * 3)
    }
    heatGeo.setAttribute('color', new THREE.BufferAttribute(heatCol, 3))
    heatGeo.setDrawRange(0, nH)
    const heatMat = new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    const heat = new THREE.Points(heatGeo, heatMat)
    heat.frustumCulled = false
    heat.visible = false
    return { atoms, atomMat, sticks, stickMat, ghosts, ghostMat, electrons, eMat, lattice, latMat, edges, routeAtoms, routeMat, heat, heatMat, nH }
  }, [model, story, lowPower])

  useEffect(
    () => () => {
      for (const m of [res.atomMat, res.stickMat, res.ghostMat, res.eMat, res.latMat, res.routeMat, res.heatMat]) m.dispose()
      res.heat.geometry.dispose()
      for (const x of [res.atoms, res.sticks, res.ghosts, res.lattice, res.routeAtoms]) x.dispose()
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
        (b.kind === 'caption'
          ? 'font-size:13px; padding:4px 10px; color:#e0f2fe; background:rgba(12,16,32,0.8); border:1px solid rgba(56,189,248,0.6);'
          : b.kind === 'route'
            ? 'font-size:14px; padding:4px 9px; color:#fde68a; background:rgba(12,16,32,0.8); border:1px solid rgba(251,146,60,0.6);'
            : b.kind === 'group'
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
  // Смена зарядов по сценарию (story.chargeSteps, если есть): набор подписей — по числу прошедших шагов.
  const steps = useMemo(() => [...chargeStepsOf(story)].sort((x, y) => x.t - y.t), [story])
  const [stepN, setStepN] = useState(0)
  const stepLabels = useMemo(() => {
    if (!steps.length) return null
    const base: SchoolHeroAtom[] = anim.ionic.map((a, i) => ({ ...a, label: model.atoms[i]!.el }))
    for (const st of steps) {
      const a = base[st.atom]
      if (a) a.label = chargeLabel(a.el, st.from)
    }
    for (let k = 0; k < stepN; k++) {
      const st = steps[k]!
      const a = base[st.atom]
      if (a) a.label = chargeLabel(a.el, st.to)
    }
    return base
  }, [steps, stepN, anim, model])
  // Заряды частиц сцены пути (RouteAtom.q / qKind + story.chargeSteps src 'route'): маленькие подписи сбоку от шара.
  const routeQ = useMemo(() => {
    const rs0 = story.routeStage
    if (!rs0) return null
    const all = ((story as FormationStory & { chargeSteps?: { atom: number; src?: string; t: number; from: number; to: number; kind?: 'ion' | 'ox' }[] }).chargeSteps ?? []).filter((x) => x.src === 'route')
    const per = rs0.atoms.map((a, i) => {
      const st = all.filter((x) => x.atom === i).sort((x, y) => x.t - y.t)
      const q0 = a.q ?? st[0]?.from
      if (q0 == null) return null
      const kind = a.qKind ?? st[0]?.kind
      return { q0, kind, steps: st.map((x) => ({ t: x.t, q: x.to, kind: x.kind ?? kind })) }
    })
    return per.some(Boolean) ? per : null
  }, [story])
  // «Итог» ОВР-разложения: у ВСЕХ ионов модели — заряд (Mn³⁺, O²⁻), по конечным зарядам ионов главной формульной единицы.
  const finalLabels = useMemo(() => {
    const info = story.redox
    const rs0 = story.routeStage
    if (story.scenario !== 'redoxDecomposition' || !info || !rs0 || !routeQ) return null
    const main = info.units.find((u) => u.main) ?? info.units[0]
    if (!main) return null
    const byEl = new Map<string, number | null>()
    for (const i of main.atoms) {
      const r = routeQ[i]
      const a = rs0.atoms[i]
      if (!a) continue
      const last = r ? (r.steps.length ? r.steps[r.steps.length - 1]! : null) : null
      const kind = last ? last.kind : r?.kind
      const q = r ? (last ? last.q : r.q0) : null
      const prev = byEl.get(a.el)
      byEl.set(a.el, q == null || kind === 'ox' || (prev !== undefined && prev !== q) ? null : q)
    }
    return anim.ionic.map((a, i) => {
      const el = model.atoms[i]!.el
      const q = byEl.get(el)
      return { ...a, label: q == null ? a.label : ionLabel(el, q) }
    })
  }, [story, routeQ, anim, model])
  const qEls = useRef<({ el: HTMLDivElement; text: string; shown: boolean; flash: number } | null)[]>([])
  useEffect(() => {
    const host = gl.domElement.parentElement
    if (!host || !routeQ) return
    const layer = document.createElement('div')
    layer.setAttribute('aria-hidden', 'true')
    layer.dataset.formationCharges = ''
    layer.style.cssText = 'position:absolute; inset:0; pointer-events:none; overflow:hidden; z-index:3; contain:strict;'
    qEls.current = routeQ.map((r) => {
      if (!r) return null
      const el = document.createElement('div')
      el.dataset.formationCharge = ''
      el.style.cssText =
        'position:absolute; left:0; top:0; white-space:nowrap; display:none; will-change:transform; font-family:var(--lt-font, "Inter", system-ui, sans-serif);' +
        'font-size:12px; font-weight:700; line-height:1; padding:2px 5px; border-radius:7px; color:#f8fafc; background:rgba(10,14,28,0.72);' +
        'border:1px solid rgba(148,163,184,0.45); font-variant-numeric:tabular-nums; transition:color 250ms cubic-bezier(0.22,1,0.36,1), border-color 250ms cubic-bezier(0.22,1,0.36,1), box-shadow 250ms cubic-bezier(0.22,1,0.36,1);'
      layer.appendChild(el)
      return { el, text: '', shown: false, flash: 0 }
    })
    host.appendChild(layer)
    return () => {
      qEls.current = []
      layer.remove()
    }
  }, [gl, routeQ])
  const isRedox = story.scenario === 'redoxDecomposition'
  const centerRef = useRef<THREE.Group>(null)
  const center = useRef(new THREE.Vector3())
  const heatSt = story.stages.find((s) => s.key === 'heat') ?? null
  const breakSt = story.stages.find((s) => s.key === 'break') ?? null
  const routeLive = useRef<V3[]>([])
  if (routeLive.current.length !== (story.routeStage?.atoms.length ?? 0)) routeLive.current = (story.routeStage?.atoms ?? []).map(() => [0, 0, 0] as V3)

  useFrame((_, dt) => {
    const c = clock.current
    const t = c.t
    lastStage.current = stageIndexAt(story, t)
    const wantIons = t >= story.ionLabelsFrom
    if (wantIons !== ionLabels) setIonLabels(wantIons)
    if (steps.length) {
      let n = 0
      while (n < steps.length && t >= steps[n]!.t) n++
      if (n !== stepN) setStepN(n)
    }
    // Нагревание: амплитуда растёт к концу этапа, на разрыве затухает (0,08 Å максимум).
    let heatA = 0
    let heatF = 0
    if (heatSt && t >= heatSt.t0) {
      const u = clamp01((t - heatSt.t0) / Math.max(1e-6, heatSt.dur))
      heatA = t < heatSt.t0 + heatSt.dur ? 0.25 + 0.75 * u : 1
      heatF = 7 + 11 * u
      const endHeat = heatSt.t0 + heatSt.dur
      if (t >= endHeat) heatA *= breakSt && breakSt.t0 >= endHeat - 0.01 ? 1 - easeInOut((t - breakSt.t0) / Math.max(0.3, 0.7 * breakSt.dur)) : 1 - clamp01((t - endHeat) / 1.2)
    }
    if (c.playing && t >= finalT0) swayT.current += Math.min(0.1, Math.max(0, dt))
    if (t < finalT0) swayT.current = 0
    const { live } = anim
    // Этап «Путь получения»: исходные вещества кольцом на время сцены пути уходят (не мешают), затем возвращаются.
    const rs = story.routeStage
    const hide = rs ? clamp01((t - rs.t0) / 0.5) * (1 - clamp01((t - (rs.t0 + rs.dur - 0.5)) / 0.5)) : 0
    const keep = Math.max(1e-4, 1 - hide)
    labelOpacity.current = 1 - hide
    // Атомы.
    for (let i = 0; i < live.length; i++) {
      const L = atomPosAt(story, i, t, live[i]!)
      if (heatA > 0.001) {
        const amp = HEAT_AMP * K * heatA
        L[0] += amp * Math.sin(heatF * t * 1.13 + i * 2.1)
        L[1] += amp * Math.sin(heatF * t * 0.97 + i * 3.7 + 1)
        L[2] += amp * Math.sin(heatF * t * 1.07 + i * 5.3 + 2)
      }
      let pulse = 1
      for (const st of steps) if (st.atom === i && t >= st.t && t < st.t + 0.6) pulse = 1 + 0.18 * Math.sin((Math.PI * (t - st.t)) / 0.6)
      _m.compose(_p.set(L[0], L[1], L[2]), _q.identity(), _s.setScalar(atomRadiusAt(story, i, t, model.atoms[i]!.r) * keep * pulse))
      res.atoms.setMatrixAt(i, _m)
    }
    res.atoms.instanceMatrix.needsUpdate = true
    // Призраки — второй атом исходной молекулы: уходит и тает при разрыве связи.
    const sb = story.stages.find((s) => s.key === 'break')
    const gu = sb ? easeInOut((t - sb.t0 - 0.6) / (sb.dur - 0.6)) : 1
    story.ghosts.forEach((g, i) => {
      const k = 1 - gu
      _p.set(g.p0[0] + (g.p1[0] - g.p0[0]) * gu, g.p0[1] + (g.p1[1] - g.p0[1]) * gu, g.p0[2] + (g.p1[2] - g.p0[2]) * gu)
      _m.compose(_p, _q.identity(), _s.setScalar(g.r * Math.max(0.001, k) * keep))
      res.ghosts.setMatrixAt(i, _m)
    })
    res.ghosts.instanceMatrix.needsUpdate = true
    // Сцена пути получения.
    const route = story.routeStage
    const rl = routeLive.current
    if (route) {
      route.atoms.forEach((a, i) => {
        const P = routeKeyAt(a.keys, t, rl[i]!)
        if (heatA > 0.001) {
          // Нагревание: колеблются частицы сцены пути (они и есть исходное вещество до «Итога»).
          const amp = HEAT_AMP * K * heatA
          P[0] += amp * Math.sin(heatF * t * 1.13 + i * 2.1)
          P[1] += amp * Math.sin(heatF * t * 0.97 + i * 3.7 + 1)
          P[2] += amp * Math.sin(heatF * t * 1.07 + i * 5.3 + 2)
        }
        const sc = clamp01((t - a.tIn) / 0.5) * (1 - clamp01((t - a.tOut) / 0.4))
        _m.compose(_p.set(P[0], P[1], P[2]), _q.identity(), _s.setScalar(Math.max(1e-5, a.r * sc)))
        res.routeAtoms.setMatrixAt(i, _m)
      })
      res.routeAtoms.instanceMatrix.needsUpdate = true
      res.routeAtoms.visible = t > route.t0 - 0.1 && t < route.t0 + route.dur + 0.1
    }
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
    const breakG = (sb ? 1 - easeInOut((t - sb.t0) / Math.max(0.1, sb.dur * 0.55)) : 0) * keep
    if (breakG > 0.001) {
      const rs = new THREE.Vector3()
      for (const s of story.reagentSticks) {
        _a.set(...live[s.a]!)
        if (s.b >= 0) _b.set(...live[s.b]!)
        else {
          const g = story.ghosts[-1 - s.b]!
          _b.set(g.p0[0] + (g.p1[0] - g.p0[0]) * gu, g.p0[1] + (g.p1[1] - g.p0[1]) * gu, g.p0[2] + (g.p1[2] - g.p0[2]) * gu)
        }
        rs.copy(_b).sub(_a).cross(anim.toward).normalize()
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
    if (route && t > route.t0 && t < route.t0 + route.dur) {
      for (const s of route.sticks) {
        const g = easeInOut((t - s.t0) / Math.max(1e-6, s.t1 - s.t0)) * (1 - clamp01((t - s.tOut) / 0.4))
        if (g <= 0.001) continue
        _a.set(...rl[s.a]!)
        _b.set(...rl[s.b]!)
        const nn = s.n ?? 1
        let side: THREE.Vector3 | null = null
        if (nn > 1) {
          // Кратная связь (O=O): палочки параллельно, сдвиг поперёк связи в плоскости экрана.
          const ax = _b.clone().sub(_a).normalize()
          side = new THREE.Vector3(0, 0, 1).cross(ax)
          if (side.lengthSq() < 1e-6) side.set(0, 1, 0).cross(ax)
          side.normalize()
        }
        drawStick(_a.clone(), _b.clone(), side, s.s ?? 0, nn, g)
      }
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
    if (route) {
      const base = story.electrons.length
      route.electrons.forEach((e, j) => {
        const sc = eR * 1.15 * clamp01((t - e.tIn) / 0.4) * (1 - clamp01((t - e.tOut) / 0.4))
        const P = routeKeyAt(e.keys, t, _rp)
        _m.compose(_p.set(P[0], P[1], P[2]), _q.identity(), _s.setScalar(Math.max(1e-5, sc)))
        res.electrons.setMatrixAt(base + j, _m)
        res.electrons.setColorAt(base + j, t > e.keys[1]![0] && t < e.keys[e.keys.length - 1]![0] ? E_MOVE : E_LONE)
      })
    }
    res.electrons.instanceMatrix.needsUpdate = true
    if (res.electrons.instanceColor) res.electrons.instanceColor.needsUpdate = true
    // Частицы тепла: поднимаются (экранные координаты внешней группы), видны вместе с колебаниями.
    if (res.nH > 0) {
      const vis = heatA
      res.heat.visible = vis > 0.01
      if (res.heat.visible) {
        const arr = (res.heat.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
        const Rr = model.radius
        for (let i = 0; i < res.nH; i++) {
          const ph = (t * (0.18 + 0.22 * hash(i, 1)) * (0.6 + heatF / 18) + hash(i, 2)) % 1
          arr[i * 3] = (hash(i, 4) * 2 - 1) * 1.15 * Rr + 0.05 * Rr * Math.sin(3 * t + i)
          arr[i * 3 + 1] = (-1.1 + 2.3 * ph) * Rr
          arr[i * 3 + 2] = (hash(i, 5) * 2 - 1) * 0.6 * Rr
        }
        res.heat.geometry.getAttribute('position').needsUpdate = true
        res.heatMat.opacity = 0.85 * vis
        res.heatMat.size = 0.035 * Rr
      }
    }
    // Фрагмент решётки и рёбра ячеек.
    let latO = 0
    const nL = story.latticeAtoms.length
    if (nL) {
      const [w0, w1] = story.latticeWin
      const fin = story.stages[story.stages.length - 1]!
      // Ионная — растёт в «Решётке» и уходит в начале «Готово» (итог — модель карточки);
      // молекулярная укладка / цепь — показывается в «Готово» и уходит в конце.
      const fadeAt = story.latticeKind === 'ionic' ? finalT0 + 2.6 : fin.t0 + fin.dur - 1.6
      latO = clamp01((t - w0 + 0.2) / 0.8) * (1 - easeInOut((t - fadeAt) / 0.8))
      if (latO > 0.01) {
        story.latticeAtoms.forEach((a, i) => {
          const g = easeInOut((t - (w0 + a.k * (w1 - w0))) / 0.7) * latO
          // Ионы фрагмента меньше (0,62 r): видно расположение соседей, а не сплошная стена шаров; уходят — сжимаясь.
          _m.compose(_p.set(...a.pos), _q.identity(), _s.setScalar(Math.max(1e-5, a.r * g * (story.latticeKind === 'ionic' ? 0.62 : 0.85))))
          res.lattice.setMatrixAt(i, _m)
        })
        res.lattice.instanceMatrix.needsUpdate = true
      }
    }
    res.lattice.visible = latO > 0.04
    if (res.edges) (res.edges.material as THREE.LineBasicMaterial).opacity = 0.55 * clamp01((t - finalT0) / 1.2)
    const cTarget = _cT.set(0, 0, 0)
    // Кадр: описанная сфера текущих положений (+ призраки и копии решётки, пока видны).
    let R = model.radius
    for (let i = 0; i < live.length; i++) {
      const L = live[i]!
      R = Math.max(R, Math.hypot(L[0], L[1], L[2]) + model.atoms[i]!.r)
    }
    if (gu < 1) for (const g of story.ghosts) R = Math.max(R, Math.hypot(...g.p0) + g.r)
    if (rs && hide > 0.5) {
      // Кадр — по сцене пути (крупно), исходные вещества спрятаны.
      R = 0
      if (isRedox) {
        // ОВР-разложение: кадр — по ВИДИМЫМ частицам (на «Решётке» — формульные единицы продукта крупно, по центру).
        let n = 0
        _p.set(0, 0, 0)
        for (let i = 0; i < rl.length; i++) {
          const a = rs.atoms[i]!
          if (t < a.tIn + 0.2 || t > a.tOut) continue
          _p.x += rl[i]![0]
          _p.y += rl[i]![1]
          _p.z += rl[i]![2]
          n++
        }
        if (n) _p.divideScalar(n)
        cTarget.copy(_p)
        for (let i = 0; i < rl.length; i++) {
          const a = rs.atoms[i]!
          if (n && (t < a.tIn + 0.2 || t > a.tOut)) continue
          R = Math.max(R, Math.hypot(rl[i]![0] - center.current.x, rl[i]![1] - center.current.y, rl[i]![2] - center.current.z) + a.r)
        }
      } else for (let i = 0; i < rl.length; i++) R = Math.max(R, Math.hypot(...rl[i]!) + rs.atoms[i]!.r)
      R = Math.max(R * 1.08, 0.35 * model.radius)
    }
    // Плавный наезд центра кадра (cubic ease-out по шагу кадра): без рывков между этапами.
    {
      const kc = 1 - Math.pow(1 - Math.min(1, 3.2 * Math.max(0.016, Math.min(0.1, dt))), 3)
      center.current.lerp(cTarget, kc)
      if (centerRef.current) centerRef.current.position.set(-center.current.x, -center.current.y, -center.current.z)
    }
    // Кадр держит весь фрагмент, пока он виден (без наезда камеры на уходящие ионы), затем плавно возвращается.
    if (latO > 0.04) {
      const kk = 1
      for (const a of story.latticeAtoms) R = Math.max(R, model.radius + (Math.hypot(...a.pos) + a.r - model.radius) * kk)
    }
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
    // Заряды частиц сцены пути: сбоку-сверху от шара (не на центре — соседи не перекрываются), смена со вспышкой.
    const qList = qEls.current
    if (routeQ && route && qList.length && bb) {
      const vis = t > route.t0 && t < route.t0 + route.dur
      bb.updateWorldMatrix(true, true)
      const cam = camera as THREE.PerspectiveCamera
      const pxK = size.height / 2 / Math.tan(((cam.fov || 46) * Math.PI) / 360)
      _s.setFromMatrixScale(bb.matrixWorld)
      const sc = _s.x
      const mw = (centerRef.current ?? bb).matrixWorld
      routeQ.forEach((r, i) => {
        const node = qList[i]
        if (!r || !node) return
        const a = route.atoms[i]!
        const on = vis && t > a.tIn + 0.35 && t < a.tOut - 0.05
        if (!on) {
          if (node.shown) {
            node.el.style.display = 'none'
            node.shown = false
          }
          return
        }
        let q = r.q0
        let kind = r.kind
        let flashAt = -1
        for (const st of r.steps) {
          if (t < st.t) break
          q = st.q
          kind = st.kind
          flashAt = st.t
        }
        const text = routeQLabel(a.el, q, kind)
        if (text !== node.text) {
          node.el.textContent = text
          node.text = text
        }
        const fl = flashAt >= 0 && t - flashAt < 0.7
        if (fl !== node.flash > 0) {
          node.flash = fl ? 1 : 0
          node.el.style.color = fl ? '#fde047' : '#f8fafc'
          node.el.style.borderColor = fl ? 'rgba(250,204,21,0.95)' : 'rgba(148,163,184,0.45)'
          node.el.style.boxShadow = fl ? '0 0 10px rgba(250,204,21,0.75)' : 'none'
        }
        _p.set(rl[i]![0], rl[i]![1], rl[i]![2]).applyMatrix4(mw)
        const dist = cam.position.distanceTo(_p)
        const pxR = dist > 1e-6 ? ((a.r * sc) / dist) * pxK : 0
        _p.project(cam)
        const x = Math.round(((_p.x * 0.5 + 0.5) * size.width + pxR * 0.62) * 2) / 2
        const y = Math.round(((-_p.y * 0.5 + 0.5) * size.height - pxR * 0.62) * 2) / 2
        if (!node.shown) {
          node.el.style.display = 'block'
          node.shown = true
        }
        node.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-10%, -90%)`
      })
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
        const srcP = bd.src === 'route' ? routeLive.current : live
        const srcR = (ai: number) => (bd.src === 'route' ? story.routeStage!.atoms[ai]!.r : model.atoms[ai]!.r)
        for (const ai of bd.atoms) {
          const L = srcP[ai]!
          _p.x += L[0] / bd.atoms.length
          _p.y += L[1] / bd.atoms.length
          _p.z += L[2] / bd.atoms.length
        }
        for (const ai of bd.atoms) {
          const L = srcP[ai]!
          top = Math.max(top, Math.hypot(L[0] - _p.x, L[1] - _p.y, L[2] - _p.z) + srcR(ai))
        }
        _p.applyMatrix4(bb.matrixWorld)
        const dist = cam.position.distanceTo(_p)
        const pxR = dist > 1e-6 ? ((top * sc) / dist) * pxK : 0
        _p.project(cam)
        let x = Math.round((_p.x * 0.5 + 0.5) * size.width * 2) / 2
        let y = Math.round(((-_p.y * 0.5 + 0.5) * size.height - pxR - (bd.kind === 'valence' ? 4 : 10)) * 2) / 2
        if (bd.kind === 'caption') {
          // Подпись решётки / каркаса — над кадром, не на частицах.
          x = Math.round(size.width / 2)
          y = 52
        }
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
      <primitive object={res.heat} />
      <group ref={turnA}>
        <group ref={turnB}>
         <group ref={centerRef}>
          <primitive object={res.atoms} />
          <primitive object={res.sticks} />
          <primitive object={res.ghosts} />
          <primitive object={res.electrons} />
          <primitive object={res.lattice} />
          <primitive object={res.routeAtoms} />
          {res.edges ? <primitive object={res.edges} /> : null}
          <SchoolBallLabels atoms={stepLabels ?? finalLabels ?? (ionLabels ? anim.ionic : anim.neutral)} crystal={crystal} opacity={labelOpacity} />
         </group>
        </group>
      </group>
    </group>
  )
}
