/**
 * Электроны «Как образуется» — чистая математика (без three): радиус точки, свободные направления слотов, положение
 * электрона в момент t (дом → перелёт → цель), середина ЗАЗОРА связи для общей пары, высота дуги перелёта, предел облаков.
 * Одна функция положения (electronPosAt) — у 3D-вида (view/electronsDraw.ts) и у автотеста (test-formation-electrons).
 *
 * Формулы (eR — радиус точки, ρ = r_i(t) + GAP):
 *  • eR = clamp(0,16·r_med, 0,016, 0,034); GAP = 1,25·eR (центр точки над поверхностью шара), PAIR = 1,15·eR (полуразнос пары:
 *    центры пары в 2,3·eR ≥ 2,2·eR).
 *  • Дом: p = c_i(t) + (r_i(t) + GAP)·û + side·PAIR·n̂, n̂ = norm(û × ẑ_m) (если |û × ẑ_m| < 0,2 — û × x̂_m); радиус r_i(t) —
 *    как у шара (ион растёт / сжимается — точка всегда снаружи).
 *  • Слот û свободен от шара j, если точка (и обе точки пары) не ближе r_j + 1,5·eR к центру j:
 *    cos θ_j ≤ (ρ² + d² − (r_j + 1,5eR)²) / (2ρd). Кандидаты û(φ, α) = cos α (cos φ x̂_m + sin φ ŷ_m) + sin α ẑ_m,
 *    φ = 0…345° через 15°, α ∈ {0°, 25°, 50°, 70°}; четыре слота — maximin по углу до соседей (штраф 0,3·α — видно сбоку),
 *    попарно ≥ 55°, при равенстве — стороны Льюиса (верх, право, низ, лево). Свободный атом — ровно 4 стороны экрана.
 *  • Общая пара: точка на оси A→B на s = r_A + (d − r_A − r_B)/2 (середина ЗАЗОРА между шарами, не середина связи),
 *    + ŵ·(смещение пары ± PAIR) + ẑ_m·(stickR + 1,1eR), ŵ = norm(ẑ_m × ось); у кратных пары разнесены на 5·eR.
 *  • Перелёт: p(u) = lerp(p0, p1, u) + ẑ_m·H·sin πu + b̂·0,08·L·sin πu (b̂ — «верх» экрана ⟂ хорде); H ≥ 0,25·L
 *    подбирается так, чтобы точка на всём пути была вне всех шаров (к зрителю путь всегда свободен).
 */
import type { SchoolHeroModel, V3 } from '../../hero/schoolHeroModel'
import type { FormationStory, StoryElectron } from '../formationStory'
import { SCHOOL_DRAW } from '../../../../lab/cinema/scenes/school/schoolModel'
import { PM_K } from '../motion'

/** центр точки над поверхностью шара, в eR */
export const E_GAP = 1.25
/** полуразнос пары, в eR */
export const E_PAIR = 1.15
/** запас «электрон вне шара соседа» при выборе слота, в eR */
const SLOT_CLEAR = 1.5
/** разнос соседних пар кратной связи, в eR */
const MULTI_STEP = 5

const deg = Math.PI / 180
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x)
const clamp01 = (x: number) => clamp(x, 0, 1)
const ease = (x: number) => {
  const u = clamp01(x)
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
}
const smooth = (x: number) => {
  const u = clamp01(x)
  return u * u * (3 - 2 * u)
}
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a: V3) => Math.hypot(a[0], a[1], a[2])
const norm = (a: V3): V3 => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

// ─── Оси экрана в координатах модели (как screenToModel в formationStory) ───
export type EFrame = { x: V3; y: V3; z: V3 }
const rotX = (p: V3, a: number): V3 => [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)]
const rotY = (p: V3, a: number): V3 => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)]
const frames = new WeakMap<SchoolHeroModel, EFrame>()
export function eFrame(model: SchoolHeroModel): EFrame {
  let f = frames.get(model)
  if (!f) {
    const s2m = (s: V3): V3 => (model.motion === 'orbit' ? rotY(rotX(s, -model.pitch), -model.yaw) : rotX(rotY(s, -model.yaw), -model.pitch))
    f = { x: s2m([1, 0, 0]), y: s2m([0, 1, 0]), z: s2m([0, 0, 1]) }
    frames.set(model, f)
  }
  return f
}

/** eR = clamp(0,16·r_med, 0,016, 0,034); r_med — медиана радиусов атомов с точками (у ионов — min(r, r_нейтр)). */
export function electronRadius(radii: readonly number[]): number {
  const s = radii.filter((r) => r > 0).sort((a, b) => a - b)
  if (!s.length) return 0.02
  const m = s.length % 2 ? s[(s.length - 1) / 2]! : 0.5 * (s[s.length / 2 - 1]! + s[s.length / 2]!)
  return clamp(0.16 * m, 0.016, 0.034)
}

/** Нормаль пары n̂ ⟂ û (в плоскости экрана, если можно). */
export function pairNormal(u: V3, f: EFrame): V3 {
  let n = cross(u, f.z)
  if (len(n) < 0.2) n = cross(u, f.x)
  return norm(n)
}

const dirOf = (f: EFrame, phi: number, alpha: number): V3 => {
  const ca = Math.cos(alpha * deg)
  const cp = Math.cos(phi * deg) * ca
  const sp = Math.sin(phi * deg) * ca
  const sa = Math.sin(alpha * deg)
  return norm([f.x[0] * cp + f.y[0] * sp + f.z[0] * sa, f.x[1] * cp + f.y[1] * sp + f.z[1] * sa, f.x[2] * cp + f.y[2] * sp + f.z[2] * sa])
}
const angDeg = (a: V3, b: V3) => Math.acos(clamp(dot(a, b), -1, 1)) / deg
const PHI_ORDER = (() => {
  const lewis = [90, 0, 270, 180]
  const rest: number[] = []
  for (let p = 0; p < 360; p += 15) if (!lewis.includes(p)) rest.push(p)
  return [...lewis, ...rest]
})()

/**
 * Четыре свободных направления слотов атома i (координаты модели) по центрам C и радиусам R всех шаров (итог PF):
 * точка (и обе точки пары) на расстоянии ρ = R_i + GAP не ближе R_j + 1,5eR к любому соседу. Порядок — порядок заполнения.
 */
export function slotDirs(i: number, C: readonly V3[], R: readonly number[], eR: number, f: EFrame): V3[] {
  const ci = C[i]!
  const rho = R[i]! + E_GAP * eR
  const hit: { c: V3; rr: number }[] = []
  const nb: V3[] = []
  for (let j = 0; j < C.length; j++) {
    if (j === i) continue
    const v = sub(C[j]!, ci)
    const d = len(v)
    if (d < 1e-9) continue
    const rr = R[j]! + SLOT_CLEAR * eR
    if (d - rr < rho + 2 * eR) hit.push({ c: v, rr })
    if (d - R[j]! < 2.5 * rho) nb.push([v[0] / d, v[1] / d, v[2] / d])
  }
  if (!nb.length && !hit.length) return [90, 0, 270, 180].map((p) => dirOf(f, p, 0))
  const free = (u: V3): boolean => {
    const n = pairNormal(u, f)
    for (const s of [0, -1, 1]) {
      const p: V3 = [u[0] * rho + n[0] * s * E_PAIR * eR, u[1] * rho + n[1] * s * E_PAIR * eR, u[2] * rho + n[2] * s * E_PAIR * eR]
      for (const h of hit) if (dist(p, h.c) < h.rr) return false
    }
    return true
  }
  type Cand = { u: V3; s: number; o: number }
  const cands: Cand[] = []
  let o = 0
  for (const alpha of [0, 25, 50, 70])
    for (const phi of PHI_ORDER) {
      const u = dirOf(f, phi, alpha)
      o++
      if (!free(u)) continue
      let a = 90
      for (const n of nb) a = Math.min(a, angDeg(u, n))
      cands.push({ u, s: a - 0.3 * alpha, o })
    }
  const minAng = (u: V3, set: Cand[]) => {
    let m = 180
    for (const c of set) m = Math.min(m, angDeg(u, c.u))
    return m
  }
  let best: Cand[] = []
  let bestQ = [-1, -Infinity, -Infinity]
  const starts = [...cands].sort((a, b) => b.s - a.s || a.o - b.o).slice(0, 32)
  for (const st of starts) {
    const set = [st]
    const cap = st.s
    while (set.length < 4) {
      let pick: Cand | null = null
      let k1 = -Infinity
      let k2 = -Infinity
      for (const c of cands) {
        if (set.includes(c)) continue
        const ma = minAng(c.u, set)
        if (ma < 55) continue
        const a1 = Math.min(c.s, cap)
        const a2 = Math.round(ma)
        if (a1 > k1 + 1e-6 || (Math.abs(a1 - k1) <= 1e-6 && a2 > k2)) ((pick = c), (k1 = a1), (k2 = a2))
      }
      if (!pick) break
      set.push(pick)
    }
    let mn = Infinity
    let sum = 0
    for (const c of set) ((mn = Math.min(mn, c.s)), (sum += c.s))
    const q = [set.length, Math.round(mn * 10) / 10, sum]
    if (q[0]! > bestQ[0]! || (q[0] === bestQ[0] && (q[1]! > bestQ[1]! || (q[1] === bestQ[1] && q[2]! > bestQ[2]! + 1e-6)))) ((best = set), (bestQ = q))
  }
  const out = best.map((c) => c.u)
  // Тесно (кристалл): добираем свободные с меньшим разносом, в крайнем случае — к зрителю.
  for (const lim of [35, 20, 0]) {
    if (out.length >= 4) break
    for (const c of cands) {
      if (out.length >= 4) break
      if (out.some((u) => angDeg(u, c.u) < lim)) continue
      out.push(c.u)
    }
  }
  while (out.length < 4) out.push(dirOf(f, 90 * out.length, 80))
  return out
}

// ─── Положение электрона ───

/** Радиус шара атома i в момент t (как atomRadiusAt в formationStory — копия, без циклического импорта). */
export function eAtomR(story: FormationStory, i: number, t: number, rFinal: number): number {
  const rn = story.rNeutral[i]!
  if (rn === rFinal) return rFinal
  const u = ease((t - story.ionWin[0]) / Math.max(1e-6, story.ionWin[1] - story.ionWin[0]))
  return rn + (rFinal - rn) * u
}

/** Конец видимости: точки гаснут до роста решётки (её ионы займут свободные направления). */
export function electronTOut(story: FormationStory, e: StoryElectron): number {
  if (e.kind === 'pair' || !story.latticeAtoms.length) return e.tOut
  const w0 = story.latticeWin[0]
  if (!Number.isFinite(w0)) return e.tOut
  return Math.min(e.tOut, w0 - (story.latticeKind === 'ionic' ? 0.45 : 0.5))
}

/** Точка дома: c + (r(t) + GAP)·û + side·PAIR·n̂. */
export function homePos(story: FormationStory, model: SchoolHeroModel, i: number, u: V3, side: number, t: number, live: readonly V3[], out: V3): V3 {
  const eR = story.eR
  const rho = eAtomR(story, i, t, model.atoms[i]!.r) + E_GAP * eR
  const c = live[i]!
  if (side === 0) {
    out[0] = c[0] + u[0] * rho
    out[1] = c[1] + u[1] * rho
    out[2] = c[2] + u[2] * rho
    return out
  }
  const n = pairNormal(u, eFrame(model))
  const k = side * E_PAIR * eR
  out[0] = c[0] + u[0] * rho + n[0] * k
  out[1] = c[1] + u[1] * rho + n[1] * k
  out[2] = c[2] + u[2] * rho + n[2] * k
  return out
}

/** Общая пара на связи a–b в момент t: середина ЗАЗОРА между шарами, ± PAIR поперёк, перед палочкой (к зрителю). */
export function bondPairPos(
  story: FormationStory,
  model: SchoolHeroModel,
  bd: NonNullable<NonNullable<StoryElectron['move']>['bond']>,
  t: number,
  live: readonly V3[],
  out: V3,
): V3 {
  const f = eFrame(model)
  const eR = story.eR
  const A = live[bd.a]!
  const B = live[bd.b]!
  const ax = sub(B, A)
  const d = len(ax) || 1e-6
  const a: V3 = [ax[0] / d, ax[1] / d, ax[2] / d]
  const rA = eAtomR(story, bd.a, t, model.atoms[bd.a]!.r)
  const rB = eAtomR(story, bd.b, t, model.atoms[bd.b]!.r)
  const s = rA + (d - rA - rB) / 2
  const zp = bondFront(model, a)
  const w = norm(cross(zp, a))
  const lat = (bd.n > 1 ? (bd.slot - (bd.n - 1) / 2) * MULTI_STEP * eR : 0) + bd.sign * E_PAIR * eR
  const z = SCHOOL_DRAW.stickR * PM_K + 1.1 * eR
  out[0] = A[0] + a[0] * s + w[0] * lat + zp[0] * z
  out[1] = A[1] + a[1] * s + w[1] * lat + zp[1] * z
  out[2] = A[2] + a[2] * s + w[2] * lat + zp[2] * z
  return out
}

/** «Перед связью»: составляющая ẑ_m, перпендикулярная оси â (если связь смотрит на зрителя — «верх» экрана ⟂ оси). */
export function bondFront(model: SchoolHeroModel, a: V3): V3 {
  const f = eFrame(model)
  const k = dot(f.z, a)
  let v: V3 = [f.z[0] - a[0] * k, f.z[1] - a[1] * k, f.z[2] - a[2] * k]
  if (len(v) < 0.35) {
    const ky = dot(f.y, a)
    v = [f.y[0] - a[0] * ky, f.y[1] - a[1] * ky, f.y[2] - a[2] * ky]
    if (len(v) < 0.2) v = cross(f.x, a)
  }
  return norm(v)
}

const _ax: V3 = [0, 0, 0]
/** Направление прихода общей пары: от оси связи наружу (к зрителю). */
function bondArrive(model: SchoolHeroModel, bd: NonNullable<NonNullable<StoryElectron['move']>['bond']>, live: readonly V3[]): V3 {
  const A = live[bd.a]!
  const B = live[bd.b]!
  _ax[0] = B[0] - A[0]
  _ax[1] = B[1] - A[1]
  _ax[2] = B[2] - A[2]
  return bondFront(model, norm(_ax))
}

/** Сторона пары дома в момент t: первый электрон слота сдвигается на −PAIR за 0,3 с, когда приходит второй. */
const sideAt = (e: StoryElectron, t: number): number => (e.homeSide && e.sideAt != null ? e.homeSide * smooth((t - e.sideAt) / 0.3) : e.homeSide)

/** Состояние точки: sc — масштаб (0 — не видна; ×1,35 в полёте), kind: 0 — своя, 1 — общая пара, 2 — летит. */
export type EState = { sc: number; kind: 0 | 1 | 2 }
const _st: EState = { sc: 0, kind: 0 }
const _p0: V3 = [0, 0, 0]
const _p1: V3 = [0, 0, 0]

/** Цель перелёта в момент t (слот акцептора или середина зазора связи). */
function targetAt(story: FormationStory, model: SchoolHeroModel, e: StoryElectron, t: number, live: readonly V3[], out: V3): V3 {
  const m = e.move!
  if (m.bond) return bondPairPos(story, model, m.bond, t, live, out)
  return homePos(story, model, m.toAtom!, m.toDir!, m.toSide ?? 0, t, live, out)
}

/**
 * Положение электрона e в момент t (пишет в out) по положениям атомов live (атомы модели в момент t).
 * Возвращает видимость и вид (один объект — переиспользуется, не хранить).
 */
export function electronPosAt(story: FormationStory, model: SchoolHeroModel, e: StoryElectron, t: number, live: readonly V3[], out: V3, H?: number): EState {
  const appear = clamp01((t - e.tIn) / 0.4)
  const vanish = 1 - clamp01((t - electronTOut(story, e)) / 0.5)
  _st.sc = appear * vanish
  _st.kind = 0
  const m = e.move
  if (!m || t < m.t0) {
    homePos(story, model, e.home, e.homeDir, sideAt(e, t), t, live, out)
    return _st
  }
  if (t >= m.t1) {
    targetAt(story, model, e, t, live, out)
    if (e.kind === 'pair') _st.kind = 1
    return _st
  }
  const u = ease((t - m.t0) / Math.max(1e-6, m.t1 - m.t0))
  homePos(story, model, e.home, e.homeDir, sideAt(e, t), t, live, _p0)
  targetAt(story, model, e, t, live, _p1)
  flightPoint(model, _p0, _p1, e.homeDir, m.bond ? bondArrive(model, m.bond, live) : (m.toDir ?? null), u, H ?? m.path?.H ?? 0, out)
  if (u > 0 && u < 1) {
    _st.kind = 2
    _st.sc *= 1.35
  } else if (e.kind === 'pair') _st.kind = 1
  return _st
}

/**
 * Путь перелёта: кубическая кривая Безье — уход по нормали слота дома d0, приход по нормали слота цели d1 (общая пара —
 * спереди, по ẑ_m), обе опорные точки подняты к зрителю на H: p(u) = B(p0, p0 + a·d0 + ẑH, p1 + a·d1 + ẑH, p1; u)
 * + b̂·0,08·L·sin πu (b̂ — «верх» экрана ⟂ хорде), a = 0,3·L. Точка уходит из шара наружу и входит в слот снаружи.
 */
export function flightPoint(model: SchoolHeroModel, p0: V3, p1: V3, d0: V3, d1: V3 | null, u: number, H: number, out: V3): V3 {
  const f = eFrame(model)
  const c = sub(p1, p0)
  const L = len(c)
  const s = Math.sin(Math.PI * u)
  let b: V3 = [f.y[0], f.y[1], f.y[2]]
  if (L > 1e-9) {
    const k = dot(b, c) / (L * L)
    b = [b[0] - c[0] * k, b[1] - c[1] * k, b[2] - c[2] * k]
    if (len(b) < 0.2) b = [f.x[0], f.x[1], f.x[2]]
    b = norm(b)
  }
  const e1 = d1 ?? f.z
  const a = 0.3 * L
  const w0 = (1 - u) * (1 - u) * (1 - u)
  const w1 = 3 * (1 - u) * (1 - u) * u
  const w2 = 3 * (1 - u) * u * u
  const w3 = u * u * u
  const side = 0.08 * L * s
  for (let q = 0; q < 3; q++) {
    const c0 = p0[q]! + d0[q]! * a + f.z[q]! * H
    const c1 = p1[q]! + e1[q]! * (a + H)
    out[q] = w0 * p0[q]! + w1 * c0 + w2 * c1 + w3 * p1[q]! + b[q]! * side
  }
  return out
}

/**
 * Высота дуги H каждого перелёта: от 0,25·L, растёт, пока точка на пути (24 отсчёта) ближе r_k + 0,65eR к центру
 * любого шара модели. Положения атомов — posAt (atomPosAt сюжета).
 */
export function fitFlightLifts(story: FormationStory, model: SchoolHeroModel, posAt: (i: number, t: number, out: V3) => V3): void {
  const n = model.atoms.length
  const eR = story.eR
  const live: V3[] = model.atoms.map(() => [0, 0, 0])
  const p: V3 = [0, 0, 0]
  const N = 48
  for (const e of story.electrons) {
    const m = e.move
    if (!m) continue
    // кадры пути: положения и радиусы шаров (от H не зависят)
    const frames: { t: number; C: V3[]; R: number[] }[] = []
    for (let s = 1; s < N; s++) {
      const t = m.t0 + ((m.t1 - m.t0) * s) / N
      for (let i = 0; i < n; i++) posAt(i, t, live[i]!)
      frames.push({ t, C: live.map((x) => [...x] as V3), R: model.atoms.map((a, i) => eAtomR(story, i, t, a.r)) })
    }
    const mid = frames[Math.floor(frames.length / 2)]!
    homePos(story, model, e.home, e.homeDir, e.homeSide, mid.t, mid.C, _p0)
    targetAt(story, model, e, mid.t, mid.C, _p1)
    let H = 0.25 * dist(_p0, _p1)
    let bestH = H
    let bestPen = Infinity
    for (let it = 0; it < 14; it++) {
      // наибольшее «вхождение» точки в шар на всём пути при этой высоте дуги
      let pen = 0
      for (const fr of frames) {
        electronPosAt(story, model, e, fr.t, fr.C, p, H)
        for (let k = 0; k < n; k++) pen = Math.max(pen, fr.R[k]! + 0.65 * eR - dist(p, fr.C[k]!))
      }
      if (pen < bestPen) ((bestPen = pen), (bestH = H))
      if (pen <= 0) break
      H = H * 1.3 + 0.5 * eR
    }
    m.path = { H: bestH }
  }
}

/**
 * Предел облака (сферы) атома i: R_eff = min(R, 0,92·min_j(d_ij − r_j)) по соседям (центры C, радиусы Rr; ex — пропустить).
 */
export function cloudLimit(i: number, R: number, C: readonly V3[], Rr: readonly number[], ex1 = -1, ex2 = -1): number {
  let m = R
  const ci = C[i]!
  for (let j = 0; j < C.length; j++) {
    if (j === i || j === ex1 || j === ex2) continue
    const cj = C[j]!
    const d = Math.hypot(cj[0] - ci[0], cj[1] - ci[1], cj[2] - ci[2])
    if (d - Rr[j]! > m / 0.92) continue
    m = Math.min(m, 0.92 * (d - Rr[j]!))
  }
  return Math.max(0, m)
}

/**
 * Предел лепестка атома i по направлению dir (единичный), толщина w: длина от центра L_eff = min(Lw, 0,92·(d·cosθ −
 * √((r_j + w)² − (d·sinθ)²))) по соседям, чей шар задевает «капсулу» лепестка (d·sinθ < r_j + w, θ < 90°).
 */
export function lobeLimit(i: number, dir: V3, Lw: number, w: number, C: readonly V3[], Rr: readonly number[], ex1 = -1, ex2 = -1): number {
  let m = Lw
  const ci = C[i]!
  for (let j = 0; j < C.length; j++) {
    if (j === i || j === ex1 || j === ex2) continue
    const cj = C[j]!
    const vx = cj[0] - ci[0]
    const vy = cj[1] - ci[1]
    const vz = cj[2] - ci[2]
    const along = vx * dir[0] + vy * dir[1] + vz * dir[2]
    if (along <= 0) continue
    const d2 = vx * vx + vy * vy + vz * vz
    const perp2 = Math.max(0, d2 - along * along)
    const rw = Rr[j]! + w
    if (perp2 >= rw * rw) continue
    const lim = 0.92 * (along - Math.sqrt(rw * rw - perp2))
    if (lim < m) m = lim
  }
  return Math.max(0, m)
}
