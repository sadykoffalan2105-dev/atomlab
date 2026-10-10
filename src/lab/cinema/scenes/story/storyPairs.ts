/**
 * ЭЛЕКТРОННЫЕ ПАРЫ, ОБЛАКА-ЛЕПЕСТКИ И ПЕРЕЛЁТ e⁻ сюжета реакции (чистый TS, без three) — та же математика, что у
 * «Как образуется» v3 (components/lab/formation/story/electrons.ts), в системе сцены сюжета (ẑ — к зрителю).
 *
 * На шагах «Разрыв / Перенос e⁻ / Образование» у атомов, участвующих в связях (концы разрываемых и новых палочек,
 * доноры и акцепторы e⁻), видны:
 *  • неподелённые пары — по Льюису (board/lewis.ts distributeElectrons: октет, сначала более электроотрицательные);
 *  • общие пары: σ — у оси связи, π — сбоку от оси (по одной на каждую лишнюю кратность); у разрываемой связи пара
 *    гаснет вместе с палочкой, у новой — появляется с ней.
 * Слева — пары исходных частиц (до отлёта атома к продукту), справа — пары продукта (после прихода на место).
 *
 * Формулы (eR = STORY_E_R — радиус точки пары; ρ = r_i(t) + GAP):
 *  • точка пары: p = c_i(t) + ρ·û ± PAIR·n̂, GAP = 1,25·eR (центр над поверхностью шара), PAIR = 1,15·eR (центры пары
 *    в 2,3·eR ≥ 2,2·eR), n̂ = norm(û × ẑ) (если |û × ẑ| < 0,2 — û × x̂); радиус r_i(t) — как у шара (ион растёт/сжимается);
 *  • слот û свободен от шара j (ВСЕ атомы, не только связанные): обе точки пары и центр не ближе r_j + 1,5·eR к центру j;
 *    проверяется по кадрам всего окна показа (атомы разлетаются и перестраиваются). Кандидаты
 *    û(φ, α) = cos α (cos φ x̂ + sin φ ŷ) + sin α ẑ, φ = 0…345° через 15°, α ∈ {15°, 35°, 55°, 75°}; выбор — меньше
 *    занятых кадров, затем maximin угла до соседей и уже выбранных слотов (≥ 50°), штраф 0,3·α (видно сбоку);
 *  • σ-пара — на середине ЗАЗОРА между шарами (s = r_a + (d − r_a − r_b)/2, радиусы в момент t), ± PAIR поперёк оси,
 *    перед палочкой на z ≥ stickR + 1,1·eR (и выше, если иначе точка ближе r + GAP к шару a или b); π — сбоку (±0,2);
 *  • если точка в каком-то кадре всё же у чужого шара или ближе 2,3·eR к другой точке — в эти моменты она плавно
 *    гаснет (окна gate), а не проходит сквозь шар;
 *  • перелёт e⁻: из слота донора, ближайшего по углу к акцептору, в слот акцептора, ближайший к донору (оба свободны
 *    от всех шаров), кубическая Безье с уходом/приходом по нормали слота, подъёмом к зрителю на H и дугой вверх
 *    (b̂ ⟂ хорде): H подбирается так, чтобы точка на всём пути была вне всех шаров (к зрителю путь всегда свободен).
 */
import { distributeElectrons, type LBond } from '../../../../components/lab/formation/board/lewis'
import type { ReactionStory, StorySide } from '../../../../chemistry/reactionStory'
import { smooth, storyAtomPos, storyAtomRadius, type StoryLayout } from './storyLayout'
import { storyVibOffset, storyVibWindow } from './storyMotion'

export type SV3 = [number, number, number]
/** Радиус точки электрона пары (единицы сцены). */
export const STORY_E_R = 0.032
/** Центр точки над поверхностью шара, полуразнос пары, запас «вне шара соседа» — в eR. */
export const STORY_E_GAP = 1.25
export const STORY_E_PAIR = 1.15
const SLOT_CLEAR = 1.5
/** Минимум между центрами двух видимых точек пар, в eR (норма 2,2 + запас). */
const DOT_SEP = 2.3
/** Радиус палочки сцены (как STICK_R в ReactionStoryScene). */
const STICK_R = 0.052
/** Летящий e⁻: радиус точки (×(1 + 0,14·min(4, n − 1)) × пульс ≤ 1,06). */
export const STORY_FLY_R = 0.088
/** Наибольший подъём дуги перелёта к зрителю. */
const H_MAX = 2.4
/** π-пара: сдвиг сбоку от оси. */
const PI_OFF = 0.2
/** Шаг кадров при подготовке (выбор слотов, окна gate, высота дуги). */
const DT = 1 / 60

/** Неподелённая пара: атом, направление слота (единичный вектор сцены), окно видимости, окна «погасить» gate. */
export type StoryLonePair = {
  readonly atom: number
  readonly dx: number
  readonly dy: number
  readonly dz: number
  readonly t0: number
  readonly t1: number
  /** пара исходной частицы (гаснет к t1) или продукта (проявляется с t0) */
  readonly left: boolean
  gate: number[]
}
/** Общая пара на палочке k раскладки: σ (у оси) или π (сбоку, side = ±1). */
export type StoryBondPair = { readonly stick: number; readonly kind: 'sigma' | 'pi'; readonly side: number; gate: number[] }
/** Перелёт e⁻ k (lay.electrons[k]): слот ухода d0, слот прихода d1, подъём к зрителю H, дуга вверх bulge, радиус точки. */
export type StoryFlight = { readonly d0: SV3; readonly d1: SV3; readonly H: number; readonly bulge: number; readonly er: number }
export type StoryPairs = {
  readonly lone: readonly StoryLonePair[]
  readonly bond: readonly StoryBondPair[]
  readonly flights: readonly StoryFlight[]
  /** атомы-участники (лепестки σ у концов палочек и облака пар) */
  readonly atoms: readonly number[]
  /** общее окно показа [on, off] */
  readonly on: number
  readonly off: number
}

// ─── векторы (локально) ───
const dot3 = (a: SV3, b: SV3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len3 = (a: SV3) => Math.hypot(a[0], a[1], a[2])
const norm3 = (a: SV3): SV3 => {
  const l = len3(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const cross3 = (a: SV3, b: SV3): SV3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const angDeg = (a: SV3, b: SV3) => (Math.acos(Math.max(-1, Math.min(1, dot3(a, b)))) * 180) / Math.PI
const Z: SV3 = [0, 0, 1]
const X: SV3 = [1, 0, 0]

/** Нормаль пары n̂ ⟂ û (в плоскости экрана, если можно). */
export function storyPairNormal(u: SV3): SV3 {
  let n = cross3(u, Z)
  if (len3(n) < 0.2) n = cross3(u, X)
  return norm3(n)
}

// ─── кадр сцены (как ReactionStoryScene.apply) ───

/** Видимость копии стопки (как ReactionStoryScene.layerVis): лицевая — 1, задние копии компактного вида — 0. */
export function storyLayerVis(lay: StoryLayout, i: number, t: number): number {
  if (!lay.compact) return 1
  const fl = lay.layerL[i] ? 0 : 1
  const fr = lay.layerR[i] ? 0 : 1
  if (fl === fr) return fl
  return fl + (fr - fl) * smooth(lay.moveFrom[i]!, lay.moveFrom[i]! + lay.moveDur, t)
}

export type StoryVib = ReturnType<typeof storyVibWindow>
const _off = [0, 0, 0]
/**
 * Кадр атомов в момент t — ровно как рисует сцена: P — центры (с тепловыми колебаниями), R — радиус шара сюжета,
 * Rv — видимый радиус (рост в начале × видимость копии стопки).
 */
export function storyFrame(lay: StoryLayout, vib: StoryVib, t: number, P: Float32Array, R: Float32Array, Rv: Float32Array): void {
  const appear = smooth(0, 0.65, t)
  for (let i = 0; i < lay.n; i++) {
    storyAtomPos(lay, i, t, P, i * 3)
    R[i] = storyAtomRadius(lay, i, t)
    storyVibOffset(vib, i, t, _off, 0)
    P[i * 3] = P[i * 3]! + _off[0]!
    P[i * 3 + 1] = P[i * 3 + 1]! + _off[1]!
    P[i * 3 + 2] = P[i * 3 + 2]! + _off[2]!
    Rv[i] = R[i]! * (0.6 + 0.4 * appear) * storyLayerVis(lay, i, t)
  }
}

// ─── неподелённые пары по Льюису ───

/** Неподелённые пары каждого атома стороны (ионное вещество — по ионам, молекула — целиком). */
function lonePairsOf(side: StorySide): number[] {
  const out = new Array<number>(side.atoms.length).fill(0)
  const run = (atoms: readonly number[], charge: number) => {
    const idx = new Map(atoms.map((a, k) => [a, k]))
    const bonds: LBond[] = side.bonds.flatMap((b) => (idx.has(b.a) && idx.has(b.b) ? [{ a: idx.get(b.a)!, b: idx.get(b.b)!, order: b.order }] : []))
    const r = distributeElectrons(atoms.map((a) => side.atoms[a]!.el), bonds, charge)
    if (r) atoms.forEach((a, k) => (out[a] = r.lone[k]!))
  }
  for (const u of side.units) {
    if (u.kind === 'metal') continue
    if (u.kind === 'ionic') for (const g of u.groups) run(side.groups[g]!.atoms, side.groups[g]!.charge)
    else run(u.atoms, u.charge)
  }
  return out
}

// ─── окна «погасить» ───

/** Множитель видимости по окнам gate [a0, b0, a1, b1, …]: внутри окна 0, плавные края 0,12 с снаружи. */
export function storyGateAt(gate: readonly number[], t: number): number {
  let g = 1
  for (let k = 0; k < gate.length; k += 2) {
    const a = gate[k]!
    const b = gate[k + 1]!
    if (t < a - 0.12 || t > b + 0.12) continue
    if (t >= a && t <= b) return 0
    g *= t < a ? 1 - smooth(a - 0.12, a, t) : smooth(b, b + 0.12, t)
  }
  return g
}

/** Отметки «занято» (кадры через 2·DT) → окна gate с запасом 0,06 с, слитые. */
function toGate(times: readonly number[]): number[] {
  const out: number[] = []
  for (const t of times) {
    const a = t - 2 * DT - 0.06
    const b = t + 2 * DT + 0.06
    if (out.length && a <= out[out.length - 1]! + 0.3) out[out.length - 1] = Math.max(out[out.length - 1]!, b)
    else out.push(a, b)
  }
  return out
}

// ─── видимость и положения точек (общие для сцены и автотеста) ───

/** Видимость пар в момент t (общее окно шага): плавно включается на разрыве и гаснет к началу «Итога». */
export function pairsVisibility(p: StoryPairs, t: number): number {
  return smooth(p.on, p.on + 0.5, t) * (1 - smooth(p.off - 0.5, p.off, t))
}

/** Видимость неподелённой пары (без окон gate): общее окно × смена «исходная → продукт» × копия стопки. */
function loneBase(pr: StoryPairs, lay: StoryLayout, lp: StoryLonePair, t: number): number {
  const side = lp.left ? 1 - smooth(lp.t1 - 0.3, lp.t1, t) : smooth(lp.t0, lp.t0 + 0.3, t)
  return pairsVisibility(pr, t) * side * storyLayerVis(lay, lp.atom, t)
}
export function storyLoneVis(pr: StoryPairs, lay: StoryLayout, lp: StoryLonePair, t: number): number {
  return loneBase(pr, lay, lp, t) * storyGateAt(lp.gate, t)
}
function bondBase(pr: StoryPairs, lay: StoryLayout, bp: StoryBondPair, t: number): number {
  const s = lay.sticks[bp.stick]!
  const alpha = s.kind === 'broken' ? 1 - smooth(s.t0, s.t1, t) : smooth(s.t0, s.t1, t)
  return pairsVisibility(pr, t) * alpha * Math.min(storyLayerVis(lay, s.a, t), storyLayerVis(lay, s.b, t))
}
export function storyBondVis(pr: StoryPairs, lay: StoryLayout, bp: StoryBondPair, t: number): number {
  return bondBase(pr, lay, bp, t) * storyGateAt(bp.gate, t)
}

/** Точка неподелённой пары (s = −1 / +1) в момент t по кадру P, R. */
export function storyLoneDot(lp: StoryLonePair, P: ArrayLike<number>, R: ArrayLike<number>, s: number, out: Float32Array | number[], o = 0): void {
  const i = lp.atom
  const u: SV3 = [lp.dx, lp.dy, lp.dz]
  const n = storyPairNormal(u)
  const rho = R[i]! + STORY_E_GAP * STORY_E_R
  const k = s * STORY_E_PAIR * STORY_E_R
  out[o] = P[i * 3]! + u[0] * rho + n[0] * k
  out[o + 1] = P[i * 3 + 1]! + u[1] * rho + n[1] * k
  out[o + 2] = P[i * 3 + 2]! + u[2] * rho + n[2] * k
}

/** «Перед связью»: ẑ без составляющей вдоль оси (связь смотрит на зрителя — экранный «верх» ⟂ оси). */
function bondFront(a: SV3): SV3 {
  const k = a[2]
  let v: SV3 = [-a[0] * k, -a[1] * k, 1 - a[2] * k]
  if (len3(v) < 0.35) {
    const ky = a[1]
    v = [-a[0] * ky, 1 - a[1] * ky, -a[2] * ky]
    if (len3(v) < 0.2) v = cross3(X, a)
  }
  return norm3(v)
}

/**
 * Точка общей пары (s = −1 / +1) на палочке bp в момент t: середина ЗАЗОРА между шарами, поперёк оси (σ) или сбоку
 * (π, вдоль оси ± PAIR), перед палочкой; подъём к зрителю — не меньше, чем нужно, чтобы точка была вне шаров a и b.
 */
export function storyBondDot(lay: StoryLayout, bp: StoryBondPair, P: ArrayLike<number>, R: ArrayLike<number>, s: number, out: Float32Array | number[], o = 0): void {
  const st = lay.sticks[bp.stick]!
  const A: SV3 = [P[st.a * 3]!, P[st.a * 3 + 1]!, P[st.a * 3 + 2]!]
  const B: SV3 = [P[st.b * 3]!, P[st.b * 3 + 1]!, P[st.b * 3 + 2]!]
  const ax: SV3 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]]
  const d = len3(ax) || 1e-6
  const a: SV3 = [ax[0] / d, ax[1] / d, ax[2] / d]
  const ra = R[st.a]!
  const rb = R[st.b]!
  const f = bondFront(a)
  const w = norm3(cross3(f, a))
  const eR = STORY_E_R
  const pairK = STORY_E_PAIR * eR
  // осевое положение и сдвиг поперёк: σ — поперёк оси (w), π — сбоку (w·±0,2) и вдоль оси ± PAIR
  let sAx = ra + (d - ra - rb) / 2
  let lat = s * pairK
  if (bp.kind === 'pi') {
    lat = bp.side * PI_OFF
    sAx += s * pairK
  }
  const gap = STORY_E_GAP * eR
  const need = (rr: number, sx: number) => Math.sqrt(Math.max(0, (rr + gap) * (rr + gap) - sx * sx - lat * lat))
  const z = Math.max(bp.kind === 'pi' ? STICK_R * 0.6 : STICK_R + 1.1 * eR, need(ra, sAx), need(rb, d - sAx))
  out[o] = A[0] + a[0] * sAx + w[0] * lat + f[0] * z
  out[o + 1] = A[1] + a[1] * sAx + w[1] * lat + f[1] * z
  out[o + 2] = A[2] + a[2] * sAx + w[2] * lat + f[2] * z
}

/** Радиус летящей точки k (с пульсом ≤ 1,06). */
export function storyFlyR(n: number): number {
  return STORY_FLY_R * (1 + 0.14 * Math.min(4, n - 1)) * 1.06
}

/**
 * Точка перелёта e⁻ (u ∈ [0, 1]) от слота донора к слоту акцептора в момент t: кубическая Безье
 * B(p0, p0 + a·d0 + ẑH, p1 + a·d1 + ẑH, p1; u) + b̂·bulge·sin² πu, a = 0,3·L, b̂ — экранный «верх» ⟂ хорде.
 */
export function storyFlightPoint(
  fl: StoryFlight,
  from: number,
  to: number,
  P: ArrayLike<number>,
  R: ArrayLike<number>,
  u: number,
  out: Float32Array | number[],
  o = 0,
  H = fl.H,
): void {
  const g0 = R[from]! + STORY_E_GAP * fl.er
  const g1 = R[to]! + STORY_E_GAP * fl.er
  const p0x = P[from * 3]! + fl.d0[0] * g0
  const p0y = P[from * 3 + 1]! + fl.d0[1] * g0
  const p0z = P[from * 3 + 2]! + fl.d0[2] * g0
  const p1x = P[to * 3]! + fl.d1[0] * g1
  const p1y = P[to * 3 + 1]! + fl.d1[1] * g1
  const p1z = P[to * 3 + 2]! + fl.d1[2] * g1
  const cx = p1x - p0x
  const cy = p1y - p0y
  const cz = p1z - p0z
  const L = Math.hypot(cx, cy, cz)
  // «верх» экрана ⟂ хорде
  let bx = 0
  let by = 1
  let bz = 0
  if (L > 1e-9) {
    const k = cy / (L * L)
    bx = -cx * k
    by = 1 - cy * k
    bz = -cz * k
    const bl = Math.hypot(bx, by, bz)
    if (bl < 0.2) {
      bx = 1
      by = 0
      bz = 0
    } else {
      bx /= bl
      by /= bl
      bz /= bl
    }
  }
  const a = 0.3 * L
  const w0 = (1 - u) * (1 - u) * (1 - u)
  const w1 = 3 * (1 - u) * (1 - u) * u
  const w2 = 3 * (1 - u) * u * u
  const w3 = u * u * u
  // дуга вверх: sin² — у концов путь идёт по нормали слота (не вбок, в соседний шар)
  const sn = Math.sin(Math.PI * u)
  const side = fl.bulge * sn * sn
  out[o] = w0 * p0x + w1 * (p0x + fl.d0[0] * a) + w2 * (p1x + fl.d1[0] * a) + w3 * p1x + bx * side
  out[o + 1] = w0 * p0y + w1 * (p0y + fl.d0[1] * a) + w2 * (p1y + fl.d1[1] * a) + w3 * p1y + by * side
  out[o + 2] = w0 * p0z + w1 * (p0z + fl.d0[2] * a + H) + w2 * (p1z + fl.d1[2] * a + H) + w3 * p1z + bz * side
}

/** Доля пути e⁻ в момент t: плавный разгон и торможение (easeInOutCubic) — как flightU сцены. */
export function storyFlightU(t0: number, t1: number, t: number): number {
  const x = t <= t0 ? 0 : t >= t1 ? 1 : (t - t0) / (t1 - t0)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}
/** Видимость летящей точки (до вылета — 0,25 с у донора, после прилёта — 0,22 с у акцептора). */
export function storyFlightVis(e: { readonly t0: number; readonly t1: number }, t: number): number {
  return smooth(e.t0 - 0.25, e.t0, t) * (1 - smooth(e.t1, e.t1 + 0.22, t))
}

// ─── подготовка ───

type Frame = { t: number; P: Float32Array; R: Float32Array; Rv: Float32Array }

/** Кандидаты направлений слота: φ = 0…345° через 15° (сначала стороны Льюиса), α — к зрителю. */
const CANDS: { u: SV3; alpha: number; o: number }[] = (() => {
  const out: { u: SV3; alpha: number; o: number }[] = []
  const lewis = [90, 0, 270, 180]
  const phis = [...lewis]
  for (let p = 0; p < 360; p += 15) if (!lewis.includes(p)) phis.push(p)
  let o = 0
  for (const alpha of [15, 35, 55, 75])
    for (const phi of phis) {
      const ca = Math.cos((alpha * Math.PI) / 180)
      out.push({ u: [Math.cos((phi * Math.PI) / 180) * ca, Math.sin((phi * Math.PI) / 180) * ca, Math.sin((alpha * Math.PI) / 180)], alpha, o: o++ })
    }
  for (const phi of [90, 0, 270, 180]) {
    const ca = Math.cos((85 * Math.PI) / 180)
    out.push({ u: [Math.cos((phi * Math.PI) / 180) * ca, Math.sin((phi * Math.PI) / 180) * ca, Math.sin((85 * Math.PI) / 180)], alpha: 85, o: o++ })
  }
  return out
})()

/** Шары рядом с атомом i в каждом кадре окна (кто вообще может задеть точку у его поверхности). */
type Near = { f: Frame; js: number[] }[]
function nearOf(i: number, frames: readonly Frame[], er: number, n: number, ray = 0): Near {
  return frames.map((f) => {
    const reach = f.R[i]! + (STORY_E_GAP + STORY_E_PAIR + SLOT_CLEAR) * er + 0.02 + ray
    const js: number[] = []
    for (let j = 0; j < n; j++) {
      if (j === i || f.Rv[j]! < 0.005) continue
      const d = Math.hypot(f.P[j * 3]! - f.P[i * 3]!, f.P[j * 3 + 1]! - f.P[i * 3 + 1]!, f.P[j * 3 + 2]! - f.P[i * 3 + 2]!)
      if (d < reach + f.Rv[j]!) js.push(j)
    }
    return { f, js }
  })
}

/** Сколько кадров окна точки слота û атома i (центр и обе точки пары, радиус точки er) у чужого шара. */
function blockedCount(i: number, u: SV3, near: Near, er: number, pair: boolean, ray = 0): number {
  const nn = storyPairNormal(u)
  // точки: центр слота, обе точки пары; у перелёта — ещё луч ухода/прихода (ρ + ray·q/3)
  const pts: [number, number][] = pair ? [[0, 0], [-1, 0], [1, 0]] : [[0, 0]]
  if (ray > 0) for (let q = 1; q <= 3; q++) pts.push([0, (ray * q) / 3])
  let cnt = 0
  for (const { f, js } of near) {
    if (!js.length) continue
    const rho0 = f.R[i]! + STORY_E_GAP * er
    const cx = f.P[i * 3]!
    const cy = f.P[i * 3 + 1]!
    const cz = f.P[i * 3 + 2]!
    let hit = false
    for (const [s, ext] of pts) {
      const k = s * STORY_E_PAIR * er
      const rho = rho0 + ext
      const px = cx + u[0] * rho + nn[0] * k
      const py = cy + u[1] * rho + nn[1] * k
      const pz = cz + u[2] * rho + nn[2] * k
      for (const j of js) {
        const rr = f.Rv[j]! + SLOT_CLEAR * er
        const dx = f.P[j * 3]! - px
        const dy = f.P[j * 3 + 1]! - py
        const dz = f.P[j * 3 + 2]! - pz
        if (dx * dx + dy * dy + dz * dz < rr * rr) {
          hit = true
          break
        }
      }
      if (hit) break
    }
    if (hit) cnt++
  }
  return cnt
}

/** Направления на соседей атома i в кадре f (связанные палочками и все шары ближе r_i + r_j + 3·eR + 0,25). */
function neighborDirs(lay: StoryLayout, i: number, f: Frame, bonded: readonly number[]): SV3[] {
  const out: SV3[] = []
  const add = (j: number) => {
    const v: SV3 = [f.P[j * 3]! - f.P[i * 3]!, f.P[j * 3 + 1]! - f.P[i * 3 + 1]!, f.P[j * 3 + 2]! - f.P[i * 3 + 2]!]
    if (len3(v) > 1e-6) out.push(norm3(v))
  }
  for (const j of bonded) add(j)
  for (let j = 0; j < lay.n; j++) {
    if (j === i || bonded.includes(j) || f.Rv[j]! < 0.005) continue
    const d = Math.hypot(f.P[j * 3]! - f.P[i * 3]!, f.P[j * 3 + 1]! - f.P[i * 3 + 1]!, f.P[j * 3 + 2]! - f.P[i * 3 + 2]!)
    if (d < f.R[i]! + f.Rv[j]! + 3 * STORY_E_R + 0.25) add(j)
  }
  return out
}

/** k слотов атома i: меньше занятых кадров → maximin угла до соседей и выбранных (≥ 50°) → меньше α → стороны Льюиса. */
function pickSlots(i: number, k: number, nb: readonly SV3[], frames: readonly Frame[], n: number, avoid: readonly SV3[] = []): SV3[] {
  if (k <= 0) return []
  const near = nearOf(i, frames, STORY_E_R, n)
  const blocked = CANDS.map((c) => blockedCount(i, c.u, near, STORY_E_R, true))
  const angNb = CANDS.map((c) => {
    let m = 180
    for (const v of nb) m = Math.min(m, angDeg(c.u, v))
    for (const v of avoid) m = Math.min(m, angDeg(c.u, v) + 30)
    return m
  })
  const out: SV3[] = []
  for (let q = 0; q < k; q++) {
    let best = -1
    let bestKey = -Infinity
    for (let ci = 0; ci < CANDS.length; ci++) {
      const c = CANDS[ci]!
      let ang = 180
      for (const u of out) ang = Math.min(ang, angDeg(c.u, u))
      if (out.some((u) => angDeg(c.u, u) < 25)) continue
      const sep = ang >= 50 ? 0 : 1
      const key = -blocked[ci]! * 1000 - sep * 500 + Math.min(angNb[ci]!, ang) - 0.3 * c.alpha - c.o * 1e-4
      if (key > bestKey) {
        bestKey = key
        best = ci
      }
    }
    if (best < 0) break
    out.push(CANDS[best]!.u)
  }
  return out
}

/** Пары, облака и перелёты по раскладке: только лицевые копии; не больше maxAtoms участников. */
export function buildStoryPairs(story: ReactionStory, lay: StoryLayout, opts: { lowPower?: boolean } = {}): StoryPairs {
  const sB = lay.steps.find((s) => s.id === 'breaking')!
  const sR = lay.steps.find((s) => s.id === 'result')!
  const on = sB.from
  // пары гаснут до того, как вокруг продукта вырастает окружение «Итога» (его частицы появляются с res.from + 0,15)
  const off = sR.from + 0.15
  const n = lay.n
  const maxAtoms = opts.lowPower ? 12 : 28
  const vib = storyVibWindow(lay.steps, lay.breakFrom)
  // участники: концы разрываемых и новых палочек, доноры и акцепторы (лицевые копии)
  const part = new Set<number>()
  const front = (i: number) => !lay.layerL[i] && !lay.layerR[i]
  lay.sticks.forEach((s) => {
    if (s.kind === 'kept') return
    if (front(s.a)) part.add(s.a)
    if (front(s.b)) part.add(s.b)
  })
  for (const i of [...lay.donors, ...lay.acceptors]) if (front(i)) part.add(i)
  const atoms = [...part].slice(0, maxAtoms)
  const pset = new Set(atoms)
  const loneL = lonePairsOf(story.left)
  const loneR = lonePairsOf(story.right)

  // кадры окна пар (и перелётов) — ровно как рисует сцена
  const tA = Math.min(on, Number.isFinite(lay.eOn) ? lay.eOn : on)
  const tB = Math.max(off, ...lay.electrons.map((e) => e.t1 + 0.25))
  const frames: Frame[] = []
  for (let t = tA; t <= tB + 1e-9; t += DT) {
    const f: Frame = { t, P: new Float32Array(n * 3), R: new Float32Array(n), Rv: new Float32Array(n) }
    storyFrame(lay, vib, t, f.P, f.R, f.Rv)
    frames.push(f)
  }
  const framesIn = (a: number, b: number, step = 1) => frames.filter((f, k) => f.t >= a - 1e-9 && f.t <= b + 1e-9 && k % step === 0)
  const frameAt = (t: number) => frames.reduce((best, f) => (Math.abs(f.t - t) < Math.abs(best.t - t) ? f : best), frames[0]!)

  // связанные палочками: слева (kept + broken), справа (kept + formed)
  const bondedOf = (i: number, right: boolean): number[] => {
    const out: number[] = []
    for (const s of lay.sticks) {
      if (right ? s.kind === 'broken' : s.kind === 'formed') continue
      const o = s.a === i ? s.b : s.b === i ? s.a : -1
      if (o >= 0) out.push(o)
    }
    return out
  }

  const lone: StoryLonePair[] = []
  for (const i of atoms) {
    const mf = lay.moveFrom[i]!
    const moving = Math.hypot(lay.p3[i * 3]! - lay.p1[i * 3]!, lay.p3[i * 3 + 1]! - lay.p1[i * 3 + 1]!) > 0.1
    // слева — до отлёта к продукту, справа — после прихода (в полёте у атома пар нет); неподвижный — смена в середине
    // образования
    const tOutL = moving ? mf + lay.moveDur * 0.15 : (lay.formFrom + lay.formTo) / 2
    const tInR = moving ? mf + lay.moveDur * 0.85 : tOutL
    const kl = Math.min(4, loneL[i] ?? 0)
    const kr = Math.min(4, loneR[story.map[i]!] ?? 0)
    if (kl > 0 && tOutL > on) {
      const fr = framesIn(on, tOutL, 3)
      const dirs = pickSlots(i, kl, neighborDirs(lay, i, frameAt(on), bondedOf(i, false)), fr, n)
      for (const d of dirs) lone.push({ atom: i, dx: d[0], dy: d[1], dz: d[2], t0: on, t1: tOutL, left: true, gate: [] })
    }
    if (kr > 0 && tInR < off) {
      const fr = framesIn(tInR, off, 3)
      const dirs = pickSlots(i, kr, neighborDirs(lay, i, frameAt(Math.max(tInR, off - 0.35)), bondedOf(i, true)), fr, n)
      for (const d of dirs) lone.push({ atom: i, dx: d[0], dy: d[1], dz: d[2], t0: tInR, t1: off, left: false, gate: [] })
    }
  }
  const bond: StoryBondPair[] = []
  lay.sticks.forEach((s, k) => {
    if (s.kind === 'kept' || !pset.has(s.a) || !pset.has(s.b)) return
    bond.push({ stick: k, kind: 'sigma', side: 0, gate: [] })
    for (let q = 1; q < s.order; q++) bond.push({ stick: k, kind: 'pi', side: q % 2 ? 1 : -1, gate: [] })
  })
  const pr: StoryPairs = { lone, bond, flights: [], atoms, on, off }

  // окна gate: точка у чужого шара (r + 0,75·eR) или ближе 2,3·eR к уже видимой точке — гаснет
  type Dot = { base: (t: number) => number; pos: (f: Frame, s: number, out: number[]) => void; owner: number[]; marks: number[] }
  const dots: Dot[] = []
  for (const bp of bond) {
    const st = lay.sticks[bp.stick]!
    dots.push({ base: (t) => bondBase(pr, lay, bp, t), pos: (f, s, out) => storyBondDot(lay, bp, f.P, f.R, s, out), owner: [st.a, st.b], marks: [] })
  }
  for (const lp of lone) dots.push({ base: (t) => loneBase(pr, lay, lp, t), pos: (f, s, out) => storyLoneDot(lp, f.P, f.R, s, out), owner: [lp.atom], marks: [] })
  const pA = [0, 0, 0]
  const pB = [0, 0, 0]
  const clearBall = 0.75 * STORY_E_R
  const sepMin = DOT_SEP * STORY_E_R
  const live: number[] = []
  const livePos: number[] = []
  for (const f of framesIn(on, off, 2)) {
    live.length = 0
    livePos.length = 0
    for (let q = 0; q < dots.length; q++) {
      const D = dots[q]!
      if (D.base(f.t) < 0.005) continue
      let bad = false
      const pts: number[] = []
      for (const s of [-1, 1]) {
        D.pos(f, s, pA)
        pts.push(pA[0]!, pA[1]!, pA[2]!)
        for (let j = 0; j < n && !bad; j++) {
          const rv = f.Rv[j]!
          if (rv < 0.005) continue
          const rr = rv + clearBall
          const dx = f.P[j * 3]! - pA[0]!
          if (dx > rr || dx < -rr) continue
          const dy = f.P[j * 3 + 1]! - pA[1]!
          const dz = f.P[j * 3 + 2]! - pA[2]!
          if (dx * dx + dy * dy + dz * dz < rr * rr) bad = true
        }
      }
      // разнос с уже видимыми точками (σ/π — раньше неподелённых, они главнее)
      for (let m = 0; m < livePos.length && !bad; m += 3) {
        for (let s = 0; s < 6 && !bad; s += 3) {
          pB[0] = pts[s]!
          pB[1] = pts[s + 1]!
          pB[2] = pts[s + 2]!
          const dx = livePos[m]! - pB[0]
          if (dx > sepMin || dx < -sepMin) continue
          if (Math.hypot(dx, livePos[m + 1]! - pB[1], livePos[m + 2]! - pB[2]) < sepMin) bad = true
        }
      }
      if (bad) {
        D.marks.push(f.t)
        continue
      }
      live.push(q)
      livePos.push(...pts)
    }
  }
  dots.forEach((D, q) => {
    const g = toGate(D.marks)
    if (q < bond.length) bond[q]!.gate = g
    else lone[q - bond.length]!.gate = g
  })

  // перелёты e⁻: слот донора ближе всего к акцептору, слот акцептора — к донору (оба свободны), высота дуги H
  const flights: StoryFlight[] = lay.electrons.map((e) => {
    const er = storyFlyR(e.n)
    const fr = framesIn(e.t0 - 0.25, e.t1 + 0.22)
    const f0 = frameAt((e.t0 + e.t1) / 2)
    const toward = (i: number, j: number): SV3 => norm3([f0.P[j * 3]! - f0.P[i * 3]!, f0.P[j * 3 + 1]! - f0.P[i * 3 + 1]!, f0.P[j * 3 + 2]! - f0.P[i * 3 + 2]!])
    // занятые неподелёнными парами направления этого атома (в окне перелёта) — e⁻ садится не на пару
    const pairDirs = (i: number): SV3[] => lone.filter((lp) => lp.atom === i && lp.t1 > e.t0 - 0.3 && lp.t0 < e.t1 + 0.3).map((lp) => [lp.dx, lp.dy, lp.dz])
    const frS = fr.filter((_, q) => q % 2 === 0)
    const Lc = Math.hypot(f0.P[e.to * 3]! - f0.P[e.from * 3]!, f0.P[e.to * 3 + 1]! - f0.P[e.from * 3 + 1]!, f0.P[e.to * 3 + 2]! - f0.P[e.from * 3 + 2]!)
    // слоты атома i по убыванию «ближе к партнёру j и свободен» (первые 4)
    const slots = (i: number, j: number): SV3[] => {
      const dir = toward(i, j)
      const occ = pairDirs(i)
      const ray = Math.min(0.3, 0.25 * Lc)
      const near = nearOf(i, frS, er, n, ray)
      const all: { u: SV3; key: number }[] = []
      for (const c of CANDS.concat(CANDS.map((x) => ({ ...x, u: [x.u[0], x.u[1], Math.max(0, x.u[2] - 0.15)] as SV3 })))) {
        const u = norm3(c.u)
        const b = blockedCount(i, u, near, er, false, ray)
        let occA = 180
        for (const v of occ) occA = Math.min(occA, angDeg(u, v))
        all.push({ u, key: -b * 1000 - (occA < 40 ? 200 : 0) + dot3(u, dir) * 100 - 0.1 * c.alpha })
      }
      all.sort((a, b) => b.key - a.key)
      const out: SV3[] = []
      for (const c of all) {
        if (out.length >= 4) break
        if (out.some((u) => angDeg(u, c.u) < 30)) continue
        out.push(c.u)
      }
      return out
    }
    const S0 = slots(e.from, e.to)
    const S1 = slots(e.to, e.from)
    const L = Math.hypot(f0.P[e.to * 3]! - f0.P[e.from * 3]!, f0.P[e.to * 3 + 1]! - f0.P[e.from * 3 + 1]!)
    const bulge = 0.3 + Math.min(0.45, L * 0.15)
    // высота H (и при нужде — дуга вверх): от 0,25·L, растёт (не выше H_MAX), пока точка в полёте ближе r_k + 0,75·er к
    // центру любого шара; концы пути — свободные слоты (от H не зависят)
    const p = [0, 0, 0]
    const fly = fr.filter((f) => f.t > e.t0 && f.t < e.t1)
    const penAt = (fl: StoryFlight, H: number) => {
      let pen = 0
      // по три отсчёта на кадр (точка в середине полёта быстрая — между кадрами не «проскочить» шар)
      for (const f of fly)
        for (const dt of [-DT / 3, 0, DT / 3]) {
          storyFlightPoint(fl, e.from, e.to, f.P, f.R, storyFlightU(e.t0, e.t1, f.t + dt), p, 0, H)
          for (let k = 0; k < n; k++) {
            const rv = f.Rv[k]!
            if (rv < 0.005) continue
            const dx = p[0]! - f.P[k * 3]!
            if (dx > rv + er || dx < -rv - er) continue
            pen = Math.max(pen, rv + 0.75 * er - Math.hypot(dx, p[1]! - f.P[k * 3 + 1]!, p[2]! - f.P[k * 3 + 2]!))
          }
        }
      return pen
    }
    let bestH = 0.25 * L
    let bestB = bulge
    let bestPen = Infinity
    let d0 = S0[0]!
    let d1 = S1[0]!
    // пары слотов (уход, приход) — по порядку, пока путь не станет свободным
    const combos: [SV3, SV3][] = []
    for (let a = 0; a < S0.length; a++) for (let b = 0; b < S1.length; b++) combos.push([S0[a]!, S1[b]!])
    combos.sort((x, y) => S0.indexOf(x[0]) + S1.indexOf(x[1]) - (S0.indexOf(y[0]) + S1.indexOf(y[1])))
    for (const [c0, c1] of combos.slice(0, 9)) {
      for (const bs of [1, 1.7, 0.4, 2.6]) {
        const fl: StoryFlight = { d0: c0, d1: c1, H: 0, bulge: bulge * bs, er }
        let H = 0.25 * L
        for (let it = 0; it < 14 && H <= H_MAX; it++) {
          const pen = penAt(fl, H)
          if (pen < bestPen - 1e-4) {
            bestPen = pen
            bestH = H
            bestB = fl.bulge
            d0 = c0
            d1 = c1
          }
          if (pen <= 0) break
          H = H * 1.25 + 0.06
        }
        if (bestPen <= 0) break
      }
      if (bestPen <= 0) break
    }
    return { d0, d1, H: bestH, bulge: bestB, er }
  })
  return { lone, bond, flights, atoms, on, off }
}
