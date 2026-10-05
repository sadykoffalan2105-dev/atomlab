/**
 * Быстрое 3D для СОБРАННОЙ молекулы (может не быть в реестре), прямо в браузере.
 *
 * 1) Начальная раскладка по VSEPR обходом в ширину: тетраэдр (sp³), треугольник (sp²), линия (sp);
 *    первая тяжёлая ветвь — анти (зигзаг), остальные заторможены (±60° / 120°); цис/транс двойной связи — как задано.
 * 2) Мини-силовое поле в виде проекции ограничений (position-based): длины связей, углы (через расстояния 1–3),
 *    плоскость и цис/транс у двойных и ароматических связей (расстояния 1–4), отталкивание несвязанных атомов.
 * Когда собранное совпало с молекулой реестра, UI берёт точные координаты RDKit (registry.ts).
 */
import type { OV2Hybridization } from '../../data/organicV2/types'
import { aromaticBonds } from './canonical'
import { bondKey, dihedral, toMol, type BondOrder, type Mol, type SkeletonGraph } from './graph'

export type Vec3 = [number, number, number]

export interface Embedded3D {
  /** атомы: сначала тяжёлые (в порядке toMol), затем H */
  readonly atoms: readonly { readonly el: string; readonly p: Vec3; readonly hyb: OV2Hybridization; readonly charge: number }[]
  readonly bonds: readonly { readonly a: number; readonly b: number; readonly o: BondOrder; readonly ar?: boolean }[]
  /** для каждого атома — индекс в исходном SkeletonGraph (-1 — добавленный H) */
  readonly src: readonly number[]
  /** число тяжёлых атомов (первые `heavy` атомов) */
  readonly heavy: number
  /** время расчёта, мс */
  readonly ms: number
  /** идеальные длины связей, Å (для проверки качества) */
  readonly idealLengths: readonly number[]
  /** идеальные углы: центр, два соседа, угол в градусах */
  readonly idealAngles: readonly { readonly c: number; readonly a: number; readonly b: number; readonly deg: number }[]
}

const COV: Record<string, number> = { H: 0.31, C: 0.76, N: 0.71, O: 0.66, F: 0.57, S: 1.05, P: 1.07, Cl: 1.02, Br: 1.2, I: 1.39, B: 0.84 }

function idealLength(e1: string, h1: OV2Hybridization, e2: string, h2: OV2Hybridization, o: number, ar: boolean): number {
  const [a, b, ha, hb] = e1 <= e2 ? [e1, e2, h1, h2] : [e2, e1, h2, h1]
  const k = `${a}${b}`
  if (ar && k === 'CC') return 1.39
  if (ar && k === 'CN') return 1.34
  if (k === 'CC') {
    if (o === 3) return 1.2
    if (o === 2) return 1.335
    const s = (h: OV2Hybridization) => (h === 'sp3' ? 0 : h === 'sp2' ? 1 : 2)
    return [1.53, 1.5, 1.465, 1.465, 1.44, 1.38][Math.min(5, s(ha) + s(hb) + (s(ha) && s(hb) ? 1 : 0))]
  }
  if (k === 'CH') { const h = a === 'C' ? ha : hb; return h === 'sp' ? 1.065 : h === 'sp2' ? 1.083 : 1.093 }
  if (k === 'CO') { if (o === 2) return 1.215; return (a === 'C' ? ha : hb) === 'sp3' ? 1.425 : 1.35 }
  if (k === 'HO') return 0.972
  if (k === 'CN') { if (o === 3) return 1.16; if (o === 2) return 1.28; return (a === 'C' ? ha : hb) === 'sp3' ? 1.465 : 1.4 }
  if (k === 'HN') return 1.015
  if (k === 'NO') return o === 2 ? 1.225 : 1.23
  if (k === 'CF') return 1.36
  if (k === 'CCl') return 1.785
  if (k === 'BrC') return 1.945
  if (k === 'CI') return 2.14
  if (k === 'CS') return 1.82
  if (k === 'HS') return 1.34
  if (k === 'OS') return o === 2 ? 1.45 : 1.6
  return (COV[a] ?? 0.8) + (COV[b] ?? 0.8) - (o === 2 ? 0.2 : o === 3 ? 0.34 : 0)
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l] }
function perp(u: Vec3): Vec3 { return norm(Math.abs(u[0]) < 0.9 ? cross(u, [1, 0, 0]) : cross(u, [0, 1, 0])) }

/**
 * 3D-координаты для скелета (H добавляются автоматически).
 * @param g скелет (или Mol)
 * @param opts.iterations число проходов силового поля (по умолчанию 160, с циклами — 300)
 */
export function embed3D(g: SkeletonGraph | Mol, opts: { iterations?: number } = {}): Embedded3D {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const m = 'adj' in g ? g : toMol(g)
  const aro = aromaticBonds(m)
  // ── полный список атомов (тяжёлые + H)
  const el: string[] = [...m.el]
  const charge: number[] = [...m.ch]
  const src: number[] = [...m.src]
  const nb: { to: number; o: number; ar: boolean }[][] = m.adj.map((l, i) => l.map((e) => ({ to: e.to, o: e.o, ar: aro.has(bondKey(i, e.to)) })))
  for (let i = 0; i < m.n; i++) for (let k = 0; k < m.hc[i]; k++) {
    const h = el.length
    el.push('H'); charge.push(0); src.push(-1); nb.push([{ to: i, o: 1, ar: false }]); nb[i].push({ to: h, o: 1, ar: false })
  }
  const N = el.length
  // ── гибридизация
  const hyb: OV2Hybridization[] = el.map((e, i) => {
    if (e === 'H' || e === 'F' || e === 'Cl' || e === 'Br' || e === 'I') return ''
    const d = nb[i].filter((x) => x.o === 2).length, t = nb[i].some((x) => x.o === 3)
    if (t || d >= 2 && e === 'C') return 'sp'
    if (d === 1 || nb[i].some((x) => x.ar)) return 'sp2'
    if (e === 'N' && charge[i] > 0) return 'sp2'
    if (e === 'N' && nb[i].some((x) => el[x.to] === 'C' && nb[x.to].some((y) => y.o === 2 && el[y.to] === 'O'))) return 'sp2' // амид
    return 'sp3'
  })
  // размер наименьшего цикла через угол a–c–b (0 — не в цикле) и через атом c
  const angleRing = new Map<string, number>()
  const ringAngle = (c: number, a: number, b: number): number => {
    const key = `${c}:${Math.min(a, b)}:${Math.max(a, b)}`
    if (angleRing.has(key)) return angleRing.get(key)!
    const d = new Map<number, number>([[a, 0]])
    const q = [a]
    let res = 0
    for (let h = 0; h < q.length && !res; h++) {
      const v = q[h]
      if (d.get(v)! >= 6) break
      for (const e of nb[v]) {
        if (e.to === c || d.has(e.to)) continue
        d.set(e.to, d.get(v)! + 1)
        if (e.to === b) { res = d.get(v)! + 3; break }
        q.push(e.to)
      }
    }
    angleRing.set(key, res)
    return res
  }
  const ringSizeAtCache = new Map<number, number>()
  const ringSizeAt = (c: number): number => {
    if (ringSizeAtCache.has(c)) return ringSizeAtCache.get(c)!
    let best = 0
    const l = nb[c]
    for (let x = 0; x < l.length; x++) for (let y = x + 1; y < l.length; y++) {
      if (el[l[x].to] === 'H' || el[l[y].to] === 'H') continue
      const r = ringAngle(c, l[x].to, l[y].to)
      if (r && (!best || r < best)) best = r
    }
    ringSizeAtCache.set(c, best)
    return best
  }
  const isExoExo = (c: number, a: number, b: number) => !nb[c].some((e) => e.to !== a && e.to !== b && (ringAngle(c, a, e.to) || ringAngle(c, b, e.to)))
  const angleAt = (c: number, a: number, b: number): number => {
    const h = hyb[c]
    if (h === 'sp') return 180
    // малые циклы: угол в кольце и углы с внешними заместителями
    const rc = ringSizeAt(c)
    if (rc > 0 && rc <= 5) {
      const ring = ringAngle(c, a, b)
      if (rc === 3) return ring === 3 ? 60 : ring ? 60 : nb[c].every((e) => e.to === a || e.to === b || ringAngle(c, a, e.to) === 3 || ringAngle(c, b, e.to) === 3) ? 118 : 115
      if (rc === 4) return ring === 4 ? 88.5 : isExoExo(c, a, b) ? 109.5 : 114.5
      if (rc === 5) {
        if (h === 'sp2') return ring === 5 ? 108 : 126
        return ring === 5 ? 104.5 : isExoExo(c, a, b) ? 108.5 : 112
      }
    }
    if (h === 'sp2') {
      if (el[c] === 'C' && nb[c].length === 3) {
        // у карбонильного C угол O=C–X чуть больше
        const dbl = nb[c].find((x) => x.o === 2 && el[x.to] === 'O')
        if (dbl && (a === dbl.to || b === dbl.to)) return 123
        if (dbl) return 114
      }
      return 120
    }
    if (el[c] === 'O') {
      const toCarbonyl = nb[c].some((x) => hyb[x.to] === 'sp2' && el[x.to] === 'C')
      if (el[a] === 'H' || el[b] === 'H') return toCarbonyl ? 106.5 : 107.5
      return toCarbonyl ? 116 : 111.5
    }
    if (el[c] === 'N' && nb[c].length === 3) return 108.5
    return 109.47
  }
  // ── идеальные длины
  const bonds: { a: number; b: number; o: BondOrder; ar?: boolean }[] = []
  const r0: number[] = []
  const r0map = new Map<string, number>()
  for (let i = 0; i < N; i++) for (const e of nb[i]) if (e.to > i) {
    bonds.push(e.ar ? { a: i, b: e.to, o: e.o as BondOrder, ar: true } : { a: i, b: e.to, o: e.o as BondOrder })
    const L = idealLength(el[i], hyb[i], el[e.to], hyb[e.to], e.o, e.ar)
    r0.push(L); r0map.set(bondKey(i, e.to), L)
  }
  const len = (a: number, b: number) => r0map.get(bondKey(a, b))!
  // ── начальная раскладка (обход в ширину, тяжёлые соседи раньше H)
  const P: Vec3[] = Array.from({ length: N }, () => [0, 0, 0] as Vec3)
  const placed = new Array(N).fill(false)
  const parent = new Array(N).fill(-1)
  const stereoFor = (a: number, b: number) => {
    const st = m.stereo.get(bondKey(a, b))
    if (!st) return null
    return a < b ? { ra: st.ref[0], rb: st.ref[1], v: st.v } : { ra: st.ref[1], rb: st.ref[0], v: st.v }
  }
  const order = (i: number) => [...nb[i]].sort((x, y) => (el[x.to] === 'H' ? 1 : 0) - (el[y.to] === 'H' ? 1 : 0) || nb[y.to].length - nb[x.to].length || x.to - y.to)
  const root = m.n ? [...Array(m.n).keys()].sort((a, b) => nb[b].length - nb[a].length)[0] : 0
  placed[root] = true
  const queue = [root]
  // кольцевые связи: атом встретили снова — замыкание
  while (queue.length) {
    const i = queue.shift()!
    const kids = order(i).filter((e) => !placed[e.to]).map((e) => e.to)
    if (!kids.length) continue
    const p = parent[i]
    const h = hyb[i]
    if (p < 0) {
      // корень: стандартные направления
      const dirs: Vec3[] = h === 'sp' ? [[1, 0, 0], [-1, 0, 0]]
        : h === 'sp2' ? [[1, 0, 0], [-0.5, 0.866, 0], [-0.5, -0.866, 0]]
          : [[1, 0, 0], [-0.3338, 0.9428, 0], [-0.3338, -0.4714, 0.8165], [-0.3338, -0.4714, -0.8165]]
      kids.forEach((k, j) => { P[k] = add(P[i], mul(dirs[j % dirs.length], len(i, k))); placed[k] = true; parent[k] = i; queue.push(k) })
      continue
    }
    const u = norm(sub(P[p], P[i])) // к родителю
    // опорный атом: сосед родителя (не i), для двойной связи — по стереохимии
    const st = stereoFor(p, i)
    const refCands = nb[p].map((e) => e.to).filter((x) => x !== i && placed[x])
    let ref = st && placed[st.ra] ? st.ra : refCands.sort((a, b) => (el[a] === 'H' ? 1 : 0) - (el[b] === 'H' ? 1 : 0))[0]
    let v: Vec3
    if (ref !== undefined) {
      const r = sub(P[ref], P[p])
      const rp = sub(r, mul(u, dot(r, u)))
      v = Math.hypot(...rp) < 1e-6 ? perp(u) : norm(rp)
    } else { v = perp(u); ref = -1 }
    const w = cross(u, v)
    const theta = (Math.PI / 180) * (h === 'sp' ? 180 : h === 'sp2' ? 120 : 109.47)
    // торсии детей относительно опоры: анти первый, затем по кругу
    const tors = h === 'sp2' ? [180, 0] : h === 'sp' ? [180] : [180, 60, -60]
    let kidsOrdered = kids
    if (st) {
      // ребёнок-опора стереосвязи: цис → 0°, транс → 180°
      const want = st.v === 'cis' ? 0 : 180
      const refKid = kids.includes(st.rb) ? st.rb : -1
      if (refKid >= 0) {
        const other = kids.filter((k) => k !== refKid)
        kidsOrdered = want === 180 ? [refKid, ...other] : [...other, refKid]
        if (want === 0 && other.length === 0) kidsOrdered = [refKid]
        if (want === 0) {
          kidsOrdered.forEach((k) => {
            const phi = (Math.PI / 180) * (k === refKid ? 0 : 180)
            const d = add(mul(u, Math.cos(theta)), mul(add(mul(v, Math.cos(phi)), mul(w, Math.sin(phi))), Math.sin(theta)))
            P[k] = add(P[i], mul(norm(d), len(i, k))); placed[k] = true; parent[k] = i; queue.push(k)
          })
          continue
        }
      }
    }
    // уже занятые направления (замыкания колец) — сдвигаем торсии на свободные
    kidsOrdered.forEach((k, j) => {
      const phi = (Math.PI / 180) * tors[j % tors.length]
      const d = add(mul(u, Math.cos(theta)), mul(add(mul(v, Math.cos(phi)), mul(w, Math.sin(phi))), Math.sin(theta)))
      P[k] = add(P[i], mul(norm(d), len(i, k)))
      placed[k] = true; parent[k] = i; queue.push(k)
    })
  }
  // ── молекулы с циклами: начальная раскладка — классическое многомерное шкалирование по топологическим расстояниям
  const ringy = bonds.length - N + 1 > 0
  const topoD = ringy ? allPairsTopo(nb) : null
  if (ringy && topoD) mdsLayout(topoD, P)
  // ── ограничения
  type C = { a: number; b: number; d: number; k: number; min?: boolean }
  const cons: C[] = []
  bonds.forEach((b, j) => cons.push({ a: b.a, b: b.b, d: r0[j], k: 1 }))
  const idealAngles: { c: number; a: number; b: number; deg: number }[] = []
  const topo = new Map<string, number>()
  for (let c = 0; c < N; c++) {
    const l = nb[c]
    for (let x = 0; x < l.length; x++) for (let y = x + 1; y < l.length; y++) {
      const a = l[x].to, b = l[y].to
      const deg = angleAt(c, a, b)
      idealAngles.push({ c, a, b, deg })
      const ra = len(c, a), rb = len(c, b)
      const d = Math.sqrt(ra * ra + rb * rb - 2 * ra * rb * Math.cos((deg * Math.PI) / 180))
      cons.push({ a, b, d, k: 0.6 })
      topo.set(bondKey(a, b), 2)
    }
  }
  for (const b of bonds) topo.set(bondKey(b.a, b.b), 1)
  // плоскость и цис/транс у двойных/ароматических связей: расстояния 1–4 по начальной раскладке
  for (const b of bonds) {
    if (b.o !== 2 && !b.ar) continue
    for (const x of nb[b.a].map((e) => e.to)) for (const y of nb[b.b].map((e) => e.to)) {
      if (x === b.b || y === b.a || x === y) continue
      let cis: boolean
      const ringBond = (ringy || b.ar) && inRingPath(nb, -1, b.a, b.b, -1)
      const st = stereoFor(b.a, b.b)
      if (ringBond) {
        // в цикле: x и y в одном кольце — цис; в разных кольцах (сочленение) или один внешний — транс; оба внешних — цис
        const xr = inRingPath(nb, x, b.a, b.b, -1), yr = inRingPath(nb, -1, b.a, b.b, y)
        cis = xr && yr ? inRingPath(nb, x, b.a, b.b, y) : xr === yr
      } else if (st) cis = (x === st.ra) === (y === st.rb) ? st.v === 'cis' : st.v !== 'cis'
      else if (!ringy) cis = Math.abs(dihedral(P[x], P[b.a], P[b.b], P[y])) < Math.PI / 2
      else {
        // не задано: главные (первые тяжёлые) заместители — транс
        const fx = nb[b.a].map((e) => e.to).filter((t) => t !== b.b).sort((p, q) => (el[p] === 'H' ? 1 : 0) - (el[q] === 'H' ? 1 : 0) || p - q)[0]
        const fy = nb[b.b].map((e) => e.to).filter((t) => t !== b.a).sort((p, q) => (el[p] === 'H' ? 1 : 0) - (el[q] === 'H' ? 1 : 0) || p - q)[0]
        cis = (x === fx) !== (y === fy)
      }
      const r1 = len(x, b.a), r2 = len(b.a, b.b), r3 = len(b.b, y)
      const t1 = (angleAt(b.a, x, b.b) * Math.PI) / 180, t2 = (angleAt(b.b, y, b.a) * Math.PI) / 180
      // плоская четвёрка: a(0,0), b(r2,0), x = r1(cos t1, sin t1), y = (r2 − r3 cos t2, ±r3 sin t2): цис — одна сторона
      const X = [r1 * Math.cos(t1), r1 * Math.sin(t1)]
      const Y = [r2 - r3 * Math.cos(t2), (cis ? 1 : -1) * r3 * Math.sin(t2)]
      const d = Math.hypot(Y[0] - X[0], Y[1] - X[1])
      cons.push({ a: x, b: y, d, k: 0.5 })
      if (!topo.has(bondKey(x, y))) topo.set(bondKey(x, y), 3)
    }
  }
  // топологические расстояния 1–4 (для отталкивания)
  for (const b of bonds) for (const x of nb[b.a].map((e) => e.to)) for (const y of nb[b.b].map((e) => e.to)) {
    if (x === b.b || y === b.a || x === y) continue
    if (!topo.has(bondKey(x, y))) topo.set(bondKey(x, y), 3)
  }
  const rep: C[] = []
  for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) {
    const t = topo.get(bondKey(a, b))
    if (t !== undefined && t <= 2) continue
    const hh = el[a] === 'H' && el[b] === 'H', hx = el[a] === 'H' || el[b] === 'H'
    const d = t === 3 ? (hh ? 2.2 : hx ? 2.45 : 2.55) : (hh ? 2.1 : hx ? 2.5 : 2.9)
    rep.push({ a, b, d, k: t === 3 ? 0.15 : 0.3, min: true })
  }
  // ── релаксация (проекция ограничений, Гаусс — Зейдель)
  const iters = opts.iterations ?? (ringy ? 300 : 160)
  // лёгкое детерминированное возмущение, чтобы кольца вышли из плоскости, где нужно
  let seed = 12345
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5 }
  if (ringy) for (let i = 0; i < N; i++) P[i] = add(P[i], [rnd() * 0.05, rnd() * 0.05, rnd() * 0.05])
  // плоские массивы для скорости: X — координаты, ограничения — (a, b, d, k)
  const X = new Float64Array(3 * N)
  P.forEach((p, i) => { X[3 * i] = p[0]; X[3 * i + 1] = p[1]; X[3 * i + 2] = p[2] })
  const pack = (L: C[]) => {
    const ab = new Int32Array(2 * L.length), dk = new Float64Array(2 * L.length)
    L.forEach((c, j) => { ab[2 * j] = 3 * c.a; ab[2 * j + 1] = 3 * c.b; dk[2 * j] = c.d; dk[2 * j + 1] = 0.5 * c.k })
    return { ab, dk, n: L.length }
  }
  const CS = pack(cons), RS = pack(rep)
  const run = (S: { ab: Int32Array; dk: Float64Array; n: number }, onlyMin: boolean) => {
    const { ab, dk, n } = S
    for (let j = 0; j < n; j++) {
      const ia = ab[2 * j], ib = ab[2 * j + 1]
      const dx = X[ib] - X[ia], dy = X[ib + 1] - X[ia + 1], dz = X[ib + 2] - X[ia + 2]
      const l2 = dx * dx + dy * dy + dz * dz
      const d = dk[2 * j]
      if (onlyMin && l2 >= d * d) continue
      const l = Math.sqrt(l2) || 1e-6
      const f = ((l - d) / l) * dk[2 * j + 1]
      X[ia] += dx * f; X[ia + 1] += dy * f; X[ia + 2] += dz * f
      X[ib] -= dx * f; X[ib + 1] -= dy * f; X[ib + 2] -= dz * f
    }
  }
  // линейные центры (sp): атом — на отрезке между соседями
  const lin = [...Array(N).keys()].filter((c) => hyb[c] === 'sp' && nb[c].length === 2).map((c) => {
    const [a, b] = nb[c].map((e) => e.to)
    return { c: 3 * c, a: 3 * a, b: 3 * b, f: len(c, a) / (len(c, a) + len(c, b)) }
  })
  const linProj = () => {
    for (const l of lin) for (let k = 0; k < 3; k++) {
      const t = X[l.a + k] + (X[l.b + k] - X[l.a + k]) * l.f
      const d = t - X[l.c + k]
      X[l.c + k] += d * 0.6; X[l.a + k] -= d * 0.3 * (1 - l.f); X[l.b + k] -= d * 0.3 * l.f
    }
  }
  for (let it = 0; it < iters; it++) {
    linProj()
    run(CS, false)
    if (it % 2 === 0 || it > iters - 20) run(RS, true)
  }
  for (let it = 0; it < 150; it++) { linProj(); run(CS, false) }
  for (let i = 0; i < N; i++) P[i] = [X[3 * i], X[3 * i + 1], X[3 * i + 2]]
  // центр масс в начало координат
  const cm: Vec3 = [0, 0, 0]
  for (const p of P) { cm[0] += p[0] / N; cm[1] += p[1] / N; cm[2] += p[2] / N }
  const atoms = P.map((p, i) => ({ el: el[i], p: sub(p, cm), hyb: hyb[i], charge: charge[i] }))
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now()
  return { atoms, bonds, src, heavy: m.n, ms: t1 - t0, idealLengths: r0, idealAngles }
}

/** Отклонения геометрии от идеала: наибольшие |Δдлины| (Å) и |Δугла| (°). */
export function geometryDeviation(e: Embedded3D): { maxBond: number; maxAngle: number; meanAngle: number } {
  let maxBond = 0, maxAngle = 0, sumA = 0
  e.bonds.forEach((b, j) => { maxBond = Math.max(maxBond, Math.abs(Math.hypot(...sub(e.atoms[b.a].p, e.atoms[b.b].p)) - e.idealLengths[j])) })
  for (const a of e.idealAngles) {
    const u = norm(sub(e.atoms[a.a].p, e.atoms[a.c].p)), v = norm(sub(e.atoms[a.b].p, e.atoms[a.c].p))
    const ang = (Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) * 180) / Math.PI
    const d = Math.abs(ang - a.deg)
    maxAngle = Math.max(maxAngle, d); sumA += d
  }
  return { maxBond, maxAngle, meanAngle: e.idealAngles.length ? sumA / e.idealAngles.length : 0 }
}

/**
 * RMSD двух наборов точек (одинаковый порядок) после наилучшего совмещения (кватернионный метод Хорна);
 * `allowMirror` — сравнить и с зеркальным отражением (стереоцентры без указанной конфигурации).
 */
export function alignedRmsd(A: readonly Vec3[], B: readonly Vec3[], allowMirror = true): number {
  const n = A.length
  if (!n) return 0
  const c = (X: readonly Vec3[]) => { const s: Vec3 = [0, 0, 0]; for (const p of X) { s[0] += p[0] / n; s[1] += p[1] / n; s[2] += p[2] / n } return X.map((p) => sub(p, s)) }
  const a = c(A)
  const run = (b: Vec3[]) => {
    const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
    let ga = 0, gb = 0
    for (let i = 0; i < n; i++) {
      for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) S[x][y] += a[i][x] * b[i][y]
      ga += dot(a[i], a[i]); gb += dot(b[i], b[i])
    }
    const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = S
    const K = [
      [xx + yy + zz, yz - zy, zx - xz, xy - yx],
      [yz - zy, xx - yy - zz, xy + yx, zx + xz],
      [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
      [xy - yx, zx + xz, yz + zy, -xx - yy + zz],
    ]
    const lmax = maxEigen4(K)
    return Math.sqrt(Math.max(0, (ga + gb - 2 * lmax) / n))
  }
  const b = c(B)
  const r1 = run(b)
  if (!allowMirror) return r1
  return Math.min(r1, run(b.map((p) => [p[0], p[1], -p[2]] as Vec3)))
}

/** Наибольшее собственное значение симметричной 4×4 (метод Якоби). */
function maxEigen4(M: number[][]): number {
  const A = M.map((r) => r.slice())
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0
    for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) off += A[p][q] * A[p][q]
    if (off < 1e-14) break
    for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) {
      if (Math.abs(A[p][q]) < 1e-18) continue
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q])
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1))
      const cs = 1 / Math.sqrt(t * t + 1), sn = t * cs
      for (let k = 0; k < 4; k++) {
        const akp = A[k][p], akq = A[k][q]
        A[k][p] = cs * akp - sn * akq; A[k][q] = sn * akp + cs * akq
      }
      for (let k = 0; k < 4; k++) {
        const apk = A[p][k], aqk = A[q][k]
        A[p][k] = cs * apk - sn * aqk; A[q][k] = sn * apk + cs * aqk
      }
    }
  }
  return Math.max(A[0][0], A[1][1], A[2][2], A[3][3])
}

/** Топологические расстояния (число связей) между всеми атомами. */
function allPairsTopo(nb: { to: number }[][]): number[][] {
  const N = nb.length
  return Array.from({ length: N }, (_, s0) => {
    const d = new Array(N).fill(99)
    d[s0] = 0
    const q = [s0]
    for (let h = 0; h < q.length; h++) { const v = q[h]; for (const e of nb[v]) if (d[e.to] === 99) { d[e.to] = d[v] + 1; q.push(e.to) } }
    return d
  })
}

/** Путь x–a=b–y лежит в цикле: x и y связаны в обход a и b (глубина ≤ 6). x или y = −1 — любой сосед. */
function inRingPath(nb: { to: number }[][], x: number, a: number, b: number, y: number): boolean {
  if (x < 0) return nb[a].some((e) => e.to !== b && inRingPath(nb, e.to, a, b, y))
  if (y < 0) return nb[b].some((e) => e.to !== a && inRingPath(nb, x, a, b, e.to))
  const seen = new Set([x, a, b])
  let front = [x]
  for (let depth = 0; depth < 6 && front.length; depth++) {
    const next: number[] = []
    for (const v of front) for (const e of nb[v]) {
      if (e.to === y) return true
      if (!seen.has(e.to)) { seen.add(e.to); next.push(e.to) }
    }
    front = next
  }
  return false
}

/** Классическое шкалирование: координаты по матрице «топологических» расстояний (≈ 1,25 Å на связь). */
function mdsLayout(T: number[][], P: Vec3[]): void {
  const N = T.length
  const dist = (k: number) => (k === 0 ? 0 : k === 1 ? 1.45 : k === 2 ? 2.45 : k >= 99 ? 10 : 1.25 * k + 0.2)
  const B = Array.from({ length: N }, (_, i) => T[i].map((k) => { const d = dist(k); return -0.5 * d * d }))
  const rm = B.map((r) => r.reduce((s, x) => s + x, 0) / N)
  const all = rm.reduce((s, x) => s + x, 0) / N
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) B[i][j] = B[i][j] - rm[i] - rm[j] + all
  const vecs: number[][] = []
  const vals: number[] = []
  let seed = 7
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5 }
  for (let k = 0; k < 3; k++) {
    let v = Array.from({ length: N }, rnd)
    let lam = 0
    for (let it = 0; it < 60; it++) {
      const w = new Array(N).fill(0)
      for (let i = 0; i < N; i++) { let s = 0; const r = B[i]; for (let j = 0; j < N; j++) s += r[j] * v[j]; w[i] = s }
      for (let p = 0; p < k; p++) { const d = w.reduce((s, x, i) => s + x * vecs[p][i], 0); for (let i = 0; i < N; i++) w[i] -= d * vecs[p][i] }
      const l = Math.sqrt(w.reduce((s, x) => s + x * x, 0)) || 1
      lam = l
      v = w.map((x) => x / l)
    }
    vecs.push(v); vals.push(lam)
  }
  for (let i = 0; i < N; i++) P[i] = [vecs[0][i] * Math.sqrt(vals[0]), vecs[1][i] * Math.sqrt(vals[1]), vecs[2][i] * Math.sqrt(Math.max(vals[2], 0.05))]
}
