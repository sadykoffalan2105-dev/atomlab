import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { isMetal } from '../../../chemistry/formationPlan'
import type { SchoolHeroModel, V3 } from '../hero/schoolHeroModel'
import { atomRadiusAt, clamp01, easeInOut, screenToModel, type FormationStory } from './formationStory'
import type { FormationClock } from './formationTimeline'
import { distributeElectrons, VALENCE } from './board/lewis'
import { orbitalsOf, type AtomOrbital, type Hybrid } from './story/phase'
import { phaseAtomPos } from './FormationPhaseScene'
import { smooth01 } from './motion'

/**
 * «Электронные облака» (по умолчанию ВКЛ, переключатель на доске) — поверх 3D «Как образуется», для всех веществ.
 * Химия — orbitalsOf(story) (данные B) или запасной вывод: группа → s, p; неподелённые пары — distributeElectrons;
 * гибридизация центрального неметалла по ОЭПВО (4 направления — sp³, 3 — sp², 2 — sp; H и галогены — без).
 * Таймлайн:
 *  • исходные: двухатомные молекулы (H₂, O₂, N₂, Cl₂ …) — готовое σ-облако (+ π у O=O, две π у N≡N);
 *    металл — «электронный газ» (рассеянная сфера ns);
 *  • разрыв — σ-перекрытие 1 → 0 (облако «рвётся»);
 *  • сближение / валентные e⁻ — атомные орбитали: s — сфера, p — гантели по осям будущих связей и пар, занятость по
 *    Хунду (p⁴ — одна полная ярче + две одинарные …); у гибридных — лепестки sp³ / sp² / sp (+ негибридные p для π);
 *  • пары / связи (и кислотный остаток ионных) — σ: облака тянутся по оси связи и перекрываются; π — боковые
 *    гантели сливаются над и под осью; неподелённые пары — лепестки по ОЭПВО;
 *  • переход e⁻ (ионные) — облако катиона ns сжимается 1,75r → 1,15r, у аниона p-гантели заполняются по каждому
 *    прилетевшему электрону, октет замыкается → сфера 1,75r; на последнем e⁻ — вспышка;
 *  • «Решётка» — облака гаснут за 1 с; у ковалентных — за 1,5 с от начала «Готово» (финал чистый, «как в жизни»).
 * Дёшево: один InstancedMesh эллипсоидов (≤ 360, телефон ≤ 160 — без π и без внутренних лепестков), один аддитивный
 * материал; все положения — функции времени тех же часов (перемотка безопасна), без Math.random. У больших моделей —
 * только центральная частица (молекула / формульная единица).
 * Упрощено (школьная модель): размеры облаков — в долях радиуса шара; s-сфера и внутренние доли лепестков чуть больше
 * «учебной» (иначе прячутся внутри непрозрачного шара); d-орбитали металлов не рисуем.
 */
const MAX = 360
const MAX_LOW = 160
const OPACITY = 0.2
const C_S = new THREE.Color('#67e8f9')
const C_P = new THREE.Color('#818cf8')
const C_HYB = new THREE.Color('#a5b4fc')
const C_SIGMA = new THREE.Color('#7dd3fc')
// Общая область σ — ярче соседних облаков, но без «засветки» (аддитивно ложится поверх двух σ-облаков).
const C_OVER = new THREE.Color('#e0f2fe').multiplyScalar(0.55)
const C_PI = new THREE.Color('#c084fc').multiplyScalar(0.8)
const C_CAT = new THREE.Color('#fdba74')
const C_METAL = C_CAT.clone().multiplyScalar(0.5)
const C_AN = new THREE.Color('#93c5fd')
// Неподелённая пара — розовый лепесток (отличается от σ / π) и яркая сердцевина у ядра.
const C_LONE = new THREE.Color('#f472b6').multiplyScalar(2.4)
const C_LONE_CORE = new THREE.Color('#fbcfe8').multiplyScalar(1.3)
const C_BURST = new THREE.Color('#fff1c4').multiplyScalar(1.6)
/** Сколько ионов / атомов берём у кристалла (центральная формульная единица). */
const UNIT_MAX = 12
const HALOGEN = new Set(['F', 'Cl', 'Br', 'I'])

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _d = new THREE.Vector3()
const _n = new THREE.Vector3()
const _n2 = new THREE.Vector3()
const _ax = new THREE.Vector3()
const _c = new THREE.Color()
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
const TETRA = Math.acos(-1 / 3)

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
  _pp.copy(up).addScaledVector(_a, -up.dot(_a))
  if (_pp.lengthSq() < 1e-6) _pp.set(1, 0, 0).addScaledVector(_a, -_a.x)
  _pp.normalize()
  const out = DIRS
  const k = Math.min(4, L)
  if (k === 1) out[0]!.copy(_a)
  else if (k === 2 && n >= 2) {
    _qq.crossVectors(units[0]!, units[1]!)
    if (_qq.lengthSq() < 1e-6) _qq.copy(_pp)
    _qq.normalize()
    const half = n === 2 ? TETRA_HALF : (40 * Math.PI) / 180
    out[0]!.copy(_a).multiplyScalar(Math.cos(half)).addScaledVector(_qq, Math.sin(half))
    out[1]!.copy(_a).multiplyScalar(Math.cos(half)).addScaledVector(_qq, -Math.sin(half))
  } else if (k === 2) {
    out[0]!.copy(_a).multiplyScalar(Math.cos(Math.PI / 3)).addScaledVector(_pp, Math.sin(Math.PI / 3))
    out[1]!.copy(_a).multiplyScalar(Math.cos(Math.PI / 3)).addScaledVector(_pp, -Math.sin(Math.PI / 3))
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
function centralMolecule(model: SchoolHeroModel, limit: number, only?: (i: number) => boolean): Set<number> {
  let c = -1
  let best = Infinity
  model.atoms.forEach((a, i) => {
    if (only && !only(i)) return
    const d = a.pos[0] ** 2 + a.pos[1] ** 2 + a.pos[2] ** 2
    if (d < best) ((best = d), (c = i))
  })
  if (c < 0) return new Set()
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
  const r2 = (i: number) => model.atoms[i]!.pos.reduce((s, v) => s + v * v, 0)
  const c = ions.reduce((m, x) => (r2(x.i) < r2(m.i) ? x : m), ions[0]!)
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

type LobeKind = 'bond' | 'lone' | 'single'
type OAtom = {
  i: number
  el: string
  s: number
  p: number
  hybrid: Hybrid
  role: AtomOrbital['role']
  dq: number
  /** неподелённые пары в итоговой частице (лепестки фазы связей) */
  lone: number
  /** оси p (порядок: σ, π, остальные) — у негибридных */
  ax: THREE.Vector3[]
  /** гибридные лепестки */
  hy: { dir: THREE.Vector3; kind: LobeKind }[]
  /** негибридные p (для π), заняты по одному e⁻ */
  pu: THREE.Vector3[]
  /** времена прилёта (анион) и ухода (катион) e⁻ */
  arrive: number[]
  leave: number[]
  /** начало первой связи атома (окно палочки); Infinity — связей нет */
  bondStart: number
  nb: number[]
}
type CBond = { a: number; b: number; order: number; win: [number, number][]; piN: THREE.Vector3; end: number; endDur: number }
type Plan = {
  atoms: OAtom[]
  bonds: CBond[]
  reagent: { a: number; b: number; n: number }[]
  metals: number[]
  piOn: boolean
  cores: boolean
  cap: number
  burst: { atom: number; t: number } | null
  /** окна этапов */
  rea0: number
  appr0: number
  brk: [number, number] | null
  brkGhost: { t0: number; dur: number } | null
  ionEnd: number
  ionEndDur: number
  covEnd: number
  route: [number, number] | null
}

const stageOf = (story: FormationStory, k: string) => story.stages.find((s) => s.key === k) ?? null

/** Запасной вывод орбиталей атома по группе (если B не дал story.orbitals). */
function fallbackOrbital(model: SchoolHeroModel, i: number, nb: number, lone: number): AtomOrbital {
  const a = model.atoms[i]!
  const el = a.el as string
  const metal = isMetal(el)
  const v = VALENCE[el] ?? (metal ? 2 : 0)
  let s: number
  let p: number
  if (el === 'H') ((s = 1), (p = 0))
  else if (metal) ((s = Math.min(2, v)), (p = el === 'Al' || el === 'Ga' || el === 'In' ? 1 : el === 'Sn' || el === 'Pb' ? 2 : 0))
  else ((s = Math.min(2, v)), (p = Math.max(0, v - 2)))
  const role: AtomOrbital['role'] = nb > 0 ? 'covalent' : a.charge > 0 ? 'cation' : a.charge < 0 ? 'anion' : metal ? 'metal' : 'inert'
  let hybrid: Hybrid = 'none'
  if (role === 'covalent' && !metal && el !== 'H' && !HALOGEN.has(el) && nb >= 2) {
    const dirs = nb + lone
    hybrid = dirs === 4 ? 'sp3' : dirs === 3 ? 'sp2' : dirs === 2 ? 'sp' : 'none'
  }
  return { i, el, n: 0, s, p, hybrid, lone, role, dq: a.charge }
}

/** Ортонормированный базис (e1 по dir, e2 ближе к ref). */
function basis(dir: THREE.Vector3, ref: THREE.Vector3): [THREE.Vector3, THREE.Vector3, THREE.Vector3] {
  const e1 = dir.clone().normalize()
  const e2 = ref.clone().addScaledVector(e1, -ref.dot(e1))
  if (e2.lengthSq() < 1e-6) e2.set(1, 0, 0).addScaledVector(e1, -e1.x)
  if (e2.lengthSq() < 1e-6) e2.set(0, 0, 1).addScaledVector(e1, -e1.z)
  e2.normalize()
  const e3 = new THREE.Vector3().crossVectors(e1, e2).normalize()
  return [e1, e2, e3]
}

function buildPlan(model: SchoolHeroModel, story: FormationStory, lowPower: boolean): Plan | null {
  const appr = stageOf(story, 'approach')
  if (!appr) return null // ОВР-разложение: путь — частицами сцены, облака не нужны
  const rea = stageOf(story, 'reagents')
  const brk = stageOf(story, 'break')
  const lat = stageOf(story, 'lattice')
  const fin = story.stages[story.stages.length - 1]!
  const N = model.atoms.length
  const upModel = (() => {
    const u = screenToModel(model, [0, 1, 0])
    return new THREE.Vector3(u[0], u[1], u[2]).normalize()
  })()
  const nbs = model.atoms.map(() => [] as number[])
  for (const b of model.bonds) if (!nbs[b.a]!.includes(b.b)) (nbs[b.a]!.push(b.b), nbs[b.b]!.push(b.a))
  const ed = distributeElectrons(
    model.atoms.map((a) => a.el as string),
    model.bonds.map((b) => ({ a: b.a, b: b.b, order: Math.max(1, Math.min(3, b.order)) })),
    0,
  )
  const orb = orbitalsOf(story)
  const orbOf = (i: number): AtomOrbital => {
    const o = orb?.atoms.find((x) => x.i === i)
    return o ?? fallbackOrbital(model, i, nbs[i]!.length, Math.max(0, Math.min(4, ed?.lone[i] ?? 0)))
  }
  const posOf = (i: number) => new THREE.Vector3(...model.atoms[i]!.pos)
  const stickWin = model.bonds.map((_, k) =>
    story.sticks
      .filter((s) => s.bond === k)
      .sort((x, y) => x.s - y.s)
      .map((s) => [s.t0, s.t1] as [number, number]),
  )
  // перенос e⁻: прилёт к аниону, уход от катиона
  const arrive = model.atoms.map(() => [] as number[])
  const leave = model.atoms.map(() => [] as number[])
  for (const e of story.electrons)
    if (e.kind === 'transfer' && e.move) {
      if (e.move.toAtom != null && e.move.toAtom < N) arrive[e.move.toAtom]!.push(e.move.t1)
      leave[e.home]?.push((e.move.t0 + e.move.t1) / 2)
    }
  const ionEnd = lat ? lat.t0 : fin.t0
  const ionEndDur = lat ? 1.0 : 1.5
  /** Нормаль π связи a–b: плоскость атома с ≥ 2 неколлинеарными соседями (H₂C=O), иначе «вверх» экрана (CO₂, O₂). */
  const piNormal = (a: number, b: number): THREE.Vector3 => {
    for (const at of [a, b]) {
      const nb = nbs[at]!
      if (nb.length < 2) continue
      const P = posOf(at)
      const c = new THREE.Vector3().crossVectors(posOf(nb[0]!).sub(P).normalize(), posOf(nb[1]!).sub(P).normalize())
      if (c.lengthSq() > 0.01) return c.normalize()
    }
    return upModel.clone()
  }

  const mkAtom = (i: number): OAtom => {
    const o = orbOf(i)
    const P = posOf(i)
    const nb = nbs[i]!
    const bondDirs = nb.map((j) => posOf(j).sub(P).normalize()).filter((v) => v.lengthSq() > 0.5)
    const lone = Math.max(0, Math.min(4, o.lone))
    const lds = bondDirs.length ? loneDirs(bondDirs, lone, upModel).map((v) => v.clone()) : []
    let bs = Infinity
    model.bonds.forEach((b, k) => {
      if ((b.a === i || b.b === i) && stickWin[k]!.length) bs = Math.min(bs, stickWin[k]![0]![0])
    })
    // оси p: σ (первая связь / к ближайшему противоиону), π (нормаль плоскости или «вверх» экрана), третья
    let first = bondDirs[0]
    if (!first && (o.role === 'anion' || o.role === 'cation')) {
      let best = Infinity
      model.atoms.forEach((a, j) => {
        if (j === i || Math.sign(a.charge) !== -Math.sign(model.atoms[i]!.charge)) return
        const d = posOf(j).distanceToSquared(P)
        if (d < best) ((best = d), (first = posOf(j).sub(P).normalize()))
      })
    }
    // вторая ось p — π: у концевого атома — та же нормаль, что у π его связи (непрерывно с фазой связей)
    const ref = bondDirs.length >= 2 ? new THREE.Vector3().crossVectors(bondDirs[0]!, bondDirs[1]!) : nb.length === 1 ? piNormal(i, nb[0]!) : upModel
    const ax = basis(first ?? upModel, ref.lengthSq() > 1e-4 ? ref : upModel)
    const hy: OAtom['hy'] = []
    const pu: THREE.Vector3[] = []
    if (o.hybrid !== 'none') {
      const nh = o.hybrid === 'sp3' ? 4 : o.hybrid === 'sp2' ? 3 : 2
      let dirs = [...bondDirs, ...lds]
      if (dirs.length !== nh) {
        // идеальная геометрия гибридов от первой оси
        const [e1, e2, e3] = ax
        dirs =
          nh === 2
            ? [e1.clone(), e1.clone().negate()]
            : nh === 3
              ? [0, 1, 2].map((k) => e1.clone().multiplyScalar(Math.cos((2 * Math.PI * k) / 3)).addScaledVector(e2, Math.sin((2 * Math.PI * k) / 3)))
              : [e1.clone(), ...[0, 1, 2].map((k) => e1.clone().multiplyScalar(Math.cos(TETRA)).addScaledVector(e2, Math.sin(TETRA) * Math.cos((2 * Math.PI * k) / 3)).addScaledVector(e3, Math.sin(TETRA) * Math.sin((2 * Math.PI * k) / 3)))]
      }
      const nBond = Math.min(bondDirs.length, nh)
      const nLone = Math.min(lone, nh - nBond)
      dirs.slice(0, nh).forEach((d, k) => hy.push({ dir: d.clone().normalize(), kind: k < nBond ? 'bond' : k < nBond + nLone ? 'lone' : 'single' }))
      // негибридные p (⟂ плоскости sp² или две ⟂ оси sp) — заняты оставшимися e⁻ по одному (для π)
      const rem = Math.max(0, o.s + o.p - nBond - 2 * nLone - (nh - nBond - nLone))
      if (nh === 3) {
        const nrm = new THREE.Vector3().crossVectors(hy[0]!.dir, hy[1]!.dir)
        if (nrm.lengthSq() > 1e-4 && rem > 0) pu.push(nrm.normalize())
      } else if (nh === 2) {
        const [, e2, e3] = basis(hy[0]!.dir, ref.lengthSq() > 1e-4 ? ref : upModel)
        if (rem > 0) pu.push(e2)
        if (rem > 1) pu.push(e3)
      }
    }
    return { i, el: o.el, s: o.s, p: o.p, hybrid: o.hybrid, role: o.role, dq: o.dq ?? model.atoms[i]!.charge, lone, ax, hy, pu, arrive: arrive[i]!.sort((x, y) => x - y), leave: leave[i]!.sort((x, y) => x - y), bondStart: bs, nb }
  }

  const covEnd = fin.t0
  const mkBond = (k: number, sel: Set<number>): CBond | null => {
    const b = model.bonds[k]!
    if (!sel.has(b.a) || !sel.has(b.b)) return null
    const inner = !!lat
    return { a: b.a, b: b.b, order: Math.max(1, Math.min(3, b.order)), win: stickWin[k]!, piN: piNormal(b.a, b.b), end: inner ? ionEnd : covEnd, endDur: inner ? ionEndDur : 1.5 }
  }

  const cap0 = lowPower ? MAX_LOW : MAX
  const cost = (sel: Set<number>, piOn: boolean, cores: boolean) => {
    let val = 0
    let bond = 0
    for (const i of sel) {
      const o = orbOf(i)
      if (o.role === 'cation' || o.role === 'metal') val += 1
      else if (o.hybrid !== 'none') val += (o.hybrid === 'sp3' ? 4 : o.hybrid === 'sp2' ? 3 : 2) * (cores ? 2 : 1) + 4
      else val += 8
      bond += Math.min(4, o.lone) * (cores ? 2 : 1)
    }
    for (const b of model.bonds) if (sel.has(b.a) && sel.has(b.b)) bond += 3 + (piOn ? 4 * (Math.max(1, Math.min(3, b.order)) - 1) : 0)
    let rea = 0
    for (const s of story.reagentSticks) if (sel.has(s.a)) rea += 3 + (s.n > 1 ? 2 : 0)
    return Math.max(rea + val, val + bond) + 1
  }
  const all = new Set(model.atoms.map((_, i) => i))
  const ionsAll = model.atoms.map((a, i) => ({ i, q: a.charge })).filter((x) => x.q !== 0 && nbs[x.i]!.length === 0)
  const central = (): Set<number> => {
    if (ionsAll.length) {
      const u = centralUnit(model, ionsAll)
      // кислотный остаток / OH⁻ у центра (Na₂SO₄, NaOH) — ближайшая к центру связанная группа
      if (ionsAll.length < N) for (const x of centralMolecule(model, 8, (i) => nbs[i]!.length > 0)) u.add(x)
      return u
    }
    return centralMolecule(model, 24)
  }
  let sel = model.kind === 'crystal' ? central() : all
  let piOn = !lowPower
  let cores = !lowPower
  if (cost(sel, piOn, cores) > cap0 && sel === all) sel = central()
  if (cost(sel, piOn, cores) > cap0) ((piOn = false), (cores = false))
  if (!sel.size) return null

  const atoms = [...sel].sort((x, y) => x - y).map(mkAtom)
  const bonds = model.bonds.map((_, k) => mkBond(k, sel)).filter((x): x is CBond => !!x)
  const pairs = new Map<string, { a: number; b: number; n: number }>()
  for (const s of story.reagentSticks) if (sel.has(s.a)) pairs.set(`${s.a}:${s.b}`, { a: s.a, b: s.b, n: Math.max(1, Math.min(3, s.n)) })
  const inPair = new Set<number>()
  for (const p of pairs.values()) (inPair.add(p.a), p.b >= 0 && inPair.add(p.b))
  const metals = atoms.filter((o) => isMetal(o.el) && !inPair.has(o.i) && o.nb.length === 0).map((o) => o.i)
  // вспышка: последний прилетевший к аниону e⁻
  let burst: Plan['burst'] = null
  for (const o of atoms) if (o.role === 'anion' && o.arrive.length) {
    const t = o.arrive[o.arrive.length - 1]!
    if (!burst || t > burst.t) burst = { atom: o.i, t }
  }
  const rs = story.routeStage
  return {
    atoms,
    bonds,
    reagent: [...pairs.values()],
    metals,
    piOn,
    cores,
    cap: cap0,
    burst,
    rea0: rea ? rea.t0 : 0,
    appr0: appr.t0,
    brk: brk ? [brk.t0, brk.t0 + Math.max(0.3, brk.dur - 0.6)] : null,
    brkGhost: brk ? { t0: brk.t0, dur: brk.dur } : null,
    ionEnd,
    ionEndDur,
    covEnd,
    route: rs ? [rs.t0, rs.t0 + rs.dur] : null,
  }
}

/** Занятость оси j (0…2) p-подуровня при e электронах (дробно — плавно) по правилу Хунда. */
function hundOcc(e: number, j: number): number {
  return clamp01(e - j) + clamp01(e - 3 - (2 - j))
}
/** Сумма плавных ступенек (каждый e⁻ — за 0,4 с после момента). */
function arrived(ts: readonly number[], t: number, lag = 0.4): number {
  let n = 0
  for (const x of ts) {
    if (t <= x) break
    n += smooth01((t - x) / lag)
  }
  return n
}

export function FormationClouds({ model, story, clock, lowPower }: { model: SchoolHeroModel; story: FormationStory; clock: MutableRefObject<FormationClock>; lowPower: boolean }) {
  const scene = useThree((s) => s.scene)
  const host = useRef<THREE.Object3D | null>(null)
  const plan = useMemo(() => buildPlan(model, story, lowPower), [model, story, lowPower])

  const res = useMemo(() => {
    if (!plan) return null
    const geo = new THREE.SphereGeometry(1, lowPower ? 12 : 20, lowPower ? 8 : 14)
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: OPACITY, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    const mesh = new THREE.InstancedMesh(geo, mat, plan.cap)
    mesh.name = 'formation-clouds'
    mesh.frustumCulled = false
    mesh.matrixAutoUpdate = false
    mesh.renderOrder = 5
    mesh.count = 0
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

  const upModel = useMemo(() => {
    const u = screenToModel(model, [0, 1, 0])
    return new THREE.Vector3(u[0], u[1], u[2]).normalize()
  }, [model])

  useFrame(() => {
    if (!plan || !res) return
    const { mesh } = res
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
    const cap = plan.cap
    let n = 0
    // сцена пути получения: исходные спрятаны — и их облака тоже
    const hide = plan.route ? clamp01((t - plan.route[0]) / 0.5) * (1 - clamp01((t - (plan.route[1] - 0.5)) / 0.5)) : 0
    const keep = 1 - hide
    const put = (x: number, y: number, z: number, axis: THREE.Vector3 | null, half: number, wide: number, col: THREE.Color, k: number) => {
      if (n >= cap || k < 0.004 || half < 1e-5 || wide < 1e-5) return
      if (axis) _q.setFromUnitVectors(_Y, axis)
      else _q.identity()
      _m.compose(_p.set(x, y, z), _q, _s.set(wide, half, wide))
      mesh.setMatrixAt(n, _m)
      mesh.setColorAt(n, _c.copy(col).multiplyScalar(k))
      n++
    }
    const lobe = (P: V3, dir: THREE.Vector3, off: number, half: number, wide: number, col: THREE.Color, k: number) =>
      put(P[0] + dir.x * off, P[1] + dir.y * off, P[2] + dir.z * off, dir, half, wide, col, k)
    const rOf = (i: number) => atomRadiusAt(story, i, t, model.atoms[i]!.r)

    // ── 1. Исходные: σ (+π) двухатомных молекул, «электронный газ» металла ──
    const eRea = smooth01((t - plan.rea0) / 0.6) * (1 - smooth01((t - plan.appr0) / 0.8)) * keep
    if (eRea > 0.004) {
      const ur = plan.brk ? 1 - smooth01((t - plan.brk[0]) / (plan.brk[1] - plan.brk[0])) : 1
      const gb = plan.brkGhost
      const gu = gb ? easeInOut((t - gb.t0 - 0.6) / (gb.dur - 0.6)) : 1
      for (const pr of plan.reagent) {
        phaseAtomPos(story, model, pr.a, t, A)
        const ra = rOf(pr.a)
        let rb: number
        let kb = 1
        if (pr.b >= 0) {
          phaseAtomPos(story, model, pr.b, t, B)
          rb = rOf(pr.b)
        } else {
          const g = story.ghosts[-1 - pr.b]
          if (!g) continue
          B[0] = g.p0[0] + (g.p1[0] - g.p0[0]) * gu
          B[1] = g.p0[1] + (g.p1[1] - g.p0[1]) * gu
          B[2] = g.p0[2] + (g.p1[2] - g.p0[2]) * gu
          rb = g.r
          kb = 1 - gu
        }
        _d.set(B[0] - A[0], B[1] - A[1], B[2] - A[2])
        const d = Math.max(1e-4, _d.length())
        _d.multiplyScalar(1 / d)
        for (const [P, r, sgn, kk] of [
          [A, ra, 1, 1],
          [B, rb, -1, kb],
        ] as const) {
          const half = r * 0.9 + (Math.max(r * 0.9, d * 0.5) - r * 0.9) * ur
          put(P[0] + _d.x * half * 0.95 * sgn, P[1] + _d.y * half * 0.95 * sgn, P[2] + _d.z * half * 0.95 * sgn, _d, half, r * (0.55 + 0.12 * ur), C_SIGMA, eRea * kk)
        }
        const rm = Math.min(ra, rb)
        put((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2, _d, d * 0.32 * ur, rm * 0.5 * ur, C_OVER, eRea)
        if (pr.n > 1 && plan.piOn) {
          // π готовой молекулы (O=O — одна, N≡N — две взаимно ⟂): слитые лепестки над и под осью
          _n.copy(upModel).addScaledVector(_d, -upModel.dot(_d))
          if (_n.lengthSq() < 1e-6) _n.set(1, 0, 0).addScaledVector(_d, -_d.x)
          _n.normalize()
          for (let j = 1; j < pr.n; j++) {
            const perp = j === 1 ? _n : _n2.crossVectors(_n, _d).normalize()
            const off = rm * 0.95
            for (const side of [1, -1]) put((A[0] + B[0]) / 2 + perp.x * off * side, (A[1] + B[1]) / 2 + perp.y * off * side, (A[2] + B[2]) / 2 + perp.z * off * side, _d, (d * 0.5 + rm * 0.5) * (0.6 + 0.4 * ur), rm * 0.42, C_PI, eRea * ur)
          }
        }
      }
      for (const i of plan.metals) {
        phaseAtomPos(story, model, i, t, A)
        const r = rOf(i) * 1.6
        put(A[0], A[1], A[2], null, r, r, C_METAL, eRea)
      }
    }

    // ── 2. Атомные орбитали (сближение / валентные e⁻) и ионы при переходе e⁻ ──
    const eIn = smooth01((t - plan.appr0 - 0.4) / 1.0) * keep
    if (eIn > 0.004) {
      const ionOut = 1 - smooth01((t - plan.ionEnd) / plan.ionEndDur)
      const iw = story.ionWin
      const ionU = Number.isFinite(iw[0]) ? easeInOut((t - iw[0]) / Math.max(1e-3, iw[1] - iw[0])) : 0
      for (const o of plan.atoms) {
        phaseAtomPos(story, model, o.i, t, A)
        const r = rOf(o.i)
        if (o.role === 'cation' || o.role === 'metal') {
          // облако ns катиона сжимается по мере ухода e⁻: 1,75r → 1,15r
          const give = Math.max(1, Math.abs(o.dq) || o.s || 1)
          const gone = o.leave.length ? arrived(o.leave, t) : give * ionU
          const fr = clamp01(gone / give)
          const f = 1.75 + (1.15 - 1.75) * fr
          put(A[0], A[1], A[2], null, r * f, r * f, C_CAT, eIn * ionOut * (1 - 0.45 * fr))
          continue
        }
        if (o.role === 'anion') {
          const need = Math.max(0, -o.dq)
          const got = o.arrive.length ? arrived(o.arrive, t) : need * ionU
          const e = o.p + got
          const close = smooth01(e - 5)
          const k = eIn * ionOut
          put(A[0], A[1], A[2], null, r * 1.2, r * 1.2, C_S, k * 0.35 * (1 - close))
          for (let j = 0; j < 3; j++) {
            const occ = hundOcc(e, j)
            if (occ <= 0) continue
            const sz = smooth01(occ)
            const br = 1 + 0.6 * clamp01(occ - 1)
            for (const sg of [1, -1]) lobe(A, j === 0 ? o.ax[0]! : j === 1 ? o.ax[1]! : o.ax[2]!, 0.85 * r * sg, 0.8 * r * (0.5 + 0.5 * sz), 0.42 * r, C_P, k * sz * br * (1 - close))
          }
          put(A[0], A[1], A[2], null, r * 1.75, r * 1.75, C_AN, k * close)
          continue
        }
        // ковалентный атом: атомные орбитали гаснут, когда начинается его первая связь (их сменяют σ / π / пары)
        const kv = eIn * (1 - smooth01((t - (Number.isFinite(o.bondStart) ? o.bondStart - 0.3 : plan.covEnd)) / 0.8)) * (o.role === 'inert' ? 0.6 : 1)
        if (kv <= 0.004) continue
        if (o.hybrid === 'none') {
          const isH = o.el === 'H'
          put(A[0], A[1], A[2], null, r * (isH ? 1.45 : 1.2), r * (isH ? 1.45 : 1.2), C_S, kv * (isH ? 1 : 0.45))
          for (let j = 0; j < 3; j++) {
            const occ = hundOcc(o.p, j)
            if (occ <= 0) continue
            const br = occ > 1.5 ? 1.6 : 1
            for (const sg of [1, -1]) lobe(A, o.ax[j]!, 0.85 * r * sg, 0.8 * r, 0.42 * r, C_P, kv * br)
          }
        } else {
          for (const hl of o.hy) {
            const col = hl.kind === 'lone' ? C_LONE : C_HYB
            const kk = hl.kind === 'lone' ? 0.45 : 1
            // гибридный лепесток: большая капля наружу + малая внутрь
            lobe(A, hl.dir, 0.9 * r, 1.1 * r, 0.55 * r, col, kv * kk)
            if (plan.cores) lobe(A, hl.dir, -0.55 * r, 0.55 * r, 0.4 * r, col, kv * kk * 0.7)
          }
          for (const ax of o.pu) for (const sg of [1, -1]) lobe(A, ax, 0.85 * r * sg, 0.8 * r, 0.42 * r, C_P, kv)
        }
      }
    }

    // ── 3. Связи: σ, π, неподелённые пары ──
    for (const b of plan.bonds) {
      const w0 = b.win[0]
      if (!w0) continue
      const eb = smooth01((t - (w0[0] - 0.4)) / 0.6) * (1 - smooth01((t - b.end) / b.endDur)) * keep
      if (eb <= 0.004) continue
      phaseAtomPos(story, model, b.a, t, A)
      phaseAtomPos(story, model, b.b, t, B)
      const ra = rOf(b.a)
      const rb = rOf(b.b)
      _d.set(B[0] - A[0], B[1] - A[1], B[2] - A[2])
      const d = Math.max(1e-4, _d.length())
      _d.multiplyScalar(1 / d)
      const u = easeInOut((t - w0[0]) / Math.max(1e-3, w0[1] - w0[0]))
      for (const [P, r, sgn] of [
        [A, ra, 1],
        [B, rb, -1],
      ] as const) {
        const half = r * 0.9 + (Math.max(r * 0.9, d * 0.5) - r * 0.9) * u
        put(P[0] + _d.x * half * 0.95 * sgn, P[1] + _d.y * half * 0.95 * sgn, P[2] + _d.z * half * 0.95 * sgn, _d, half, r * (0.55 + 0.12 * u), C_SIGMA, eb)
      }
      const rm = Math.min(ra, rb)
      put((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2, _d, d * 0.32 * u, rm * 0.5 * u, C_OVER, eb)
      if (!plan.piOn || b.order < 2) continue
      // π: первая — нормаль плоскости атома (или «вверх» экрана), вторая — d × n₁; при связывании сливаются над/под осью
      _n.copy(b.piN).addScaledVector(_d, -b.piN.dot(_d))
      if (_n.lengthSq() < 1e-6) _n.copy(upModel).addScaledVector(_d, -upModel.dot(_d))
      if (_n.lengthSq() < 1e-6) _n.set(1, 0, 0).addScaledVector(_d, -_d.x)
      _n.normalize()
      for (let j = 1; j < b.order; j++) {
        const pw = b.win[j]
        const v = pw ? easeInOut((t - pw[0]) / Math.max(1e-3, pw[1] - pw[0])) : 0
        const perp = j === 1 ? _n : _n2.crossVectors(_d, _n).normalize()
        _ax.copy(perp).lerp(_d, v).normalize()
        for (const [P, r, sgn] of [
          [A, ra, 1],
          [B, rb, -1],
        ] as const)
          for (const side of [1, -1]) {
            const off = r * (0.95 - 0.15 * v)
            const along = (d * 0.25 + r * 0.1) * v * sgn
            put(
              P[0] + perp.x * off * side + _d.x * along,
              P[1] + perp.y * off * side + _d.y * along,
              P[2] + perp.z * off * side + _d.z * along,
              _ax,
              r * (0.75 + v * Math.max(0, (d * 0.5) / Math.max(1e-4, r) - 0.5) * 0.6),
              r * 0.42,
              C_PI,
              eb,
            )
          }
      }
    }
    for (const o of plan.atoms) {
      if (o.lone <= 0 || !o.nb.length || !Number.isFinite(o.bondStart)) continue
      const end = plan.bonds.find((b) => b.a === o.i || b.b === o.i)
      const el = smooth01((t - (o.bondStart - 0.4)) / 0.6) * (1 - smooth01((t - (end ? end.end : plan.covEnd)) / (end ? end.endDur : 1.5))) * keep
      if (el <= 0.004) continue
      phaseAtomPos(story, model, o.i, t, A)
      const r = rOf(o.i)
      const units: THREE.Vector3[] = []
      for (let j = 0; j < o.nb.length && j < 6; j++) {
        phaseAtomPos(story, model, o.nb[j]!, t, NB)
        const u = UPOOL[j]!.set(NB[0] - A[0], NB[1] - A[1], NB[2] - A[2])
        if (u.lengthSq() > 1e-8) units.push(u.normalize())
      }
      if (!units.length) continue
      for (const dir of loneDirs(units, o.lone, upModel)) {
        lobe(A, dir, 1.7 * r, 0.8 * r, 0.4 * r, C_LONE, el)
        if (plan.cores) lobe(A, dir, 1.25 * r, 0.36 * r, 0.22 * r, C_LONE_CORE, el)
      }
    }

    // ── 4. Вспышка: октет аниона замкнулся последним e⁻ ──
    if (plan.burst) {
      const u = (t - plan.burst.t) / 0.8
      if (u > 0 && u < 1) {
        phaseAtomPos(story, model, plan.burst.atom, t, A)
        const r = rOf(plan.burst.atom) * (1.3 + 1.7 * smooth01(u))
        put(A[0], A[1], A[2], null, r, r, C_BURST, (1 - u) * (1 - u) * keep)
      }
    }

    mesh.count = n
    mesh.visible = n > 0
    if (n > 0) {
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  })

  return res ? <primitive object={res.mesh} /> : null
}
