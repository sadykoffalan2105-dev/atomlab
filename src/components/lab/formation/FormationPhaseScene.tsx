import { useEffect, useMemo, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SCHOOL_DRAW } from '../../../lab/cinema/scenes/school/schoolModel'
import { schoolBallRadius, type SchoolHeroModel, type V3 } from '../hero/schoolHeroModel'
import { createSchoolMatteMaterial, SCHOOL_STICK_HEX, schoolAtomColor, schoolSphereGeometry, schoolStickGeometry } from '../hero/schoolHeroStyle'
import { atomPosAt, screenToModel, type FormationStory } from './formationStory'
import type { FormationClock } from './formationTimeline'
import { PM_K, smooth01 } from './motion'
import { phaseInfoOf, phaseOf, type FinalPhase } from './story/phase'
import { applyLatticeSnap } from './story/lattice'

/**
 * Итог «как в жизни» (25 °C) — слой внутри группы атомов FormationMoleculeView (та же система координат, что у шаров):
 *  • газ — 6–10 копий молекулы далеко друг от друга (R ≈ 2,2–3,4 радиуса модели), медленный дрейф и вращение;
 *    честно: в настоящем газе молекулы ещё в ~10 раз дальше (подпись — в HUD у B); копии мельче (0,8·r) и тусклее
 *    (цвет 0,4 к фону) — модель главная; кадр держит копии на 0,8 (обрезка краем допустима);
 *  • жидкость — 12 копий вплотную (направления кубооктаэдра, шаг 1,08 диаметра), медленное коллективное движение;
 *    копии 0,9·r, цвет 0,25 к фону;
 *  • раствор — молекулы воды (O–H 96 пм, 104,5°) кольцом; сильная кислота: H⁺ уходит к воде → H₃O⁺ (O–H 98 пм),
 *    слабая — одна вода подходит (водородная связь O···H 180 пм) и отходит;
 *  • ионные / молекулярные / цепные — фрагмент решётки остаётся (это делает сам вид), сеть — модель и есть каркас.
 * Всё — функции времени (перемотка безопасна), без Math.random. Не стартует раньше fin.t0 + 0,6 с.
 */

const hash = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return x - Math.floor(x)
}
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const addk = (a: V3, b: V3, k: number): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: V3) => Math.hypot(a[0], a[1], a[2])
const norm = (a: V3): V3 => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
/** Единичный вектор, перпендикулярный a (предпочтительно в плоскости, заданной ref). */
const perpTo = (a: V3, ref: V3): V3 => {
  let p = addk(ref, a, -dot(ref, a))
  if (len(p) < 1e-4) p = addk([1, 0, 0], a, -a[0])
  if (len(p) < 1e-4) p = addk([0, 1, 0], a, -a[1])
  return norm(p)
}

/** Длины воды (справочные): O–H 96 пм, ∠HOH 104,5°; O–H в H₃O⁺ 98 пм; водородная связь O···H 180 пм. */
const D_OH = 96 * PM_K
const D_OH3 = 98 * PM_K
const D_HBOND = 180 * PM_K
const HALF_HOH = ((104.5 / 2) * Math.PI) / 180
/** Половина угла между неподелёнными парами воды (тетраэдр: 109,5° / 2). */
const HALF_LP = ((109.47 / 2) * Math.PI) / 180
const ATOM_BUDGET = 160
/** Копии газа / жидкости: радиус относительно атома модели и доля смешения цвета с фоном. */
export const PHASE_COPY = { gas: { r: 0.8, dim: 0.4 }, liquid: { r: 0.9, dim: 0.25 } } as const
const PHASE_BG = new THREE.Color('#0b1020')
const WATER_BUDGET = 8
const ELNEG = new Set(['N', 'O', 'F', 'Cl', 'Br', 'I', 'S'])

type Copy = { c: V3; dir: V3; q0: THREE.Quaternion; axis: THREE.Vector3; w: number; v: V3; tIn: number; ph: number }
type Water = { O: V3; H1: V3; H2: V3; tIn: number; move: null | { dir: V3; dist: number; t0: number; t1: number } }
type Acid = { i: number; to: V3; t0: number; t1: number }
export type PhaseLayout = {
  phase: FinalPhase
  t0: number
  Rm: number
  kind: 'copies' | 'waters' | 'none'
  copies: Copy[]
  liquid: boolean
  D: number
  waters: Water[]
  acid: Acid[]
  /** атомов в одной копии и связей (для палочек — только у молекул > 3 атомов) */
  nA: number
  sticks: boolean
}

const cache = new WeakMap<FormationStory, Map<string, PhaseLayout>>()

/** Раскладка сцены фазы (кэш по сюжету): копии, вода, уход H⁺. Чистая функция модели и сюжета. */
export function phaseLayout(story: FormationStory, model: SchoolHeroModel, lowPower: boolean): PhaseLayout {
  const key = lowPower ? 'lo' : 'hi'
  let m = cache.get(story)
  if (!m) cache.set(story, (m = new Map()))
  const hit = m.get(key)
  if (hit) return hit
  const L = buildLayout(story, model, lowPower)
  m.set(key, L)
  return L
}

function buildLayout(story: FormationStory, model: SchoolHeroModel, lowPower: boolean): PhaseLayout {
  const fin = story.stages[story.stages.length - 1]!
  const phase = phaseOf(story)
  const info = phaseInfoOf(story)
  const Rm = Math.max(0.05, model.radius)
  const nA = model.atoms.length
  const base: PhaseLayout = { phase, t0: fin.t0 + 0.6, Rm, kind: 'none', copies: [], liquid: false, D: 2 * Rm, waters: [], acid: [], nA, sticks: false }
  if (model.kind === 'crystal' || nA === 0) return base
  if (phase === 'gas' || phase === 'liquid') {
    const liquid = phase === 'liquid'
    let n = liquid ? 12 : Math.max(0, Math.min(10, Math.round(info.copies)))
    if (!liquid && n > 0) n = Math.max(6, n)
    if (lowPower) n = Math.floor(n / 2)
    n = Math.min(n, Math.floor(ATOM_BUDGET / Math.max(1, nA)))
    if (n <= 0) return base
    const D = 2 * Rm
    const copies: Copy[] = []
    // кубооктаэдр — 12 ближайших соседей ГЦК (плотная упаковка жидкости)
    const CUBO: V3[] = []
    for (const [a, b] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ] as const)
      for (const sa of [1, -1])
        for (const sb of [1, -1]) {
          const v: V3 = [0, 0, 0]
          v[a] = sa
          v[b] = sb
          CUBO.push(norm(v))
        }
    const spacing = liquid ? Math.max(1.02, info.spacing || 1.08) : Math.max(2.2, info.spacing || 2.6)
    for (let k = 0; k < n; k++) {
      let dir: V3
      let R: number
      if (liquid) {
        dir = CUBO[k]!
        R = spacing * D
      } else {
        // сфера Фибоначчи (равномерно по направлениям), сжатая по оси взгляда (×0,45 в координатах экрана):
        // копии не встают прямо перед / за центральной молекулой и не заслоняют её
        const y = 1 - (2 * (k + 0.5)) / n
        const rr = Math.sqrt(Math.max(0, 1 - y * y))
        const th = k * 2.39996 + 0.7
        dir = norm(screenToModel(model, norm([rr * Math.cos(th), y, 0.45 * rr * Math.sin(th)])))
        R = (spacing / 2.6) * (2.2 + 1.2 * hash(k, 1)) * Rm
      }
      const u1 = hash(k, 2)
      const u2 = hash(k, 3)
      const u3 = hash(k, 4)
      const q0 = new THREE.Quaternion(
        Math.sqrt(1 - u1) * Math.sin(2 * Math.PI * u2),
        Math.sqrt(1 - u1) * Math.cos(2 * Math.PI * u2),
        Math.sqrt(u1) * Math.sin(2 * Math.PI * u3),
        Math.sqrt(u1) * Math.cos(2 * Math.PI * u3),
      ).normalize()
      const axis = new THREE.Vector3(hash(k, 5) * 2 - 1, hash(k, 6) * 2 - 1, hash(k, 7) * 2 - 1)
      if (axis.lengthSq() < 1e-4) axis.set(0, 1, 0)
      axis.normalize()
      // дрейф газа — по касательной (радиальное расстояние растёт медленно), 0,08·R_model/с
      const tan = perpTo(dir, [hash(k, 8) - 0.5, hash(k, 9) - 0.5, hash(k, 10) - 0.5])
      copies.push({ c: [dir[0] * R, dir[1] * R, dir[2] * R], dir, q0, axis, w: liquid ? 0.15 : 0.25, v: liquid ? [0, 0, 0] : [tan[0] * 0.08 * Rm, tan[1] * 0.08 * Rm, tan[2] * 0.08 * Rm], tIn: fin.t0 + 0.6 + 0.12 * k, ph: 2 * Math.PI * hash(k, 11) })
    }
    return { ...base, kind: 'copies', copies, liquid, D, sticks: nA > 3 && model.bonds.length > 0 }
  }
  if (phase === 'solution') {
    const nW = Math.max(4, Math.min(WATER_BUDGET, Math.round(info.waters ?? 6)))
    const diss = info.dissociation ?? 'none'
    const acidIdx = (info.acidH ?? []).filter((i) => i >= 0 && i < nA && model.atoms[i]!.el === 'H')
    const ex = screenToModel(model, [1, 0, 0])
    const ey = screenToModel(model, [0, 1, 0])
    const ez = norm(cross(ex, ey))
    const rH = schoolBallRadius('H' as never)
    const rO = schoolBallRadius('O' as never)
    const wExt = D_OH + rH
    const Rw = Math.max(1.6 * Rm, Rm + rO + wExt * 1.1)
    const waters: Water[] = []
    const acid: Acid[] = []
    const used: V3[] = []
    // Вода с неподелённой парой, направленной по e (к H кислоты): b = −c·e + s·m, n = s·e + c·m (пара = e).
    const lpWater = (O: V3, e: V3): { H1: V3; H2: V3 } => {
      const m0 = perpTo(e, ez)
      const c = Math.cos(HALF_LP)
      const s = Math.sin(HALF_LP)
      const b = norm(addk(addk([0, 0, 0], e, -c), m0, s))
      const nn = norm(addk(addk([0, 0, 0], e, s), m0, c))
      const p = norm(cross(b, nn))
      const h1 = addk(addk([0, 0, 0], b, Math.cos(HALF_HOH)), p, Math.sin(HALF_HOH))
      const h2 = addk(addk([0, 0, 0], b, Math.cos(HALF_HOH)), p, -Math.sin(HALF_HOH))
      return { H1: addk(O, h1, D_OH), H2: addk(O, h2, D_OH) }
    }
    // Вода, повёрнутая атомом H к точке X (водородная связь к аниону / электроотрицательному атому) или O к X.
    const aimWater = (O: V3, X: V3, hToward: boolean): { H1: V3; H2: V3 } => {
      const e = norm(sub(X, O))
      if (hToward) {
        const m0 = perpTo(e, ez)
        const h2 = addk(addk([0, 0, 0], e, Math.cos(2 * HALF_HOH)), m0, Math.sin(2 * HALF_HOH))
        return { H1: addk(O, e, D_OH), H2: addk(O, h2, D_OH) }
      }
      // O к X: биссектриса H–O–H — от X
      const b: V3 = [-e[0], -e[1], -e[2]]
      const p = perpTo(b, ez)
      return {
        H1: addk(O, addk(addk([0, 0, 0], b, Math.cos(HALF_HOH)), p, Math.sin(HALF_HOH)), D_OH),
        H2: addk(O, addk(addk([0, 0, 0], b, Math.cos(HALF_HOH)), p, -Math.sin(HALF_HOH)), D_OH),
      }
    }
    const T0 = fin.t0 + 0.6
    // 1) приёмники H⁺ (сильная кислота) / вода у H (слабая): по направлению от центра к кислотному H
    const recv = diss === 'none' ? [] : diss === 'weak' ? acidIdx.slice(0, 1) : acidIdx.slice(0, nW)
    for (const i of recv) {
      const h = model.atoms[i]!.pos
      const dir = len(h) > 1e-4 ? norm(h) : ey
      const O: V3 = [dir[0] * Rw, dir[1] * Rw, dir[2] * Rw]
      const e = norm(sub(h, O))
      const w = lpWater(O, e)
      if (diss === 'strong') {
        acid.push({ i, to: addk(O, e, D_OH3), t0: fin.t0 + 0.8, t1: fin.t0 + 2.4 })
        waters.push({ O, ...w, tIn: T0 + 0.12 * waters.length, move: null })
      } else {
        const dist = Math.max(0, len(sub(h, O)) - D_HBOND)
        waters.push({ O, ...w, tIn: T0 + 0.12 * waters.length, move: { dir: e, dist, t0: fin.t0 + 1.0, t1: fin.t0 + 3.8 } })
      }
      used.push(dir)
    }
    // 2) остальные — кольцом в плоскости экрана, подальше от приёмников
    const M = 24
    const cand: V3[] = []
    for (let k = 0; k < M; k++) {
      const a = (2 * Math.PI * k) / M + 0.13
      cand.push(norm(addk(addk([0, 0, 0], ex, Math.cos(a)), ey, Math.sin(a))))
    }
    while (waters.length < nW) {
      let best = -1
      let bestD = -Infinity
      cand.forEach((d, k) => {
        const md = used.length ? Math.min(...used.map((u) => 1 - dot(u, d))) : 1 + k * 1e-6
        if (md > bestD + 1e-9) ((bestD = md), (best = k))
      })
      if (best < 0) break
      const dir = cand.splice(best, 1)[0]!
      used.push(dir)
      const O: V3 = [dir[0] * Rw, dir[1] * Rw, dir[2] * Rw]
      // ближайший атом модели: электроотрицательный (Cl⁻ после ухода H⁺, O, N) — к нему H воды; H / катион — к нему O
      let nearI = 0
      let nd = Infinity
      model.atoms.forEach((a, i) => {
        if (acid.some((x) => x.i === i)) return
        const d = len(sub(a.pos, O))
        if (d < nd) ((nd = d), (nearI = i))
      })
      const na = model.atoms[nearI]!
      const w = aimWater(O, na.pos, ELNEG.has(na.el) || na.charge < 0)
      waters.push({ O, ...w, tIn: T0 + 0.12 * waters.length, move: null })
    }
    return { ...base, kind: 'waters', waters, acid }
  }
  return base
}

/** Доля ухода H⁺ кислоты (0…1) у атома i модели — для палочки H–A и подписи. */
export function acidDetach(story: FormationStory, model: SchoolHeroModel, i: number, t: number): number {
  const L = phaseLayout(story, model, false)
  for (const a of L.acid) if (a.i === i) return smooth01((t - a.t0) / (a.t1 - a.t0))
  return 0
}

/**
 * Положение атома i модели с учётом сцены фазы (уход H⁺ к воде) и «усадки в узлы» решётки (latticeSnap, ионные) —
 * пишет в out.
 */
export function phaseAtomPos(story: FormationStory, model: SchoolHeroModel, i: number, t: number, out: V3): V3 {
  atomPosAt(story, i, t, out)
  applyLatticeSnap(story, i, t, out)
  const L = phaseLayout(story, model, false)
  if (!L.acid.length) return out
  for (const a of L.acid)
    if (a.i === i && t > a.t0) {
      const u = smooth01((t - a.t0) / (a.t1 - a.t0))
      out[0] += (a.to[0] - out[0]) * u
      out[1] += (a.to[1] - out[1]) * u
      out[2] += (a.to[2] - out[2]) * u
    }
  return out
}

const _q = new THREE.Quaternion()
const _qs = new THREE.Quaternion()
const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _a = new THREE.Vector3()
const _s = new THREE.Vector3()
const _ax = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _c = new THREE.Color()

function copyCenter(L: PhaseLayout, c: Copy, t: number, out: THREE.Vector3): THREE.Vector3 {
  if (L.liquid) {
    // коллективное движение жидкости: большая амплитуда, низкая частота (0,3 Гц) — не дрожь
    const k = 0.04 * L.D * Math.sin(2 * Math.PI * 0.3 * t + c.ph)
    return out.set(c.c[0] + c.dir[0] * k, c.c[1] + c.dir[1] * k, c.c[2] + c.dir[2] * k)
  }
  const dt = Math.max(0, t - c.tIn)
  return out.set(c.c[0] + c.v[0] * dt, c.c[1] + c.v[1] * dt, c.c[2] + c.v[2] * dt)
}

function waterO(w: Water, t: number, out: V3): V3 {
  let k = 0
  if (w.move && t > w.move.t0) {
    const u = Math.min(1, (t - w.move.t0) / (w.move.t1 - w.move.t0))
    const s = Math.sin(Math.PI * u)
    k = w.move.dist * s * s
  }
  out[0] = w.move ? w.move.dir[0] * k : 0
  out[1] = w.move ? w.move.dir[1] * k : 0
  out[2] = w.move ? w.move.dir[2] * k : 0
  return out
}

/** Радиус кадра сцены фазы в момент t (мир модели): копии / вода включаются по мере появления. */
export function phaseExtent(L: PhaseLayout, t: number): number {
  if (L.kind === 'none' || t < L.t0) return 0
  let R = 0
  if (L.kind === 'copies')
    for (const c of L.copies) {
      const s = smooth01((t - c.tIn) / 1.0)
      if (s <= 0) continue
      copyCenter(L, c, t, _p)
      // копии в кадре на 0,8: модель крупнее, крайние копии может обрезать край окна
      R = Math.max(R, 0.8 * s * (_p.length() + L.Rm))
    }
  else
    for (const w of L.waters) {
      const s = smooth01((t - w.tIn) / 1.0)
      if (s <= 0) continue
      R = Math.max(R, s * (len(w.O) + D_OH + schoolBallRadius('O' as never)))
    }
  return R
}

const WATER_EL = ['O', 'H', 'H'] as const
const _wo: V3 = [0, 0, 0]

/** copiesCap — не больше стольких копий молекул (лаборатория: копии не выходят за свободную часть кадра); по умолчанию — все. */
export function FormationPhaseScene({ model, story, clock, lowPower, copiesCap }: { model: SchoolHeroModel; story: FormationStory; clock: MutableRefObject<FormationClock>; lowPower: boolean; copiesCap?: number }) {
  const L = useMemo(() => phaseLayout(story, model, lowPower), [story, model, lowPower])
  const res = useMemo(() => {
    if (L.kind === 'none') return null
    const nInst = L.kind === 'copies' ? L.copies.length * L.nA : L.waters.length * 3
    if (nInst <= 0) return null
    const mat = createSchoolMatteMaterial()
    const atoms = new THREE.InstancedMesh(schoolSphereGeometry(lowPower), mat, nInst)
    atoms.name = 'formation-phase-atoms'
    atoms.frustumCulled = false
    atoms.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    const dim = L.kind === 'copies' ? (L.liquid ? PHASE_COPY.liquid.dim : PHASE_COPY.gas.dim) : 0
    for (let k = 0; k < nInst; k++) {
      const el = L.kind === 'copies' ? model.atoms[k % L.nA]!.el : WATER_EL[k % 3]!
      atoms.setColorAt(k, schoolAtomColor(el as never, _c).lerp(PHASE_BG, dim))
      atoms.setMatrixAt(k, _m.makeScale(1e-5, 1e-5, 1e-5))
    }
    let sticks: THREE.InstancedMesh | null = null
    let stickMat: THREE.Material | null = null
    if (L.kind === 'copies' && L.sticks) {
      stickMat = createSchoolMatteMaterial(SCHOOL_STICK_HEX.dark)
      sticks = new THREE.InstancedMesh(schoolStickGeometry(), stickMat, L.copies.length * model.bonds.length)
      sticks.frustumCulled = false
      sticks.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    }
    const pool = Array.from({ length: L.nA }, () => new THREE.Vector3())
    return { atoms, mat, sticks, stickMat, pool }
  }, [L, model, lowPower])

  useEffect(
    () => () => {
      res?.mat.dispose()
      res?.stickMat?.dispose()
      res?.atoms.dispose()
      res?.sticks?.dispose()
    },
    [res],
  )

  useFrame(() => {
    if (!res) return
    const t = clock.current.t
    const on = t >= L.t0
    res.atoms.visible = on
    if (res.sticks) res.sticks.visible = on
    if (!on) return
    if (L.kind === 'copies') {
      const rK = L.liquid ? PHASE_COPY.liquid.r : PHASE_COPY.gas.r
      if (copiesCap != null) {
        const cap = Math.max(0, Math.min(L.copies.length, Math.floor(copiesCap)))
        res.atoms.count = cap * L.nA
        if (res.sticks) res.sticks.count = cap * model.bonds.length
      }
      const rS = SCHOOL_DRAW.stickR * PM_K * 0.7 * rK
      let ks = 0
      L.copies.forEach((c, k) => {
        const s = smooth01((t - c.tIn) / 1.0)
        copyCenter(L, c, t, _a)
        _qs.setFromAxisAngle(c.axis, c.w * Math.max(0, t - c.tIn))
        _q.copy(_qs).multiply(c.q0)
        for (let i = 0; i < L.nA; i++) {
          const a = model.atoms[i]!
          const P = res.pool[i]!.set(a.pos[0], a.pos[1], a.pos[2]).applyQuaternion(_q).add(_a)
          _m.compose(P, _qs.identity(), _s.setScalar(Math.max(1e-5, a.r * rK * s)))
          res.atoms.setMatrixAt(k * L.nA + i, _m)
        }
        if (res.sticks)
          for (const b of model.bonds) {
            const A = res.pool[b.a]!
            const B = res.pool[b.b]!
            _ax.copy(B).sub(A)
            const d = _ax.length()
            if (d < 1e-6) {
              res.sticks.setMatrixAt(ks++, _m.makeScale(1e-5, 1e-5, 1e-5))
              continue
            }
            _ax.divideScalar(d)
            _qs.setFromUnitVectors(_up, _ax)
            _p.copy(A).add(B).multiplyScalar(0.5)
            _m.compose(_p, _qs, _s.set(rS * Math.max(1e-3, s), d * Math.max(1e-3, s), rS * Math.max(1e-3, s)))
            res.sticks.setMatrixAt(ks++, _m)
          }
      })
      if (res.sticks) res.sticks.instanceMatrix.needsUpdate = true
    } else {
      L.waters.forEach((w, k) => {
        const s = smooth01((t - w.tIn) / 1.0)
        waterO(w, t, _wo)
        const pts = [w.O, w.H1, w.H2]
        for (let j = 0; j < 3; j++) {
          const P = pts[j]!
          _m.compose(_p.set(P[0] + _wo[0], P[1] + _wo[1], P[2] + _wo[2]), _q.identity(), _s.setScalar(Math.max(1e-5, schoolBallRadius(WATER_EL[j] as never) * s)))
          res.atoms.setMatrixAt(k * 3 + j, _m)
        }
      })
    }
    res.atoms.instanceMatrix.needsUpdate = true
  })

  if (!res) return null
  return (
    <>
      <primitive object={res.atoms} />
      {res.sticks ? <primitive object={res.sticks} /> : null}
    </>
  )
}
